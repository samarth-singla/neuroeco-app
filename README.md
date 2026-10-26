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

Data is stored with the libSQL client: in a local SQLite file by default, or in a
[Turso](https://turso.tech) database when `TURSO_DATABASE_URL` is set (see [Deploy](#deploy-as-one-node-service)).

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
| `DB_PATH` | `./data/neuroeco.db` | Local SQLite file (used when `TURSO_DATABASE_URL` is not set). Relative paths are resolved from the repo root. The folder is created if needed. |
| `TURSO_DATABASE_URL` | *(empty)* | Turso database URL, e.g. `libsql://neuroeco-yourname.turso.io`. When set, data goes to Turso instead of the local file. |
| `TURSO_AUTH_TOKEN` | *(empty)* | Turso database token (needed with `TURSO_DATABASE_URL`). Keep it secret. |

## Deploy as one Node service

The whole study is a single Node app. Its data must live somewhere that survives restarts: either
**Turso** (works on free hosts with no disk) or a local file on a **persistent disk**.

### Render (free plan) + Turso — recommended

Render's free plan has no disk and wipes local files whenever the app sleeps or redeploys, so use Turso
for the data.

1. **Turso:** create a database and copy its **URL** (`libsql://…turso.io`) and a **token**
   (dashboard: *Databases → your database → Create token*; or CLI: `turso db show <name> --url` and
   `turso db tokens create <name>`). The app creates its tables on first start.
2. **Render:** *New → Web Service* → connect the GitHub repo, then:
   - **Runtime:** Node · **Branch:** `main` · **Instance type:** Free
   - **Build command:** `npm install --include=dev && npm run build`
   - **Start command:** `npm start`
3. **Environment variables** (same page under *Environment*, or later in the service's **Environment**
   tab → *Add Environment Variable*):

   | Key | Value |
   | --- | --- |
   | `TURSO_DATABASE_URL` | your `libsql://…turso.io` URL |
   | `TURSO_AUTH_TOKEN` | your Turso token |
   | `ADMIN_PASSWORD` | a long password of your choice |
   | `NODE_VERSION` | `22` |

   Do not set `PORT` (Render sets it) or `DB_PATH` (ignored when Turso is set).
4. **Deploy.** When the log shows `Server listening … (database: Turso …)`, open the `onrender.com` URL.
   Check `/admin` with your password. If the log says `Could not start the server`, re-check the Turso URL
   and token. Changing an environment variable later triggers a redeploy automatically.

Free Render services sleep after about 15 minutes without visitors; the next visit takes up to a minute to
wake. During data collection, a free uptime monitor (e.g. UptimeRobot) that requests
`https://<your-app>.onrender.com/api/health` every 10 minutes keeps it awake.

### Other hosts

- **Build command:** `npm install --include=dev && npm run build` · **Start command:** `npm start`
- **Data:** set the two Turso variables, **or** point `DB_PATH` at persistent storage (Render paid disk at
  `/var/data` → `DB_PATH=/var/data/neuroeco.db`; Railway volume at `/data` → `DB_PATH=/data/neuroeco.db`).
- **VPS:** clone, build, run `npm start` under a process manager (systemd or `pm2`) behind HTTPS (Caddy or
  nginx). The local file in `data/` is fine there.

Use HTTPS in production: the admin password is sent with HTTP Basic auth. Run a **single instance** of the
server: sign-ups are queued in the server process to keep the groups balanced.

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
2. **Local file:** stop the server, run `npm run db:reset -- --yes` (deletes the file at `DB_PATH`), start
   the server again — it creates a fresh, empty database.
3. **Turso (e.g. the Render deployment):** on your own computer, put the same `TURSO_DATABASE_URL` and
   `TURSO_AUTH_TOKEN` in `.env` and run `npm run db:reset -- --yes`. It deletes every participant, event and
   response in Turso (the tables stay). No redeploy is needed. Remove the Turso lines from `.env` afterwards
   if you want local development to use the local file again.

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
