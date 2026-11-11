// Prepares the link preview pictures (the image shown when a page is shared) before each build.
// For every project with a mockup it writes public/og/<name>.jpg, 1200 x 630, cropped around the
// project's focus point. Project pages and the apps point at these. Unchanged mockups are skipped.
import { readdir, readFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'content/projects');
const out = path.join(root, 'public/og');
await mkdir(out, { recursive: true });

const W = 1200, H = 630;
const newer = async (a, b) => {
  try { return (await stat(a)).mtimeMs > (await stat(b)).mtimeMs; } catch { return true; }
};

let n = 0;
for (const file of (await readdir(src)).filter((f) => f.endsWith('.md'))) {
  const name = file.replace(/\.md$/, '');
  const text = await readFile(path.join(src, file), 'utf8');
  const image = text.match(/^image:\s*(.+)$/m)?.[1].trim();
  if (!image) continue;
  const from = path.resolve(src, image);
  const to = path.join(out, `${name}.jpg`);
  n++;
  if (!(await newer(from, to)) && !(await newer(path.join(src, file), to))) continue;
  // focus: "50% 25%" = which part stays in view when the picture is cropped
  const [fx, fy] = (text.match(/^focus:\s*(.+)$/m)?.[1] ?? '50% 50%').split(/\s+/).map((v) => parseFloat(v) / 100);
  const meta = await sharp(from).metadata();
  const scale = Math.max(W / meta.width, H / meta.height);
  const w = Math.round(meta.width * scale), h = Math.round(meta.height * scale);
  const left = Math.round((w - W) * (Number.isFinite(fx) ? fx : 0.5));
  const top = Math.round((h - H) * (Number.isFinite(fy) ? fy : 0.5));
  await sharp(from).resize(w, h).extract({ left, top, width: W, height: H }).jpeg({ quality: 82, mozjpeg: true }).toFile(to);
}
console.log(`previews: ${n} project pictures ready`);
