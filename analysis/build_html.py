"""Step 7 - results/index.html: one self-contained results page (CSS, JS and figures inline, no external requests),
generated from results.json, the tables and the figures. Rebuilt by run_all.py on every run."""

from __future__ import annotations

import base64
import html
import io
import os
import re

import pandas as pd

from common import FIGURES, RESULTS
from narrative import (R, VERDICT_CLASS, attrition_bias, attrition_paragraphs, headline, held_lists, ids_for,
                       itt_changes, limitations, load, n_text, not_justified, pct, result_paragraphs, robustness,
                       test_rows)
from report import scorecard_rows
from spec import SPEC

ORDER = list(SPEC)


def inline(text: str) -> str:
    """Escape, then render **bold** and `code`."""
    t = html.escape(text, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"`(.+?)`", r"<code>\1</code>", t)
    t = re.sub(r"(?<![\w*])\*(\w[^*]*?)\*(?![\w*])", r"<em>\1</em>", t)
    return t


def paras(items: list[str]) -> str:
    out, ul = [], []
    for x in items:
        if x.startswith("- "):
            ul.append(f"<li>{inline(x[2:])}</li>")
            continue
        if ul:
            out.append("<ul>" + "".join(ul) + "</ul>")
            ul = []
        out.append(f"<p>{inline(x)}</p>")
    if ul:
        out.append("<ul>" + "".join(ul) + "</ul>")
    return "\n".join(out)


def bullets(items: list[str]) -> str:
    return "<ul>" + "".join(f"<li>{inline(x[2:] if x.startswith('- ') else x)}</li>" for x in items) + "</ul>"


def table(rows: list[dict], cls: str = "") -> str:
    if not rows:
        return ""
    cols = list(rows[0])
    nw = {"p", "Holm p", "Role", "Direction", "Hyp."}
    cl = lambda c: ' class="nw"' if c in nw else ""  # noqa: E731
    head = "".join(f"<th{cl(c)}>{html.escape(c)}</th>" for c in cols)
    body = "".join("<tr>" + "".join(f"<td{cl(c)}>{inline(str(r[c]))}</td>" for c in cols) + "</tr>" for r in rows)
    return f'<div class="tablewrap"><table class="{cls}"><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'


MAX_FIG_WIDTH = 1500


def compress_png(path: str) -> bytes:
    """Downscale wide figures and reduce them to a 128-colour palette PNG (text stays sharp on the flat dark
    background); keeps the page small enough to open quickly from disk."""
    from PIL import Image

    im = Image.open(path).convert("RGB")
    if im.width > MAX_FIG_WIDTH:
        im = im.resize((MAX_FIG_WIDTH, round(im.height * MAX_FIG_WIDTH / im.width)), Image.LANCZOS)
    im = im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def fig(name: str, alt: str) -> str:
    path = os.path.join(FIGURES, name + ".png")
    if not os.path.exists(path):
        return f'<p class="missing">Figure missing: {html.escape(name)}</p>'
    b64 = base64.b64encode(compress_png(path)).decode()
    return f'<figure><img alt="{html.escape(alt)}" src="data:image/png;base64,{b64}"></figure>'


def badge(verdict: str, label: str | None = None) -> str:
    cls = VERDICT_CLASS.get(verdict, "grey")
    extra = f'<span class="badge-note">{html.escape(label)}</span>' if label else ""
    return f'<span class="badge {cls}">{html.escape(verdict)}</span>{extra}'


def card(r: R, hid: str) -> str:
    h, sp = r.hyps[hid], SPEC[hid]
    p = r.t(sp["primary"]) if sp.get("primary") else None
    if hid == "H1h":
        top = r.s["H1h_ux_map"][0]
        head = f"Top: {top['feature']} {top['yes']}/{top['n']}"
    elif hid == "H9":
        head = "Exploratory bias × gender model; dataset part pending"
    elif p is not None:
        head = headline(p)
    else:
        head = "–"
    return (f'<a class="card" href="#h-{hid}" data-target="h-{hid}"><div class="card-top"><span class="hid">{hid}</span>'
            f'<span class="short">{html.escape(sp["short"])}</span></div>{badge(h["verdict"], h.get("label"))}'
            f'<p class="pred">{html.escape(sp["prediction"])}</p><p class="head">{inline(head)}</p></a>')


def section(sid: str, title: str, body: str, kicker: str = "") -> str:
    k = f'<div class="kicker">{html.escape(kicker)}</div>' if kicker else ""
    return f'<section class="slide" id="{sid}">{k}<h2>{html.escape(title)}</h2>{body}</section>'


