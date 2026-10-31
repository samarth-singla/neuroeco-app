/**
 * Game state and every player action, as one pure reducer. Each action returns the new state AND
 * the events to log, so the UI and the headless simulation log exactly the same thing, and the
 * server can recompute every measure from the event log.
 *
 * Actions are idempotent where a refresh could repeat them (e.g. a settled round is not settled
 * twice).
 */
import { ANSWER_KEY, BRAIN, ECONOMY, type Skin } from '../config/game';
import {
  addProfit,
  cap,
  cashOutAll,
  crash,
  lockIn,
  payTax,
  roundRate,
  startWallets,
  taxFor,
  trade,
  vipLevel,
  withdrawable,
  withdrawSmall,
  type SpinOutcome,
  type Wallets,
} from './economy';
import { FIRST_STEP } from './steps';

export interface GameAssignment {
  app_version: Skin;
  round1_outcome: 'small_win' | 'flat';
  withdrawal_offer: 'allowed' | 'not_offered';
  referral_source: 'friend' | 'ad';
  money_source: 'profit' | 'own';
  /** Flash-deal sizes in the order shown (H3) */
  deal_order: number[];
  /** Spin gains in the order shown (H4) */
  spin_order: number[];
}

export interface GameState {
  step: string;
  wallets: Wallets;
  /** Sum of every amount invested anywhere (rounds, deals, pool, deposits, top-up) */
  totalDeposited: number;
  spins: { gain: number; accepted: boolean; outcome?: SpinOutcome }[];
  planId: string | null;
  s3?: 'invest' | 'skip';
  rounds: Record<number, { amount: number; rate: number; gain: number }>;
  streakPaid: boolean;
  verifyAny: boolean;
  chatShownAt?: number;
  chatOpened: boolean;
  chatDeposit: boolean;
  dealDetails: Record<number, boolean>;
  deals: Record<
    number,
    { invested: boolean; amount: number; detailsBefore: boolean; gain: number }
  >;
  poolDetails: boolean;
  pool?: { joined: boolean; detailsBefore: boolean };
  withdrawTest?: 'done' | 'skipped' | 'not_offered';
  s9Deposit?: number;
  reinvest?: number;
  crashLoss?: number;
  topup?: number;
  taxShown?: number;
  cashout?: 'done' | 'tax_paid' | 'tax_declined';
  brain: Record<string, { correct: boolean }>;
  answers: Record<string, string | number>;
}

export interface GameEvent {
  screen: string;
  type: string;
  payload?: Record<string, unknown>;
}

export type GameAction =
  | { type: 'go'; step: string }
  | { type: 'answer'; id: string; value: string | number; ms?: number }
  | { type: 'spin'; gain: number; accept: boolean; outcome: SpinOutcome; ms?: number }
  | {
      type: 'verify';
      what: 'tnc' | 'plan_details' | 'badge' | 'about' | 'deal_details' | 'pool_details';
      size?: number;
    }
  | { type: 's3_decide'; choice: 'invest' | 'skip'; planId: string | null; decisionMs: number }
  | { type: 'round_invest'; round: number; amount: number; at: number; decisionMs?: number }
  | { type: 'round_skip'; round: number; decisionMs?: number }
  | { type: 'vip_tap' }
  | { type: 'streak_reward' }
  | { type: 'chat_shown'; at: number }
  | { type: 'chat_open' }
  | { type: 'brain_answer'; id: string; value: string | number; ms: number }
  | { type: 'deal'; size: number; invest: boolean; at: number; decisionMs: number }
  | { type: 'pool'; join: boolean; at: number; decisionMs: number }
  | { type: 'withdraw_test'; take: boolean }
  | { type: 'withdraw_unavailable' }
  | { type: 's9_deposit'; amount: number; at: number }
  | { type: 'reinvest'; amount: number; at: number }
  | { type: 'crash' }
  | { type: 'topup'; amount: number; at: number; decisionMs: number }
  | { type: 'cashout_click' }
  | { type: 'tax'; pay: boolean };

