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

## Phase 3 — Shared app shell and simulated wallet

**Status:** done

**Built**
- Fictional app "Dhanoura" with a generated SVG logo (`client/src/components/Logo.tsx`, `client/public/logo.svg`);
  dark theme with green/gold accents, cards, decorative bottom nav (`AppShell`), plain `StudyLayout` for surveys.
- Always-visible footer: "Research prototype — no real money is used."
- Simulated wallet (`client/src/lib/wallet.ts`, pure reducer): ₹10,000 practice balance, deposits, scripted
  returns/losses, withdrawals, fee payments, fraud-version sign-up bonus. Header shows practice balance and
  in-app balance (+ locked bonus and VIP level in the fraud version).
- Event logger (`lib/logger.ts`): buffers events, flushes every 3 s, on every step change, and via `sendBeacon`
  when the page is hidden. `useLog(screen)` logs `screen_view` once per mount and returns `log(type, payload)`.
- Decision timer (`useDecisionTimer`): ms from first render to the first decisive click, sent in the
  click's payload (`decision_ms`, `first_decision`).
- Study state (`state/study.tsx`): participant id, assignment, step, wallet, session choices and answers, saved in
  `sessionStorage` (refresh resumes the same participant and step); step changes are sent to the server.
- All session amounts, rates and texts in `client/src/config/session.ts`.
- Tests: wallet maths (9), logger/decision timer incl. StrictMode (2). Checked in headless Edge at 360px:
  wallet updates, survives refresh, no horizontal scroll, events reach the DB.

**Decisions**
- `// DECISION:` The sign-up bonus is locked until the first deposit, then joins the in-app balance (so
  returns/losses apply to it). It cannot be invested on its own.
- `// DECISION:` Fees are paid from the practice balance; if it is short, only what is left is taken.
- `// DECISION:` Bottom nav is decorative (the session order is fixed), so it cannot lead to a dead end.

**Open**
- The temporary start screen and demo screen are replaced in Phases 4 and 7.

## Phase 4 — App session screens

**Status:** done

