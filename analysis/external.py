"""Dataset parts of H8 and H9 on the NFCS 2024 surveys (DATA_COLLECTION_REPORT.md, Part D).

All dataset-specific names and codes are in analysis/external_config.yaml. If a configured data file is missing, the
module skips cleanly and both parts stay PENDING.

Estimation: survey-weighted logistic regression = GLM binomial with the survey weight (normalized to mean 1 in each
model sample) as variance weights and HC1 robust standard errors. Literacy, self-rating and overconfidence are
standardized (unweighted z over the respondents with both literacy and self-rating);
overconfidence = z(self-rating) - z(literacy), entered as z(overconfidence). Odds ratios are per 1 SD.

Reparameterization (reported for every State-by-State outcome): with OC = z(self) - z(lit) and s = SD(OC),
  a*z(lit) + b*z(OC) = a*z(lit) + (b/s)*(z(self) - z(lit)) = (a - b/s)*z(lit) + (b/s)*z(self),
so the model with z(lit) and z(self) is the same model; only the meaning of the literacy coefficient changes
(effect of literacy at equal overconfidence vs at equal self-rating).

Pre-registered verdict rules (written before any dataset existed; see ANALYSIS_PROGRESS.md):
- H8 (dataset part; primary model fixed in the config before fitting = Investor Survey, targeted by investment
  fraud): SUPPORTED if the overconfidence OR > 1 with p < 0.05 and the literacy OR's 95% CI is not entirely below 1;
  PARTLY SUPPORTED if OR > 1 with 0.05 <= p < 0.10 and the literacy CI is not entirely below 1; otherwise NOT
  SUPPORTED. The final H8 verdict combines app and dataset parts (verdicts.combine).
- H9 (primary outcome fixed in the config = State-by-State, lost money): for each grouping (age, income, gender), a
  joint Wald test of all bias x group interactions (bias proxies: overconfidence, risk willingness) plus separate
  models within each group naming the bias with the largest standardized effect. SUPPORTED if for at least one
  grouping the joint p < 0.05 and the strongest bias differs between that grouping's groups; PARTLY SUPPORTED if the
  smallest such p is in [0.05, 0.10); otherwise NOT SUPPORTED. Holm-adjusted p over the three groupings is reported
  within each outcome. The within-group models are exploratory.
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
GROUPINGS = {"gender": "Gender", "age": "Age group", "income": "Income group"}
STATE_OUTCOMES = {"targeted": "targeted by a fraud or scam (past year)",
                  "lost_all": "lost money to a fraud (all respondents)",
                  "lost_targeted": "lost money (among those targeted)"}
# Teammate's NFCS report (State-by-State): odds ratios for literacy and overconfidence
TEAMMATE = {"targeted": (0.88, 0.92), "lost_all": (0.71, 0.90), "lost_targeted": (0.65, 0.88)}
STATE_CONTROLS = "fin_edu + C(age) + male + C(income) + z_risk + owns_inv"
INV_CONTROLS = "C(age) + male + C(income)"


# ------------------------------------------------------------------------------------------------- loading


def load_config(path: str = CONFIG) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def todo_fields(obj, prefix: str = "") -> list[str]:
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


def _read(data_dir: str, rel: str) -> pd.DataFrame:
    path = os.path.join(data_dir, rel)
    if path.lower().endswith(".dta"):
        return pd.read_stata(path, convert_categoricals=False)
    return pd.read_csv(path, encoding="utf-8-sig", low_memory=False)


def yn(s: pd.Series, spec: dict) -> pd.Series:
    return pd.Series(np.where(s.isin(spec["yes_codes"]), 1.0, np.where(s.isin(spec["no_codes"]), 0.0, np.nan)), index=s.index)


def score(raw: pd.DataFrame, items: list[dict], dont_know: int, refused: int) -> pd.Series:
    """Number correct; don't know = wrong; refused or blank on any item = missing."""
    parts = []
    for it in items:
        x = raw[it["column"]]
        c = x.isin(it["correct"]).astype(float)
        c[x.isna() | (x == refused)] = np.nan
        parts.append(c)
    return pd.concat(parts, axis=1).sum(axis=1, min_count=len(items))


