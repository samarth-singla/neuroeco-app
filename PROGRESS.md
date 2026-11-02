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

## Redesign Phase 3 — Honest skin UI

**Status:** done

**Built**
- Every stage renders the honest "ZenTrade" skin from the same components (`skin` prop): clean light theme with a
  fintech blue accent, normal-size numbers, returns as plain ranges with a risk label, Invest and Skip buttons of
  equal size and weight, readable risk line ("Returns are not guaranteed…") right above the buttons on every money
  screen, readable "Terms and risks" / "Details" links, "About" page instead of the badge, Help & FAQ card instead
  of the mentor chat, a calm "practice market today" card, result cards that pop in. No toasts, ticker, countdowns,
  scarcity, badges, testimonials, VIP ladder or confetti.
- `client/src/game/skinParity.test.ts`: the same player (same seed → same choices) is run through both skins for
  all 16 non-skin condition combinations × 12 players and compared screen by screen — identical step order, Main,
  Portfolio, Cashed-out and Profit(+locked bonus) balances, round and deal payoffs, crash loss, total deposited,
  spins and brain-bonus results. Also checks that all timings and amounts are single, skin-independent numbers.
- Played end to end in Edge at 360 px: no errors, no covered buttons, no horizontal scroll. 61 game tests pass.

**Decisions**
- `// DECISION:` The honest skin keeps gentle, non-manipulative feedback (animated counters, live chart, result
  cards popping in) so it is not duller than the fraud skin (plan rule 7); only the dark-design layer differs.
- `// DECISION:` The only allowed skin differences in the economy are the manipulations themselves: the ₹500 bonus
  is locked until the first deposit in the fraud skin (honest: credited at once) and the fraud skin blocks the
  final withdrawal with a tax.
- The headless player now advances its clock by a fixed step and draws the fraud-only "VIP tap" in both skins, so the
  same seed gives the same choices in both skins.
- Note: one client test failed once during the Phase 3 commit run and passed in every rerun (6 runs). The only
  timing-sensitive client test (real-time countdown) now has more headroom, and the client suite's per-test timeout
  is 15 s. Committed as a follow-up fix.

## Redesign Phase 4 — Mini-games and quick reactions

**Status:** done

**Built**
- S2 bonus spins: wheel animation (fraud) / coin card (honest), accept or skip each of six "50% lose ₹100 / 50% win
  ₹X" offers in the player's `spin_order`; the outcome is drawn at once but only revealed on the report card. Choices
  stored as `la_gain_<X>` = accept / reject. Spin duration in `TIMING.spinMs`.
- S5 brain bonus: 3 CRT puzzles (number entry) then the Big Three literacy questions (choices), one per screen; a
  correct answer adds ₹100 to Profit; fraud skin shows a timer ring (visual only, restarts); time per answer logged.
- S13 quick reactions (`ui/SwipeCard.tsx`, `ui/FeatureMini.tsx`): 7 swipe cards "Did this push you to invest?",
  each showing a small re-render of the feature as the player saw it in their own skin (fraud element or honest
  counterpart); drag right = Yes, left = No, or tap the buttons (method logged). Then a trust slider and an urgency
  slider (1–7, must be touched before Next), then 3 FOMO statements as agree / disagree swipe cards.
- Tests (`client/src/test/miniGames.test.tsx`, both skins): profile + spins, brain bonus and reactions played in
  jsdom against a fake API — every one of the 39 game response items arrives in `responses`; spin outcomes are never
  shown before the report card; correct brain answers pay ₹100 each; sliders cannot be skipped. Played in Edge at
  360 px including a real swipe gesture: no errors, no covered buttons. 45 server + 107 client tests pass.

**Decisions**
- `// DECISION:` Swipe is optional — every card also has two buttons, so the task works with keyboard and screen
  readers, and the answer method (swipe / tap) is logged.
- `// DECISION:` FOMO score = number of "agree" answers (0–3).

## Redesign Phase 5 — Report card, debrief and sharing

**Status:** done

