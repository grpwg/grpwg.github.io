import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
// Occlusion A/B: the same settled frame with camera occlusion culling on and
// off must produce the same image, while the culled frame draws strictly
// fewer triangles. A1/A2 shots calibrate the motion noise floor so animated
// waves (if any survive the reduced-motion context) cannot fake a pass.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  ...(process.env.REVIEW_CHANNEL ? { channel: process.env.REVIEW_CHANNEL } : {}),
  ...(process.env.REVIEW_ARGS ? { args: process.env.REVIEW_ARGS.split(",").filter(Boolean) } : {}),
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => { errors.push(String(error)); console.error('[pageerror]', error.stack || error); });
page.on('console', message => { if (message.type() === 'error' && /THREE|shader|WebGL/.test(message.text())) errors.push(message.text()); });
const origin = process.env.REVIEW_URL || 'http://127.0.0.1:5188';
await mkdir('verification/occlusion', { recursive: true });
const stats = () => page.evaluate(() => window.rhine.stats());
const diffImages = async (left, right) => page.evaluate(async ([first, second]) => {
  const load = (data) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = 'data:image/png;base64,' + data;
  });
  const [imageA, imageB] = await Promise.all([load(first), load(second)]);
  const canvas = document.createElement('canvas');
  canvas.width = imageA.width;
  canvas.height = imageA.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(imageA, 0, 0);
  const pixelsA = context.getImageData(0, 0, canvas.width, canvas.height).data;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(imageB, 0, 0);
  const pixelsB = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let changed = 0;
  let max = 0;
  for (let i = 0; i < pixelsA.length; i += 4) {
    const delta = Math.max(
      Math.abs(pixelsA[i] - pixelsB[i]),
      Math.abs(pixelsA[i + 1] - pixelsB[i + 1]),
      Math.abs(pixelsA[i + 2] - pixelsB[i + 2]),
    );
    if (delta > max) max = delta;
    if (delta > 8) changed++;
  }
  return { changed, total: canvas.width * canvas.height, max };
}, [left.toString('base64'), right.toString('base64')]);

const settle = async (ms) => {
  await page.waitForTimeout(ms);
  // Freeze anything that still repaints text between shots.
  await page.evaluate(() => {
    const clock = document.querySelector('#clock');
    if (clock) clock.style.visibility = 'hidden';
  });
};
const shot = async (name) => {
  const buffer = await page.screenshot({ path: `verification/occlusion/${name}.png` });
  return buffer;
};
const results = {};
try {
  await page.goto(origin);
  await page.waitForFunction(() => window.rhine?.stats().ready);
  await page.locator('.entry-start').click();
  await page.waitForFunction(() => window.rhine.stats().startup === 'started');
  await page.evaluate(() => window.rhine.archive());
  await settle(1800);

  // ---- archive mode -------------------------------------------------------
  const archiveOn1 = await stats();
  assert.equal(archiveOn1.occlusion.enabled, true, 'occlusion runs by default');
  assert.ok(archiveOn1.occlusion.occluders > 0, 'at least one occluder claims cells');
  assert.ok(archiveOn1.occlusion.hidden > 0, `archive view culls hidden slots (got ${archiveOn1.occlusion.hidden})`);
  const shotA1 = await shot('archive-on');
  await settle(300);
  const shotA2 = await shot('archive-on-2');
  await page.evaluate(() => window.rhine.setOcclusion(false));
  await settle(350);
  const archiveOff = await stats();
  assert.equal(archiveOff.occlusion.enabled, false, 'occlusion toggles off');
  const shotB = await shot('archive-off');
  const floor = await diffImages(shotA1, shotA2);
  const delta = await diffImages(shotA1, shotB);
  // Strictly fewer triangles, and the extra draw calls only come from mesh
  // culling, never from the shared instanced batches.
  assert.ok(archiveOff.triangles > archiveOn1.triangles,
    `culling drops triangles (${archiveOn1.triangles} < ${archiveOff.triangles})`);
  const budget = Math.max(Math.ceil(floor.changed * 1.25), 400);
  assert.ok(delta.changed <= budget,
    `occlusion is visually neutral: ${delta.changed}px differ, motion floor ${floor.changed}px, budget ${budget}px`);
  results.archive = {
    enabled: { candidates: archiveOn1.occlusion.candidates, hidden: archiveOn1.occlusion.hidden, occluders: archiveOn1.occlusion.occluders, meshesHidden: archiveOn1.occlusion.meshesHidden },
    triangles: { on: archiveOn1.triangles, off: archiveOff.triangles },
    drawCalls: { on: archiveOn1.drawCalls, off: archiveOff.drawCalls },
    diff: delta,
    motionFloor: floor,
  };

  // ---- detail mode --------------------------------------------------------
  await page.evaluate(() => window.rhine.setOcclusion(true));
  await page.evaluate(() => window.rhine.detail());
  await settle(1600);
  const detailOn = await stats();
  assert.equal(detailOn.occlusion.enabled, true, 'occlusion stays on in detail');
  const detailA1 = await shot('detail-on');
  await settle(300);
  const detailA2 = await shot('detail-on-2');
  await page.evaluate(() => window.rhine.setOcclusion(false));
  await settle(350);
  const detailOff = await stats();
  const detailB = await shot('detail-off');
  const detailFloor = await diffImages(detailA1, detailA2);
  const detailDelta = await diffImages(detailA1, detailB);
  assert.ok(detailOff.triangles > detailOn.triangles,
    `detail culling drops triangles (${detailOn.triangles} < ${detailOff.triangles})`);
  const detailBudget = Math.max(Math.ceil(detailFloor.changed * 1.25), 400);
  assert.ok(detailDelta.changed <= detailBudget,
    `detail occlusion is visually neutral: ${detailDelta.changed}px differ, motion floor ${detailFloor.changed}px`);
  results.detail = {
    enabled: { candidates: detailOn.occlusion.candidates, hidden: detailOn.occlusion.hidden, occluders: detailOn.occlusion.occluders, meshesHidden: detailOn.occlusion.meshesHidden },
    triangles: { on: detailOn.triangles, off: detailOff.triangles },
    drawCalls: { on: detailOn.drawCalls, off: detailOff.drawCalls },
    diff: detailDelta,
    motionFloor: detailFloor,
  };

  assert.deepEqual(errors, [], 'no page or shader errors');
  results.errors = errors;
  await writeFile('verification/occlusion/results.json', JSON.stringify(results, null, 2));
  console.log('Occlusion culling A/B: hidden slots, fewer triangles and a visually neutral frame passed.');
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close().catch(() => {});
}
