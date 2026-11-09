# Analysis Progress

Running log of the study analysis (Python pipeline in `analysis/`, outputs in `results/`). Newest entries at the bottom.

How to run everything from the raw files in `data/`:

```bash
py -3.13 -m venv analysis/.venv
analysis/.venv/Scripts/python -m pip install -r analysis/requirements.txt   # macOS/Linux: analysis/.venv/bin/python
analysis/.venv/Scripts/python analysis/run_all.py
```

---

## Step 1 — Pre-registration (2026-11-09)

**Status:** done, committed on its own before any test was run.

- `results/ANALYSIS_PLAN.md`: prediction, one primary test, secondary outcomes and verdict rules for H1, H1a–H1h,
  H2–H9; effect sizes, Holm families, robustness and survey plan.
- Seen before writing: column names, consent/completion counts per factor (`/admin`), `current_step` per skin, survey
  answer counts. No app outcome variable had been looked at.
- Setup: `analysis/requirements.txt` (pandas, numpy, scipy, statsmodels, matplotlib, plus pyyaml for the external
  dataset config in Step 4b); a local virtual environment `analysis/.venv` (Python 3.13, git-ignored).
- Housekeeping: `.gitignore` now ignores the contents of `data/` but keeps `data/external/README.md`; `results/` and
  `analysis/` are excluded from prettier and ESLint (generated / Python files).
- Data notes:
  - the survey export is named `Investment Apps – Quick Survey (Responses) - Form responses 1.csv` (not
    `survey.csv`); the code finds it by pattern, and the file is not renamed (data/ is read-only);
  - `data/external/` did not exist; it is created in Step 4b with a README only.

## Step 2 — Data checks (2026-11-09)

**Status:** done. Module `analysis/checks.py`; tables `results/tables/checks_*.csv`; section `checks` in
`results/results.json`.

- 61 completers (no pilots): honest 39 / fraud 22. The other factors are close to 50/50 among completers.
- Among completers, skin is independent of every other randomized factor (Fisher, smallest p = 0.108 for the Gold
  Plan framing).
- No missing values except blanks by design (fraud-only columns, `withdrew` when not offered, escalation ratio when
  round 1 was skipped, loss-aversion group for 3 inconsistent spin players).
- All `crt_1` answers are numbers.
- Decision-time outliers (> Q3 + 3 × IQR = 68.9 s): 3 players (2 honest, 1 fraud). They are kept in every test;
  the H1 timing tests are rerun without them as robustness.
- One player has duplicated round events (identical amounts, from a double tap or refresh). The first event is used,
  which reproduces `wide.csv` exactly. The S3 decision time from `events.csv` also matches `wide.csv` exactly for all
  61 completers.

## Step 3 — Attrition and intention-to-treat (2026-11-09)

**Status:** done. Module `analysis/attrition.py`; tables `results/tables/attrition_*.csv`; figure
`results/figures/attrition_funnel.png`; section `attrition` and tests `ATT.*`, `H1.itt.*`, `H2.itt.*` in
`results.json`.

- **Differential attrition (critical):** fraud 22 of 62 completed (35%) vs honest 39 of 62 (63%); Fisher p = 0.004,
  OR of completing (fraud vs honest) 0.32 [0.16, 0.67]. No other randomized factor changed completion (all p ≥ 0.47).
- Where drop-outs stopped (fraud vs honest): during the profile 8 vs 5; on the home screen 11 vs 6 (all 11 fraud
  players had closed the VIP pop-up; nobody in either skin who stopped there made the S3 decision); later in the
  game 21 vs 12. The fraud curve also drops between "Cash out" and the sliders, where only the fraud skin has the
  tax block and the 7 feature cards.
- Note: the profile screens are not identical across skins (fraud has the neon look and the avatar picker), so
  "before the home screen" means before any money or game mechanic, not before any visual difference.
- ITT sample (everyone who reached `g:home`): honest 57, fraud 54 (50 non-completers added). The H1 and H2 reruns
  are stored as robustness tests; the comparison with the completer results is part of Step 4 and the report.
