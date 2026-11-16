// Familienrezepte: Lena's family cookbook as a notebook on the screen.
// The notebook is built from photographs (assets/); everything inside it is encrypted (data/) and opens with
// the shared password. Built by scripts/familienrezepte/build.py; see the README there.
'use strict';
const $ = id => document.getElementById(id);
const root = document.documentElement;
const asset = f => `assets/${f}.webp?v=${V['assets/' + f + '.webp'] || ''}`;
const A = { sheetR: asset('sheet-right'), sheetL: asset('sheet-left'), pageR: asset('page-right'), pageL: asset('page-left'), endL: asset('endpaper-left'), endR: asset('endpaper-right'),
            cover: asset('cover-front'), elastic: asset('cover-elastic'), label: asset('cover-label'), back: asset('cover-back') };
root.style.setProperty('--img-r', `url(${A.pageR})`);
root.style.setProperty('--img-l', `url(${A.pageL})`);
root.style.setProperty('--img-e', `url(${A.endR})`);
root.style.setProperty('--img-sr', `url(${A.sheetR})`);      // clean paper for a page in motion: white to every edge
root.style.setProperty('--img-sl', `url(${A.sheetL})`);
$('baseR').src = A.pageR; $('imgCover').src = A.cover; $('imgLabel').src = A.label; $('imgElastic').src = A.elastic; $('imgEnd').src = A.endL;
$('imgEndR').src = A.endR; $('imgBack').src = A.back;
for (const [id, img] of [['coverBackShade', A.endL], ['backInShade', A.endR], ['backOutShade', A.back]]) {   // shading only where the board is
  const m = $(id).style; m.webkitMaskImage = m.maskImage = `url(${img})`; m.webkitMaskSize = m.maskSize = '100% 100%';
}
let D = null;                 // the book's content, once unlocked
const ILLD = {};              // illustrations per recipe, as they arrive
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const tall = matchMedia('(max-aspect-ratio: 1/1), (max-width: 700px)');
let lang = 'de';
const T = { de: { ing: 'Zutaten', steps: 'Zubereitung', prev: 'Zurückblättern', next: 'Weiterblättern', toc: 'Inhaltsverzeichnis', pw: 'Passwort', wrong: 'Falsches Passwort', open: 'Öffnen' },
            en: { ing: 'Ingredients', steps: 'Instructions', prev: 'Previous page', next: 'Next page', toc: 'Contents', pw: 'Password', wrong: 'Wrong password', open: 'Open' } };

