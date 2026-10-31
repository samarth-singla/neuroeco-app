import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeApp } from './helpers';
import { all } from '../src/db';
import { shuffledDeals, shuffledSpins } from '../src/randomize';
import { ECONOMY, SPINS } from '../../client/src/config/game';

const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

describe('game order factors', () => {
  it('deal and spin orders are permutations of the configured amounts', () => {
    for (let i = 0; i < 30; i++) {
      expect(sorted(shuffledDeals())).toEqual(sorted(ECONOMY.deals.sizes));
      expect(sorted(shuffledSpins())).toEqual(sorted(SPINS.gains));
    }
  });

  it('every new participant gets both orders, and all orders occur', async () => {
    const { app, db } = await makeApp();
    const firstDeals = new Set<number>();
    const firstSpins = new Set<number>();
    for (let i = 0; i < 60; i++) {
      const p = (await request(app).post('/api/participants').send({ consented: true })).body;
      expect(sorted(p.assignment.deal_order)).toEqual(sorted(ECONOMY.deals.sizes));
      expect(sorted(p.assignment.spin_order)).toEqual(sorted(SPINS.gains));
      firstDeals.add(p.assignment.deal_order[0]);
      firstSpins.add(p.assignment.spin_order[0]);
    }
    expect(firstDeals.size).toBe(3);
    expect(firstSpins.size).toBeGreaterThanOrEqual(5);
    const rows = await all<{ deal_order: string }>(db, 'SELECT deal_order FROM participants');
    expect(rows.every((r) => r.deal_order.split(',').length === 3)).toBe(true);
  });

  it('marks completion when the game report card is reached', async () => {
    const { app, db } = await makeApp();
    const p = (await request(app).post('/api/participants').send({ consented: true })).body;
    await request(app)
      .post(`/api/participants/${p.participant_id}/step`)
      .send({ step: 'g:report' })
      .expect(200);
    const [row] = await all<{ completed_at: string | null }>(
      db,
      'SELECT completed_at FROM participants WHERE participant_id = ?',
      [p.participant_id],
    );
    expect(row.completed_at).not.toBeNull();
  });
});
