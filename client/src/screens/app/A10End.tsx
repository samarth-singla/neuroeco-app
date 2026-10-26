import { TEXT } from '../../config/session';
import { AppShell } from '../../components/AppShell';
import { Button, Card, ScreenTitle } from '../../components/ui';
import { useLog } from '../../lib/useLog';
import { formatINR } from '../../lib/wallet';
import { useStudy } from '../../state/study';

/** A10 — End of the app session; continues to the UI/UX survey. */
export function A10End() {
  const { state, version, go } = useStudy();
  useLog('A10');
  return (
    <AppShell
      wallet={state.wallet}
      version={version}
      actions={<Button onClick={() => go('uiux:0')}>{TEXT.A10.cta}</Button>}
    >
      <ScreenTitle title={TEXT.A10.title} />
      <Card>
        <p className="text-sm text-gray-300">{TEXT.A10.body}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-ink-700 p-2">
            <div className="text-gray-400">Practice balance</div>
            <div className="font-semibold text-white">{formatINR(state.wallet.cash)}</div>
          </div>
          <div className="rounded-xl bg-ink-700 p-2">
            <div className="text-gray-400">Left in app</div>
            <div className="font-semibold text-white">{formatINR(state.wallet.appBalance)}</div>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
