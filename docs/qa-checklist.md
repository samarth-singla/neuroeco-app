# QA checklist

Run this before the pilot and again before real data collection. Use a fresh database
(see "Reset the database" in the README) and **delete it again afterwards**, so test runs never mix
with real data.

## Automated checks (run first)

| Command | What it checks |
| --- | --- |
| `npm test` | Unit + flow tests: randomization balance, scores, escalation ratio, API, export, every app-session combination, surveys, consent/debrief, timer never blocks, 40-participant API simulation |
| `npm run simulate` | 40 simulated participants through the API; `wide.csv` columns match the data dictionary, no required values missing, factors balanced |
| `npm run smoke` | Real browser (Edge or Chrome) completes the whole study at 360 px in both versions, with a refresh mid-session (needs the app running) |
| `npm run lint` / `npm run typecheck` | Code style and types |

## Manual checks

Tick each box. Use a real phone if possible, otherwise browser dev tools at **360 × 740**.

### Layout (360 px wide)
- [ ] No sideways scrolling on any screen (app, surveys, consent, debrief).
- [ ] Footer "Research prototype — no real money is used." is visible on every screen.
- [ ] Buttons are never hidden behind the mentor chat bubble (fraud version, A5 and A7).
- [ ] Text is readable; Likert buttons 1–7 fit on one row.

### Both versions
Open the link in private/incognito windows until you have had both versions (the version is in
`sessionStorage` key `neuroeco:study:v1` → `assignment.app_version`, or check `/admin`).
- [ ] **Plain:** no bonus, timer, slots, VIP levels, badge, ticker, testimonials, mentor chat or fee screen.
      About/Verify shows neutral company info; A5/A7 show a "Help & FAQ" link; A9 withdrawal just works.
- [ ] **Fraud:** ₹500 locked bonus on A1; countdown + "Only 3 slots left", ticker, NDIA badge, VIP levels,
      testimonials on A2; About/Verify shows the certificate; mentor chat pops up on A5/A7; A9 asks for the
      10% processing tax with Pay / Don't pay.
- [ ] Same plans, same stated returns and same scripted outcomes in both versions.

### Every condition combination
Use `/admin` to see which conditions you got. Cover all 8 combinations of
`app_version × round1_outcome × withdrawal_offer` (the automated flow test covers all 8; spot-check a few by hand).
- [ ] `small_win` shows +8% on A4; `flat` shows 0%.
- [ ] `allowed` shows a ₹200 withdrawal on A6 that succeeds; `not_offered` shows no withdrawal option.
- [ ] The H5 referral page matches `referral_source` (friend / ad) and the H7 page matches `money_source`.
- [ ] H3 stake pages appear in the order given by `stake_order`.

### No dead ends
- [ ] Every app screen can be passed without investing ("Continue without investing", "Don't invest",
      "Not now", "Leave", "Leave it in the app").
- [ ] Wait on A2 until the countdown reaches zero: it shows "New slots opening…", restarts, and both
      buttons keep working.
- [ ] Practice balance at ₹0: deposit screens say the balance is too low and the skip button still works.
- [ ] Survey "Next" with a missing answer highlights the question and does not move on.

### Refresh-resume
- [ ] Refresh on an app screen (e.g. A4, A7): same screen, same wallet balance, scripted result not applied twice.
- [ ] Refresh in the middle of the survey: same page, earlier pages' answers kept.
- [ ] Close the tab and open the link again in a new tab: a new participant starts (consent screen) —
      expected, because `sessionStorage` is per tab.

### Consent, debrief and withdrawal
- [ ] Consent text does not mention fraud or scams.
- [ ] "Agree and start" stays disabled until both boxes are ticked.
- [ ] "I do not want to take part" ends politely and no participant appears in `/admin`.
- [ ] Debrief appears only after the general survey and lists all eight features and the tips
      (cybercrime.gov.in / 1930).
- [ ] "Withdraw my data" → confirm → thank-you text says the data was withdrawn; `/admin` shows
      Withdrawn +1 and the participant is missing from all four CSVs.

### Admin and export
- [ ] `/admin` asks for a password; a wrong password is refused.
- [ ] Counts per factor level look balanced.
- [ ] All four CSV downloads open in Excel / Google Sheets with ₹ shown correctly.
- [ ] `wide.csv` has one row per completed, non-withdrawn participant and its columns match
      `docs/data-dictionary.md`.
- [ ] A pilot link (`?pilot=1`) gives `is_pilot = 1` in the exports.

### Safety (plan rule 3)
- [ ] No real payment, UPI, card or bank fields anywhere.
- [ ] No name, email, phone, password, PAN or Aadhaar fields anywhere.
- [ ] Only the fictional app name (Dhanoura) and fictional regulator (NDIA) appear; no real logos,
      regulators or brokers.
