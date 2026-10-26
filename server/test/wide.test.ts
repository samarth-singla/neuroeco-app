import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { basicAuth, makeApp } from './helpers';
import { wideColumns } from '../src/wide';
import { ALL_ITEMS } from '../../client/src/config/survey';
import { renderDictionary } from '../scripts/data-dictionary';

type App = ReturnType<typeof makeApp>['app'];

function parseCsv(text: string): Record<string, string>[] {
  // Simple parser for our own output (quoted fields, "" escapes)
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const t = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') {
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
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

async function participant(app: App) {
  return (await request(app).post('/api/participants').send({ consented: true })).body as {
    participant_id: string;
    assignment: { withdrawal_offer: string };
  };
}

const ev = (screen: string, event_type: string, payload?: object) => ({
  screen,
  event_type,
  payload,
});

describe('wide.csv', () => {
  it('has one row per completed, non-withdrawn participant with behaviour and scores', async () => {
    const { app, db } = makeApp();
    const done = await participant(app);
    const unfinished = await participant(app);
    const withdrawn = await participant(app);
    // Force a known withdrawal condition for the checks below
    db.prepare("UPDATE participants SET withdrawal_offer = 'allowed' WHERE participant_id = ?").run(
      done.participant_id,
    );

    await request(app)
      .post('/api/events')
      .send({
        participant_id: done.participant_id,
        events: [
          ev('A2', 'screen_view'),
          ev('A2', 'verify_click'),
          ev('A2', 'invest_click', { plan_id: 'growth', decision_ms: 12345, first_decision: true }),
          ev('A3', 'deposit_submit', { round: 1, amount: 1000, plan_id: 'growth' }),
          ev('A5', 'chat_open', { kind: 'mentor' }),
          ev('A5', 'deposit_submit', { round: 2, amount: 2500, plan_id: 'growth' }),
          ev('A6', 'withdraw_click', { amount: 200 }),
          ev('A7', 'deposit_submit', { round: 3, amount: 0, plan_id: 'growth' }),
          ev('A8', 'topup_click'),
          ev('A8', 'topup_submit', { amount: 700 }),
          ev('A9', 'fee_shown', { fee: 300 }),
          ev('A9', 'fee_pay_click', { fee: 300 }),
        ],
      })
      .expect(200);

    const answers: Record<string, string | number> = {
      crt_1: 10,
      crt_2: 5,
      crt_3: 47,
      la_gain_50: 'reject',
      la_gain_100: 'reject',
      la_gain_150: 'reject',
      la_gain_200: 'accept',
      la_gain_250: 'accept',
      la_gain_300: 'accept',
      lit_interest: 'more',
      lit_inflation: 'less',
      lit_diversification: 'true',
      lit_self: 6,
      herd_1: 1,
      herd_2: 2,
      herd_3: 3,
      herd_4: 4,
      herd_5: 5,
      sus_1: 7,
      sus_2: 7,
      sus_3: 1,
      sus_4: 1,
      sus_5: 4,
      uiux_timer_urgency: 6,
      comments: 'Nice app, = fine',
    };
    for (const p of [done, unfinished, withdrawn]) {
      await request(app)
        .post('/api/responses')
        .send({
          participant_id: p.participant_id,
          responses: Object.entries(answers).map(([item_id, value]) => ({ item_id, value })),
        })
        .expect(200);
    }
    for (const p of [done, withdrawn]) {
      await request(app)
        .post(`/api/participants/${p.participant_id}/step`)
        .send({ step: 'debrief' })
        .expect(200);
    }
    await request(app).post(`/api/participants/${withdrawn.participant_id}/withdraw`).expect(200);

    const res = await request(app)
      .get('/api/export/wide.csv')
      .set('Authorization', basicAuth())
      .expect(200);
    const rows = parseCsv(res.text);
    expect(Object.keys(rows[0])).toEqual(wideColumns().map((c) => c.name));
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.participant_id).toBe(done.participant_id);
    expect(r).toMatchObject({
      a2_decision_time_s: '12.345',
      a2_choice: 'invest',
      invested: '1',
      plan: 'growth',
      r1_amount: '1000',
      r2_amount: '2500',
      escalation_ratio: '2.5',
      verify_click: '1',
      chat_open: '1',
      withdrew: '1',
      post_withdrawal_deposit: '0',
      topup_click: '1',
      topup: '1',
      topup_amount: '700',
      fee_shown: '1',
      fee_paid: '1',
      total_deposited: '4200',
      crt_1: '10',
      crt_score: '2',
      loss_aversion_lambda: '2',
      la_consistent: '1',
      la_accepted: '3',
      literacy_score: '2',
      self_rated_literacy: '6',
      herd_score: '3',
      susceptibility_index: '4',
      uiux_timer_urgency: '6',
      comments: 'Nice app, = fine',
      overconfidence: '', // only one row: SD undefined
    });
  });

  it('fills defaults for a participant who never invested', async () => {
    const { app, db } = makeApp();
    const p = await participant(app);
    db.prepare(
      "UPDATE participants SET withdrawal_offer = 'not_offered' WHERE participant_id = ?",
    ).run(p.participant_id);
    await request(app)
      .post('/api/events')
      .send({
        participant_id: p.participant_id,
        events: [
          ev('A2', 'exit_click', { decision_ms: 4000, first_decision: true }),
          ev('A8', 'topup_decline'),
        ],
      })
      .expect(200);
    await request(app).post(`/api/participants/${p.participant_id}/step`).send({ step: 'debrief' });
    const res = await request(app).get('/api/export/wide.csv').set('Authorization', basicAuth());
    const [r] = parseCsv(res.text);
    expect(r).toMatchObject({
      a2_choice: 'exit',
      a2_decision_time_s: '4',
      invested: '0',
      plan: '',
      r1_amount: '0',
      escalation_ratio: '',
      withdrew: '',
      topup: '0',
      fee_paid: '',
    });
  });

  it('includes every survey item as a column', () => {
    const names = wideColumns().map((c) => c.name);
    for (const { id } of ALL_ITEMS) expect(names).toContain(id);
    expect(new Set(names).size).toBe(names.length); // no duplicates
  });

  it('docs/data-dictionary.md is up to date (run npm run docs:dictionary)', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const doc = fs.readFileSync(path.join(root, 'docs', 'data-dictionary.md'), 'utf8');
    expect(doc.replace(/\r\n/g, '\n')).toBe(renderDictionary());
  });
});
