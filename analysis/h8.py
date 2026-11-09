"""H8 (app part): literacy does not protect, overconfidence increases susceptibility (trap_score_shared8).
The dataset part is in external.py."""

from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

from common import BG, C1, C2, INK, INK2, Registry, save_table, savefig

TERMS = {"literacy_score": "Literacy score (0–3)", "overconfidence": "Overconfidence (z self − z literacy)",
         "exp_fin_edu_num": "Prior finance course (yes)", "fraud": "Fraud skin", "exp_investing_num":
         "Investing experience (0–2)"}


def run(reg: Registry, df: pd.DataFrame) -> None:
    dist = df["literacy_score"].value_counts().reindex([0, 1, 2, 3]).fillna(0).astype(int)
    n = int(dist.sum())
    ceiling = bool(dist[3] / n > 0.5)
    reg.sections["H8"] = {"literacy_distribution": {str(k): int(v) for k, v in dist.items()},
                          "ceiling_effect": ceiling, "share_at_3": float(dist[3] / n),
                          "self_rating_distribution": {str(k): int(v) for k, v in
                                                       df["self_rated_literacy"].value_counts().sort_index().items()}}
    save_table(pd.DataFrame({"literacy_score": dist.index, "players": dist.values, "share": dist.values / n}),
               "H8_literacy_distribution")

    d = df[["trap_score_shared8", "literacy_score", "overconfidence", "exp_fin_edu_num", "fraud",
            "exp_investing_num"]].dropna()
    m = smf.ols("trap_score_shared8 ~ literacy_score + overconfidence + exp_fin_edu_num + fraud + exp_investing_num",
                data=d).fit(cov_type="HC3")
    ci = m.conf_int()
    coefs = pd.DataFrame({"term": m.params.index, "coef": m.params.values, "se_hc3": m.bse.values,
                          "ci_low": ci[0].values, "ci_high": ci[1].values, "p": m.pvalues.values})
    save_table(coefs, "H8_ols")
    b_oc, b_lit = float(m.params["overconfidence"]), float(m.params["literacy_score"])
    lit_lo, lit_hi = float(ci.loc["literacy_score", 0]), float(ci.loc["literacy_score", 1])
    common = dict(hypothesis="H8", outcome="trap_score_shared8", n={"players": int(m.nobs)},
                  test="OLS with HC3 SEs: trap_score_shared8 ~ literacy + overconfidence + fin. education + fraud + "
                       "investing experience")
    reg.add_test(id="H8.primary", role="primary", prediction="overconfidence coefficient > 0", statistic_name="t",
                 statistic=float(m.tvalues["overconfidence"]), p=float(m.pvalues["overconfidence"]),
                 effect_name="Traps per 1 unit of overconfidence", effect=b_oc,
                 ci_low=float(ci.loc["overconfidence", 0]), ci_high=float(ci.loc["overconfidence", 1]),
                 direction_ok=bool(b_oc > 0), r2=float(m.rsquared), ceiling=ceiling, **common)
    reg.add_test(id="H8.literacy", role="secondary", prediction="literacy coefficient not negative (CI not entirely < 0)",
                 statistic_name="t", statistic=float(m.tvalues["literacy_score"]), p=float(m.pvalues["literacy_score"]),
                 effect_name="Traps per extra correct literacy answer", effect=b_lit, ci_low=lit_lo, ci_high=lit_hi,
                 direction_ok=bool(lit_hi >= 0), protects=bool(lit_hi < 0), **common)
    reg.add_test(id="H8.dataset", hypothesis="H8", role="primary-dataset", outcome="victimization",
                 prediction="literacy does not lower victimization; overconfidence raises it",
                 test="Logistic regression on the external dataset", testable=False,
                 note="PENDING: the external dataset has not been added yet (see data/external/README.md).",
                 pending=True)

    # Figure: literacy distribution + coefficient plot
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 4.6), gridspec_kw={"width_ratios": [1, 1.6]}, layout="constrained")
    ax1.bar(dist.index, dist.values, width=0.6, color=C1)
    for k, v in dist.items():
        ax1.text(k, v + 0.4, str(v), ha="center", color=INK)
    ax1.set_xticks([0, 1, 2, 3])
    ax1.set_xlabel("Literacy score (Big Three items correct)")
    ax1.set_ylabel("Players")
    ax1.set_title(f"Literacy distribution (n = {n})" + (" — ceiling" if ceiling else ""), loc="left")
    ax1.grid(axis="x", visible=False)
    terms = list(TERMS)
    for i, t in enumerate(terms):
        y = len(terms) - 1 - i
        lo, hi = ci.loc[t, 0], ci.loc[t, 1]
        c = C2 if t in ("overconfidence", "literacy_score") else INK2
        ax2.plot([lo, hi], [y, y], color=c, lw=2, solid_capstyle="round")
        ax2.scatter([m.params[t]], [y], s=60, color=c, zorder=3, edgecolor=BG)
    ax2.axvline(0, color=INK2, lw=1)
    ax2.set_yticks(range(len(terms)))
    ax2.set_yticklabels([TERMS[t] for t in terms][::-1])
    ax2.set_xlabel("Change in trap score (shared 8 traps), 95% CI (HC3)\n← fewer traps      more traps →")
    ax2.set_title(f"OLS on trap score (n = {int(m.nobs)}, R² = {m.rsquared:.2f})", loc="left")
    ax2.grid(axis="y", visible=False)
    savefig(fig, "H8")


__all__ = ["run", "np"]
