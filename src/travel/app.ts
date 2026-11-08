// gowiththeflo: map, drawer, and interactions.
// Data comes from the page (built from /content/travel); the map is MapLibre with
// self-hosted relief tiles and country shapes, so nothing depends on a map service.
import { Map as MapLibre, setWorkerUrl, LngLatBounds, type GeoJSONSource, type MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { feature } from 'topojson-client';
import { formatFacts, formatPeriod, monthShort } from './format';
import { unpackFacts, type TravelData, type TripOut } from './types';

setWorkerUrl(workerUrl);

type Data = TravelData & { topo: string };
const data: Data = JSON.parse(document.getElementById('tf-data')!.textContent!);
const visited = new Set(data.visited);
const tripsByCountry = new Map<string, TripOut[]>();
for (const t of data.trips) for (const c of t.countries) {
  if (!tripsByCountry.has(c)) tripsByCountry.set(c, []);
  tripsByCountry.get(c)!.push(t);
}
const tripById = new Map(data.trips.map((t) => [t.id, t]));
const nameOf = (c: string) => data.ref[c]?.n ?? c;

// ── Look ────────────────────────────────────────────────────────────────
const PAPER = '#f3f2ef';
const INK = '#2b2b29';
const WATER = '#74b4e8';    // also baked into the relief tiles (scripts/travel/build-map.py)
const FOG_COLOR = '#f2f2f0'; // light neutral grey
const FOG = 0.7;           // see-through: the land shows faintly under countries not yet visited
const FOG_PEEK = 0.45;     // ...thinned while hovering, as if wiping the glass
const HOME_PINS = [
  { name: 'Copenhagen', lngLat: [12.5682, 55.6761] as [number, number] },
  { name: 'Ortenberg', lngLat: [7.972, 48.445] as [number, number] },
];

const root = document.body;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const fineQuery = matchMedia('(hover: hover) and (pointer: fine)');
let fine = fineQuery.matches;
const applyFine = () => { fine = fineQuery.matches; root.classList.toggle('is-fine', fine); if (!fine) { hideTip(); plane.hide(); clearMeasure(); } };
fineQuery.addEventListener('change', applyFine);

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const mapEl = $('map');
const tip = $('tf-tip');
const distChip = $('tf-dist');
const drawer = $('tf-drawer');
const dTitles = $('tf-d-titles');
const dBody = $('tf-d-body');
const backBtn = $('tf-back');
const diaryBtn = $('tf-open-diary');

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const flagImg = (c: string, cls = 'tf-flag') => (data.flags[c] ? `<img class="${cls}" src="${data.flags[c]}" alt="" width="30" height="22.5" loading="lazy">` : '');

// ── Map ─────────────────────────────────────────────────────────────────
const isPhone = () => innerWidth <= 700;
function initialView() {
  const w = innerWidth;
  if (isPhone()) return { center: [14, 38] as [number, number], zoom: 1.15 };
  return { center: [12, 26] as [number, number], zoom: Math.max(1.2, Math.min(2.3, Math.log2(w / 512) + 0.35)) };
}
const LAT_LIMIT = 72;
const tileUrl = new URL('/projects/travel-diary/map/relief/{z}/{x}/{y}.webp', location.href).href.replace('%7Bz%7D', '{z}').replace('%7Bx%7D', '{x}').replace('%7By%7D', '{y}');

const map = new MapLibre({
  container: mapEl,
  ...initialView(),
  minZoom: 0.6,
  maxZoom: 7,
  renderWorldCopies: true,
  dragRotate: false,
  pitchWithRotate: false,
  touchPitch: false,
  fadeDuration: 0,
  attributionControl: false, // Natural Earth is public domain; credited in the counter's "i" instead
  transformConstrain: (lngLat, zoom) => {
    const lat = Math.max(-LAT_LIMIT + 14, Math.min(LAT_LIMIT, lngLat.lat));
    lngLat.lat = lat;
    return { center: lngLat, zoom };
  },
  style: {
    version: 8,
    sources: {
      relief: { type: 'raster', tiles: [tileUrl], tileSize: 512, maxzoom: 4 },
    },
    layers: [
      { id: 'water', type: 'background', paint: { 'background-color': WATER } },
      { id: 'relief', type: 'raster', source: 'relief', paint: { 'raster-fade-duration': 0, 'raster-resampling': 'linear' } },
    ],
  },
});
map.touchZoomRotate.disableRotation();
map.keyboard.disableRotation();

let allShapes: GeoJSON.FeatureCollection | null = null;
const shapes = fetch(data.topo).then((r) => r.json()).then((topo) => (allShapes = feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection));

const visitedList = ['literal', data.visited] as const;
let ready = false;

Promise.all([shapes, new Promise<void>((r) => (map.loaded() ? r() : map.once('load', () => r())))]).then(([fc]) => {
  map.addSource('countries', { type: 'geojson', data: fc, promoteId: 'iso', tolerance: 0.3 });
  map.addSource('pins', { type: 'geojson', data: { type: 'FeatureCollection', features: HOME_PINS.map((p) => ({ type: 'Feature', properties: { name: p.name }, geometry: { type: 'Point', coordinates: p.lngLat } })) } });
  map.addSource('measure', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

  const isVisited = ['in', ['get', 'iso'], visitedList] as any;
  const hovered = ['boolean', ['feature-state', 'hover'], false] as any;

  // Fog over the world; visited countries start fogged too and clear once the map is ready
  map.addLayer({ id: 'fog', type: 'fill', source: 'countries', filter: ['!', isVisited],
    paint: { 'fill-color': FOG_COLOR, 'fill-opacity': ['case', hovered, FOG_PEEK, FOG], 'fill-antialias': false } });
  map.addLayer({ id: 'fog-lift', type: 'fill', source: 'countries', filter: isVisited,
    paint: { 'fill-color': FOG_COLOR, 'fill-opacity': FOG, 'fill-opacity-transition': { duration: 0, delay: 0 }, 'fill-antialias': false } });
  // Borders: hairlines, a touch darker around visited countries
  map.addLayer({ id: 'borders', type: 'line', source: 'countries',
    paint: { 'line-color': ['case', isVisited, 'rgba(43,43,41,0.2)', 'rgba(255,255,255,0.7)'], 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.35, 5, 0.8] } });
  map.addLayer({ id: 'hover-line', type: 'line', source: 'countries', filter: isVisited,
    paint: { 'line-color': INK, 'line-width': 1, 'line-opacity': ['case', hovered, 0.55, 0] } });
  map.addLayer({ id: 'selected', type: 'line', source: 'countries', filter: ['==', ['get', 'iso'], ''],
    paint: { 'line-color': INK, 'line-width': 1.6 } });
  map.addLayer({ id: 'pins', type: 'circle', source: 'pins',
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.6, 6, 4], 'circle-color': INK, 'circle-stroke-color': PAPER, 'circle-stroke-width': 1.4 } });
  map.addLayer({ id: 'measure-line', type: 'line', source: 'measure', filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': INK, 'line-width': 1.4, 'line-dasharray': [2, 2], 'line-opacity': 0.8 } });
  map.addLayer({ id: 'measure-dots', type: 'circle', source: 'measure', filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-radius': 3.5, 'circle-color': INK, 'circle-stroke-color': PAPER, 'circle-stroke-width': 1.5 } });

  map.once('idle', () => {
    ready = true;
    mapEl.classList.add('is-ready');
    // One motion moment: the fog lifts from the countries Florian has visited
    const lift = () => {
      map.setPaintProperty('fog-lift', 'fill-opacity-transition', { duration: reduceMotion.matches ? 0 : 1400, delay: 0 });
      map.setPaintProperty('fog-lift', 'fill-opacity', 0);
    };
    if (reduceMotion.matches) lift(); else setTimeout(lift, 380);
    route();
  });
});

// ── Hover, click, and the tooltip ───────────────────────────────────────
let hoverId: { source: string; id: string } | null = null;
function setHover(next: { source: string; id: string } | null) {
  if (hoverId && (!next || hoverId.id !== next.id || hoverId.source !== next.source)) map.setFeatureState(hoverId, { hover: false });
  if (next) map.setFeatureState(next, { hover: true });
  hoverId = next;
}
function pick(point: { x: number; y: number }): MapGeoJSONFeature | undefined {
  if (!ready) return;
  const box = (pad: number): [[number, number], [number, number]] => [[point.x - pad, point.y - pad], [point.x + pad, point.y + pad]];
  const pin = map.queryRenderedFeatures(box(6), { layers: ['pins'] });
  if (pin.length) return pin[0];
  const exact = map.queryRenderedFeatures([point.x, point.y], { layers: ['fog', 'fog-lift'] })[0];
  if (exact) return exact;
  // Small islands and microstates: accept a click a few pixels off, nearest first
  for (const pad of [4, 8, 12]) {
    const near = map.queryRenderedFeatures(box(pad), { layers: ['fog', 'fog-lift'] });
    if (near.length) return near[0];
  }
}
function showTip(text: string, x: number, y: number) {
  tip.textContent = text;
  tip.classList.add('is-on');
  const w = tip.offsetWidth;
  tip.style.transform = `translate(${Math.min(x + 16, innerWidth - w - 10)}px, ${Math.max(y - 9, 8)}px)`;
}
function hideTip() { tip.classList.remove('is-on'); }

map.on('mousemove', (e) => {
  if (!fine) return;
  const f = pick(e.point);
  if (!f) { setHover(null); hideTip(); return; }
  if (f.layer.id === 'pins') { setHover(null); showTip(f.properties.name, e.originalEvent.clientX, e.originalEvent.clientY); return; }
  const iso = f.properties.iso as string;
  setHover({ source: 'countries', id: iso });
  if (data.ref[iso]) showTip(nameOf(iso), e.originalEvent.clientX, e.originalEvent.clientY); else hideTip();
});
mapEl.addEventListener('mouseleave', () => { setHover(null); hideTip(); });

map.on('click', (e) => {
  if (measure.pending || measure.done) { clearMeasure(); if (fine) return; }
  const f = pick(e.point);
  const iso = f && f.layer.id !== 'pins' ? (f.properties.iso as string) : null;
  if (iso && data.ref[iso]) go(`#${iso.toLowerCase()}`);
  else if (drawerOpen()) go('');
});

// ── The aeroplane cursor (desktop only, over the map only) ──────────────
const plane = (() => {
  const el = $('tf-plane');
  let x = -100, y = -100, lx = x, ly = y, target = 0, angle = 0, raf = 0, on = false;
  const frame = () => {
    const d = ((target - angle + 540) % 360) - 180;
    angle += d * 0.14;
    el.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg)`;
    raf = Math.abs(d) > 0.2 ? requestAnimationFrame(frame) : 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const canvas = map.getCanvasContainer();
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !fine) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    if (Math.hypot(dx, dy) > 1.5) { target = (Math.atan2(dy, dx) * 180) / Math.PI + 90; lx = e.clientX; ly = e.clientY; }
    x = e.clientX; y = e.clientY;
    if (!on) { on = true; el.classList.add('is-on'); }
    kick();
  });
  canvas.addEventListener('pointerleave', () => api.hide());
  const api = { hide() { on = false; el.classList.remove('is-on'); } };
  return api;
})();

// ── Measuring air distance (right-click two places, desktop only) ───────
const measure: { a: [number, number] | null; pending: boolean; done: boolean; line: [number, number][] | null } = { a: null, pending: false, done: false, line: null };
function greatCircle(a: [number, number], b: [number, number], steps = 96): [number, number][] {
  const toR = Math.PI / 180;
  const [l1, p1] = [a[0] * toR, a[1] * toR], [l2, p2] = [b[0] * toR, b[1] * toR];
  const v1 = [Math.cos(p1) * Math.cos(l1), Math.cos(p1) * Math.sin(l1), Math.sin(p1)];
  const v2 = [Math.cos(p2) * Math.cos(l2), Math.cos(p2) * Math.sin(l2), Math.sin(p2)];
  const w = Math.acos(Math.max(-1, Math.min(1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2])));
  const pts: [number, number][] = [];
  let prev: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s = Math.sin(w) || 1;
    const f1 = w ? Math.sin((1 - t) * w) / s : 1 - t, f2 = w ? Math.sin(t * w) / s : t;
    const v = [f1 * v1[0] + f2 * v2[0], f1 * v1[1] + f2 * v2[1], f1 * v1[2] + f2 * v2[2]];
    let lng = Math.atan2(v[1], v[0]) / toR;
    const lat = Math.atan2(v[2], Math.hypot(v[0], v[1])) / toR;
    if (prev !== null) { while (lng - prev > 180) lng -= 360; while (lng - prev < -180) lng += 360; } // keep the line continuous
    prev = lng;
    pts.push([lng, lat]);
  }
  return pts;
}
function km(a: [number, number], b: [number, number]) {
  const toR = Math.PI / 180, R = 6371;
  const dLat = (b[1] - a[1]) * toR, dLng = (b[0] - a[0]) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const measureSource = () => map.getSource('measure') as GeoJSONSource | undefined;
function clearMeasure() {
  measure.a = null; measure.pending = false; measure.done = false; measure.line = null;
  measureSource()?.setData({ type: 'FeatureCollection', features: [] });
  distChip.classList.remove('is-on');
}
// The distance sits at the apex of the arc: the point furthest from the straight line between
// the two places, on screen. The label goes just beyond it, on the outside of the curve.
function placeDistChip() {
  const line = measure.line;
  if (!line) return;
  const pts = line.map((c) => map.project(c));
  const a = pts[0], b = pts[pts.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  let apex = pts[Math.floor(pts.length / 2)], best = -1, side = 0;
  for (const p of pts) {
    const d = ((p.x - a.x) * dy - (p.y - a.y) * dx) / len; // signed distance from the chord
    if (Math.abs(d) > best) { best = Math.abs(d); apex = p; side = Math.sign(d); }
  }
  // Unit normal pointing away from the chord; a nearly straight line gets its label above
  let nx = dy / len * side, ny = -dx / len * side;
  if (best < 4) { nx = 0; ny = -1; }
  const w = distChip.offsetWidth, h = distChip.offsetHeight, gap = 10;
  const cx = apex.x + nx * (gap + h / 2) + nx * Math.abs(nx) * (w / 2 - h / 2);
  const cy = apex.y + ny * (gap + h / 2);
  distChip.style.transform = `translate(${cx - w / 2}px, ${cy - h / 2}px)`;
}
map.on('move', placeDistChip);
map.getCanvasContainer().addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (!fine || !ready) return;
  const r = map.getCanvas().getBoundingClientRect();
  const ll = map.unproject([e.clientX - r.left, e.clientY - r.top]);
  const pt: [number, number] = [ll.lng, ll.lat];
  if (!measure.pending) {
    clearMeasure();
    measure.a = pt; measure.pending = true;
    measureSource()?.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pt } }] });
    return;
  }
  const a = measure.a!;
  const line = greatCircle(a, pt);
  measure.pending = false; measure.done = true; measure.line = line;
  measureSource()?.setData({ type: 'FeatureCollection', features: [
    { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } },
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: a } },
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: line[line.length - 1] } },
  ] });
  distChip.textContent = `${Math.round(km(a, pt)).toLocaleString('en-GB')} km`;
  distChip.classList.add('is-on');
  placeDistChip();
});

// ── Zoom buttons ────────────────────────────────────────────────────────
$('tf-zoom-in').addEventListener('click', () => map.zoomIn({ duration: 400 }));
$('tf-zoom-out').addEventListener('click', () => map.zoomOut({ duration: 400 }));

// ── Small pop-overs (the "i" buttons) ───────────────────────────────────
function wirePop(btn: HTMLElement) {
  const pop = document.getElementById(btn.getAttribute('aria-controls')!)!;
  const set = (open: boolean) => { btn.setAttribute('aria-expanded', String(open)); pop.hidden = !open; };
  btn.addEventListener('click', (e) => { e.stopPropagation(); set(btn.getAttribute('aria-expanded') !== 'true'); });
  document.addEventListener('click', (e) => { if (!pop.contains(e.target as Node)) set(false); });
}
wirePop(document.querySelector<HTMLElement>('.tf-panel .tf-info')!);

// ── Drawer views ────────────────────────────────────────────────────────
// Addresses: #dk (a country), #trip/<id> (one trip), #diary and #diary/countries (lists)
let lastFocus: HTMLElement | null = null;
const drawerOpen = () => drawer.classList.contains('is-open');
function go(hash: string) {
  if (hash === location.hash || (hash === '' && !location.hash)) { route(); return; }
  if (hash) location.hash = hash;
  else history.replaceState(null, '', location.pathname + location.search), route();
}
addEventListener('hashchange', route);

function openDrawer() {
  if (!drawerOpen()) {
    lastFocus = document.activeElement as HTMLElement;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
  }
  dBody.scrollTop = 0;
  requestAnimationFrame(() => dTitles.focus({ preventScroll: true }));
}
function closeDrawer() {
  if (!drawerOpen()) return;
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  diaryBtn.setAttribute('aria-expanded', 'false');
  if (ready) map.setFilter('selected', ['==', ['get', 'iso'], '']);
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}
dTitles.tabIndex = -1;
$('tf-close').addEventListener('click', () => go(''));
diaryBtn.addEventListener('click', () => go(location.hash.startsWith('#diary') ? '' : '#diary'));
backBtn.addEventListener('click', () => history.back());

// Features overlay: opened from the footer, closed with Esc, the close button, or a click outside the card
const feat = $('tf-feat'), featOpen = $('tf-feat-open');
const setFeat = (open: boolean) => {
  feat.hidden = !open; featOpen.setAttribute('aria-expanded', String(open));
  if (open) $('tf-feat-close').focus(); else featOpen.focus({ preventScroll: true });
};
featOpen.addEventListener('click', () => setFeat(true));
$('tf-feat-close').addEventListener('click', () => setFeat(false));
feat.addEventListener('click', (e) => { if (e.target === feat) setFeat(false); });

addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!feat.hidden) setFeat(false);
  else if (measure.pending || measure.done) clearMeasure();
  else if (drawerOpen()) go('');
});

// A view opened from another drawer view can step back to it
let current = '';
let cameFromDrawer = false;

function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h !== current) {
    const isList = (x: string) => x.startsWith('diary');
    if (!(isList(h) && isList(current))) cameFromDrawer = !!current && !!h;
    current = h;
  }
  backBtn.hidden = !cameFromDrawer || h.startsWith('diary');
  if (!h) { closeDrawer(); return; }
  if (h === 'diary' || h === 'diary/countries') { renderDiary(h === 'diary/countries' ? 'countries' : 'trips'); return; }
  if (h.startsWith('trip/')) { const t = tripById.get(h.slice(5)); if (t) { renderTrip(t); return; } }
  const code = h.toUpperCase();
  if (data.ref[code]) { renderCountry(code); return; }
  go('');
}

function select(codes: string[]) {
  if (!ready) return;
  map.setFilter('selected', ['in', ['get', 'iso'], ['literal', codes]]);
}
function fitTo(codes: string[]) {
  if (!ready) return;
  const feats = (allShapes?.features ?? []).filter((f) => codes.includes(f.properties!.iso));
  if (!feats.length) return;
  const b = new LngLatBounds();
  // Use the main body of each country (the largest polygon) so overseas islands don't zoom the map out
  for (const c of codes) {
    const parts = feats.filter((f) => f.properties!.iso === c);
    let best: GeoJSON.Position[] | null = null, bestN = 0;
    for (const f of parts) {
      const polys = f.geometry.type === 'MultiPolygon' ? (f.geometry as GeoJSON.MultiPolygon).coordinates : [(f.geometry as GeoJSON.Polygon).coordinates];
      for (const p of polys) if (p[0].length > bestN) { bestN = p[0].length; best = p[0]; }
    }
    best?.forEach((p) => b.extend(p as [number, number]));
  }
  if (b.isEmpty()) return;
  const phone = isPhone();
  const pad = phone
    ? { top: 70, bottom: innerHeight * 0.72 + 20, left: 30, right: 30 }
    : { top: 80, bottom: 80, left: 280, right: (drawer.querySelector('.tf-drawer-card') as HTMLElement).offsetWidth + 60 };
  if (pad.top + pad.bottom > innerHeight - 60) { pad.bottom = Math.max(20, innerHeight - pad.top - 80); }
  map.fitBounds(b, { padding: pad, maxZoom: 5, duration: reduceMotion.matches ? 0 : 900 });
}

// Region of the screen the drawer doesn't cover
function openArea() {
  const card = drawer.querySelector('.tf-drawer-card') as HTMLElement;
  if (isPhone()) return { left: 0, right: innerWidth, top: 60, bottom: innerHeight - card.offsetHeight };
  return { left: 0, right: drawer.getBoundingClientRect().left - 8, top: 0, bottom: innerHeight };
}
function mainBody(code: string): GeoJSON.Position[] | null {
  let best: GeoJSON.Position[] | null = null, n = 0;
  for (const f of allShapes?.features ?? []) {
    if (f.properties!.iso !== code) continue;
    const polys = f.geometry.type === 'MultiPolygon' ? (f.geometry as GeoJSON.MultiPolygon).coordinates : [(f.geometry as GeoJSON.Polygon).coordinates];
    for (const p of polys) if (p[0].length > n) { n = p[0].length; best = p[0]; }
  }
  return best;
}
// Bring a country into the part of the map the drawer leaves free, without zooming
function ensureVisible(code: string) {
  if (!ready) return;
  const ring = mainBody(code);
  if (!ring) return;
  const b = new LngLatBounds();
  ring.forEach((p) => b.extend(p as [number, number]));
  const c = b.getCenter();
  const pt = map.project(c);
  const a = openArea();
  const m = 40;
  if (pt.x > a.left + m && pt.x < a.right - m && pt.y > a.top + m && pt.y < a.bottom - m) return;
  const target = { x: (a.left + a.right) / 2, y: (a.top + a.bottom) / 2 };
  const centre = map.project(map.getCenter());
  map.easeTo({ center: map.unproject([centre.x + pt.x - target.x, centre.y + pt.y - target.y]), duration: reduceMotion.matches ? 0 : 700 });
}

function statusLine(code: string) {
  const r = data.ref[code];
  const parts = [visited.has(code) ? 'Visited' : 'Not visited yet'];
  if (r.b) parts.push(r.b);
  return parts.join(' · ');
}

function tripArticle(t: TripOut, current?: string) {
  const others = t.countries.filter((c) => c !== current);
  const meta = [formatPeriod(t.start, t.end), t.with ? `with ${esc(t.with)}` : ''].filter(Boolean).join(' · ');
  return `<article class="tf-trip">
    <h3 class="hand"><a href="#trip/${esc(t.id)}">${esc(t.title)}</a></h3>
    <p class="tf-meta">${meta}</p>
    ${others.length ? `<ul class="tf-places" aria-label="Also on this trip">${others.map(placeChip).join('')}</ul>` : ''}
    <div class="tf-story">${t.html}</div>
  </article>`;
}
const placeChip = (c: string) => `<li><button class="tf-place" type="button" data-country="${c}">${flagImg(c, '')}${esc(nameOf(c))}</button></li>`;

function factsBlock(code: string) {
  const f = formatFacts(unpackFacts(data.facts[code], data.sources), data.ref[code]?.cap);
  const rows = f.rows.map((r) => `<dt>${r.label}${r.info ? ` <button class="tf-info" type="button" aria-expanded="false" aria-controls="tf-hdi-pop" aria-label="About the Human Development Index"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button>` : ''}</dt><dd>${r.value ?? '<span class="tf-na">Not available</span>'}</dd>${r.info ? `<div id="tf-hdi-pop" class="tf-pop" hidden>${r.info}</div>` : ''}`).join('');
  return `<section aria-label="Country facts"><h2 class="tf-section-label">Country facts</h2><dl class="tf-facts">${rows}</dl>${f.source ? `<p class="tf-source">${f.source}</p>` : ''}</section>`;
}

function setHeader(html: string) { dTitles.innerHTML = html; }
function wireBody() {
  dBody.querySelectorAll<HTMLElement>('[data-country]').forEach((b) => b.addEventListener('click', () => go(`#${b.dataset.country!.toLowerCase()}`)));
  dBody.querySelectorAll<HTMLElement>('.tf-info').forEach(wirePop);
}

function renderCountry(code: string) {
  const r = data.ref[code];
  setHeader(`<div class="tf-d-flagline">${flagImg(code)}<h2 class="tf-d-name" id="tf-d-title">${esc(r.n)}</h2></div><p class="tf-d-status">${statusLine(code)}</p>`);
  // Country facts first, then the diary entries for that country
  const trips = tripsByCountry.get(code) ?? [];
  let body = factsBlock(code);
  if (visited.has(code)) {
    body += `<section aria-label="Diary"><h2 class="tf-section-label tf-diary-label">Diary</h2>${trips.length
      ? trips.map((t) => tripArticle(t, code)).join('')
      : `<p class="tf-empty">No diary entry yet.</p>`}</section>`;
  }
  dBody.innerHTML = body;
  wireBody();
  diaryBtn.setAttribute('aria-expanded', 'false');
  openDrawer();
  select([code]);
  requestAnimationFrame(() => ensureVisible(code));
}

function renderTrip(t: TripOut) {
  setHeader(`<h2 class="tf-d-title tf-trip-title hand" id="tf-d-title">${esc(t.title)}</h2><p class="tf-d-status">${[formatPeriod(t.start, t.end), t.with ? `with ${esc(t.with)}` : ''].filter(Boolean).join(' · ')}</p>`);
  dBody.innerHTML = `<article class="tf-trip tf-trip-view"><ul class="tf-places" aria-label="Countries">${t.countries.map(placeChip).join('')}</ul><div class="tf-story">${t.html}</div></article>`;
  wireBody();
  diaryBtn.setAttribute('aria-expanded', 'false');
  openDrawer();
  select(t.countries);
  fitTo(t.countries);
}

function renderDiary(tab: 'trips' | 'countries') {
  setHeader(`<h2 class="tf-d-title" id="tf-d-title">Diary</h2>
    <div class="tf-tabs" role="tablist" aria-label="Diary">
      <button class="tf-tab" role="tab" type="button" aria-selected="${tab === 'trips'}" data-tab="trips">Trips</button>
      <button class="tf-tab" role="tab" type="button" aria-selected="${tab === 'countries'}" data-tab="countries">Countries</button>
    </div>`);
  dTitles.querySelectorAll<HTMLElement>('.tf-tab').forEach((b) => b.addEventListener('click', () => {
    const next = b.dataset.tab === 'countries' ? '#diary/countries' : '#diary';
    if (location.hash !== next) { history.replaceState(null, '', next); route(); }
  }));
  if (tab === 'trips') {
    let html = '', year = '';
    for (const t of data.trips) {
      const y = t.start.slice(0, 4);
      if (y !== year) { html += `${year ? '</div>' : ''}<h3 class="tf-year">${y}</h3><div class="tf-rows">`; year = y; }
      html += `<a class="tf-row" href="#trip/${esc(t.id)}"><span class="tf-row-main"><span class="tf-row-name tf-row-trip hand">${esc(t.title)}</span><span class="tf-row-sub">${t.countries.map(nameOf).map(esc).join(', ')}</span></span><span class="tf-row-meta">${monthShort(t.start)}</span></a>`;
    }
    dBody.innerHTML = html ? html + '</div>' : '<p class="tf-empty">No trips written up yet.</p>';
  } else {
    const list = data.visited.slice().sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'en'));
    dBody.innerHTML = `<div class="tf-rows" style="margin-top:14px">${list.map((c) => {
      const ts = tripsByCountry.get(c) ?? [];
      // The year of the earliest diary entry: when the country was first "unlocked"
      const years = ts.map((t) => t.start.slice(0, 4)).sort()[0] ?? '';
      return `<a class="tf-row" href="#${c.toLowerCase()}"><span class="tf-row-main"><span class="tf-row-name">${flagImg(c, 'tf-flag')}${esc(nameOf(c))}</span></span><span class="tf-row-meta">${years}</span></a>`;
    }).join('')}</div>`;
  }
  diaryBtn.setAttribute('aria-expanded', 'true');
  openDrawer();
  select([]);
}

applyFine();
if (!ready) {
  // Lists and trips can open before the map is ready; countries are highlighted once it is
  const h = location.hash;
  if (h) route();
}
