"""Generated wording shared by the Markdown report and the HTML page. Every number comes from results.json (or the
tables); nothing is typed by hand. Strings may contain **bold** and `code` (rendered by each builder)."""

from __future__ import annotations

import json
import math
import os

from common import RESULTS
from spec import SPEC

AMOUNTS = {"total_deposited", "r1_amount", "r2_amount", "r4_amount", "post_withdrawal_deposit", "reinvest_amount",
           "crash_topup_amount"}
SECONDS = {"decision_time_first_invest", "pool_time", "deal_time"}
OUTCOME_LABEL = {
    "total_deposited": "total deposited", "decision_time_first_invest": "first decision time",
    "invested_r1": "invested in round 1", "verify_any": "verified anything", "verify_count": "verification opens",
    "app_trust": "trust rating (1–7)", "app_urgency": "urgency rating (1–7)",
    "trap_score_shared8": "trap score (shared 8)", "trap_hook": "invested in round 1 (hook)",
    "vip_upgrade": "deposited ≥ ₹5,000 (VIP 2+)", "vip_level": "VIP level (0–3)", "r4_amount": "round-4 stake",
    "r1_amount": "round-1 stake", "r2_amount": "round-2 stake", "escalation_ratio": "escalation ratio (r2 ÷ r1)",
    "chat_deposit": "deposit within 60 s of the chat", "tax_paid": "paid the withdrawal tax",
    "deal_details": "opened deal details", "deal_invest": "invested in the deal", "deal_time": "deal decision time",
    "crash_topup": "topped up after the crash", "crash_topup_amount": "top-up amount", "pool_join": "joined the pool",
    "pool_details": "opened pool details", "pool_time": "pool decision time",
    "post_withdrawal_deposit": "deposit after the withdrawal stage", "withdrew": "took the test withdrawal",
    "reinvest_amount": "Gold Plan amount", "reinvest_accept": "accepted the Gold Plan",
    "victimization": "fraud victimization", "la_group": "loss-aversion group",
    "log1p(total_deposited)": "log(1 + total deposited)",
    "feature_push_timer": "said the timer pushed them", "feature_push_bonus": "said the locked bonus pushed them",
    "feature_push_vip": "said the VIP levels pushed them", "feature_push_regulator": "said the NDIA badge pushed them",
    "feature_push_social": "said the social proof pushed them", "feature_push_chat": "said the mentor chat pushed them",
    "feature_push_tax": "said the withdrawal tax pushed them",
    "targeted": "targeted by fraud", "lost_all": "lost money to fraud", "lost_targeted": "lost money (if targeted)",
    "guaranteed": "would take a guaranteed 25% offer", "guaranteed_or_unsure": "guaranteed offer: yes or not sure",
    "regulator": "checked a regulator",
}
STANDARD_EFFECTS = ("Cliff", "Odds ratio", "Interaction odds", "Share", "η²", "Kendall", "Spearman")


def cap(s: str) -> str:
    return s[:1].upper() + s[1:] if s else s
ROLE_LABEL = {"primary": "Primary", "secondary": "Secondary", "robustness": "Robustness", "exploratory": "Exploratory",
              "descriptive": "Descriptive", "check": "Check", "primary-dataset": "Primary (dataset)",
              "secondary-dataset": "Secondary (dataset)"}
VERDICT_CLASS = {"SUPPORTED": "supported", "PARTLY SUPPORTED": "partly", "NOT SUPPORTED": "not",
                 "NOT TESTABLE": "grey", "EXPLORATORY": "grey", "DESCRIPTIVE": "grey", "PENDING": "pending"}


def load() -> dict:
    with open(os.path.join(RESULTS, "results.json"), encoding="utf-8") as f:
        return json.load(f)


class R:
    """Convenience wrapper around results.json."""

    def __init__(self, data: dict):
        self.d = data
        self.tests = {t["id"]: t for t in data["tests"]}
        self.hyps = {h["id"]: h for h in data["hypotheses"]}
        self.s = data["sections"]
        self.meta = data["meta"]

    def t(self, tid):
        return self.tests.get(tid)


# ------------------------------------------------------------------------------------------------ formatting


def num(v, d=2):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "–"
    if isinstance(v, str):
        return v
    if abs(v) >= 1000:
        return f"{v:,.0f}"
    return f"{v:.{d}f}"


def pval(p):
    if p is None:
        return "–"
    return "< 0.001" if p < 0.001 else f"{p:.3f}"


def pct(x, d=0):
    return "–" if x is None else f"{100 * x:.{d}f}%"


def money(v):
    return "–" if v is None else f"₹{v:,.0f}"


def val(outcome, v):
    if v is None:
        return "–"
    if outcome in AMOUNTS:
        return money(v)
    if outcome in SECONDS:
        return f"{v:.1f} s"
    return num(v)


def label(outcome):
    return OUTCOME_LABEL.get(outcome, outcome or "")


def effect_ci(t):
    if t.get("effect") is None:
        return "–"
    e = num(t["effect"])
    if t.get("ci_low") is None:
        return e
    if t.get("effect_name", "").startswith("Share"):
        return f"{pct(t['effect'])} [{pct(t['ci_low'])}, {pct(t['ci_high'])}]"
    return f"{e} [{num(t['ci_low'])}, {num(t['ci_high'])}]"


def short_effect_name(t):
    n = t.get("effect_name") or ""
    if n.startswith("Cliff"):
        return "δ"
    if n.startswith("Odds ratio") or n.startswith("Interaction odds"):
        return "OR"
    if n.startswith("Share"):
        return "share"
    if n.startswith("η²"):
        return "η²_Q"
    if n.startswith("Kendall"):
        return "W"
    if n.startswith("Spearman"):
        return "ρ"
    if n.startswith("Difference"):
        return "diff"
    return "b"


