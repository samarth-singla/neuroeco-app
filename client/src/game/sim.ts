/**
 * Headless player: walks through every step with random (seeded) choices, dispatching the same
 * actions the UI dispatches. Used by tests and by the server's simulation script.
 */
import {
  ANSWER_KEY,
  BRAIN,
  ECONOMY,
  FEATURES,
  FOMO,
  PLANS,
  PROFILE,
  SLIDERS,
  type GameQuestion,
} from '../config/game';
import {
  initialGame,
  reduce,
  type GameAction,
  type GameAssignment,
  type GameEvent,
  type GameState,
} from './reducer';
import { nextStep, stepIndex, stepKind } from './steps';

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Probabilities for the random player; tweak per test. */
export interface Policy {
  invest: number;
  verify: number;
  acceptSpin: number;
  chatOpen: number;
  correct: number;
  payTax: number;
}

export const DEFAULT_POLICY: Policy = {
  invest: 0.7,
  verify: 0.3,
  acceptSpin: 0.5,
  chatOpen: 0.5,
  correct: 0.6,
  payTax: 0.4,
};

export interface SimResult {
  state: GameState;
  events: (GameEvent & { at: number })[];
  answers: Record<string, string | number>;
  /** Wallet snapshots at key steps, for invariant checks */
  snapshots: Record<string, GameState['wallets']>;
}

function randomAnswer(q: GameQuestion, rng: Rng, correct: boolean): string | number {
  if (q.kind === 'scale') return 1 + Math.floor(rng() * 7);
  if (q.kind === 'number')
    return correct ? ANSWER_KEY.crt[q.id] : [10, 100, 24][Math.floor(rng() * 3)];
  if (correct && q.id in ANSWER_KEY.literacy) return ANSWER_KEY.literacy[q.id];
  return q.options[Math.floor(rng() * q.options.length)].value;
}

export function simulateGame(
  a: GameAssignment,
  rng: Rng,
  policy: Policy = DEFAULT_POLICY,
): SimResult {
  let s = initialGame(a);
  const events: SimResult['events'] = [];
  const snapshots: SimResult['snapshots'] = {};
  let at = 1_700_000_000_000;
  const chance = (p: number) => rng() < p;
  const pick = <T>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  const amount = (max: number) => {
    const opts = [...ECONOMY.quickAmounts, max].filter((x) => x <= max && x >= ECONOMY.minInvest);
    return opts.length ? pick(opts) : 0;
  };
  const act = (action: GameAction) => {
    // fixed step so both skins (same seed) make identical random choices
    at += 2500;
    const r = reduce(s, action, a);
    s = r.state;
    for (const e of r.events) events.push({ ...e, at });
  };

  while (s.step !== 'g:end') {
    const step = s.step;
    const kind = stepKind(step);
    const i = stepIndex(step);
    snapshots[step] = s.wallets;

    switch (kind) {
      case 'profile': {
        const q = PROFILE[i];
        act({ type: 'answer', id: q.id, value: randomAnswer(q, rng, false) });
        break;
      }
      case 'spin':
        act({
          type: 'spin',
          gain: a.spin_order[i],
          accept: chance(policy.acceptSpin),
          outcome: chance(0.5) ? 'win' : 'lose',
        });
        break;
      case 'home':
        if (chance(policy.verify))
          act({ type: 'verify', what: pick(['tnc', 'plan_details', 'badge', 'about'] as const) });
        act({
          type: 's3_decide',
          choice: chance(policy.invest) ? 'invest' : 'skip',
          planId: pick(PLANS).id,
          decisionMs: 1000 + Math.floor(rng() * 30000),
        });
        break;
      case 'round': {
        const round = i;
        const tap = chance(0.2); // drawn in both skins so the random sequence stays aligned
        if (a.app_version === 'fraud' && tap) act({ type: 'vip_tap' });
        if (chance(policy.invest)) {
          act({ type: 'round_invest', round, amount: amount(s.wallets.main), at: at + 1000 });
        } else act({ type: 'round_skip', round });
        if (round === 6) act({ type: 'streak_reward' });
        break;
      }
      case 'brain': {
        const q = BRAIN[i];
        act({
          type: 'brain_answer',
          id: q.id,
          value: randomAnswer(q, rng, chance(policy.correct)),
          ms: 4000,
        });
        break;
      }
      case 'chat':
        act({ type: 'chat_shown', at: at + 1 });
        if (chance(policy.chatOpen)) act({ type: 'chat_open' });
        break;
      case 'deal': {
        const size = a.deal_order[i];
        if (chance(policy.verify)) act({ type: 'verify', what: 'deal_details', size });
        act({ type: 'deal', size, invest: chance(policy.invest), at: at + 1, decisionMs: 3000 });
        break;
      }
      case 'pool':
        if (chance(policy.verify)) act({ type: 'verify', what: 'pool_details' });
        act({ type: 'pool', join: chance(policy.invest * 0.6), at: at + 1, decisionMs: 3000 });
        break;
      case 'withdraw':
        if (a.withdrawal_offer === 'allowed') act({ type: 'withdraw_test', take: chance(0.8) });
        else act({ type: 'withdraw_unavailable' });
        act({
          type: 's9_deposit',
          amount: chance(policy.invest * 0.6)
            ? amount(Math.min(s.wallets.main, ECONOMY.postWithdrawalMax))
            : 0,
          at: at + 1,
        });
        break;
      case 'reinvest':
        snapshots['reinvest_before'] = s.wallets;
        act({
          type: 'reinvest',
          amount: chance(policy.invest * 0.6) ? pick([500, 1000, 2000]) : 0,
          at: at + 1,
        });
        break;
      case 'crash':
        act({ type: 'crash' });
        act({
          type: 'topup',
          amount: chance(policy.invest * 0.5) ? amount(s.wallets.main) : 0,
          at: at + 1,
          decisionMs: 5000,
        });
        break;
      case 'cashout':
        act({ type: 'cashout_click' });
        if (a.app_version === 'fraud') act({ type: 'tax', pay: chance(policy.payTax) });
        break;
      case 'react': {
        const qs = [
          ...FEATURES.map((f) => ({
            id: `feature_push_${f.id}`,
            value: chance(0.5) ? 'yes' : 'no',
          })),
          ...SLIDERS.map((q) => ({ id: q.id, value: 1 + Math.floor(rng() * 7) })),
          ...FOMO.map((q) => ({ id: q.id, value: chance(0.5) ? 'agree' : 'disagree' })),
        ];
        const q = qs[i];
        act({ type: 'answer', id: q.id, value: q.value });
        break;
      }
      default:
        break;
    }
    act({ type: 'go', step: nextStep(step) });
  }
  return { state: s, events, answers: s.answers, snapshots };
}
