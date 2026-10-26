/**
 * Balanced randomization. Each factor is assigned independently: the participant goes to the
 * level with the fewest participants so far, ties broken at random. This keeps groups close
 * to 50/50 even with small samples.
 */

export const FACTORS = {
  app_version: ['plain', 'fraud'], // H1
  round1_outcome: ['small_win', 'flat'], // H2
  withdrawal_offer: ['allowed', 'not_offered'], // H6
  referral_source: ['friend', 'ad'], // H5 (survey)
  money_source: ['profit', 'own'], // H7 (survey)
} as const;

export type FactorName = keyof typeof FACTORS;
export type Assignment = { [F in FactorName]: (typeof FACTORS)[F][number] };
export type LevelCounts = { [F in FactorName]?: Record<string, number> };

/** Stake levels for the H3 scenarios (within-subject; order is shuffled per participant). */
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

// DECISION: stake order for H3 is a plain random shuffle (not balanced); it is stored per participant.
export function shuffledStakes(rng: Rng = Math.random): number[] {
  const arr: number[] = [...STAKES];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
