/**
 * Redesign Phase 4 checks: every mini-game answer is stored in `responses`, and bonus-spin results
 * stay hidden until the report card.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { BRAIN, FEATURES, FOMO, GAME_ITEM_IDS, PROFILE, SLIDERS, TIMING } from '../config/game';
import { _resetLogger, flush } from '../lib/logger';
import { installFakeApi, type FakeApi } from './fakeApi';
import { apiAssignment, gameAssignment, savedGame, seedGame } from './gameSeed';

const SPIN_MS = TIMING.spinMs;
const stored: Record<string, unknown> = {};

beforeAll(() => {
  TIMING.spinMs = 5; // keep the spin animation short in tests
  window.history.replaceState({}, '', '/?game=1');
});
afterAll(() => {
  TIMING.spinMs = SPIN_MS;
  window.history.replaceState({}, '', '/');
  // Across the three stages below, every game response item was stored
  expect(Object.keys(stored).sort()).toEqual([...GAME_ITEM_IDS].sort());
});
beforeEach(() => {
  sessionStorage.clear();
  _resetLogger();
});
afterEach(() => vi.unstubAllGlobals());

const step = () => savedGame().game.step;

async function waitForStep(s: string) {
  await waitFor(() => expect(step()).toBe(s), { timeout: 4000 });
}

/** Re-open the game at another step with the current state, as after a refresh. */
function resumeAt(stepId: string) {
  const g = savedGame();
  cleanup();
  seedGame(stepId, g.assignment, g.game);
  render(<App />);
}

async function responsesSaved(api: FakeApi, ids: string[]) {
  await waitFor(() => {
    for (const id of ids) expect(api.responses, id).toHaveProperty(id);
  });
  Object.assign(stored, api.responses);
}