def hyp_section(r: R, hid: str) -> str:
    sp, h = SPEC[hid], r.hyps[hid]
    parts = [f'<div class="verdict-line">{badge(h["verdict"], h.get("label"))}<span>{inline(h["verdict_reason"])}</span></div>']
    parts.append(f'<div class="block"><h3>What we claimed</h3><p>{inline(sp["claim"])}</p></div>')
    parts.append(f'<div class="block"><h3>How the experiment tests it</h3><p>{inline(sp["how"])}</p></div>')
    parts.append(f'<div class="block"><h3>The maths</h3><pre class="maths">{html.escape(sp["maths"])}</pre></div>')
    figs = "".join(fig(f, f"{hid} figure") for f in dict.fromkeys(sp["figures"]))
    parts.append(f'<div class="block"><h3>Result</h3>{figs}{paras(result_paragraphs(r, hid))}'
                 f'{table(test_rows(r, ids_for(r, hid)), "tests")}</div>')
    nj = not_justified(r, hid)
    parts.append(f'<div class="block caution"><h3>Verdict and what the data does NOT justify</h3>'
                 f'<p>{badge(h["verdict"], h.get("label"))}</p>{bullets(nj)}</div>')
    rob = robustness(r, hid)
    if rob:
        parts.append(f'<div class="block"><h3>Robustness notes</h3>{paras(rob)}</div>')
    if hid in ("H8", "H9") and r.s["external"][hid].get("status") != "done":
        parts.append(f'<div class="block pending-box"><h3>Dataset part: PENDING</h3><p>'
                     f'{inline(r.s["external"][hid].get("reason", ""))}. Add the dataset and fill '
                     '<code>analysis/external_config.yaml</code> (see <code>data/external/README.md</code>); '
                     '<code>run_all.py</code> then fills this part in.</p></div>')
    return section(f"h-{hid}", f"{hid} — {sp['title']}", "\n".join(parts), kicker="Hypothesis")


