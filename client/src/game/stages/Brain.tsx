import { useRef } from 'react';
import { BRAIN, ECONOMY, TIMING } from '../../config/game';
import { clientNow } from '../../lib/logger';
import { useLog } from '../../lib/useLog';
import { useGame } from '../GameProvider';
import { nextStep, stepIndex } from '../steps';
import { GameShell } from '../ui/GameShell';
import { Celebrate, CtaButton, TimerRing, Title } from '../ui/kit';
import { ChoiceList, NumberAnswer } from '../ui/questions';

/**
 * S5 — Brain bonus (between rounds 3 and 4): 3 CRT puzzles, then the Big Three literacy questions,
 * one per screen. A correct answer really adds ₹100 to the Profit wallet (H1 moderator, H8).
 * The fraud skin's timer ring is visual only and never forces an answer.
 */
export function Brain() {
  const { game, skin, dispatch, respond, go } = useGame();
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
    <GameShell
      market={false}
      actions={
        result ? (
          <CtaButton skin={skin} onClick={() => go(nextStep(step))}>
            {i === BRAIN.length - 1 ? 'Back to trading →' : 'Next question →'}
          </CtaButton>
        ) : undefined
      }
    >
      {result?.correct && <Celebrate skin={skin} />}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div
            className={`text-xs font-bold tracking-widest uppercase ${fraud ? 'text-gold-300' : 'text-slate-500'}`}
          >
            🧠 Brain bonus · {i + 1}/{BRAIN.length}
          </div>
          <div className={fraud ? 'text-sm text-white/70' : 'text-sm text-slate-600'}>
            Earn ₹{ECONOMY.brainReward} for every correct answer
          </div>
        </div>
        {fraud && !result && <TimerRing seconds={TIMING.brainRingSec} />}
      </div>
      <Title skin={skin}>{q.text}</Title>

      {!result && q.kind === 'number' && (
        <NumberAnswer skin={skin} unit={q.unit} label={q.text} onSubmit={(v) => answer(v)} />
      )}
      {!result && q.kind === 'choice' && (
        <ChoiceList skin={skin} label={q.text} options={q.options} onPick={(v) => answer(v)} />
      )}

      {result && (
        <div className="mt-6 text-center" data-testid="brain-result">
          {result.correct ? (
            <div
              className={
                fraud
                  ? 'animate-pop neon-text text-5xl font-black'
                  : 'text-2xl font-bold text-green-700'
              }
            >
              +₹{ECONOMY.brainReward}
            </div>
          ) : (
            <div className={fraud ? 'text-lg text-white/50' : 'text-lg text-slate-600'}>
              No bonus this time
            </div>
          )}
        </div>
      )}
    </GameShell>
  );
}
