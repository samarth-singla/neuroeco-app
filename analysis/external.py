"""Step 4b - dataset parts of H8 and H9 on an external population survey (DATA_COLLECTION_REPORT.md, Part D).

All dataset-specific names come from analysis/external_config.yaml. If data/external/ has no data file or the config
still contains TODO, the module skips cleanly and both parts are PENDING everywhere. Once the dataset is added and
the config filled, run_all.py produces the results with no code changes.

Models (survey weights used when configured: GLM binomial with normalized variance weights and HC1 robust SEs;
otherwise maximum-likelihood logistic regression):
- H8: victim ~ literacy_score + overconfidence + C(age_group) + male + C(income_group) + investing_experience,
  overconfidence = z(self-rated knowledge) - z(literacy score).
  Verdict (same rule as the app part, on the odds-ratio scale): SUPPORTED if the overconfidence OR > 1 with p < 0.05
  and the literacy OR's 95% CI is not entirely below 1; PARTLY SUPPORTED if OR > 1 with 0.05 <= p < 0.10 and the
  literacy CI is not entirely below 1; otherwise NOT SUPPORTED.
- H9: for each grouping (age group, income group, gender): victim ~ (bias proxies) x C(group) + other controls, with a
  joint Wald test of all bias x group interactions, plus separate models within each group to name the bias with the
  largest standardized effect (bias proxies are z-scored). Verdict: SUPPORTED if, for at least one grouping, the
  joint interaction p < 0.05 and the strongest bias differs between that grouping's groups (with only one bias proxy:
  if its slope differs, p < 0.05); PARTLY SUPPORTED if the smallest such p is in [0.05, 0.10); otherwise NOT
  SUPPORTED. Holm-adjusted p-values over the three groupings are reported.
"""

from __future__ import annotations

import os
import warnings

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf
import yaml

from common import BG, C1, C2, C3, DATA, INK, INK2, Registry, holm, save_table, savefig

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(HERE, "external_config.yaml")
EXTERNAL_DIR = os.path.join(DATA, "external")
GROUPINGS = {"age_group": "Age group", "income_group": "Income group", "gender": "Gender"}


# ---------------------------------------------------------------------------------------------------- config


def load_config(path: str = CONFIG) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def todo_fields(obj, prefix: str = "") -> list[str]:
    """Dotted paths of every TODO left in the config (as a value or as a mapping key)."""
    out = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = f"{prefix}.{k}" if prefix else str(k)
            if str(k).strip().upper() == "TODO":
                out.append(prefix or "(root)")
            out += todo_fields(v, p)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            out += todo_fields(v, f"{prefix}[{i}]")
    elif isinstance(obj, str) and obj.strip().upper() == "TODO":
        out.append(prefix)
    return sorted(set(out))


def status_pending(reason: str, todo: list[str] | None = None) -> dict:
    s = {"status": "pending", "verdict": "PENDING", "reason": reason}
    if todo:
        s["todo"] = todo
    return {"H8": dict(s), "H9": dict(s)}


# ---------------------------------------------------------------------------------------------------- data


def _read(cfg: dict, data_dir: str) -> pd.DataFrame:
    path = os.path.join(data_dir, cfg["dataset"]["file"])
    fmt = str(cfg["dataset"].get("format", "csv")).lower()
    if fmt == "stata":
        return pd.read_stata(path, convert_categoricals=False)
    return pd.read_csv(path, encoding="utf-8-sig", low_memory=False)


def _norm(v):
    """Compare codes as text so 1, 1.0 and '1' match."""
    if pd.isna(v):
        return None
    try:
        f = float(v)
        return str(int(f)) if f.is_integer() else str(f)
    except (TypeError, ValueError):
        return str(v).strip()


def _codes(values) -> set:
    return {_norm(v) for v in (values or [])}


def _z(s: pd.Series) -> pd.Series:
    return (s - s.mean()) / s.std(ddof=1)


