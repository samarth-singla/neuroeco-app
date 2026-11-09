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
