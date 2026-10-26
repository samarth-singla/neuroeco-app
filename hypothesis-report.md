# Final Hypothesis Report — Behavioral Mechanics of App-Based Investment Frauds

A neuroeconomic perspective · Samarth Singla, Aishani Sood · 2026-10-23

---

## H1: Dark design features override deliberate judgment

**Statement:** Participants using the fraud-style app decide faster, invest more often and in larger amounts, verify less, and rate the app as more urgent and trustworthy than participants using a plain version with the same returns.

**H0:** App version has no effect on decision time, investment, verification or perceived urgency and trust.

**Basis:** Dark design loads the decision with pressure, rewards and social signals, shifting choice from deliberate System 2 evaluation to fast System 1 judgment.

**Variables**

- **IV:** App version (plain / fraud-style, randomly assigned)
- **DVs:** Decision time (seconds), invested (yes/no), amount invested, verification click (yes/no), urgency and trust ratings (1–7)
- **Moderator:** CRT score (Cognitive Reflection Test, 0–3)
- **Controls:** Age, gender, investing experience, trading-app use

**Source:** Prototype logs + UI/UX survey

**Test:** Mann-Whitney U (decision time, amount); chi-square (invested, verified); regression with app version × CRT interaction

### Sub-hypotheses: design features used in real fraud apps

| Sub | Design feature | Bias exploited | Expected effect |
| --- | --- | --- | --- |
| H1a | Countdown timers and "only 3 slots left" on investment plans | Urgency, scarcity | Faster decisions, more investing |
| H1b | Sign-up bonus credited to the wallet, withdrawable only after a first deposit | Endowment effect, reciprocity | Higher first-deposit rate |
| H1c | VIP levels: bigger deposits unlock higher daily returns | Goal-gradient, status, sunk cost | Larger deposits to reach the next tier |
| H1d | Fake regulatory credentials: "SEBI registered" badges, certificates, names close to real brokers | Authority bias | Higher trust, fewer verification checks |
| H1e | Live withdrawal ticker and screenshot testimonials | Social proof, FOMO | More investing, faster decisions |
| H1f | "Customer service" or mentor chat that nudges users to deposit | Authority, social trust | Higher deposit after the nudge |
| H1g | Withdrawal blocked by a "tax", "processing fee" or account freeze until an extra payment | Endowment effect, loss aversion, sunk cost | Willingness to pay to unlock |

Each sub-hypothesis is tested through feature-level urgency, trust and temptation ratings (plain vs fraud-style, Mann-Whitney U per feature). These results form the design-vulnerability (UX) map.

---

## H2: An early small win increases later investment

**Statement:** Participants who see a small profit after their first investment invest more in the next round than those who see no gain.

**H0:** First-round outcome has no effect on second-round investment.

**Basis:** An unexpected reward creates a positive reward prediction error (dopamine signal) that reinforces the action, as with intermittent reinforcement in gambling.

**Variables**

- **IV:** Round-1 outcome (small win / flat, randomly assigned)
- **DVs:** Round-2 amount, escalation ratio (round-2 amount ÷ round-1 amount)

**Source:** Prototype logs

**Test:** Mann-Whitney U on escalation ratio

---

## H3: People trust faster when stakes are small

**Statement:** Willingness to invest without verifying is highest at small amounts and falls as the amount rises.

**H0:** Willingness and verification intention do not change with stake size.

**Basis:** Prospect Theory probability weighting and the peanuts effect: small potential losses feel negligible, so scrutiny drops.

**Variables**

- **IV:** Stake level (₹500 / ₹5,000 / ₹50,000, within-subject)
- **DVs:** Willingness to invest (1–7), would verify first (yes/no)

**Source:** General survey

**Test:** Friedman test; Cochran's Q for verification

---

## H4: Loss aversion drives loss chasing

**Statement:** After a scripted loss, participants with higher loss aversion are more likely to add money to recover their balance.

**H0:** Loss aversion does not predict post-loss top-ups.

**Basis:** Losses weigh about twice as much as equal gains; falling below the reference point triggers recovery-seeking and sunk-cost escalation.

**Variables**

- **IV:** Loss aversion λ (from a 50-50 gamble task)
- **DVs:** Post-loss top-up (yes/no), top-up amount
- **Controls:** App version, investing experience

**Source:** General survey + prototype logs

**Test:** Logistic regression (top-up); OLS (amount)

---

## H5: A friend's referral lowers verification

**Statement:** The same app is joined more readily, and checked less, when a friend refers it than when it appears as an ad.

**H0:** Source of recommendation makes no difference.

**Basis:** Social information is processed as a safety signal; following trusted others reduces the felt need to evaluate.

**Variables**

- **IV:** Referral source (friend / ad, randomly assigned)
- **DVs:** Willingness to join (1–7), would verify first (yes/no)
- **Moderator:** Herd / FOMO score

**Source:** General survey

**Test:** Mann-Whitney U; chi-square

---

## H6: A small successful withdrawal builds trust

**Statement:** Participants allowed one small withdrawal deposit more afterwards than those not offered a withdrawal.

**H0:** Being allowed a withdrawal has no effect on later deposits or trust.

**Basis:** A successful withdrawal is a credibility signal and a reward; it updates trust upward, which is why real scam apps allow small withdrawals before asking for large deposits.

**Variables**

- **IV:** Withdrawal (allowed / not offered, randomly assigned)
- **DVs:** Deposit amount after the withdrawal stage, trust rating (1–7)

**Source:** Prototype logs

**Test:** Mann-Whitney U

---

## H7: App profits are treated as house money

**Statement:** Participants reinvest profits shown in the app more freely than an equal amount of their own fresh money.

**H0:** Source of money has no effect on reinvestment.

**Basis:** Mental accounting puts gains in a separate "free money" account, so losing them feels less painful and risk-taking rises.

**Variables**

- **IV:** Money source (app profit / own money, same amount, randomly assigned)
- **DVs:** Willingness to reinvest (1–7), amount reinvested

**Source:** General survey

**Test:** Mann-Whitney U

---

## H8: Financial literacy does not protect against fraud (extended)

**Statement:** Financial literacy does not reduce fraud susceptibility, while overconfidence (perceived minus actual literacy) increases it.

**H0:** Literacy reduces susceptibility and overconfidence has no effect.

**Basis:** Confident decision-makers rely on fast judgment and skip checking, so knowledge is held but not applied.

**Variables**

- **IVs:** Financial literacy score (Big Three questions), overconfidence score, prior financial education (yes/no)
- **DVs:** Susceptibility index (survey), victimization yes/no (online dataset)
- **Controls:** Age, gender, income, investing experience

**Source:** General survey + online dataset

**Test:** Logistic regression (victimization); OLS (susceptibility index)

---

## H9: The dominant bias differs by demographic group (extended)

**Statement:** The bias that best predicts victimization differs across age, gender and income groups.

**H0:** The same biases predict victimization equally across groups.

**Variables**

- **IVs:** Bias scores × demographic group (interaction terms)
- **DV:** Victimization / susceptibility

**Source:** Online dataset (the survey can test gender only)

**Test:** Regression with interaction terms