- Implementation notes: the first event per participant and round is used (one duplicated player). Reaching
  `g:home` = a `screen_view` on `g:home`, or `current_step` at or past `g:home`.

## Step 4 — Hypothesis tests (2026-11-09)

**Status:** done, run exactly as in `results/ANALYSIS_PLAN.md`. Modules `analysis/h1.py` … `h9.py`, verdict rules
in `analysis/verdicts.py`, fixed text per hypothesis in `analysis/spec.py`. Tables `results/tables/H*.csv`, one
figure per hypothesis in `results/figures/`, every test in `results/results.json`.

- No model failed to fit and no fallback was needed (`problems` in results.json is empty). All logistic models
  converged without separation warnings.
- Verdicts (raw p, pre-registered rules):
  - SUPPORTED: H1d.
  - NOT SUPPORTED: H1, H1a, H1b, H1c, H1e, H1f, H2–H8 (H8 app evidence only).
  - NOT TESTABLE: H1g (no comparison group).
  - DESCRIPTIVE: H1h.
  - EXPLORATORY: H9 (app part).
  - PENDING: H8 and H9 dataset parts.
- Things to know when reading the results:
  - H1 primary just misses (p = 0.102, δ = 0.26 in the predicted direction); 2 of 6 secondary outcomes are
    significant in the predicted direction (`verify_any`, `trap_score_shared8`), which is not "more than half", so
    the rule gives NOT SUPPORTED.
  - H4: the estimate points the opposite way (higher loss aversion → fewer top-ups, OR 0.51, p = 0.084). It is not
    marked low-power (largest group 67% < 70%).
  - H3: investing falls with stake size (secondary, p = 0.079), but the primary (details) is not lowest at ₹500.
  - H8: ceiling effect flagged (40 of 61 players score 3 of 3 on literacy).
  - The H1b primary (`trap_hook`) is the same variable as the H1 secondary `invested_r1` (`r1_amount > 0`), and the
    H1d primary is the same test as the H1 secondary `verify_any`. They are listed under both, as the plan
    specifies.
  - H3 card-position check: the position totals happen to be a permutation of the size totals for `details`, so
    the two Cochran's Q values coincide.
- Rule set before any dataset result exists: when the H8 dataset part is added, the final H8 verdict is the common
  verdict if both parts agree, NOT SUPPORTED if one part is NOT SUPPORTED and neither is SUPPORTED, otherwise
  PARTLY SUPPORTED (`verdicts.combine`).

## Step 4b — External dataset module (2026-11-09)

**Status:** built; skipped while the data is missing. H8 and H9 dataset parts are PENDING in results.json.

- `analysis/external.py` computes the dataset parts of H8 and H9. Every dataset-specific name is in
  `analysis/external_config.yaml` (TODO placeholders). `data/external/README.md` explains what to add.
- The module skips cleanly while `data/external/` has no data file or the config still has a TODO. The status, with
  the list of TODO fields, goes to `results.json → sections.external`.
- H8 model: logistic regression victim ~ literacy + overconfidence (z(self-rating) − z(literacy)) + age group +
  gender + income group + investing experience. Survey weights are used if configured (GLM binomial with
  normalized variance weights and HC1 SEs).
- H9 model: for age group, income group and gender, a joint Wald test of bias × group interactions, plus models
  within each group naming the strongest bias (z-scored overconfidence and, if available, risk attitude); Holm is
  applied over the three groupings.
- Verdict rules for the dataset parts were written in the module docstring before any dataset exists. The final
  H8 verdict combines both parts (`verdicts.combine`).
- Tested end to end on a **synthetic** file in the session scratchpad (weighted and unweighted, with and without a
  risk-attitude column). No synthetic data was written to `data/` or `results/`. The test exposed and fixed two
  figure issues: tick-label clutter on the log axis, and point offsets when there is a single bias.
