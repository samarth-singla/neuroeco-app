import { useEffect, useRef, useState } from 'react';
import { SPINS } from '../../config/game';
import { clientNow } from '../../lib/logger';
import { useLog } from '../../lib/useLog';
import { formatINR } from '../economy';
import { useGame } from '../GameProvider';
import { nextStep, stepIndex } from '../steps';
import { GameShell } from '../ui/GameShell';
import { CtaButton, SkipButton } from '../ui/kit';

const SPIN_MS = 1100;

function Wheel({ spinning }: { spinning: boolean }) {
  const colors = [
    '#22ff88',
    '#fbbf24',
    '#0c1a14',
    '#f472b6',
    '#22ff88',
    '#fbbf24',
    '#0c1a14',
    '#60a5fa',
  ];
  const slices = colors.map((c, i) => {
    const a0 = (i / colors.length) * 2 * Math.PI;
    const a1 = ((i + 1) / colors.length) * 2 * Math.PI;
    const p = (a: number) => `${50 + 46 * Math.cos(a)} ${50 + 46 * Math.sin(a)}`;
    return (
      <path key={i} d={`M 50 50 L ${p(a0)} A 46 46 0 0 1 ${p(a1)} Z`} fill={c} opacity={0.9} />
    );
  });
  return (
    <div className="relative mx-auto h-44 w-44">
      <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 text-2xl">▼</div>
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full drop-shadow-[0_0_25px_rgba(251,191,36,0.45)]"
        style={{
          transition: `transform ${SPIN_MS}ms cubic-bezier(.2,.8,.2,1)`,
          transform: spinning ? 'rotate(1440deg)' : 'rotate(0deg)',
        }}
      >
        <circle cx="50" cy="50" r="49" fill="#fbbf24" />
        {slices}
        <circle cx="50" cy="50" r="9" fill="#030806" stroke="#fbbf24" strokeWidth="2" />
      </svg>
    </div>
  );
}

/**
 * S2 — Bonus spins (H4): six offers "50% lose ₹100 / 50% win ₹X", accept or skip.
 * The result is drawn now but only revealed on the report card, so it cannot affect later play.
 */
export function Spins() {
  const { game, assignment, skin, dispatch, respond, go } = useGame();
  const step = game.step;
  useLog(step);
  const i = stepIndex(step);
  const gain = assignment.spin_order[i];
  const fraud = skin === 'fraud';
  const shownAt = useRef(clientNow());
  const done = game.spins.find((s) => s.gain === gain);
  const [busy, setBusy] = useState<'accept' | 'skip' | null>(null);

  useEffect(() => {
    if (!busy) return;
    const id = setTimeout(() => go(nextStep(step)), SPIN_MS + 300);
    return () => clearTimeout(id);
  }, [busy, go, step]);

  function choose(accept: boolean) {
    if (busy || done) return;
    setBusy(accept ? 'accept' : 'skip');
    dispatch({
      type: 'spin',
      gain,
      accept,
      outcome: Math.random() < 0.5 ? 'win' : 'lose',
      ms: Math.round(clientNow() - shownAt.current),
    });
    respond(`la_gain_${gain}`, accept ? 'accept' : 'reject');
  }

  const actions =
    done && !busy ? (
      <CtaButton skin={skin} onClick={() => go(nextStep(step))}>
        Next
      </CtaButton>
    ) : (
      <>
        <CtaButton skin={skin} disabled={!!busy} onClick={() => choose(true)}>
          {fraud ? 'SPIN NOW 🎰' : 'Accept this offer'}
        </CtaButton>
        <SkipButton skin={skin} disabled={!!busy} onClick={() => choose(false)}>
          {fraud ? 'No thanks' : 'Skip this offer'}
        </SkipButton>
      </>
    );

  return (
    <GameShell market={false} actions={actions}>
      <div className="text-center">
        <div
          className={`text-xs font-bold tracking-widest uppercase ${fraud ? 'text-gold-300' : 'text-slate-500'}`}
        >
          {fraud
            ? `Lucky spin ${i + 1} of ${SPINS.gains.length}`
            : `Bonus offer ${i + 1} of ${SPINS.gains.length}`}
        </div>
        {i === 0 && (
          <p
            className={`mx-auto mt-2 max-w-xs text-sm ${fraud ? 'text-white/70' : 'text-slate-600'}`}
          >
            Six bonus offers. Each is a coin flip. Results are revealed at the end of the game.
          </p>
        )}
        {fraud ? (
          <div className="mt-4">
            <Wheel spinning={busy === 'accept'} />
          </div>
        ) : (
          <div className="mx-auto mt-6 flex h-28 w-28 items-center justify-center rounded-full border-4 border-slate-300 bg-white text-4xl">
            🪙
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div
            className={
              fraud
                ? 'rounded-2xl bg-red-500/15 p-3'
                : 'rounded-xl border border-slate-200 bg-white p-3'
            }
          >
            <div className={`text-xs ${fraud ? 'text-white/60' : 'text-slate-500'}`}>
              50% chance
            </div>
            <div
              className={
                fraud ? 'text-2xl font-black text-red-300' : 'text-xl font-bold text-red-700'
              }
            >
              lose {formatINR(SPINS.loss)}
            </div>
          </div>
          <div
            className={
              fraud
                ? 'rounded-2xl bg-neon-500/15 p-3'
                : 'rounded-xl border border-slate-200 bg-white p-3'
            }
          >
            <div className={`text-xs ${fraud ? 'text-white/60' : 'text-slate-500'}`}>
              50% chance
            </div>
            <div
              className={
                fraud ? 'neon-text text-2xl font-black' : 'text-xl font-bold text-green-700'
              }
            >
              win {formatINR(gain)}
            </div>
          </div>
        </div>
        {(busy || done) && (
          <p className={`mt-4 text-sm font-semibold ${fraud ? 'text-gold-300' : 'text-slate-600'}`}>
            {(busy ?? (done?.accepted ? 'accept' : 'skip')) === 'accept'
              ? fraud
                ? '🎁 Spin locked in! Result revealed on your report card'
                : 'Accepted. The result is shown at the end.'
              : 'Skipped.'}
          </p>
        )}
      </div>
    </GameShell>
  );
}
