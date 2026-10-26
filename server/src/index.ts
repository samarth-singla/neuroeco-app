import { config } from './config';
import { openDb } from './db';
import { createApp } from './app';

async function main() {
  if (config.usingTurso && !config.dbAuthToken) {
    console.warn(
      'TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is empty: Turso will refuse access.',
    );
  }
  const db = await openDb(config.dbTarget, config.dbAuthToken);
  const app = createApp({ db, adminPassword: config.adminPassword, clientDist: config.clientDist });

  if (!config.adminPassword) {
    console.warn('ADMIN_PASSWORD is not set: /admin and the exports are disabled.');
  }

  const where = config.usingTurso ? `Turso (${config.dbTarget})` : config.dbPath;
  app.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port} (database: ${where})`);
  });
}

main().catch((err) => {
  console.error('Could not start the server:', err instanceof Error ? err.message : err);
  if (config.usingTurso) {
    console.error(
      'Check TURSO_DATABASE_URL (libsql://<database>-<org>.turso.io) and TURSO_AUTH_TOKEN.',
    );
  }
  process.exit(1);
});
