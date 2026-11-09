"""Shared helpers: paths, data loading and preparation (DATA_COLLECTION_REPORT B10/B11/B13), statistics with
effect sizes, the results registry (results/results.json) and the figure style.

Every test result goes through `Registry.add_test`, so the report and the HTML page can be generated from
results.json alone. Data files in data/ are only read, never written.
"""

from __future__ import annotations

import glob
import json
import math
import os
from dataclasses import dataclass, field
from typing import Any, Iterable

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from scipy import stats  # noqa: E402
from statsmodels.stats.multitest import multipletests  # noqa: E402
from statsmodels.stats.proportion import proportion_confint  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
RESULTS = os.path.join(ROOT, "results")
TABLES = os.path.join(RESULTS, "tables")
FIGURES = os.path.join(RESULTS, "figures")

SEED = 42
N_BOOT = 2000
ALPHA = 0.05

SHARED8 = [
    "trap_hook", "trap_vip", "trap_deal_no_details", "trap_pool_no_details",
    "trap_crash_topup", "trap_no_verify", "trap_trust_after_withdrawal", "trap_reinvest",
]
FEATURES = {  # feature_push_* column -> label, sub-hypothesis
    "feature_push_timer": ("Countdown timer / slots left", "H1a"),
    "feature_push_bonus": ("Locked sign-up bonus", "H1b"),
    "feature_push_vip": ("VIP levels", "H1c"),
    "feature_push_regulator": ("NDIA badge / certificate", "H1d"),
    "feature_push_social": ("Social proof (ticker, toasts)", "H1e"),
    "feature_push_chat": ("Mentor chat", "H1f"),
    "feature_push_tax": ("Withdrawal tax", "H1g"),
}
EXP_INVESTING = {"none": 0, "some": 1, "regular": 2}
YES_NO = {"yes": 1, "no": 0}


def ensure_dirs() -> None:
    for d in (RESULTS, TABLES, FIGURES):
        os.makedirs(d, exist_ok=True)


# --------------------------------------------------------------------------------------------- data loading


def read_csv(name: str) -> pd.DataFrame:
    return pd.read_csv(os.path.join(DATA, name), encoding="utf-8-sig")


def survey_path() -> str | None:
    """The Google Form export; the file keeps its download name (data/ is read-only)."""
    for pattern in ("survey.csv", "*Survey*Responses*.csv", "*survey*.csv"):
        hits = sorted(glob.glob(os.path.join(DATA, pattern)))
        if hits:
            return hits[0]
    return None


def z(s: pd.Series) -> pd.Series:
    return (s - s.mean()) / s.std(ddof=1)


def prepare_wide() -> pd.DataFrame:
    """wide.csv, pilots dropped, with the B13 transforms and the plan's codings."""
    df = read_csv("wide.csv")
    df = df[df["is_pilot"] == 0].copy()
    df["fraud"] = (df["skin"] == "fraud").astype(int)
    # B10: recompute overconfidence on the filtered sample
    df["overconfidence"] = z(df["self_rated_literacy"]) - z(df["literacy_score"])
    df["trap_score_shared8"] = df[SHARED8].sum(axis=1)
    df["invested_r1"] = (df["r1_amount"] > 0).astype(int)
    df["log_total_deposited"] = np.log1p(df["total_deposited"])
    df["exp_investing_num"] = df["exp_investing"].map(EXP_INVESTING)
    df["exp_trading_app_num"] = df["exp_trading_app"].map(YES_NO)
    df["exp_fin_edu_num"] = df["exp_fin_edu"].map(YES_NO)
    df["male"] = (df["demo_gender"] == "male").astype(int)
    df["la_group"] = df["loss_aversion_group"]  # numeric 1-3, NaN = inconsistent / missing
    for col in FEATURES:
        df[col + "_yes"] = df[col].map(YES_NO)
    return df


def skin_label(s: str) -> str:
    return {"plain": "honest", "honest": "honest", "fraud": "fraud"}.get(s, s)


