"""Step 5 - survey (Part C), descriptive only. Cleaning follows C5, adapted to the real Google Form headers.

- The non-consenting row is dropped. The C5 launch-date filter is applied with the real launch date (2026-11-02,
  the day the study database was reset), so no consenting row is removed by it.
- Shares with Wilson 95% CIs; for the few who invested, counts only ("2 of 3"), no percentages and no tests.
"""

from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from common import BG, C1, C2, FEATURES, INK, INK2, Registry, save_table, savefig, survey_path, wilson

LAUNCH = "2026-11-02"
OPTIONS = {  # Q2 option text (start) -> variable, label
    "Countdown timer": ("sv_seen_timer", "Countdown timer / \"offer ends soon\""),
    "Only X slots": ("sv_seen_slots", "\"Only X slots left\""),
    "Very high or": ("sv_seen_high_returns", "Very high / \"guaranteed\" returns"),
    "Live messages": ("sv_seen_social", "Live withdrawal messages / testimonials"),
    "Bonus for referring": ("sv_seen_referral", "Referral bonus / \"your friend joined\""),
    "Sign-up bonus": ("sv_seen_locked_bonus", "Sign-up bonus locked until deposit"),
    "VIP levels": ("sv_seen_vip", "VIP levels / higher returns for bigger deposits"),
    "A registration badge": ("sv_seen_badge", "Registration badge / certificate / regulator logo"),
    "A mentor": ("sv_seen_mentor", "Mentor / advisor / \"support\" pushing deposits"),
    "Withdrawal blocked": ("sv_seen_withdraw_block", "Withdrawal blocked until a fee / tax is paid"),
    "None of these": ("sv_seen_none", "None of these"),
}
STOP_REASONS = {
    "It seemed too good to be true": "It seemed too good to be true",
    "I checked and it wasn": "I checked and it wasn't registered / legitimate",
    "I just wasn": "I just wasn't interested",
    "I didn": "I didn't have money to invest",
    "Someone warned me": "Someone warned me",
    "Other": "Other",
}
# Survey trick <-> app feature card (features both measure)
MATCH = [
    ("sv_seen_timer_or_slots", "feature_push_timer", "Countdown timer / slots left"),
    ("sv_seen_locked_bonus", "feature_push_bonus", "Locked sign-up bonus"),
    ("sv_seen_vip", "feature_push_vip", "VIP levels"),
    ("sv_seen_badge", "feature_push_regulator", "Badge / certificate"),
    ("sv_seen_social", "feature_push_social", "Social proof (live withdrawals)"),
    ("sv_seen_mentor", "feature_push_chat", "Mentor / advisor chat"),
    ("sv_seen_withdraw_block", "feature_push_tax", "Withdrawal blocked by a fee / tax"),
]
YN = {"Yes": 1, "No": 0}


def _col(sv: pd.DataFrame, start: str) -> str:
    hits = [c for c in sv.columns if c.strip().lower().startswith(start.lower())]
    if not hits:
        raise KeyError(f"survey column starting with {start!r} not found")
    return hits[0]


def share(s: pd.Series) -> dict:
    s = s.dropna()
    k, n = int(s.sum()), int(len(s))
    lo, hi = wilson(k, n)
    return {"yes": k, "n": n, "share": k / n if n else None, "ci_low": lo, "ci_high": hi}


