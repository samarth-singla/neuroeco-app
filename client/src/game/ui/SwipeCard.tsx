import { useRef, useState, type ReactNode } from 'react';
import type { Skin } from '../../config/game';

const THRESHOLD = 90;

/**
 * Tinder-style card: drag right for the right-hand answer, left for the left-hand one. The two
 * buttons under the card do the same thing, so swiping is optional (and keyboard accessible).
 */
export function SwipeCard({
  skin,
  children,
  left,
  right,
  onAnswer,
}: {
  skin: Skin;
  children: ReactNode;
  left: { value: string; label: string };
  right: { value: string; label: string };
  onAnswer: (value: string, method: 'swipe' | 'tap') => void;
}) {
  const fraud = skin === 'fraud';
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const start = useRef<number | null>(null);

  function finish(dir: 'left' | 'right', method: 'swipe' | 'tap') {
    if (leaving) return;
    setLeaving(true);
    setDx(dir === 'right' ? 420 : -420);
    setTimeout(() => onAnswer(dir === 'right' ? right.value : left.value, method), 180);
  }

  const tilt = Math.max(-1, Math.min(1, dx / 160));
  return (
    <div>
      <div
        role="group"
        aria-label="Swipe card"
        onPointerDown={(e) => {
          if (leaving) return;
          start.current = e.clientX;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (start.current !== null) setDx(e.clientX - start.current);
        }}
        onPointerUp={() => {
          if (start.current === null) return;
          start.current = null;
          if (Math.abs(dx) > THRESHOLD) finish(dx > 0 ? 'right' : 'left', 'swipe');
          else setDx(0);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDx(0);
        }}
        style={{
          transform: `translateX(${dx}px) rotate(${tilt * 8}deg)`,
          transition: start.current === null ? 'transform 0.2s ease-out' : 'none',
          touchAction: 'pan-y',
        }}
        className={`relative cursor-grab select-none ${
          fraud
            ? 'glow-card rounded-3xl p-4'
            : 'rounded-2xl border border-slate-200 bg-white p-4 shadow-md'
        }`}
      >
        <span
          className="pointer-events-none absolute top-3 left-3 z-10 rotate-[-12deg] rounded-lg border-2 border-red-500 px-2 py-0.5 text-sm font-black text-red-500"
          style={{ opacity: Math.max(0, -tilt) }}
        >
          {left.label.toUpperCase()}
        </span>
        <span
          className="pointer-events-none absolute top-3 right-3 z-10 rotate-[12deg] rounded-lg border-2 border-green-500 px-2 py-0.5 text-sm font-black text-green-500"
          style={{ opacity: Math.max(0, tilt) }}
        >
          {right.label.toUpperCase()}
        </span>
        <div className="pointer-events-none">{children}</div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={leaving}
          onClick={() => finish('left', 'tap')}
          className={
            fraud
              ? 'rounded-2xl border border-red-400/40 bg-red-500/10 py-3 text-base font-black text-red-300'
              : 'rounded-xl border border-slate-300 bg-white py-3 text-base font-semibold text-slate-800'
          }
        >
          ← {left.label}
        </button>
        <button
          type="button"
          disabled={leaving}
          onClick={() => finish('right', 'tap')}
          className={
            fraud
              ? 'rounded-2xl border border-neon-400/40 bg-neon-500/10 py-3 text-base font-black text-neon-300'
              : 'rounded-xl border border-slate-300 bg-white py-3 text-base font-semibold text-slate-800'
          }
        >
          {right.label} →
        </button>
      </div>
      <p className={`mt-2 text-center text-xs ${fraud ? 'text-white/40' : 'text-slate-400'}`}>
        Swipe the card or tap a button
      </p>
    </div>
  );
}

/** 1–7 slider that must be moved (or tapped) before it counts as answered. */
export function Slider7({
  skin,
  id,
  value,
  onChange,
  minLabel,
  maxLabel,
}: {
  skin: Skin;
  id: string;
  value: number | null;
  onChange: (v: number) => void;
  minLabel: string;
  maxLabel: string;
}) {
  const fraud = skin === 'fraud';
  return (
    <div>
      <div
        className={`mb-2 text-center text-4xl font-black ${fraud ? 'text-gold-300' : 'text-blue-700'}`}
      >
        {value ?? '–'}
        <span className={`text-base ${fraud ? 'text-white/40' : 'text-slate-400'}`}> / 7</span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={7}
        step={1}
        value={value ?? 4}
        aria-valuetext={value === null ? 'not answered' : String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        onClick={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        className={`w-full ${fraud ? 'accent-amber-400' : 'accent-blue-700'}`}
      />
      <div
        className={`mt-1 flex justify-between text-xs ${fraud ? 'text-white/50' : 'text-slate-500'}`}
      >
        <span>1 · {minLabel}</span>
        <span>{maxLabel} · 7</span>
      </div>
      {value === null && (
        <p className={`mt-2 text-center text-xs ${fraud ? 'text-white/40' : 'text-slate-400'}`}>
          Move or tap the slider
        </p>
      )}
    </div>
  );
}
