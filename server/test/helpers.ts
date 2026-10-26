import { openDb } from '../src/db';
import { createApp } from '../src/app';

export const ADMIN_PASSWORD = 'test-password';

export function makeApp() {
  const db = openDb(':memory:');
  const app = createApp({ db, adminPassword: ADMIN_PASSWORD });
  return { db, app };
}

export function basicAuth(password = ADMIN_PASSWORD): string {
  return 'Basic ' + Buffer.from(`admin:${password}`).toString('base64');
}