def build(cfg: dict, raw: pd.DataFrame) -> pd.DataFrame:
    miss = _codes(cfg.get("missing_values"))
    col = lambda name: raw[name].map(_norm).where(lambda s: ~s.isin(miss))  # noqa: E731

    d = pd.DataFrame(index=raw.index)
    v = cfg["victimization"]
    vic = col(v["column"])
    d["victim"] = np.where(vic.isin(_codes(v["yes_values"])), 1.0,
                           np.where(vic.isin(_codes(v["no_values"])), 0.0, np.nan))

    items = cfg["literacy"]["items"]
    correct = []
    for it in items:
        x = col(it["column"])
        c = x.isin(_codes(it["correct"])).astype(float)
        if not cfg["literacy"].get("dont_know_is_wrong", True):
            c[x.isna()] = np.nan  # "don't know" / missing codes -> missing instead of wrong
        c[raw[it["column"]].isna()] = np.nan  # blank in the file -> missing
        correct.append(c)
    d["literacy_score"] = pd.concat(correct, axis=1).sum(axis=1, min_count=len(items))

    s = cfg["self_rated_knowledge"]
    self_r = pd.to_numeric(col(s["column"]), errors="coerce")
    d["self_rated"] = -self_r if s.get("reverse") else self_r

    for key in ("age_group", "income_group"):
        g = cfg[key]
        labels = {_norm(k): str(lab) for k, lab in (g.get("labels") or {}).items()}
        x = col(g["column"])
        d[key] = x.map(labels) if labels else x
    gcol = col(cfg["gender"]["column"])
    d["male"] = np.where(gcol.isna(), np.nan, gcol.isin(_codes(cfg["gender"]["male_values"])).astype(float))
    d["gender"] = np.where(d["male"].isna(), None, np.where(d["male"] == 1, "male", "not male"))

    ie = cfg["investing_experience"]
    x = col(ie["column"])
    labels = {_norm(k): lab for k, lab in (ie.get("labels") or {}).items()}
    d["investing_experience"] = pd.to_numeric(x.map(labels) if labels else x, errors="coerce")

    ra = cfg.get("risk_attitude") or {}
    if ra.get("column"):
        r = pd.to_numeric(col(ra["column"]), errors="coerce")
        d["risk_attitude"] = -r if ra.get("reverse") else r
    w = (cfg.get("weights") or {}).get("column")
    d["weight"] = pd.to_numeric(raw[w], errors="coerce") if w else 1.0

    d = d.dropna(subset=["victim", "literacy_score", "self_rated"])
    d["overconfidence"] = _z(d["self_rated"]) - _z(d["literacy_score"])
    d["overconfidence_z"] = _z(d["overconfidence"])
    if "risk_attitude" in d:
        d["risk_attitude_z"] = _z(d["risk_attitude"])
    d["weight"] = d["weight"] / d["weight"].mean()
    return d


def fit(formula: str, d: pd.DataFrame, weighted: bool):
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        if weighted:
            m = smf.glm(formula, data=d, family=sm.families.Binomial(), var_weights=d["weight"]).fit(cov_type="HC1")
        else:
            m = smf.logit(formula, data=d).fit(disp=0, maxiter=300)
    bad = [str(w.message) for w in caught if "converg" in str(w.message).lower() or "separation" in str(w.message).lower()]
    if bad:
        raise RuntimeError("; ".join(bad))
    return m


def _or_row(m, term):
    ci = m.conf_int()
    return {"term": term, "coef": float(m.params[term]), "odds_ratio": float(np.exp(m.params[term])),
            "or_ci_low": float(np.exp(ci.loc[term, 0])), "or_ci_high": float(np.exp(ci.loc[term, 1])),
            "p": float(m.pvalues[term])}


# ---------------------------------------------------------------------------------------------------- run


