/**
 * wide.csv: one row per player who reached the report card (S14) and did not withdraw, with the
 * assignment, behaviour measures recomputed from the event log, every response item and the
 * derived scores (REDESIGN_PLAN.md §5).
 *
 * `wideColumns()` is also the source of docs/data-dictionary.md (npm run docs:dictionary).
 */
import type { DB } from './db';
import { all } from './db';
import { toCsv, type Cell } from './csv';
import {
  BRAIN,
  ECONOMY,
  FEATURES,
  FOMO,
  GAME_ITEM_IDS,
  PROFILE,
  SLIDERS,
  SPINS,
  TRAP_TEXT,
  type Skin,
} from '../../client/src/config/game';
import { factsFromEvents, TRAPS, trapResult } from '../../client/src/game/traps';
import { crtScore, literacyScore, lossAversion, overconfidence, type Answers } from './scoring';

export interface Column {
  name: string;
  description: string;
  hypotheses: string;
  group:
    | 'Identifiers & assignments'
    | 'App behaviour (event log)'
    | 'Traps'
    | 'Response items'
    | 'Derived scores';
}

type Def = [name: string, description: string, hypotheses: string];
const cols = (group: Column['group'], defs: Def[]): Column[] =>
  defs.map(([name, description, hypotheses]) => ({ name, description, hypotheses, group }));

const DEALS = ECONOMY.deals.sizes;
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const vip2 = ECONOMY.vipTiers.find((t) => t.level === ECONOMY.vipUpgradeLevel)!;

const ASSIGNMENT_COLUMNS = cols('Identifiers & assignments', [
  ['participant_id', 'Random UUID created at consent', '—'],
  [
    'is_pilot',
    '1 = joined through a `?pilot=1` link (exclude from analysis), 0 = real participant',
    '—',
  ],
  ['created_at', 'Consent time (ISO, UTC)', '—'],
  ['completed_at', 'Time the report card (S14) was reached (ISO, UTC)', '—'],
  [
    'skin',
    'IV. `honest` ("ZenTrade") or `fraud` ("ZenTrade X", dark-design layer); stored as `app_version` plain / fraud',
    'H1, H1a–H1g',
  ],
  ['round1_outcome', 'IV. Round-1 result: `small_win` (+8%) or `flat` (0%)', 'H2'],
  ['pool_source', 'IV. Diamond Pool invite: `friend` message or sponsored `ad`', 'H5'],
  ['withdrawal_offer', 'IV. Test withdrawal (S9): `allowed` or `not_offered`', 'H6'],
  [
    'reinvest_framing',
    'IV. Gold Plan offer (S10): `profit` (from Profit wallet) or `main` (from Main wallet)',
    'H7',
  ],
  [
    'deal_order',
    'Order the flash deals were shown, ₹ (e.g. `8000;500;3000`)',
    'H3 (order control)',
  ],
  ['spin_order', 'Order the bonus spins were shown (win amounts, ₹)', 'H4 (order control)'],
]);

