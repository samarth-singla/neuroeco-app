import { FAQ, PLANS, TEXT } from '../config/session';
import type { FeatureId } from '../config/survey';
import type { AppVersion } from '../types';
import { feeFor, FeeBlockCard, PlainWithdrawalDone } from '../screens/app/A9FinalWithdrawal';
import {
  AboutContent,
  BonusCard,
  ChatMessages,
  FaqContent,
  MentorChat,
  PlainPlanNote,
  PlainWelcomeCard,
  PlanCard,
  RegulatorBadge,
  Testimonials,
  UrgencyBanner,
  VipTiers,
  WithdrawalTicker,
} from './elements';

function PlanList({ version }: { version: AppVersion }) {
  return (
    <div className="space-y-2">
      {PLANS.map((p) => (
        <PlanCard key={p.id} plan={p} version={version} />
      ))}
    </div>
  );
}

/**
 * Re-renders one app element from the participant's own version for the UI/UX survey:
 * fraud participants see the dark-design feature, plain participants its neutral counterpart.
 */
export function FeaturePreview({
  feature,
  version,
  withdrawAmount,
  fee,
}: {
  feature: FeatureId;
  version: AppVersion;
  /** The participant's own A9 amounts, so the preview matches what they saw */
  withdrawAmount?: number;
  fee?: number;
}) {
  const fraud = version === 'fraud';
  const amount = withdrawAmount && withdrawAmount > 0 ? withdrawAmount : 2000;

  switch (feature) {
    case 'timer':
      return fraud ? (
        <div>
          <UrgencyBanner />
          <PlanCard plan={PLANS[1]} version="fraud" />
        </div>
      ) : (
        <div>
          <PlanCard plan={PLANS[1]} version="plain" />
          <PlainPlanNote />
        </div>
      );
    case 'bonus':
      return fraud ? <BonusCard /> : <PlainWelcomeCard text={TEXT.A1.intro} />;
    case 'vip':
      return fraud ? <VipTiers /> : <PlanList version="plain" />;
    case 'regulator':
      return fraud ? (
        <div className="space-y-3">
          <RegulatorBadge />
          <AboutContent version="fraud" />
        </div>
      ) : (
        <AboutContent version="plain" />
      );
    case 'social':
      return fraud ? (
        <div>
          <WithdrawalTicker />
          <Testimonials />
        </div>
      ) : (
        <div>
          <PlanList version="plain" />
          <PlainPlanNote />
        </div>
      );
    case 'chat':
      return fraud ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <MentorChat static />
          </div>
          <ChatMessages />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-center text-sm text-gray-300 underline underline-offset-4">
            ❔ {FAQ.linkLabel}
          </div>
          <FaqContent />
        </div>
      );
    case 'withdrawal_tax':
      return fraud ? (
        <FeeBlockCard fee={fee ?? feeFor(amount)} />
      ) : (
        <PlainWithdrawalDone amount={amount} />
      );
  }
}