**Built**
- Screens A1–A10 (`client/src/screens/app/`), each built once and switching on the participant's version:
  A1 welcome (+ ₹500 sign-up bonus, H1b), A2 plans (+ countdown & "only 3 slots left" H1a, VIP tiers H1c,
  "NDIA Certified" badge & certificate H1d, withdrawal ticker & testimonials H1e; About/Verify link in both),
  A3/A5/A7 deposits (A5/A7 + mentor chat H1f; plain shows a Help/FAQ link), A4 round-1 outcome (H2),
  A6 withdrawal stage (H6), A8 scripted −30% loss with top-up (H4), A9 final withdrawal (fraud: 10%
  "processing tax" block with Pay / Don't pay, H1g), A10 end.
- Feature components are pure (`client/src/features/elements.tsx`) so the UI/UX survey can re-render them.
- Every screen has a non-investing way forward; the countdown resets ("New slots opening…") and never blocks.
- Scripted effects (round-1 return, loss) are applied during the screen transition, so a refresh never applies
  them twice.
- Events: `screen_view`, `bonus_shown`, `plan_select`, `invest_click` / `exit_click` (with `decision_ms`),
  `verify_click` / `verify_close`, `timer_reset`, `deposit_submit {round, amount, plan_id}`, `outcome_shown`,
  `chat_preview_shown`, `chat_open {kind: mentor|faq}`, `withdraw_offer_shown`, `withdraw_click`,
  `withdraw_skip`, `loss_shown`, `topup_click`, `topup_submit`, `topup_cancel`, `topup_decline`,
  `withdraw_final_click`, `withdraw_final_keep`, `fee_shown`, `fee_pay_click`, `fee_decline_click`.
- Tests (`client/src/test/appFlow.test.tsx`): full run-through for all 8 combinations of version ×
  round1_outcome × withdrawal_offer, a never-invest path in both versions, refresh-resume. Also run in headless
  Edge at 360px against the real server for both versions: no errors, no horizontal scroll, all events in the DB.

**Decisions**
- `// DECISION:` Plans differ only in stated return ("up to 8/10/12%"); every plan gets the same scripted outcome.
  VIP tier perks are display-only (fraud apps promise them; returns stay identical across versions).
- `// DECISION:` Choosing "Continue without investing" on A2 skips A3 (R1 = 0); A4 then says the participant did
  not invest and shows what plans returned.
- `// DECISION:` Small withdrawal = min(₹200, app balance); if the app balance is 0 the offer says there is
  nothing to withdraw. A6 is shown in both conditions (portfolio summary) so the flow length is the same.
- `// DECISION:` A9 offers "Leave it in the app" as well as "Withdraw"; the fee screen appears only after
  "Withdraw" in the fraud version. Fee = 10% of the app balance. After paying, the balance stays "under review".
- `// DECISION:` The About/Verify link is on A2 only (the H1 decision screen).
- `// DECISION:` The plain version's counterpart of the mentor chat is a Help/FAQ link; both log `chat_open`
  with `kind`.
- Deposit buttons sit in a sticky action bar and the chat preview sits beside the chat button and collapses after
  7 s, so the fraud chat never covers the buttons or amount chips (avoids a mechanical timing confound).

## Phase 5 — UI/UX survey (H1h / feature ratings)

**Status:** done

**Built**
- `client/src/config/survey.ts` (pure data, shared with the server): item types (likert, choice, number, slider,
  text), the 7 feature pages and the overall page. Item ids `uiux_<feature>_<urgency|trust|temptation>`
  (features: `timer`, `bonus`, `vip`, `regulator`, `social`, `chat`, `withdrawal_tax`), `uiux_overall_trust`,
  `uiux_overall_urgency` — 23 items.
- Survey engine: `screens/SurveyPage.tsx` (progress bar, all non-optional answers required, answers saved to
  the server before moving on, retry message if saving fails) and `components/Question.tsx`.
- `features/FeaturePreview.tsx` re-renders each element from the participant's own version (plain participants
  see the plain counterpart), using their own withdrawal amount / fee on the last feature. Previews are inert.
- Tests: required-answer validation, version-specific preview, all 23 ids saved, hand-off to `survey:0`
  (both versions). Checked in Edge at 360px.

**Decisions**
- `// DECISION:` Survey pages have no Back button, so answers are given once in a fixed order.
- `// DECISION:` Feature page titles use neutral names (e.g. "Mentor chat", "Withdrawal processing tax"), not
  evaluative ones, so the debrief framing is not revealed early.

## Phase 6 — General survey

**Status:** done

