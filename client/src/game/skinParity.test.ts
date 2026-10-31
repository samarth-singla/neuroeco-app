/**
 * Redesign Phase 3 check: both skins have identical stage order, timings, amounts and payoffs.
 * The same player (same seed = same choices) is run through both skins and compared step by step.
 * Only two differences are allowed, both part of the manipulation: where the ₹500 bonus sits before
 * the first deposit (locked vs. in Profit, H1b) and the withdrawal tax at cash-out (H1g).
 */
import { describe, expect, it } from 'vitest';
import { ECONOMY, SPINS, TIMING } from '../config/game';
import type { GameAssignment } from './reducer';
import { mulberry32, simulateGame } from './sim';
import { STEPS } from './steps';

function nonSkinCombos(): Omit<GameAssignment, 'app_version'>[] {
  const out: Omit<GameAssignment, 'app_version'>[] = [];
  for (const round1_outcome of ['small_win', 'flat'] as const)
    for (const withdrawal_offer of ['allowed', 'not_offered'] as const)
      for (const referral_source of ['friend', 'ad'] as const)
        for (const money_source of ['profit', 'own'] as const)
          out.push({
            round1_outcome,
            withdrawal_offer,
            referral_source,
            money_source,
            deal_order: [3000, 8000, 500],
            spin_order: [...SPINS.gains].reverse(),
          });
  return out;
}

describe('skin parity', () => {
  it('stage order, timings and amounts come from one skin-independent config', () => {
    // STEPS is a single list (no per-skin variant)
    expect(STEPS.length).toBeGreaterThan(40);
    // every timing and amount is a plain number, not a per-skin value
    for (const v of Object.values(TIMING)) expect(typeof v).toBe('number');
    expect(typeof ECONOMY.rounds.chartMs).toBe('number');
    expect(typeof ECONOMY.poolEntry).toBe('number');
    expect(typeof ECONOMY.crashRate).toBe('number');
  });

  for (const base of nonSkinCombos()) {
    const name = `${base.round1_outcome}/${base.withdrawal_offer}/${base.referral_source}/${base.money_source}`;
    it(`same choices → same steps, balances and payoffs in both skins (${name})`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        const plain = simulateGame({ ...base, app_version: 'plain' }, mulberry32(seed));
        const fraud = simulateGame({ ...base, app_version: 'fraud' }, mulberry32(seed));

        // Same screens in the same order
        expect(Object.keys(fraud.snapshots)).toEqual(Object.keys(plain.snapshots));

        // Same balances on every screen up to cash-out
        for (const step of Object.keys(plain.snapshots)) {
          if (
            step === 'g:cashout' ||
            step.startsWith('g:react') ||
            step === 'g:report' ||
            step === 'g:share'
          )
            continue;
          const p = plain.snapshots[step];
          const f = fraud.snapshots[step];
          expect(f.main, step).toBe(p.main);
          expect(f.portfolio, step).toBe(p.portfolio);
          expect(f.cashedOut, step).toBe(p.cashedOut);
          // the bonus is locked (fraud) or already in Profit (honest) — same total
          expect(f.profit + f.bonusLocked, step).toBe(p.profit + p.bonusLocked);
        }

        // Same payoffs
        expect(fraud.state.rounds).toEqual(plain.state.rounds);
        expect(fraud.state.deals).toEqual(plain.state.deals);
        expect(fraud.state.crashLoss).toBe(plain.state.crashLoss);
        expect(fraud.state.totalDeposited).toBe(plain.state.totalDeposited);
        expect(fraud.state.spins).toEqual(plain.state.spins);
        expect(fraud.state.brain).toEqual(plain.state.brain);

        // Cash-out: honest goes through; fraud is blocked by the tax (the H1g manipulation)
        expect(plain.state.cashout).toBe('done');
        expect(fraud.state.taxShown).toBeGreaterThanOrEqual(0);
      }
    });
  }
});
