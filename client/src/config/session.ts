/**
 * All amounts, percentages and texts used in the app session (screens A1–A10).
 * Edit here to change the study; components read from this file.
 *
 * Rules (IMPLEMENTATION_PLAN.md §0.3): fictional app and regulator names only,
 * virtual money only, all testimonials/ticker/chat content is synthetic.
 *
 * This file must stay pure data (no React, no browser APIs): the server and the
 * simulation script import it too.
 */

export const BRAND = {
  appName: 'Dhanoura',
  tagline: 'Grow your money, one cycle at a time',
  company: 'Dhanoura Digital Pvt. Ltd. (fictional)',
};

export const RESEARCH_FOOTER = 'Research prototype — no real money is used.';

export const WALLET = {
  /** Practice balance every participant starts with. All deposits come from it. */
  startingCash: 10000,
  /** Quick-pick amounts on deposit screens */
  quickAmounts: [500, 1000, 2000, 5000],
  /** Smallest non-zero deposit */
  minDeposit: 100,
};

/** Fictional regulator (H1d). Never use a real regulator's name. */
export const REGULATOR = {
  name: 'National Digital Investment Authority',
  short: 'NDIA',
  badge: 'NDIA Certified',
  certificateNo: 'NDIA/DIP/2024/04571',
  issued: '12 March 2024',
  validTill: '11 March 2027',
};

export interface Plan {
  id: string;
  name: string;
  returnText: string;
  cycle: string;
  risk: string;
}

// DECISION: plans differ only in what they state; every plan gets the same scripted outcome
// (see OUTCOMES), so "plan" is a choice we log, not something that changes returns.
export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    returnText: 'up to 8% per cycle',
    cycle: '1-day cycle',
    risk: 'Medium risk',
  },
  {
    id: 'growth',
    name: 'Growth',
    returnText: 'up to 10% per cycle',
    cycle: '1-day cycle',
    risk: 'High risk',
  },
  {
    id: 'premium',
    name: 'Premium',
    returnText: 'up to 12% per cycle',
    cycle: '1-day cycle',
    risk: 'High risk',
  },
];

export const PLAIN_PLAN_NOTE =
  'Returns are not guaranteed. You can lose part or all of the money you put in.';

/** Scripted outcomes. Identical in both app versions (only presentation differs). */
export const OUTCOMES = {
  /** H2: round-1 result, by `round1_outcome` */
  round1Rate: { small_win: 0.08, flat: 0 } as Record<'small_win' | 'flat', number>,
  /** H6: amount of the small test withdrawal when `withdrawal_offer = allowed` */
  smallWithdrawal: 200,
  /** H4: scripted market correction on A8 */
  lossRate: -0.3,
  /** H1g: "processing tax" asked to unlock the final withdrawal (fraud version only) */
  feeRate: 0.1,
};

/** H1b: sign-up bonus (fraud version only) */
export const BONUS = {
  amount: 500,
  title: 'Welcome bonus credited!',
  body: '₹500 has been added to your wallet. It becomes withdrawable after your first deposit.',
  lockedLabel: 'Bonus (locked)',
};

/** H1c: VIP tiers (fraud version only). Shown as perks; they do not change the scripted outcome. */
export const VIP_TIERS = [
  { level: 1, minDeposit: 1000, perk: '+0.5% daily bonus' },
  { level: 2, minDeposit: 3000, perk: '+1% daily bonus' },
  { level: 3, minDeposit: 6000, perk: '+2% daily bonus + priority withdrawals' },
];

/** H1a: countdown and scarcity (fraud version only) */
export const URGENCY = {
  timerSeconds: 180,
  timerLabel: 'Offer ends in',
  resetLabel: 'New slots opening…',
  resetPauseSeconds: 3,
  slotsText: 'Only 3 slots left',
};

/** H1e: synthetic social proof (fraud version only). Masked, made-up names; no real people. */
export const TICKER = [
  { name: 'R***t K.', amount: 4250, ago: '2 min ago' },
  { name: 'P***a S.', amount: 12800, ago: '3 min ago' },
  { name: 'A***n M.', amount: 2100, ago: '5 min ago' },
  { name: 'S***i R.', amount: 7600, ago: '6 min ago' },
  { name: 'V***k J.', amount: 15400, ago: '8 min ago' },
  { name: 'N***a D.', amount: 3300, ago: '9 min ago' },
];

export const TESTIMONIALS = [
  {
    initials: 'MK',
    name: 'M*** K.',
    text: 'Withdrawal of ₹12,400 came in 10 mins!! Best app 🙏',
    time: '10:42 AM',
  },
  {
    initials: 'RS',
    name: 'R*** S.',
    text: 'VIP 2 is worth it. Made back my deposit in a week 💰',
    time: '9:15 AM',
  },
  {
    initials: 'AP',
    name: 'A*** P.',
    text: 'Was scared at first but got my money every day 😍',
    time: 'Yesterday',
  },
];

