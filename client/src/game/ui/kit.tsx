/**
 * Shared game UI. Every component takes the skin:
 * - fraud: neon/gold, huge numbers, pulsing CTA, animations
 * - plain (honest): clean light theme, normal sizes, equal-weight buttons
 */
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ECONOMY, type Skin } from '../../config/game';
import { formatINR } from '../economy';
import { haptic, play } from './sound';

// ---------------------------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------------------------

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { skin: Skin };

/** Main action. Fraud: giant pulsing gold button with haptics. Honest: normal primary button. */
export function CtaButton({
  skin,
  className = '',
  onClick,
  children,
  disabled,
  ...rest
}: BtnProps) {
  const fraud = skin === 'fraud';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        if (fraud) {
          haptic(35);
          play('tap');
        }
        onClick?.(e);
      }}
      className={
        fraud
          ? `w-full rounded-2xl bg-linear-to-r from-gold-500 via-gold-300 to-gold-500 px-4 py-4 text-lg font-black tracking-wide text-black uppercase disabled:animate-none disabled:opacity-40 ${disabled ? '' : 'animate-pulse-cta'} ${className}`
          : `w-full rounded-xl bg-blue-700 px-4 py-3 text-base font-semibold text-white hover:bg-blue-800 disabled:opacity-40 ${className}`
      }
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * The "don't" option. Fraud: small, low-contrast text link. Honest: a full button of equal weight
 * to the CTA (same size, outlined).
 */
export function SkipButton({ skin, className = '', children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={
        skin === 'fraud'
          ? `mx-auto block px-3 py-2 text-xs text-white/35 hover:text-white/60 ${className}`
          : `w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50 ${className}`
      }
      {...rest}
    >
      {children}
    </button>
  );
}

/** Neutral secondary action, used where neither option is a "skip". */
export function SecondaryButton({ skin, className = '', children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={
        skin === 'fraud'
          ? `w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base font-semibold text-white hover:bg-white/10 ${className}`
          : `w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50 ${className}`
      }
      {...rest}
    >
      {children}
    </button>
  );
}

/** Tiny link (T&C, details). Fraud: grey and small. Honest: readable underlined link. */
export function InfoLink({ skin, className = '', children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={
        skin === 'fraud'
          ? `text-[10px] text-white/30 underline underline-offset-2 ${className}`
          : `text-sm font-medium text-blue-700 underline underline-offset-4 ${className}`
      }
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
// Cards and sheets
// ---------------------------------------------------------------------------------------------

export function Panel({
  skin,
  children,
  className = '',
  glow = false,
}: {
  skin: Skin;
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={
        skin === 'fraud'
          ? `glow-card rounded-2xl p-4 ${glow ? 'animate-glow' : ''} ${className}`
          : `rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`
      }
    >
      {children}
    </div>
  );
}

export function Title({
  skin,
  children,
  sub,
}: {
  skin: Skin;
  children: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="mb-3">
      <h1
        className={
          skin === 'fraud'
            ? 'text-2xl leading-tight font-black text-white'
            : 'text-xl font-bold text-slate-900'
        }
      >
        {children}
      </h1>
      {sub && (
        <p
          className={
            skin === 'fraud' ? 'mt-1 text-sm text-white/60' : 'mt-1 text-sm text-slate-600'
          }
        >
          {sub}
        </p>
      )}
    </div>
  );
}

/** Bottom sheet opened by the player (details, T&C, certificate). Always has a Close button. */
export function Sheet({
  skin,
  open,
  title,
  onClose,
  children,
}: {
  skin: Skin;
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={
          skin === 'fraud'
            ? 'max-h-[85dvh] w-full max-w-[420px] overflow-y-auto rounded-t-3xl border-t border-neon-400/30 bg-void-900 p-5 text-white'
            : 'max-h-[85dvh] w-full max-w-[420px] overflow-y-auto rounded-t-2xl bg-white p-5 text-slate-800'
        }
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className={
              skin === 'fraud'
                ? 'rounded-full bg-white/10 px-3 py-1 text-sm'
                : 'rounded-full bg-slate-100 px-3 py-1 text-sm'
            }
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Numbers, timers, celebrations
// ---------------------------------------------------------------------------------------------

/** Animated number that ticks up/down to `value`. */
export function useCountUp(value: number, ms = 700): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(a + (value - a) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, ms]);
  return shown;
}

export function Money({
  value,
  animate = true,
  className = '',
}: {
  value: number;
  animate?: boolean;
  className?: string;
}) {
  const n = useCountUp(value);
  return <span className={`tabular ${className}`}>{formatINR(animate ? n : value)}</span>;
}

/**
 * Countdown that really ticks but never blocks: at zero it shows `resetLabel` for 3 s and
 * starts again. `onReset` fires each time it restarts.
 */
export function Countdown({
  seconds,
  resetLabel = 'New slots opening…',
  onReset,
}: {
  seconds: number;
  resetLabel?: string;
  onReset?: () => void;
}) {
  const [tick, setTick] = useState(0);
  const cb = useRef(onReset);
  useEffect(() => {
    cb.current = onReset;
  });
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const pause = 3;
  const pos = tick % (seconds + pause);
  useEffect(() => {
    if (tick > 0 && pos === seconds) cb.current?.();
  }, [tick, pos, seconds]);
  if (pos >= seconds) return <span data-testid="countdown">{resetLabel}</span>;
  const left = seconds - pos;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <span className="tabular font-mono" data-testid="countdown">
      {mm}:{ss}
    </span>
  );
}

/**
 * Falling confetti. Decorative only: it lives inside the content area, under the sticky header
 * and action bar (z-10 < z-20), and ignores taps, so it never covers or blocks a button.
 */
export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const [items] = useState(() =>
    Array.from({ length: pieces }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 1.6 + Math.random() * 1.4,
      dx: `${(Math.random() - 0.5) * 120}px`,
      color: ['#22ff88', '#fbbf24', '#fde68a', '#f472b6', '#60a5fa'][i % 5],
      size: 6 + Math.random() * 6,
    })),
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
      {items.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.5,
            background: p.color,
            animation: `fall ${p.dur}s ${p.delay}s ease-in forwards`,
            ['--dx' as string]: p.dx,
          }}
          className="absolute top-0 rounded-sm"
        />
      ))}
    </div>
  );
}