- `pyyaml` was added to `analysis/requirements.txt` to read the config.

## Step 5 — Survey (2026-11-09)

**Status:** done. Module `analysis/survey.py`; tables `results/tables/survey_*.csv`; figures
`survey_tricks_seen.png`, `survey_what_stopped.png`, `survey_vs_app.png`; section `survey` in results.json.

- Cleaning follows C5, adapted to the real headers (matched by their "Q1." … "Q11." prefixes). The one
  non-consenting row was dropped, leaving 45 respondents (2026-11-02 to 2026-11-09).
- Deviation from the C5 recipe: its launch-date filter (`>= 2026-11-03`) would drop the 14 responses from
  2026-11-02, the day collection started (the app database was reset that day). The prompt asks to drop only the
  non-consenting row, so the filter uses 2026-11-02 and drops nothing.
- Branching checks pass (nobody answered Section B without Q1 = Yes or Q6–Q11 after Q5 = No). Nobody ticked "None"
  together with another trick.
- Results: approached 34 of 43 who answered yes or no (79%; the 2 "Not sure" are blank). Most-seen tricks: countdown
  timer, live withdrawal messages, very high returns, referral bonus. Main channel: social media ads (17 of 34); a
  friend/family referral only 1 of 34. Invested: 3 of 34 approached, reported as counts only.
- "What stopped you" was answered by 24 of 31 approached non-investors. Top reasons: too good to be true (13) and
  not interested (12); 7 checked and found it unregistered.
- The survey-vs-app figure pairs the 7 features both measure. The app timer card covers the countdown and the slots
  counter, so its survey counterpart is "timer OR slots".

## Step 6 — ANALYSIS_REPORT.md (2026-11-09)

**Status:** done. `analysis/report.py` (with `analysis/narrative.py`, the generated wording shared with the HTML page)
writes `results/ANALYSIS_REPORT.md`, `results/tables/scorecard.csv` and one `results/tables/tests_<H>.csv` per
hypothesis.

- All numbers come from results.json and the tables. Fixed text (claims, how each experiment tests its hypothesis,
  maths, what the data cannot justify) lives in `analysis/spec.py` and contains no result numbers. Sentences that
  depend on the data (directions, conclusion changes, ceiling flags) are built by conditions in code.
- Structure follows the prompt: (1) scorecard, (2) data and attrition with the funnel figure and the bias
  discussion, (3) one section per hypothesis (claim, how, maths, result with table and figure, verdict and what the
  data does NOT justify, robustness), (4) survey, (5) held / did not hold, (6) limitations.
- ITT definition used in the report: the conclusion "changes" only if significance changes, or if both results are
  significant but in opposite directions. Two non-significant results count as the same conclusion. Result:
  only the H1 round-1 stake changes (completers p = 0.090 → ITT p = 0.037, fraud higher).

## Step 7 — results/index.html (2026-11-09)

**Status:** done. `analysis/build_html.py` generates `results/index.html` from results.json, the tables and the
figures; `run_all.py` rebuilds it every run.

- One self-contained file (~2.4 MB): CSS and JS inline, all figures embedded as base64 PNG, no external requests.
  Opens offline by double-clicking.
- Dark theme matching the app; sticky navigation (Scorecard, Attrition, H1–H9, H1 parts, Survey, Limitations); a
  scorecard card per hypothesis with a coloured verdict badge (click jumps to the section); per-hypothesis sections
  mirroring the report; "Present mode" shows one section at a time (← → to move, Esc to exit).
- No participant IDs or raw rows in the page (checked automatically).
- Checked in headless Edge at 1366×768 and 1920×1080 with `npm run check:results`
  (`scripts/check-results-html.mjs`): no horizontal scroll, no element outside the viewport, all 23 figures loaded,
  no clipped cards, no overlapping cards, no external requests, present mode works. Fixed after the first
  screenshots: table cells broke words mid-word (now wrap only between words, and numeric columns never wrap); the
  present mode did not jump to the top of the next section (smooth scrolling); the nav highlight was stale in
  present mode.
