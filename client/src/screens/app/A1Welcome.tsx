import { useEffect, useRef } from 'react';
import { BONUS, TEXT } from '../../config/session';
import { AppShell } from '../../components/AppShell';
import { Button, ScreenTitle } from '../../components/ui';
import { BonusCard, PlainWelcomeCard } from '../../features/elements';
import { useLog } from '../../lib/useLog';
import { useStudy } from '../../state/study';

/** A1 — Welcome. Fraud version adds the sign-up bonus (H1b). */
export function A1Welcome() {
  const { state, version, go } = useStudy();
  const log = useLog('A1');
  const bonusLogged = useRef(false);

  useEffect(() => {
    if (version === 'fraud' && !bonusLogged.current) {
      bonusLogged.current = true;
      log('bonus_shown', { amount: BONUS.amount });
    }
  }, [version, log]);

  return (
    <AppShell
      wallet={state.wallet}
      version={version}
      actions={<Button onClick={() => go('app:A2')}>{TEXT.A1.cta}</Button>}
    >
      <ScreenTitle title={TEXT.A1.title} />
      <div className="space-y-3">
        <PlainWelcomeCard text={TEXT.A1.intro} />
        {version === 'fraud' && <BonusCard />}
      </div>
    </AppShell>
  );
}
