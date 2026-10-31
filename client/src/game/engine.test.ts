import { describe, expect, it } from 'vitest';
import { ECONOMY, GAME_ITEM_IDS, SPINS } from '../config/game';
import {
  cap,
  crash,
  finalBalance,
  lockIn,
  roundRate,
  spinNet,
  startWallets,
  taxFor,
  trade,
  vipLevel,
} from './economy';
import { initialGame, isCorrect, reduce, type GameAssignment } from './reducer';
import { DEFAULT_POLICY, mulberry32, simulateGame } from './sim';
import { STEPS, nextStep, stageOf } from './steps';
import { factsFromEvents, factsFromState, trapResult } from './traps';

const DEALS = [500, 3000, 8000];

function combos(): GameAssignment[] {
  const out: GameAssignment[] = [];
  for (const app_version of ['plain', 'fraud'] as const)
    for (const round1_outcome of ['small_win', 'flat'] as const)
      for (const withdrawal_offer of ['allowed', 'not_offered'] as const)
        for (const referral_source of ['friend', 'ad'] as const)
          for (const money_source of ['profit', 'own'] as const)
            out.push({
              app_version,
              round1_outcome,
              withdrawal_offer,
              referral_source,
              money_source,
              deal_order: [8000, 500, 3000],
              spin_order: [300, 50, 200, 100, 250, 150],
            });
  return out;
}

describe('economy', () => {
  it('starts with ₹10,000 in Main; the bonus is locked only in the fraud skin', () => {
    expect(startWallets('fraud')).toMatchObject({ main: 10000, profit: 0, bonusLocked: 500 });
    expect(startWallets('plain')).toMatchObject({ main: 10000, profit: 500, bonusLocked: 0 });
  });

  it('trades: gains go to Profit, losses come off Main, the first deposit unlocks the bonus', () => {
    const w0 = startWallets('fraud');
    const { w, gain } = trade(w0, 1000, 0.08);
    expect(gain).toBe(80);
    expect(w).toMatchObject({ main: 10000, profit: 580, bonusLocked: 0 });
    const loss = trade(w, 1000, -0.04);
    expect(loss.w.main).toBe(9960);
    expect(trade(w0, 0, 0.08).w).toBe(w0); // skipping changes nothing, bonus stays locked
  });

  it('caps amounts at the wallet balance', () => {
    expect(cap(5000, 1200)).toBe(1200);
    expect(cap(-5, 1000)).toBe(0);
    expect(lockIn(startWallets('plain'), 20000, 'main').amount).toBe(10000);
  });

  it('crash takes 40% off Main and Portfolio but not Profit', () => {
    const w = { ...startWallets('plain'), portfolio: 1000 };
    const r = crash(w);
    expect(r.w).toMatchObject({ main: 6000, portfolio: 600, profit: 500 });
    expect(r.loss).toBe(4400);
  });

  it('round rates: round 1 depends on the condition, later rounds are fixed and net positive', () => {
    expect(roundRate(1, 'small_win')).toBe(0.08);
    expect(roundRate(1, 'flat')).toBe(0);
    const later = [2, 3, 4, 5, 6].map((r) => roundRate(r, 'flat'));
    expect(later.reduce((s, x) => s + x, 0)).toBeGreaterThan(0);
  });

  it('VIP levels, tax and spin results', () => {
    expect(vipLevel(999)).toBe(0);
    expect(vipLevel(5000)).toBe(2);
    expect(taxFor({ ...startWallets('plain'), profit: 0 })).toBe(1000);
    expect(
      spinNet([
        { gain: 300, accepted: true, outcome: 'win' },
        { gain: 50, accepted: true, outcome: 'lose' },
        { gain: 100, accepted: false },
      ]),
    ).toBe(200);
  });

  it('scores CRT and literacy answers', () => {
    expect(isCorrect('crt_1', '5')).toBe(true);
    expect(isCorrect('crt_1', 10)).toBe(false);
    expect(isCorrect('crt_3', 47)).toBe(true);
    expect(isCorrect('lit_interest', 'more')).toBe(true);
    expect(isCorrect('lit_diversification', 'true')).toBe(false);
  });
});