def clean() -> tuple[pd.DataFrame, dict]:
    raw = pd.read_csv(survey_path(), encoding="utf-8-sig")
    cols = {"sv_timestamp": _col(raw, "Timestamp"), "consent": _col(raw, "Do you agree")}
    for q in range(1, 12):
        cols[f"q{q}"] = _col(raw, f"Q{q}.")
    cols["stopped"] = _col(raw, "What stopped you")
    sv = raw[list(cols.values())].copy()
    sv.columns = list(cols.keys())
    info = {"rows_in_file": len(sv)}
    sv = sv[sv["consent"].fillna("").str.startswith("Yes")].copy()
    info["non_consenting_dropped"] = info["rows_in_file"] - len(sv)
    ts = pd.to_datetime(sv["sv_timestamp"], dayfirst=True)
    before = len(sv)
    sv = sv[ts >= LAUNCH].copy()
    info["dropped_before_launch"] = before - len(sv)
    info["first_response"] = str(ts.min().date())
    info["last_response"] = str(ts.max().date())

    sv["sv_approached"] = sv["q1"].map(YN)
    for start, (col, _) in OPTIONS.items():
        sv[col] = sv["q2"].fillna("").str.contains(start, regex=False).astype(int)
    tricks = [v for v, _ in OPTIONS.values() if v != "sv_seen_none"]
    sv["sv_seen_count"] = sv[tricks].sum(axis=1)
    info["none_with_other_options"] = int(((sv["sv_seen_none"] == 1) & (sv["sv_seen_count"] > 0)).sum())
    sv.loc[sv["sv_seen_count"] > 0, "sv_seen_none"] = 0  # C5: keep the other options
    sv["sv_seen_timer_or_slots"] = ((sv["sv_seen_timer"] == 1) | (sv["sv_seen_slots"] == 1)).astype(int)
    sv["sv_recency_12m"] = sv["q3"].map({"In the past 12 months": 1, "1–3 years ago": 0,
                                         "More than 3 years ago": 0})
    sv["sv_invested"] = sv["q5"].map(YN)

    # Branching checks
    later = ["q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11"]
    info["branching_q1_not_yes_but_answered_section_b"] = int(
        ((sv["q1"] != "Yes") & sv[later].notna().any(axis=1)).sum())
    info["branching_q5_no_but_answered_q6_q11"] = int(
        ((sv["q5"] == "No") & sv[["q6", "q7", "q8", "q9", "q10", "q11"]].notna().any(axis=1)).sum())
    info["q1_counts"] = {str(k): int(v) for k, v in sv["q1"].value_counts(dropna=False).items()}
    return sv, info


def run(reg: Registry, df_app: pd.DataFrame) -> dict:
    sv, info = clean()
    out = dict(info)
    out["respondents"] = len(sv)
    out["approached"] = share(sv["sv_approached"])
    appr = sv[sv["sv_approached"] == 1]
    out["approached_past_12m"] = share(appr["sv_recency_12m"])

    # Q2 tricks, all respondents
    rows = []
    for _, (col, label) in OPTIONS.items():
        rows.append({"variable": col, "trick": label} | share(sv[col]))
    seen = pd.DataFrame(rows).sort_values("share", ascending=False)
    save_table(seen, "survey_tricks_seen")
    out["tricks_seen"] = seen.to_dict("records")
    out["seen_count_mean"] = float(sv["sv_seen_count"].mean())

    # Q4 channels, approached respondents
    ch = appr["q4"].dropna()
    rows = [{"channel": k} | share(pd.Series((ch == k).astype(int))) for k in ch.value_counts().index]
    channels = pd.DataFrame(rows)
    save_table(channels, "survey_channels")
    out["channels"] = channels.to_dict("records")

    # Invested: counts only
    inv = appr[appr["sv_invested"] == 1]
    out["invested_count"] = {"yes": int((appr["sv_invested"] == 1).sum()), "of": int(appr["sv_invested"].notna().sum())}
    rows = []
    for q, label in (("q6", "First amount small (under ₹1,000)"), ("q7", "App showed profits early on"),
                     ("q8", "A small withdrawal worked first"), ("q9", "Reinvested shown profits"),
                     ("q10", "Put in more after a loss / blocked withdrawal")):
        vc = inv[q].value_counts()
        rows.append({"question": q.upper(), "item": label, "yes": int(vc.get("Yes", 0)), "no": int(vc.get("No", 0)),
                     "dont_remember_or_blank": int(len(inv) - vc.get("Yes", 0) - vc.get("No", 0)),
                     "of_invested": len(inv)})
    rows.append({"question": "Q11", "item": "Amount lost (counts per band)",
                 "bands": "; ".join(f"{k}: {v}" for k, v in inv["q11"].value_counts().items()),
                 "of_invested": len(inv)})
    invested = pd.DataFrame(rows)
    for c in ("yes", "no", "dont_remember_or_blank"):
        invested[c] = invested[c].astype("Int64")
    save_table(invested, "survey_invested_counts")
    out["invested_items"] = invested.to_dict("records")

    # What stopped you (approached, did not invest)
    non = appr[appr["sv_invested"] == 0]
    answered = non["stopped"].dropna()
    rows = []
    for start, label in STOP_REASONS.items():
        rows.append({"reason": label} | share(answered.str.contains(start, regex=False).astype(int)))
    stop = pd.DataFrame(rows).sort_values("share", ascending=False)
    save_table(stop, "survey_what_stopped_you")
    out["what_stopped"] = stop.to_dict("records")
    out["what_stopped_answered"] = {"answered": int(len(answered)), "of_non_investors": int(len(non))}

    # Survey vs app comparison
    fr = df_app[df_app["skin"] == "fraud"]
    rows = []
    for svc, appc, label in MATCH:
        a = share(fr[appc + "_yes"])
        s = share(sv[svc])
        rows.append({"feature": label, "survey_variable": svc, "app_variable": appc,
                     "survey_seen_share": s["share"], "survey_ci_low": s["ci_low"], "survey_ci_high": s["ci_high"],
                     "survey_n": s["n"], "survey_yes": s["yes"], "app_pushed_share": a["share"],
                     "app_ci_low": a["ci_low"], "app_ci_high": a["ci_high"], "app_n": a["n"], "app_yes": a["yes"]})
    comp = pd.DataFrame(rows)
    save_table(comp, "survey_vs_app")
    out["survey_vs_app"] = comp.to_dict("records")
    reg.sections["survey"] = out

    _figures(seen, stop, comp, out)
    return out