for (const skin of ['fraud', 'plain'] as const) {
  describe(`${skin} skin`, () => {
    it('S1 profile: answers stored, then the home dashboard', async () => {
      const a = gameAssignment({ app_version: skin });
      const api = installFakeApi(apiAssignment(a));
      seedGame('g:profile:0', a);
      render(<App />);
      for (let i = 0; i < PROFILE.length; i++) {
        await waitForStep(`g:profile:${i}`);
        const q = PROFILE[i];
        if (q.kind === 'scale') fireEvent.click(await screen.findByRole('radio', { name: '6' }));
        else fireEvent.click((await screen.findAllByRole('radio'))[0]);
      }
      fireEvent.click(await screen.findByRole('button', { name: /Start earning|Continue/ }));
      await waitForStep('g:home');
      await responsesSaved(
        api,
        PROFILE.map((q) => q.id),
      );
      expect(api.responses.lit_self).toBe(6);
    });

    it('S2 spins: two pop-ups over the game (₹150 / ₹250), results not shown', async () => {
      const a = gameAssignment({ app_version: skin, spin_order: [250, 150] });
      const api = installFakeApi(apiAssignment(a));
      seedGame('g:spin:0', a);
      render(<App />);
      // a pop-up over the (inert) trading screen, not a separate page
      expect(await screen.findByRole('dialog')).toHaveTextContent('win ₹250');
      expect(document.querySelector('[inert]')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /SPIN NOW|Accept this offer/ }));
      expect(document.body.textContent).not.toMatch(/you (won|lost)|result: (win|lose)/i);
      await waitForStep('g:round:1');

      resumeAt('g:spin:1');
      expect(await screen.findByRole('dialog')).toHaveTextContent('win ₹150');
      fireEvent.click(screen.getByRole('button', { name: /No thanks|Skip this offer/ }));
      expect(document.body.textContent).not.toMatch(/you (won|lost)|result: (win|lose)/i);
      await waitForStep('g:round:3');

      const spins = savedGame().game.spins;
      expect(spins.map((x) => [x.gain, x.accepted])).toEqual([
        [250, true],
        [150, false],
      ]);
      expect(['win', 'lose']).toContain(spins[0].outcome);
      await responsesSaved(api, ['la_gain_150', 'la_gain_250']);
      expect(api.responses.la_gain_250).toBe('accept');
      expect(api.responses.la_gain_150).toBe('reject');
    });

    it('S5 bonus questions: pop-ups between rounds, answers stored, ₹100 per correct', async () => {
      const a = gameAssignment({ app_version: skin });
      const api = installFakeApi(apiAssignment(a));
      // bonus question k pops up before this round / screen
      const after = ['g:round:2', skin === 'fraud' ? 'g:chat' : 'g:round:4', 'g:deal'];
      async function answer(i: number) {
        await waitForStep(`g:brain:${i}`);
        expect(await screen.findByRole('dialog', { name: 'Bonus question' })).toBeInTheDocument();
        const q = BRAIN[i];
        if (q.kind === 'number') {
          fireEvent.change(await screen.findByRole('textbox'), { target: { value: '5' } });
          fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
        } else {
          fireEvent.click(
            await screen.findByRole('radio', {
              name: (q as { options: { label: string }[] }).options[0].label,
            }),
          );
        }
        fireEvent.click(await screen.findByRole('button', { name: /Back to trading/ }));
      }
      seedGame('g:brain:0', a);
      render(<App />);
      await answer(0);
      await waitForStep(after[0]);
      resumeAt('g:brain:1');
      await answer(1);
      await answer(2);
      await waitForStep(after[1]);
      resumeAt('g:brain:3');
      await answer(3);
      await waitForStep(after[2]);
      // crt_1 = ₹5 correct + lit_interest "more" correct = ₹200; honest bonus ₹500 in Profit
      expect(savedGame().game.wallets.profit).toBe(200 + (skin === 'plain' ? 500 : 0));
      await responsesSaved(
        api,
        BRAIN.map((q) => q.id),
      );
      await act(async () => {
        await flush();
      });
      const brainEvents = api.events.filter((e) => e.event_type === 'brain_answer');
      expect(brainEvents).toHaveLength(4);
      expect(typeof brainEvents[0].payload?.ms).toBe('number');
    });

    it(`S13 quick reactions: ${skin === 'fraud' ? 'swipe cards, ' : ''}sliders and FOMO cards stored`, async () => {
      const a = gameAssignment({ app_version: skin });
      const api = installFakeApi(apiAssignment(a));
      // the honest skin skips the 7 feature swipe cards
      let i = skin === 'fraud' ? 0 : FEATURES.length;
      seedGame(`g:react:${i}`, a);
      render(<App />);
      for (const f of skin === 'fraud' ? FEATURES : []) {
        await waitForStep(`g:react:${i++}`);
        expect((await screen.findAllByText(f.label[skin])).length).toBeGreaterThan(0);
        fireEvent.click(await screen.findByRole('button', { name: i % 2 ? /Yes/ : /No/ }));
      }
      for (const q of SLIDERS) {
        await waitForStep(`g:react:${i++}`);
        const next = await screen.findByRole('button', { name: 'Next' });
        expect(next).toBeDisabled(); // must touch the slider first
        fireEvent.change(document.getElementById(q.id)!, { target: { value: '3' } });
        fireEvent.click(next);
      }
      for (let k = 0; k < FOMO.length; k++) {
        await waitForStep(`g:react:${i++}`);
        fireEvent.click(await screen.findByRole('button', { name: /Agree →/ }));
      }
      await waitForStep('g:report');
      await responsesSaved(api, [
        ...(skin === 'fraud' ? FEATURES.map((f) => `feature_push_${f.id}`) : []),
        ...SLIDERS.map((q) => q.id),
        ...FOMO.map((q) => q.id),
      ]);
      expect(api.responses.app_trust).toBe(3);
      if (skin === 'fraud') expect(api.responses.feature_push_timer).toBe('yes');
      else expect(api.responses).not.toHaveProperty('feature_push_timer');
      expect(api.responses.fomo_1).toBe('agree');
    });
  });
}
