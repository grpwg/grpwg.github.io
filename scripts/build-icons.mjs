// Rasterize the shared lockup; no alternate logo or generated art.
// ImageMagick rasterizes the SVG so the script needs no bundled dependency.
import { mkdir, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logo } from "../src/brand.ts";

const run = promisify(execFile);
const inner = logo.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
// The lockup lives in viewBox 240 190 850 770; centre that box in the square.
const iconSvg = (scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#a81e27"/><g transform="translate(${(512 - 850 * scale) / 2 - 240 * scale} ${(512 - 770 * scale) / 2 - 190 * scale}) scale(${scale})" fill="#ffffff">${inner}</g></svg>`;

await mkdir("public/icons", { recursive: true });
// The maskable variant keeps the lockup inside the platform's safe zone.
const icons = [
  ["app-icon", iconSvg(0.5)],
  ["icon-maskable-512", iconSvg(0.34)],
];
for (const [name, svg] of icons) {
  const source = `public/icons/${name}.svg`;
  await writeFile(source, svg);
  const sizes = name === "app-icon" ? [["apple-touch-icon", 180], ["icon-192", 192], ["icon-512", 512]] : [["icon-maskable-512", 512]];
  for (const [file, size] of sizes)
    await run("magick", ["-background", "none", "-density", "384", source, "-resize", `${size}x${size}`, `public/icons/${file}.png`]);
  if (name !== "app-icon") await rm(source, { force: true });
}
console.log("Glorious Revolution lockup exported to four home-screen icons.");
