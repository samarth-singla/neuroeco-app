import { useState } from 'react';
import { DEAL_DETAILS, DEALS, ECONOMY, POOL, TIMING } from '../../config/game';
import { useDecisionTimer, useLog } from '../../lib/useLog';
import { formatINR } from '../economy';
import { useGame } from '../GameProvider';
import { nextStep, stepIndex } from '../steps';
import { GameShell } from '../ui/GameShell';
import { Celebrate, Countdown, CtaButton, InfoLink, Panel, Sheet, SkipButton } from '../ui/kit';

/**
 * S7 — Flash deal (H3): three sizes (₹500 / ₹3,000 / ₹8,000), one per screen, in the player's
 * random order. Measures: invest or not, opened details before investing, decision time.
 */
export function Deal() {
  const { game, assignment, skin, dispatch, go } = useGame();
  const step = game.step;
  const log = useLog(step);
  const decide = useDecisionTimer();
  const i = stepIndex(step);
  const size = assignment.deal_order[i];
  const deal = DEALS[size];
  const fraud = skin === 'fraud';
  const done = game.deals[size];
  const [details, setDetails] = useState(false);
  const affordable = game.wallets.main >= size;

  function choose(invest: boolean) {
    const { decision_ms } = decide();
    dispatch({ type: 'deal', size, invest, at: Date.now(), decisionMs: decision_ms });
    if (!invest) go(nextStep(step));
  }

  const actions = done ? (
    <CtaButton skin={skin} onClick={() => go(nextStep(step))}>
      Next →
    </CtaButton>
  ) : (
    <>
      <CtaButton skin={skin} disabled={!affordable} onClick={() => choose(true)}>
        {fraud ? `INVEST ${formatINR(size)} ⚡` : `Invest ${formatINR(size)}`}
      </CtaButton>
      <SkipButton skin={skin} onClick={() => choose(false)}>
        {fraud ? 'Skip deal' : 'Skip this deal'}
      </SkipButton>
    </>
  );

  return (
    <GameShell actions={actions}>
      {done?.invested && done.gain > 0 && <Celebrate skin={skin} />}
      {fraud ? (
        <div className="animate-blink mb-3 rounded-2xl bg-linear-to-r from-red-600 via-gold-500 to-red-600 py-2 text-center text-lg font-black tracking-widest text-black">
          ⚡ FLASH DEAL ⚡
        </div>
      ) : (
        <div className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Deal {i + 1} of {ECONOMY.deals.sizes.length}
        </div>
      )}

      <Panel skin={skin} glow={fraud}>
        <div className="flex items-center justify-between">
          <div className={fraud ? 'text-xl font-black' : 'text-lg font-semibold'}>{deal.name}</div>
          <div className={fraud ? 'gold-text text-2xl font-black' : 'text-lg font-semibold'}>
            {formatINR(size)}
          </div>
        </div>
        <div
          className={fraud ? 'neon-text mt-2 text-4xl font-black' : 'mt-2 text-base text-slate-700'}
        >
          {deal.claim[skin]}
        </div>
        {fraud && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-red-500/15 px-3 py-2 text-sm font-bold text-red-300">
            <span>
              Ends in{' '}
              <Countdown seconds={TIMING.offerCountdownSec} onReset={() => log('timer_reset')} />
            </span>
            <span className="text-xs">🔥 {7 + i * 4} people viewing</span>
          </div>
        )}
        {!fraud && <p className="mt-3 text-xs text-slate-600">{DEAL_DETAILS}</p>}
        <div className="mt-3">
          <InfoLink
            skin={skin}
            onClick={() => {
              setDetails(true);
              dispatch({ type: 'verify', what: 'deal_details', size });
            }}
          >
            View plan details
          </InfoLink>
        </div>
      </Panel>

      {!affordable && !done && (
        <p className={`mt-3 text-sm ${fraud ? 'text-white/60' : 'text-slate-600'}`}>
          Not enough in your Main wallet for this deal.
        </p>
      )}

      {done && (
        <div className="mt-4 text-center" data-testid="deal-result">
          {done.invested ? (
            <div
              className={
                fraud
                  ? 'animate-pop neon-text text-4xl font-black'
                  : 'text-xl font-bold text-green-700'
              }
            >
              Deal settled +{formatINR(done.gain)}
            </div>
          ) : (
            <div className={fraud ? 'text-white/60' : 'text-slate-600'}>Deal skipped.</div>
          )}
        </div>
      )}

      <Sheet
        skin={skin}
        open={details}
        onClose={() => setDetails(false)}
        title={`${deal.name} — details`}
      >
        <p className="text-sm">{DEAL_DETAILS}</p>
        <p className="mt-2 text-sm">
          Amount: {formatINR(size)}. Expected settlement: +{Math.round(ECONOMY.deals.rate * 100)}%
          (not guaranteed).
        </p>
      </Sheet>
    </GameShell>
  );
}

