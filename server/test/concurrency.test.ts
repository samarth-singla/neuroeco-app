import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { makeApp } from './helpers';
import { all } from '../src/db';

describe('simultaneous sign-ups', () => {
  it('stay balanced when 40 participants consent at the same moment', async () => {
    const { app, db } = await makeApp();
    await Promise.all(
      Array.from({ length: 40 }, () =>
        request(app).post('/api/participants').send({ consented: true }).expect(201),
      ),
    );
    for (const f of [
      'app_version',
      'round1_outcome',
      'withdrawal_offer',
      'referral_source',
      'money_source',
    ]) {
      const rows = await all<{ n: number }>(
        db,
        `SELECT COUNT(*) AS n FROM participants GROUP BY ${f}`,
      );
      expect(
        rows.map((r) => r.n),
        f,
      ).toEqual([20, 20]);
    }
  });
});