def scale(raw: pd.Series, dont_know: int, refused: int) -> pd.Series:
    return raw.where(~raw.isin([dont_know, refused]))


def _z(s: pd.Series) -> pd.Series:
    return (s - s.mean()) / s.std(ddof=1)


def add_z(d: pd.DataFrame, lit: str, self_col: str) -> tuple[pd.DataFrame, float]:
    base = d[lit].notna() & d[self_col].notna()
    d.loc[base, "z_lit"] = _z(d.loc[base, lit])
    d.loc[base, "z_self"] = _z(d.loc[base, self_col])
    d["oc_raw"] = d["z_self"] - d["z_lit"]
    s_oc = float(d.loc[base, "oc_raw"].std(ddof=1))
    d.loc[base, "z_oc"] = (d.loc[base, "oc_raw"] - d.loc[base, "oc_raw"].mean()) / s_oc
    return d, s_oc


def build_state(cfg: dict, raw: pd.DataFrame) -> tuple[pd.DataFrame, float]:
    c, dk, rf = cfg["state"], cfg["dont_know"], cfg["refused"]
    d = pd.DataFrame(index=raw.index)
    d["id"] = raw[c["id"]]
    d["w"] = raw[c["weight"]].astype(float)
    d["targeted"] = yn(raw[c["targeted"]["column"]], c["targeted"])
    lost = yn(raw[c["lost"]["column"]], c["lost"])
    d["lost_all"] = np.where(d["targeted"] == 0, 0.0, np.where(d["targeted"] == 1, lost, np.nan))
    d["lost_targeted"] = np.where(d["targeted"] == 1, lost, np.nan)
    d["lit"] = score(raw, c["literacy"], dk, rf)
    d["self"] = scale(raw[c["self_rated"]["column"]], dk, rf)
    d["fin_edu"] = yn(raw[c["fin_edu"]["column"]], c["fin_edu"])
    d["age"] = raw[c["age"]["column"]].map(c["age"]["labels"])
    d["income"] = raw[c["income"]["column"]].map(c["income"]["labels"])
    d["male"] = raw[c["gender"]["column"]].isin(c["gender"]["male_codes"]).astype(float)
    d["gender"] = np.where(d["male"] == 1, "male", "female")
    risk = scale(raw[c["risk"]["column"]], dk, rf)
    d["z_risk"] = _z(risk)
    d["owns_inv"] = yn(raw[c["owns_investments"]["column"]], c["owns_investments"])
    return add_z(d, "lit", "self")


def build_investor(cfg: dict, raw: pd.DataFrame, state_raw: pd.DataFrame) -> tuple[pd.DataFrame, float, dict]:
    c, dk, rf = cfg["investor"], cfg["dont_know"], cfg["refused"]
    d = pd.DataFrame(index=raw.index)
    d["id"] = raw[c["id"]]
    d["w"] = raw[c["weight"]].astype(float)
    d["targeted"] = yn(raw[c["targeted"]["column"]], c["targeted"])
    lost = yn(raw[c["lost"]["column"]], c["lost"])
    d["lost_all"] = np.where(d["targeted"] == 0, 0.0, np.where(d["targeted"] == 1, lost, np.nan))
    d["quiz"] = score(raw, c["quiz"], dk, rf)
    d["self"] = scale(raw[c["self_rated"]["column"]], dk, rf)
    g = raw[c["guaranteed"]["column"]]
    d["guaranteed"] = np.where(g.isin(c["guaranteed"]["yes_codes"]), 1.0, np.where(g.isin(c["guaranteed"]["no_codes"]), 0.0,
                                                                              np.nan))
    d["guaranteed_or_unsure"] = np.where(g.isin(c["guaranteed"]["yes_codes"] + c["guaranteed"]["not_sure_codes"]), 1.0,
                                         np.where(g.isin(c["guaranteed"]["no_codes"]), 0.0, np.nan))
    d["regulator"] = yn(raw[c["checked_regulator"]["column"]], c["checked_regulator"])
    d["finfluencer"] = yn(raw[c["finfluencer"]["column"]], c["finfluencer"])
    d["age"] = raw[c["age"]["column"]].map(c["age"]["labels"])
    d["income"] = raw[c["income"]["column"]].map(c["income"]["labels"])
    d["male"] = raw[c["gender"]["column"]].isin(c["gender"]["male_codes"]).astype(float)
    d, s_oc = add_z(d, "quiz", "self")
    # Link to the State-by-State answers (Big Three robustness)
    s = cfg["state"]
    st = pd.DataFrame({"id": state_raw[s["id"]], "big3": score(state_raw, s["literacy"], dk, rf),
                       "self_fin": scale(state_raw[s["self_rated"]["column"]], dk, rf)})
    d = d.merge(st, on="id", how="left")
    link = {"investor_rows": int(len(d)), "matched_in_state_file": int(d["big3"].notna().sum())}
    b = d["big3"].notna() & d["self_fin"].notna()
    d.loc[b, "z_big3"] = _z(d.loc[b, "big3"])
    oc3 = _z(d.loc[b, "self_fin"]) - d.loc[b, "z_big3"]
    d.loc[b, "z_oc_big3"] = _z(oc3)
    return d, s_oc, link


