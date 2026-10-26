import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { DB } from './db';
import { apiRouter } from './routes/api';
import { adminRouter } from './routes/admin';

export interface AppOptions {
  db: DB;
  adminPassword: string;
  /** Folder with the built client. If it exists, it is served as a single-page app. */
  clientDist?: string;
}

export function createApp(opts: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  // text/plain is accepted too because navigator.sendBeacon may send JSON with that type.
  app.use(express.json({ limit: '1mb', type: ['application/json', 'text/plain'] }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: Date.now() });
  });

  app.use(adminRouter(opts.db, opts.adminPassword));
  app.use('/api', apiRouter(opts.db));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not found' });
  });

  // Serve the built client (production). Any other GET falls back to index.html.
  if (opts.clientDist && fs.existsSync(opts.clientDist)) {
    const dist = opts.clientDist;
    app.use(express.static(dist));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  // Malformed JSON and other errors
  app.use(
    (
      err: Error & { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status = err.status && err.status < 500 ? err.status : 500;
      if (status === 500) console.error(err);
      res.status(status).json({ error: status === 500 ? 'server error' : err.message });
    },
  );

  return app;
}
