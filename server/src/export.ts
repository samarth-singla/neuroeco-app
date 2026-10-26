import type { DB } from './db';
import { toCsv, type Cell } from './csv';

type Row = Record<string, Cell>;

function columnsOf(db: DB, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
}

export function participantsCsv(db: DB): string {
  const rows = db.prepare('SELECT * FROM participants ORDER BY created_at').all() as Row[];
  return toCsv(columnsOf(db, 'participants'), rows);
}

export function eventsCsv(db: DB): string {
  const rows = db.prepare('SELECT * FROM events ORDER BY participant_id, id').all() as Row[];
  return toCsv(columnsOf(db, 'events'), rows);
}

export function responsesCsv(db: DB): string {
  const rows = db
    .prepare('SELECT * FROM responses ORDER BY participant_id, item_id')
    .all() as Row[];
  return toCsv(columnsOf(db, 'responses'), rows);
}