# ------------------------------------------------------------------------------------------------- models


def fit(formula: str, d: pd.DataFrame):
    """Survey-weighted logistic regression (GLM binomial, variance weights normalized to mean 1, HC1 SEs)."""
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        m = smf.glm(formula, data=d, family=sm.families.Binomial(), var_weights=d["w"] / d["w"].mean()).fit(
            cov_type="HC1")
    bad = [str(w.message) for w in caught if "converg" in str(w.message).lower()
           or "separation" in str(w.message).lower() or "overflow" in str(w.message).lower()]
    if bad:
        raise RuntimeError("; ".join(bad))
    return m


def orow(m, term: str) -> dict:
    ci = m.conf_int()
    return {"term": term, "coef": float(m.params[term]), "odds_ratio": float(np.exp(m.params[term])),
            "or_ci_low": float(np.exp(ci.loc[term, 0])), "or_ci_high": float(np.exp(ci.loc[term, 1])),
            "p": float(m.pvalues[term]), "z": float(m.tvalues[term])}


def model_frame(d: pd.DataFrame, y: str, cols: list[str]) -> pd.DataFrame:
    return d.dropna(subset=[y, "w", *cols]).copy()


def wshare(d: pd.DataFrame, col: str) -> float:
    x = d.dropna(subset=[col])
    return float(np.average(x[col], weights=x["w"])) if len(x) else float("nan")


def register_pair(reg: Registry, *, base_id: str, hypothesis: str, role: str, m, outcome: str, label: str,
                  lit_term: str, oc_term: str, events: int, k_params: int, oc_pred: str = ">", note: str | None = None,
                  lit_name: str = "literacy") -> tuple[dict, dict]:
    oc, lit = orow(m, oc_term), orow(m, lit_term)
    epv = events / max(k_params, 1)
    low = epv < 10
    n = {"respondents": int(m.nobs), "events": int(events)}
    common = dict(hypothesis=hypothesis, outcome=outcome, test="Survey-weighted logistic regression (HC1 SEs)",
                  n=n, low_power=bool(low), events_per_parameter=round(epv, 1), dataset_label=label)
    if note:
        common["note"] = note
    elif low:
        common["note"] = f"LOW POWER: {events} events for {k_params} parameters ({epv:.1f} per parameter < 10)."
    r1 = reg.add_test(id=base_id, role=role, prediction=f"overconfidence OR {oc_pred} 1 ({label})",
                      statistic_name="z", statistic=oc["z"], p=oc["p"],
                      effect_name="Odds ratio per SD of overconfidence", effect=oc["odds_ratio"],
                      ci_low=oc["or_ci_low"], ci_high=oc["or_ci_high"],
                      direction_ok=(oc["odds_ratio"] > 1) if oc_pred == ">" else (oc["odds_ratio"] < 1), **common)
    r2 = reg.add_test(id=base_id + ".literacy", role=role.replace("primary", "secondary"),
                      prediction=f"{lit_name} OR not protective (CI not entirely on the protective side) ({label})",
                      statistic_name="z", statistic=lit["z"], p=lit["p"],
                      effect_name=f"Odds ratio per SD of {lit_name}", effect=lit["odds_ratio"],
                      ci_low=lit["or_ci_low"], ci_high=lit["or_ci_high"],
                      direction_ok=lit["or_ci_high"] >= 1 if oc_pred == ">" else lit["or_ci_low"] <= 1, **common)
    return r1, r2


