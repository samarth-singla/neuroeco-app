# Progress

Tracks the build of `IMPLEMENTATION_PLAN.md`, phase by phase.

## Phase 1 — Project setup

**Status:** done

**Built**
- npm workspaces: `client/` (Vite 7 + React 19 + TypeScript + Tailwind 4) and `server/` (Express 5 + TypeScript).
- Root scripts: `dev` (both via `concurrently`), `build`, `start`, `test`, `lint`, `format`, `typecheck`.
- ESLint 9 (flat config, typescript-eslint, react-hooks) + Prettier.
- `.gitignore` (node_modules, dist, `.env`, `*.db`, `data/`), `.env.example` (`PORT`, `ADMIN_PASSWORD`, `DB_PATH`).
- `GET /api/health`; the client page calls it through the Vite proxy and shows "API connected".
- Checked in headless Edge (via `playwright-core`) at 360px width.

**Decisions**
- `// DECISION:` Server is bundled with `tsup` (esbuild) instead of plain `tsc`, so it can import the shared,
  pure-data config files in `client/src/config/` (survey item ids) without a separate shared package.
- `// DECISION:` `.npmrc` sets `legacy-peer-deps=true`: npm 10 crashes ("reading 'edgesOut'") resolving vitest 4's
  optional peers in a workspace. All needed peers are listed explicitly. vitest and vite are declared at the root
  so both workspaces share one copy.
- vitest 4.1.12 is used instead of 3.x because 3.x has open security advisories (dev-only).

**Open**
- `npm audit` reports one low-severity advisory in the esbuild copy nested under `tsup` (affects esbuild's dev
  server, which this project does not use). No fix without a tsup major upgrade.

## Phase 2 — Database and API

**Status:** done

**Built**
- SQLite schema (`server/src/db.ts`): `participants`, `events` (append-only, server `ts` in ms + `client_ts`),
  `responses`. `ensureColumn()` helper adds columns to older DB files in later phases.
- Balanced randomization (`server/src/randomize.ts`): each factor independently goes to the smaller group,
  ties broken at random, inside a DB transaction (count + insert are atomic).
- Endpoints: `POST /api/participants`, `GET /api/participants/:id`, `POST /api/participants/:id/step`,
  `POST /api/events`, `POST /api/responses`, `GET /admin` (counts + export links),
  `GET /api/export/{participants,events,responses}.csv`. Admin uses HTTP Basic auth (any username,
  password = `ADMIN_PASSWORD`).
- Tests (`server/test`): randomization balance (100 simulated participants, 3 seeds, every level 48–52),
  independence of factors, API behaviour, consent required, admin auth, CSV export. 19 tests pass.

**Decisions**
- `// DECISION:` H3 stake order is a plain random shuffle per participant, stored in `participants.stake_order`.
- `// DECISION:` `responses` has one row per (participant, item); re-answering keeps the latest value.
- `// DECISION:` `completed_at` is set when the participant reaches the `debrief` step (all data collected).
- `// DECISION:` Timestamps: `created_at`, `completed_at`, `answered_at` are ISO strings; `events.ts` is ms.
- `// DECISION:` CSV cells that start with `= + - @` (and are not numbers) get a leading `'` so spreadsheet apps
  do not run participant free text as formulas. CSVs start with a UTF-8 BOM for Excel.
- Added `.gitattributes` (LF line endings) so Prettier checks pass on Windows checkouts.

**Open**
- `wide.csv` is built in Phase 8 (needs survey item list and derived scores).
