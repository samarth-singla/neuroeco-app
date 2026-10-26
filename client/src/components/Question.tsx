import type { Item } from '../config/survey';
import type { AnswerValue } from '../types';
import { formatINR } from '../lib/wallet';

/** Is this value a complete answer for the item? (free text is optional) */
export function isAnswered(item: Item, value: AnswerValue | undefined): boolean {
  if (item.type === 'text') return true;
  if (value === undefined || value === '') return false;
  if (item.type === 'number' || item.type === 'slider') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < item.min || n > item.max) return false;
    if (item.type === 'number' && !item.decimals && !Number.isInteger(n)) return false;
  }
  return true;
}

function Likert({
  item,
  value,
  onChange,
}: {
  item: Extract<Item, { type: 'likert' }>;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
}) {
  return (
    <div>
      <div role="radiogroup" aria-label={item.text} className="grid grid-cols-7 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n}`}
            onClick={() => onChange(n)}
            className={`h-11 rounded-lg border text-base font-semibold transition ${
              value === n
                ? 'border-brand-400 bg-brand-500 text-ink-950'
                : 'border-ink-600 bg-ink-800 text-gray-200 hover:border-brand-400/60'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between gap-4 text-[11px] text-gray-400">
        <span>1 = {item.minLabel}</span>
        <span className="text-right">7 = {item.maxLabel}</span>
      </div>
    </div>
  );
}

export function Question({
  item,
  value,
  onChange,
  showError,
}: {
  item: Item;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  showError: boolean;
}) {
  const missing = showError && !isAnswered(item, value);
  const labelId = `q-${item.id}`;

  let control;
  switch (item.type) {
    case 'likert':
      control = <Likert item={item} value={value} onChange={onChange} />;
      break;
    case 'choice':
      control = (
        <div role="radiogroup" aria-labelledby={labelId} className="space-y-2">
          {item.options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={value === o.value}
              onClick={() => onChange(o.value)}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                value === o.value
                  ? 'border-brand-400 bg-brand-500/15 text-white'
                  : 'border-ink-600 bg-ink-800 text-gray-200 hover:border-brand-400/60'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
      break;
    case 'number':
      control = (
        <div className="flex items-center gap-2">
          <input
            aria-labelledby={labelId}
            inputMode={item.decimals ? 'decimal' : 'numeric'}
            autoComplete="off"
            value={value ?? ''}
            onChange={(e) => {
              const cleaned = e.target.value.replace(item.decimals ? /[^\d.]/g : /\D/g, '');
              onChange(cleaned);
            }}
            className="w-40 rounded-xl border border-ink-600 bg-ink-800 px-3 py-2.5 text-lg text-white outline-none focus:border-brand-400"
          />
          {item.unit && <span className="text-sm text-gray-400">{item.unit}</span>}
        </div>
      );
      break;
    case 'slider': {
      const set = value !== undefined && value !== '';
      control = (
        <div>
          <input
            type="range"
            aria-labelledby={labelId}
            min={item.min}
            max={item.max}
            step={item.step}
            value={set ? Number(value) : item.min}
            onChange={(e) => onChange(Number(e.target.value))}
            onClick={(e) => onChange(Number((e.target as HTMLInputElement).value))}
            className="w-full accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-xs text-gray-400">
            <span>{formatINR(item.min)}</span>
            <span className="text-base font-semibold text-white">
              {set ? formatINR(Number(value)) : 'Tap or move the slider'}
            </span>
            <span>{formatINR(item.max)}</span>
          </div>
        </div>
      );
      break;
    }
    case 'text':
      control = (
        <textarea
          aria-labelledby={labelId}
          rows={3}
          maxLength={1500}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
        />
      );
      break;
  }

  return (
    <fieldset
      className={`rounded-2xl border p-4 ${missing ? 'border-red-500/70' : 'border-transparent'}`}
      data-item={item.id}
    >
      <legend className="sr-only">{item.text}</legend>
      <p id={labelId} className="mb-3 text-sm font-medium leading-relaxed text-white">
        {item.text}
        {item.type === 'text' && <span className="text-gray-400"> (optional)</span>}
      </p>
      {control}
      {missing && <p className="mt-2 text-xs text-red-400">Please answer this question.</p>}
    </fieldset>
  );
}
