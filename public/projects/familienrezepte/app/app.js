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
// every notebook picture is fetched and decoded up front and kept, so the first turn or opening never waits for one
const KEEP_IMG = Object.values(A).map(src => { const i = new Image(); i.src = src; if (i.decode) i.decode().catch(() => {}); return i; });
const frames = n => new Promise(r => { const f = k => k ? requestAnimationFrame(() => f(k - 1)) : r(); f(n); });
// before anything moves: the pictures in what is about to be shown are decoded, and the browser has painted it
async function ready(nodes, cap = 400) {
  const imgs = nodes.filter(Boolean).flatMap(n => [...n.querySelectorAll('img')]);
  await Promise.race([Promise.all(imgs.map(i => (i.decode ? i.decode() : Promise.resolve()).catch(() => {}))), new Promise(r => setTimeout(r, cap))]);
  await frames(2);
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
      const it = il.items[p.i], img = el('img', 'illus'); img.src = it.url; img.alt = '';
      img.style.left = U(p.x); img.style.top = U(p.y); img.style.width = U(it.w * p.k); img.style.height = U(it.h * p.k);
      if (p.r) img.style.transform = `rotate(${p.r}deg)`;
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
// Florian's layout for each page (from his annotated sheets and his review, 17 November): for each picture, by
// its number on the page, where it goes and how large. 'b' = below the text, composed in the order given and
// centred together; 's' = beside the ingredient list, stacked from the top in the order given; 'sr' = beside the
// ingredients as one small row; 'c' / 'cl' = the open corner at the bottom right / left, for pages whose text
// runs nearly to the foot; 'hl' = a small accent in the top left corner, by the title.
// Scale is relative to the picture's usual size. Optional fine-tuning: dy / dx (nudge
// down / right), snug (beside: as close to the text as it fits instead of centred in the gap), top (beside:
// may start this high, e.g. next to the title), rot (degrees clockwise), gap (extra space before it in a row),
// min (smallest scale it may shrink to), down (beside: lowered this much once placed), bx / by (below: the
// whole group shifted right / down), rise (below: may rise beside the last
// short lines when the space is tight). Pages not listed are laid out automatically.
const LAYOUT = {
  1: [[1, 'b', 0.8], [2, 'b', 1]],
  2: [[1, 'b', 0.9], [2, 'b', 1.3]],
  3: [[3, 's', 1], [1, 's', 1.12, { down: 15 }], [2, 'b', 0.97, { rise: 1 }]],
  4: [[2, 's', 1, { dy: 115, snug: 1 }], [3, 'b', 1.25], [1, 'b', 1.25]],
  5: [[3, 'b', 1, 26], [2, 'b', 1], [1, 's', 1], [4, 's', 1]],
  7: [[1, 's', 0.9, { top: 145 }], [2, 's', 0.9], [3, 's', 1]],
  8: [[3, 'b', 0.8], [2, 'b', 1.12], [1, 's', 0.8]],
  9: [[1, 'b', 1], [2, 'b', 0.8]],
  10: [[2, 'b', 1], [3, 's', 1], [1, 's', 1]],
  11: [[1, 's', 1, { dy: 150, snug: 1, dx: 25 }]],
  12: [[1, 'b', 1], [2, 's', 1, { dy: 18, dx: -25 }]],
  13: [[2, 'b', 1], [1, 'b', 0.8]],
  14: [[3, 'b', 1], [2, 's', 1], [1, 's', 1]],
  15: [[1, 'b', 1], [2, 's', 1.5, { dy: 6, snug: 1, dx: 15 }]],
  16: [[3, 's', 1.3], [1, 's', 1], [2, 'b', 1]],
  17: [[1, 's', 1.12], [3, 'b', 1.7], [2, 'b', 1, { gap: 22 }]],
  19: [[1, 'b', 1], [2, 's', 1.1, { down: 15 }]],
  20: [[2, 'b', 1], [1, 's', 1], [3, 's', 1.15, { down: 18 }]],
  21: [[2, 's', 1.15], [1, 'b', 1]],
  22: [[2, 's', 1.2], [4, 'c', 1, 20], [1, 'c', 1], [3, 'cl', 1, { rot: 220 }]],
  23: [[3, 's', 1.3], [2, 'b', 1.22, { rot: -45 }], [1, 'b', 1]],
  24: [[1, 's', 1], [3, 'b', 1], [2, 'b', 1, { gap: 40 }]],
  25: [[2, 'hl', 0.72], [1, 's', 1.15, { min: 0.95 }], [3, 's', 0.72, { dx: 20 }]],
  27: [[3, 'b', 1], [2, 'sr', 1], [1, 'sr', 0.88, { dy: 14 }]],
  28: [[2, 'b', 1], [3, 's', 1.15], [1, 's', 1, { dx: -35 }]],
  29: [[1, 'b', 1], [2, 's', 1.3]],
  32: [[3, 'b', 1], [2, 'b', 1], [1, 's', 1]],
  33: [[2, 'b', 1], [1, 'b', 1], [3, 's', 1, { top: 120, snug: 1, min: 0.55 }]],
};
function place(r, rects) {
  // Each page is composed around Lena's main dish. Below the text it stands in the middle of the free space with
  // its companions beside it on one line, smaller, with air around them. Pictures meant for the side sit in the
  // open space beside the ingredients, centred in that gap. Nothing ever touches the text: if a picture does not
  // fit where it is meant to go, it is made a little smaller, and only then moves to the other place.
  const il = ILLD[r.no]; if (!il || !il.items.length) return null;
  const cols = Math.ceil((X1 - X0) / GRID), rows = Math.ceil(Y1 / GRID);
  const occ = new Uint8Array(cols * rows);
  const mark = (x0, y0, x1, y1, pad) => {
    const a = Math.max(0, Math.floor((x0 - pad - X0) / GRID)), b = Math.min(cols - 1, Math.floor((x1 + pad - X0) / GRID));
    const c = Math.max(0, Math.floor((y0 - pad) / GRID)), d = Math.min(rows - 1, Math.floor((y1 + pad) / GRID));
    for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) occ[y * cols + x] = 1;
  };
  let textBottom = 0;
  for (const q of rects) { mark(q[0], q[1], q[2], q[3], 10); if (q[3] < Y1) textBottom = Math.max(textBottom, q[3]); }
  const free = (x0, y0, w, h) => {
    if (x0 < X0 || y0 < 0 || x0 + w > X1 || y0 + h > Y1) return false;
    const a = Math.floor((x0 - X0) / GRID), b = Math.ceil((x0 + w - X0) / GRID) - 1, c = Math.floor(y0 / GRID), d = Math.ceil((y0 + h) / GRID) - 1;
    for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) if (occ[y * cols + x]) return false;
    return true;
  };
  const items = il.items.map((it, i) => ({ i, ...it, scale: 1, dy: 0, o: {} }));
  const dims = (it, f) => {
    const k = it.size * it.scale * f / Math.max(it.w, it.h), w = it.w * k, h = it.h * k, a = (it.o.rot || 0) * Math.PI / 180;
    if (!a) return { w, h, k, iw: w, ih: h };
    const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));   // a turned picture takes the box around it
    return { w: w * c + h * s, h: w * s + h * c, k, iw: w, ih: h };
  };
  const out = [];
  const commit = (it, d, x, y) => { out.push({ i: it.i, x: x + (d.w - d.iw) / 2, y: y + (d.h - d.ih) / 2, k: d.k, r: it.o.rot || 0 }); mark(x, y, x + d.w, y + d.h, 16); };
  const GAP = 26;
  // the still life below the text: in the order given, centred, resting on a common line
  const compose = (f, list) => {
    let x = 0; const parts = [];
    const H = Math.max(...list.map(it => dims(it, f).h)), base = H * 0.95;
    list.forEach((it, n) => { const d = dims(it, f); if (n) x += it.o.gap || 0; parts.push({ it, d, x, y: Math.max(0, base - d.h) + it.dy }); x += d.w + GAP; });
    const minY = Math.min(...parts.map(p => p.y)), maxY = Math.max(...parts.map(p => p.y + p.d.h));
    parts.forEach(p => { p.y -= minY; });
    return { parts, w: x - GAP, h: maxY - minY };
  };
  const bandTop = textBottom + 34, bandH = Y1 - bandTop;
  const inBand = C => {
    if (C.w > X1 - X0 - 20 || C.h > bandH) return null;
    const sh = (C.parts.find(p => p.it.o.bx || p.it.o.by) || { it: { o: {} } }).it.o;
    const cx = 252.5 - C.w / 2 + (sh.bx || 0);
    const yIdeal = bandTop + (bandH - C.h) * 0.45 + (sh.by || 0);    // optically centred, a touch above the middle
    for (const dy of [0, -12, 12, -25, 25, -40, 40]) for (const dx of [0, -15, 15, -30, 30, -50, 50]) {
      const x = cx + dx, y = clamp(yIdeal + dy, bandTop, Y1 - C.h);
      if (C.parts.every(p => free(x + p.x, y + p.y, p.d.w, p.d.h))) return { x, y };
    }
    return null;
  };
  // a group too tall for the space below the text may rise beside its last short lines, resting at the foot and
  // as near the middle as the text allows
  const rise = C => {
    const y = Y1 - C.h - 12;
    for (let n = 0; n < 60; n++) for (const s of [-1, 1]) {
      const x = 252.5 - C.w / 2 + s * n * GRID;
      if (C.parts.every(p => free(x + p.x, y + p.y, p.d.w, p.d.h))) return { x, y };
    }
    return null;
  };
  const below = (list, fs) => {
    if (!list.length) return true;
    if (list.some(it => it.o.rise)) for (const f of fs) { const C = compose(f, list); if (C.h <= bandH) break; const at = rise(C); if (at) { C.parts.forEach(p => commit(p.it, p.d, at.x + p.x, at.y + p.y)); return true; } }
    for (const f of fs) { const C = compose(f, list), at = inBand(C); if (at) { C.parts.forEach(p => commit(p.it, p.d, at.x + p.x, at.y + p.y)); return true; } }
    return false;
  };
  // beside the ingredients: the highest open spot below the title, centred in the gap between text and page edge
  const beside = (it, fs, yMin = 170) => {
    const group = Array.isArray(it) ? it : [it], lead = group[0], o = lead.o;
    if (o.min) fs = fs.filter(f => f >= o.min).concat(fs.some(f => f < o.min) ? [o.min] : []);
    if (o.top != null) yMin = o.top;
    for (const f of fs) {
      const C = compose(f, group), d = { w: C.w, h: C.h };
      for (let y = yMin + lead.dy; y + d.h <= Y1; y += GRID) {
        let x1 = X1; while (x1 - d.w >= X0 && !free(x1 - d.w, y, d.w, d.h)) x1 -= GRID;
        if (x1 - d.w < X0) continue;
        let x0 = x1 - d.w; while (x0 - GRID >= X0 && free(x0 - GRID, y, x1 - x0 + GRID, d.h)) x0 -= GRID;
        if (x1 < X1 - 40) continue;                                      // only the open space at the right, not a hole in the text
        let x = o.snug ? x0 + 4 : Math.max(x0 + (x1 - x0 - d.w) / 2, x1 - d.w - 60);
        if (o.dx) { const nx = clamp(x + o.dx, x0, x1 - d.w); x = nx; }
        if (!C.parts.every(p => free(x + p.x, y + p.y, p.d.w, p.d.h))) x = x1 - d.w;
        if (o.down) for (let k = o.down; k > 0; k -= GRID) if (y + k + d.h <= Y1 && C.parts.every(p => free(x + p.x, y + k + p.y, p.d.w, p.d.h))) { y += k; break; }
        C.parts.forEach(p => commit(p.it, p.d, x + p.x, y + p.y)); return true;
      }
    }
    return false;
  };
  // the open corner at the foot of the page: the group rests as low and as far right as it fits
  const corner = (list, fs, left) => {
    for (const f of fs) {
      const C = compose(f, list);
      for (let y = Y1 - C.h; y >= textBottom * 0.55; y -= GRID) for (let n = 0, x; (x = left ? X0 + 30 + n * GRID : X1 - C.w - 10 - n * GRID) >= X0 && x + C.w <= X1; n++)
        if (C.parts.every(p => free(x + p.x, y + p.y, p.d.w, p.d.h))) { C.parts.forEach(p => commit(p.it, p.d, x + p.x, y + p.y)); return true; }
    }
    return false;
  };
  const spec = LAYOUT[r.no];
  if (spec) {
    const b = [], s = [], c = [], cl = [], row = [], hl = [];
    for (const [n, zone, sc, opt] of spec) {
      const it = items[n - 1]; if (!it) continue;
      it.scale = sc; it.o = typeof opt === 'object' ? opt : {}; it.dy = typeof opt === 'number' ? opt : (it.o.dy || 0);
      ({ b, s, c, cl, hl, sr: row })[zone].push(it);
    }
    const CF = [1, 0.9, 0.8, 0.72, 0.64, 0.56];
    for (const it of hl) {                                               // a small accent in the top left corner, by the title
      let done = false;
      for (const f of [1, 0.88, 0.76]) { const d = dims(it, f);
        for (let y = 8; y < 120 && !done; y += GRID) for (let x = X0 + 30; x < 120 && !done; x += GRID) if (free(x, y, d.w, d.h)) { commit(it, d, x, y); done = true; }
        if (done) break; }
      if (!done) s.push(it);
    }
    if (c.length && !corner(c, CF)) b.push(...c);
    if (cl.length && !corner(cl, CF, true)) b.push(...cl);
    const spare = [];
    if (row.length && !beside(row, [1, 0.9, 0.8, 0.72])) spare.push(...row);
    for (const it of s) if (!beside(it, [1, 0.88, 0.76])) spare.push(it);
    if (!below([...b, ...spare], [1, 0.9, 0.8, 0.72, 0.64]) && !corner([...b, ...spare], [0.9, 0.8, 0.72, 0.64])) {
      // not everything fits below: the largest stays, the rest tries the side
      const all = [...b, ...spare].sort((p, q) => q.size * q.scale - p.size * p.scale);
      for (let keep = all.length - 1; keep >= 1; keep--) {
        const kept = [...b, ...spare].filter(it => all.slice(0, keep).includes(it));
        if (below(kept, [1, 0.88, 0.76, 0.66])) { for (const it of all.slice(keep)) beside(it, [0.9, 0.76, 0.6]); return out; }
      }
      for (const it of all) beside(it, [0.85, 0.7, 0.58, 0.48]) || corner([it], [0.7, 0.6, 0.5, 0.42]) || beside(it, [0.4, 0.34], 0);
    }
    return out;
  }
  // automatic: the dish with its companions below; what does not fit goes beside the ingredients
  const hero = items.find(it => it.role === 'hero') || items[0];
  const rest = items.filter(it => it !== hero).sort((p, q) => q.size - p.size);
  for (const f of [1, 0.9, 0.8, 0.72]) {
    const list = [...rest.filter((_, n) => n % 2 === 1).reverse(), hero, ...rest.filter((_, n) => n % 2 === 0)];
    const C = compose(f, list), at = inBand(C);
    if (at) { C.parts.forEach(p => commit(p.it, p.d, at.x + p.x, at.y + p.y)); return out; }
  }
  for (let keep = rest.length - 1; keep >= 0; keep--) {
    const kept = rest.slice(0, keep), list = [...kept.filter((_, n) => n % 2 === 1).reverse(), hero, ...kept.filter((_, n) => n % 2 === 0)];
    if (below(list, [1, 0.88, 0.76, 0.66])) { for (const it of rest.slice(keep)) beside(it, [0.9, 0.76, 0.62]); return out; }
  }
  if (!beside(hero, [0.85, 0.72, 0.6, 0.48]) && !corner([hero], [0.7, 0.6, 0.5, 0.42])) beside(hero, [0.4, 0.34], 0);
  for (const it of rest) beside(it, [0.8, 0.68, 0.56]);
  return out;
}
function fitOne(r, box, u) {
  r._v = (r._v || 0) + 1;
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
function buildPages() { layoutVer++; pages = [tocPage(), ...D.recipes.map(r => recipePage(r)), insideBack]; }
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
// A page that is already showing is not built again (rebuilding it would flicker its pictures for a frame)
let layoutVer = 0;
const slotKey = (i, side) => `${i}|${side}|${lang}|${layoutVer}|${tall.matches}|${(D && D.recipes[i - 1] && D.recipes[i - 1]._v) || 0}`;
function setSlot(slot, i, side) {
  const key = slotKey(i, side); if (slot._key === key && slot.firstChild) return;
  slot._key = key; slot.replaceChildren(); if (i >= 0 || side === 'r') slot.appendChild(make(i, side));
}
function clearSlot(slot) { slot._key = null; slot.replaceChildren(); }
// When a page's illustrations arrive while it is open: the new page is built and its pictures decoded first,
// then swapped in whole, so nothing blinks
async function showSmooth() {
  const jobs = [[slotR, rightIdx(pos), 'r'], [slotL, leftIdx(pos), 'l']].filter(([s, i, side]) => i >= 0 || side === 'r')
    .map(([s, i, side]) => [s, slotKey(i, side), make(i, side)]).filter(([s, key]) => s._key !== key);
  if (!jobs.length) return;
  const imgs = jobs.flatMap(([, , node]) => [...node.querySelectorAll('img')]);
  await Promise.race([Promise.all(imgs.map(im => (im.decode ? im.decode() : Promise.resolve()).catch(() => {}))), wait(500)]);
  if (busy || !open) return;                          // something moved in the meantime; the next show() builds it
  for (const [s, key, node] of jobs) { s._key = key; s.replaceChildren(node); }
}
function leftBase(n) { $('baseL').src = n === 0 ? A.endL : A.pageL; }   // inside cover first, ruled paper after that
function show() {
  setSlot(slotR, rightIdx(pos), 'r');
  if (leftIdx(pos) >= 0) setSlot(slotL, leftIdx(pos), 'l'); else clearSlot(slotL);
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
const N = 40;
const three = document.querySelector('.three');
function buildLeaf(frontIdx, backIdx, pivot, n) {
  n = n || N; const sw = 608 / n;
  pivot.replaceChildren(); const u = px(); const fr = [], bk = [];
  const front = make(frontIdx, 'r'), back = make(backIdx, 'l');
  for (let i = 0; i < n; i++) {
    for (const [arr, src, off] of [[fr, front, -i * sw], [bk, back, -(n - 1 - i) * sw]]) {
      const s = el('div', 'strip'); s.style.width = (sw * u + 1.2) + 'px';
      const c = src.cloneNode(true); c.style.left = (off * u) + 'px'; s.appendChild(c);
      const sh = el('div', 'shade'); s.appendChild(sh); s._sh = sh; pivot.appendChild(s); arr.push(s);
    }
  }
  return { fr, bk, u, n, pivot };
}
// The sheet bends: the free edge leads, the part by the fold follows, and it lands with a soft bulge that flattens
// In perspective, the part of a page that lifts towards the eye grows taller than the book. A real page does not
// change height, so each strip is shortened by exactly as much as its height in the air would enlarge it, about the
// point the perspective is centred on: the turning page keeps the book's height all the way over.
const PERSP = 6000, PERSP_Y = 0.46 * 1006 - 3;       // as in .three (perspective, perspective-origin), in book units
function poseLeaf(L, p, noCast) {
  const { fr, bk, u, n } = L; const w = 608 / n * u, P = PERSP * u, OY = (PERSP_Y * u).toFixed(2);
  const tip = Math.PI * ease(clamp(p / 0.86, 0, 1)), sp = Math.PI * ease(clamp((p - 0.14) / 0.86, 0, 1));
  let x = 0, z = 0, zmax = 0; const th = [];
  for (let i = 0; i <= n; i++) th.push(sp + (tip - sp) * Math.pow(i / n, 1.35));
  for (let i = 0; i < n; i++) {
    const a = (th[i] + th[i + 1]) / 2, deg = (-a * 180 / Math.PI).toFixed(3);
    const k = ((P - (z + w / 2 * Math.sin(a))) / P).toFixed(5);
    const base = `translate3d(${x.toFixed(2)}px,0,${z.toFixed(2)}px) translateY(${OY}px) scaleY(${k}) translateY(-${OY}px) rotateY(${deg}deg)`;
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
  await pagesReady([rightIdx(to), leftIdx(to), rightIdx(Math.min(pos, to)), leftIdx(Math.max(pos, to))], 700);
  const n = dir > 0 ? pos : to;                       // the leaf between position n and n + 1
  if (reduce.matches) { pos = to; show(); busy = false; return; }
  const L = buildLeaf(rightIdx(n), leftIdx(n + 1), leaf);
  poseLeaf(L, dir > 0 ? 0 : 1);
  await ready([leaf]);                                // the leaf lies exactly over the page it lifts: nothing changes yet
  if (dir > 0) setSlot(slotR, rightIdx(to), 'r'); else { if (leftIdx(to) >= 0) setSlot(slotL, leftIdx(to), 'l'); else clearSlot(slotL); leftBase(to); }
  await ready([dir > 0 ? slotR : slotL], 250);
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
  const Ls = ns.map(n => { const pv = el('div', 'pivot'); three.insertBefore(pv, leaf); return buildLeaf(rightIdx(n), leftIdx(n + 1), pv, 24); });
  Ls.forEach((L, j) => { poseLeaf(L, dir > 0 ? 0 : 1, true); L.pivot.style.zIndex = 100 - j; });   // the first to go lies on top
  await ready(Ls.map(L => L.pivot), 600);
  // underneath: the destination, on the side the leaves are leaving
  if (dir > 0) setSlot(slotR, rightIdx(to), 'r'); else { if (leftIdx(to) >= 0) setSlot(slotL, leftIdx(to), 'l'); else clearSlot(slotL); leftBase(to); }
  await ready([dir > 0 ? slotR : slotL], 250);
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
  busy = true; await pagesReady([rightIdx(to), leftIdx(to)], 1500); busy = false;
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
  $('pass').classList.add('gone'); pos = 0; setSlot(slotR, rightIdx(0), 'r'); await ready([slotR]); document.body.classList.remove('closed'); document.body.classList.add('opening');
  if (reduce.matches) { cover.hidden = true; $('spineHold').style.visibility = 'hidden'; document.body.classList.remove('lidded'); } else {
    coverFront.classList.add('off'); await wait(430);
    await animate(2100, t => poseCover(swing(t)));
    cover.hidden = true;
  }
  $('baseL').hidden = false; shadow.style.transform = 'none'; open = true; document.body.classList.remove('opening'); show(); busy = false;
}
async function closeBook() {
  if (busy || !open) return; busy = true; open = false; updateControls();
  cover.hidden = false; $('baseL').hidden = true; clearSlot(slotL); document.body.classList.add('opening');
  if (!reduce.matches) { poseCover(1); await animate(1800, t => poseCover(1 - swing(t))); }
  poseCover(0); cast.style.background = 'none'; clearSlot(slotR); document.body.classList.add('closed'); document.body.classList.remove('opening'); coverFront.classList.remove('off'); busy = false;
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
// A page of illustrations: a small index, then the pictures themselves
async function fetchPictures(name) {
  const r = await fetch(`${name}?v=${V[name] || ''}`); if (!r.ok) throw new Error(name);
  const buf = new Uint8Array(await r.arrayBuffer());
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, KEY, buf.slice(12)));
  const n = new DataView(plain.buffer).getUint32(0);
  const idx = JSON.parse(new TextDecoder().decode(plain.subarray(4, 4 + n)));
  let at = 4 + n;
  for (const it of idx.items) { it.url = URL.createObjectURL(new Blob([plain.subarray(at, at + it.len)], { type: 'image/webp' })); at += it.len; }
  await Promise.all(idx.items.map(it => new Promise(res => { const im = new Image(); im.onload = im.onerror = res; im.src = it.url; })));
  return idx;
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
const illP = {};
// one page's illustrations: fetched once; when they land the page is laid out again and, if open, swapped in
function ensureIll(n) {
  if (!D || !ILL.includes(n)) return Promise.resolve();
  return illP[n] || (illP[n] = fetchPictures(`data/ill-${String(n).padStart(2, '0')}.bin`).then(d => {
    ILLD[n] = d; const box = measureBox(); fitOne(D.recipes[n - 1], box, px()); box.remove();
    if (visible(n) && !busy) return showSmooth();
  }).catch(() => {}));
}
// before moving to a page: its illustrations are there (or a moment has passed), so it never lands without them
const pagesReady = (idxs, cap) => Promise.race([Promise.all(idxs.map(ensureIll)), wait(cap)]);
async function loadIllustrations() {
  if (illLoading) return; illLoading = true;
  const here = () => Math.max(1, rightIdx(pos));
  const todo = ILL.slice();
  while (todo.length) {
    todo.sort((a, b) => Math.abs(a - here()) - Math.abs(b - here()));
    await ensureIll(todo.shift());
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
  try { await useKey(raw(k)); passDone = true; $('pass').hidden = true; resume(); }
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
// ---------- pulling down to reload (phones) ----------
// The page itself does not scroll, so the browser's own pull-to-refresh never starts, and a home-screen app has
// none. A downward drag from anywhere draws a small reload sign from the top; let go past the mark and the app
// reloads, opening again on the same page and language.
const RESUME = 'familienrezepte.resume';
const ptr = el('div', 'ptr'); ptr.setAttribute('aria-hidden', 'true');
ptr.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
document.body.appendChild(ptr);
let px0 = null, py0 = 0, pull = 0, pulling = false;
const PULL = 90;
addEventListener('touchstart', e => {
  if (e.touches.length !== 1 || busy || e.target.closest('input, a, button')) { px0 = null; return; }
  px0 = e.touches[0].clientX; py0 = e.touches[0].clientY; pull = 0; pulling = false; ptr.classList.remove('settle');
}, { passive: true });
addEventListener('touchmove', e => {
  if (px0 == null) return;
  const dx = e.touches[0].clientX - px0, dy = e.touches[0].clientY - py0;
  if (!pulling) { if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) { px0 = null; return; } if (dy < 14 || dy < Math.abs(dx) * 1.5) return; pulling = true; }
  pull = Math.max(0, dy - 14);
  const d = Math.min(pull, PULL * 1.6) * 0.6;          // the sign follows the finger, with some resistance
  ptr.style.opacity = Math.min(1, pull / (PULL * 0.6)).toFixed(2);
  ptr.style.transform = `translateY(${(d - 48 + 12).toFixed(1)}px) rotate(${(pull * 2.4).toFixed(0)}deg)`;
  ptr.classList.toggle('ready', pull >= PULL);
}, { passive: true });
addEventListener('touchend', () => {
  if (px0 == null) return; px0 = null;
  if (!pulling) return; pulling = false;
  ptr.classList.add('settle');
  if (pull >= PULL) {
    ptr.style.transform = 'translateY(28px)'; ptr.classList.add('spin');
    try { sessionStorage.setItem(RESUME, JSON.stringify({ open, page: open ? Math.max(rightIdx(pos), 0) : -1, lang })); } catch (e) {}
    setTimeout(() => location.reload(), 250);
  } else { ptr.style.transform = 'translateY(-48px)'; ptr.style.opacity = '0'; }
}, { passive: true });
// after such a reload: straight back to the page that was open, without the cover opening again
function resume() {
  let r = null; try { r = JSON.parse(sessionStorage.getItem(RESUME)); sessionStorage.removeItem(RESUME); } catch (e) {}
  if (!r) return;
  if (r.lang && r.lang !== lang) setLang(r.lang);
  if (!r.open || !D || open || busy) return;
  document.body.classList.remove('closed', 'lidded'); $('pass').classList.add('gone');
  cover.hidden = true; $('spineHold').style.visibility = 'hidden'; $('baseL').hidden = false; shadow.style.transform = 'none'; cast.style.background = 'none';
  open = true; pos = Math.min(posOf(r.page), lastPos()); show(); updateControls();
}

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
