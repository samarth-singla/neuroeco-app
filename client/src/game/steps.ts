/**
 * The game is a fixed sequence of steps. Each step is one screen; the step id is stored as the
 * participant's `current_step` (server) and in sessionStorage, so a refresh resumes on it.
 *
 * Order follows a scam lifecycle: profile → spins → hook (home) → rounds 1–3 → brain bonus →
 * round 4 → mentor chat → rounds 5–6 → flash deals → pool → test withdrawal → reinvest →
 * crash → cash out → quick reactions → report card → share.
 */
import { BRAIN, FEATURES, FOMO, PROFILE, SLIDERS, SPINS } from '../config/game';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export const STEPS: string[] = [
  ...range(PROFILE.length).map((i) => `g:profile:${i}`),
  ...range(SPINS.gains.length).map((i) => `g:spin:${i}`),
  'g:home',
  'g:round:1',
  'g:round:2',
  'g:round:3',
  ...range(BRAIN.length).map((i) => `g:brain:${i}`),
  'g:round:4',
  'g:chat',
  'g:round:5',
  'g:round:6',
  'g:deal:0',
  'g:deal:1',
  'g:deal:2',
  'g:pool',
  'g:withdraw',
  'g:reinvest',
  'g:crash',
  'g:cashout',
  ...range(FEATURES.length + SLIDERS.length + FOMO.length).map((i) => `g:react:${i}`),
  'g:report',
  'g:share',
  'g:end',
];

export const FIRST_STEP = STEPS[0];

export function nextStep(step: string): string {
  const i = STEPS.indexOf(step);
  return i < 0 || i === STEPS.length - 1 ? 'g:end' : STEPS[i + 1];
}

export function isGameStep(step: string): boolean {
  return STEPS.includes(step);
}

/** "S1"…"S15" stage of a step (for the level bar and the docs). */
export function stageOf(step: string): number {
  const kind = step.split(':')[1];
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
  return map[kind] ?? 1;
}

export function stepKind(step: string): string {
  return step.split(':')[1] ?? '';
}

export function stepIndex(step: string): number {
  return Number(step.split(':')[2] ?? 0);
}

/** Progress for the level bar, 0–1. */
export function progressOf(step: string): number {
  const i = STEPS.indexOf(step);
  return i < 0 ? 0 : i / (STEPS.length - 1);
}

/** Steps that mean all data has been collected (report card reached). */
export const COMPLETE_STEPS = ['g:report', 'g:share', 'g:end'];
