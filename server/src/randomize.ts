/**
 * Balanced randomization. Each factor is assigned independently: the participant goes to the
 * level with the fewest participants so far, ties broken at random. This keeps groups close
 * to 50/50 even with small samples.
 */
import { ECONOMY, SPINS } from '../../client/src/config/game';

export const FACTORS = {
  app_version: ['plain', 'fraud'], // H1: skin (plain = honest "ZenTrade", fraud = "ZenTrade X")
  round1_outcome: ['small_win', 'flat'], // H2
  withdrawal_offer: ['allowed', 'not_offered'], // H6: test withdrawal
  referral_source: ['friend', 'ad'], // H5: pool invite source
  money_source: ['profit', 'own'], // H7: reinvest framing (profit wallet / main wallet)
} as const;

export type FactorName = keyof typeof FACTORS;
export type Assignment = { [F in FactorName]: (typeof FACTORS)[F][number] };
export type LevelCounts = { [F in FactorName]?: Record<string, number> };

/** v1 survey: stake levels for the H3 scenarios (kept until the v1 flow is removed). */
export const STAKES = [500, 5000, 50000] as const;

export type Rng = () => number;

export function pickBalanced<T extends string>(
  levels: readonly T[],
  counts: Record<string, number>,
  rng: Rng,
): T {
  const min = Math.min(...levels.map((l) => counts[l] ?? 0));
  const smallest = levels.filter((l) => (counts[l] ?? 0) === min);
  return smallest[Math.floor(rng() * smallest.length)];
}

export function assignFactors(counts: LevelCounts, rng: Rng = Math.random): Assignment {
  const out = {} as Record<FactorName, string>;
  for (const factor of Object.keys(FACTORS) as FactorName[]) {
    out[factor] = pickBalanced(FACTORS[factor], counts[factor] ?? {}, rng);
  }
  return out as Assignment;
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// DECISION: order factors (v1 stakes, flash deals, spins) are plain random permutations per
// participant, not balanced; they are order controls, stored per participant.
export function shuffledStakes(rng: Rng = Math.random): number[] {
  return shuffle(STAKES, rng);
}

/** Game: flash-deal sizes (₹500 / ₹3,000 / ₹8,000) in the order shown (H3). */
export function shuffledDeals(rng: Rng = Math.random): number[] {
  return shuffle(ECONOMY.deals.sizes, rng);
}

/** Game: bonus-spin gains (₹50…₹300) in the order shown (H4). */
export function shuffledSpins(rng: Rng = Math.random): number[] {
  return shuffle(SPINS.gains, rng);
}
