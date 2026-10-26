import type { ReactNode } from 'react';
import { BRAND, BONUS, RESEARCH_FOOTER, VIP_TIERS } from '../config/session';
import { formatINR, type Wallet } from '../lib/wallet';
import type { AppVersion } from '../types';
import { Logo } from './Logo';

export function ResearchFooter() {
  return (
    <div
      className="bg-ink-950/95 px-3 py-1.5 text-center text-[11px] text-gray-400"
      data-testid="research-footer"
    >
      {RESEARCH_FOOTER}
    </div>
  );
}

export function vipLevel(totalDeposited: number): number {
  let level = 0;
  for (const t of VIP_TIERS) if (totalDeposited >= t.minDeposit) level = t.level;
  return level;
}

function WalletBar({ wallet, version }: { wallet: Wallet; version: AppVersion }) {
  const vip = vipLevel(wallet.totalDeposited);
  return (
    <div className="grid grid-cols-2 gap-2 px-4 pb-3" data-testid="wallet">
      <div className="rounded-xl bg-ink-800 px-3 py-2">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">Practice balance</div>
        <div className="text-base font-semibold text-white" data-testid="wallet-cash">
          {formatINR(wallet.cash)}
        </div>
      </div>
      <div className="rounded-xl bg-ink-800 px-3 py-2">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">In app</div>
        <div className="text-base font-semibold text-brand-400" data-testid="wallet-app">
          {formatINR(wallet.appBalance)}
        </div>
      </div>
      {version === 'fraud' && (wallet.bonus > 0 || vip > 0) && (
        <div className="col-span-2 flex flex-wrap gap-2 text-xs">
          {wallet.bonus > 0 && (
            <span
              className="rounded-full bg-gold-500/15 px-2.5 py-1 text-gold-300"
              data-testid="wallet-bonus"
            >
              🔒 {BONUS.lockedLabel}: {formatINR(wallet.bonus)}
            </span>
          )}
          {vip > 0 && (
            <span className="rounded-full bg-gold-500/15 px-2.5 py-1 font-semibold text-gold-300">
              👑 VIP {vip}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const NAV = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'plans', label: 'Plans', icon: '▤' },
  { id: 'wallet', label: 'Wallet', icon: '◫' },
  { id: 'profile', label: 'Profile', icon: '◯' },
];

/** Decorative bottom navigation (the session follows a fixed order). */
function BottomNav({ active }: { active: string }) {
  return (
    <nav className="grid grid-cols-4 border-t border-ink-700 bg-ink-900" aria-hidden="true">
      {NAV.map((n) => (
        <div
          key={n.id}
          className={`flex flex-col items-center py-2 text-[11px] ${
            n.id === active ? 'text-brand-400' : 'text-gray-500'
          }`}
        >
          <span className="text-lg leading-none">{n.icon}</span>
          {n.label}
        </div>
      ))}
    </nav>
  );
}

/** Phone-style frame used by the app session screens (A1–A10). */
export function AppShell({
  wallet,
  version,
  nav = 'home',
  actions,
  floating,
  children,
}: {
  wallet: Wallet;
  version: AppVersion;
  nav?: string;
  /** Buttons pinned above the bottom nav, so the choice is always visible */
  actions?: ReactNode;
  /** Floating element (e.g. mentor chat bubble) shown above the actions */
  floating?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh justify-center bg-ink-950">
      <div className="relative flex min-h-dvh w-full max-w-[420px] flex-col bg-ink-900">
        <header className="sticky top-0 z-20 bg-ink-900/95 backdrop-blur">
          <div className="flex items-center gap-2 px-4 py-3">
            <Logo size={30} />
            <div className="leading-tight">
              <div className="font-bold text-white">{BRAND.appName}</div>
              <div className="text-[11px] text-gray-400">{BRAND.tagline}</div>
            </div>
          </div>
          <WalletBar wallet={wallet} version={version} />
        </header>
        <main className="flex-1 px-4 pb-6 pt-2">{children}</main>
        <div className="sticky bottom-0 z-20">
          {floating && (
            <div className="pointer-events-none absolute bottom-full right-0 left-0 flex justify-end px-4 pb-3">
              <div className="pointer-events-auto">{floating}</div>
            </div>
          )}
          {actions && (
            <div className="space-y-2 border-t border-ink-700 bg-ink-900/95 px-4 py-3 backdrop-blur">
              {actions}
            </div>
          )}
          <BottomNav active={nav} />
          <ResearchFooter />
        </div>
      </div>
    </div>
  );
}

/** Plain frame for consent, surveys and debrief. */
export function StudyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-ink-950">
      <div className="flex min-h-dvh w-full max-w-[420px] flex-col bg-ink-900">
        <main className="flex-1 px-4 py-6">{children}</main>
        <div className="sticky bottom-0 z-20">
          <ResearchFooter />
        </div>
      </div>
    </div>
  );
}