def headline(t) -> str:
    """'δ = 0.26 [−0.07, 0.56], p = 0.102'"""
    if t is None:
        return "–"
    if t.get("pending"):
        return "pending (external dataset)"
    if not t["testable"]:
        return "not testable: " + (t.get("note") or "")
    s = f"{short_effect_name(t)} = {effect_ci(t)}"
    if t.get("p") is not None:
        s += f", p = {pval(t['p'])}" if t["p"] >= 0.001 else ", p < 0.001"
    return s


def n_text(t) -> str:
    if not t or not t.get("n"):
        return "–"
    return ", ".join(f"{k} {v}" for k, v in t["n"].items())


def direction_text(t) -> str:
    ok = t.get("direction_ok")
    if t.get("role") in ("check", "descriptive") or ok is None:
        return "–"
    return "as predicted" if ok else "opposite"


# ------------------------------------------------------------------------------------------------ test sentences


def group_summary(t) -> str:
    """One clause describing the groups of a two-group test."""
    sm, out = t.get("summary") or {}, t.get("outcome")
    groups = t.get("groups") or list(sm)
    parts = []
    for g in groups:
        x = sm.get(g, {})
        if "share" in x:
            parts.append(f"{g} {x['yes']}/{x['n']} ({pct(x['share'])})")
        elif "median" in x:
            parts.append(f"{g} median {val(out, x['median'])} (mean {val(out, x['mean'])}, n = {x['n']})")
    return " vs ".join(parts)


def sentence(t) -> str:
    if t is None:
        return ""
    if t.get("pending"):
        return f"{cap(label(t['outcome']))}: **pending** — the external dataset has not been added."
    if not t["testable"]:
        return f"{cap(label(t['outcome']))}: not testable ({t.get('note')})."
    name = cap(label(t["outcome"]))
    en = t.get("effect_name") or ""
    if t.get("pairwise"):
        name = cap(t["prediction"])
    elif en and not en.startswith(STANDARD_EFFECTS):
        name = f"{name} — {en[:1].lower() + en[1:]}"
    if (t.get("effect_name") or "").startswith("Share"):
        sm = t["summary"]
        return f"{name}: {sm['yes']} of {sm['n']} ({pct(t['effect'])}, 95% CI {pct(t['ci_low'])}–{pct(t['ci_high'])})."
    gs = group_summary(t) if t.get("groups") else ""
    core = f"{name}: {gs + '; ' if gs else ''}{headline(t)}"
    if t.get("p_holm") is not None:
        core += f" (Holm p = {pval(t['p_holm'])})"
    d = direction_text(t)
    if d != "–":
        core += f" — direction {d}"
    return core + "."


def test_rows(r: R, ids) -> list[dict]:
    rows = []
    for tid in ids:
        t = r.t(tid)
        if t is None:
            continue
        rows.append({
            "Role": ROLE_LABEL.get(t["role"], t["role"]), "Outcome": label(t["outcome"]),
            "Prediction": t.get("prediction") or "–", "Test": t.get("test") or "–",
            "Statistic": (f"{t['statistic_name']} = {num(t['statistic']) if not isinstance(t['statistic'], str) else t['statistic']}"
                          if t.get("statistic_name") and t.get("statistic") is not None else "–"),
            "p": pval(t.get("p")), "Holm p": pval(t.get("p_holm")),
            "Effect [95% CI]": (f"{short_effect_name(t)} = {effect_ci(t)}" if t.get("effect") is not None else
                                ("pending" if t.get("pending") else (t.get("note") or "–"))),
            "n": n_text(t), "Direction": direction_text(t),
        })
    return rows


def all_ids(hid: str) -> list[str]:
    sp = SPEC[hid]
    ids = ([sp["primary"]] if sp.get("primary") else []) + sp.get("secondary", []) + sp.get("extra", [])
    return ids


def ext_done(r: R, hid: str) -> bool:
    return r.s.get("external", {}).get(hid, {}).get("status") == "done"


def dataset_ids(r: R, hid: str) -> list[str]:
    """Tests of the external-dataset part (NFCS), in the order they were run."""
    if not ext_done(r, hid):
        return []
    return [k for k, t in r.tests.items() if t["hypothesis"] == hid and
            (k.startswith(f"{hid}.dataset") or k.startswith(("H8.state", "H8.inv")))]


def ids_for(r: R, hid: str) -> list[str]:
    """App-part tests of a hypothesis (the dataset part has its own table)."""
    ids = [i for i in all_ids(hid) if i in r.tests]
    if hid in ("H8", "H9") and ext_done(r, hid):
        ds = set(dataset_ids(r, hid))
        ids = [i for i in ids if i not in ds]
    return ids


# ------------------------------------------------------------------------------------------------ hypothesis text


