import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// This project is an independent derivative and ships no licensed webfont:
// public/fonts/novecento is intentionally absent from Git. Anyone who holds
// their own Novecento kit can drop it in that directory; the build then
// verifies each file against the recorded SHA-256 and the opening lettering
// upgrades from the authored phrase artwork to real text. Nothing is fetched
// from any remote host, and no hosting project is privileged.
const sources = JSON.parse(await readFile(new URL('../verification/boot-lettering/webfont-sources.json', import.meta.url), 'utf8'));
const files = [
  ...Object.entries(sources).map(([weight, source]) => ({
    path: `webFonts/NovecentoSansWide${weight}/font.woff2`, hash: source.sha256,
  })),
  { path: 'RhineLabNovecento.css', hash: '9495a310fe80cc0c06c56cb9e04926ae4135e41ce674bacb6cd38c0d5f4f0f7a' },
];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
let installed = 0;
for (const file of files) {
  const target = resolve('public/fonts/novecento', file.path);
  let bytes;
  try { bytes = await readFile(target); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    continue;
  }
  if (digest(bytes) !== file.hash) throw new Error(`Local licensed font checksum mismatch: ${file.path}`);
  installed++;
}
if (installed) console.log(`Verified ${installed} locally installed licensed font assets.`);
