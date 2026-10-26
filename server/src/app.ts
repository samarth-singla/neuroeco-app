import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

export interface AppOptions {
  /** Folder with the built client. If it exists, it is served as a single-page app. */
  clientDist?: string;
}

export function createApp(opts: AppOptions = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: Date.now() });
  });

  // Serve the built client (production). Any non-API GET falls back to index.html.
  if (opts.clientDist && fs.existsSync(opts.clientDist)) {
    const dist = opts.clientDist;
    app.use(express.static(dist));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  return app;
}
