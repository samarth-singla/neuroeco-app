import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { Countdown } from '../features/Countdown';
import { URGENCY } from '../config/session';
import { _resetLogger, flush } from '../lib/logger';
import { installFakeApi } from './fakeApi';
import { makeAssignment, seedAt } from './seed';

const TIMER_SECONDS = URGENCY.timerSeconds;

beforeEach(() => {
  sessionStorage.clear();
  _resetLogger();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  URGENCY.timerSeconds = TIMER_SECONDS;
});

describe('countdown timer (H1a)', () => {
  it('ticks down, shows "New slots opening…" at zero, then restarts', () => {
    vi.useFakeTimers();
    const onReset = vi.fn();
    render(<Countdown onReset={onReset} />);
    expect(screen.getByTestId('countdown')).toHaveTextContent('03:00');
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByTestId('countdown')).toHaveTextContent('02:50');
    act(() => vi.advanceTimersByTime((URGENCY.timerSeconds - 10) * 1000));
    expect(screen.getByTestId('countdown')).toHaveTextContent(URGENCY.resetLabel);
    expect(onReset).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(URGENCY.resetPauseSeconds * 1000));
    expect(screen.getByTestId('countdown')).toHaveTextContent('03:00');
  });

  it(
    'never blocks progress: both A2 choices still work after the timer runs out',
    { timeout: 10000 },
    async () => {
      URGENCY.timerSeconds = 2; // run out quickly, in real time
      const api = installFakeApi(makeAssignment({ app_version: 'fraud' }));
      seedAt('app:A2', makeAssignment({ app_version: 'fraud' }));
      render(<App />);
      await screen.findByText(URGENCY.resetLabel, {}, { timeout: 4000 });
      expect(screen.getByRole('button', { name: 'Continue without investing' })).toBeEnabled();
      fireEvent.click(screen.getByRole('button', { name: /Growth/ }));
      expect(screen.getByRole('button', { name: 'Invest in this plan' })).toBeEnabled();
      fireEvent.click(screen.getByRole('button', { name: 'Invest in this plan' }));
      expect(await screen.findByText('Make a deposit')).toBeInTheDocument();
      await act(async () => {
        await flush();
      });
      expect(api.events.map((e) => e.event_type)).toContain('timer_reset');
    },
  );
});