# --------------------------------------------------------------------------------------------- statistics


def _clean(x: Iterable) -> np.ndarray:
    a = np.asarray(pd.to_numeric(pd.Series(list(x)), errors="coerce"), dtype=float)
    return a[~np.isnan(a)]


def cliffs_delta(a: np.ndarray, b: np.ndarray) -> float:
    """P(A > B) - P(A < B); equals the rank-biserial correlation of the Mann-Whitney U test."""
    if len(a) == 0 or len(b) == 0:
        return float("nan")
    diff = np.sign(a[:, None] - b[None, :])
    return float(diff.mean())


def boot_ci_two(a: np.ndarray, b: np.ndarray, fn, n=N_BOOT, seed=SEED) -> tuple[float, float]:
    """Percentile bootstrap CI, resampling within each group."""
    rng = np.random.default_rng(seed)
    vals = np.empty(n)
    for i in range(n):
        vals[i] = fn(rng.choice(a, len(a)), rng.choice(b, len(b)))
    vals = vals[~np.isnan(vals)]
    if len(vals) == 0:
        return (float("nan"), float("nan"))
    return float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))


def boot_ci_rows(data: np.ndarray, fn, n=N_BOOT, seed=SEED) -> tuple[float, float]:
    """Percentile bootstrap CI, resampling rows (participants) of a 2-D array."""
    rng = np.random.default_rng(seed)
    m = len(data)
    vals = np.empty(n)
    for i in range(n):
        vals[i] = fn(data[rng.integers(0, m, m)])
    vals = vals[~np.isnan(vals)]
    if len(vals) == 0:
        return (float("nan"), float("nan"))
    return float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))


def wilson(k: int, n: int) -> tuple[float, float]:
    if n == 0:
        return (float("nan"), float("nan"))
    lo, hi = proportion_confint(k, n, method="wilson")
    return float(lo), float(hi)


def odds_ratio(a: int, b: int, c: int, d: int) -> tuple[float, float, float, bool]:
    """2x2 [[a, b], [c, d]] (rows = groups A, B; columns = yes, no). Woolf CI; Haldane +0.5 if any cell is 0."""
    corrected = min(a, b, c, d) == 0
    if corrected:
        a, b, c, d = (x + 0.5 for x in (a, b, c, d))
    or_ = (a * d) / (b * c)
    se = math.sqrt(1 / a + 1 / b + 1 / c + 1 / d)
    lo, hi = math.exp(math.log(or_) - 1.96 * se), math.exp(math.log(or_) + 1.96 * se)
    return or_, lo, hi, corrected


def describe(x: np.ndarray) -> dict:
    if len(x) == 0:
        return {"n": 0}
    return {
        "n": int(len(x)),
        "mean": float(np.mean(x)),
        "median": float(np.median(x)),
        "q1": float(np.percentile(x, 25)),
        "q3": float(np.percentile(x, 75)),
        "min": float(np.min(x)),
        "max": float(np.max(x)),
    }


def holm(pvals: list[float]) -> list[float]:
    ok = [i for i, p in enumerate(pvals) if p is not None and not np.isnan(p)]
    out = [float("nan")] * len(pvals)
    if ok:
        adj = multipletests([pvals[i] for i in ok], method="holm")[1]
        for i, v in zip(ok, adj):
            out[i] = float(v)
    return out


# --------------------------------------------------------------------------------------------- registry