/** Coins flying up from the middle of the screen (wins in the fraud skin). */
export function CoinBurst({ count = 12 }: { count?: number }) {
  const [items] = useState(() =>
    Array.from({ length: count }, () => ({
      dx: `${(Math.random() - 0.5) * 220}px`,
      delay: Math.random() * 0.4,
    })),
  );
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-1/3 z-10 flex justify-center"
      aria-hidden="true"
    >
      {items.map((c, i) => (
        <span
          key={i}
          className="absolute text-2xl"
          style={{
            animation: `coin-up 1.2s ${c.delay}s ease-out forwards`,
            opacity: 0,
            ['--dx' as string]: c.dx,
          }}
        >
          🪙
        </span>
      ))}
    </div>
  );
}

/** Win celebration (fraud only): confetti + coins + sound. */
export function Celebrate({ skin, big = false }: { skin: Skin; big?: boolean }) {
  useEffect(() => {
    if (skin === 'fraud') {
      play(big ? 'cash' : 'coin');
      haptic(big ? 80 : 40);
    }
  }, [skin, big]);
  if (skin !== 'fraud') return null;
  return (
    <>
      <Confetti pieces={big ? 110 : 60} />
      <CoinBurst count={big ? 18 : 10} />
    </>
  );
}

/** Circular timer ring (visual only, restarts; never forces an answer). */
export function TimerRing({ seconds, size = 64 }: { seconds: number; size?: number }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => (x + 1) % (seconds + 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const left = seconds - t;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="5"
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={left <= 5 ? '#f87171' : '#22ff88'}
        strokeWidth="5"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - left / seconds)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize="16"
        fontWeight="800"
      >
        {left}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------
// Amount picker
// ---------------------------------------------------------------------------------------------

/**
 * Amount input with quick chips, capped at `max` (the wallet balance). Below the minimum, the
 * confirm button stays disabled; "skip" is always possible on the screen.
 */
export function AmountPicker({
  skin,
  max,
  value,
  onChange,
  label = 'Amount',
  source = 'Main wallet',
  limit,
}: {
  skin: Skin;
  max: number;
  value: number;
  onChange: (v: number) => void;
  label?: string;
  source?: string;
  /** Extra cap that is not the wallet balance (e.g. an offer limit) */
  limit?: number;
}) {
  const fraud = skin === 'fraud';
  const cap = Math.max(0, Math.min(max, limit ?? Infinity));
  const chips = [...ECONOMY.quickAmounts.filter((q) => q < cap), cap].filter(
    (q, i, arr) => q >= ECONOMY.minInvest && arr.indexOf(q) === i,
  );
  return (
    <div>
      <div
        className={`flex items-baseline justify-between text-xs ${fraud ? 'text-white/50' : 'text-slate-500'}`}
      >
        <label htmlFor="amount">{label}</label>
        <span>
          {source}: {formatINR(max)}
        </span>
      </div>
      <div
        className={
          fraud
            ? 'mt-1 flex items-center rounded-2xl border border-neon-400/30 bg-black/40 px-3 focus-within:border-neon-400'
            : 'mt-1 flex items-center rounded-xl border border-slate-300 bg-white px-3 focus-within:border-blue-700'
        }
      >
        <span className={fraud ? 'text-xl text-neon-400' : 'text-lg text-slate-500'}>₹</span>
        <input
          id="amount"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={value === 0 ? '' : String(value)}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, '').slice(0, 7) || 0);
            onChange(Math.min(n, cap));
          }}
          className={`tabular w-full bg-transparent px-2 py-3 outline-none ${fraud ? 'text-3xl font-black text-white' : 'text-2xl font-semibold text-slate-900'}`}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {chips.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onChange(q)}
            className={
              fraud
                ? `rounded-full border px-3 py-1.5 text-sm font-bold ${value === q ? 'border-gold-400 bg-gold-400 text-black' : 'border-white/15 bg-white/5 text-white'}`
                : `rounded-full border px-3 py-1.5 text-sm ${value === q ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`
            }
          >
            {q === cap && q === max && q > 0
              ? fraud
                ? `ALL IN ${formatINR(q)}`
                : `All ${formatINR(q)}`
              : formatINR(q)}
          </button>
        ))}
      </div>
      {cap < ECONOMY.minInvest && (
        <p className={`mt-2 text-xs ${fraud ? 'text-white/50' : 'text-slate-500'}`}>
          Not enough in your {source}. Add funds from Main wallet, or skip.
        </p>
      )}
    </div>
  );
}

export function validAmount(v: number, max: number) {
  return v >= ECONOMY.minInvest && v <= max;
}
