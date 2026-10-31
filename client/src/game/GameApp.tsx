import { useEffect, useState, type ComponentType } from 'react';
import { StudyLayout } from '../components/AppShell';
import { api } from '../lib/api';
import { Consent } from '../screens/Consent';
import {
  clearSavedGame,
  GameProvider,
  loadSavedGame,
  newSavedGame,
  useGame,
  type SavedGame,
} from './GameProvider';
import { isGameStep, stepKind } from './steps';
import { Brain } from './stages/Brain';
import { Chat } from './stages/Chat';
import { Deal, Pool } from './stages/Deals';
import { Home } from './stages/Home';
import { Cashout, Crash, Reinvest, Withdraw } from './stages/Money';
import { Profile } from './stages/Profile';
import { Reactions } from './stages/Reactions';
import { End, Report, Share } from './stages/Report';
import { Round } from './stages/Round';
import { Spins } from './stages/Spins';

const STAGES: Record<string, ComponentType> = {
  profile: Profile,
  spin: Spins,
  home: Home,
  round: Round,
  brain: Brain,
  chat: Chat,
  deal: Deal,
  pool: Pool,
  withdraw: Withdraw,
  reinvest: Reinvest,
  crash: Crash,
  cashout: Cashout,
  react: Reactions,
  report: Report,
  share: Share,
  end: End,
};

function GameRouter() {
  const { game } = useGame();
  const Stage = STAGES[stepKind(game.step)] ?? Profile;
  // key: every step is a fresh screen (new screen_view, decision timer and local state)
  return <Stage key={game.step} />;
}

function isPilotLink(): boolean {
  return new URLSearchParams(window.location.search).get('pilot') === '1';
}

/** The game: consent → new player (server-side randomization) → stages. Resumes after refresh. */
export function GameApp() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [saved, setSaved] = useState<SavedGame | null>(null);

  useEffect(() => {
    const s = loadSavedGame();
    if (!s?.participantId || !isGameStep(s.game.step)) {
      setStatus('ready');
      return;
    }
    api
      .getParticipant(s.participantId)
      .then((info) => {
        if (info) setSaved(s);
        else clearSavedGame(); // database was reset: start fresh
      })
      .catch(() => setSaved(s)) // offline: continue with the local copy
      .finally(() => setStatus('ready'));
  }, []);

  if (status === 'loading') return <StudyLayout>Loading…</StudyLayout>;
  if (!saved) {
    return (
      <Consent
        onAgree={async () => {
          const info = await api.createParticipant(isPilotLink());
          setSaved(newSavedGame(info));
        }}
      />
    );
  }
  return (
    <GameProvider initial={saved}>
      <GameRouter />
    </GameProvider>
  );
}
