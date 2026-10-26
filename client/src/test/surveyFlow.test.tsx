import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App';
import { _resetLogger } from '../lib/logger';
import {
  MONEY_TEXT,
  OPTIONAL_ITEM_IDS,
  REFERRAL_TEXT,
  SURVEY_ITEM_IDS,
  surveyPages,
} from '../config/survey';
import { installFakeApi } from './fakeApi';
import { makeAssignment, seedAt } from './seed';
import { answerPageItems, clickNext } from './answer';

beforeEach(() => {
  sessionStorage.clear();
  _resetLogger();
});
afterEach(() => vi.unstubAllGlobals());

describe('general survey content', () => {
  it('has the same item ids in every condition', () => {
    const a = surveyPages({
      referral_source: 'ad',
      money_source: 'own',
      stake_order: [50000, 500, 5000],
    });
    const ids = a.flatMap((p) => p.items.map((i) => i.id)).sort();
    expect(ids).toEqual([...SURVEY_ITEM_IDS].sort());
  });

  it('covers every block in the plan', () => {
    for (const id of [
      'crt_1',
      'crt_2',
      'crt_3',
      'la_gain_50',
      'la_gain_300',
      'h3_stake_500_willing',
      'h3_stake_5000_verify',
      'h3_stake_50000_willing',
      'h5_join_willing',
      'h5_verify',
      'herd_1',
      'herd_5',
      'h7_reinvest_willing',
      'h7_reinvest_amount',
      'lit_interest',
      'lit_inflation',
      'lit_diversification',
      'lit_self',
      'sus_1',
      'sus_5',
      'exp_fin_edu',
      'exp_investing',
      'exp_trading_app',
      'exp_scam',
      'demo_age',
      'demo_gender',
      'demo_income',
      'demo_field',
    ]) {
      expect(SURVEY_ITEM_IDS).toContain(id);
    }
    expect(OPTIONAL_ITEM_IDS).toEqual(['comments']);
  });
});

describe('general survey flow', () => {
  const cases = [
    makeAssignment({
      referral_source: 'friend',
      money_source: 'profit',
      stake_order: [50000, 500, 5000],
    }),
    makeAssignment({ referral_source: 'ad', money_source: 'own', stake_order: [5000, 50000, 500] }),
  ];

  for (const a of cases) {
    it(`${a.referral_source} / ${a.money_source} / stakes ${a.stake_order.join(',')}`, async () => {
      const api = installFakeApi(a);
      seedAt('survey:0', a);
      render(<App />);
      const pages = surveyPages(a);

      // CRT page: required numbers
      await screen.findByText('Three quick puzzles');
      clickNext();
      expect(screen.getAllByText('Please answer this question.')).toHaveLength(3);

      const stakeTitlesSeen: number[] = [];
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        await screen.findByText(`${i + 1} / ${pages.length}`);
        if (page.id.startsWith('h3_stake_')) stakeTitlesSeen.push(Number(page.id.slice(9)));
        if (page.id === 'h5_referral') {
          expect(screen.getByText(REFERRAL_TEXT[a.referral_source])).toBeInTheDocument();
        }
        if (page.id === 'h7_money_source') {
          expect(screen.getByText(MONEY_TEXT[a.money_source].intro)).toBeInTheDocument();
        }
        if (page.id === 'demographics') {
          // Age below 18 is not accepted
          const age = within(document.querySelector<HTMLElement>('[data-item="demo_age"]')!);
          fireEvent.change(age.getByRole('textbox'), { target: { value: '12' } });
          clickNext();
          expect(screen.getAllByText('Please answer this question.').length).toBeGreaterThan(0);
        }
        answerPageItems(page);
        clickNext();
      }

      await screen.findByText('About this study');
      expect(stakeTitlesSeen).toEqual(a.stake_order);
      const required = SURVEY_ITEM_IDS.filter((id) => !OPTIONAL_ITEM_IDS.includes(id));
      for (const id of required) expect(api.responses, id).toHaveProperty(id);
      expect(api.responses).not.toHaveProperty('comments');
      expect(api.responses.h7_reinvest_amount).toBe(1000);
      expect(api.steps.at(-1)).toBe('debrief');
    });
  }
});
