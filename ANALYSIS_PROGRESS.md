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
