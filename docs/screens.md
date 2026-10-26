# Screens

Participant journey, in order. Both app versions have the same screens, returns and flow; the fraud-style
version adds the H1 dark-design features. Code: `client/src/screens/`. Texts and amounts:
`client/src/config/session.ts`, `survey.ts`, `study.ts`. Event names are in `events.csv`
(`event_type` column); derived columns are described in `docs/data-dictionary.md`.

## Before the app

| Step | Screen | Shows | Logs | Hypothesis |
| --- | --- | --- | --- | --- |
| — | Consent | Study info (no fraud framing), 18+ and agree checkboxes. Declining ends without a record. | participant created on agree | — |
| — | Random assignment | Server-side, balanced: `app_version`, `round1_outcome`, `withdrawal_offer`, `referral_source`, `money_source`; shuffled `stake_order` | `participants` row | H1, H2, H3, H5, H6, H7 |

## App session (A1–A10)

| # | Screen | Plain version | Fraud-style version | Logs | Hypothesis |
| --- | --- | --- | --- | --- | --- |
| A1 | Welcome | Intro: ₹10,000 practice balance, use it or not | Same + **₹500 sign-up bonus**, locked until the first deposit | `screen_view`, `bonus_shown` | H1b |
| A2 | Investment plans | 3 plans (Starter / Growth / Premium, "up to 8/10/12% per cycle") + risk note; About / Verify link (neutral company info) | Same plans + **countdown & "Only 3 slots left"** (H1a), **VIP tiers** (H1c), **"NDIA Certified" badge and certificate** behind the same About / Verify link (H1d), **live withdrawal ticker and screenshot testimonials** (H1e) | `plan_select`, `invest_click` / `exit_click` (with `decision_ms`), `verify_click`, `verify_close`, `timer_reset` | H1, H1a, H1c, H1d, H1e |
| A3 | Deposit 1 | Amount input + quick amounts; "Don't invest" | Same | `deposit_submit {round: 1}` | H1, H1b, H2 |
| A4 | Round-1 outcome | +8% (`small_win`) or 0% (`flat`) on the deposit | Same | `outcome_shown` | H2 |
| A5 | Deposit 2 | "Invest again?" + Help & FAQ link | Same + **mentor chat** bubble: "Most members upgrade to VIP 2 today" | `deposit_submit {round: 2}`, `chat_open {kind}`, `chat_preview_shown` | H2, H1f |
| A6 | Withdrawal stage | `allowed`: withdraw ₹200 → succeeds. `not_offered`: portfolio only | Same | `withdraw_offer_shown`, `withdraw_click`, `withdraw_skip` | H6 |
| A7 | Deposit 3 | "Add more?" + Help & FAQ link | Same + mentor chat | `deposit_submit {round: 3}`, `chat_open` | H6, H1f |
| A8 | Scripted loss | −30% "market correction"; "Top up to recover" / "Leave" | Same | `loss_shown`, `topup_click`, `topup_submit`, `topup_cancel`, `topup_decline` | H4 |
| A9 | Final withdrawal | Withdrawal processes normally (or "Leave it in the app") | Withdrawal **blocked by a 10% "processing tax"**: "Pay fee" / "Don't pay" (simulated) | `withdraw_final_click`, `withdraw_final_keep`, `fee_shown`, `fee_pay_click`, `fee_decline_click` | H1g |
| A10 | End of session | "Session complete" → survey | Same | `screen_view` | — |

Every app screen can be passed without investing. The countdown restarts at zero ("New slots opening…")
and never blocks progress.

## Surveys

| Step | Pages | Content | Hypothesis |
| --- | --- | --- | --- |
| UI/UX survey | 8 | For each feature, a re-render from the participant's own version (fraud element or plain counterpart), rated 1–7 for urgency, trust and temptation: timer & slots / plan card, bonus / welcome card, VIP tiers / plan list, regulator badge & certificate / About page, ticker & testimonials / plans screen, mentor chat / Help & FAQ, withdrawal tax / withdrawal confirmation. Then overall trust and overall urgency. | H1a–H1g, H1, H6 (trust) |
| General survey | 13 | CRT (3) · loss-aversion gambles (6) · stake scenarios ₹500 / ₹5,000 / ₹50,000 in random order · referral scenario (friend or ad) · herd/FOMO (5) · money-source scenario (app profit or own money; willingness + ₹0–2,000) · self-rated literacy · Big Three literacy · susceptibility (5) · experience & exposure (4) · demographics (+ optional comment) | H1 (CRT), H3, H4, H5, H7, H8, H9 |

## After the surveys

| Step | Screen | Shows | Logs |
| --- | --- | --- | --- |
| Debrief | Reveals the simulated fraud app, lists the eight manipulative features (adapted to the version seen), explains scripted outcomes, protection tips (official regulator check, never pay to withdraw, cybercrime.gov.in / 1930), "Withdraw my data" | `data_withdraw` → `participants.withdrawn = 1` |
| Thank you | End message (different text after a withdrawal) | `screen_view` |
