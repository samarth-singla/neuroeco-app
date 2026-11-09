"""H7: app profits are treated as house money (Gold Plan funded from Profit vs Main wallet)."""

from __future__ import annotations

import matplotlib.pyplot as plt
import pandas as pd

from common import C1, C2, Registry, _clean, fisher_test, mwu_test, savefig, share_bars, strip_box

KW = dict(group_col="reinvest_framing", a="profit", b="main", label_a="profit wallet", label_b="main wallet")


def run(reg: Registry, df: pd.DataFrame) -> None:
    mwu_test(reg, id="H7.primary", hypothesis="H7", role="primary", outcome="reinvest_amount", df=df,
             prediction="profit > main", predicted="greater", holm_family="H2-H7", **KW)
    fisher_test(reg, id="H7.sec.reinvest_accept", hypothesis="H7", role="secondary", outcome="reinvest_accept",
                df=df, prediction="profit > main", predicted="greater", **KW)

    pr, mn = df[df["reinvest_framing"] == "profit"], df[df["reinvest_framing"] == "main"]
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.6))
    strip_box(ax1, [("Main wallet", _clean(mn["reinvest_amount"]), C1), ("Profit wallet", _clean(pr["reinvest_amount"]), C2)],
              "Gold Plan amount (₹, 0–2,000)", "Primary: amount reinvested")
    share_bars(ax2, [("Main wallet", int(mn["reinvest_accept"].sum()), len(mn), C1),
                     ("Profit wallet", int(pr["reinvest_accept"].sum()), len(pr), C2)], "Accepted (amount > 0)",
               "Secondary: accepted the offer")
    savefig(fig, "H7")
