import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App';
import { _resetLogger } from '../lib/logger';
import { UIUX_ITEM_IDS } from '../config/survey';
import { installFakeApi } from './fakeApi';
import { makeAssignment, seedAt } from './seed';

beforeEach(() => {
  sessionStorage.clear();
  _resetLogger();
});
afterEach(() => vi.unstubAllGlobals());

/** Answers every Likert question on the current page with `n` and clicks Next. */
async function answerPage(n: number) {
  for (const group of screen.getAllByRole('radiogroup')) {
    fireEvent.click(within(group).getByRole('radio', { name: String(n) }));
  }
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
}

describe('UI/UX survey', () => {
  it('has 7 features × 3 ratings + 2 overall items', () => {
    expect(UIUX_ITEM_IDS).toHaveLength(23);
    expect(UIUX_ITEM_IDS).toContain('uiux_timer_urgency');
    expect(UIUX_ITEM_IDS).toContain('uiux_withdrawal_tax_temptation');
    expect(UIUX_ITEM_IDS).toContain('uiux_overall_trust');
    expect(UIUX_ITEM_IDS).toContain('uiux_overall_urgency');
  });

  for (const version of ['plain', 'fraud'] as const) {
    it(`${version}: shows the participant's own version and saves every rating`, async () => {
      const api = installFakeApi(makeAssignment({ app_version: version }));
      seedAt('uiux:0', makeAssignment({ app_version: version }));
      render(<App />);

      // First page: timer feature. Fraud sees the countdown, plain does not.
      await screen.findByRole('button', { name: 'Next' });
      expect(screen.queryByTestId('countdown') !== null).toBe(version === 'fraud');

      // Required answers: Next without answering keeps the participant on the page.
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getAllByText('Please answer this question.')).toHaveLength(3);

      for (let page = 0; page < 8; page++) {
        await screen.findByText(`${page + 1} / 8`);
        await answerPage((page % 7) + 1);
      }

      await screen.findByText('Three quick puzzles');
      expect(Object.keys(api.responses).sort()).toEqual([...UIUX_ITEM_IDS].sort());
      expect(api.responses.uiux_timer_urgency).toBe(1);
      expect(api.responses.uiux_overall_trust).toBe(1);
    });
  }
});