// Lettering and illustrations become pictures once, so a page can be copied cheaply while it turns
const urls = {};
function svgUrl(key, svg) { return urls[key] || (urls[key] = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))); }
function handUrl(key, p) {
  return svgUrl('h' + key, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w} ${p.h}" fill="#1d1d1c"><path d="${p.d}"/>${p.d2 ? `<path transform="translate(${p.dx},${p.dy})" d="${p.d2}"/>` : ''}</svg>`);
}
function illusUrl(key, it) {   // paths are stored in half units
  return svgUrl('i' + key, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${it.w * 2} ${it.h * 2}">${it.white ? `<path d="${it.white}" fill="#fcfbf7"/>` : ''}${it.layers.map(l => `<path d="${l.d}" fill="${l.c}"/>`).join('')}</svg>`);
}
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const U = n => `calc(${n} * var(--u))`;

// ---------- pages ----------
// Lena's lettering, placed by its ink: centred on cx, baseline on printed line k, lifted by `lift`
function hand(key, cx, k, parent, lift) {
  const p = D.hand[key], s = p.s, img = el('img', 'hand'); img.src = handUrl(key, p); img.alt = '';
  img.style.width = U(p.w * s); img.style.height = U(p.h * s);
  img.style.left = U(cx - (p.x1 - p.x0) * s / 2 - p.x0 * s);
  img.style.top = U(74.5 + 29 * k - 2.2 - p.base * s - (lift || 0));
  parent.appendChild(img); return img;
}
function row(k, html, cls) { const r = el('div', 'row' + (cls ? ' ' + cls : ''), html); r.style.setProperty('--k', k); return r; }
const CX = 252.5;               // the middle of the text block

function tocPage() {
  return side => {
    const s = el('div', 'sheet ' + side), inn = el('div', 'in'); s.appendChild(inn);
    hand('toc', CX, 1, inn);
    const entry = r => `<a data-go="${r.no}"><i>${r.no}</i><span>${esc(lang === 'de' ? r.title : r.title_en)}${r.dup ? ` <em>${esc(r.dup)}</em>` : ''}</span></a>`;
    inn.appendChild(row(3, esc(D.dedication[lang]), 's ded'));
    const grid = el('div', 'toc'); grid.style.top = `calc(var(--u) * ${58.3 + 29 * 6} - var(--fs-s) * 0.3635)`;
    grid.innerHTML = `<div>${D.index.slice(0, 19).map(entry).join('')}</div><div>${D.index.slice(19).map(entry).join('')}</div>`;
    inn.appendChild(grid);
    return s;
  };
}
// The top of a recipe page: who it is from, small, above the title; the English name below it in English
function header(r, inn) {
  const key = String(r.no), t = D.hand[key];
  hand(key, CX, 1, inn);
  hand(r.by, CX, 1, inn, (t.base - t.top) * t.s + 9);
  if (lang === 'en') inn.appendChild(row(2, `<span class="muted">${esc(r.title_en)}</span>`, 's center'));
}
// A recipe that would run past the foot of the page gets its ingredients in two columns
const LINES = 26, fit = {};
const fkey = (r, l) => r.no + l + (tall.matches ? 't' : 'w');
function body(r, two) {
  const c = r[lang];
  const group = g => `<div class="label">${esc(g.label || T[lang].ing)}</div>` + (two ? '<div class="cols">' : '') + g.items.map(i => `<div class="li bul"><b>•</b>${esc(i)}</div>`).join('') + (two ? '</div>' : '');
  // two groups (dough and topping, say) stand side by side, as Lena wrote them
  let html = c.ingredients.length === 2 ? `<div class="groups"><div>${group(c.ingredients[0])}</div><div>${group(c.ingredients[1])}</div></div>` : c.ingredients.map(group).join('');
  html += `<div>&nbsp;</div><div class="label">${T[lang].steps}</div>` + c.steps.map((t, i) => `<div class="li"><b>${i + 1}.</b>${esc(t)}</div>`).join('');
  for (const x of c.extras) html += `<div>&nbsp;</div>` + (x.label ? `<div class="label">${esc(x.label)}</div>` : '') + x.lines.map(t => `<div>${esc(t)}</div>`).join('');
  const b = row(4, html); b.classList.add('body'); return b;
}
function recipePage(r, bare) {
  return side => {
    const s = el('div', 'sheet ' + side), inn = el('div', 'in'); s.appendChild(inn);
    header(r, inn);
    const f = fit[fkey(r, lang)];
    inn.appendChild(body(r, f && f.two));
    const il = ILLD[r.no];
    if (il && !bare && f && f.place) for (const p of f.place) {
      const it = il.items[p.i], img = el('img', 'illus'); img.src = illusUrl(r.no + '-' + p.i, it); img.alt = '';
      img.style.left = U(p.x); img.style.top = U(p.y); img.style.width = U(it.w * p.k); img.style.height = U(it.h * p.k);
      inn.appendChild(img);
    }
    s.appendChild(el('div', 'pageno', String(r.no)));
    return s;
  };
}
const insideBack = side => el('div', 'sheet ' + side + ' e');
const blank = side => el('div', 'sheet ' + side);

// ---------- fitting text and illustrations on each page ----------
// Every recipe is laid out once per language and screen shape: the text first, then Lena's illustrations go
// as close as possible to where she put them on her page, without touching the text, scaled down only if needed.
const GRID = 5, X0 = -25, X1 = 530, Y1 = 945, BASE_K = 0.44, MAXS = 270;
function measureBox() { const box = el('div', 'slot slot-r'); box.style.visibility = 'hidden'; $('book').appendChild(box); return box; }
function textRects(sheet, u) {
  const inn = sheet.querySelector('.in'), o = inn.getBoundingClientRect(), out = [];
  const w = document.createTreeWalker(inn, NodeFilter.SHOW_TEXT); const rg = document.createRange();
  while (w.nextNode()) {
    if (!w.currentNode.textContent.trim()) continue;
    rg.selectNodeContents(w.currentNode);
    for (const r of rg.getClientRects()) out.push([(r.left - o.left) / u, (r.top - o.top) / u, (r.right - o.left) / u, (r.bottom - o.top) / u]);
  }
  for (const img of inn.querySelectorAll('.hand')) { const r = img.getBoundingClientRect(); out.push([(r.left - o.left) / u, (r.top - o.top) / u, (r.right - o.left) / u, (r.bottom - o.top) / u]); }
  const pn = sheet.querySelector('.pageno').getBoundingClientRect(); out.push([(pn.left - o.left) / u - 20, (pn.top - o.top) / u - 10, X1, Y1 + 50]);
  return out;
}
function place(r, rects) {
  // Each page gets a small composed still life: the main dish centred in the free space below the text, its
  // companions beside it on the same baseline. Where the page is too full, companions move to the empty space
  // beside the ingredient list, and as a last resort anything goes wherever it fits.
  const il = ILLD[r.no]; if (!il || !il.items.length) return null;
  const cols = Math.ceil((X1 - X0) / GRID), rows = Math.ceil(Y1 / GRID);
  const occ = new Uint8Array(cols * rows);
  const mark = (x0, y0, x1, y1, pad) => {
    const a = Math.max(0, Math.floor((x0 - pad - X0) / GRID)), b = Math.min(cols - 1, Math.floor((x1 + pad - X0) / GRID));
    const c = Math.max(0, Math.floor((y0 - pad) / GRID)), d = Math.min(rows - 1, Math.floor((y1 + pad) / GRID));
    for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) occ[y * cols + x] = 1;
  };
  let textBottom = 0;
  for (const q of rects) { mark(q[0], q[1], q[2], q[3], 8); if (q[3] < Y1) textBottom = Math.max(textBottom, q[3]); }
  const free = (x0, y0, w, h) => {
    if (x0 < X0 || y0 < 0 || x0 + w > X1 || y0 + h > Y1) return false;
    const a = Math.floor((x0 - X0) / GRID), b = Math.ceil((x0 + w - X0) / GRID) - 1, c = Math.floor(y0 / GRID), d = Math.ceil((y0 + h) / GRID) - 1;
    for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) if (occ[y * cols + x]) return false;
    return true;
  };
  const items = il.items.map((it, i) => ({ i, w: it.w, h: it.h })).sort((p, q) => q.w * q.h - p.w * p.h);
  const hero = items[0], rest = items.slice(1);
  const K0 = clamp(250 / Math.max(hero.w, hero.h), 0.28, 0.62);
  const sizeOf = (it, k, isHero) => {
    let kk = k;
    if (!isHero) kk = Math.min(k, 0.72 * Math.max(hero.w, hero.h) * k / Math.max(it.w, it.h));   // companions stay smaller than the dish
    return { w: it.w * kk, h: it.h * kk, k: kk };
  };
  // the still life: hero in the middle, companions alternately right and left, standing on the same line
  const compose = (k, list) => {
    const H = sizeOf(hero, k, true), parts = [{ it: hero, ...H, x: 0, y: 0 }];
    let left = 0, right = H.w; const gap = 14, base = H.h * 0.96;
    list.forEach((it, n) => {
      const S = sizeOf(it, k, false);
      if (n % 2 === 0) { parts.push({ it, ...S, x: right + gap, y: base - S.h }); right += gap + S.w; }
      else { left -= gap + S.w; parts.push({ it, ...S, x: left, y: base - S.h }); }
    });
    const minY = Math.min(...parts.map(p => p.y)), maxY = Math.max(...parts.map(p => p.y + p.h));
    parts.forEach(p => { p.x -= left; p.y -= minY; });
    return { parts, w: right - left, h: maxY - minY };
  };
  const out = [];
  const commit = (p, x, y) => { out.push({ i: p.it.i, x, y, k: p.k }); mark(x, y, x + p.w, y + p.h, 12); };
  const bandTop = textBottom + 30, bandH = Y1 - bandTop;
  // where in the band: centred across the text, a little above the middle of the space
  const tryBand = (C) => {
    if (C.w > X1 - X0 || C.h > bandH) return null;
    const cx = 252.5 - C.w / 2;
    const yIdeal = bandTop + (bandH - C.h) * (bandH > 1.8 * C.h ? 0.42 : 0.5);
    for (const dy of [0, -15, 15, -30, 30, -50, 50]) for (const dx of [0, -20, 20, -40, 40, -70, 70]) {
      const x = cx + dx, y = clamp(yIdeal + dy, bandTop, Y1 - C.h);
      if (C.parts.every(p => free(x + p.x, y + p.y, p.w, p.h))) return { x, y };
    }
    return null;
  };
  let placed = false;
  for (const f of [1, 0.9, 0.8, 0.7]) {                  // everything together, shrinking a little if needed
    const C = compose(K0 * f, rest), at = tryBand(C);
    if (at) { C.parts.forEach(p => commit(p, at.x + p.x, at.y + p.y)); placed = true; break; }
  }
  let left = placed ? [] : rest;
  if (!placed) {                                         // the dish alone below the text, companions elsewhere
    for (const f of [1, 0.9, 0.8, 0.7, 0.6]) {
      const C = compose(K0 * f, []), at = tryBand(C);
      if (at) { commit(C.parts[0], at.x, at.y); placed = true; break; }
    }
    left = placed ? rest : items;
  }
  // the rest: beside the ingredients (top right), then anywhere that fits, as close to that corner as possible
  for (const it of left) {
    let best = null;
    for (const f of [1, 0.85, 0.7, 0.55, 0.45]) {
      const S = sizeOf(it, K0 * f, it === hero && !placed);
      for (let y = 40; y + S.h <= Y1; y += GRID) for (let x = X0; x + S.w <= X1; x += GRID) {
        if (!free(x, y, S.w, S.h)) continue;
        const score = Math.hypot((x + S.w) - 520, (y - 150) * 0.7) + 400 * (1 - f);
        if (!best || score < best.score) best = { score, x, y, S };
      }
      if (best) break;
    }
    if (best) commit({ it, ...best.S }, best.x, best.y);
  }
  return out;
}
function fitOne(r, box, u) {
  const keep = lang;
  for (const l of ['de', 'en']) {
    lang = l; const key = fkey(r, l); delete fit[key];
    let s = recipePage(r, true)('r'); box.replaceChildren(s);
    const one = Math.round(s.querySelector('.body').getBoundingClientRect().height / (29 * u));
    const f = fit[key] = { one, two: one > LINES && r[l].ingredients.length === 1 };
    if (f.two) { s = recipePage(r, true)('r'); box.replaceChildren(s); }
    f.now = Math.round(s.querySelector('.body').getBoundingClientRect().height / (29 * u));
    f.place = place(r, textRects(s, u));
  }
  lang = keep;
}
function fitAll() { const box = measureBox(), u = px(); for (const r of D.recipes) fitOne(r, box, u); box.remove(); }

