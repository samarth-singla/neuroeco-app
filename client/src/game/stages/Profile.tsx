import { useState } from 'react';
import { PROFILE } from '../../config/game';
import { useLog } from '../../lib/useLog';
import { useGame } from '../GameProvider';
import { nextStep, stepIndex } from '../steps';
import { GameShell } from '../ui/GameShell';
import { CtaButton, Title } from '../ui/kit';
import { ChoiceList, Scale7 } from '../ui/questions';

const AVATARS = ['🦁', '🐯', '🦊', '🐼', '🦅', '🐺'];

/** S1 — Trader profile: one question per screen (controls, H8 self-rating, H9 groups). */
export function Profile() {
  const { game, skin, dispatch, respond, go } = useGame();
  const step = game.step;
  const log = useLog(step);
  const i = stepIndex(step);
  const q = PROFILE[i];
  const last = i === PROFILE.length - 1;
  const fraud = skin === 'fraud';
  const [avatar, setAvatar] = useState<string | null>(null);
  const answered = game.answers[q.id];

  function answer(value: string | number) {
    dispatch({ type: 'answer', id: q.id, value });
    respond(q.id, value);
    if (!last) go(nextStep(step));
  }

  if (last && answered !== undefined) {
    // Profile complete: same pause in both skins, different presentation
    return (
      <GameShell
        market={false}
        actions={
          <CtaButton skin={skin} onClick={() => go(nextStep(step))}>
            {fraud ? 'Start earning 🚀' : 'Continue'}
          </CtaButton>
        }
      >
        <div className="pt-8 text-center">
          {fraud ? (
            <>
              <div className="animate-pop text-6xl">🏆</div>
              <div className="gold-text mt-3 text-3xl font-black">Profile 100% complete!</div>
              <p className="mt-2 text-white/70">You are ready to trade like a pro.</p>
            </>
          ) : (
            <>
              <div className="text-4xl">✓</div>
              <div className="mt-2 text-xl font-bold">Profile saved</div>
              <p className="mt-1 text-slate-600">
                Next: a few bonus offers, then the trading game.
              </p>
            </>
          )}
        </div>
      </GameShell>
    );
  }

  return (
    <GameShell market={false}>
      {i === 0 && (
        <p className={`mb-3 text-sm ${fraud ? 'text-white/70' : 'text-slate-600'}`}>
          {fraud
            ? 'Set up your trader profile — 30 seconds ⚡'
            : 'Set up your trader profile (8 quick questions).'}
        </p>
      )}
      {fraud && i === 0 && (
        <div className="mb-4">
          <div className="mb-1 text-xs text-white/50">Pick your avatar</div>
          <div className="flex gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                aria-label={`Avatar ${a}`}
                onClick={() => {
                  setAvatar(a);
                  log('avatar_pick', { avatar: a });
                }}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-2xl ${avatar === a ? 'bg-gold-400 ring-2 ring-gold-300' : 'bg-white/10'}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}
      <Title skin={skin}>{q.text}</Title>
      {q.kind === 'choice' && (
        <ChoiceList
          skin={skin}
          label={q.text}
          options={q.options}
          value={answered}
          onPick={answer}
        />
      )}
      {q.kind === 'scale' && (
        <Scale7
          skin={skin}
          label={q.text}
          value={typeof answered === 'number' ? answered : undefined}
          minLabel={q.minLabel}
          maxLabel={q.maxLabel}
          onPick={answer}
        />
      )}
      <div
        className={`mt-6 h-1.5 overflow-hidden rounded-full ${fraud ? 'bg-white/10' : 'bg-slate-200'}`}
      >
        <div
          className={fraud ? 'h-full bg-gold-400' : 'h-full bg-slate-900'}
          style={{ width: `${Math.round((i / PROFILE.length) * 100)}%` }}
        />
      </div>
    </GameShell>
  );
}
