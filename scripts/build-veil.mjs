// Prepares the veil images from content/veil.json before each build.
// For every slide it writes two files to public/veil/:
//   NN.webp      sharp version, seen through the handwritten name
//   NN-fog.webp  small, pre-blurred version for the fogged glass (no live blur needed)
// Unchanged photos are skipped, so repeat builds are quick.
import { readFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const config = JSON.parse(await readFile(path.join(root, 'content/veil.json'), 'utf8'));
const out = path.join(root, 'public/veil');
await mkdir(out, { recursive: true });

const newer = async (src, dst) => {
  try { return (await stat(src)).mtimeMs > (await stat(dst)).mtimeMs; } catch { return true; }
};

for (const [i, slide] of config.slides.entries()) {
  const src = path.join(root, 'photography', slide.file);
  const id = String(i + 1).padStart(2, '0');
  const sharpOut = path.join(out, `${id}.webp`);
  const fogOut = path.join(out, `${id}-fog.webp`);
  try { await stat(src); } catch { console.warn(`veil: missing photo "${slide.file}", skipped`); continue; }
  if (await newer(src, sharpOut)) {
    await sharp(src).rotate().resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 76 }).toFile(sharpOut);
  }
  if (await newer(src, fogOut)) {
    await sharp(src).rotate().resize({ width: 480 }).blur(7).webp({ quality: 60 }).toFile(fogOut);
  }
}
console.log(`veil: ${config.slides.length} photos ready`);