// ---------- the order of pages ----------
let pages = [];
function buildPages() { pages = [tocPage(), ...D.recipes.map(r => recipePage(r)), insideBack]; }
// Which pages lie open at position n. Wide: a spread, the inside of the cover first. Tall: one right-hand page at a time
const wide = () => !tall.matches;
const rightIdx = n => wide() ? 2 * n : n;
const leftIdx = n => wide() ? 2 * n - 1 : -1;
const lastPos = () => wide() ? Math.floor((pages.length - 1) / 2) : pages.length - 1;
const posOf = pageIdx => wide() ? Math.ceil(pageIdx / 2) : pageIdx;
const make = (i, side) => (pages[i] || blank)(side);

// ---------- state ----------
let pos = 0, open = false, busy = false, shutBack = false;
const slotL = $('slotL'), slotR = $('slotR'), leaf = $('leaf'), cast = $('cast');
function setSlot(slot, i, side) { slot.replaceChildren(); if (i >= 0 || side === 'r') slot.appendChild(make(i, side)); }
function leftBase(n) { $('baseL').src = n === 0 ? A.endL : A.pageL; }   // inside cover first, ruled paper after that
function show() {
  setSlot(slotR, rightIdx(pos), 'r');
  if (leftIdx(pos) >= 0) setSlot(slotL, leftIdx(pos), 'l'); else slotL.replaceChildren();
  leftBase(pos);
  updateControls();
}
const visible = n => open && (rightIdx(pos) === n || leftIdx(pos) === n);
function updateControls() {
  const reopen = shutBack;
  $('prev').classList.toggle('gone', !open && !reopen);
  $('next').classList.toggle('gone', !open || (pos >= lastPos() && !wide()));
  $('home').hidden = !open && !reopen; requestAnimationFrame(() => $('home').classList.toggle('gone', !(open && pos > 0) && !reopen));
  $('pass').hidden = open || passDone;
  $('prev').setAttribute('aria-label', T[lang].prev); $('next').setAttribute('aria-label', T[lang].next); $('home').setAttribute('aria-label', T[lang].toc);
  $('pw').placeholder = T[lang].pw; $('pw').setAttribute('aria-label', T[lang].pw); $('passGo').setAttribute('aria-label', T[lang].open);
}
const px = () => $('book').getBoundingClientRect().width / 1283;
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const swing = t => (1 - Math.cos(Math.PI * t)) / 2 * 0.7 + t * 0.3;   // a board, not a sheet: steady through the middle
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wait = ms => new Promise(r => setTimeout(r, ms));
function animate(ms, fn) { return new Promise(res => { const t0 = performance.now(); const tick = now => { const t = clamp((now - t0) / ms, 0, 1); fn(t); t < 1 ? requestAnimationFrame(tick) : res(); }; requestAnimationFrame(tick); }); }
// How a face of paper is lit: light comes from above and a little from the left
function lit(theta, back) { const d = (Math.cos(theta) * 0.94 + Math.sin(theta) * 0.34) * (back ? -1 : 1); return 0.66 + 0.34 * clamp(d, -0.25, 1.1) / 0.94; }
const tint = v => v >= 1 ? `rgba(255,255,255,${((v - 1) * 0.9).toFixed(3)})` : `rgba(38,32,18,${((1 - v) * 0.5).toFixed(3)})`;
function setCast(tipX, lift, reach) {
  if (lift < 0.004) { cast.style.background = 'none'; return; }
  const a = (0.26 * Math.pow(lift, 0.6)).toFixed(3), w = 10 + reach * lift;
  const X = tipX >= 0 ? 608 + tipX : 608 - tipX, dir = tipX >= 0 ? 'to right' : 'to left';
  cast.style.background = `linear-gradient(${dir}, transparent ${U(X - 1)}, rgba(20,16,8,${a}) ${U(X)}, rgba(20,16,8,${(a * 0.35).toFixed(3)}) ${U(X + w * 0.4)}, transparent ${U(X + w)})`;
}

