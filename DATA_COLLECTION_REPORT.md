# Data Collection Report — Behavioral Mechanics of App-Based Investment Frauds

The master reference for every piece of data the project collects: what is collected, from where, why, how it is coded, and which hypothesis it serves. Use this file as the base for the analysis pipeline. Hypotheses are those in `hypothesis-report.md` (H1–H9).

The project has three data sources:

| Part | Source | What it is | Who | Link |
| --- | --- | --- | --- | --- |
| **B** | ZenTrade research app | A 7–8-minute trading game, randomized experiment (honest vs fraud skin plus four other factors) | College volunteers | App link |
| **C** | Survey form | An 11-question Google Form on real-life experience with scam investment apps | College volunteers | Separate form link |
| **D** | Existing dataset | A public individual-level survey with fraud victimization, literacy and demographics | General population | Download |

The app and the survey are **separate studies with separate links**. They are not linked per person: some volunteers will do both, some only one. Each is analysed on its own, and the results are combined only at the level of conclusions (Part E).

> Research simulation only: the app uses virtual rupees, with no payment, card, UPI or bank fields, and no names, emails, phone numbers or ID numbers. The survey is anonymous and collects no contact details. The app ("ZenTrade" / "ZenTrade X"), the regulator ("NDIA") and all people shown are fictional.

## Contents

- **Part A — Overview**
  - A1. Which hypothesis comes from which source
  - A2. Collection procedure
- **Part B — The ZenTrade app**
  - B1. Study design at a glance
  - B2. Randomization
  - B3. The two versions (skins)
  - B4. Game flow, step by step
  - B5. Game economy (all numbers)
  - B6. Stage by stage: what, why, data, hypothesis
  - B7. Data files
  - B8. Event log reference (`events.csv`)
  - B9. Analysis file reference (`wide.csv`, 102 columns)
  - B10. Derived scores: exact formulas
  - B11. Traps and the trap score
  - B12. Hypothesis → variables → test
  - B13. Pipeline recipe (cleaning and preparation)
  - B14. Caveats and design decisions that affect analysis
- **Part C — The survey form**
  - C1. Purpose and design
  - C2. Questions
  - C3. Variables and coding
  - C4. Hypothesis → variables → analysis
  - C5. Pipeline recipe
  - C6. Caveats
- **Part D — Existing dataset**
- **Part E — Combined evidence per hypothesis**

---

## Part A — Overview

### A1. Which hypothesis comes from which source

No measure is collected twice. The app is the causal test; the survey shows whether the same tricks happen in real life; the dataset covers age, income and real victimization in the general population.

| Hypothesis | App (Part B) — experiment | Survey (Part C) — real life | Existing dataset (Part D) |
| --- | --- | --- | --- |
| H1 Dark design | **Main test:** honest vs fraud skin on decision time, investing, amounts, verification, trust, urgency | Q2: which tricks respondents have seen | — |
| H1a Countdown / scarcity | Feature card (fraud); skin comparison | Q2 options 1–2 | — |
| H1b Locked sign-up bonus | Feature card (fraud); `trap_hook` by skin | Q2 option 6 | — |
| H1c VIP levels | Feature card (fraud); VIP measures by skin | Q2 option 7 | — |
| H1d Fake credentials | Feature card (fraud); verification by skin | Q2 option 8 | — |
| H1e Social proof | Feature card (fraud); skin comparison | Q2 option 4 | — |
| H1f Mentor chat | `chat_deposit` (fraud); `r4_amount` by skin | Q2 option 9 | — |
| H1g Withdrawal tax | `tax_paid` (fraud) | Q2 option 10; Q10 | — |
| H2 Early win | **Main test:** round-1 win vs flat | Q7 | — |
| H3 Small stakes | **Main test:** flash deals ₹500 / ₹3,000 / ₹8,000 | Q6 | — |
| H4 Loss chasing | **Main test:** loss aversion group → crash top-up | Q10 | — |
| H5 Friend referral | **Main test:** friend invite vs ad | Q4; Q2 option 5 | — |
| H6 Test withdrawal | **Main test:** withdrawal allowed vs not | Q8 | — |
| H7 House money | **Main test:** profit vs main wallet framing | Q9 | — |
| H8 Literacy paradox | Literacy and overconfidence → trap score | — | **Main test:** literacy and overconfidence → real victimization |
| H9 Bias by group | Bias scores × gender (age and income vary little) | — | **Main test:** age, income and gender groups |

### A2. Collection procedure

1. **Reset the app database** before real collection: `npm run db:reset -- --yes`. Earlier test runs must not mix with real data.
2. **Pilot** with 5–8 people using `?pilot=1` app links and a test run of the form. Delete test rows from the form's Google Sheet afterwards.
3. **Share two links separately** in college groups: the app link (main) and the form link. Ask people to do both, but each stands alone.
4. **Targets:** at least 100 completed app players (about 50 per skin; every randomized factor about 50 per level). The survey has no randomization, so any number helps; aim for 100+.
5. **Monitor** app balance and completions on `/admin`; check the form's response count daily.
6. **Close collection** on the planned date, then download `wide.csv`, `participants.csv`, `events.csv`, `responses.csv` from `/admin` and the form's Google Sheet as CSV.

---

## Part B — The ZenTrade app

### B1. Study design at a glance

| Item | Value |
| --- | --- |
| Design | Between-subjects experiment inside a ~7–8-minute trading game, plus within-subject parts (H3 deal sizes) and in-game questions |
| Main IV | **Skin** (app version): `fraud` ("ZenTrade X", dark-design layer) vs `honest` ("ZenTrade", same mechanics without manipulation) |
| Other randomized IVs | Round-1 outcome (H2), pool invite source (H5), test withdrawal (H6), Gold Plan framing (H7) |
| Order controls | Flash-deal card order (H3), bonus-spin order (H4) |
| Unit of analysis | One participant = one browser tab (one row in `wide.csv`) |
| Inclusion in `wide.csv` | Reached the Scam Report Card (S14), not flagged withdrawn, played the game version |
| Pilots | Links with `?pilot=1` → `is_pilot = 1`; randomized separately; **exclude from analysis** |
| Money | Virtual ₹ only. Market results are **scripted** (identical for everyone except the randomized round-1 result); only the two bonus-spin outcomes are random (50/50) |
| Debrief | The Scam Report Card at the end reveals the fraud, lists the traps fallen for, gives safety tips |

Approximate play time: fraud skin 7½–8 min (40 screens), honest skin 6½–7 min (32 screens).

### B2. Randomization

Assigned on the server when the participant clicks "Agree and start" on the consent screen.

| Factor (`wide.csv` column) | Stored in DB as | Levels | Hypothesis | How assigned |
| --- | --- | --- | --- | --- |
| `skin` | `app_version` | `honest` (`plain`) / `fraud` | H1, H1a–H1g | Balanced |
| `round1_outcome` | `round1_outcome` | `small_win` (+8%) / `flat` (0%) | H2 | Balanced |
| `pool_source` | `referral_source` | `friend` / `ad` | H5 | Balanced |
| `withdrawal_offer` | `withdrawal_offer` | `allowed` / `not_offered` | H6 | Balanced |
| `reinvest_framing` | `money_source` | `profit` (`profit`) / `main` (`own`) | H7 | Balanced |
| `deal_order` | `deal_order` | permutation of 500, 3000, 8000 | H3 order control | Random shuffle |
| `spin_order` | `spin_order` | `150;250` or `250;150` | H4 order control | Random shuffle |

- **Balanced** = each factor is assigned independently: the new participant joins the level with fewer participants
  so far (ties broken at random). Groups stay within ±1 of 50/50 at any sample size. Factors are independent of each
  other, so the 32 combinations of the five factors are roughly equally filled in large samples (not guaranteed per
  cell).
- Pilot and real participants are balanced separately.
- Sign-ups are queued inside one server process so two simultaneous sign-ups cannot break the balance (the server
  must run as a single instance).

### B3. The two versions (skins)

Both skins use **the same stage order, amounts, scripted returns, payoffs and timings** (checked by an automated
skin-parity test that runs identical simulated players through both). Only the presentation layer differs, plus three
screens the honest skin skips (none of them moves money).

#### What is the same in both

- Dark background; same wallets (Main, Profit, Portfolio), same rounds, deals, pool, withdrawal, Gold Plan, crash,
  bonus spins and bonus questions, same rewards.
