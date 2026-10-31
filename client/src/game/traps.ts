/**
 * Trap score (0–10): the scam tricks a player fell for. Computed from "facts" so the report card
 * (facts from the game state) and the export (facts from the event log) use the same rule.
 * The tax trap exists only in the fraud skin, so honest players can score at most 9.
 */
import { ECONOMY, type Skin } from '../config/game';
import { vipLevel } from './economy';

export interface TrapFacts {
  skin: Skin;
  r1Amount: number;
  totalDeposited: number;
  chatDeposit: boolean;
  dealNoDetails: boolean;
  poolNoDetails: boolean;
  crashTopup: boolean;
  taxPaid: boolean;
  verifyAny: boolean;
  postWithdrawalDeposit: number;
  reinvestAmount: number;
}

export const TRAPS: { id: string; fraudOnly?: boolean; test: (f: TrapFacts) => boolean }[] = [
  { id: 'hook', test: (f) => f.r1Amount > 0 },
  { id: 'vip', test: (f) => vipLevel(f.totalDeposited) >= ECONOMY.vipUpgradeLevel },
  { id: 'chat', test: (f) => f.chatDeposit },
  { id: 'deal_no_details', test: (f) => f.dealNoDetails },
  { id: 'pool_no_details', test: (f) => f.poolNoDetails },
  { id: 'crash_topup', test: (f) => f.crashTopup },
  { id: 'tax_paid', fraudOnly: true, test: (f) => f.taxPaid },
  { id: 'no_verify', test: (f) => !f.verifyAny },
  { id: 'trust_after_withdrawal', test: (f) => f.postWithdrawalDeposit > 0 },
  { id: 'reinvest', test: (f) => f.reinvestAmount > 0 },
];

export function trapResult(f: TrapFacts): { score: number; possible: number; fallen: string[] } {
  const applicable = TRAPS.filter((t) => !t.fraudOnly || f.skin === 'fraud');
  const fallen = applicable.filter((t) => t.test(f)).map((t) => t.id);
  return { score: fallen.length, possible: applicable.length, fallen };
}

interface LoggedEvent {
  event_type: string;
  payload: Record<string, unknown>;
}

const MONEY_EVENTS = [
  'round_invest',
  'deal_invest',
  'pool_join',
  'post_withdrawal_deposit',
  'reinvest',
  'crash_topup',
];

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Facts recomputed from the event log (server export). */
export function factsFromEvents(events: LoggedEvent[], skin: Skin): TrapFacts {
  const of = (t: string) => events.filter((e) => e.event_type === t);
  const last = (t: string) => of(t).at(-1)?.payload;
  const money = events.filter((e) => MONEY_EVENTS.includes(e.event_type));
  const r1 = of('round_invest')
    .filter((e) => e.payload.round === 1)
    .at(-1);
  return {
    skin,
    r1Amount: num(r1?.payload.amount),
    totalDeposited: money.reduce((s, e) => s + num(e.payload.amount), 0),
    chatDeposit: money.some((e) => {
      const since = e.payload.since_chat_ms;
      return (
        num(e.payload.amount) > 0 &&
        typeof since === 'number' &&
        since >= 0 &&
        since <= ECONOMY.chatDepositWindowMs
      );
    }),
    dealNoDetails: of('deal_invest').some((e) => e.payload.details_before === false),
    poolNoDetails: of('pool_join').some((e) => e.payload.details_before === false),
    crashTopup: num(last('crash_topup')?.amount) > 0,
    taxPaid: of('tax_pay').length > 0,
    verifyAny: of('verify_open').length > 0,
    postWithdrawalDeposit: num(last('post_withdrawal_deposit')?.amount),
    reinvestAmount: num(last('reinvest')?.amount),
  };
}

/** Facts from the in-browser game state (report card). */
export function factsFromState(
  s: {
    rounds: Record<number, { amount: number }>;
    totalDeposited: number;
    chatDeposit: boolean;
    deals: Record<number, { invested: boolean; detailsBefore: boolean }>;
    pool?: { joined: boolean; detailsBefore: boolean };
    topup?: number;
    cashout?: string;
    verifyAny: boolean;
    s9Deposit?: number;
    reinvest?: number;
  },
  skin: Skin,
): TrapFacts {
  return {
    skin,
    r1Amount: s.rounds[1]?.amount ?? 0,
    totalDeposited: s.totalDeposited,
    chatDeposit: s.chatDeposit,
    dealNoDetails: Object.values(s.deals).some((d) => d.invested && !d.detailsBefore),
    poolNoDetails: !!s.pool?.joined && !s.pool.detailsBefore,
    crashTopup: (s.topup ?? 0) > 0,
    taxPaid: s.cashout === 'tax_paid',
    verifyAny: s.verifyAny,
    postWithdrawalDeposit: s.s9Deposit ?? 0,
    reinvestAmount: s.reinvest ?? 0,
  };
}
