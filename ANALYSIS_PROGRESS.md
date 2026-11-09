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
