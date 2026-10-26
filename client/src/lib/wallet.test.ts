import { describe, expect, it } from 'vitest';
import { applyAll, clampDeposit, formatINR, newWallet, walletReducer } from './wallet';

describe('wallet', () => {
  it('starts with the practice balance and nothing in the app', () => {
    const w = newWallet(10000);
    expect(w.cash).toBe(10000);
    expect(w.appBalance).toBe(0);
  });

  it('moves deposits from the practice balance into the app', () => {
    const w = walletReducer(newWallet(10000), { type: 'deposit', amount: 2500 });
    expect(w.cash).toBe(7500);
    expect(w.appBalance).toBe(2500);
    expect(w.totalDeposited).toBe(2500);
  });

  it('never deposits more than the practice balance, or negative / fractional amounts', () => {
    const w = newWallet(1000);
    expect(clampDeposit(w, 5000)).toBe(1000);
    expect(clampDeposit(w, -50)).toBe(0);
    expect(clampDeposit(w, 99.6)).toBe(100);
    expect(clampDeposit(w, Number.NaN)).toBe(0);
    expect(walletReducer(w, { type: 'deposit', amount: 0 })).toBe(w);
  });

  it('applies scripted returns and losses to the in-app balance (whole rupees)', () => {
    const w = applyAll(newWallet(10000), [
      { type: 'deposit', amount: 1000 },
      { type: 'apply_return', rate: 0.08 },
    ]);
    expect(w.appBalance).toBe(1080);
    const after = walletReducer(w, { type: 'apply_return', rate: -0.3 });
    expect(after.appBalance).toBe(756);
    expect(after.cash).toBe(9000);
  });

  it('keeps the bonus locked until the first deposit, then adds it to the app balance', () => {
    let w = walletReducer(newWallet(10000), { type: 'credit_bonus', amount: 500 });
    expect(w.bonus).toBe(500);
    expect(w.appBalance).toBe(0);
    w = walletReducer(w, { type: 'deposit', amount: 1000 });
    expect(w.bonus).toBe(0);
    expect(w.bonusUnlocked).toBe(true);
    expect(w.appBalance).toBe(1500);
    expect(w.totalDeposited).toBe(1000);
    w = walletReducer(w, { type: 'deposit', amount: 1000 });
    expect(w.appBalance).toBe(2500);
  });

  it('withdraws back into the practice balance, never more than the app balance', () => {
    let w = applyAll(newWallet(10000), [{ type: 'deposit', amount: 150 }]);
    w = walletReducer(w, { type: 'withdraw', amount: 200 });
    expect(w.appBalance).toBe(0);
    expect(w.cash).toBe(10000);
    expect(w.totalWithdrawn).toBe(150);
  });

  it('withdraw_all empties the app balance', () => {
    const w = applyAll(newWallet(10000), [
      { type: 'deposit', amount: 4000 },
      { type: 'apply_return', rate: 0.08 },
      { type: 'withdraw_all' },
    ]);
    expect(w.appBalance).toBe(0);
    expect(w.cash).toBe(6000 + 4320);
  });

  it('takes fees from the practice balance, capped at what is left', () => {
    let w = applyAll(newWallet(1000), [{ type: 'deposit', amount: 900 }]);
    w = walletReducer(w, { type: 'pay_fee', amount: 300 });
    expect(w.cash).toBe(0);
    expect(w.feesPaid).toBe(100);
  });

  it('formats rupees in Indian style', () => {
    expect(formatINR(1234567)).toBe('₹12,34,567');
    expect(formatINR(10000)).toBe('₹10,000');
  });
});
