"""Final step of run_all.py: check that every output exists and agrees with results.json, and that no participant
data leaks into the outputs. Raises SystemExit with a list of problems if anything is off."""

from __future__ import annotations

import glob
import html
import os
import re

from common import FIGURES, RESULTS, TABLES, read_csv
from narrative import R, dataset_ids, headline, ids_for, load, test_rows
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
        if r.s.get("external", {}).get(hid, {}).get("status") == "done":
            for f in sp.get("dataset_figures", []):
                if not os.path.exists(os.path.join(FIGURES, f + ".png")):
                    problems.append(f"missing dataset figure {f}.png ({hid})")
            if hid == "H8" and not os.path.exists(os.path.join(TABLES, "external_replication.csv")):
                problems.append("missing table external_replication.csv")
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

    # 2a. every test row (effect, CI, p) shown in the report also appears in the page, and matches results.json
    n_rows = 0
    for hid in SPEC:
        ids = ids_for(r, hid) + (dataset_ids(r, hid) if hid != "H9" else [])
        for row in test_rows(r, ids):
            n_rows += 1
            for key in ("Effect [95% CI]", "p"):
                val = row[key]
                if val in ("–", "pending"):
                    continue
                for name, text in (("report", report), ("index.html", page_text)):
                    if val not in text:
                        problems.append(f"{name}: {hid} {row['Outcome']} {key} '{val}' not found")
    for t in r.d["tests"]:
        if t.get("p_holm") is not None and t.get("p") is not None and t["p_holm"] + 1e-12 < t["p"]:
            problems.append(f"results.json: Holm p smaller than raw p for {t['id']}")

    # 2b. every hypothesis section answers the instructor's two questions; key takeaways present
    for name, text in (("report", report), ("index.html", page_text)):
        if "Key takeaways" not in text:
            problems.append(f"{name}: Key takeaways section missing")
        for hid in SPEC:
            tag = f"{hid} — {SPEC[hid]['title']}"
            sec = text.split(tag, 1)[-1]
            nxt = min([i for i in (sec.find(" — ", 1),) if i > 0] or [len(sec)])
            for q in ("How does our experiment test this?", "What did we claim that the results do not justify?"):
                if q not in sec[:max(nxt, 20000)]:
                    problems.append(f"{name}: '{q}' missing in {hid}")

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

    out = {"rows_checked": n_rows, "figures": len(glob.glob(os.path.join(FIGURES, "*.png"))),
           "tables": len(glob.glob(os.path.join(TABLES, "*.csv"))), "problems": problems}
    if problems:
        raise SystemExit("Output check failed:\n- " + "\n- ".join(problems))
    return out
