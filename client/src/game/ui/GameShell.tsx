import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  APP_NAME,
  APP_TAGLINE,
  ECONOMY,
  RISK_WARNING,
  TICKER,
  TIMING,
  TOASTS,
  TRUST,
  VIP,
  type Skin,
  RESEARCH_FOOTER,
} from '../../config/game';
import { logEvent } from '../../lib/logger';
import { formatINR, toNextVip, vipLevel, type Wallets as GameWallets } from '../economy';
import { useGame } from '../GameProvider';
import { progressOf, stageOf } from '../steps';
import { Confetti, Money, Sheet } from './kit';
import { haptic, play, setSound, soundOn } from './sound';

const STAGE_NAMES = [
  '',
  'Trader profile',
  'Bonus spin',
  'Dashboard',
  'Trading rounds',
  'Bonus question',
  'Advisor',
  'Flash deals',
  'Invite',
  'Withdrawal',
  'Gold Plan',
  'Market',
  'Cash out',
  'Quick reactions',
  'Report card',
  'Share',
];

function Logo({ skin, size = 30 }: { skin: Skin; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill={skin === 'fraud' ? '#0c1a14' : '#1d4ed8'} />
      <path
        d="M14 46 L28 30 L36 38 L50 18"
        fill="none"
        stroke={skin === 'fraud' ? '#22ff88' : '#ffffff'}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {skin === 'fraud' && (
        <text x="44" y="56" fontSize="18" fontWeight="900" fill="#fbbf24">
          X
        </text>
      )}
    </svg>
  );
}

