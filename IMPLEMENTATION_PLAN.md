# Implementation Plan — Fraud-Style Investment App (Research Prototype)

Project: *Analyzing the Behavioral Mechanics of App-Based Investment Frauds* (neuroeconomics course project).

This file tells Claude Code how to build the research app from start to finish. Work through the phases **in order**. Each phase ends with a checklist; finish it before moving on.

---

## 0. Rules for Claude Code (read first)

1. **Read `hypothesis-report.md` in full before writing any code.** Every screen, randomized factor and logged variable in this plan exists to test a hypothesis in that file (H1–H9). If this plan and the report disagree, follow the report and note the conflict in your final summary.
2. **Commit and push after each phase, without asking for confirmation.**
   - At the end of every phase (once its checklist passes), stage the changes, commit, and push to the current branch.
   - Commit message format: `Phase N: <short summary>` (e.g. `Phase 2: database schema, API and randomization`). Smaller commits within a phase are fine for large steps.
   - Before each commit, run `git status` and make sure no secrets or local data are staged: never commit `.env`, `*.db`, `node_modules/` or `dist/`.
   - Never force-push, never run `git rebase`, `git reset --hard`, or amend commits that are already pushed, and never delete branches.
   - If a push fails (auth, conflicts, no remote), stop pushing, keep committing locally, and report the error in your summary.
3. **This is a research simulation, not a real app.**
   - No real money, no payment gateways, no UPI/card/bank fields, ever.
   - No passwords, phone numbers, emails, PAN or Aadhaar collected from participants.
   - All money is virtual ("₹" shown, but a simulated wallet only).
   - Use a **fictional app name** and **fictional regulator names** (e.g. "National Digital Investment Authority", "NDIA Certified"). Never use real logos, real regulator names (SEBI, RBI), or real broker names.
4. Keep the code simple and readable. Two students will maintain it.
5. When something in this plan is ambiguous, choose the simplest option, leave a `// DECISION:` comment, and list it in the final summary.
6. At the end, write a short summary: what was built, how to run it, how to export data, and any open decisions.

---

## 1. Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React + TypeScript + Vite, Tailwind CSS, mobile-first |
| Backend | Node.js + Express + TypeScript |
| Database | SQLite (via `better-sqlite3`) |
| Tests | Vitest (unit), a scripted end-to-end session test |
| Repo layout | `client/`, `server/`, `docs/` (keep `hypothesis-report.md` at root) |

One command (`npm run dev` at root) should start both client and server. One command (`npm run build && npm start`) should serve the built client from the Express server, so the whole thing deploys as a single Node app (Render / Railway / any VPS).

Configuration via `.env` (provide `.env.example`):
- `PORT`
- `ADMIN_PASSWORD` — protects the data-export page
- `DB_PATH`

---

## 2. Participant journey (overview)

Every participant goes through this exact order. Debrief comes **last** so it cannot bias the survey answers.

1. Consent
2. Random assignment (server-side)
3. App session (~10 min) — plain or fraud-style version
4. UI/UX survey (feature ratings)
5. General survey (bias measures, scenarios, literacy, demographics)
6. Debrief
7. Thank-you screen

A participant is identified only by a random `participant_id` (UUID) created at consent. Store it in `sessionStorage` so a page refresh resumes the same participant at the same step.

---

## 3. Phase 1 — Project setup

- Scaffold `client/` (Vite React TS + Tailwind) and `server/` (Express TS).
- Root `package.json` with scripts: `dev`, `build`, `start`, `test`, `lint`.
- Set up ESLint + Prettier.
- Add `README.md` with setup and run instructions.
- Add `.gitignore` (node_modules, dist, `.env`, `*.db`).

**Checklist:** `npm install` and `npm run dev` work; a blank client page talks to a `/api/health` endpoint.

---

## 4. Phase 2 — Database and API

### Tables

**participants**

