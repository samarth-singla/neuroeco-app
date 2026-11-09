"""H9 (app part, exploratory): does the bias that predicts the trap score differ by gender? Age and income cannot
be tested in the app sample. The dataset part is in external.py."""

from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

from common import BG, C1, C2, INK2, Registry, save_table, savefig

BIASES = {"la_group": "Loss-aversion group (1–3)", "fomo_score": "FOMO score (0–3)",
          "overconfidence": "Overconfidence", "crt_correct": "CRT correct (reflective)"}


def run(reg: Registry, df: pd.DataFrame) -> None:
    d = df[["trap_score_shared8", "male", *BIASES]].dropna()
    sizes = {"male": int((d["male"] == 1).sum()), "not male": int((d["male"] == 0).sum())}
    reg.sections["H9"] = {
        "group_sizes_model": sizes,
        "gender_counts_all": {str(k): int(v) for k, v in df["demo_gender"].value_counts().items()},
        "age_counts": {str(k): int(v) for k, v in df["demo_age"].value_counts().items()},
        "income_counts": {str(k): int(v) for k, v in df["demo_income"].value_counts().items()},
    }
    formula = "trap_score_shared8 ~ (" + " + ".join(BIASES) + ") * male"
    try:
        m = smf.ols(formula, data=d).fit(cov_type="HC3")
    except Exception as e:  # noqa: BLE001
        reg.problem(f"H9 app model could not be fitted: {e}")
        return
    ci = m.conf_int()
    save_table(pd.DataFrame({"term": m.params.index, "coef": m.params.values, "se_hc3": m.bse.values,
                             "ci_low": ci[0].values, "ci_high": ci[1].values, "p": m.pvalues.values}), "H9_ols")

    # Simple slopes of each bias for not-male (reference) and male players
    rows = []
    names = list(m.params.index)
    for b in BIASES:
        for grp, male in (("not male", 0), ("male", 1)):
            v = np.zeros(len(names))
            v[names.index(b)] = 1
            if male:
                v[names.index(f"{b}:male")] = 1
            tt = m.t_test(v)
            lo, hi = np.asarray(tt.conf_int()).ravel()
            rows.append({"bias": b, "label": BIASES[b], "group": grp, "slope": float(np.asarray(tt.effect).ravel()[0]),
                         "ci_low": float(lo), "ci_high": float(hi), "p": float(np.asarray(tt.pvalue).ravel()[0])})
        it = f"{b}:male"
        reg.add_test(id=f"H9.app.{b}_x_male", hypothesis="H9", role="exploratory", outcome="trap_score_shared8",
                     prediction=f"slope of {b} differs between male and not-male players",
                     test="OLS (HC3) with bias × male interactions", statistic_name="t",
                     statistic=float(m.tvalues[it]), p=float(m.pvalues[it]),
                     effect_name="Interaction: slope(male) − slope(not male)", effect=float(m.params[it]),
                     ci_low=float(ci.loc[it, 0]), ci_high=float(ci.loc[it, 1]), n={"players": int(m.nobs)} | sizes)
    slopes = pd.DataFrame(rows)
    save_table(slopes, "H9_simple_slopes")
    reg.sections["H9"]["simple_slopes"] = slopes.to_dict("records")
    reg.sections["H9"]["r2"] = float(m.rsquared)
    reg.sections["H9"]["n"] = int(m.nobs)
    reg.add_test(id="H9.dataset", hypothesis="H9", role="primary-dataset", outcome="victimization",
                 prediction="the bias that best predicts victimization differs by age, income and gender group",
                 test="Logistic regression with interactions on the external dataset", testable=False,
                 note="PENDING: the external dataset has not been added yet (see data/external/README.md).",
                 pending=True)

    fig, ax = plt.subplots(figsize=(10, 4.8))
    y0 = np.arange(len(BIASES))
    for off, (grp, c) in zip((0.17, -0.17), (("not male", C1), ("male", C2))):
        s = slopes[slopes["group"] == grp].set_index("bias").loc[list(BIASES)]
        y = (len(BIASES) - 1 - y0) + off
        ax.hlines(y, s["ci_low"], s["ci_high"], color=c, lw=2)
        ax.scatter(s["slope"], y, s=55, color=c, zorder=3, edgecolor=BG, label=f"{grp} (n = {sizes[grp]})")
    ax.axvline(0, color=INK2, lw=1)
    ax.set_yticks(len(BIASES) - 1 - y0)
    ax.set_yticklabels(list(BIASES.values()))
    ax.set_xlabel("Change in trap score per unit of the bias, 95% CI (HC3)")
    ax.set_title(f"Exploratory: bias slopes by gender (n = {int(m.nobs)})", loc="left")
    ax.legend(loc="lower right")
    ax.grid(axis="y", visible=False)
    savefig(fig, "H9")