def result_paragraphs(r: R, hid: str) -> list[str]:
    sp, out = SPEC[hid], []
    s = r.s
    if hid == "H2":
        out.append(f"{s['H2']['excluded_r1_zero']} players skipped round 1 and have no escalation ratio "
                   f"(small win {s['H2']['excluded_by_condition']['small_win']}, flat "
                   f"{s['H2']['excluded_by_condition']['flat']}); they stay in the round-2 stake comparison.")
    if hid == "H4":
        h = s["H4"]
        dist = ", ".join(f"{k}: {v}" for k, v in h["distribution"].items())
        out.append(f"Loss-aversion groups among consistent players: {dist}; {h['inconsistent']} inconsistent players "
                   f"excluded. The largest group holds {pct(h['largest_group_share'])} of players, so the test is "
                   + ("**marked low-power** (> 70%)." if h["low_power"] else "not marked low-power (threshold 70%)."))
    if hid == "H8":
        h = s["H8"]
        dist = ", ".join(f"{k} correct: {v}" for k, v in h["literacy_distribution"].items())
        out.append(f"Literacy score distribution: {dist}. {pct(h['share_at_3'])} score 3 of 3"
                   + (", so a **ceiling effect** is flagged: literacy hardly varies, which limits what the model can "
                      "detect." if h["ceiling_effect"] else "."))
    if hid == "H3":
        p = r.t("H3.primary")["summary"]
        i = r.t("H3.sec.deal_invest")["summary"]
        out.append("Details opened by size: " + ", ".join(f"₹{int(k):,} {v['yes']}/{v['n']} ({pct(v['share'])})"
                                                          for k, v in p.items())
                   + ". Invested by size: " + ", ".join(f"₹{int(k):,} {v['yes']}/{v['n']} ({pct(v['share'])})"
                                                       for k, v in i.items()) + ".")
    primary = r.t(sp["primary"]) if sp.get("primary") else None
    if primary is not None:
        out.append("**Primary.** " + sentence(primary))
    secs = [r.t(x) for x in sp.get("secondary", []) if r.t(x)]
    if secs:
        out.append("**Secondary.** " + " ".join(sentence(t) for t in secs))
    if hid == "H1c":
        w = s["H1c_within_fraud"]
        out.append(f"Within fraud (descriptive): {w['vip_nudge_taps_any']} of {w['n']} players tapped an after-round "
                   f"VIP nudge (mean {num(w['vip_nudge_taps_mean'])} taps); {w['vip_level_ups_any']} of {w['n']} saw "
                   f"at least one level-up (mean {num(w['vip_level_ups_mean'])}).")
    if hid == "H1f":
        out.append(f"{s['H1f_chat']['chat_open']} of {s['H1f_chat']['n']} fraud players opened the mentor chat.")
    if hid == "H1g":
        out.append(f"{s['H1g_tax']['tax_shown']} of {s['H1g_tax']['n']} fraud completers reached the tax block.")
    if hid == "H1h":
        ux = s["H1h_ux_map"]
        out.append("Ranked: " + "; ".join(f"{u['feature']} {u['yes']}/{u['n']} ({pct(u['share'])})" for u in ux) + ".")
        c = s["H1h_feature_push_count"]
        out.append(f"On average fraud players said {num(c['mean'], 1)} of 7 features pushed them (median "
                   f"{num(c['median'], 1)}); {c['zero']} said none did.")
    if hid == "H9":
        h = s["H9"]
        g = h["group_sizes_model"]
        out.append(f"Model sample: {h.get('n', '–')} players (male {g['male']}, not male {g['not male']}). Gender in "
                   "all completers: " + ", ".join(f"{k} {v}" for k, v in h["gender_counts_all"].items())
                   + ". Age: " + ", ".join(f"{k} {v}" for k, v in h["age_counts"].items())
                   + ". Income: " + ", ".join(f"{k} {v}" for k, v in h["income_counts"].items()) + ".")
        for b in ("la_group", "fomo_score", "overconfidence", "crt_correct"):
            t = r.t(f"H9.app.{b}_x_male")
            if t:
                out.append(f"`{b}` × male: interaction b = {effect_ci(t)}, p = {pval(t['p'])}.")
    for x in sp.get("extra", []):
        t = r.t(x)
        if t and t["role"] == "exploratory" and hid != "H9":
            out.append("**Exploratory.** " + sentence(t) + (f" Model R² = {num(t['r2'])}." if t.get("r2") else ""))
    return out


def not_justified(r: R, hid: str) -> list[str]:
    sp, h = SPEC[hid], r.hyps[hid]
    out = []
    primary = r.t(sp["primary"]) if sp.get("primary") else None
    v = h["verdict"]
    if primary is not None and primary["testable"] and primary.get("p") is not None and v in ("NOT SUPPORTED",
                                                                                           "PARTLY SUPPORTED"):
        if primary.get("direction_ok") is False and primary["p"] < 0.10:
            out.append(f"The primary estimate points the **opposite** way ({headline(primary)}). This was not predicted "
                       "and is not significant at 0.05, so it is not a confirmed reverse effect either; it is a "
                       "pattern to re-test.")
        elif primary["p"] >= 0.05:
            out.append(("In the app, a" if hid in ("H8", "H9") and ext_done(r, hid) else "A")
                       + f" non-significant result is not evidence of no effect: the 95% CI ({effect_ci(primary)}) "
                       "is wide enough to include both no effect and a sizeable effect. The data cannot decide "
                       "between them at this sample size.")
    if v == "SUPPORTED" and primary is not None and primary.get("p_holm") is not None:
        out.append(f"The result survives the Holm correction (Holm p = {pval(primary['p_holm'])})."
                   if primary["p_holm"] < 0.05 else
                   f"After the Holm correction the result is no longer significant (Holm p = "
                   f"{pval(primary['p_holm'])}); treat it as suggestive.")
    if hid.startswith("H1") and hid not in ("H1g", "H1h"):
        a = r.s["attrition"]["completion_skin"]
        out.append(f"Fraud players dropped out more ({a['fraud']['completed']}/{a['fraud']['consented']} completed vs "
                   f"{a['honest']['completed']}/{a['honest']['consented']} honest), so the fraud finishers are a "
                   "selected group; a skin difference among finishers is not a clean causal effect of the design.")
    out.append(sp["overclaim"])
    if hid in ("H8", "H9") and ext_done(r, hid):
        out += dataset_not_justified(r, hid)
    if hid == "H8":
        lit = r.t("H8.literacy")
        if lit and lit["ci_low"] is not None:
            if lit["ci_high"] < 0:
                out.append("The literacy CI lies entirely below 0: in this sample literacy does protect.")
            else:
                out.append(f"Literacy coefficient {effect_ci(lit)} traps per correct answer: there is **no evidence "
                           f"that literacy protects**, but the CI still allows a protective effect of up to "
                           f"{num(abs(lit['ci_low']))} fewer traps per correct answer, so this is **not** evidence "
                           "that literacy does not matter.")
    return out


