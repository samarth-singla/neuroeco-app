"""Final step of run_all.py: check that every output exists and agrees with results.json, and that no participant
data leaks into the outputs. Raises SystemExit with a list of problems if anything is off."""

from __future__ import annotations

import glob
import html
import os
import re

from common import FIGURES, RESULTS, TABLES, read_csv
from narrative import R, headline, load
from spec import SPEC

UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)


def run() -> dict:
    r = R(load())
    problems = []
    report = open(os.path.join(RESULTS, "ANALYSIS_REPORT.md"), encoding="utf-8").read()
    page = open(os.path.join(RESULTS, "index.html"), encoding="utf-8").read()
    page_text = html.unescape(re.sub(r"<[^>]+>", "", re.sub(r'src="data:[^"]+"', "", page)))

    # 1. every figure and table named in the spec exists
    for hid, sp in SPEC.items():
        for f in sp["figures"]:
            if not os.path.exists(os.path.join(FIGURES, f + ".png")):
                problems.append(f"missing figure {f}.png ({hid})")
        for t in sp.get("tables", []):
            if not os.path.exists(os.path.join(TABLES, t + ".csv")):
                problems.append(f"missing table {t}.csv ({hid})")
        if not os.path.exists(os.path.join(TABLES, f"tests_{hid}.csv")):
            problems.append(f"missing table tests_{hid}.csv")
    for f in ("attrition_funnel", "survey_tricks_seen", "survey_what_stopped", "survey_vs_app"):
        if not os.path.exists(os.path.join(FIGURES, f + ".png")):
            problems.append(f"missing figure {f}.png")

    # 2. report and page show the same verdicts and primary numbers as results.json
    for hid, h in r.hyps.items():
        tag = f"{hid} — {SPEC[hid]['title']}"
        for name, text in (("report", report), ("index.html", page_text)):
            if tag not in text:
                problems.append(f"{name}: section for {hid} missing")
            sec = text.split(tag, 1)[-1][:6000]
            if h["verdict"] not in sec:
                problems.append(f"{name}: verdict {h['verdict']} for {hid} not shown in its section")
            p = r.t(SPEC[hid]["primary"]) if SPEC[hid].get("primary") else None
            if p is not None and p.get("p") is not None and headline(p) not in text:
                problems.append(f"{name}: primary result of {hid} ({headline(p)}) not found")

    # 3. no participant identifiers or raw rows in any output
    ids = set(read_csv("participants.csv")["participant_id"].astype(str))
    for path in glob.glob(os.path.join(RESULTS, "**", "*"), recursive=True):
        if os.path.isdir(path) or path.endswith(".png"):
            continue
        txt = open(path, encoding="utf-8", errors="ignore").read()
        if any(m.group(0) in ids for m in UUID.finditer(txt)):
            problems.append(f"participant id found in {os.path.relpath(path, RESULTS)}")

    # 4. the page is self-contained
    if re.search(r'(src|href)="(https?:)?//', page):
        problems.append("index.html references an external resource")

    out = {"figures": len(glob.glob(os.path.join(FIGURES, "*.png"))),
           "tables": len(glob.glob(os.path.join(TABLES, "*.csv"))), "problems": problems}
    if problems:
        raise SystemExit("Output check failed:\n- " + "\n- ".join(problems))
    return out
