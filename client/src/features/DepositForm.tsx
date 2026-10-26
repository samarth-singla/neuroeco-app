import { useState } from 'react';
import { WALLET } from '../config/session';
import { formatINR } from '../lib/wallet';

export function depositError(amount: number, max: number): string | null {
  if (!Number.isInteger(amount) || amount <= 0) return 'Enter an amount';
  if (amount < WALLET.minDeposit) return `Minimum is ${formatINR(WALLET.minDeposit)}`;
  if (amount > max) return `You have ${formatINR(max)} available`;
  return null;
}

export interface AmountField {
  raw: string;
  setRaw: (v: string) => void;
  amount: number;
  error: string | null;
  canInvest: boolean;
  max: number;
}

export function useAmount(max: number): AmountField {
  const [raw, setRaw] = useState('');
  const amount = raw === '' ? 0 : Number(raw);
  return {
    raw,
    setRaw,
    amount,
    error: depositError(amount, max),
    canInvest: max >= WALLET.minDeposit,
    max,
  };
}

/** Amount input with quick-pick chips. */
export function AmountInput({ field }: { field: AmountField }) {
  const { raw, setRaw, error, canInvest, max } = field;
  return (
    <div>
      <label className="block text-sm text-gray-400" htmlFor="amount">
        Amount (available: {formatINR(max)})
      </label>
      <div className="mt-1 flex items-center rounded-xl border border-ink-600 bg-ink-800 px-3 focus-within:border-brand-400">
        <span className="text-lg text-gray-400">₹</span>
        <input
          id="amount"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={raw}
          disabled={!canInvest}
          onChange={(e) => setRaw(e.target.value.replace(/\D/g, '').slice(0, 7))}
          className="w-full bg-transparent px-2 py-3 text-2xl font-semibold text-white outline-none"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {WALLET.quickAmounts.map((q) => (
          <button
            key={q}
            type="button"
            disabled={q > max}
            onClick={() => setRaw(String(q))}
            className="rounded-full border border-ink-600 bg-ink-700 px-3 py-1.5 text-sm text-gray-200 disabled:opacity-30"
          >
            {formatINR(q)}
          </button>
        ))}
      </div>
      {raw !== '' && error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {!canInvest && (
        <p className="mt-2 text-sm text-gray-400">Your practice balance is too low to invest.</p>
      )}
    </div>
  );
}

/** Confirm + skip buttons. Skip always works, so not investing is a valid choice everywhere. */
export function DepositButtons({
  field,
  confirmLabel,
  skipLabel,
  onConfirm,
  onSkip,
}: {
  field: AmountField;
  confirmLabel: string;
  skipLabel: string;
  onConfirm: (amount: number) => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={field.error !== null}
        onClick={() => onConfirm(field.amount)}
        className="w-full rounded-xl bg-brand-500 px-4 py-3 font-semibold text-ink-950 transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {confirmLabel}
        {field.error === null ? ` ${formatINR(field.amount)}` : ''}
      </button>
      <button
        type="button"
        onClick={onSkip}
        className="w-full rounded-xl px-4 py-2 text-sm text-gray-300 underline-offset-4 hover:underline"
      >
        {skipLabel}
      </button>
    </div>
  );
}

/** Input and buttons together (used inline for the A8 top-up). */
export function DepositForm({
  max,
  confirmLabel,
  skipLabel,
  onConfirm,
  onSkip,
}: {
  max: number;
  confirmLabel: string;
  skipLabel: string;
  onConfirm: (amount: number) => void;
  onSkip: () => void;
}) {
  const field = useAmount(max);
  return (
    <div>
      <AmountInput field={field} />
      <div className="mt-4">
        <DepositButtons
          field={field}
          confirmLabel={confirmLabel}
          skipLabel={skipLabel}
          onConfirm={onConfirm}
          onSkip={onSkip}
        />
      </div>
    </div>
  );
}
