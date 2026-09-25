import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

// Restore only in the owner's hosting projects. Forks keep the phrase artwork.
let officialPagesBuild = false;
if (process.env.CF_PAGES === '1' && process.env.CF_PAGES_URL) {
  const host = new URL(process.env.CF_PAGES_URL).hostname;
  officialPagesBuild = host === 'rhine-lab-ui.pages.dev' || host.endsWith('.rhine-lab-ui.pages.dev');
}
const officialBuild = officialPagesBuild ||
  process.env.VERCEL_PROJECT_ID === 'prj_KyOQlIfl3qhHkI4SUpiD5tbFTE5w';
const sources = JSON.parse(await readFile(new URL('../verification/boot-lettering/webfont-sources.json', import.meta.url), 'utf8'));
const files = [
  ...Object.entries(sources).map(([weight, source]) => ({
    path: `webFonts/NovecentoSansWide${weight}/font.woff2`, hash: source.sha256,
  })),
  { path: 'RhineLabNovecento.css', hash: '9495a310fe80cc0c06c56cb9e04926ae4135e41ce674bacb6cd38c0d5f4f0f7a' },
];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
// The licensed kit is restored from the checkout itself. The owner may point
// RHINE_WEBFONT_SOURCE at any host that serves the same verified bytes; there
// is deliberately no baked-in domain, so this branch depends on none.
const webSource = process.env.RHINE_WEBFONT_SOURCE?.replace(/\/+$/, '');
let restored = 0;
for (const file of files) {
  const target = resolve('public/fonts/novecento', file.path);
  let bytes;
  try { bytes = await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!bytes && officialBuild) {
    if (webSource) {
      const url = `${webSource}/fonts/novecento/${file.path}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Licensed font restore failed (${response.status}): ${file.path}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (digest(bytes) !== file.hash) throw new Error(`Licensed font checksum mismatch: ${file.path}`);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
      restored++;
    } else {
      console.warn(`Licensed font missing locally: ${file.path}. Install the kit in public/fonts/novecento or set RHINE_WEBFONT_SOURCE; official packaging stops without it.`);
    }
  }
  if (bytes && digest(bytes) !== file.hash) throw new Error(`Local licensed font checksum mismatch: ${file.path}`);
}
if (restored) console.log(`Restored ${restored} verified licensed assets for the owner's website build.`);
