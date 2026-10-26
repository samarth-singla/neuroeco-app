import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { basicAuth, makeApp } from './helpers';
import { all, get } from '../src/db';

async function newParticipant(app: Awaited<ReturnType<typeof makeApp>>['app']) {
  const res = await request(app).post('/api/participants').send({ consented: true });
  expect(res.status).toBe(201);
  return res.body as {
    participant_id: string;
    current_step: string;
    assignment: Record<string, unknown>;
  };
}

describe('participants', () => {
  it('requires consent and creates no record without it', async () => {
    const { app, db } = await makeApp();
    const res = await request(app).post('/api/participants').send({ consented: false });
    expect(res.status).toBe(400);
    expect((await get<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM participants'))!.n).toBe(0);
  });

  it('creates a participant with all assignments', async () => {
    const { app } = await makeApp();
    const p = await newParticipant(app);
    expect(p.participant_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.current_step).toBe('app:A1');
    expect(['plain', 'fraud']).toContain(p.assignment.app_version);
    expect(['small_win', 'flat']).toContain(p.assignment.round1_outcome);
    expect(['allowed', 'not_offered']).toContain(p.assignment.withdrawal_offer);
    expect(['friend', 'ad']).toContain(p.assignment.referral_source);
    expect(['profit', 'own']).toContain(p.assignment.money_source);
    expect(p.assignment.stake_order).toHaveLength(3);
  });

  it('resumes and updates the current step', async () => {
    const { app } = await makeApp();
    const p = await newParticipant(app);
    await request(app)
      .post(`/api/participants/${p.participant_id}/step`)
      .send({ step: 'app:A4' })
      .expect(200);
    const res = await request(app).get(`/api/participants/${p.participant_id}`).expect(200);
    expect(res.body.current_step).toBe('app:A4');
    expect(res.body.assignment).toEqual(p.assignment);
    expect(res.body.completed).toBe(false);
  });

  it('marks completion when the debrief step is reached', async () => {
    const { app, db } = await makeApp();
    const p = await newParticipant(app);
    await request(app)
      .post(`/api/participants/${p.participant_id}/step`)
      .send({ step: 'debrief' })
      .expect(200);
    const row = (await get<{ completed_at: string | null }>(
      db,
      'SELECT completed_at FROM participants WHERE participant_id = ?',
      [p.participant_id],
    ))!;
    expect(row.completed_at).not.toBeNull();
  });

  it('returns 404 for unknown participants', async () => {
    const { app } = await makeApp();
    await request(app).get('/api/participants/00000000-0000-0000-0000-000000000000').expect(404);
    await request(app).get('/api/participants/not-a-uuid').expect(404);
  });
});

describe('events and responses', () => {
  it('stores a batch of events with server timestamps', async () => {
    const { app, db } = await makeApp();
    const p = await newParticipant(app);
    const res = await request(app)
      .post('/api/events')
      .send({
        participant_id: p.participant_id,
        events: [
          { client_ts: 12.5, screen: 'A2', event_type: 'screen_view' },
          {
            client_ts: 900,
            screen: 'A2',
            event_type: 'invest_click',
            payload: { plan_id: 'growth' },
          },
        ],
      })
      .expect(200);
    expect(res.body.saved).toBe(2);
    const rows = await all<{
      ts: number;
      payload: string | null;
      event_type: string;
    }>(db, 'SELECT * FROM events ORDER BY id');
    expect(rows.map((r) => r.event_type)).toEqual(['screen_view', 'invest_click']);
    expect(rows[0].ts).toBeGreaterThan(0);
    expect(JSON.parse(rows[1].payload!)).toEqual({ plan_id: 'growth' });
  });

  it('accepts sendBeacon-style text/plain JSON', async () => {
    const { app } = await makeApp();
    const p = await newParticipant(app);
    await request(app)
      .post('/api/events')
      .set('Content-Type', 'text/plain')
      .send(
        JSON.stringify({
          participant_id: p.participant_id,
          events: [{ screen: 'A1', event_type: 'screen_view' }],
        }),
      )
      .expect(200);
  });

  it('rejects bad events', async () => {
    const { app } = await makeApp();
    const p = await newParticipant(app);
    await request(app)
      .post('/api/events')
      .send({
        participant_id: p.participant_id,
        events: [{ screen: 'A1', event_type: 'DROP TABLE' }],
      })
      .expect(400);
    await request(app)
      .post('/api/events')
      .send({
        participant_id: '00000000-0000-0000-0000-000000000000',
        events: [{ screen: 'A1', event_type: 'screen_view' }],
      })
      .expect(404);
  });

  it('upserts responses (latest answer wins)', async () => {
    const { app, db } = await makeApp();
    const p = await newParticipant(app);
    const post = (value: unknown) =>
      request(app)
        .post('/api/responses')
        .send({ participant_id: p.participant_id, responses: [{ item_id: 'crt_1', value }] })
        .expect(200);
    await post(10);
    await post(5);
    const rows = await all(db, 'SELECT item_id, value FROM responses');
    expect(rows).toEqual([{ item_id: 'crt_1', value: '5' }]);
  });
});

describe('admin and export', () => {
  it('requires the admin password', async () => {
    const { app } = await makeApp();
    await request(app).get('/admin').expect(401);
    await request(app).get('/admin').set('Authorization', basicAuth('wrong')).expect(401);
    await request(app).get('/api/export/participants.csv').expect(401);
    const res = await request(app).get('/admin').set('Authorization', basicAuth()).expect(200);
    expect(res.text).toContain('Study admin');
  });

  it('exports raw CSVs', async () => {
    const { app } = await makeApp();
    const p = await newParticipant(app);
    const res = await request(app)
      .get('/api/export/participants.csv')
      .set('Authorization', basicAuth())
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('participant_id,created_at');
    expect(res.text).toContain(p.participant_id);
  });
});
