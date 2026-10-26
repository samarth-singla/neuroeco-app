/**
 * Phase 4 check: the whole app session (A1–A10) can be completed in both versions and under
 * every combination of round1_outcome and withdrawal_offer, and the logged events arrive.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { flush, _resetLogger } from '../lib/logger';
import type { Assignment } from '../types';
import { installFakeApi } from './fakeApi';

const btn = (name: RegExp | string) => screen.getByRole('button', { name });
const findBtn = (name: RegExp | string) => screen.findByRole('button', { name });

function typeAmount(value: string) {
  fireEvent.change(screen.getByLabelText(/Amount/), { target: { value } });
}

async function startStudy() {
  render(<App />);
  // Consent / start screen (the consent screen replaces this in Phase 7)
  const agree = screen.queryByRole('checkbox');
  if (agree) {
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
  }
  fireEvent.click(await findBtn(/^(Start|I agree|Agree and start)/i));
  await findBtn('Continue');
}

function makeAssignment(over: Partial<Assignment>): Assignment {
  return {
    app_version: 'plain',
    round1_outcome: 'small_win',
    withdrawal_offer: 'allowed',
    referral_source: 'friend',
    money_source: 'own',
    stake_order: [500, 5000, 50000],
    ...over,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  _resetLogger();
});
afterEach(() => vi.unstubAllGlobals());

const combos: Assignment[] = [];
for (const app_version of ['plain', 'fraud'] as const)
  for (const round1_outcome of ['small_win', 'flat'] as const)
    for (const withdrawal_offer of ['allowed', 'not_offered'] as const)
      combos.push(makeAssignment({ app_version, round1_outcome, withdrawal_offer }));

describe('app session — investing path', () => {
  for (const a of combos) {
    it(`${a.app_version} / ${a.round1_outcome} / ${a.withdrawal_offer}`, async () => {
      const api = installFakeApi(a);
      await startStudy();
      const fraud = a.app_version === 'fraud';

      // A1
      if (fraud) expect(screen.getByText(/Welcome bonus credited/)).toBeInTheDocument();
      else expect(screen.queryByText(/Welcome bonus/)).toBeNull();
      fireEvent.click(btn('Continue'));

      // A2
      expect(screen.queryByTestId('urgency-banner') !== null).toBe(fraud);
      expect(screen.queryByTestId('vip-tiers') !== null).toBe(fraud);
      expect(screen.queryByTestId('regulator-badge') !== null).toBe(fraud);
      expect(screen.queryByTestId('ticker') !== null).toBe(fraud);
      expect(screen.queryByTestId('testimonials') !== null).toBe(fraud);
      fireEvent.click(btn('About / Verify'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.click(btn('Close'));
      fireEvent.click(btn(/Growth/));
      fireEvent.click(btn('Invest in this plan'));

      // A3
      typeAmount('1000');
      fireEvent.click(btn('Invest ₹1,000'));

      // A4
      const expectedGain = a.round1_outcome === 'small_win' ? (fraud ? '+₹120' : '+₹80') : '₹0';
      expect(screen.getByText(expectedGain)).toBeInTheDocument();
      fireEvent.click(btn('Continue'));

      // A5
      if (fraud) {
        fireEvent.click(btn(/Chat with/));
        expect(screen.getByText(/Most members upgrade to VIP 2 today/)).toBeInTheDocument();
        fireEvent.click(btn('Close'));
      } else {
        fireEvent.click(btn(/Help & FAQ/));
        fireEvent.click(btn('Close'));
      }
      typeAmount('2000');
      fireEvent.click(btn('Invest ₹2,000'));

      // A6
      if (a.withdrawal_offer === 'allowed') {
        fireEvent.click(btn('Withdraw ₹200'));
        expect(screen.getByTestId('withdraw-done')).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/Withdraw/)).toBeNull();
      }
      fireEvent.click(btn('Continue'));

      // A7
      fireEvent.click(btn('Not now'));

      // A8
      expect(screen.getByText('−30%')).toBeInTheDocument();
      fireEvent.click(btn('Top up to recover'));
      typeAmount('500');
      fireEvent.click(btn('Add ₹500'));

      // A9
      fireEvent.click(btn(/^Withdraw ₹/));
      if (fraud) {
        expect(screen.getByText('Withdrawal on hold')).toBeInTheDocument();
        fireEvent.click(btn(/^Pay fee/));
      } else {
        expect(screen.getByText(/withdrawn/)).toBeInTheDocument();
      }
      fireEvent.click(btn('Continue'));

      // A10
      fireEvent.click(btn('Continue to survey'));
      expect(screen.queryByRole('button', { name: 'Continue to survey' })).toBeNull();

      await act(async () => {
        await flush();
      });
      const types = api.events.map((e) => `${e.screen}:${e.event_type}`);
      for (const s of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10']) {
        expect(types).toContain(`${s}:screen_view`);
      }
      const expected = [
        'A2:verify_click',
        'A2:plan_select',
        'A2:invest_click',
        'A3:deposit_submit',
        'A4:outcome_shown',
        'A5:chat_open',
        'A5:deposit_submit',
        'A6:withdraw_offer_shown',
        'A7:deposit_submit',
        'A8:loss_shown',
        'A8:topup_click',
        'A8:topup_submit',
        'A9:withdraw_final_click',
      ];
      if (a.withdrawal_offer === 'allowed') expected.push('A6:withdraw_click');
      if (fraud) expected.push('A1:bonus_shown', 'A9:fee_shown', 'A9:fee_pay_click');
      for (const t of expected) expect(types).toContain(t);

      const invest = api.events.find((e) => e.event_type === 'invest_click')!;
      expect(invest.payload).toMatchObject({ plan_id: 'growth', first_decision: true });
      expect(typeof invest.payload!.decision_ms).toBe('number');
      expect(api.steps.at(-1)).toBe('uiux:0');
    });
  }
});

describe('app session — never investing is a valid path (no dead ends)', () => {
  for (const app_version of ['plain', 'fraud'] as const) {
    it(app_version, async () => {
      const api = installFakeApi(makeAssignment({ app_version, withdrawal_offer: 'allowed' }));
      await startStudy();
      fireEvent.click(btn('Continue')); // A1
      fireEvent.click(btn('Continue without investing')); // A2
      expect(screen.getByText(/You didn't invest this cycle/)).toBeInTheDocument();
      fireEvent.click(btn('Continue')); // A4
      fireEvent.click(btn('Not now')); // A5
      expect(screen.getByText(/no balance in the app to withdraw/)).toBeInTheDocument();
      fireEvent.click(btn('Continue')); // A6
      fireEvent.click(btn('Not now')); // A7
      fireEvent.click(btn('Leave')); // A8
      fireEvent.click(btn('Continue')); // A9 (nothing to withdraw)
      fireEvent.click(btn('Continue to survey')); // A10
      await act(async () => {
        await flush();
      });
      const types = api.events.map((e) => e.event_type);
      expect(types).toContain('exit_click');
      expect(types).toContain('topup_decline');
      expect(types).not.toContain('fee_shown');
      expect(api.steps.at(-1)).toBe('uiux:0');
    });
  }
});

describe('refresh resume', () => {
  it('resumes at the same screen with the same wallet', async () => {
    installFakeApi(makeAssignment({ app_version: 'plain' }));
    const { unmount } = render(<App />);
    fireEvent.click(await findBtn(/^(Start|I agree|Agree and start)/i));
    fireEvent.click(await findBtn('Continue'));
    fireEvent.click(btn(/Starter/));
    fireEvent.click(btn('Invest in this plan'));
    typeAmount('3000');
    fireEvent.click(btn('Invest ₹3,000'));
    unmount();

    render(<App />); // simulated page refresh
    expect(await screen.findByText('Cycle 1 result')).toBeInTheDocument();
    expect(screen.getByTestId('wallet-cash')).toHaveTextContent('₹7,000');
    expect(screen.getByTestId('wallet-app')).toHaveTextContent('₹3,240');
  });
});
