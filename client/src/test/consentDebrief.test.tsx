import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { _resetLogger } from '../lib/logger';
import { DEBRIEF, THANKS } from '../config/study';
import { installFakeApi } from './fakeApi';
import { makeAssignment, seedAt } from './seed';

const btn = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  sessionStorage.clear();
  _resetLogger();
});
afterEach(() => vi.unstubAllGlobals());

describe('consent', () => {
  it('does not reveal the fraud framing', async () => {
    installFakeApi(makeAssignment());
    render(<App />);
    await screen.findByRole('button', { name: 'Agree and start' });
    expect(document.body.textContent).not.toMatch(/fraud|scam/i);
  });

  it('requires both boxes (18+ and agree) before starting', async () => {
    installFakeApi(makeAssignment());
    render(<App />);
    const start = await screen.findByRole('button', { name: 'Agree and start' });
    expect(start).toBeDisabled();
    const [age, agree] = screen.getAllByRole('checkbox');
    fireEvent.click(age);
    expect(start).toBeDisabled();
    fireEvent.click(agree);
    expect(start).toBeEnabled();
  });

  it('declining ends politely and creates no record', async () => {
    installFakeApi(makeAssignment());
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'I do not want to take part' }));
    expect(screen.getByText(/No information about you has been recorded/)).toBeInTheDocument();
    const calls = (fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls;
    expect(
      calls.some(([url, init]) => url === '/api/participants' && init?.method === 'POST'),
    ).toBe(false);
  });
});

describe('debrief', () => {
  it('fraud version: says they saw the fraud-style version and lists the features', async () => {
    installFakeApi(makeAssignment({ app_version: 'fraud' }));
    seedAt('debrief', makeAssignment({ app_version: 'fraud' }));
    render(<App />);
    expect(await screen.findByText(DEBRIEF.fraudVersion)).toBeInTheDocument();
    for (const f of [
      'Countdown timer',
      'Fake scarcity',
      'VIP tiers',
      'Mentor chat',
      'Withdrawal "tax"',
    ]) {
      expect(screen.getByText(`${f}:`)).toBeInTheDocument();
    }
    expect(screen.getByText(/cybercrime\.gov\.in/)).toBeInTheDocument();
    expect(screen.getByText(/Never pay a fee/)).toBeInTheDocument();
  });

  it('plain version: explains that others saw the fraud-style version', async () => {
    installFakeApi(makeAssignment({ app_version: 'plain' }));
    seedAt('debrief', makeAssignment({ app_version: 'plain' }));
    render(<App />);
    expect(await screen.findByText(DEBRIEF.plainVersion)).toBeInTheDocument();
  });

  it('withdrawing data marks the participant and shows the withdrawn thank-you', async () => {
    const api = installFakeApi(makeAssignment());
    seedAt('debrief', makeAssignment());
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: DEBRIEF.withdrawCta }));
    fireEvent.click(btn(DEBRIEF.withdrawYes));
    expect(await screen.findByText(THANKS.withdrawnBody)).toBeInTheDocument();
    expect(api.withdrawn).toBe(true);
    expect(api.steps.at(-1)).toBe('thanks');
  });

  it('finishing without withdrawing shows the normal thank-you', async () => {
    const api = installFakeApi(makeAssignment());
    seedAt('debrief', makeAssignment());
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: DEBRIEF.continueCta }));
    expect(await screen.findByText(THANKS.body)).toBeInTheDocument();
    expect(api.withdrawn).toBe(false);
  });
});
