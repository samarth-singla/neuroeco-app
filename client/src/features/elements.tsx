/**
 * The design features compared in H1 (fraud-style) and their plain counterparts.
 * These are pure display components: screens add the logging. The UI/UX survey
 * (Phase 5) re-renders them so participants rate what they actually saw.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ABOUT,
  BONUS,
  BRAND,
  CHAT,
  FAQ,
  PLAIN_PLAN_NOTE,
  REGULATOR,
  SOCIAL_LABELS,
  TESTIMONIALS,
  TICKER,
  URGENCY,
  VIP_TIERS,
  type Plan,
} from '../config/session';
import { formatINR } from '../lib/wallet';
import type { AppVersion } from '../types';
import { Card, Sheet } from '../components/ui';
import { Countdown } from './Countdown';

// ---------- H1a: countdown + scarcity ----------

export function UrgencyBanner({ onReset }: { onReset?: () => void }) {
  return (
    <div
      className="mb-3 flex items-center justify-between rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-300"
      data-testid="urgency-banner"
    >
      <span>
        ⏱ {URGENCY.timerLabel} <Countdown onReset={onReset} />
      </span>
      <span className="rounded-full bg-red-500/25 px-2 py-0.5 text-xs font-semibold">
        🔥 {URGENCY.slotsText}
      </span>
    </div>
  );
}

// ---------- Plan card (both versions) ----------

export function PlanCard({
  plan,
  version,
  selected = false,
  onSelect,
}: {
  plan: Plan;
  version: AppVersion;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const fraud = version === 'fraud';
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? 'border-brand-400 bg-brand-500/10 ring-2 ring-brand-400/40'
          : 'border-ink-600 bg-ink-800 hover:border-ink-600/80'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-white">{plan.name}</div>
        {fraud && (
          <span className="rounded-full bg-gold-500/20 px-2 py-0.5 text-[11px] font-semibold text-gold-300">
            🔥 Hot
          </span>
        )}
      </div>
      <div className={`mt-1 text-lg font-bold ${fraud ? 'text-gold-300' : 'text-brand-400'}`}>
        {plan.returnText}
      </div>
      <div className="mt-1 text-xs text-gray-400">
        {plan.cycle} · {plan.risk}
      </div>
    </button>
  );
}

export function PlainPlanNote() {
  return <p className="mt-2 text-xs text-gray-400">{PLAIN_PLAN_NOTE}</p>;
}

// ---------- H1b: sign-up bonus / plain welcome ----------

export function BonusCard() {
  return (
    <Card className="border-gold-500/40 bg-linear-to-br from-gold-500/20 to-ink-800">
      <div className="text-3xl">🎁</div>
      <div className="mt-1 text-lg font-bold text-gold-300">{BONUS.title}</div>
      <div className="mt-1 text-2xl font-extrabold text-white">+{formatINR(BONUS.amount)}</div>
      <p className="mt-2 text-sm text-gray-300">{BONUS.body}</p>
    </Card>
  );
}

export function PlainWelcomeCard({ text }: { text: string }) {
  return (
    <Card>
      <p className="text-sm leading-relaxed text-gray-300">{text}</p>
    </Card>
  );
}

// ---------- H1c: VIP tiers / plain plan list ----------

export function VipTiers() {
  return (
    <div data-testid="vip-tiers">
      <Card className="border-gold-500/30">
        <div className="mb-2 font-semibold text-gold-300">
          👑 VIP levels — deposit more, earn more
        </div>
        <ul className="space-y-2">
          {VIP_TIERS.map((t) => (
            <li
              key={t.level}
              className="flex items-center justify-between rounded-xl bg-ink-700 px-3 py-2"
            >
              <span className="font-semibold text-white">VIP {t.level}</span>
              <span className="text-xs text-gray-300">from {formatINR(t.minDeposit)}</span>
              <span className="text-xs font-semibold text-gold-300">{t.perk}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---------- H1d: regulator badge + certificate / plain About ----------

export function RegulatorBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-brand-400/40 bg-brand-500/15 px-2.5 py-1 text-xs font-semibold text-brand-400"
      data-testid="regulator-badge"
    >
      🛡️ {REGULATOR.badge}
    </span>
  );
}

export function Certificate() {
  return (
    <div className="rounded-xl border-2 border-gold-400/60 bg-linear-to-b from-[#fffbeb] to-[#fef3c7] p-4 text-center text-ink-900">
      <div className="text-xs uppercase tracking-[0.2em] text-amber-800">{REGULATOR.name}</div>
      <div className="mt-2 text-lg font-bold">Certificate of Registration</div>
      <div className="mt-1 text-sm">{BRAND.company}</div>
      <div className="mt-3 text-xs">Registration No. {REGULATOR.certificateNo}</div>
      <div className="text-xs">
        Issued {REGULATOR.issued} · Valid till {REGULATOR.validTill}
      </div>
      <div className="mx-auto mt-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-700 text-[10px] font-bold text-amber-800">
        {REGULATOR.short}
        <br />
        SEAL
      </div>
    </div>
  );
}

export function AboutContent({ version }: { version: AppVersion }) {
  const about = version === 'fraud' ? ABOUT.fraud : ABOUT.plain;
  return (
    <div className="space-y-3 text-sm text-gray-300">
      {version === 'fraud' && <Certificate />}
      <ul className="list-disc space-y-1 pl-5">
        {about.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

export function aboutTitle(version: AppVersion): string {
  return version === 'fraud' ? ABOUT.fraud.title : ABOUT.plain.title;
}

// ---------- H1e: withdrawal ticker + testimonials ----------

export function WithdrawalTicker() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % TICKER.length), 2500);
    return () => clearInterval(id);
  }, []);
  const t = TICKER[i];
  return (
    <div
      className="mb-3 flex items-center gap-2 overflow-hidden rounded-xl bg-brand-500/10 px-3 py-2 text-sm"
      data-testid="ticker"
    >
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-brand-400" />
      <span className="shrink-0 text-xs font-semibold text-brand-400">
        {SOCIAL_LABELS.tickerTitle}
      </span>
      <span className="truncate text-gray-200">
        {t.name} withdrew <b className="text-white">{formatINR(t.amount)}</b> · {t.ago}
      </span>
    </div>
  );
}

export function Testimonials() {
  return (
    <div data-testid="testimonials">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="font-semibold text-white">{SOCIAL_LABELS.testimonialsTitle}</div>
        <div className="text-[11px] text-gray-500">{SOCIAL_LABELS.testimonialsNote}</div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {TESTIMONIALS.map((t) => (
          <div
            key={t.name}
            className="w-56 shrink-0 rounded-xl border border-ink-600 bg-[#0f1f1a] p-3 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                {t.initials}
              </span>
              <span className="text-xs font-semibold text-gray-200">{t.name}</span>
            </div>
            <div className="mt-2 rounded-lg rounded-tl-none bg-brand-600/30 px-3 py-2 text-sm text-gray-100">
              {t.text}
            </div>
            <div className="mt-1 text-right text-[10px] text-gray-500">{t.time} ✓✓</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- H1f: mentor chat / plain FAQ ----------

export function ChatMessages() {
  return (
    <div className="space-y-2">
      {CHAT.messages.map((m) => (
        <div key={m} className="flex items-end gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-ink-950">
            {CHAT.agentName[0]}
          </span>
          <div className="rounded-2xl rounded-bl-none bg-ink-700 px-3 py-2 text-sm text-gray-100">
            {m}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Floating mentor bubble with a pop-up preview message; opens the chat sheet. */