# ------------------------------------------------------------------------------------------------- run


def run(reg: Registry, config_path: str = CONFIG, data_dir: str = EXTERNAL_DIR) -> dict:
    if not os.path.isdir(data_dir):
        return status_pending("data/external/ does not exist")
    try:
        cfg = load_config(config_path)
    except (OSError, yaml.YAMLError) as e:
        return status_pending(f"config could not be read: {e}")
    todo = todo_fields(cfg)
    if todo:
        return status_pending("analysis/external_config.yaml still has TODO fields", todo)
    for part in ("state", "investor"):
        if not os.path.exists(os.path.join(data_dir, cfg[part]["file"])):
            return status_pending(f"data file not found: data/external/{cfg[part]['file']}")

    st_raw = _read(data_dir, cfg["state"]["file"])
    inv_raw = _read(data_dir, cfg["investor"]["file"])
    st, s_oc_state = build_state(cfg, st_raw)
    inv, s_oc_inv, link = build_investor(cfg, inv_raw, st_raw)

    info = {
        "state": {"name": cfg["state"]["name"], "source": cfg["state"]["source"], "country": cfg["state"]["country"],
                  "rows": int(len(st)), "weighted_targeted": wshare(st, "targeted"),
                  "weighted_lost_all": wshare(st, "lost_all"), "weighted_lost_targeted": wshare(st, "lost_targeted"),
                  "n_targeted": int((st["targeted"] == 1).sum()), "n_lost": int((st["lost_all"] == 1).sum()),
                  "literacy_distribution": {str(int(k)): int(v) for k, v in
                                            st["lit"].value_counts().sort_index().items()},
                  "share_lit_3": float((st["lit"] == 3).mean()), "sd_overconfidence_raw": s_oc_state},
        "investor": {"name": cfg["investor"]["name"], "source": cfg["investor"]["source"],
                     "country": cfg["investor"]["country"], "rows": int(len(inv)),
                     "n_targeted": int((inv["targeted"] == 1).sum()), "n_lost": int((inv["lost_all"] == 1).sum()),
                     "weighted_targeted": wshare(inv, "targeted"), "weighted_guaranteed_yes": wshare(inv, "guaranteed"),
                     "weighted_regulator": wshare(inv, "regulator"), "weighted_finfluencer": wshare(inv, "finfluencer"),
                     "quiz_items": len(cfg["investor"]["quiz"]), "quiz_excluded": cfg["investor"]["quiz_excluded"],
                     "quiz_mean": float(inv["quiz"].mean()), "sd_overconfidence_raw": s_oc_inv, "link": link,
                     "guaranteed_counts": {"yes": int((inv["guaranteed"] == 1).sum()),
                                           "no": int((inv["guaranteed"] == 0).sum()),
                                           "not_sure": int(((inv["guaranteed_or_unsure"] == 1) &
                                                            (inv["guaranteed"] != 1)).sum())}},
        "estimation": "Survey-weighted logistic regression: GLM binomial, weights normalized to mean 1, HC1 robust SEs; "
                      "odds ratios per SD.",
    }
    reg.sections["external_dataset"] = info

    state_res = state_models(reg, st, s_oc_state)
    inv_res = investor_models(reg, inv)
    h9_res = h9(reg, st)
    info["state_models"] = state_res
    info["investor_models"] = inv_res
    info["replication"] = replication(state_res)
    _h8_figure(reg, state_res, inv_res)

    h8_status = h8_verdict(reg)
    return {"H8": h8_status | {"dataset": "NFCS 2024 Investor Survey (primary) + State-by-State (check)"},
            "H9": h9_res | {"dataset": "NFCS 2024 State-by-State Survey"}}


