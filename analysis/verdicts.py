"""Holm adjustment and verdicts, exactly as pre-registered in results/ANALYSIS_PLAN.md (section 2).

Verdicts use raw p-values; Holm-adjusted values are reported alongside."""

from __future__ import annotations

from common import ALPHA, Registry, holm
from spec import SPEC

SUPPORTED, PARTLY, NOT_SUPPORTED = "SUPPORTED", "PARTLY SUPPORTED", "NOT SUPPORTED"
NOT_TESTABLE, EXPLORATORY, DESCRIPTIVE, PENDING = "NOT TESTABLE", "EXPLORATORY", "DESCRIPTIVE", "PENDING"


def apply_holm(reg: Registry) -> None:
    for fam in ("H1", "H2-H7"):
        recs = [t for t in reg.tests if t.get("holm_family") == fam and t["testable"] and t.get("p") is not None]
        for r, ph in zip(recs, holm([r["p"] for r in recs])):
            r["p_holm"] = ph
        reg.sections.setdefault("holm_families", {})[fam] = [r["id"] for r in recs]


def standard_verdict(primary: dict | None, secondaries: list[dict]) -> tuple[str, str]:
    if primary is None or not primary["testable"] or primary.get("p") is None:
        why = (primary or {}).get("note") or "primary test could not be run"
        return NOT_TESTABLE, why
    p, ok = primary["p"], primary["direction_ok"]
    if ok is False:
        if p < ALPHA:
            return NOT_SUPPORTED, f"significant effect in the OPPOSITE direction (p = {p:.3f})"
        return NOT_SUPPORTED, (f"estimate points the opposite way and is not significant (p = {p:.3f}): no "
                               "evidence for the predicted effect")
    if ok and p < ALPHA:
        return SUPPORTED, f"primary in the predicted direction, p = {p:.3f} < 0.05"
    if ok and p < 0.10:
        return PARTLY, f"primary in the predicted direction, 0.05 ≤ p = {p:.3f} < 0.10"
    sec = [s for s in secondaries if s["testable"] and s.get("p") is not None]
    hits = [s for s in sec if s["p"] < ALPHA and s["direction_ok"]]
    if sec and len(hits) > len(sec) / 2:
        return PARTLY, (f"primary not significant (p = {p:.3f}), but {len(hits)} of {len(sec)} secondary outcomes "
                        "significant in the predicted direction")
    if ok is None:
        return NOT_SUPPORTED, f"no difference (effect exactly 0, p = {p:.3f})"
    tail = (f"; {len(hits)} of {len(sec)} secondary tests significant in the predicted direction" if sec else
            "; the secondary outcomes are descriptive shares without a test")
    return NOT_SUPPORTED, f"predicted direction but not significant (primary p = {p:.3f} ≥ 0.10{tail})"


def h8_app_verdict(reg: Registry) -> tuple[str, str]:
    oc, lit = reg.get("H8.primary"), reg.get("H8.literacy")
    if oc is None or not oc["testable"]:
        return NOT_TESTABLE, "model could not be fitted"
    if lit["ci_high"] is not None and lit["ci_high"] < 0:
        return NOT_SUPPORTED, "the literacy CI lies entirely below 0: literacy protects in this sample"
    p, b = oc["p"], oc["effect"]
    if b > 0 and p < ALPHA:
        return SUPPORTED, f"overconfidence coefficient > 0 (p = {p:.3f}) and the literacy CI is not entirely below 0"
    if b > 0 and p < 0.10:
        return PARTLY, f"overconfidence coefficient > 0 with 0.05 ≤ p = {p:.3f} < 0.10; literacy CI not below 0"
    if b <= 0:
        return NOT_SUPPORTED, f"overconfidence coefficient not positive (p = {p:.3f})"
    return NOT_SUPPORTED, f"overconfidence coefficient positive but p = {p:.3f} ≥ 0.10"


def apply_verdicts(reg: Registry, external_status: dict) -> None:
    for hid, sp in SPEC.items():
        primary = reg.get(sp["primary"]) if sp.get("primary") else None
        secs = [reg.get(s) for s in sp.get("secondary", []) if reg.get(s) is not None]
        kind = sp.get("kind", "standard")
        label = None
        if kind == "standard":
            verdict, reason = standard_verdict(primary, secs)
        elif kind == "no_comparison":
            verdict, reason = NOT_TESTABLE, "no comparison group exists in the design; the rate is descriptive"
        elif kind == "descriptive":
            verdict, reason = DESCRIPTIVE, "shares only, no hypothesis test"
        elif kind == "h8":
            app_v, app_r = h8_app_verdict(reg)
            ds = external_status.get("H8", {})
            if ds.get("status") == "done":
                verdict, reason = combine(app_v, ds["verdict"]), f"app: {app_v} ({app_r}); dataset: {ds['verdict']}"
                label = "app + dataset"
            else:
                verdict, reason, label = app_v, app_r, "app evidence only; dataset part PENDING"
            reg.set_hypothesis(hid, app_verdict=app_v, app_reason=app_r, dataset=ds)
        elif kind == "h9":
            ds = external_status.get("H9", {})
            verdict, reason = EXPLORATORY, "app part is exploratory by design (gender only, small groups)"
            label = "app evidence only; dataset part PENDING" if ds.get("status") != "done" else "app + dataset"
            if ds.get("status") == "done":
                verdict, reason = ds["verdict"], f"dataset: {ds['verdict']}; app part exploratory"
            reg.set_hypothesis(hid, app_verdict=EXPLORATORY, dataset=ds)
        else:
            raise ValueError(kind)
        if primary is not None and primary.get("low_power"):
            reason += " (marked low-power: one loss-aversion group holds > 70% of players)"
        reg.set_hypothesis(hid, title=sp["title"], short=sp["short"], prediction=sp["prediction"],
                           primary_test=sp.get("primary"), secondary_tests=sp.get("secondary", []),
                           verdict=verdict, verdict_reason=reason, label=label)


def combine(app: str, dataset: str) -> str:
    """Final H8 verdict when both parts exist: SUPPORTED only if both are; NOT SUPPORTED if both fail."""
    if app == dataset:
        return app
    if NOT_SUPPORTED in (app, dataset) and SUPPORTED not in (app, dataset):
        return NOT_SUPPORTED
    return PARTLY
