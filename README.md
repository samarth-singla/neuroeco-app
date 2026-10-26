# Neuroeco research app

Research prototype for the course project *Analyzing the Behavioral Mechanics of App-Based Investment
Frauds*. Participants use a simulated investment app — a **plain** or a **fraud-style** version, assigned at
random — and then answer a UI/UX survey and a general survey. Every screen, randomized factor and logged
variable maps to a hypothesis in [`hypothesis-report.md`](hypothesis-report.md) (H1–H9).

> **Simulation only.** No real money, no payment fields, no names, emails, phone numbers or ID numbers.
> The app ("Dhanoura") and the regulator ("NDIA") are fictional.

## Contents

- [Requirements](#requirements) · [Setup](#setup) · [Run](#run-in-development) · [Build](#build-and-run-in-production)
- [Environment variables](#environment-variables) · [Deploy](#deploy-as-one-node-service)
- [Study links and pilot mode](#study-links-and-pilot-mode) · [Exporting data](#exporting-data)
- [Reset the database](#reset-the-database-before-real-data-collection) · [Testing](#testing)
- [Changing texts and amounts](#changing-texts-and-amounts) · [Project layout](#project-layout)

## Requirements

- Node.js **20.19+** (tested with Node 22) and npm 10+
- For `npm run smoke` only: Microsoft Edge or Google Chrome installed

## Setup

```bash
npm install
cp .env.example .env      # then set ADMIN_PASSWORD
```

`better-sqlite3` ships prebuilt binaries for common platforms; if `npm install` tries to compile it, install
the platform build tools (Windows: "Desktop development with C++"; Linux: `build-essential`, `python3`).

## Run in development

```bash
npm run dev
```

- Participant app: <http://localhost:5173> (Vite, hot reload)
- API + admin: <http://localhost:3001> (Express; the Vite dev server proxies `/api` and `/admin` to it)
- Admin page: <http://localhost:5173/admin> (any username, password = `ADMIN_PASSWORD`)

## Build and run in production

```bash
npm run build      # builds client/dist and server/dist
npm start          # one Node process serves the app, the API and /admin on PORT
```

## Environment variables

Set them in `.env` (repo root) or in your host's settings. Variables already set in the environment win
over `.env`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3001` | Port the server listens on |
| `ADMIN_PASSWORD` | *(empty)* | Password for `/admin` and the CSV exports. If empty, admin is disabled. Use a long random string. |
| `DB_PATH` | `./data/neuroeco.db` | SQLite file. Relative paths are resolved from the repo root. The folder is created if needed. |

## Deploy as one Node service

The whole study is a single Node app with a single SQLite file. On any host:

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Environment:** `ADMIN_PASSWORD` (required), `DB_PATH` pointing at **persistent storage**, `PORT` if the
  host does not set it.

Notes per host:

- **Render:** create a *Web Service*, add a *Persistent Disk* (e.g. mounted at `/var/data`) and set
  `DB_PATH=/var/data/neuroeco.db`. Without a disk the database is wiped on every deploy.
- **Railway:** add a *Volume* (e.g. at `/data`) and set `DB_PATH=/data/neuroeco.db`.
- **VPS:** clone, `npm install && npm run build`, run `npm start` under a process manager (systemd or
  `pm2`) behind HTTPS (e.g. Caddy or nginx). Keep `data/` out of the web root (it already is).

Use HTTPS in production: the admin password is sent with HTTP Basic auth. Run a single instance (SQLite is
a local file). Free hosting tiers that sleep may make the first page load slow.

## Study links and pilot mode

- Real participants: `https://<your-host>/`
- Pilot / testing: `https://<your-host>/?pilot=1` — these participants get `is_pilot = 1` in every export
  and are randomized separately, so they never unbalance the real groups. Exclude them in the analysis.

Each browser tab is one participant (`sessionStorage`): refreshing resumes at the same step; a new tab or
window starts a new participant.

## Exporting data

Open `/admin` (password `ADMIN_PASSWORD`). It shows totals (consented, completed, withdrawn, pilot),
per-level counts for every randomized factor and four downloads:

| File | Contents |
| --- | --- |
| `wide.csv` | **Use this for analysis.** One row per completed, non-withdrawn participant: assignments, behaviour measures, every survey answer and derived scores (CRT, λ, literacy, overconfidence, herd, susceptibility). Columns are documented in [`docs/data-dictionary.md`](docs/data-dictionary.md). |
| `participants.csv` | One row per consented participant (including unfinished) |
| `events.csv` | Raw behaviour log (one row per event) |
| `responses.csv` | Raw survey answers (one row per participant × item) |

Participants who withdrew their data on the debrief screen are excluded from all four files. Scores are
computed by the server at download time (overconfidence uses z-scores over the downloaded sample).

## Reset the database before real data collection

Test runs (including `npm run smoke`) create real rows. Before collecting real data:

1. Download anything you want to keep from `/admin`.
2. Stop the server.
3. Run `npm run db:reset -- --yes` (deletes the file at `DB_PATH`), or delete the file by hand.
4. Start the server again — it creates a fresh, empty database.

On a host, run the same command in the host's shell, or delete the database file on the persistent disk.

## Testing

| Command | What it does |
| --- | --- |
| `npm test` | All unit and flow tests (server + client), including a 40-participant API simulation |
| `npm run simulate` | The API simulation on its own (`npm run simulate -- 100` for more participants) |
| `npm run smoke` | Real browser run through the whole study at 360 px in both versions (app must be running; `npm run smoke -- http://localhost:3001` for a built app, `BROWSER=chrome` for Chrome) |
| `npm run lint` | ESLint + Prettier check (`npm run format` fixes formatting) |
| `npm run typecheck` | TypeScript checks |

The manual checklist is in [`docs/qa-checklist.md`](docs/qa-checklist.md).

## Changing texts and amounts

| What | File |
| --- | --- |
| App name, amounts, returns, fees, bonus, VIP tiers, timer, ticker, testimonials, chat, screen texts | `client/src/config/session.ts` |
| UI/UX and general survey questions | `client/src/config/survey.ts` |
| Consent, debrief and thank-you texts | `client/src/config/study.ts` |
| Scoring keys (CRT answers, literacy answers, λ rule) | `server/src/scoring.ts` |
| `wide.csv` columns and their descriptions | `server/src/wide.ts` → then run `npm run docs:dictionary` |

Keep survey item ids stable once data collection starts — they are the column names in the exports.

## Project layout

```
client/                React + TypeScript + Vite + Tailwind (participant-facing app)
  src/config/          all texts, amounts and survey questions (pure data, also used by the server)
  src/screens/app/     app session screens A1–A10
  src/features/        dark-design features and their plain counterparts
  src/screens/         consent, survey pages, debrief
  src/lib/             wallet maths, event logger, API client
  src/test/            flow tests
server/                Express + TypeScript + SQLite
  src/                 API, randomization, scoring, exports, admin page
  scripts/             simulate.ts, data-dictionary.ts, reset-db.ts
  test/                unit and API tests
scripts/               browser-smoke.mjs
docs/                  data dictionary, screen list, QA checklist
PROGRESS.md            build log with every design decision
```
