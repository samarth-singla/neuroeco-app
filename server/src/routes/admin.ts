import { Router, type Response } from 'express';
import { all, get, type DB } from '../db';
import { requireAdmin } from '../auth';
import { FACTORS, type FactorName } from '../randomize';
import { eventsCsv, participantsCsv, responsesCsv } from '../export';
import { wideCsv } from '../wide';

const BOM = '\uFEFF'; // lets Excel read UTF-8 text (₹ etc.) correctly

function sendCsv(res: Response, name: string, body: string) {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${name}"`);
  res.set('Cache-Control', 'no-store');
  res.send(BOM + body);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Game names of the balanced factors (column names kept for older data) */
const FACTOR_LABELS: Record<string, string> = {
  app_version: 'Skin (plain = honest ZenTrade, fraud = ZenTrade X) — H1',
  round1_outcome: 'Round-1 outcome — H2',
  withdrawal_offer: 'Test withdrawal — H6',
  referral_source: 'Pool invite source — H5',
  money_source: 'Reinvest framing (profit / own = main wallet) — H7',
};

const COMPLETE = 'completed_at IS NOT NULL AND withdrawn = 0';

export async function adminCounts(db: DB) {
  const one = async (sql: string) => Number((await get<{ n: number }>(db, sql))?.n ?? 0);
  // Per level (real participants only, pilots excluded): all, and completed non-withdrawn
  const factors: Record<string, Record<string, { all: number; complete: number }>> = {};
  for (const f of Object.keys(FACTORS) as FactorName[]) {
    factors[f] = Object.fromEntries(FACTORS[f].map((l) => [l, { all: 0, complete: 0 }]));
    const rows = await all<{ level: string; n: number; c: number }>(
      db,
      `SELECT ${f} AS level, COUNT(*) AS n,
         SUM(CASE WHEN ${COMPLETE} THEN 1 ELSE 0 END) AS c
       FROM participants WHERE is_pilot = 0 GROUP BY ${f}`,
    );
    for (const r of rows) factors[f][r.level] = { all: Number(r.n), complete: Number(r.c) };
  }
  return {
    total: await one('SELECT COUNT(*) AS n FROM participants'),
    completed: await one('SELECT COUNT(*) AS n FROM participants WHERE completed_at IS NOT NULL'),
    withdrawn: await one('SELECT COUNT(*) AS n FROM participants WHERE withdrawn = 1'),
    inWide: await one(
      `SELECT COUNT(*) AS n FROM participants WHERE ${COMPLETE} AND current_step LIKE 'g:%'`,
    ),
    pilot: await one('SELECT COUNT(*) AS n FROM participants WHERE is_pilot = 1'),
    factors,
  };
}

async function adminPage(db: DB): Promise<string> {
  const c = await adminCounts(db);
  const factorRows = Object.entries(c.factors)
    .map(([f, levels]) =>
      Object.entries(levels)
        .map(
          ([l, n], i) =>
            `<tr>${i === 0 ? `<th rowspan="${Object.keys(levels).length}">${escapeHtml(FACTOR_LABELS[f] ?? f)}</th>` : ''}` +
            `<td>${escapeHtml(l)}</td><td>${n.all}</td><td>${n.complete}</td></tr>`,
        )
        .join(''),
    )
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Study admin</title>
<style>
body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#111}
table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{text-align:left;padding:.4rem .6rem;border-bottom:1px solid #ddd}
a.btn{display:inline-block;margin:.25rem .5rem .25rem 0;padding:.5rem .9rem;background:#065f46;color:#fff;border-radius:6px;text-decoration:none}
small{color:#555}
</style></head><body>
<h1>Study admin</h1>
<table>
<tr><th>Total participants (consented)</th><td><b>${c.total}</b></td></tr>
<tr><th>Completed (reached the report card)</th><td><b>${c.completed}</b></td></tr>
<tr><th>Withdrawn (excluded from exports)</th><td><b>${c.withdrawn}</b></td></tr>
<tr><th>Rows in wide.csv (completed, not withdrawn)</th><td><b>${c.inWide}</b></td></tr>
<tr><th>Pilot participants (?pilot=1, included in exports with is_pilot = 1)</th><td><b>${c.pilot}</b></td></tr>
</table>
<h2>Randomized factors (real participants, pilots excluded)</h2>
<table>
<tr><th>Factor</th><th>Level</th><th>All</th><th>Completed, not withdrawn</th></tr>
${factorRows}
</table>
<h2>Exports</h2>
<p>
<a class="btn" href="/api/export/wide.csv">wide.csv</a>
<a class="btn" href="/api/export/participants.csv">participants.csv</a>
<a class="btn" href="/api/export/events.csv">events.csv</a>
<a class="btn" href="/api/export/responses.csv">responses.csv</a>
</p>
<p><small>wide.csv: one row per game player who reached the report card, with derived scores (see docs/data-dictionary.md).
The raw files include unfinished players and any data from the original survey flow. Withdrawn participants are left out of every file.</small></p>
</body></html>`;
}

export function adminRouter(db: DB, password: string): Router {
  const r = Router();
  const auth = requireAdmin(password);

  r.get('/admin', auth, async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.type('html').send(await adminPage(db));
  });
  r.get('/api/export/participants.csv', auth, async (_req, res) =>
    sendCsv(res, 'participants.csv', await participantsCsv(db)),
  );
  r.get('/api/export/events.csv', auth, async (_req, res) =>
    sendCsv(res, 'events.csv', await eventsCsv(db)),
  );
  r.get('/api/export/responses.csv', auth, async (_req, res) =>
    sendCsv(res, 'responses.csv', await responsesCsv(db)),
  );
  r.get('/api/export/wide.csv', auth, async (_req, res) =>
    sendCsv(res, 'wide.csv', await wideCsv(db)),
  );

  return r;
}