- `analysis/verify_outputs.py` runs last in `run_all.py`. It checks that every figure and table exists, that the
  report and the page show the same verdicts and primary results as results.json, that no participant ID appears in
  any output, and that the page has no external resources.
- Housekeeping: `eslint.config.js` reformatted with prettier; the Step 1 commit had left it unformatted (the npm
  notices hid the prettier warning).

## Final check — clean rebuild (2026-11-09)

- All generated outputs and Python caches were deleted, then `analysis/.venv/Scripts/python analysis/run_all.py` was
  run once (≈10 s). It rebuilt results.json, ANALYSIS_REPORT.md, index.html, 20 figures and 47 tables, and the
  output check passed. Compared with the committed outputs, only the "generated at" timestamp changed: the figures
  and tables are byte-identical, so the pipeline is reproducible.
- The files in `data/` were only read (modification times unchanged).

**Scorecard (pre-registered rules, raw p):** SUPPORTED: H1d (fraud players verified far less). NOT SUPPORTED: H1
(p = 0.102, predicted direction), H1a, H1b, H1c, H1e, H1f, H2, H3, H4 (opposite direction, p = 0.084), H5, H6, H7,
H8 (app evidence only). NOT TESTABLE: H1g. DESCRIPTIVE: H1h. EXPLORATORY: H9 (app). PENDING: H8 and H9 dataset
parts. Read every skin result with the differential attrition in mind (fraud 35% vs honest 63% completed).

---

## Final 1 — results page: blank-page fix (2026-11-09)

**Status:** done. `analysis/build_html.py` and `scripts/check-results-html.mjs` changed.

