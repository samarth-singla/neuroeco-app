import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { basicAuth, makeApp } from './helpers';

describe('data withdrawal (debrief)', () => {
  it('marks the participant withdrawn and excludes them from every export', async () => {
    const { app, db } = makeApp();
    const keep = (await request(app).post('/api/participants').send({ consented: true })).body;
    const leave = (await request(app).post('/api/participants').send({ consented: true })).body;
    for (const p of [keep, leave]) {
      await request(app)
        .post('/api/events')
        .send({
          participant_id: p.participant_id,
          events: [{ screen: 'A1', event_type: 'screen_view' }],
        })
        .expect(200);
      await request(app)
        .post('/api/responses')
        .send({ participant_id: p.participant_id, responses: [{ item_id: 'crt_1', value: 5 }] })
        .expect(200);
    }

    await request(app).post(`/api/participants/${leave.participant_id}/withdraw`).expect(200);
    const row = db
      .prepare('SELECT withdrawn FROM participants WHERE participant_id = ?')
      .get(leave.participant_id) as { withdrawn: number };
    expect(row.withdrawn).toBe(1);

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

  it('returns 404 for unknown participants', async () => {
    const { app } = makeApp();
    await request(app)
      .post('/api/participants/00000000-0000-0000-0000-000000000000/withdraw')
      .expect(404);
  });
});