def build(r: R) -> str:
    m, s = r.meta, r.s
    sv = s["survey"]
    cs = s["attrition"]["completion_skin"]
    nav = ['<a href="#scorecard">Scorecard</a>', '<a href="#attrition">Attrition</a>']
    nav += [f'<a href="#h-{h}">{h}</a>' for h in ORDER if h in ("H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8", "H9")]
    nav += ['<a href="#survey">Survey</a>', '<a href="#limitations">Limitations</a>']
    h1_sub = "".join(f'<a href="#h-{h}">{h}</a>' for h in ORDER if h.startswith("H1") and h != "H1")

    sections = []
    # Header + scorecard
    header = (f'<header class="slide hero" id="top"><div class="kicker">Results</div><h1>{html.escape(m["title"])}</h1>'
              f'<div class="stats"><div class="stat"><b>{m["consented"]}</b><span>consented</span></div>'
              f'<div class="stat"><b>{m["completed"]}</b><span>completed</span></div>'
              f'<div class="stat"><b>{m["completed_by_skin"]["honest"]} / {m["consented_by_skin"]["honest"]}</b>'
              f'<span>honest completed / consented</span></div>'
              f'<div class="stat"><b>{m["completed_by_skin"]["fraud"]} / {m["consented_by_skin"]["fraud"]}</b>'
              f'<span>fraud completed / consented</span></div>'
              f'<div class="stat"><b>{sv["respondents"]}</b><span>survey respondents</span></div></div>'
              f'<p class="meta">App data collected {m["collection_start"]} to {m["collection_end"]}; survey '
              f'{sv["first_response"]} to {sv["last_response"]}. Two-sided tests, α = {m["alpha"]}; verdicts follow '
              f'the pre-registered plan (raw p; Holm-adjusted p shown). Generated {m["generated_at"]}.</p></header>')
    cards = "".join(card(r, h) for h in ORDER)
    legend = ('<p class="legend">'
              + " ".join(badge(v) for v in ("SUPPORTED", "PARTLY SUPPORTED", "NOT SUPPORTED", "NOT TESTABLE",
                                            "EXPLORATORY", "PENDING")) + "</p>")
    sections.append(section("scorecard", "Scorecard", legend + f'<div class="cards">{cards}</div>'
                            + table(scorecard_rows(r), "score"), kicker="Every hypothesis at a glance"))

    # Attrition
    tiles = (f'<div class="stats"><div class="stat"><b>{pct(cs["honest"]["rate"])}</b><span>honest completed '
             f'({cs["honest"]["completed"]}/{cs["honest"]["consented"]})</span></div><div class="stat warn"><b>'
             f'{pct(cs["fraud"]["rate"])}</b><span>fraud completed ({cs["fraud"]["completed"]}/'
             f'{cs["fraud"]["consented"]})</span></div><div class="stat"><b>p = '
             f'{s["attrition"]["completion_skin_p"]:.3f}</b><span>Fisher, completion by skin</span></div></div>')
    caveat = ('<p class="callout">Fraud players dropped out much more often, so the fraud finishers are a selected '
              'group: every skin comparison among finishers must be read with that in mind.</p>')
    funnel = pd.read_csv(os.path.join(RESULTS, "tables", "attrition_funnel.csv")).rename(columns={
        "milestone": "Milestone", "step": "Step", "honest": "Honest reached", "fraud": "Fraud reached"})
    changes = itt_changes(r)
    itt = ("<p><strong>Intention-to-treat check (H1, H2):</strong> " + (
        "conclusion changes for " + "; ".join(html.escape(c) for c in changes) if changes else "no conclusion changes")
           + ".</p>")
    sections.append(section("attrition", "Data and attrition",
                            tiles + caveat + fig("attrition_funnel", "Drop-out funnel by skin")
                            + paras(attrition_paragraphs(r)) + "<h3>What the attrition means for H1</h3>"
                            + paras(attrition_bias(r)) + itt + "<details><summary>Funnel table</summary>"
                            + table(funnel.to_dict("records")) + "</details>", kicker="Read this first"))

    for hid in ORDER:
        sections.append(hyp_section(r, hid))

    # Survey
    a = sv["approached"]
    ic = sv["invested_count"]
    ws = sv["what_stopped_answered"]
    body = (f'<div class="stats"><div class="stat"><b>{pct(a["share"])}</b><span>approached ({a["yes"]}/{a["n"]}; '
            f'95% CI {pct(a["ci_low"])}–{pct(a["ci_high"])})</span></div><div class="stat"><b>{ic["yes"]} of {ic["of"]}'
            f'</b><span>approached who put money in (counts only)</span></div></div>'
            '<p>Descriptive only: no randomization, and not linked to the app players.</p>'
            + fig("survey_tricks_seen", "Tricks seen in real life")
            + "<p><strong>First contact (approached):</strong> " + "; ".join(
                f"{html.escape(c['channel'])} {c['yes']}/{c['n']}" for c in sv["channels"]) + ".</p>"
            + f"<h3>What stopped them ({ws['answered']} of {ws['of_non_investors']} non-investors answered)</h3>"
            + fig("survey_what_stopped", "What stopped them from investing")
            + "<h3>Respondents who invested (counts only)</h3>"
            + table([{"Question": x["question"], "Item": x["item"],
                      "Answers": (f"yes {x['yes']} of {x['of_invested']}, no {x['no']}" if x["question"] != "Q11"
                                  else x["bands"])} for x in sv["invested_items"]])
            + "<h3>Common in real life vs persuasive in the app</h3>"
            + "<p>Different people and different questions: a map, not a test.</p>"
            + fig("survey_vs_app", "Survey vs app"))
    sections.append(section("survey", "Survey: real-life evidence", body, kicker="Part C"))

    held, not_held, other = held_lists(r)
    sections.append(section("held", "What held, what did not",
                            '<div class="cols"><div><h3>Held</h3>' + bullets(held or ["none"]) + "</div><div>"
                            "<h3>Did not hold</h3>" + bullets(not_held or ["none"]) + "</div></div>"
                            "<h3>No verdict possible yet / by design</h3>" + bullets(other or ["none"]),
                            kicker="Summary"))
    sections.append(section("limitations", "Limitations", bullets(limitations(r)), kicker="Read with care"))

    page = TEMPLATE.replace("{{NAV}}", "".join(nav)).replace("{{SUBNAV}}", h1_sub).replace("{{HEADER}}", header) \
        .replace("{{SECTIONS}}", "\n".join(sections))
    return re.sub(r"var\(--([a-z0-9-]+)\)", lambda mt: TOKENS[mt.group(1)], page)


# Colours and sizes, written into the CSS as plain values at build time (older viewers ignore CSS variables).
TOKENS = {
    "bg": "#121211", "surface": "#1a1a19", "surface-2": "#232321", "line": "#383835", "ink": "#f0efec",
    "ink-2": "#c3c2b7", "ink-3": "#9a998f", "accent": "#d95926", "blue": "#3987e5", "good": "#0ca30c",
    "warn": "#fab219", "bad": "#d03b3b", "grey": "#6f6e68", "radius": "14px", "maxw": "1180px",
}


TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Study Results</title>
<style>
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 120px; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 18px/1.6 system-ui, -apple-system, "Segoe UI",
  Roboto, sans-serif; overflow-x: hidden; }