// ---------- turning a page ----------
// A leaf is a sheet of paper cut into vertical strips, each its own plane in 3D, so the sheet can bend.
const N = 36;
const three = document.querySelector('.three');
function buildLeaf(frontIdx, backIdx, pivot, n) {
  n = n || N; const sw = 608 / n;
  pivot.replaceChildren(); const u = px(); const fr = [], bk = [];
  const front = make(frontIdx, 'r'), back = make(backIdx, 'l');
  for (let i = 0; i < n; i++) {
    for (const [arr, src, off] of [[fr, front, -i * sw], [bk, back, -(n - 1 - i) * sw]]) {
      const s = el('div', 'strip'); s.style.width = (sw * u + 0.6) + 'px';
      const c = src.cloneNode(true); c.style.left = (off * u) + 'px'; s.appendChild(c);
      const sh = el('div', 'shade'); s.appendChild(sh); s._sh = sh; pivot.appendChild(s); arr.push(s);
    }
  }
  return { fr, bk, u, n, pivot };
}
// The sheet bends: the free edge leads, the part by the fold follows, and it lands with a soft bulge that flattens
function poseLeaf(L, p, noCast) {
  const { fr, bk, u, n } = L; const w = 608 / n * u;
  const tip = Math.PI * ease(clamp(p / 0.86, 0, 1)), sp = Math.PI * ease(clamp((p - 0.14) / 0.86, 0, 1));
  let x = 0, z = 0, zmax = 0; const th = [];
  for (let i = 0; i <= n; i++) th.push(sp + (tip - sp) * Math.pow(i / n, 1.35));
  for (let i = 0; i < n; i++) {
    const a = (th[i] + th[i + 1]) / 2, deg = (-a * 180 / Math.PI).toFixed(3);
    const base = `translate3d(${x.toFixed(2)}px,0,${z.toFixed(2)}px) rotateY(${deg}deg)`;
    fr[i].style.transform = base;
    bk[i].style.transform = `${base} translateX(${(w / 2).toFixed(2)}px) rotateY(180deg) translateX(${(-w / 2).toFixed(2)}px)`;
    fr[i]._sh.style.background = `linear-gradient(to right, ${tint(lit(th[i], false))}, ${tint(lit(th[i + 1], false))})`;
    bk[i]._sh.style.background = `linear-gradient(to left, ${tint(lit(th[i], true))}, ${tint(lit(th[i + 1], true))})`;
    x += w * Math.cos(a); z += w * Math.sin(a); zmax = Math.max(zmax, z);
  }
  if (!noCast) setCast(x / u, zmax / (608 * u), 300);
  return { tip: x / u, lift: zmax / (608 * u) };
}
async function turn(dir) {
  if (busy) return;
  if (shutBack) { if (dir < 0) return openBack(); return; }
  if (!open) return;
  const to = pos + dir;
  if (to < 0) return closeBook();
  if (to > lastPos()) { if (wide()) return closeBack(); return; }
  busy = true;
  const n = dir > 0 ? pos : to;                       // the leaf between position n and n + 1
  if (reduce.matches) { pos = to; show(); busy = false; return; }
  const L = buildLeaf(rightIdx(n), leftIdx(n + 1), leaf);
  poseLeaf(L, dir > 0 ? 0 : 1);
  if (dir > 0) setSlot(slotR, rightIdx(to), 'r'); else { if (leftIdx(to) >= 0) setSlot(slotL, leftIdx(to), 'l'); else slotL.replaceChildren(); leftBase(to); }
  await animate(1050, t => poseLeaf(L, dir > 0 ? t : 1 - t));
  pos = to; show(); leaf.replaceChildren(); cast.style.background = 'none'; busy = false;
}
// Going further than one page: the pages riffle past under the thumb, a handful of real leaves in quick
// succession, and the book lands open at the destination. One page away is an ordinary turn.
async function riffle(to) {
  const from = pos, dir = Math.sign(to - from), steps = Math.abs(to - from);
  if (!steps) return;
  if (steps === 1 || reduce.matches) { if (reduce.matches) { pos = to; show(); return; } return turn(dir); }
  busy = true;
  const m = Math.min(steps, 7), ns = [];
  for (let j = 0; j < m; j++) {
    const k = Math.round(j * (steps - 1) / (m - 1));
    ns.push(dir > 0 ? from + k : from - 1 - k);       // leaf between n and n + 1: forwards from the top of the right stack, backwards from the top of the left
  }
  const Ls = ns.map(n => { const pv = el('div', 'pivot'); three.insertBefore(pv, leaf); return buildLeaf(rightIdx(n), leftIdx(n + 1), pv, 18); });
  Ls.forEach(L => poseLeaf(L, dir > 0 ? 0 : 1, true));
  // underneath: the destination, on the side the leaves are leaving
  if (dir > 0) setSlot(slotR, rightIdx(to), 'r'); else { if (leftIdx(to) >= 0) setSlot(slotL, leftIdx(to), 'l'); else slotL.replaceChildren(); leftBase(to); }
  const ONE = 560, GAP = steps > 4 ? 85 : 110, T = ONE + (m - 1) * GAP;
  await animate(T, t => {
    let top = null;
    Ls.forEach((L, j) => {
      const q = clamp((t * T - j * GAP) / ONE, 0, 1);
      const r = poseLeaf(L, dir > 0 ? q : 1 - q, true);
      // on the side it leaves, the earlier leaf lies on top; on the side it lands, the later one does
      L.pivot.style.zIndex = q < 0.5 ? 100 - j : 200 + j;
      if (q > 0 && q < 1 && (!top || r.lift > top.lift)) top = r;
    });
    if (top) setCast(top.tip, top.lift * 0.8, 260); else cast.style.background = 'none';
  });
  Ls.forEach(L => L.pivot.remove());
  pos = to; show(); cast.style.background = 'none'; busy = false;
}
async function go(pageIdx) {
  if (busy) return;
  const to = posOf(pageIdx);
  if (shutBack) return openBack(to);
  if (!open || to === pos) return;
  await riffle(to);
}