def run(reg: Registry, config_path: str = CONFIG, data_dir: str = EXTERNAL_DIR) -> dict:
    if not os.path.isdir(data_dir):
        return status_pending("data/external/ does not exist")
    try:
        cfg = load_config(config_path)
    except (OSError, yaml.YAMLError) as e:
        return status_pending(f"config could not be read: {e}")
    todo = todo_fields(cfg)
    files = [f for f in os.listdir(data_dir) if not f.lower().startswith("readme")]
    if not files:
        return status_pending("no dataset file in data/external/ yet", todo)
    if todo:
        return status_pending("analysis/external_config.yaml still has TODO fields", todo)
    path = os.path.join(data_dir, cfg["dataset"]["file"])
    if not os.path.exists(path):
        return status_pending(f"configured file not found: data/external/{cfg['dataset']['file']}")

    raw = _read(cfg, data_dir)
    d = build(cfg, raw)
    weighted = bool((cfg.get("weights") or {}).get("column"))
    info = {"name": cfg["dataset"].get("name"), "source": cfg["dataset"].get("source"),
            "country": cfg["dataset"].get("country"), "rows_in_file": int(len(raw)), "rows_used": int(len(d)),
            "victims": int(d["victim"].sum()), "weighted": weighted,
            "literacy_distribution": {str(int(k)): int(v) for k, v in d["literacy_score"].value_counts().sort_index().items()}}
    reg.sections["external_dataset"] = info
    status = {"H8": h8(reg, d, weighted), "H9": h9(reg, d, weighted)}
    for k in status:
        status[k]["dataset"] = info["name"]
    return status


def h8(reg: Registry, d: pd.DataFrame, weighted: bool) -> dict:
    controls = "C(age_group) + male + C(income_group) + investing_experience"
    dd = d.dropna(subset=["age_group", "income_group", "male", "investing_experience"])
    try:
        m = fit(f"victim ~ literacy_score + overconfidence + {controls}", dd, weighted)
    except Exception as e:  # noqa: BLE001
        reg.problem(f"H8 dataset model could not be fitted: {e}")
        reg.add_test(id="H8.dataset", hypothesis="H8", role="primary-dataset", outcome="victimization",
                     test="Logistic regression (not fitted)", testable=False, note=str(e))
        return {"status": "done", "verdict": "NOT TESTABLE", "reason": f"model not fitted: {e}"}
    rows = [_or_row(m, t) for t in m.params.index]
    save_table(pd.DataFrame(rows), "external_H8_logit")
    oc, lit = _or_row(m, "overconfidence"), _or_row(m, "literacy_score")
    test = ("Logistic regression" + (" (survey-weighted GLM, HC1 SEs)" if weighted else "") +
            ": victim ~ literacy + overconfidence + age group + gender + income group + investing experience")
    reg.add_test(id="H8.dataset", hypothesis="H8", role="primary-dataset", outcome="victimization",
                 prediction="overconfidence OR > 1", test=test, statistic_name="z", p=oc["p"],
                 statistic=float(m.tvalues["overconfidence"]), effect_name="Odds ratio per unit of overconfidence",
                 effect=oc["odds_ratio"], ci_low=oc["or_ci_low"], ci_high=oc["or_ci_high"],
                 n={"respondents": int(m.nobs), "victims": int(dd["victim"].sum())}, direction_ok=oc["odds_ratio"] > 1)
    reg.add_test(id="H8.dataset.literacy", hypothesis="H8", role="secondary-dataset", outcome="victimization",
                 prediction="literacy OR not below 1 (CI not entirely < 1)", test=test, statistic_name="z",
                 statistic=float(m.tvalues["literacy_score"]), p=lit["p"],
                 effect_name="Odds ratio per extra correct literacy answer", effect=lit["odds_ratio"],
                 ci_low=lit["or_ci_low"], ci_high=lit["or_ci_high"], n={"respondents": int(m.nobs)},
                 direction_ok=lit["or_ci_high"] >= 1)
    if lit["or_ci_high"] < 1:
        v, r = "NOT SUPPORTED", "literacy OR CI entirely below 1: literacy protects in the dataset"
    elif oc["odds_ratio"] > 1 and oc["p"] < 0.05:
        v, r = "SUPPORTED", f"overconfidence OR > 1 (p = {oc['p']:.3f}); literacy CI not entirely below 1"
    elif oc["odds_ratio"] > 1 and oc["p"] < 0.10:
        v, r = "PARTLY SUPPORTED", f"overconfidence OR > 1 with p = {oc['p']:.3f}; literacy CI not entirely below 1"
    else:
        v, r = "NOT SUPPORTED", f"overconfidence OR = {oc['odds_ratio']:.2f}, p = {oc['p']:.3f}"

    fig, ax = plt.subplots(figsize=(8, 3.2), layout="constrained")
    for y, (row, lab) in enumerate(((oc, "Overconfidence"), (lit, "Literacy score"))):
        ax.plot([row["or_ci_low"], row["or_ci_high"]], [y, y], color=C2, lw=2)
        ax.scatter([row["odds_ratio"]], [y], color=C2, s=60, zorder=3, edgecolor=BG)
    ax.axvline(1, color=INK2, lw=1)
    _log_axis(ax)
    ax.set_yticks([0, 1])
    ax.set_yticklabels(["Overconfidence", "Literacy score"])
    ax.set_xlabel("Odds ratio of fraud victimization (95% CI, log scale)")
    ax.set_title(f"External dataset: H8 (n = {int(m.nobs)})", loc="left")
    savefig(fig, "external_H8")
    return {"status": "done", "verdict": v, "reason": r, "n": int(m.nobs)}