export const SOCIAL_LABELS = {
  tickerTitle: 'Live withdrawals',
  testimonialsTitle: 'What members say',
  testimonialsNote: 'Screenshots shared by members',
};

/** H1f: mentor / customer-service chat (fraud version, A5 and A7) */
export const CHAT = {
  agentName: 'Asha',
  agentRole: 'Success Mentor',
  previewDelayMs: 1500,
  /** The preview message collapses back into the chat button after this long */
  previewHideMs: 7000,
  messages: [
    'Hi 👋 I am your personal success mentor.',
    'Most members upgrade to VIP 2 today.',
    'VIP 2 starts at ₹3,000 total deposit and earns +1% daily bonus. Shall I help you upgrade? 😊',
  ],
};

/** Plain counterpart of the chat: a neutral help link */
export const FAQ = {
  linkLabel: 'Help & FAQ',
  items: [
    { q: 'Are returns guaranteed?', a: 'No. The value of your investment can go up or down.' },
    { q: 'Can I withdraw?', a: 'Withdrawals are processed to your practice balance.' },
    { q: 'Is there a fee?', a: 'There are no deposit or withdrawal fees.' },
  ],
};

/** "About / Verify" page (A2). Plain: neutral company info. Fraud: fictional certificate. */
export const ABOUT = {
  linkLabel: 'About / Verify',
  plain: {
    title: `About ${BRAND.appName}`,
    lines: [
      'Dhanoura is a practice investment app made for this study.',
      'Company: Dhanoura Digital Pvt. Ltd. (fictional).',
      'Registered office: 4th floor, Example Towers, Pune (fictional address).',
      'Before investing in any real app, check whether it is registered with the official regulator.',
    ],
  },
  fraud: {
    title: 'Certified & Regulated',
    lines: [
      'Dhanoura is certified by the National Digital Investment Authority (NDIA).',
      'Your funds are 100% protected under NDIA guidelines.',
      'Trusted by 2,00,000+ members across India.',
    ],
  },
};

/** Screen texts */
export const TEXT = {
  A1: {
    title: `Welcome to ${BRAND.appName}`,
    intro:
      'This is a practice investment app. You have a practice balance of ₹10,000. You can choose to use it in the app — or not. Nothing you do here involves real money.',
    cta: 'Continue',
  },
  A2: {
    title: 'Investment plans',
    subtitle: 'Choose a plan to invest in, or continue without investing.',
    investCta: 'Invest in this plan',
    exitCta: 'Continue without investing',
  },
  A3: {
    title: 'Make a deposit',
    subtitle: 'How much of your practice balance do you want to invest?',
    confirm: 'Invest',
    skip: "Don't invest",
  },
  A4: {
    title: 'Cycle 1 result',
    small_win: 'Your plan earned +8% this cycle.',
    flat: 'Your plan earned 0% this cycle.',
    noInvestment: "You didn't invest this cycle.",
    cta: 'Continue',
  },
  A5: {
    title: 'Invest again?',
    subtitle: 'You can add more to your plan for the next cycle.',
    confirm: 'Invest',
    skip: 'Not now',
  },
  A6: {
    title: 'Your portfolio',
    withdrawTitle: 'Try a withdrawal',
    withdrawBody: 'You can withdraw a small amount to your practice balance.',
    withdrawCta: 'Withdraw',
    withdrawSkip: 'Skip',
    withdrawDone: 'Withdrawal successful! The money is back in your practice balance.',
    nothingToWithdraw: 'You have no balance in the app to withdraw.',
    cta: 'Continue',
  },
  A7: {
    title: 'Add more?',
    subtitle: 'You can add more to your plan for the next cycle.',
    confirm: 'Invest',
    skip: 'Not now',
  },
  A8: {
    title: 'Market correction',
    body: 'The market fell 30% this cycle. Your plan value dropped.',
    topupCta: 'Top up to recover',
    leaveCta: 'Leave',
    topupConfirm: 'Add',
    topupCancel: 'Cancel',
  },
  A9: {
    title: 'Withdraw your balance',
    body: 'The session is ending. You can withdraw your app balance to your practice balance.',
    withdrawCta: 'Withdraw',
    keepCta: 'Leave it in the app',
    plainDone: 'Withdrawal processed. The money is back in your practice balance.',
    nothingToWithdraw: 'You have no balance in the app to withdraw.',
    lockedBonus: 'Your locked bonus could not be withdrawn because you made no deposit.',
    blockedTitle: 'Withdrawal on hold',
    blockedBody:
      'To unlock your balance, a one-time 10% processing tax must be paid from your practice balance.',
    payCta: 'Pay fee',
    declineCta: "Don't pay",
    paidMsg: 'Fee received. Your withdrawal is under review.',
    declinedMsg: 'Your balance remains locked.',
    cta: 'Continue',
  },
  A10: {
    title: 'Session complete',
    body: 'Thank you! The app part is over. Next, a few questions about what you saw.',
    cta: 'Continue to survey',
  },
};
