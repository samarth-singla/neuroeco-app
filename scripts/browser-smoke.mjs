/**
 * Browser smoke test for the ZenTrade game: drives a real browser through the whole study
 * (consent → 15 stages → report card → share) at phone width (360 px), once per skin, with a page
 * refresh in the middle of the trading rounds. On every screen it checks for page errors, sideways
 * scrolling, and — with a hit-test on every visible button — that no overlay (toast, chat bubble,
 * confetti) covers a button.
 *
 * Needs the app running (npm run dev, or npm run build && npm start) and an installed Microsoft
 * Edge or Google Chrome (no browser download needed).
 *
 *   npm run smoke                          (http://localhost:5173, Edge)
 *   npm run smoke -- http://localhost:3001 (another URL)
 *   BROWSER=chrome npm run smoke           (use Chrome)
 *
 * Note: this creates real participant rows. Reset the database before data collection, and never
 * point it at the live site.
 */
import { chromium } from 'playwright-core';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const CHANNEL = process.env.BROWSER === 'chrome' ? 'chrome' : 'msedge';
const KEY = 'neuroeco:game:v1';

async function runOnce(browser, wanted) {
  let page;
  let ctx;
  for (let attempt = 0; attempt < 8; attempt++) {
    ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
    page = await ctx.newPage();
    await page.goto(BASE);
    for (const c of await page.getByRole('checkbox').all()) await c.check();
    await page.getByRole('button', { name: 'Agree and start' }).click();
    await page.waitForFunction((k) => !!sessionStorage.getItem(k), KEY);
    const skin = await page.evaluate(
      (k) => JSON.parse(sessionStorage.getItem(k)).assignment.app_version,
      KEY,
    );
    if (skin === wanted) break; // balanced assignment alternates; try again
    await ctx.close();
    ctx = null;
  }
  if (!ctx) throw new Error(`could not get a ${wanted} player`);

  const problems = [];
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  const btn = (name) => page.getByRole('button', { name });
  const state = () => page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)), KEY);
  async function tap(loc) {
    await loc.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await loc.click({ force: true }); // pulsing CTAs never become "stable" for auto-waiting
  }
  async function check(where) {
    const res = await page.evaluate(() => {
      const bad = [];
      for (const b of document.querySelectorAll('button')) {
        const r = b.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= innerHeight) continue;
        const y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
        const el = document.elementFromPoint(r.left + r.width / 2, y);
        if (!el || b.contains(el) || el.contains(b)) continue;
        const sticky = el.closest('[data-sticky]');
        if (sticky && !sticky.contains(b)) continue; // normal scrolling under a sticky bar
        if (el.closest('[role=dialog]')) continue;
        bad.push(`"${b.textContent.trim().slice(0, 25)}" covered by ${el.tagName}`);
      }
      return { bad, width: document.documentElement.scrollWidth };
    });
    for (const b of res.bad) problems.push(`${where}: ${b}`);
    if (res.width > 360) problems.push(`${where}: horizontal scroll (${res.width}px)`);
  }

  const started = Date.now();
  let refreshed = false;
  for (let guard = 0; guard < 120; guard++) {
    const step = (await state()).game.step;
    if (step === 'g:end') break;
    const [, kind, idx] = step.split(':');
    const i = Number(idx ?? 0);
    await page.waitForTimeout(200);
    await check(step);

    if (kind === 'profile') {
      if (i === 7) {
        await tap(page.getByRole('radio', { name: '5' }));
        await tap(btn(/Start earning|Continue/));
      } else await tap(page.getByRole('radio').first());
    } else if (kind === 'spin') {
      await tap(btn(i % 2 ? /No thanks|Skip this offer/ : /SPIN NOW|Accept this offer/));
    } else if (kind === 'home') {
      await page.waitForTimeout(5000); // let a toast appear, then check again
      await check(`${step} (toasts)`);
      await tap(btn('Details').first());
      await tap(btn('Close'));
      await tap(page.getByRole('button', { name: /Growth/ }));
      await tap(btn(/INVEST NOW|Invest in this plan/));
    } else if (kind === 'round') {
      if (i === 2 && !refreshed) {
        refreshed = true; // refresh-resume check
        await page.reload();
        await page.getByText('Round 2').waitFor({ timeout: 10000 });
      }
      await page.getByLabel(/Invest this round/).fill('1000');
      await tap(btn(/INVEST NOW|^Invest/).first());
      await page.waitForTimeout(700);
      await check(`${step} (chart)`);
      await btn(/Next|Continue/).waitFor({ timeout: 8000 });
      await check(`${step} (result)`);
      await tap(btn(/Next|Continue/));
    } else if (kind === 'brain') {
      const box = page.getByRole('textbox');
      if (await box.count()) {
        await box.fill(i === 2 ? '47' : '5');
        await tap(btn('Submit answer'));
      } else await tap(page.getByRole('radio').first());
      await tap(btn(/Next question|Back to trading/));
    } else if (kind === 'chat') {
      await tap(btn(/Open chat|Open Help/));
      await page.waitForTimeout(4000);
      await check(`${step} (open)`);
      await tap(btn(/Continue to round 5/));
    } else if (kind === 'deal') {
      if (i === 0) {
        await tap(btn('View plan details'));
        await tap(btn('Close'));
      }
      await tap(btn(/INVEST ₹|Invest ₹/));
      await tap(btn(/Next/));
    } else if (kind === 'pool') {
      await tap(btn(/JOIN POOL|Join for/));
    } else if (kind === 'withdraw') {
      const w = btn(/^Withdraw ₹/);
      if (await w.count()) {
        await tap(w);
        await page.waitForTimeout(1800);
      }
      await page.getByLabel(/Deposit/).fill('1000');
      await tap(btn(/DEPOSIT|^Deposit/));
    } else if (kind === 'reinvest') {
      await page.locator('#reinvest').focus();
    await page.keyboard.press('End');
    await tap(btn(/^Reinvest|^Add/));
    } else if (kind === 'crash') {
      await page.getByLabel(/Top-up amount/).fill('500');
      await tap(btn(/TOP UP|Top up/));
    } else if (kind === 'cashout') {
      await tap(btn(/Withdraw everything/));
      await page.waitForTimeout(400);
      await check(`${step} (after withdraw)`);
      const pay = btn(/PAY TAX/);
      if (await pay.count()) await tap(pay);
      await tap(btn(/Continue/));
    } else if (kind === 'react') {
      if (i === 7 || i === 8) {
        await page.locator('input[type=range]').focus();
        await page.keyboard.press('ArrowRight');
        await tap(btn('Next'));
      } else await tap(btn(i >= 9 ? /Agree →/ : /Yes →/));
    } else if (kind === 'report') {
      await page.getByTestId('trap-score').waitFor();
      await tap(btn('Continue'));
    } else if (kind === 'share') {
      await tap(btn('Finish'));
    }
    try {
      await page.waitForFunction(
        ([k, prev]) => JSON.parse(sessionStorage.getItem(k)).game.step !== prev,
        [KEY, step],
        { timeout: 9000 },
      );
    } catch {
      problems.push(`dead end: stuck on ${step}`);
      break;
    }
  }
  const s = await state();
  if (s.game.step !== 'g:end') problems.push(`did not finish (last step ${s.game.step})`);
  await ctx.close();
  return {
    skin: wanted,
    participant: s.participantId,
    seconds: Math.round((Date.now() - started) / 1000),
    problems,
  };
}

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
let failed = false;
try {
  for (const skin of ['fraud', 'plain']) {
    const r = await runOnce(browser, skin);
    const name = skin === 'plain' ? 'honest' : 'fraud';
    if (r.problems.length) {
      failed = true;
      console.error(`✗ ${name} skin:\n  ${r.problems.join('\n  ')}`);
    } else {
      console.log(
        `✓ ${name} skin: full game in ${r.seconds}s (scripted), no errors, no covered buttons — ${r.participant}`,
      );
    }
  }
} catch (e) {
  failed = true;
  console.error('✗', e.message);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
