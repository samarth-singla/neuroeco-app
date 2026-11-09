# External dataset (H8 and H9, dataset parts)

This folder holds the public population survey used for the dataset parts of H8 and H9
(`DATA_COLLECTION_REPORT.md`, Part D). It is empty until the dataset is chosen; until then H8 and H9 dataset parts
show as **PENDING** in `results/results.json`, `results/ANALYSIS_REPORT.md` and `results/index.html`.

Only this README is tracked by git. The data file itself stays local (it is git-ignored).

## What to add

1. **One individual-level data file** (one row per respondent), as `.csv` or Stata `.dta`. Convert other formats
   (SPSS, Excel) to CSV first. It must contain:
   - investment-fraud victimization (yes/no) — the outcome;
   - financial literacy questions (ideally the Big Three: compound interest, inflation, diversification);
   - self-rated financial knowledge;
   - age, income and gender;
   - investing experience (control);
   - optional: a risk-attitude question (extra H9 bias proxy) and survey weights.
2. **Fill `analysis/external_config.yaml`** — replace every `TODO`:

   | Section | What to enter |
   | --- | --- |
   | `dataset` | name, source (URL or citation), file name in this folder, format (`csv` / `stata`), country |
   | `missing_values` | codes meaning don't know / refused / missing (e.g. `[98, 99]`) |
   | `victimization` | column, the codes meaning "victim" (`yes_values`) and "not a victim" (`no_values`) |
   | `literacy.items` | three columns and the correct answer code for each |
   | `self_rated_knowledge` | column; `reverse: true` if a lower code means more confident |
   | `age_group`, `income_group` | column and a `labels` map from codes to group names |
   | `gender` | column and the code(s) meaning male |
   | `investing_experience` | column and an optional `labels` map to numbers |
   | `risk_attitude` | column (higher = more risk-seeking; `reverse: true` otherwise) or `column: null` |
   | `weights` | survey weight column, or `column: null` |

3. **Run** `analysis/.venv/Scripts/python analysis/run_all.py`. No code changes are needed: the dataset parts of H8
   and H9 are computed, their verdicts are combined with the app parts, and the report and results page are rebuilt.

## Checks before running

- Open the codebook and confirm the victimization question is about **investment** fraud (the plan mentions the
  NFCS 2024; confirm it has such a question first).
- If the dataset is not from India, say so in `dataset.country`; the report treats it as a comparison population.
- Never edit the downloaded data by hand; recode only through the config.