export function MentorChat({
  onOpen,
  onPreview,
  static: isStatic = false,
}: {
  onOpen?: () => void;
  onPreview?: () => void;
  /** Survey preview: show the message straight away, no timer */
  static?: boolean;
}) {
  const [preview, setPreview] = useState(isStatic);
  const [open, setOpen] = useState(false);
  const onPreviewRef = useRef(onPreview);
  useEffect(() => {
    onPreviewRef.current = onPreview;
  });

  useEffect(() => {
    if (isStatic) return;
    const show = setTimeout(() => {
      setPreview(true);
      onPreviewRef.current?.();
    }, CHAT.previewDelayMs);
    const hide = setTimeout(() => setPreview(false), CHAT.previewDelayMs + CHAT.previewHideMs);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [isStatic]);

  const bubble = (
    <div className="flex items-end gap-2">
      {preview && (
        <div className="max-w-[220px] rounded-2xl rounded-br-none bg-white px-3 py-2 text-sm text-ink-900 shadow-xl">
          <div className="text-[11px] font-semibold text-emerald-700">
            {CHAT.agentName} · {CHAT.agentRole}
          </div>
          {CHAT.messages[1]}
        </div>
      )}
      <button
        type="button"
        aria-label={`Chat with ${CHAT.agentName}`}
        onClick={() => {
          setOpen(true);
          onOpen?.();
        }}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gold-400 text-2xl shadow-xl"
      >
        💬
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white">
          1
        </span>
      </button>
    </div>
  );

  return (
    <>
      {bubble}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`${CHAT.agentName} · ${CHAT.agentRole}`}
      >
        <ChatMessages />
      </Sheet>
    </>
  );
}

export function FaqContent() {
  return (
    <dl className="space-y-3 text-sm">
      {FAQ.items.map((f) => (
        <div key={f.q}>
          <dt className="font-semibold text-white">{f.q}</dt>
          <dd className="text-gray-300">{f.a}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FaqLink({ onOpen }: { onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="text-sm text-gray-300 underline underline-offset-4"
        onClick={() => {
          setOpen(true);
          onOpen?.();
        }}
      >
        ❔ {FAQ.linkLabel}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={FAQ.linkLabel}>
        <FaqContent />
      </Sheet>
    </>
  );
}
