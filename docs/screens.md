# Screens — the ZenTrade game

Participant journey, in order (about 7½–8 minutes in the fraud skin, 6½–7 in the honest skin). Both skins
have the same stages, order, timings, amounts and payoffs; the fraud skin ("ZenTrade X") adds the dark-design
layer, the honest skin ("ZenTrade") presents the same thing the way a regulated app would (dark slate design,
normal-size numbers, readable risk text). The honest skin skips three things that have no money in them: the
mentor-chat screen, the 7 feature swipe cards, and the extra cash-out result screen. Code:
`client/src/game/stages/`; step order: `client/src/game/steps.ts`. Texts, numbers and timings:
`client/src/config/game.ts`. Step ids (`g:<stage>[:<n>]`) are stored as the participant's `current_step`; event
names appear in `events.csv`; derived columns are in `docs/data-dictionary.md`.

Order: profile → home → **spin 1** → round 1 → **bonus question 1** → round 2 → **spin 2** → round 3 → **bonus
questions 2 and 3** → [mentor chat, fraud only] → round 4 → **bonus question 4** → flash deals → pool invite →
test withdrawal → Gold Plan → crash → cash out → quick reactions → report card → share. Spins and bonus
questions are pop-ups over the (dimmed, untappable) trading screen.

| Stage | What the player does | Fraud skin adds | Logged | Hypothesis |
| --- | --- | --- | --- | --- |
| S0 Consent | Study info (no fraud framing), 18+ and agree boxes; declining creates no record | — | participant created, balanced randomization | — |
| S1 Trader profile (8 screens) | Age band, gender, field, family income, investing experience, trading-app use, prior financial education, "How good are you with money?" 1–7 | Avatar picker, "Profile 100% complete!" | `responses` | Controls, H8 (self-rating → overconfidence), H9 |
| S3 Home dashboard | Wallets, ₹500 bonus, 3 plans with details, chart; invest or skip | **VIP ladder pop-up on the first visit** (VIP 1 = 2%, VIP 2 = 3%, VIP 3 = 5% daily, with thresholds); bonus locked until first deposit; ticker, winner toasts, testimonials, "NDIA Certified" badge, ★4.9, 10 lakh+ users; countdown + "only 3 slots left"; VIP ladder card; tiny T&C | `s3_invest`/`s3_skip` (decision time from when the dashboard is usable), `plan_select`, `verify_open`, `toast_shown`, `vip_popup_shown`/`vip_popup_close` | H1, H1a–H1e |
| S2 Bonus spins (2 pop-ups) | "50% lose ₹100 / 50% win ₹X": X = ₹150 before round 1 and ₹250 before round 3, or the other way round (random per player, `spin_order`); accept or skip; results hidden until S14 | Spinning wheel, "Lucky spin" | `spin_accept`/`spin_skip`, `la_gain_150`, `la_gain_250` | H4 (loss-aversion group) |
| S4 Trading rounds 1–4 | Pick an amount, Invest or Skip, 3-second animated chart (the stake shows as "in trade", out of Main), then the result card while Main and Profit update together (round 1: +8% or 0% by condition; then +6%, +10%, +12%). A gain goes to Profit and the stake returns to Main, so Main changes only on a loss; ₹2,000 streak reward after round 4 | **Persistent VIP bar** on every money screen ("VIP 1 · ₹3,200 / ₹5,000 to VIP 2"); after each round a **nudge** "Deposit ₹X more to unlock VIP n and earn n% daily" (tap pre-fills the next round); **level-up banner + confetti** when a threshold is crossed (higher rate "starting next cycle", so payoffs stay identical); pulsing INVEST NOW, "Upgrade" shortcut, confetti on wins | `round_invest`/`round_skip`, `vip_upgrade_tap`, `vip_nudge_tap`, `vip_level_up` | H1c, H2 |
| S5 Bonus questions (4 pop-ups) | Q1 after round 1: bat-and-ball CRT (₹110 / ₹100 more → ₹5). Q2–Q3 after round 3, Q4 after round 4: Big Three literacy (compound interest, inflation, diversification). +₹100 per correct answer | Timer ring (visual only) | `brain_answer`, `responses` | H1 moderator (CRT correct / incorrect), H8 |
| S6 Mentor chat (fraud only) | Right before round 4: open the message or continue | "Rohit Sir, Senior Advisor" typing: "Most members upgrade to VIP 2 today…" | `chat_shown`, `chat_open`, deposit within 60 s | H1f |
| S7 Flash deals (1 screen) | ₹500 / ₹3,000 / ₹8,000 as three cards in random order, each with "View details" and "Invest"; Continue when done | Flashing FLASH DEALS banner, countdown, viewers | `deal_invest`/`deal_skip` per size (details before, seconds from screen open to Invest / Continue) | H3 |
| S8 Diamond Pool | Friend message or sponsored ad (random, separate from skin): join ₹2,000 or not | — | `pool_join`/`pool_skip` (details before, decision time) | H5 |
| S9 Test withdrawal | Allowed: withdraw ₹500 ("Money sent!") — or not offered; then a deposit offer (≤ ₹5,000) | Celebration; "Withdrawals open at VIP n" | `test_withdraw`, `post_withdrawal_deposit` | H6 |
| S10 Gold Plan | ₹2,000 offer from the Profit wallet or the Main wallet (random); slider ₹0–2,000 | — | `reinvest` | H7 |
| S11 Market crash | Main + Portfolio −40%; top up ("Loss Shield") or leave it | Red flash, shake, "recover in 10 minutes" countdown | `crash`, `crash_topup`/`crash_leave` | H4 |
| S12 Cash out | Withdraw everything. Honest: processed instantly, straight on to S13 | Blocked: 10% "processing tax", freeze warning, support message; Pay tax / Don't pay | `cashout` / `tax_shown`, `tax_pay`/`tax_decline` | H1g |
| S13 Quick reactions | Trust and urgency sliders, then 3 FOMO agree/disagree cards | First: 7 swipe cards "Did this push you to invest?" (one per feature) | `responses`, `reaction_method` | H1h (fraud only), H5, H6, H9 |
| S14 Scam Report Card | Reveal; traps fallen for (score /10, honest /8) and avoided; spin results; final balance; how the scam worked; safety tips | — | `report_shown` | Debrief |
| S15 Share | Share the challenge (link without personal data) | — | `share_tap` | Recruitment |

## Rules every stage follows

- Every money screen can be passed without investing; skipping is logged.
- Countdowns reset at zero and never block progress.
- Toasts sit in a reserved lane; confetti, coins and the crash flash stay in the content area under the sticky
  bars; nothing ever covers a button or an amount field (checked by `npm run smoke`). Pop-ups (spins, bonus
  questions, VIP ladder) carry their own buttons; the screen behind them is `inert` while they are open.
- Amounts are capped by the wallet balance; one question per screen in S1, S5 and S13.
- A page refresh resumes on the same screen without repeating any scripted result.
