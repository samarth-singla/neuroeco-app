/**
 * Derived scores, computed at export time (never in the browser).
 * Inputs are the raw `responses` values (strings) keyed by item id.
 */
import { ANSWER_KEY, SPINS } from '../../client/src/config/game';

// Game bonus spins (S2): 50% lose ₹100 vs 50% win ₹100, ₹150, ₹200 or ₹300, ordered by win
const GAMBLE_GAINS = [...SPINS.gains].sort((x, y) => x - y);
const GAMBLE_LOSS = SPINS.loss;

export type Answers = Record<string, string | undefined>;

function num(v: string | undefined): number | null {
  if (v === undefined || v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Correct CRT answers (₹ version of bat-and-ball; machines; lily pads). */
export const CRT_KEY: Record<string, number> = ANSWER_KEY.crt;

/** CRT score 0–3; null if any item is missing. */
export function crtScore(a: Answers): number | null {
  let score = 0;
  for (const [id, correct] of Object.entries(CRT_KEY)) {
    const n = num(a[id]);
    if (n === null) return null;
    if (Math.abs(n - correct) < 1e-9) score++;
  }
  return score;
}

export interface LossAversion {
  /** λ = smallest accepted gain ÷ loss; 3.5 if every gamble is rejected; null if inconsistent/missing */
  lambda: number | null;
  /** 1 = at most one switch from reject to accept; 0 = inconsistent; null = missing */
  consistent: 0 | 1 | null;
  accepted: number | null;
}

/** Top-coded λ for participants who reject every gamble (λ > 300/100). */
// DECISION: reject-all is top-coded to 3.5 (beyond the largest ratio offered, 3.0).
export const LAMBDA_REJECT_ALL = 3.5;

/**
 * Loss aversion from the four 50-50 bonus spins (lose ₹100 vs win ₹100 / 150 / 200 / 300).
 * With linear utility a person accepts when win ≥ λ × loss, so λ = smallest accepted win ÷ 100:
 * 1, 1.5, 2 or 3 (accepting all gives 1). Rejecting all = 3.5. Accepting a win and then rejecting a
 * larger one is inconsistent → λ blank.
 */
export function lossAversion(a: Answers): LossAversion {
  const choices = GAMBLE_GAINS.map((g) => a[`la_gain_${g}`]);
  if (choices.some((c) => c !== 'accept' && c !== 'reject')) {
    return { lambda: null, consistent: null, accepted: null };
  }
  const accepted = choices.filter((c) => c === 'accept').length;
  const first = choices.indexOf('accept');
  // Consistent = once a gamble is accepted, every larger gain is accepted too.
  const consistent = first === -1 || choices.slice(first).every((c) => c === 'accept');
  if (!consistent) return { lambda: null, consistent: 0, accepted };
  const lambda = first === -1 ? LAMBDA_REJECT_ALL : GAMBLE_GAINS[first] / GAMBLE_LOSS;
  return { lambda, consistent: 1, accepted };
}

/** Correct Big Three answers. */
export const LITERACY_KEY: Record<string, string> = ANSWER_KEY.literacy;

/** Literacy score 0–3 ("don't know" counts as wrong); null if any item is missing. */
export function literacyScore(a: Answers): number | null {
  let score = 0;
  for (const [id, correct] of Object.entries(LITERACY_KEY)) {
    if (a[id] === undefined) return null;
    if (a[id] === correct) score++;
  }
  return score;
}

/** Mean of the given items; null if any is missing. */
export function meanOf(a: Answers, ids: string[]): number | null {
  const vals = ids.map((id) => num(a[id]));
  if (vals.some((v) => v === null)) return null;
  return (vals as number[]).reduce((s, v) => s + v, 0) / vals.length;
}

/** z-scores over a sample (sample SD, n − 1). Null in → null out; all null if SD is 0 or n < 2. */
export function zScores(values: (number | null)[]): (number | null)[] {
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 2) return values.map(() => null);
  const mean = present.reduce((s, v) => s + v, 0) / present.length;
  const sd = Math.sqrt(present.reduce((s, v) => s + (v - mean) ** 2, 0) / (present.length - 1));
  // DECISION: if everyone has the same score the z-score is undefined, so overconfidence is left blank.
  if (sd === 0) return values.map(() => null);
  return values.map((v) => (v === null ? null : (v - mean) / sd));
}

/** Overconfidence = z(self-rated literacy) − z(literacy quiz score), over the exported sample. */
export function overconfidence(
  selfRated: (number | null)[],
  quiz: (number | null)[],
): (number | null)[] {
  const zs = zScores(selfRated);
  const zq = zScores(quiz);
  return zs.map((s, i) => (s === null || zq[i] === null ? null : s - (zq[i] as number)));
}

/** R2 ÷ R1; null when R1 is 0 (or missing). */
export function escalationRatio(r1: number | null, r2: number | null): number | null {
  if (r1 === null || r2 === null || r1 <= 0) return null;
  return r2 / r1;
}
