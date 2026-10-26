import { describe, expect, it } from 'vitest';
import { all, get, openDb } from '../src/db';
import { createParticipant } from '../src/store';
import { FACTORS, pickBalanced, shuffledStakes, STAKES, type FactorName } from '../src/randomize';

function seeded(seed: number) {
  // Small deterministic PRNG (mulberry32) so failures are reproducible
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('pickBalanced', () => {
  it('picks the level with the fewest participants', () => {
    expect(pickBalanced(['a', 'b'], { a: 3, b: 1 }, Math.random)).toBe('b');
    expect(pickBalanced(['a', 'b'], { a: 0, b: 2 }, Math.random)).toBe('a');
  });

  it('breaks ties at random', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(pickBalanced(['a', 'b'], { a: 2, b: 2 }, Math.random));
    expect(seen).toEqual(new Set(['a', 'b']));
  });

  it('treats missing levels as zero', () => {
    expect(pickBalanced(['a', 'b'], { a: 1 }, Math.random)).toBe('b');
  });
});

describe('balanced randomization over the database', () => {
  for (const seed of [1, 42, 2026]) {
    it(`keeps every factor within 50 ± 2 for 100 participants (seed ${seed})`, async () => {
      const db = await openDb(':memory:');
      const rng = seeded(seed);
      for (let i = 0; i < 100; i++) await createParticipant(db, rng);
      for (const factor of Object.keys(FACTORS) as FactorName[]) {
        for (const level of FACTORS[factor]) {
          const { n } = (await get<{ n: number }>(
            db,
            `SELECT COUNT(*) AS n FROM participants WHERE ${factor} = ?`,
            [level],
          ))!;
          expect(n, `${factor}=${level}`).toBeGreaterThanOrEqual(48);
          expect(n, `${factor}=${level}`).toBeLessThanOrEqual(52);
        }
      }
    });
  }

  it('assigns factors independently (all 8 app-session cells get participants)', async () => {
    const db = await openDb(':memory:');
    const rng = seeded(7);
    for (let i = 0; i < 100; i++) await createParticipant(db, rng);
    const cells = await all(
      db,
      'SELECT app_version, round1_outcome, withdrawal_offer, COUNT(*) AS n FROM participants GROUP BY 1, 2, 3',
    );
    expect(cells).toHaveLength(8);
  });
});

describe('shuffledStakes', () => {
  it('returns a permutation of the three stake levels', () => {
    for (let i = 0; i < 20; i++) {
      expect([...shuffledStakes()].sort((a, b) => a - b)).toEqual([...STAKES]);
    }
  });
});
