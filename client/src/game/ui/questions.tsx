import { useState } from 'react';
import type { Skin } from '../../config/game';

export function ChoiceList({
  skin,
  options,
  value,
  onPick,
  label,
}: {
  skin: Skin;
  options: { value: string; label: string }[];
  value?: string | number;
  onPick: (v: string) => void;
  label: string;
}) {
  const fraud = skin === 'fraud';
  return (
    <div role="radiogroup" aria-label={label} className="space-y-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onPick(o.value)}
          className={
            fraud
              ? `w-full rounded-2xl border px-4 py-3.5 text-left text-base font-bold transition ${value === o.value ? 'border-neon-400 bg-neon-500/20 text-white' : 'border-white/10 bg-white/5 text-white hover:border-neon-400/50'}`
              : `w-full rounded-xl border px-4 py-3 text-left text-base transition ${value === o.value ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:border-slate-500'}`
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 1–7 scale as seven buttons (one tap answers). */
export function Scale7({
  skin,
  value,
  onPick,
  minLabel,
  maxLabel,
  label,
}: {
  skin: Skin;
  value?: number;
  onPick: (v: number) => void;
  minLabel: string;
  maxLabel: string;
  label: string;
}) {
  const fraud = skin === 'fraud';
  return (
    <div>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-7 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={String(n)}
            onClick={() => onPick(n)}
            className={
              fraud
                ? `h-12 rounded-xl border text-lg font-black ${value === n ? 'border-gold-400 bg-gold-400 text-black' : 'border-white/10 bg-white/5 text-white'}`
                : `h-12 rounded-lg border text-base font-semibold ${value === n ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-800'}`
            }
          >
            {n}
          </button>
        ))}
      </div>
      <div
        className={`mt-1.5 flex justify-between text-xs ${fraud ? 'text-white/50' : 'text-slate-500'}`}
      >
        <span>1 = {minLabel}</span>
        <span>7 = {maxLabel}</span>
      </div>
    </div>
  );
}

/** Number entry with a submit button (CRT answers). */
export function NumberAnswer({
  skin,
  unit,
  onSubmit,
  label,
}: {
  skin: Skin;
  unit: string;
  onSubmit: (v: string) => void;
  label: string;
}) {
  const [raw, setRaw] = useState('');
  const fraud = skin === 'fraud';
  const ok = raw !== '' && Number.isFinite(Number(raw));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSubmit(raw);
      }}
    >
      <div
        className={
          fraud
            ? 'flex items-center rounded-2xl border border-neon-400/30 bg-black/40 px-3'
            : 'flex items-center rounded-xl border border-slate-300 bg-white px-3'
        }
      >
        <input
          aria-label={label}
          inputMode="decimal"
          autoComplete="off"
          value={raw}
          onChange={(e) => setRaw(e.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
          className={`tabular w-full bg-transparent px-1 py-3 outline-none ${fraud ? 'text-3xl font-black text-white' : 'text-2xl font-semibold text-slate-900'}`}
        />
        <span className={fraud ? 'text-white/60' : 'text-slate-500'}>{unit}</span>
      </div>
      <button
        type="submit"
        disabled={!ok}
        className={
          fraud
            ? 'mt-3 w-full rounded-2xl bg-neon-500 px-4 py-3 text-base font-black text-black disabled:opacity-40'
            : 'mt-3 w-full rounded-xl bg-blue-700 px-4 py-3 text-base font-semibold text-white disabled:opacity-40'
        }
      >
        Submit answer
      </button>
    </form>
  );
}