- During a round's 3-second chart the stake is shown "in trade" (out of Main); when the chart ends, the result card
  appears and Main / Profit update together.
- Every money screen has a clear way to continue without investing; countdowns reset at zero and never block.

#### Differences

| Element | Fraud skin "ZenTrade X" | Honest skin "ZenTrade" | Hypothesis |
| --- | --- | --- | --- |
| Look | Neon/gold, huge return numbers, pulsing gold INVEST NOW, haptic vibration, confetti and coins on wins, optional sounds | Dark slate, normal-size numbers, equal-size Invest / Skip buttons, no celebrations | H1 |
| Risk text | Tiny grey "T&C" link | Readable risk line above the buttons on every money screen | H1 |
| Plans | "+120% / +312% / +580% monthly" | "Expected −5% to +8% per round" etc. with risk labels | H1 |
| Countdown + "only 3 slots left" | Yes (resets at zero) | No | H1a |
| Sign-up bonus ₹500 | **Locked** until the first deposit | Credited to Profit at once | H1b |
| VIP system | VIP pop-up on first home visit (VIP 1 = 2%, VIP 2 = 3%, VIP 3 = 5% daily), VIP ladder card, persistent VIP bar on every money screen, after-round nudge "Deposit ₹X more to unlock VIP n…", level-up banner. Higher rates always start "next cycle", so real payoffs are identical | None (VIP level is still computed from deposits for analysis) | H1c |
| Trust signals | "NDIA Certified" badge (tap → certificate), ★4.9, "10 lakh+ users" | "About" page: practice app, not registered, check the official regulator | H1d |
| Social proof | Withdrawal ticker, winner toasts every 4–7 s, "LIVE · traders online", member screenshots, "members earned today" counter | None | H1e |
| Mentor chat | "Rohit Sir, Senior Advisor" typing deposit nudges before round 4 | **No screen** | H1f |
| Final withdrawal | **Blocked** by a 10% "processing tax", freeze warning, support message; Pay / Don't pay | Processes instantly; game moves straight on | H1g |
| Flash deals | Flashing banner, countdown, "people viewing" | Plain cards with terms text | (H3 is within-subject) |
| Crash | Red flash, shake, "recover in 10 minutes" countdown | Plain loss card | (H4) |
| Quick reactions | 7 feature swipe cards + 2 sliders + 3 FOMO cards (12) | 2 sliders + 3 FOMO cards (5) | H1h, H5, H9 |
| Bonus-question pop-up | Timer ring (visual only) | No timer | — |
| Trap maximum | 10 | 8 (no chat, no tax) | H8 |

### B4. Game flow, step by step

Spins and bonus questions are **pop-ups** over the dimmed, untappable trading screen. Each step id is saved as the
participant's `current_step` and in the browser, so a refresh resumes on the same screen without repeating any
scripted result.

| # | Step id | Screen | Fraud | Honest |
| --- | --- | --- | --- | --- |
| 1–8 | `g:profile:0`–`7` | S1 Trader profile (8 one-tap questions) | ✓ | ✓ |
| 9 | `g:home` | S3 Home dashboard (fraud: VIP pop-up first) | ✓ | ✓ |
| 10 | `g:spin:0` | S2 Bonus spin 1 (pop-up) | ✓ | ✓ |
| 11 | `g:round:1` | S4 Trading round 1 | ✓ | ✓ |
| 12 | `g:brain:0` | S5 Bonus question 1 — CRT bat-and-ball (pop-up) | ✓ | ✓ |
| 13 | `g:round:2` | Round 2 | ✓ | ✓ |
| 14 | `g:spin:1` | Bonus spin 2 (pop-up) | ✓ | ✓ |
| 15 | `g:round:3` | Round 3 | ✓ | ✓ |
| 16–17 | `g:brain:1`, `g:brain:2` | Bonus questions 2–3 — literacy (pop-ups) | ✓ | ✓ |
| 18 | `g:chat` | S6 Mentor chat | ✓ | — |
| 19 | `g:round:4` | Round 4 (+ ₹2,000 streak reward) | ✓ | ✓ |
| 20 | `g:brain:3` | Bonus question 4 — literacy (pop-up) | ✓ | ✓ |
| 21 | `g:deal` | S7 Flash deals (3 cards, one screen) | ✓ | ✓ |
| 22 | `g:pool` | S8 Diamond Pool invite | ✓ | ✓ |
| 23 | `g:withdraw` | S9 Test withdrawal + deposit offer | ✓ | ✓ |
| 24 | `g:reinvest` | S10 Gold Plan offer | ✓ | ✓ |
| 25 | `g:crash` | S11 Market crash + Loss Shield top-up | ✓ | ✓ |
| 26 | `g:cashout` | S12 Cash out (fraud: tax block) | ✓ | ✓ (instant) |
| 27–33 | `g:react:0`–`6` | S13 Feature swipe cards | ✓ | — |
| 34–35 | `g:react:7`, `8` | S13 Trust and urgency sliders | ✓ | ✓ |
| 36–38 | `g:react:9`–`11` | S13 FOMO agree/disagree cards | ✓ | ✓ |
| 39 | `g:report` | S14 Scam Report Card (completion is recorded here) | ✓ | ✓ |
| 40 | `g:share` | S15 Share | ✓ | ✓ |
| — | `g:end` | Thank-you screen | ✓ | ✓ |

### B5. Game economy (all numbers)

All values are in `client/src/config/game.ts` and identical in both skins.

#### Wallets

| Wallet | Meaning |
| --- | --- |
| Main | Demo cash, starts at **₹10,000**. Round stakes and deal amounts are "traded" from here; losses come off it; pool, post-withdrawal deposit, top-up (and Gold Plan in the `main` framing) move money out of it into Portfolio |
| Profit | Gains: round gains, deal gains, ₹100 per correct bonus question, ₹2,000 streak reward, sign-up bonus (honest at once; fraud after first deposit) |
| Portfolio | Locked money: pool entry, post-withdrawal deposit, Gold Plan, Loss Shield top-up |
| Cashed out | Test withdrawal; honest final withdrawal |

#### Rules

| Item | Rule |
| --- | --- |
| Trade (round or deal) | Stake stays in Main; gain = round(stake × rate) → Profit; a loss would come off Main. Stake is capped at Main |
| Minimum amount | ₹100 for any investment |
| Round returns (scripted) | Round 1: **+8%** (`small_win`) or **0%** (`flat`); round 2 **+6%**; round 3 **+10%**; round 4 **+12%** |
| Streak reward | ₹2,000 to Profit after round 4 (guarantees the profit-framed Gold Plan is always affordable) |
| Sign-up bonus | ₹500. Honest: in Profit from the start. Fraud: locked; released to Profit by the first deposit of any kind |
| Bonus questions | ₹100 to Profit per correct answer (max ₹400) |
| Bonus spins | 50% lose ₹100 / 50% win ₹150 or ₹250 if accepted; outcome drawn at random but **only counted and shown on the report card** (`spin_net`); it never changes the wallets during play |
| Flash deals | ₹500, ₹3,000, ₹8,000; settle immediately at **+5%** to Profit; every deal is always affordable |
| Diamond Pool | ₹2,000 from Main → Portfolio |
| Test withdrawal (`allowed`) | ₹500 from Main → Cashed out |
| Post-withdrawal deposit | ₹0–5,000 from Main → Portfolio |
| Gold Plan | ₹0–2,000 (slider, steps of ₹100, **starts at ₹0**) from Profit (`profit` framing) or Main (`main` framing) → Portfolio |
| Market crash | Main and Portfolio × 0.6 (−40%); Profit untouched; `crash_loss` = total taken |
| Loss Shield top-up | Any amount from Main → Portfolio (does not undo the loss) |
| Withdrawal tax (fraud) | 10% of Main + Profit + Portfolio, rounded |
| VIP thresholds | Total deposited ≥ ₹1,000 → VIP 1; ≥ ₹5,000 → VIP 2; ≥ ₹10,000 → VIP 3 |
| Total deposited | Sum of every amount put in: round stakes, deals, pool, post-withdrawal deposit, Gold Plan, top-up (round and deal stakes count even though they return) |
| Final balance | Main + Profit + Portfolio + Cashed out − tax paid + spin result. Money frozen by the fraud tax block still counts |

#### Timings (both skins)

