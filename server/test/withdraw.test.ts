import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { basicAuth, makeApp } from './helpers';
import { get, run } from '../src/db';

/**
 * The app no longer offers "withdraw my data". The `withdrawn` column stays (default 0) so rows
 * withdrawn before the option was removed are still left out of every export.
 */
describe('legacy data-withdrawal flag', () => {
  it('new participants start with withdrawn = 0', async () => {
    const { app, db } = await makeApp();
    const p = (await request(app).post('/api/participants').send({ consented: true })).body;
    const row = (await get<{ withdrawn: number }>(
      db,
      'SELECT withdrawn FROM participants WHERE participant_id = ?',
      [p.participant_id],
    ))!;
    expect(row.withdrawn).toBe(0);
  });

  it('rows flagged withdrawn are excluded from every export', async () => {
    const { app, db } = await makeApp();
    const keep = (await request(app).post('/api/participants').send({ consented: true })).body;
    const leave = (await request(app).post('/api/participants').send({ consented: true })).body;
    for (const p of [keep, leave]) {
      await request(app)
        .post('/api/events')
        .send({
          participant_id: p.participant_id,
          events: [{ screen: 'g:home', event_type: 'screen_view' }],
        })
        .expect(200);
      await request(app)
        .post('/api/responses')
        .send({ participant_id: p.participant_id, responses: [{ item_id: 'crt_1', value: 5 }] })
        .expect(200);
    }
    await run(db, 'UPDATE participants SET withdrawn = 1 WHERE participant_id = ?', [
      leave.participant_id,
    ]);

    for (const file of ['participants', 'events', 'responses']) {
      const csv = (
        await request(app)
          .get(`/api/export/${file}.csv`)
          .set('Authorization', basicAuth())
          .expect(200)
      ).text;
      expect(csv, file).toContain(keep.participant_id);
      expect(csv, file).not.toContain(leave.participant_id);
    }

    const admin = await request(app).get('/admin').set('Authorization', basicAuth()).expect(200);
    expect(admin.text).toContain('Withdrawn');
  });

  it('participants can no longer withdraw through the API', async () => {
    const { app } = await makeApp();
    const p = (await request(app).post('/api/participants').send({ consented: true })).body;
    await request(app).post(`/api/participants/${p.participant_id}/withdraw`).expect(404);
  });
});
