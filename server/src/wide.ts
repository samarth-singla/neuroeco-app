/**
 * wide.csv: one row per completed, non-withdrawn participant, with assignments, behaviour
 * measures from the event log, every survey answer and the derived scores.
 *
 * `wideColumns()` is also the source of docs/data-dictionary.md (npm run docs:dictionary).
 */
import { all, type DB } from './db';
import { toCsv, type Cell } from './csv';
import { ALL_ITEMS, type Item } from '../../client/src/config/survey';
import {
  crtScore,
  escalationRatio,
  HERD_ITEMS,
  literacyScore,
  lossAversion,
  meanOf,
  overconfidence,
  SUSCEPTIBILITY_ITEMS,
  type Answers,
} from './scoring';

export interface Column {
  name: string;
  description: string;
  hypotheses: string;
  group:
    'Identifiers & assignments' | 'App behaviour (event log)' | 'Survey items' | 'Derived scores';
}

const ASSIGNMENT_COLUMNS: Column[] = [
  ['participant_id', 'Random UUID created at consent', '—'],
  [
    'is_pilot',
    '1 = joined through a `?pilot=1` link (exclude from analysis), 0 = real participant',
    '—',
  ],
  ['created_at', 'Consent time (ISO, UTC)', '—'],
  ['completed_at', 'Time the general survey was finished (ISO, UTC)', '—'],
  ['app_version', 'IV. `plain` or `fraud` (fraud-style dark design)', 'H1, H1a–H1g'],
  ['round1_outcome', 'IV. Round-1 result: `small_win` (+8%) or `flat` (0%)', 'H2'],
  ['withdrawal_offer', 'IV. `allowed` (small ₹200 withdrawal offered) or `not_offered`', 'H6'],
  ['referral_source', 'IV. Referral scenario version: `friend` or `ad`', 'H5'],
  ['money_source', 'IV. Money-source scenario version: `profit` (house money) or `own`', 'H7'],
  ['stake_order', 'Order the H3 stake pages were shown (e.g. `5000;500;50000`)', 'H3'],
].map(([name, description, hypotheses]) => ({
  name,
  description,
  hypotheses,
  group: 'Identifiers & assignments' as const,
}));

const BEHAVIOUR_COLUMNS: Column[] = [
  [
    'a2_decision_time_s',
    'Seconds from first render of the plans screen (A2) to the first Invest / Continue-without-investing click',
    'H1, H1a, H1e',
  ],
  ['a2_choice', '`invest` or `exit` (first decisive click on A2)', 'H1'],
  ['invested', '1 = deposited more than ₹0 in round 1 (A3), 0 = did not', 'H1, H1b'],
  [
    'plan',
    'Plan id chosen on A2 (`starter`, `growth`, `premium`); blank if no investment',
    'H1, H1c',
  ],
  ['r1_amount', 'Round-1 deposit in ₹ (A3); 0 if none', 'H1, H1b, H1c, H2'],
  ['r2_amount', 'Round-2 deposit in ₹ (A5, after the round-1 result); 0 if none', 'H2, H1f'],
  ['escalation_ratio', 'r2_amount ÷ r1_amount; blank if r1_amount = 0', 'H2'],
  ['verify_click', '1 = opened the About / Verify page on A2, 0 = did not', 'H1, H1d'],
  [
    'chat_open',
    '1 = opened the mentor chat (fraud) or Help/FAQ (plain) on A5/A7, 0 = did not',
    'H1f',
  ],
  [
    'withdrew',
    '1 = made the small withdrawal on A6, 0 = skipped / nothing to withdraw; blank if not offered',
    'H6',
  ],
  ['post_withdrawal_deposit', 'Deposit in ₹ on A7 (after the withdrawal stage); 0 if none', 'H6'],
  [
    'topup_click',
    '1 = clicked "Top up to recover" after the scripted loss (A8), 0 = did not',
    'H4',
  ],
  ['topup', '1 = added money after the scripted loss (A8), 0 = did not', 'H4'],
  ['topup_amount', 'Top-up amount in ₹ (A8); 0 if none', 'H4'],
  [
    'fee_shown',
    '1 = saw the withdrawal "processing tax" screen (fraud version, A9), 0 = did not',
    'H1g',
  ],
  [
    'fee_paid',
    '1 = clicked "Pay fee", 0 = "Don\'t pay"; blank if the fee screen was not shown',
    'H1g',
  ],
  ['total_deposited', 'Total ₹ deposited in the session (rounds 1–3 + top-up)', 'H1'],
].map(([name, description, hypotheses]) => ({
  name,
  description,
  hypotheses,
  group: 'App behaviour (event log)' as const,
}));

