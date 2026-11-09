"""H4: loss aversion (group 1-3 from the two bonus spins) predicts topping up after the scripted crash."""

from __future__ import annotations

import warnings

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from scipy import stats

from common import (C1, INK, Registry, _clean, boot_ci_rows, mwu_test, save_table, savefig, strip_box, wilson)

LABELS = {1: "Low (1)", 2: "Typical (2)", 3: "High (3)"}


def run(reg: Registry, df: pd.DataFrame) -> None:
    dist = df["la_group"].value_counts().reindex([1, 2, 3]).fillna(0).astype(int)
    n_cons = int(dist.sum())
    largest = float(dist.max() / n_cons) if n_cons else float("nan")
    low_power = largest > 0.70
    reg.sections["H4"] = {
        "distribution": {LABELS[k]: int(v) for k, v in dist.items()},
        "inconsistent": int((df["la_consistent"] == 0).sum()),
        "largest_group_share": largest, "low_power": bool(low_power),
        "by_spin_order": {str(k): {LABELS[g]: int(c) for g, c in v.value_counts().reindex([1, 2, 3]).fillna(0).items()}
                          for k, v in df.groupby("spin_order")["la_group"]},
    }
    save_table(pd.DataFrame({"loss_aversion_group": [LABELS[k] for k in dist.index], "players": dist.values,
                             "share": dist.values / max(n_cons, 1)}), "H4_group_distribution")

    d = df[["crash_topup", "crash_topup_amount", "la_group", "fraud", "exp_investing_num"]].dropna()
    note = "LOW POWER: one loss-aversion group holds more than 70% of players." if low_power else None

    # Primary: logistic regression
    fitted = False
    try:
        m = fit_logit("crash_topup ~ la_group + fraud + exp_investing_num", d)
        ci = m.conf_int()
        save_table(pd.DataFrame({"term": m.params.index, "coef": m.params.values, "odds_ratio": np.exp(m.params.values),
                                 "or_ci_low": np.exp(ci[0].values), "or_ci_high": np.exp(ci[1].values),
                                 "z": m.tvalues.values, "p": m.pvalues.values}), "H4_logit")
        b = float(m.params["la_group"])
        reg.add_test(id="H4.primary", hypothesis="H4", role="primary", outcome="crash_topup",
                     prediction="higher loss-aversion group → more likely to top up (OR > 1)",
                     test="Logistic regression: crash_topup ~ loss_aversion_group + fraud + exp_investing",
                     statistic_name="z", statistic=float(m.tvalues["la_group"]), p=float(m.pvalues["la_group"]),
                     effect_name="Odds ratio per loss-aversion group step", effect=float(np.exp(b)),
                     ci_low=float(np.exp(ci.loc["la_group", 0])), ci_high=float(np.exp(ci.loc["la_group", 1])),
                     n={"players": int(m.nobs)}, direction_ok=bool(b > 0) if b != 0 else None, holm_family="H2-H7",
                     note=note, low_power=bool(low_power),
                     summary={str(LABELS[g]): {"n": int((d["la_group"] == g).sum()),
                                               "yes": int(d.loc[d["la_group"] == g, "crash_topup"].sum())}
                              for g in (1, 2, 3)})
        fitted = True
    except Exception as e:  # noqa: BLE001
        reg.problem(f"H4 primary logistic regression could not be used ({e}); pre-registered fallback: Spearman "
                    "correlation of loss_aversion_group with crash_topup.")
    if not fitted:
        _spearman(reg, d, "crash_topup", id="H4.primary", role="primary", holm_family="H2-H7",
                  note=(note or "") + " Fallback for the logistic model (see problems).")

    # Secondary: OLS on the amount (HC3) and Spearman
    try:
        o = smf.ols("crash_topup_amount ~ la_group + fraud + exp_investing_num", data=d).fit(cov_type="HC3")
        ci = o.conf_int()
        save_table(pd.DataFrame({"term": o.params.index, "coef": o.params.values, "se_hc3": o.bse.values,
                                 "ci_low": ci[0].values, "ci_high": ci[1].values, "p": o.pvalues.values}), "H4_ols")
        reg.add_test(id="H4.sec.amount_ols", hypothesis="H4", role="secondary", outcome="crash_topup_amount",
                     prediction="coefficient of loss_aversion_group > 0",
                     test="OLS (HC3): crash_topup_amount ~ loss_aversion_group + fraud + exp_investing",
                     statistic_name="t", statistic=float(o.tvalues["la_group"]), p=float(o.pvalues["la_group"]),
                     effect_name="₹ per loss-aversion group step", effect=float(o.params["la_group"]),
                     ci_low=float(ci.loc["la_group", 0]), ci_high=float(ci.loc["la_group", 1]),
                     n={"players": int(o.nobs)}, direction_ok=bool(o.params["la_group"] > 0))
    except Exception as e:  # noqa: BLE001
        reg.problem(f"H4 secondary OLS could not be fitted: {e}")
    _spearman(reg, d, "crash_topup_amount", id="H4.sec.amount_spearman", role="secondary")

    # Order check: loss-aversion group by spin order
    mwu_test(reg, id="H4.order.spin_order", hypothesis="H4", role="check", outcome="la_group", df=df,
             group_col="spin_order", a="150;250", b="250;150", predicted="greater",
             prediction="(check) no spin-order effect on the loss-aversion group")

    # Figure
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.6))
    for i, g in enumerate((1, 2, 3)):
        s = d.loc[d["la_group"] == g, "crash_topup"]
        k, n = int(s.sum()), len(s)
        p = k / n if n else 0
        lo, hi = wilson(k, n) if n else (0, 0)
        ax1.bar(i, p, width=0.55, color=C1)
        if n:
            ax1.errorbar(i, p, yerr=[[p - lo], [hi - p]], color=INK, capsize=5, lw=1.4)
        ax1.text(i, (hi if n else 0) + 0.03, f"{k}/{n}", ha="center", color=INK)
    ax1.set_xticks(range(3))
    ax1.set_xticklabels([f"{LABELS[g]}\n(n = {int((d['la_group'] == g).sum())})" for g in (1, 2, 3)])
    ax1.set_ylim(0, 1.12)
    ax1.yaxis.set_major_formatter(plt.matplotlib.ticker.PercentFormatter(1.0))
    ax1.set_ylabel("Topped up after the crash")
    ax1.set_xlabel("Loss-aversion group (from the two bonus spins)")
    ax1.set_title("Primary: top-up after the crash", loc="left")
    ax1.grid(axis="x", visible=False)
    strip_box(ax2, [(LABELS[g], _clean(d.loc[d["la_group"] == g, "crash_topup_amount"]), C1) for g in (1, 2, 3)],
              "Top-up amount (₹)", "Secondary: top-up amount")
    savefig(fig, "H4")


