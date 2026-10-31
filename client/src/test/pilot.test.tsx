import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { _resetLogger } from '../lib/logger';
import { installFakeApi } from './fakeApi';
import { makeAssignment } from './seed';

type Calls = { mock: { calls: [string, RequestInit?][] } };

async function agree() {
  render(<App />);
  await screen.findByRole('button', { name: 'Agree and start' });
  for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
  fireEvent.click(screen.getByRole('button', { name: 'Agree and start' }));
  await screen.findByRole('button', { name: 'Continue' });
  const calls = (fetch as unknown as Calls).mock.calls;
  const create = calls.find(
    ([url, init]) => url === '/api/participants' && init?.method === 'POST',
  );
  return JSON.parse(String(create![1]!.body));
}

beforeEach(() => {
  sessionStorage.clear();
  _resetLogger();
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/?game=0');
});

describe('pilot link', () => {
  it('?pilot=1 creates a pilot participant', async () => {
    window.history.replaceState({}, '', '/?pilot=1&game=0');
    installFakeApi(makeAssignment());
    expect(await agree()).toEqual({ consented: true, pilot: true });
  });

  it('a normal link creates a real participant', async () => {
    installFakeApi(makeAssignment());
    expect(await agree()).toEqual({ consented: true, pilot: false });
  });
});
