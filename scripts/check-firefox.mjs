/**
 * Firefox (Gecko) regression for the production build.
 *
 * Run against a built preview: `npm run preview -- --port 5188`, then
 * `node scripts/check-firefox.mjs`. Like the other browser checks it honours
 * `PLAYWRIGHT_MODULE` for an external Playwright install; the Gecko engine
 * comes from `playwright install firefox`.
 */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { firefox } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.REVIEW_URL || 'http://127.0.0.1:5188';
await mkdir('verification/firefox', { recursive: true });

const errors = [];
const consoleErrors = [];
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
const results = {};

try {
  await page.goto(origin);
  await page.waitForFunction(() => window.rhine?.stats().ready);
  results.userAgent = await page.evaluate(() => navigator.userAgent);
  assert.match(results.userAgent, /Gecko\/\d+.*Firefox/);

  results.webgl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    return gl
      ? { version: gl.getParameter(gl.VERSION), webgl2: true }
      : { version: null, webgl2: false };
  });
  assert.ok(results.webgl.webgl2, 'Firefox must provide a WebGL2 context');

  // Audio must unlock: Firefox never implemented cancelAndHoldAtTime, which
  // previously trapped startup in the "声音暂未就绪" error state.
  await page.locator('.entry-start').click();
  await page.waitForFunction(() => window.rhine.stats().startup === 'started', null, { timeout: 60000 });
  results.startup = 'started';

  await page.evaluate(() => window.rhine.archive());
  await page.waitForTimeout(2500);
  const archive = await page.evaluate(() => window.rhine.stats());
  assert.equal(archive.mode, 'archive');
  assert.ok(archive.drawCalls > 0, 'array must draw in Gecko');
  results.archive = { drawCalls: archive.drawCalls, archiveCount: archive.archiveCount, fps: archive.fps };
  await page.screenshot({ path: 'verification/firefox/archive.png' });

  // Modal: the backdrop suspends the GPU pass without freezing the array.
  // The click itself takes a few frames (pointer travel + hit testing); sample
  // only after the backdrop is mounted so the window measures covered frames.
  await page.locator('[data-action="settings"]').click();
  await page.waitForTimeout(300);
  const beforeModal = await page.evaluate(() => window.rhine.stats());
  assert.equal(beforeModal.mode, 'archive', 'settings opens over the archive');
  await page.waitForTimeout(1500);
  const duringModal = await page.evaluate(() => window.rhine.stats());
  assert.ok(duringModal.suspendedFrames > beforeModal.suspendedFrames, 'modal should suspend rendering');
  assert.equal(duringModal.renderedFrames, beforeModal.renderedFrames, 'no frame may draw behind the blurred backdrop');

  // Firefox desktop has no install entry, so the guidance must not promise one.
  results.pwaGuidance = await page.locator('#pwa-settings p').first().innerText();
  assert.match(results.pwaGuidance, /本浏览器不提供一键安装/);

  // Fresh visits default to the performance preset (aoSamples/depthOfField 0),
  // which skips the shared-depth MRT shader entirely. Switch to the original
  // preset so the one non-three-built-in render path actually compiles here.
  assert.equal(duringModal.superPerformance, false, 'sharing needs performance mode off');
  await page.locator('#quality-preset').selectOption('original');
  await page.waitForTimeout(400);
  results.renderQuality = await page.evaluate(() =>
    JSON.parse(document.querySelector('#three-scene').dataset.renderQuality));
  assert.ok(results.renderQuality.aoSamples > 0, 'AO pass must be on');
  assert.ok(results.renderQuality.depthOfField > 0, 'depth of field must be on');
  assert.ok(results.renderQuality.aoWidth > 0, 'AO pass must be allocated');
  // scene.setSharing requires ao + bokeh + aoResolution 1 + no performance mode.
  // The preset gives aoResolution 1, so a full-resolution AO buffer (aoWidth
  // equals the render width) proves the shared-depth MRT path is the one drawn.
  assert.equal(results.renderQuality.aoWidth, results.renderQuality.width,
    'AO must run at full resolution for the shared depth path');

  await page.locator('[data-action="close-modal"]').click();
  await page.waitForTimeout(1200);
  const afterModal = await page.evaluate(() => window.rhine.stats());
  assert.ok(afterModal.renderedFrames > duringModal.renderedFrames, 'rendering must resume after close');
  results.modal = {
    before: beforeModal.renderedFrames,
    suspendedDuring: duringModal.suspendedFrames - beforeModal.suspendedFrames,
    drawnBehindBackdrop: duringModal.renderedFrames - beforeModal.renderedFrames,
    resumed: afterModal.renderedFrames - duringModal.renderedFrames,
  };
  // Draws again with AO + DoF + shared depth: any MRT shader error would have
  // surfaced in `errors`/`consoleErrors` above.
  await page.screenshot({ path: 'verification/firefox/shared-depth.png' });

  // Wheel stepping stays responsive without a Chromium-specific delta shape.
  const selected = (await page.evaluate(() => window.rhine.stats())).selected;
  await page.mouse.move(800, 450);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 120);
  await page.waitForTimeout(700);
  results.wheelChanged = (await page.evaluate(() => window.rhine.stats())).selected !== selected;

  await page.evaluate(() => window.rhine.detail());
  await page.waitForTimeout(2800);
  assert.equal((await page.evaluate(() => window.rhine.stats())).mode, 'detail');
  await page.screenshot({ path: 'verification/firefox/detail.png' });
  results.detail = true;

  // The terminal is an online player: no service worker and no offline copy,
  // so a visit always runs the release currently deployed.
  results.serviceWorker = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    const registration = await navigator.serviceWorker.getRegistration();
    return registration ? 'registered' : 'none';
  });

  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  results.errors = errors;
  results.consoleErrors = consoleErrors;
  await writeFile('verification/firefox/results.json', JSON.stringify(results, null, 2));
  console.log('Firefox startup, WebGL2 array render, modal render suspension, wheel stepping, detail and service worker passed.');
} finally {
  await browser.close();
}
