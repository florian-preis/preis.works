// Photography page behaviour: reveal, hover location, grid/index switch, lightbox.

type Item = { caption: string; date: string; thumb: string; view: string; w: number; h: number };
const data: Item[] = JSON.parse(document.getElementById('photo-data')!.textContent || '[]');

const grid = document.getElementById('grid')!;
const index = document.getElementById('index')!;

/* ── Reveal in batches as tiles arrive, never queued behind the whole list ── */
const tiles = Array.from(grid.querySelectorAll<HTMLElement>('.tile'));
const reveal = new IntersectionObserver((entries) => {
  let k = 0;
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target as HTMLElement;
    setTimeout(() => el.classList.add('shown'), k++ * 40);
    reveal.unobserve(el);
  });
}, { rootMargin: '0px 0px -4% 0px', threshold: 0.04 });
tiles.forEach((t) => reveal.observe(t));

/* ── Hover location: two slots crossfade in the toolbar at the top of the page ── */
const slots = [
  Array.from(document.querySelectorAll<HTMLElement>('.loc[data-slot="0"]')),
  Array.from(document.querySelectorAll<HTMLElement>('.loc[data-slot="1"]')),
];
let active = 0;
let shownText = '';
let showing = false;
const showLocation = (text: string) => {
  if (showing && text === shownText) return;
  const next = showing ? 1 - active : active;
  slots[next].forEach((el) => { el.textContent = text; el.classList.add('on'); });
  if (next !== active) slots[active].forEach((el) => el.classList.remove('on'));
  active = next; shownText = text; showing = true;
};
const hideLocation = () => {
  showing = false;
  slots.flat().forEach((el) => el.classList.remove('on'));
};
tiles.forEach((t) => {
  const i = Number(t.dataset.i);
  t.addEventListener('mouseenter', () => showLocation(data[i].caption));
  t.addEventListener('focus', () => showLocation(data[i].caption));
});
grid.addEventListener('mouseleave', hideLocation);

/* ── Grid / index switch ── */
const track = document.querySelector<HTMLButtonElement>('.switch-track')!;
const labels = Array.from(document.querySelectorAll<HTMLButtonElement>('.switch-label'));
const setView = (view: 'grid' | 'index') => {
  const isIndex = view === 'index';
  track.setAttribute('aria-checked', String(isIndex));
  labels.forEach((l) => l.classList.toggle('is-on', l.dataset.view === view));
  grid.hidden = isIndex;
  index.hidden = !isIndex;
  hideLocation();
};
track.addEventListener('click', () => setView(track.getAttribute('aria-checked') === 'true' ? 'grid' : 'index'));
labels.forEach((l) => l.addEventListener('click', () => setView(l.dataset.view as 'grid' | 'index')));

/* ── Lightbox ── */
const lb = document.getElementById('lightbox')!;
const img = lb.querySelector<HTMLImageElement>('.lb-img')!;
const place = lb.querySelector<HTMLElement>('.lb-place')!;
const date = lb.querySelector<HTMLElement>('.lb-date')!;
const count = lb.querySelector<HTMLElement>('.lb-count')!;
let current = 0;
let lastFocus: HTMLElement | null = null;
const cache = new Set<string>();

const preload = () => [-1, 1].forEach((d) => {
  const n = data[(current + d + data.length) % data.length];
  if (!cache.has(n.view)) { const i = new Image(); i.src = n.view; cache.add(n.view); }
});
const render = () => {
  const p = data[current];
  place.textContent = p.caption;
  date.textContent = p.date;
  count.textContent = `${current + 1} / ${data.length}`;
  img.alt = p.caption;
  img.width = p.w; img.height = p.h;
  // The cached thumbnail stands in, slightly blurred, while the large image loads
  if (!cache.has(p.view)) { img.src = p.thumb; img.classList.add('loading'); }
  const full = new Image();
  full.onload = () => { if (data[current] === p) { img.src = p.view; img.classList.remove('loading'); } };
  full.src = p.view; cache.add(p.view);
  preload();
};
const open = (i: number) => {
  current = i; lastFocus = document.activeElement as HTMLElement;
  render(); lb.hidden = false;
  document.documentElement.style.overflow = 'hidden';
  lb.querySelector<HTMLButtonElement>('.lb-close')!.focus();
};
const close = () => {
  lb.hidden = true; document.documentElement.style.overflow = '';
  lastFocus?.focus();
};
const step = (d: number) => { current = (current + d + data.length) % data.length; render(); };

document.querySelectorAll<HTMLAnchorElement>('[data-i]').forEach((a) => a.addEventListener('click', (e) => {
  if (e.metaKey || e.ctrlKey) return;
  e.preventDefault(); open(Number(a.dataset.i));
}));
lb.querySelector('.lb-close')!.addEventListener('click', close);
lb.querySelector('.lb-prev')!.addEventListener('click', () => step(-1));
lb.querySelector('.lb-next')!.addEventListener('click', () => step(1));
document.addEventListener('keydown', (e) => {
  if (lb.hidden) return;
  if (e.key === 'Escape') close();
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});
// Swipe on touch screens
let x0: number | null = null;
lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
lb.addEventListener('touchend', (e) => {
  if (x0 === null) return;
  const dx = e.changedTouches[0].clientX - x0; x0 = null;
  if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
});
