/**
 * ZenTrade game: every number, timing, text and list the game uses. Edit here to tune the study;
 * components and the economy read from this file.
 *
 * Pure data only (no React, no browser APIs): the server and the simulation script import it.
 *
 * Skins: `fraud` = "ZenTrade X" (dark-design layer on), `plain` = honest "ZenTrade".
 * The skin is stored in the existing `app_version` column (plain | fraud).
 * Research simulation: virtual money only, fictional app, regulator ("NDIA") and people.
 */

export type Skin = 'plain' | 'fraud';

/**
 * Which flow a normal study link runs. While the game is being built it is reached with `?game=1`;
 * set to true to make the game the default (the old survey flow is then only reachable with
 * `?game=0`).
 */
export const GAME_IS_DEFAULT = false;

export const APP_NAME: Record<Skin, string> = { fraud: 'ZenTrade X', plain: 'ZenTrade' };
export const APP_TAGLINE: Record<Skin, string> = {
  fraud: 'India’s #1 smart earning app',
  plain: 'Practice trading, clearly explained',
};

// ---------------------------------------------------------------------------------------------
// Economy (identical in both skins)
// ---------------------------------------------------------------------------------------------

export const ECONOMY = {
  /** Demo cash every player starts with, in the Main wallet */
  startingMain: 10000,
  /** Sign-up bonus. Fraud: locked until the first deposit (H1b). Honest: credited to Profit at once. */
  signupBonus: 500,
  /** Smallest non-zero amount for any investment */
  minInvest: 100,
  /** Quick-pick chips on amount pickers */
  quickAmounts: [500, 1000, 2000, 5000],

  /** Trading rounds (H2). Returns are scripted; round 1 depends on `round1_outcome`. */
  rounds: {
    count: 6,
    round1: { small_win: 0.08, flat: 0 } as Record<'small_win' | 'flat', number>,
    /** Rounds 2–6, net positive */
    later: { 2: 0.06, 3: -0.04, 4: 0.1, 5: 0.05, 6: 0.07 } as Record<number, number>,
    /** Length of the chart animation after Invest/Skip */
    chartMs: 2600,
  },
  /**
   * Paid to the Profit wallet after round 6 in both skins, so every player has at least ₹2,000 of
   * profit when the H7 reinvest offer arrives (the profit framing needs it).
   */
  // DECISION: a fixed "6-round streak reward" guarantees the Profit wallet can fund the H7 offer.
  streakReward: 2000,
  /** Brain bonus: added to the Profit wallet per correct answer (S5) */
  brainReward: 100,

  /** VIP ladder (fraud display only). Perks are promises; real returns are identical (H1c). */
  vipTiers: [
    { level: 1, minDeposited: 1000, perk: 'up to 1.5× returns' },
    { level: 2, minDeposited: 5000, perk: 'up to 3× returns' },
    { level: 3, minDeposited: 10000, perk: 'up to 5× returns + instant withdrawals' },
  ],
  /** Reaching this VIP level counts as the "VIP upgrade" trap (computed in both skins) */
  vipUpgradeLevel: 2,

  /** Flash deals (H3): three sizes, one at a time, order randomized per player. Settle at once. */
  deals: { sizes: [500, 3000, 8000], rate: 0.05 },
  /** Diamond Pool (H5): entry moves from Main to the locked Portfolio */
  poolEntry: 2000,
  /** Test withdrawal (H6) from the Main wallet */
  testWithdrawal: 500,
  /** Largest deposit offered right after the withdrawal stage (keeps ₹2,000+ in Main for S10) */
  postWithdrawalMax: 5000,
  /** Gold Plan reinvest offer (H7) */
  reinvest: { amount: 2000, step: 100 },
  /** Market crash (H4): Main wallet and Portfolio drop by this rate; Profit is untouched */
  crashRate: -0.4,
  /** Withdrawal "processing tax" (fraud only, H1g) */
  taxRate: 0.1,
  /** A deposit within this time after the mentor chat / help card counts as a chat deposit (H1f) */
  chatDepositWindowMs: 60000,
};