def state_models(reg: Registry, st: pd.DataFrame, s_oc: float) -> dict:
    rows, out = [], {}
    for y, lab in STATE_OUTCOMES.items():
        d = model_frame(st, y, ["z_lit", "z_oc", "z_self", "fin_edu", "age", "income", "male", "z_risk", "owns_inv"])
        m = fit(f"{y} ~ z_lit + z_oc + {STATE_CONTROLS}", d)
        mb = fit(f"{y} ~ z_lit + z_self + {STATE_CONTROLS}", d)
        register_pair(reg, base_id=f"H8.state.{y}", hypothesis="H8", role="secondary-dataset", m=m, outcome=y,
                      label=f"State-by-State, {lab}", lit_term="z_lit", oc_term="z_oc", events=int(d[y].sum()),
                      k_params=len(m.params))
        a, b = float(m.params["z_lit"]), float(m.params["z_oc"])
        lit_b, self_b = float(mb.params["z_lit"]), float(mb.params["z_self"])
        out[y] = {"label": lab, "n": int(m.nobs), "events": int(d[y].sum()), "lit": orow(m, "z_lit"),
                  "oc": orow(m, "z_oc"), "reparam": {"lit": orow(mb, "z_lit"), "self": orow(mb, "z_self"),
                                                     "check_lit": a - b / s_oc, "check_self": b / s_oc,
                                                     "max_abs_diff": max(abs(a - b / s_oc - lit_b),
                                                                         abs(b / s_oc - self_b))}}
        for name, mm in (("z(lit) + z(OC)", m), ("z(lit) + z(self)", mb)):
            for t in mm.params.index:
                rows.append({"outcome": y, "model": name} | orow(mm, t))
    save_table(pd.DataFrame(rows), "external_state_models")
    return out


def investor_models(reg: Registry, inv: pd.DataFrame) -> dict:
    out, rows = {}, []
    base_cols = ["z_lit", "z_oc", "age", "income", "male"]
    knowledge = "investing knowledge (11-item quiz)"
    specs = [  # id, outcome, label, role, predicted OC direction
        ("H8.dataset", "targeted", "Investor Survey, targeted by investment fraud (primary)", "primary-dataset", ">"),
        ("H8.inv.lost", "lost_all", "Investor Survey, lost money to investment fraud", "secondary-dataset", ">"),
        ("H8.inv.guaranteed", "guaranteed", "Investor Survey, would invest in a guaranteed risk-free 25% offer "
                                            "(yes vs no)", "secondary-dataset", ">"),
        ("H8.inv.guaranteed_unsure", "guaranteed_or_unsure", "Investor Survey, guaranteed offer: yes or not sure vs "
                                                             "no (robustness)", "robustness", ">"),
        ("H8.inv.regulator", "regulator", "Investor Survey, ever checked a regulator about a financial professional",
         "secondary-dataset", "<"),
    ]
    for tid, y, lab, role, pred in specs:
        d = model_frame(inv, y, base_cols)
        m = fit(f"{y} ~ z_lit + z_oc + {INV_CONTROLS}", d)
        events = int(d[y].sum())
        register_pair(reg, base_id=tid, hypothesis="H8", role=role, m=m, outcome=y, label=lab, lit_term="z_lit",
                      oc_term="z_oc", events=min(events, int(len(d) - events)), k_params=len(m.params), oc_pred=pred,
                      lit_name=knowledge)
        out[y] = {"label": lab, "n": int(m.nobs), "events": events, "lit": orow(m, "z_lit"), "oc": orow(m, "z_oc"),
                  "predicted_oc": pred}
        rows += [{"outcome": y, "model": "z(quiz) + z(OC)"} | orow(m, t) for t in m.params.index]
    # Robustness: targeted + finfluencer use; targeted with the Big Three from the linked State answers
    d = model_frame(inv, "targeted", base_cols + ["finfluencer"])
    m = fit(f"targeted ~ z_lit + z_oc + finfluencer + {INV_CONTROLS}", d)
    register_pair(reg, base_id="H8.inv.targeted_finfluencer", hypothesis="H8", role="robustness", m=m,
                  outcome="targeted", label="Investor Survey, targeted, + finfluencer use", lit_term="z_lit",
                  oc_term="z_oc", events=int(d["targeted"].sum()), k_params=len(m.params), lit_name=knowledge)
    out["targeted_finfluencer"] = {"n": int(m.nobs), "finfluencer": orow(m, "finfluencer"), "lit": orow(m, "z_lit"),
                                   "oc": orow(m, "z_oc")}
    rows += [{"outcome": "targeted", "model": "+ finfluencer"} | orow(m, t) for t in m.params.index]
    d = model_frame(inv, "targeted", ["z_big3", "z_oc_big3", "age", "income", "male"])
    m = fit(f"targeted ~ z_big3 + z_oc_big3 + {INV_CONTROLS}", d)
    register_pair(reg, base_id="H8.inv.targeted_big3", hypothesis="H8", role="robustness", m=m, outcome="targeted",
                  label="Investor Survey, targeted, Big Three literacy (linked by NFCSID)", lit_term="z_big3",
                  oc_term="z_oc_big3", events=int(d["targeted"].sum()), k_params=len(m.params),
                  lit_name="Big Three literacy (linked State answers)")
    out["targeted_big3"] = {"n": int(m.nobs), "lit": orow(m, "z_big3"), "oc": orow(m, "z_oc_big3")}
    rows += [{"outcome": "targeted", "model": "Big Three (linked)"} | orow(m, t) for t in m.params.index]
    save_table(pd.DataFrame(rows), "external_investor_models")
    return out


