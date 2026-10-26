import { randomUUID } from 'node:crypto';
import { all, get, run, type DB } from './db';
import {
  assignFactors,
  FACTORS,
  shuffledStakes,
  type Assignment,
  type FactorName,
  type LevelCounts,
  type Rng,
} from './randomize';

export interface ParticipantRow extends Assignment {
  participant_id: string;
  created_at: string;
  consented: number;
  stake_order: string;
  current_step: string;
  completed_at: string | null;
  withdrawn: number;
  is_pilot: number;
}

export interface EventInput {
  client_ts?: number | null;
  screen: string;
  event_type: string;
  payload?: unknown;
}

export interface ResponseInput {
  item_id: string;
  value: string | number | boolean | null;
}

/** Steps that mean the participant has finished all data collection (survey done). */
export const COMPLETED_STEPS = new Set(['debrief', 'thanks']);

// DECISION: pilot and real participants are balanced separately, so pilot runs never
// unbalance the real sample.
async function levelCounts(db: DB, isPilot: number): Promise<LevelCounts> {
  const counts: LevelCounts = {};
  for (const factor of Object.keys(FACTORS) as FactorName[]) {
    // factor names are fixed constants, never user input
    const rows = await all<{ level: string; n: number }>(
      db,
      `SELECT ${factor} AS level, COUNT(*) AS n FROM participants WHERE is_pilot = ? GROUP BY ${factor}`,
      [isPilot],
    );
    counts[factor] = Object.fromEntries(rows.map((r) => [r.level, Number(r.n)]));
  }
  return counts;
}

// Sign-ups are handled one at a time, so the count-then-insert in createParticipant cannot
// interleave and unbalance the groups.
// DECISION: this in-process queue replaces a database transaction; it is correct because the
// app runs as a single server instance (as documented in the README).
let signupQueue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(fn: () => Promise<T>): Promise<T> {
  const next = signupQueue.then(fn, fn);
  signupQueue = next.catch(() => undefined);
  return next;
}

export function createParticipant(
  db: DB,
  rng: Rng = Math.random,
  pilot = false,
): Promise<ParticipantRow> {
  return oneAtATime(async () => {
    const assignment = assignFactors(await levelCounts(db, pilot ? 1 : 0), rng);
    const row: ParticipantRow = {
      participant_id: randomUUID(),
      created_at: new Date().toISOString(),
      consented: 1,
      ...assignment,
      stake_order: shuffledStakes(rng).join(','),
      current_step: 'app:A1',
      completed_at: null,
      withdrawn: 0,
      is_pilot: pilot ? 1 : 0,
    };
    await run(
      db,
      `INSERT INTO participants (participant_id, created_at, consented, app_version, round1_outcome,
         withdrawal_offer, referral_source, money_source, stake_order, current_step, completed_at, is_pilot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.participant_id,
        row.created_at,
        row.consented,
        row.app_version,
        row.round1_outcome,
        row.withdrawal_offer,
        row.referral_source,
        row.money_source,
        row.stake_order,
        row.current_step,
        row.completed_at,
        row.is_pilot,
      ],
    );
    return row;
  });
}

export function getParticipant(db: DB, id: string): Promise<ParticipantRow | undefined> {
  return get<ParticipantRow>(db, 'SELECT * FROM participants WHERE participant_id = ?', [id]);
}

/** Debrief "withdraw my data": the participant is kept but excluded from all exports. */
export async function withdrawParticipant(db: DB, id: string): Promise<void> {
  await run(db, 'UPDATE participants SET withdrawn = 1 WHERE participant_id = ?', [id]);
}

export async function setStep(db: DB, id: string, step: string): Promise<void> {
  await run(db, 'UPDATE participants SET current_step = ? WHERE participant_id = ?', [step, id]);
  if (COMPLETED_STEPS.has(step)) {
    await run(
      db,
      'UPDATE participants SET completed_at = ? WHERE participant_id = ? AND completed_at IS NULL',
      [new Date().toISOString(), id],
    );
  }
}

export async function insertEvents(
  db: DB,
  participantId: string,
  events: EventInput[],
): Promise<number> {
  if (events.length === 0) return 0;
  const now = Date.now();
  // One batch = one round trip, written atomically
  await db.batch(
    events.map((e) => ({
      sql: `INSERT INTO events (participant_id, ts, client_ts, screen, event_type, payload)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        participantId,
        now,
        e.client_ts ?? null,
        e.screen,
        e.event_type,
        e.payload === undefined ? null : JSON.stringify(e.payload),
      ],
    })),
    'write',
  );
  return events.length;
}

export async function upsertResponses(
  db: DB,
  participantId: string,
  responses: ResponseInput[],
): Promise<number> {
  if (responses.length === 0) return 0;
  const now = new Date().toISOString();
  // DECISION: one row per (participant, item). Re-answering an item keeps the latest answer.
  await db.batch(
    responses.map((r) => ({
      sql: `INSERT INTO responses (participant_id, item_id, value, answered_at) VALUES (?, ?, ?, ?)
            ON CONFLICT (participant_id, item_id)
            DO UPDATE SET value = excluded.value, answered_at = excluded.answered_at`,
      args: [participantId, r.item_id, r.value === null ? null : String(r.value), now],
    })),
    'write',
  );
  return responses.length;
}

/** What the client needs to (re)start a participant. */
export function publicParticipant(p: ParticipantRow) {
  return {
    participant_id: p.participant_id,
    current_step: p.current_step,
    completed: p.completed_at !== null,
    assignment: {
      app_version: p.app_version,
      round1_outcome: p.round1_outcome,
      withdrawal_offer: p.withdrawal_offer,
      referral_source: p.referral_source,
      money_source: p.money_source,
      stake_order: p.stake_order.split(',').map(Number),
    },
  };
}