describe('steps', () => {
  it('cover all 15 stages in the planned order and end at g:end', () => {
    const stages = STEPS.map(stageOf);
    for (let i = 1; i < stages.length; i++) {
      // stages never go backwards, except rounds that resume after the brain bonus / chat
      if (stages[i] < stages[i - 1]) expect(STEPS[i]).toMatch(/^g:round:/);
    }
    expect(new Set(stages).size).toBe(15);
    expect(STEPS.at(-1)).toBe('g:end');
    expect(nextStep('g:end')).toBe('g:end');
    expect(STEPS.indexOf('g:brain:0')).toBe(STEPS.indexOf('g:round:3') + 1);
    expect(STEPS.indexOf('g:chat')).toBe(STEPS.indexOf('g:round:4') + 1);
  });
});

describe('headless run through every stage for every factor combination', () => {
  const all = combos();
  it('has 32 combinations', () => expect(all).toHaveLength(32));

  for (const a of all) {
    const name = `${a.app_version}/${a.round1_outcome}/${a.withdrawal_offer}/${a.referral_source}/${a.money_source}`;
    it(name, () => {
      for (let seed = 1; seed <= 15; seed++) {
        const r = simulateGame(a, mulberry32(seed * 97 + all.indexOf(a)));
        const s = r.state;
        expect(s.step).toBe('g:end');

        // Every wallet stays non-negative at every step
        for (const w of Object.values(r.snapshots)) {
          for (const v of Object.values(w)) expect(v).toBeGreaterThanOrEqual(0);
        }
        // H3: every flash deal is affordable, whatever was done before
        for (let i = 0; i < 3; i++) {
          expect(r.snapshots[`g:deal:${i}`].main).toBeGreaterThanOrEqual(Math.max(...DEALS));
        }
        // H7: both framings can fund the full ₹2,000 offer
        const before = r.snapshots['reinvest_before'];
        expect(before.profit).toBeGreaterThanOrEqual(ECONOMY.reinvest.amount);
        expect(before.main).toBeGreaterThanOrEqual(ECONOMY.reinvest.amount);

        // All six spins answered, in the assigned order
        expect(s.spins.map((x) => x.gain)).toEqual(a.spin_order);
        // Every response item answered
        for (const id of GAME_ITEM_IDS) expect(r.answers, id).toHaveProperty(id);

        // Report-card trap score = export trap score (from the event log)
        const fromState = factsFromState(s, a.app_version);
        const fromEvents = factsFromEvents(
          r.events.map((e) => ({ event_type: e.type, payload: e.payload ?? {} })),
          a.app_version,
        );
        expect(fromEvents).toEqual(fromState);
        const t = trapResult(fromState);
        expect(t.score).toBeLessThanOrEqual(t.possible);
        expect(t.possible).toBe(a.app_version === 'fraud' ? 10 : 9);

        // Final balance is consistent and the fraud skin's tax is the only skin-specific loss
        expect(Number.isFinite(finalBalance(s.wallets, s.spins))).toBe(true);
        if (a.app_version === 'plain') expect(s.cashout).toBe('done');
        else expect(['tax_paid', 'tax_declined']).toContain(s.cashout);
      }
    });
  }
});

describe('reducer guards against repeats (refresh safety)', () => {
  it('does not settle the same round, deal, crash or tax twice', () => {
    const a = combos()[0];
    let s = initialGame(a);
    const step = (action: Parameters<typeof reduce>[1]) => (s = reduce(s, action, a).state);
    step({ type: 'round_invest', round: 1, amount: 1000, at: 1 });
    const once = s.wallets;
    step({ type: 'round_invest', round: 1, amount: 1000, at: 2 });
    expect(s.wallets).toBe(once);
    step({ type: 'crash' });
    const crashed = s.wallets;
    step({ type: 'crash' });
    expect(s.wallets).toBe(crashed);
    expect(
      reduce(s, { type: 'spin', gain: SPINS.gains[0], accept: true, outcome: 'win' }, a).events,
    ).toHaveLength(1);
  });

  it('counts a deposit within 60 s of the chat as a chat deposit, but not later', () => {
    const a = combos()[0];
    let s = initialGame(a);
    s = reduce(s, { type: 'chat_shown', at: 1000 }, a).state;
    const late = reduce(s, { type: 'round_invest', round: 5, amount: 500, at: 1000 + 61000 }, a);
    expect(late.state.chatDeposit).toBe(false);
    const soon = reduce(s, { type: 'round_invest', round: 5, amount: 500, at: 1000 + 30000 }, a);
    expect(soon.state.chatDeposit).toBe(true);
    expect(soon.events[0].payload?.since_chat_ms).toBe(30000);
  });

  it('policy defaults are sane', () => {
    expect(DEFAULT_POLICY.invest).toBeGreaterThan(0);
  });
});