def h8_verdict(reg: Registry) -> dict:
    oc, lit = reg.get("H8.dataset"), reg.get("H8.dataset.literacy")
    if lit["ci_high"] < 1:
        v, r = "NOT SUPPORTED", "investing-knowledge OR CI entirely below 1: knowledge protects in the Investor Survey"
    elif oc["effect"] > 1 and oc["p"] < 0.05:
        v, r = "SUPPORTED", f"overconfidence OR > 1 (p = {oc['p']:.3f}); knowledge CI not entirely below 1"
    elif oc["effect"] > 1 and oc["p"] < 0.10:
        v, r = "PARTLY SUPPORTED", f"overconfidence OR > 1 with p = {oc['p']:.3f}; knowledge CI not entirely below 1"
    else:
        v, r = "NOT SUPPORTED", f"overconfidence OR = {oc['effect']:.2f}, p = {oc['p']:.3f}"
    return {"status": "done", "verdict": v, "reason": r}


def replication(state_res: dict) -> list[dict]:
    rows = []
    for y, (t_lit, t_oc) in TEAMMATE.items():
        r = state_res[y]
        for pred, ours, theirs in (("literacy", r["lit"], t_lit), ("overconfidence", r["oc"], t_oc)):
            diff = ours["odds_ratio"] - theirs
            rows.append({"outcome": STATE_OUTCOMES[y], "predictor": pred, "ours": round(ours["odds_ratio"], 2),
                         "ours_ci": f"[{ours['or_ci_low']:.2f}, {ours['or_ci_high']:.2f}]", "teammate": theirs,
                         "difference": round(diff, 2), "flag": bool(abs(round(diff, 2)) > 0.02),
                         "teammate_in_our_ci": bool(ours["or_ci_low"] <= theirs <= ours["or_ci_high"])})
    save_table(pd.DataFrame(rows), "external_replication")
    return rows