/** Bonus spins (H4): 50% lose ₹100, 50% win X. Results are revealed only on the report card. */
export const SPINS = { loss: 100, gains: [50, 100, 150, 200, 250, 300] };

/** Optional prize draw. Switch on only with instructor approval (consent then states the rules). */
export const PRIZE_DRAW = {
  enabled: false,
  rupeesPerTicket: 1000,
  rules:
    'Optional prize draw: at the end you get one ticket for every ₹1,000 of final balance and a random code. Keep the code; the research team draws winning codes after the study. No contact details are collected.',
};

// ---------------------------------------------------------------------------------------------
// Timing (identical in both skins)
// ---------------------------------------------------------------------------------------------

export const TIMING = {
  /** Countdown on plans / deals; resets at zero and never blocks */
  offerCountdownSec: 120,
  /** Crash "recover in 10 minutes" countdown (fraud text; resets, never blocks) */
  crashCountdownSec: 600,
  /** Account-freeze countdown on the tax screen (fraud) */
  freezeCountdownSec: 1800,
  /** Winner toast interval range (fraud) */
  toastMinMs: 4000,
  toastMaxMs: 7000,
  toastVisibleMs: 3200,
  /** Mentor chat typing delay per message */
  chatTypingMs: 1100,
  /** Brain-bonus timer ring (visual only, restarts) */
  brainRingSec: 20,
};

// ---------------------------------------------------------------------------------------------
// Plans on the home dashboard (S3). Payoff is the scripted round result for every plan.
// ---------------------------------------------------------------------------------------------

export interface GamePlan {
  id: string;
  name: string;
  claim: Record<Skin, string>;
  risk: string;
}

export const PLANS: GamePlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    claim: { fraud: '+120% monthly', plain: 'Expected −5% to +8% per round' },
    risk: 'Medium risk',
  },
  {
    id: 'growth',
    name: 'Growth',
    claim: { fraud: '+312% monthly', plain: 'Expected −8% to +10% per round' },
    risk: 'High risk',
  },
  {
    id: 'turbo',
    name: 'Turbo',
    claim: { fraud: '+580% monthly 🔥', plain: 'Expected −12% to +12% per round' },
    risk: 'Very high risk',
  },
];

export const PLAN_DETAILS =
  'All plans follow the same market. Returns are not guaranteed and you can lose money. Money invested in a round is returned after the round together with any gain or loss.';

// ---------------------------------------------------------------------------------------------
// Fraud-skin social proof and pressure (fictional people only)
// ---------------------------------------------------------------------------------------------

export const TOASTS = [
  'Priya from Pune just withdrew ₹12,400 💸',
  'Arjun upgraded to VIP 3 👑',
  'Sneha from Jaipur earned ₹8,250 today',
  'Imran from Lucknow withdrew ₹23,000 💸',
  'Kavya just joined the Diamond Pool 💎',
  'Vikram from Surat earned ₹4,90,000 this month 🚀',
  'Meera upgraded to VIP 2 👑',
  'Aditya from Bhopal withdrew ₹6,700 💸',
];

export const TICKER = [
  'R***t withdrew ₹4,250',
  'P***a withdrew ₹12,800',
  'A***n withdrew ₹2,100',
  'S***i withdrew ₹7,600',
  'V***k withdrew ₹15,400',
  'N***a withdrew ₹3,300',
  'K***l withdrew ₹9,900',
];

export const TESTIMONIALS = [
  {
    initials: 'MK',
    name: 'M*** K.',
    text: 'Withdrawal of ₹12,400 came in 10 mins!! 🙏',
    time: '10:42 AM',
  },
  {
    initials: 'RS',
    name: 'R*** S.',
    text: 'VIP 2 is worth it, made back my deposit in a week 💰',
    time: '9:15 AM',
  },
  {
    initials: 'AP',
    name: 'A*** P.',
    text: 'Was scared at first but money comes every day 😍',
    time: 'Yesterday',
  },
];

