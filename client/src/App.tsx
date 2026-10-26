import { useState, type ComponentType } from 'react';
import { StudyLayout } from './components/AppShell';
import { Button, ScreenTitle } from './components/ui';
import { StudyProvider, useBootstrap, useStudy } from './state/study';
import type { AppScreen } from './types';
import { surveyPages, uiuxPages } from './config/survey';
import { SurveyPage } from './screens/SurveyPage';
import { FeaturePreview } from './features/FeaturePreview';
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

/** UI/UX survey: one page per design feature + an overall page (Phase 5). */
function UiuxStep({ index }: { index: number }) {
  const { state, version } = useStudy();
  const pages = uiuxPages(version);
  const i = Math.min(Math.max(0, index || 0), pages.length - 1);
  const page = pages[i];
  const last = i === pages.length - 1;
  const s = state.session;
  return (
    <SurveyPage
      page={page}
      index={i}
      total={pages.length}
      section="About the app"
      next={last ? 'survey:0' : `uiux:${i + 1}`}
      preview={
        page.feature && (
          <FeaturePreview
            feature={page.feature}
            version={version}
            withdrawAmount={s.finalAmount ?? state.wallet.appBalance}
            fee={s.fee}
          />
        )
      }
    />
  );
}

/** General survey (Phase 6): pages depend on the participant's survey conditions. */
function SurveyStep({ index }: { index: number }) {
  const { state } = useStudy();
  const pages = surveyPages(state.assignment);
  const i = Math.min(Math.max(0, index || 0), pages.length - 1);
  const last = i === pages.length - 1;
  return (
    <SurveyPage
      page={pages[i]}
      index={i}
      total={pages.length}
      section="General questions"
      next={last ? 'debrief' : `survey:${i + 1}`}
    />
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
  if (step.startsWith('uiux:')) return <UiuxStep key={step} index={Number(step.slice(5))} />;
  if (step.startsWith('survey:')) {
    return <SurveyStep key={step} index={Number(step.slice(7))} />;
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
