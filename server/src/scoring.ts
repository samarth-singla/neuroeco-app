/**
 * Derived scores, computed at export time (never in the browser).
 * Inputs are the raw `responses` values (strings) keyed by item id.
 */
import { ANSWER_KEY, SPINS } from '../../client/src/config/game';

// Game bonus spins (S2): 50% lose ₹100 vs 50% win ₹150 or ₹250 (two pop-ups, random order)
const [LOW_WIN, HIGH_WIN] = [...SPINS.gains].sort((x, y) => x - y);

export type Answers = Record<string, string | undefined>;

function num(v: string | undefined): number | null {
  if (v === undefined || v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Correct CRT answer (₹ version of bat-and-ball: the ball costs ₹5). */
export const CRT_KEY: Record<string, number> = ANSWER_KEY.crt;

/** CRT (single bat-and-ball item): 1 = correct, 0 = incorrect, null if unanswered. */
export function crtCorrect(a: Answers): 0 | 1 | null {
  const ids = Object.keys(CRT_KEY);
  let correct = 1 as 0 | 1;
  for (const id of ids) {
    const n = num(a[id]);
    if (n === null) return null;
    if (Math.abs(n - CRT_KEY[id]) >= 1e-9) correct = 0;
  }
  return correct;
}

export interface LossAversion {
  /**
   * 1 = accepted the ₹150 bet (low, λ ≤ 1.5); 2 = accepted only the ₹250 bet (typical, 1.5–2.5);
   * 3 = rejected both (high, λ > 2.5); null if inconsistent (accepted ₹150, rejected ₹250) or missing
   */
  group: 1 | 2 | 3 | null;
  /** 1 = consistent, 0 = accepted ₹150 but rejected ₹250; null = missing */
  consistent: 0 | 1 | null;
  accepted: number | null;
}

/**
 * Loss aversion from the two 50-50 bonus spins (lose ₹100 vs win ₹150 / ₹250). With linear
 * utility a bet is accepted when win ≥ λ × loss, so accepting ₹150 means λ ≤ 1.5, accepting only
 * ₹250 means 1.5 < λ ≤ 2.5, and rejecting both means λ > 2.5.
 */
export function lossAversion(a: Answers): LossAversion {
  const low = a[`la_gain_${LOW_WIN}`];
  const high = a[`la_gain_${HIGH_WIN}`];
  const ok = (c: string | undefined) => c === 'accept' || c === 'reject';
  if (!ok(low) || !ok(high)) return { group: null, consistent: null, accepted: null };
  const accepted = (low === 'accept' ? 1 : 0) + (high === 'accept' ? 1 : 0);
  if (low === 'accept' && high === 'reject') return { group: null, consistent: 0, accepted };
  const group = low === 'accept' ? 1 : high === 'accept' ? 2 : 3;
  return { group, consistent: 1, accepted };
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
