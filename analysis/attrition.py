"""Step 3 - attrition: completion by randomized factor, drop-out funnel by skin, where players dropped out, and
intention-to-treat (ITT) robustness for H1 and H2 rebuilt from events.csv for every player who reached g:home."""

from __future__ import annotations

import json

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

from common import (BG, C1, C2, GROUP_COLORS, INK, INK2, Registry, fisher_test, mwu_test, odds_ratio, read_csv,
                    save_table, savefig, wilson)

# Full step order (fraud flow, B4); the honest flow skips g:chat and g:react:0-6.
STEPS = ([f"g:profile:{i}" for i in range(8)] + ["g:home", "g:spin:0", "g:round:1", "g:brain:0", "g:round:2",
         "g:spin:1", "g:round:3", "g:brain:1", "g:brain:2", "g:chat", "g:round:4", "g:brain:3", "g:deal",
         "g:pool", "g:withdraw", "g:reinvest", "g:crash", "g:cashout"] + [f"g:react:{i}" for i in range(12)]
         + ["g:report", "g:share", "g:end"])
IDX = {s: i for i, s in enumerate(STEPS)}
MILESTONES = [  # shared by both skins
    ("Consented", "g:profile:0"), ("Profile done (home)", "g:home"), ("Round 1", "g:round:1"),
    ("Round 2", "g:round:2"), ("Round 3", "g:round:3"), ("Round 4", "g:round:4"), ("Flash deals", "g:deal"),
    ("Pool invite", "g:pool"), ("Test withdrawal", "g:withdraw"), ("Gold Plan", "g:reinvest"),
    ("Market crash", "g:crash"), ("Cash out", "g:cashout"), ("Trust/urgency sliders", "g:react:7"),
    ("Report card (completed)", "g:report"),
]
FACTORS = {"app_version": "skin", "round1_outcome": "round1_outcome", "referral_source": "pool_source",
           "withdrawal_offer": "withdrawal_offer", "money_source": "reinvest_framing"}
LEVEL_NAMES = {"plain": "honest", "own": "main"}


def _payload(p) -> dict:
    try:
        return json.loads(p) if isinstance(p, str) else {}
    except ValueError:
        return {}


def load_participants() -> pd.DataFrame:
    p = read_csv("participants.csv")
    p = p[p["is_pilot"] == 0].copy()
    p["skin"] = p["app_version"].map(lambda s: LEVEL_NAMES.get(s, s))
    p["completed"] = p["completed_at"].notna().astype(int)
    p["step_idx"] = p["current_step"].map(IDX)
    return p


