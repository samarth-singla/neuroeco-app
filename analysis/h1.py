"""H1 and H1a-H1h: dark design (fraud skin) vs honest skin, plus the fraud-only feature cards (UX map)."""

from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

from checks import outlier_threshold
from common import (BG, C1, C2, C3, FEATURES, GRID, INK, INK2, Registry, _clean, boot_ci_two, cliffs_delta,
                    fisher_test, mwu_test, save_table, savefig, share_bars, share_record, strip_box, wilson)

SK = dict(group_col="skin", a="fraud", b="honest")


def run(reg: Registry, df: pd.DataFrame) -> None:
    fr = df[df["skin"] == "fraud"]
    kw = dict(df=df, **SK)

    # ---------------------------------------------------------------- H1
    mwu_test(reg, id="H1.primary", hypothesis="H1", role="primary", outcome="total_deposited",
             prediction="fraud > honest", predicted="greater", holm_family="H1", **kw)
    mwu_test(reg, id="H1.sec.decision_time", hypothesis="H1", role="secondary",
             outcome="decision_time_first_invest", prediction="fraud < honest", predicted="less", **kw)
    fisher_test(reg, id="H1.sec.invested_r1", hypothesis="H1", role="secondary", outcome="invested_r1",
                prediction="fraud > honest", predicted="greater", **kw)
    fisher_test(reg, id="H1.sec.verify_any", hypothesis="H1", role="secondary", outcome="verify_any",
                prediction="fraud < honest", predicted="less", **kw)
    mwu_test(reg, id="H1.sec.app_trust", hypothesis="H1", role="secondary", outcome="app_trust",
             prediction="fraud > honest", predicted="greater", **kw)
    mwu_test(reg, id="H1.sec.app_urgency", hypothesis="H1", role="secondary", outcome="app_urgency",
             prediction="fraud > honest", predicted="greater", **kw)
    mwu_test(reg, id="H1.sec.trap_score_shared8", hypothesis="H1", role="secondary", outcome="trap_score_shared8",
             prediction="fraud > honest", predicted="greater", **kw)

    # Robustness: timing without the outliers; r1_amount among completers (to compare with the ITT rerun)
    thr = outlier_threshold(df["decision_time_first_invest"])
    trimmed = df[df["decision_time_first_invest"] <= thr]
    mwu_test(reg, id="H1.rob.decision_time_no_outliers", hypothesis="H1", role="robustness",
             outcome="decision_time_first_invest", prediction="fraud < honest (outliers > Q3 + 3 IQR removed)",
             predicted="less", df=trimmed, **SK, note=f"threshold {thr:.1f} s")
    mwu_test(reg, id="H1.rob.r1_amount", hypothesis="H1", role="robustness", outcome="r1_amount",
             prediction="fraud > honest (completers; compare with the ITT rerun)", predicted="greater", **kw)

    # Moderator (exploratory): OLS log1p(total_deposited) ~ fraud * crt_correct + controls, HC3
    _moderator(reg, df)

    # ---------------------------------------------------------------- H1a / H1e (shared primary test)
    mwu_test(reg, id="H1ae.primary", hypothesis="H1a", role="primary", outcome="decision_time_first_invest",
             prediction="fraud < honest", predicted="less", holm_family="H1", **kw,
             note="Shared primary test of H1a and H1e (counted once in the Holm family).")
    mwu_test(reg, id="H1ae.rob.no_outliers", hypothesis="H1a", role="robustness",
             outcome="decision_time_first_invest", prediction="fraud < honest (outliers removed)",
             predicted="less", df=trimmed, **SK, note=f"threshold {thr:.1f} s")
    share_record(reg, id="H1a.sec.feature_push_timer", hypothesis="H1a", role="secondary",
                 outcome="feature_push_timer", series=fr["feature_push_timer_yes"],
                 prediction="share of fraud players saying the timer pushed them")
    share_record(reg, id="H1e.sec.feature_push_social", hypothesis="H1e", role="secondary",
                 outcome="feature_push_social", series=fr["feature_push_social_yes"],
                 prediction="share of fraud players saying social proof pushed them")

    # ---------------------------------------------------------------- H1b
    fisher_test(reg, id="H1b.primary", hypothesis="H1b", role="primary", outcome="trap_hook",
                prediction="fraud > honest", predicted="greater", holm_family="H1", **kw)
    share_record(reg, id="H1b.sec.feature_push_bonus", hypothesis="H1b", role="secondary",
                 outcome="feature_push_bonus", series=fr["feature_push_bonus_yes"],
                 prediction="share of fraud players saying the locked bonus pushed them")

    # ---------------------------------------------------------------- H1c
    fisher_test(reg, id="H1c.primary", hypothesis="H1c", role="primary", outcome="vip_upgrade",
                prediction="fraud > honest", predicted="greater", holm_family="H1", **kw)
    mwu_test(reg, id="H1c.sec.vip_level", hypothesis="H1c", role="secondary", outcome="vip_level",
             prediction="fraud > honest", predicted="greater", **kw)
    share_record(reg, id="H1c.sec.feature_push_vip", hypothesis="H1c", role="secondary",
                 outcome="feature_push_vip", series=fr["feature_push_vip_yes"],
                 prediction="share of fraud players saying the VIP levels pushed them")
    vip_rows = []
    for col in ("vip_nudge_taps", "vip_level_ups", "vip_taps"):
        vc = fr[col].value_counts().sort_index()
        for val, cnt in vc.items():
            vip_rows.append({"measure": col, "value": int(val), "fraud_players": int(cnt)})
    save_table(pd.DataFrame(vip_rows), "H1c_vip_within_fraud")
    lv = pd.crosstab(df["vip_level"], df["skin"]).reindex(index=[0, 1, 2, 3], columns=["honest", "fraud"]).fillna(0)
    save_table(lv.astype(int).reset_index(), "H1c_vip_level_by_skin")
    reg.sections["H1c_within_fraud"] = {
        "vip_nudge_taps_any": int((fr["vip_nudge_taps"] > 0).sum()), "n": len(fr),
        "vip_nudge_taps_mean": float(fr["vip_nudge_taps"].mean()),
        "vip_level_ups_mean": float(fr["vip_level_ups"].mean()),
        "vip_level_ups_any": int((fr["vip_level_ups"] > 0).sum()),
    }

    # ---------------------------------------------------------------- H1d
    fisher_test(reg, id="H1d.primary", hypothesis="H1d", role="primary", outcome="verify_any",
                prediction="fraud < honest", predicted="less", holm_family="H1", **kw)
    mwu_test(reg, id="H1d.sec.verify_count", hypothesis="H1d", role="secondary", outcome="verify_count",
             prediction="fraud < honest", predicted="less", **kw)
    share_record(reg, id="H1d.sec.feature_push_regulator", hypothesis="H1d", role="secondary",
                 outcome="feature_push_regulator", series=fr["feature_push_regulator_yes"],
                 prediction="share of fraud players saying the NDIA badge pushed them")

    # ---------------------------------------------------------------- H1f
    mwu_test(reg, id="H1f.primary", hypothesis="H1f", role="primary", outcome="r4_amount",
             prediction="fraud > honest", predicted="greater", holm_family="H1", **kw)
    share_record(reg, id="H1f.sec.chat_deposit", hypothesis="H1f", role="secondary", outcome="chat_deposit",
                 series=fr["chat_deposit"], prediction="share of fraud players depositing within 60 s of the chat")
    share_record(reg, id="H1f.sec.feature_push_chat", hypothesis="H1f", role="secondary",
                 outcome="feature_push_chat", series=fr["feature_push_chat_yes"],
                 prediction="share of fraud players saying the mentor chat pushed them")
    reg.sections["H1f_chat"] = {"chat_open": int(fr["chat_open"].sum()), "n": len(fr)}

    # ---------------------------------------------------------------- H1g (no comparison group)
    shown = fr[fr["tax_shown"] == 1]
    share_record(reg, id="H1g.primary", hypothesis="H1g", role="primary", outcome="tax_paid",
                 series=shown["tax_paid"], prediction="share of fraud players shown the tax who paid it",
                 note="No honest comparison exists (the honest skin has no tax), so there is no test or p-value.")
    share_record(reg, id="H1g.sec.feature_push_tax", hypothesis="H1g", role="secondary", outcome="feature_push_tax",
                 series=fr["feature_push_tax_yes"], prediction="share of fraud players saying the tax pushed them")
    reg.sections["H1g_tax"] = {"tax_shown": int(fr["tax_shown"].sum()), "n": len(fr)}

    # ---------------------------------------------------------------- H1h UX map
    rows = []
    for col, (label, sub) in FEATURES.items():
        s = fr[col + "_yes"].dropna()
        k, n = int(s.sum()), len(s)
        lo, hi = wilson(k, n)
        rows.append({"feature": label, "sub_hypothesis": sub, "column": col, "yes": k, "n": n,
                     "share": k / n if n else np.nan, "ci_low": lo, "ci_high": hi})
    ux = pd.DataFrame(rows).sort_values("share", ascending=False)
    save_table(ux, "H1h_ux_map")
    reg.sections["H1h_ux_map"] = ux.to_dict("records")
    reg.sections["H1h_feature_push_count"] = {
        "mean": float(fr["feature_push_count"].mean()), "median": float(fr["feature_push_count"].median()),
        "n": int(fr["feature_push_count"].notna().sum()),
        "zero": int((fr["feature_push_count"] == 0).sum())}

    _figures(reg, df, fr, thr)


