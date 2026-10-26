import { newWallet } from '../lib/wallet';
import type { StudyState } from '../state/study';
import type { Assignment, Step } from '../types';

export const FAKE_ID = '11111111-2222-4333-8444-555555555555';

export function makeAssignment(over: Partial<Assignment> = {}): Assignment {
  return {
    app_version: 'plain',
    round1_outcome: 'small_win',
    withdrawal_offer: 'allowed',
    referral_source: 'friend',
    money_source: 'own',
    stake_order: [500, 5000, 50000],
    ...over,
  };
}

/** Puts a participant at `step` in sessionStorage, as if they had refreshed the page there. */
export function seedAt(step: Step, assignment: Assignment, over: Partial<StudyState> = {}) {
  const state: StudyState = {
    participantId: FAKE_ID,
    assignment,
    step,
    wallet: newWallet(10000),
    session: {},
    answers: {},
    ...over,
  };
  sessionStorage.setItem('neuroeco:study:v1', JSON.stringify(state));
}
