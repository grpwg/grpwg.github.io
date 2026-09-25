import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
// Frame caching A/B: the cross-frame shadow map cache, the instance pass
// reuse fingerprint and the subpixel detail LOD must (1) fire on settled
// frames — static windows reuse frames without re-rendering shadows —
// (2) never alter the image: the same states with all three disabled match
// within the motion noise floor, and (3) never freeze interaction: moving
// casters still re-render shadows, selections and theme switches repaint,
// and reuse resumes once everything settles again.
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
// Deterministic quiet state: no music playfield (activePlay would keep the
// fingerprint time-dependent by design), light theme as the reference.
await context.addInitScript(() => {
  localStorage.setItem('rhine-settings', JSON.stringify({
    music: false, sound: false, reduced: true, colorTheme: 'light',
  }));
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => { errors.push(String(error)); console.error('[pageerror]', error.stack || error); });
page.on('console', message => { if (message.type() === 'error' && /THREE|shader|WebGL/.test(message.text())) errors.push(message.text()); });
const origin = process.env.REVIEW_URL || 'http://127.0.0.1:4173';
const dir = 'verification/frame-caching';
await mkdir(dir, { recursive: true });
const stats = () => page.evaluate(() => window.rhine.stats());
const settle = async (ms) => {
  await page.waitForTimeout(ms);
  // Freeze anything that still repaints text between shots.
  await page.evaluate(() => {
    const clock = document.querySelector('#clock');
    if (clock) clock.style.visibility = 'hidden';
  });
};
const shot = async (name) => page.screenshot({ path: `${dir}/${name}.png` });
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
  const context2d = canvas.getContext('2d', { willReadFrequently: true });
  context2d.clearRect(0, 0, canvas.width, canvas.height);
  context2d.drawImage(imageA, 0, 0);
  const pixelsA = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
  context2d.clearRect(0, 0, canvas.width, canvas.height);
  context2d.drawImage(imageB, 0, 0);
  const pixelsB = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
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

// `frames` counts rAF-driven frames regardless of which reuse layer skipped
// the draw; settled windows render nothing, so raw renderedFrames can be 0.
const span = (a, b) => ({
  frames: (b.renderedFrames + b.reusedFrames) - (a.renderedFrames + a.reusedFrames),
  rendered: b.renderedFrames - a.renderedFrames,
  reusedSnapshots: b.reusedFrames - a.reusedFrames,
  shadow: b.shadowRenders - a.shadowRenders,
  reused: b.instanceReused - a.instanceReused,
});

// Settled state can take 7s+ to reach (rate-5 camera lerp converging to
// float32-exact), and run history shifts it; poll instead of guessing. Frozen
// renderedFrames covers the disabled build (no fingerprint to report), the
// clean drift report covers the enabled one.
const waitStable = async (label) => {
  const deadline = Date.now() + 30000;
  let frozen = 0;
  let previous = null;
  while (frozen < 4) {
    if (Date.now() > deadline) throw new Error(`scene never settled: ${label}`);
    const s = await stats();
    frozen = previous !== null && s.renderedFrames === previous && s.optimization.drift.length === 0
      ? frozen + 1 : 0;
    previous = s.renderedFrames;
    await page.waitForTimeout(200);
  }
  // Freeze text right before the window; any one-off layout change from this
  // lands before the window starts.
  await page.evaluate(() => {
    const clock = document.querySelector('#clock');
    if (clock) clock.style.visibility = 'hidden';
  });
  await page.waitForTimeout(300);
};

const run = async (label, params) => {
  const out = {};
  await page.goto(`${origin}/?${params}`);
  await page.waitForFunction(() => {
    const s = window.rhine?.stats();
    return s && s.ready && s.loaded;
  });
  await waitStable('entrance');

  // ---- resting array: reduced motion keeps every matrix still -------------
  const a1 = await stats();
  await settle(1200);
  const a2 = await stats();
  out.archive = span(a1, a2);
  out.archiveCount = a2.archiveCount;
  out.occluded = a2.occlusion.hidden;
  const shotArchive = await shot(`${label}-archive`);
  await settle(350);
  const floorShot = await shot(`${label}-archive-2`);
  out.floor = await diffImages(shotArchive, floorShot);

  // ---- selection moves casters: shadows must follow, image must change ----
  const before = await stats();
  await page.evaluate(() => window.rhine.select(3));
  await waitStable('post-select'); // motion, scan, pulses and the camera tail
  const after = await stats();
  out.select = { ...span(before, after), count: after.archiveCount };
  const shotSelect = await shot(`${label}-select`);
  out.selectChanged = await diffImages(shotArchive, shotSelect);
  // ---- detail reading state: array frozen, decryption settled -------------
  await page.evaluate(() => window.rhine.detail());
  await waitStable('detail');
  const d1 = await stats();
  await settle(1400);
  const d2 = await stats();
  out.detail = span(d1, d2);
  const shotDetail = await shot(`${label}-detail`);

  // ---- theme switch through the settings modal ----------------------------
  await page.locator('[data-action="settings"]').click();
  await settle(1400);
  await page.locator('[data-color-theme="dark"]').click();
  await settle(2000);
  await page.locator('[data-action="close-modal"]').click();
  await waitStable('post-theme');
  const t1 = await stats();
  await settle(1200);
  const t2 = await stats();
  out.afterTheme = span(t1, t2);
  const shotDark = await shot(`${label}-detail-dark`);
  out.darkChanged = await diffImages(shotDetail, shotDark);
  out.detailCulled = t2.detailCulled;

  // ---- subpixel LOD diagnostic: projected size of the 0.25-unit feature ---
  out.lod = await page.evaluate(() => {
    const s = window.rhine.stats();
    const canvas = document.querySelector('canvas');
    const tan = Math.tan(s.fieldOfView * Math.PI / 360);
    let min = Infinity;
    let max = 0;
    for (let row = 0; row < 32; row++) {
      for (let lane = 0; lane < 5; lane++) {
        const dx = s.cameraPosition[0] - (lane - 2) * 5.2;
        const dy = s.cameraPosition[1] + 3;
        const dz = s.cameraPosition[2] - (row - 15.5) * 0.62;
        const d = Math.hypot(dx, dy, dz);
        const px = 0.25 * canvas.height / (2 * d * tan);
        if (px < min) min = px;
        if (px > max) max = px;
      }
    }
    return { minFeaturePx: min, maxFeaturePx: max, bufferHeight: canvas.height, fieldOfView: s.fieldOfView };
  });
  out.shots = { archive: shotArchive, select: shotSelect, detail: shotDetail, dark: shotDark };
  return out;
};

const results = {};
try {
  const on = await run('on', 'scene=archive');
  results.on = on;
  const off = await run('off', 'scene=archive&no-shadow-cache&no-detail-lod&no-instance-reuse');
  results.off = off;

  // ---- the optimizations fire on settled frames ---------------------------
  assert.ok(on.archive.frames > 30, `frame loop runs (${on.archive.frames})`);
  assert.ok(on.archive.reused >= on.archive.frames * 0.8,
    `resting array reuses frames (${on.archive.reused}/${on.archive.frames})`);
  assert.ok(on.archive.shadow <= 2 && on.archive.shadow < on.archive.frames,
    `shadow map stays cached while static (${on.archive.shadow}/${on.archive.frames})`);
  assert.ok(on.detail.frames > 60, `detail frames run (${on.detail.frames})`);
  assert.ok(on.detail.reused >= on.detail.frames * 0.8,
    `detail reading state reuses frames (${on.detail.reused}/${on.detail.frames})`);
  assert.ok(on.detail.shadow <= 2 && on.detail.shadow < on.detail.frames,
    `detail shadows cached (${on.detail.shadow}/${on.detail.frames})`);
  assert.ok(on.afterTheme.reused >= on.afterTheme.frames * 0.8,
    `reuse resumes after the theme wave (${on.afterTheme.reused}/${on.afterTheme.frames})`);

  // ---- and never freeze: movers re-render, interaction repaints -----------
  assert.ok(on.select.shadow >= 1, `moved casters re-render the shadow map (${on.select.shadow})`);
  assert.ok(on.select.rendered > 20, `selection repaints (${on.select.rendered})`);
  // Cards settle (rate 35) long before the camera lerp (rate 5); those tail
  // frames render without touching the shadow map — the cache in action.
  assert.ok(on.select.shadow < on.select.rendered,
    `cached shadows skip the camera-settle frames (${on.select.shadow} < ${on.select.rendered})`);
  assert.ok(on.select.count > 0, 'selection draws instances');
  assert.ok(on.occluded > 0, `occlusion still culls covered slots (${on.occluded})`);
  const budget = Math.max(Math.ceil(on.floor.changed * 1.25), 400);
  assert.ok(on.selectChanged.changed > budget,
    `selection visibly repaints (${on.selectChanged.changed}px > budget ${budget}px)`);
  assert.ok(on.darkChanged.changed > budget,
    `theme switch visibly recolors (${on.darkChanged.changed}px > budget ${budget}px)`);

  // ---- flags fully disable each path --------------------------------------
  assert.equal(off.archive.reused, 0, 'no-instance-reuse disables the fingerprint');
  assert.equal(off.detail.reused, 0, 'disabled reuse stays disabled in detail');
  assert.ok(off.select.rendered > 20, 'legacy path still renders the selection');
  assert.equal(off.select.shadow, off.select.rendered,
    'no-shadow-cache re-renders shadows on every drawn frame');

  // ---- pixel parity: default build matches the disabled build -------------
  results.parity = {
    archive: await diffImages(on.shots.archive, off.shots.archive),
    select: await diffImages(on.shots.select, off.shots.select),
    detail: await diffImages(on.shots.detail, off.shots.detail),
    dark: await diffImages(on.shots.dark, off.shots.dark),
  };
  for (const [name, value] of Object.entries(results.parity)) {
    assert.ok(value.changed <= budget,
      `${name} matches the disabled build (${value.changed}px <= budget ${budget}px, floor ${on.floor.changed}px)`);
  }

  // ---- subpixel detail LOD never fires at these sizes ---------------------
  assert.equal(on.detailCulled, 0, 'no subpixel parts at a1600×900 reading distance');
  assert.equal(off.detailCulled, 0, 'disabled LOD reports nothing culled');
  assert.ok(on.lod.minFeaturePx > 1,
    `the0.25-unit feature stays above one device pixel (min ${on.lod.minFeaturePx.toFixed(2)}px)`);

  assert.deepEqual(errors, [], 'no page or shader errors');
  results.errors = errors;
  results.budget = budget;
  const strip = ({ shots, ...rest }) => rest;
  await writeFile(`${dir}/results.json`, JSON.stringify({ ...results, on: strip(on), off: strip(off) }, null, 2));
  console.log('Frame caching A/B: reuse and shadow cache fire, flags disable them, images match.');
  console.log(JSON.stringify({
    on: strip(on), off: strip(off), parity: results.parity, lod: on.lod, budget,
  }, null, 2));
} finally {
  await browser.close().catch(() => {});
}