**Built**
- S14 Scam Report Card (`client/src/game/stages/Report.tsx`), in a neutral design once the fiction is revealed:
  reveal text per skin (fraud: "ZenTrade X was a simulated scam app"; honest: "you played the honest version,
  others got a scam version"), trap score out of 10 (9 for honest) with a colour gauge, each trap fallen for with a
  tip, traps avoided, the six bonus spins finally revealed with their total, final-balance breakdown (Main + Profit
  + Portfolio + Cashed out − tax + spins), a note on what a real scam would have kept, how each manipulation worked,
  pre-set results, how to spot a real scam (official regulator's register, never pay to withdraw, red flags,
  cybercrime.gov.in / 1930), and "Withdraw my data" (existing endpoint, with confirmation).
- S15 Share: native share sheet or copy link (site root, no personal data); tap logged. End screen (different text
  after a data withdrawal).
- Optional `PRIZE_DRAW` (off by default): when on, consent lists the rules, and the report card shows tickets
  (1 per ₹1,000 of final balance) and a code derived from the participant id (no contact details).
- `report_shown` event logs trap score, possible score, trap ids, spin total and final balance.
- Tests (`client/src/test/reportCard.test.tsx`): for 8 simulated players (both skins) the on-screen trap score equals
  the score computed from the raw event log (what the export uses) and the final balance matches; spins revealed;
  `report_shown` logs the same score; withdrawal, share and prize draw work. Checked in Edge.
- Fixed four racy test assertions (checked async results synchronously; failed only on a busy machine) to wait
  properly. Full suite passes twice in a row: 45 server + 119 client.

**Decisions**
- `// DECISION:` Report, share and end screens use one neutral light design for both skins (the app is revealed).
- `// DECISION:` Prize-draw code = "ZT-" + first 8 hex characters of the participant id, so no extra data is stored
  and the team can match codes to rows.
- `// DECISION:` Withdrawing data on the report card goes straight to the end screen (no share prompt).

## Redesign Phase 6 — Logging and export

**Status:** done

**Built**
- `server/src/wide.ts` rewritten for the game: one row per player who reached the report card (S14), not withdrawn
  (106 columns). Assignments (skin, round-1 outcome, pool source, test withdrawal, reinvest framing, deal and spin
  order); behaviour recomputed from the event log — `decision_time_first_invest`, `s3_choice`, `plan`,
  `verify_any`/`verify_count`, `total_deposited`, `vip_upgrade`/`vip_taps`, `r1…r6_amount`, `escalation_ratio`,
  `chat_open`, `chat_deposit`, `deal_invest_/deal_details_/deal_time_{500,3000,8000}`, `pool_join`/`pool_details`/
  `pool_time`, `withdrew`, `post_withdrawal_deposit`, `reinvest_accept`/`reinvest_amount`, `crash_loss`,
  `crash_topup`/`crash_topup_amount`/`crash_time`, `tax_shown`/`tax_paid`, `brain_correct`, `spin_net`,
  `final_balance`; `trap_score`, `trap_possible` and one flag per trap (same shared function as the report card);
  all 39 response items; derived `crt_score`, `lambda` (+ `la_consistent`, `la_accepted`), `literacy_score`,
  `self_rated_literacy`, `overconfidence`, `feature_push_count`, `fomo_score`.
- Scoring keys now come from the game config (answer key, spin gains); v1 λ / CRT / literacy / overconfidence
  formulas unchanged.
- `docs/data-dictionary.md` regenerated (grouped: assignments, behaviour, traps, response items, derived scores),
  every column mapped to H1–H9.
- `/admin`: factors shown with their game names (skin, pool invite source, reinvest framing…); "completed" = reached
  the report card; "rows in wide.csv" uses the same filter as the export.
- `server/scripts/simulate.ts` rewritten for the game: 40 headless players through the real API (every 10th stops at
  the crash, some withdraw) — columns match the dictionary, no missing required values, conditional blanks exactly
  where expected, trap score / round-1 stake / final balance match each player's own game state, factors balanced.
- **The game is now the default flow** (`GAME_IS_DEFAULT = true`); the original survey flow is reachable only with
  `?game=0` until it is removed in Phase 7.
- Tests: new `wide.test.ts` (every derived column from a hand-built event log, honest-skin blanks, exclusions,
  dictionary up to date). 46 server + 119 client tests pass; browser playthrough data exports correctly.

**Decisions**
- `// DECISION:` `wide.csv` contains game players only (current step `g:…`); any data from the original survey flow
  remains in the raw `participants` / `events` / `responses` exports.
- `// DECISION:` `trap_score` is recomputed from the raw events, never copied from the client's `report_shown` log;
  `final_balance` and `spin_net` are taken from `report_shown` (descriptive only).
- `// DECISION:` `deal_details_*` = details opened before deciding, for invested and skipped deals alike.
- `// DECISION:` Column names in the database keep their v1 names (`app_version`, `referral_source`,
  `money_source`); `wide.csv` uses the game names (`skin` honest/fraud, `pool_source`, `reinvest_framing` profit/main).

**Open**
- A player who was mid-way through the old survey flow when this deploys will see the game's consent screen after a
  refresh (their partial v1 data stays in the raw exports).

## Redesign Phase 7 — Cleanup and report update

**Status:** done

**Built**
- Removed the v1 flow: 10 session screens, feature components, UI/UX and general survey (`config/survey.ts`,
  `SurveyPage`, `Question`), v1 debrief, study state, wallet, storage, `config/session.ts`, and their tests.
  `App.tsx` now renders only the game. Kept and moved: consent screen (+ `config/study.ts` trimmed to the consent
  text), `components/StudyLayout.tsx`, `RESEARCH_FOOTER` (now in `config/game.ts`).
- Server: removed the v1 stake order and survey item lists; the legacy `stake_order` column is filled with ''.
- New game tests replacing the v1 ones: consent (no fraud framing, both boxes, declining creates no record,
  `?pilot=1`) and the countdown (ticks, resets at zero, never blocks).
- `scripts/browser-smoke.mjs` (`npm run smoke`) rewritten for the game: both skins at 360 px, refresh in the middle
  of the trading rounds, hit-test of every button on every screen, dead-end detection. Passes against the local
  (scratch-database) server.
- Docs: `README.md` (game description, exports, config table, prize-draw switch, project layout),
  `docs/screens.md` (every stage, per-skin differences, logged events, hypotheses), `docs/qa-checklist.md`
  (game checks), `hypothesis-report.md` per REDESIGN_PLAN §6 — H3/H5/H7 sources = prototype logs with behavioural
  DVs, H4 λ from the bonus spins, H8 susceptibility = trap score, H1c VIP promise note, H1d fictional "NDIA", and the
  "identical mechanics and payoffs" line under H1. Hypothesis statements unchanged.
- Lint, typecheck, production build, 45 server + 86 client tests, simulation and smoke test all pass.

**Decisions**
- `// DECISION:` The H1 sub-hypothesis test line in `hypothesis-report.md` now names the S13 yes/no "Did this push
  you to invest?" reactions (plus behaviour) instead of the three v1 rating scales, since that is what the game
  measures (REDESIGN_PLAN S13). Statements are unchanged.
- `// DECISION:` The `?game=` switch was removed with the v1 flow; every link runs the game.

## Redesign Phase 8 — Playtest pass

**Status:** done

**Built / fixed after playing both skins in Edge at 360 px**
- Rounds: the amount field and quick chips now sit right under a shorter chart (they were pushed below the fold
  by the fraud skin's bonus nudge and VIP panel, leaving a disabled INVEST NOW with no visible way forward); the
  nudges follow below. The action bar shows a disabled "⏳ Trading…" button during the chart animation instead of
  going blank. "VIP 0" now reads "Member".
- Gold Plan: the slider starts at ₹0, so the H7 amount is an active choice rather than an accepted default.
- New test: every derived variable listed in REDESIGN_PLAN §5 is a `wide.csv` column (and so in the dictionary).
- Smoke test and playthroughs updated for the slider; both skins complete with no errors or covered buttons.

**Length.** The game has 51 screens. Built-in waits (spins, chart animations, withdrawal processing, chat typing)
add about 30 s and are identical in both skins; a scripted player finishes either skin in ~52 s. With realistic
reading and decision time (about 4 s per profile / reaction tap, 10–15 s per money or brain screen, 1–2 min on the
report card) a full play takes roughly 8–10 minutes.

**Decisions**
- `// DECISION:` Gold Plan slider default ₹0 (both framings).

### Final checklist
- [x] Both skins fun and complete; honest skin not noticeably shorter or duller — same 51 screens, same waits, same
      payoffs (skin-parity test); honest skin has its own animated, polished presentation.
- [x] Every DV in Section 5 exported and documented (test + generated `docs/data-dictionary.md`, 106 columns).
- [x] No real money, payment, credential or identity fields anywhere (scanned; only fictional names).
- [x] Database reset instructions in README (local file and Turso).
- [x] Every phase committed and pushed; `git status` clean; no `.env` or `.db` files in history.
- [x] Final summary written (below).

---

## Redesign summary for the team

**What changed.** The study is now a ~10-minute game, **ZenTrade**, that follows a scam lifecycle: trader profile →
bonus spins (λ) → dashboard hook → 6 trading rounds with a brain bonus (CRT + literacy) and a mentor chat → three
flash deals (H3) → a pool invite from a friend or an ad (H5) → test withdrawal (H6) → Gold Plan from profit or main
wallet (H7) → 40% crash and top-up (H4) → cash-out with the fraud skin's tax trap (H1g) → quick swipe reactions →
personal Scam Report Card (debrief) → share. Half the players get the fraud skin "ZenTrade X" (neon, huge returns,
ticker, winner pop-ups, fake NDIA badge, countdowns, VIP ladder, "Rohit Sir", flash banners, freeze warning); half
get the honest skin with identical mechanics, timings and payoffs. H3, H4, H5 and H7 are now measured by behaviour,
not hypothetical questions; H8's susceptibility is the trap score.

**Running it** is unchanged: `npm install`, `.env`, `npm run dev` (http://localhost:5173). Every link now opens the
game; `?pilot=1` still marks pilots. On Render, push to `main` and it redeploys; the Turso database gets the two new
columns automatically on start.

**Data.** `/admin` → `wide.csv`: one row per player who reached the report card (106 columns: assignments,
behaviour recomputed from the event log, trap score + per-trap flags, all answers, CRT, λ, literacy,
overconfidence, FOMO). Column-by-column documentation in `docs/data-dictionary.md`; stage list in
`docs/screens.md`; `hypothesis-report.md` variables updated (statements unchanged).

**Decisions worth a look before piloting** (all marked `// DECISION:` and listed per phase above):
- Economy: round stakes and flash deals are trades (no affordability confound); a ₹2,000 streak reward after
  round 6 makes the profit-framed Gold Plan always fundable; the crash hits Main + Portfolio.
- Traps 8–10 ("3 more"): never verified anything, deposited after the withdrawal stage, took the Gold Plan; trap 1 =
  deposited in round 1 (measurable in both skins). Honest players can score at most 9 (no tax screen).
- Frozen money in the fraud skin still counts in the final balance, so the optional prize draw rewards choices only.
- Prior financial education kept in the profile (H8); "ever scammed" dropped (would prime suspicion).
- Gold Plan slider starts at ₹0; flash-deal and spin orders are random (not balanced) order controls.
- `PRIZE_DRAW` is off; switch on only with instructor approval.

**Before real data collection:** play both skins on a real phone (`docs/qa-checklist.md`), run a few `?pilot=1`
players on the live site, then reset the Turso database (`npm run db:reset -- --yes` with the Turso lines in
`.env`). Keep the Turso lines commented out in `.env` while developing, so local tests never reach live data.

---

## Playtest fixes (after Redesign Phase 8)

**Status:** done

**Changed**
- **No data-withdrawal option.** The report card's "Withdraw my data" section, its confirmation, the end screen's
  withdrawn text, the client API call and the `POST /api/participants/:id/withdraw` endpoint are removed. The
  `participants.withdrawn` column stays (default 0), and rows flagged earlier are still left out of every export and
  counted on `/admin`, so old exports work as before.
- **4 trading rounds instead of 6.** Round 1 stays randomized (+8% / 0%, H2) and round 2 stays +6%, so the
  escalation ratio (round 2 ÷ round 1) is unchanged. Rounds 3–4 now pay +10% and +12%. The brain bonus comes after
  round 2 and the mentor chat after round 3 (`ECONOMY.rounds.brainAfterRound` / `chatAfterRound`). The ₹2,000 streak
  reward is paid after round 4. The crash is unchanged. `wide.csv` drops `r5_amount` and `r6_amount`.
- **4 bonus spins instead of 6:** lose ₹100 vs win ₹100 / ₹150 / ₹200 / ₹300, random order, results still hidden
  until the report card. λ = smallest accepted win ÷ 100 (1, 1.5, 2 or 3); rejecting all = 3.5; accepting a win and
  then rejecting a larger one = inconsistent → blank. `wide.csv` drops `la_gain_50` and `la_gain_250`. 102 columns
  now; `docs/data-dictionary.md` regenerated.
- **Dark background in both skins.** The honest skin now uses a dark slate theme on every screen, including the report,
  share and end screens. Text, cards, buttons, chart and gauge colours were re-tuned for contrast. Everything that makes
  it honest is unchanged: normal-size numbers, readable risk line above the buttons, equal Invest / Skip buttons, and
  no toasts, ticker, timers, badges or confetti. The fraud skin is unchanged. The consent screen is untouched.
- Docs: `README.md`, `docs/screens.md`, `docs/qa-checklist.md`, and the H4 variable line in `hypothesis-report.md`
  (spin values and λ rule; the statement is unchanged).
- Tests: step order (brain after round 2, chat after round 3, 47 steps); round rates; a never-investing player can
  fund both Gold Plan framings in all 32 conditions; λ for 1 / 1.5 / 2 / 3 / 3.5, inconsistent answers and spin order;
  no withdraw option on the report or end screen (both skins); legacy `withdrawn` rows excluded from exports, and the
  withdraw endpoint is gone; export test updated to 4 rounds and 4 spins.

**Decisions**
- `// DECISION:` Rounds 3–4 pay +10% / +12%: someone who stakes the same amount every round gets the same total gain
  into Profit over the later rounds as before (+28% of the stake: 6 + 10 + 5 + 7 before, 6 + 10 + 12 now). The old −4%
  dip in round 3 is dropped; the crash remains the scripted loss.
- `// DECISION:` The ₹2,000 streak reward is kept (paid after round 4). Round gains alone cannot guarantee the profit
  framing of the Gold Plan for players who skip every round; the reward does, in both skins.
- `// DECISION:` Accepting all four spins gives λ = 1 (smallest accepted win ₹100 ÷ ₹100); previously the ₹50 spin
  allowed λ = 0.5.
- `// DECISION:` The withdraw endpoint is removed (not just hidden) so participants have no way to withdraw; the
  simulation and tests set the legacy flag directly in the database.
- `// DECISION:` The report, share and end screens use the same dark slate design (the app is revealed by then).

**Checks**
- Lint, typecheck, 48 server + 89 client tests, the 40-player API simulation, and `npm run smoke` (both skins at
  360 px, refresh mid-game, no covered buttons, no horizontal scroll) all pass.
- Played both skins end to end in Edge at 360 px with screenshots: no page errors, no covered buttons. The honest
  skin's text and cards are readable on dark.

**Length.** The game now has 47 screens (was 51). A scripted player finishes in 41–47 s (was ~52 s). With realistic
reading and decision time (about 4 s per profile / spin / reaction tap, 12–15 s per money or brain screen, 1–2 min on
the report card), a full play takes about 7½–8½ minutes, roughly 40 s shorter than before.

**Open**
- A player who is mid-game on round 5 or 6 when this deploys has a saved step that no longer exists. A refresh then
  shows the consent screen and starts them as a new participant (no dead end); their partial data stays in the raw
  exports. Deploy between sessions, and reset the database before real collection as planned.

---

## Playtest fixes 2

**Status:** done

**Changed**
- **Mini-games interleaved with the rounds** (same structure in both skins): profile → home → spin 1 → round 1 →
  bonus question 1 → round 2 → spin 2 → round 3 → bonus questions 2–3 → [mentor chat, fraud only] → round 4 →
  bonus question 4 → flash deals → pool → test withdrawal → Gold Plan → crash → cash out → reactions → report card.
  Spins and bonus questions are pop-ups (`ui/PopupStage.tsx`, `Modal` in `ui/kit.tsx`) over the trading screen,
  which is dimmed and `inert` behind them. Each pop-up is still its own step, so refresh-resume works.
- **2 bonus spins:** lose ₹100 vs win ₹150 and lose ₹100 vs win ₹250, order random per player (`spin_order`,
  exported). Results hidden until the report card. `loss_aversion_group` replaces `lambda`: 1 = accepted ₹150 (low,
  λ ≤ 1.5), 2 = accepted only ₹250 (typical, 1.5–2.5), 3 = rejected both (high, λ > 2.5); accepted ₹150 but rejected
  ₹250 = blank (`la_consistent = 0`).
- **4 bonus questions:** bat-and-ball CRT (₹5), then the Big Three literacy items; ₹100 per correct answer. `crt_2`
  and `crt_3` removed; `crt_correct` (0/1) replaces `crt_score`; `literacy_score` (0–3) and `overconfidence` (the
  self-rating stays in the profile) unchanged. `brain_correct` is now 0–4.
- **VIP system (fraud only):** VIP ladder pop-up on the first home visit (VIP 1 = 2%, VIP 2 = 3%, VIP 3 = 5% daily,
  with thresholds); a persistent VIP bar on every money screen ("VIP 1 · ₹3,200 / ₹5,000 to VIP 2"); a nudge after
  every round ("Deposit ₹X more to unlock VIP 2 and earn 3% daily"; tapping pre-fills the next round); a level-up
  banner with confetti when a threshold is crossed. Every higher rate starts "next cycle", so payoffs stay identical.
  Logged: `vip_popup_shown`, `vip_popup_close` (ms), `vip_nudge_tap`, `vip_level_up`. New columns: `vip_level`,
  `vip_popup_time`, `vip_nudge_taps`, `vip_level_ups`.
- **Shorter honest skin:** no mentor-chat screen; quick reactions skip the 7 feature swipe cards; the final
  withdrawal processes instantly and moves straight on.
- **Both skins:** the round chart animation is 7 s (was 2.6 s). Flash deals are one screen with three cards in
  random order, each with its own "View details" and "Invest"; per-deal invest, details-before and decision time are
  still logged.
- `hypothesis-report.md`: the H1 moderator is "CRT (single bat-and-ball item, correct / incorrect)"; the H4 IV is "loss
  aversion group (low / typical / high) from 2 in-game spins". Docs: `docs/screens.md`, `docs/qa-checklist.md`,
  `README.md`; `docs/data-dictionary.md` regenerated (102 columns: 4 removed, 4 added).
- Tests: step lists per skin (fraud 41 steps, honest 33); skin parity (honest steps = fraud steps minus the
  fraud-only ones; same balances and payoffs); the headless player for all 32 conditions (VIP events fraud only,
  honest has no feature answers or chat events, trap maximum 10 / 8); spin and bonus pop-ups (inert background,
  answers stored); one-screen deals; VIP pop-up / bar / nudge / pre-fill / level-up; honest instant cash-out;
  loss-aversion group and CRT scoring; export columns and honest blanks; the 40-player simulation. The browser
  smoke test follows the new flow and checks the pop-ups, the 3 deal cards, the VIP nudges and the tax block.

**Decisions**
- `// DECISION:` The mentor chat (fraud) sits right before round 4, after bonus questions 2–3, so the 60-second
  chat-deposit window covers the round-4 stake.
- `// DECISION:` Decision time on the home screen runs from when the dashboard is usable. For the fraud skin that is
  when the VIP pop-up closes; the pop-up time is exported separately (`vip_popup_time`), so the pop-up does not add
  reading time to the H1 comparison.
- `// DECISION:` The VIP pop-up shows on the first visit to the home screen only, not again after a refresh.
- `// DECISION:` A deposit that jumps two VIP levels logs one `vip_level_up` (with the new level) and shows one banner.
- `// DECISION:` The honest skin still answers the 3 FOMO statements, not only the two sliders: FOMO is the H5
  moderator and an H9 bias score, and dropping it would remove those for half the sample. The task said honest
  players "only answer the overall trust and urgency sliders"; removing the FOMO cards too is a one-line change in
  `fraudOnlyStep()` in `steps.ts`.
- `// DECISION:` The chat trap is now fraud-only (honest players never see a chat), so honest players can score at
  most 8 traps (was 9). `chat_open`, `chat_deposit`, `trap_chat`, `feature_push_*` and `feature_push_count` are blank
  for honest players.
- `// DECISION:` Deal decision time = seconds from opening the deals screen to tapping that deal's Invest; for a deal
  not taken, to Continue.
- `// DECISION:` The task asked for a 6–8 s chart animation under "speed up"; 6–8 s is longer than before (2.6 s),
  so it was set to 7 s as written (`ECONOMY.rounds.chartMs`). It adds about 18 s per player in both skins.

**Effects on the analysis to note**
- H1a–H1g: the feature swipe cards ("Did this push you to invest?") now exist only in the fraud skin, so the
  plain-vs-fraud chi-square per feature described under H1 in `hypothesis-report.md` can no longer be run;
  only within-fraud answers plus the behaviour per feature remain. That line in the report was not changed
  (only the two requested edits were made).
- H1f: the honest skin has no chat counterpart, so the 60-second chat deposit exists for fraud players only;
  `r4_amount` (the stake right after the chat slot) can be compared across skins instead.
- The honest skin is now about a minute shorter than the fraud skin (REDESIGN_PLAN rule 7 asked for equal length).

**Checks**
- Lint, typecheck, 49 server + 99 client tests, the 40-player simulation and `npm run smoke` all pass. In the
  smoke test, fraud ran 40 screens in 59 s and honest 32 screens in 48 s (scripted), with a refresh mid-game, no
  covered buttons and no sideways scroll.
- Played both skins at 360 px with screenshots of every screen (VIP pop-up, spin and bonus pop-ups, one-screen
  deals, VIP bar / nudge / level-up, honest dark theme).

**Length.** Scripted runs: fraud 59–65 s and honest 48–52 s, which includes the built-in waits (four 7 s charts,
spin animations, chat typing). With realistic reading and decision time (≈4 s per profile or reaction tap, 6 s
per spin, 10 s to decide each round, 10–15 s per bonus question, 30 s on the deals screen, 12–15 s per other money
screen, 1½ min on the report card), a full play takes about **7½–8 minutes in the fraud skin** and about
**6½–7 minutes in the honest skin**.

**Open**
- A player mid-game when this deploys whose saved step no longer exists (an old `g:spin:2`, `g:brain:4`,
  `g:deal:1`, or an honest player on `g:chat` / a feature card) restarts at consent as a new participant. Reset the
  database before real collection as planned.

---

## Playtest fixes 3 — clearer round results

**Status:** done

**Why:** in playtests Main looked frozen at ₹10,000 through all four rounds, and the result felt slow. Both were
by design: a round stake stays in Main, a gain goes to Profit, a loss comes off Main, and every round is ≥ 0%. The
header updated at the tap, but the result card only appeared after the 7-second chart.

**Changed**
- While a round's chart runs, the header shows the wallets from before the trade, with the stake taken out of Main
  and labelled "₹X in trade". When the chart ends, the stake returns to Main, the gain counts up into Profit, and the
  result card, the VIP bar and any VIP level-up banner all appear at the same moment. Display only
  (`WalletDisplay` in `ui/GameShell.tsx`, set by `stages/Round.tsx`): the game state and the logged
  `round_invest` event still hold the settled result from the tap, so payoffs and data are unchanged.
- Round chart animation: 3 s (was 7 s), both skins.
- The animated counters (`useCountUp`) now time themselves with `performance.now()` instead of the frame timestamp.
  When the two clocks differed (seen in the test browser), a counter could briefly run backwards or stall.
- `docs/screens.md` updated. New tests (both skins): during the chart Main shows ₹9,000 with "₹1,000 in trade",
  Profit is unchanged and there is no result; when it ends the result card shows +₹80, Main is back to ₹10,000 and
  Profit is ₹580.

**Decisions**
- `// DECISION:` The money model is unchanged (stake stays in Main, gain → Profit). Only the display during the chart
  shows the stake as "in trade", which explains why Main ends unchanged after a winning round.
