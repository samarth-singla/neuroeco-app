/**
 * All survey question text: the UI/UX feature ratings (Phase 5) and the general survey (Phase 6).
 * Item ids are stable: they become the `responses.item_id` values and the `wide.csv` columns.
 *
 * This file must stay pure data (no React, no browser APIs): the server imports it to know
 * which columns to export, and the simulation script uses it to answer every item.
 */

export interface LikertItem {
  id: string;
  type: 'likert';
  text: string;
  minLabel: string;
  maxLabel: string;
}

export interface ChoiceItem {
  id: string;
  type: 'choice';
  text: string;
  options: { value: string; label: string }[];
}

export interface NumberItem {
  id: string;
  type: 'number';
  text: string;
  min: number;
  max: number;
  unit?: string;
  /** Allow decimals (e.g. CRT answers) */
  decimals?: boolean;
}

export interface SliderItem {
  id: string;
  type: 'slider';
  text: string;
  min: number;
  max: number;
  step: number;
  unit: '₹';
}

export interface TextItem {
  id: string;
  type: 'text';
  text: string;
  optional: true;
}

export type Item = LikertItem | ChoiceItem | NumberItem | SliderItem | TextItem;

export type FeatureId =
  'timer' | 'bonus' | 'vip' | 'regulator' | 'social' | 'chat' | 'withdrawal_tax';

export interface Page {
  id: string;
  /** Block name, used in the data dictionary */
  block: string;
  title: string;
  intro?: string;
  /** UI/UX pages: which app element to re-render above the questions */
  feature?: FeatureId;
  items: Item[];
}

const likert = (id: string, text: string, minLabel: string, maxLabel: string): LikertItem => ({
  id,
  type: 'likert',
  text,
  minLabel,
  maxLabel,
});

export const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

// ---------------------------------------------------------------------------------------------
// UI/UX survey (H1a–H1g feature ratings, H1 and H6 trust)
// ---------------------------------------------------------------------------------------------

/** Feature order and the label shown for each version (fraud element → plain counterpart). */
export const UIUX_FEATURES: { id: FeatureId; fraud: string; plain: string }[] = [
  { id: 'timer', fraud: 'Countdown timer and limited slots', plain: 'Investment plan card' },
  { id: 'bonus', fraud: 'Sign-up bonus', plain: 'Welcome card' },
  { id: 'vip', fraud: 'VIP levels', plain: 'Plan list' },
  { id: 'regulator', fraud: 'Certification badge and certificate', plain: 'About page' },
  { id: 'social', fraud: 'Live withdrawals and member testimonials', plain: 'Plans screen' },
  { id: 'chat', fraud: 'Mentor chat', plain: 'Help & FAQ link' },
  { id: 'withdrawal_tax', fraud: 'Withdrawal processing tax', plain: 'Withdrawal confirmation' },
];

export const UIUX_DIMENSIONS = [
  {
    key: 'urgency',
    text: 'How urgent did this make you feel?',
    minLabel: 'Not at all urgent',
    maxLabel: 'Extremely urgent',
  },
  {
    key: 'trust',
    text: 'How trustworthy did this seem?',
    minLabel: 'Not at all trustworthy',
    maxLabel: 'Completely trustworthy',
  },
  {
    key: 'temptation',
    text: 'How tempted were you to invest?',
    minLabel: 'Not at all tempted',
    maxLabel: 'Extremely tempted',
  },
] as const;

export const UIUX_INTRO =
  'This is part of the app you just used. Please rate it on the three questions below.';

export function uiuxPages(version: 'plain' | 'fraud'): Page[] {
  const featurePages: Page[] = UIUX_FEATURES.map((f) => ({
    id: `uiux_${f.id}`,
    block: 'uiux',
    title: version === 'fraud' ? f.fraud : f.plain,
    intro: UIUX_INTRO,
    feature: f.id,
    items: UIUX_DIMENSIONS.map((d) =>
      likert(`uiux_${f.id}_${d.key}`, d.text, d.minLabel, d.maxLabel),
    ),
  }));
  const overall: Page = {
    id: 'uiux_overall',
    block: 'uiux',
    title: 'The app overall',
    items: [
      likert(
        'uiux_overall_trust',
        'Overall, how much did you trust the app?',
        'Not at all',
        'Completely',
      ),
      likert(
        'uiux_overall_urgency',
        'Overall, how much did the app make you feel you had to act quickly?',
        'Not at all',
        'Very much',
      ),
    ],
  };
  return [...featurePages, overall];
}

/** Every UI/UX item id (identical for both versions). */
export const UIUX_ITEM_IDS: string[] = uiuxPages('plain').flatMap((p) => p.items.map((i) => i.id));