def _jsonable(v: Any) -> Any:
    if isinstance(v, dict):
        return {str(k): _jsonable(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_jsonable(x) for x in v]
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(v, (np.bool_,)):
        return bool(v)
    return v


@dataclass
class Registry:
    tests: list = field(default_factory=list)
    hypotheses: dict = field(default_factory=dict)
    sections: dict = field(default_factory=dict)
    problems: list = field(default_factory=list)

    def add_test(self, **kw) -> dict:
        rec = {
            "id": kw.pop("id"),
            "hypothesis": kw.pop("hypothesis"),
            "role": kw.pop("role"),  # primary | secondary | robustness | exploratory | descriptive | check
            "outcome": kw.pop("outcome", None),
            "prediction": kw.pop("prediction", None),
            "test": kw.pop("test", None),
            "statistic_name": kw.pop("statistic_name", None),
            "statistic": kw.pop("statistic", None),
            "p": kw.pop("p", None),
            "p_holm": None,
            "holm_family": kw.pop("holm_family", None),
            "effect_name": kw.pop("effect_name", None),
            "effect": kw.pop("effect", None),
            "ci_low": kw.pop("ci_low", None),
            "ci_high": kw.pop("ci_high", None),
            "n": kw.pop("n", {}),
            "summary": kw.pop("summary", {}),
            "direction_ok": kw.pop("direction_ok", None),
            "testable": kw.pop("testable", True),
            "note": kw.pop("note", None),
            "interpretation": kw.pop("interpretation", None),
        }
        rec.update(kw)
        self.tests = [t for t in self.tests if t["id"] != rec["id"]]
        self.tests.append(rec)
        return rec

    def get(self, test_id: str) -> dict | None:
        return next((t for t in self.tests if t["id"] == test_id), None)

    def set_hypothesis(self, hid: str, **kw) -> None:
        self.hypotheses.setdefault(hid, {"id": hid}).update(kw)

    def problem(self, text: str) -> None:
        if text not in self.problems:
            self.problems.append(text)

    def save(self, path: str, meta: dict) -> None:
        order = ["H1", "H1a", "H1b", "H1c", "H1d", "H1e", "H1f", "H1g", "H1h",
                 "H2", "H3", "H4", "H5", "H6", "H7", "H8", "H9"]
        hyps = [self.hypotheses[h] for h in order if h in self.hypotheses]
        out = {"meta": meta, "hypotheses": hyps, "tests": self.tests, "sections": self.sections,
               "problems": self.problems}
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(_jsonable(out), f, indent=1, ensure_ascii=False)


# --------------------------------------------------------------------------------------------- standard tests


def fmt_n(n: dict) -> str:
    return ", ".join(f"{k} {v}" for k, v in n.items())


def mwu_test(reg: Registry, *, id, hypothesis, role, outcome, df, group_col, a, b, predicted, prediction,
             label_a=None, label_b=None, holm_family=None, note=None) -> dict:
    """Mann-Whitney U, two-sided; effect = Cliff's delta (A vs B), bootstrap CI.
    predicted: 'greater' (A > B) or 'less' (A < B)."""
    xa = _clean(df.loc[df[group_col] == a, outcome])
    xb = _clean(df.loc[df[group_col] == b, outcome])
    la, lb = label_a or str(a), label_b or str(b)
    n = {la: len(xa), lb: len(xb)}
    summary = {la: describe(xa), lb: describe(xb)}
    if len(xa) < 5 or len(xb) < 5 or (len(np.unique(np.r_[xa, xb])) < 2):
        why = "fewer than 5 players in a group" if min(len(xa), len(xb)) < 5 else "no variance in the outcome"
        return reg.add_test(id=id, hypothesis=hypothesis, role=role, outcome=outcome, prediction=prediction,
                            test="Mann-Whitney U", n=n, summary=summary, testable=False, note=why,
                            holm_family=holm_family)
    res = stats.mannwhitneyu(xa, xb, alternative="two-sided")
    d = cliffs_delta(xa, xb)
    lo, hi = boot_ci_two(xa, xb, cliffs_delta)
    ok = (d > 0) if predicted == "greater" else (d < 0)
    if d == 0:
        ok = None
    return reg.add_test(id=id, hypothesis=hypothesis, role=role, outcome=outcome, prediction=prediction,
                        test="Mann-Whitney U (two-sided)", statistic_name="U", statistic=float(res.statistic),
                        p=float(res.pvalue), effect_name=f"Cliff's δ ({la} vs {lb})", effect=d, ci_low=lo,
                        ci_high=hi, n=n, summary=summary, direction_ok=ok, holm_family=holm_family, note=note,
                        groups=[la, lb], predicted=predicted)


def fisher_test(reg: Registry, *, id, hypothesis, role, outcome, df, group_col, a, b, predicted, prediction,
                label_a=None, label_b=None, holm_family=None, note=None) -> dict:
    """Fisher's exact test on a 2x2 table (group x outcome 1/0); effect = odds ratio (A vs B)."""
    la, lb = label_a or str(a), label_b or str(b)
    ya = _clean(df.loc[df[group_col] == a, outcome])
    yb = _clean(df.loc[df[group_col] == b, outcome])
    ka, na, kb, nb = int(ya.sum()), len(ya), int(yb.sum()), len(yb)
    summary = {}
    for lab, k, nn in ((la, ka, na), (lb, kb, nb)):
        lo, hi = wilson(k, nn)
        summary[lab] = {"n": nn, "yes": k, "share": k / nn if nn else None, "ci_low": lo, "ci_high": hi}
    n = {la: na, lb: nb}
    if na < 5 or nb < 5 or ka + kb in (0, na + nb):
        why = "fewer than 5 players in a group" if min(na, nb) < 5 else "outcome has one value for everyone"
        return reg.add_test(id=id, hypothesis=hypothesis, role=role, outcome=outcome, prediction=prediction,
                            test="Fisher's exact test", n=n, summary=summary, testable=False, note=why,
                            holm_family=holm_family)
    table = [[ka, na - ka], [kb, nb - kb]]
    _, p = stats.fisher_exact(table, alternative="two-sided")
    or_, lo, hi, corrected = odds_ratio(ka, na - ka, kb, nb - kb)
    ok = (or_ > 1) if predicted == "greater" else (or_ < 1)
    if or_ == 1:
        ok = None
    extra = " (Haldane +0.5 correction, a cell was 0)" if corrected else ""
    return reg.add_test(id=id, hypothesis=hypothesis, role=role, outcome=outcome, prediction=prediction,
                        test="Fisher's exact test (two-sided)", statistic_name="OR", statistic=or_,
                        p=float(p), effect_name=f"Odds ratio ({la} vs {lb}){extra}", effect=or_, ci_low=lo,
                        ci_high=hi, n=n, summary=summary, direction_ok=ok, holm_family=holm_family,
                        note=note, groups=[la, lb], predicted=predicted,
                        risk_difference=(ka / na - kb / nb))


def share_record(reg: Registry, *, id, hypothesis, role, outcome, series: pd.Series, prediction=None,
                 note=None) -> dict:
    s = series.dropna()
    k, n = int(s.sum()), int(len(s))
    lo, hi = wilson(k, n)
    return reg.add_test(id=id, hypothesis=hypothesis, role=role, outcome=outcome, prediction=prediction,
                        test="Share with Wilson 95% CI (no test)", effect_name="Share", effect=k / n if n else None,
                        ci_low=lo, ci_high=hi, n={"players": n}, summary={"yes": k, "n": n},
                        testable=n > 0, note=note)


def save_table(df: pd.DataFrame, name: str) -> str:
    path = os.path.join(TABLES, name + ".csv")
    df.to_csv(path, index=False, encoding="utf-8", lineterminator="\n")
    return path


def tests_table(reg: Registry, prefix: str) -> pd.DataFrame:
    rows = []
    for t in reg.tests:
        if t["hypothesis"] == prefix or t["id"].startswith(prefix + "."):
            rows.append({k: t.get(k) for k in ("id", "hypothesis", "role", "outcome", "prediction", "test",
                                              "statistic_name", "statistic", "p", "p_holm", "effect_name",
                                              "effect", "ci_low", "ci_high")} | {"n": fmt_n(t["n"]),
                                                                                  "direction_ok": t["direction_ok"],
                                                                                  "testable": t["testable"],
                                                                                  "note": t["note"]})
    return pd.DataFrame(rows)


# --------------------------------------------------------------------------------------------- figures

BG = "#1a1a19"
INK = "#f0efec"
INK2 = "#c3c2b7"
GRID = "#383835"
C1 = "#3987e5"  # categorical slot 1 (blue)
C2 = "#d95926"  # slot 2 (orange)
C3 = "#199e70"  # slot 3 (aqua)
GROUP_COLORS = {"honest": C1, "fraud": C2}


def style() -> None:
    plt.rcParams.update({
        "figure.facecolor": BG, "axes.facecolor": BG, "savefig.facecolor": BG,
        "axes.edgecolor": GRID, "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
        "text.color": INK, "axes.titlecolor": INK, "axes.grid": True, "grid.color": GRID,
        "grid.linewidth": 0.6, "axes.axisbelow": True, "axes.spines.top": False, "axes.spines.right": False,
        "font.size": 11, "axes.titlesize": 12.5, "axes.titleweight": "bold", "axes.labelsize": 11,
        "legend.frameon": False, "figure.dpi": 100,
    })


def savefig(fig, name: str) -> str:
    path = os.path.join(FIGURES, name + ".png")
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


def strip_box(ax, groups: list[tuple[str, np.ndarray, str]], ylabel: str, title: str | None = None,
              log: bool = False) -> None:
    """Every player as a dot (jittered) with a median bar and IQR box: honest for small n."""
    rng = np.random.default_rng(SEED)
    for i, (lab, x, color) in enumerate(groups):
        if len(x):
            q1, med, q3 = np.percentile(x, [25, 50, 75])
            ax.add_patch(plt.Rectangle((i - 0.28, q1), 0.56, max(q3 - q1, 1e-9), facecolor=color, alpha=0.18,
                                       edgecolor="none"))
            ax.plot([i - 0.3, i + 0.3], [med, med], color=INK, lw=2, solid_capstyle="round", zorder=4)
            ax.scatter(i + rng.uniform(-0.18, 0.18, len(x)), x, s=26, color=color, alpha=0.85,
                       edgecolor=BG, linewidth=0.6, zorder=3)
    ax.set_xticks(range(len(groups)))
    ax.set_xticklabels([f"{lab}\n(n = {len(x)})" for lab, x, _ in groups])
    ax.set_xlim(-0.6, len(groups) - 0.4)
    ax.set_ylabel(ylabel)
    if log:
        ax.set_yscale("symlog", linthresh=1)
    ax.grid(axis="x", visible=False)
    if title:
        ax.set_title(title, loc="left")


def share_bars(ax, groups: list[tuple[str, int, int, str]], ylabel: str, title: str | None = None) -> None:
    """Share with Wilson 95% CI per group; label = k/n."""
    for i, (lab, k, n, color) in enumerate(groups):
        p = k / n if n else 0
        lo, hi = wilson(k, n)
        ax.bar(i, p, width=0.55, color=color, zorder=2)
        ax.errorbar(i, p, yerr=[[p - lo], [hi - p]], color=INK, capsize=5, lw=1.4, zorder=3)
        ax.text(i, hi + 0.03, f"{k}/{n}", ha="center", va="bottom", color=INK, fontsize=10.5)
    ax.set_xticks(range(len(groups)))
    ax.set_xticklabels([f"{lab}\n(n = {n})" for lab, _, n, _ in groups])
    ax.set_ylim(0, 1.12)
    ax.set_ylabel(ylabel)
    ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0))
    ax.grid(axis="x", visible=False)
    if title:
        ax.set_title(title, loc="left")


def caption(fig, text: str) -> None:
    fig.text(0.01, -0.02, text, ha="left", va="top", color=INK2, fontsize=9.5, wrap=True)
