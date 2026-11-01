import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  END,
  FEATURE_EXPLAINERS,
  PRIZE_DRAW,
  REPORT,
  SAFETY_TIPS,
  SHARE,
  SPINS,
  TRAP_AVOIDED,
  TRAP_TEXT,
  RESEARCH_FOOTER,
} from '../../config/game';
import { logEvent } from '../../lib/logger';
import { useLog } from '../../lib/useLog';
import { finalBalance, formatINR, spinNet } from '../economy';
import { useGame } from '../GameProvider';
import { factsFromState, TRAPS, trapResult } from '../traps';

/** After the reveal the app fiction is over: report, share and end use one neutral design. */
function ReportLayout({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-slate-950 text-slate-50">
      <div className="flex min-h-dvh w-full max-w-[420px] flex-col bg-slate-900">
        <main className="flex-1 px-4 py-5">{children}</main>
        <div
          className="sticky bottom-0 border-t border-slate-700 bg-slate-900"
          data-sticky="bottom"
        >
          {actions && <div className="space-y-2 px-4 pt-3 pb-2">{actions}</div>}
          <div className="px-3 py-1 text-center text-[10px] text-slate-400">{RESEARCH_FOOTER}</div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-400 uppercase">{title}</h2>
      {children}
    </section>
  );
}

const btnPrimary =
  'w-full rounded-xl bg-blue-700 px-4 py-3 text-base font-semibold text-white hover:bg-blue-600 disabled:opacity-40';
const btnSecondary =
  'w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-base font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-40';

