/**
 * Deletes the SQLite database (DB_PATH from .env) so data collection starts empty.
 * Stop the server first. Requires --yes, because it cannot be undone.
 *
 *   npm run db:reset -- --yes
 *
 * Export anything you want to keep from /admin before running this.
 */
import fs from 'node:fs';
import { config } from '../src/config';

const files = ['', '-wal', '-shm', '-journal'].map((s) => config.dbPath + s);
const existing = files.filter((f) => fs.existsSync(f));

if (!process.argv.includes('--yes')) {
  console.log(`This permanently deletes the study database:\n  ${config.dbPath}`);
  console.log(existing.length ? 'Run again with --yes to confirm.' : '(It does not exist yet.)');
  process.exit(existing.length ? 1 : 0);
}

for (const f of existing) fs.rmSync(f);
console.log(
  existing.length
    ? `Deleted ${existing.length} file(s). A fresh, empty database is created on the next server start.`
    : 'Nothing to delete.',
);