def h9(reg: Registry, st: pd.DataFrame) -> dict:
    biases = ["z_oc", "z_risk"]
    names = {"z_oc": "overconfidence", "z_risk": "risk willingness", "z_lit": "literacy"}
    controls = {"gender": "male", "age": "C(age)", "income": "C(income)"}
    other = "fin_edu + owns_inv"
    by_group_rows, results = [], {}
    for y in STATE_OUTCOMES:
        res = []
        d = model_frame(st, y, ["z_lit", "z_oc", "z_risk", "fin_edu", "owns_inv", "age", "income", "male"])
        for g in GROUPINGS:
            rest = " + ".join(v for k, v in controls.items() if k != g)
            m = fit(f"{y} ~ (z_oc + z_risk) * C({g}) + z_lit + {rest} + {other}", d)
            idx = [i for i, t in enumerate(m.params.index) if ":" in t and t.split(":")[0] in biases]
            R = np.zeros((len(idx), len(m.params)))
            for r_, i in enumerate(idx):
                R[r_, i] = 1
            wt = m.wald_test(R, scalar=True)
            p = float(np.asarray(wt.pvalue).ravel()[0])
            stat = float(np.asarray(wt.statistic).ravel()[0])
            best = {}
            for level, sub in d.groupby(g):
                ms = fit(f"{y} ~ z_lit + z_oc + z_risk + {rest} + {other}", sub)
                rows = [orow(ms, b) | {"outcome": y, "grouping": g, "group": str(level), "predictor": names[b],
                                       "n": int(ms.nobs), "events": int(sub[y].sum())} for b in ("z_lit", *biases)]
                top = max((r for r in rows if r["predictor"] != "literacy"), key=lambda r: abs(r["coef"]))
                best[str(level)] = top["predictor"]
                by_group_rows += [r | {"strongest_bias_in_group": r["predictor"] == top["predictor"]} for r in rows]
            res.append({"grouping": g, "p": p, "stat": stat, "df": len(idx), "differs": len(set(best.values())) > 1,
                        "strongest": best, "n": int(m.nobs)})
        for r, ph in zip(res, holm([r["p"] for r in res])):
            r["p_holm"] = ph
            t = reg.add_test(id=f"H9.dataset.{y}.{r['grouping']}", hypothesis="H9",
                             role="primary-dataset" if y == "lost_all" else "exploratory", outcome=y,
                             prediction=f"bias effects (overconfidence, risk willingness) differ across "
                                        f"{GROUPINGS[r['grouping']].lower()}s ({STATE_OUTCOMES[y]})",
                             test="Joint Wald test of bias × group interactions (survey-weighted logistic, HC1)",
                             statistic_name=f"Wald χ² (df = {r['df']})", statistic=r["stat"], p=r["p"],
                             n={"respondents": r["n"]}, direction_ok=r["differs"],
                             strongest_bias_by_group=r["strongest"], dataset_label="State-by-State")
            t["p_holm"] = ph
            t["holm_family"] = f"H9-{y}"
        results[y] = res
    reg.tests = [t for t in reg.tests if t["id"] != "H9.dataset"]
    by = pd.DataFrame(by_group_rows)
    save_table(by, "external_H9_by_group")
    save_table(pd.DataFrame([{k: v for k, v in r.items() if k != "strongest"} | {
        "outcome": y, "strongest": "; ".join(f"{k}: {v}" for k, v in r["strongest"].items())}
        for y, rs in results.items() for r in rs]), "external_H9_interactions")
    _h9_figure(by[by["outcome"] == "lost_all"])
    prim = results["lost_all"]
    ok = [r for r in prim if r["differs"]]
    pmin = min((r["p"] for r in ok), default=None)
    v = "SUPPORTED" if pmin is not None and pmin < 0.05 else (
        "PARTLY SUPPORTED" if pmin is not None and pmin < 0.10 else "NOT SUPPORTED")
    reason = "primary outcome (lost money): " + "; ".join(
        f"{GROUPINGS[r['grouping']].lower()} p = {r['p']:.3f}, strongest bias "
        f"{'differs' if r['differs'] else 'is the same'} across groups" for r in prim)
    return {"status": "done", "verdict": v, "reason": reason, "groupings": results}


# ------------------------------------------------------------------------------------------------- figures


def _log_axis(ax) -> None:
    from matplotlib.ticker import FuncFormatter, LogLocator, NullFormatter

    ax.set_xscale("log")
    ax.xaxis.set_major_locator(LogLocator(base=10, subs=(1.0, 1.2, 1.5, 2.0, 3.0, 5.0, 7.0), numticks=20))
    ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:g}"))
    ax.xaxis.set_minor_formatter(NullFormatter())


