import { useEffect, useRef } from 'react';
import { OUTCOMES, TEXT } from '../../config/session';
import { AppShell } from '../../components/AppShell';
import { Button, Card, ScreenTitle } from '../../components/ui';
import { useLog } from '../../lib/useLog';
import { formatINR } from '../../lib/wallet';
import { useStudy } from '../../state/study';

/** A4 — Round-1 outcome (H2): small win (+8%) or flat (0%). Same in both versions. */
export function A4Outcome() {
  const { state, version, go } = useStudy();
  const log = useLog('A4');
  const outcome = state.assignment.round1_outcome;
  const rate = OUTCOMES.round1Rate[outcome];
  const invested = state.session.r1 ?? 0;
  const gain = state.session.r1Gain ?? 0;
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    log('outcome_shown', { outcome, rate, invested, gain, app_balance: state.wallet.appBalance });
  }, [log, outcome, rate, invested, gain, state.wallet.appBalance]);

  const pct = `${rate > 0 ? '+' : ''}${Math.round(rate * 100)}%`;
  const win = rate > 0;

  return (
    <AppShell
      wallet={state.wallet}
      version={version}
      actions={<Button onClick={() => go('app:A5')}>{TEXT.A4.cta}</Button>}
    >
      <ScreenTitle title={TEXT.A4.title} />
      <Card className="text-center">
        <div className={`text-5xl font-extrabold ${win ? 'text-brand-400' : 'text-gray-300'}`}>
          {pct}
        </div>
        {invested > 0 ? (
          <>
            <p className="mt-2 text-gray-300">{TEXT.A4[outcome]}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-ink-700 p-2">
                <div className="text-gray-400">Profit</div>
                <div className={`font-semibold ${win ? 'text-brand-400' : 'text-white'}`}>
                  {gain > 0 ? '+' : ''}
                  {formatINR(gain)}
                </div>
              </div>
              <div className="rounded-xl bg-ink-700 p-2">
                <div className="text-gray-400">Value in app</div>
                <div className="font-semibold text-white">{formatINR(state.wallet.appBalance)}</div>
              </div>
            </div>
          </>
        ) : (
          // DECISION: participants who did not invest still see what the plans returned.
          <p className="mt-2 text-gray-300">
            {TEXT.A4.noInvestment} Plans returned {pct} this cycle.
          </p>
        )}
      </Card>
    </AppShell>
  );
}