def h9(reg: Registry, d: pd.DataFrame, weighted: bool) -> dict:
    biases = ["overconfidence_z"] + (["risk_attitude_z"] if "risk_attitude_z" in d else [])
    names = {"overconfidence_z": "overconfidence", "risk_attitude_z": "risk attitude"}
    base_controls = {"age_group": "C(age_group)", "income_group": "C(income_group)", "gender": "male"}
    strongest_rows, results = [], []
    for g, glabel in GROUPINGS.items():
        dd = d.dropna(subset=["age_group", "income_group", "male", "investing_experience", *biases])
        others = " + ".join([v for k, v in base_controls.items() if k != g] + ["investing_experience"])
        inter = " + ".join(f"{b} * C({g})" for b in biases)
        try:
            m = fit(f"victim ~ {inter} + {others}", dd, weighted)
            idx = [i for i, t in enumerate(m.params.index) if ":" in t and any(t.startswith(b + ":") for b in biases)]
            R = np.zeros((len(idx), len(m.params)))
            for r_, i in enumerate(idx):
                R[r_, i] = 1
            wt = m.wald_test(R, scalar=True)
            p = float(np.asarray(wt.pvalue).ravel()[0])
            stat = float(np.asarray(wt.statistic).ravel()[0])
        except Exception as e:  # noqa: BLE001
            reg.problem(f"H9 dataset interaction model ({glabel}) could not be fitted: {e}")
            results.append({"grouping": g, "p": None, "differs": False})
            continue
        best = {}
        for level, sub in dd.groupby(g):
            try:
                ms = fit(f"victim ~ {' + '.join(biases)} + {others}", sub, weighted)
            except Exception as e:  # noqa: BLE001
                reg.problem(f"H9 dataset model within {glabel} = {level} not fitted: {e}")
                continue
            rows = [_or_row(ms, b) | {"grouping": g, "group": str(level), "bias": names[b], "n": int(ms.nobs)}
                    for b in biases]
            top = max(rows, key=lambda r: abs(r["coef"]))
            best[str(level)] = top["bias"]
            for r in rows:
                strongest_rows.append(r | {"strongest_in_group": r["bias"] == top["bias"]})
        differs = len(set(best.values())) > 1 if len(biases) > 1 else True
        results.append({"grouping": g, "p": p, "differs": differs, "strongest": best})
        reg.add_test(id=f"H9.dataset.{g}", hypothesis="H9", role="primary-dataset", outcome="victimization",
                     prediction=f"bias effects differ across {glabel.lower()}s",
                     test="Joint Wald test of bias × group interactions (logistic" +
                          (", survey-weighted, HC1" if weighted else "") + ")",
                     statistic_name="Wald χ²", statistic=stat, p=p, n={"respondents": int(m.nobs)},
                     direction_ok=differs, strongest_bias_by_group=best)
    for r, ph in zip(results, holm([r["p"] if r["p"] is not None else np.nan for r in results])):
        r["p_holm"] = ph
        t = reg.get(f"H9.dataset.{r['grouping']}")
        if t:
            t["p_holm"] = ph
    reg.tests = [t for t in reg.tests if t["id"] != "H9.dataset"]
    if strongest_rows:
        save_table(pd.DataFrame(strongest_rows), "external_H9_by_group")
        _h9_figure(pd.DataFrame(strongest_rows))
    ok = [r for r in results if r["p"] is not None and r["differs"]]
    pmin = min((r["p"] for r in ok), default=None)
    if pmin is not None and pmin < 0.05:
        v = "SUPPORTED"
    elif pmin is not None and pmin < 0.10:
        v = "PARTLY SUPPORTED"
    else:
        v = "NOT SUPPORTED"
    return {"status": "done", "verdict": v,
            "reason": "smallest interaction p = " + (f"{pmin:.3f}" if pmin is not None else "n/a") +
                      " among groupings where the strongest bias differs", "groupings": results}