/** Prize-draw code derived from the participant id (no contact details needed). */
export function prizeCode(participantId: string): string {
  const hex = participantId.replace(/-/g, '').toUpperCase();
  return `ZT-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/**
 * S14 — Scam Report Card (reveal and debrief): which traps the player fell for, trap score,
 * spin results, final balance, how the scam version worked and how to spot real scams. The trap
 * score uses the same function as the export.
 */
export function Report() {
  const { game, skin, participantId, next } = useGame();
  const step = game.step;
  useLog(step);
  const facts = factsFromState(game, skin);
  const traps = trapResult(facts);
  const net = spinNet(game.spins);
  const final = finalBalance(game.wallets, game.spins);
  const tickets = Math.max(0, Math.floor(final / PRIZE_DRAW.rupeesPerTicket));
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    logEvent(step, 'report_shown', {
      trap_score: traps.score,
      trap_possible: traps.possible,
      traps: traps.fallen,
      spin_net: net,
      final_balance: final,
      ...(PRIZE_DRAW.enabled
        ? { prize_tickets: tickets, prize_code: prizeCode(participantId) }
        : {}),
    });
  }, [step, traps.score, traps.possible, traps.fallen, net, final, tickets, participantId]);

  const applicable = TRAPS.filter((t) => !t.fraudOnly || skin === 'fraud');
  const avoided = applicable.filter((t) => !traps.fallen.includes(t.id)).map((t) => t.id);
  const pct = traps.possible ? traps.score / traps.possible : 0;
  const w = game.wallets;

  return (
    <ReportLayout
      actions={
        <button type="button" className={btnPrimary} onClick={() => next()}>
          Continue
        </button>
      }
    >
      <div className="text-center">
        <div className="text-xs font-bold tracking-widest text-red-400 uppercase">Reveal</div>
        <h1 className="mt-1 text-2xl font-black">{REPORT.title}</h1>
        <p className="mt-2 text-sm text-slate-200">
          {skin === 'fraud' ? REPORT.revealFraud : REPORT.revealPlain}
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-800 p-4 text-center">
        <div className="text-sm text-slate-300">Trap score</div>
        <div
          className="text-5xl font-black"
          style={{ color: pct >= 0.6 ? '#f87171' : pct >= 0.3 ? '#fbbf24' : '#4ade80' }}
        >
          <span data-testid="trap-score">{traps.score}</span>
          <span className="text-2xl text-slate-400"> / {traps.possible}</span>
        </div>
        <div className="mx-auto mt-2 h-2 w-48 overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full rounded-full bg-red-500"
            style={{ width: `${Math.round(pct * 100)}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-slate-400">
          {pct >= 0.6
            ? 'A real scam app would have taken a lot from you.'
            : pct >= 0.3
              ? 'You dodged some traps, but not all.'
              : 'Well spotted — you avoided most traps.'}
        </div>
      </div>

      {traps.fallen.length > 0 && (
        <Section title={REPORT.trapsTitle}>
          <ul className="space-y-2" data-testid="traps-fallen">
            {traps.fallen.map((id) => (
              <li key={id} className="rounded-xl border border-red-900 bg-red-950/50 p-3">
                <div className="font-semibold text-red-300">❌ {TRAP_TEXT[id][skin]}</div>
                <div className="mt-0.5 text-xs text-red-200/80">{TRAP_TEXT[id].tip}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {avoided.length > 0 && (
        <Section title={REPORT.avoidedTitle}>
          <ul className="space-y-1 text-sm" data-testid="traps-avoided">
            {avoided.map((id) => (
              <li key={id} className="text-green-300">
                ✅ {TRAP_AVOIDED[id]}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={REPORT.spinsTitle}>
        <ul className="space-y-1 text-sm" data-testid="spin-results">
          {game.spins.map((s) => (
            <li key={s.gain} className="flex justify-between">
              <span>
                50% lose ₹{SPINS.loss} / 50% win ₹{s.gain}
              </span>
              <span
                className={
                  !s.accepted
                    ? 'text-slate-400'
                    : s.outcome === 'win'
                      ? 'font-semibold text-green-400'
                      : 'font-semibold text-red-400'
                }
              >
                {!s.accepted
                  ? 'skipped'
                  : s.outcome === 'win'
                    ? `won +₹${s.gain}`
                    : `lost −₹${SPINS.loss}`}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-1 text-right text-sm font-semibold">Spins total: {formatINR(net)}</div>
      </Section>

      <Section title={REPORT.balanceTitle}>
        <table className="w-full text-sm">
          <tbody>
            {[
              ['Main wallet', w.main],
              ['Profit wallet', w.profit],
              ['Portfolio', w.portfolio],
              ['Cashed out', w.cashedOut],
              ...(w.taxPaid ? [['Withdrawal “tax” paid', -w.taxPaid] as const] : []),
              ['Bonus spins', net],
            ].map(([label, v]) => (
              <tr key={label as string} className="border-b border-slate-800">
                <td className="py-1 text-slate-300">{label}</td>
                <td className="py-1 text-right">{formatINR(v as number)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-1.5 font-bold">Final balance</td>
              <td className="py-1.5 text-right text-lg font-black" data-testid="final-balance">
                {formatINR(final)}
              </td>
            </tr>
          </tbody>
        </table>
        {skin === 'fraud' && game.cashout !== 'done' && (
          <p className="mt-2 rounded-lg bg-amber-950/50 p-2 text-xs text-amber-200">
            In a real scam app, the {formatINR(w.main + w.profit + w.portfolio)} still “in the app”
            would never come back{w.taxPaid ? ', and the tax you paid would be lost too' : ''}. We
            count it here so your score reflects your choices only.
          </p>
        )}
        {PRIZE_DRAW.enabled && (
          <div className="mt-3 rounded-xl border border-blue-800 bg-blue-950/60 p-3 text-sm">
            <div className="font-semibold">
              Prize draw: {tickets} ticket{tickets === 1 ? '' : 's'}
            </div>
            <div>
              Your code: <span className="font-mono font-bold">{prizeCode(participantId)}</span> —
              write it down.
            </div>
          </div>
        )}
      </Section>

      <Section title={REPORT.explainTitle}>
        <ul className="space-y-1.5 text-sm">
          {FEATURE_EXPLAINERS.map((f) => (
            <li key={f.name}>
              <span className="font-semibold">{f.name}: </span>
              <span className="text-slate-200">{f.what}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-400">{REPORT.scripted}</p>
      </Section>

      <Section title={REPORT.tipsTitle}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-100" data-testid="safety-tips">
          {SAFETY_TIPS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Section>
    </ReportLayout>
  );
}

/** S15 — Share the challenge (link without personal data). */
export function Share() {
  const { game, next } = useGame();
  const step = game.step;
  const log = useLog(step);
  const [copied, setCopied] = useState(false);
  const url = window.location.origin + '/';

  async function share() {
    try {
      if (typeof navigator.share === 'function') {
        log('share_tap', { method: 'native' });
        await navigator.share({ title: 'Can you spot the scam?', text: SHARE.shareText, url });
      } else {
        log('share_tap', { method: 'copy' });
        await navigator.clipboard?.writeText(`${SHARE.shareText} ${url}`);
        setCopied(true);
      }
    } catch {
      // share sheet dismissed or clipboard blocked: nothing to do
    }
  }

  return (
    <ReportLayout
      actions={
        <button type="button" className={btnSecondary} onClick={() => next()}>
          {SHARE.finish}
        </button>
      }
    >
      <div className="pt-6 text-center">
        <div className="text-5xl">🕵️</div>
        <h1 className="mt-3 text-2xl font-black">{SHARE.title}</h1>
        <p className="mt-2 text-sm text-slate-200">{SHARE.body}</p>
        <button type="button" className={`${btnPrimary} mt-6`} onClick={share}>
          📤 {SHARE.button}
        </button>
        {copied && <p className="mt-2 text-sm text-green-400">{SHARE.copied}</p>}
      </div>
    </ReportLayout>
  );
}

export function End() {
  const { game } = useGame();
  useLog(game.step);
  return (
    <ReportLayout>
      <div className="pt-12 text-center">
        <div className="text-5xl">🙏</div>
        <h1 className="mt-3 text-2xl font-black">{END.title}</h1>
        <p className="mt-2 text-slate-200">{END.body}</p>
      </div>
    </ReportLayout>
  );
}
