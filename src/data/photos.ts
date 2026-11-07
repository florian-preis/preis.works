// Reads every photo in /photography and turns its filename into a caption and date.
//
// NAMING CONVENTION:  YYYYMMDD_Caption text.jpg
//   e.g.  20260219_Staircase at Marina Bay Sands, Singapore.jpg
// The filename is the content. Add a photo by adding a file; nothing else to edit.
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('/photography/*.{jpg,jpeg,JPG,JPEG,png,webp}', { eager: true });

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface Photo {
  file: string;
  image: ImageMetadata;
  caption: string;
  date: string;     // "26 July 2026"
  sortKey: string;  // "20260726"
}

export const photos: Photo[] = Object.entries(files)
  .map(([path, mod]) => {
    const file = path.split('/').pop()!;
    const stem = file.replace(/\.[^.]+$/, '');
    const m = stem.match(/^(\d{4})(\d{2})(\d{2})_(.+)$/);
    // A file without a date prefix still appears, with its raw name as caption,
    // so a naming mistake is visible and gets fixed.
    const caption = m ? m[4].trim() : stem;
    const date = m ? `${parseInt(m[3], 10)} ${MONTHS[parseInt(m[2], 10) - 1] ?? ''} ${m[1]}` : '';
    return { file, image: mod.default, caption, date, sortKey: m ? m[1] + m[2] + m[3] : '0' };
  })
  .sort((a, b) => b.sortKey.localeCompare(a.sortKey) || a.file.localeCompare(b.file));

export const photoByFile = (file: string) => photos.find((p) => p.file === file);
