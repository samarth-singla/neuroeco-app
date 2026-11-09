"""Regenerates every result from the raw files in data/ in one command:

    analysis/.venv/Scripts/python analysis/run_all.py

Order: data checks -> attrition -> hypothesis tests -> external dataset (H8/H9, pending until added) -> survey ->
verdicts and Holm -> results.json -> ANALYSIS_REPORT.md -> index.html.
"""

from __future__ import annotations

import os
import shutil
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import attrition  # noqa: E402
import checks  # noqa: E402
import h1, h2, h3, h4, h5, h6, h7, h8, h9  # noqa: E401,E402
import verdicts  # noqa: E402
from common import FIGURES, RESULTS, TABLES, Registry, ensure_dirs, prepare_wide, read_csv, style  # noqa: E402


def clean_outputs() -> None:
    """Start from a clean state: generated tables and figures are rebuilt every run."""
    for d in (TABLES, FIGURES):
        if os.path.isdir(d):
            shutil.rmtree(d)
    for f in ("results.json", "ANALYSIS_REPORT.md", "index.html"):
        p = os.path.join(RESULTS, f)
        if os.path.exists(p):
            os.remove(p)


def meta(df) -> dict:
    parts = read_csv("participants.csv")
    parts = parts[parts["is_pilot"] == 0]
    return {
        "title": "Behavioral Mechanics of App-Based Investment Frauds",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "consented": int(len(parts)),
        "consented_by_skin": {"honest": int((parts["app_version"] == "plain").sum()),
                              "fraud": int((parts["app_version"] == "fraud").sum())},
        "completed": int(len(df)),
        "completed_by_skin": {"honest": int((df["skin"] == "honest").sum()),
                              "fraud": int((df["skin"] == "fraud").sum())},
        "collection_start": str(parts["created_at"].min())[:10],
        "collection_end": str(parts["created_at"].max())[:10],
        "alpha": 0.05,
        "bootstrap": {"resamples": 2000, "seed": 42},
    }


def main() -> None:
    clean_outputs()
    ensure_dirs()
    style()
    reg = Registry()
    df = prepare_wide()

    checks.run(reg, df)
    attrition.run(reg, df)
    for mod in (h1, h2, h3, h4, h5, h6, h7, h8, h9):
        mod.run(reg, df)
    external_status = {"H8": {"status": "pending"}, "H9": {"status": "pending"}}
    reg.sections["external"] = external_status
    verdicts.apply_holm(reg)
    verdicts.apply_verdicts(reg, external_status)

    reg.save(os.path.join(RESULTS, "results.json"), meta(df))
    print("done:", os.path.join(RESULTS, "results.json"))


if __name__ == "__main__":
    main()
