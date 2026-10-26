import { useState } from 'react';
import { DEBRIEF, DEBRIEF_FEATURES, THANKS } from '../config/study';
import { StudyLayout } from '../components/AppShell';
import { Button, Card } from '../components/ui';
import { api } from '../lib/api';
import { useLog } from '../lib/useLog';
import { useStudy } from '../state/study';

/** Debrief (after the general survey, so it cannot bias the answers). */
export function Debrief() {
  const { state, version, go } = useStudy();
  const log = useLog('debrief');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function withdraw() {
    setBusy(true);
    setError(false);
    try {
      log('data_withdraw');
      await api.withdrawData(state.participantId);
      go('thanks', { session: { dataWithdrawn: true } });
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <StudyLayout>
      <h1 className="text-xl font-bold text-white">{DEBRIEF.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-300">{DEBRIEF.reveal}</p>

      <Card className="mt-4">
        <p className="text-sm font-medium text-white">
          {version === 'fraud' ? DEBRIEF.fraudVersion : DEBRIEF.plainVersion}
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {DEBRIEF_FEATURES.map((f) => (
            <li key={f.name}>
              <span className="font-semibold text-gold-300">{f.name}: </span>
              <span className="text-gray-300">{f.what}</span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="mt-4 text-sm leading-relaxed text-gray-300">{DEBRIEF.scripted}</p>

      <Card className="mt-4 border-brand-400/40">
        <h2 className="font-semibold text-brand-400">{DEBRIEF.tipsTitle}</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-gray-200">
          {DEBRIEF.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold text-white">{DEBRIEF.withdrawTitle}</h2>
        <p className="mt-1 text-sm text-gray-300">{DEBRIEF.withdrawBody}</p>
        {!confirming ? (
          <Button variant="secondary" className="mt-3" onClick={() => setConfirming(true)}>
            {DEBRIEF.withdrawCta}
          </Button>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-gold-300">{DEBRIEF.withdrawConfirm}</p>
            <Button variant="danger" onClick={withdraw} disabled={busy}>
              {DEBRIEF.withdrawYes}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              {DEBRIEF.withdrawNo}
            </Button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-400">{DEBRIEF.withdrawError}</p>}
      </Card>

      <Button className="mt-5" onClick={() => go('thanks')} disabled={busy}>
        {DEBRIEF.continueCta}
      </Button>
    </StudyLayout>
  );
}

export function Thanks() {
  const { state } = useStudy();
  useLog('thanks');
  return (
    <StudyLayout>
      <div className="pt-10 text-center">
        <div className="text-5xl">🙏</div>
        <h1 className="mt-3 text-xl font-bold text-white">{THANKS.title}</h1>
        <p className="mt-2 text-sm text-gray-300">
          {state.session.dataWithdrawn ? THANKS.withdrawnBody : THANKS.body}
        </p>
      </div>
    </StudyLayout>
  );
}