Round chart 3 s · spin animation 1.1 s · chat typing 1.1 s per message · offer countdowns 120 s (reset) · crash
countdown 600 s (fraud text) · freeze countdown 1,800 s (fraud) · toasts every 4–7 s, visible 3.2 s (fraud) ·
bonus-question timer ring 20 s (fraud, visual only) · VIP level-up banner 4 s (fraud) · chat-deposit window 60 s.

### B6. Stage by stage: what, why, data, hypothesis

#### S0 Consent
- **What:** study information without fraud framing ("a study of how people use investment apps"), 18+ and agree
  checkboxes. Declining shows a polite end screen and creates **no** record.
- **Why:** ethics; the fraud framing would bias behaviour.
- **Data:** participant row created at "Agree and start" with all randomized factors.

#### S1 Trader profile (8 screens, one tap each)
- **What:** age band, gender, field of study, family income band, investing experience, trading/crypto-app use,
  prior personal-finance course, "How good are you with money?" 1–7. Fraud adds an avatar picker and "Profile 100%
  complete!".
- **Why:** controls (H1, H4, H8), group variables (H9), H8 IV (prior financial education), self-rated literacy for
  overconfidence (H8). Asked before the game so the game cannot shift the self-rating.
- **Data:** `demo_age`, `demo_gender`, `demo_field`, `demo_income`, `exp_investing`, `exp_trading_app`, `exp_fin_edu`,
  `lit_self`.

#### S3 Home dashboard (the hook)
- **What:** wallets, three plans with "Details", a chart, ₹500 bonus; choose a plan and invest, or skip. Fraud adds the
  VIP ladder pop-up (first visit), locked bonus, countdown + "only 3 slots left", VIP ladder card, ticker, toasts,
  testimonials, badge, rating, tiny T&C.
- **Why:** the first commitment decision under dark design (H1, H1a–H1e).
- **Data:** `decision_time_first_invest` (from when the dashboard becomes usable — fraud: when the VIP pop-up is
  closed — to the first Invest/Skip tap), `s3_choice`, `plan`, verification taps (→ `verify_any`, `verify_count`),
  `vip_popup_time`. Raw: `plan_select`, `toast_shown`, `timer_reset`.
- **Note:** the S3 "invest" choice moves no money; money moves from round 1 on.

#### S2 Bonus spins (2 pop-ups)
- **What:** "50% lose ₹100 / 50% win ₹X", accept or skip, X = ₹150 (before round 1) and ₹250 (before round 3), or the
  other way round (`spin_order`). Results are hidden until the report card.
- **Why:** a behavioural loss-aversion measure (H4 IV; also an H9 bias score). Hiding results stops them from
  affecting later play.
- **Data:** `la_gain_150`, `la_gain_250` (`accept`/`reject`) → `loss_aversion_group`, `la_consistent`, `la_accepted`;
  `spin_net` (outcome, descriptive).

