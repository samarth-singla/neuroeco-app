/**
 * Browser smoke test: drives a real browser through the whole study (consent → app → both
 * surveys → debrief) at phone width (360 px), once per app version, including a page refresh in
 * the middle of the app session. Fails on page errors, horizontal scrolling or dead ends.
 *
 * Needs the app running (npm run dev, or npm run build && npm start) and an installed
 * Microsoft Edge or Google Chrome (no browser download needed).
 *
 *   npm run smoke                          (http://localhost:5173, Edge)
 *   npm run smoke -- http://localhost:3001 (another URL)
 *   BROWSER=chrome npm run smoke           (use Chrome)
 *
 * Note: this creates real participant rows. Reset the database before data collection.
 */
import { chromium } from 'playwright-core';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const CHANNEL = process.env.BROWSER === 'chrome' ? 'chrome' : 'msedge';
const KEY = 'neuroeco:study:v1';

async function answerSurveyPage(page) {
  for (const box of await page.locator('fieldset[data-item]').all()) {
    const id = await box.getAttribute('data-item');
    const radios = box.getByRole('radio');
    if ((await radios.count()) > 0) {
      const n = await radios.count();
      await radios.nth(n === 7 ? 3 : 0).click();
      continue;
    }
    const slider = box.locator('input[type=range]');
    if ((await slider.count()) > 0) {
      await slider.focus();
      await slider.press('ArrowRight');
      continue;
    }
    const input = box.locator('input');
    if ((await input.count()) > 0) {
      await input.fill(id === 'demo_age' ? '21' : id === 'crt_3' ? '47' : '5');
    }
  }
  await page.getByRole('button', { name: 'Next' }).click();
}

async function checkLayout(page, where, problems) {
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  if (width > 360) problems.push(`${where}: horizontal scroll (${width}px)`);
}

async function runOnce(browser, wantedVersion) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
    const button = (name) => page.getByRole('button', { name, exact: true });

    await page.goto(BASE);
    for (const box of await page.getByRole('checkbox').all()) await box.check();
    await button('Agree and start').click();
    await button('Continue').waitFor();
    const state = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)), KEY);
    if (state.assignment.app_version !== wantedVersion) {
      await context.close(); // balanced assignment alternates; try again
      continue;
    }
    const a = state.assignment;
    await checkLayout(page, 'A1', problems);
    await button('Continue').click();

    // A2 → A3
    await checkLayout(page, 'A2', problems);
    await page.getByRole('button', { name: /Growth/ }).click();
    await button('Invest in this plan').click();
    await page.getByLabel(/Amount/).fill('1000');
    await button('Invest ₹1,000').click();

    // Refresh-resume on A4
    await page.getByText('Cycle 1 result').waitFor();
    await page.reload();
    await page.getByText('Cycle 1 result').waitFor({ timeout: 10000 });
    await button('Continue').click();

    // A5 → A10
    await page.getByLabel(/Amount/).fill('500');
    await button('Invest ₹500').click();
    const small = page.getByRole('button', { name: /^Withdraw ₹/ });
    if (await small.count()) await small.click();
    await button('Continue').click();
    await button('Not now').click();
    await checkLayout(page, 'A8', problems);
    await button('Leave').click();
    await page.getByRole('button', { name: /^Withdraw ₹/ }).click();
    if (wantedVersion === 'fraud') await page.getByRole('button', { name: /^Pay fee/ }).click();
    await button('Continue').click();
    await button('Continue to survey').click();

    // UI/UX survey (8 pages) + general survey (13 pages)
    for (let i = 0; i < 21; i++) {
      await page.getByRole('button', { name: 'Next' }).waitFor();
      await checkLayout(page, `survey page ${i + 1}`, problems);
      await answerSurveyPage(page);
    }

    // Debrief → thanks
    await button('Finish').waitFor();
    await checkLayout(page, 'debrief', problems);
    await button('Finish').click();
    await page.getByText('Thank you for taking part!').waitFor();
    await context.close();
    return { version: wantedVersion, participant: state.participantId, assignment: a, problems };
  }
  throw new Error(`could not get a ${wantedVersion} participant`);
}

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
let failed = false;
try {
  for (const v of ['plain', 'fraud']) {
    const r = await runOnce(browser, v);
    const tag = `${r.version} (${r.assignment.round1_outcome}, ${r.assignment.withdrawal_offer})`;
    if (r.problems.length) {
      failed = true;
      console.error(`✗ ${tag}:\n  ${r.problems.join('\n  ')}`);
    } else console.log(`✓ ${tag}: full study completed, participant ${r.participant}`);
  }
} catch (e) {
  failed = true;
  console.error('✗', e.message);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
