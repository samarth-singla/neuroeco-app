import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { basicAuth, makeApp } from './helpers';

/** Splits one CSV line, respecting quoted fields (stake_order contains commas). */
function cells(line: string): string[] {
  const out: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cell);
      cell = '';
    } else cell += ch;
  }
  out.push(cell);
  return out;
}

const BOM = String.fromCharCode(0xfeff);

/** Value of `column` for the row of `participantId` in a CSV export. */
function valueOf(csv: string, participantId: string, column: string): string {
  const [header, ...rows] = csv.replace(BOM, '').split('\r\n');
  const col = cells(header).indexOf(column);
  const row = rows.find((l) => l.startsWith(participantId));
  if (col < 0 || !row) throw new Error(`no ${column} for ${participantId}`);
  return cells(row)[col];
}

describe('pilot mode (?pilot=1)', () => {
  it('tags pilot participants and exports the flag', async () => {
    const { app } = makeApp();
    const pilot = (
      await request(app).post('/api/participants').send({ consented: true, pilot: true })
    ).body;
    const real = (await request(app).post('/api/participants').send({ consented: true })).body;
    for (const p of [pilot, real]) {
      await request(app)
        .post(`/api/participants/${p.participant_id}/step`)
        .send({ step: 'debrief' });
    }
    const get = async (file: string) =>
      (await request(app).get(`/api/export/${file}`).set('Authorization', basicAuth())).text;

    const participants = await get('participants.csv');
    expect(valueOf(participants, pilot.participant_id, 'is_pilot')).toBe('1');
    expect(valueOf(participants, real.participant_id, 'is_pilot')).toBe('0');

    const wide = await get('wide.csv');
    expect(valueOf(wide, pilot.participant_id, 'is_pilot')).toBe('1');
    expect(valueOf(wide, real.participant_id, 'is_pilot')).toBe('0');

    const admin = await request(app).get('/admin').set('Authorization', basicAuth());
    expect(admin.text).toMatch(/Pilot participants[^<]*<\/th><td><b>1</);
  });

  it('does not let pilot participants unbalance the real sample', async () => {
    const { app, db } = makeApp();
    for (let i = 0; i < 7; i++) {
      await request(app).post('/api/participants').send({ consented: true, pilot: true });
    }
    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/participants').send({ consented: true });
    }
    const rows = db
      .prepare(
        'SELECT app_version, COUNT(*) AS n FROM participants WHERE is_pilot = 0 GROUP BY app_version',
      )
      .all() as { app_version: string; n: number }[];
    expect(rows.map((r) => r.n)).toEqual([5, 5]);
  });
});