| Column | Notes |
| --- | --- |
| participant_id | UUID, primary key |
| created_at | timestamp |
| consented | boolean |
| app_version | `plain` / `fraud` (H1) |
| round1_outcome | `small_win` / `flat` (H2) |
| withdrawal_offer | `allowed` / `not_offered` (H6) |
| referral_source | `friend` / `ad` (H5, survey) |
| money_source | `profit` / `own` (H7, survey) |
| current_step | for resume |
| completed_at | timestamp or null |

**events** — append-only behaviour log

| Column | Notes |
| --- | --- |
| id | auto |
| participant_id | FK |
| ts | server timestamp (ms) |
| client_ts | client `performance.now()`-based ms |
| screen | screen name |
| event_type | e.g. `screen_view`, `invest_click`, `exit_click`, `verify_click`, `chat_open`, `topup_click`, `fee_pay_click`, `fee_decline_click` |
| payload | JSON (amount, plan id, etc.) |

**responses** — survey answers

| Column | Notes |
| --- | --- |
| participant_id | FK |
| item_id | stable question id (e.g. `uiux_timer_urgency`, `crt_1`, `h3_stake_500_willing`) |
| value | text/number |
| answered_at | timestamp |

### Endpoints

- `POST /api/participants` → creates participant, runs randomization, returns id + assignments
- `GET /api/participants/:id` → current step + assignments (resume)
- `POST /api/participants/:id/step` → update current step
- `POST /api/events` → batch of events (client buffers and flushes every few seconds + on screen change)
- `POST /api/responses` → batch of answers
- `GET /admin` (password) → simple page with counts per condition and export buttons
- `GET /api/export/participants.csv`, `/api/export/events.csv`, `/api/export/responses.csv`, `/api/export/wide.csv` (password)

### Randomization

Each factor is assigned **independently** with balanced (block) randomization so groups stay near 50/50 even with small samples: for each factor, keep a running count per level and assign to the smaller group, breaking ties randomly. Do it server-side.

**Checklist:** endpoints work, unit tests for randomization balance (simulate 100 participants → each factor within 50±2).

---

## 5. Phase 3 — Shared app shell and simulated wallet

- Fictional app name and logo (simple generated SVG), styled to look like a modern Indian trading/earning app (dark theme, green/gold accents, cards, bottom nav).
- **Virtual wallet**: every participant starts with a simulated **₹10,000** "practice balance" (explained on the first app screen as money they can choose to use in the app). All deposits come from this balance so amounts are comparable.
- A small, always-visible footer: "Research prototype — no real money is used."
- Event logger hook (`useLog`) that records `screen_view` on mount and exposes `log(eventType, payload)`.
- Decision timer utility: records time from a screen's first render to the first decisive click (`invest_click` or `exit_click`).

**Checklist:** shell renders on a phone-size viewport; wallet balance updates correctly; events reach the DB.

---

## 6. Phase 4 — App session screens

Both versions have the **same screens, same returns and same flow**. The fraud version adds the H1 dark-design features; the plain version shows neutral equivalents. Build each screen once with a `version` prop.