export const TRUST = {
  badge: 'NDIA Certified',
  regulator: 'National Digital Investment Authority',
  certificateNo: 'NDIA/DIP/2024/04571',
  users: '10 lakh+ users',
  rating: '4.9',
  /** Honest skin's neutral "About" text (no certification claims) */
  honestAbout: [
    'ZenTrade is a practice trading game made for this study.',
    'It is not registered with any regulator. Before using a real investing app, check its registration on the official regulator’s website.',
  ],
  fraudAbout: [
    'ZenTrade X is certified by the National Digital Investment Authority (NDIA).',
    'Your funds are 100% protected under NDIA guidelines.',
    'Trusted by 10 lakh+ members across India.',
  ],
};

export const TERMS = {
  short: 'T&C',
  text: 'Returns are not guaranteed. Past results do not predict future results. You may lose some or all of the money you invest. Deposits may be locked. Withdrawals may be subject to processing fees and verification.',
};

// ---------------------------------------------------------------------------------------------
// Mentor chat (S6) — fraud: advisor; honest: help card
// ---------------------------------------------------------------------------------------------

export const CHAT = {
  agentName: 'Rohit Sir',
  agentRole: 'Senior Advisor',
  notice: 'Rohit Sir sent you a message',
  messages: [
    'Namaste 🙏 I am Rohit, your Senior Advisor.',
    'Most members upgrade to VIP 2 today.',
    'Only 2 VIP seats left in my group.',
    'Invest in the next round and I will personally guide your trades 📈',
  ],
  help: {
    title: 'Help & FAQ',
    notice: 'Tips for the next rounds',
    items: [
      { q: 'Are returns guaranteed?', a: 'No. Each round can go up or down.' },
      {
        q: 'How much should I invest?',
        a: 'Only what you are comfortable losing. Skipping is fine.',
      },
      { q: 'Are there fees?', a: 'There are no deposit or withdrawal fees.' },
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Flash deals (S7, H3) and pool invite (S8, H5)
// ---------------------------------------------------------------------------------------------

export const DEALS: Record<number, { name: string; claim: Record<Skin, string> }> = {
  500: {
    name: 'Mini Flash',
    claim: { fraud: '+25% in 24 hours', plain: 'Target +5%, not guaranteed' },
  },
  3000: {
    name: 'Silver Flash',
    claim: { fraud: '+40% in 24 hours', plain: 'Target +5%, not guaranteed' },
  },
  8000: {
    name: 'Platinum Flash',
    claim: { fraud: '+75% in 24 hours', plain: 'Target +5%, not guaranteed' },
  },
};

export const DEAL_DETAILS =
  'Settles at the end of the deal window. The return is not guaranteed and the full amount can be lost. Your money is locked until the deal settles.';

export const POOL = {
  name: 'Diamond Pool',
  friend: {
    from: 'Rahul (college friend)',
    message: 'bro I made ₹4k yesterday, join my pool 🔥',
  },
  ad: {
    label: 'Sponsored',
    message: 'Diamond Pool members made ₹4,000 yesterday. Join now 🔥',
  },
  details:
    'Your ₹2,000 entry is locked in the pool until the season ends. Pool returns depend on new members joining. The entry can be lost.',
};

// ---------------------------------------------------------------------------------------------
// Profile (S1), brain bonus (S5) and quick reactions (S13) — stored in `responses`
// ---------------------------------------------------------------------------------------------

export interface ChoiceQ {
  id: string;
  kind: 'choice';
  text: string;
  options: { value: string; label: string }[];
}
export interface ScaleQ {
  id: string;
  kind: 'scale';
  text: string;
  minLabel: string;
  maxLabel: string;
}
export interface NumberQ {
  id: string;
  kind: 'number';
  text: string;
  unit: string;
}
export type GameQuestion = ChoiceQ | ScaleQ | NumberQ;

export const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

/** S1 trader profile: one question per screen (controls, H8 self-rating, H9 groups) */
export const PROFILE: GameQuestion[] = [
  {
    id: 'demo_age',
    kind: 'choice',
    text: 'Your age',
    options: [
      { value: '18_20', label: '18–20' },
      { value: '21_23', label: '21–23' },
      { value: '24_26', label: '24–26' },
      { value: '27_35', label: '27–35' },
      { value: '36_plus', label: '36 or older' },
    ],
  },
  {
    id: 'demo_gender',
    kind: 'choice',
    text: 'Gender',
    options: [
      { value: 'female', label: 'Female' },
      { value: 'male', label: 'Male' },
      { value: 'other', label: 'Non-binary / other' },
      { value: 'prefer_not', label: 'Prefer not to say' },
    ],
  },
  {
    id: 'demo_field',
    kind: 'choice',
    text: 'Field of study',
    options: [
      { value: 'engineering', label: 'Engineering / tech' },
      { value: 'science', label: 'Science / maths' },
      { value: 'commerce_econ', label: 'Commerce / economics / management' },
      { value: 'humanities_social', label: 'Humanities / social sciences' },
      { value: 'medicine', label: 'Medicine / health' },
      { value: 'other', label: 'Other' },
      { value: 'not_student', label: 'Not a student' },
    ],
  },
  {
    id: 'demo_income',
    kind: 'choice',
    text: 'Family income per year',
    options: [
      { value: 'lt_3l', label: 'Below ₹3 lakh' },
      { value: '3l_6l', label: '₹3–6 lakh' },
      { value: '6l_12l', label: '₹6–12 lakh' },
      { value: '12l_25l', label: '₹12–25 lakh' },
      { value: 'gt_25l', label: 'Above ₹25 lakh' },
      { value: 'prefer_not', label: 'Prefer not to say' },
    ],
  },
  {
    id: 'exp_investing',
    kind: 'choice',
    text: 'Investing experience',
    options: [
      { value: 'none', label: 'None' },
      { value: 'some', label: 'A few times' },
      { value: 'regular', label: 'I invest regularly' },
    ],
  },
  {
    id: 'exp_trading_app',
    kind: 'choice',
    text: 'Have you used a trading, investing or crypto app?',
    options: YES_NO,
  },
  // DECISION: prior financial education is kept (H8 IV in hypothesis-report.md) as a 7th profile tap.
  {
    id: 'exp_fin_edu',
    kind: 'choice',
    text: 'Have you taken any course or class on personal finance or investing?',
    options: YES_NO,
  },
  {
    id: 'lit_self',
    kind: 'scale',
    text: 'How good are you with money?',
    minLabel: 'Not good',
    maxLabel: 'Very good',
  },
];

/** S5 brain bonus: 3 CRT items, then the Big Three literacy items. Correct answers pay ₹100. */
export const BRAIN: GameQuestion[] = [
  {
    id: 'crt_1',
    kind: 'number',
    text: 'A bat and a ball cost ₹110 in total. The bat costs ₹100 more than the ball. How much does the ball cost?',
    unit: '₹',
  },
  {
    id: 'crt_2',
    kind: 'number',
    text: 'If 5 machines take 5 minutes to make 5 widgets, how long would 100 machines take to make 100 widgets?',
    unit: 'minutes',
  },
  {
    id: 'crt_3',
    kind: 'number',
    text: 'A patch of lily pads doubles in size every day. If it takes 48 days to cover the whole lake, how long does it take to cover half the lake?',
    unit: 'days',
  },
  {
    id: 'lit_interest',
    kind: 'choice',
    text: 'You have ₹100 in a savings account at 2% interest per year. After 5 years, how much is in the account?',
    options: [
      { value: 'more', label: 'More than ₹102' },
      { value: 'exactly', label: 'Exactly ₹102' },
      { value: 'less', label: 'Less than ₹102' },
      { value: 'dont_know', label: "Don't know" },
    ],
  },
  {
    id: 'lit_inflation',
    kind: 'choice',
    text: 'Your savings earn 1% interest per year and inflation is 2% per year. After 1 year, you can buy…',
    options: [
      { value: 'more', label: 'More than today' },
      { value: 'same', label: 'Exactly the same' },
      { value: 'less', label: 'Less than today' },
      { value: 'dont_know', label: "Don't know" },
    ],
  },
  {
    id: 'lit_diversification',
    kind: 'choice',
    text: "True or false: buying one company's stock is usually safer than buying a stock mutual fund.",
    options: [
      { value: 'true', label: 'True' },
      { value: 'false', label: 'False' },
      { value: 'dont_know', label: "Don't know" },
    ],
  },
];

/** Correct answers (CRT: ₹ version of bat-and-ball). Used by the game and by export scoring. */
export const ANSWER_KEY = {
  crt: { crt_1: 5, crt_2: 5, crt_3: 47 } as Record<string, number>,
  literacy: { lit_interest: 'more', lit_inflation: 'less', lit_diversification: 'false' } as Record<
    string,
    string
  >,
};

/** S13 quick reactions: one card per feature the player saw, in their own skin */
export const FEATURES: {
  id: string;
  label: Record<Skin, string>;
  hint: Record<Skin, string>;
}[] = [
  {
    id: 'timer',
    label: { fraud: 'Countdown & “only 3 slots left”', plain: 'Plan cards' },
    hint: { fraud: '⏱ 01:59 · 🔥 Only 3 slots left', plain: 'Starter · Growth · Turbo' },
  },
  {
    id: 'bonus',
    label: { fraud: 'Locked ₹500 bonus', plain: '₹500 welcome bonus' },
    hint: { fraud: '🔒 Unlocks after your first deposit', plain: 'Added to your Profit wallet' },
  },
  {
    id: 'vip',
    label: { fraud: 'VIP ladder', plain: 'Deposit summary' },
    hint: { fraud: '👑 VIP 2 — up to 3× returns', plain: 'Total invested so far' },
  },
  {
    id: 'regulator',
    label: { fraud: '“NDIA Certified” badge', plain: 'About ZenTrade' },
    hint: {
      fraud: '🛡️ NDIA Certified · 4.9★ · 10 lakh+ users',
      plain: 'Practice app, not registered',
    },
  },
  {
    id: 'social',
    label: { fraud: 'Winner pop-ups, ticker & testimonials', plain: 'Market chart' },
    hint: { fraud: '“Priya from Pune just withdrew ₹12,400”', plain: 'Round results chart' },
  },
  {
    id: 'chat',
    label: { fraud: 'Rohit Sir, Senior Advisor', plain: 'Help & FAQ card' },
    hint: { fraud: '“Most members upgrade to VIP 2 today”', plain: 'Are returns guaranteed? No.' },
  },
  {
    id: 'tax',
    label: { fraud: '10% withdrawal “processing tax”', plain: 'Withdrawal screen' },
    hint: { fraud: '⚠️ Pay tax to unlock your balance', plain: 'Withdrawal processed' },
  },
];

export const REACTION_QUESTION = 'Did this push you to invest?';

export const SLIDERS: ScaleQ[] = [
  {
    id: 'app_trust',
    kind: 'scale',
    text: 'Overall, how much did you trust the app?',
    minLabel: 'Not at all',
    maxLabel: 'Completely',
  },
  {
    id: 'app_urgency',
    kind: 'scale',
    text: 'Overall, how much did the app make you feel you had to act fast?',
    minLabel: 'Not at all',
    maxLabel: 'Very much',
  },
];

/** FOMO statements (H5 moderator, H9): agree / disagree; fomo_score = number agreed (0–3) */
export const FOMO: ChoiceQ[] = [
  'When many people are making money from something, I want in too.',
  'I worry about missing out on profits that others are making.',
  'If my friends invest in something, I feel I should invest too.',
].map((text, i) => ({
  id: `fomo_${i + 1}`,
  kind: 'choice',
  text,
  options: [
    { value: 'agree', label: 'Agree' },
    { value: 'disagree', label: 'Disagree' },
  ],
}));

/** Every response item id the game stores, in order (also the wide.csv item columns). */
export const GAME_ITEM_IDS: string[] = [
  ...PROFILE.map((q) => q.id),
  ...SPINS.gains.map((g) => `la_gain_${g}`),
  ...BRAIN.map((q) => q.id),
  ...FEATURES.map((f) => `feature_push_${f.id}`),
  ...SLIDERS.map((q) => q.id),
  ...FOMO.map((q) => q.id),
];

// ---------------------------------------------------------------------------------------------
// Report card (S14): traps. Logic lives in client/src/game/traps.ts.
// ---------------------------------------------------------------------------------------------

export const TRAP_TEXT: Record<string, { fraud: string; plain: string; tip: string }> = {
  hook: {
    fraud: 'You deposited in round 1 — the locked ₹500 bonus hooked you',
    plain: 'You invested straight away in round 1',
    tip: 'Bonuses that unlock only after a deposit are bait.',
  },
  vip: {
    fraud: 'You deposited enough to reach VIP 2',
    plain: 'You deposited ₹5,000+ in total',
    tip: 'VIP levels promise bigger returns for bigger deposits — real markets don’t work that way.',
  },
  chat: {
    fraud: 'You invested within a minute of the “advisor” chat',
    plain: 'You invested within a minute of the help card',
    tip: 'Friendly “mentors” in scam apps are paid to make you deposit.',
  },
  deal_no_details: {
    fraud: 'You grabbed a flash deal without opening its details',
    plain: 'You invested in a deal without opening its details',
    tip: 'Small amounts feel safe, so people skip checking. Always read the terms.',
  },
  pool_no_details: {
    fraud: 'You joined the Diamond Pool without checking it',
    plain: 'You joined the Diamond Pool without checking it',
    tip: 'Pools that pay from new members joining are Ponzi schemes — even when a friend invites you.',
  },
  crash_topup: {
    fraud: 'You topped up to “recover” after the crash',
    plain: 'You topped up after the crash',
    tip: 'Chasing losses with more money is how scam apps drain victims.',
  },
  tax_paid: {
    fraud: 'You paid a “tax” to unlock your withdrawal',
    plain: 'You paid a fee to withdraw',
    tip: 'Never pay a fee or tax to withdraw. Real platforms deduct charges; they never ask you to pay first.',
  },
  no_verify: {
    fraud: 'You never opened the T&C, plan details or the badge',
    plain: 'You never opened the terms, plan details or About page',
    tip: 'A badge inside an app proves nothing. Check the regulator’s own website.',
  },
  trust_after_withdrawal: {
    fraud: 'You deposited more right after the withdrawal stage',
    plain: 'You deposited more right after the withdrawal stage',
    tip: 'Scam apps let small withdrawals through to win your trust before a big deposit.',
  },
  reinvest: {
    fraud: 'You put money into the Gold Plan offer',
    plain: 'You put money into the Gold Plan offer',
    tip: 'Profits shown in an app are just numbers until they reach your bank.',
  },
};

export const SAFETY_TIPS = [
  "Check the app or company on the official securities regulator's list of registered intermediaries — not a badge or certificate inside the app.",
  'Never pay a fee, “tax” or deposit to unlock a withdrawal.',
  'Guaranteed or very high returns, countdowns and “limited slots” are red flags.',
  'Be careful with “mentors”, Telegram/WhatsApp groups and referral links — even from friends.',
  'Victim of fraud? Report at cybercrime.gov.in or call 1930.',
];