def robustness(r: R, hid: str) -> list[str]:
    out = []
    sp = SPEC[hid]
    primary = r.t(sp["primary"]) if sp.get("primary") else None
    if primary is not None and primary.get("holm_family"):
        fam = "H1 family (H1, H1a/H1e, H1b, H1c, H1d, H1f)" if primary["holm_family"] == "H1" else \
            "H2–H7 primary tests"
        out.append(f"Holm-adjusted p for the primary test within the {fam}: {pval(primary.get('p_holm'))} "
                   f"(raw p = {pval(primary.get('p'))}). Verdicts use the raw p-value as pre-registered.")
    if hid in ("H1", "H1a", "H1e"):
        full = r.t("H1.sec.decision_time" if hid == "H1" else "H1ae.primary")
        trim = r.t("H1.rob.decision_time_no_outliers" if hid == "H1" else "H1ae.rob.no_outliers")
        ch = r.s["checks"]["time_outliers"]
        out.append(f"Decision-time outliers (> {num(r.s['checks']['time_outlier_threshold_s'], 1)} s): "
                   f"{ch['honest']} honest, {ch['fraud']} fraud. With them: {headline(full)}; without them: "
                   f"{headline(trim)}. " + ("Same conclusion." if (full['p'] < 0.05) == (trim['p'] < 0.05) else
                                            "**The conclusion changes without the outliers.**"))
    if hid == "H1":
        out += itt_lines(r, "H1")
    if hid == "H2":
        out += itt_lines(r, "H2")
    if hid == "H3":
        for nm in ("details", "invest"):
            t = r.t(f"H3.order.{nm}_by_position")
            if t:
                sm = ", ".join(f"{k} {pct(v['share'])}" for k, v in t["summary"].items())
                out.append(f"Card-position check ({nm}): {sm}; Cochran's Q p = {pval(t['p'])}.")
        pairs = [r.t(f"H3.pair.details_{a}_vs_{b}") for a, b in ((500, 3000), (500, 8000), (3000, 8000))]
        out.append("Pairwise McNemar on details (Holm within H3): " + "; ".join(
            f"₹{p['id'].split('_')[1]} vs ₹{p['id'].split('_')[3]}: diff {num(p['effect'])} "
            f"[{num(p['ci_low'])}, {num(p['ci_high'])}], p = {pval(p['p'])}, Holm p = {pval(p['p_holm'])}"
            for p in pairs if p) + ".")
    if hid == "H4":
        t = r.t("H4.order.spin_order")
        if t:
            out.append(f"Spin-order check: loss-aversion group by spin order, {headline(t)} (a check, not a "
                       "hypothesis test).")
    return out


ITT_PAIRS = {
    "H1": [("H1.sec.invested_r1", "H1.itt.invested_r1"), ("H1.sec.decision_time", "H1.itt.decision_time"),
           ("H1.rob.r1_amount", "H1.itt.r1_amount")],
    "H2": [("H2.primary", "H2.itt.escalation_ratio"), ("H2.sec.r2_amount", "H2.itt.r2_amount")],
}


def same_conclusion(c, i) -> bool:
    """Same conclusion = both non-significant, or both significant in the same direction."""
    if c["p"] >= 0.05 and i["p"] >= 0.05:
        return True
    return c["p"] < 0.05 and i["p"] < 0.05 and c["direction_ok"] == i["direction_ok"]


def itt_lines(r: R, hid: str) -> list[str]:
    out = []
    itt = r.s["attrition"]["itt"]
    out.append(f"Intention-to-treat rerun on everyone who reached the home screen (honest "
               f"{itt['reached_home']['honest']}, fraud {itt['reached_home']['fraud']}; "
               f"{itt['non_completers_included']} non-completers added):")
    for comp_id, itt_id in ITT_PAIRS[hid]:
        c, i = r.t(comp_id), r.t(itt_id)
        if not c or not i:
            continue
        same = same_conclusion(c, i)
        out.append(f"- {label(c['outcome'])}: completers {headline(c)}; ITT {headline(i)} → "
                   + ("same conclusion." if same else "**conclusion changes**."))
    return out


def itt_changes(r: R) -> list[str]:
    ch = []
    for hid, pairs in ITT_PAIRS.items():
        for comp_id, itt_id in pairs:
            c, i = r.t(comp_id), r.t(itt_id)
            if c and i and not same_conclusion(c, i):
                ch.append(f"{hid} {label(c['outcome'])}: completers p = {pval(c['p'])} → ITT p = {pval(i['p'])}")
    return ch


# ------------------------------------------------------------------------------------------------ attrition text


