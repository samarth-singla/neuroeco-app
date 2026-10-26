/**
 * End-to-end check: runs simulated participants through the real HTTP API (random choices),
 * then downloads wide.csv and checks the columns and that no required value is missing.
 *
 *   npm run simulate              (40 participants, temporary in-memory database)
 *   npm run simulate -- 100       (other sample size)
 *
 * Exits with code 1 if any check fails. Also used by server/test/simulate.test.ts.
 */
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { openDb } from '../src/db';
import { createApp } from '../src/app';
import { wideColumns } from '../src/wide';
import {
  OPTIONAL_ITEM_IDS,
  surveyPages,
  uiuxPages,
  type Item,
} from '../../client/src/config/survey';
import { OUTCOMES, PLANS, WALLET } from '../../client/src/config/session';

const PASSWORD = 'simulate-password';

type Rng = () => number;

function mulberry32(seed: number): Rng {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Assignment {
  app_version: 'plain' | 'fraud';
  round1_outcome: 'small_win' | 'flat';
  withdrawal_offer: 'allowed' | 'not_offered';
  referral_source: 'friend' | 'ad';
  money_source: 'profit' | 'own';
  stake_order: number[];
}

interface Ev {
  screen: string;
  event_type: string;
  client_ts?: number;
  payload?: Record<string, unknown>;
}

/** Mirrors the client's app-session logic closely enough to produce realistic event logs. */
function simulateSession(a: Assignment, rng: Rng): Ev[] {
  const pick = <T>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  const chance = (p: number) => rng() < p;
  const events: Ev[] = [];
  let t = 0;
  const log = (screen: string, event_type: string, payload?: Record<string, unknown>) => {
    t += 200 + Math.floor(rng() * 3000);
    events.push({ screen, event_type, client_ts: t, payload });
  };
  const fraud = a.app_version === 'fraud';
  let cash = WALLET.startingCash;
  let app = 0;
  let bonus = fraud ? 500 : 0;
  const deposit = (amount: number) => {
    const x = Math.min(amount, cash);
    cash -= x;
    app += x;
    if (x > 0 && bonus > 0) {
      app += bonus;
      bonus = 0;
    }
    return x;
  };
  const amount = () => (chance(0.25) ? 0 : pick([500, 1000, 2000, 3000, 5000]));

  log('A1', 'screen_view');
  if (fraud) log('A1', 'bonus_shown', { amount: 500 });

  // A2
  log('A2', 'screen_view');
  if (chance(0.3)) {
    log('A2', 'verify_click');
    log('A2', 'verify_close', { open_ms: 2000 });
  }
  const invests = chance(0.75);
  const plan = pick(PLANS).id;
  const decision_ms = 1500 + Math.floor(rng() * 40000);
  let planId: string | null = null;
  if (invests) {
    log('A2', 'plan_select', { plan_id: plan });
    log('A2', 'invest_click', { plan_id: plan, decision_ms, first_decision: true });
    planId = plan;
    log('A3', 'screen_view');
    const r1 = deposit(amount());
    log('A3', 'deposit_submit', { round: 1, amount: r1, plan_id: planId });
  } else {
    log('A2', 'exit_click', { decision_ms, first_decision: true });
  }
  app = Math.round(app * (1 + OUTCOMES.round1Rate[a.round1_outcome]));
  log('A4', 'screen_view');
  log('A4', 'outcome_shown', { outcome: a.round1_outcome });

  // A5
  log('A5', 'screen_view');
  if (chance(0.4)) log('A5', 'chat_open', { kind: fraud ? 'mentor' : 'faq' });
  log('A5', 'deposit_submit', { round: 2, amount: deposit(amount()), plan_id: planId });

  // A6
  log('A6', 'screen_view');
  if (a.withdrawal_offer === 'allowed' && app > 0) {
    const w = Math.min(OUTCOMES.smallWithdrawal, app);
    log('A6', 'withdraw_offer_shown', { offered: true, amount: w, available: true });
    if (chance(0.7)) {
      log('A6', 'withdraw_click', { amount: w });
      app -= w;
      cash += w;
    } else log('A6', 'withdraw_skip', { amount: w });
  }

  // A7
  log('A7', 'screen_view');
  log('A7', 'deposit_submit', { round: 3, amount: deposit(amount()), plan_id: planId });

  // A8
  app = Math.round(app * (1 + OUTCOMES.lossRate));
  log('A8', 'screen_view');
  log('A8', 'loss_shown', {});
  if (chance(0.4)) {
    log('A8', 'topup_click');
    const x = deposit(pick([500, 1000, 2000]));
    log('A8', 'topup_submit', { amount: x });
  } else log('A8', 'topup_decline');

  // A9
  log('A9', 'screen_view');
  if (app > 0 && chance(0.85)) {
    log('A9', 'withdraw_final_click', { amount: app });
    if (fraud) {
      const fee = Math.round(app * OUTCOMES.feeRate);
      log('A9', 'fee_shown', { fee });
      log('A9', chance(0.4) ? 'fee_pay_click' : 'fee_decline_click', { fee });
    }
  } else if (app > 0) log('A9', 'withdraw_final_keep', { amount: app });
  log('A10', 'screen_view');
  return events;
}

function randomAnswer(item: Item, rng: Rng): string | number | null {
  const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  switch (item.type) {
    case 'likert':
      return int(1, 7);
    case 'choice':
      return item.options[Math.floor(rng() * item.options.length)].value;
    case 'number':
      if (item.id.startsWith('crt_')) return [5, 10, 47, 24, 100][int(0, 4)];
      return int(item.min, item.max);
    case 'slider':
      return int(0, item.max / item.step) * item.step;
    case 'text':
      return rng() < 0.3 ? 'Simulated comment, with a comma' : null;
  }
}

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

export interface SimulationResult {
  participants: number;
  completed: number;
  withdrawn: number;
  wideRows: number;
  errors: string[];
}

export async function runSimulation(n = 40, seed = 2026): Promise<SimulationResult> {
  const rng = mulberry32(seed);
  const db = openDb(':memory:');
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
  const expected = new Map<string, { a: Assignment; events: Ev[] }>();

  try {
    for (let i = 0; i < n; i++) {
      const p = (await post('/api/participants', { consented: true })) as {
        participant_id: string;
        assignment: Assignment;
      };
      const id = p.participant_id;
      const a = p.assignment;
      const events = simulateSession(a, rng);
      // Send events in batches, like the client
      for (let k = 0; k < events.length; k += 7) {
        await post('/api/events', { participant_id: id, events: events.slice(k, k + 7) });
      }
      await post(`/api/participants/${id}/step`, { step: 'uiux:0' });

      const finishes = i % 10 !== 9; // every 10th participant drops out during the survey
      const pages = [...uiuxPages(a.app_version), ...surveyPages(a)];
      const upto = finishes ? pages.length : Math.floor(pages.length / 2);
      for (let k = 0; k < upto; k++) {
        const responses = pages[k].items
          .map((item) => ({ item_id: item.id, value: randomAnswer(item, rng) }))
          .filter((r) => r.value !== null);
        await post('/api/responses', { participant_id: id, responses });
      }
      if (!finishes) continue;
      await post(`/api/participants/${id}/step`, { step: 'debrief' });
      completed++;
      if (i % 15 === 7) {
        await post(`/api/participants/${id}/withdraw`, {});
        withdrawn++;
      } else {
        await post(`/api/participants/${id}/step`, { step: 'thanks' });
        expected.set(id, { a, events });
      }
    }

    const res = await fetch(`${base}/api/export/wide.csv`, {
      headers: { Authorization: 'Basic ' + Buffer.from(`admin:${PASSWORD}`).toString('base64') },
    });
    if (!res.ok) throw new Error(`wide.csv → ${res.status}`);
    const { header, rows } = parseCsv(await res.text());

    // 1. Columns
    const cols = wideColumns().map((c) => c.name);
    if (header.join(',') !== cols.join(','))
      errors.push('wide.csv header does not match the data dictionary');

    // 2. Rows = completed and not withdrawn
    if (rows.length !== expected.size) {
      errors.push(`expected ${expected.size} rows in wide.csv, got ${rows.length}`);
    }

    // 3. Required values
    const alwaysRequired = [
      'participant_id',
      'is_pilot',
      'created_at',
      'completed_at',
      'app_version',
      'round1_outcome',
      'withdrawal_offer',
      'referral_source',
      'money_source',
      'stake_order',
      'a2_decision_time_s',
      'a2_choice',
      'invested',
      'r1_amount',
      'r2_amount',
      'verify_click',
      'chat_open',
      'post_withdrawal_deposit',
      'topup_click',
      'topup',
      'topup_amount',
      'fee_shown',
      'total_deposited',
      'crt_score',
      'la_consistent',
      'la_accepted',
      'literacy_score',
      'self_rated_literacy',
      'overconfidence',
      'herd_score',
      'susceptibility_index',
    ];
    const itemColumns = cols.filter(
      (c) => (c.startsWith('uiux_') || pagesItemIds.has(c)) && !OPTIONAL_ITEM_IDS.includes(c),
    );
    for (const r of rows) {
      const who = r.participant_id.slice(0, 8);
      for (const c of [...alwaysRequired, ...itemColumns]) {
        if (r[c] === undefined || r[c] === '') errors.push(`${who}: missing ${c}`);
      }
      // Conditional columns
      const r1 = Number(r.r1_amount);
      if (r1 > 0 !== (r.escalation_ratio !== '')) errors.push(`${who}: escalation_ratio vs r1`);
      if (r1 > 0 !== (r.plan !== '')) errors.push(`${who}: plan vs r1`);
      if ((r.withdrawal_offer === 'allowed') !== (r.withdrew !== ''))
        errors.push(`${who}: withdrew`);
      if ((r.fee_shown === '1') !== (r.fee_paid !== ''))
        errors.push(`${who}: fee_paid vs fee_shown`);
      if (r.fee_shown === '1' && r.app_version !== 'fraud')
        errors.push(`${who}: fee shown to plain`);
      if ((r.la_consistent === '1') !== (r.loss_aversion_lambda !== '')) errors.push(`${who}: λ`);

      // Cross-check behaviour against what was sent
      const sent = expected.get(r.participant_id);
      if (!sent) {
        errors.push(`${who}: unexpected row`);
        continue;
      }
      const d1 = sent.events.find(
        (e) => e.event_type === 'deposit_submit' && e.payload?.round === 1,
      );
      if (Number(r.r1_amount) !== ((d1?.payload?.amount as number) ?? 0))
        errors.push(`${who}: r1_amount`);
      const d = sent.events.find(
        (e) => e.event_type === 'invest_click' || e.event_type === 'exit_click',
      );
      const ms = d?.payload?.decision_ms as number;
      if (Math.abs(Number(r.a2_decision_time_s) - ms / 1000) > 1e-9)
        errors.push(`${who}: decision time`);
    }

    // 4. Balance of randomized factors over everyone who consented
    for (const f of [
      'app_version',
      'round1_outcome',
      'withdrawal_offer',
      'referral_source',
      'money_source',
    ]) {
      const counts = db
        .prepare(`SELECT ${f} AS level, COUNT(*) AS c FROM participants GROUP BY ${f}`)
        .all() as { level: string; c: number }[];
      const values = counts.map((x) => x.c);
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

const pagesItemIds = new Set(
  surveyPages({
    referral_source: 'friend',
    money_source: 'own',
    stake_order: [500, 5000, 50000],
  }).flatMap((p) => p.items.map((i) => i.id)),
);

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const n = Number(process.argv[2] ?? 40);
  runSimulation(n)
    .then((r) => {
      console.log(
        `Simulated ${r.participants} participants: ${r.completed} completed, ${r.withdrawn} withdrew, ` +
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