| # | Screen | Plain version | Fraud-style version | Logs | Hypothesis |
| --- | --- | --- | --- | --- | --- |
| A1 | Welcome / onboarding | Short intro to the app | Same + **sign-up bonus** ₹500 credited to wallet, "withdrawable after your first deposit" (H1b) | screen_view | H1b |
| A2 | Investment plans | 3 plans with returns stated plainly, an "About / Verify" link | Same plans + **countdown timer** and **"only 3 slots left"** (H1a), **VIP tiers** (deposit more → higher daily return, H1c), **fictional regulator badge and certificate** (H1d), **live withdrawal ticker** and **screenshot testimonials** (H1e), same "About / Verify" link | decision time, invest/exit, plan, amount, verify_click | H1, H1a, H1c, H1d, H1e |
| A3 | Deposit 1 | Amount input | Same | amount (R1) | H1, H2 |
| A4 | Round-1 outcome | Shows result per `round1_outcome`: small win (e.g. +8%) or flat (0%) | Same | — | H2 |
| A5 | Deposit 2 | "Invest again?" | Same + **mentor / customer-service chat** bubble that messages "Most members upgrade to VIP 2 today" (H1f) | amount (R2), chat_open | H2, H1f |
| A6 | Withdrawal stage | If `allowed`: user may withdraw a small amount (e.g. ₹200) and it "succeeds". If `not_offered`: no withdrawal option shown. | Same | withdraw_click | H6 |
| A7 | Deposit 3 | "Add more?" | Same (chat still present) | amount (post-withdrawal) | H6 |
| A8 | Scripted loss | Balance drops (e.g. −30%, "market correction"), button "Top up to recover" and "Leave" | Same | topup_click, top-up amount | H4 |
| A9 | Final withdrawal | Withdrawal processes normally | Withdrawal **blocked**: "Pay 10% processing tax to unlock your balance" (H1g); buttons "Pay fee" / "Don't pay" (simulated) | fee_pay_click / fee_decline_click | H1g |
| A10 | End of session | "Session complete" → continue to survey | Same | screen_view | — |

Notes:
- Same returns in both versions. Only presentation differs.
- The plain version's "About / Verify" page shows neutral company info. In the fraud version the same link exists (verification clicks are a DV) and shows the fictional certificate.
- The countdown timer must actually tick down but must not force a decision; if it reaches zero it resets ("New slots opening"). Never block progress.
- Testimonials, ticker names and chat messages are fictional, hard-coded, clearly synthetic content (no real people).
- Every screen needs a way to continue without investing, so "no investment" is a valid, logged choice.
- Put all amounts, percentages and texts in one config file (`client/src/config/session.ts`) so the team can adjust them without touching components.

**Checklist:** a full run-through works in both versions and under every combination of `round1_outcome` and `withdrawal_offer`; all listed events appear in the DB.

---

## 7. Phase 5 — UI/UX survey (H1h / feature ratings)

Shown after A10. For each feature, show a small screenshot or re-render of the element **from the participant's own version** (plain users see the plain counterpart) and ask three 1–7 Likert items: *How urgent did this make you feel? How trustworthy did this seem? How tempted were you to invest?*

Features to rate (fraud element → plain counterpart):
- Countdown timer & limited slots → plain plan card
- Sign-up bonus → plain welcome card
- VIP tiers → plain plan list
- Regulator badge / certificate → plain About page
- Withdrawal ticker & testimonials → plain plan screen without them
- Mentor chat → plain FAQ/help link
- Withdrawal processing-tax screen → plain withdrawal confirmation

Then two overall items: overall trust in the app (1–7), overall urgency (1–7).

Item IDs: `uiux_<feature>_<urgency|trust|temptation>`, `uiux_overall_trust`, `uiux_overall_urgency`.

---

## 8. Phase 6 — General survey

One question per screen or short grouped pages; progress bar; all answers required except free text.

| Block | Content | Hypothesis |
| --- | --- | --- |
| CRT | 3 standard Cognitive Reflection Test items (bat & ball, machines, lily pads), free numeric answer; score 0–3 | H1 moderator |
| Loss aversion | 6 mixed 50-50 gambles: lose ₹100 vs win ₹50, 100, 150, 200, 250, 300 — accept/reject each; λ estimated from the switching point | H4, H8, H9 |
| Stake scenarios | Same scenario at ₹500, ₹5,000, ₹50,000 (within-subject, randomize order): willingness to invest (1–7) + "would you verify first?" (yes/no) | H3 |
| Referral scenario | Shows the `referral_source` version only (friend referral vs ad): willingness to join (1–7) + verify first (yes/no) | H5 |
| Herd / FOMO | 4–5 Likert items | H5 moderator, H9 |
| Money source scenario | Shows the `money_source` version only (reinvest ₹2,000 app profit vs deposit ₹2,000 own money): willingness (1–7) + amount (₹0–2,000 slider) | H7 |
| Financial literacy | Big Three: interest, inflation, diversification; score 0–3 | H8 |
| Self-rated literacy | 1–7 | H8 (overconfidence) |
| Susceptibility | 4–5 short scam-scenario willingness items (1–7) → index | H8, H9 |
| Experience & exposure | Prior financial education (y/n), investing experience (none/some/regular), trading/crypto app use (y/n), prior scam exposure (never/targeted/lost money) | Controls, H8 |
| Demographics | Age (number), gender, family income band, field of study | Controls, H9 |

