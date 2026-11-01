import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { basicAuth, makeApp } from './helpers';
import { run } from '../src/db';
import { wideColumns } from '../src/wide';
import { GAME_ITEM_IDS } from '../../client/src/config/game';
import { renderDictionary } from '../scripts/data-dictionary';

type App = Awaited<ReturnType<typeof makeApp>>['app'];
type DB = Awaited<ReturnType<typeof makeApp>>['db'];

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const t = text.replace(String.fromCharCode(0xfeff), '');
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

const ev = (screen: string, event_type: string, payload?: object) => ({
  screen,
  event_type,
  payload,
});

async function player(app: App, db: DB, set: Record<string, string>) {
  const p = (await request(app).post('/api/participants').send({ consented: true })).body as {
    participant_id: string;
  };
  for (const [k, v] of Object.entries(set)) {
    await run(db, `UPDATE participants SET ${k} = ? WHERE participant_id = ?`, [
      v,
      p.participant_id,
    ]);
  }
  return p.participant_id;
}

async function wide(app: App) {
  const res = await request(app)
    .get('/api/export/wide.csv')
    .set('Authorization', basicAuth())
    .expect(200);
  return { text: res.text, rows: parseCsv(res.text) };
}

describe('wide.csv (game)', () => {
  it('derives behaviour measures, traps and scores from the event log', async () => {
    const { app, db } = await makeApp();
    const id = await player(app, db, {
      app_version: 'fraud',
      withdrawal_offer: 'allowed',
      money_source: 'profit',
      deal_order: '8000,500,3000',
    });
    await request(app)
      .post('/api/events')
      .send({
        participant_id: id,
        events: [
          ev('g:home', 'vip_popup_shown', {}),
          ev('g:home', 'vip_popup_close', { ms: 4200 }),
          ev('g:home', 'verify_open', { what: 'tnc' }),
          ev('g:home', 's3_invest', { plan_id: 'growth', decision_ms: 12345 }),
          ev('g:round:1', 'round_invest', { round: 1, amount: 1000, since_chat_ms: null }),
          ev('g:round:1', 'vip_level_up', { level: 1 }),
          ev('g:round:1', 'vip_nudge_tap', { round: 1, amount: 4000 }),
          ev('g:brain:0', 'brain_answer', { id: 'crt_1', correct: true }),
          ev('g:round:2', 'round_invest', { round: 2, amount: 2500, since_chat_ms: null }),
          ev('g:round:3', 'vip_upgrade_tap', {}),
          ev('g:round:3', 'round_invest', { round: 3, amount: 2000, since_chat_ms: null }),
          ev('g:chat', 'chat_shown', { kind: 'mentor' }),
          ev('g:chat', 'chat_open', { kind: 'mentor' }),
          ev('g:round:4', 'round_invest', { round: 4, amount: 500, since_chat_ms: 30000 }),
          ev('g:deal', 'deal_skip', { size: 8000, details_before: true, decision_ms: 9000 }),
          ev('g:deal', 'deal_invest', {
            size: 500,
            amount: 500,
            details_before: false,
            decision_ms: 2000,
          }),
          ev('g:deal', 'deal_invest', {
            size: 3000,
            amount: 3000,
            details_before: true,
            decision_ms: 6000,
          }),
          ev('g:pool', 'pool_join', { amount: 2000, details_before: false, decision_ms: 4000 }),
          ev('g:withdraw', 'test_withdraw', { amount: 500 }),
          ev('g:withdraw', 'post_withdrawal_deposit', { amount: 1000 }),
          ev('g:reinvest', 'reinvest', { amount: 1500, from: 'profit' }),
          ev('g:crash', 'crash', { loss: 4000 }),
          ev('g:crash', 'crash_topup', { amount: 700, decision_ms: 5000 }),
          ev('g:cashout', 'tax_shown', { tax: 900 }),
          ev('g:cashout', 'tax_pay', { tax: 900 }),
          ev('g:brain:1', 'brain_answer', { id: 'lit_interest', correct: false }),
          ev('g:report', 'report_shown', { trap_score: 10, spin_net: -50, final_balance: 9123 }),
        ],
      })
      .expect(200);
    const answers: Record<string, string | number> = {
      crt_1: 5,
      lit_interest: 'more',
      lit_inflation: 'less',
      lit_diversification: 'true',
      lit_self: 6,
      la_gain_150: 'reject',
      la_gain_250: 'accept',
      fomo_1: 'agree',
      fomo_2: 'disagree',
      fomo_3: 'agree',
      feature_push_timer: 'yes',
      feature_push_bonus: 'no',
      feature_push_vip: 'yes',
      feature_push_regulator: 'no',
      feature_push_social: 'no',
      feature_push_chat: 'yes',
      feature_push_tax: 'no',
    };
    await request(app)
      .post('/api/responses')
      .send({
        participant_id: id,
        responses: Object.entries(answers).map(([item_id, value]) => ({ item_id, value })),
      })
      .expect(200);
    await request(app).post(`/api/participants/${id}/step`).send({ step: 'g:report' }).expect(200);

    const { text, rows } = await wide(app);
    expect(text.split('\r\n')[0].replace(String.fromCharCode(0xfeff), '')).toBe(
      wideColumns()
        .map((c) => c.name)
        .join(','),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      skin: 'fraud',
      reinvest_framing: 'profit',
      deal_order: '8000;500;3000',
      decision_time_first_invest: '12.345',
      s3_choice: 'invest',
      plan: 'growth',
      verify_any: '1',
      verify_count: '1',
      r1_amount: '1000',
      r2_amount: '2500',
      r3_amount: '2000',
      r4_amount: '500',
      escalation_ratio: '2.5',
      vip_upgrade: '1',
      vip_level: '3',
      vip_taps: '1',
      vip_popup_time: '4.2',
      vip_nudge_taps: '1',
      vip_level_ups: '1',
      chat_open: '1',
      chat_deposit: '1',
      deal_invest_8000: '0',
      deal_details_8000: '1',
      deal_time_8000: '9',
      deal_invest_500: '1',
      deal_details_500: '0',
      pool_join: '1',
      pool_details: '0',
      withdrew: '1',
      post_withdrawal_deposit: '1000',
      reinvest_accept: '1',
      reinvest_amount: '1500',
      crash_loss: '4000',
      crash_topup: '1',
      crash_topup_amount: '700',
      tax_shown: '1',
      tax_paid: '1',
      brain_correct: '1',
      spin_net: '-50',
      final_balance: '9123',
      trap_score: '9', // recomputed from events (the logged report value is ignored); no_verify avoided
      trap_possible: '10',
      trap_hook: '1',
      trap_no_verify: '0',
      crt_correct: '1',
      loss_aversion_group: '2',
      la_consistent: '1',
      la_accepted: '1',
      literacy_score: '2',
      self_rated_literacy: '6',
      feature_push_count: '3',
      fomo_score: '2',
      total_deposited: String(1000 + 2500 + 2000 + 500 + 500 + 3000 + 2000 + 1000 + 1500 + 700),
    });
  });

  it('honest skin: tax, chat, feature-card and VIP columns blank; not-offered withdrawal blank; never-invested defaults', async () => {
    const { app, db } = await makeApp();
    const id = await player(app, db, { app_version: 'plain', withdrawal_offer: 'not_offered' });
    await request(app)
      .post('/api/events')
      .send({
        participant_id: id,
        events: [
          ev('g:home', 's3_skip', { plan_id: null, decision_ms: 4000 }),
          ev('g:round:1', 'round_skip', { round: 1 }),
          ev('g:cashout', 'cashout', { amount: 9000 }),
        ],
      });
    await request(app).post(`/api/participants/${id}/step`).send({ step: 'g:report' });
    const [r] = (await wide(app)).rows;
    expect(r).toMatchObject({
      skin: 'honest',
      s3_choice: 'skip',
      plan: '',
      r1_amount: '0',
      escalation_ratio: '',
      withdrew: '',
      tax_shown: '0',
      tax_paid: '',
      trap_tax_paid: '',
      trap_chat: '',
      trap_possible: '8',
      trap_no_verify: '1',
      chat_open: '',
      chat_deposit: '',
      feature_push_timer: '',
      feature_push_count: '',
      vip_level: '0',
      vip_popup_time: '',
      vip_nudge_taps: '',
      vip_level_ups: '',
    });
  });

  it('leaves out unfinished, withdrawn and original-survey participants', async () => {
    const { app, db } = await makeApp();
    const done = await player(app, db, {});
    const unfinished = await player(app, db, {});
    const gone = await player(app, db, {});
    const v1 = await player(app, db, {});
    await request(app).post(`/api/participants/${done}/step`).send({ step: 'g:report' });
    await request(app).post(`/api/participants/${unfinished}/step`).send({ step: 'g:crash' });
    await request(app).post(`/api/participants/${gone}/step`).send({ step: 'g:report' });
    await run(db, 'UPDATE participants SET withdrawn = 1 WHERE participant_id = ?', [gone]); // legacy flag
    await request(app).post(`/api/participants/${v1}/step`).send({ step: 'debrief' });
    const { rows } = await wide(app);
    expect(rows.map((r) => r.participant_id)).toEqual([done]);
  });

  it('exports every derived variable listed in REDESIGN_PLAN.md section 5', () => {
    const names = wideColumns().map((c) => c.name);
    const section5 = [
      'decision_time_first_invest',
      'verify_any',
      'total_deposited',
      'vip_upgrade',
      'chat_deposit',
      'escalation_ratio',
      'deal_invest_500',
      'deal_invest_3000',
      'deal_invest_8000',
      'deal_details_500',
      'deal_details_3000',
      'deal_details_8000',
      'loss_aversion_group', // replaces lambda (Playtest fixes 2)
      'crash_topup',
      'crash_topup_amount',
      'pool_join',
      'pool_details',
      'post_withdrawal_deposit',
      'reinvest_accept',
      'reinvest_amount',
      'tax_paid',
      'crt_correct', // replaces crt_score (single CRT item)
      'literacy_score',
      'overconfidence',
      'trap_score',
      'feature_push_timer',
      'feature_push_bonus',
      'feature_push_vip',
      'feature_push_regulator',
      'feature_push_social',
      'feature_push_chat',
      'feature_push_tax',
      'app_trust',
      'app_urgency',
      'fomo_score',
      'final_balance',
    ];
    for (const v of section5) expect(names, v).toContain(v);
  });

  it('has every game response item as a column, no duplicates', () => {
    const names = wideColumns().map((c) => c.name);
    for (const id of GAME_ITEM_IDS) expect(names).toContain(id);
    expect(new Set(names).size).toBe(names.length);
  });

  it('docs/data-dictionary.md is up to date (run npm run docs:dictionary)', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const doc = fs.readFileSync(path.join(root, 'docs', 'data-dictionary.md'), 'utf8');
    expect(doc.replace(/\r\n/g, '\n')).toBe(renderDictionary());
  });
});