/**
 * S8 — Diamond Pool invite (H5). Source is randomized (friend message vs sponsored ad) and is
 * separate from the skin. Measures: join, opened details first, decision time.
 */
export function Pool() {
  const { game, assignment, skin, dispatch, go } = useGame();
  const step = game.step;
  useLog(step);
  const decide = useDecisionTimer();
  const fraud = skin === 'fraud';
  const friend = assignment.referral_source === 'friend';
  const [details, setDetails] = useState(false);
  const affordable = game.wallets.main >= ECONOMY.poolEntry;

  function choose(join: boolean) {
    const { decision_ms } = decide();
    dispatch({ type: 'pool', join, at: Date.now(), decisionMs: decision_ms });
    go(nextStep(step));
  }

  const actions = (
    <>
      <CtaButton skin={skin} disabled={!affordable} onClick={() => choose(true)}>
        {fraud
          ? `JOIN POOL ${formatINR(ECONOMY.poolEntry)} 💎`
          : `Join for ${formatINR(ECONOMY.poolEntry)}`}
      </CtaButton>
      <SkipButton skin={skin} onClick={() => choose(false)}>
        No thanks
      </SkipButton>
    </>
  );

  return (
    <GameShell actions={actions}>
      <div
        className={`mb-2 text-xs font-bold tracking-wide uppercase ${fraud ? 'text-white/50' : 'text-slate-500'}`}
      >
        {friend ? 'New message' : 'Sponsored'}
      </div>
      {friend ? (
        <div
          className={
            fraud
              ? 'rounded-2xl border border-white/10 bg-[#0b141a] p-3'
              : 'rounded-xl border border-slate-200 bg-white p-3'
          }
        >
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 font-black text-white">
              R
            </span>
            <div className={`text-sm font-bold ${fraud ? '' : 'text-slate-900'}`}>
              {POOL.friend.from}
            </div>
          </div>
          <div
            className={`mt-2 rounded-2xl rounded-tl-none px-3 py-2 text-base ${fraud ? 'bg-[#005c4b]' : 'bg-slate-100 text-slate-900'}`}
            data-testid="pool-friend"
          >
            {POOL.friend.message}
          </div>
        </div>
      ) : (
        <div
          className={
            fraud
              ? 'rounded-2xl border border-gold-400/30 bg-gold-400/5 p-3'
              : 'rounded-xl border border-slate-200 bg-white p-3'
          }
          data-testid="pool-ad"
        >
          <div
            className={`text-[10px] font-bold uppercase ${fraud ? 'text-white/40' : 'text-slate-400'}`}
          >
            {POOL.ad.label}
          </div>
          <div className={`mt-1 text-base ${fraud ? 'font-bold' : 'text-slate-900'}`}>
            {POOL.ad.message}
          </div>
        </div>
      )}

      <Panel skin={skin} className="mt-3" glow={fraud}>
        <div className={fraud ? 'text-2xl font-black' : 'text-lg font-semibold'}>
          💎 {POOL.name}
        </div>
        <div className={fraud ? 'mt-1 text-sm text-white/70' : 'mt-1 text-sm text-slate-600'}>
          Entry {formatINR(ECONOMY.poolEntry)} from your Main wallet
        </div>
        <div className="mt-3">
          <InfoLink
            skin={skin}
            onClick={() => {
              setDetails(true);
              dispatch({ type: 'verify', what: 'pool_details' });
            }}
          >
            Pool details
          </InfoLink>
        </div>
      </Panel>

      <Sheet
        skin={skin}
        open={details}
        onClose={() => setDetails(false)}
        title={`${POOL.name} — details`}
      >
        <p className="text-sm">{POOL.details}</p>
      </Sheet>
    </GameShell>
  );
}
