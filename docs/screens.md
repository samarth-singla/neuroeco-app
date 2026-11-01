# Screens — the ZenTrade game

Participant journey, in order (about 7–9 minutes, 47 screens). Both skins have the same stages, timings, amounts and
payoffs; the fraud skin ("ZenTrade X") adds the dark-design layer, the honest skin ("ZenTrade") presents the
same thing the way a regulated app would. Both skins use a dark background; the honest skin is a calm dark-slate design with normal-size numbers and readable text. Code: `client/src/game/stages/`. Texts, numbers and timings:
`client/src/config/game.ts`. Step ids (`g:<stage>:<n>`) are stored as the participant's `current_step`; event
names appear in `events.csv`; derived columns are in `docs/data-dictionary.md`.

| Stage | What the player does | Fraud skin adds | Logged | Hypothesis |
| --- | --- | --- | --- | --- |
| S0 Consent | Study info (no fraud framing), 18+ and agree boxes; declining creates no record | — | participant created, balanced randomization | — |
| S1 Trader profile (8 screens) | Age band, gender, field, family income, investing experience, trading-app use, prior financial education, "How good are you with money?" 1–7 | Avatar picker, "Profile 100% complete!" | `responses` | Controls, H8, H9 |
| S2 Bonus spins (4) | "50% lose ₹100 / 50% win ₹X" (X = 100, 150, 200, 300, random order): accept or skip; results hidden until S14 | Spinning wheel, "Lucky spin" | `spin_accept` / `spin_skip`, `la_gain_X` | H4 (λ = smallest accepted win ÷ 100; reject all = 3.5) |
| S3 Home dashboard | Wallets, ₹500 bonus, 3 plans with details, chart; invest or skip | Bonus locked until first deposit; ticker, winner toasts, testimonials, "NDIA Certified" badge, ★4.9, 10 lakh+ users; countdown + "only 3 slots left"; VIP ladder; tiny T&C | `s3_invest`/`s3_skip` (decision time), `plan_select`, `verify_open`, `toast_shown` | H1, H1a–H1e |
| S4 Trading rounds 1–2 | Pick an amount, Invest or Skip, animated chart, result (round 1: +8% or 0% by condition; round 2: +6%) | Pulsing INVEST NOW, VIP "Upgrade" shortcut, confetti on wins | `round_invest`/`round_skip`, `vip_upgrade_tap` | H1c, H2 |
| S5 Brain bonus (6) | 3 CRT puzzles + 3 Big Three literacy questions; +₹100 per correct answer | Timer ring (visual only) | `brain_answer`, `responses` | H1 moderator, H8 |
| S4 Round 3 | as above (+10%) | as above | as above | — |
| S6 Mentor chat | Open the message or continue | "Rohit Sir, Senior Advisor" typing: "Most members upgrade to VIP 2 today…"; honest: Help & FAQ card | `chat_shown`, `chat_open`, deposit within 60 s | H1f |
| S4 Round 4 | as above (+12%); ₹2,000 streak reward after round 4 | as above | as above | H1f (chat deposit) |
| S7 Flash deals (3) | ₹500 / ₹3,000 / ₹8,000 deals in random order: view details, invest or skip | Flashing FLASH DEAL banner, countdown, viewers | `deal_invest`/`deal_skip` (details before, decision time) | H3 |
| S8 Diamond Pool | Friend message or sponsored ad (random, separate from skin): join ₹2,000 or not | — | `pool_join`/`pool_skip` (details before, decision time) | H5 |
| S9 Test withdrawal | Allowed: withdraw ₹500 ("Money sent!") — or not offered; then a deposit offer (≤ ₹5,000) | Celebration; "Withdrawals open at VIP n" | `test_withdraw`, `post_withdrawal_deposit` | H6 |
| S10 Gold Plan | ₹2,000 offer from the Profit wallet or the Main wallet (random); slider ₹0–2,000 | — | `reinvest` | H7 |
| S11 Market crash | Main + Portfolio −40%; top up ("Loss Shield") or leave it | Red flash, shake, "recover in 10 minutes" countdown | `crash`, `crash_topup`/`crash_leave` | H4 |
| S12 Cash out | Withdraw everything. Honest: processed | Blocked: 10% "processing tax", freeze warning, support message; Pay tax / Don't pay | `cashout` / `tax_shown`, `tax_pay`/`tax_decline` | H1g |
| S13 Quick reactions (12) | 7 swipe cards "Did this push you to invest?" (feature re-rendered in own skin), trust and urgency sliders, 3 FOMO agree/disagree cards | — | `responses`, `reaction_method` | H1h, H5, H9 |
| S14 Scam Report Card | Reveal; traps fallen for (score /10, honest /9) and avoided; spin results; final balance; how the scam worked; safety tips | — | `report_shown` | Debrief |
| S15 Share | Share the challenge (link without personal data) | — | `share_tap` | Recruitment |

## Rules every stage follows

- Every money screen can be passed without investing; skipping is logged.
- Countdowns reset at zero and never block progress.
- Toasts sit in a reserved lane; confetti, coins and the crash flash stay in the content area under the sticky
  bars; nothing ever covers a button or an amount field (checked by `npm run smoke`).
- Amounts are capped by the wallet balance; one question per screen in S1, S5 and S13.
- A page refresh resumes on the same screen without repeating any scripted result.