#### S4 Trading rounds 1–4
- **What:** choose an amount (quick chips or typed, capped at Main), Invest or Skip, 3-second chart, result card.
  Skipping plays the same chart (equal time). Fraud adds the VIP bar, an "Upgrade" shortcut before investing, a nudge
  after each round (tap pre-fills the next round's amount with what is needed for the next level), a level-up banner,
  confetti, an "unlock your bonus" nudge in round 1.
- **Why:** round 1 is the randomized small win vs flat (H2: does an early win increase the next stake?). Rounds as a
  whole give investment amounts for H1 and the VIP push for H1c. Round 1 investing is also the "hook" trap.
- **Data:** `r1_amount`–`r4_amount`, `escalation_ratio`, `vip_taps`, `vip_nudge_taps`, `vip_level_ups`, `vip_level`,
  `vip_upgrade`; raw per-round decision times in `round_invest`/`round_skip` events.

#### S5 Bonus questions (4 pop-ups, ₹100 per correct answer)
- **What:** Q1 (after round 1) bat-and-ball CRT: "A bat and a ball cost ₹110 in total. The bat costs ₹100 more than the
  ball. How much does the ball cost?" (correct ₹5). Q2–Q3 (after round 3) and Q4 (after round 4): Big Three
  literacy — compound interest (correct `more`), inflation (`less`), diversification (`false`).
- **Why:** CRT = H1 moderator (reflective vs intuitive thinking); literacy = H8 IV and the "actual" side of
  overconfidence. The ₹100 reward makes answers incentive-compatible.
- **Data:** `crt_1`, `lit_interest`, `lit_inflation`, `lit_diversification` → `crt_correct`, `literacy_score`,
  `brain_correct`, `overconfidence`; time per answer in `brain_answer` events (`ms`).

#### S6 Mentor chat (fraud only, right before round 4)
- **What:** "Rohit Sir, Senior Advisor" types: "Most members upgrade to VIP 2 today", "Only 2 VIP seats left…",
  "Invest in the next round…". Open the chat or tap "Later".
- **Why:** H1f — does a fake mentor push deposits? Measured as any deposit within 60 s of the chat appearing (in
  practice the round-4 stake).
- **Data:** `chat_open`, `chat_deposit` (fraud only; blank for honest). Cross-skin proxy: `r4_amount`.

#### S7 Flash deals (one screen, three cards)
- **What:** ₹500, ₹3,000, ₹8,000 cards in random order (`deal_order`), each with "View details" and "Invest"; Continue
  when done (deals not taken count as skipped).
- **Why:** H3 — people verify less and invest more readily when stakes are small (within-subject).
- **Data:** per size: `deal_invest_*`, `deal_details_*` (details opened **before** investing / before Continue),
  `deal_time_*` (seconds from opening the screen to that deal's Invest tap; not taken → to Continue).

#### S8 Diamond Pool invite
- **What:** the same ₹2,000 pool offered either as a WhatsApp-style message from "Rahul (college friend)" or as a
  "Sponsored" ad (`pool_source`, independent of skin). "Pool details" reveal it pays from new members (Ponzi).
- **Why:** H5 — a friend's referral lowers checking and raises joining.
- **Data:** `pool_join`, `pool_details`, `pool_time`; moderator `fomo_score`.

#### S9 Test withdrawal
- **What:** `allowed`: withdraw ₹500 ("Money sent!") or decline; `not_offered`: "Withdrawals open at VIP n". Then an
  offer to deposit up to ₹5,000 into the portfolio.
- **Why:** H6 — a successful small withdrawal builds trust and leads to larger deposits (as real scam apps do).
- **Data:** `withdrew` (blank if not offered), `post_withdrawal_deposit`; trust from `app_trust` (S13).

#### S10 Gold Plan offer
- **What:** "Reinvest ₹2,000 from your profits" (`profit`) or "Add ₹2,000 from your main wallet" (`main`); slider ₹0–2,000
  starting at ₹0. Both framings are always fully affordable.
- **Why:** H7 — house-money effect (profits are reinvested more freely than own money).
- **Data:** `reinvest_accept`, `reinvest_amount`.

#### S11 Market crash
- **What:** scripted −40% on Main and Portfolio. Option to "Top up to activate Loss Shield" (any amount) or "Leave it".
- **Why:** H4 — loss aversion predicts chasing losses.
- **Data:** `crash_loss`, `crash_topup`, `crash_topup_amount`, `crash_time`.

#### S12 Cash out
- **What:** withdraw everything. Honest: processed instantly. Fraud: blocked by a 10% "processing tax", freeze
  countdown, support message; Pay tax / Don't pay (paying does not release the money).
- **Why:** H1g — willingness to pay to unlock a withdrawal.
- **Data:** `tax_shown`, `tax_paid` (fraud only).

#### S13 Quick reactions
- **What:** fraud: 7 swipe cards "Did this push you to invest?" (timer, locked bonus, VIP ladder, NDIA badge, social
  proof, mentor, tax), each showing a mini re-render of the feature. Both: trust slider and urgency slider (1–7, must
  be touched), then 3 FOMO statements (agree/disagree). Swipe or tap; the method is logged.
- **Why:** H1h / H1a–H1g self-report (fraud only); H1 and H6 trust and urgency ratings; H5 moderator and H9 bias score
  (FOMO).
- **Data:** `feature_push_*`, `feature_push_count`, `app_trust`, `app_urgency`, `fomo_1`–`3`, `fomo_score`.

#### S14 Scam Report Card (debrief) and S15 Share
- **What:** reveal ("ZenTrade X was a simulated scam app" / "You played the honest version"), trap score, traps
  fallen for and avoided, spin results, final balance breakdown, how each manipulation worked, safety tips
  (official regulator register, never pay to withdraw, cybercrime.gov.in / 1930). Then a share button (link without
  personal data).
- **Why:** ethical debrief; reaching it marks completion (`completed_at`).
- **Data:** `report_shown` event (trap score, spin net, final balance), `share_tap`.

### B7. Data files

Downloaded from `/admin` (password-protected). CSVs are UTF-8 with a BOM (for Excel). Cells that would start with
`=`, `+`, `-` or `@` and are not numbers are prefixed with `'` (spreadsheet-formula protection); negative numbers are
not affected.

| File | Rows | Use |
| --- | --- | --- |
| `wide.csv` | One per participant who reached the report card | **Analysis file**: assignments, behaviour, traps, answers, derived scores (section B9) |
| `participants.csv` | One per consented participant (including drop-outs) | Assignment checks, drop-out analysis. Columns: `participant_id`, `created_at`, `consented`, `app_version`, `round1_outcome`, `withdrawal_offer`, `referral_source`, `money_source`, `stake_order` (legacy, empty), `current_step` (last step reached), `completed_at`, `withdrawn`, `is_pilot`, `deal_order`, `spin_order` (comma-separated) |
| `events.csv` | One per logged event | Raw behaviour log (section B8): `id`, `participant_id`, `ts` (server time, ms since epoch), `client_ts` (ms since page load; resets on refresh), `screen` (step id), `event_type`, `payload` (JSON) |
| `responses.csv` | One per participant × item | Raw answers: `participant_id`, `item_id`, `value`, `answered_at` (ISO). A re-answer keeps the latest value |

All four files leave out participants flagged `withdrawn = 1` (the app no longer offers withdrawal; the flag only
affects older rows). Pilot participants **are included** with `is_pilot = 1`.

### B8. Event log reference (`events.csv`)

Every event has `screen` = the step id on which it happened. Money events also carry `since_chat_ms` (ms since the
mentor chat appeared, or null), `total_deposited` and `vip_level` after the deposit.

| `event_type` | When | Payload |
| --- | --- | --- |
| `screen_view` | Every screen mount | — |
| `answer` | Profile and reaction answers | `id`, `ms` |
| `avatar_pick` | Fraud profile avatar | `avatar` |
| `vip_popup_shown` / `vip_popup_close` | Fraud home VIP pop-up | close: `ms` open |
| `verify_open` | T&C, plan/deal/pool details, badge, About | `what` (`tnc`, `plan_details`, `badge`, `about`, `deal_details`, `pool_details`), `size` |
| `plan_select` | Plan tapped on S3 | `plan_id` |
| `s3_invest` / `s3_skip` | S3 decision | `plan_id`, `decision_ms` |
| `toast_shown` | Fraud winner toast | `i` |
| `timer_reset` | A countdown reached zero and restarted | — |
| `spin_accept` / `spin_skip` | Bonus spin | `gain`, `outcome` (`win`/`lose`, accept only), `ms` |
| `round_invest` | Round stake | `round`, `amount`, `rate`, `gain`, `all_in`, `plan_id`, `decision_ms`, + money fields |
| `round_skip` | Round skipped | `round`, `rate`, `decision_ms` |
| `vip_upgrade_tap` | Fraud in-round "Upgrade" shortcut | `total_deposited` |
| `vip_nudge_tap` | Fraud after-round nudge | `round`, `amount`, `total_deposited` |
| `vip_level_up` | Fraud: a deposit crossed a VIP threshold (one event per deposit, highest new level) | `level`, `total_deposited` |
| `streak_reward` | After round 4 | `amount` |
| `brain_answer` | Bonus question | `id`, `correct`, `reward`, `ms` |
| `chat_shown` / `chat_open` | Fraud mentor chat | `kind` |
| `deal_invest` / `deal_skip` | Flash deal | `size`, `amount`/`gain` (invest), `details_before`, `decision_ms`, + money fields |
| `pool_join` / `pool_skip` | Pool | `source`, `amount` (join), `details_before`, `decision_ms`, + money fields |
| `test_withdraw` / `test_withdraw_skip` / `test_withdraw_unavailable` | S9 | `amount` (withdraw) |
| `post_withdrawal_deposit` | S9 deposit | `amount`, `offer`, + money fields |
| `reinvest` | S10 | `amount`, `from` (`profit`/`main`), `accepted`, + money fields |
| `crash` | S11 | `loss` |
| `crash_topup` / `crash_leave` | S11 decision | `amount`, `decision_ms`, + money fields |
| `cashout` | Honest withdrawal | `amount` |
| `tax_shown` / `tax_pay` / `tax_decline` | Fraud tax block | `tax`, `amount` (shown) |
| `reaction_method` | S13 card answered | `id`, `method` (`swipe`/`tap`) |
| `report_shown` | S14 | `trap_score`, `trap_possible`, `traps`, `spin_net`, `final_balance` (+ prize fields if enabled) |
| `share_tap` | S15 | `method` (`native`/`copy`) |

A refresh never repeats a scripted action (the game ignores repeated money actions), so each money event appears at
most once per participant.

### B9. Analysis file reference (`wide.csv`, 102 columns)

Coding: yes/no = `1`/`0`; blank = not applicable or not answered; amounts in ₹; times in seconds (3 decimals).
"Fraud only" columns are blank for honest players by design.

#### 9.1 Identifiers and assignments (11)

| Column | Type | Values |
| --- | --- | --- |
| `participant_id` | string | UUID |
| `is_pilot` | 0/1 | exclude 1 |
| `created_at`, `completed_at` | ISO datetime (UTC) | consent time; report-card time |
| `skin` | categorical | `honest`, `fraud` |
| `round1_outcome` | categorical | `small_win`, `flat` |
| `pool_source` | categorical | `friend`, `ad` |
| `withdrawal_offer` | categorical | `allowed`, `not_offered` |
| `reinvest_framing` | categorical | `profit`, `main` |
| `deal_order` | string | e.g. `8000;500;3000` (top to bottom) |
| `spin_order` | string | `150;250` or `250;150` (first = before round 1) |

#### 9.2 Behaviour (44)

| Column | Type | Definition | Blank when | Hyp. |
| --- | --- | --- | --- | --- |
| `decision_time_first_invest` | s | S3 usable → first Invest/Skip | never (completers) | H1, H1a, H1e |
| `s3_choice` | `invest`/`skip` | S3 decision | — | H1, H1b |
| `plan` | `starter`/`growth`/`turbo` | plan chosen | `s3_choice = skip` | H1 |
| `verify_any` | 0/1 | opened any T&C/details/badge/About | — | H1, H1d |
| `verify_count` | count | number of such opens | — | H1, H1d |
| `total_deposited` | ₹ | sum of all amounts invested | — | H1 |
| `vip_upgrade` | 0/1 | total deposited ≥ ₹5,000 (both skins) | — | H1c |
| `vip_level` | 0–3 | VIP level by total deposited (both skins) | — | H1c |
| `vip_taps` | count | in-round "Upgrade" taps (honest always 0) | — | H1c |
| `vip_popup_time` | s | VIP pop-up open time | honest | H1c |
| `vip_nudge_taps` | count | after-round nudge taps | honest | H1c |
| `vip_level_ups` | count | level-up events | honest | H1c |
| `r1_amount`–`r4_amount` | ₹ | round stake (0 = skipped) | — | H1, H2 |
| `escalation_ratio` | ratio | `r2_amount / r1_amount` (4 decimals) | `r1_amount = 0` | H2 |
| `chat_open` | 0/1 | opened the mentor chat | honest | H1f |
| `chat_deposit` | 0/1 | any deposit within 60 s of the chat | honest | H1f |
| `deal_invest_{500,3000,8000}` | 0/1 | invested in that deal | — | H3 |
| `deal_details_{500,3000,8000}` | 0/1 | opened its details before deciding | — | H3 |
| `deal_time_{500,3000,8000}` | s | screen open → Invest (or Continue) | — | H3 |
| `pool_join` | 0/1 | joined | — | H5 |
| `pool_details` | 0/1 | opened details before deciding | — | H5 |
| `pool_time` | s | screen open → decision | — | H5 |
| `withdrew` | 0/1 | took the ₹500 test withdrawal | `not_offered` | H6 |
| `post_withdrawal_deposit` | ₹0–5,000 | S9 deposit | — | H6 |
| `reinvest_accept` | 0/1 | Gold Plan amount > 0 | — | H7 |
| `reinvest_amount` | ₹0–2,000 | Gold Plan amount | — | H7 |
| `crash_loss` | ₹ | scripted crash loss | — | H4 |
| `crash_topup` | 0/1 | topped up | — | H4 |
| `crash_topup_amount` | ₹ | top-up (0 = none) | — | H4 |
| `crash_time` | s | crash screen → decision | — | H4 |
| `tax_shown` | 0/1 | saw the tax block (honest always 0) | — | H1g |
| `tax_paid` | 0/1 | paid the tax | honest | H1g |
| `brain_correct` | 0–4 | correct bonus answers | — | H1, H8 |
| `spin_net` | ₹ | net spin result | — | descriptive |
| `final_balance` | ₹ | report-card final balance | — | descriptive |

#### 9.3 Traps (12)

`trap_score`, `trap_possible`, and one 0/1 flag per trap: `trap_hook`, `trap_vip`, `trap_chat` (honest blank),
`trap_deal_no_details`, `trap_pool_no_details`, `trap_crash_topup`, `trap_tax_paid` (honest blank), `trap_no_verify`,
`trap_trust_after_withdrawal`, `trap_reinvest`. Definitions in section B11.

#### 9.4 Response items (26)

| Column | Values |
| --- | --- |
| `demo_age` | `18_20`, `21_23`, `24_26`, `27_35`, `36_plus` |
| `demo_gender` | `female`, `male`, `other`, `prefer_not` |
| `demo_field` | `engineering`, `science`, `commerce_econ`, `humanities_social`, `medicine`, `other`, `not_student` |
| `demo_income` | `lt_3l`, `3l_6l`, `6l_12l`, `12l_25l`, `gt_25l`, `prefer_not` |
| `exp_investing` | `none`, `some`, `regular` |
| `exp_trading_app` | `yes`, `no` |
| `exp_fin_edu` | `yes`, `no` |
| `lit_self` | 1–7 |
| `la_gain_150`, `la_gain_250` | `accept`, `reject` |
| `crt_1` | number as typed (correct = 5) |
| `lit_interest` | `more` (correct), `exactly`, `less`, `dont_know` |
| `lit_inflation` | `more`, `same`, `less` (correct), `dont_know` |
| `lit_diversification` | `true`, `false` (correct), `dont_know` |
| `feature_push_timer`, `_bonus`, `_vip`, `_regulator`, `_social`, `_chat`, `_tax` | `yes`, `no` (honest blank) |
| `app_trust`, `app_urgency` | 1–7 |
| `fomo_1`, `fomo_2`, `fomo_3` | `agree`, `disagree` |

#### 9.5 Derived scores (9)

`crt_correct`, `loss_aversion_group`, `la_consistent`, `la_accepted`, `literacy_score`, `self_rated_literacy`,
`overconfidence`, `feature_push_count` (honest blank), `fomo_score`. Formulas in section B10.

### B10. Derived scores: exact formulas

| Score | Formula | Blank when |
| --- | --- | --- |
| `crt_correct` | 1 if `crt_1` = 5 (numeric), else 0 | unanswered |
| `loss_aversion_group` | 1 = accepted ₹150 and ₹250 (low, λ ≤ 1.5); 2 = rejected ₹150, accepted ₹250 (typical, 1.5 < λ ≤ 2.5); 3 = rejected both (high, λ > 2.5). Basis: with linear utility a 50/50 bet (−100, +X) is accepted when X ≥ λ·100 | inconsistent (accepted ₹150, rejected ₹250 → `la_consistent = 0`) or a spin missing |
| `la_consistent` | 1 unless accepted ₹150 and rejected ₹250 | spin missing |
| `la_accepted` | number of spins accepted (0–2) | spin missing |
| `literacy_score` | correct among `lit_interest`=`more`, `lit_inflation`=`less`, `lit_diversification`=`false`; `dont_know` = wrong | any of the three missing |
| `self_rated_literacy` | = `lit_self` | missing |
| `overconfidence` | z(`self_rated_literacy`) − z(`literacy_score`), z = (x − mean) / sample SD over **all rows in the downloaded file** (rounded to 4 decimals) | either value missing, or an SD = 0 |
| `feature_push_count` | number of `feature_push_*` = `yes` (0–7) | honest, or any missing |
| `fomo_score` | number of `fomo_*` = `agree` (0–3) | any missing |
| `escalation_ratio` | `r2_amount / r1_amount` | `r1_amount = 0` |
| `brain_correct` | number of correct bonus answers (0–4) | — |
| `vip_level` | 0 if total < 1,000; 1 if < 5,000; 2 if < 10,000; else 3 | — |
| `final_balance` | Main + Profit + Portfolio + Cashed out − tax paid + `spin_net` | — |

**Recompute `overconfidence` after filtering** (it is standardized over whatever rows the file contained, pilots
included):

```python
z = lambda s: (s - s.mean()) / s.std(ddof=1)
df["overconfidence"] = z(df["self_rated_literacy"]) - z(df["literacy_score"])
```

### B11. Traps and the trap score

Computed by one shared function for the report card and the export (`client/src/game/traps.ts`); the export
recomputes it from the raw events (the value the browser logged in `report_shown` is not used).

| Trap flag | Fallen for when | Skins |
| --- | --- | --- |
| `trap_hook` | Round-1 stake > 0 (fraud: this also unlocks the bonus) | both |
| `trap_vip` | Total deposited ≥ ₹5,000 (VIP 2) | both |
| `trap_chat` | Any deposit with 0 ≤ `since_chat_ms` ≤ 60,000 (usually the round-4 stake; a very fast flash-deal investment can also fall in the window) | **fraud only** |
| `trap_deal_no_details` | Invested in at least one flash deal without opening its details first | both |
| `trap_pool_no_details` | Joined the pool without opening its details first | both |
| `trap_crash_topup` | Top-up after the crash > 0 | both |
| `trap_tax_paid` | Paid the withdrawal tax | **fraud only** |
| `trap_no_verify` | Never opened any T&C / plan details / deal or pool details / badge / About | both |
| `trap_trust_after_withdrawal` | Post-withdrawal deposit > 0 | both |
| `trap_reinvest` | Gold Plan amount > 0 | both |

- `trap_score` = number of applicable traps fallen for; `trap_possible` = 10 (fraud) or 8 (honest).
- **Cross-skin comparisons use the shared 8 traps only** (as stated under H1 in `hypothesis-report.md`):

```python
SHARED = ["trap_hook", "trap_vip", "trap_deal_no_details", "trap_pool_no_details",
          "trap_crash_topup", "trap_no_verify", "trap_trust_after_withdrawal", "trap_reinvest"]
df["trap_score_shared8"] = df[SHARED].sum(axis=1)   # equals trap_score for honest players
```

- The data dictionary's text for `trap_chat` uses the honest wording ("help card"); the trap is the fraud mentor chat.

### B12. Hypothesis → variables → test

Tests are those in `hypothesis-report.md`. Always filter `is_pilot == 0`.

| Hyp. | IV(s) | DV(s) / moderators / controls (`wide.csv`) | Test | Notes |
| --- | --- | --- | --- | --- |
| **H1** Dark design overrides judgment | `skin` | `decision_time_first_invest`; invested: `s3_choice`, `r1_amount > 0`; amount: `total_deposited` (and `r1_amount`); `verify_any`; `app_urgency`, `app_trust`. Moderator `crt_correct`. Controls `demo_age`, `demo_gender`, `exp_investing`, `exp_trading_app` | Mann-Whitney U (time, amount); chi-square (invested, verified); regression with `skin × crt_correct` | Decision time excludes the fraud VIP pop-up (`vip_popup_time` separate). Log-transform times for regression |
| **H1a** Countdown/scarcity | (fraud feature) | `feature_push_timer` share; behaviour `decision_time_first_invest`, `s3_choice` vs honest | Share of "yes" (fraud only) + skin comparison of linked behaviour | Feature cards are fraud only |
| **H1b** Locked bonus | (fraud) | `feature_push_bonus`; `trap_hook` / `r1_amount > 0` by skin | as above | |
| **H1c** VIP ladder | (fraud) | `feature_push_vip`; `vip_upgrade`, `vip_level`, `total_deposited` by skin; within fraud `vip_nudge_taps`, `vip_taps`, `vip_level_ups` | as above | VIP returns never paid ("next cycle") |
| **H1d** Fake credentials | (fraud) | `feature_push_regulator`; `verify_any`, `verify_count`, `app_trust` by skin | as above | |
| **H1e** Social proof | (fraud) | `feature_push_social`; `decision_time_first_invest`, `s3_choice` by skin | as above | |
| **H1f** Mentor chat | (fraud) | `feature_push_chat`; `chat_open`, `chat_deposit` (fraud); cross-skin proxy `r4_amount` | within-fraud rate; MWU on `r4_amount` by skin | Honest has no chat screen |
| **H1g** Withdrawal tax | (fraud) | `feature_push_tax`; `tax_paid` | rate of paying (fraud only) | Honest has no tax |
| **H1h** UX map | — | all `feature_push_*`, `feature_push_count` | share "yes" per feature (fraud) | |
| **H2** Early small win | `round1_outcome` | `r2_amount`, `escalation_ratio` | Mann-Whitney U on `escalation_ratio` | Ratio defined only if `r1_amount > 0`; also report `r2_amount` for all |
| **H3** Small stakes, less checking | deal size (within) | `deal_invest_*`, `deal_details_*`, `deal_time_*` | Friedman (times); Cochran's Q (details; also invest) | Reshape to long (participant × size); control `deal_order` (card position) |
| **H4** Loss aversion → loss chasing | `loss_aversion_group` (1/2/3, ordinal) | `crash_topup` (logistic), `crash_topup_amount` (OLS); controls `skin`, `exp_investing`; order control `spin_order` | Logistic regression; OLS | Drop blank group (inconsistent); `crash_loss` as a covariate is optional (depends on prior locking) |
| **H5** Friend referral | `pool_source` | `pool_join`, `pool_details`, `pool_time`; moderator `fomo_score` | Mann-Whitney U (time); chi-square (join, details) | |
| **H6** Small withdrawal builds trust | `withdrawal_offer` | `post_withdrawal_deposit`, `app_trust` | Mann-Whitney U | `withdrew` shows take-up within `allowed` (intention-to-treat on the offer) |
| **H7** House money | `reinvest_framing` | `reinvest_accept`, `reinvest_amount` | Mann-Whitney U (amount); chi-square (accept) | Both framings always affordable |
| **H8** Literacy vs overconfidence | `literacy_score`, `overconfidence`, `exp_fin_edu` | `trap_score_shared8` (or `trap_score` with `skin` and `trap_possible`); controls `demo_age`, `demo_gender`, `demo_income`, `exp_investing` | OLS on the trap score; victimization (logistic) uses the online dataset, not the app | Recompute `overconfidence` after filtering |
| **H9** Dominant bias by group | bias scores × group | `loss_aversion_group`, `fomo_score`, `overconfidence`, `crt_correct` × `demo_gender` (also `demo_age`, `demo_income`) → `trap_score_shared8` | Regression with interaction terms | The app sample is mostly 18–24 students, so age and income groups come from the existing dataset (Part D); the app can test gender |

### B13. Pipeline recipe (cleaning and preparation)

```python
import pandas as pd, numpy as np

df = pd.read_csv("wide.csv", encoding="utf-8-sig")   # BOM-safe
df = df[df["is_pilot"] == 0].copy()                    # 1. drop pilots

# 2. Types: 0/1 → int (nullable), seconds/₹ → float; categoricals as category
yes_no = [c for c in df.columns if c.startswith(("trap_", "deal_invest_", "deal_details_"))
          and c not in ("trap_score", "trap_possible")] + [
    "verify_any", "vip_upgrade", "chat_open", "chat_deposit", "pool_join", "pool_details",
    "withdrew", "reinvest_accept", "crash_topup", "tax_shown", "tax_paid"]
df[yes_no] = df[yes_no].astype("Int64")
df["fraud"] = (df["skin"] == "fraud").astype(int)

# 3. Recompute sample-dependent and shared scores
z = lambda s: (s - s.mean()) / s.std(ddof=1)
df["overconfidence"] = z(df["self_rated_literacy"]) - z(df["literacy_score"])
SHARED = ["trap_hook", "trap_vip", "trap_deal_no_details", "trap_pool_no_details",
          "trap_crash_topup", "trap_no_verify", "trap_trust_after_withdrawal", "trap_reinvest"]
df["trap_score_shared8"] = df[SHARED].sum(axis=1)

# 4. Useful transforms
df["invested_r1"] = (df["r1_amount"] > 0).astype(int)
df["log_decision_time"] = np.log1p(df["decision_time_first_invest"])
df["la_group"] = pd.Categorical(df["loss_aversion_group"].astype("Int64"), categories=[1, 2, 3], ordered=True)

# 5. H3 long format (participant × deal size), with card position from deal_order
rows = []
for _, r in df.iterrows():
    order = [int(x) for x in str(r["deal_order"]).split(";")]
    for size in (500, 3000, 8000):
        rows.append({"participant_id": r["participant_id"], "size": size,
                     "position": order.index(size) + 1,
                     "invest": r[f"deal_invest_{size}"], "details": r[f"deal_details_{size}"],
                     "time": r[f"deal_time_{size}"]})
deals_long = pd.DataFrame(rows)
```

Checks before analysis:
- Factor balance: counts per level of `skin`, `round1_outcome`, `pool_source`, `withdrawal_offer`,
  `reinvest_framing` (also shown on `/admin`).
- Completion and drop-out by skin: compare `participants.csv` (all consented, `completed_at` blank = dropped) with
  `wide.csv`; `current_step` shows where drop-outs stopped. Differential drop-out between skins should be reported.
- Time outliers: decision times can be long if a participant left the tab; use medians / rank tests, or trim
  (e.g. > 3 × IQR) and report the rule.
- Inconsistent spin choices (`la_consistent = 0`): report how many; they are blank in H4.

### B14. Caveats and design decisions that affect analysis

1. **Scripted market.** Round, deal and crash results are pre-set and identical for everyone (except round 1 by
   condition). Outcome variance comes only from choices, so money DVs are pure behaviour.
2. **Honest skin is shorter** (32 vs 40 screens, ~1 minute less) because it skips the chat, the 7 feature cards and the
   extra cash-out screen. REDESIGN_PLAN asked for equal length; mention this as a limitation (fatigue/time differences
   are possible confounds for late-game DVs, though the skipped screens move no money).
3. **Feature cards are fraud only**, so H1a–H1g self-reports are within-fraud shares, not plain-vs-fraud comparisons.
4. **H1f** has no honest counterpart; use `chat_deposit` within fraud, and `r4_amount` across skins.
5. **Trap score:** fraud max 10, honest max 8 — compare skins with `trap_score_shared8` only.
6. **Decision time on S3** starts when the dashboard is usable; for the fraud skin that is after the VIP pop-up closes
   (pop-up duration in `vip_popup_time`).
7. **Total deposited** counts round and deal stakes even though they return to Main; it measures willingness to put
   money in, not money lost.
8. **Spin outcomes** are random but invisible during play; `spin_net` is descriptive and part of `final_balance`.
9. **Final balance** counts money frozen by the fraud tax block (so it reflects choices, not the scam's theft); only
   the tax paid is lost. Relevant only if the optional prize draw (`PRIZE_DRAW`, off) is enabled.
10. **Gold Plan slider starts at ₹0**, so `reinvest_amount` is an active choice.
11. **Overconfidence** in the downloaded file is standardized over all exported rows (pilots included): recompute.
12. **Chat window** counts any deposit within 60 s of the chat appearing, not only the round-4 stake.
13. **Legacy data:** rows from the original survey version (before the game) and older game versions are not in
    `wide.csv` (wrong steps / missing items). Reset the database before real collection to avoid mixing versions.
14. **Order controls** (`deal_order`, `spin_order`) are random shuffles, not balanced; include them as covariates if
    they turn out to matter.
15. **Self-report items** (sliders, FOMO, feature cards) come at the end of the game but before the report card, so
    the reveal cannot influence them.

---

## Part C — The survey form

### C1. Purpose and design

| Item | Value |
| --- | --- |
| Purpose | Real-life evidence: have respondents met the tricks tested in the app, and did the same sequence (early win, test withdrawal, loss chasing, reinvesting profits) happen to them? |
| Design | Descriptive, cross-sectional; no randomization |
| Platform | Google Forms, linked to a Google Sheet |
| Length | 11 questions; about 1 minute for most respondents (Q1–Q2), about 3 minutes if targeted (Q1–Q11) |
| Sample | College volunteers, shared by a separate link from the app |
| Link to the app | None. Survey and app responses cannot be matched per person |
| Anonymity | No name, email, phone, ID or demographics collected; "Limit to 1 response" off |
| Debrief | End page with tips on spotting fake investment apps |

Demographics, literacy, attitude items and scenarios are **not** in the survey on purpose: the app already measures them (Part B, S1, S5, S13), and the age and income groups come from the existing dataset (Part D).

### C2. Questions

**Consent (first page).** This short survey is part of a university research project on investment apps. It takes about 1–3 minutes. Participation is voluntary and anonymous: we do not collect your name, phone number or email. You can choose "Prefer not to say" and stop at any time. Do you agree to take part?
- Yes, I agree and I am 18 or older → continue
- No → end form

**Section A — Everyone**

| # | Question | Type | Options |
| --- | --- | --- | --- |
| Q1 | Have you ever been approached by a suspicious investment or "earning" app, platform or group? This includes trading apps, "task" apps, or WhatsApp, Telegram or Instagram groups offering high returns. | Single choice, required | Yes → Q2, then Section B · No → Q2, then end · Not sure → Q2, then end · Prefer not to say → Q2, then end |
| Q2 | Which of these have you ever seen in any investment app, ad, website or group? Select all that apply. | Checkboxes, required | 1 Countdown timer or "offer ends soon" · 2 "Only X slots left" · 3 Very high or "guaranteed" returns shown in big numbers · 4 Live messages like "Priya just withdrew ₹12,000" or many testimonials · 5 Bonus for referring friends, or "your friend joined" · 6 Sign-up bonus you could only withdraw after depositing · 7 VIP levels or higher returns for bigger deposits · 8 A registration badge, certificate or regulator logo · 9 A mentor, advisor or "customer support" pushing you to invest more · 10 Withdrawal blocked until you paid a fee, tax or deposit · 11 None of these |

**Section B — Only if Q1 = Yes**

| # | Question | Type | Options |
| --- | --- | --- | --- |
| Q3 | When did this last happen? | Single choice | In the past 12 months · 1–3 years ago · More than 3 years ago |
| Q4 | How were you first approached? | Single choice | Social media ad · Messaging group (WhatsApp / Telegram) · Friend or family referral · Influencer or celebrity promotion · Cold call or SMS · Other |
| Q5 | Did you put any money into it? | Single choice, required | Yes → Q6 · No → end page |
| Q6 | Was your first amount small (under ₹1,000)? | Single choice | Yes · No · Don't remember |
| Q7 | Did the app show you profits early on? | Single choice | Yes · No · Don't remember |
| Q8 | Did a small withdrawal work before you invested more? | Single choice | Yes · No · Don't remember |
| Q9 | Did you reinvest the profits shown in the app instead of withdrawing them? | Single choice | Yes · No · Don't remember |
| Q10 | After a loss or a blocked withdrawal, did you put in more money to recover it or unlock it? | Single choice | Yes · No · Don't remember |
| Q11 | Roughly how much did you lose in total? (optional) | Single choice | Nothing, I got it all back · Under ₹1,000 · ₹1,000–10,000 · ₹10,001–1,00,000 · Above ₹1,00,000 · Prefer not to say |

**End page (everyone).** Thank you! How to spot fake investment apps:
- Check that the company is on the regulator's official list of registered entities (SEBI for securities) before investing.
- Never pay a "tax", "fee" or extra deposit to withdraw your own money.
- Guaranteed high returns, countdown timers and "only few slots left" are pressure tactics.
- Early profits and a small successful withdrawal are common tricks to win your trust.
- Report fraud at cybercrime.gov.in or call 1930.

### C3. Variables and coding

Rename the Google Sheet columns to these names before analysis. Coding: yes/no = `1`/`0`; "Don't remember", "Not sure" and "Prefer not to say" = blank (missing); questions not shown because of branching = blank.

| Variable | Question | Coding | Hyp. |
| --- | --- | --- | --- |
| `sv_timestamp` | — | Google Forms timestamp | — |
| `sv_approached` | Q1 | Yes = 1, No = 0, Not sure / Prefer not to say = blank | Prevalence |
| `sv_seen_timer` | Q2 option 1 | 1 if ticked, else 0 | H1a |
| `sv_seen_slots` | Q2 option 2 | 1 / 0 | H1a |
| `sv_seen_high_returns` | Q2 option 3 | 1 / 0 | H1 |
| `sv_seen_social` | Q2 option 4 | 1 / 0 | H1e |
| `sv_seen_referral` | Q2 option 5 | 1 / 0 | H5 |
| `sv_seen_locked_bonus` | Q2 option 6 | 1 / 0 | H1b |
| `sv_seen_vip` | Q2 option 7 | 1 / 0 | H1c |
| `sv_seen_badge` | Q2 option 8 | 1 / 0 | H1d |
| `sv_seen_mentor` | Q2 option 9 | 1 / 0 | H1f |
| `sv_seen_withdraw_block` | Q2 option 10 | 1 / 0 | H1g |
| `sv_seen_none` | Q2 option 11 | 1 / 0 | — |
| `sv_seen_count` | Q2 | Number of options 1–10 ticked (0–10) | H1 |
| `sv_recency` | Q3 | 0 = past 12 months, 1 = 1–3 years, 2 = more than 3 years | Descriptive |
| `sv_channel` | Q4 | `social_ad`, `messaging_group`, `friend_family`, `influencer`, `call_sms`, `other` | H5 |
| `sv_channel_friend` | Q4 | 1 = friend or family referral, 0 = any other channel | H5 |
| `sv_invested` | Q5 | Yes = 1, No = 0 | Descriptive |
| `sv_small_first` | Q6 | Yes = 1, No = 0 | H3 |
| `sv_early_profit` | Q7 | Yes = 1, No = 0 | H2 |
| `sv_test_withdrawal` | Q8 | Yes = 1, No = 0 | H6 |
| `sv_reinvest_profit` | Q9 | Yes = 1, No = 0 | H7 |
| `sv_chased_loss` | Q10 | Yes = 1, No = 0 | H4, H1g |
| `sv_loss_band` | Q11 | 0 = nothing, 1 = under ₹1,000, 2 = ₹1,000–10,000, 3 = ₹10,001–1,00,000, 4 = above ₹1,00,000; Prefer not to say = blank | Descriptive |
| `sv_lost_money` | Q5, Q11 | 1 = invested and Q11 is not "Nothing"; 0 = invested and Q11 = "Nothing", or not invested; blank if Q11 blank and invested | Descriptive |

### C4. Hypothesis → variables → analysis

The survey has no randomization, so it gives **descriptive** evidence (percentages with 95% confidence intervals), not causal tests. Its role is to show that the mechanisms tested in the app happen in real life.

| Hyp. | Survey variables | What to report |
| --- | --- | --- |
| Prevalence | `sv_approached`, `sv_recency` | % of all respondents ever approached; % in the past 12 months |
| H1, H1a–H1g | `sv_seen_*`, `sv_seen_count` | % of all respondents who have seen each trick; rank the tricks; compare with the app's `feature_push_*` shares (Part B, H1h) to show which tricks are both common and effective |
| H5 | `sv_channel`, `sv_channel_friend`, `sv_seen_referral` | Share of approached respondents first reached through a friend or family referral |
| H3 | `sv_small_first` | Among those who invested: % whose first amount was under ₹1,000 |
| H2 | `sv_early_profit` | Among those who invested: % who saw early profits |
| H6 | `sv_test_withdrawal` | Among those who invested: % whose small withdrawal worked before investing more |
| H7 | `sv_reinvest_profit` | Among those who invested: % who reinvested shown profits |
| H4, H1g | `sv_chased_loss` | Among those who invested: % who put in more to recover or unlock |
| Descriptive | `sv_invested`, `sv_lost_money`, `sv_loss_band` | % of approached who invested; % who lost money; distribution of losses |

Optional within-survey check: among respondents who invested, does seeing more tricks (`sv_seen_count`) go with losing money (`sv_lost_money`)? Use a logistic regression or a simple comparison, and report it as an association only.

Small-group warning: Section B is answered only by those approached, and Q6–Q11 only by those who invested. If fewer than about 20 respondents invested, report counts ("7 of 12") rather than percentages, and do not run tests on Q6–Q11.

### C5. Pipeline recipe

```python
import pandas as pd, numpy as np

sv = pd.read_csv("survey.csv")          # Google Sheet → File → Download → CSV
# 1. Rename columns: timestamp, consent, Q1–Q11 (adjust to the sheet's header text)
sv.columns = ["sv_timestamp", "consent", "q1", "q2", "q3", "q4", "q5",
              "q6", "q7", "q8", "q9", "q10", "q11"]
sv = sv[sv["consent"].str.startswith("Yes")].copy()      # 2. consented only
# 3. Drop pilot / test rows by timestamp (before the launch time)
sv = sv[pd.to_datetime(sv["sv_timestamp"], dayfirst=True) >= "2026-11-03"]

yn = {"Yes": 1, "No": 0}                 # "Don't remember" etc. → NaN
sv["sv_approached"] = sv["q1"].map(yn)

options = {  # exact option text in the form → variable
    "Countdown timer": "sv_seen_timer", "Only X slots": "sv_seen_slots",
    "Very high or": "sv_seen_high_returns", "Live messages": "sv_seen_social",
    "Bonus for referring": "sv_seen_referral", "Sign-up bonus": "sv_seen_locked_bonus",
    "VIP levels": "sv_seen_vip", "A registration badge": "sv_seen_badge",
    "A mentor": "sv_seen_mentor", "Withdrawal blocked": "sv_seen_withdraw_block",
    "None of these": "sv_seen_none"}
for start, col in options.items():
    sv[col] = sv["q2"].fillna("").str.contains(start, regex=False).astype(int)
sv["sv_seen_count"] = sv[[c for c in options.values() if c != "sv_seen_none"]].sum(axis=1)

sv["sv_recency"] = sv["q3"].map({"In the past 12 months": 0, "1–3 years ago": 1,
                                 "More than 3 years ago": 2})
sv["sv_channel_friend"] = np.where(sv["q4"].isna(), np.nan,
                                   (sv["q4"] == "Friend or family referral").astype(float))
sv["sv_invested"] = sv["q5"].map(yn)
for q, col in [("q6", "sv_small_first"), ("q7", "sv_early_profit"),
               ("q8", "sv_test_withdrawal"), ("q9", "sv_reinvest_profit"),
               ("q10", "sv_chased_loss")]:
    sv[col] = sv[q].map(yn)
sv["sv_loss_band"] = sv["q11"].map({"Nothing, I got it all back": 0, "Under ₹1,000": 1,
                                    "₹1,000–10,000": 2, "₹10,001–1,00,000": 3,
                                    "Above ₹1,00,000": 4})
sv["sv_lost_money"] = np.where(sv["sv_invested"] == 1,
                               np.where(sv["sv_loss_band"].isna(), np.nan,
                                        (sv["sv_loss_band"] > 0).astype(float)),
                               np.where(sv["sv_approached"].notna(), 0, np.nan))

# 4. Share with 95% Wilson confidence interval
from statsmodels.stats.proportion import proportion_confint
def share(s):
    s = s.dropna(); k, n = int(s.sum()), len(s)
    lo, hi = proportion_confint(k, n, method="wilson") if n else (np.nan, np.nan)
    return pd.Series({"n": n, "yes": k, "share": k / n if n else np.nan, "ci_low": lo, "ci_high": hi})
invested = sv[sv["sv_invested"] == 1]
summary = pd.DataFrame({c: share(invested[c]) for c in
    ["sv_small_first", "sv_early_profit", "sv_test_withdrawal", "sv_reinvest_profit", "sv_chased_loss"]}).T
```

Checks before analysis:
- Remove pilot and test responses (by timestamp, or note their row numbers during piloting).
- Check the branching worked: respondents with Q1 ≠ Yes must have Q3–Q11 blank; Q5 = No must have Q6–Q11 blank.
- Respondents ticking "None of these" together with other options: keep the other options and set `sv_seen_none` = 0.
- Duplicate responses cannot be detected without collecting emails; mention this as a limitation.

### C6. Caveats

1. **Descriptive only.** No randomization, so survey results show how common the tricks are, not that they cause behaviour. The causal evidence is in Part B.
2. **Not linked to the app.** Survey respondents and app players overlap only partly and cannot be matched.
3. **Self-report and recall.** Respondents may not remember details (hence "Don't remember") or may not recognise that an app was a scam.
4. **Small subgroups.** Only respondents who were approached and invested answer Q6–Q11.
5. **Sample.** College students, mostly 18–24; results do not generalise to older groups.
6. **Priming.** Q2 lists scam tricks; the end page gives tips so respondents leave with correct information.

---

## Part D — Existing dataset

### D1. Role

The existing dataset covers what neither college sample can: **real fraud victimization across age, income and gender groups**. It is the main source for H8 (literacy and overconfidence vs real victimization) and H9 (which bias matters most for which group).

### D2. Required variables

The dataset must be an individual-level public survey containing:

| Needed | Used for |
| --- | --- |
| Investment fraud victimization (targeted and/or lost money) | H8 DV, H9 DV |
| Financial literacy questions (ideally the Big Three) | H8 IV |
| Self-rated financial knowledge | H8 overconfidence |
| Age, income, gender | H9 groups; H8 controls |
| Risk attitude, investing experience (if available) | Controls; H9 bias proxies |
| Survey weights (if provided) | Population estimates |

### D3. Status

**Open item:** confirm the dataset. The team referred to the NFCS 2024 (US) for the literacy benchmark. Before relying on it, open its codebook and confirm it has an investment-fraud victimization question. If it does not, choose another dataset that meets D2 before building this part of the pipeline. Record here: dataset name, wave, download source, sample size, and the exact variable names for each row of D2.

### D4. Analysis

| Hyp. | Model | Notes |
| --- | --- | --- |
| H8 | Logistic regression: victimization on literacy score and overconfidence (z(self-rating) − z(literacy)), with age, gender, income, investing experience as controls | Use survey weights if provided; compare literacy coefficients with the app's trap-score model (Part B, H8) |
| H9 | Logistic regression with interaction terms: bias proxies (overconfidence, risk attitude) × age group, income group, gender | Report which bias predicts victimization most strongly in each group |

Caveat: if the dataset is from outside India, say so and treat it as a comparison population, not a description of Indian investors.

---

## Part E — Combined evidence per hypothesis

How to present each hypothesis using all sources together. The app gives the causal test; the survey shows the trick is real and common; the dataset gives population-level evidence.

| Hyp. | Causal test (app) | Real-life evidence (survey) | Population evidence (dataset) | Headline form |
| --- | --- | --- | --- | --- |
| H1 | Fraud vs honest skin on time, investing, amounts, verification, trust, urgency | Q2: % who have seen each trick | — | "Dark design changed behaviour by X; Y% of students have seen these tricks" |
| H1a–H1g | Feature-card shares (fraud) + linked behaviour by skin | Q2 per trick | — | UX map: trick × share who felt pushed (app) × share who have seen it (survey) |
| H2 | Round-1 win vs flat → escalation | Q7 | — | "An early win raised the next stake by X; Y% of victims saw early profits" |
| H3 | Flash-deal size → investing and checking | Q6 | — | "Checking fell as stakes fell; Y% of victims started under ₹1,000" |
| H4 | Loss aversion group → crash top-up | Q10 | — | "High loss aversion predicted chasing losses; Y% of victims put in more after a loss" |
| H5 | Friend vs ad → joining and checking | Q4 | — | "A friend's invite raised joining by X; Y% of approaches came through friends or family" |
| H6 | Withdrawal allowed vs not → later deposit, trust | Q8 | — | "A successful small withdrawal raised deposits by X; Y% of victims had one" |
| H7 | Profit vs main framing → reinvestment | Q9 | — | "Profits were reinvested more freely; Y% of victims reinvested shown profits" |
| H8 | Literacy and overconfidence → trap score | — | Literacy and overconfidence → real victimization | "Knowledge did not protect; overconfidence predicted falling for traps (app) and being scammed (dataset)" |
| H9 | Bias × gender → trap score | — | Bias × age, income, gender → victimization | "The dominant bias differs by group" |
