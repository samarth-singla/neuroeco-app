import { CHAT, OUTCOMES, PLANS, TEXT } from '../../config/session';
import { AppShell } from '../../components/AppShell';
import { Card, ScreenTitle } from '../../components/ui';
import { AmountInput, DepositButtons, useAmount } from '../../features/DepositForm';
import { FaqLink, MentorChat } from '../../features/elements';
import { useLog } from '../../lib/useLog';
import { applyAll, formatINR, type WalletAction } from '../../lib/wallet';
import { useStudy, type Change } from '../../state/study';
import type { Step } from '../../types';

type Round = 1 | 2 | 3;

const SCREEN_OF: Record<Round, 'A3' | 'A5' | 'A7'> = { 1: 'A3', 2: 'A5', 3: 'A7' };

/**
 * A3 (round 1, H1/H2), A5 (round 2, H2 + mentor chat H1f), A7 (post-withdrawal, H6).
 * Same screen for both versions, except the fraud version's mentor chat on A5 and A7
 * (plain version shows a neutral Help/FAQ link instead).
 */
export function DepositScreen({ round }: { round: Round }) {
  const { state, version, go } = useStudy();
  const screen = SCREEN_OF[round];
  const log = useLog(screen);
  const text = TEXT[screen];
  const plan = PLANS.find((p) => p.id === state.session.planId);
  const showChat = round >= 2;
  const field = useAmount(state.wallet.cash);

  function finish(amount: number) {
    log('deposit_submit', { round, amount, plan_id: state.session.planId ?? null });
    const deposit: WalletAction[] = amount > 0 ? [{ type: 'deposit', amount }] : [];
    const w = state.wallet;
    let next: Step;
    let change: Change;

    if (round === 1) {
      // Deposit, then apply the scripted round-1 result (H2) on the way to A4.
      const rate = OUTCOMES.round1Rate[state.assignment.round1_outcome];
      const before = applyAll(w, deposit);
      const after = applyAll(before, [{ type: 'apply_return', rate }]);
      next = 'app:A4';
      change = {
        wallet: [...deposit, { type: 'apply_return', rate }],
        session: { r1: amount, r1Gain: after.appBalance - before.appBalance },
      };
    } else if (round === 2) {
      next = 'app:A6';
      change = { wallet: deposit, session: { r2: amount } };
    } else {
      // Apply the scripted market correction (H4) on the way to A8.
      const before = applyAll(w, deposit);
      const after = applyAll(before, [{ type: 'apply_return', rate: OUTCOMES.lossRate }]);
      next = 'app:A8';
      change = {
        wallet: [...deposit, { type: 'apply_return', rate: OUTCOMES.lossRate }],
        session: { r3: amount, lossAmount: before.appBalance - after.appBalance },
      };
    }
    go(next, change);
  }

  const floating = showChat ? (
    version === 'fraud' ? (
      <MentorChat
        onPreview={() => log('chat_preview_shown', { message: CHAT.messages[1] })}
        onOpen={() => log('chat_open', { kind: 'mentor' })}
      />
    ) : undefined
  ) : undefined;

  return (
    <AppShell
      wallet={state.wallet}
      version={version}
      nav="wallet"
      floating={floating}
      actions={
        <DepositButtons
          field={field}
          confirmLabel={text.confirm}
          skipLabel={text.skip}
          onConfirm={finish}
          onSkip={() => finish(0)}
        />
      }
    >
      <ScreenTitle title={text.title} subtitle={text.subtitle} />
      {plan && (
        <Card className="mb-4">
          <div className="text-xs text-gray-400">Selected plan</div>
          <div className="font-semibold text-white">
            {plan.name} · <span className="text-brand-400">{plan.returnText}</span>
          </div>
          {state.wallet.appBalance > 0 && (
            <div className="mt-1 text-xs text-gray-400">
              Current value in app: {formatINR(state.wallet.appBalance)}
            </div>
          )}
        </Card>
      )}
      <AmountInput field={field} />
      {showChat && version === 'plain' && (
        <div className="mt-6 text-center">
          <FaqLink onOpen={() => log('chat_open', { kind: 'faq' })} />
        </div>
      )}
      {/* room so the floating chat bubble can be scrolled clear of the content */}
      {showChat && version === 'fraud' && <div className="h-36" />}
    </AppShell>
  );
}
