// The lightbox's behaviour, shared by the Photography page and the project pages
// (markup and look: src/components/Lightbox.astro).
//
// - Arrows, the arrow keys, or a swipe flip through; Esc or the close button closes.
// - Every picture has its own address (the part after #), so one photo can be linked or shared.
// - The browser's Back button closes the lightbox instead of leaving the page.
// - The Tab key stays inside the lightbox while it is open.

export interface LightboxItem {
  id: string;      // the address: /photography/#20260726-lerici-liguria-italy
  src: string;     // the large picture
  w: number;
  h: number;
  alt: string;
  title: string;   // first caption line (the place, or the screen's caption)
  sub?: string;    // second caption line (the date)
}

export function initLightbox(items: LightboxItem[], standIn?: (i: number) => string | undefined) {
  const lb = document.getElementById('lightbox');
  if (!lb || !items.length) return null;
  const img = lb.querySelector<HTMLImageElement>('.lb-img')!;
  const title = lb.querySelector<HTMLElement>('.lb-title')!;
  const sub = lb.querySelector<HTMLElement>('.lb-sub')!;
  const count = lb.querySelector<HTMLElement>('.lb-count')!;
  const closeBtn = lb.querySelector<HTMLButtonElement>('.lb-close')!;
  const cache = new Set<string>();
  let current = 0;
  let shown = false;
  let pushed = false; // true when opening added a step to the browser's history, so Back closes
  let lastFocus: HTMLElement | null = null;

  const fromAddress = () => {
    let id = location.hash.slice(1);
    try { id = decodeURIComponent(id); } catch { /* keep as typed */ }
    return id ? items.findIndex((it) => it.id === id) : -1;
  };
  const preload = () => [-1, 1].forEach((d) => {
    const n = items[(current + d + items.length) % items.length];
    if (!cache.has(n.src)) { new Image().src = n.src; cache.add(n.src); }
  });
  const render = () => {
    const it = items[current];
    title.textContent = it.title;
    sub.textContent = it.sub ?? '';
    count.textContent = `${current + 1} / ${items.length}`;
    img.alt = it.alt; img.width = it.w; img.height = it.h;
    // The small picture from the page stands in, slightly blurred, while the large one loads
    if (!cache.has(it.src)) {
      const small = standIn?.(current);
      if (small) img.src = small;
      img.classList.add('loading');
    }
    const full = new Image();
    full.onload = () => { if (items[current] === it) { img.src = it.src; img.classList.remove('loading'); } };
    full.src = it.src; cache.add(it.src);
    preload();
  };
  const reveal = () => {
    render();
    if (shown) return;
    shown = true;
    lb.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    closeBtn.focus();
  };
  const hide = () => {
    if (!shown) return;
    shown = false; pushed = false;
    lb.hidden = true;
    document.documentElement.style.overflow = '';
    lastFocus?.focus();
    lastFocus = null;
  };

  const open = (i: number) => {
    current = i;
    lastFocus = document.activeElement as HTMLElement;
    history.pushState({ lightbox: true }, '', `#${items[i].id}`);
    pushed = true;
    reveal();
  };
  const close = () => {
    if (pushed) { history.back(); return; } // the address change then hides it, below
    history.replaceState(null, '', location.pathname + location.search);
    hide();
  };
  const step = (d: number) => {
    current = (current + d + items.length) % items.length;
    history.replaceState(history.state, '', `#${items[current].id}`);
    render();
  };

  // Back, Forward, or an address typed by hand
  const sync = () => {
    const i = fromAddress();
    if (i < 0) { hide(); return; }
    current = i;
    pushed = !!history.state?.lightbox;
    reveal();
  };
  window.addEventListener('popstate', sync);
  window.addEventListener('hashchange', sync);

  closeBtn.addEventListener('click', close);
  lb.querySelector('.lb-prev')!.addEventListener('click', () => step(-1));
  lb.querySelector('.lb-next')!.addEventListener('click', () => step(1));
  document.addEventListener('keydown', (e) => {
    if (!shown) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'Tab') {
      const stops = [...lb.querySelectorAll<HTMLElement>('button')].filter((b) => b.offsetParent !== null);
      if (!stops.length) return;
      const at = stops.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (at <= 0 ? stops.length - 1 : at - 1) : (at < 0 || at === stops.length - 1 ? 0 : at + 1);
      e.preventDefault();
      stops[next].focus();
    }
  });
  // Swipe on touch screens
  let x0: number | null = null;
  lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
  });

  // Opened from a link to one picture
  if (fromAddress() >= 0) sync();

  return { open };
}
