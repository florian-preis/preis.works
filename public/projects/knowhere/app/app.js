/* knowhere: geography trainer. Florian Preis, preis.works */
(() => {
'use strict';

const KV = window.KV;
const ALL = window.KW_COUNTRIES;
const BY = {}; ALL.forEach(c => { BY[c.id] = c; });
const TOTAL = ALL.length;
const MODES = ['flags', 'capitals', 'locations'];
const ML = { flags: 'Flags', capitals: 'Capitals', locations: 'Locations' };
const REGIONS = [['europe', 'Europe'], ['asia', 'Asia'], ['africa', 'Africa'], ['americas', 'Americas'], ['oceania', 'Oceania']];
const DIFF = { easy: 1, medium: 2, hard: 3 };
const HOUR = 36e5, DAY = 864e5;
const INTERVAL = [0, 0, 1 * DAY, 3 * DAY, 8 * DAY, 21 * DAY]; // by box
const LEVELS = ['New', 'Learning', 'Familiar', 'Known'];
const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const flagSrc = id => `flags/${id}.svg`;

const ICON = {
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  cross: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  flame: '<svg viewBox="0 0 24 24"><path d="M12 3c.8 3.4 5 5.6 5 10.2A5 5 0 0 1 7 13.4c0-2.4 1.3-3.9 2.4-4.9.3 1.6 1 2.6 2 3 .6-2.7-.4-5.6.6-8.5z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  reset: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.7"/><path d="M4 4v4.7h4.7"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  loop: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.6-4.5L3 9"/><path d="M3 4v5h5"/><path d="M4 13a8 8 0 0 0 14.6 4.5L21 15"/><path d="M21 20v-5h-5"/></svg>',
  sliders: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
};

/* ── storage ─────────────────────────────────────────────── */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
};
const K = { s: 'kw3_settings', p: 'kw3_progress', h: 'kw3_history', d: 'kw3_daily', days: 'kw3_days', recent: 'kw3_recent', mig: 'kw3_migrated' };

const DEFAULTS = { regions: REGIONS.map(r => r[0]), diff: 'medium', style: 'choice', reverse: true, play: 'round', night: null };
let S = Object.assign({}, DEFAULTS, store.get(K.s, {}));
const saveS = () => store.set(K.s, S);
let P = store.get(K.p, {});
MODES.forEach(m => { P[m] = P[m] || {}; });
const saveP = () => store.set(K.p, P);
const getHist = () => store.get(K.h, []);
function addHist(e) { const h = getHist(); h.push(e); store.set(K.h, h.slice(-400)); }

/* ── text matching ───────────────────────────────────────── */
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\bsaint\b/g, 'st').replace(/\bthe\b/g, '').replace(/[^a-z0-9]/g, '');
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = new Array(n + 1), cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
const NAME_KEYS = {}, CAP_KEYS = {}, CAP_OWNER = {}, NAME_OWNER = {};
ALL.forEach(c => {
  NAME_KEYS[c.id] = [...new Set([c.name, ...c.nameAlt].map(norm).filter(x => x.length >= 2))];
  CAP_KEYS[c.id] = [...new Set([c.cap, ...c.capAlt].map(norm))];
  NAME_KEYS[c.id].forEach(k => { NAME_OWNER[k] = c.id; });
  CAP_KEYS[c.id].forEach(k => { CAP_OWNER[k] = c.id; });
});
const TRAPS = {}; ALL.forEach(c => c.traps.forEach(t => { if (!CAP_OWNER[norm(t)]) TRAPS[norm(t)] = t; }));
const CAP_LIST = [...new Set(ALL.map(c => c.cap))].sort((a, b) => a.localeCompare(b));
const NAME_LIST = ALL.map(c => c.name).sort((a, b) => a.localeCompare(b));

function matchAnswer(input, kind, id) {
  const n = norm(input); if (!n) return false;
  const acc = kind === 'capital' ? CAP_KEYS[id] : NAME_KEYS[id];
  if (acc.includes(n)) return true;
  const tol = n.length >= 9 ? 2 : n.length >= 5 ? 1 : 0;
  if (!tol) return false;
  let da = Infinity; for (const a of acc) da = Math.min(da, lev(a, n));
  if (da > tol) return false;
  const KEYS = kind === 'capital' ? CAP_KEYS : NAME_KEYS;
  for (const k in KEYS) {
    if (k === id) continue;
    for (const a of KEYS[k]) { if (Math.abs(a.length - n.length) > da) continue; if (lev(a, n) <= da) return false; }
  }
  if (kind === 'capital') for (const t in TRAPS) { if (Math.abs(t.length - n.length) <= da && lev(t, n) <= da) return false; }
  return true;
}
function suggest(input, kind) {
  const n = norm(input); if (n.length < 2) return [];
  const list = kind === 'capital' ? CAP_LIST : NAME_LIST;
  const starts = list.filter(x => norm(x).startsWith(n));
  const inner = list.filter(x => !norm(x).startsWith(n) && norm(x).includes(n));
  return [...starts, ...inner].slice(0, 4);
}
/* who a typed or chosen answer belongs to, for the "mixed up with" memory */
function confKeyFor(text, kind) {
  const n = norm(text); if (!n) return null;
  if (kind === 'capital') { if (CAP_OWNER[n]) return CAP_OWNER[n]; if (TRAPS[n]) return '~' + TRAPS[n]; return null; }
  return NAME_OWNER[n] || null;
}
const confLabel = (key, mode) => key[0] === '~' ? key.slice(1) : BY[key] ? (mode === 'capitals' ? BY[key].cap : BY[key].name) : '';

/* ── migration from the first version ─────────────────────── */
function migrate() {
  if (store.get(K.mig, false)) return;
  try {
    const now = Date.now();
    const os = store.get('kw_s', null);
    if (os && store.get(K.s, null) == null) {
      if (Array.isArray(os.regions) && os.regions.length) {
        S.regions = os.regions.filter(r => REGIONS.some(x => x[0] === r));
        if (S.regions.length === 4) S.regions.push('oceania');
        if (!S.regions.length) S.regions = DEFAULTS.regions.slice();
      }
      if (DIFF[os.diff]) S.diff = os.diff;
      S.style = os.style === 'type' ? 'type' : 'choice';
      S.play = os.mode === 'marathon' ? 'marathon' : 'round';
    }
    try { if (localStorage.getItem('kw_night') === '1') S.night = true; } catch (e) { /* ignore */ }
    const legacyName = { 'n. macedonia': 'mk', 'uae': 'ae', 'rep. of congo': 'cg', 'dominican rep.': 'do', 'bosnia & herzegovina': 'ba' };
    const ow = store.get('kw_wrong2', {});
    for (const m of MODES) {
      const mw = ow[m] || {};
      for (const id in mw) {
        if (!BY[id]) continue;
        const cnt = (mw[id] && mw[id].count) || 1;
        const r = P[m][id] || { b: 1, n: 0, c: 0, w: 0, last: now - HOUR, due: 0, conf: {} };
        r.b = 1; r.n += cnt; r.w += cnt; r.due = 0;
        ((mw[id] && mw[id].mistakes) || []).forEach(x => {
          const sel = String(x.selected || '');
          const k = m === 'capitals' ? confKeyFor(sel, 'capital') : (legacyName[sel.toLowerCase()] || confKeyFor(sel, 'country'));
          if (k && k !== id) r.conf[k] = (r.conf[k] || 0) + 1;
        });
        P[m][id] = r;
      }
    }
    const ob = store.get('kw_board', []);
    if (ob.length) {
      const hist = getHist();
      ob.forEach(e => {
        const t = Date.parse(e.date) || now;
        const mm = String(e.time || '').match(/(\d+)m\s*(\d+)s/);
        const mar = e.gamemode === 'marathon';
        hist.push({ t, kind: mar ? 'marathon' : 'round', mode: e.mode, correct: mar ? (e.streak || 0) : (e.correct || 0), total: e.total || 10, secs: mm ? (+mm[1]) * 60 + (+mm[2]) : 0, best: e.streak || 0 });
      });
      hist.sort((a, b) => a.t - b.t);
      store.set(K.h, hist.slice(-400));
    }
    saveS(); saveP();
  } catch (e) { /* keep going with fresh data */ }
  store.set(K.mig, true);
}

