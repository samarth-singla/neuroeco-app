/**
 * Redesign Phase 4 checks: every mini-game answer is stored in `responses`, and bonus-spin results
 * stay hidden until the report card.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import {
  BRAIN,
  FEATURES,
  FOMO,
  GAME_ITEM_IDS,
  PROFILE,
  SLIDERS,
  SPINS,
  TIMING,
} from '../config/game';
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

async function responsesSaved(api: FakeApi, ids: string[]) {
  await waitFor(() => {
    for (const id of ids) expect(api.responses, id).toHaveProperty(id);
  });
  Object.assign(stored, api.responses);
}

for (const skin of ['fraud', 'plain'] as const) {
  describe(`${skin} skin`, () => {
    it('S1 profile and S2 spins: answers stored, spin results not shown', async () => {
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

      for (let i = 0; i < SPINS.gains.length; i++) {
        await waitForStep(`g:spin:${i}`);
        const accept = i % 2 === 0;
        fireEvent.click(
          await screen.findByRole('button', {
            name: accept ? /SPIN NOW|Accept this offer/ : /No thanks|Skip this offer/,
          }),
        );
        // The outcome is drawn but never displayed before the report card
        expect(document.body.textContent).not.toMatch(/you (won|lost)|result: (win|lose)/i);
      }
      await waitForStep('g:home');

      const spins = savedGame().game.spins;
      expect(spins).toHaveLength(6);
      expect(
        spins.filter((s) => s.accepted).every((s) => s.outcome === 'win' || s.outcome === 'lose'),
      ).toBe(true);
      await responsesSaved(api, [
        ...PROFILE.map((q) => q.id),
        ...SPINS.gains.map((g) => `la_gain_${g}`),
      ]);
      expect(api.responses.la_gain_50).toBe('accept');
      expect(api.responses.la_gain_100).toBe('reject');
      expect(api.responses.lit_self).toBe(6);
    });

    it('S5 brain bonus: answers stored and correct answers pay ₹100', async () => {
      const a = gameAssignment({ app_version: skin });
      const api = installFakeApi(apiAssignment(a));
      seedGame('g:brain:0', a);
      render(<App />);
      const answers: Record<string, string> = { crt_1: '5', crt_2: '100', crt_3: '47' };
      for (let i = 0; i < BRAIN.length; i++) {
        await waitForStep(`g:brain:${i}`);
        const q = BRAIN[i];
        if (q.kind === 'number') {
          fireEvent.change(await screen.findByRole('textbox'), {
            target: { value: answers[q.id] },
          });
          fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
        } else {
          fireEvent.click(
            await screen.findByRole('radio', {
              name: (q as { options: { label: string }[] }).options[0].label,
            }),
          );
        }
        fireEvent.click(
          await screen.findByRole('button', { name: /Next question|Back to trading/ }),
        );
      }
      await waitForStep('g:round:4');
      // crt_1 and crt_3 correct (₹200) + lit_interest "more" correct (₹100); honest bonus ₹500 in Profit
      expect(savedGame().game.wallets.profit).toBe(300 + (skin === 'plain' ? 500 : 0));
      await responsesSaved(
        api,
        BRAIN.map((q) => q.id),
      );
      await act(async () => {
        await flush();
      });
      const brainEvents = api.events.filter((e) => e.event_type === 'brain_answer');
      expect(brainEvents).toHaveLength(6);
      expect(typeof brainEvents[0].payload?.ms).toBe('number');
    });

    it('S13 quick reactions: swipe cards, sliders and FOMO cards all stored', async () => {
      const a = gameAssignment({ app_version: skin });
      const api = installFakeApi(apiAssignment(a));
      seedGame('g:react:0', a);
      render(<App />);
      let i = 0;
      for (const f of FEATURES) {
        await waitForStep(`g:react:${i++}`);
        expect(screen.getAllByText(f.label[skin]).length).toBeGreaterThan(0);
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
        ...FEATURES.map((f) => `feature_push_${f.id}`),
        ...SLIDERS.map((q) => q.id),
        ...FOMO.map((q) => q.id),
      ]);
      expect(api.responses.app_trust).toBe(3);
      expect(api.responses.feature_push_timer).toBe('yes');
      expect(api.responses.fomo_1).toBe('agree');
    });
  });
}