def attrition_paragraphs(r: R) -> list[str]:
    a = r.s["attrition"]
    cs = a["completion_skin"]
    o = a["completion_skin_or"]
    out = [f"Of {a['consented']} consented players, {a['completed']} reached the report card. Completion: honest "
           f"{cs['honest']['completed']}/{cs['honest']['consented']} ({pct(cs['honest']['rate'])}, 95% CI "
           f"{pct(cs['honest']['ci_low'])}–{pct(cs['honest']['ci_high'])}) vs fraud {cs['fraud']['completed']}/"
           f"{cs['fraud']['consented']} ({pct(cs['fraud']['rate'])}, {pct(cs['fraud']['ci_low'])}–"
           f"{pct(cs['fraud']['ci_high'])}); Fisher p = {pval(a['completion_skin_p'])}, odds ratio of completing "
           f"(fraud vs honest) {num(o[0])} [{num(o[1])}, {num(o[2])}]."]
    others = [x for x in a["completion_by_factor"] if x["factor"] != "skin"]
    ps = sorted({(x["factor"], x["fisher_p"]) for x in others})
    out.append("No other randomized factor changed completion (" + "; ".join(f"{f} p = {pval(p)}" for f, p in ps) + ").")
    ph = a["dropout_phase"]
    out.append("Where drop-outs stopped (honest vs fraud): " + "; ".join(
        f"{x['phase']}: {x['honest']} vs {x['fraud']} (Fisher p = {pval(x['fisher_p_fraud_vs_honest'])})" for x in ph)
        + ". The profile screens already looked different (fraud neon look and avatar picker), so \"before the home "
          "screen\" means before any money or game mechanic, not before any visual difference.")
    hd = a["home_dropouts_detail"]
    made = hd["honest"]["made_s3_decision"] + hd["fraud"]["made_s3_decision"]
    out.append(f"Players who stopped on the home screen: honest {hd['honest']['n']}, fraud {hd['fraud']['n']}; "
               f"{made} of them made the first Invest/Skip decision. {hd['fraud']['closed_vip_popup']} of the "
               f"{hd['fraud']['n']} fraud players among them had closed the VIP pop-up first"
               + (", so they left while looking at the fraud dashboard." if hd["fraud"]["n"] and
                  hd["fraud"]["closed_vip_popup"] == hd["fraud"]["n"] else "."))
    ch = r.s["checks"]
    out.append(f"Randomization among completers: skin is independent of every other factor (smallest Fisher p = "
               f"{pval(ch['randomization_min_p'])}). {ch['la_inconsistent']} players gave inconsistent spin answers "
               f"(excluded from H4); {ch['crt_non_numeric_all']} CRT answers were not numbers; "
               f"{ch['duplicate_round_events']['players']} player had duplicated round events (first event used).")
    return out


def attrition_bias(r: R) -> list[str]:
    cs = r.s["attrition"]["completion_skin"]
    if cs["fraud"]["rate"] >= cs["honest"]["rate"]:
        return ["Completion did not differ in the direction that would select fraud finishers."]
    return [
        "Fraud players dropped out more, so the fraud finishers are likely the players who were more willing to "
        "engage with a pushy app (or more patient with a longer game). Possible direction of the bias for each H1 "
        "result, comparing fraud finishers with all fraud starters:",
        "- **Amounts and investing (total deposited, round-1 investing, round-4 stake, VIP):** if disengaged or "
        "sceptical players left, the remaining fraud players are the more willing investors, which would make "
        "fraud look *higher* than it would be for everyone randomized: a bias towards H1. The ITT rerun "
        "(round 1 only) is the check for this.",
        "- **Verification (H1d):** if sceptical players who would have checked the app left instead, fraud finishers "
        "verify less partly because of who stayed: a bias towards H1d. The fraud skin also had more to verify "
        "(badge), which works against H1d; the two cannot be separated.",
        "- **Trust and urgency ratings:** finishers of a pushy app are likely the less suspicious players, a bias "
        "towards higher fraud trust" + (
            "; the observed fraud trust is nevertheless not higher than honest trust, so selection cannot have "
            "created a trust effect here." if r.t("H1.sec.app_trust") and r.t("H1.sec.app_trust")["effect"] is not None
            and r.t("H1.sec.app_trust")["effect"] <= 0 else
            "; part of any fraud-trust advantage could therefore be selection."),
        "- **Decision time:** players who left on the home screen never made the first decision, so the ITT timing "
        "rerun cannot include them; fast and slow leavers are both possible, the direction is unknown.",
        "- **Trap score:** traps from the later screens are counted only for finishers; if quitters were the "
        "players who would have avoided traps, the fraud trap score is biased upwards.",
    ]


# ------------------------------------------------------------------------------------------------ held / not


def held_lists(r: R) -> tuple[list[str], list[str], list[str]]:
    held, not_held, other = [], [], []
    for hid, h in r.hyps.items():
        sp = SPEC[hid]
        p = r.t(sp["primary"]) if sp.get("primary") else None
        line = f"**{hid} {sp['short']}** — {h['verdict']}" + (f": {headline(p)}" if p and p.get('p') is not None else "")
        if h["verdict"] in ("SUPPORTED", "PARTLY SUPPORTED"):
            held.append(line)
        elif h["verdict"] == "NOT SUPPORTED":
            not_held.append(line + (f" ({h['label']})" if h.get("label") else ""))
        else:
            other.append(f"**{hid} {sp['short']}** — {h['verdict']}" + (f" ({h['label']})" if h.get("label") else ""))
    sig = [t for t in r.tests.values() if t["role"] in ("secondary", "robustness") and t.get("p") is not None
           and t["p"] < 0.05 and t.get("direction_ok") and not t.get("pairwise")]
    held_primaries = [r.t(SPEC[h]["primary"]) for h, x in r.hyps.items()
                      if x["verdict"] in ("SUPPORTED", "PARTLY SUPPORTED") and SPEC[h].get("primary")]
    sig = [t for t in sig if not any(p and p["outcome"] == t["outcome"] and p.get("p") == t.get("p")
                                     for p in held_primaries)]
    for t in sig:
        held.append(f"Secondary/robustness finding (not a verdict on its own): {t['hypothesis']} "
                    f"{label(t['outcome'])} — {headline(t)}")
    return held, not_held, other


