import { Router, type Response } from 'express';
import type { DB } from '../db';
import { requireAdmin } from '../auth';
import { FACTORS, type FactorName } from '../randomize';
import { eventsCsv, participantsCsv, responsesCsv } from '../export';

function sendCsv(res: Response, name: string, body: string) {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${name}"`);
  res.set('Cache-Control', 'no-store');
  res.send('﻿' + body); // BOM so Excel reads UTF-8 text correctly
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function adminCounts(db: DB) {
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const factors: Record<string, Record<string, number>> = {};
  for (const f of Object.keys(FACTORS) as FactorName[]) {
    factors[f] = Object.fromEntries(FACTORS[f].map((l) => [l, 0]));
    const rows = db
      .prepare(`SELECT ${f} AS level, COUNT(*) AS n FROM participants GROUP BY ${f}`)
      .all() as { level: string; n: number }[];
    for (const r of rows) factors[f][r.level] = r.n;
  }
  return {
    total: one('SELECT COUNT(*) AS n FROM participants'),
    completed: one('SELECT COUNT(*) AS n FROM participants WHERE completed_at IS NOT NULL'),
    factors,
  };
}

function adminPage(db: DB): string {
  const c = adminCounts(db);
  const factorRows = Object.entries(c.factors)
    .map(
      ([f, levels]) =>
        `<tr><th>${escapeHtml(f)}</th><td>${Object.entries(levels)
          .map(([l, n]) => `${escapeHtml(l)}: <b>${n}</b>`)
          .join(' &nbsp;&middot;&nbsp; ')}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Study admin</title>
<style>
body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#111}
table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{text-align:left;padding:.4rem .6rem;border-bottom:1px solid #ddd}
a.btn{display:inline-block;margin:.25rem .5rem .25rem 0;padding:.5rem .9rem;background:#065f46;color:#fff;border-radius:6px;text-decoration:none}
</style></head><body>
<h1>Study admin</h1>
<table>
<tr><th>Total participants</th><td><b>${c.total}</b></td></tr>
<tr><th>Completed</th><td><b>${c.completed}</b></td></tr>
${factorRows}
</table>
<h2>Exports</h2>
<p>
<a class="btn" href="/api/export/participants.csv">participants.csv</a>
<a class="btn" href="/api/export/events.csv">events.csv</a>
<a class="btn" href="/api/export/responses.csv">responses.csv</a>
</p>
</body></html>`;
}

export function adminRouter(db: DB, password: string): Router {
  const r = Router();
  const auth = requireAdmin(password);

  r.get('/admin', auth, (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.type('html').send(adminPage(db));
  });
  r.get('/api/export/participants.csv', auth, (_req, res) =>
    sendCsv(res, 'participants.csv', participantsCsv(db)),
  );
  r.get('/api/export/events.csv', auth, (_req, res) => sendCsv(res, 'events.csv', eventsCsv(db)));
  r.get('/api/export/responses.csv', auth, (_req, res) =>
    sendCsv(res, 'responses.csv', responsesCsv(db)),
  );

  return r;
}
