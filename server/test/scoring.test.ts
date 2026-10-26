import { describe, expect, it } from 'vitest';
import {
  crtScore,
  escalationRatio,
  LAMBDA_REJECT_ALL,
  literacyScore,
  lossAversion,
  meanOf,
  overconfidence,
  zScores,
  type Answers,
} from '../src/scoring';

const gambles = (choices: string): Answers => {
  // choices: 6 letters, a = accept, r = reject, for gains 50…300
  const gains = [50, 100, 150, 200, 250, 300];
  return Object.fromEntries(
    gains.map((g, i) => [`la_gain_${g}`, choices[i] === 'a' ? 'accept' : 'reject']),
  );
};

describe('CRT', () => {
  it('scores 0–3 against 5, 5, 47', () => {
    expect(crtScore({ crt_1: '5', crt_2: '5', crt_3: '47' })).toBe(3);
    expect(crtScore({ crt_1: '10', crt_2: '100', crt_3: '24' })).toBe(0); // intuitive answers
    expect(crtScore({ crt_1: '5.0', crt_2: '100', crt_3: '47' })).toBe(2);
  });
  it('is blank if an answer is missing', () => {
    expect(crtScore({ crt_1: '5', crt_2: '5' })).toBeNull();
    expect(crtScore({ crt_1: '5', crt_2: '5', crt_3: '' })).toBeNull();
  });
});

describe('loss aversion λ', () => {
  it('uses the smallest accepted gain ÷ 100', () => {
    expect(lossAversion(gambles('rrrraa'))).toEqual({ lambda: 2.5, consistent: 1, accepted: 2 });
    expect(lossAversion(gambles('raaaaa')).lambda).toBe(1);
    expect(lossAversion(gambles('rrraaa')).lambda).toBe(2);
  });
  it('accept-all gives 0.5, reject-all is top-coded', () => {
    expect(lossAversion(gambles('aaaaaa')).lambda).toBe(0.5);
    expect(lossAversion(gambles('rrrrrr'))).toEqual({
      lambda: LAMBDA_REJECT_ALL,
      consistent: 1,
      accepted: 0,
    });
  });
  it('flags inconsistent choices and leaves λ blank', () => {
    expect(lossAversion(gambles('rarara'))).toEqual({ lambda: null, consistent: 0, accepted: 3 });
    expect(lossAversion(gambles('aaaaar'))).toMatchObject({ lambda: null, consistent: 0 });
  });
  it('is blank if any gamble is unanswered', () => {
    const a = gambles('rrraaa');
    delete a.la_gain_150;
    expect(lossAversion(a)).toEqual({ lambda: null, consistent: null, accepted: null });
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