def limitations(r: R) -> list[str]:
    m, s = r.meta, r.s
    ages = s["H9"]["age_counts"]
    n = m["completed"]
    young = ages.get("18_20", 0)
    gender = s["H9"]["gender_counts_all"]
    a = s["attrition"]["completion_skin"]
    ext = s["external"]["H8"]
    inv = r.t("H1.sec.invested_r1")["summary"]
    inv_txt = ", ".join(f"{g} {pct(v['share'])}" for g, v in inv.items())
    lim = [
        f"**Sample:** {n} completers from one college population; {young} of {n} are aged 18–20 and {gender.get('male', 0)} "
        f"of {n} are male. Small groups give wide confidence intervals: many non-significant results are inconclusive, "
        "not evidence of no effect.",
        f"**Differential attrition:** {a['fraud']['completed']}/{a['fraud']['consented']} fraud vs "
        f"{a['honest']['completed']}/{a['honest']['consented']} honest players finished. Completer comparisons of the "
        "skins are not fully randomized comparisons (see the attrition section).",
        "**Bundled features (H1):** the fraud skin switches on all dark-design features together, so sub-hypotheses "
        "H1a–H1g cannot be separated causally; the feature cards are self-reports from fraud players only.",
        f"**Ceiling effects:** {pct(s['H8']['share_at_3'])} of players got all three literacy questions right, and "
        f"round-1 investing was {inv_txt}, which leaves little room for differences in H1b and H8.",
        "**Virtual money:** all amounts are virtual rupees in a short game; real losses, real friends and real "
        "apps carry stakes the experiment cannot reproduce.",
        "**Unequal length:** the honest skin is about a minute shorter (no chat, no feature cards, no tax screen); "
        "fatigue may differ for the late-game outcomes.",
        "**Multiple testing:** many outcomes were tested; Holm-adjusted p-values are shown, and verdicts use raw "
        "p-values as pre-registered.",
        "**Survey:** a separate convenience sample, not linked to the app players; only "
        f"{s['survey']['invested_count']['yes']} respondents had invested, so the victim-sequence questions are "
        "counts only.",
    ]
    if ext.get("status") == "done":
        lim.append("**NFCS datasets (H8, H9):** US adults and US investors, not Indian students; cross-sectional "
                   "associations, not causal effects; victimization is self-reported for the past year, and being "
                   "'targeted' partly measures noticing an approach. The State-by-State survey covers any financial "
                   "fraud, not only investment fraud.")
    if ext.get("status") != "done":
        lim.append("**External dataset pending:** the population-level parts of H8 and H9 (age, income, real "
                   "victimization) are not yet run; H8 and H9 verdicts rest on app evidence only.")
    return lim


# ------------------------------------------------------------------------------------------------ external datasets


def or_txt(o: dict) -> str:
    pv = pval(o["p"])
    return f"OR {o['odds_ratio']:.2f} [{o['or_ci_low']:.2f}, {o['or_ci_high']:.2f}], p {pv if pv.startswith('<') else '= ' + pv}"


def _protects(o: dict, lower_is_protective: bool = True) -> bool:
    return o["or_ci_high"] < 1 if lower_is_protective else o["or_ci_low"] > 1


def dataset_headline(r: R, hid: str) -> str:
    if hid == "H8":
        t = r.t("H8.dataset")
        return f"NFCS Investor (targeted): {headline(t)}"
    res = r.s["external"]["H9"]["groupings"]["lost_all"]
    return "NFCS State (lost money): " + "; ".join(f"{g['grouping']} p = {pval(g['p'])}" for g in res)


