import { useEffect, useRef, useState } from 'react';
import { TEXT } from '../../config/session';
import { AppShell } from '../../components/AppShell';
import { Button, Card, ScreenTitle } from '../../components/ui';
import { DepositForm } from '../../features/DepositForm';
import { useLog } from '../../lib/useLog';
import { formatINR } from '../../lib/wallet';
import { useStudy } from '../../state/study';

/** A8 — Scripted loss (H4): −30% "market correction", then "Top up to recover" or "Leave". */
export function A8Loss() {
  const { state, version, go } = useStudy();
  const log = useLog('A8');
  const [toppingUp, setToppingUp] = useState(false);
  const loss = state.session.lossAmount ?? 0;
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    log('loss_shown', { loss, app_balance: state.wallet.appBalance });
  }, [log, loss, state.wallet.appBalance]);

  return (
    <AppShell
      wallet={state.wallet}
      version={version}
      nav="wallet"
      actions={
        toppingUp ? undefined : (
          <>
            <Button
              onClick={() => {
                log('topup_click');
                setToppingUp(true);
              }}
            >
              {TEXT.A8.topupCta}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                log('topup_decline');
                go('app:A9', { session: { topup: 0 } });
              }}
            >
              {TEXT.A8.leaveCta}
            </Button>
          </>
        )
      }
    >
      <ScreenTitle title={TEXT.A8.title} />
      <Card className="border-red-500/40 text-center">
        <div className="text-5xl font-extrabold text-red-400">−30%</div>
        <p className="mt-2 text-gray-300">{TEXT.A8.body}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-ink-700 p-2">
            <div className="text-gray-400">Loss</div>
            <div className="font-semibold text-red-400">−{formatINR(loss)}</div>
          </div>
          <div className="rounded-xl bg-ink-700 p-2">
            <div className="text-gray-400">Value in app</div>
            <div className="font-semibold text-white">{formatINR(state.wallet.appBalance)}</div>
          </div>
        </div>
      </Card>

      {toppingUp && (
        <div className="mt-4">
          <DepositForm
            max={state.wallet.cash}
            confirmLabel={TEXT.A8.topupConfirm}
            skipLabel={TEXT.A8.topupCancel}
            onConfirm={(amount) => {
              log('topup_submit', { amount });
              go('app:A9', { wallet: [{ type: 'deposit', amount }], session: { topup: amount } });
            }}
            onSkip={() => {
              log('topup_cancel');
              setToppingUp(false);
            }}
          />
        </div>
      )}
    </AppShell>
  );
}
