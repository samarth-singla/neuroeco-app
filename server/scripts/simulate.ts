/**
 * End-to-end check of the game export: simulated players (the same headless player the client tests
 * use) go through the real HTTP API — consent, events, responses, steps — then wide.csv is
 * downloaded and checked: columns match the data dictionary, no required value is missing,
 * conditional columns are blank exactly when they should be, and key values match each player's
 * own game state (trap score, round-1 stake, final balance).
 *
 *   npm run simulate              (40 players, temporary in-memory database)
 *   npm run simulate -- 100       (other sample size)
 *
 * Exits with code 1 if any check fails. Also run by server/test/simulate.test.ts.
 */
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { all, openDb } from '../src/db';
import { createApp } from '../src/app';
import { wideColumns } from '../src/wide';
import { finalBalance, spinNet } from '../../client/src/game/economy';
import { mulberry32, simulateGame } from '../../client/src/game/sim';
import { STEPS } from '../../client/src/game/steps';
import { factsFromState, trapResult } from '../../client/src/game/traps';
import type { GameAssignment } from '../../client/src/game/reducer';

const PASSWORD = 'simulate-password';

function parseCsv(text: string): { header: string[]; rows: Record<string, string>[] } {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      out.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  const [header, ...body] = out;
  return { header, rows: body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]]))) };
}

/** Columns that may legitimately be blank, with the rule for when they must be blank. */
const CONDITIONAL: Record<string, (r: Record<string, string>) => boolean> = {
  escalation_ratio: (r) => r.r1_amount === '0',
  plan: (r) => r.s3_choice === 'skip',
  withdrew: (r) => r.withdrawal_offer === 'not_offered',
  tax_paid: (r) => r.skin === 'honest',
  trap_tax_paid: (r) => r.skin === 'honest',
  lambda: (r) => r.la_consistent === '0',
};

export interface SimulationResult {
  participants: number;
  completed: number;
  withdrawn: number;
  wideRows: number;
  errors: string[];
}

