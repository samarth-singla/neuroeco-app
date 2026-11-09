"""H3: within-subject flash deals (₹500 / ₹3,000 / ₹8,000). Prediction: details opened least and investing most at
₹500. Cochran's Q (details, invest), pairwise exact McNemar with Holm, Friedman (times), card-position check."""

from __future__ import annotations

import itertools

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats
from statsmodels.stats.contingency_tables import mcnemar

from common import (BG, C1, C2, INK, INK2, Registry, _clean, boot_ci_rows, holm, save_table, savefig, strip_box,
                    wilson)

SIZES = (500, 3000, 8000)


def deals_long(df: pd.DataFrame) -> pd.DataFrame:
    """B13 step 5: participant x size, with card position from deal_order."""
    rows = []
    for _, r in df.iterrows():
        order = [int(x) for x in str(r["deal_order"]).split(";")]
        for size in SIZES:
            rows.append({"participant_id": r["participant_id"], "size": size, "position": order.index(size) + 1,
                         "invest": r[f"deal_invest_{size}"], "details": r[f"deal_details_{size}"],
                         "time": r[f"deal_time_{size}"]})
    return pd.DataFrame(rows)


def cochran_q(x: np.ndarray) -> float:
    """Cochran's Q for an n x k binary matrix (NaN if undefined)."""
    k = x.shape[1]
    col = x.sum(axis=0)
    row = x.sum(axis=1)
    total = x.sum()
    den = k * total - (row ** 2).sum()
    if den == 0:
        return float("nan")
    return float((k - 1) * (k * (col ** 2).sum() - total ** 2) / den)


def eta_q(x: np.ndarray) -> float:
    q = cochran_q(x)
    return q / (len(x) * (x.shape[1] - 1)) if not np.isnan(q) else float("nan")


def kendall_w(x: np.ndarray) -> float:
    if len(x) < 2 or np.all(x == x[0]):
        return float("nan")
    with np.errstate(all="ignore"):
        try:
            chi = stats.friedmanchisquare(*x.T).statistic
        except ValueError:
            return float("nan")
    return float(chi / (len(x) * (x.shape[1] - 1)))


def _cochran_record(reg, *, id, role, outcome, mat, labels, predicted_level, predicted, prediction, holm_family=None):
    n, k = mat.shape
    q = cochran_q(mat)
    shares = mat.mean(axis=0)
    summary = {}
    for lab, col in zip(labels, mat.T):
        lo, hi = wilson(int(col.sum()), n)
        summary[str(lab)] = {"n": n, "yes": int(col.sum()), "share": float(col.mean()), "ci_low": lo, "ci_high": hi}
    if np.isnan(q):
        return reg.add_test(id=id, hypothesis="H3", role=role, outcome=outcome, prediction=prediction,
                            test="Cochran's Q", n={"players": n}, summary=summary, testable=False,
                            note="Q undefined: every player made the same choice at every size", holm_family=holm_family)
    p = float(stats.chi2.sf(q, k - 1))
    lo, hi = boot_ci_rows(mat, eta_q)
    idx = labels.index(predicted_level)
    ok = (shares[idx] == shares.min() and shares[idx] < shares.max()) if predicted == "lowest" else \
         (shares[idx] == shares.max() and shares[idx] > shares.min())
    return reg.add_test(id=id, hypothesis="H3", role=role, outcome=outcome, prediction=prediction,
                        test=f"Cochran's Q (df = {k - 1})", statistic_name="Q", statistic=q, p=p,
                        effect_name="η²_Q = Q / (n(k − 1))", effect=q / (n * (k - 1)), ci_low=lo, ci_high=hi,
                        n={"players": n}, summary=summary, direction_ok=bool(ok), holm_family=holm_family)


