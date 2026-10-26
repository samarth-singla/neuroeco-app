import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-500 text-ink-950 hover:bg-brand-400 font-semibold',
  gold: 'bg-gradient-to-r from-gold-500 to-gold-300 text-ink-950 font-semibold hover:brightness-110',
  secondary: 'bg-ink-700 text-white hover:bg-ink-600 border border-ink-600',
  ghost: 'bg-transparent text-gray-300 hover:text-white underline-offset-4 hover:underline',
  danger: 'bg-red-500/90 text-white hover:bg-red-500 font-semibold',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`w-full rounded-xl px-4 py-3 text-base transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-ink-600 bg-ink-800 p-4 ${className}`}>
      {children}
    </div>
  );
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-bold text-white">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
    </div>
  );
}

/** Simple full-screen-ish overlay used for the About page, chat and FAQ. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  closeLabel = 'Close',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[85dvh] w-full max-w-[420px] overflow-y-auto rounded-t-3xl border-t border-ink-600 bg-ink-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm text-gray-300 hover:bg-ink-700"
          >
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
