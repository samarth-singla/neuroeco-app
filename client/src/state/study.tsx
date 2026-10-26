import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, type ParticipantInfo } from '../lib/api';
import { flush, initLogger } from '../lib/logger';
import { clearSaved, loadSaved, save } from '../lib/storage';
import { applyAll, newWallet, walletReducer, type Wallet, type WalletAction } from '../lib/wallet';
import { BONUS, WALLET } from '../config/session';
import type { Answers, AppVersion, Assignment, Step } from '../types';

/** Choices made during the app session that later screens need (also logged as events). */
export interface SessionData {
  planId?: string;
  r1?: number;
  r2?: number;
  r3?: number;
  r1Gain?: number;
  smallWithdrawal?: number | 'skipped' | 'unavailable';
  lossAmount?: number;
  topup?: number;
  finalWithdrawal?: 'done' | 'fee_paid' | 'fee_declined' | 'kept' | 'none';
  fee?: number;
  finalAmount?: number;
}

export interface StudyState {
  participantId: string;
  assignment: Assignment;
  step: Step;
  wallet: Wallet;
  session: SessionData;
  answers: Answers;
}

export interface Change {
  wallet?: WalletAction[];
  session?: Partial<SessionData>;
}

interface StudyApi {
  state: StudyState;
  version: AppVersion;
  /** Move to another step, applying wallet/session changes in the same update. */
  go: (step: Step, change?: Change) => void;
  update: (change: Change) => void;
  /** Saves survey answers to the server (throws if it fails) and keeps them locally. */
  saveAnswers: (answers: Answers) => Promise<void>;
}

const StudyContext = createContext<StudyApi | null>(null);

export function useStudy(): StudyApi {
  const ctx = useContext(StudyContext);
  if (!ctx) throw new Error('useStudy must be used inside <StudyProvider>');
  return ctx;
}

export function initialState(info: ParticipantInfo): StudyState {
  let wallet = newWallet(WALLET.startingCash);
  if (info.assignment.app_version === 'fraud') {
    wallet = walletReducer(wallet, { type: 'credit_bonus', amount: BONUS.amount });
  }
  return {
    participantId: info.participant_id,
    assignment: info.assignment,
    step: 'app:A1',
    wallet,
    session: {},
    answers: {},
  };
}

function applyChange(s: StudyState, change?: Change): StudyState {
  if (!change) return s;
  return {
    ...s,
    wallet: change.wallet ? applyAll(s.wallet, change.wallet) : s.wallet,
    session: change.session ? { ...s.session, ...change.session } : s.session,
  };
}

export function StudyProvider({ initial, children }: { initial: StudyState; children: ReactNode }) {
  const [state, setState] = useState<StudyState>(initial);

  useEffect(() => {
    initLogger(state.participantId);
  }, [state.participantId]);

  useEffect(() => {
    save(state);
  }, [state]);

  const go = useCallback((step: Step, change?: Change) => {
    setState((s) => ({ ...applyChange(s, change), step }));
    void flush();
    window.scrollTo?.(0, 0);
  }, []);

  // Tell the server about every step change (for resume and completion). Failures are retried
  // on the next change; the local copy in sessionStorage is the main resume source.
  useEffect(() => {
    api.setStep(state.participantId, state.step).catch(() => undefined);
  }, [state.participantId, state.step]);

  const update = useCallback((change: Change) => {
    setState((s) => applyChange(s, change));
  }, []);

  const saveAnswers = useCallback(
    async (answers: Answers) => {
      const list = Object.entries(answers).map(([item_id, value]) => ({ item_id, value }));
      if (list.length > 0) await api.postResponses(state.participantId, list);
      setState((s) => ({ ...s, answers: { ...s.answers, ...answers } }));
    },
    [state.participantId],
  );

  const value = useMemo<StudyApi>(
    () => ({ state, version: state.assignment.app_version, go, update, saveAnswers }),
    [state, go, update, saveAnswers],
  );

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

/**
 * Loads a saved participant from sessionStorage (refresh-resume) and checks it still exists
 * on the server. `start()` creates a new participant after consent.
 */
export function useBootstrap() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [initial, setInitial] = useState<StudyState | null>(null);

  useEffect(() => {
    const saved = loadSaved<StudyState>();
    if (!saved?.participantId) {
      setStatus('ready');
      return;
    }
    api
      .getParticipant(saved.participantId)
      .then((info) => {
        if (info) setInitial(saved);
        else clearSaved(); // database was reset: start fresh
      })
      .catch(() => setInitial(saved)) // offline: keep going with the local copy
      .finally(() => setStatus('ready'));
  }, []);

  const start = useCallback(async (pilot: boolean) => {
    const info = await api.createParticipant(pilot);
    const s = initialState(info);
    save(s);
    setInitial(s);
  }, []);

  return { status, initial, start };
}
