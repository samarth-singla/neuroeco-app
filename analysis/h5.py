"""H5: a friend's referral (vs an ad) raises joining the Diamond Pool and lowers checking."""

from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from h4 import fit_logit
from common import (BG, C1, C2, INK, Registry, _clean, fisher_test, mwu_test, save_table, savefig, strip_box,
                    wilson)

KW = dict(group_col="pool_source", a="friend", b="ad")


def run(reg: Registry, df: pd.DataFrame) -> None:
    fisher_test(reg, id="H5.primary", hypothesis="H5", role="primary", outcome="pool_join", df=df,
                prediction="friend > ad", predicted="greater", holm_family="H2-H7", **KW)
    fisher_test(reg, id="H5.sec.pool_details", hypothesis="H5", role="secondary", outcome="pool_details", df=df,
                prediction="friend < ad", predicted="less", **KW)
    mwu_test(reg, id="H5.sec.pool_time", hypothesis="H5", role="secondary", outcome="pool_time", df=df,
             prediction="friend < ad", predicted="less", **KW)

    # Moderator (exploratory): logistic pool_join ~ friend * fomo_score
    d = df[["pool_join", "pool_source", "fomo_score"]].dropna().assign(
        friend=lambda x: (x["pool_source"] == "friend").astype(int))
    try:
        m = fit_logit("pool_join ~ friend * fomo_score", d)
        ci = m.conf_int()
        save_table(pd.DataFrame({"term": m.params.index, "coef": m.params.values, "odds_ratio": np.exp(m.params.values),
                                 "or_ci_low": np.exp(ci[0].values), "or_ci_high": np.exp(ci[1].values),
                                 "p": m.pvalues.values}), "H5_moderator_logit")
        t = "friend:fomo_score"
        reg.add_test(id="H5.mod.friend_x_fomo", hypothesis="H5", role="exploratory", outcome="pool_join",
                     prediction="friend effect larger for higher FOMO (interaction OR > 1)",
                     test="Logistic regression: pool_join ~ friend × fomo_score", statistic_name="z",
                     statistic=float(m.tvalues[t]), p=float(m.pvalues[t]), effect_name="Interaction odds ratio",
                     effect=float(np.exp(m.params[t])), ci_low=float(np.exp(ci.loc[t, 0])),
                     ci_high=float(np.exp(ci.loc[t, 1])), n={"players": int(m.nobs)},
                     direction_ok=bool(m.params[t] > 0))
    except Exception as e:  # noqa: BLE001
        reg.problem(f"H5 moderator logistic model not fitted ({e}); exploratory, no fallback.")
        reg.add_test(id="H5.mod.friend_x_fomo", hypothesis="H5", role="exploratory", outcome="pool_join",
                     prediction="friend effect larger for higher FOMO", test="Logistic regression (not fitted)",
                     testable=False, note=str(e), n={"players": len(d)})

    fr, ad = df[df["pool_source"] == "friend"], df[df["pool_source"] == "ad"]
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.6))
    x = np.arange(2)
    for off, (lab, g, c) in zip((-0.2, 0.2), (("Ad", ad, C1), ("Friend", fr, C2))):
        for xi, col in zip(x, ("pool_join", "pool_details")):
            k, n = int(g[col].sum()), len(g)
            p = k / n
            lo, hi = wilson(k, n)
            ax1.bar(xi + off, p, width=0.38, color=c, label=f"{lab} (n = {n})" if xi == 0 else None)
            ax1.errorbar(xi + off, p, yerr=[[p - lo], [hi - p]], color=INK, capsize=4, lw=1.3)
            ax1.text(xi + off, hi + 0.03, f"{k}/{n}", ha="center", color=INK, fontsize=10)
    ax1.set_xticks(x)
    ax1.set_xticklabels(["Joined the pool\n(primary)", "Opened pool details\nbefore deciding"])
    ax1.set_ylim(0, 1.12)
    ax1.yaxis.set_major_formatter(plt.matplotlib.ticker.PercentFormatter(1.0))
    ax1.set_ylabel("Share of players")
    ax1.legend(loc="upper right")
    ax1.set_title("Pool invite: friend vs ad", loc="left")
    ax1.grid(axis="x", visible=False)
    strip_box(ax2, [("Ad", _clean(ad["pool_time"]), C1), ("Friend", _clean(fr["pool_time"]), C2)],
              "Seconds to decide", "Decision time on the pool screen")
    savefig(fig, "H5")


__all__ = ["run", "BG"]
