export type AppVersion = 'plain' | 'fraud';

export interface Assignment {
  app_version: AppVersion;
  round1_outcome: 'small_win' | 'flat';
  withdrawal_offer: 'allowed' | 'not_offered';
  referral_source: 'friend' | 'ad';
  money_source: 'profit' | 'own';
  /** H3 stake amounts in the order this participant sees them */
  stake_order: number[];
  /** Game: flash-deal sizes in the order shown (H3) */
  deal_order?: number[];
  /** Game: bonus-spin gains in the order shown (H4) */
  spin_order?: number[];
}

export type AppScreen = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7' | 'A8' | 'A9' | 'A10';

/**
 * Where the participant is. Stored on the server (`current_step`) and in sessionStorage.
 * `app:A1`…`app:A10` are the app screens, `uiux:<n>` and `survey:<n>` are survey pages.
 */
export type Step =
  `app:${AppScreen}` | `uiux:${number}` | `survey:${number}` | 'debrief' | 'thanks';

export type AnswerValue = string | number;
export type Answers = Record<string, AnswerValue>;