/* ── random helpers ──────────────────────────────────────── */
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return mulberry(h >>> 0); }
function shuffle(a, rng = Math.random) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/* keep the right answer from sitting in the same slot twice in a row */
function place(opts, correct, rng, pos) {
  let i = opts.indexOf(correct);
  if (i === pos.p) { const j = (i + 1 + Math.floor(rng() * (opts.length - 1))) % opts.length; [opts[i], opts[j]] = [opts[j], opts[i]]; i = j; }
  pos.p = i; return opts;
}
const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/* ── trainer ─────────────────────────────────────────────── */
function level(r) { if (!r || !r.n) return 0; if (r.b <= 1) return 1; if (r.b === 2) return 2; return 3; }
function record(mode, id, ok, confKey) {
  const now = Date.now();
  const r = P[mode][id] || { b: 0, n: 0, c: 0, w: 0, last: 0, due: 0, conf: {} };
  if (ok) {
    if (!r.n) r.b = 2;                        // knew it first time: skip ahead
    else if (now >= r.due) r.b = Math.min(5, r.b + 1);
    r.c++;
  } else {
    r.b = 1; r.w++;
    if (confKey && confKey !== id) r.conf[confKey] = (r.conf[confKey] || 0) + 1;
  }
  r.n++; r.last = now; r.due = now + INTERVAL[r.b];
  P[mode][id] = r; saveP();
}
function topConf(r) {
  if (!r || !r.conf) return null;
  let best = null, n = 0; for (const k in r.conf) if (r.conf[k] > n) { n = r.conf[k]; best = k; }
  return best;
}
function pushRecent(mode, id) { const R = store.get(K.recent, {}); R[mode] = (R[mode] || []).concat(id).slice(-30); store.set(K.recent, R); }

function pool() {
  const lim = DIFF[S.diff] || 2;
  let p = ALL.filter(c => S.regions.includes(c.r) && c.d <= lim);
  if (p.length < 10) {
    const extra = ALL.filter(c => S.regions.includes(c.r) && c.d > lim).sort((a, b) => a.d - b.d);
    p = p.concat(extra.slice(0, 10 - p.length));
  }
  return p;
}

function pickRound(mode) {
  const pl = pool(), pr = P[mode], now = Date.now();
  const recent = new Set((store.get(K.recent, {})[mode] || []).slice(-20));
  const weak = [], due = [], fresh = [], rest = [];
  for (const c of pl) {
    const r = pr[c.id];
    if (!r || !r.n) fresh.push(c);
    else if (r.b <= 1) weak.push(c);
    else if (now >= r.due) due.push(c);
    else rest.push(c);
  }
  weak.sort((a, b) => pr[a.id].last - pr[b.id].last);
  due.sort((a, b) => pr[a.id].due - pr[b.id].due);
  const spread = S.diff === 'hard' ? 2.6 : 1.6;
  const fk = {}; fresh.forEach(c => { fk[c.id] = c.d + Math.random() * spread; });
  fresh.sort((a, b) => fk[a.id] - fk[b.id]);
  rest.sort((a, b) => pr[a.id].last - pr[b.id].last);
  const N = Math.min(10, pl.length), out = [], used = new Set();
  const take = (arr, lim, skipRecent) => {
    for (const c of arr) {
      if (out.length >= N || lim <= 0) break;
      if (used.has(c.id) || (skipRecent && recent.has(c.id))) continue;
      out.push(c); used.add(c.id); lim--;
    }
  };
  take(weak, 3, false); take(due, 3, true); take(fresh, N, true); take(due, N, true);
  take(weak, N, false); take(rest, N, true); take(due, N, false); take(fresh, N, false); take(rest, N, false);
  return shuffle(out);
}
function learningItems(onlyMode) {
  const out = [];
  for (const m of MODES) {
    if (onlyMode && m !== onlyMode) continue;
    for (const id in P[m]) { const r = P[m][id]; if (BY[id] && r.n && r.b <= 1) out.push({ mode: m, id, last: r.last }); }
  }
  return out.sort((a, b) => a.last - b.last);
}

/* ── question building ───────────────────────────────────── */
const trivialCap = c => { const a = norm(c.cap), b = norm(c.name); return a.includes(b) || b.includes(a); };

function countryOpts(c, mode, o) {
  const rng = o.rng, lvl = o.lvl;
  const picked = [c.id];
  const add = id => { if (id && BY[id] && !picked.includes(id) && picked.length < 4) picked.push(id); };
  if (o.personal) { const k = topConf(P[mode][c.id]); if (k && k[0] !== '~') add(k); }
  const nearN = { 1: 1, 2: 2, 3: 3 }[lvl];
  const near = mode === 'flags'
    ? shuffle(c.look.slice(), rng).concat(shuffle(c.near.slice(0, 6), rng))
    : shuffle(c.near.slice(0, 6), rng);
  for (const id of near) { if (picked.length >= 1 + nearN) break; add(id); }
  shuffle(ALL.filter(x => x.r === c.r && x.d <= lvl + 1), rng).forEach(x => add(x.id));
  shuffle(ALL.filter(x => x.r === c.r), rng).forEach(x => add(x.id));
  shuffle(ALL.slice(), rng).forEach(x => add(x.id));
  return place(shuffle(picked, rng), c.id, rng, o.pos);
}
function capOpts(c, o) {
  const rng = o.rng, lvl = o.lvl;
  const out = [c.cap], seen = new Set(CAP_KEYS[c.id]);
  const add = s => { const k = norm(s); if (!s || seen.has(k) || out.length >= 4) return; seen.add(k); out.push(s); };
  if (o.personal) { const k = topConf(P.capitals[c.id]); if (k) add(k[0] === '~' ? k.slice(1) : BY[k] && BY[k].cap); }
  const trapN = lvl === 1 ? (rng() < 0.35 ? 1 : 0) : lvl === 2 ? 1 : 2;
  shuffle(c.traps.slice(), rng).slice(0, trapN).forEach(add);
  const nearN = { 1: 0, 2: 1, 3: 2 }[lvl];
  shuffle(c.near.slice(0, 6), rng).slice(0, nearN).forEach(id => add(BY[id].cap));
  shuffle(ALL.filter(x => x.r === c.r && x.id !== c.id && x.d <= lvl + 1), rng).forEach(x => add(x.cap));
  shuffle(ALL.slice(), rng).forEach(x => add(x.cap));
  return place(shuffle(out, rng), c.cap, rng, o.pos);
}
function makeQ(mode, c, o) {
  o = Object.assign({ rng: Math.random, allowReverse: false, style: 'choice', personal: false, lvl: 2, pos: { p: -1 } }, o);
  const r = P[mode][c.id];
  let dir = 'fwd';
  if (o.allowReverse && S.reverse && r && r.b >= 2 && o.rng() < 0.5 && !(mode === 'capitals' && trivialCap(c))) dir = 'rev';
  const q = { mode, id: c.id, dir };
  const typed = o.style === 'type';
  if (mode === 'flags') {
    if (dir === 'fwd') { q.ans = 'country'; q.input = typed ? 'type' : 'choice'; }
    else { q.ans = 'flag'; q.input = 'choice'; }
  } else if (mode === 'capitals') {
    q.ans = dir === 'fwd' ? 'capital' : 'country'; q.input = typed ? 'type' : 'choice';
  } else {
    if (dir === 'fwd') { q.ans = 'country'; q.input = typed ? 'type' : 'choice'; }
    else { q.ans = 'map'; q.input = 'choice'; }
  }
  if (q.input === 'choice') q.opts = q.ans === 'capital' ? capOpts(c, o) : countryOpts(c, mode, o);
  return q;
}