def _h8_figure(reg: Registry, state_res: dict, inv_res: dict) -> None:
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6.2), gridspec_kw={"width_ratios": [1, 2.2]},
                                   layout="constrained")
    rows = [("Literacy (per correct answer)", reg.get("H8.literacy")),
            ("Overconfidence (per unit)", reg.get("H8.primary"))]
    for i, (lab, t) in enumerate(rows):
        c = C1 if "Literacy" in lab else C2
        ax1.plot([t["ci_low"], t["ci_high"]], [i, i], color=c, lw=2.2)
        ax1.scatter([t["effect"]], [i], color=c, s=60, zorder=3, edgecolor=BG)
    ax1.axvline(0, color=INK2, lw=1)
    ax1.set_yticks([0, 1])
    ax1.set_yticklabels([r[0] for r in rows])
    ax1.set_ylim(-0.7, 1.7)
    ax1.set_xlabel("Change in game trap score (OLS b, 95% CI)\n← fewer traps     more traps →")
    ax1.set_title(f"(a) App: trap score (n = {reg.get('H8.primary')['n']['players']})", loc="left")
    models = [(f"State: targeted (n = {state_res['targeted']['n']:,})", state_res["targeted"]),
              (f"State: lost money, all (n = {state_res['lost_all']['n']:,})", state_res["lost_all"]),
              (f"State: lost money | targeted (n = {state_res['lost_targeted']['n']:,})", state_res["lost_targeted"]),
              (f"Investor: targeted, investment fraud (n = {inv_res['targeted']['n']:,})", inv_res["targeted"]),
              (f"Investor: lost money (n = {inv_res['lost_all']['n']:,})", inv_res["lost_all"]),
              (f"Investor: would take guaranteed 25% (n = {inv_res['guaranteed']['n']:,})", inv_res["guaranteed"]),
              (f"Investor: checked a regulator* (n = {inv_res['regulator']['n']:,})", inv_res["regulator"])]
    y0 = np.arange(len(models))[::-1]
    for off, key, c, lab in ((0.16, "lit", C1, "Literacy / investing knowledge (per SD)"),
                             (-0.16, "oc", C2, "Overconfidence (per SD)")):
        for y, (_, r) in zip(y0, models):
            o = r[key]
            ax2.plot([o["or_ci_low"], o["or_ci_high"]], [y + off, y + off], color=c, lw=2.2)
            ax2.scatter([o["odds_ratio"]], [y + off], color=c, s=50, zorder=3, edgecolor=BG,
                        label=lab if y == y0[0] else None)
    ax2.axvline(1, color=INK2, lw=1)
    _log_axis(ax2)
    ax2.set_yticks(y0)
    ax2.set_yticklabels([m[0] for m in models])
    ax2.set_xlabel("Odds ratio (95% CI, survey-weighted, log scale)\n← less likely     more likely →")
    ax2.set_title("(b) NFCS 2024 (US adults / US investors)", loc="left")
    h, lab = ax2.get_legend_handles_labels()
    fig.legend(h, lab, loc="outside lower center", ncol=2)
    fig.text(0.01, -0.06, "*For 'checked a regulator' an OR above 1 means MORE checking (protective behaviour).",
             color=INK2, fontsize=9.5)
    savefig(fig, "external_H8")


def _h9_figure(t: pd.DataFrame) -> None:
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.8), layout="constrained")
    for ax, g in zip(axes, GROUPINGS):
        s = t[(t["grouping"] == g) & t["predictor"].isin(["literacy", "overconfidence"])]
        levels = list(dict.fromkeys(s["group"]))
        if g == "age":
            levels = sorted(levels)
        if g == "income":
            levels = [x for x in ("<$50K", "$50K-$100K", "$100K+") if x in levels]
        y0 = np.arange(len(levels))[::-1]
        for off, (pred, c) in zip((0.15, -0.15), (("literacy", C1), ("overconfidence", C2))):
            b = s[s["predictor"] == pred].set_index("group").reindex(levels)
            ax.hlines(y0 + off, b["or_ci_low"], b["or_ci_high"], color=c, lw=2)
            ax.scatter(b["odds_ratio"], y0 + off, color=c, s=40, zorder=3, edgecolor=BG, label=pred)
        ax.axvline(1, color=INK2, lw=1)
        _log_axis(ax)
        ax.set_yticks(y0)
        ax.set_yticklabels(levels)
        ax.set_title(GROUPINGS[g], loc="left")
        ax.set_xlabel("OR per SD (95% CI)")
    h, lab = axes[0].get_legend_handles_labels()
    fig.legend(h, lab, loc="outside lower center", ncol=2)
    fig.suptitle("NFCS State-by-State: lost money to a fraud — literacy and overconfidence by group (exploratory)",
                 color=INK, x=0.01, ha="left")
    savefig(fig, "external_H9")


__all__ = ["run", "C3", "INK"]
