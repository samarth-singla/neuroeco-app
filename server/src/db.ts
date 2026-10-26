import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type DB = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS participants (
  participant_id   TEXT PRIMARY KEY,
  created_at       TEXT NOT NULL,
  consented        INTEGER NOT NULL DEFAULT 1,
  app_version      TEXT NOT NULL CHECK (app_version IN ('plain', 'fraud')),
  round1_outcome   TEXT NOT NULL CHECK (round1_outcome IN ('small_win', 'flat')),
  withdrawal_offer TEXT NOT NULL CHECK (withdrawal_offer IN ('allowed', 'not_offered')),
  referral_source  TEXT NOT NULL CHECK (referral_source IN ('friend', 'ad')),
  money_source     TEXT NOT NULL CHECK (money_source IN ('profit', 'own')),
  stake_order      TEXT NOT NULL,
  current_step     TEXT NOT NULL DEFAULT 'app:A1',
  completed_at     TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id TEXT NOT NULL REFERENCES participants(participant_id),
  ts             INTEGER NOT NULL,
  client_ts      REAL,
  screen         TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  payload        TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_participant ON events(participant_id);

CREATE TABLE IF NOT EXISTS responses (
  participant_id TEXT NOT NULL REFERENCES participants(participant_id),
  item_id        TEXT NOT NULL,
  value          TEXT,
  answered_at    TEXT NOT NULL,
  PRIMARY KEY (participant_id, item_id)
);
`;

/** Adds a column if an older database file does not have it yet. */
export function ensureColumn(db: DB, table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function openDb(file: string): DB {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  // Phase 7: participants can withdraw their data on the debrief screen (excluded from every export)
  ensureColumn(db, 'participants', 'withdrawn', 'INTEGER NOT NULL DEFAULT 0');
  // Phase 10: participants who came through a ?pilot=1 link (excluded from analysis)
  ensureColumn(db, 'participants', 'is_pilot', 'INTEGER NOT NULL DEFAULT 0');
  return db;
}