def dataset_block(r: R, hid: str) -> list[tuple[str, object]]:
    """Items ('h' heading, 'p' paragraph, 'list' bullets, 'table' rows, 'fig' figure name) for the dataset part."""
    if not ext_done(r, hid):
        return []
    e = r.s["external_dataset"]
    st, inv = e["state"], e["investor"]
    ext = r.s["external"][hid]
    out: list[tuple[str, object]] = [("h", "Dataset part: NFCS 2024 (United States)")]
    out.append(("p", f"**Dataset verdict: {ext['verdict']}** — {ext['reason']}. {e['estimation']}"))
    if hid == "H8":
        sm, im = e["state_models"], e["investor_models"]
        out.append(("p", f"**Data.** {inv['name']}: {inv['rows']:,} investors; {inv['n_targeted']} said they were "
                         f"targeted by an investment fraud in the past year and {inv['n_lost']} lost money "
                         f"(weighted {pct(inv['weighted_targeted'], 1)} targeted). Investing knowledge = "
                         f"{inv['quiz_items']}-item quiz (don't know = wrong; "
                         f"{', '.join(inv['quiz_excluded'])} left out as a newer item), mean {inv['quiz_mean']:.1f}. "
                         f"{inv['link']['matched_in_state_file']:,} of {inv['link']['investor_rows']:,} investors link "
                         f"to the State-by-State file by NFCSID. {st['name']}: {st['rows']:,} adults; weighted "
                         f"{pct(st['weighted_targeted'], 1)} targeted by any financial fraud, "
                         f"{pct(st['weighted_lost_all'], 1)} lost money. Big Three literacy scores 3 of 3 for "
                         f"{pct(st['share_lit_3'])} of State respondents (no ceiling, unlike the app's "
                         f"{pct(r.s['H8']['share_at_3'])})."))
        t = im["targeted"]
        out.append(("p", f"**Primary (fixed before fitting): Investor Survey, targeted by investment fraud.** "
                         f"Overconfidence {or_txt(t['oc'])}; investing knowledge {or_txt(t['lit'])} "
                         f"(n = {t['n']:,}, {t['events']} targeted)."))
        lines = []
        for key, lab in (("lost_all", "lost money to investment fraud"),
                         ("guaranteed", "would invest in a 'guaranteed, risk-free 25% a year' offer (yes vs no)"),
                         ("guaranteed_or_unsure", "same offer, yes or not sure vs no (robustness)"),
                         ("regulator", "ever checked a regulator about a financial professional (OR > 1 = more "
                                       "checking)")):
            m = im[key]
            low = r.t({"lost_all": "H8.inv.lost", "guaranteed": "H8.inv.guaranteed",
                       "guaranteed_or_unsure": "H8.inv.guaranteed_unsure", "regulator": "H8.inv.regulator"}[key])
            flag = " **Low power** (" + low["note"].split(":")[1].strip() + ")" if low.get("low_power") else ""
            lines.append(f"- Investor, {lab}: overconfidence {or_txt(m['oc'])}; knowledge {or_txt(m['lit'])} "
                         f"(n = {m['n']:,}).{flag}")
        b3, ff = im["targeted_big3"], im["targeted_finfluencer"]
        lines.append(f"- Investor, targeted, with the **Big Three** from the linked State answers instead of the quiz: "
                     f"overconfidence {or_txt(b3['oc'])}; literacy {or_txt(b3['lit'])} (n = {b3['n']:,}).")
        lines.append(f"- Investor, targeted, adding finfluencer use: overconfidence {or_txt(ff['oc'])}; finfluencer "
                     f"use {or_txt(ff['finfluencer'])}.")
        for y, m in sm.items():
            lines.append(f"- State-by-State, {m['label']}: literacy {or_txt(m['lit'])}; overconfidence "
                         f"{or_txt(m['oc'])} (n = {m['n']:,}, {m['events']:,} events).")
        out.append(("p", "**All NFCS models** (odds ratios per SD, survey-weighted):"))
        out.append(("list", lines))
        out.append(("fig", "external_H8"))
        out.append(("table", test_rows(r, dataset_ids(r, hid))))
        out.append(("h", "Replication check: our State-by-State odds ratios vs the teammate's NFCS report"))
        rep_rows = e["replication"]
        out.append(("table", [{"Outcome": x["outcome"], "Predictor": x["predictor"],
                               "Ours [95% CI]": f"{x['ours']:.2f} {x['ours_ci']}", "Teammate": f"{x['teammate']:.2f}",
                               "Difference": f"{x['difference']:+.2f}",
                               "> 0.02?": "yes" if x["flag"] else "no"} for x in rep_rows]))
        flagged = [x for x in rep_rows if x["flag"]]
        biggest = max(abs(x["difference"]) for x in rep_rows)
        if flagged:
            out.append(("p", "Differences larger than 0.02: " + "; ".join(
                f"{x['outcome']} {x['predictor']} ({x['difference']:+.2f})" for x in flagged)
                + ". Possible reasons: different controls, weights or coding of 'don't know' answers; the teammate's "
                  "exact specification is not in this repository. "
                + ("All teammate values lie inside our 95% CIs." if all(x["teammate_in_our_ci"] for x in rep_rows)
                   else "Some teammate values lie outside our 95% CIs.")))
        else:
            out.append(("p", f"All six odds ratios agree within 0.02 (largest absolute difference {biggest:.2f}), so no "
                             "difference needs explaining; every teammate value lies inside our 95% CI. Our "
                             "specification: Big Three with don't know = wrong, z-scored literacy and "
                             "overconfidence, national weights (wgt_n2), controls for financial education, age, "
                             "gender, income, risk willingness and owning investments."))
        out.append(("h", "Reparameterization: one model, two readings of the literacy coefficient"))
        out.append(("p", "a·z(lit) + b·(z(self) − z(lit)) = (a − b)·z(lit) + b·z(self). The two versions fit the data "
                         "identically (the largest coefficient difference after the conversion is printed below, "
                         "zero up to rounding). With overconfidence in the model, the literacy odds ratio compares "
                         "people with the same overconfidence; with the self-rating in the model, it compares people "
                         "with the same self-rating."))
        out.append(("table", [{"Outcome": m["label"], "Literacy (at equal overconfidence)": or_txt(m["lit"]),
                               "Overconfidence": or_txt(m["oc"]),
                               "Literacy (at equal self-rating)": or_txt(m["reparam"]["lit"]),
                               "Self-rating": or_txt(m["reparam"]["self"]),
                               "Max. difference": f"{m['reparam']['max_abs_diff']:.1e}"} for m in sm.values()]))
        out.append(("h", "Where the app and the NFCS disagree"))
        out.append(("list", disagreements(r)))
    if hid == "H9":
        res = ext["groupings"]
        out.append(("p", f"**Data.** {st['name']}: {st['rows']:,} adults. Primary outcome (fixed before fitting): lost "
                         "money to a fraud. Bias proxies: z(overconfidence) and z(risk willingness); literacy and the "
                         "other controls are in every model. The within-group models are **exploratory**; Holm is "
                         "applied over the three groupings within each outcome."))
        rows = []
        for y, rs in res.items():
            for g in rs:
                rows.append({"Outcome": y.replace("_", " "), "Grouping": g["grouping"],
                             "Wald χ² (df)": f"{g['stat']:.1f} ({g['df']})", "p": pval(g["p"]),
                             "Holm p": pval(g["p_holm"]),
                             "Strongest bias by group": "; ".join(f"{k}: {v}" for k, v in g["strongest"].items())})
        out.append(("table", rows))
        out.append(("fig", "external_H9"))
    return out