export function initialGame(a: GameAssignment): GameState {
  return {
    step: FIRST_STEP,
    wallets: startWallets(a.app_version),
    totalDeposited: 0,
    spins: [],
    planId: null,
    rounds: {},
    streakPaid: false,
    verifyAny: false,
    chatOpened: false,
    chatDeposit: false,
    dealDetails: {},
    deals: {},
    poolDetails: false,
    brain: {},
    answers: {},
  };
}

/** Is a CRT / literacy answer correct? */
export function isCorrect(id: string, value: string | number): boolean {
  if (id in ANSWER_KEY.crt) {
    const n = Number(String(value).trim());
    return Number.isFinite(n) && Math.abs(n - ANSWER_KEY.crt[id]) < 1e-9;
  }
  if (id in ANSWER_KEY.literacy) return value === ANSWER_KEY.literacy[id];
  return false;
}

/** Money put in: updates total deposited and the chat-deposit flag; returns event extras. */
function deposit(s: GameState, amount: number, at: number) {
  const since = s.chatShownAt !== undefined ? at - s.chatShownAt : null;
  const chat = amount > 0 && since !== null && since >= 0 && since <= ECONOMY.chatDepositWindowMs;
  const totalDeposited = s.totalDeposited + amount;
  return {
    state: { totalDeposited, chatDeposit: s.chatDeposit || chat },
    extra: {
      since_chat_ms: since,
      total_deposited: totalDeposited,
      vip_level: vipLevel(totalDeposited),
    },
  };
}

type Result = { state: GameState; events: GameEvent[] };

