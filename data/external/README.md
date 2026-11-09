# External datasets (H8 and H9, dataset parts)

This folder holds the public surveys used for the dataset parts of H8 and H9 (`DATA_COLLECTION_REPORT.md`, Part D).
Only this README is tracked by git: the data folders are git-ignored (`data/external/*/`) because the raw files are
large (about 39 MB for the State-by-State files) and are redistributed by FINRA, not by us.

## What is here (added 2026-11-09)

| Folder | Dataset | Used for |
| --- | --- | --- |
| `nfcs2024_state/` | NFCS 2024 State-by-State Survey (data .csv/.dta/.sav, questionnaire, data file info, methodology) | H8 large-sample check (any financial fraud), H9 main test |
| `nfcs2024_investor/2024-Inv-Data-and-Data-Info/` | NFCS 2024 Investor Survey (data .csv/.dta/.sav, data file info) | H8 main test (investment fraud) |

Source: FINRA Investor Education Foundation, National Financial Capability Study (finrafoundation.org). US data:
the report treats it as a comparison population, not a description of Indian investors.

## How it is used

Every variable name and answer code is in `analysis/external_config.yaml` (checked against the codebooks; see
`ANALYSIS_PROGRESS.md`, "Final 2"). `analysis/external.py` reads the Stata (.dta) files and fits survey-weighted
logistic regressions. Running `analysis/.venv/Scripts/python analysis/run_all.py` rebuilds everything.

If a data file is missing (for example on a fresh clone), the module skips cleanly and the H8 and H9 dataset parts
show as PENDING. To restore them, download the 2024 State-by-State and Investor data from the FINRA Foundation and
place them at the paths given in `analysis/external_config.yaml`.

Never edit the downloaded data by hand; recode only through the config.
