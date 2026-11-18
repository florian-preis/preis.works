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
$('baseR').src = A.pageR; $('baseL').src = A.pageL; $('baseLE').src = A.endL; $('imgCover').src = A.cover; $('imgLabel').src = A.label; $('imgElastic').src = A.elastic; $('imgEnd').src = A.endL;
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
// A recipe that would run past the foot of the page gets its ingredients in two columns; so does a recipe listed
// in TWO, on every screen, to leave room for its pictures below the text
const LINES = 26, TWO = new Set([25]), fit = {};
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
const TOPM = 44, EDGEM = 14;            // a picture squeezed into the top corner keeps this far from the top edge, and this much further from the right
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
// short lines when the space is tight), stay (below: keeps its place below when the others have to move to the
// side). For 'hl', dy / dx move the accent away from the top / left edge. Pages not listed are laid out automatically.
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
  17: [[1, 's', 1.12], [3, 'b', 1.7, { stay: 1 }], [2, 'b', 1, { gap: 22 }]],
  19: [[1, 'b', 1], [2, 's', 1.1, { down: 15 }]],
  20: [[2, 'b', 1], [1, 's', 1], [3, 's', 1.15, { down: 18 }]],
  21: [[2, 's', 1.15], [1, 'b', 1]],
  22: [[2, 's', 1.2], [4, 'c', 1, 20], [1, 'c', 1], [3, 'cl', 1, { rot: 220 }]],
  23: [[3, 's', 1.3], [2, 'b', 1.22, { rot: -45 }], [1, 'b', 1]],
  24: [[1, 's', 1], [3, 'b', 1], [2, 'b', 1, { gap: 40 }]],
  25: [[2, 'hl', 0.72, { dy: 22 }], [3, 's', 0.72, { dx: 20 }], [1, 'b', 1]],
  27: [[3, 'b', 1], [2, 'sr', 0.8], [1, 'sr', 0.88, { dy: 14 }]],
  28: [[2, 'b', 1], [3, 's', 1.15], [1, 's', 1, { dx: -35 }]],
  29: [[1, 'b', 1], [2, 's', 1.3]],
  31: [[1, 's', 0.9], [2, 'c', 1]],
  32: [[3, 'b', 1], [2, 'b', 1], [1, 's', 1]],
  33: [[2, 'b', 1], [1, 'b', 1], [3, 's', 1, { top: 120, snug: 1, min: 0.55 }]],
};
// Phone pages where the entry above does not work out, by page and language (Florian's review, 18 November):
// '23en' = Grießklößchensuppe in English. Same notation as above
const LAYOUT_PHONE = {
  '23en': [[1, 's', 0.42, { top: 120 }], [3, 's', 1.3], [2, 'b', 0.84, { rot: -86, rise: 1 }]],
};
function place(r, rects, l = lang) {
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
  const beside = (it, fs, yMin = 170, xMax = X1) => {
    const group = Array.isArray(it) ? it : [it], lead = group[0], o = lead.o;
    if (o.min) fs = fs.filter(f => f >= o.min).concat(fs.some(f => f < o.min) ? [o.min] : []);
    if (o.top != null) yMin = o.top;
    for (const f of fs) {
      const C = compose(f, group), d = { w: C.w, h: C.h };
      for (let y = yMin + lead.dy; y + d.h <= Y1; y += GRID) {
        let x1 = xMax; while (x1 - d.w >= X0 && !free(x1 - d.w, y, d.w, d.h)) x1 -= GRID;
        if (x1 - d.w < X0) continue;
        let x0 = x1 - d.w; while (x0 - GRID >= X0 && free(x0 - GRID, y, x1 - x0 + GRID, d.h)) x0 -= GRID;
        if (x1 < xMax - 40) continue;                                    // only the open space at the right, not a hole in the text
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
  const spec = (tall.matches && (LAYOUT_PHONE[r.no + l] || LAYOUT_PHONE[r.no])) || LAYOUT[r.no];
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
        const y0 = 8 + it.dy, x0 = X0 + 30 + (it.o.dx || 0);           // dy / dx: further from the top / left edge
        for (let y = y0; y < y0 + 112 && !done; y += GRID) for (let x = x0; x < x0 + 95 && !done; x += GRID) if (free(x, y, d.w, d.h)) { commit(it, d, x, y); done = true; }
        if (done) break; }
      if (!done) s.push(it);
    }
    if (c.length && !corner(c, CF)) b.push(...c);
    if (cl.length && !corner(cl, CF, true)) b.push(...cl);
    const spare = [];
    if (row.length && !beside(row, [1, 0.9, 0.8, 0.72])) spare.push(...row);
    for (const it of s) if (!beside(it, [1, 0.88, 0.76])) spare.push(it);
    if (!below([...b, ...spare], [1, 0.9, 0.8, 0.72, 0.64]) && !corner([...b, ...spare], [0.9, 0.8, 0.72, 0.64])) {
      // not everything fits below: a picture marked 'stay' keeps its place below and the others go to the side;
      // otherwise the largest stays and the rest tries the side
      const stay = [...b, ...spare].filter(it => it.o.stay), FB = [1, 0.9, 0.8, 0.72, 0.64];
      const fRow = FB.find(f => { const C = compose(f, b); return C.h <= bandH && C.w <= X1 - X0 - 20; });   // its size in the full row, where that row fits
      if (stay.length && below(stay, fRow ? FB.filter(f => f <= fRow) : FB)) {
        for (const it of [...b, ...spare].filter(it => !it.o.stay).sort((p, q) => q.size * q.scale - p.size * p.scale))
          beside(it, [0.85, 0.7, 0.58, 0.48]) || corner([it], [0.7, 0.6, 0.5, 0.42]) || beside(it, [0.4, 0.34], TOPM, X1 - EDGEM) || beside(it, [0.4, 0.34], 0);
        return out;
      }
      const all = [...b, ...spare].sort((p, q) => q.size * q.scale - p.size * p.scale);
      for (let keep = all.length - 1; keep >= 1; keep--) {
        const kept = [...b, ...spare].filter(it => all.slice(0, keep).includes(it));
        if (below(kept, [1, 0.88, 0.76, 0.66])) { for (const it of all.slice(keep)) beside(it, [0.9, 0.76, 0.6]); return out; }
      }
      for (const it of all) beside(it, [0.85, 0.7, 0.58, 0.48]) || corner([it], [0.7, 0.6, 0.5, 0.42]) || beside(it, [0.4, 0.34], TOPM, X1 - EDGEM) || beside(it, [0.4, 0.34], 0);
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
  if (!beside(hero, [0.85, 0.72, 0.6, 0.48]) && !corner([hero], [0.7, 0.6, 0.5, 0.42])) beside(hero, [0.4, 0.34], TOPM, X1 - EDGEM) || beside(hero, [0.4, 0.34], 0);
  for (const it of rest) beside(it, [0.8, 0.68, 0.56]);
  return out;
}
function fitOne(r, box, u) {
  r._v = (r._v || 0) + 1;
  const keep = lang, rects = {};
  for (const l of ['de', 'en']) {
    lang = l; const key = fkey(r, l); delete fit[key];
    let s = recipePage(r, true)('r'); box.replaceChildren(s);
    const one = Math.round(s.querySelector('.body').getBoundingClientRect().height / (29 * u));
    const f = fit[key] = { one, two: (one > LINES || TWO.has(r.no)) && r[l].ingredients.length === 1 };
    if (f.two) { s = recipePage(r, true)('r'); box.replaceChildren(s); }
    f.now = Math.round(s.querySelector('.body').getBoundingClientRect().height / (29 * u));
    rects[l] = textRects(s, u);
    f.place = place(r, rects[l], l);
  }
  lang = keep;
  // One arrangement for both languages wherever it costs little, so switching the language moves no picture. In
  // order: the German arrangement, if it clears the English text; the English one, if it clears the German text
  // and keeps the German pictures nearly as large; the pictures placed once against the text of both languages,
  // if that keeps every picture nearly as large as in either language and looks like one of the two arrangements
  // (no picture far from where it stood there). Only if none works does each language keep its own arrangement
  const de = fit[fkey(r, 'de')], en = fit[fkey(r, 'en')];
  if (!de.place || !en.place) return;
  if (clears(r, de.place, rects.en)) { en.place = de.place; de.shared = en.shared = 'de'; return; }
  if (clears(r, en.place, rects.de) && kept(en.place, de.place)) { de.place = en.place; de.shared = en.shared = 'en'; return; }
  const both = place(r, rects.de.concat(rects.en), 'de');
  if (both && kept(both, de.place) && kept(both, en.place) && (near(r, both, de.place) || near(r, both, en.place))) { de.place = en.place = both; de.shared = en.shared = 'both'; }
}
// does arrangement a keep every picture of arrangement b at least 80% as large?
const kept = (a, b) => a.length === b.length && b.every(q => { const m = a.find(x => x.i === q.i); return m && m.k >= q.k * 0.8; });
// does arrangement a put every picture within 80 units (centre to centre) of where arrangement b has it?
function near(r, a, b) {
  const it = ILLD[r.no].items, c = p => [p.x + it[p.i].w * p.k / 2, p.y + it[p.i].h * p.k / 2];
  return b.every(q => { const m = a.find(x => x.i === q.i); if (!m) return false; const [x0, y0] = c(m), [x1, y1] = c(q); return Math.hypot(x0 - x1, y0 - y1) <= 80; });
}
// does an arrangement of pictures keep clear of a page's text (with the same margin the layout keeps)?
function clears(r, placed, rects) {
  const il = ILLD[r.no]; if (!il) return false;
  const hit = (x0, y0, x1, y1) => rects.some(q => x0 < q[2] + 10 && x1 > q[0] - 10 && y0 < q[3] + 10 && y1 > q[1] - 10);
  return placed.every(p => {
    const it = il.items[p.i], iw = it.w * p.k, ih = it.h * p.k, a = (p.r || 0) * Math.PI / 180;
    const c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a)), w = iw * c + ih * sn, h = iw * sn + ih * c;
    const x0 = p.x - (w - iw) / 2, y0 = p.y - (h - ih) / 2;
    return x0 >= X0 && x0 + w <= X1 && y0 >= 0 && y0 + h <= Y1 && !hit(x0, y0, x0 + w, y0 + h);
  });
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
const slotL = $('slotL'), slotR = $('slotR'), cast = $('cast');
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
  prepare();
}
// The left half of the open book: the inside of the cover first, ruled paper after that. Both pictures are loaded
// from the start and only shown or hidden, so the left half is never empty for a moment
let leftOn = false;
function leftBase(n) { $('baseLE').style.visibility = leftOn && n === 0 ? 'visible' : 'hidden'; $('baseL').style.visibility = leftOn && n !== 0 ? 'visible' : 'hidden'; }
function showLeft(on) { leftOn = on; leftBase(pos); }
function show() {
  setSlot(slotR, rightIdx(pos), 'r');
  if (leftIdx(pos) >= 0) setSlot(slotL, leftIdx(pos), 'l'); else clearSlot(slotL);
  leftBase(pos);
  updateControls();
  prepare();
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
// The shadow a lifted page casts on the page beneath: drawn into a canvas, so moving it repaints nothing else
const castCtx = cast.getContext('2d');
let castOn = false;
function castCanvas() {
  const u = px(), w = 1216 * u, h = 994 * u, cs = Math.min(devicePixelRatio || 1, 1.5);
  const W = Math.ceil(w * cs), H = Math.ceil(h * cs);
  if (cast.width !== W || cast.height !== H) { cast.width = W; cast.height = H; }
  castCtx.setTransform(W / w, 0, 0, H / h, 0, 0);
  return { u, w, h };
}
function noCast() { if (!castOn) return; castOn = false; castCtx.setTransform(1, 0, 0, 1, 0, 0); castCtx.clearRect(0, 0, cast.width, cast.height); }
function setCast(tipX, lift, reach) {
  if (lift < 0.004) return noCast();
  const { u, w, h } = castCanvas(); castCtx.clearRect(0, 0, w, h); castOn = true;
  const a = 0.26 * Math.pow(lift, 0.6), wd = (10 + reach * lift) * u;
  const X = (608 + tipX) * u, dir = tipX >= 0 ? 1 : -1;   // where the free edge is, over the spread; the shadow falls away from the spine
  const x0 = X, x1 = X + dir * wd, g = castCtx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, `rgba(20,16,8,${a.toFixed(3)})`); g.addColorStop(0.4, `rgba(20,16,8,${(a * 0.35).toFixed(3)})`); g.addColorStop(1, 'rgba(20,16,8,0)');
  castCtx.fillStyle = g; castCtx.fillRect(Math.min(x0, x1), 0, wd, h);
}