export function reduce(s: GameState, action: GameAction, a: GameAssignment): Result {
  const ev = (type: string, payload?: Record<string, unknown>): GameEvent => ({
    screen: s.step,
    type,
    payload,
  });
  const same: Result = { state: s, events: [] };

  switch (action.type) {
    case 'go':
      return { state: { ...s, step: action.step }, events: [] };

    case 'answer':
      return {
        state: { ...s, answers: { ...s.answers, [action.id]: action.value } },
        events: [ev('answer', { id: action.id, ms: action.ms ?? null })],
      };

    case 'spin': {
      if (s.spins.some((x) => x.gain === action.gain)) return same;
      const spin = action.accept
        ? { gain: action.gain, accepted: true, outcome: action.outcome }
        : { gain: action.gain, accepted: false };
      return {
        state: {
          ...s,
          spins: [...s.spins, spin],
          answers: {
            ...s.answers,
            [`la_gain_${action.gain}`]: action.accept ? 'accept' : 'reject',
          },
        },
        events: [
          ev(action.accept ? 'spin_accept' : 'spin_skip', {
            gain: action.gain,
            outcome: action.accept ? action.outcome : null,
            ms: action.ms ?? null,
          }),
        ],
      };
    }

    case 'verify': {
      const next: GameState = { ...s, verifyAny: true };
      if (action.what === 'deal_details' && action.size !== undefined) {
        next.dealDetails = { ...s.dealDetails, [action.size]: true };
      }
      if (action.what === 'pool_details') next.poolDetails = true;
      return {
        state: next,
        events: [ev('verify_open', { what: action.what, size: action.size ?? null })],
      };
    }

    case 's3_decide':
      if (s.s3) return same;
      return {
        state: { ...s, s3: action.choice, planId: action.planId },
        events: [
          ev(action.choice === 'invest' ? 's3_invest' : 's3_skip', {
            plan_id: action.planId,
            decision_ms: action.decisionMs,
          }),
        ],
      };

    case 'round_invest': {
      if (s.rounds[action.round]) return same;
      const rate = roundRate(action.round, a.round1_outcome);
      const amount = cap(action.amount, s.wallets.main);
      const allIn = amount > 0 && amount === s.wallets.main;
      const { w, gain } = trade(s.wallets, amount, rate);
      const d = deposit(s, amount, action.at);
      return {
        state: {
          ...s,
          ...d.state,
          wallets: w,
          rounds: { ...s.rounds, [action.round]: { amount, rate, gain } },
        },
        events: [
          ev('round_invest', {
            round: action.round,
            amount,
            rate,
            gain,
            all_in: allIn,
            plan_id: s.planId,
            decision_ms: action.decisionMs ?? null,
            ...d.extra,
          }),
        ],
      };
    }

    case 'round_skip': {
      if (s.rounds[action.round]) return same;
      const rate = roundRate(action.round, a.round1_outcome);
      return {
        state: { ...s, rounds: { ...s.rounds, [action.round]: { amount: 0, rate, gain: 0 } } },
        events: [
          ev('round_skip', { round: action.round, rate, decision_ms: action.decisionMs ?? null }),
        ],
      };
    }

    case 'vip_tap':
      return { state: s, events: [ev('vip_upgrade_tap', { total_deposited: s.totalDeposited })] };

    case 'streak_reward':
      if (s.streakPaid) return same;
      return {
        state: { ...s, streakPaid: true, wallets: addProfit(s.wallets, ECONOMY.streakReward) },
        events: [ev('streak_reward', { amount: ECONOMY.streakReward })],
      };

    case 'chat_shown':
      if (s.chatShownAt !== undefined) return same;
      return {
        state: { ...s, chatShownAt: action.at },
        events: [ev('chat_shown', { kind: kindOfChat(a) })],
      };

    case 'chat_open':
      return {
        state: { ...s, chatOpened: true },
        events: [ev('chat_open', { kind: kindOfChat(a) })],
      };

    case 'brain_answer': {
      if (s.brain[action.id]) return same;
      const correct = isCorrect(action.id, action.value);
      return {
        state: {
          ...s,
          brain: { ...s.brain, [action.id]: { correct } },
          answers: { ...s.answers, [action.id]: action.value },
          wallets: correct ? addProfit(s.wallets, ECONOMY.brainReward) : s.wallets,
        },
        events: [
          ev('brain_answer', {
            id: action.id,
            correct,
            reward: correct ? ECONOMY.brainReward : 0,
            ms: action.ms,
          }),
        ],
      };
    }

    case 'deal': {
      if (s.deals[action.size]) return same;
      const detailsBefore = !!s.dealDetails[action.size];
      if (!action.invest) {
        return {
          state: {
            ...s,
            deals: {
              ...s.deals,
              [action.size]: { invested: false, amount: 0, detailsBefore, gain: 0 },
            },
          },
          events: [
            ev('deal_skip', {
              size: action.size,
              details_before: detailsBefore,
              decision_ms: action.decisionMs,
            }),
          ],
        };
      }
      const amount = cap(action.size, s.wallets.main);
      const { w, gain } = trade(s.wallets, amount, ECONOMY.deals.rate);
      const d = deposit(s, amount, action.at);
      return {
        state: {
          ...s,
          ...d.state,
          wallets: w,
          deals: { ...s.deals, [action.size]: { invested: true, amount, detailsBefore, gain } },
        },
        events: [
          ev('deal_invest', {
            size: action.size,
            amount,
            gain,
            details_before: detailsBefore,
            decision_ms: action.decisionMs,
            ...d.extra,
          }),
        ],
      };
    }

    case 'pool': {
      if (s.pool) return same;
      const detailsBefore = s.poolDetails;
      if (!action.join) {
        return {
          state: { ...s, pool: { joined: false, detailsBefore } },
          events: [
            ev('pool_skip', {
              source: a.referral_source,
              details_before: detailsBefore,
              decision_ms: action.decisionMs,
            }),
          ],
        };
      }
      const { w, amount } = lockIn(s.wallets, ECONOMY.poolEntry, 'main');
      const d = deposit(s, amount, action.at);
      return {
        state: { ...s, ...d.state, wallets: w, pool: { joined: amount > 0, detailsBefore } },
        events: [
          ev('pool_join', {
            source: a.referral_source,
            amount,
            details_before: detailsBefore,
            decision_ms: action.decisionMs,
            ...d.extra,
          }),
        ],
      };
    }

    case 'withdraw_test': {
      if (s.withdrawTest) return same;
      if (!action.take) {
        return { state: { ...s, withdrawTest: 'skipped' }, events: [ev('test_withdraw_skip')] };
      }
      const { w, amount } = withdrawSmall(s.wallets, ECONOMY.testWithdrawal);
      return {
        state: { ...s, wallets: w, withdrawTest: 'done' },
        events: [ev('test_withdraw', { amount })],
      };
    }

    case 'withdraw_unavailable':
      if (s.withdrawTest) return same;
      return {
        state: { ...s, withdrawTest: 'not_offered' },
        events: [ev('test_withdraw_unavailable')],
      };

    case 's9_deposit': {
      if (s.s9Deposit !== undefined) return same;
      const { w, amount } = lockIn(
        s.wallets,
        Math.min(action.amount, ECONOMY.postWithdrawalMax),
        'main',
      );
      const d = deposit(s, amount, action.at);
      return {
        state: { ...s, ...d.state, wallets: w, s9Deposit: amount },
        events: [ev('post_withdrawal_deposit', { amount, offer: a.withdrawal_offer, ...d.extra })],
      };
    }

    case 'reinvest': {
      if (s.reinvest !== undefined) return same;
      const from = a.money_source === 'profit' ? 'profit' : 'main';
      const { w, amount } = lockIn(
        s.wallets,
        Math.min(action.amount, ECONOMY.reinvest.amount),
        from,
      );
      const d = deposit(s, amount, action.at);
      return {
        state: { ...s, ...d.state, wallets: w, reinvest: amount },
        events: [ev('reinvest', { amount, from, accepted: amount > 0, ...d.extra })],
      };
    }

    case 'crash': {
      if (s.crashLoss !== undefined) return same;
      const { w, loss } = crash(s.wallets);
      return { state: { ...s, wallets: w, crashLoss: loss }, events: [ev('crash', { loss })] };
    }

    case 'topup': {
      if (s.topup !== undefined) return same;
      const { w, amount } = lockIn(s.wallets, action.amount, 'main');
      const d = deposit(s, amount, action.at);
      return {
        state: { ...s, ...d.state, wallets: w, topup: amount },
        events: [
          ev(amount > 0 ? 'crash_topup' : 'crash_leave', {
            amount,
            decision_ms: action.decisionMs,
            ...d.extra,
          }),
        ],
      };
    }

    case 'cashout_click': {
      if (s.cashout || s.taxShown !== undefined) return same;
      if (a.app_version === 'plain') {
        const amount = withdrawable(s.wallets);
        return {
          state: { ...s, wallets: cashOutAll(s.wallets), cashout: 'done' },
          events: [ev('cashout', { amount })],
        };
      }
      const tax = taxFor(s.wallets);
      return {
        state: { ...s, taxShown: tax },
        events: [ev('tax_shown', { tax, amount: withdrawable(s.wallets) })],
      };
    }

    case 'tax': {
      if (s.cashout || s.taxShown === undefined) return same;
      const tax = s.taxShown;
      return action.pay
        ? {
            state: { ...s, wallets: payTax(s.wallets, tax), cashout: 'tax_paid' },
            events: [ev('tax_pay', { tax })],
          }
        : { state: { ...s, cashout: 'tax_declined' }, events: [ev('tax_decline', { tax })] };
    }
  }
}

export function kindOfChat(a: GameAssignment): 'mentor' | 'help' {
  return a.app_version === 'fraud' ? 'mentor' : 'help';
}

/** The order the brain-bonus questions are shown in (fixed). */
export const BRAIN_IDS = BRAIN.map((q) => q.id);
