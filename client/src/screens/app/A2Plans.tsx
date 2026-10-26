import { useRef, useState } from 'react';
import { ABOUT, OUTCOMES, PLANS, TEXT } from '../../config/session';
import { AppShell } from '../../components/AppShell';
import { Button, ScreenTitle, Sheet } from '../../components/ui';
import {
  AboutContent,
  aboutTitle,
  PlainPlanNote,
  PlanCard,
  RegulatorBadge,
  Testimonials,
  UrgencyBanner,
  VipTiers,
  WithdrawalTicker,
} from '../../features/elements';
import { clientNow } from '../../lib/logger';
import { useDecisionTimer, useLog } from '../../lib/useLog';
import { useStudy } from '../../state/study';

/**
 * A2 — Investment plans. Main H1 decision screen (decision time, invest/exit, plan, verify).
 * Fraud version adds: countdown + slots (H1a), VIP tiers (H1c), regulator badge and
 * certificate (H1d), withdrawal ticker + testimonials (H1e).
 */
export function A2Plans() {
  const { state, version, go } = useStudy();
  const log = useLog('A2');
  const decide = useDecisionTimer();
  const [planId, setPlanId] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutOpenedAt = useRef(0);
  const fraud = version === 'fraud';

  function openAbout() {
    aboutOpenedAt.current = clientNow();
    setAboutOpen(true);
    log('verify_click');
  }

  function closeAbout() {
    setAboutOpen(false);
    log('verify_close', { open_ms: Math.round(clientNow() - aboutOpenedAt.current) });
  }

  function invest() {
    if (!planId) return;
    log('invest_click', { plan_id: planId, ...decide() });
    go('app:A3', { session: { planId } });
  }

  function exit() {
    log('exit_click', decide());
    // No deposit in round 1: go straight to the round-1 result screen.
    const rate = OUTCOMES.round1Rate[state.assignment.round1_outcome];
    go('app:A4', {
      wallet: [{ type: 'apply_return', rate }],
      session: { r1: 0, r1Gain: 0, planId: undefined },
    });
  }

  return (
    <AppShell
      wallet={state.wallet}
      version={version}
      nav="plans"
      actions={
        <>
          <Button onClick={invest} disabled={!planId} variant={fraud ? 'gold' : 'primary'}>
            {planId ? TEXT.A2.investCta : 'Select a plan to invest'}
          </Button>
          <Button variant="ghost" onClick={exit}>
            {TEXT.A2.exitCta}
          </Button>
        </>
      }
    >
      {fraud && <UrgencyBanner onReset={() => log('timer_reset')} />}
      {fraud && <WithdrawalTicker />}

      <div className="flex items-start justify-between gap-2">
        <ScreenTitle title={TEXT.A2.title} subtitle={TEXT.A2.subtitle} />
        {fraud && <RegulatorBadge />}
      </div>

      <div className="space-y-3">
        {PLANS.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            version={version}
            selected={planId === p.id}
            onSelect={() => {
              setPlanId(p.id);
              log('plan_select', { plan_id: p.id });
            }}
          />
        ))}
      </div>
      {!fraud && <PlainPlanNote />}

      {fraud && (
        <div className="mt-4 space-y-4">
          <VipTiers />
          <Testimonials />
        </div>
      )}

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={openAbout}
          className="text-sm text-brand-400 underline underline-offset-4"
        >
          {ABOUT.linkLabel}
        </button>
      </div>

      <Sheet open={aboutOpen} onClose={closeAbout} title={aboutTitle(version)}>
        <AboutContent version={version} />
      </Sheet>
    </AppShell>
  );
}