def _hbars(ax, labels, shares, lo, hi, ks, ns, color):
    y = np.arange(len(labels))[::-1]
    ax.barh(y, shares, height=0.62, color=color)
    ax.errorbar(shares, y, xerr=[np.array(shares) - np.array(lo), np.array(hi) - np.array(shares)], fmt="none",
                ecolor=INK, capsize=3.5, lw=1.2)
    for yi, h, k, n in zip(y, hi, ks, ns):
        ax.text(min(h + 0.02, 0.97), yi, f"{k}/{n}", va="center", color=INK, fontsize=9.5)
    ax.set_yticks(y)
    ax.set_yticklabels(labels)
    ax.set_xlim(0, 1.1)
    ax.xaxis.set_major_formatter(plt.matplotlib.ticker.PercentFormatter(1.0))
    ax.grid(axis="y", visible=False)


def _figures(seen, stop, comp, out) -> None:
    n = out["respondents"]
    fig, ax = plt.subplots(figsize=(10, 5.6), layout="constrained")
    s = seen[seen["variable"] != "sv_seen_none"]
    _hbars(ax, s["trick"], s["share"], s["ci_low"], s["ci_high"], s["yes"], s["n"], C1)
    ax.set_xlabel("Share of respondents who have seen the trick (95% Wilson CI)")
    ax.set_title(f"Survey: tricks seen in real investment apps, ads or groups (n = {n})", loc="left")
    savefig(fig, "survey_tricks_seen")

    a = out["what_stopped_answered"]
    fig, ax = plt.subplots(figsize=(9, 3.8), layout="constrained")
    _hbars(ax, stop["reason"], stop["share"], stop["ci_low"], stop["ci_high"], stop["yes"], stop["n"], C1)
    ax.set_xlabel("Share of approached non-investors who answered (95% Wilson CI); several reasons allowed")
    ax.set_title(f"Survey: what stopped them from putting money in (n = {a['answered']} of "
                 f"{a['of_non_investors']})", loc="left")
    savefig(fig, "survey_what_stopped")

    fig, ax = plt.subplots(figsize=(10.5, 5.4), layout="constrained")
    y0 = np.arange(len(comp))[::-1]
    for off, (col, lo, hi, color, lab) in zip(
            (0.19, -0.19), (("survey_seen_share", "survey_ci_low", "survey_ci_high", C1,
                             f"Seen in real life (survey, n = {int(comp['survey_n'].iloc[0])})"),
                            ("app_pushed_share", "app_ci_low", "app_ci_high", C2,
                             f"Said it pushed them to invest (app fraud skin, n = {int(comp['app_n'].iloc[0])})"))):
        ax.barh(y0 + off, comp[col], height=0.36, color=color, label=lab)
        ax.errorbar(comp[col], y0 + off, xerr=[comp[col] - comp[lo], comp[hi] - comp[col]], fmt="none", ecolor=INK,
                    capsize=3, lw=1.1)
    ax.set_yticks(y0)
    ax.set_yticklabels(comp["feature"])
    ax.set_xlim(0, 1.05)
    ax.xaxis.set_major_formatter(plt.matplotlib.ticker.PercentFormatter(1.0))
    ax.set_xlabel("Share (95% Wilson CI)")
    ax.set_title("Common in real life vs persuasive in the app (features both measure)", loc="left")
    fig.legend(loc="outside lower center", ncol=1)
    ax.grid(axis="y", visible=False)
    savefig(fig, "survey_vs_app")


__all__ = ["run", "BG", "INK2", "FEATURES"]
