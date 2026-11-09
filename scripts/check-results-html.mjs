/**
 * Checks results/index.html opened from disk (file://) in Chromium, Firefox and WebKit, with JavaScript enabled
 * AND disabled, at 1366x768 and 1920x1080:
 * - every section and every figure is visible (the page never depends on the script to show content);
 * - no horizontal page scroll, no element outside the viewport, no clipped or overlapping score cards;
 * - no request leaves the file, no console or page errors;
 * - with JavaScript: present mode shows one section at a time, arrow keys move, Esc restores the full page.
 * Screenshots go to SHOTS_DIR (default ./results-html-shots, git-ignored).
 *
 *   node scripts/check-results-html.mjs [path/to/index.html]
 *   (install the engines once: npx playwright-core install chromium firefox webkit)
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from 'playwright-core';

const file = path.resolve(process.argv[2] ?? 'results/index.html');
const shots = path.resolve(process.env.SHOTS_DIR ?? 'results-html-shots');
fs.mkdirSync(shots, { recursive: true });

const engines = { chromium, firefox, webkit };
const sizes = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];
const problems = [];
const summary = [];

for (const [engineName, engine] of Object.entries(engines)) {
  const browser = await engine.launch({ headless: true });
  for (const js of [true, false]) {
    for (const vp of sizes) {
      const tag = `${engineName}-${js ? 'js' : 'nojs'}-${vp.width}x${vp.height}`;
      const context = await browser.newContext({ viewport: vp, javaScriptEnabled: js });
      const page = await context.newPage();
      const external = [];
      const errors = [];
      page.on('request', (req) => {
        const u = req.url();
        if (!u.startsWith('file:') && !u.startsWith('data:')) external.push(u);
      });
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });

      const r = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const slides = [...document.querySelectorAll('main > .slide')];
        const hidden = slides
          .filter((s) => {
            const cs = getComputedStyle(s);
            const b = s.getBoundingClientRect();
            return (
              cs.display === 'none' ||
              cs.visibility === 'hidden' ||
              Number(cs.opacity) === 0 ||
              b.height < 20
            );
          })
          .map((s) => s.id);
        const imgs = [...document.images];
        const badImgs = imgs
          .filter(
            (i) => !i.complete || i.naturalWidth === 0 || i.getBoundingClientRect().width < 50,
          )
          .map((i) => i.alt);
        const overflowing = [...document.querySelectorAll('main *, nav *')]
          .filter((el) => !el.closest('.tablewrap'))
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return b.width > 0 && (b.right > vw + 1 || b.left < -1);
          })
          .slice(0, 8)
          .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
        const clipped = [...document.querySelectorAll('.card, .stat, .badge')]
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => el.textContent.trim().slice(0, 40));
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
        return {
          sections: slides.length,
          hidden,
          images: imgs.length,
          badImgs,
          pageScrollWidth: document.documentElement.scrollWidth,
          vw,
          overflowing,
          clipped,
          overlaps,
          rupee: document.body.innerText.includes('₹'),
          charset: document.characterSet,
        };
      });

      await page.screenshot({ path: path.join(shots, `${tag}-top.png`) });
      await page.evaluate(() => document.getElementById('h-H8').scrollIntoView());
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(shots, `${tag}-H8.png`) });

      if (js) {
        const visible = () =>
          page.evaluate(() =>
            [...document.querySelectorAll('main > .slide')]
              .filter((s) => getComputedStyle(s).display !== 'none')
              .map((s) => s.id),
          );
        await page.click('#pm');
        const v0 = await visible();
        await page.keyboard.press('ArrowRight');
        const v1 = await visible();
        await page.screenshot({ path: path.join(shots, `${tag}-present.png`) });
        await page.keyboard.press('ArrowLeft');
        const v2 = await visible();
        await page.keyboard.press('Escape');
        const v3 = await visible();
        if (v0.length !== 1 || v1.length !== 1 || v1[0] === v0[0] || v2[0] !== v0[0])
          problems.push(`${tag}: present mode navigation failed ${JSON.stringify({ v0, v1, v2 })}`);
        if (v3.length !== r.sections) problems.push(`${tag}: Esc did not restore every section`);
      } else if (await page.$('#pm')) {
        problems.push(`${tag}: present-mode button shown without JavaScript`);
      }

      if (r.hidden.length) problems.push(`${tag}: hidden sections ${r.hidden}`);
      if (r.badImgs.length) problems.push(`${tag}: figures not visible ${r.badImgs}`);
      if (r.pageScrollWidth > r.vw) problems.push(`${tag}: page scrolls sideways`);
      if (r.overflowing.length)
        problems.push(`${tag}: elements outside the viewport ${r.overflowing}`);
      if (r.clipped.length) problems.push(`${tag}: clipped text ${r.clipped}`);
      if (r.overlaps) problems.push(`${tag}: ${r.overlaps} overlapping cards`);
      if (!r.rupee || r.charset.toUpperCase() !== 'UTF-8')
        problems.push(`${tag}: rupee sign / UTF-8 problem`);
      if (external.length) problems.push(`${tag}: external requests ${external}`);
      if (errors.length) problems.push(`${tag}: errors ${errors}`);
      summary.push(
        `${tag}: ${r.sections - r.hidden.length}/${r.sections} sections, ` +
          `${r.images - r.badImgs.length}/${r.images} figures visible, ${errors.length} errors`,
      );
      await context.close();
    }
  }
  await browser.close();
}

const size = fs.statSync(file).size;
console.log(summary.join('\n'));
console.log(`file size: ${(size / 1024 / 1024).toFixed(2)} MB; screenshots: ${shots}`);
if (problems.length) {
  console.log('PROBLEMS:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('OK in all engines, with and without JavaScript, at both sizes');
