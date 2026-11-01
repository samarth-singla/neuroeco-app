/**
 * The game is a fixed sequence of steps. Each step is one screen (or one pop-up over the game
 * screen); the step id is stored as the participant's `current_step` (server) and in
 * sessionStorage, so a refresh resumes on it.
 *
 * Order follows a scam lifecycle, with the mini-games interleaved with the trading rounds:
 * profile → home (hook) → spin 1 → round 1 → bonus question 1 → round 2 → spin 2 → round 3 →
 * bonus questions 2–3 → [mentor chat] → round 4 → bonus question 4 → flash deals → pool →
 * test withdrawal → reinvest → crash → cash out → quick reactions → report card → share.
 *
 * The honest skin has no mentor-chat screen and no feature swipe cards (it answers only the
 * slider and FOMO reactions); everything else — order, amounts, payoffs, timings — is identical.
 */
import { BRAIN, FEATURES, FOMO, PROFILE, SLIDERS, type Skin } from '../config/game';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Bonus question k (0-based) = BRAIN[k]; spin k = assignment.spin_order[k]. */
const FLOW: string[] = [
  ...range(PROFILE.length).map((i) => `g:profile:${i}`),
  'g:home',
  'g:spin:0',
  'g:round:1',
  'g:brain:0',
  'g:round:2',
  'g:spin:1',
  'g:round:3',
  'g:brain:1',
  'g:brain:2',
  'g:chat', // fraud only
  'g:round:4',
  'g:brain:3',
  'g:deal',
  'g:pool',
  'g:withdraw',
  'g:reinvest',
  'g:crash',
  'g:cashout',
  // Quick reactions: feature cards 0–6 are fraud only; sliders and FOMO statements for everyone
  ...range(FEATURES.length + SLIDERS.length + FOMO.length).map((i) => `g:react:${i}`),
  'g:report',
  'g:share',
  'g:end',
];

export function stepKind(step: string): string {
  return step.split(':')[1] ?? '';
}

export function stepIndex(step: string): number {
  return Number(step.split(':')[2] ?? 0);
}

/** Steps that only the fraud skin shows. */
export function fraudOnlyStep(step: string): boolean {
  if (step === 'g:chat') return true;
  return stepKind(step) === 'react' && stepIndex(step) < FEATURES.length;
}

const BY_SKIN: Record<Skin, string[]> = {
  fraud: FLOW,
  plain: FLOW.filter((s) => !fraudOnlyStep(s)),
};

export function stepsFor(skin: Skin): string[] {
  return BY_SKIN[skin];
}

/** Every step id either skin can be on. */
export const ALL_STEPS = FLOW;

export const FIRST_STEP = FLOW[0];

if (BRAIN.length !== FLOW.filter((s) => s.startsWith('g:brain:')).length) {
  throw new Error('steps.ts: one g:brain step per BRAIN question');
}

export function nextStep(step: string, skin: Skin): string {
  const list = stepsFor(skin);
  const i = list.indexOf(step);
  return i < 0 || i === list.length - 1 ? 'g:end' : list[i + 1];
}

export function isGameStep(step: string, skin?: Skin): boolean {
  return (skin ? stepsFor(skin) : FLOW).includes(step);
}

/** "S1"…"S15" stage of a step (for the level bar and the docs). */
export function stageOf(step: string): number {
  const map: Record<string, number> = {
    profile: 1,
    spin: 2,
    home: 3,
    round: 4,
    brain: 5,
    chat: 6,
    deal: 7,
    pool: 8,
    withdraw: 9,
    reinvest: 10,
    crash: 11,
    cashout: 12,
    react: 13,
    report: 14,
    share: 15,
    end: 15,
  };
  return map[stepKind(step)] ?? 1;
}

/** Progress for the level bar, 0–1, within the player's own skin. */
export function progressOf(step: string, skin: Skin): number {
  const list = stepsFor(skin);
  const i = list.indexOf(step);
  return i < 0 ? 0 : i / (list.length - 1);
}

/** The next trading round at or after this step (shown behind a pop-up); null after round 4. */
export function upcomingRound(step: string): number | null {
  const i = FLOW.indexOf(step);
  for (let k = Math.max(0, i); k < FLOW.length; k++) {
    if (stepKind(FLOW[k]) === 'round') return stepIndex(FLOW[k]);
  }
  return null;
}

/** Steps that mean all data has been collected (report card reached). */
export const COMPLETE_STEPS = ['g:report', 'g:share', 'g:end'];