def run(reg: Registry, df: pd.DataFrame) -> None:
    long = deals_long(df)
    save_table(long.drop(columns=["participant_id"]).groupby("size").agg(
        players=("invest", "size"), invested=("invest", "sum"), details_opened=("details", "sum"),
        median_time_s=("time", "median")).reset_index(), "H3_by_size")

    det = df[[f"deal_details_{s}" for s in SIZES]].to_numpy(float)
    inv = df[[f"deal_invest_{s}" for s in SIZES]].to_numpy(float)
    tim = df[[f"deal_time_{s}" for s in SIZES]].to_numpy(float)
    labels = list(SIZES)

    _cochran_record(reg, id="H3.primary", role="primary", outcome="deal_details", mat=det, labels=labels,
                    predicted_level=500, predicted="lowest", holm_family="H2-H7",
                    prediction="details opened least at ₹500 (share lowest at ₹500)")
    _cochran_record(reg, id="H3.sec.deal_invest", role="secondary", outcome="deal_invest", mat=inv, labels=labels,
                    predicted_level=500, predicted="highest",
                    prediction="investing most at ₹500 (share highest at ₹500)")

    # Friedman on times
    ok_rows = ~np.isnan(tim).any(axis=1)
    t = tim[ok_rows]
    fr = stats.friedmanchisquare(*t.T)
    w = float(fr.statistic / (len(t) * 2))
    lo, hi = boot_ci_rows(t, kendall_w)
    med = np.median(t, axis=0)
    reg.add_test(id="H3.sec.deal_time", hypothesis="H3", role="secondary", outcome="deal_time",
                 prediction="shortest time at ₹500", test="Friedman test (df = 2)", statistic_name="χ²_F",
                 statistic=float(fr.statistic), p=float(fr.pvalue), effect_name="Kendall's W", effect=w,
                 ci_low=lo, ci_high=hi, n={"players": int(len(t))},
                 summary={str(s): {"median": float(m)} for s, m in zip(SIZES, med)},
                 direction_ok=bool(med[0] == med.min() and med[0] < med.max()))

    # Pairwise exact McNemar on details (Holm within H3), paired difference with bootstrap CI
    pairs = list(itertools.combinations(range(3), 2))
    recs = []
    for i, j in pairs:
        a, b = det[:, i], det[:, j]
        tab = [[int(((a == 1) & (b == 1)).sum()), int(((a == 1) & (b == 0)).sum())],
               [int(((a == 0) & (b == 1)).sum()), int(((a == 0) & (b == 0)).sum())]]
        p = float(mcnemar(tab, exact=True).pvalue) if tab[0][1] + tab[1][0] > 0 else 1.0
        diff = float(a.mean() - b.mean())
        lo, hi = boot_ci_rows(np.c_[a, b], lambda m: m[:, 0].mean() - m[:, 1].mean())
        ok = diff < 0 if SIZES[i] == 500 else None
        recs.append(reg.add_test(
            id=f"H3.pair.details_{SIZES[i]}_vs_{SIZES[j]}", hypothesis="H3", role="secondary",
            outcome="deal_details", prediction=f"details share lower at ₹{SIZES[i]:,} than at ₹{SIZES[j]:,}",
            test="Exact McNemar test (pairwise, Holm within H3)", statistic_name="discordant b / c",
            statistic=f"{tab[0][1]} / {tab[1][0]}", p=p,
            effect_name=f"Difference in share (₹{SIZES[i]:,} − ₹{SIZES[j]:,})", effect=diff, ci_low=lo,
            ci_high=hi, n={"players": len(a)}, direction_ok=ok if ok is not None else (diff < 0),
            holm_family="H3-pairs", pairwise=True))
    for r, ph in zip(recs, holm([r["p"] for r in recs])):
        r["p_holm"] = ph

    # Card-position check: does position (1st/2nd/3rd card) drive choices instead of size?
    pos_det = long.pivot(index="participant_id", columns="position", values="details")[[1, 2, 3]].to_numpy(float)
    pos_inv = long.pivot(index="participant_id", columns="position", values="invest")[[1, 2, 3]].to_numpy(float)
    for name, mat in (("details", pos_det), ("invest", pos_inv)):
        q = cochran_q(mat)
        p = float(stats.chi2.sf(q, 2)) if not np.isnan(q) else None
        reg.add_test(id=f"H3.order.{name}_by_position", hypothesis="H3", role="check", outcome=f"deal_{name}",
                     prediction="(check) no card-position effect", test="Cochran's Q over card position (df = 2)",
                     statistic_name="Q", statistic=q, p=p, effect_name="η²_Q", effect=eta_q(mat),
                     n={"players": len(mat)},
                     summary={f"position {k}": {"share": float(v)} for k, v in zip((1, 2, 3), mat.mean(axis=0))},
                     testable=not np.isnan(q))
    save_table(long.drop(columns=["participant_id"]).groupby("position").agg(
        invested=("invest", "mean"), details=("details", "mean"), median_time_s=("time", "median")).reset_index(),
        "H3_by_position")

    _figure(det, inv, tim, len(df))


def _figure(det, inv, tim, n) -> None:
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11.5, 4.6))
    x = np.arange(3)
    for mat, lab, c in ((det, "Opened details before deciding (primary)", C1), (inv, "Invested", C2)):
        k = mat.sum(axis=0)
        p = k / n
        ci = np.array([wilson(int(ki), n) for ki in k])
        ax1.plot(x, p, color=c, lw=2, marker="o", ms=8, markeredgecolor=BG, label=lab, zorder=3)
        ax1.fill_between(x, ci[:, 0], ci[:, 1], color=c, alpha=0.15, lw=0)
        for xi, pi, ki in zip(x, p, k):
            ax1.annotate(f"{int(ki)}/{n}", (xi, pi), xytext=(0, 9), textcoords="offset points", ha="center",
                         color=INK, fontsize=9.5)
    ax1.set_xticks(x)
    ax1.set_xticklabels(["₹500", "₹3,000", "₹8,000"])
    ax1.set_xlabel("Flash-deal size (every player saw all three)")
    ax1.set_ylim(0, 1.05)
    ax1.yaxis.set_major_formatter(plt.matplotlib.ticker.PercentFormatter(1.0))
    ax1.set_ylabel("Share of players (95% Wilson band)")
    ax1.legend(loc="upper left")
    ax1.set_title(f"Checking and investing by stake (n = {n})", loc="left")
    ax1.grid(axis="x", visible=False)
    strip_box(ax2, [(f"₹{s:,}", _clean(tim[:, i]), C1) for i, s in enumerate(SIZES)],
              "Seconds from screen open to Invest (or Continue)", "Decision time by stake")
    ax2.set_xticklabels([f"₹{s:,}" for s in SIZES])
    ax2.tick_params(axis="x", colors=INK2)
    savefig(fig, "H3")