Keep all question text in `client/src/config/survey.ts`. Derived scores (CRT, λ, literacy, overconfidence, susceptibility index, herd score) are computed **server-side** at export, not in the browser.

---

## 9. Phase 7 — Consent and debrief

**Consent screen** (before anything else):
- Purpose stated as "a study of how people use investment apps" (do not reveal the scam framing yet).
- ~15 minutes, voluntary, can stop anytime, no real money, no identifying information collected, data used only for a course project.
- Confirm 18+ and agree checkbox. If not agreed, end politely and create no record.

**Debrief screen** (after the general survey):
- Explain the app was a simulated fraud app and which features were manipulative (list them: timers, fake scarcity, bonus locks, VIP tiers, fake regulator badges, fake ticker/testimonials, mentor chat, withdrawal "tax").
- Practical tips: verify registration on the real regulator's website, never pay a fee to withdraw, be wary of guaranteed returns, report to cybercrime.gov.in / 1930.
- Option to withdraw their data (button → marks participant `withdrawn = true`; exclude from export).

Add the `withdrawn` column to `participants`.

---

## 10. Phase 8 — Data export

`/admin` (password from `ADMIN_PASSWORD`):
- Counts: total, completed, withdrawn, and per level of each randomized factor.
- Download buttons for the four CSVs.

`wide.csv` — **one row per completed, non-withdrawn participant**, with:
- All assignments
- Decision time on A2 (seconds), invested (y/n), plan, R1 amount, R2 amount, escalation ratio (R2/R1, blank if R1 = 0), verify_click (y/n), chat_open (y/n), withdrew (y/n), post-withdrawal deposit, top-up (y/n), top-up amount, fee paid (y/n)
- All survey item values
- Derived scores: CRT, λ, literacy, self-rated literacy, overconfidence (z(self-rated) − z(quiz), computed over the exported sample), herd score, susceptibility index

Document every column in `docs/data-dictionary.md`, mapping each to its hypothesis (H1–H9).

---

## 11. Phase 9 — Testing and QA

- Unit tests: randomization balance, score calculations (CRT, λ, literacy, overconfidence), escalation ratio edge cases.
- An end-to-end script (`server/scripts/simulate.ts`) that runs ~40 simulated participants through the API with random choices and checks the export has the expected columns and no missing required values.
- Manual check list in `docs/qa-checklist.md`: phone layout (360px wide), refresh-resume, both versions, all condition combinations, debrief and data withdrawal, admin export.
- Make sure no screen can dead-end and the timer never blocks progress.

---

## 12. Phase 10 — Documentation and deployment prep

- `README.md`: install, run, build, environment variables, how to deploy as one Node service, how to reset the database before real data collection.
- `docs/data-dictionary.md` (Phase 8).
- `docs/screens.md`: one line per screen, which version shows what, and which hypothesis it serves (copy of the Phase 4 table kept up to date).
- A pilot mode flag (`?pilot=1` on the link) that tags participants as pilot so they can be excluded from analysis.

**Final checklist before reporting done:**
- [ ] All screens in both versions work end to end
- [ ] All randomized factors assigned and balanced
- [ ] Every DV listed in `hypothesis-report.md` for H1–H7 is logged or asked
- [ ] Survey covers the measures needed for H3, H5, H7, H8, H9
- [ ] Export produces `wide.csv` matching the data dictionary
- [ ] Tests pass
- [ ] No real payment, credential or identity fields anywhere
- [ ] Every phase committed and pushed; `git status` clean; no `.env` or `.db` files in history
- [ ] Final summary written for the team