**Cause investigation.** The previously committed `results/index.html` was opened from disk (file://) in
Playwright Chromium, Firefox and WebKit (and Edge earlier), with JavaScript on and off. In every case all 23 sections
and 23 figures rendered, the console showed no errors, and no section was hidden by CSS (the only hiding rule applied
after the script added a `present` class). The HTML validated (balanced tags, no stray markup, UTF-8 with
`<meta charset="utf-8">` in the first bytes). The blank page could therefore not be reproduced in any standard
browser engine. Likely causes, none of which the old page guarded against:
- the file was opened in a viewer that is not a modern browser: the Windows Explorer preview pane or an embedded
  editor preview. These use older engines that ignore CSS variables, and the whole old colour scheme was built on
  CSS variables. Some of them also block scripts or `data:` images;
- a copy that is not the generated file, for example GitHub's page saved with "Save link as", or the GitHub file
  view, which does not render a 2.4 MB HTML file;
- the very large embedded images (2.4 MB page) loading slowly from a synced or network folder.

**Fix (progressive enhancement).**
- All content (scorecard, sections, figures, tables) is in the HTML and visible without JavaScript. No CSS rule
  hides a section; only the script hides sections in present mode, by setting styles after it has loaded.
- The present-mode button and the keyboard hint are created by the script, so nothing dead appears without it.
- All JavaScript is plain ES2017 (no modules, no top-level await, no external scripts) inside try/catch. Any error
  calls `revealAll()`, which shows every section again.
- Colours are written into the CSS as plain values at build time (no CSS variables), so older viewers still get the
  dark theme.
- The page is UTF-8 with `<meta charset="utf-8">`; ₹ renders in every engine (checked).
- Embedded PNGs are downscaled to at most 1,500 px wide and saved as 128-colour palette PNGs: the page went from
  2.46 MB to **1.10 MB**.

**Test.** `npm run check:results` opens the file via file:// in Chromium, Firefox and WebKit, with JavaScript
enabled and disabled, at 1366×768 and 1920×1080 (12 runs). Result: 23/23 sections and 23/23 figures visible in
every run, no errors, no external requests, no horizontal scroll, no clipped or overlapping cards. Present mode
works (with JavaScript) and Esc restores every section. Screenshots were checked by eye. The Firefox and WebKit
engines were installed once with `npx playwright-core install firefox webkit`.

## Final 2 — External datasets: NFCS 2024 for H8 and H9 (2026-11-09)

**Status:** done. `analysis/external_config.yaml` filled; `analysis/external.py` rewritten for the two NFCS surveys;
the report, the page and `verify_outputs.py` now show and check the dataset parts.

**Data handling.** The raw files are in `data/external/nfcs2024_state/` (39 MB) and `data/external/nfcs2024_investor/`
(3.6 MB). `data/external/*/` is git-ignored (the line was already in `.gitignore`, now committed); only
`data/external/README.md` is tracked.

**Codebook check (State-by-State), from the Stata value labels, the questionnaire and the data-file-info PDF.**
- J65 = "targeted in a financial fraud or scam in the past year" (1 yes, 2 no, 98 don't know → missing,
  99 → missing). It is **any** financial fraud, not investment fraud.
- J66 = lost money; asked only if J65 = 1. lost = 0 if not targeted; don't know → missing.
- M6 correct = 1 ("More than $102"); M7 correct = 3 ("Less than today"); M10 correct = 2 ("False"). Don't know (98)
  = wrong, prefer not to say (99) = missing.
- M4 = "overall financial knowledge" 1–7. M20 has three answers (offered and participated / offered but did not
  participate / not offered), coded 1 = participated.
- A3Ar_w labels confirmed (18-24 … 65+). A8_2021 has 10 bands, collapsed to <$50K / $50K-$100K / $100K+. A50A:
  male / female (nonbinary randomly assigned by FINRA). J2 = risk willingness 1–10. wgt_n2 = national weight.
- **Mismatch:** `B14A` does not exist in the 2024 file. It is a grid: `B14A_1` = stocks, bonds, mutual funds
  (used as "owns investments") and `B14A_60` = crypto (not used).

**Codebook check (Investor Survey).**
- D41 = targeted in an **investment** fraud (127 yes); D42 = lost money (56 yes, asked if D41 = 1).
- G2 = self-rated investing knowledge 1–7. G43 = "guaranteed, risk-free 25% annual return every year for 5 years:
  would you invest?" (1,249 yes / 616 no / 989 don't know = "not sure"). C7 = ever checked a regulator about a
  financial professional. F40 = decisions based on a social media personality (finfluencer: frequently or sometimes
  = 1). WGT1 = weight (age × education). S_Age, S_Gender2, S_Income = demographics from the State file (3 bands).
- **Mismatch:** the public file has **12** quiz items, not 11. The classic 11 (G4, G5, G6, G7, G21, G8, G22, G11,
  G12, G13, G23) are scored 0–11. G44 (inflation, numbered with the other new 2024 G4x items) is left out and
  recorded in the config. The codebook has no answer key; the standard correct answers are listed per item in the
  config.
- **Link:** NFCSID links the Investor Survey to the State-by-State file (2,839 of 2,861 matched). The Big Three
  robustness check uses the linked answers.
- All requested items exist, so no model was skipped.

**Decisions fixed before fitting (recorded in the config).** H8 dataset primary = Investor Survey, targeted by
investment fraud (the only investment-fraud outcome with enough cases; "lost money" has 56 cases and is flagged low
power). H9 primary = State-by-State, lost money (all respondents). G43 robustness = "yes or not sure" vs "no". The
regulator model predicts overconfidence OR < 1 (less checking).

**Estimation.** Survey-weighted logistic regression: GLM binomial with the weight normalized to mean 1 as variance
weights and HC1 robust SEs. Literacy / quiz, self-rating and overconfidence are z-scored; overconfidence =
z(self) − z(literacy), entered as z(OC). The State models also refit with z(lit) + z(self): the maximum coefficient
difference after converting with a·z(lit) + b·(z(self) − z(lit)) = (a − b)·z(lit) + b·z(self) is about 1e-16.

**Results.**
- **Replication:** all six State-by-State odds ratios match the teammate's report within 0.01 (literacy 0.88 / 0.71 /
  0.65, overconfidence 0.92 / 0.89 / 0.87 vs 0.92 / 0.90 / 0.88). Every teammate value lies inside our 95% CI.
