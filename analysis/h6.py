"""H6: a small successful test withdrawal builds trust and raises the next deposit (ITT on the offer)."""

from __future__ import annotations

import matplotlib.pyplot as plt
import pandas as pd

from common import C1, C2, Registry, _clean, mwu_test, savefig, share_record, strip_box

KW = dict(group_col="withdrawal_offer", a="allowed", b="not_offered", label_a="allowed", label_b="not offered")


def run(reg: Registry, df: pd.DataFrame) -> None:
    mwu_test(reg, id="H6.primary", hypothesis="H6", role="primary", outcome="post_withdrawal_deposit", df=df,
             prediction="allowed > not offered", predicted="greater", holm_family="H2-H7", **KW,
             note="Intention-to-treat on the offer: everyone offered counts as 'allowed', whether or not they withdrew.")
    mwu_test(reg, id="H6.sec.app_trust", hypothesis="H6", role="secondary", outcome="app_trust", df=df,
             prediction="allowed > not offered", predicted="greater", **KW)
    al = df[df["withdrawal_offer"] == "allowed"]
    share_record(reg, id="H6.sec.withdrew", hypothesis="H6", role="descriptive", outcome="withdrew",
                 series=al["withdrew"], prediction="take-up of the ₹500 test withdrawal among those offered")

    no = df[df["withdrawal_offer"] == "not_offered"]
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.6))
    strip_box(ax1, [("Not offered", _clean(no["post_withdrawal_deposit"]), C1),
                    ("Allowed", _clean(al["post_withdrawal_deposit"]), C2)],
              "Deposit after the withdrawal stage (₹, 0–5,000)", "Primary: deposit after the test withdrawal")
    strip_box(ax2, [("Not offered", _clean(no["app_trust"]), C1), ("Allowed", _clean(al["app_trust"]), C2)],
              "Trust rating (1–7)", "Secondary: trust in the app")
    ax2.set_ylim(0.5, 7.5)
    savefig(fig, "H6")
