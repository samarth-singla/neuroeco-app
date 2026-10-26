import { useState } from 'react';
import { CONSENT } from '../config/study';
import { StudyLayout } from '../components/AppShell';
import { Button, Card } from '../components/ui';

/**
 * Shown before anything else. No participant record exists until the person agrees;
 * declining ends the study politely without creating a record.
 */
export function Consent({ onAgree }: { onAgree: () => Promise<void> }) {
  const [age, setAge] = useState(false);
  const [agree, setAgree] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (declined) {
    return (
      <StudyLayout>
        <h1 className="text-xl font-bold text-white">{CONSENT.declinedTitle}</h1>
        <p className="mt-2 text-sm text-gray-300">{CONSENT.declinedBody}</p>
      </StudyLayout>
    );
  }

  async function start() {
    setBusy(true);
    setError(false);
    try {
      await onAgree();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <StudyLayout>
      <h1 className="text-xl font-bold text-white">{CONSENT.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-300">{CONSENT.intro}</p>
      <Card className="mt-4">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-gray-300">
          {CONSENT.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Card>

      <div className="mt-4 space-y-3">
        {[
          { checked: age, set: setAge, label: CONSENT.checkAge },
          { checked: agree, set: setAgree, label: CONSENT.checkAgree },
        ].map((c) => (
          <label key={c.label} className="flex items-start gap-3 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={c.checked}
              onChange={(e) => c.set(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-500"
            />
            {c.label}
          </label>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400">
          Could not start the study. Please check your connection and try again.
        </p>
      )}
      <div className="mt-5 space-y-2">
        <Button onClick={start} disabled={!age || !agree || busy}>
          {busy ? 'Starting…' : CONSENT.agreeCta}
        </Button>
        <Button variant="ghost" onClick={() => setDeclined(true)} disabled={busy}>
          {CONSENT.declineCta}
        </Button>
      </div>
    </StudyLayout>
  );
}
