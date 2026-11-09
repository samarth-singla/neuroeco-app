"""Step 2 - data checks: factor balance among completers, randomization independence, missing values, inconsistent
spin players, non-numeric CRT answers, decision-time outliers, duplicated events."""

from __future__ import annotations

import json

import numpy as np
import pandas as pd
from scipy import stats

from common import Registry, odds_ratio, read_csv, save_table

FACTORS = {
    "skin": ("H1", ["honest", "fraud"]),
    "round1_outcome": ("H2", ["small_win", "flat"]),
    "pool_source": ("H5", ["friend", "ad"]),
    "withdrawal_offer": ("H6", ["allowed", "not_offered"]),
    "reinvest_framing": ("H7", ["profit", "main"]),
}

ANALYSIS_COLUMNS = [
    "total_deposited", "decision_time_first_invest", "r1_amount", "r2_amount", "r4_amount", "escalation_ratio",
    "verify_any", "verify_count", "app_trust", "app_urgency", "trap_score_shared8", "vip_upgrade", "vip_level",
    "chat_deposit", "tax_paid", "deal_invest_500", "deal_invest_3000", "deal_invest_8000", "deal_details_500",
    "deal_details_3000", "deal_details_8000", "deal_time_500", "deal_time_3000", "deal_time_8000", "pool_join",
    "pool_details", "pool_time", "post_withdrawal_deposit", "withdrew", "reinvest_amount", "reinvest_accept",
    "crash_topup", "crash_topup_amount", "loss_aversion_group", "crt_correct", "literacy_score",
    "self_rated_literacy", "overconfidence", "fomo_score", "exp_investing", "exp_trading_app", "exp_fin_edu",
    "demo_gender", "feature_push_timer", "feature_push_bonus", "feature_push_vip", "feature_push_regulator",
    "feature_push_social", "feature_push_chat", "feature_push_tax",
]
FRAUD_ONLY = {"chat_deposit", "tax_paid"} | {c for c in ANALYSIS_COLUMNS if c.startswith("feature_push_")}


def outlier_threshold(x: pd.Series) -> float:
    q1, q3 = np.nanpercentile(x, [25, 75])
    return float(q3 + 3 * (q3 - q1))