const BEHAVIOUR_COLUMNS = cols('App behaviour (event log)', [
  [
    'decision_time_first_invest',
    'Seconds from first render of the home dashboard (S3) to the first Invest / Skip tap',
    'H1, H1a, H1e',
  ],
  ['s3_choice', '`invest` or `skip` on the home dashboard (S3)', 'H1, H1b'],
  ['plan', 'Plan chosen on S3 (`starter`, `growth`, `turbo`); blank if skipped', 'H1'],
  [
    'verify_any',
    '1 = opened the T&C, plan details, deal or pool details, or the badge / About page at least once',
    'H1, H1d',
  ],
  ['verify_count', 'Number of times any of those was opened', 'H1, H1d'],
  [
    'total_deposited',
    'Sum of every amount invested (round stakes, deals, pool, deposits, Gold Plan, top-up), ₹',
    'H1',
  ],
  [
    'vip_upgrade',
    `1 = total deposited reached VIP ${vip2.level} (${inr(vip2.minDeposited)}). VIP is shown only in the fraud skin; the threshold is computed for both`,
    'H1c',
  ],
  ['vip_taps', 'Times the VIP "Upgrade" shortcut was tapped (fraud skin only)', 'H1c'],
  ...[1, 2, 3, 4, 5, 6].map((r): Def => [
    `r${r}_amount`,
    `Round ${r} stake, ₹ (0 if skipped)`,
    r <= 2 ? 'H1, H2' : 'H1',
  ]),
  ['escalation_ratio', 'r2_amount ÷ r1_amount; blank if r1_amount = 0', 'H2'],
  ['chat_open', '1 = opened the mentor chat (fraud) / Help & FAQ (honest) on S6', 'H1f'],
  [
    'chat_deposit',
    `1 = invested within ${ECONOMY.chatDepositWindowMs / 1000} s after S6 appeared`,
    'H1f',
  ],
  ...DEALS.flatMap((d): Def[] => [
    [`deal_invest_${d}`, `1 = invested in the ${inr(d)} flash deal`, 'H3'],
    [`deal_details_${d}`, `1 = opened the ${inr(d)} deal's details before deciding`, 'H3'],
    [`deal_time_${d}`, `Seconds to decide on the ${inr(d)} deal`, 'H3'],
  ]),
  ['pool_join', '1 = joined the Diamond Pool (S8)', 'H5'],
  ['pool_details', '1 = opened the pool details before deciding', 'H5'],
  ['pool_time', 'Seconds to decide on the pool invite', 'H5'],
  [
    'withdrew',
    `1 = made the ${inr(ECONOMY.testWithdrawal)} test withdrawal; 0 = declined; blank if not offered`,
    'H6',
  ],
  [
    'post_withdrawal_deposit',
    `Deposit right after the withdrawal stage (S9), ₹0–${ECONOMY.postWithdrawalMax}`,
    'H6',
  ],
  ['reinvest_accept', '1 = put money into the Gold Plan (S10)', 'H7'],
  ['reinvest_amount', `Gold Plan amount, ₹0–${ECONOMY.reinvest.amount}`, 'H7'],
  ['crash_loss', 'Loss from the scripted 40% crash (S11), ₹', 'H4'],
  ['crash_topup', '1 = topped up after the crash', 'H4'],
  ['crash_topup_amount', 'Top-up amount, ₹ (0 if none)', 'H4'],
  ['crash_time', 'Seconds to decide after the crash', 'H4'],
  ['tax_shown', '1 = saw the withdrawal "tax" screen (fraud skin)', 'H1g'],
  ['tax_paid', '1 = paid the tax, 0 = refused; blank for the honest skin', 'H1g'],
  ['brain_correct', 'Correct brain-bonus answers (0–6; CRT + literacy)', 'H1, H8'],
  [
    'spin_net',
    'Net result of the accepted bonus spins, ₹ (revealed on the report card)',
    'Descriptive',
  ],
  [
    'final_balance',
    'Final balance on the report card (Main + Profit + Portfolio + Cashed out − tax + spins), ₹',
    'Prize draw, descriptive',
  ],
]);

const TRAP_COLUMNS = cols('Traps', [
  ['trap_score', 'Number of traps fallen for (same function as the report card)', 'H8, H9'],
  ['trap_possible', 'Traps possible: 10 (fraud) or 9 (honest — no tax screen)', 'H8, H9'],
  ...TRAPS.map((t): Def => [
    `trap_${t.id}`,
    `1 = ${TRAP_TEXT[t.id].plain}${t.fraudOnly ? ' (fraud skin only; blank for honest)' : ''}`,
    'H8, H9',
  ]),
]);

function choices(options: { value: string }[]) {
  return options.map((o) => `\`${o.value}\``).join(' / ');
}

