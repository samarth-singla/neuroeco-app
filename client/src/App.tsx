import { useState, type ComponentType } from 'react';
import { StudyLayout } from './components/AppShell';
import { Button, ScreenTitle } from './components/ui';
import { StudyProvider, useBootstrap, useStudy } from './state/study';
import type { AppScreen } from './types';
import { A1Welcome } from './screens/app/A1Welcome';
import { A2Plans } from './screens/app/A2Plans';
import { DepositScreen } from './screens/app/DepositScreen';
import { A4Outcome } from './screens/app/A4Outcome';
import { A6Withdrawal } from './screens/app/A6Withdrawal';
import { A8Loss } from './screens/app/A8Loss';
import { A9FinalWithdrawal } from './screens/app/A9FinalWithdrawal';
import { A10End } from './screens/app/A10End';

function isPilotLink(): boolean {
  return new URLSearchParams(window.location.search).get('pilot') === '1';
}

const APP_SCREENS: Record<AppScreen, ComponentType> = {
  A1: A1Welcome,
  A2: A2Plans,
  A3: () => <DepositScreen round={1} />,
  A4: A4Outcome,
  A5: () => <DepositScreen round={2} />,
  A6: A6Withdrawal,
  A7: () => <DepositScreen round={3} />,
  A8: A8Loss,
  A9: A9FinalWithdrawal,
  A10: A10End,
};

// Temporary start screen (replaced by the consent screen in Phase 7)
function Start({ onStart }: { onStart: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <StudyLayout>
      <ScreenTitle title="Research study" subtitle="Placeholder start screen" />
      <Button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          onStart().finally(() => setBusy(false));
        }}
      >
        Start
      </Button>
    </StudyLayout>
  );
}

function Router() {
  const { state } = useStudy();
  const step = state.step;
  if (step.startsWith('app:')) {
    const Screen = APP_SCREENS[step.slice(4) as AppScreen] ?? A1Welcome;
    // key: remount (fresh screen_view + decision timer) on every screen change
    return <Screen key={step} />;
  }
  return (
    <StudyLayout>
      <ScreenTitle title="Survey" subtitle={`Coming in a later phase (${step})`} />
    </StudyLayout>
  );
}

export default function App() {
  const { status, initial, start } = useBootstrap();
  if (status === 'loading') return <StudyLayout>Loading…</StudyLayout>;
  if (!initial) return <Start onStart={() => start(isPilotLink())} />;
  return (
    <StudyProvider initial={initial}>
      <Router />
    </StudyProvider>
  );
}