a { color: var(--blue); }
code { font-family: ui-monospace, Consolas, monospace; font-size: 0.88em; background: var(--surface-2);
  padding: 0.05em 0.35em; border-radius: 5px; }
nav.top { position: sticky; top: 0; z-index: 10; background: rgba(18,18,17,0.94); backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--line); }
nav.top .inner { max-width: var(--maxw); margin: 0 auto; padding: 8px 16px; display: flex; flex-wrap: wrap;
  gap: 4px 6px; align-items: center; }
nav.top a { color: var(--ink-2); text-decoration: none; padding: 4px 10px; border-radius: 999px; font-size: 15px; }
nav.top a:hover, nav.top a.active { background: var(--surface-2); color: var(--ink); }
nav.top .sub { width: 100%; display: flex; flex-wrap: wrap; gap: 2px 4px; font-size: 13px; }
nav.top .sub a { font-size: 13px; padding: 2px 8px; color: var(--ink-3); }
nav.top button { margin-left: auto; background: var(--accent); color: #fff; border: 0; border-radius: 999px;
  padding: 6px 14px; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
main { max-width: var(--maxw); margin: 0 auto; padding: 0 16px 80px; }
.slide { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 28px 32px; margin: 28px 0; }
.hero h1 { font-size: clamp(28px, 3.4vw, 44px); line-height: 1.15; margin: 4px 0 18px; }
h2 { font-size: clamp(24px, 2.6vw, 34px); line-height: 1.2; margin: 2px 0 16px; }
h3 { font-size: 20px; margin: 22px 0 8px; color: var(--ink); }
.kicker { text-transform: uppercase; letter-spacing: 0.12em; font-size: 13px; color: var(--accent); font-weight: 700; }
.meta, .legend { color: var(--ink-2); font-size: 15px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 14px 0; }
.stat { background: var(--surface-2); border-radius: 12px; padding: 14px 16px; }
.stat b { display: block; font-size: 30px; line-height: 1.1; }
.stat span { color: var(--ink-2); font-size: 14px; }
.stat.warn b { color: var(--accent); }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; margin: 16px 0 22px; }
.card { display: block; background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px;
  padding: 14px 16px; color: var(--ink); text-decoration: none; transition: border-color .15s; }