// ---------- opening and closing at the front ----------
const cover = $('cover'), coverFront = $('coverFront'), shadow = $('shadow'), backB = $('back');
function poseCover(t) {
  const a = Math.PI * t; cover.style.transform = `rotateY(${(-180 * t).toFixed(3)}deg)`;
  $('coverBackShade').style.background = tint(lit(a, true) * 0.985);
  // the shadow on the desk follows the cover: under the right half until the cover stands upright, then out to where the cover reaches
  shadow.style.transformOrigin = '100% 50%';
  shadow.style.transform = `scaleX(${((618 + (t > 0.5 ? 643 * Math.abs(Math.cos(a)) : 0)) / 1258).toFixed(4)})`;
  document.body.classList.toggle('lidded', t < 0.5);
  $('spineHold').style.visibility = t < 0.5 ? 'visible' : 'hidden';   // the spine shows until the cover stands upright, then it is gone
  if (t < 0.5) setCast(636 * Math.cos(a), Math.sin(a) * 0.9, 210); else cast.style.background = 'none';
}
async function openBook() {
  if (busy || open || shutBack) return; busy = true;
  if (document.activeElement === $('pw')) { $('pw').blur(); await wait(380); }
  $('pass').classList.add('gone'); pos = 0; setSlot(slotR, rightIdx(0), 'r'); document.body.classList.remove('closed'); document.body.classList.add('opening');
  if (reduce.matches) { cover.hidden = true; $('spineHold').style.visibility = 'hidden'; document.body.classList.remove('lidded'); } else {
    coverFront.classList.add('off'); await wait(430);
    await animate(2100, t => poseCover(swing(t)));
    cover.hidden = true;
  }
  $('baseL').hidden = false; shadow.style.transform = 'none'; open = true; document.body.classList.remove('opening'); show(); busy = false;
}
async function closeBook() {
  if (busy || !open) return; busy = true; open = false; updateControls();
  cover.hidden = false; $('baseL').hidden = true; slotL.replaceChildren(); document.body.classList.add('opening');
  if (!reduce.matches) { poseCover(1); await animate(1800, t => poseCover(1 - swing(t))); }
  poseCover(0); cast.style.background = 'none'; slotR.replaceChildren(); document.body.classList.add('closed'); document.body.classList.remove('opening'); coverFront.classList.remove('off'); busy = false;
  updateControls();
}

