# QA checklist — ZenTrade game

Run before the pilot and again before real data collection. Use a **local test database** (never the live
Turso database — comment out the Turso lines in `.env`), and reset it afterwards.

## Automated checks (run first)

| Command | What it checks |
| --- | --- |
| `npm test` | Economy and step machine for all 32 factor combinations; skin parity (same choices → same balances and payoffs in both skins); mini-games store every answer; report-card trap score = export trap score; consent, pilot link, countdown; server API, randomization balance, export, a 40-player API simulation |
| `npm run simulate` | 40 simulated players through the API; `wide.csv` matches the data dictionary, no missing required values, factors balanced |
| `npm run smoke` | Real browser (Edge or Chrome) plays the whole game at 360 px in both skins, with a refresh mid-game, and hit-tests every button for overlays (needs the app running locally) |
| `npm run lint` / `npm run typecheck` | Code style and types |

## Manual checks on a real phone

### Both skins
Open the link in private windows until you have had both skins (shown in `/admin`, or the app name: "ZenTrade X"
= fraud, "ZenTrade" = honest).
- [ ] **Fraud:** ticker, winner toasts every few seconds, ★4.9 / 10 lakh+ / NDIA badge (tap → certificate),
      locked ₹500 bonus, countdown + "only 3 slots left", VIP ladder, testimonials, pulsing INVEST NOW (phone
      vibrates on Android), confetti on wins, "Rohit Sir" chat typing, flashing flash deals, crash flash, tax block.
- [ ] **Honest:** light theme, equal Invest / Skip buttons, readable risk line above the buttons, About page,
      Help & FAQ card, no toasts / timers / badges / confetti, withdrawal goes through.
- [ ] The honest skin does not feel noticeably shorter or duller.
- [ ] Sound toggle (fraud) is off by default and works when switched on.

### Layout and overlays
- [ ] No sideways scrolling on any screen.
- [ ] Toasts, chat and confetti never cover a button or amount field.
- [ ] Footer "Research prototype — no real money is used." visible on every screen.

### Conditions (see `/admin` for what you got)
- [ ] Round 1 shows +8% (`small_win`) or 0% (`flat`).
- [ ] Pool invite is a friend message or a sponsored ad.
- [ ] Test withdrawal: ₹500 succeeds (`allowed`) or "Withdrawals open at VIP n" (`not_offered`).
- [ ] Gold Plan says "from your profits" or "from your main wallet".
- [ ] Flash deals appear in a different order for different players.

### No dead ends
- [ ] Every money screen can be skipped; never investing still reaches the report card.
- [ ] Waiting on a countdown until zero: it resets and buttons still work.
- [ ] Refresh on a round, after the crash and on the tax screen: same screen, same balances, nothing applied twice.

### Report card and data
- [ ] Trap score and list make sense for what you did; spin results appear only here.
- [ ] "Withdraw my data" → end screen says so; `/admin` Withdrawn +1; player missing from every CSV.
- [ ] Share opens the phone's share sheet (or copies the link) and the link has no personal data.
- [ ] `/admin` counts and the four CSV downloads work; `wide.csv` columns match `docs/data-dictionary.md`.
- [ ] A `?pilot=1` link gives `is_pilot = 1`.

### Safety (plan rule 6)
- [ ] No real payment, UPI, card or bank fields; no phone, email or ID fields.
- [ ] Only fictional names: ZenTrade / ZenTrade X, NDIA, Rohit Sir, toast names; no real logos, regulators, brokers
      or celebrities.
