import { all, columnsOf, type DB } from './db';
import { toCsv, type Cell } from './csv';

type Row = Record<string, Cell>;

/** Withdrawn participants are excluded from every export. */
const ACTIVE = 'participant_id IN (SELECT participant_id FROM participants WHERE withdrawn = 0)';

export async function participantsCsv(db: DB): Promise<string> {
  const rows = await all<Row>(
    db,
    'SELECT * FROM participants WHERE withdrawn = 0 ORDER BY created_at',
  );
  return toCsv(await columnsOf(db, 'participants'), rows);
}

export async function eventsCsv(db: DB): Promise<string> {
  const rows = await all<Row>(
    db,
    `SELECT * FROM events WHERE ${ACTIVE} ORDER BY participant_id, id`,
  );
  return toCsv(await columnsOf(db, 'events'), rows);
}

export async function responsesCsv(db: DB): Promise<string> {
  const rows = await all<Row>(
    db,
    `SELECT * FROM responses WHERE ${ACTIVE} ORDER BY participant_id, item_id`,
  );
  return toCsv(await columnsOf(db, 'responses'), rows);
}
