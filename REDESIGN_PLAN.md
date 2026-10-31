# Redesign Plan v2 — Immersive Fraud-App Simulation

The first build works technically but feels like a plain form with three schemes and a long questionnaire. Participants get bored and drop out, and several hypotheses (H3, H5, H7) are only measured through hypothetical survey questions.

This redesign turns the study into a **10-minute game that feels like a real Indian scam trading/betting app**. It traps the player at every stage, and it measures almost every hypothesis through **behaviour inside the game**, not through questions.

Work through the phases **in order**. Each phase ends with a checklist; finish it before moving on.

---

## 0. Rules for Claude Code (read first)

1. Read `hypothesis-report.md`, `PROGRESS.md` and this file in full before writing code. Every stage below names the hypothesis it serves.
2. **Keep the backend.** Reuse consent, server-side balanced randomization, the `events` and `responses` tables, pilot mode, admin page, CSV export and the data-dictionary generator. Extend them; do not rewrite them.
3. **Replace the frontend experience:** the 10 session screens, the UI/UX survey and the general survey are replaced by the game described here. Delete old screens and survey config once the new ones work.
4. **Commit and push after each phase without asking.** Message format `Redesign Phase N: <summary>`. Run `git status` first; never commit `.env`, `*.db`, `node_modules/`, `dist/`. Never force-push, rebase, hard-reset, amend pushed commits or delete branches. If a push fails, keep committing locally and report it.
5. Update `PROGRESS.md` at the end of every phase (status, what was built, `// DECISION:` choices, open items). If `PROGRESS.md` shows a redesign phase in progress, finish it rather than restarting.
6. **Still a research simulation:** no real money, no payment/UPI/card/bank fields, no phone/email/ID collection. Fictional app name **"ZenTrade X"**, fictional regulator **"NDIA"**, fictional people in all toasts, chats and testimonials. No real logos, regulators, brokers or celebrities.
7. **Both versions must be equally fun.** The honest version is a polished, legitimate-looking trading game with the same rounds, same returns, same mini-games and same timing. Only the dark-design layer differs. If the honest version is boring, H1 measures boredom instead of dark design.
8. When something is ambiguous, pick the simplest option, mark it `// DECISION:`, and list it in `PROGRESS.md`.

---

## 1. Look and feel

### Fraud-style skin ("ZenTrade X")

Built to look and feel like real scam trading, betting and colour-prediction apps:

- Dark background, neon green and gold, glowing cards, animated gradients.
- **Huge bold return numbers** (`+312%`, `₹4,82,000 earned today`), animated counters that tick up.
- **One giant pulsing "INVEST NOW" button** at the bottom of every money screen, with haptic vibration (`navigator.vibrate`) on tap.
- **Winner toasts** sliding in every 4–7 seconds: "Priya from Pune just withdrew ₹12,400", "Arjun upgraded to VIP 3".
- **Live ticker** of withdrawals scrolling across the top.
- **Tiny low-contrast grey text** for risk warnings and terms, collapsed behind a small "T&C" link.
- **Countdown timers and "only 3 slots left"** on plans.
- **Fake trust signals:** "NDIA Certified" badge, a certificate image, "10 lakh+ users", 4.9 stars.
- Confetti and coin animations on every win; loss screens are quick and greyed out.
- Optional sound effects (coin, cash register), off by default with a mute toggle.

### Honest skin ("ZenTrade")

Same layout and mechanics, presented the way a regulated app would:

- Clean light theme, normal-size numbers, returns shown as plain percentages with a risk label.
- Normal-size "Invest" and "Skip" buttons of equal weight.
- Risk warning in readable text right above the button.
- No toasts, ticker, countdown, scarcity, badges, testimonials or confetti.
- A help/FAQ link where the fraud skin has the mentor chat.

Put all texts, numbers, timings and toast lists in `client/src/config/game.ts` so the team can tune them without touching components.

