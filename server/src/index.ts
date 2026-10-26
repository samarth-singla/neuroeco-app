import { config } from './config';
import { openDb } from './db';
import { createApp } from './app';

const db = openDb(config.dbPath);
const app = createApp({ db, adminPassword: config.adminPassword, clientDist: config.clientDist });

if (!config.adminPassword) {
  console.warn('ADMIN_PASSWORD is not set: /admin and the exports are disabled.');
}

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port} (db: ${config.dbPath})`);
});
