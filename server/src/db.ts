import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient, type Client, type InArgs } from '@libsql/client';

/**
 * Database access through the libSQL client. The same code works with:
 * - a local SQLite file (development, VPS), and
 * - a Turso database over the network (hosts without a persistent disk, e.g. Render free).
 */
export type DB = Client;

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

type Row = Record<string, unknown>;

/** Runs a query and returns plain row objects. */
export async function all<T = Row>(db: DB, sql: string, args: InArgs = []): Promise<T[]> {
  const rs = await db.execute({ sql, args });
  return rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]]))) as T[];
}

/** First row of a query, or undefined. */
export async function get<T = Row>(db: DB, sql: string, args: InArgs = []): Promise<T | undefined> {
  return (await all<T>(db, sql, args))[0];
}

export async function run(db: DB, sql: string, args: InArgs = []): Promise<void> {
  await db.execute({ sql, args });
}

/** Column names of a table, in order. */
export async function columnsOf(db: DB, table: string): Promise<string[]> {
  return (await all<{ name: string }>(db, `PRAGMA table_info(${table})`)).map((c) => c.name);
}

/** Adds a column if an older database does not have it yet. */
export async function ensureColumn(
  db: DB,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  if (!(await columnsOf(db, table)).includes(column)) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

const URL_RE = /^(libsql|https?|wss?|file):/i;

/**
 * Opens the database. `target` is either a libSQL/Turso URL (`libsql://…`), `:memory:` (tests),
 * or a file path (a folder is created if needed). `authToken` is needed for Turso.
 */
export async function openDb(target: string, authToken?: string): Promise<DB> {
  let url = target;
  if (target !== ':memory:' && !URL_RE.test(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    url = pathToFileURL(target).href;
  }
  const db = createClient({ url, authToken: authToken || undefined });
  await db.executeMultiple(SCHEMA);
  // Phase 7: participants can withdraw their data on the debrief screen (excluded from every export)
  await ensureColumn(db, 'participants', 'withdrawn', 'INTEGER NOT NULL DEFAULT 0');
  // Phase 10: participants who came through a ?pilot=1 link (excluded from analysis)
  await ensureColumn(db, 'participants', 'is_pilot', 'INTEGER NOT NULL DEFAULT 0');
  // Redesign: game order factors (comma-separated amounts in the order shown)
  await ensureColumn(db, 'participants', 'deal_order', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'participants', 'spin_order', "TEXT NOT NULL DEFAULT ''");
  return db;
}

/** True if the target is a remote (Turso) database rather than a local file. */
export function isRemote(target: string): boolean {
  return /^(libsql|https?|wss?):/i.test(target);
}
