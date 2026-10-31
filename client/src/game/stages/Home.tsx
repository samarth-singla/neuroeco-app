import { useEffect, useState } from 'react';
import {
  ECONOMY,
  PLAN_DETAILS,
  PLANS,
  TERMS,
  TESTIMONIALS,
  TIMING,
  type Skin,
} from '../../config/game';
import { useDecisionTimer, useLog } from '../../lib/useLog';
import { formatINR } from '../economy';
import { useGame } from '../GameProvider';
import { nextStep } from '../steps';
import { LiveChart } from '../ui/Chart';
import { GameShell } from '../ui/GameShell';
import { Countdown, CtaButton, InfoLink, Money, Panel, Sheet, SkipButton, Title } from '../ui/kit';

/** "Members earned today" ticking up every couple of seconds (fraud skin). */
function LiveEarned() {
  const [v, setV] = useState(482000);
  useEffect(() => {
    const id = setInterval(() => setV((x) => x + 100 + Math.round(Math.random() * 800)), 2200);
    return () => clearInterval(id);
  }, []);
  return <Money value={v} className="gold-text text-4xl font-black" />;
}

export function VipLadder({ total }: { total: number }) {
  return (
    <Panel skin="fraud" className="border-gold-400/40" glow>
      <div className="flex items-center justify-between">
        <div className="gold-text text-lg font-black">👑 VIP ladder</div>
        <div className="text-[10px] text-white/50">Deposited {formatINR(total)}</div>
      </div>
      <ul className="mt-2 space-y-1.5">
        {ECONOMY.vipTiers.map((t) => {
          const reached = total >= t.minDeposited;
          return (
            <li
              key={t.level}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${reached ? 'bg-gold-400/20' : 'bg-white/5'}`}
            >
              <span className="font-black">
                {reached ? '✅' : '🔒'} VIP {t.level}
              </span>
              <span className="text-xs text-white/60">from {formatINR(t.minDeposited)}</span>
              <span className="text-xs font-bold text-gold-300">{t.perk}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function Testimonials() {
  return (
    <div data-testid="testimonials">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="font-black">💬 Member screenshots</div>
        <div className="text-[10px] text-white/40">Real withdrawals*</div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {TESTIMONIALS.map((t) => (
          <div
            key={t.name}
            className="w-56 shrink-0 rounded-xl border border-white/10 bg-[#0b141a] p-3 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neon-500 text-[10px] font-black text-black">
                {t.initials}
              </span>
              <span className="text-xs font-bold">{t.name}</span>
            </div>
            <div className="mt-2 rounded-lg rounded-tl-none bg-[#005c4b] px-3 py-2 text-sm">
              {t.text}
            </div>
            <div className="mt-1 text-right text-[10px] text-white/40">{t.time} ✓✓</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Urgency({ onReset }: { onReset?: () => void }) {
  return (
    <div
      className="flex items-center justify-between rounded-2xl bg-red-500/15 px-3 py-2 text-sm font-bold text-red-300"
      data-testid="urgency"
    >
      <span>
        ⏱ Offer ends in <Countdown seconds={TIMING.offerCountdownSec} onReset={onReset} />
      </span>
      <span className="animate-blink rounded-full bg-red-500 px-2 py-0.5 text-[11px] text-white">
        🔥 Only 3 slots left
      </span>
    </div>
  );
}

function PlanCard({
  skin,
  plan,
  selected,
  onSelect,
  onDetails,
}: {
  skin: Skin;
  plan: (typeof PLANS)[number];
  selected: boolean;
  onSelect: () => void;
  onDetails: () => void;
}) {
  const fraud = skin === 'fraud';
  return (
    <div
      className={
        fraud
          ? `rounded-2xl border p-3 transition ${selected ? 'border-gold-400 bg-gold-400/10 shadow-[0_0_25px_rgba(251,191,36,0.35)]' : 'border-white/10 bg-white/5'}`
          : `rounded-xl border p-3 ${selected ? 'border-slate-900 bg-white ring-2 ring-slate-900' : 'border-slate-200 bg-white'}`
      }
    >
      <button type="button" onClick={onSelect} aria-pressed={selected} className="w-full text-left">
        <div className="flex items-center justify-between">
          <span className={fraud ? 'font-black' : 'font-semibold'}>{plan.name}</span>
          {fraud && plan.id === 'growth' && (
            <span className="rounded-full bg-gold-400 px-2 py-0.5 text-[10px] font-black text-black">
              MOST POPULAR
            </span>
          )}
          {!fraud && <span className="text-xs text-slate-500">{plan.risk}</span>}
        </div>
        <div
          className={fraud ? 'neon-text mt-1 text-3xl font-black' : 'mt-1 text-sm text-slate-700'}
        >
          {plan.claim[skin]}
        </div>
      </button>
      <div className="mt-1 text-right">
        <InfoLink skin={skin} onClick={onDetails}>
          Details
        </InfoLink>
      </div>
    </div>
  );
}

/**
 * S3 — Home dashboard (the hook). Choose a plan and invest, or skip. Decision time = first render
 * → first Invest/Skip tap (H1). Fraud adds: locked bonus (H1b), countdown + slots (H1a), VIP ladder
 * (H1c), badge/rating (header, H1d), ticker/toasts/testimonials (H1e).
 */
export function Home() {
  const { game, skin, dispatch, go } = useGame();
  const step = game.step;
  const log = useLog(step);
  const decide = useDecisionTimer();
  const fraud = skin === 'fraud';
  const [planId, setPlanId] = useState<string | null>(game.planId);
  const [sheet, setSheet] = useState<null | 'tnc' | 'plan'>(null);

  function choose(choice: 'invest' | 'skip') {
    const { decision_ms } = decide();
    dispatch({
      type: 's3_decide',
      choice,
      planId: choice === 'invest' ? planId : null,
      decisionMs: decision_ms,
    });
    go(nextStep(step));
  }

  const actions = (
    <>
      {!fraud && <p className="pb-1 text-xs text-slate-600">{TERMS.text}</p>}
      <CtaButton skin={skin} disabled={!planId} onClick={() => choose('invest')}>
        {planId ? (fraud ? 'INVEST NOW 🚀' : 'Invest in this plan') : 'Select a plan'}
      </CtaButton>
      <SkipButton skin={skin} onClick={() => choose('skip')}>
        Skip for now
      </SkipButton>
    </>
  );

  return (
    <GameShell actions={actions}>
      <div className="space-y-3">
        {fraud ? (
          <div className="text-center">
            <div className="text-xs font-bold text-white/60 uppercase">Members earned today</div>
            <LiveEarned />
            <div className="mt-1 text-xs text-neon-300">▲ +312% average monthly return</div>
          </div>
        ) : (
          <Title skin={skin} sub="Pick a plan to trade with in the next rounds, or skip.">
            Your practice account
          </Title>
        )}

        {fraud ? (
          <Panel skin={skin} className="border-gold-400/40 bg-gold-400/5">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🎁</div>
              <div className="flex-1">
                <div className="font-black text-gold-300">₹{ECONOMY.signupBonus} sign-up bonus</div>
                <div className="text-xs text-white/70">
                  🔒 Locked — unlocks after your first deposit
                </div>
              </div>
            </div>
          </Panel>
        ) : (
          <Panel skin={skin}>
            <div className="text-sm">
              <span className="font-semibold">₹{ECONOMY.signupBonus} welcome bonus</span> has been
              added to your Profit wallet.
            </div>
          </Panel>
        )}

        {fraud && <Urgency onReset={() => log('timer_reset')} />}

        <div
          className={
            fraud
              ? 'rounded-2xl bg-black/30 p-2'
              : 'rounded-xl border border-slate-200 bg-white p-2'
          }
        >
          <LiveChart skin={skin} rate={0.06} seed={7} ms={0} running={false} height={90} />
        </div>

        <div className="space-y-2">
          {PLANS.map((p) => (
            <PlanCard
              key={p.id}
              skin={skin}
              plan={p}
              selected={planId === p.id}
              onSelect={() => {
                setPlanId(p.id);
                log('plan_select', { plan_id: p.id });
              }}
              onDetails={() => {
                setSheet('plan');
                dispatch({ type: 'verify', what: 'plan_details' });
              }}
            />
          ))}
        </div>

        {fraud && <VipLadder total={game.totalDeposited} />}
        {fraud && <Testimonials />}

        <div className="text-center">
          <InfoLink
            skin={skin}
            onClick={() => {
              setSheet('tnc');
              dispatch({ type: 'verify', what: 'tnc' });
            }}
          >
            {fraud ? 'T&C apply' : 'Terms and risks'}
          </InfoLink>
        </div>
      </div>

      <Sheet
        skin={skin}
        open={sheet === 'tnc'}
        onClose={() => setSheet(null)}
        title="Terms & conditions"
      >
        <p className="text-sm">{TERMS.text}</p>
      </Sheet>
      <Sheet
        skin={skin}
        open={sheet === 'plan'}
        onClose={() => setSheet(null)}
        title="Plan details"
      >
        <p className="text-sm">{PLAN_DETAILS}</p>
      </Sheet>
    </GameShell>
  );
}
