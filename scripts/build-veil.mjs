// Prepares the fogged-glass images for the home page veil before each build.
// For every photo in photography/ it writes one small, pre-blurred image to
// public/veil/ (a few kilobytes each), so the browser never has to blur live.
// The sharp layer reuses the large lightbox images, so nothing else is needed.
// Unchanged photos are skipped, so repeat builds are quick.
import { readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { fogName } from '../src/data/veil-names.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'photography');
const out = path.join(root, 'public/veil');
await mkdir(out, { recursive: true });

const newer = async (a, b) => {
  try { return (await stat(a)).mtimeMs > (await stat(b)).mtimeMs; } catch { return true; }
};

const files = (await readdir(src)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
for (const file of files) {
  const from = path.join(src, file);
  const to = path.join(out, fogName(file));
  if (await newer(from, to)) {
    await sharp(from).rotate().resize({ width: 480 }).blur(7).webp({ quality: 60 }).toFile(to);
  }
}
console.log(`veil: ${files.length} photos ready`);