def fit_logit(formula: str, data: pd.DataFrame):
    """Logistic regression that fails loudly on non-convergence or (quasi-)separation."""
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        m = smf.logit(formula, data=data).fit(disp=0, maxiter=200)
    bad = [str(w.message) for w in caught
           if "converg" in str(w.message).lower() or "separation" in str(w.message).lower()]
    if bad or not m.mle_retvals.get("converged", True):
        raise RuntimeError("logistic model problem: " + ("; ".join(bad) or "did not converge"))
    return m


def _spearman(reg, d, outcome, *, id, role, holm_family=None, note=None):
    x, y = d["la_group"].to_numpy(float), d[outcome].to_numpy(float)
    if len(np.unique(x)) < 2 or len(np.unique(y)) < 2:
        return reg.add_test(id=id, hypothesis="H4", role=role, outcome=outcome, test="Spearman correlation",
                            testable=False, note="no variance", n={"players": len(x)}, holm_family=holm_family)
    r = stats.spearmanr(x, y)
    lo, hi = boot_ci_rows(np.c_[x, y], lambda m: stats.spearmanr(m[:, 0], m[:, 1]).statistic
                          if len(np.unique(m[:, 0])) > 1 and len(np.unique(m[:, 1])) > 1 else np.nan)
    return reg.add_test(id=id, hypothesis="H4", role=role, outcome=outcome,
                        prediction=f"ρ(loss_aversion_group, {outcome}) > 0", test="Spearman correlation",
                        statistic_name="ρ", statistic=float(r.statistic), p=float(r.pvalue),
                        effect_name="Spearman ρ", effect=float(r.statistic), ci_low=lo, ci_high=hi,
                        n={"players": len(x)}, direction_ok=bool(r.statistic > 0), holm_family=holm_family,
                        note=note)