def _moderator(reg: Registry, df: pd.DataFrame) -> None:
    d = df[["log_total_deposited", "fraud", "crt_correct", "exp_investing_num", "exp_trading_app_num"]].dropna()
    try:
        m = smf.ols("log_total_deposited ~ fraud * crt_correct + exp_investing_num + exp_trading_app_num",
                    data=d).fit(cov_type="HC3")
    except Exception as e:  # noqa: BLE001
        reg.problem(f"H1 moderator OLS could not be fitted: {e}")
        return
    ci = m.conf_int()
    coefs = pd.DataFrame({"term": m.params.index, "coef": m.params.values, "se_hc3": m.bse.values,
                          "ci_low": ci[0].values, "ci_high": ci[1].values, "p": m.pvalues.values})
    save_table(coefs, "H1_moderator_ols")
    term = "fraud:crt_correct"
    cells = d.groupby(["fraud", "crt_correct"]).size()
    reg.add_test(id="H1.mod.fraud_x_crt", hypothesis="H1", role="exploratory", outcome="log1p(total_deposited)",
                 prediction="fraud effect smaller for CRT-correct players (interaction < 0)",
                 test="OLS with HC3 SEs: log1p(total_deposited) ~ fraud × crt_correct + exp_investing + "
                      "exp_trading_app", statistic_name="t", statistic=float(m.tvalues[term]),
                 p=float(m.pvalues[term]), effect_name="Interaction coefficient (log points)",
                 effect=float(m.params[term]), ci_low=float(ci.loc[term, 0]), ci_high=float(ci.loc[term, 1]),
                 n={"players": int(m.nobs)} | {f"fraud={int(f)}, crt={int(c)}": int(v) for (f, c), v in cells.items()},
                 direction_ok=bool(m.params[term] < 0), r2=float(m.rsquared),
                 summary={"fraud_coef": float(m.params["fraud"]), "fraud_p": float(m.pvalues["fraud"])})