/* ── daily ───────────────────────────────────────────────── */
function dailyItems(key) {
  const rng = seeded('knowhere-daily-' + key);
  const pos = { p: -1 };
  const pick = (d, n) => shuffle(ALL.filter(c => c.d === d), rng).slice(0, n);
  const cs = [...pick(1, 3), ...pick(2, 4), ...pick(3, 3)];
  const modes = shuffle(['flags', 'capitals', 'locations', 'flags', 'capitals', 'locations', 'flags', 'capitals', 'locations', MODES[Math.floor(rng() * 3)]], rng);
  return cs.map((c, i) => makeQ(modes[i], c, { rng, allowReverse: false, style: 'choice', personal: false, lvl: 2, pos }));
}
const dailyAll = () => store.get(K.d, {});
const dailyState = (key = dateKey()) => dailyAll()[key] || null;
function saveDaily(st, key = dateKey()) { const all = dailyAll(); all[key] = st; const keys = Object.keys(all).sort(); while (keys.length > 120) delete all[keys.shift()]; store.set(K.d, all); }
function streakFrom(set) {
  const d = new Date(); let n = 0;
  if (!set.has(dateKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(dateKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const dailyStreak = () => { const all = dailyAll(); return streakFrom(new Set(Object.keys(all).filter(k => all[k] && all[k].done))); };
function markDay() { const days = store.get(K.days, []); const k = dateKey(); if (!days.includes(k)) { days.push(k); store.set(K.days, days.slice(-400)); } }
const dayStreak = () => streakFrom(new Set(store.get(K.days, [])));
function shareText(st) {
  const d = new Date();
  const url = /^https?:/.test(location.protocol) ? location.origin + location.pathname : 'https://preis.works/projects/knowhere/app/';
  return `knowhere daily, ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}\n${st.marks.filter(Boolean).length}/10 in ${fmt(st.secs)}\n${st.marks.map(m => m ? '🟩' : '🟥').join('')}\n${url}`;
}
function shareDaily() {
  const st = dailyState(); if (!st || !st.done) return;
  const text = shareText(st);
  if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Result copied'), () => toast('Could not copy'));
  else toast('Sharing is not available here');
}

/* ── map ─────────────────────────────────────────────────── */
const MAP = { feat: null, byId: {}, p: null };
function loadMap() {
  if (!MAP.p) {
    MAP.p = fetch('world.json').then(r => { if (!r.ok) throw new Error('map'); return r.json(); }).then(t => {
      MAP.feat = KV.feature(t, t.objects.countries).features;
      MAP.byId = {}; MAP.feat.forEach(f => { if (f.id) (MAP.byId[f.id] = MAP.byId[f.id] || []).push(f); });
      return MAP;
    }).catch(e => { MAP.p = null; throw e; });
  }
  return MAP.p;
}
const fcOf = ids => ({ type: 'FeatureCollection', features: ids.flatMap(id => MAP.byId[id] || []) });
const centreLon = c => (c.ll[1] > 150 || c.ll[1] < -150) ? 170 : 0;
function worldProj(W, H, lon) {
  return KV.geoNaturalEarth1().rotate([-lon, 0]).fitExtent([[6, 6], [W - 6, H - 6]], { type: 'FeatureCollection', features: MAP.feat });
}

function drawQuestionMap(box, id) {
  box._ready = false;
  loadMap().then(() => {
    if (!box.isConnected) return;
    const c = BY[id];
    const W = box.clientWidth || 360, H = box.clientHeight || 240;
    const pr = worldProj(W, H, centreLon(c)), path = KV.geoPath(pr);
    box.querySelectorAll(':scope > svg, :scope > .map-msg').forEach(n => n.remove());
    const svg = KV.select(box).insert('svg', ':first-child').attr('viewBox', `0 0 ${W} ${H}`).attr('aria-hidden', 'true');
    const g = svg.append('g');
    g.selectAll('path').data(MAP.feat).join('path').attr('d', path).attr('class', d => d.id === id ? 'land hl' : 'land');
    g.selectAll('path.hl').raise();
    const fc = fcOf([id]);
    let k, cx, cy, size = 0;
    if (fc.features.length) {
      const [[x0, y0], [x1, y1]] = path.bounds(fc), w = x1 - x0, h = y1 - y0;
      if (w > W * 0.55 && c.area < 3e6) { [cx, cy] = pr([c.ll[1], c.ll[0]]); k = 5; }
      else { cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; k = Math.min(W / (w * 1.8), H / (h * 1.8)); }
      k = Math.max(1.15, Math.min(k, 14)); size = Math.max(w, h) * k;
    } else { [cx, cy] = pr([c.ll[1], c.ll[0]]); k = 6; }
    // small islands and microstates: a wider view so there is land around them to recognise, plus a ring
    if (c.r === 'oceania' && c.area < 50000) { const k0 = k; [cx, cy] = pr([c.ll[1], c.ll[0]]); k = 2.4; size = size * k / k0; }
    else if (size < 16 || c.area < 25000) { const k0 = k; k = Math.min(k, 6); size = size * k / k0; }
    if (size < 16 || c.area < 25000 || (c.r === 'oceania' && c.area < 50000)) {
      g.append('circle').attr('class', 'ring').attr('cx', cx).attr('cy', cy).attr('r', Math.max(13, Math.min(size, 30) / 2 + 7) / k);
      if (!fc.features.length || c.area < 5000) g.append('circle').attr('class', 'ringdot').attr('cx', cx).attr('cy', cy).attr('r', 2.4 / k);
    }
    const z = KV.zoom().scaleExtent([1, 40]).on('zoom', e => g.attr('transform', e.transform));
    svg.call(z).on('dblclick.zoom', null);
    const T = KV.zoomIdentity.translate(W / 2 - k * cx, H / 2 - k * cy).scale(k);
    const go = () => svg.transition().duration(RM ? 0 : 1100).ease(KV.easeCubicInOut).call(z.transform, T);
    if (RM) svg.call(z.transform, T);
    else { svg.call(z.transform, KV.zoomIdentity); setTimeout(() => { if (box.isConnected) go(); }, 160); }
    box._reset = go;
    box._mark = other => { g.selectAll('path').filter(d => d.id === other).attr('class', 'land wrong').raise(); g.selectAll('path.hl').raise(); };
    box._ready = true;
  }).catch(() => { if (box.isConnected) box.innerHTML = '<div class="map-msg">Map unavailable</div>'; });
}

function drawMinis(q) {
  loadMap().then(() => {
    const c = BY[q.id];
    q.opts.forEach((id, i) => {
      const box = $('mini-' + i); if (!box || !box.isConnected) return;
      const W = box.clientWidth || 170, H = box.clientHeight || 118;
      const pr = KV.geoNaturalEarth1().rotate([-centreLon(c), 0]);
      const shapes = fcOf(q.opts).features;
      const pts = q.opts.filter(x => !MAP.byId[x]).map(x => [BY[x].ll[1], BY[x].ll[0]]);
      const fit = { type: 'FeatureCollection', features: shapes.concat(pts.length ? [{ type: 'Feature', geometry: { type: 'MultiPoint', coordinates: pts } }] : []) };
      pr.fitExtent([[10, 10], [W - 10, H - 10]], fit);
      // never zoom closer than a small region
      const maxS = W * 7;
      if (pr.scale() > maxS) {
        const centre = KV.geoCentroid(fit);
        pr.scale(maxS); const p = pr(centre), t = pr.translate();
        pr.translate([t[0] + W / 2 - p[0], t[1] + H / 2 - p[1]]);
      }
      const path = KV.geoPath(pr);
      box.innerHTML = '';
      const svg = KV.select(box).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('aria-hidden', 'true');
      svg.selectAll('path').data(MAP.feat).join('path').attr('d', path).attr('class', d => d.id === id ? 'land hl' : 'land');
      svg.selectAll('path.hl').raise();
      const fc = fcOf([id]);
      let size = 0, cxy = pr([BY[id].ll[1], BY[id].ll[0]]);
      if (fc.features.length) { const [[x0, y0], [x1, y1]] = path.bounds(fc); size = Math.max(x1 - x0, y1 - y0); if (size < 400) cxy = [(x0 + x1) / 2, (y0 + y1) / 2]; }
      if (size < 9 && cxy) {
        svg.append('circle').attr('class', 'ring').attr('cx', cxy[0]).attr('cy', cxy[1]).attr('r', 10);
        if (!fc.features.length) svg.append('circle').attr('class', 'ringdot').attr('cx', cxy[0]).attr('cy', cxy[1]).attr('r', 2.4);
      }
    });
  }).catch(() => { q.opts.forEach((_, i) => { const b = $('mini-' + i); if (b) b.innerHTML = '<div class="map-msg">Map unavailable</div>'; }); });
}

/* ── quiz session ────────────────────────────────────────── */
let QZ = null, token = 0, tick = null;
const posState = { p: -1 };

function startSession(kind, mode) {
  let items = [], startI = 0, res = [], t0 = Date.now();
  const lvl = DIFF[S.diff] || 2;
  if (kind === 'round') {
    items = pickRound(mode).map(c => makeQ(mode, c, { allowReverse: true, style: S.style, personal: true, lvl, pos: posState }));
  } else if (kind === 'practice') {
    items = learningItems(mode).slice(0, 10).map(x => makeQ(x.mode, BY[x.id], { allowReverse: false, style: S.style, personal: true, lvl, pos: posState }));
    shuffle(items);
  } else if (kind === 'daily') {
    const st = dailyState();
    if (st && st.done) { showDailyEnd(); return; }
    items = dailyItems(dateKey());
    if (st && st.marks) { startI = st.marks.length; res = st.marks.map((ok, i) => ({ q: items[i], ok: !!ok, given: st.given ? st.given[i] : '' })); t0 = Date.now() - (st.secs || 0) * 1000; }
  }
  if (kind !== 'marathon' && !items.length) { toast(kind === 'practice' ? 'Nothing to practise right now' : 'No countries in play'); return; }
  token++;
  QZ = { kind, mode, items, i: startI, res, streak: 0, best: 0, t0, answered: false, done: false, deck: [], day: dateKey() };
  showScreen('quiz');
  renderQ();
  startTick();
}
function nextMarathonItem() {
  if (!QZ.deck.length) {
    const recent = new Set(QZ.items.slice(-5).map(q => q.id));
    QZ.deck = shuffle(pool().filter(c => !recent.has(c.id)));
    if (!QZ.deck.length) QZ.deck = shuffle(pool());
  }
  const c = QZ.deck.pop();
  return makeQ(QZ.mode, c, { allowReverse: true, style: S.style, personal: true, lvl: DIFF[S.diff] || 2, pos: posState });
}
function current() {
  if (QZ.kind === 'marathon' && !QZ.items[QZ.i]) QZ.items[QZ.i] = nextMarathonItem();
  return QZ.items[QZ.i];
}
function startTick() {
  stopTick();
  tick = setInterval(() => { const el = $('qtimer'); if (el && QZ && !QZ.done) el.textContent = fmt(Math.floor((Date.now() - QZ.t0) / 1000)); }, 500);
}
function stopTick() { if (tick) { clearInterval(tick); tick = null; } }

function headerHTML(q) {
  const mar = QZ.kind === 'marathon';
  const total = QZ.items.length;
  const pct = mar ? 0 : Math.round(QZ.i / total * 100);
  const ctr = mar ? `Run ${QZ.streak}` : `${QZ.i + 1}/${total}`;
  const tag = QZ.kind === 'daily' ? `Daily · ${ML[q.mode]}` : QZ.kind === 'practice' ? `Practice · ${ML[q.mode]}` : mar ? `Marathon · ${ML[q.mode]}` : ML[q.mode];
  return `<div class="qhd"><button class="qx" id="qx" aria-label="Quit">${ICON.cross}</button>
    <div class="qpt"${mar ? ' style="visibility:hidden"' : ''}><div class="qpf" style="width:${pct}%"></div></div>
    <span class="qctr" id="qctr">${ctr}</span></div>
    <div class="qmeta"><span class="qtag">${esc(tag)}</span><div class="qright">
    <span class="qtimer" id="qtimer">${fmt(Math.floor((Date.now() - QZ.t0) / 1000))}</span>
    <span class="qstrk${QZ.streak >= 3 ? ' hot' : ''}" id="qstrk" title="Streak">${ICON.flame}<span id="qsn">${QZ.streak}</span></span></div></div>`;
}
function optionsHTML(q) {
  if (q.input === 'type') {
    const what = q.ans === 'capital' ? 'capital' : 'country';
    return `<div class="qcard"><div class="tin" style="padding-top:14px"><div class="tin-row">
      <input class="ci" id="ci" type="text" inputmode="text" enterkeyhint="go" placeholder="Type the ${what}" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" aria-label="Your answer">
      <button class="btn-ink" id="cbtn">Check</button></div><div class="sugg" id="sugg"></div></div></div>`;
  }
  if (q.ans === 'flag') return `<div class="choices">${q.opts.map((id, i) => `<button class="ch ch-img" data-i="${i}" aria-label="Flag ${i + 1}"><img src="${flagSrc(id)}" alt="" width="160" height="120"></button>`).join('')}</div>`;
  if (q.ans === 'map') return `<div class="choices">${q.opts.map((id, i) => `<button class="ch ch-map" data-i="${i}" aria-label="Map ${i + 1}"><div class="mini" id="mini-${i}"></div></button>`).join('')}</div>`;
  const label = v => q.ans === 'capital' ? v : BY[v].name;
  return `<div class="choices">${q.opts.map((v, i) => `<button class="ch" data-i="${i}"><span class="key">${i + 1}</span>${esc(label(v))}</button>`).join('')}</div>`;
}
function promptHTML(q) {
  const c = BY[q.id];
  if (q.mode === 'flags' && q.dir === 'fwd') return `<div class="qcard"><div class="qpad"><img class="flag-main" src="${flagSrc(c.id)}" alt="Flag to identify" width="200" height="150"><div class="qprompt">Which country is this?</div></div></div>`;
  if (q.mode === 'flags') return `<div class="qcard"><div class="qpad"><div class="qbig">${esc(c.name)}</div><div class="qprompt">Which flag is it?</div></div></div>`;
  if (q.mode === 'capitals' && q.dir === 'fwd') return `<div class="qcard"><div class="qpad"><img class="flag-sm" src="${flagSrc(c.id)}" alt="" width="44" height="33"><div class="qbig">${esc(c.name)}</div><div class="qprompt">What's the capital?</div></div></div>`;
  if (q.mode === 'capitals') return `<div class="qcard"><div class="qpad"><div class="qbig">${esc(c.cap)}</div><div class="qprompt">is the capital of which country?</div></div></div>`;
  if (q.dir === 'fwd') return `<div class="qcard"><div class="mapbox" id="qmap"><div class="map-msg">Loading map</div><button class="map-reset" id="map-reset" aria-label="Recentre map">${ICON.reset}</button></div><div class="qprompt" style="margin:0;padding:12px 16px">Which country is highlighted?</div></div>`;
  return `<div class="qcard"><div class="qpad"><div class="qbig">${esc(c.name)}</div><div class="qprompt">Where is it?</div></div></div>`;
}
function renderQ() {
  const q = current();
  QZ.answered = false;
  $('quiz-body').innerHTML = headerHTML(q) + promptHTML(q) + optionsHTML(q) + '<div id="fbslot"></div>';
  $('qx').addEventListener('click', quitSession);
  document.querySelectorAll('#quiz-body .ch').forEach(b => b.addEventListener('click', () => choose(+b.dataset.i)));
  if (q.input === 'type') {
    const inp = $('ci');
    $('cbtn').addEventListener('click', () => submitType());
    inp.addEventListener('input', () => renderSugg(q));
    setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 50);
  }
  if (q.mode === 'locations' && q.dir === 'fwd') { const box = $('qmap'); drawQuestionMap(box, q.id); $('map-reset').addEventListener('click', () => box._reset && box._reset()); }
  if (q.ans === 'map') drawMinis(q);
  const nq = QZ.items[QZ.i + 1];
  if (nq) { new Image().src = flagSrc(nq.id); if (nq.ans === 'flag') nq.opts.forEach(id => { new Image().src = flagSrc(id); }); }
  $('screen-quiz').scrollTop = 0;
}
function renderSugg(q) {
  const box = $('sugg'); if (!box || QZ.answered) return;
  const list = suggest($('ci').value, q.ans === 'capital' ? 'capital' : 'country');
  box.innerHTML = list.map(s => `<button class="sg" type="button">${esc(s)}</button>`).join('');
  box.querySelectorAll('.sg').forEach((b, i) => b.addEventListener('click', () => { $('ci').value = list[i]; submitType(); }));
}
function choose(i) {
  if (!QZ || QZ.answered || QZ.done) return;
  const q = current(), c = BY[q.id];
  let ok, given, key;
  if (q.ans === 'capital') { given = q.opts[i]; ok = given === c.cap; key = confKeyFor(given, 'capital'); }
  else { ok = q.opts[i] === q.id; key = q.opts[i]; given = BY[q.opts[i]].name; }
  const right = q.ans === 'capital' ? q.opts.indexOf(c.cap) : q.opts.indexOf(q.id);
  document.querySelectorAll('#quiz-body .ch').forEach((b, j) => {
    b.disabled = true;
    if (j === right) b.classList.add('ok');
    if (j === i && !ok) b.classList.add('no');
  });
  if (!ok && q.mode === 'locations' && q.dir === 'fwd') { const box = $('qmap'); if (box && box._mark) box._mark(q.opts[i]); }
  resolve(ok, given, key);
}
function submitType() {
  if (!QZ || QZ.answered || QZ.done) return;
  const q = current(), inp = $('ci'); if (!inp) return;
  const val = inp.value.trim();
  if (!val) { inp.focus(); return; }
  const kind = q.ans === 'capital' ? 'capital' : 'country';
  const ok = matchAnswer(val, kind, q.id);
  inp.disabled = true; inp.classList.add(ok ? 'ok' : 'no');
  $('cbtn').disabled = true;
  const sg = $('sugg'); if (sg) sg.innerHTML = '';
  if (ok) inp.value = kind === 'capital' ? BY[q.id].cap : BY[q.id].name;
  resolve(ok, val, confKeyFor(val, kind));
}
function resolve(ok, given, key) {
  QZ.answered = true;
  const q = current(), c = BY[q.id];
  record(q.mode, q.id, ok, ok ? null : key);
  pushRecent(q.mode, q.id);
  QZ.res.push({ q, ok, given });
  if (ok) { QZ.streak++; QZ.best = Math.max(QZ.best, QZ.streak); } else QZ.streak = 0;
  const sn = $('qsn'); if (sn) sn.textContent = QZ.streak;
  const st = $('qstrk'); if (st) st.classList.toggle('hot', QZ.streak >= 3);
  if (QZ.kind === 'marathon') $('qctr').textContent = `Run ${QZ.res.filter(r => r.ok).length}`;
  if (QZ.kind === 'daily') {
    const secs = Math.floor((Date.now() - QZ.t0) / 1000);
    saveDaily({ marks: QZ.res.map(r => r.ok ? 1 : 0), given: QZ.res.map(r => r.ok ? '' : r.given), secs, done: false }, QZ.day);
  }
  const t = token;
  if (ok) {
    setTimeout(() => { if (t === token && QZ && QZ.answered && !QZ.done) advance(); }, q.input === 'type' ? 850 : 650);
    return;
  }
  const isCap = q.ans === 'capital';
  const alts = isCap && c.capAlt.length ? ` (also ${c.capAlt.filter(a => norm(a) !== norm(c.cap)).slice(0, 2).join(', ')})` : '';
  let v = isCap ? `It's ${c.cap}` : `It's ${c.name}`;
  let d = isCap ? `${c.cap} is the capital of ${c.name}${alts}.` : q.mode === 'capitals' ? `${c.cap} is the capital of ${c.name}.` : '';
  if (given) {
    const owner = key && key[0] !== '~' && BY[key] ? BY[key] : null;
    if (isCap && owner) d += ` ${owner.cap} is the capital of ${owner.name}.`;
    else if (!isCap && q.input === 'type') d += `${d ? ' ' : ''}You wrote ${given}.`;
    else if (!isCap && q.ans !== 'flag' && q.ans !== 'map') d += `${d ? ' ' : ''}Not ${given}.`;
  }
  const last = QZ.kind === 'marathon' || (QZ.kind !== 'marathon' && QZ.i + 1 >= QZ.items.length);
  $('fbslot').innerHTML = `<div class="fb"><div class="fb-body"><div class="fb-v no">${esc(v)}</div>${d ? `<div class="fb-d">${esc(d)}</div>` : ''}</div>
    <button class="btn-ink" id="fbnext">${last ? 'See result' : 'Next'}</button></div>`;
  $('fbnext').addEventListener('click', () => { if (t === token) advance(); });
  setTimeout(() => { const b = $('fbnext'); if (b && (q.input === 'type' || matchMedia('(hover:hover)').matches)) b.focus({ preventScroll: true }); }, 30);
  $('fbslot').scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' });
}
function advance() {
  if (!QZ || QZ.done) return;
  const lastOk = QZ.res.length ? QZ.res[QZ.res.length - 1].ok : true;
  QZ.i++;
  if (QZ.kind === 'marathon') { if (!lastOk) return endSession(); return renderQ(); }
  if (QZ.i >= QZ.items.length) return endSession();
  renderQ();
}
function quitSession() { token++; stopTick(); if (QZ) QZ.done = true; QZ = null; showScreen('home'); }

function endSession() {
  token++; stopTick();
  QZ.done = true;
  const secs = Math.floor((Date.now() - QZ.t0) / 1000);
  const correct = QZ.res.filter(r => r.ok).length;
  const now = Date.now();
  markDay();
  if (QZ.kind === 'daily') {
    saveDaily({ marks: QZ.res.map(r => r.ok ? 1 : 0), given: QZ.res.map(r => r.ok ? '' : r.given), secs, done: true }, QZ.day);
    addHist({ t: now, kind: 'daily', mode: 'mixed', correct, total: QZ.res.length, secs, best: QZ.best });
    return showDailyEnd(QZ.res);
  }
  if (QZ.kind === 'marathon') {
    const prevBest = bestRun();
    addHist({ t: now, kind: 'marathon', mode: QZ.mode, correct, total: QZ.res.length, secs, best: correct });
    const miss = QZ.res.filter(r => !r.ok);
    $('quiz-body').innerHTML = `<div class="rcs">
      <div class="eyebrow">Run over · ${ML[QZ.mode]}</div>
      <div class="rc-big">${correct}</div>
      <div class="rc-sub">${correct > prevBest ? 'New best run' : `Best run ${prevBest}`} · ${fmt(secs)}</div>
      ${miss.length ? `<div class="review">${miss.map(reviewRow).join('')}</div>` : ''}
      <div class="rc-acts"><button class="btn-ink" id="again">Go again</button><button class="btn-line" id="home">Home</button></div></div>`;
  } else {
    addHist({ t: now, kind: QZ.kind, mode: QZ.kind === 'practice' ? 'mixed' : QZ.mode, correct, total: QZ.res.length, secs, best: QZ.best });
    const title = QZ.kind === 'practice' ? 'Practice done' : `Round complete · ${ML[QZ.mode]}`;
    $('quiz-body').innerHTML = `<div class="rcs">
      <div class="eyebrow">${title}</div>
      <div class="rc-big">${correct}<small>/${QZ.res.length}</small></div>
      <div class="rc-sub">${fmt(secs)} · best streak ${QZ.best}</div>
      <div class="review">${QZ.res.map(reviewRow).join('')}</div>
      <div class="rc-acts"><button class="btn-ink" id="again">${QZ.kind === 'practice' ? 'Practise more' : 'Play again'}</button><button class="btn-line" id="home">Home</button></div></div>`;
  }
  const { kind, mode } = QZ;
  $('again').addEventListener('click', () => startSession(kind, kind === 'practice' ? null : mode));
  $('home').addEventListener('click', () => showScreen('home'));
  $('screen-quiz').scrollTop = 0;
}
function reviewRow(r) {
  const c = BY[r.q.id];
  const what = r.q.mode === 'capitals' ? c.cap : r.q.mode === 'locations' ? c.sub : '';
  const said = !r.ok && r.given ? `you said ${r.given}` : '';
  const d = [what, said].filter(Boolean).join(' · ');
  return `<div class="rv-row"><img class="flag-xs" src="${flagSrc(c.id)}" alt="" width="28" height="21"><div class="rv-main"><div class="rv-name">${esc(c.name)}</div>${d ? `<div class="rv-d">${esc(d)}</div>` : ''}</div><span class="mk ${r.ok ? 'ok' : 'no'}" aria-label="${r.ok ? 'Correct' : 'Wrong'}">${r.ok ? ICON.check : ICON.cross}</span></div>`;
}
function showDailyEnd(res) {
  const st = dailyState(); if (!st) return showScreen('home');
  if (!res) { const items = dailyItems(dateKey()); res = st.marks.map((ok, i) => ({ q: items[i], ok: !!ok, given: st.given ? st.given[i] : '' })); }
  QZ = { kind: 'daily', done: true, res };
  showScreen('quiz');
  const score = st.marks.filter(Boolean).length;
  $('quiz-body').innerHTML = `<div class="rcs">
    <div class="eyebrow">Daily · ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    <div class="rc-big">${score}<small>/10</small></div>
    <div class="dots" style="justify-content:center">${st.marks.map(m => `<span class="dot ${m ? 'ok' : 'no'}"></span>`).join('')}</div>
    <div class="rc-sub">${fmt(st.secs)} · daily streak ${dailyStreak()}</div>
    <div class="review">${res.map(reviewRow).join('')}</div>
    <div class="rc-acts"><button class="btn-ink" id="share">${ICON.share}Share</button><button class="btn-line" id="home">Home</button></div></div>`;
  $('share').addEventListener('click', shareDaily);
  $('home').addEventListener('click', () => showScreen('home'));
  $('screen-quiz').scrollTop = 0;
}
const bestRun = () => getHist().filter(e => e.kind === 'marathon').reduce((m, e) => Math.max(m, e.correct || 0), 0);

/* ── home ────────────────────────────────────────────────── */
function renderDailyCard() {
  const st = dailyState(), el = $('daily-card');
  const now = new Date();
  const date = `${now.toLocaleDateString('en-GB', { weekday: 'long' })}, ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;
  // Streak and share of correct answers across every daily played
  const ds = dailyStreak();
  const dh = getHist().filter(e => e.kind === 'daily');
  const tot = dh.reduce((n, e) => n + (e.total || 0), 0), cor = dh.reduce((n, e) => n + (e.correct || 0), 0);
  const stats = `<div class="daily-stats"><span><b>${ds}</b> day streak</span>${tot ? `<span><b>${Math.round(cor / tot * 100)}%</b> correct</span>` : ''}</div>`;
  if (st && st.done) {
    const end = new Date(); end.setHours(24, 0, 0, 0);
    const mins = Math.max(1, Math.round((end - Date.now()) / 6e4));
    el.innerHTML = `<div class="daily-body"><div class="eyebrow">Daily · ${date}</div><div class="daily-title">${st.marks.filter(Boolean).length}/10 in ${fmt(st.secs)}</div><div class="daily-sub">Next daily challenge in ${Math.floor(mins / 60)}h ${mins % 60}m</div></div>
      <div class="daily-side"><button class="btn-play" id="daily-share">${ICON.share}Share</button>${stats}</div>`;
    $('daily-share').addEventListener('click', shareDaily);
    el.onclick = e => { if (!e.target.closest('button')) showDailyEnd(); };
    el.style.cursor = 'pointer';
  } else {
    const answered = st && st.marks ? st.marks.filter(m => m === 0 || m === 1).length : 0;
    el.innerHTML = `<div class="daily-body"><div class="eyebrow">Daily · ${date}</div><div class="daily-title">Daily challenge</div><div class="daily-sub">${answered ? `${answered} of 10 answered, pick up where you left off` : '10 mixed questions, the same for everyone, one attempt'}</div></div>
      <div class="daily-side"><button class="btn-play" id="daily-play">${st ? 'Resume' : 'Play'}</button>${stats}</div>`;
    $('daily-play').addEventListener('click', () => startSession('daily'));
    el.onclick = null; el.style.cursor = '';
  }
}
function settingsLine() {
  const r = S.regions.length === REGIONS.length ? 'All regions' : S.regions.length <= 2 ? S.regions.map(x => REGIONS.find(y => y[0] === x)[1]).join(' and ') : `${S.regions.length} regions`;
  const d = S.diff[0].toUpperCase() + S.diff.slice(1);
  return `${ICON.sliders}${esc(r)} · ${d} · ${S.style === 'type' ? 'Type in' : 'Multiple choice'}`;
}
function renderHome() {
  renderDailyCard();
  document.querySelectorAll('#play-seg button').forEach(b => { const on = b.dataset.play === S.play; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  MODES.forEach(m => {
    const lv = [0, 0, 0, 0]; ALL.forEach(c => lv[level(P[m][c.id])]++);
    document.querySelector(`[data-known="${m}"]`).textContent = `${lv[2] + lv[3]} of ${TOTAL} known`;
    document.querySelector(`[data-bar="${m}"]`).innerHTML = [3, 2, 1].map(i => lv[i] ? `<span style="width:${lv[i] / TOTAL * 100}%;background:${LCOL[i]}"></span>` : '').join('');
  });
  $('setline').innerHTML = settingsLine();
  const learn = learningItems().length;
  const pb = $('practise-btn');
  pb.classList.toggle('hidden', !learn);
  pb.innerHTML = `${ICON.loop}Practise mistakes <span class="count">${learn}</span>`;
  const run = bestRun(), rounds = getHist().filter(e => e.kind === 'round').length;
  $('fp-stats').innerHTML = run || rounds ? [run ? `Best run <b>${run}</b>` : '', rounds ? `<b>${rounds}</b> rounds` : ''].filter(Boolean).join(' · ') : '';
}

/* ── progress ────────────────────────────────────────────── */
let pMode = 'flags', pSel = null;
const LCOL = ['var(--m0)', 'var(--m1)', 'var(--m2)', 'var(--m3)'];
function renderProgress() {
  const m = pMode, pr = P[m];
  const lv = [0, 0, 0, 0]; let seen = 0, right = 0;
  ALL.forEach(c => { const r = pr[c.id]; lv[level(r)]++; if (r) { seen += r.n; right += r.c; } });
  const regions = REGIONS.map(([k, name]) => { const cs = ALL.filter(c => c.r === k); return { name, tot: cs.length, n: cs.filter(c => level(pr[c.id]) === 3).length, f: cs.filter(c => level(pr[c.id]) >= 2).length }; });
  const rounds = getHist().filter(e => (e.kind === 'round') && e.mode === m).slice(-20);
  const tricky = Object.keys(pr).filter(id => BY[id] && pr[id].w > 0).sort((a, b) => (level(pr[a]) - level(pr[b])) || (pr[b].w - pr[a].w)).slice(0, 6);
  const learnN = learningItems(m).length;
  const last5 = rounds.slice(-5); const avg = last5.length ? Math.round(last5.reduce((s, e) => s + e.correct / e.total, 0) / last5.length * 100) : 0;
  $('progress-body').innerHTML = `
    <div class="seg" id="pseg">${MODES.map(x => `<button data-m="${x}" class="${x === m ? 'on' : ''}">${ML[x]}</button>`).join('')}</div>
    <div>
      <div class="p-head"><div class="p-num">${lv[3]}<small>of ${TOTAL} known</small></div><div class="rc-sub" style="font-size:12px">${seen ? `${Math.round(right / seen * 100)}% right` : ''}</div></div>
      <div class="stack" aria-hidden="true">${[3, 2, 1, 0].map(i => lv[i] ? `<span style="flex:${lv[i]};background:${LCOL[i]}"></span>` : '').join('')}</div>
      <div class="legend">${[3, 2, 1, 0].map(i => `<span><i style="background:${LCOL[i]}"></i>${LEVELS[i]} ${lv[i]}</span>`).join('')}</div>
    </div>
    <div>
      <div class="pmap" id="pmap"><div class="map-msg">Loading map</div>
        <div class="pmap-ctl"><button id="pz-in" aria-label="Zoom in">${ICON.plus}</button><button id="pz-out" aria-label="Zoom out">${ICON.minus}</button><button id="pz-reset" aria-label="Reset map">${ICON.reset}</button></div>
        <div class="pmap-hint">Tap a country</div></div>
      <div id="cinfo"></div>
    </div>
    <div><div class="sec-t">By region</div>${regions.map(r => `<div class="reg-row"><span>${r.name}</span><div class="reg-bar"><span style="width:${r.n / r.tot * 100}%"></span></div><span class="reg-n">${r.n}/${r.tot}</span></div>`).join('')}</div>
    <div><div class="p-head"><div class="sec-t">Recent rounds</div><div class="sec-t" id="bar-read" style="text-transform:none;letter-spacing:0;font-size:12px;color:var(--ink-2)">${rounds.length ? `Last ${last5.length}: ${avg}%` : ''}</div></div>
      ${rounds.length ? `<div class="bars" id="bars">${rounds.map((e, i) => `<div class="bar" data-i="${i}" style="height:${Math.max(3, e.correct / e.total * 100)}%" role="img" aria-label="${e.correct} of ${e.total}"></div>`).join('')}</div>
      <div class="bars-cap"><span>${new Date(rounds[0].t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span><span>${new Date(rounds[rounds.length - 1].t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div>`
      : `<div class="empty">Your rounds of ${ML[m].toLowerCase()} will show up here.</div>`}</div>
    <div><div class="sec-t">Trickiest</div>
      ${tricky.length ? tricky.map(id => { const c = BY[id], r = pr[id]; const conf = Object.keys(r.conf || {}).sort((a, b) => r.conf[b] - r.conf[a]).slice(0, 2).map(k => confLabel(k, m)).filter(Boolean);
        return `<div class="tr-row"><img class="flag-xs" src="${flagSrc(id)}" alt="" width="28" height="21"><div class="tr-main"><div class="tr-name">${esc(c.name)}${m === 'capitals' ? ` · ${esc(c.cap)}` : ''}</div><div class="tr-d">${LEVELS[level(r)]}${conf.length ? ` · mixed up with ${esc(conf.join(', '))}` : ''}</div></div><span class="tr-n">×${r.w}</span></div>`; }).join('')
        : '<div class="empty">No mistakes yet.</div>'}
      ${learnN ? `<button class="practise" id="p-practise" style="margin-top:12px">${ICON.loop}Practise these <span class="count">${learnN}</span></button>` : ''}
    </div>`;
  document.querySelectorAll('#pseg button').forEach(b => b.addEventListener('click', () => { pMode = b.dataset.m; pSel = null; renderProgress(); }));
  if (learnN) $('p-practise').addEventListener('click', () => startSession('practice', m));
  const bars = $('bars');
  if (bars) bars.querySelectorAll('.bar').forEach(b => {
    const show = () => { const e = rounds[+b.dataset.i]; bars.querySelectorAll('.bar').forEach(x => x.classList.toggle('on', x === b)); $('bar-read').textContent = `${e.correct}/${e.total} · ${new Date(e.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`; };
    b.addEventListener('pointerenter', show); b.addEventListener('click', show);
  });
  drawProgressMap();
  if (pSel) showCountryInfo(pSel);
}
function drawProgressMap() {
  const box = $('pmap'), m = pMode;
  loadMap().then(() => {
    if (!box.isConnected) return;
    const W = box.clientWidth || 360, H = box.clientHeight || 240;
    const pr = worldProj(W, H, 0), path = KV.geoPath(pr);
    box.querySelector('.map-msg') && box.querySelector('.map-msg').remove();
    const svg = KV.select(box).insert('svg', ':first-child').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', `Map of countries by how well you know their ${ML[m].toLowerCase()}`);
    const g = svg.append('g');
    const fill = id => BY[id] ? LCOL[level(P[m][id])] : 'var(--land)';
    g.selectAll('path').data(MAP.feat).join('path').attr('d', path).attr('class', 'land').style('fill', d => fill(d.id))
      .on('click', (e, d) => { if (d.id && BY[d.id]) select(d.id); });
    const small = ALL.filter(c => !MAP.byId[c.id] || c.area < 12000);
    g.selectAll('circle.sd').data(small).join('circle').attr('class', 'sd').attr('cx', c => pr([c.ll[1], c.ll[0]])[0]).attr('cy', c => pr([c.ll[1], c.ll[0]])[1])
      .attr('r', 2.6).style('fill', c => fill(c.id)).style('stroke', 'var(--ink-3)').style('stroke-width', '.6px').style('vector-effect', 'non-scaling-stroke').style('cursor', 'pointer')
      .on('click', (e, c) => select(c.id));
    const z = KV.zoom().scaleExtent([1, 14]).translateExtent([[0, 0], [W, H]])
      .filter(e => e.type === 'wheel' ? e.ctrlKey : e.type.startsWith('touch') ? e.touches.length > 1 : !e.button)
      .on('zoom', e => { g.attr('transform', e.transform); g.selectAll('circle.sd').attr('r', 2.6 / Math.sqrt(e.transform.k)); });
    svg.call(z).on('dblclick.zoom', null);
    svg.style('touch-action', 'pan-y');
    $('pz-in').onclick = () => svg.transition().duration(300).call(z.scaleBy, 1.8);
    $('pz-out').onclick = () => svg.transition().duration(300).call(z.scaleBy, 1 / 1.8);
    $('pz-reset').onclick = () => svg.transition().duration(400).call(z.transform, KV.zoomIdentity);
    function select(id) {
      pSel = id;
      g.selectAll('path').classed('sel', d => d.id === id);
      g.selectAll('path.sel').raise();
      showCountryInfo(id);
    }
    if (pSel) g.selectAll('path').classed('sel', d => d.id === pSel);
  }).catch(() => { if (box.isConnected) box.querySelector('.map-msg').textContent = 'Map unavailable'; });
}
function showCountryInfo(id) {
  const c = BY[id], el = $('cinfo'); if (!el || !c) return;
  el.innerHTML = `<div class="cinfo"><img class="flag-xs" src="${flagSrc(id)}" alt="" width="40" height="30"><div class="cinfo-main"><div class="tr-name">${esc(c.name)}</div><div class="tr-d">Capital: ${esc(c.cap)}</div>
    <div class="lvls">${MODES.map(m => { const l = level(P[m][id]); return `<span class="lvl"><i style="background:${LCOL[l]};box-shadow:0 0 0 1px var(--line-2)"></i>${ML[m]}: ${LEVELS[l].toLowerCase()}</span>`; }).join('')}</div></div></div>`;
}

/* ── navigation ──────────────────────────────────────────── */
function showScreen(name) {
  if (name !== 'quiz' && QZ) { token++; stopTick(); QZ.done = true; QZ = null; }
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  document.querySelectorAll('.np').forEach(p => { const on = p.dataset.screen === name; p.classList.toggle('active', on); p.setAttribute('aria-selected', on); });
  if (name === 'home') renderHome();
  if (name === 'progress') renderProgress();
  const sc = $('screen-' + name); if (sc) sc.scrollTop = 0;
}
document.querySelectorAll('.np').forEach(p => p.addEventListener('click', () => showScreen(p.dataset.screen)));
$('nav-logo').addEventListener('click', () => showScreen('home'));
document.querySelectorAll('.hmc').forEach(b => b.addEventListener('click', () => startSession(S.play === 'marathon' ? 'marathon' : 'round', b.dataset.mode)));
document.querySelectorAll('#play-seg button').forEach(b => b.addEventListener('click', () => { S.play = b.dataset.play; saveS(); renderHome(); }));
$('practise-btn').addEventListener('click', () => startSession('practice', null));
$('setline').addEventListener('click', openD);

/* ── settings ────────────────────────────────────────────── */
function openD() { syncSettings(); $('drawer').classList.add('open'); $('ov').classList.add('open'); setTimeout(() => $('dx').focus({ preventScroll: true }), 50); }
function closeD() { $('drawer').classList.remove('open'); $('ov').classList.remove('open'); disarm(); }
$('settings-btn').addEventListener('click', openD);
$('dx').addEventListener('click', closeD);
$('ov').addEventListener('click', closeD);
$('set-regions').innerHTML = REGIONS.map(([k, n]) => `<button class="chip" data-v="${k}">${n}</button>`).join('');
function syncSettings() {
  document.querySelectorAll('#set-regions .chip').forEach(c => { const on = S.regions.includes(c.dataset.v); c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
  document.querySelectorAll('#set-diff .chip').forEach(c => { const on = c.dataset.v === S.diff; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
  document.querySelectorAll('#set-style .chip').forEach(c => { const on = c.dataset.v === S.style; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
  $('sw-reverse').setAttribute('aria-checked', !!S.reverse);
  $('sw-night').setAttribute('aria-checked', isNight());
  $('pool-note').textContent = `${pool().length} countries in play`;
}
function changed() { saveS(); syncSettings(); if ($('screen-home').classList.contains('active')) renderHome(); }
document.querySelectorAll('#set-regions .chip').forEach(c => c.addEventListener('click', () => {
  const v = c.dataset.v;
  if (S.regions.includes(v)) { if (S.regions.length === 1) { toast('Keep at least one region'); return; } S.regions = S.regions.filter(x => x !== v); }
  else S.regions = REGIONS.map(r => r[0]).filter(x => x === v || S.regions.includes(x));
  changed();
}));
document.querySelectorAll('#set-diff .chip').forEach(c => c.addEventListener('click', () => { S.diff = c.dataset.v; changed(); }));
document.querySelectorAll('#set-style .chip').forEach(c => c.addEventListener('click', () => { S.style = c.dataset.v; changed(); }));
$('sw-reverse').addEventListener('click', () => { S.reverse = !S.reverse; changed(); });
$('sw-night').addEventListener('click', () => { S.night = !isNight(); changed(); applyTheme(); });
let armT = null;
function disarm() { const b = $('reset-btn'); b.classList.remove('arm'); b.textContent = 'Reset progress'; clearTimeout(armT); }
$('reset-btn').addEventListener('click', () => {
  const b = $('reset-btn');
  if (!b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = 'Tap again to erase all progress'; armT = setTimeout(disarm, 4000); return; }
  disarm();
  [K.p, K.h, K.d, K.days, K.recent].forEach(store.del);
  P = {}; MODES.forEach(m => { P[m] = {}; });
  pSel = null;
  closeD(); showScreen('home'); toast('Progress reset');
});

/* ── theme ───────────────────────────────────────────────── */
const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
const isNight = () => S.night == null ? !!(mq && mq.matches) : !!S.night;
function applyTheme() {
  const n = isNight();
  document.documentElement.classList.toggle('night', n);
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = n ? '#111110' : '#F7F3EE';
}
if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (S.night == null) applyTheme(); });

/* ── keyboard ────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if ($('drawer').classList.contains('open')) { if (e.key === 'Escape') closeD(); return; }
  if (!QZ || QZ.done || !$('screen-quiz').classList.contains('active')) return;
  if (e.target && e.target.id === 'ci') {
    if (e.key === 'Enter') { e.preventDefault(); if (!QZ.answered) submitType(); }
    return;
  }
  if (!QZ.answered && /^[1-4]$/.test(e.key)) { const b = document.querySelector(`#quiz-body .ch[data-i="${+e.key - 1}"]`); if (b) b.click(); }
  else if (QZ.answered && e.key === 'Enter') { const n = $('fbnext'); if (n && document.activeElement !== n) { e.preventDefault(); n.click(); } }
  else if (e.key === 'Escape') quitSession();
});

/* ── toast ───────────────────────────────────────────────── */
let toastT = null;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

/* ── logo ────────────────────────────────────────────────── */
(function logo() {
  const el = $('home-logo'), gap = el && el.querySelector('.logo-gap');
  if (!el || !gap || RM) return;
  const ease = 'cubic-bezier(.45,0,.2,1)';
  gap.style.transition = `width 800ms ${ease}`;
  function cycle() {
    if (document.hidden || !$('screen-home').classList.contains('active')) { setTimeout(cycle, 1500); return; }
    gap.style.width = '.52em';
    setTimeout(() => el.classList.add('logo-lined'), 700);
    setTimeout(() => el.classList.remove('logo-lined'), 3400);
    setTimeout(() => { gap.style.width = '0'; }, 3800);
    setTimeout(cycle, 12000);
  }
  setTimeout(cycle, 900);
})();

/* ── boot ────────────────────────────────────────────────── */
migrate();
applyTheme();
showScreen('home');
loadMap().catch(() => {});
document.addEventListener('visibilitychange', () => { if (!document.hidden && $('screen-home').classList.contains('active')) renderHome(); });

// test hook, only with ?test in the URL
if (/[?&]test\b/.test(location.search)) window.__kw = { Q: () => QZ, cur: () => QZ && QZ.items[QZ.i], drawQuestionMap, loadMap, matchAnswer, pickRound, dailyItems, makeQ, P: () => P, S: () => S, BY, ALL, level, startSession, pool };
})();