// ---------- closing at the back (wide screens) ----------
// The back board lies under the last right-hand page. Closing lifts it over the pages on the left, so the book
// ends up lying where its left half was, showing the back cover. The spine stays where it is.
function poseBack(t) {
  const a = Math.PI * t; backB.style.transform = `rotateY(${(-180 * t).toFixed(3)}deg)`;
  $('backInShade').style.background = tint(lit(a, false));
  $('backOutShade').style.background = tint(lit(a, true) * 0.985);
  shadow.style.transformOrigin = '0% 50%';
  shadow.style.transform = `scaleX(${((622 + (t < 0.5 ? 643 * Math.abs(Math.cos(a)) : 0)) / 1258).toFixed(4)})`;
  document.body.classList.toggle('backlid', t > 0.5);
  $('spineHoldBack').style.visibility = t > 0.5 ? 'visible' : 'hidden';
  if (t > 0.5) setCast(-636 * Math.cos(Math.PI - a), Math.sin(a) * 0.9, 210); else cast.style.background = 'none';
}
async function closeBack() {
  if (busy || !open) return; busy = true; open = false; updateControls();
  backB.hidden = false; poseBack(0); document.body.classList.add('backshut');
  if (!reduce.matches) await animate(2100, t => poseBack(swing(t)));
  poseBack(1); cast.style.background = 'none'; shutBack = true; busy = false; updateControls();
}
async function openBack(to) {
  if (busy || !shutBack) return; busy = true; shutBack = false;
  const onward = to != null && to < lastPos();
  if (!reduce.matches) { poseBack(1); await animate(onward ? 1300 : 1800, t => poseBack(1 - swing(t))); }
  poseBack(0); backB.hidden = true; document.body.classList.remove('backshut', 'backlid'); $('spineHoldBack').style.visibility = 'hidden';
  shadow.style.transform = 'none'; cast.style.background = 'none'; open = true; pos = lastPos(); show(); busy = false;
  if (onward) await riffle(to);                         // straight on, without stopping on the last page
}
poseCover(0);