function itemDef(id: string): Def {
  const p = PROFILE.find((q) => q.id === id);
  if (p) {
    const values = p.kind === 'choice' ? choices(p.options) : '1–7';
    const h =
      id === 'lit_self' ? 'H8 (self-rated literacy)' : id === 'exp_fin_edu' ? 'H8' : 'Controls, H9';
    return [id, `S1 profile: ${p.text} (${values})`, h];
  }
  if (id.startsWith('la_gain_')) {
    return [
      id,
      `S2 spin "50% lose ₹${SPINS.loss} / 50% win ₹${id.slice(8)}": \`accept\` / \`reject\``,
      'H4',
    ];
  }
  const b = BRAIN.find((q) => q.id === id);
  if (b) {
    const text = b.text.length > 90 ? `${b.text.slice(0, 87)}…` : b.text;
    const values = b.kind === 'choice' ? choices(b.options) : 'number';
    return [
      id,
      `S5 brain bonus: ${text} (${values})`,
      id.startsWith('crt') ? 'H1 (moderator)' : 'H8',
    ];
  }
  const f = FEATURES.find((x) => `feature_push_${x.id}` === id);
  if (f) {
    return [
      id,
      `S13 "Did this push you to invest?" — ${f.label.fraud} (fraud) / ${f.label.plain} (honest): \`yes\` / \`no\``,
      'H1h',
    ];
  }
  const s = SLIDERS.find((q) => q.id === id);
  if (s) return [id, `S13: ${s.text} (1–7)`, id === 'app_trust' ? 'H1, H6' : 'H1'];
  const fo = FOMO.find((q) => q.id === id);
  if (fo) return [id, `S13: "${fo.text}" (\`agree\` / \`disagree\`)`, 'H5 (moderator), H9'];
  return [id, id, '—'];
}

const ITEM_COLUMNS = cols('Response items', GAME_ITEM_IDS.map(itemDef));

const DERIVED_COLUMNS = cols('Derived scores', [
  ['crt_score', 'Cognitive Reflection Test score 0–3 (correct: 5, 5, 47)', 'H1 (moderator)'],
  [
    'lambda',
    'Loss aversion λ from the bonus spins = smallest accepted gain ÷ ₹100 (0.5–3.0); 3.5 if all rejected; blank if inconsistent',
    'H4, H8, H9',
  ],
  [
    'la_consistent',
    '1 = spin choices switch at most once (reject → accept), 0 = inconsistent',
    'H4',
  ],
  ['la_accepted', 'Number of the six spins accepted (0–6)', 'H4'],
  ['literacy_score', 'Big Three financial literacy score 0–3 ("don\'t know" = wrong)', 'H8'],
  ['self_rated_literacy', 'Self-rated "How good are you with money?" 1–7 (= `lit_self`)', 'H8'],
  [
    'overconfidence',
    'z(self_rated_literacy) − z(literacy_score), z over the rows in this export (sample SD); blank if either SD is 0',
    'H8',
  ],
  ['feature_push_count', 'Number of the 7 features answered "yes, it pushed me to invest"', 'H1h'],
  ['fomo_score', 'Number of the 3 FOMO statements agreed with (0–3)', 'H5 (moderator), H9'],
]);

export function wideColumns(): Column[] {
  return [
    ...ASSIGNMENT_COLUMNS,
    ...BEHAVIOUR_COLUMNS,
    ...TRAP_COLUMNS,
    ...ITEM_COLUMNS,
    ...DERIVED_COLUMNS,
  ];
}

// ---------------------------------------------------------------------------------------------

type Payload = Record<string, unknown>;
export interface Ev {
  event_type: string;
  payload: Payload;
}

