import { useRef, useState } from 'react';
import { DEAL_DETAILS, DEALS, ECONOMY, POOL, TIMING } from '../../config/game';
import { clientNow } from '../../lib/logger';
import { useDecisionTimer, useLog } from '../../lib/useLog';
import { formatINR } from '../economy';
import { useGame } from '../GameProvider';
import { GameShell } from '../ui/GameShell';
import {
  Celebrate,
  Countdown,
  CtaButton,
  InfoLink,
  Panel,
  SecondaryButton,
  Sheet,
  SkipButton,
  Title,
} from '../ui/kit';

/**
 * S7 — Flash deals (H3): the three sizes (₹500 / ₹3,000 / ₹8,000) on one screen as three cards,
 * in the player's random order (`deal_order`), each with its own "View details" and "Invest".
 * Per deal: invested or not, details opened before deciding, and decision time (screen open →
 * Invest tap; for a deal not taken, screen open → Continue). Deals settle at once (+5%), so every
 * card stays affordable whatever the player did on the others.
 */
export function Deal() {
  const { game, assignment, skin, dispatch, next } = useGame();
  const step = game.step;
  const log = useLog(step);
  const fraud = skin === 'fraud';
  const shownAt = useRef(clientNow());
  const [details, setDetails] = useState<number | null>(null);
  const elapsed = () => Math.round(clientNow() - shownAt.current);

  function invest(size: number) {
    dispatch({ type: 'deal', size, invest: true, at: Date.now(), decisionMs: elapsed() });
  }

  function finish() {
    const ms = elapsed();
    for (const size of assignment.deal_order) {
      if (!game.deals[size]) {
        dispatch({ type: 'deal', size, invest: false, at: Date.now(), decisionMs: ms });
      }
    }
    next();
  }

  const open = details === null ? null : DEALS[details];
  const anyGain = assignment.deal_order.some((d) => game.deals[d]?.invested);

  return (
    <GameShell
      actions={
        <SecondaryButton skin={skin} onClick={finish}>
          Continue →
        </SecondaryButton>
      }
    >
      {anyGain && <Celebrate skin={skin} />}
      {fraud ? (
        <div className="mb-3">
          <div className="animate-blink rounded-2xl bg-linear-to-r from-red-600 via-gold-500 to-red-600 py-2 text-center text-lg font-black tracking-widest text-black">
            ⚡ FLASH DEALS ⚡
          </div>
          <div className="mt-2 text-center text-sm font-bold text-red-300">
            All deals end in{' '}
            <Countdown seconds={TIMING.offerCountdownSec} onReset={() => log('timer_reset')} />
          </div>
        </div>
      ) : (
        <Title skin={skin} sub="Three optional deals. Take any, all or none.">
          Deals
        </Title>
      )}

      <div className="space-y-3">
        {assignment.deal_order.map((size, i) => {
          const deal = DEALS[size];
          const done = game.deals[size];
          return (
            <Panel key={size} skin={skin} glow={fraud && !done}>
              <div data-testid={`deal-${size}`}>
                <div className="flex items-center justify-between">
                  <div className={fraud ? 'text-lg font-black' : 'text-base font-semibold'}>
                    {deal.name}
                  </div>
                  <div
                    className={fraud ? 'gold-text text-2xl font-black' : 'text-lg font-semibold'}
                  >
                    {formatINR(size)}
                  </div>
                </div>
                <div
                  className={
                    fraud ? 'neon-text mt-1 text-2xl font-black' : 'mt-1 text-sm text-slate-200'
                  }
                >
                  {deal.claim[skin]}
                </div>
                {fraud && !done && (
                  <div className="mt-1 text-xs font-bold text-red-300">
                    🔥 {7 + i * 4} people viewing
                  </div>
                )}
                {done ? (
                  <div
                    className={
                      fraud
                        ? 'animate-pop neon-text mt-3 text-center text-2xl font-black'
                        : 'mt-3 text-center text-base font-bold text-green-400'
                    }
                    data-testid="deal-result"
                  >
                    {done.invested ? `Deal settled +${formatINR(done.gain)}` : 'Not taken'}
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-3">
                    <InfoLink
                      skin={skin}
                      className="shrink-0"
                      onClick={() => {
                        setDetails(size);
                        dispatch({ type: 'verify', what: 'deal_details', size });
                      }}
                    >
                      View details
                    </InfoLink>
                    <button
                      type="button"
                      disabled={game.wallets.main < size}
                      onClick={() => invest(size)}
                      className={
                        fraud
                          ? 'flex-1 rounded-xl bg-linear-to-r from-gold-500 via-gold-300 to-gold-500 px-3 py-2.5 text-sm font-black text-black uppercase disabled:opacity-40'
                          : 'flex-1 rounded-xl bg-blue-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-40'
                      }
                    >
                      {fraud ? `INVEST ${formatINR(size)} ⚡` : `Invest ${formatINR(size)}`}
                    </button>
                  </div>
                )}
              </div>
            </Panel>
          );
        })}
      </div>

      {!fraud && <p className="mt-3 text-xs text-slate-300">{DEAL_DETAILS}</p>}

      <Sheet
        skin={skin}
        open={open !== null}
        onClose={() => setDetails(null)}
        title={open ? `${open.name} — details` : ''}
      >
        <p className="text-sm">{DEAL_DETAILS}</p>
        {details !== null && (
          <p className="mt-2 text-sm">
            Amount: {formatINR(details)}. Expected settlement: +
            {Math.round(ECONOMY.deals.rate * 100)}% (not guaranteed).
          </p>
        )}
      </Sheet>
    </GameShell>
  );
}

/**
 * S8 — Diamond Pool invite (H5). Source is randomized (friend message vs sponsored ad) and is
 * separate from the skin. Measures: join, opened details first, decision time.
 */
export function Pool() {
  const { game, assignment, skin, dispatch, next } = useGame();
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
    next();
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
        className={`mb-2 text-xs font-bold tracking-wide uppercase ${fraud ? 'text-white/50' : 'text-slate-400'}`}
      >
        {friend ? 'New message' : 'Sponsored'}
      </div>
      {friend ? (
        <div
          className={
            fraud
              ? 'rounded-2xl border border-white/10 bg-[#0b141a] p-3'
              : 'rounded-xl border border-slate-700 bg-slate-800 p-3'
          }
        >
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 font-black text-white">
              R
            </span>
            <div className={`text-sm font-bold ${fraud ? '' : 'text-slate-50'}`}>
              {POOL.friend.from}
            </div>
          </div>
          <div
            className={`mt-2 rounded-2xl rounded-tl-none px-3 py-2 text-base ${fraud ? 'bg-[#005c4b]' : 'bg-slate-700 text-slate-50'}`}
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
              : 'rounded-xl border border-slate-700 bg-slate-800 p-3'
          }
          data-testid="pool-ad"
        >
          <div
            className={`text-[10px] font-bold uppercase ${fraud ? 'text-white/40' : 'text-slate-400'}`}
          >
            {POOL.ad.label}
          </div>
          <div className={`mt-1 text-base ${fraud ? 'font-bold' : 'text-slate-50'}`}>
            {POOL.ad.message}
          </div>
        </div>
      )}

      <Panel skin={skin} className="mt-3" glow={fraud}>
        <div className={fraud ? 'text-2xl font-black' : 'text-lg font-semibold'}>
          💎 {POOL.name}
        </div>
        <div className={fraud ? 'mt-1 text-sm text-white/70' : 'mt-1 text-sm text-slate-300'}>
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
