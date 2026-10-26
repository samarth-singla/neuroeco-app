import { randomUUID } from 'node:crypto';
import type { DB } from './db';
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
function levelCounts(db: DB, isPilot: number): LevelCounts {
  const counts: LevelCounts = {};
  for (const factor of Object.keys(FACTORS) as FactorName[]) {
    // factor names are fixed constants, never user input
    const rows = db
      .prepare(
        `SELECT ${factor} AS level, COUNT(*) AS n FROM participants WHERE is_pilot = ? GROUP BY ${factor}`,
      )
      .all(isPilot) as { level: string; n: number }[];
    counts[factor] = Object.fromEntries(rows.map((r) => [r.level, r.n]));
  }
  return counts;
}

export function createParticipant(db: DB, rng: Rng = Math.random, pilot = false): ParticipantRow {
  // A transaction makes count + insert atomic, so parallel sign-ups cannot unbalance groups.
  const tx = db.transaction(() => {
    const assignment = assignFactors(levelCounts(db, pilot ? 1 : 0), rng);
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
    db.prepare(
      `INSERT INTO participants (participant_id, created_at, consented, app_version, round1_outcome,
         withdrawal_offer, referral_source, money_source, stake_order, current_step, completed_at, is_pilot)
       VALUES (@participant_id, @created_at, @consented, @app_version, @round1_outcome,
         @withdrawal_offer, @referral_source, @money_source, @stake_order, @current_step, @completed_at, @is_pilot)`,
    ).run(row);
    return row;
  });
  return tx();
}

export function getParticipant(db: DB, id: string): ParticipantRow | undefined {
  return db.prepare('SELECT * FROM participants WHERE participant_id = ?').get(id) as
    ParticipantRow | undefined;
}

/** Debrief "withdraw my data": the participant is kept but excluded from all exports. */
export function withdrawParticipant(db: DB, id: string): void {
  db.prepare('UPDATE participants SET withdrawn = 1 WHERE participant_id = ?').run(id);
}

export function setStep(db: DB, id: string, step: string): void {
  db.prepare('UPDATE participants SET current_step = ? WHERE participant_id = ?').run(step, id);
  if (COMPLETED_STEPS.has(step)) {
    db.prepare(
      'UPDATE participants SET completed_at = ? WHERE participant_id = ? AND completed_at IS NULL',
    ).run(new Date().toISOString(), id);
  }
}

export function insertEvents(db: DB, participantId: string, events: EventInput[]): number {
  const stmt = db.prepare(
    `INSERT INTO events (participant_id, ts, client_ts, screen, event_type, payload)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction((list: EventInput[]) => {
    const now = Date.now();
    for (const e of list) {
      stmt.run(
        participantId,
        now,
        e.client_ts ?? null,
        e.screen,
        e.event_type,
        e.payload === undefined ? null : JSON.stringify(e.payload),
      );
    }
  });
  tx(events);
  return events.length;
}

export function upsertResponses(db: DB, participantId: string, responses: ResponseInput[]): number {
  // DECISION: one row per (participant, item). Re-answering an item keeps the latest answer.
  const stmt = db.prepare(
    `INSERT INTO responses (participant_id, item_id, value, answered_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (participant_id, item_id) DO UPDATE SET value = excluded.value, answered_at = excluded.answered_at`,
  );
  const tx = db.transaction((list: ResponseInput[]) => {
    const now = new Date().toISOString();
    for (const r of list) {
      stmt.run(participantId, r.item_id, r.value === null ? null : String(r.value), now);
    }
  });
  tx(responses);
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