def _log_axis(ax) -> None:
    """Log-scaled odds-ratio axis with plain number labels (no clutter from minor ticks)."""
    from matplotlib.ticker import FuncFormatter, LogLocator, NullFormatter

    ax.set_xscale("log")
    ax.xaxis.set_major_locator(LogLocator(base=10, subs=(1.0, 1.2, 1.5, 2.0, 3.0, 5.0), numticks=20))
    ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:g}"))
    ax.xaxis.set_minor_formatter(NullFormatter())


def _h9_figure(t: pd.DataFrame) -> None:
    groupings = list(dict.fromkeys(t["grouping"]))
    fig, axes = plt.subplots(1, len(groupings), figsize=(5 * len(groupings), 4.2), layout="constrained", squeeze=False)
    colors = {"overconfidence": C2, "risk attitude": C1}
    for ax, g in zip(axes[0], groupings):
        s = t[t["grouping"] == g]
        levels = list(dict.fromkeys(s["group"]))
        bias_list = list(dict.fromkeys(s["bias"]))
        offsets = (0.0,) if len(bias_list) == 1 else (-0.15, 0.15)
        for off, bias in zip(offsets, bias_list):
            b = s[s["bias"] == bias].set_index("group").reindex(levels)
            y = np.arange(len(levels)) + off
            ax.hlines(y, b["or_ci_low"], b["or_ci_high"], color=colors.get(bias, C3), lw=2)
            ax.scatter(b["odds_ratio"], y, color=colors.get(bias, C3), s=45, zorder=3, edgecolor=BG, label=bias)
        ax.axvline(1, color=INK2, lw=1)
        _log_axis(ax)
        ax.set_yticks(range(len(levels)))
        ax.set_yticklabels(levels)
        ax.set_title(GROUPINGS[g], loc="left")
        ax.set_xlabel("OR per SD (95% CI)")
    handles, labels = axes[0][0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="outside lower center", ncol=len(labels))
    fig.suptitle("External dataset: H9 — bias effect on victimization by group", color=INK, x=0.01, ha="left")
    savefig(fig, "external_H9")
