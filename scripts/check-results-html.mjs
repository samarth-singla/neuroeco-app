/**
 * Checks results/index.html in a headless browser (Edge by default; BROWSER=chrome for Chrome):
 * - at 1366x768 and 1920x1080: no horizontal page scroll, no element sticking out of the viewport,
 *   every figure loaded, no request leaves the file (self-contained), score cards do not overlap;
 * - present mode: one section at a time, arrow keys move, Esc exits;
 * - saves screenshots to SHOTS_DIR (default: ./results-html-shots, not committed).
 *
 *   node scripts/check-results-html.mjs [path/to/index.html]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const CHANNEL = process.env.BROWSER === 'chrome' ? 'chrome' : 'msedge';
const file = path.resolve(process.argv[2] ?? 'results/index.html');
const shots = path.resolve(process.env.SHOTS_DIR ?? 'results-html-shots');
fs.mkdirSync(shots, { recursive: true });

const sizes = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];
const problems = [];
const browser = await chromium.launch({ channel: CHANNEL, headless: true });

for (const vp of sizes) {
  const tag = `${vp.width}x${vp.height}`;
  const page = await browser.newPage({ viewport: vp });
  const external = [];
  page.on('request', (req) => {
    const u = req.url();
    if (!u.startsWith('file:') && !u.startsWith('data:')) external.push(u);
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });

  const report = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = { pageScrollWidth: document.documentElement.scrollWidth, vw };
    const imgs = [...document.images];
    out.images = imgs.length;
    out.brokenImages = imgs.filter((i) => !i.complete || i.naturalWidth === 0).length;
    // elements sticking out of the viewport (ignoring content inside horizontal table scrollers)
    out.overflowing = [...document.querySelectorAll('main *, nav *')]
      .filter((el) => !el.closest('.tablewrap'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > vw + 1 || r.left < -1);
      })
      .slice(0, 10)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
    // tables that need sideways scrolling inside their wrapper
    out.scrollingTables = [...document.querySelectorAll('.tablewrap')].filter(
      (w) => w.scrollWidth > w.clientWidth + 1,
    ).length;
    // text clipped inside cards / stat tiles
    out.clipped = [...document.querySelectorAll('.card, .stat, .badge')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent.trim().slice(0, 40));
    // overlapping score cards
    const cards = [...document.querySelectorAll('.card')].map((c) => c.getBoundingClientRect());
    let overlaps = 0;
    for (let i = 0; i < cards.length; i++)
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i];
        const b = cards[j];
        if (
          a.left < b.right - 1 &&
          b.left < a.right - 1 &&
          a.top < b.bottom - 1 &&
          b.top < a.bottom - 1
        )
          overlaps++;
      }
    out.cardOverlaps = overlaps;
    out.cards = cards.length;
    out.sections = document.querySelectorAll('main > .slide').length;
    out.navHeight = Math.round(document.querySelector('nav.top').getBoundingClientRect().height);
    return out;
  });

  await page.screenshot({ path: path.join(shots, `${tag}-top.png`) });
  await page.click('a.card[href="#h-H1"]');
  await page.waitForTimeout(2500); // smooth scrolling
  await page.screenshot({ path: path.join(shots, `${tag}-H1.png`) });
  await page.screenshot({ path: path.join(shots, `${tag}-full.png`), fullPage: true });

  // Present mode
  await page.click('#pm');
  const visible = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('main > .slide')]
        .filter((s) => getComputedStyle(s).display !== 'none')
        .map((s) => s.id),
    );
  const v0 = await visible();
  await page.keyboard.press('ArrowRight');
  const v1 = await visible();
  await page.screenshot({ path: path.join(shots, `${tag}-present.png`) });
  await page.keyboard.press('ArrowLeft');
  const v2 = await visible();
  await page.keyboard.press('Escape');
  const v3 = await visible();
  report.present = { start: v0, afterRight: v1, afterLeft: v2, afterEsc: v3.length };

  if (report.pageScrollWidth > report.vw)
    problems.push(`${tag}: page scrolls sideways (${report.pageScrollWidth}px)`);
  if (report.overflowing.length)
    problems.push(`${tag}: elements outside the viewport: ${report.overflowing}`);
  if (report.brokenImages) problems.push(`${tag}: ${report.brokenImages} figure(s) did not load`);
  if (report.clipped.length) problems.push(`${tag}: clipped text in ${report.clipped}`);
  if (report.cardOverlaps) problems.push(`${tag}: ${report.cardOverlaps} overlapping score cards`);
  if (external.length) problems.push(`${tag}: external requests ${external}`);
  if (errors.length) problems.push(`${tag}: script errors ${errors}`);
  if (v0.length !== 1 || v1.length !== 1 || v1[0] === v0[0] || v2[0] !== v0[0])
    problems.push(`${tag}: present mode navigation failed ${JSON.stringify(report.present)}`);
  if (v3.length !== report.sections) problems.push(`${tag}: Esc did not leave present mode`);
  console.log(tag, JSON.stringify(report));
  await page.close();
}

await browser.close();
console.log(`screenshots: ${shots}`);
if (problems.length) {
  console.log('PROBLEMS:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('OK: no overflow, all figures loaded, self-contained, present mode works');
