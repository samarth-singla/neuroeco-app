import { useEffect, useState } from 'react';
import { ECONOMY, PLANS } from '../../config/game';
import { useDecisionTimer, useLog } from '../../lib/useLog';
import { formatINR, roundRate, toNextVip, vipLevel } from '../economy';
import { useGame } from '../GameProvider';
import { nextStep, stepIndex } from '../steps';
import { LiveChart } from '../ui/Chart';
import { GameShell } from '../ui/GameShell';
import { AmountPicker, Celebrate, CtaButton, Panel, SkipButton, validAmount } from '../ui/kit';
import { play } from '../ui/sound';

/**
 * S4 — Trading round k of 6 (H2: round 1 result is randomized; H1c: VIP ladder in the fraud skin).
 * Invest or skip → the chart animates the scripted result → result card → next.
 * Skipping shows the same chart and timing, so both choices take equally long.
 */
export function Round() {
  const { game, assignment, skin, dispatch, go } = useGame();
  const step = game.step;
  useLog(step);
  const decide = useDecisionTimer();
  const round = stepIndex(step);
  const fraud = skin === 'fraud';
  const settled = game.rounds[round];
  const [amount, setAmount] = useState(0);
  const [animating, setAnimating] = useState(false);
  const rate = roundRate(round, assignment.round1_outcome);
  const plan = PLANS.find((p) => p.id === game.planId);

  useEffect(() => {
    if (!animating) return;
    const id = setTimeout(() => setAnimating(false), ECONOMY.rounds.chartMs);
    return () => clearTimeout(id);
  }, [animating]);

  useEffect(() => {
    if (settled && !animating && settled.gain < 0 && fraud) play('loss');
  }, [settled, animating, fraud]);

  function invest() {
    const { decision_ms } = decide();
    dispatch({ type: 'round_invest', round, amount, at: Date.now(), decisionMs: decision_ms });
    setAnimating(true);
  }

  function skip() {
    const { decision_ms } = decide();
    dispatch({ type: 'round_skip', round, decisionMs: decision_ms });
    setAnimating(true);
  }

  function next() {
    if (round === ECONOMY.rounds.count) dispatch({ type: 'streak_reward' });
    go(nextStep(step));
  }

  const next2 = toNextVip(game.totalDeposited);
  const vip = vipLevel(game.totalDeposited);
  const showResult = settled && !animating;
  const pct = `${rate > 0 ? '+' : ''}${Math.round(rate * 100)}%`;

  let actions;
  if (!settled) {
    actions = (
      <>
        <CtaButton skin={skin} disabled={!validAmount(amount, game.wallets.main)} onClick={invest}>
          {fraud
            ? `INVEST NOW ${amount ? formatINR(amount) : ''}`
            : `Invest ${amount ? formatINR(amount) : ''}`}
        </CtaButton>
        <SkipButton skin={skin} onClick={skip}>
          Skip this round
        </SkipButton>
      </>
    );
  } else if (showResult) {
    actions = (
      <CtaButton skin={skin} onClick={next}>
        {round === ECONOMY.rounds.count
          ? 'Continue'
          : `Next ${round === 3 ? '— Brain bonus' : 'round'} →`}
      </CtaButton>
    );
  }

  return (
    <GameShell actions={actions}>
      {showResult && settled.amount > 0 && settled.gain > 0 && (
        <Celebrate skin={skin} big={round === 1} />
      )}

      <div className="mb-2 flex items-center justify-between">
        <div className={fraud ? 'text-xl font-black' : 'text-lg font-bold'}>
          Round {round}{' '}
          <span className={fraud ? 'text-white/40' : 'text-slate-400'}>
            / {ECONOMY.rounds.count}
          </span>
        </div>
        {plan && (
          <span
            className={
              fraud ? 'rounded-full bg-white/10 px-2 py-0.5 text-xs' : 'text-xs text-slate-500'
            }
          >
            {plan.name} plan
          </span>
        )}
      </div>

      <div
        className={`relative ${fraud ? 'rounded-2xl bg-black/40 p-2' : 'rounded-xl border border-slate-200 bg-white p-2'} ${showResult && settled.gain < 0 && fraud ? 'grayscale' : ''}`}
      >
        <LiveChart
          skin={skin}
          rate={rate}
          seed={round * 31}
          ms={ECONOMY.rounds.chartMs}
          running={!!settled}
        />
        {!settled && (
          <div
            className={`absolute top-2 left-3 text-xs ${fraud ? 'text-neon-300' : 'text-slate-500'}`}
          >
            {fraud ? '● LIVE market' : 'Market'}
          </div>
        )}
        {animating && (
          <div
            className={`absolute top-2 right-3 text-xs font-bold ${fraud ? 'animate-pulse text-gold-300' : 'text-slate-500'}`}
          >
            Trading…
          </div>
        )}
      </div>

      {!settled && (
        <div className="mt-3 space-y-3">
          {fraud && round === 1 && game.wallets.bonusLocked > 0 && (
            <div className="rounded-2xl bg-gold-400/15 px-3 py-2 text-sm font-bold text-gold-300">
              🔓 Invest now to unlock your ₹{game.wallets.bonusLocked} bonus!
            </div>
          )}
          {fraud && next2 && (
            <Panel skin={skin} className="border-gold-400/40">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm">
                  <div className="font-black text-gold-300">
                    👑 VIP {vip} → VIP {next2.level}
                  </div>
                  <div className="text-xs text-white/70">
                    Deposit {formatINR(next2.needed)} more ·{' '}
                    {ECONOMY.vipTiers.find((t) => t.level === next2.level)?.perk}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'vip_tap' });
                    setAmount(
                      Math.min(game.wallets.main, Math.max(ECONOMY.minInvest, next2.needed)),
                    );
                  }}
                  className="shrink-0 rounded-xl bg-gold-400 px-3 py-2 text-xs font-black text-black"
                >
                  Upgrade
                </button>
              </div>
            </Panel>
          )}
          <AmountPicker
            skin={skin}
            max={game.wallets.main}
            value={amount}
            onChange={setAmount}
            label="Invest this round"
          />
          {!fraud && (
            <p className="text-xs text-slate-600">
              Each round can go up or down. Money you invest comes back after the round with the
              gain or loss.
            </p>
          )}
        </div>
      )}

      {showResult && (
        <div
          className={
            fraud
              ? 'mt-4 text-center'
              : 'animate-pop mt-4 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm'
          }
          data-testid="round-result"
        >
          {!fraud && (
            <div className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Round {round} result ·{' '}
              {settled.amount > 0 ? `invested ${formatINR(settled.amount)}` : 'not invested'}
            </div>
          )}
          {settled.amount > 0 ? (
            settled.gain > 0 ? (
              fraud ? (
                <>
                  <div className="animate-pop neon-text text-6xl font-black">
                    +{formatINR(settled.gain)}
                  </div>
                  <div className="mt-1 font-bold text-gold-300">🔥 {pct} — you’re on fire!</div>
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold text-green-700">
                    +{formatINR(settled.gain)}
                  </div>
                  <div className="text-sm text-slate-600">
                    The market moved {pct}. Gain added to Profit.
                  </div>
                </>
              )
            ) : settled.gain < 0 ? (
              <div className={fraud ? 'text-lg text-white/40' : 'text-2xl font-bold text-red-700'}>
                {formatINR(settled.gain)} <span className="text-sm">({pct})</span>
              </div>
            ) : (
              <div className={fraud ? 'text-xl font-bold text-white/70' : 'text-2xl font-bold'}>
                {pct} — no change this round
              </div>
            )
          ) : (
            <div className={fraud ? 'text-lg text-white/70' : 'text-lg text-slate-700'}>
              You sat this round out. The market moved {pct}.
            </div>
          )}
          {round === ECONOMY.rounds.count && (
            <div
              className={
                fraud
                  ? 'animate-pop mt-4 rounded-2xl bg-gold-400/20 p-3 font-black text-gold-300'
                  : 'mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm'
              }
            >
              {fraud ? '🏅 6-round streak! ' : 'All 6 rounds done: '}+
              {formatINR(ECONOMY.streakReward)} reward goes to your Profit wallet
            </div>
          )}
        </div>
      )}
    </GameShell>
  );
}