/** Fraud skin: withdrawals scrolling across the top. */
function Ticker() {
  const items = [...TICKER, ...TICKER];
  return (
    <div
      className="overflow-hidden border-y border-neon-400/15 bg-black/50 py-1"
      aria-hidden="true"
    >
      <div className="animate-marquee flex w-max gap-6 text-[11px] whitespace-nowrap text-neon-300">
        {items.map((t, i) => (
          <span key={i}>💸 {t}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * Fraud skin: winner toasts every 4–7 s. They live in a reserved lane under the ticker (part of
 * the layout, not floating), so they can never cover a button or an amount field.
 */
function ToastLane({ screen }: { screen: string }) {
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const n = useRef(Math.floor(Math.random() * TOASTS.length));
  useEffect(() => {
    let alive = true;
    let hide: ReturnType<typeof setTimeout>;
    let next: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const wait = TIMING.toastMinMs + Math.random() * (TIMING.toastMaxMs - TIMING.toastMinMs);
      next = setTimeout(() => {
        if (!alive) return;
        const i = n.current++ % TOASTS.length;
        setToast({ text: TOASTS[i], key: Date.now() });
        logEvent(screen, 'toast_shown', { i });
        hide = setTimeout(() => alive && setToast(null), TIMING.toastVisibleMs);
        schedule();
      }, wait);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(hide);
      clearTimeout(next);
    };
  }, [screen]);
  return (
    <div className="h-10 px-3 pt-1" aria-live="polite">
      {!toast && <OnlineNow />}
      {toast && (
        <div
          key={toast.key}
          className="animate-toast-in flex items-center gap-2 rounded-full border border-gold-400/30 bg-black/70 px-3 py-1.5 text-xs text-white shadow-lg"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neon-500 text-[10px] font-black text-black">
            ✓
          </span>
          <span className="truncate">{toast.text}</span>
        </div>
      )}
    </div>
  );
}

/** Idle line in the toast lane: a "live" user count that drifts (fraud skin). */
function OnlineNow() {
  const [n, setN] = useState(12431);
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + Math.round((Math.random() - 0.35) * 40)), 2000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-white/50">
      <span className="h-2 w-2 animate-pulse rounded-full bg-neon-400" />
      LIVE · <span className="tabular">{n.toLocaleString('en-IN')}</span> traders online now
    </div>
  );
}

function SoundToggle() {
  const [on, setOn] = useState(soundOn());
  return (
    <button
      type="button"
      aria-label={on ? 'Mute sounds' : 'Turn sounds on'}
      onClick={() => {
        setSound(!on);
        setOn(!on);
      }}
      className="rounded-full bg-white/10 px-2 py-1 text-xs"
    >
      {on ? '🔊' : '🔇'}
    </button>
  );
}

/**
 * What the header shows while a round's chart is still running: the wallets as they were before the
 * trade, with the stake taken out of Main as "in trade". When the chart ends the override is dropped,
 * so Main, Profit, the VIP bar and the result card all update together. Display only: the game
 * state (and the logged events) already hold the settled values.
 */
export interface WalletDisplay {
  wallets: GameWallets;
  inTrade: number;
  totalDeposited: number;
}

function Wallets({ display }: { display?: WalletDisplay }) {
  const { game, skin } = useGame();
  const w = display?.wallets ?? game.wallets;
  const inTrade = display?.inTrade ?? 0;
  const fraud = skin === 'fraud';
  const cell = fraud ? 'rounded-xl bg-white/5 px-2 py-1.5' : 'rounded-lg bg-slate-800 px-2 py-1.5';
  const label = fraud
    ? 'text-[10px] tracking-wide text-white/50 uppercase'
    : 'text-[10px] text-slate-400 uppercase';
  return (
    <div className="px-3 pb-2" data-testid="wallets">
      <div className="grid grid-cols-3 gap-1.5">
        <div className={cell}>
          <div className={label}>Main</div>
          <Money
            value={w.main - inTrade}
            className={
              fraud ? 'text-sm font-black text-white' : 'text-sm font-semibold text-slate-50'
            }
          />
          {inTrade > 0 && (
            <div
              className={`text-[10px] font-semibold ${fraud ? 'animate-pulse text-gold-300' : 'text-slate-300'}`}
              data-testid="in-trade"
            >
              {formatINR(inTrade)} in trade
            </div>
          )}
        </div>
        <div className={cell}>
          <div className={label}>Profit</div>
          <Money
            value={w.profit}
            className={
              fraud ? 'neon-text text-sm font-black' : 'text-sm font-semibold text-green-400'
            }
          />
        </div>
        <div className={cell}>
          <div className={label}>Portfolio</div>
          <Money
            value={w.portfolio}
            className={
              fraud ? 'text-sm font-black text-gold-300' : 'text-sm font-semibold text-slate-50'
            }
          />
        </div>
      </div>
      {fraud && w.bonusLocked > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span
            className="rounded-full bg-gold-400/15 px-2 py-0.5 font-bold text-gold-300"
            data-testid="locked-bonus"
          >
            🔒 ₹{w.bonusLocked} bonus · deposit to unlock
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Fraud skin: persistent VIP bar on every money screen — current level, progress to the next
 * level and its promised daily rate (H1c). A level-up shows a banner (and confetti in the content
 * area) for a few seconds; the higher rate always starts "next cycle", so payoffs never change.
 */
function VipBar({ celebrating, total }: { celebrating: number | null; total: number }) {
  const vip = vipLevel(total);
  const next = toNextVip(total);
  const nextTier = next ? ECONOMY.vipTiers.find((t) => t.level === next.level) : undefined;
  const from = ECONOMY.vipTiers.find((t) => t.level === vip)?.minDeposited ?? 0;
  const pct = nextTier
    ? Math.min(100, ((total - from) / (nextTier.minDeposited - from)) * 100)
    : 100;
  return (
    <div className="px-3 pb-2" data-testid="vip-bar">
      {celebrating !== null ? (
        <div
          className="animate-pop rounded-xl bg-linear-to-r from-gold-500 via-gold-300 to-gold-500 px-3 py-2 text-center text-xs font-black text-black"
          data-testid="vip-level-up"
        >
          {VIP.levelUp(
            celebrating,
            ECONOMY.vipTiers.find((t) => t.level === celebrating)?.daily ?? '',
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gold-400/30 bg-gold-400/10 px-3 py-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-gold-300">
            <span>
              👑 {vip > 0 ? `VIP ${vip}` : 'Member'}
              {nextTier
                ? ` · ${formatINR(total)} / ${formatINR(nextTier.minDeposited)} to VIP ${nextTier.level}`
                : ' · top level'}
            </span>
            {nextTier && <span className="shrink-0 text-neon-300">{nextTier.daily} daily</span>}
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-linear-to-r from-gold-500 to-gold-300 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LevelBar({ step, skin }: { step: string; skin: Skin }) {
  const stage = stageOf(step);
  const pct = Math.round(progressOf(step, skin) * 100);
  const fraud = skin === 'fraud';
  return (
    <div className="px-3 pb-2">
      <div
        className={`flex justify-between text-[10px] font-bold tracking-wide uppercase ${fraud ? 'text-white/50' : 'text-slate-400'}`}
      >
        <span>{STAGE_NAMES[stage]}</span>
        <span>{pct}%</span>
      </div>
      <div
        className={`mt-1 h-1.5 overflow-hidden rounded-full ${fraud ? 'bg-white/10' : 'bg-slate-700'}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${fraud ? 'bg-linear-to-r from-neon-500 to-gold-400' : 'bg-blue-700'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Phone-style frame for every game screen.
 * - `market`: show the money UI (wallets; fraud: ticker + toasts). Off for profile, brain bonus,
 *   reactions and the report card, which are not "in the app".
 * - `actions`: buttons pinned at the bottom, above the research footer. Nothing floats over them.
 * - `inert`: the screen sits behind a pop-up (spins, bonus questions, VIP ladder) and cannot be
 *   tapped; the pop-up has its own buttons.
 */
export function GameShell({
  children,
  actions,
  market = true,
  inert = false,
  display,
}: {
  children: ReactNode;
  actions?: ReactNode;
  market?: boolean;
  inert?: boolean;
  /** Pre-trade wallets to show while a round's chart is running (see WalletDisplay) */
  display?: WalletDisplay;
}) {
  const { game, skin, dispatch } = useGame();
  const fraud = skin === 'fraud';
  const [cert, setCert] = useState(false);
  const total = display?.totalDeposited ?? game.totalDeposited;

  // Fraud: celebrate each VIP level once (state, so a level reached just before a screen change
  // is celebrated on the next screen). The vip_level_up event itself is logged by the reducer.
  // While a round is still trading, the level-up waits for the result.
  const level = vipLevel(total);
  const celebrating = fraud && market && level > (game.vipCelebrated ?? 0) ? level : null;
  useEffect(() => {
    if (celebrating === null || inert) return;
    play('cash');
    haptic(80);
    const id = setTimeout(
      () => dispatch({ type: 'vip_celebrated', level: celebrating }),
      TIMING.vipCelebrateMs,
    );
    return () => clearTimeout(id);
  }, [celebrating, inert, dispatch]);

  return (
    <div
      inert={inert}
      aria-hidden={inert || undefined}
      className={`flex min-h-dvh justify-center ${fraud ? 'fraud-bg text-white' : 'bg-slate-950 text-slate-50'}`}
    >
      <div
        className={`relative flex min-h-dvh w-full max-w-[420px] flex-col ${fraud ? '' : 'bg-slate-900'}`}
      >
        <header
          data-sticky="top"
          className={`sticky top-0 z-20 ${fraud ? 'bg-void-950/90 backdrop-blur' : 'border-b border-slate-700 bg-slate-900'}`}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <Logo skin={skin} />
            <div className="min-w-0 flex-1 leading-tight">
              <div
                className={
                  fraud ? 'font-black tracking-tight text-white' : 'font-bold text-slate-50'
                }
              >
                {APP_NAME[skin]}
              </div>
              <div className={`truncate text-[10px] ${fraud ? 'text-gold-300' : 'text-slate-400'}`}>
                {fraud ? `★ ${TRUST.rating} · ${TRUST.users}` : APP_TAGLINE.plain}
              </div>
            </div>
            {fraud ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCert(true);
                    dispatch({ type: 'verify', what: 'badge' });
                  }}
                  className="rounded-full border border-neon-400/40 bg-neon-500/10 px-2 py-1 text-[10px] font-bold text-neon-300"
                  data-testid="ndia-badge"
                >
                  🛡️ {TRUST.badge}
                </button>
                <SoundToggle />
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCert(true);
                  dispatch({ type: 'verify', what: 'about' });
                }}
                className="text-xs font-medium text-blue-300 underline underline-offset-4"
              >
                About
              </button>
            )}
          </div>
          {fraud && market && <Ticker />}
          {fraud && market && <ToastLane screen={game.step} />}
          {market && <Wallets display={display} />}
          {fraud && market && <VipBar celebrating={celebrating} total={total} />}
          <LevelBar step={game.step} skin={skin} />
        </header>

        <main className="relative flex-1 overflow-hidden px-4 pt-2 pb-4">
          {celebrating !== null && !inert && <Confetti pieces={90} />}
          {children}
        </main>

        <div
          data-sticky="bottom"
          className={`sticky bottom-0 z-20 ${fraud ? 'bg-void-950/95 backdrop-blur' : 'border-t border-slate-700 bg-slate-900'}`}
        >
          {actions && (
            <div className="space-y-1 px-4 pt-3 pb-2">
              {!fraud && market && (
                <p className="pb-1 text-xs text-slate-300" data-testid="risk-warning">
                  ⚠️ {RISK_WARNING}
                </p>
              )}
              {actions}
            </div>
          )}
          <div
            className={`px-3 py-1 text-center text-[10px] ${fraud ? 'text-white/30' : 'text-slate-400'}`}
          >
            {RESEARCH_FOOTER}
          </div>
        </div>

        <Sheet
          skin={skin}
          open={cert}
          onClose={() => setCert(false)}
          title={fraud ? TRUST.regulator : `About ${APP_NAME.plain}`}
        >
          {fraud ? <Certificate /> : <HonestAbout />}
        </Sheet>
      </div>
    </div>
  );
}

export function Certificate() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border-2 border-gold-400/70 bg-linear-to-b from-amber-50 to-amber-100 p-4 text-center text-stone-900">
        <div className="text-[10px] tracking-[0.2em] text-amber-800 uppercase">
          {TRUST.regulator}
        </div>
        <div className="mt-2 text-lg font-black">Certificate of Registration</div>
        <div className="text-sm">ZenTrade X Digital Pvt. Ltd.</div>
        <div className="mt-2 text-xs">Reg. No. {TRUST.certificateNo}</div>
        <div className="mx-auto mt-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-700 text-[10px] font-black text-amber-800">
          NDIA
          <br />
          SEAL
        </div>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-white/80">
        {TRUST.fraudAbout.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

function HonestAbout() {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {TRUST.honestAbout.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}