.card:hover { border-color: var(--ink-3); }
.card-top { display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px; }
.hid { font-weight: 800; font-size: 20px; }
.short { color: var(--ink-2); font-size: 15px; }
.card .pred { font-size: 14.5px; color: var(--ink-2); margin: 8px 0 6px; line-height: 1.45; }
.card .head { font-size: 14.5px; margin: 0; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.badge { display: inline-block; font-size: 12.5px; font-weight: 800; letter-spacing: 0.04em; padding: 3px 10px;
  border-radius: 999px; border: 2px solid transparent; margin: 2px 4px 2px 0; }
.badge.supported { background: var(--good); color: #fff; }
.badge.partly { background: var(--warn); color: #1a1a19; }
.badge.not { background: var(--bad); color: #fff; }
.badge.grey { background: var(--grey); color: #fff; }
.badge.pending { background: transparent; border-color: var(--blue); color: var(--blue); }
.badge-note { font-size: 12.5px; color: var(--ink-3); margin-right: 6px; }
.verdict-line { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; color: var(--ink-2);
  font-size: 16px; margin-bottom: 8px; }
.block { margin-top: 10px; }
pre.maths { background: #0d0d0c; border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px;
  font: 15px/1.55 ui-monospace, Consolas, monospace; color: #e8e6df; white-space: pre-wrap; overflow-wrap: anywhere;
  margin: 6px 0; }
figure { margin: 14px 0; text-align: center; }
figure img { max-width: 100%; height: auto; border-radius: 10px; }
.tablewrap { max-width: 100%; overflow-x: auto; margin: 12px 0; }
table { width: 100%; border-collapse: collapse; font-size: 14px; font-variant-numeric: tabular-nums; }
th, td { text-align: left; vertical-align: top; padding: 7px 8px; border-bottom: 1px solid var(--line);
  overflow-wrap: break-word; hyphens: manual; }
th { white-space: nowrap; }
td.nw { white-space: nowrap; }
th { color: var(--ink-2); font-weight: 700; background: var(--surface-2); position: sticky; top: 0; }
table.tests td:nth-child(4) { min-width: 150px; }
.caution { border-left: 4px solid var(--accent); padding-left: 16px; }
.pending-box { border: 2px dashed var(--blue); border-radius: 12px; padding: 4px 16px 10px; }
.callout { background: rgba(217,89,38,0.12); border: 1px solid var(--accent); border-radius: 10px;
  padding: 10px 14px; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
details summary { cursor: pointer; color: var(--ink-2); margin-top: 12px; }
li { margin: 4px 0; }
.missing { color: var(--bad); }
/* Present mode is switched on by the script only; the script itself shows and hides sections. */
body.present { font-size: 20px; }
body.present main > .slide.current { margin: 18px 0; min-height: calc(100vh - 140px); }
.pm-hint { position: fixed; right: 16px; bottom: 12px; color: var(--ink-3); font-size: 13px;
  background: var(--surface-2); padding: 4px 10px; border-radius: 999px; }
@media (max-width: 760px) {
  body { font-size: 16px; }
  .slide { padding: 18px 16px; }
  .cols { grid-template-columns: 1fr; }
  nav.top button { margin-left: 0; }
}
@media print { nav.top { display: none; } .slide { break-inside: avoid; } }
</style>
</head>
<body>
<nav class="top" aria-label="Sections"><div class="inner">{{NAV}}<div class="sub">H1 parts: {{SUBNAV}}</div></div></nav>
<main>
{{HEADER}}
{{SECTIONS}}
</main>
<script>
/* Progressive enhancement only: every section is visible without this script. It adds a present-mode button,
   arrow-key navigation and the nav highlight. Any error restores the full page. Plain ES2017, no modules. */
(function () {
  'use strict';
  function revealAll() {
    try {
      var all = document.querySelectorAll('main > .slide');
      for (var k = 0; k < all.length; k++) { all[k].style.display = ''; all[k].classList.remove('current'); }
      document.body.classList.remove('present');
      var h = document.querySelector('.pm-hint');
      if (h) { h.hidden = true; }
    } catch (e) { /* nothing more to do */ }
  }
  try {
    var slides = Array.prototype.slice.call(document.querySelectorAll('main > .slide'));
    var inner = document.querySelector('nav.top .inner');
    if (!slides.length || !inner) { return; }
    var links = Array.prototype.slice.call(document.querySelectorAll('nav.top a'));
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pm';
    btn.textContent = 'Present mode';
    btn.setAttribute('aria-pressed', 'false');
    inner.insertBefore(btn, inner.querySelector('.sub'));
    var hint = document.createElement('div');
    hint.className = 'pm-hint';
    hint.textContent = '← → move · Esc exits present mode';
    hint.hidden = true;
    document.body.appendChild(hint);
    var cur = 0;
    var present = false;

    var mark = function (id) {
      links.forEach(function (l) { l.classList.toggle('active', l.getAttribute('href') === '#' + id); });
    };
    var toTop = function () {
      try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
    };
    var render = function () {
      slides.forEach(function (s, j) {
        s.style.display = (!present || j === cur) ? '' : 'none';
        s.classList.toggle('current', present && j === cur);
      });
    };
    var show = function (i) {
      cur = Math.max(0, Math.min(slides.length - 1, i));
      render();
      mark(slides[cur].id);
      toTop();
    };
    var indexOfId = function (id) {
      for (var i = 0; i < slides.length; i++) { if (slides[i].id === id) { return i; } }
      return -1;
    };
    var setPresent = function (on) {
      try {
        present = on;
        document.body.classList.toggle('present', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.textContent = on ? 'Exit present mode' : 'Present mode';
        hint.hidden = !on;
        if (on) { show(cur); } else { render(); slides[cur].scrollIntoView(); }
      } catch (e) { revealAll(); }
    };
    btn.addEventListener('click', function () { setPresent(!present); });
    document.addEventListener('keydown', function (e) {
      try {
        if (!present) { return; }
        if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); show(cur + 1); }
        else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(cur - 1); }
        else if (e.key === 'Escape') { setPresent(false); }
      } catch (err) { revealAll(); }
    });
    document.addEventListener('click', function (e) {
      try {
        var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
        if (!a) { return; }
        var i = indexOfId(a.getAttribute('href').slice(1));
        if (i < 0) { return; }
        cur = i;
        if (present) { e.preventDefault(); show(i); }
      } catch (err) { revealAll(); }
    });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting || present) { return; }
          cur = Math.max(0, indexOfId(en.target.id));
          mark(en.target.id);
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      slides.forEach(function (s) { io.observe(s); });
    }
  } catch (err) {
    revealAll();
    if (window.console && console.error) { console.error('results page script error:', err); }
  }
})();
</script>
</body>
</html>
"""


def run() -> str:
    r = R(load())
    path = os.path.join(RESULTS, "index.html")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(build(r))
    return path


__all__ = ["run", "n_text"]
