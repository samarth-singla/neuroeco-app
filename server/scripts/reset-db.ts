/**
 * Empties the study database so data collection starts clean. Requires --yes (cannot be undone).
 *
 *   npm run db:reset -- --yes
 *
 * - Local SQLite file (DB_PATH): stop the server first; the file is deleted.
 * - Turso (TURSO_DATABASE_URL set in .env or the environment): every row is deleted; the tables stay.
 *
 * Download anything you want to keep from /admin before running this.
 */
import fs from 'node:fs';
import { config } from '../src/config';
import { openDb } from '../src/db';

const confirmed = process.argv.includes('--yes');
const where = config.usingTurso ? `Turso database ${config.dbTarget}` : `file ${config.dbPath}`;

async function main() {
  if (!confirmed) {
    console.log(`This permanently deletes all study data in the ${where}.`);
    console.log('Run again with --yes to confirm:  npm run db:reset -- --yes');
    process.exit(1);
  }

  if (config.usingTurso) {
    const db = await openDb(config.dbTarget, config.dbAuthToken);
    await db.batch(
      ['DELETE FROM events', 'DELETE FROM responses', 'DELETE FROM participants'],
      'write',
    );
    db.close();
    console.log('Deleted all rows from the Turso database (participants, events, responses).');
    return;
  }

  const files = ['', '-wal', '-shm', '-journal'].map((s) => config.dbPath + s);
  const existing = files.filter((f) => fs.existsSync(f));
  for (const f of existing) fs.rmSync(f);
  console.log(
    existing.length
      ? `Deleted ${config.dbPath}. A fresh, empty database is created on the next server start.`
      : 'Nothing to delete.',
  );
}

main().catch((e) => {
  console.error('Reset failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
