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
