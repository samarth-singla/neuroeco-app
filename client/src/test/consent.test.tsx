import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { Countdown } from '../game/ui/kit';
import { _resetLogger } from '../lib/logger';
import { installFakeApi } from './fakeApi';
import { apiAssignment, gameAssignment, savedGame } from './gameSeed';

type Calls = { mock: { calls: [string, RequestInit?][] } };
const created = () =>
  (fetch as unknown as Calls).mock.calls.filter(
    ([url, init]) => url === '/api/participants' && init?.method === 'POST',
  );

beforeEach(() => {
  sessionStorage.clear();
  _resetLogger();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.history.replaceState({}, '', '/');
});

describe('consent (start of the game)', () => {
  it('does not reveal the fraud framing', async () => {
    installFakeApi(apiAssignment(gameAssignment()));
    render(<App />);
    await screen.findByRole('button', { name: 'Agree and start' });
    expect(document.body.textContent).not.toMatch(/fraud|scam/i);
  });

  it('needs both boxes; agreeing creates the player and starts the profile', async () => {
    installFakeApi(apiAssignment(gameAssignment()));
    render(<App />);
    const start = await screen.findByRole('button', { name: 'Agree and start' });
    const [age, agree] = screen.getAllByRole('checkbox');
    fireEvent.click(age);
    expect(start).toBeDisabled();
    fireEvent.click(agree);
    fireEvent.click(start);
    await waitFor(() => expect(savedGame().game.step).toBe('g:profile:0'));
    expect(created()).toHaveLength(1);
    expect(JSON.parse(String(created()[0][1]!.body))).toEqual({ consented: true, pilot: false });
  });

  it('declining ends politely and creates no record', async () => {
    installFakeApi(apiAssignment(gameAssignment()));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'I do not want to take part' }));
    expect(screen.getByText(/No information about you has been recorded/)).toBeInTheDocument();
    expect(created()).toHaveLength(0);
  });

  it('a ?pilot=1 link creates a pilot player', async () => {
    window.history.replaceState({}, '', '/?pilot=1');
    installFakeApi(apiAssignment(gameAssignment()));
    render(<App />);
    await screen.findByRole('button', { name: 'Agree and start' });
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Agree and start' }));
    await waitFor(() => expect(created()).toHaveLength(1));
    expect(JSON.parse(String(created()[0][1]!.body))).toEqual({ consented: true, pilot: true });
  });
});

describe('countdown (H1a) never blocks', () => {
  it('ticks down, shows the reset label at zero, then restarts', () => {
    vi.useFakeTimers();
    const onReset = vi.fn();
    render(<Countdown seconds={5} resetLabel="New slots opening…" onReset={onReset} />);
    expect(screen.getByTestId('countdown')).toHaveTextContent('00:05');
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByTestId('countdown')).toHaveTextContent('00:03');
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByTestId('countdown')).toHaveTextContent('New slots opening…');
    expect(onReset).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByTestId('countdown')).toHaveTextContent('00:05');
  });
});