const DERIVED_COLUMNS: Column[] = [
  ['crt_score', 'Cognitive Reflection Test score 0–3 (correct: 5, 5, 47)', 'H1 (moderator)'],
  [
    'loss_aversion_lambda',
    'λ = smallest accepted gain ÷ ₹100 loss (0.5–3.0); 3.5 if all six gambles rejected; blank if choices are inconsistent',
    'H4, H8, H9',
  ],
  [
    'la_consistent',
    '1 = gamble choices switch at most once (reject → accept), 0 = inconsistent',
    'H4',
  ],
  ['la_accepted', 'Number of the six gambles accepted (0–6)', 'H4'],
  ['literacy_score', 'Big Three financial literacy score 0–3 ("don\'t know" = wrong)', 'H8'],
  ['self_rated_literacy', 'Self-rated financial knowledge 1–7 (= `lit_self`)', 'H8'],
  [
    'overconfidence',
    'z(self_rated_literacy) − z(literacy_score), z computed over the rows in this export (sample SD); blank if either SD is 0',
    'H8',
  ],
  ['herd_score', 'Mean of herd_1–herd_5 (1–7)', 'H5 (moderator), H9'],
  ['susceptibility_index', 'Mean of sus_1–sus_5 (1–7)', 'H8, H9'],
].map(([name, description, hypotheses]) => ({
  name,
  description,
  hypotheses,
  group: 'Derived scores' as const,
}));

const UIUX_HYPOTHESIS: Record<string, string> = {
  timer: 'H1a',
  bonus: 'H1b',
  vip: 'H1c',
  regulator: 'H1d',
  social: 'H1e',
  chat: 'H1f',
  withdrawal_tax: 'H1g',
};

const BLOCK_HYPOTHESES: Record<string, string> = {
  crt: 'H1 (moderator)',
  loss_aversion: 'H4, H8, H9',
  stake_scenarios: 'H3',
  referral_scenario: 'H5',
  herd_fomo: 'H5 (moderator), H9',
  money_source_scenario: 'H7',
  self_rated_literacy: 'H8',
  financial_literacy: 'H8',
  susceptibility: 'H8, H9',
  experience: 'Controls (H1, H4, H8)',
  demographics: 'Controls (H1, H8, H9)',
};

function itemHypotheses(id: string, block: string): string {
  if (id === 'comments') return '—';
  if (block === 'uiux') {
    if (id === 'uiux_overall_trust') return 'H1, H6';
    if (id === 'uiux_overall_urgency') return 'H1';
    const feature = Object.keys(UIUX_HYPOTHESIS).find((f) => id.startsWith(`uiux_${f}_`));
    return feature ? `${UIUX_HYPOTHESIS[feature]}, H1` : 'H1';
  }
  return BLOCK_HYPOTHESES[block] ?? '—';
}

function itemDescription(item: Item, block: string): string {
  const text = item.text.length > 110 ? `${item.text.slice(0, 107)}…` : item.text;
  let values = '';
  if (item.type === 'likert') values = '1–7';
  if (item.type === 'choice') values = item.options.map((o) => `\`${o.value}\``).join(' / ');
  if (item.type === 'number') values = `number ${item.min}–${item.max}`;
  if (item.type === 'slider') values = `₹${item.min}–${item.max}`;
  if (item.type === 'text') values = 'free text, optional';
  const variant =
    block === 'referral_scenario'
      ? ' Wording depends on `referral_source`.'
      : block === 'money_source_scenario'
        ? ' Wording depends on `money_source`.'
        : '';
  return `${text} (${values}).${variant}`;
}

const ITEM_COLUMNS: Column[] = ALL_ITEMS.map(({ id, block, item }) => ({
  name: id,
  description: itemDescription(item, block),
  hypotheses: itemHypotheses(id, block),
  group: 'Survey items' as const,
}));

export function wideColumns(): Column[] {
  return [...ASSIGNMENT_COLUMNS, ...BEHAVIOUR_COLUMNS, ...ITEM_COLUMNS, ...DERIVED_COLUMNS];
}

// ---------------------------------------------------------------------------------------------

interface EventRow {
  participant_id: string;
  screen: string;
  event_type: string;
  payload: string | null;
}

type Payload = Record<string, unknown>;

function parse(p: string | null): Payload {
  if (!p) return {};
  try {
    const v = JSON.parse(p);
    return typeof v === 'object' && v !== null ? (v as Payload) : {};
  } catch {
    return {};
  }
}

const amountOf = (p: Payload) => (typeof p.amount === 'number' ? p.amount : 0);

