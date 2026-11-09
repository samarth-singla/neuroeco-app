"""H2: an early small win (round 1, randomized) increases the next stake."""

from __future__ import annotations

import matplotlib.pyplot as plt
import pandas as pd

from common import C1, C2, Registry, _clean, mwu_test, savefig, strip_box

KW = dict(group_col="round1_outcome", a="small_win", b="flat", label_a="small win", label_b="flat")


def run(reg: Registry, df: pd.DataFrame) -> None:
    played = df[df["r1_amount"] > 0]
    excluded = len(df) - len(played)
    reg.sections["H2"] = {"excluded_r1_zero": int(excluded),
                          "excluded_by_condition": {c: int(((df["r1_amount"] == 0) & (df["round1_outcome"] == c)).sum())
                                                    for c in ("small_win", "flat")}}
    mwu_test(reg, id="H2.primary", hypothesis="H2", role="primary", outcome="escalation_ratio", df=played,
             prediction="small win > flat", predicted="greater", holm_family="H2-H7", **KW,
             note=f"Only players with r1_amount > 0; {excluded} excluded (round 1 skipped).")
    mwu_test(reg, id="H2.sec.r2_amount", hypothesis="H2", role="secondary", outcome="r2_amount", df=df,
             prediction="small win > flat", predicted="greater", **KW)

    sw, fl = df[df["round1_outcome"] == "small_win"], df[df["round1_outcome"] == "flat"]
    psw, pfl = played[played["round1_outcome"] == "small_win"], played[played["round1_outcome"] == "flat"]
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.6))
    strip_box(ax1, [("Flat round 1", _clean(pfl["escalation_ratio"]), C1),
                    ("Small win (+8%)", _clean(psw["escalation_ratio"]), C2)],
              "Escalation ratio = round-2 stake ÷ round-1 stake", "Primary: escalation (round 1 played)")
    ax1.axhline(1, color="#c3c2b7", lw=1)
    strip_box(ax2, [("Flat round 1", _clean(fl["r2_amount"]), C1), ("Small win (+8%)", _clean(sw["r2_amount"]), C2)],
              "Round-2 stake (₹)", "Secondary: round-2 stake (all completers)")
    savefig(fig, "H2")