// ---------- unlocking ----------
// The password is stretched into a key; the key (never the password) is remembered in this browser, so the book
// asks only once per browser, until its stored data is cleared or the password changes
const KEEP = 'familienrezepte.key';
const raw = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const store = { get() { try { return localStorage.getItem(KEEP); } catch (e) { return null; } }, set(v) { try { v ? localStorage.setItem(KEEP, v) : localStorage.removeItem(KEEP); } catch (e) {} } };
let KEY = null;
async function fetchSealed(name) {
  const r = await fetch(`${name}?v=${V[name] || ''}`); if (!r.ok) throw new Error(name);
  const buf = new Uint8Array(await r.arrayBuffer());
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, KEY, buf.slice(12));
  const text = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return JSON.parse(text);
}
async function useKey(bits) {
  KEY = await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['decrypt']);
  D = await fetchSealed('data/core.json'.replace('.json', '.bin'));
  await Promise.race([document.fonts.ready, wait(1500)]);
  fitAll(); buildPages(); loadIllustrations();
}
async function unlock(pw) {
  if (D) return true;
  try {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: raw(CRYPT.salt), iterations: CRYPT.iter, hash: 'SHA-256' }, base, 256));
    await useKey(bits); store.set(btoa(String.fromCharCode(...bits))); return true;
  } catch (e) { D = null; KEY = null; return false; }
}
// Illustrations arrive page by page, nearest to the open page first, and fill in when they land
let illLoading = false;
async function loadIllustrations() {
  if (illLoading) return; illLoading = true;
  const here = () => Math.max(1, rightIdx(pos));
  const todo = ILL.slice();
  while (todo.length) {
    todo.sort((a, b) => Math.abs(a - here()) - Math.abs(b - here()));
    const n = todo.shift();
    try { ILLD[n] = await fetchSealed(`data/ill-${String(n).padStart(2, '0')}.bin`); } catch (e) { continue; }
    const box = measureBox(); fitOne(D.recipes[n - 1], box, px()); box.remove();
    if (visible(n) && !busy) show();
  }
}
let unlocking = false, passDone = false;
async function tryOpen() {
  if (unlocking || open || busy) return;
  if (shutBack) return openBack();
  if (D && passDone) return openBook();
  if (!D && !$('pw').value) { $('pw').focus(); return; }
  unlocking = true; $('passMsg').textContent = ''; $('pass').classList.add('busy');
  const ok = await unlock($('pw').value); $('pass').classList.remove('busy');
  if (ok && !passDone) {
    $('pw').blur(); $('pass').classList.add('ok'); await wait(reduce.matches ? 500 : 900);
    $('pass').classList.add('gone'); await wait(reduce.matches ? 0 : 380); passDone = true; $('pass').hidden = true; $('pw').value = '';
  }
  unlocking = false;
  if (ok) openBook(); else { $('passMsg').textContent = T[lang].wrong; $('pw').select(); }
}
$('passGo').addEventListener('click', tryOpen);
$('pw').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); tryOpen(); } });
// a browser that has opened the book before goes straight in: no password field, the closed book waits for a click
(async () => {
  const k = store.get(); if (!k || !window.crypto || !crypto.subtle) return;
  $('pass').classList.add('gone');
  try { await useKey(raw(k)); passDone = true; $('pass').hidden = true; }
  catch (e) { D = null; KEY = null; store.set(null); $('pass').classList.remove('gone'); }
  updateControls();
})();