def run(reg: Registry, df: pd.DataFrame) -> dict:
    p = load_participants()
    out: dict = {"consented": len(p), "completed": int(p["completed"].sum())}
    unknown = sorted(set(p.loc[p["step_idx"].isna(), "current_step"]))
    if unknown:
        reg.problem(f"Unknown current_step values in participants.csv: {unknown}")

    # 1. Completion rate by each randomized factor (Fisher, OR, Wilson CIs)
    rows = []
    for col, name in FACTORS.items():
        levels = sorted(p[col].unique())
        if name == "skin":
            levels = ["fraud", "plain"]
        a, b = levels[0], levels[1]
        ka, na = int(p.loc[p[col] == a, "completed"].sum()), int((p[col] == a).sum())
        kb, nb = int(p.loc[p[col] == b, "completed"].sum()), int((p[col] == b).sum())
        _, pval = stats.fisher_exact([[ka, na - ka], [kb, nb - kb]])
        or_, lo, hi, _ = odds_ratio(ka, na - ka, kb, nb - kb)
        for lv, k, n in ((a, ka, na), (b, kb, nb)):
            wl, wh = wilson(k, n)
            rows.append({"factor": name, "level": LEVEL_NAMES.get(lv, lv), "consented": n, "completed": k,
                         "completion_rate": k / n, "ci_low": wl, "ci_high": wh,
                         "odds_ratio_first_vs_second": or_, "or_ci_low": lo, "or_ci_high": hi, "fisher_p": pval})
    comp = pd.DataFrame(rows)
    save_table(comp, "attrition_completion_by_factor")
    out["completion_by_factor"] = comp.to_dict("records")
    sk = comp[comp["factor"] == "skin"].set_index("level")
    out["completion_skin"] = {
        lv: {"consented": int(sk.at[lv, "consented"]), "completed": int(sk.at[lv, "completed"]),
             "rate": float(sk.at[lv, "completion_rate"]), "ci_low": float(sk.at[lv, "ci_low"]),
             "ci_high": float(sk.at[lv, "ci_high"])} for lv in ("honest", "fraud")}
    out["completion_skin_p"] = float(sk["fisher_p"].iloc[0])
    out["completion_skin_or"] = [float(sk["odds_ratio_first_vs_second"].iloc[0]), float(sk["or_ci_low"].iloc[0]),
                                 float(sk["or_ci_high"].iloc[0])]  # fraud vs honest
    reg.add_test(id="ATT.completion_skin", hypothesis="attrition", role="check", outcome="completed",
                 prediction="(check) completion does not depend on skin", test="Fisher's exact test (two-sided)",
                 statistic_name="OR", statistic=out["completion_skin_or"][0], p=out["completion_skin_p"],
                 effect_name="Odds ratio of completing (fraud vs honest)", effect=out["completion_skin_or"][0],
                 ci_low=out["completion_skin_or"][1], ci_high=out["completion_skin_or"][2],
                 n={"honest": out["completion_skin"]["honest"]["consented"],
                    "fraud": out["completion_skin"]["fraud"]["consented"]},
                 summary=out["completion_skin"])

    # 2. Funnel by skin over the shared milestones
    rows = []
    for label, step in MILESTONES:
        for skin in ("honest", "fraud"):
            s = p[p["skin"] == skin]
            reached = int((s["step_idx"] >= IDX[step]).sum())
            rows.append({"milestone": label, "step": step, "skin": skin, "reached": reached,
                         "share_of_consented": reached / len(s)})
    funnel = pd.DataFrame(rows)
    save_table(funnel.pivot_table(index=["milestone", "step"], columns="skin",
                                  values="reached", sort=False).astype(int).reset_index()[
        ["milestone", "step", "honest", "fraud"]], "attrition_funnel")
    out["funnel"] = funnel.to_dict("records")
    _funnel_figure(funnel, out)

    # 3. Where did drop-outs stop? profile (before any money screen) / at home / after home
    ev = read_csv("events.csv")
    decided_s3 = set(ev.loc[ev["event_type"].isin(["s3_invest", "s3_skip"]), "participant_id"])
    closed_vip = set(ev.loc[ev["event_type"] == "vip_popup_close", "participant_id"])
    drop = p[p["completed"] == 0].copy()

    def phase(i):
        if i < IDX["g:home"]:
            return "during profile (before the home screen)"
        if i == IDX["g:home"]:
            return "on the home screen"
        return "after the home screen (in the game)"

    drop["phase"] = drop["step_idx"].map(phase)
    rows = []
    for ph in ["during profile (before the home screen)", "on the home screen", "after the home screen (in the game)"]:
        r = {"phase": ph}
        for skin in ("honest", "fraud"):
            r[skin] = int(((drop["phase"] == ph) & (drop["skin"] == skin)).sum())
            r[f"{skin}_share_of_consented"] = r[skin] / int((p["skin"] == skin).sum())
        k1, k2 = r["fraud"], r["honest"]
        n1, n2 = int((p["skin"] == "fraud").sum()), int((p["skin"] == "honest").sum())
        r["fisher_p_fraud_vs_honest"] = stats.fisher_exact([[k1, n1 - k1], [k2, n2 - k2]])[1]
        rows.append(r)
    phases = pd.DataFrame(rows)
    save_table(phases, "attrition_dropout_phase")
    out["dropout_phase"] = phases.to_dict("records")
    home = drop[drop["current_step"] == "g:home"]
    out["home_dropouts_detail"] = {
        skin: {"n": int((home["skin"] == skin).sum()),
               "made_s3_decision": int(home.loc[home["skin"] == skin, "participant_id"].isin(decided_s3).sum()),
               "closed_vip_popup": int(home.loc[home["skin"] == skin, "participant_id"].isin(closed_vip).sum())}
        for skin in ("honest", "fraud")}

    # 4. ITT robustness for H1 and H2
    out["itt"] = itt(reg, p, ev)
    reg.sections["attrition"] = out
    return out


def _funnel_figure(funnel: pd.DataFrame, out: dict) -> None:
    fig, ax = plt.subplots(figsize=(10, 5.2))
    labels = [m for m, _ in MILESTONES]
    x = np.arange(len(labels))
    for skin, color in (("honest", C1), ("fraud", C2)):
        s = funnel[funnel["skin"] == skin].set_index("milestone").loc[labels]
        ax.plot(x, s["share_of_consented"], color=color, lw=2, marker="o", ms=7, zorder=3,
                markeredgecolor=BG, markeredgewidth=1.2)
        n0, n1 = int(s["reached"].iloc[0]), int(s["reached"].iloc[-1])
        ax.annotate(f"{skin}: {n1} of {n0} completed", (x[-1], s["share_of_consented"].iloc[-1]),
                    xytext=(8, 0), textcoords="offset points", color=INK, va="center", fontsize=10.5)
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=35, ha="right")
    ax.set_ylim(0, 1.05)
    ax.set_xlim(-0.4, len(labels) + 1.9)
    ax.yaxis.set_major_formatter(plt.matplotlib.ticker.PercentFormatter(1.0))
    ax.set_ylabel("Share of consented players still playing")
    ax.set_title("Drop-out funnel by skin (all consented players)", loc="left")
    ax.grid(axis="x", visible=False)
    savefig(fig, "attrition_funnel")


