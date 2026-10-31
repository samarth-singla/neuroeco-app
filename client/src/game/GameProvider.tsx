import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ECONOMY, SPINS, type Skin } from '../config/game';
import { api, type ParticipantInfo } from '../lib/api';
import { flush, initLogger, logEvent } from '../lib/logger';
import {
  initialGame,
  reduce,
  type GameAction,
  type GameAssignment,
  type GameState,
} from './reducer';
import { FIRST_STEP } from './steps';

/** Everything saved in sessionStorage so a refresh resumes the same player on the same screen. */
export interface SavedGame {
  participantId: string;
  assignment: GameAssignment;
  game: GameState;
  /** Answers not yet confirmed by the server (retried in the background) */
  pending: { item_id: string; value: string | number }[];
  /** Set when the player withdrew their data on the report card */
  withdrawn?: boolean;
}

const KEY = 'neuroeco:game:v1';

export function loadSavedGame(): SavedGame | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedGame) : null;
  } catch {
    return null;
  }
}

function saveGame(g: SavedGame) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(g));
  } catch {
    // storage blocked: the game still works, it just cannot resume after a refresh
  }
}

export function clearSavedGame() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

function shuffle<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Builds the game assignment from the server's participant record. */
export function toGameAssignment(info: ParticipantInfo): GameAssignment {
  const a = info.assignment;
  const valid = (xs: number[] | undefined, n: number) => Array.isArray(xs) && xs.length === n;
  return {
    app_version: a.app_version,
    round1_outcome: a.round1_outcome,
    withdrawal_offer: a.withdrawal_offer,
    referral_source: a.referral_source,
    money_source: a.money_source,
    // Fallback only for participants created before the server knew these factors
    deal_order: valid(a.deal_order, 3) ? a.deal_order! : shuffle(ECONOMY.deals.sizes),
    spin_order: valid(a.spin_order, SPINS.gains.length) ? a.spin_order! : shuffle(SPINS.gains),
  };
}

export function newSavedGame(info: ParticipantInfo): SavedGame {
  const assignment = toGameAssignment(info);
  return {
    participantId: info.participant_id,
    assignment,
    game: initialGame(assignment),
    pending: [],
  };
}

interface GameApi {
  game: GameState;
  assignment: GameAssignment;
  skin: Skin;
  participantId: string;
  dispatch: (action: GameAction) => void;
  /** Move to another step (logs, tells the server, scrolls to top). */
  go: (step: string) => void;
  /** Store a response item (sent to the server in the background, retried until saved). */
  respond: (itemId: string, value: string | number) => void;
  /** True after the player withdrew their data on the report card */
  withdrawn: boolean;
  setWithdrawn: () => void;
}

const Ctx = createContext<GameApi | null>(null);

export function useGame(): GameApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useGame must be used inside <GameProvider>');
  return c;
}

export function GameProvider({ initial, children }: { initial: SavedGame; children: ReactNode }) {
  const [saved, setSaved] = useState<SavedGame>(() => ({
    ...initial,
    game: { ...initial.game, step: initial.game.step || FIRST_STEP },
  }));
  // The reducer runs outside setState so events are logged exactly once (StrictMode-safe).
  const ref = useRef(saved);
  const sending = useRef(false);

  const commit = useCallback((next: SavedGame) => {
    ref.current = next;
    setSaved(next);
    saveGame(next);
  }, []);

  useEffect(() => {
    initLogger(saved.participantId);
  }, [saved.participantId]);

  // Save straight away, so a refresh right after consent resumes the same player
  useEffect(() => {
    saveGame(ref.current);
  }, []);

  const dispatch = useCallback(
    (action: GameAction) => {
      const cur = ref.current;
      const r = reduce(cur.game, action, cur.assignment);
      for (const e of r.events) logEvent(e.screen, e.type, e.payload);
      if (r.state !== cur.game) commit({ ...cur, game: r.state });
    },
    [commit],
  );

  // Send queued answers; on failure keep them and retry a few seconds later.
  const sendPending = useCallback(async () => {
    const cur = ref.current;
    if (sending.current || cur.pending.length === 0) return;
    sending.current = true;
    const batch = cur.pending;
    try {
      await api.postResponses(cur.participantId, batch);
      const now = ref.current;
      commit({ ...now, pending: now.pending.slice(batch.length) });
    } catch {
      setTimeout(() => void sendPending(), 4000);
    } finally {
      sending.current = false;
    }
  }, [commit]);

  useEffect(() => {
    if (saved.pending.length > 0) void sendPending();
  }, [saved.pending.length, sendPending]);

  const respond = useCallback(
    (itemId: string, value: string | number) => {
      const cur = ref.current;
      commit({ ...cur, pending: [...cur.pending, { item_id: itemId, value }] });
    },
    [commit],
  );

  const go = useCallback(
    (step: string) => {
      dispatch({ type: 'go', step });
      void flush();
      window.scrollTo?.(0, 0);
    },
    [dispatch],
  );

  // Tell the server where the player is (resume + completion). Failures retry on the next step.
  useEffect(() => {
    api.setStep(saved.participantId, saved.game.step).catch(() => undefined);
  }, [saved.participantId, saved.game.step]);

  const setWithdrawn = useCallback(() => {
    commit({ ...ref.current, withdrawn: true });
  }, [commit]);

  const value = useMemo<GameApi>(
    () => ({
      game: saved.game,
      assignment: saved.assignment,
      skin: saved.assignment.app_version,
      participantId: saved.participantId,
      dispatch,
      go,
      respond,
      withdrawn: !!saved.withdrawn,
      setWithdrawn,
    }),
    [saved, dispatch, go, respond, setWithdrawn],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
