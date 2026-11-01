import { SPINS } from '../config/game';
import { initialGame, type GameAssignment, type GameState } from '../game/reducer';
import type { SavedGame } from '../game/GameProvider';

export const FAKE_ID = '11111111-2222-4333-8444-555555555555';

export function gameAssignment(over: Partial<GameAssignment> = {}): GameAssignment {
  return {
    app_version: 'fraud',
    round1_outcome: 'small_win',
    withdrawal_offer: 'allowed',
    referral_source: 'friend',
    money_source: 'profit',
    deal_order: [500, 3000, 8000],
    spin_order: [...SPINS.gains],
    ...over,
  };
}

/** Puts a game player at `step` in sessionStorage, as if they had refreshed there. */
export function seedGame(step: string, a: GameAssignment, over: Partial<GameState> = {}) {
  const saved: SavedGame = {
    participantId: FAKE_ID,
    assignment: a,
    game: { ...initialGame(a), ...over, step },
    pending: [],
  };
  sessionStorage.setItem('neuroeco:game:v1', JSON.stringify(saved));
}

export function savedGame(): SavedGame {
  return JSON.parse(sessionStorage.getItem('neuroeco:game:v1')!) as SavedGame;
}

/** Fake-API assignment shape */
export function apiAssignment(a: GameAssignment) {
  return { ...a };
}