- **H8 primary (Investor, targeted):** overconfidence OR 2.22 [1.61, 3.06], p < 0.001; knowledge OR 1.38
  [0.99, 1.92]. Dataset part SUPPORTED by the pre-registered rule. Combined with the app (NOT SUPPORTED), H8 is
  **PARTLY SUPPORTED**.
- **The other models disagree, and the report and page say so explicitly.**
  - State-by-State: literacy protects strongly (ORs 0.65–0.88), and overconfidence is slightly protective
    (0.87–0.92).
  - Investor, Big Three (linked): overconfidence 1.13 (n.s.), literacy 0.70 (protective).
  - Guaranteed-25% offer: knowledge protects (0.71), overconfidence null.
  - Overconfident investors check regulators *more* (2.41).
  - Reasons listed: general vs investment fraud, real vs simulated money, US adults vs Indian students, the app's
    literacy ceiling (66% vs 31% at 3/3), self-reported "targeted" may measure noticing, different knowledge
    measures.
- **H9 (State, lost money):** the joint interaction test is significant for age (p = 0.005, Holm 0.015): risk
  willingness is the strongest bias under 55, overconfidence from 55. Gender p = 0.145 and income p = 0.702.
  Verdict by the pre-registered rule: **SUPPORTED** (within-group models labelled exploratory).
- Figures: `external_H8.png` (app coefficients + all NFCS odds ratios), `external_H9.png` (literacy and
  overconfidence ORs by group).

**Fixes along the way.** PyYAML reads the keys `yes:` / `no:` as booleans, so the config uses `yes_codes` /
`no_codes`. Matplotlib turned "$50K-$100K" into math text, so maths parsing is now off for all figures. `pypdf` was
installed in the venv only to read the codebook PDFs (not a pipeline requirement).

## Final 3 — Final check, instructor's questions, key takeaways (2026-11-09)

**Status:** done.

- **Instructor's two questions.** Every hypothesis section in the report and on the page now has the headings "How
  does our experiment test this?" and "What did we claim that the results do not justify?". The second opens with
  one generated plain sentence set by the verdict. If a NOT SUPPORTED hypothesis still has significant secondary
  outcomes, the sentence names the parts that held (for H1: verification and trap score). For H9 it names the
  grouping the US data backs.
- **Key takeaways** (7 generated bullets) at the top of `ANALYSIS_REPORT.md` and as the second section of
  `index.html` (after the header, before the scorecard; "Takeaways" added to the navigation). Every number comes
  from results.json; phrases that depend on the data are conditions in code.
- **Agreement check strengthened** (`analysis/verify_outputs.py`). Every test row (effect, 95% CI, p) shown in the
  report must also appear in the page (83 rows), together with every verdict, every primary result, both question
  headings in every hypothesis section, and the Key takeaways. Holm p is never below raw p. No participant IDs in
  any output.
- **Clean rebuild:** all generated outputs and caches deleted, then `run_all.py` (≈17 s with the NFCS data): 22
  figures, 52 tables, report and page; the output check passed.
- **Page:** `npm run check:results` passes in Chromium, Firefox and WebKit, with and without JavaScript, at
  1366×768 and 1920×1080 (24 sections, 25 figures visible in every run, no errors). Size 1.26 MB.

**Final scorecard (pre-registered rules, raw p):** SUPPORTED: H1d, H9 (US dataset; age only). PARTLY SUPPORTED: H8
(app NOT SUPPORTED + Investor Survey SUPPORTED; State-by-State points the other way). NOT SUPPORTED: H1, H1a, H1b,
H1c, H1e, H1f, H2, H3, H4, H5, H6, H7. NOT TESTABLE: H1g. DESCRIPTIVE: H1h.