def disagreements(r: R) -> list[str]:
    e = r.s["external_dataset"]
    sm, im = e["state_models"], e["investor_models"]
    app_lit, app_oc = r.t("H8.literacy"), r.t("H8.primary")
    out = []
    app_lit_txt = (f"no evidence that literacy protects (b = {effect_ci(app_lit)} traps per correct answer)"
                   if app_lit["ci_high"] >= 0 else f"literacy protects (b = {effect_ci(app_lit)})")
    state_prot = [m for m in sm.values() if _protects(m["lit"])]
    out.append(f"**Literacy.** The game shows {app_lit_txt}. In the State-by-State survey higher literacy goes with "
               f"lower odds of fraud in {len(state_prot)} of {len(sm)} outcomes ("
               + "; ".join(f"{m['label']}: OR {m['lit']['odds_ratio']:.2f}" for m in sm.values()) + "). "
               f"Among investors, more investing knowledge does "
               f"{'not ' if not _protects(im['targeted']['lit']) else ''}lower the odds of being targeted by investment "
               f"fraud (OR {im['targeted']['lit']['odds_ratio']:.2f}) but does "
               f"{'' if _protects(im['guaranteed']['lit']) else 'not '}lower the wish to take a 'guaranteed 25%' "
               f"offer (OR {im['guaranteed']['lit']['odds_ratio']:.2f}).")
    oc_state = [m["oc"]["odds_ratio"] for m in sm.values()]
    out.append(f"**Overconfidence.** In the game it is not significant (b = {effect_ci(app_oc)}, p = "
               f"{pval(app_oc['p'])}). Among investors it is a strong risk factor for being targeted by investment "
               f"fraud (OR {im['targeted']['oc']['odds_ratio']:.2f}) and losing money "
               f"(OR {im['lost_all']['oc']['odds_ratio']:.2f}), but in the general population it goes with slightly "
               f"{'lower' if max(oc_state) < 1 else 'mixed'} odds of any fraud (ORs "
               + ", ".join(f"{x:.2f}" for x in oc_state) + "). With the Big Three instead of the investing quiz, the "
               f"investor effect is OR {im['targeted_big3']['oc']['odds_ratio']:.2f} (p = "
               f"{pval(im['targeted_big3']['oc']['p'])}).")
    out.append("**Possible reasons:** (1) general vs investment fraud: the State survey asks about any financial fraud "
               "or scam, the Investor survey and the app are about investment fraud; (2) real vs simulated money: "
               "the app uses virtual rupees in a 7-minute game; (3) US adults and US investors vs Indian college "
               "students; (4) the ceiling effect in our literacy measure ("
               f"{pct(r.s['H8']['share_at_3'])} of players scored 3 of 3, vs {pct(e['state']['share_lit_3'])} in the "
               "State survey), which leaves almost no variation to detect protection; (5) 'targeted' is self-reported "
               "belief: overconfident, active investors may notice and report approaches more (they also checked a "
               f"regulator more often, OR {im['regulator']['oc']['odds_ratio']:.2f}); (6) different knowledge measures "
               "(an 11-item investing quiz vs the Big Three).")
    return out


def dataset_not_justified(r: R, hid: str) -> list[str]:
    e = r.s["external_dataset"]
    if hid == "H8":
        sm, im = e["state_models"], e["investor_models"]
        out = [f"The dataset verdict rests on the pre-chosen primary model (Investor Survey, targeted by investment "
               f"fraud). It does **not** justify a general claim that overconfidence makes people fall for fraud: in "
               f"the State-by-State survey overconfidence goes with "
               f"{'lower' if all(m['oc']['odds_ratio'] < 1 for m in sm.values()) else 'mixed'} odds of fraud, and "
               f"with the Big Three instead of the quiz the investor effect is "
               f"{'not significant' if im['targeted_big3']['oc']['p'] >= 0.05 else 'still significant'} "
               f"(OR {im['targeted_big3']['oc']['odds_ratio']:.2f})."]
        if any(_protects(m["lit"]) for m in sm.values()):
            out.append("It does **not** justify 'literacy does not protect' in general: in the large US sample, literacy "
                       "clearly goes with lower odds of being targeted and of losing money.")
        out.append("'Targeted' is a self-report of a belief, so a higher rate among overconfident investors may partly "
                   "reflect noticing scams, not falling for them; the NFCS results are associations in US data, not "
                   "causal effects for Indian students.")
        return out
    res = r.s["external"]["H9"]["groupings"]["lost_all"]
    sig = [g for g in res if g["p"] < 0.05]
    return [("The dataset verdict rests on " + (", ".join(f"{g['grouping']} (p = {pval(g['p'])}, Holm p = "
                                                          f"{pval(g['p_holm'])})" for g in sig) or "no grouping")
             + f"; the other groupings show no reliable difference. The 'strongest bias' in each group is a ranking "
               "of point estimates whose CIs overlap, so it is exploratory. US data: it does not show which bias "
               "matters most for Indian students or for age and income groups outside the US.")]