/** Behaviour measures for one participant from their events (in logged order). */
export function behaviour(
  events: { screen: string; event_type: string; payload: Payload }[],
  withdrawalOffer: string,
): Record<string, Cell> {
  const of = (type: string, screen?: string) =>
    events.filter((e) => e.event_type === type && (!screen || e.screen === screen));
  const has = (type: string) => (of(type).length > 0 ? 1 : 0);
  const lastDeposit = (round: number) => {
    const d = of('deposit_submit').filter((e) => e.payload.round === round);
    return d.length ? d[d.length - 1].payload : null;
  };

  const decision = events.find(
    (e) => e.screen === 'A2' && (e.event_type === 'invest_click' || e.event_type === 'exit_click'),
  );
  const decisionMs =
    decision && typeof decision.payload.decision_ms === 'number'
      ? decision.payload.decision_ms
      : null;

  const d1 = lastDeposit(1);
  const r1 = d1 ? amountOf(d1) : 0;
  const r2 = amountOf(lastDeposit(2) ?? {});
  const r3 = amountOf(lastDeposit(3) ?? {});
  const topups = of('topup_submit');
  const topupAmount = topups.length ? amountOf(topups[topups.length - 1].payload) : 0;

  const invest = of('invest_click', 'A2');
  const planId =
    r1 > 0
      ? ((d1?.plan_id as string | undefined) ??
        (invest.length ? (invest[invest.length - 1].payload.plan_id as string) : null))
      : null;

  const feeDecision = events.find(
    (e) => e.event_type === 'fee_pay_click' || e.event_type === 'fee_decline_click',
  );

  const ratio = escalationRatio(r1, r2);
  return {
    a2_decision_time_s: decisionMs === null ? null : Math.round(decisionMs) / 1000,
    a2_choice: decision ? (decision.event_type === 'invest_click' ? 'invest' : 'exit') : null,
    invested: r1 > 0 ? 1 : 0,
    plan: planId,
    r1_amount: r1,
    r2_amount: r2,
    escalation_ratio: ratio === null ? null : Math.round(ratio * 10000) / 10000,
    verify_click: has('verify_click'),
    chat_open: has('chat_open'),
    withdrew: withdrawalOffer === 'allowed' ? has('withdraw_click') : null,
    post_withdrawal_deposit: r3,
    topup_click: has('topup_click'),
    topup: topupAmount > 0 ? 1 : 0,
    topup_amount: topupAmount,
    fee_shown: has('fee_shown'),
    fee_paid: feeDecision ? (feeDecision.event_type === 'fee_pay_click' ? 1 : 0) : null,
    total_deposited: r1 + r2 + r3 + topupAmount,
  };
}

const round4 = (v: number | null) => (v === null ? null : Math.round(v * 10000) / 10000);

interface ParticipantRow {
  participant_id: string;
  is_pilot?: number;
  created_at: string;
  completed_at: string;
  app_version: string;
  round1_outcome: string;
  withdrawal_offer: string;
  referral_source: string;
  money_source: string;
  stake_order: string;
}

/** Rows for wide.csv (completed and not withdrawn), in consent order. */
export async function wideRows(db: DB): Promise<Record<string, Cell>[]> {
  const participants = await all<ParticipantRow>(
    db,
    `SELECT * FROM participants
     WHERE completed_at IS NOT NULL AND withdrawn = 0
     ORDER BY created_at`,
  );

  const eligible = `participant_id IN (SELECT participant_id FROM participants
    WHERE completed_at IS NOT NULL AND withdrawn = 0)`;
  const events = await all<EventRow>(
    db,
    `SELECT participant_id, screen, event_type, payload FROM events WHERE ${eligible} ORDER BY id`,
  );
  const responses = await all<{ participant_id: string; item_id: string; value: string | null }>(
    db,
    `SELECT participant_id, item_id, value FROM responses WHERE ${eligible}`,
  );

  const eventsBy = new Map<string, { screen: string; event_type: string; payload: Payload }[]>();
  for (const e of events) {
    const list = eventsBy.get(e.participant_id) ?? [];
    list.push({ screen: e.screen, event_type: e.event_type, payload: parse(e.payload) });
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
    const row: Record<string, Cell> = {
      participant_id: p.participant_id,
      is_pilot: Number(p.is_pilot ?? 0),
      created_at: p.created_at,
      completed_at: p.completed_at,
      app_version: p.app_version,
      round1_outcome: p.round1_outcome,
      withdrawal_offer: p.withdrawal_offer,
      referral_source: p.referral_source,
      money_source: p.money_source,
      stake_order: p.stake_order.split(',').join(';'),
      ...behaviour(eventsBy.get(p.participant_id) ?? [], p.withdrawal_offer),
    };
    for (const { id } of ALL_ITEMS) row[id] = answers[id] ?? null;
    Object.assign(row, {
      crt_score: crtScore(answers),
      loss_aversion_lambda: la.lambda,
      la_consistent: la.consistent,
      la_accepted: la.accepted,
      literacy_score: literacyScore(answers),
      self_rated_literacy: Number.isFinite(selfRated) ? selfRated : null,
      herd_score: round4(meanOf(answers, HERD_ITEMS)),
      susceptibility_index: round4(meanOf(answers, SUSCEPTIBILITY_ITEMS)),
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
