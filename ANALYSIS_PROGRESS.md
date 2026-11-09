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
