import type { ReactNode } from 'react';
import { RESEARCH_FOOTER } from '../config/game';

/** Plain dark frame for consent and loading screens (before the game starts). */
export function StudyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-ink-950">
      <div className="flex min-h-dvh w-full max-w-[420px] flex-col bg-ink-900">
        <main className="flex-1 px-4 py-6">{children}</main>
        <div className="sticky bottom-0 z-20">
          <div
            className="bg-ink-950/95 px-3 py-1.5 text-center text-[11px] text-gray-400"
            data-testid="research-footer"
          >
            {RESEARCH_FOOTER}
          </div>
        </div>
      </div>
    </div>
  );
}