def _figures(reg: Registry, df: pd.DataFrame, fr: pd.DataFrame, thr: float) -> None:
    h = df[df["skin"] == "honest"]

    def grp(col, data=(h, fr)):
        return [("Honest", _clean(data[0][col]), C1), ("Fraud", _clean(data[1][col]), C2)]

    # H1: primary strip + effect sizes of every H1 outcome on one Cliff's delta scale
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 4.8), gridspec_kw={"width_ratios": [1, 1.5]}, layout="constrained")
    strip_box(ax1, grp("total_deposited"), "Total deposited (₹, virtual)", "Primary: total deposited")
    outs = [("total_deposited", "Total deposited", ">"), ("decision_time_first_invest", "Decision time (S3)", "<"),
            ("invested_r1", "Invested in round 1", ">"), ("verify_any", "Verified anything", "<"),
            ("app_trust", "Trust rating", ">"), ("app_urgency", "Urgency rating", ">"),
            ("trap_score_shared8", "Trap score (shared 8)", ">")]
    rows = []
    for i, (col, lab, pred) in enumerate(outs):
        a, b = _clean(fr[col]), _clean(h[col])
        d = cliffs_delta(a, b)
        lo, hi = boot_ci_two(a, b, cliffs_delta)
        rows.append({"outcome": col, "delta_fraud_vs_honest": d, "ci_low": lo, "ci_high": hi, "predicted": pred})
        y = len(outs) - 1 - i
        ok = (d > 0) if pred == ">" else (d < 0)
        color = C2 if ok else INK2
        ax2.plot([lo, hi], [y, y], color=color, lw=2, solid_capstyle="round")
        ax2.scatter([d], [y], s=60, color=color, zorder=3, edgecolor=BG, linewidth=1)
        ax2.text(1.04, y, f"pred. fraud {pred} honest", va="center", fontsize=9.5, color=INK2,
                 transform=ax2.get_yaxis_transform())
    save_table(pd.DataFrame(rows), "H1_effect_sizes")
    ax2.axvline(0, color=INK2, lw=1)
    ax2.set_yticks(range(len(outs)))
    ax2.set_yticklabels([lab for _, lab, _ in outs][::-1])
    ax2.set_xlim(-1, 1)
    ax2.set_xlabel("Cliff's δ, fraud vs honest (95% bootstrap CI)\n← honest higher      fraud higher →")
    ax2.set_title(f"All H1 outcomes (honest n = {len(h)}, fraud n = {len(fr)})", loc="left")
    ax2.grid(axis="y", visible=False)
    savefig(fig, "H1")

    # H1a / H1e: decision time
    fig, ax = plt.subplots(figsize=(6.4, 4.6))
    strip_box(ax, grp("decision_time_first_invest"), "Seconds from usable home screen to first Invest/Skip",
              "First decision time by skin")
    ax.axhline(thr, color=INK2, lw=1, ls=(0, (1, 0)))
    ax.text(1.45, thr, f"outlier rule {thr:.0f} s", color=INK2, fontsize=9, va="bottom", ha="right")
    savefig(fig, "H1a_H1e")

    # H1b: hook
    fig, ax = plt.subplots(figsize=(5.6, 4.4))
    share_bars(ax, [("Honest", int(h["trap_hook"].sum()), len(h), C1),
                    ("Fraud", int(fr["trap_hook"].sum()), len(fr), C2)], "Invested in round 1 (trap_hook)",
               "First deposit (round 1) by skin")
    savefig(fig, "H1b")

    # H1c: VIP upgrade + VIP level distribution
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.4))
    share_bars(ax1, [("Honest", int(h["vip_upgrade"].sum()), len(h), C1),
                     ("Fraud", int(fr["vip_upgrade"].sum()), len(fr), C2)], "Deposited ≥ ₹5,000 (VIP 2+)",
               "Reached VIP 2 by skin")
    x = np.arange(4)
    for off, (lab, d, c) in zip((-0.2, 0.2), (("Honest", h, C1), ("Fraud", fr, C2))):
        shares = d["vip_level"].value_counts(normalize=True).reindex(range(4)).fillna(0)
        ax2.bar(x + off, shares.values, width=0.38, color=c, label=f"{lab} (n = {len(d)})")
    ax2.set_xticks(x)
    ax2.set_xticklabels(["Member\n< ₹1k", "VIP 1\n₹1k–5k", "VIP 2\n₹5k–10k", "VIP 3\n≥ ₹10k"])
    ax2.yaxis.set_major_formatter(plt.matplotlib.ticker.PercentFormatter(1.0))
    ax2.set_ylabel("Share of players")
    ax2.set_title("VIP level reached (by total deposited)", loc="left")
    ax2.legend(loc="upper left")
    ax2.grid(axis="x", visible=False)
    savefig(fig, "H1c")

    # H1d: verification
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.4))
    share_bars(ax1, [("Honest", int(h["verify_any"].sum()), len(h), C1),
                     ("Fraud", int(fr["verify_any"].sum()), len(fr), C2)], "Opened any T&C / details / badge",
               "Verified anything by skin")
    strip_box(ax2, grp("verify_count"), "Number of verification opens", "Verification count by skin")
    savefig(fig, "H1d")

    # H1f: round-4 stake
    fig, ax = plt.subplots(figsize=(6.4, 4.6))
    strip_box(ax, grp("r4_amount"), "Round-4 stake (₹)", "Round-4 stake (after the fraud mentor chat)")
    savefig(fig, "H1f")

    # H1g: tax paid and self-report (two different measures, both within fraud)
    shown = fr[fr["tax_shown"] == 1]
    fig, ax = plt.subplots(figsize=(7.5, 3.2))
    items = [("Paid the 'processing tax'", int(shown["tax_paid"].sum()), len(shown)),
             ("Said the tax pushed them", int(fr["feature_push_tax_yes"].sum()), int(fr["feature_push_tax_yes"].notna().sum()))]
    for i, (lab, k, n) in enumerate(items):
        p = k / n if n else 0
        lo, hi = wilson(k, n)
        y = len(items) - 1 - i
        ax.barh(y, p, height=0.5, color=C2)
        ax.errorbar(p, y, xerr=[[p - lo], [hi - p]], color=INK, capsize=5, lw=1.4)
        ax.text(min(hi + 0.02, 0.98), y, f"{k}/{n}", va="center", color=INK)
    ax.set_yticks(range(len(items)))
    ax.set_yticklabels([lab for lab, _, _ in items][::-1])
    ax.set_xlim(0, 1.08)
    ax.xaxis.set_major_formatter(plt.matplotlib.ticker.PercentFormatter(1.0))
    ax.set_title("Withdrawal tax, fraud skin only (no honest comparison exists)", loc="left")
    ax.grid(axis="y", visible=False)
    savefig(fig, "H1g")

    # H1h: UX map
    ux = pd.DataFrame(reg.sections["H1h_ux_map"]).sort_values("share")
    fig, ax = plt.subplots(figsize=(9, 4.6))
    y = np.arange(len(ux))
    ax.barh(y, ux["share"], height=0.6, color=C2)
    ax.errorbar(ux["share"], y, xerr=[ux["share"] - ux["ci_low"], ux["ci_high"] - ux["share"]], fmt="none",
                ecolor=INK, capsize=4, lw=1.3)
    for yi, (_, r) in zip(y, ux.iterrows()):
        ax.text(min(r["ci_high"] + 0.02, 0.97), yi, f"{r['yes']}/{r['n']}", va="center", color=INK, fontsize=10)
    ax.set_yticks(y)
    ax.set_yticklabels([f"{r['feature']} ({r['sub_hypothesis']})" for _, r in ux.iterrows()])
    ax.set_xlim(0, 1.08)
    ax.xaxis.set_major_formatter(plt.matplotlib.ticker.PercentFormatter(1.0))
    ax.set_xlabel("Share of fraud players who said the feature pushed them to invest (95% Wilson CI)")
    ax.set_title(f"UX map: which dark-design features felt persuasive (fraud n = {len(fr)})", loc="left")
    ax.grid(axis="y", visible=False)
    savefig(fig, "H1h")


__all__ = ["run", "GRID", "C3"]
