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
