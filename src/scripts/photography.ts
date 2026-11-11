// Photography page behaviour: reveal, hover location, grid/index switch, lightbox.
import { initLightbox } from './lightbox';

type Item = { id: string; caption: string; date: string; view: string; w: number; h: number };
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
// While a large photo loads, the thumbnail already on the page stands in
const lightbox = initLightbox(
  data.map((p) => ({ id: p.id, src: p.view, w: p.w, h: p.h, alt: p.caption, title: p.caption, sub: p.date })),
  (i) => tiles[i]?.querySelector('img')?.currentSrc || undefined,
);
document.querySelectorAll<HTMLAnchorElement>('[data-i]').forEach((a) => a.addEventListener('click', (e) => {
  if (e.metaKey || e.ctrlKey) return;
  e.preventDefault(); lightbox?.open(Number(a.dataset.i));
}));
