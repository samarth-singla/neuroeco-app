import { describe, expect, it } from 'vitest';
import {
  crtCorrect,
  escalationRatio,
  literacyScore,
  lossAversion,
  meanOf,
  overconfidence,
  zScores,
  type Answers,
} from '../src/scoring';

const spins = (s150: string, s250: string): Answers => ({
  la_gain_150: s150 === 'a' ? 'accept' : 'reject',
  la_gain_250: s250 === 'a' ? 'accept' : 'reject',
});

describe('CRT (single bat-and-ball item)', () => {
  it('1 = ₹5 (correct), 0 = anything else', () => {
    expect(crtCorrect({ crt_1: '5' })).toBe(1);
    expect(crtCorrect({ crt_1: '5.0' })).toBe(1);
    expect(crtCorrect({ crt_1: '10' })).toBe(0); // the intuitive answer
    expect(crtCorrect({ crt_1: '105' })).toBe(0);
  });
  it('is blank if unanswered', () => {
    expect(crtCorrect({})).toBeNull();
    expect(crtCorrect({ crt_1: '' })).toBeNull();
  });
});

describe('loss-aversion group (2 bonus spins: lose ₹100 vs win ₹150 / ₹250)', () => {
  it('1 = accepted the ₹150 bet (low, λ ≤ 1.5)', () => {
    expect(lossAversion(spins('a', 'a'))).toEqual({ group: 1, consistent: 1, accepted: 2 });
  });
  it('2 = accepted only the ₹250 bet (typical, 1.5–2.5)', () => {
    expect(lossAversion(spins('r', 'a'))).toEqual({ group: 2, consistent: 1, accepted: 1 });
  });
  it('3 = rejected both (high, λ > 2.5)', () => {
    expect(lossAversion(spins('r', 'r'))).toEqual({ group: 3, consistent: 1, accepted: 0 });
  });
  it('accepted ₹150 but rejected ₹250 = inconsistent, blank', () => {
    expect(lossAversion(spins('a', 'r'))).toEqual({ group: null, consistent: 0, accepted: 1 });
  });
  it('does not depend on the order the spins were shown in', () => {
    const a = spins('r', 'a');
    expect(lossAversion(Object.fromEntries(Object.entries(a).reverse())).group).toBe(2);
  });
  it('is blank if a spin is unanswered', () => {
    expect(lossAversion({ la_gain_150: 'accept' })).toEqual({
      group: null,
      consistent: null,
      accepted: null,
    });
  });
});

describe('financial literacy', () => {
  it('scores the Big Three (don’t know = wrong)', () => {
    expect(
      literacyScore({ lit_interest: 'more', lit_inflation: 'less', lit_diversification: 'false' }),
    ).toBe(3);
    expect(
      literacyScore({
        lit_interest: 'dont_know',
        lit_inflation: 'less',
        lit_diversification: 'true',
      }),
    ).toBe(1);
    expect(literacyScore({ lit_interest: 'more' })).toBeNull();
  });
});

describe('overconfidence', () => {
  it('is z(self) − z(quiz) over the sample', () => {
    const self = [7, 4, 1];
    const quiz = [1, 2, 3];
    const oc = overconfidence(self, quiz);
    // z(self) = [1, 0, -1]; z(quiz) = [-1, 0, 1]
    expect(oc[0]).toBeCloseTo(2);
    expect(oc[1]).toBeCloseTo(0);
    expect(oc[2]).toBeCloseTo(-2);
  });
  it('is blank when the SD is 0, for missing values, or with fewer than 2 people', () => {
    expect(overconfidence([3, 3, 3], [1, 2, 3])).toEqual([null, null, null]);
    expect(overconfidence([5], [2])).toEqual([null]);
    const oc = overconfidence([1, null, 7], [3, 2, 1]);
    expect(oc[1]).toBeNull();
    expect(oc[0]).not.toBeNull();
  });
  it('z-scores use the sample SD', () => {
    const z = zScores([2, 4, 6]);
    expect(z[0]).toBeCloseTo(-1);
    expect(z[2]).toBeCloseTo(1);
  });
});

describe('means', () => {
  it('averages items and is blank if one is missing', () => {
    expect(meanOf({ a: '1', b: '4' }, ['a', 'b'])).toBe(2.5);
    expect(meanOf({ a: '1' }, ['a', 'b'])).toBeNull();
  });
});

describe('escalation ratio', () => {
  it('is R2 ÷ R1', () => {
    expect(escalationRatio(1000, 2000)).toBe(2);
    expect(escalationRatio(1000, 0)).toBe(0);
  });
  it('is blank when R1 is 0 or missing', () => {
    expect(escalationRatio(0, 500)).toBeNull();
    expect(escalationRatio(0, 0)).toBeNull();
    expect(escalationRatio(null, 500)).toBeNull();
  });
});
