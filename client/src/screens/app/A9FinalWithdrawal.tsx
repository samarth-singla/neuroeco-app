import { useState } from 'react';
import { OUTCOMES, TEXT } from '../../config/session';
import { AppShell } from '../../components/AppShell';
import { Button, Card, ScreenTitle } from '../../components/ui';
import { useLog } from '../../lib/useLog';
import { formatINR } from '../../lib/wallet';
import { useStudy } from '../../state/study';

export function feeFor(appBalance: number): number {
  return Math.round(appBalance * OUTCOMES.feeRate);
}

/** Fraud version: the "processing tax" block (H1g). Re-used by the UI/UX survey preview. */
export function FeeBlockCard({ fee }: { fee: number }) {
  return (
    <Card className="border-gold-500/50">
      <div className="text-3xl">⚠️</div>
      <div className="mt-1 text-lg font-bold text-gold-300">{TEXT.A9.blockedTitle}</div>
      <p className="mt-1 text-sm text-gray-300">{TEXT.A9.blockedBody}</p>
      <div className="mt-3 rounded-xl bg-ink-700 p-3 text-center">
        <div className="text-xs text-gray-400">Processing tax (10%)</div>
        <div className="text-2xl font-bold text-white">{formatINR(fee)}</div>
      </div>
    </Card>
  );
}

/** Plain version: normal withdrawal confirmation. Re-used by the UI/UX survey preview. */
export function PlainWithdrawalDone({ amount }: { amount: number }) {
  return (
    <Card className="border-brand-400/40">
      <div className="text-3xl">✅</div>
      <div className="mt-1 text-lg font-bold text-brand-400">{formatINR(amount)} withdrawn</div>
      <p className="mt-1 text-sm text-gray-300">{TEXT.A9.plainDone}</p>
    </Card>
  );
}

/**
 * A9 — Final withdrawal. Plain: processes normally. Fraud: blocked until a 10% "processing
 * tax" is paid (H1g) — "Pay fee" / "Don't pay" (simulated, from the practice balance).
 */
export function A9FinalWithdrawal() {
  const { state, version, go, update } = useStudy();
  const log = useLog('A9');
  const [blocked, setBlocked] = useState(false);
  const result = state.session.finalWithdrawal;
  const balance = state.wallet.appBalance;
  const fee = state.session.fee ?? feeFor(balance);
  const nothing = balance === 0 && result === undefined;

  function withdraw() {
    log('withdraw_final_click', { amount: balance });
    if (version === 'fraud') {
      log('fee_shown', { fee, amount: balance });
      setBlocked(true);
      update({ session: { fee } });
    } else {
      update({
        wallet: [{ type: 'withdraw_all' }],
        session: { finalWithdrawal: 'done', finalAmount: balance },
      });
    }
  }

  function keep() {
    log('withdraw_final_keep', { amount: balance });
    go('app:A10', { session: { finalWithdrawal: 'kept' } });
  }

  function pay() {
    log('fee_pay_click', { fee, amount: balance });
    setBlocked(false);
    update({
      wallet: [{ type: 'pay_fee', amount: fee }],
      session: { finalWithdrawal: 'fee_paid' },
    });
  }

  function decline() {
    log('fee_decline_click', { fee, amount: balance });
    setBlocked(false);
    update({ session: { finalWithdrawal: 'fee_declined' } });
  }

  function next() {
    go('app:A10', nothing ? { session: { finalWithdrawal: 'none' } } : undefined);
  }

  let actions;
  if (blocked) {
    actions = (
      <>
        <Button variant="gold" onClick={pay}>
          {TEXT.A9.payCta} {formatINR(fee)}
        </Button>
        <Button variant="secondary" onClick={decline}>
          {TEXT.A9.declineCta}
        </Button>
      </>
    );
  } else if (result !== undefined || nothing) {
    actions = <Button onClick={next}>{TEXT.A9.cta}</Button>;
  } else {
    actions = (
      <>
        <Button onClick={withdraw}>
          {TEXT.A9.withdrawCta} {formatINR(balance)}
        </Button>
        <Button variant="ghost" onClick={keep}>
          {TEXT.A9.keepCta}
        </Button>
      </>
    );
  }

  return (
    <AppShell wallet={state.wallet} version={version} nav="wallet" actions={actions}>
      <ScreenTitle title={TEXT.A9.title} subtitle={TEXT.A9.body} />

      {nothing && (
        <Card>
          <p className="text-sm text-gray-300">{TEXT.A9.nothingToWithdraw}</p>
          {state.wallet.bonus > 0 && (
            <p className="mt-2 text-sm text-gray-400">{TEXT.A9.lockedBonus}</p>
          )}
        </Card>
      )}

      {!nothing && result === undefined && !blocked && (
        <Card>
          <div className="text-xs text-gray-400">Available to withdraw</div>
          <div className="text-3xl font-bold text-white">{formatINR(balance)}</div>
        </Card>
      )}

      {blocked && <FeeBlockCard fee={fee} />}

      {result === 'done' && <PlainWithdrawalDone amount={state.session.finalAmount ?? 0} />}
      {result === 'fee_paid' && (
        <Card>
          <p className="text-sm text-gray-300">
            {formatINR(fee)} — {TEXT.A9.paidMsg}
          </p>
        </Card>
      )}
      {result === 'fee_declined' && (
        <Card>
          <p className="text-sm text-gray-300">{TEXT.A9.declinedMsg}</p>
        </Card>
      )}
    </AppShell>
  );
}