// ---------------------------------------------------------------------------------------------
// General survey (H3, H4, H5, H7, H8, H9 + moderators and controls)
// ---------------------------------------------------------------------------------------------

export interface SurveyAssignment {
  referral_source: 'friend' | 'ad';
  money_source: 'profit' | 'own';
  stake_order: number[];
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const WILLING = { minLabel: 'Not at all willing', maxLabel: 'Extremely willing' };
const AGREE = { minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' };
const LIKELY = { minLabel: 'Not at all likely', maxLabel: 'Extremely likely' };

const agree = (id: string, text: string) => likert(id, text, AGREE.minLabel, AGREE.maxLabel);
const likely = (id: string, text: string) => likert(id, text, LIKELY.minLabel, LIKELY.maxLabel);
const willing = (id: string, text: string) => likert(id, text, WILLING.minLabel, WILLING.maxLabel);

/** CRT (H1 moderator). Free numeric answers; scored server-side (correct: 5, 5, 47). */
// DECISION: the bat-and-ball item uses rupees (₹110 / ₹100 → ₹5) instead of dollars.
const CRT_PAGE: Page = {
  id: 'crt',
  block: 'crt',
  title: 'Three quick puzzles',
  intro: 'Please answer each with a number.',
  items: [
    {
      id: 'crt_1',
      type: 'number',
      decimals: true,
      min: 0,
      max: 1000,
      unit: '₹',
      text: 'A bat and a ball cost ₹110 in total. The bat costs ₹100 more than the ball. How much does the ball cost?',
    },
    {
      id: 'crt_2',
      type: 'number',
      decimals: true,
      min: 0,
      max: 100000,
      unit: 'minutes',
      text: 'If it takes 5 machines 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets?',
    },
    {
      id: 'crt_3',
      type: 'number',
      decimals: true,
      min: 0,
      max: 100000,
      unit: 'days',
      text: 'In a lake, there is a patch of lily pads. Every day, the patch doubles in size. If it takes 48 days for the patch to cover the entire lake, how long would it take for the patch to cover half of the lake?',
    },
  ],
};

/** Loss aversion (H4, H8, H9): 50-50 gambles, lose ₹100 vs win G. λ from the switching point. */
export const GAMBLE_LOSS = 100;
export const GAMBLE_GAINS = [50, 100, 150, 200, 250, 300];

const LOSS_PAGE: Page = {
  id: 'loss_aversion',
  block: 'loss_aversion',
  title: 'Coin-flip bets',
  intro:
    'Imagine a fair coin is flipped. For each bet below, would you accept or reject it? There are no right or wrong answers.',
  items: GAMBLE_GAINS.map((g) => ({
    id: `la_gain_${g}`,
    type: 'choice' as const,
    text: `Heads: you lose ${inr(GAMBLE_LOSS)}. Tails: you win ${inr(g)}.`,
    options: [
      { value: 'accept', label: 'Accept the bet' },
      { value: 'reject', label: 'Reject the bet' },
    ],
  })),
};

/** H3 stake levels (within-subject; the server stores a shuffled order per participant). */
export const STAKES = [500, 5000, 50000];

function stakePage(stake: number): Page {
  return {
    id: `h3_stake_${stake}`,
    block: 'stake_scenarios',
    title: 'A new investment app',
    intro: `Imagine you come across a new investment app that promises high returns. You are thinking about putting ${inr(stake)} into it.`,
    items: [
      willing(
        `h3_stake_${stake}_willing`,
        `How willing would you be to invest ${inr(stake)} in this app?`,
      ),
      {
        id: `h3_stake_${stake}_verify`,
        type: 'choice',
        text: "Would you check the app's registration with the official regulator before investing?",
        options: YES_NO,
      },
    ],
  };
}

/** H5 referral scenario: only the participant's assigned version is shown. */
export const REFERRAL_TEXT: Record<SurveyAssignment['referral_source'], string> = {
  friend:
    'A close friend tells you they have been using an investment app for a few months and earning good returns. They send you their referral link and ask you to join.',
  ad: 'You see an online advertisement for an investment app. The ad says its members have been earning good returns for a few months, and has a link to join.',
};

function referralPage(source: SurveyAssignment['referral_source']): Page {
  return {
    id: 'h5_referral',
    block: 'referral_scenario',
    title: 'Joining an app',
    intro: REFERRAL_TEXT[source],
    items: [
      willing('h5_join_willing', 'How willing would you be to join this app?'),
      {
        id: 'h5_verify',
        type: 'choice',
        text: "Would you check the app's registration with the official regulator before joining?",
        options: YES_NO,
      },
    ],
  };
}

/** Herd / FOMO score (H5 moderator, H9): mean of five items. */
const HERD_PAGE: Page = {
  id: 'herd',
  block: 'herd_fomo',
  title: 'You and other people',
  intro: 'How much do you agree with each statement?',
  items: [
    agree('herd_1', 'When many people are buying an investment, I feel I should buy it too.'),
    agree('herd_2', 'I worry about missing out when others are making money from an investment.'),
    agree('herd_3', 'If my friends invest in something, I am more likely to invest in it as well.'),
    agree('herd_4', 'I tend to follow investment tips from popular people online.'),
    agree('herd_5', 'I feel uneasy when I hear that others made profits I missed.'),
  ],
};

/** H7 money-source scenario: only the participant's assigned version is shown. */
export const MONEY_AMOUNT = 2000;
export const MONEY_TEXT: Record<
  SurveyAssignment['money_source'],
  { intro: string; willing: string; amount: string }
> = {
  profit: {
    intro: `Imagine you have been using an investment app and it now shows ${inr(MONEY_AMOUNT)} of profit in your account. The app offers a new plan with some risk.`,
    willing: `How willing would you be to put this ${inr(MONEY_AMOUNT)} profit into the new plan?`,
    amount: `How much of the ${inr(MONEY_AMOUNT)} profit would you put into the new plan?`,
  },
  own: {
    intro: `Imagine you have ${inr(MONEY_AMOUNT)} of your own savings. An investment app offers a new plan with some risk.`,
    willing: `How willing would you be to deposit this ${inr(MONEY_AMOUNT)} of your own money into the new plan?`,
    amount: `How much of your ${inr(MONEY_AMOUNT)} would you deposit into the new plan?`,
  },
};

function moneyPage(source: SurveyAssignment['money_source']): Page {
  const t = MONEY_TEXT[source];
  return {
    id: 'h7_money_source',
    block: 'money_source_scenario',
    title: 'A new plan',
    intro: t.intro,
    items: [
      willing('h7_reinvest_willing', t.willing),
      {
        id: 'h7_reinvest_amount',
        type: 'slider',
        text: t.amount,
        min: 0,
        max: MONEY_AMOUNT,
        step: 100,
        unit: '₹',
      },
    ],
  };
}

/** Self-rated literacy (H8 overconfidence). */
// DECISION: the self-rating comes before the literacy quiz, so the quiz cannot change the self-rating.
const SELF_LIT_PAGE: Page = {
  id: 'lit_self',
  block: 'self_rated_literacy',
  title: 'Your financial knowledge',
  items: [
    likert(
      'lit_self',
      'How would you rate your overall financial knowledge?',
      'Very low',
      'Very high',
    ),
  ],
};

/** Big Three financial literacy (H8). Correct: more, less, false. */
const LITERACY_PAGE: Page = {
  id: 'literacy',
  block: 'financial_literacy',
  title: 'Three money questions',
  items: [
    {
      id: 'lit_interest',
      type: 'choice',
      text: 'Suppose you had ₹100 in a savings account and the interest rate was 2% per year. After 5 years, how much do you think you would have in the account if you left the money to grow?',
      options: [
        { value: 'more', label: 'More than ₹102' },
        { value: 'exactly', label: 'Exactly ₹102' },
        { value: 'less', label: 'Less than ₹102' },
        { value: 'dont_know', label: "Don't know" },
      ],
    },
    {
      id: 'lit_inflation',
      type: 'choice',
      text: 'Imagine that the interest rate on your savings account was 1% per year and inflation was 2% per year. After 1 year, how much would you be able to buy with the money in this account?',
      options: [
        { value: 'more', label: 'More than today' },
        { value: 'same', label: 'Exactly the same' },
        { value: 'less', label: 'Less than today' },
        { value: 'dont_know', label: "Don't know" },
      ],
    },
    {
      id: 'lit_diversification',
      type: 'choice',
      text: "True or false: buying a single company's stock usually provides a safer return than a stock mutual fund.",
      options: [
        { value: 'true', label: 'True' },
        { value: 'false', label: 'False' },
        { value: 'dont_know', label: "Don't know" },
      ],
    },
  ],
};

/** Susceptibility index (H8, H9): mean of five scam-scenario items. */
const SUSCEPTIBILITY_PAGE: Page = {
  id: 'susceptibility',
  block: 'susceptibility',
  title: 'Some offers',
  intro: 'How likely would you be to do each of these?',
  items: [
    likely('sus_1', 'An app promises a guaranteed 3% return every day. Invest ₹5,000 in it.'),
    likely(
      'sus_2',
      'A message offers ₹500 a day for liking videos, after a ₹1,000 registration fee. Pay the fee and sign up.',
    ),
    likely(
      'sus_3',
      'A "stock mentor" in a WhatsApp group shares tips that worked for others and invites you to a private trading app. Join and deposit money.',
    ),
    likely(
      'sus_4',
      'An investment app shows a profit but asks you to pay a "tax" before you can withdraw. Pay it.',
    ),
    likely(
      'sus_5',
      'Someone you met online offers to double your crypto in a week. Send them money.',
    ),
  ],
};

/** Experience and exposure (controls, H8). */
const EXPERIENCE_PAGE: Page = {
  id: 'experience',
  block: 'experience',
  title: 'Your experience',
  items: [
    {
      id: 'exp_fin_edu',
      type: 'choice',
      text: 'Have you had any formal financial education (a course, workshop or class on personal finance or investing)?',
      options: YES_NO,
    },
    {
      id: 'exp_investing',
      type: 'choice',
      text: 'How much investing experience do you have (stocks, mutual funds, crypto, etc.)?',
      options: [
        { value: 'none', label: 'None' },
        { value: 'some', label: 'Some (a few times)' },
        { value: 'regular', label: 'I invest regularly' },
      ],
    },
    {
      id: 'exp_trading_app',
      type: 'choice',
      text: 'Have you ever used a trading, investing or crypto app?',
      options: YES_NO,
    },
    {
      id: 'exp_scam',
      type: 'choice',
      text: 'Have you ever been targeted by an investment or money scam?',
      options: [
        { value: 'never', label: 'Never' },
        { value: 'targeted', label: 'I was targeted but did not lose money' },
        { value: 'lost_money', label: 'I lost money to a scam' },
      ],
    },
  ],
};

/** Demographics (controls, H9). */
const DEMOGRAPHICS_PAGE: Page = {
  id: 'demographics',
  block: 'demographics',
  title: 'About you',
  items: [
    { id: 'demo_age', type: 'number', text: 'Your age (years)', min: 18, max: 99 },
    {
      id: 'demo_gender',
      type: 'choice',
      text: 'Gender',
      options: [
        { value: 'female', label: 'Female' },
        { value: 'male', label: 'Male' },
        { value: 'other', label: 'Non-binary / other' },
        { value: 'prefer_not', label: 'Prefer not to say' },
      ],
    },
    {
      id: 'demo_income',
      type: 'choice',
      text: 'Approximate annual family income',
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
      id: 'demo_field',
      type: 'choice',
      text: 'Field of study',
      options: [
        { value: 'engineering', label: 'Engineering / technology' },
        { value: 'science', label: 'Natural sciences / mathematics' },
        { value: 'commerce_econ', label: 'Commerce / economics / management' },
        { value: 'humanities_social', label: 'Humanities / social sciences' },
        { value: 'medicine', label: 'Medicine / health' },
        { value: 'law', label: 'Law' },
        { value: 'design_arts', label: 'Design / arts' },
        { value: 'other', label: 'Other' },
        { value: 'not_student', label: 'Not a student' },
      ],
    },
    {
      id: 'comments',
      type: 'text',
      optional: true,
      text: 'Anything else you would like to tell us about the app or the study?',
    },
  ],
};

/** The general survey pages for one participant, in order. */
export function surveyPages(a: SurveyAssignment): Page[] {
  const stakes = a.stake_order.length === STAKES.length ? a.stake_order : STAKES;
  return [
    CRT_PAGE,
    LOSS_PAGE,
    ...stakes.map(stakePage),
    referralPage(a.referral_source),
    HERD_PAGE,
    moneyPage(a.money_source),
    SELF_LIT_PAGE,
    LITERACY_PAGE,
    SUSCEPTIBILITY_PAGE,
    EXPERIENCE_PAGE,
    DEMOGRAPHICS_PAGE,
  ];
}

const CANONICAL = surveyPages({
  referral_source: 'friend',
  money_source: 'profit',
  stake_order: STAKES,
});

/** Every general-survey item id, in page order (the same for every condition). */
export const SURVEY_ITEM_IDS: string[] = CANONICAL.flatMap((p) => p.items.map((i) => i.id));

/** Items that may be left empty (free text) */
export const OPTIONAL_ITEM_IDS: string[] = CANONICAL.flatMap((p) =>
  p.items.filter((i) => i.type === 'text').map((i) => i.id),
);

/** All items (UI/UX + general) with their block, for the export and the data dictionary. */
export const ALL_ITEMS: { id: string; block: string; item: Item }[] = [
  ...uiuxPages('plain'),
  ...CANONICAL,
].flatMap((p) => p.items.map((item) => ({ id: item.id, block: p.block, item })));