def run(reg: Registry, df: pd.DataFrame) -> dict:
    out: dict = {}

    # 1. Sample size per randomized factor among completers
    rows = []
    for f, (h, levels) in FACTORS.items():
        for lv in levels:
            rows.append({"factor": f, "hypothesis": h, "level": lv, "completers": int((df[f] == lv).sum())})
    counts = pd.DataFrame(rows)
    save_table(counts, "checks_factor_counts")
    out["factor_counts"] = counts.to_dict("records")

    # 2. Skin x each other factor among completers (Fisher): is assignment still independent of skin?
    rows = []
    for f, (_, levels) in FACTORS.items():
        if f == "skin":
            continue
        t = pd.crosstab(df["skin"], df[f]).reindex(index=["honest", "fraud"], columns=levels).fillna(0).astype(int)
        _, p = stats.fisher_exact(t.values)
        or_, lo, hi, _ = odds_ratio(t.iat[1, 0], t.iat[1, 1], t.iat[0, 0], t.iat[0, 1])
        rows.append({
            "factor": f, "level_1": levels[0], "level_2": levels[1],
            "honest_level_1": t.iat[0, 0], "honest_level_2": t.iat[0, 1],
            "fraud_level_1": t.iat[1, 0], "fraud_level_2": t.iat[1, 1],
            "odds_ratio_fraud_vs_honest": or_, "ci_low": lo, "ci_high": hi, "fisher_p": p,
        })
    indep = pd.DataFrame(rows)
    save_table(indep, "checks_randomization")
    out["randomization"] = indep.to_dict("records")
    out["randomization_min_p"] = float(indep["fisher_p"].min())

    # 3. Missing values per analysis column (fraud-only columns are blank for honest by design)
    by_design = {  # blank by design for some players: (subset, label)
        "withdrew": (df["withdrawal_offer"] == "allowed", "withdrawal offered only"),
        "escalation_ratio": (df["r1_amount"] > 0, "r1_amount > 0 only"),
        "loss_aversion_group": (df["la_consistent"] == 1, "consistent spin choices only"),
    }
    rows = []
    for c in ANALYSIS_COLUMNS:
        if c in FRAUD_ONLY:
            sub, applies = df[df["skin"] == "fraud"], "fraud only"
        elif c in by_design:
            sub, applies = df[by_design[c][0]], by_design[c][1]
        else:
            sub, applies = df, "all"
        rows.append({
            "column": c, "applies_to": applies,
            "n_applicable": len(sub), "missing": int(sub[c].isna().sum()),
            "missing_share": float(sub[c].isna().mean()),
        })
    missing = pd.DataFrame(rows)
    save_table(missing, "checks_missing")
    out["missing_nonzero"] = missing[missing["missing"] > 0][["column", "missing", "n_applicable"]].to_dict("records")

    # 4. Inconsistent spin players and loss-aversion distribution
    out["la_inconsistent"] = int((df["la_consistent"] == 0).sum())
    out["la_missing_spin"] = int(df["la_consistent"].isna().sum())

    # 5. crt_1 entries that are not numbers (raw responses, completers and everyone)
    resp = read_csv("responses.csv")
    crt = resp[resp["item_id"] == "crt_1"].copy()
    crt["numeric"] = pd.to_numeric(crt["value"], errors="coerce").notna()
    crt_done = crt[crt["participant_id"].isin(df["participant_id"])]
    out["crt_non_numeric_all"] = int((~crt["numeric"]).sum())
    out["crt_non_numeric_completers"] = int((~crt_done["numeric"]).sum())
    out["crt_answers_completers"] = {str(k): int(v) for k, v in
                                     df["crt_1"].value_counts().sort_index().items()}
    out["crt_non_numeric_values"] = sorted(set(crt.loc[~crt["numeric"], "value"].astype(str)))

    # 6. Decision-time outliers (Q3 + 3 x IQR, pooled)
    thr = outlier_threshold(df["decision_time_first_invest"])
    flag = df["decision_time_first_invest"] > thr
    out["time_outlier_threshold_s"] = thr
    out["time_outliers"] = {"total": int(flag.sum()),
                            "honest": int((flag & (df["skin"] == "honest")).sum()),
                            "fraud": int((flag & (df["skin"] == "fraud")).sum()),
                            "values_s": sorted(round(v, 1) for v in df.loc[flag, "decision_time_first_invest"])}
    save_table(pd.DataFrame([{"rule": "decision_time_first_invest > Q3 + 3 x IQR (pooled completers)",
                              "threshold_s": thr, **{k: v for k, v in out["time_outliers"].items()
                                                     if k != "values_s"},
                              "flagged_values_s": "; ".join(str(v) for v in out["time_outliers"]["values_s"])}]),
               "checks_time_outliers")

    # 7. Duplicated money events (a refresh should never repeat one; the first event is used)
    ev = read_csv("events.csv")
    r = ev[ev["event_type"].isin(["round_invest", "round_skip"])].copy()
    r["round"] = r["payload"].map(lambda p: json.loads(p)["round"])
    dup = r.groupby(["participant_id", "round"]).size()
    out["duplicate_round_events"] = {"players": int((dup > 1).groupby(level=0).any().sum()),
                                     "rounds": int((dup > 1).sum())}

    # 8. Overconfidence recomputed on the filtered sample
    out["overconfidence_recomputed_n"] = int(df["overconfidence"].notna().sum())

    summary = pd.DataFrame([
        {"check": "completers (wide.csv, is_pilot = 0)", "value": len(df)},
        {"check": "smallest Fisher p, skin x other factor", "value": round(out["randomization_min_p"], 4)},
        {"check": "inconsistent spin players (la_consistent = 0)", "value": out["la_inconsistent"]},
        {"check": "players with a spin missing", "value": out["la_missing_spin"]},
        {"check": "crt_1 answers that are not numbers (all consented)", "value": out["crt_non_numeric_all"]},
        {"check": "decision-time outlier threshold (s)", "value": round(thr, 1)},
        {"check": "decision-time outliers (honest / fraud)",
         "value": f"{out['time_outliers']['honest']} / {out['time_outliers']['fraud']}"},
        {"check": "players with duplicated round events (first event used)",
         "value": out["duplicate_round_events"]["players"]},
    ])
    save_table(summary, "checks_summary")
    reg.sections["checks"] = out
    return out
