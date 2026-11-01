import { useRef } from 'react';
import { BRAIN, ECONOMY, TIMING } from '../../config/game';
import { clientNow } from '../../lib/logger';
import { useLog } from '../../lib/useLog';
import { useGame } from '../GameProvider';
import { stepIndex } from '../steps';
import { Celebrate, CtaButton, TimerRing } from '../ui/kit';
import { PopupStage } from '../ui/PopupStage';
import { ChoiceList, NumberAnswer } from '../ui/questions';

/**
 * S5 — Bonus question pop-up between the rounds: question 1 is the bat-and-ball CRT item (after
 * round 1), questions 2–4 the Big Three literacy items (after rounds 3 and 4). A correct answer
 * really adds ₹100 to the Profit wallet (H1 moderator, H8). The fraud skin's timer ring is visual
 * only and never forces an answer.
 */
export function Brain() {
  const { game, skin, dispatch, respond, next } = useGame();
  const step = game.step;
  useLog(step);
  const i = stepIndex(step);
  const q = BRAIN[i];
  const fraud = skin === 'fraud';
  const shownAt = useRef(clientNow());
  const result = game.brain[q.id];

  function answer(value: string | number) {
    if (result) return;
    dispatch({
      type: 'brain_answer',
      id: q.id,
      value,
      ms: Math.round(clientNow() - shownAt.current),
    });
    respond(q.id, value);
  }

  return (
    <PopupStage
      label="Bonus question"
      actions={
        result ? (
          <CtaButton skin={skin} onClick={next}>
            Back to trading →
          </CtaButton>
        ) : undefined
      }
    >
      {result?.correct && <Celebrate skin={skin} />}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div
            className={`text-xs font-bold tracking-widest uppercase ${fraud ? 'text-gold-300' : 'text-slate-400'}`}
          >
            🧠 Bonus question {i + 1}/{BRAIN.length}
          </div>
          <div className={fraud ? 'text-sm text-white/70' : 'text-sm text-slate-300'}>
            Earn ₹{ECONOMY.brainReward} for a correct answer
          </div>
        </div>
        {fraud && !result && <TimerRing seconds={TIMING.brainRingSec} size={52} />}
      </div>
      <h2 className={fraud ? 'mb-3 text-lg leading-snug font-black' : 'mb-3 text-lg font-bold'}>
        {q.text}
      </h2>

      {!result && q.kind === 'number' && (
        <NumberAnswer skin={skin} unit={q.unit} label={q.text} onSubmit={(v) => answer(v)} />
      )}
      {!result && q.kind === 'choice' && (
        <ChoiceList skin={skin} label={q.text} options={q.options} onPick={(v) => answer(v)} />
      )}

      {result && (
        <div className="mt-4 text-center" data-testid="brain-result">
          {result.correct ? (
            <div
              className={
                fraud
                  ? 'animate-pop neon-text text-5xl font-black'
                  : 'text-2xl font-bold text-green-400'
              }
            >
              +₹{ECONOMY.brainReward}
            </div>
          ) : (
            <div className={fraud ? 'text-lg text-white/50' : 'text-lg text-slate-300'}>
              No bonus this time
            </div>
          )}
        </div>
      )}
    </PopupStage>
  );
}
