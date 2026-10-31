/**
 * Redesign Phase 5 checks: the report card's trap score equals the score computed from the event
 * log (what the export uses); spins are revealed; data withdrawal, sharing and the prize draw work.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { END, PRIZE_DRAW } from '../config/game';
import { finalBalance, formatINR } from '../game/economy';
import { mulberry32, simulateGame } from '../game/sim';
import { factsFromEvents, trapResult } from '../game/traps';
import { _resetLogger, flush } from '../lib/logger';
import { installFakeApi } from './fakeApi';
import { apiAssignment, gameAssignment, savedGame, seedGame } from './gameSeed';

beforeAll(() => window.history.replaceState({}, '', '/?game=1'));
afterAll(() => window.history.replaceState({}, '', '/'));
beforeEach(() => {
  sessionStorage.clear();
  _resetLogger();
});
afterEach(() => vi.unstubAllGlobals());

function playToReport(skin: 'plain' | 'fraud', seed: number) {
  const a = gameAssignment({
    app_version: skin,
    withdrawal_offer: seed % 2 ? 'allowed' : 'not_offered',
  });
  const r = simulateGame(a, mulberry32(seed));
  const { step: _step, ...state } = r.state;
  seedGame('g:report', a, state);
  const exported = trapResult(
    factsFromEvents(
      r.events.map((e) => ({ event_type: e.type, payload: e.payload ?? {} })),
      skin,
    ),
  );
  return { a, r, exported };
}

describe('report card', () => {
  for (const skin of ['fraud', 'plain'] as const) {
    for (const seed of [3, 8, 21, 34]) {
      it(`${skin} #${seed}: on-screen trap score = trap score from the event log`, async () => {
        const { a, r, exported } = playToReport(skin, seed);
        installFakeApi(apiAssignment(a));
        render(<App />);
        const shown = await screen.findByTestId('trap-score');
        expect(Number(shown.textContent)).toBe(exported.score);
        expect(screen.getByText(`/ ${exported.possible}`)).toBeInTheDocument();
        expect(screen.getByTestId('final-balance')).toHaveTextContent(
          formatINR(finalBalance(r.state.wallets, r.state.spins)),
        );
        // every spin is revealed now, with its outcome
        const spins = screen.getByTestId('spin-results');
        expect(spins.querySelectorAll('li')).toHaveLength(6);
        for (const s of r.state.spins.filter((x) => x.accepted)) {
          expect(spins.textContent).toContain(
            s.outcome === 'win' ? `won +₹${s.gain}` : 'lost −₹100',
          );
        }
        expect(screen.getByTestId('safety-tips').textContent).toMatch(
          /cybercrime\.gov\.in or call 1930/,
        );
      });
    }
  }

  it('logs report_shown with the same trap score', async () => {
    const { a, exported } = playToReport('fraud', 5);
    const api = installFakeApi(apiAssignment(a));
    render(<App />);
    await screen.findByTestId('trap-score');
    await waitFor(async () => {
      await act(async () => {
        await flush();
      });
      const ev = api.events.find((e) => e.event_type === 'report_shown');
      expect(ev?.payload?.trap_score).toBe(exported.score);
    });
  });

  it('withdraw my data → server flag set, end screen says so', async () => {
    const { a } = playToReport('plain', 2);
    const api = installFakeApi(apiAssignment(a));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw my data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, withdraw my data' }));
    expect(await screen.findByText(END.withdrawn)).toBeInTheDocument();
    expect(api.withdrawn).toBe(true);
    expect(savedGame().game.step).toBe('g:end');
  });

  it('share screen logs the tap and finishes', async () => {
    const a = gameAssignment();
    const api = installFakeApi(apiAssignment(a));
    seedGame('g:share', a);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Share the challenge/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByText(END.body)).toBeInTheDocument();
    await act(async () => {
      await flush();
    });
    expect(api.events.some((e) => e.event_type === 'share_tap')).toBe(true);
  });

  it('prize draw (when switched on) shows tickets and a code', async () => {
    PRIZE_DRAW.enabled = true;
    try {
      const { a, r } = playToReport('fraud', 13);
      installFakeApi(apiAssignment(a));
      render(<App />);
      const tickets = Math.floor(
        finalBalance(r.state.wallets, r.state.spins) / PRIZE_DRAW.rupeesPerTicket,
      );
      expect(
        await screen.findByText(new RegExp(`Prize draw: ${tickets} ticket`)),
      ).toBeInTheDocument();
      expect(screen.getByText(/^ZT-[0-9A-F]{4}-[0-9A-F]{4}$/)).toBeInTheDocument();
    } finally {
      PRIZE_DRAW.enabled = false;
    }
  });
});
