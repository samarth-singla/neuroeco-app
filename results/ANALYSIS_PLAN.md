# Analysis Plan (pre-registration)

Behavioral Mechanics of App-Based Investment Frauds · written 2026-11-09, **before any hypothesis test was run**.

This plan is committed on its own before the analysis code is run. After that commit it is not changed. If an entry
proves impossible (for example a model cannot be fitted), the original entry stays here, and the problem and the
fallback used are recorded in `ANALYSIS_PROGRESS.md` and in `results/ANALYSIS_REPORT.md`.

**What had been seen when this plan was written.** Column names of all files; the number of consented and completed
players per randomized factor (the `/admin` screenshot: 62 / 62 consented, 22 fraud and 39 honest completers); the
last step reached (`current_step`) per skin; the answer counts of the survey form (Part C is descriptive only). No app
outcome variable (amounts, times, choices, ratings, traps, scores) had been looked at.

Sources: `hypothesis-report.md` (claims), `DATA_COLLECTION_REPORT.md` (variables B9, formulas B10, traps B11,
recipe B13, caveats B14, survey C3/C5).

---

## 1. General rules

| Item | Rule |
| --- | --- |
| Sample | `wide.csv` rows with `is_pilot == 0` (completers). Attrition and intention-to-treat checks use `participants.csv` and `events.csv` (all consented, `is_pilot == 0`). |
| Derived variables | Exactly as in B10, B11 and B13. `overconfidence` is **recomputed after filtering**: z(`self_rated_literacy`) − z(`literacy_score`), z with the sample SD (ddof = 1) over all filtered completers. `trap_score_shared8` = sum of the 8 shared trap flags; it is the only trap score used across skins. `invested_r1` = `r1_amount > 0`. `fraud` = 1 if `skin == "fraud"`. |
| Coding of controls | `exp_investing` as an ordinal number: none = 0, some = 1, regular = 2. `exp_trading_app` and `exp_fin_edu`: yes = 1, no = 0. `loss_aversion_group` as a number 1–3 (blank for inconsistent players). Male = 1 if `demo_gender == "male"`, else 0 (female, other and prefer not to say are collapsed because they are small). |
| Missing data | Complete cases per test; n per group is reported for every test. No imputation. |
| Outliers | No outlier is dropped from any primary or secondary test. The only outlier analysis is the pre-specified decision-time robustness check (section 5). |
| Significance | All tests two-sided, α = 0.05. |
| Binary outcomes, 2 groups | Fisher's exact test (the prompt names Fisher for these; exact tests are valid at any cell size). If a chi-square test is ever used for a larger table, Fisher's exact test (or an exact / Monte-Carlo alternative) replaces it whenever any expected count is < 5. |
| Continuous / ordinal outcomes, 2 groups | Mann-Whitney U (two-sided, exact or asymptotic as chosen by SciPy's default). |
| Within-subject (H3) | Cochran's Q (binary, 3 sizes) with pairwise exact McNemar tests (Holm within H3); Friedman test (times). |
| Models | Logistic regression (maximum likelihood) with odds ratios and Wald 95% CIs; OLS with HC3 robust standard errors. If a logistic model does not converge or shows (quasi-)separation, the problem is reported and the verdict is based on the pre-specified fallback test listed for that hypothesis (exploratory models get no fallback; they are reported as not fitted). |
| Effect sizes | Mann-Whitney U: Cliff's delta δ = P(A > B) − P(A < B) (identical to the rank-biserial correlation), A = the group predicted higher, with a percentile bootstrap 95% CI (2,000 resamples, resampling within each group, seed 42). 2×2 tables: odds ratio with Woolf (log) 95% CI; if any cell is 0, the Haldane–Anscombe correction (+0.5 to every cell) is used for the OR and its CI. Proportions: Wilson 95% CI. Cochran's Q: η²_Q = Q / (n(k − 1)); pairwise: difference in proportions with a bootstrap CI over participants. Friedman: Kendall's W = χ²_F / (n(k − 1)) with a bootstrap CI over participants. Spearman ρ with a bootstrap CI. Regression: coefficient (or OR) with 95% CI. All bootstraps: 2,000 resamples, seed 42. |
| Multiple testing | Holm-adjusted p-values are reported (a) within the H1 family (the distinct primary tests of H1, H1a–H1g: H1, H1a/H1e (shared test), H1b, H1c, H1d, H1f; H1g has no p-value) and (b) across the primary tests of H2–H7. **Verdicts are based on raw p-values** and the rules below; Holm values are shown so the reader can judge. |

## 2. Verdict rules

| Verdict | Rule |
| --- | --- |
| **SUPPORTED** | Primary outcome in the predicted direction with p < 0.05. |
| **PARTLY SUPPORTED** | Primary outcome in the predicted direction with 0.05 ≤ p < 0.10; **or** primary not significant but more than half of the secondary outcomes significant (p < 0.05) in the predicted direction. |
| **NOT SUPPORTED** | No difference (p ≥ 0.10 and the secondary rule not met) **or** an effect in the opposite direction (whatever its p). |
| **NOT TESTABLE** | Too little data or no variance (a group with fewer than 5 players, or an outcome that takes one value in every group), or no comparison group exists in the design. The reason is stated. |
| **EXPLORATORY** | Models labelled exploratory below (H1 moderator, H5 moderator, H9 app part). They never receive SUPPORTED. |
| **DESCRIPTIVE** | H1h (UX map): shares only, no test. |
| **PENDING** | Needs the external dataset (H8 and H9 dataset parts). |

"Predicted direction" means the sign of the effect size (or the order of proportions for H3) matches the prediction.
A significant effect in the opposite direction is reported as such and gives NOT SUPPORTED.

## 3. Hypotheses: prediction, primary test, secondary outcomes

Direction notation: "A > B" means group A is predicted to have higher values.

### H1 — Dark design overrides deliberate judgment

- **Prediction:** fraud-skin players put more money in than honest-skin players (same returns), decide faster, invest
  more often, verify less, and rate the app as more trustworthy and more urgent.
- **Primary:** `total_deposited`, fraud > honest, Mann-Whitney U, Cliff's δ (fraud vs honest).
- **Secondary:**
  - `decision_time_first_invest`: fraud < honest (MWU)
  - `invested_r1`: fraud > honest (Fisher, OR)
  - `verify_any`: fraud < honest (Fisher, OR)
  - `app_trust`: fraud > honest (MWU)
  - `app_urgency`: fraud > honest (MWU)
  - `trap_score_shared8`: fraud > honest (MWU)
- **Moderator (exploratory, small n):** OLS (HC3) of `log1p(total_deposited)` on
  `fraud + crt_correct + fraud × crt_correct + exp_investing + exp_trading_app`. Prediction: the fraud effect is
  smaller for players who answer the CRT correctly (negative interaction). Verdict at most EXPLORATORY.

### H1a — Countdown timer and "only 3 slots left"

- **Prediction:** faster first decision under the fraud skin.
- **Primary:** `decision_time_first_invest`, fraud < honest (MWU) — the same test as the H1 secondary outcome, so it
  counts once in the Holm family (shared with H1e).
- **Secondary:** share of fraud players with `feature_push_timer = yes` (Wilson CI, descriptive).
- **Note:** features are bundled in the fraud skin; the skin comparison cannot isolate the timer.

### H1b — Locked sign-up bonus

- **Prediction:** a higher first-deposit rate under the fraud skin.
- **Primary:** `trap_hook` (round-1 stake > 0), fraud > honest (Fisher, OR).
- **Secondary:** share with `feature_push_bonus = yes` (Wilson CI).

### H1c — VIP levels

- **Prediction:** larger deposits to reach the next tier under the fraud skin.
- **Primary:** `vip_upgrade` (total deposited ≥ ₹5,000), fraud > honest (Fisher, OR).
- **Secondary:** `vip_level`, fraud > honest (MWU); share with `feature_push_vip = yes` (Wilson CI). Within fraud,
  described only: distribution of `vip_nudge_taps` and `vip_level_ups`.

### H1d — Fake regulatory credentials

- **Prediction:** fewer verification checks under the fraud skin.
- **Primary:** `verify_any`, fraud < honest (Fisher, OR).
- **Secondary:** `verify_count`, fraud < honest (MWU); share with `feature_push_regulator = yes` (Wilson CI).

### H1e — Social proof (ticker, testimonials)

- **Prediction:** faster decisions under the fraud skin.
- **Primary:** `decision_time_first_invest`, fraud < honest (MWU) — shared with H1a.
- **Secondary:** share with `feature_push_social = yes` (Wilson CI).

### H1f — Mentor chat

- **Prediction:** a higher deposit right after the nudge (round 4) under the fraud skin.
- **Primary:** `r4_amount`, fraud > honest (MWU).
- **Secondary:** within fraud, `chat_deposit` rate (Wilson CI); share with `feature_push_chat = yes` (Wilson CI).

### H1g — Withdrawal blocked by a tax

- **Prediction:** players are willing to pay to unlock a blocked withdrawal.
- **Primary:** within fraud, `tax_paid` rate among players shown the tax (Wilson CI). **No honest comparison exists**
  (the honest skin has no tax), so there is no hypothesis test and no p-value.
- **Secondary:** share with `feature_push_tax = yes` (Wilson CI).
- **Verdict:** NOT TESTABLE as a causal claim (no comparison group); the rate is reported descriptively.

### H1h — UX map

- Bar chart of the share of fraud players saying each feature pushed them to invest (7 features), with Wilson CIs,
  sorted. Verdict DESCRIPTIVE.

### H2 — An early small win increases later investment

- **Prediction:** players randomized to a small round-1 win escalate their round-2 stake more than players with a flat
  round 1.
- **Primary:** `escalation_ratio` (= `r2_amount / r1_amount`), small_win > flat, MWU, only players with
  `r1_amount > 0` (the number excluded is reported).
- **Secondary:** `r2_amount`, all completers, small_win > flat (MWU).

### H3 — People trust faster when stakes are small (within-subject)

- **Prediction:** at ₹500 players open the deal's details **least** and invest **most**; checking rises and investing
  falls as the stake rises.
- **Data:** long format participant × size (B13), with card position from `deal_order`.
- **Primary:** `deal_details` across sizes, Cochran's Q. Predicted direction = the details share is lowest at ₹500.
  Pairwise exact McNemar tests (500 vs 3,000, 500 vs 8,000, 3,000 vs 8,000) with Holm within H3.
- **Secondary:**
  - `deal_invest` across sizes, Cochran's Q; predicted direction = the invest share is highest at ₹500;
  - `deal_time` across sizes, Friedman test; predicted direction = shortest median time at ₹500.
- **Order check:** the same Cochran's Q tests on card position (1st / 2nd / 3rd card) instead of size, to see whether
  position rather than size drives choices.

### H4 — Loss aversion drives loss chasing

- **Reported first:** the distribution of `loss_aversion_group` (1 / 2 / 3) and the number of inconsistent players
  (`la_consistent = 0`, excluded). If one group holds more than 70% of the players, the test is marked **low-power**
  and the report says so.
- **Prediction:** higher loss-aversion group → more likely to top up after the crash.
- **Primary:** logistic regression `crash_topup ~ loss_aversion_group (numeric 1–3) + fraud + exp_investing`;
  coefficient of `loss_aversion_group` > 0 (OR > 1), Wald p.
  - Fallback if the model cannot be fitted: Spearman correlation of `loss_aversion_group` with `crash_topup`.
- **Secondary:** OLS (HC3) `crash_topup_amount` on the same predictors (coefficient > 0); Spearman ρ between
  `loss_aversion_group` and `crash_topup_amount` (> 0).
- **Order check:** `loss_aversion_group` by `spin_order` (MWU), descriptive.

### H5 — A friend's referral lowers verification

- **Prediction:** the pool is joined more often, checked less and decided faster when a friend refers it.
- **Primary:** `pool_join`, friend > ad (Fisher, OR).
- **Secondary:** `pool_details`, friend < ad (Fisher, OR); `pool_time`, friend < ad (MWU).
- **Moderator (exploratory):** logistic `pool_join ~ friend + fomo_score + friend × fomo_score`.

### H6 — A small successful withdrawal builds trust

- **Prediction:** players offered a test withdrawal deposit more afterwards and trust the app more.
- **Primary:** `post_withdrawal_deposit`, allowed > not_offered, MWU (intention-to-treat on the offer: everyone
  offered is in the allowed group whether or not they withdrew).
- **Secondary:** `app_trust`, allowed > not_offered (MWU). Within allowed: take-up rate of `withdrew` (Wilson CI,
  descriptive).

### H7 — App profits are treated as house money

- **Prediction:** the Gold Plan is funded more generously from app profit than from the main wallet.
- **Primary:** `reinvest_amount`, profit > main (MWU).
- **Secondary:** `reinvest_accept`, profit > main (Fisher, OR).

### H8 — Financial literacy does not protect; overconfidence increases susceptibility

- **Reported first:** the distribution of `literacy_score` (0–3). If more than half of the players score 3, a
  ceiling effect is flagged.
- **App part — model:** OLS with HC3 standard errors,
  `trap_score_shared8 ~ literacy_score + overconfidence + exp_fin_edu + fraud + exp_investing`.
- **Prediction:** the literacy coefficient is **not negative** (literacy does not protect) and the overconfidence
  coefficient is **positive**.
- **Primary:** the overconfidence coefficient (> 0, p < 0.05). The literacy part is judged by its 95% CI: if the
  whole CI lies below 0, literacy **does** protect and the prediction fails. If the CI includes 0, the report says
  "no evidence that literacy protects" and states how large a protective effect the CI still allows (it is not
  evidence that literacy does not matter).
- **App-part verdict:** SUPPORTED if the overconfidence coefficient is positive with p < 0.05 **and** the literacy CI
  is not entirely below 0; PARTLY SUPPORTED if the overconfidence coefficient is positive with 0.05 ≤ p < 0.10 and the
  literacy CI is not entirely below 0; NOT SUPPORTED if the overconfidence coefficient is not positive or p ≥ 0.10, or
  if the literacy CI lies entirely below 0.
- **Note:** `overconfidence` is a linear combination of the self-rating and the literacy score, so with literacy in the
  model its coefficient is the effect of a higher self-rating at the same literacy.
- **Dataset part:** logistic regression of victimization on literacy and overconfidence (z(self-rated knowledge) −
  z(literacy)) with age group, gender, income group and investing experience as controls (survey weights if provided).
  **PENDING** until the dataset is added (Step 4b).
- **Final verdict:** combines both parts; while the dataset part is PENDING it is shown as the app-part verdict
  labelled "app evidence only".

### H9 — The dominant bias differs by demographic group

- **App part (EXPLORATORY only):** OLS (HC3)
  `trap_score_shared8 ~ (loss_aversion_group + fomo_score + overconfidence + crt_correct) × male`. Group sizes are
  reported. Age and income cannot be tested in the app sample (mostly 18–20). Verdict at most EXPLORATORY.
- **Dataset part:** logistic regression of victimization on bias proxies (overconfidence, risk attitude if available)
  × age group, income group and gender; report which bias predicts victimization most strongly in each group.
  **PENDING**.
- **Final verdict:** "app evidence only: EXPLORATORY" while the dataset part is PENDING.

## 4. Data checks (before any hypothesis result)

- Sample size per randomized factor among completers; skin × each other factor (Fisher) to confirm the randomization
  stayed independent among completers.
- Missing values per analysis column; number of inconsistent spin players; `crt_1` entries that are not numbers.

## 5. Robustness

- **Decision-time outliers:** flag `decision_time_first_invest` > Q3 + 3 × IQR (computed on all completers pooled).
  The H1 timing tests (H1 secondary, H1a / H1e primary) are run with and without the flagged players; both are
  reported, verdicts use the full sample.
- **Attrition:** completion rate by skin (Fisher) and by each other factor; drop-out funnel by skin over the shared
  steps; drop-outs during the profile (before any money screen) separated from drop-outs after the home screen.
- **Intention-to-treat (H1, H2):** rebuilt from `events.csv` for every consented player who reached `g:home`: S3
  decision time (`s3_invest` / `s3_skip` `decision_ms`), round-1 and round-2 stakes (`round_invest` / `round_skip`).
  H1 reruns: `invested_r1` (Fisher), decision time (MWU), `r1_amount` (MWU). H2 reruns: escalation ratio and
  `r2_amount` for those who played round 2. The report says whether conclusions change. Verdicts use the completer
  analysis in this plan.

## 6. Survey (Part C, descriptive only)

Cleaning by the C5 recipe adapted to the real headers; the one non-consenting row is dropped. Shares with Wilson CIs:
approached (Q1), each trick seen (Q2, ranked), approach channels (Q4), the "What stopped you" reasons (ranked). For
the few who invested: counts only ("1 of 2"), no percentages and no tests. One comparison figure: trick seen in real
life (survey) next to the share of fraud players who said that trick pushed them (app), for the features both
measure.
