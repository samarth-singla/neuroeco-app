/**
 * Playtest fixes 2: flash deals on one screen, the fraud skin's VIP system (pop-up, bar, nudge,
 * level-up) and the honest skin's instant cash-out.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { ECONOMY, TIMING } from '../config/game';
import { _resetLogger, flush } from '../lib/logger';
import { installFakeApi, type FakeApi } from './fakeApi';
import { apiAssignment, gameAssignment, savedGame, seedGame } from './gameSeed';

const CHART_MS = ECONOMY.rounds.chartMs;
const CELEBRATE_MS = TIMING.vipCelebrateMs;
beforeAll(() => {
  ECONOMY.rounds.chartMs = 20; // skip the 7 s chart animation in tests
  TIMING.vipCelebrateMs = 300;
});
afterAll(() => {
  ECONOMY.rounds.chartMs = CHART_MS;
  TIMING.vipCelebrateMs = CELEBRATE_MS;
});
beforeEach(() => {
  sessionStorage.clear();
  _resetLogger();
});
afterEach(() => vi.unstubAllGlobals());

const step = () => savedGame().game.step;
const waitForStep = (s: string) => waitFor(() => expect(step()).toBe(s), { timeout: 4000 });

async function logged(api: FakeApi, type: string) {
  await act(async () => {
    await flush();
  });
  return api.events.filter((e) => e.event_type === type);
}

function resumeAt(stepId: string) {
  const g = savedGame();
  cleanup();
  seedGame(stepId, g.assignment, g.game);
  render(<App />);
}

for (const skin of ['fraud', 'plain'] as const) {
  describe(`${skin} skin`, () => {
    it('flash deals: three cards on one screen in random order; invest / details per deal', async () => {
      const a = gameAssignment({ app_version: skin, deal_order: [8000, 500, 3000] });
      const api = installFakeApi(apiAssignment(a));
      seedGame('g:deal', a);
      render(<App />);

      const cards = await screen.findAllByTestId(/^deal-\d+$/);
      expect(cards.map((c) => c.dataset.testid)).toEqual(['deal-8000', 'deal-500', 'deal-3000']);
      const card500 = within(screen.getByTestId('deal-500'));
      fireEvent.click(card500.getByRole('button', { name: 'View details' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
      fireEvent.click(card500.getByRole('button', { name: /Invest ₹500/i }));
      expect(await card500.findByTestId('deal-result')).toHaveTextContent('+₹25');
      fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
      await waitForStep('g:pool');

      const inv = await logged(api, 'deal_invest');
      expect(inv.map((e) => [e.payload?.size, e.payload?.details_before])).toEqual([[500, true]]);
      expect(typeof inv[0].payload?.decision_ms).toBe('number');
      const skips = await logged(api, 'deal_skip');
      expect(skips.map((e) => e.payload?.size).sort()).toEqual([3000, 8000]);
      expect(savedGame().game.deals[8000]).toMatchObject({ invested: false, detailsBefore: false });
    });
  });
}

describe('fraud skin VIP system', () => {
  it('VIP ladder pop-up on the first home visit (2% / 3% / 5% daily), logged, not shown again', async () => {
    const a = gameAssignment({ app_version: 'fraud' });
    const api = installFakeApi(apiAssignment(a));
    seedGame('g:home', a);
    render(<App />);
    const pop = await screen.findByRole('dialog', { name: 'VIP ladder' });
    for (const t of ['2% daily', '3% daily', '5% daily']) expect(pop).toHaveTextContent(t);
    expect(pop).toHaveTextContent('₹5,000');
    expect(document.querySelector('[inert]')).not.toBeNull(); // dashboard behind is not tappable
    fireEvent.click(within(pop).getByRole('button', { name: /Start earning/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.querySelector('[inert]')).toBeNull();
    expect(await logged(api, 'vip_popup_shown')).toHaveLength(1);
    expect((await logged(api, 'vip_popup_close'))[0].payload?.ms).toEqual(expect.any(Number));

    resumeAt('g:home');
    await screen.findByTestId('vip-bar');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('VIP bar, after-round nudge (pre-fills the next round) and level-up celebration', async () => {
    const a = gameAssignment({ app_version: 'fraud' });
    const api = installFakeApi(apiAssignment(a));
    seedGame('g:round:1', a);
    render(<App />);
    expect(await screen.findByTestId('vip-bar')).toHaveTextContent('Member · ₹0 / ₹1,000 to VIP 1');
    fireEvent.change(screen.getByLabelText(/Invest this round/), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /INVEST NOW/ }));
    expect(await screen.findByTestId('vip-level-up')).toHaveTextContent(
      'VIP 1 unlocked! 2% daily returns starting next cycle',
    );
    const nudge = await screen.findByTestId('vip-nudge', {}, { timeout: 3000 });
    expect(nudge).toHaveTextContent('Deposit ₹4,000 more to unlock VIP 2 and earn 3% daily.');
    fireEvent.click(within(nudge).getByRole('button', { name: /Upgrade next round/ }));
    expect(await logged(api, 'vip_level_up')).toEqual([
      expect.objectContaining({ payload: expect.objectContaining({ level: 1 }) }),
    ]);
    expect((await logged(api, 'vip_nudge_tap'))[0].payload).toMatchObject({
      round: 1,
      amount: 4000,
    });

    resumeAt('g:round:2');
    expect(await screen.findByLabelText(/Invest this round/)).toHaveValue('4000');
    // the level-up banner shows once, then the bar returns
    await waitFor(() =>
      expect(screen.getByTestId('vip-bar')).toHaveTextContent('VIP 1 · ₹1,000 / ₹5,000 to VIP 2'),
    );
    expect(savedGame().game.vipCelebrated).toBe(1);
  });

  it('honest skin has no VIP pop-up, bar or nudge', async () => {
    const a = gameAssignment({ app_version: 'plain' });
    const api = installFakeApi(apiAssignment(a));
    seedGame('g:home', a);
    render(<App />);
    await screen.findByText('Your practice account');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('vip-bar')).not.toBeInTheDocument();
    resumeAt('g:round:1');
    fireEvent.change(await screen.findByLabelText(/Invest this round/), {
      target: { value: '5000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Invest/ }));
    await screen.findByTestId('round-result', {}, { timeout: 3000 });
    expect(screen.queryByTestId('vip-nudge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('vip-level-up')).not.toBeInTheDocument();
    const types = (await logged(api, 'round_invest')).length;
    expect(types).toBe(1);
    expect(api.events.some((e) => e.event_type.startsWith('vip_'))).toBe(false);
  });
});

describe('round: stake shown "in trade" while the chart runs', () => {
  for (const skin of ['fraud', 'plain'] as const) {
    it(`${skin}: Main, Profit and the result card update together when the chart ends`, async () => {
      ECONOMY.rounds.chartMs = 1500;
      try {
        const a = gameAssignment({ app_version: skin, round1_outcome: 'small_win' });
        installFakeApi(apiAssignment(a));
        seedGame('g:round:1', a);
        render(<App />);
        const wallets = await screen.findByTestId('wallets');
        const profitBefore = skin === 'fraud' ? '₹0' : '₹500';
        fireEvent.change(screen.getByLabelText(/Invest this round/), { target: { value: '1000' } });
        fireEvent.click(screen.getByRole('button', { name: /INVEST NOW|^Invest/ }));

        // During the chart: stake out of Main, Profit unchanged, no result yet
        expect(await within(wallets).findByTestId('in-trade')).toHaveTextContent('₹1,000 in trade');
        await waitFor(() => expect(wallets).toHaveTextContent('₹9,000'));
        expect(wallets).toHaveTextContent(profitBefore);
        expect(screen.queryByTestId('round-result')).not.toBeInTheDocument();
        expect(screen.queryByTestId('vip-level-up')).not.toBeInTheDocument();
        // ...while the game state already holds the settled result (logged at the tap)
        expect(savedGame().game.rounds[1]).toMatchObject({ amount: 1000, gain: 80 });

        // When the chart ends: result card, Main back to ₹10,000, gain in Profit
        expect(await screen.findByTestId('round-result', {}, { timeout: 3000 })).toHaveTextContent(
          '+₹80',
        );
        expect(within(wallets).queryByTestId('in-trade')).not.toBeInTheDocument();
        await waitFor(() => {
          expect(wallets).toHaveTextContent('₹10,000');
          // fraud: the ₹500 bonus unlocks with the first deposit
          expect(wallets).toHaveTextContent('₹580'); // 500 bonus + 80 gain in both skins
        });
      } finally {
        ECONOMY.rounds.chartMs = 20;
      }
    });
  }
});

describe('honest skin cash-out', () => {
  it('processes instantly and moves straight on to the sliders (no extra screen)', async () => {
    const a = gameAssignment({ app_version: 'plain' });
    const api = installFakeApi(apiAssignment(a));
    seedGame('g:cashout', a);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Withdraw everything/ }));
    await waitForStep('g:react:7');
    expect(savedGame().game.cashout).toBe('done');
    expect(await logged(api, 'cashout')).toHaveLength(1);
  });
});