// ---------- turning a page ----------
// A leaf is the sheet of paper being turned, cut into narrow vertical strips. Each strip is a flat slice of the
// page, moved and narrowed to where that part of the bent sheet appears on the screen (seen in perspective, from
// the eye's distance PERSP), so the sheet bends while every strip stays a plain rectangle of the page's height: the
// turning page keeps the book's height, its top and foot stay straight, and the browser never sorts planes in 3D.
// The sheet only ever bends one way, so the strips nearer its free edge are always nearer the eye: each strip lies
// on top of the one before it. A strip has two slices, the page being lifted and the page on its back, and shows
// whichever faces the reader. The light on a strip is a thin layer of its own, so the slices are painted once and
// then only moved; the paper (sheet-left/right) is cut to the photographed top page, so it fits the book exactly.
const N = 30, NR = 14, NR_MID = 10;   // strips for a single turn; for the first and last leaf of a riffle; for those in between
const PERSP = 6000;                   // the eye's distance, in book units
const OV = 6;                         // px each slice reaches under its neighbour (unscaled), so no seam shows even where a strip is steep
const leavesHost = $('leaves');
// the top page's outline (sheets.py): top and foot of the paper every 2 units across a sheet, in sheet units
function paperAt(o, X) {
  const i = clamp(X / 2, 0, o.top.length - 1), a = Math.floor(i), b = Math.min(a + 1, o.top.length - 1), f = i - a;
  const t0 = o.top[a], t1 = o.top[b], f0 = o.foot[a], f1 = o.foot[b];
  if (t0 == null && t1 == null) return null;
  return [t0 == null ? t1 : t1 == null ? t0 : t0 + (t1 - t0) * f, f0 == null ? f1 : f1 == null ? f0 : f0 + (f1 - f0) * f];
}
// A slice only needs the pictures that reach into it: the others are left out of its copy of the page
const unitsOf = v => { const m = /calc\(([-\d.e]+) \* var\(--u\)\)/.exec(v || ''); return m ? parseFloat(m[1]) : null; };
function prune(copy, side, a, b) {
  const off = side === 'r' ? 62 : 41;                  // .in sits this far into the sheet
  for (const im of copy.querySelectorAll('img')) {
    const l = unitsOf(im.style.left), w = unitsOf(im.style.width); if (l == null || w == null) continue;
    const x0 = off + l - w * 0.25, x1 = off + l + w * 1.25;   // generous: pictures may be turned
    if (x1 < a || x0 > b) im.remove();
  }
  return copy;
}
function buildLeaf(frontIdx, backIdx, n) {
  n = n || N; const u = px(), w = 608 / n, wp = w * u, m = OV / u + 2;
  const box = el('div', 'leaf'), F = [], B = [];
  const front = make(frontIdx, 'r'), back = make(backIdx, 'l');
  for (let i = 0; i < n; i++) {
    const f = el('div', 'strip'), b = el('div', 'strip');
    f.style.width = b.style.width = (wp + OV) + 'px';
    const cf = prune(front.cloneNode(true), 'r', i * w - 2, (i + 1) * w + m); cf.style.left = (-i * wp) + 'px'; f.appendChild(cf);
    const cb = prune(back.cloneNode(true), 'l', 608 - (i + 1) * w - m, 608 - i * w + 2); cb.style.left = (OV - (608 - (i + 1) * w) * u) + 'px'; b.appendChild(cb);
    box.append(f, b); F.push(f); B.push(b);
  }
  // the light on the sheet: one canvas over the whole leaf, drawn afresh every frame (nothing is repainted)
  const cv = document.createElement('canvas'); cv.className = 'light';
  const cs = Math.min(devicePixelRatio || 1, tall.matches ? 1.25 : 2);
  cv.width = Math.ceil(1283 * u * cs); cv.height = Math.ceil(994 * u * cs);
  box.appendChild(cv);
  leavesHost.appendChild(box);
  return { F, B, face: [], u, n, w, box, cv, ctx: cv.getContext('2d'), cs };
}
// The light on a leaf: every visible piece of every strip, nearest first, is filled with its own shading, cut to the
// top page's outline. Pieces hidden behind nearer strips are skipped, so no shading is laid twice
function lightLeaf(L, xs, vf, face) {
  const { ctx, cv, u, n, w } = L, ox = 640 * u;
  ctx.setTransform(cv.width / (1283 * u), 0, 0, cv.height / (994 * u), 0, 0); ctx.clearRect(0, 0, 1283 * u, 994 * u);
  const cov = [];
  const free = (lo, hi) => {                            // the parts of [lo, hi] not yet covered by nearer strips
    let out = [[lo, hi]];
    for (const [c0, c1] of cov) out = out.flatMap(([a, b]) => (c1 <= a || c0 >= b) ? [[a, b]] : [[a, Math.min(b, c0)], [Math.max(a, c1), b]].filter(([p, q]) => q - p > 0.01));
    return out;
  };
  for (let i = n - 1; i >= 0; i--) {
    const a = xs[i], b = xs[i + 1], lo = Math.min(a, b), hi = Math.max(a, b);
    if (hi - lo < 0.02) continue;
    const o = face[i] ? OUTLINE.r : OUTLINE.l;
    const X = x => face[i] ? i * w + (x - a) / (b - a) * w : 608 - i * w - (x - a) / (b - a) * w;   // sheet column under x
    const V = x => vf[i][0] + (vf[i][1] - vf[i][0]) * (x - a) / (b - a);                             // light at x
    for (const [p0, p1] of free(lo, hi)) {
      const steps = Math.max(1, Math.ceil(Math.abs(X(p1) - X(p0)) / 2)), top = [], foot = [];
      for (let k = 0; k <= steps; k++) { const x = p0 + (p1 - p0) * k / steps, q = paperAt(o, X(x)); if (q) { top.push([x, q[0]]); foot.push([x, q[1]]); } }
      if (top.length < 2) continue;
      ctx.beginPath(); ctx.moveTo(ox + top[0][0], top[0][1] * u);
      for (const [x, y] of top.slice(1)) ctx.lineTo(ox + x, y * u);
      for (let k = foot.length - 1; k >= 0; k--) ctx.lineTo(ox + foot[k][0], foot[k][1] * u);
      ctx.closePath();
      const g = ctx.createLinearGradient(ox + p0, 0, ox + p1, 0); g.addColorStop(0, tint(V(p0))); g.addColorStop(1, tint(V(p1)));
      ctx.fillStyle = g; ctx.fill();
    }
    cov.push([lo, hi]);
  }
}
// The sheet bends: the free edge leads, the part by the fold follows, and it lands with a soft bulge that flattens
function poseLeaf(L, p, quiet) {
  const { F, B, u, n, w } = L, wp = w * u, P = PERSP * u, O = (tall.matches ? 322.25 : 1.5) * u;
  const tip = Math.PI * ease(clamp(p / 0.86, 0, 1)), sp = Math.PI * ease(clamp((p - 0.14) / 0.86, 0, 1));
  const th = []; for (let i = 0; i <= n; i++) th.push(sp + (tip - sp) * Math.pow(i / n, 1.35));
  let x = 0, z = 0, zmax = 0; const xs = [0], face = [];
  for (let i = 0; i < n; i++) {
    const a = (th[i] + th[i + 1]) / 2, x1 = x + wp * Math.cos(a), z1 = z + wp * Math.sin(a);
    xs.push(O + (x1 - O) * P / (P - z1));             // where this strip's far edge appears on the screen
    x = x1; z = z1; zmax = Math.max(zmax, z);
  }
  for (let i = 0; i < n; i++) {
    const s0 = xs[i], s1 = xs[i + 1], front = s1 >= s0; face.push(front);
    if (L.face[i] !== front) { L.face[i] = front; F[i].style.opacity = front ? '1' : '0.001'; B[i].style.opacity = front ? '0.001' : '1'; }
    if (front) F[i].style.transform = `translate(${s0.toFixed(2)}px,0) scaleX(${((s1 - s0) / wp).toFixed(5)})`;
    else { const k = (s0 - s1) / wp; B[i].style.transform = `translate(${(s1 - OV * k).toFixed(2)}px,0) scaleX(${k.toFixed(5)})`; }
  }
  // the light changes along each strip from one edge to the other, by the angle there, on whichever face shows
  const vf = []; for (let i = 0; i < n; i++) vf.push([lit(th[i], !face[i]), lit(th[i + 1], !face[i])]);
  lightLeaf(L, xs, vf, face);
  if (!quiet) setCast(x / u, zmax / (608 * u), 300);
  return { tip: x / u, lift: zmax / (608 * u) };
}
// The next turn either way is prepared while the reader reads: its leaf is built, laid out and painted, lying
// invisibly in place, so a turn starts the moment it is asked for. A prepared leaf belongs to the exact pages,
// language, layout and size it was built for; anything else is thrown away
const ahead = new Map();
const leafKey = n => `${slotKey(rightIdx(n), 'r')}/${slotKey(leftIdx(n + 1), 'l')}/${N}/${px().toFixed(4)}`;
function dropAhead() { clearTimeout(prepTimer); for (const L of ahead.values()) L.box.remove(); ahead.clear(); }
function takeLeaf(n) {
  const k = leafKey(n), L = ahead.get(k); if (!L) return null;
  ahead.delete(k); L.box.style.opacity = ''; return L;
}
let prepTimer = 0;
function prepare() {
  clearTimeout(prepTimer);
  prepTimer = setTimeout(() => {
    if (busy || !open || reduce.matches || !D) return;
    const want = [pos, pos - 1].filter(n => n >= 0 && n < lastPos());
    if (tall.matches) want.length = Math.min(want.length, 1);            // phones keep only the next leaf ready
    const keys = new Map(want.map(n => [leafKey(n), n]));
    for (const [k, L] of ahead) if (!keys.has(k)) { L.box.remove(); ahead.delete(k); }
    const next = [...keys].find(([k]) => !ahead.has(k));
    if (!next) return;
    const [k, n] = next, L = buildLeaf(rightIdx(n), leftIdx(n + 1));
    L.box.style.opacity = '0.001';                      // drawn, so it is painted and ready, but not seen
    poseLeaf(L, n === pos ? 0 : 1, true); ahead.set(k, L);
    prepare();                                          // and the other one, a moment later
  }, 180);
}
// While pages move, nothing else may claim the main thread: work that arrives meanwhile (an illustration file
// landing, a page to lay out again) waits until the movement has finished
let animating = false;
const later = [];
function afterMotion(fn) { if (animating || later.length) { later.push(fn); if (!animating) setTimeout(drain, 0); } else fn(); }
async function moving(ms, fn) {
  animating = true;
  try { await animate(ms, fn); } finally { animating = false; }
  drain();
}
// work held back during a movement is done afterwards in small portions, so the screen keeps drawing in between
function drain() {
  const t0 = performance.now();
  while (later.length && !animating && performance.now() - t0 < 12) later.shift()();
  if (later.length && !animating) setTimeout(drain, 0);
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
  const key = leafKey(n), L = takeLeaf(n) || buildLeaf(rightIdx(n), leftIdx(n + 1));
  poseLeaf(L, dir > 0 ? 0 : 1);
  await ready([L.box]);                               // the leaf lies exactly over the page it lifts: nothing changes yet
  if (dir > 0) setSlot(slotR, rightIdx(to), 'r'); else { if (leftIdx(to) >= 0) setSlot(slotL, leftIdx(to), 'l'); else clearSlot(slotL); leftBase(to); }
  await ready([dir > 0 ? slotR : slotL], 250);
  await moving(1050, t => poseLeaf(L, dir > 0 ? t : 1 - t));
  // the leaf just turned is the one the next turn back (or forth) needs: it stays, invisibly, where it landed,
  // unless its pages changed while it turned (their pictures arrived, say)
  L.box.style.opacity = '0.001'; noCast();
  pos = to; if (leafKey(n) === key && !ahead.has(key)) ahead.set(key, L); else L.box.remove();
  show(); busy = false;
}
// Going further than one page: the pages riffle past under the thumb, a few real leaves in quick succession, and
// the book lands open at the destination. One page away is an ordinary turn.
const RIFFLE = 5;                                     // leaves that fly past at most
async function riffle(to) {
  const from = pos, dir = Math.sign(to - from), steps = Math.abs(to - from);
  if (!steps) return;
  if (steps === 1 || reduce.matches) { if (reduce.matches) { pos = to; show(); return; } return turn(dir); }
  busy = true;
  const m = Math.min(steps, RIFFLE), ns = [];
  for (let j = 0; j < m; j++) {
    const k = Math.round(j * (steps - 1) / (m - 1));
    ns.push(dir > 0 ? from + k : from - 1 - k);       // leaf between n and n + 1: forwards from the top of the right stack, backwards from the top of the left
  }
  // the first leaf is often prepared already; the ones flying past in between need fewer strips
  const Ls = ns.map((n, j) => (j === 0 && takeLeaf(n)) || buildLeaf(rightIdx(n), leftIdx(n + 1), j === 0 || j === m - 1 ? NR : NR_MID));
  Ls.forEach((L, j) => { poseLeaf(L, dir > 0 ? 0 : 1, true); L.box.style.zIndex = 100 - j; });   // the first to go lies on top
  await ready(Ls.map(L => L.box), 600);
  // underneath: the destination, on the side the leaves are leaving
  if (dir > 0) setSlot(slotR, rightIdx(to), 'r'); else { if (leftIdx(to) >= 0) setSlot(slotL, leftIdx(to), 'l'); else clearSlot(slotL); leftBase(to); }
  await ready([dir > 0 ? slotR : slotL], 250);
  const ONE = 560, GAP = steps > 4 ? 95 : 120, T = ONE + (m - 1) * GAP;
  await moving(T, t => {
    let top = null;
    Ls.forEach((L, j) => {
      const q = clamp((t * T - j * GAP) / ONE, 0, 1);
      const z = q < 0.5 ? 100 - j : 200 + j;           // on the side it leaves, the earlier leaf lies on top; on the side it lands, the later one does
      if (L.z !== z) { L.z = z; L.box.style.zIndex = z; }
      if (L.q === q) return;                            // still waiting to go, or already landed: nothing to move
      L.q = q; const r = poseLeaf(L, dir > 0 ? q : 1 - q, true);
      if (q > 0 && q < 1 && (!top || r.lift > top.lift)) top = r;
    });
    if (top) setCast(top.tip, top.lift * 0.8, 260); else noCast();
  });
  pos = to; show(); Ls.forEach(L => L.box.remove()); noCast(); busy = false;
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
  if (t < 0.5) setCast(636 * Math.cos(a), Math.sin(a) * 0.9, 210); else noCast();
}
async function openBook() {
  if (busy || open || shutBack) return; busy = true;
  if (document.activeElement === $('pw')) { $('pw').blur(); await wait(380); }
  $('pass').classList.add('gone'); pos = 0; setSlot(slotR, rightIdx(0), 'r'); await ready([slotR]); document.body.classList.remove('closed'); document.body.classList.add('opening');
  if (reduce.matches) { cover.hidden = true; $('spineHold').style.visibility = 'hidden'; document.body.classList.remove('lidded'); } else {
    coverFront.classList.add('off'); await wait(430);
    await moving(2100, t => poseCover(swing(t)));
    showLeft(true); await frames(2);                  // the inside cover is drawn under the open cover first, so taking the cover away changes nothing
    cover.hidden = true;
  }
  showLeft(true); shadow.style.transform = 'none'; open = true; document.body.classList.remove('opening'); show(); busy = false;
}
async function closeBook() {
  if (busy || !open) return; busy = true; open = false; updateControls(); dropAhead();
  poseCover(1); cover.hidden = false; clearSlot(slotL); document.body.classList.add('opening');
  await frames(2); showLeft(false);                 // the cover lies over the left half before it is taken away underneath
  if (!reduce.matches) await moving(1800, t => poseCover(1 - swing(t)));
  poseCover(0); noCast(); clearSlot(slotR); document.body.classList.add('closed'); document.body.classList.remove('opening'); coverFront.classList.remove('off'); busy = false;
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
  if (t > 0.5) setCast(-636 * Math.cos(Math.PI - a), Math.sin(a) * 0.9, 210); else noCast();
}
async function closeBack() {
  if (busy || !open) return; busy = true; open = false; updateControls(); dropAhead();
  backB.hidden = false; poseBack(0); document.body.classList.add('backshut');
  if (!reduce.matches) await moving(2100, t => poseBack(swing(t)));
  poseBack(1); noCast(); shutBack = true; busy = false; updateControls();
}
async function openBack(to) {
  if (busy || !shutBack) return; busy = true; shutBack = false;
  const onward = to != null && to < lastPos();
  if (!reduce.matches) { poseBack(1); await moving(onward ? 1300 : 1800, t => poseBack(1 - swing(t))); }
  poseBack(0); backB.hidden = true; document.body.classList.remove('backshut', 'backlid'); $('spineHoldBack').style.visibility = 'hidden';
  shadow.style.transform = 'none'; noCast(); open = true; pos = lastPos(); show(); busy = false;
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
    ILLD[n] = d;
    return new Promise(res => afterMotion(() => {
      const box = measureBox(); fitOne(D.recipes[n - 1], box, px()); box.remove();
      res(visible(n) && !busy ? showSmooth() : null);
    }));
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
  cover.hidden = true; $('spineHold').style.visibility = 'hidden'; leftOn = true; shadow.style.transform = 'none'; noCast();
  open = true; pos = Math.min(posOf(r.page), lastPos()); show(); updateControls();
}

function setLang(l) {
  dropAhead();                                         // the prepared leaves are in the old language; dropped first, so the switch restyles only the open pages
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
  const page = open ? Math.max(rightIdx(pos), 0) : 0; dropAhead(); fitAll(); buildPages(); pos = Math.min(posOf(page), lastPos()); if (open) show();
});
addEventListener('resize', () => { if (open && !busy) prepare(); });
updateControls();
// for checking the book in a test browser
window.__book = { riffle, forget: () => store.set(null), unlock, tryOpen, data: () => D, ill: () => ILLD, fit, setLang, recipePage, openBook, closeBook, closeBack, openBack, turn, go, poseLeaf, buildLeaf, poseCover, poseBack, setSlot, rightIdx, leftIdx, coverFront, state: () => ({ pos, open, busy, shutBack, last: lastPos(), animating }) };
