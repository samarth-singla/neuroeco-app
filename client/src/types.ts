/** Assignment returned by the server for a new participant (balanced factors + order factors). */
export interface Assignment {
  /** Skin: `plain` = honest "ZenTrade", `fraud` = "ZenTrade X" (H1) */
  app_version: 'plain' | 'fraud';
  round1_outcome: 'small_win' | 'flat';
  withdrawal_offer: 'allowed' | 'not_offered';
  /** Diamond Pool invite source (H5) */
  referral_source: 'friend' | 'ad';
  /** Gold Plan framing: from Profit wallet (`profit`) or Main wallet (`own`) (H7) */
  money_source: 'profit' | 'own';
  /** Flash-deal sizes in the order shown (H3) */
  deal_order?: number[];
  /** Bonus-spin gains in the order shown (H4) */
  spin_order?: number[];
}

export type AnswerValue = string | number;
