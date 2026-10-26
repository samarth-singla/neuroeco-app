import { useEffect, useRef } from 'react';
import { OUTCOMES, TEXT } from '../../config/session';
import { AppShell } from '../../components/AppShell';
import { Button, Card, ScreenTitle } from '../../components/ui';
import { useLog } from '../../lib/useLog';
import { formatINR } from '../../lib/wallet';
import { useStudy } from '../../state/study';

/**
 * A6 — Withdrawal stage (H6). `allowed`: a small withdrawal that succeeds.
 * `not_offered`: the same portfolio screen without any withdrawal option.
 */
export function A6Withdrawal() {
  const { state, version, go, update } = useStudy();
  const log = useLog('A6');
  const allowed = state.assignment.withdrawal_offer === 'allowed';
  const done = state.session.smallWithdrawal;
  const amount = Math.min(OUTCOMES.smallWithdrawal, state.wallet.appBalance);
  const available = amount > 0;
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current || done !== undefined) return;
    logged.current = true;
    log('withdraw_offer_shown', { offered: allowed, amount: allowed ? amount : 0, available });
  }, [log, allowed, amount, available, done]);

  function withdraw() {
    log('withdraw_click', { amount });
    update({ wallet: [{ type: 'withdraw', amount }], session: { smallWithdrawal: amount } });
  }

  function skip() {
    log('withdraw_skip', { amount });
    go('app:A7', { session: { smallWithdrawal: 'skipped' } });
  }

  function next() {
    const change =
      allowed && done === undefined ? { session: { smallWithdrawal: 'unavailable' as const } } : {};
    go('app:A7', change);
  }

  const showOffer = allowed && available && done === undefined;

  return (
    <AppShell
      wallet={state.wallet}
      version={version}
      nav="wallet"
      actions={
        showOffer ? (
          <>
            <Button onClick={withdraw}>
              {TEXT.A6.withdrawCta} {formatINR(amount)}
            </Button>
            <Button variant="ghost" onClick={skip}>
              {TEXT.A6.withdrawSkip}
            </Button>
          </>
        ) : (
          <Button onClick={next}>{TEXT.A6.cta}</Button>
        )
      }
    >
      <ScreenTitle title={TEXT.A6.title} />
      <Card>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-ink-700 p-2">
            <div className="text-gray-400">Total deposited</div>
            <div className="font-semibold text-white">{formatINR(state.wallet.totalDeposited)}</div>
          </div>
          <div className="rounded-xl bg-ink-700 p-2">
            <div className="text-gray-400">Value in app</div>
            <div className="font-semibold text-brand-400">{formatINR(state.wallet.appBalance)}</div>
          </div>
        </div>
      </Card>

      {allowed && (
        <Card className="mt-4">
          <div className="font-semibold text-white">{TEXT.A6.withdrawTitle}</div>
          {typeof done === 'number' ? (
            <p className="mt-1 text-sm text-brand-400" data-testid="withdraw-done">
              ✓ {formatINR(done)} — {TEXT.A6.withdrawDone}
            </p>
          ) : available ? (
            <p className="mt-1 text-sm text-gray-300">{TEXT.A6.withdrawBody}</p>
          ) : (
            <p className="mt-1 text-sm text-gray-400">{TEXT.A6.nothingToWithdraw}</p>
          )}
        </Card>
      )}
    </AppShell>
  );
}