// ---------- controls ----------
$('next').onclick = () => turn(1); $('prev').onclick = () => turn(-1); $('home').onclick = () => go(0);
$('year').textContent = new Date().getFullYear();   // the year in the footer keeps itself current
const goRecipe = n => go(Number(n));
function hit(e, side) {
  if (!open) return tryOpen();
  if (wide()) return turn(side === 'r' ? 1 : -1);
  const r = $('hitR').getBoundingClientRect(); turn((e.clientX - r.left) / r.width < 0.26 ? -1 : 1);
}
$('hitR').onclick = e => hit(e, 'r'); $('hitL').onclick = e => hit(e, 'l');
coverFront.style.pointerEvents = 'none';
// entries in the contents sit under the tap area: pass the tap through to them
for (const h of [$('hitL'), $('hitR')]) h.addEventListener('click', e => {
  h.style.pointerEvents = 'none'; const under = document.elementFromPoint(e.clientX, e.clientY); h.style.pointerEvents = '';
  const a = under && under.closest('a[data-go]'); if (a && open) { e.stopImmediatePropagation(); goRecipe(a.dataset.go); }
}, true);
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { open ? turn(1) : tryOpen(); e.preventDefault(); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { turn(-1); e.preventDefault(); }
  else if (e.key === 'Home') go(0);
});
let sx = null, sy = 0;
$('book').addEventListener('touchstart', e => { if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } else sx = null; }, { passive: true });
$('book').addEventListener('touchend', e => {
  if (sx == null) return; const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
  if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.4) { e.preventDefault(); if (!open && !shutBack) { if (dx < 0) tryOpen(); } else turn(dx < 0 ? 1 : -1); }
});
function setLang(l) {
  lang = l; root.lang = l; $('lang').setAttribute('aria-checked', String(l === 'en'));
  $('lblDE').classList.toggle('is-on', l === 'de'); $('lblEN').classList.toggle('is-on', l === 'en');
  if (open) show(); else updateControls();
}
$('lang').onclick = () => setLang(lang === 'de' ? 'en' : 'de'); $('lblDE').onclick = () => setLang('de'); $('lblEN').onclick = () => setLang('en');
// turning the phone or resizing the window: lay the pages out again for the new shape, on the same page
tall.addEventListener('change', async () => {
  while (busy) await wait(100);
  if (!D) return;
  if (shutBack && !wide()) { shutBack = false; backB.hidden = true; document.body.classList.remove('backshut', 'backlid'); $('spineHoldBack').style.visibility = 'hidden'; shadow.style.transform = 'none'; open = true; }
  const page = open ? Math.max(rightIdx(pos), 0) : 0; fitAll(); buildPages(); pos = Math.min(posOf(page), lastPos()); if (open) show();
});
updateControls();
// for checking the book in a test browser
window.__book = { riffle, forget: () => store.set(null), unlock, tryOpen, data: () => D, ill: () => ILLD, fit, setLang, recipePage, openBook, closeBook, closeBack, openBack, turn, go, poseLeaf, buildLeaf, poseCover, poseBack, setSlot, rightIdx, leftIdx, coverFront, state: () => ({ pos, open, busy, shutBack, last: lastPos() }) };