def itt(reg: Registry, p: pd.DataFrame, ev: pd.DataFrame) -> dict:
    """Rebuild S3 decision and round-1/2 stakes for every consented player who reached g:home."""
    ev = ev[ev["participant_id"].isin(p["participant_id"])].sort_values("id")
    reached_home = set(ev.loc[(ev["event_type"] == "screen_view") & (ev["screen"] == "g:home"), "participant_id"])
    reached_home |= set(p.loc[p["step_idx"] >= IDX["g:home"], "participant_id"])
    base = p[p["participant_id"].isin(reached_home)][["participant_id", "skin", "round1_outcome",
                                                       "completed"]].copy()

    s3 = ev[ev["event_type"].isin(["s3_invest", "s3_skip"])].drop_duplicates("participant_id")
    s3 = s3.assign(decision_time_first_invest=s3["payload"].map(lambda x: _payload(x).get("decision_ms")) / 1000,
                   s3_invest=(s3["event_type"] == "s3_invest").astype(int))
    rd = ev[ev["event_type"].isin(["round_invest", "round_skip"])].copy()
    rd["round"] = rd["payload"].map(lambda x: _payload(x).get("round"))
    rd["amount"] = rd["payload"].map(lambda x: _payload(x).get("amount", 0))
    rd = rd.drop_duplicates(["participant_id", "round"])  # first event per round
    r1 = rd[rd["round"] == 1].set_index("participant_id")["amount"].rename("r1_amount")
    r2 = rd[rd["round"] == 2].set_index("participant_id")["amount"].rename("r2_amount")

    d = (base.merge(s3[["participant_id", "decision_time_first_invest", "s3_invest"]], on="participant_id",
                    how="left").merge(r1, left_on="participant_id", right_index=True, how="left")
         .merge(r2, left_on="participant_id", right_index=True, how="left"))
    d["invested_r1"] = np.where(d["r1_amount"].isna(), np.nan, (d["r1_amount"] > 0).astype(float))
    d["escalation_ratio"] = np.where((d["r1_amount"] > 0) & d["r2_amount"].notna(),
                                     d["r2_amount"] / d["r1_amount"], np.nan)

    out = {
        "reached_home": {s: int((d["skin"] == s).sum()) for s in ("honest", "fraud")},
        "with_s3_decision": {s: int(d.loc[d["skin"] == s, "decision_time_first_invest"].notna().sum())
                             for s in ("honest", "fraud")},
        "with_round1": {s: int(d.loc[d["skin"] == s, "r1_amount"].notna().sum()) for s in ("honest", "fraud")},
        "with_round2": {s: int(d.loc[d["round1_outcome"] == s, "r2_amount"].notna().sum())
                        for s in ("small_win", "flat")},
        "non_completers_included": int((d["completed"] == 0).sum()),
    }
    kw = dict(df=d, group_col="skin", a="fraud", b="honest", role="robustness")
    fisher_test(reg, id="H1.itt.invested_r1", hypothesis="H1", outcome="invested_r1",
                prediction="fraud > honest (ITT: everyone who reached home)", predicted="greater", **kw)
    mwu_test(reg, id="H1.itt.decision_time", hypothesis="H1", outcome="decision_time_first_invest",
             prediction="fraud < honest (ITT: everyone who reached home)", predicted="less", **kw)
    mwu_test(reg, id="H1.itt.r1_amount", hypothesis="H1", outcome="r1_amount",
             prediction="fraud > honest (ITT: everyone who reached home)", predicted="greater", **kw)
    kw2 = dict(df=d, group_col="round1_outcome", a="small_win", b="flat", role="robustness")
    mwu_test(reg, id="H2.itt.escalation_ratio", hypothesis="H2", outcome="escalation_ratio",
             prediction="small_win > flat (ITT: everyone who played round 2 with r1 > 0)", predicted="greater",
             **kw2)
    mwu_test(reg, id="H2.itt.r2_amount", hypothesis="H2", outcome="r2_amount",
             prediction="small_win > flat (ITT: everyone who played round 2)", predicted="greater", **kw2)
    save_table(d.drop(columns=["participant_id"]).groupby("skin").agg(
        players=("skin", "size"), completed=("completed", "sum"),
        s3_decisions=("decision_time_first_invest", "count"),
        median_decision_time_s=("decision_time_first_invest", "median"),
        round1_decisions=("r1_amount", "count"), invested_r1_share=("invested_r1", "mean"),
        median_r1_amount=("r1_amount", "median")).reset_index(), "attrition_itt_sample")
    return out


__all__ = ["run", "GROUP_COLORS", "INK2"]