**Built**
- All general-survey text in `client/src/config/survey.ts`; 13 pages with progress bar, all answers required
  except the free-text comment:
  CRT (3 numeric items) → loss-aversion gambles (lose ₹100 vs win ₹50…₹300) → H3 stake scenarios (₹500 /
  ₹5,000 / ₹50,000, one page each, in the participant's randomized `stake_order`) → H5 referral scenario
  (assigned `referral_source` only) → herd/FOMO (5 items) → H7 money-source scenario (assigned `money_source`
  only; willingness + ₹0–2,000 slider) → self-rated literacy → Big Three literacy → susceptibility (5 items) →
  experience & exposure (4 items) → demographics (age, gender, family income band, field of study) + optional
  comment.
- Item ids are identical across conditions (exported as `SURVEY_ITEM_IDS`; also `ALL_ITEMS` with blocks for the
  server export).
- Tests: same ids in all conditions, every planned block present, full run-through for two condition sets
  (variant texts shown, stake order respected, validation of empty / out-of-range answers, all required ids saved,
  ends at `debrief`). Checked in Edge at 360px.

**Decisions**
- `// DECISION:` CRT bat-and-ball item uses rupees (₹110 total, ₹100 more → correct answer 5).
- `// DECISION:` Self-rated literacy is asked before the Big Three quiz, so the quiz cannot shift the self-rating.
- `// DECISION:` Scenario "verify first" questions ask about checking registration with "the official regulator"
  (no regulator named, per plan rule 3).
- Scores (CRT, λ, literacy, overconfidence, herd, susceptibility) are not computed in the browser; they are
  computed server-side at export (Phase 8).

## Phase 7 — Consent and debrief

**Status:** done

**Built**
- Consent screen (`client/src/screens/Consent.tsx`, text in `client/src/config/study.ts`): "a study of how people
  use investment apps" (no fraud framing), ~15 min, voluntary, stop anytime, no real money, no identifying data,
  course-project use only; "I am 18+" and "I agree" checkboxes. The participant record (and randomization) is
  created only on "Agree and start"; declining shows a polite end screen and sends nothing to the server.
- Debrief (`screens/Debrief.tsx`) after the general survey: reveals the simulated fraud app, lists the
  manipulative features (timer, fake scarcity, bonus lock, VIP tiers, fake regulator badge/certificate, fake
  ticker/testimonials, mentor chat, withdrawal "tax"), explains the scripted outcomes, gives protection tips
  (verify registration on the official regulator's website, never pay a fee to withdraw, beware guaranteed
  returns, report at cybercrime.gov.in / 1930) and offers "Withdraw my data" (with confirmation).
- Thank-you screen (different text after a withdrawal).
- Server: `participants.withdrawn` column (added to old DB files via `ensureColumn`),
  `POST /api/participants/:id/withdraw`; withdrawn participants are excluded from all CSV exports and counted
  on `/admin`.
- Tests: consent hides the fraud framing, both boxes required, declining creates no record; debrief text per
  version, withdrawal flow, normal finish (client); withdrawal + export exclusion (server). Checked in Edge.

**Decisions**
- `// DECISION:` The debrief adapts to the version: fraud participants are told these were the features they saw;
  plain participants are told other participants saw them.
- `// DECISION:` Debrief tips refer to "the official securities regulator" without naming it (plan rule 3 bans
  real regulator names). The team can name it in `client/src/config/study.ts` if the instructor agrees.
- `// DECISION:` Withdrawal keeps the rows in the database (flag only) and excludes them from every export, as the
  plan says; "reset the database" in the README removes everything.

## Phase 8 — Data export

**Status:** done

**Built**
- `wide.csv` (`server/src/wide.ts`): one row per completed, non-withdrawn participant (101 columns) —
  assignments; app behaviour from the event log (A2 decision time, choice, invested, plan, R1, R2, escalation
  ratio, verify click, chat open, withdrew, post-withdrawal deposit, top-up click / yes-no / amount, fee shown /
  paid, total deposited); every UI/UX and survey item; derived scores.
- Scores computed server-side at export (`server/src/scoring.ts`): CRT (0–3), loss aversion λ (+ consistency
  flag and number accepted), Big Three literacy (0–3), self-rated literacy, overconfidence = z(self) − z(quiz)
  over the exported sample, herd score (mean), susceptibility index (mean).
- `/admin`: totals (consented, completed, withdrawn, rows in wide.csv), per-level counts of every randomized
  factor (all and completed), download buttons for the four CSVs.
- `docs/data-dictionary.md` is generated from the column definitions (`npm run docs:dictionary -w server`) and
  maps every column to H1–H9; a test fails if the committed file is out of date.
- Tests: CRT, λ (switch points, accept-all, reject-all, inconsistent, missing), literacy, z-scores /
  overconfidence (incl. SD = 0), means, escalation ratio edge cases (R1 = 0), full wide.csv row check, never-
  invested defaults, exclusion of unfinished and withdrawn participants. 38 server tests pass.

**Decisions**
- `// DECISION:` λ = smallest accepted gain ÷ ₹100 (accept-all → 0.5). Reject-all is top-coded to 3.5.
  Choices that switch back (accept then reject) are flagged `la_consistent = 0` and λ is left blank.
- `// DECISION:` "Don't know" counts as wrong in the literacy score.
- `// DECISION:` Overconfidence is blank when the self-rating or quiz score has zero variance in the export.
- `// DECISION:` `invested` = R1 > 0. `withdrew` is blank for `not_offered` participants; `fee_paid` is blank when
  the fee screen was not shown (all plain participants, and fraud participants who kept their balance or had
  nothing to withdraw). Yes/no columns are 1/0.
- `// DECISION:` Yes/no columns, amounts and survey values are exported as stored; survey choices use stable codes
  (e.g. `more`, `dont_know`), listed in the data dictionary.

**Open**
- `is_pilot` is already a wide.csv column (always 0 until the pilot flag is wired in Phase 10).

## Phase 9 — Testing and QA

**Status:** done

**Built**
- `server/scripts/simulate.ts` (`npm run simulate`): 40 simulated participants through the real HTTP API with
  random choices (some drop out during the survey, some withdraw), then checks that `wide.csv` columns match the
  data dictionary, row count = completed − withdrawn, no required value is missing, conditional columns are blank
  exactly when they should be, behaviour values match what was sent, and factors are balanced. Also runs as a
  vitest test.
- `scripts/browser-smoke.mjs` (`npm run smoke`): real Edge/Chrome (via `playwright-core`, no browser download)
  completes the whole study at 360 px in both versions, with a refresh mid-session; fails on page errors,
  horizontal scroll or dead ends. Passed against the dev server.
- Countdown tests: ticks, shows "New slots opening…" at zero, restarts; A2 choices still work after it runs out.
- `docs/qa-checklist.md`: manual checks (360 px layout, refresh-resume, both versions, all condition
  combinations, no dead ends, consent/debrief/withdrawal, admin export, safety rules).
- Totals: 39 server tests + 38 client tests pass.

**Decisions**
- `// DECISION:` The browser smoke test uses an installed Edge/Chrome through `playwright-core` instead of
  downloading browsers, so it runs on the team's laptops without extra setup. It writes real rows, so the DB must
  be reset afterwards (noted in the checklist).

**Open**
- The manual checklist in `docs/qa-checklist.md` still needs to be run on a real phone by the team.

## Phase 10 — Documentation and deployment prep

**Status:** done

**Built**
- Pilot mode: `?pilot=1` on the link → `participants.is_pilot = 1` (column added to old DB files), included in
  all exports with the flag, counted separately on `/admin`.
- `README.md`: install, run, build, environment variables, deploying as one Node service (Render / Railway /
  VPS, with persistent storage for SQLite), study and pilot links, exporting data, resetting the database, tests,
  where to change texts.
- `npm run db:reset -- --yes` (`server/scripts/reset-db.ts`) deletes the database; refuses without `--yes`.
- `docs/screens.md`: every screen, what each version shows, what is logged and which hypothesis it serves.
- `docs/data-dictionary.md` (generated, Phase 8) and `docs/qa-checklist.md` (Phase 9).
- Checked the production path: `npm run build && npm start` serves the client, deep links, API and `/admin` from
  one process; the browser smoke test passes against the built app.
- Tests: pilot flag in exports and admin, pilot participants do not unbalance the real sample (server);
  `?pilot=1` sends the flag (client). 41 server + 40 client tests pass.

**Decisions**
- `// DECISION:` Pilot and real participants are balanced separately in the randomization, and the `/admin`
  factor table shows real participants only.

---

## Final checklist

- [x] All screens in both versions work end to end — client flow tests (8 condition combinations + never-invest
      paths) and the real-browser smoke test (dev server and production build).
- [x] All randomized factors assigned and balanced — balanced randomization tests (100 participants, 48–52 per
      level) and the 40-participant simulation (every factor within 1).
- [x] Every DV listed in `hypothesis-report.md` for H1–H7 is logged or asked (see mapping below).
- [x] Survey covers the measures for H3, H5, H7, H8, H9.
- [x] Export produces `wide.csv` matching the data dictionary (test compares header and the committed doc).
- [x] Tests pass (`npm test`: 41 server + 40 client), lint and typecheck clean.
- [x] No real payment, credential or identity fields anywhere (scanned; the consent text only says they are not
      collected).
- [x] Every phase committed and pushed; `git status` clean; no `.env` or `.db` files in history.
- [x] Final summary written (below).

### DV coverage (hypothesis-report.md → wide.csv)

| Hypothesis | DVs / IVs in the report | Where |
| --- | --- | --- |
| H1 | decision time, invested, amount, verification click, urgency & trust ratings; CRT moderator; controls age, gender, investing experience, trading-app use | `a2_decision_time_s`, `invested`, `r1_amount` (+ `total_deposited`), `verify_click`, `uiux_overall_urgency`, `uiux_overall_trust`, `crt_score`, `demo_age`, `demo_gender`, `exp_investing`, `exp_trading_app` |
| H1a–H1g | feature-level urgency, trust, temptation (plain vs fraud) | `uiux_<feature>_<urgency\|trust\|temptation>`; behaviour: H1b `invested`, H1c `r1_amount`/`plan`, H1d `verify_click`, H1f `chat_open`/`r2_amount`, H1g `fee_paid` |
| H2 | round-2 amount, escalation ratio | `r2_amount`, `escalation_ratio` (IV `round1_outcome`) |
| H3 | willingness (1–7) and verify-first at ₹500 / ₹5,000 / ₹50,000 | `h3_stake_<stake>_willing`, `h3_stake_<stake>_verify`, `stake_order` |
| H4 | λ; post-loss top-up (y/n) and amount; controls app version, investing experience | `loss_aversion_lambda`, `topup`, `topup_amount`, `app_version`, `exp_investing` |
| H5 | willingness to join, verify first; herd/FOMO moderator | `h5_join_willing`, `h5_verify`, `herd_score` (IV `referral_source`) |
| H6 | deposit after the withdrawal stage, trust rating | `post_withdrawal_deposit`, `uiux_overall_trust` (IV `withdrawal_offer`) |
| H7 | willingness to reinvest, amount reinvested | `h7_reinvest_willing`, `h7_reinvest_amount` (IV `money_source`) |
| H8 | literacy, overconfidence, prior financial education → susceptibility index; controls age, gender, income, experience | `literacy_score`, `overconfidence`, `exp_fin_edu`, `susceptibility_index`, `demo_*`, `exp_investing` |
| H9 | bias scores × demographic group | `loss_aversion_lambda`, `herd_score`, `overconfidence`, `crt_score` × `demo_gender` / `demo_age` / `demo_income` |

### Plan vs hypothesis report — differences noted

1. **H1d wording.** The report describes real fraud apps using "SEBI registered" badges. Plan rule 3 forbids
   real regulator names, so the app uses the fictional "National Digital Investment Authority" ("NDIA
   Certified"). The manipulation (an official-looking badge and certificate) is the same.
2. **H8 victimization (yes/no)** comes from the *online dataset* in the report; the app cannot collect it. The
   survey's `exp_scam` (never / targeted / lost money) is available as a self-reported proxy.
3. **H9** says the survey can test gender only; the survey still collects age and income band as the plan asks.
4. **VIP tiers vs "same returns".** The report's H1c says bigger deposits unlock higher returns; the plan says
   both versions have the same returns. Resolved by showing VIP perks as promises only — the scripted outcomes
   are identical in both versions, as in real scam apps.

## Summary for the team

**What was built.** A mobile-first research web app (React + Vite + Tailwind client, Express + SQLite server)
that runs the full participant journey: consent → balanced random assignment → ~10-minute simulated investment
app (plain or fraud-style, screens A1–A10) → UI/UX feature ratings → general survey → debrief with data
withdrawal → thank-you. Every click that matters is logged; `/admin` shows counts and downloads four CSVs, and
`wide.csv` has one analysis-ready row per participant with all scores.

**How to run it.** `npm install`, copy `.env.example` to `.env` and set `ADMIN_PASSWORD`, then `npm run dev`
(app on http://localhost:5173). For deployment: `npm run build && npm start` as one Node service with `DB_PATH`
on persistent storage (details in the README).

**How to export data.** Open `/admin`, enter `ADMIN_PASSWORD`, download `wide.csv` (documented column by column
in `docs/data-dictionary.md`). Pilot runs use `?pilot=1` and are flagged `is_pilot = 1`. Run
`npm run db:reset -- --yes` (server stopped) before real data collection.

**Open decisions for the team** (all marked `// DECISION:` in the code and listed per phase above). The ones
most worth a look before piloting:
- λ rule: smallest accepted gain ÷ ₹100; reject-all top-coded to 3.5; inconsistent switchers get a blank λ.
- Plans differ only in stated return; VIP perks are display-only; all plans get the same scripted outcome.
- Self-rated literacy is asked before the Big Three quiz.
- CRT bat-and-ball uses rupees (₹110 / ₹100 → ₹5).
- Debrief tips do not name the real regulator (plan rule 3); add it in `client/src/config/study.ts` if the
  instructor agrees.
- `withdrew` is blank for `not_offered`; `fee_paid` is blank when the fee screen was not shown.
- Pilot participants are randomized separately from real ones.
- Survey pages have no Back button.

**Still to do by the team.** Run `docs/qa-checklist.md` on a real phone; pilot with a few people
(`?pilot=1`); reset the database before real collection. Commits so far are authored as "Your Real Name"
(the local git `user.name`); set your real name with `git config user.name` for future commits.

---

## Follow-up — Free deployment with Turso (after Phase 10)

**Status:** done

**Why:** the team will host on Render's free plan, which has no persistent disk (local files are wiped when the
service sleeps or redeploys), so a local SQLite file would lose data.

**Built**
- Database access moved from `better-sqlite3` to the libSQL client (`@libsql/client`). The same code uses a local
  SQLite file (default, `DB_PATH`) or a Turso database when `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` are set.
  All database calls are now async (`server/src/db.ts` helpers `all`, `get`, `run`). Existing local files still
  open (same SQLite format).
- Event and response batches are written with one `batch` call (one round trip to Turso).
- `npm run db:reset -- --yes` deletes the local file, or deletes every row when Turso is configured.
- Clear start-up error when the Turso URL/token is wrong.
- README: step-by-step Render (free) + Turso deployment and environment variables; `.env.example` lists the
  Turso variables.
- New test: 40 simultaneous sign-ups still split 20/20 on every factor. 42 server + 40 client tests pass; the
  simulation and the browser smoke test (against the production build) pass.

**Decisions**
- `// DECISION:` Deviation from the plan's stack table ("SQLite via better-sqlite3"): libSQL is SQLite-compatible
  and is needed for Turso. Local development still uses a plain SQLite file.
- `// DECISION:` The randomization's count-then-insert is protected by an in-process sign-up queue instead of a
  database transaction, so the server must run as a single instance (documented in the README).

**Open**
- The real Turso connection was not tested from here (no credentials in this environment); the remote path uses
  the same client and SQL as the local tests. The first Render deploy log should show
  `Server listening … (database: Turso …)`.

---

# Redesign (REDESIGN_PLAN.md) — immersive game "ZenTrade"

## Redesign Phase 1 — Game engine and economy

**Status:** done

**Built**
- `client/src/config/game.ts`: every number, timing, text and list of the game (economy, rates, VIP ladder,
  deals, pool, chat, toasts, ticker, profile / brain-bonus / quick-reaction items, answer key, trap texts, safety
  tips, `PRIZE_DRAW` flag). Pure data, also imported by the server.
- `client/src/game/economy.ts`: wallets (Main, Profit, Portfolio, Cashed out, locked bonus, tax paid), trades,
  lock-ins, crash, cash-out, tax, VIP levels, spin results, final balance.
- `client/src/game/steps.ts`: the fixed step sequence (S1 profile ×8 → S2 spins ×6 → S3 home → rounds 1–3 →
  S5 brain ×6 → round 4 → S6 chat → rounds 5–6 → S7 deals ×3 → S8 pool → S9 withdrawal → S10 reinvest → S11
  crash → S12 cash-out → S13 reactions ×12 → S14 report → S15 share → end). Step ids (`g:<stage>:<n>`) are the
  participant's `current_step`, so a refresh resumes on the same screen.
- `client/src/game/reducer.ts`: one pure reducer for every player action. Each action returns the new state and
  the events to log, so the UI and the headless player log identical events. Repeated actions (refresh) are
  ignored.
- `client/src/game/traps.ts`: trap score (0–10; tax trap fraud-only, so honest max is 9) computed from "facts";
  facts come from the game state (report card) or from the event log (export) — the same function.
- `client/src/game/sim.ts`: seeded headless player used by tests (and later the server simulation).
- Server: new per-participant order factors `deal_order` (₹500/3,000/8,000) and `spin_order` (₹50…300) — new
  columns added with `ensureColumn`, returned in the assignment; `g:report` / `g:share` / `g:end` mark completion.
  The five balanced factors are unchanged (skin = `app_version` plain/fraud, round-1 outcome, test withdrawal,
  pool invite source = `referral_source`, reinvest framing = `money_source`).
- Tests: economy rules, step order, a headless run through every stage for all 32 factor combinations × 15 random
  players (wallets never negative, every deal affordable, both H7 framings can fund ₹2,000, all items answered,
  report-card trap score = event-log trap score), refresh guards, 60-second chat-deposit window; server: order
  permutations, assignment fields, completion at `g:report`. 45 server + 84 client tests pass.

**Decisions**
- `// DECISION:` The skin is stored in the existing `app_version` column: `plain` = honest "ZenTrade",
  `fraud` = "ZenTrade X" (the column has a CHECK constraint that cannot be changed in SQLite).
- `// DECISION:` Economy: round stakes and flash deals are trades (stake stays in Main, gain → Profit, loss comes
  off Main), so every deal is affordable whatever was done before (no balance confound for H3). The pool, the
  post-withdrawal deposit, the Gold Plan and the Loss Shield top-up lock money in the Portfolio.
- `// DECISION:` A fixed ₹2,000 "6-round streak reward" goes to Profit after round 6 in both skins, so the
  profit framing of the H7 offer is always fundable; the post-withdrawal deposit is capped at ₹5,000 so the
  main-wallet framing is always fundable too.
- `// DECISION:` The crash takes 40% off Main and Portfolio (not Profit), so every player experiences a loss (H4).
- `// DECISION:` Test withdrawal comes from Main. Final balance = Main + Profit + Portfolio + Cashed out − tax paid
  + spin results; money frozen by the fraud skin's withdrawal block still counts, so the optional prize draw
  depends on choices only.
- `// DECISION:` Total deposited counts every amount invested (round stakes, deals, pool, deposits, Gold Plan,
  top-up). VIP 2 = ₹5,000 total, as in the plan.
- `// DECISION:` Traps 8–10 ("plus 3 more"): never opened any T&C/details/badge; deposited right after the
  withdrawal stage; accepted the Gold Plan offer. Trap 1 ("locked-bonus deposit") = deposited in round 1, so it is
  measurable in both skins.
- `// DECISION:` Prior financial education (H8 IV) is kept as a 7th profile tap; the "ever scammed" question is
  dropped (asking it before the game would prime suspicion).
- `// DECISION:` Bonus-spin choices are also stored in `responses` as `la_gain_<X>` so the v1 λ formula is reused.
- `// DECISION:` While the game is being built, the live site keeps the current study as the default; the game
  runs only with `?game=1` until the export is switched over (Redesign Phase 6). Render deploys every push, so
  this avoids showing a half-built game to participants.

**Open**
- UI for all stages: Redesign Phases 2–5.

## Redesign Phase 2 — Fraud skin UI

**Status:** done

**Built**
- `client/src/game/GameProvider.tsx`: game state on top of the Phase 1 reducer — logs the reducer's events exactly
  once, sends the step to the server, saves to sessionStorage (also right after consent), and queues answers for
  `responses` in the background with retries.
- `client/src/game/GameApp.tsx`: consent (existing screen) → new player → stage router; resumes after refresh.
  Reached with `?game=1` while `GAME_IS_DEFAULT` (in `config/game.ts`) is false.
- UI kit (`client/src/game/ui/`): `GameShell` (header with ★ 4.9 · 10 lakh+ users and a tappable "NDIA Certified"
  badge → certificate, scrolling withdrawal ticker, winner toasts every 4–7 s, a "LIVE · traders online" line between
  toasts, wallets Main/Profit/Portfolio with locked bonus and VIP chip, level bar, sticky action bar, research
  footer), giant pulsing gold INVEST NOW with vibration, tiny grey "skip" and T&C links, animated counters,
  confetti + coins on wins, greyed quick loss results, resetting countdowns, live chart that draws the scripted
  result, typing chat, timer ring, optional synthesized sounds (off by default, mute toggle).
- All stages in the fraud skin: S1 profile (+ avatar picker, "Profile 100% complete!"), S2 spin wheel, S3
  dashboard (live "members earned today", locked ₹500 bonus, countdown + "only 3 slots left", plan cards with huge
  returns, VIP ladder, WhatsApp-style testimonials, T&C), S4 six rounds (VIP "Upgrade" shortcut, unlock-bonus nudge,
  streak reward), S5 brain bonus, S6 "Rohit Sir" chat with typing, S7 flashing flash deals with details sheets,
  S8 pool invite (friend message / sponsored ad), S9 test withdrawal ("Money sent!") or lock + deposit offer,
  S10 Gold Plan with slider, S11 crash (red flash, shake, "recover in 10 minutes"), S12 tax block (freeze warning,
  support message, Pay tax / Don't pay), S13 quick reactions, basic S14 report / S15 share (finished in Phases 4–5).
- Checked in Edge at 360 px with a scripted playthrough: whole game completes, no page errors, no horizontal
  scroll, and a hit-test on every visible button on every screen (including while toasts, confetti and the chat are
  showing) finds nothing covering any button.

**Decisions**
- `// DECISION:` Toasts sit in a reserved lane in the header (part of the layout, not floating), and confetti,
  coins and the crash flash are confined to the content area under the sticky header and action bar — so no
  overlay can cover a button or amount field.
- `// DECISION:` Ticker and toasts appear only on "in-app" money screens (S3–S12), not on the profile, spins,
  brain bonus, reactions or report card.
- `// DECISION:` Both choices on a round (invest or skip) play the same chart animation, so skipping is not faster.
- `// DECISION:` The "withdrawals locked" message names the VIP level above the player's own (round stakes count
  toward VIP, so most players are already VIP 2 by then).
- `// DECISION:` Flash deals settle immediately (+5%) and show the result, so each deal starts with the same Main
  balance (no affordability confound for H3).

**Open**
- Honest skin polish (Phase 3), swipe cards and full mini-game polish (Phase 4), report card and share (Phase 5).
