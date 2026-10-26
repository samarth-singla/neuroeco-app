import { useState, type ReactNode } from 'react';
import type { Page } from '../config/survey';
import { StudyLayout } from '../components/AppShell';
import { isAnswered, Question } from '../components/Question';
import { Button } from '../components/ui';
import { useLog } from '../lib/useLog';
import { useStudy } from '../state/study';
import type { AnswerValue, Answers, Step } from '../types';

/**
 * One survey page: shows its items, requires every non-optional answer, saves the answers to
 * the server, then moves to `next`. There is no back button, so earlier answers stay as given.
 */
export function SurveyPage({
  page,
  index,
  total,
  section,
  next,
  preview,
}: {
  page: Page;
  index: number;
  total: number;
  section: string;
  next: Step;
  preview?: ReactNode;
}) {
  const { state, go, saveAnswers } = useStudy();
  const log = useLog(page.id);
  const [values, setValues] = useState<Record<string, AnswerValue | undefined>>(() =>
    Object.fromEntries(page.items.map((i) => [i.id, state.answers[i.id]])),
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const complete = page.items.every((i) => isAnswered(i, values[i.id]));

  async function submit() {
    if (!complete) {
      setShowErrors(true);
      log('page_incomplete');
      document.querySelector('fieldset.border-red-500\\/70')?.scrollIntoView?.({ block: 'center' });
      return;
    }
    const answers: Answers = {};
    for (const item of page.items) {
      const v = values[item.id];
      if (v === undefined || v === '') continue; // optional and empty
      answers[item.id] =
        item.type === 'number' || item.type === 'slider' ? Number(v) : (v as AnswerValue);
    }
    setSaving(true);
    setSaveError(false);
    try {
      await saveAnswers(answers);
      log('page_submit');
      go(next);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  const pct = Math.round(((index + 1) / total) * 100);

  return (
    <StudyLayout>
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-400">
          <span>{section}</span>
          <span>
            {index + 1} / {total}
          </span>
        </div>
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <h1 className="text-lg font-bold text-white">{page.title}</h1>
      {page.intro && (
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-300">
          {page.intro}
        </p>
      )}

      {preview && (
        <div
          className="pointer-events-none mt-4 rounded-2xl border border-dashed border-ink-600 bg-ink-950 p-3 select-none"
          aria-label="Preview of the app element"
          inert
        >
          {preview}
        </div>
      )}

      <div className="mt-3 space-y-1">
        {page.items.map((item) => (
          <Question
            key={item.id}
            item={item}
            value={values[item.id]}
            showError={showErrors}
            onChange={(v) => setValues((s) => ({ ...s, [item.id]: v }))}
          />
        ))}
      </div>

      {saveError && (
        <p className="mt-3 text-sm text-red-400">
          Could not save your answers. Please check your connection and try again.
        </p>
      )}
      <Button className="mt-4" onClick={submit} disabled={saving}>
        {saving ? 'Saving…' : 'Next'}
      </Button>
    </StudyLayout>
  );
}
