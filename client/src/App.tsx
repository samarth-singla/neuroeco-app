import { useState } from 'react';
import { AppShell, StudyLayout } from './components/AppShell';
import { Button, Card, ScreenTitle } from './components/ui';
import { StudyProvider, useBootstrap, useStudy } from './state/study';
import { useLog } from './lib/useLog';
import { formatINR } from './lib/wallet';

function isPilotLink(): boolean {
  return new URLSearchParams(window.location.search).get('pilot') === '1';
}

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

function DemoScreen() {
  const { state, version, update } = useStudy();
  const log = useLog('A1');
  return (
    <AppShell wallet={state.wallet} version={version}>
      <ScreenTitle title="Shell preview" subtitle={`Version: ${version}`} />
      <Card>
        <p className="text-sm text-gray-300">
          Deposit {formatINR(1000)} to check the wallet updates.
        </p>
        <Button
          className="mt-3"
          onClick={() => {
            log('deposit_submit', { round: 0, amount: 1000 });
            update({ wallet: [{ type: 'deposit', amount: 1000 }] });
          }}
        >
          Deposit ₹1,000
        </Button>
      </Card>
    </AppShell>
  );
}

export default function App() {
  const { status, initial, start } = useBootstrap();
  if (status === 'loading') return <StudyLayout>Loading…</StudyLayout>;
  if (!initial) return <Start onStart={() => start(isPilotLink())} />;
  return (
    <StudyProvider initial={initial}>
      <DemoScreen />
    </StudyProvider>
  );
}