function parse(p: string | null): Payload {
  if (!p) return {};
  try {
    const v = JSON.parse(p);
    return typeof v === 'object' && v !== null ? (v as Payload) : {};
  } catch {
    return {};
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const secs = (ms: unknown) => {
  const n = num(ms);
  return n === null ? null : Math.round(n) / 1000;
};
const yes = (b: boolean) => (b ? 1 : 0);

/** Behaviour measures and traps for one player, from their events in logged order. */
export function behaviour(events: Ev[], skin: Skin, withdrawalOffer: string): Record<string, Cell> {
  const of = (t: string) => events.filter((e) => e.event_type === t);
  const last = (t: string) => of(t).at(-1)?.payload;
  const first = (...types: string[]) => events.find((e) => types.includes(e.event_type));
  const round = (r: number) => {
    const inv = of('round_invest')
      .filter((e) => e.payload.round === r)
      .at(-1);
    return inv ? (num(inv.payload.amount) ?? 0) : 0;
  };
  const r1 = round(1);
  const r2 = round(2);
  const facts = factsFromEvents(events, skin);
  const traps = trapResult(facts);
  const s3 = first('s3_invest', 's3_skip');
  const pool = first('pool_join', 'pool_skip');
  const topup = first('crash_topup', 'crash_leave');
  const tax = first('tax_pay', 'tax_decline');
  const withdraw = first('test_withdraw', 'test_withdraw_skip');
  const report = last('report_shown');

  const row: Record<string, Cell> = {
    decision_time_first_invest: secs(s3?.payload.decision_ms),
    s3_choice: s3 ? (s3.event_type === 's3_invest' ? 'invest' : 'skip') : null,
    plan: s3?.event_type === 's3_invest' ? ((s3.payload.plan_id as string | null) ?? null) : null,
    verify_any: yes(facts.verifyAny),
    verify_count: of('verify_open').length,
    total_deposited: facts.totalDeposited,
    vip_upgrade: yes(traps.fallen.includes('vip')),
    vip_taps: of('vip_upgrade_tap').length,
    r1_amount: r1,
    r2_amount: r2,
    r3_amount: round(3),
    r4_amount: round(4),
    r5_amount: round(5),
    r6_amount: round(6),
    escalation_ratio: r1 > 0 ? Math.round((r2 / r1) * 10000) / 10000 : null,
    chat_open: yes(of('chat_open').length > 0),
    chat_deposit: yes(facts.chatDeposit),
    pool_join: pool ? yes(pool.event_type === 'pool_join') : null,
    pool_details: pool ? yes(pool.payload.details_before === true) : null,
    pool_time: secs(pool?.payload.decision_ms),
    withdrew: withdrawalOffer === 'allowed' ? yes(withdraw?.event_type === 'test_withdraw') : null,
    post_withdrawal_deposit: facts.postWithdrawalDeposit,
    reinvest_accept: yes(facts.reinvestAmount > 0),
    reinvest_amount: facts.reinvestAmount,
    crash_loss: num(last('crash')?.loss),
    crash_topup: yes(facts.crashTopup),
    crash_topup_amount: num(last('crash_topup')?.amount) ?? 0,
    crash_time: secs(topup?.payload.decision_ms),
    tax_shown: yes(of('tax_shown').length > 0),
    tax_paid: skin === 'fraud' && tax ? yes(tax.event_type === 'tax_pay') : null,
    brain_correct: of('brain_answer').filter((e) => e.payload.correct === true).length,
    spin_net: num(report?.spin_net),
    final_balance: num(report?.final_balance),
    trap_score: traps.score,
    trap_possible: traps.possible,
  };
  for (const d of DEALS) {
    const e = events.find(
      (x) =>
        (x.event_type === 'deal_invest' || x.event_type === 'deal_skip') && x.payload.size === d,
    );
    row[`deal_invest_${d}`] = e ? yes(e.event_type === 'deal_invest') : null;
    row[`deal_details_${d}`] = e ? yes(e.payload.details_before === true) : null;
    row[`deal_time_${d}`] = secs(e?.payload.decision_ms);
  }
  for (const t of TRAPS) {
    row[`trap_${t.id}`] = t.fraudOnly && skin !== 'fraud' ? null : yes(traps.fallen.includes(t.id));
  }
  return row;
}

const round4 = (v: number | null) => (v === null ? null : Math.round(v * 10000) / 10000);

interface ParticipantRow {
  participant_id: string;
  is_pilot?: number;
  created_at: string;
  completed_at: string;
  app_version: Skin;
  round1_outcome: string;
  withdrawal_offer: string;
  referral_source: string;
  money_source: string;
  deal_order: string | null;
  spin_order: string | null;
}

// DECISION: wide.csv holds game players only (current step `g:…`); data from the original survey
// flow stays in the raw exports.
const ELIGIBLE = `completed_at IS NOT NULL AND withdrawn = 0 AND current_step LIKE 'g:%'`;

/** Rows for wide.csv, in consent order. */
export async function wideRows(db: DB): Promise<Record<string, Cell>[]> {
  const participants = await all<ParticipantRow>(
    db,
    `SELECT * FROM participants WHERE ${ELIGIBLE} ORDER BY created_at`,
  );
  const inEligible = `participant_id IN (SELECT participant_id FROM participants WHERE ${ELIGIBLE})`;
  const events = await all<{ participant_id: string; event_type: string; payload: string | null }>(
    db,
    `SELECT participant_id, event_type, payload FROM events WHERE ${inEligible} ORDER BY id`,
  );
  const responses = await all<{ participant_id: string; item_id: string; value: string | null }>(
    db,
    `SELECT participant_id, item_id, value FROM responses WHERE ${inEligible}`,
  );

  const eventsBy = new Map<string, Ev[]>();
  for (const e of events) {
    const list = eventsBy.get(e.participant_id) ?? [];
    list.push({ event_type: e.event_type, payload: parse(e.payload) });
    eventsBy.set(e.participant_id, list);
  }
  const answersBy = new Map<string, Answers>();
  for (const r of responses) {
    const a = answersBy.get(r.participant_id) ?? {};
    a[r.item_id] = r.value ?? undefined;
    answersBy.set(r.participant_id, a);
  }

  const rows = participants.map((p) => {
    const answers = answersBy.get(p.participant_id) ?? {};
    const la = lossAversion(answers);
    const selfRated = answers.lit_self === undefined ? null : Number(answers.lit_self);
    const pushes = FEATURES.map((f) => answers[`feature_push_${f.id}`]);
    const fomo = FOMO.map((q) => answers[q.id]);
    const row: Record<string, Cell> = {
      participant_id: p.participant_id,
      is_pilot: Number(p.is_pilot ?? 0),
      created_at: p.created_at,
      completed_at: p.completed_at,
      skin: p.app_version === 'fraud' ? 'fraud' : 'honest',
      round1_outcome: p.round1_outcome,
      pool_source: p.referral_source,
      withdrawal_offer: p.withdrawal_offer,
      reinvest_framing: p.money_source === 'profit' ? 'profit' : 'main',
      deal_order: (p.deal_order ?? '').split(',').join(';'),
      spin_order: (p.spin_order ?? '').split(',').join(';'),
      ...behaviour(eventsBy.get(p.participant_id) ?? [], p.app_version, p.withdrawal_offer),
    };
    for (const id of GAME_ITEM_IDS) row[id] = answers[id] ?? null;
    Object.assign(row, {
      crt_score: crtScore(answers),
      lambda: la.lambda,
      la_consistent: la.consistent,
      la_accepted: la.accepted,
      literacy_score: literacyScore(answers),
      self_rated_literacy: Number.isFinite(selfRated) ? selfRated : null,
      feature_push_count: pushes.every((v) => v !== undefined)
        ? pushes.filter((v) => v === 'yes').length
        : null,
      fomo_score: fomo.every((v) => v !== undefined)
        ? fomo.filter((v) => v === 'agree').length
        : null,
    });
    return row;
  });

  // Overconfidence needs the whole exported sample (z-scores).
  const oc = overconfidence(
    rows.map((r) => (typeof r.self_rated_literacy === 'number' ? r.self_rated_literacy : null)),
    rows.map((r) => (typeof r.literacy_score === 'number' ? r.literacy_score : null)),
  );
  rows.forEach((r, i) => (r.overconfidence = round4(oc[i])));
  return rows;
}

export async function wideCsv(db: DB): Promise<string> {
  return toCsv(
    wideColumns().map((c) => c.name),
    await wideRows(db),
  );
}
