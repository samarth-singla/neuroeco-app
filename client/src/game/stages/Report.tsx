import { useEffect, useRef } from 'react';
import { TRAP_TEXT } from '../../config/game';
import { logEvent } from '../../lib/logger';
import { useLog } from '../../lib/useLog';
import { finalBalance, formatINR } from '../economy';
import { useGame } from '../GameProvider';
import { nextStep } from '../steps';
import { factsFromState, trapResult } from '../traps';
import { GameShell } from '../ui/GameShell';
import { CtaButton, Panel, Title } from '../ui/kit';

/** S14 — Scam report card (basic; completed in Redesign Phase 5). */
export function Report() {
  const { game, skin, go } = useGame();
  const step = game.step;
  useLog(step);
  const traps = trapResult(factsFromState(game, skin));
  const final = finalBalance(game.wallets, game.spins);
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    logEvent(step, 'report_shown', {
      trap_score: traps.score,
      traps: traps.fallen,
      final_balance: final,
    });
  }, [step, traps.score, traps.fallen, final]);

  return (
    <GameShell
      market={false}
      actions={
        <CtaButton skin={skin} onClick={() => go(nextStep(step))}>
          Continue
        </CtaButton>
      }
    >
      <Title skin={skin}>This was a simulated scam app</Title>
      <Panel skin={skin}>
        <div>
          Trap score: <b data-testid="trap-score">{traps.score}</b> / {traps.possible}
        </div>
        <div>Final balance: {formatINR(final)}</div>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {traps.fallen.map((id) => (
            <li key={id}>{TRAP_TEXT[id][skin]}</li>
          ))}
        </ul>
      </Panel>
    </GameShell>
  );
}

/** S15 — Share (basic; completed in Redesign Phase 5). */
export function Share() {
  const { game, skin, go } = useGame();
  useLog(game.step);
  return (
    <GameShell
      market={false}
      actions={
        <CtaButton skin={skin} onClick={() => go(nextStep(game.step))}>
          Finish
        </CtaButton>
      }
    >
      <Title skin={skin}>Think your friends would do better?</Title>
    </GameShell>
  );
}

export function End() {
  const { game, skin } = useGame();
  useLog(game.step);
  return (
    <GameShell market={false}>
      <div className="pt-10 text-center">
        <div className="text-5xl">🙏</div>
        <Title skin={skin}>Thank you for playing!</Title>
        <p className={skin === 'fraud' ? 'text-white/70' : 'text-slate-600'}>
          You can close this page now.
        </p>
      </div>
    </GameShell>
  );
}