---

## 2. Game economy

- Every player starts with **₹10,000 demo cash** in a **Main wallet**.
- Gains go into a separate **Profit wallet** (needed for H7).
- Returns per round are **scripted and identical in both skins** (only the outcome of round 1 is randomized for H2). The live chart animation is just a visual of the scripted result.
- The final screen shows **Final balance = Main + Profit wallets**. Every trap the player falls for lowers it.
- **Optional real incentive** (config flag `PRIZE_DRAW`, default off): players entering the prize draw get more tickets for a higher final balance. This makes choices count, the standard approach in experimental economics. The team switches it on only if the instructor approves; if on, the consent screen states the rules.

---

## 3. The game flow

Total time: about 8–10 minutes. A "Level" progress bar replaces the survey progress bar. Each stage is one or two screens. Order matters: the stages follow a real scam lifecycle (hook → deposit → escalate → trap).

| Stage | What the player experiences | Fraud skin adds | Logged | Hypothesis |
| --- | --- | --- | --- | --- |
| S0 Consent | Existing consent screen (unchanged wording, 18+) | — | consent | — |
| S1 Trader profile | "Set up your trader profile" — 6 taps: age band, gender, field of study, family income band, investing experience, trading/crypto app use, then "How good are you with money? 1–7" | Avatar picker and "Profile 100% complete!" animation | responses | Controls, H8 (self-rated literacy), H9 |
| S2 Daily bonus spins | Six spin offers, each: "50% lose ₹100, 50% win ₹X" (X = 50, 100, 150, 200, 250, 300, random order). Accept or skip each. Results are **not shown until the end** so they don't affect later play. | Spinning wheel, "Lucky spin!" glow | accept/skip per spin | H4 (loss aversion λ) |
| S3 Home dashboard (hook) | Wallet, three plans, chart. Free to explore, then choose to invest. Signup bonus ₹500 shown. | Bonus ₹500 is **locked until first deposit** (H1b); winner toasts, ticker, testimonials, NDIA badge, 4.9★ (H1d, H1e); countdown + "3 slots left" (H1a); VIP ladder card (H1c) | time to first invest (decision time), invest/skip, plan, verify/T&C taps, toast views | H1, H1a, H1b, H1c, H1d, H1e |
| S4 Trading rounds | 6 short rounds (~20 s each): pick amount, tap Invest or Skip, watch the animated chart, see result. Round 1 result = small win (+8%) or flat (0%) by randomization; rounds 2–6 scripted and net positive so everyone has profit by S7. | VIP ladder: depositing ≥ ₹5,000 total "unlocks VIP 2 — up to 3× returns" (promised only, actual returns identical) | amount per round, escalation ratio, VIP upgrade taps | H1c, H2 |
| S5 Brain bonus | Break between rounds 3 and 4: "Earn ₹100 per correct answer" — 3 CRT questions, then the 3 Big Three literacy questions. Correct answers really add ₹100. | Timer ring around each question | answers, time per answer | H1 moderator (CRT), H8 (literacy, overconfidence) |
| S6 Mentor chat | After round 4, a chat appears. | Fraud: "Rohit Sir, Senior Advisor" types messages: "Most members upgrade to VIP 2 today", "Only 2 VIP seats left in my group". Honest: a static help/FAQ card. | chat opened, messages read, deposit within 60 s of chat | H1f |
| S7 Flash deals | Three deals appear one at a time, in random order, at three sizes: **₹500, ₹3,000, ₹8,000**. Each shows "View plan details" and "Invest". | Flashing "FLASH DEAL" banner on each | invest per deal, opened details before investing (yes/no), decision time | H3 |
| S8 Pool invite | An invitation to the "Diamond Pool". Randomized: **friend invite** ("Rahul (college friend): bro I made ₹4k yesterday, join my pool 🔥") or **sponsored ad** for the same pool. | Same in both skins (this factor is separate from skin) | join (yes/no), opened details, decision time | H5 |
| S9 Test withdrawal | Randomized: **allowed** — player withdraws ₹500 with a success animation and "Money sent!" — or **not offered** — "Withdrawals open at VIP 2". Then a deposit offer. | Celebration animation on success | withdrew, next deposit amount | H6 |
| S10 Reinvest offer | Gold Plan offer for ₹2,000. Randomized framing: **"Reinvest ₹2,000 from your profits"** (taken from Profit wallet) or **"Add ₹2,000 from your main wallet"**. | — | accept (yes/no), amount (slider ₹0–2,000) | H7 |
| S11 Market crash | Balance drops 40% with a red flash: "Market correction." Options: "Top up to activate Loss Shield and recover" (choose amount) or "Leave it". | Fraud: "Recover in 10 minutes or losses become permanent" countdown | top-up (yes/no), amount, decision time | H4 |
| S12 Withdraw everything | Player tries to cash out. Honest: withdrawal processes. Fraud: **blocked** — "Pay 10% processing tax (₹X) to unlock your balance" with "Pay tax" and "Don't pay". | Account-freeze warning, support chat pushing payment | paid (yes/no) | H1g |
| S13 Quick reactions | About 60 seconds. Seven swipe cards, one per feature the player saw (in their own skin): "Did this push you to invest?" Yes / No, plus one trust slider and one urgency slider for the whole app. Then 3 quick FOMO statements (agree/disagree). | — | responses | H1h, H5 moderator, H9 |
| S14 Scam Report Card | **Reveal and debrief:** "This was a simulated scam app." Shows which traps the player fell for (e.g. "You paid the withdrawal tax", "You chased your loss"), a trap score out of 10, spin results, final balance, and how to spot real scams (check the real regulator's registered list, never pay to withdraw, report to cybercrime.gov.in / 1930). Withdraw-my-data button (existing). | — | viewed, data withdrawal | Debrief |
| S15 Share | "Think your friends would do better? Share the challenge" — a share button with a link (no personal data). | — | share tapped | Recruitment |

### Rules for every stage

- Every money screen has a clear way to continue **without investing**; skipping is a valid, logged choice.
- Timers never block progress. When a countdown ends it resets ("New slots opening").
- Toasts and chat bubbles must never cover buttons or amount fields (this was a real bug in v1).
- Amounts are always capped by the current wallet balance; show "Add funds from Main wallet" where needed.
- Max one question per screen in S1, S5 and S13.

---

## 4. Randomized factors (all independent, balanced, server-side)

| Factor | Levels | Hypothesis |
| --- | --- | --- |
| Skin | honest / fraud | H1 |
| Round-1 outcome | small win / flat | H2 |
| Pool invite source | friend / ad | H5 |
| Test withdrawal | allowed / not offered | H6 |
| Reinvest framing | profit wallet / main wallet | H7 |
| Flash-deal order | random permutation per player | H3 (order control) |
| Spin order | random permutation per player | H4 (order control) |

Reuse the existing balanced-randomization code; add the new factors.

---

## 5. Measures and export

Add all new event types, and update `wide.csv` and the generated data dictionary. Key derived variables (computed server-side at export):

| Variable | Definition | Hypothesis |
| --- | --- | --- |
| decision_time_first_invest | S3 first render → first Invest/Skip tap (s) | H1 |
| verify_any | Opened T&C, plan details or badge info at least once | H1, H1d |
| total_deposited | Sum of all deposits | H1 |
| vip_upgrade | Reached VIP 2 | H1c |
| chat_deposit | Deposited within 60 s of the mentor chat | H1f |
| escalation_ratio | Round 2 amount ÷ round 1 amount (blank if round 1 = 0) | H2 |
| deal_invest_500 / 3000 / 8000 | Invested in each flash deal | H3 |
| deal_details_500 / 3000 / 8000 | Opened details before investing | H3 |
| lambda | Loss aversion from spin accept/skip (keep v1 formula and cap) | H4 |
| crash_topup, crash_topup_amount | S11 | H4 |
| pool_join, pool_details | S8 | H5 |
| post_withdrawal_deposit | S9 deposit | H6 |
| reinvest_accept, reinvest_amount | S10 | H7 |
| tax_paid | S12 | H1g |
| crt_score, literacy_score, overconfidence | S5 + S1 self-rating (keep v1 formulas) | H1, H8 |
| trap_score | Count of traps fallen for, 0–10: locked-bonus deposit, VIP upgrade, chat deposit, ≥ 1 flash deal without details, pool join without details, crash top-up, tax paid, plus 3 more defined in config | H8, H9 (replaces the scenario-based susceptibility index) |
| feature_push_* , app_trust, app_urgency, fomo_score | S13 | H1h, H5, H9 |
| final_balance | End of game | Prize draw, descriptive |

---

## 6. Update the hypothesis report

Edit `hypothesis-report.md` so its Variables and Source lines match the game (do not change hypothesis statements):

- H3, H5, H7: Source becomes "Prototype logs" and DVs become the behavioural measures above.
- H4: λ comes from the in-game bonus spins.
- H8: susceptibility index becomes the in-game trap score.
- H1c: VIP tiers promise higher returns; actual returns are identical in both skins.
- H1d: fictional regulator ("NDIA") in the prototype.
- Add one line under H1: both skins share identical mechanics and payoffs; only presentation differs.

---

## 7. Phases

### Redesign Phase 1 — Game engine and economy
Wallets (Main, Profit), scripted round results, stage machine with resume (reuse `current_step`), `game.ts` config, new randomized factors.
**Checklist:** a headless run through all stages works for every factor combination; randomization balance tests updated and passing.

### Redesign Phase 2 — Fraud skin UI
All stages in the fraud skin with full visual treatment (toasts, ticker, pulsing button, counters, confetti, timers, mentor chat typing animation, tax trap).
**Checklist:** plays end to end at 360 px width; no overlay covers any button.

### Redesign Phase 3 — Honest skin UI
Same stages, honest presentation. Shared components with a `skin` prop.
**Checklist:** both skins have identical stage order, timings, amounts and payoffs (add a test that compares the scripted economy across skins).

### Redesign Phase 4 — Mini-games and quick reactions
S2 spins, S5 brain bonus, S13 swipe cards and sliders.
**Checklist:** all answers stored in `responses`; spin results hidden until S14.

### Redesign Phase 5 — Report card, debrief and sharing
S14 personalised trap report, debrief tips, data withdrawal, S15 share link. Optional `PRIZE_DRAW` flag.
**Checklist:** trap score on screen matches the exported `trap_score`.

### Redesign Phase 6 — Logging and export
All events, derived variables in Section 5, regenerated data dictionary, admin counts for new factors.
**Checklist:** the simulation script (update it to the new flow) runs 40 players; export has no missing required values.

### Redesign Phase 7 — Cleanup and report update
Remove v1 screens and survey config, update README, `docs/screens.md`, `docs/qa-checklist.md`, and `hypothesis-report.md` (Section 6).
**Checklist:** lint, typecheck and all tests pass; `npm run smoke` updated for the new flow and passing.

### Redesign Phase 8 — Playtest pass
Play both skins end to end in a real browser at phone width. Fix anything that feels slow, confusing or dead. Target: full game in 8–10 minutes.
**Checklist:**
- [ ] Both skins fun and complete; honest skin not noticeably shorter or duller
- [ ] Every DV in Section 5 exported and documented
- [ ] No real money, payment, credential or identity fields anywhere
- [ ] Database reset instructions in README
- [ ] Every phase committed and pushed; `git status` clean
- [ ] Final summary written in `PROGRESS.md`