export async function runSimulation(n = 40, seed = 2026): Promise<SimulationResult> {
  const db = await openDb(':memory:');
  const server = createApp({ db, adminPassword: PASSWORD }).listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = async (url: string, body: unknown) => {
    const res = await fetch(base + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${url} → ${res.status} ${await res.text()}`);
    return res.json();
  };

  const errors: string[] = [];
  let completed = 0;
  let withdrawn = 0;
  const expected = new Map<string, { trap: number; r1: number; final: number }>();

  try {
    for (let i = 0; i < n; i++) {
      const p = (await post('/api/participants', { consented: true })) as {
        participant_id: string;
        assignment: GameAssignment;
      };
      const id = p.participant_id;
      const a: GameAssignment = { ...p.assignment };
      const sim = simulateGame(a, mulberry32(seed * 1000 + i));
      const dropOut = i % 10 === 9; // every 10th player stops at the crash screen
      const stopAt = dropOut ? STEPS.indexOf('g:crash') : Infinity;
      const events = sim.events
        .filter((e) => STEPS.indexOf(e.screen) < stopAt)
        .map((e, k) => ({
          client_ts: k * 1000,
          screen: e.screen,
          event_type: e.type,
          payload: e.payload,
        }));

      const traps = trapResult(factsFromState(sim.state, a.app_version));
      const final = finalBalance(sim.state.wallets, sim.state.spins);
      if (!dropOut) {
        // what the report card logs
        events.push({
          client_ts: events.length * 1000,
          screen: 'g:report',
          event_type: 'report_shown',
          payload: {
            trap_score: traps.score,
            trap_possible: traps.possible,
            traps: traps.fallen,
            spin_net: spinNet(sim.state.spins),
            final_balance: final,
          },
        });
      }
      for (let k = 0; k < events.length; k += 25) {
        await post('/api/events', { participant_id: id, events: events.slice(k, k + 25) });
      }
      const responses = Object.entries(sim.answers).map(([item_id, value]) => ({ item_id, value }));
      await post('/api/responses', { participant_id: id, responses });

      if (dropOut) {
        await post(`/api/participants/${id}/step`, { step: 'g:crash' });
        continue;
      }
      await post(`/api/participants/${id}/step`, { step: 'g:report' });
      completed++;
      if (i % 15 === 7) {
        await post(`/api/participants/${id}/withdraw`, {});
        withdrawn++;
      } else {
        await post(`/api/participants/${id}/step`, { step: 'g:end' });
        expected.set(id, { trap: traps.score, r1: sim.state.rounds[1]?.amount ?? 0, final });
      }
    }

    const res = await fetch(`${base}/api/export/wide.csv`, {
      headers: { Authorization: 'Basic ' + Buffer.from(`admin:${PASSWORD}`).toString('base64') },
    });
    if (!res.ok) throw new Error(`wide.csv → ${res.status}`);
    const { header, rows } = parseCsv(await res.text());

    // 1. Columns = data dictionary
    const cols = wideColumns().map((c) => c.name);
    if (header.join(',') !== cols.join(','))
      errors.push('wide.csv header does not match the data dictionary');

    // 2. One row per completed, non-withdrawn player
    if (rows.length !== expected.size)
      errors.push(`expected ${expected.size} rows, got ${rows.length}`);

    // 3. No missing required values; conditional columns blank exactly when they should be
    for (const r of rows) {
      const who = r.participant_id.slice(0, 8);
      for (const c of cols) {
        const blank = r[c] === '' || r[c] === undefined;
        const rule = CONDITIONAL[c];
        if (c === 'overconfidence') continue; // sample-level z-score, checked below
        if (rule) {
          if (blank !== rule(r))
            errors.push(`${who}: ${c} blank=${blank} but rule says ${rule(r)}`);
        } else if (blank) errors.push(`${who}: missing ${c}`);
      }
      if (r.tax_shown === '1' && r.skin !== 'fraud')
        errors.push(`${who}: tax shown to honest skin`);
      // 4. Cross-check against the player's own game state
      const e = expected.get(r.participant_id);
      if (!e) {
        errors.push(`${who}: unexpected row`);
        continue;
      }
      if (Number(r.trap_score) !== e.trap)
        errors.push(`${who}: trap_score ${r.trap_score} ≠ ${e.trap}`);
      if (Number(r.r1_amount) !== e.r1) errors.push(`${who}: r1_amount ${r.r1_amount} ≠ ${e.r1}`);
      if (Number(r.final_balance) !== e.final) errors.push(`${who}: final_balance mismatch`);
    }
    if (rows.length > 2 && rows.every((r) => r.overconfidence === '')) {
      errors.push('overconfidence blank for every row');
    }

    // 5. Balanced factors over everyone who consented
    for (const f of [
      'app_version',
      'round1_outcome',
      'withdrawal_offer',
      'referral_source',
      'money_source',
    ]) {
      const counts = await all<{ level: string; c: number }>(
        db,
        `SELECT ${f} AS level, COUNT(*) AS c FROM participants GROUP BY ${f}`,
      );
      const values = counts.map((x) => Number(x.c));
      if (values.length !== 2 || Math.abs(values[0] - values[1]) > 1) {
        errors.push(`factor ${f} unbalanced: ${JSON.stringify(counts)}`);
      }
    }
  } finally {
    server.close();
    db.close();
  }

  return { participants: n, completed, withdrawn, wideRows: expected.size, errors };
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const n = Number(process.argv[2] ?? 40);
  runSimulation(n)
    .then((r) => {
      console.log(
        `Simulated ${r.participants} players: ${r.completed} reached the report card, ${r.withdrawn} withdrew, ` +
          `${r.wideRows} rows in wide.csv.`,
      );
      if (r.errors.length) {
        console.error(`FAILED — ${r.errors.length} problem(s):`);
        for (const e of r.errors.slice(0, 50)) console.error('  - ' + e);
        process.exit(1);
      }
      console.log(
        'All checks passed: columns match the data dictionary, no required values missing.',
      );
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
