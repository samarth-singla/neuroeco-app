/**
 * Simulated wallet. Pure functions only, so they are easy to test.
 *
 * - `cash`: the participant's practice balance outside the app (starts at ₹10,000).
 *   Every deposit comes out of it, every successful withdrawal goes back into it.
 * - `appBalance`: money inside the app (deposits + scripted returns − withdrawals).
 * - `bonus`: fraud-version sign-up bonus, locked until the first deposit.
 */
export interface Wallet {
  cash: number;
  appBalance: number;
  bonus: number;
  bonusUnlocked: boolean;
  totalDeposited: number;
  totalWithdrawn: number;
  feesPaid: number;
}

export type WalletAction =
  | { type: 'credit_bonus'; amount: number }
  | { type: 'deposit'; amount: number }
  | { type: 'apply_return'; rate: number }
  | { type: 'withdraw'; amount: number }
  | { type: 'withdraw_all' }
  | { type: 'pay_fee'; amount: number };

export function newWallet(startingCash: number): Wallet {
  return {
    cash: startingCash,
    appBalance: 0,
    bonus: 0,
    bonusUnlocked: false,
    totalDeposited: 0,
    totalWithdrawn: 0,
    feesPaid: 0,
  };
}

const whole = (n: number) => Math.max(0, Math.round(Number.isFinite(n) ? n : 0));

/** Largest amount that can be deposited right now. */
export function maxDeposit(w: Wallet): number {
  return w.cash;
}

/** Turns user input into a valid deposit amount (whole rupees, 0…cash). */
export function clampDeposit(w: Wallet, amount: number): number {
  return Math.min(whole(amount), maxDeposit(w));
}

export function walletReducer(w: Wallet, action: WalletAction): Wallet {
  switch (action.type) {
    case 'credit_bonus':
      return { ...w, bonus: w.bonus + whole(action.amount) };

    case 'deposit': {
      const amount = clampDeposit(w, action.amount);
      if (amount === 0) return w;
      // DECISION: on the first deposit the locked sign-up bonus is unlocked and joins the in-app balance.
      const unlock = !w.bonusUnlocked && w.bonus > 0;
      return {
        ...w,
        cash: w.cash - amount,
        appBalance: w.appBalance + amount + (unlock ? w.bonus : 0),
        bonus: unlock ? 0 : w.bonus,
        bonusUnlocked: w.bonusUnlocked || unlock,
        totalDeposited: w.totalDeposited + amount,
      };
    }

    case 'apply_return':
      return { ...w, appBalance: whole(w.appBalance * (1 + action.rate)) };

    case 'withdraw': {
      const amount = Math.min(whole(action.amount), w.appBalance);
      return {
        ...w,
        appBalance: w.appBalance - amount,
        cash: w.cash + amount,
        totalWithdrawn: w.totalWithdrawn + amount,
      };
    }

    case 'withdraw_all':
      return walletReducer(w, { type: 'withdraw', amount: w.appBalance });

    case 'pay_fee': {
      // DECISION: the fee is paid from the practice balance; if it is short, only what is left is taken.
      const amount = Math.min(whole(action.amount), w.cash);
      return { ...w, cash: w.cash - amount, feesPaid: w.feesPaid + amount };
    }
  }
}

export function applyAll(w: Wallet, actions: WalletAction[]): Wallet {
  return actions.reduce(walletReducer, w);
}

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function formatINR(n: number): string {
  return `₹${inr.format(Math.round(n))}`;
}
