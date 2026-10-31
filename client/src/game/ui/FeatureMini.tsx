/**
 * Small, static re-renders of each design feature for the S13 quick-reaction cards, in the
 * player's own skin (fraud element, or its honest counterpart).
 */
import { CHAT, ECONOMY, PLANS, TOASTS, TRUST, type Skin } from '../../config/game';
import { formatINR } from '../economy';
import { LiveChart } from './Chart';

export function FeatureMini({ id, skin, total }: { id: string; skin: Skin; total: number }) {
  const fraud = skin === 'fraud';
  const plan = PLANS[1];
  switch (id) {
    case 'timer':
      return fraud ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-2xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-300">
            <span>⏱ Offer ends in 01:59</span>
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-white">
              🔥 Only 3 slots left
            </span>
          </div>
          <div className="rounded-2xl border border-gold-400 bg-gold-400/10 p-3">
            <div className="font-black">{plan.name}</div>
            <div className="neon-text text-2xl font-black">{plan.claim.fraud}</div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="flex justify-between">
            <span className="font-semibold">{plan.name}</span>
            <span className="text-xs text-slate-500">{plan.risk}</span>
          </div>
          <div className="text-sm text-slate-700">{plan.claim.plain}</div>
        </div>
      );
    case 'bonus':
      return fraud ? (
        <div className="flex items-center gap-3 rounded-2xl border border-gold-400/40 bg-gold-400/5 p-3">
          <span className="text-3xl">🎁</span>
          <div>
            <div className="font-black text-gold-300">₹{ECONOMY.signupBonus} sign-up bonus</div>
            <div className="text-xs text-white/70">
              🔒 Locked — unlocks after your first deposit
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 p-3 text-sm">
          <b>₹{ECONOMY.signupBonus} welcome bonus</b> has been added to your Profit wallet.
        </div>
      );
    case 'vip':
      return fraud ? (
        <div className="space-y-1.5">
          {ECONOMY.vipTiers.map((t) => (
            <div
              key={t.level}
              className="flex justify-between rounded-xl bg-white/5 px-3 py-1.5 text-xs"
            >
              <span className="font-black">👑 VIP {t.level}</span>
              <span className="font-bold text-gold-300">{t.perk}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 p-3 text-sm">
          <div className="text-xs text-slate-500">Total invested so far</div>
          <div className="text-xl font-semibold">{formatINR(total)}</div>
        </div>
      );
    case 'regulator':
      return fraud ? (
        <div className="text-center">
          <span className="inline-block rounded-full border border-neon-400/40 bg-neon-500/10 px-3 py-1 text-sm font-bold text-neon-300">
            🛡️ {TRUST.badge}
          </span>
          <div className="mt-2 text-xs text-gold-300">
            ★ {TRUST.rating} · {TRUST.users}
          </div>
          <div className="mx-auto mt-2 w-40 rounded-lg border-2 border-gold-400/70 bg-amber-50 p-2 text-[10px] text-slate-900">
            <div className="font-black">Certificate of Registration</div>
            <div>{TRUST.certificateNo}</div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
          {TRUST.honestAbout[0]}
        </div>
      );
    case 'social':
      return fraud ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-full border border-gold-400/30 bg-black/60 px-3 py-1.5 text-xs">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neon-500 text-[10px] font-black text-black">
              ✓
            </span>
            {TOASTS[0]}
          </div>
          <div className="rounded-lg rounded-tl-none bg-[#005c4b] px-3 py-2 text-sm">
            Withdrawal of ₹12,400 came in 10 mins!! 🙏
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 p-2">
          <LiveChart skin="plain" rate={0.06} seed={7} ms={0} running={false} height={70} />
        </div>
      );
    case 'chat':
      return fraud ? (
        <div className="flex items-end gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-400 text-sm font-black text-black">
            R
          </span>
          <div>
            <div className="text-[10px] text-white/50">
              {CHAT.agentName} · {CHAT.agentRole}
            </div>
            <div className="rounded-2xl rounded-bl-none bg-[#1f2c33] px-3 py-2 text-sm">
              {CHAT.messages[1]}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 p-3 text-sm">
          <div className="font-semibold">{CHAT.help.items[0].q}</div>
          <div className="text-slate-600">{CHAT.help.items[0].a}</div>
        </div>
      );
    case 'tax':
      return fraud ? (
        <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-3 text-center">
          <div className="text-xs font-black text-red-300">⚠️ WITHDRAWAL ON HOLD</div>
          <div className="text-sm">Pay 10% processing tax to unlock your balance</div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 p-3 text-center text-sm">
          <div className="text-2xl">✅</div>
          Withdrawal processed
        </div>
      );
    default:
      return null;
  }
}
