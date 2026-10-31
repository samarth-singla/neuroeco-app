/**
 * Game economy: pure functions on the wallets. Identical in both skins (the skin only changes
 * whether the sign-up bonus starts locked, and whether the withdrawal is blocked by a tax).
 *
 * Wallets:
 * - main: demo cash (starts at ₹10,000). Round stakes and deal amounts come from here.
 * - profit: gains, rewards and (honest skin) the sign-up bonus.
 * - portfolio: money locked in the pool, post-withdrawal deposit, Gold Plan and Loss Shield.
 * - cashedOut: money successfully withdrawn out of the app.
 * - bonusLocked: fraud skin's sign-up bonus, released to profit on the first deposit (H1b).
 * - taxPaid: withdrawal "tax" paid (fraud skin, H1g).
 */
import { ECONOMY, SPINS, type Skin } from '../config/game';

export interface Wallets {
  main: number;
  profit: number;
  portfolio: number;
  cashedOut: number;
  bonusLocked: number;
  taxPaid: number;
}

const r = (n: number) => Math.round(n);

export function startWallets(skin: Skin): Wallets {
  const bonus = ECONOMY.signupBonus;
  return {
    main: ECONOMY.startingMain,
    profit: skin === 'fraud' ? 0 : bonus,
    portfolio: 0,
    cashedOut: 0,
    bonusLocked: skin === 'fraud' ? bonus : 0,
    taxPaid: 0,
  };
}

/** Round-1 rate depends on the randomized outcome; rounds 2–6 are fixed. */
export function roundRate(round: number, round1Outcome: 'small_win' | 'flat'): number {
  return round === 1 ? ECONOMY.rounds.round1[round1Outcome] : ECONOMY.rounds.later[round];
}

/** Clamp an amount the player asked for to what the source wallet holds (whole rupees, ≥ 0). */
export function cap(amount: number, available: number): number {
  const a = Number.isFinite(amount) ? r(amount) : 0;
  return Math.max(0, Math.min(a, Math.max(0, available)));
}

/** The first deposit releases a locked bonus into the profit wallet. */
function unlockBonus(w: Wallets): Wallets {
  return w.bonusLocked > 0 ? { ...w, profit: w.profit + w.bonusLocked, bonusLocked: 0 } : w;
}

/** A trade (round or flash deal): stake stays in main, gain goes to profit, loss comes off main. */
export function trade(w: Wallets, amount: number, rate: number): { w: Wallets; gain: number } {
  const stake = cap(amount, w.main);
  if (stake === 0) return { w, gain: 0 };
  const gain = r(stake * rate);
  const next = gain >= 0 ? { ...w, profit: w.profit + gain } : { ...w, main: w.main + gain };
  return { w: unlockBonus(next), gain };
}

/** Lock money in the portfolio, from main or profit. */
export function lockIn(
  w: Wallets,
  amount: number,
  from: 'main' | 'profit',
): { w: Wallets; amount: number } {
  const a = cap(amount, w[from]);
  if (a === 0) return { w, amount: 0 };
  return { w: unlockBonus({ ...w, [from]: w[from] - a, portfolio: w.portfolio + a }), amount: a };
}

export function addProfit(w: Wallets, amount: number): Wallets {
  return { ...w, profit: w.profit + r(amount) };
}

/** Test withdrawal: main → cashed out. */
export function withdrawSmall(w: Wallets, amount: number): { w: Wallets; amount: number } {
  const a = cap(amount, w.main);
  return { w: { ...w, main: w.main - a, cashedOut: w.cashedOut + a }, amount: a };
}

/** Market crash: main and portfolio fall by the crash rate; profit is untouched. */
export function crash(w: Wallets): { w: Wallets; loss: number } {
  const main = r(w.main * (1 + ECONOMY.crashRate));
  const portfolio = r(w.portfolio * (1 + ECONOMY.crashRate));
  return { w: { ...w, main, portfolio }, loss: w.main - main + (w.portfolio - portfolio) };
}

/** Balance shown on the cash-out screen. */
export function withdrawable(w: Wallets): number {
  return w.main + w.profit + w.portfolio;
}

/** Honest skin: withdrawal goes through. */
export function cashOutAll(w: Wallets): Wallets {
  return { ...w, main: 0, profit: 0, portfolio: 0, cashedOut: w.cashedOut + withdrawable(w) };
}

export function taxFor(w: Wallets): number {
  return r(withdrawable(w) * ECONOMY.taxRate);
}

export function payTax(w: Wallets, tax: number): Wallets {
  return { ...w, taxPaid: w.taxPaid + r(tax) };
}

export function vipLevel(totalDeposited: number): number {
  let level = 0;
  for (const t of ECONOMY.vipTiers) if (totalDeposited >= t.minDeposited) level = t.level;
  return level;
}

/** Amount still needed to reach the next VIP level (0 at the top). */
export function toNextVip(totalDeposited: number): { level: number; needed: number } | null {
  const next = ECONOMY.vipTiers.find((t) => totalDeposited < t.minDeposited);
  return next ? { level: next.level, needed: next.minDeposited - totalDeposited } : null;
}

export type SpinOutcome = 'win' | 'lose';

/** Net result of the accepted bonus spins (revealed on the report card). */
export function spinNet(spins: { gain: number; accepted: boolean; outcome?: SpinOutcome }[]) {
  return spins.reduce(
    (sum, s) => (s.accepted ? sum + (s.outcome === 'win' ? s.gain : -SPINS.loss) : sum),
    0,
  );
}

/**
 * Final balance = main + profit + portfolio + cashed out − tax paid + spin results.
 * Frozen money in the fraud skin still counts, so the optional prize draw depends only on choices.
 */
// DECISION: frozen (blocked) money counts in the final balance; only the tax paid is lost.
export function finalBalance(w: Wallets, spins: Parameters<typeof spinNet>[0]): number {
  return w.main + w.profit + w.portfolio + w.cashedOut - w.taxPaid + spinNet(spins);
}

export function formatINR(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(Math.round(n)))}`;
}
