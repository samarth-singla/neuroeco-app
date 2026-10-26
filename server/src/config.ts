import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Repo root: this file lives in server/src (dev) or server/dist (built), both two levels down.
const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..', '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

function resolveFromRoot(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(ROOT_DIR, p);
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  dbPath: resolveFromRoot(process.env.DB_PATH ?? './data/neuroeco.db'),
  clientDist: path.join(ROOT_DIR, 'client', 'dist'),
};
