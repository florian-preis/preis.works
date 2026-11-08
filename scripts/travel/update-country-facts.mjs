// Refreshes the country facts shown in gowiththeflo (population, GDP, GDP per person,
// Human Development Index) and writes a report of what changed.
//
//   node scripts/travel/update-country-facts.mjs [--report facts-report.md] [--dry-run]
//
// Runs monthly on GitHub (.github/workflows/update-country-facts.yml), which opens a
// pull request with the report. Nothing reaches the site until that is merged.
// Uses only Node's built-ins, so it needs no npm install.
//
// Sources
//   World Bank API: SP.POP.TOTL, NY.GDP.MKTP.CD, NY.GDP.PCAP.CD (latest year with a value, current US$)
//   UNDP Human Development Report: composite indices time series (CSV). The file is
//   found on the HDR downloads page; set HDR_CSV_URL to point at it directly if needed.
// Values for places these sources skip (Taiwan, Vatican City) live in overrides.yml.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../../', import.meta.url);
const FACTS = new URL('content/travel/facts/country-facts.json', ROOT);
const REFERENCE = new URL('content/travel/facts/reference.yml', ROOT);
const OVERRIDES = new URL('content/travel/facts/overrides.yml', ROOT);

const WB = 'https://api.worldbank.org/v2/country/all/indicator';
const INDICATORS = { population: 'SP.POP.TOTL', gdp: 'NY.GDP.MKTP.CD', gdpPerCapita: 'NY.GDP.PCAP.CD' };
const HDR_PAGE = 'https://hdr.undp.org/data-center/documentation-and-downloads';
const HDR_FILE = /Composite_indices_complete_time_series\.csv/i;

// Thresholds for the report's warnings
export const LIMITS = { population: 0.05, gdp: 0.25, gdpPerCapita: 0.25, hdi: 0.05 };

// ── Pure helpers (tested in update-country-facts.test.mjs) ───────────────────

/** Country codes (two capital letters) used as top-level keys in a YAML file. */
export function yamlCodes(text) {
  return [...text.matchAll(/^([A-Z]{2}):/gm)].map((m) => m[1]);
}

/** Codes that count towards the 197, from reference.yml. */
export function countedCodes(text) {
  const out = [];
  let code = null;
  for (const line of text.split('\n')) {
    const k = line.match(/^([A-Z]{2}):/);
    if (k) code = k[1];
    else if (code && /^\s+counted:\s*true/.test(line)) out.push(code);
  }
  return out;
}

/** Years given in overrides.yml, per code, to flag stale hand-kept values. */
export function overrideYears(text) {
  const out = {};
  let code = null;
  for (const line of text.split('\n')) {
    const k = line.match(/^([A-Z]{2}):/);
    if (k) { code = k[1]; continue; }
    const f = line.match(/^\s+(\w+):.*year:\s*(\d{4})/);
    if (code && f) (out[code] ??= {})[f[1]] = Number(f[2]);
  }
  return out;
}

/** World Bank API rows -> { iso2: { value, year } } plus an iso3 -> iso2 map. */
export function readWorldBank(rows, codes) {
  const wanted = new Set(codes);
  const values = {}, iso3 = {};
  for (const r of rows ?? []) {
    const id = r?.country?.id;
    if (!wanted.has(id)) continue;
    if (r.countryiso3code) iso3[r.countryiso3code] = id;
    if (typeof r.value === 'number' && Number.isFinite(r.value)) values[id] = { value: r.value, year: Number(r.date) };
  }
  return { values, iso3 };
}

/** Minimal CSV parser (quoted fields, commas, newlines in quotes). */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

/**
 * UNDP composite indices -> { iso2: { hdi: {value, year}, hdiRank: {value, of, year} } }.
 * Uses the latest year that has HDI values. Takes UNDP's own rank column for that year
 * when present, otherwise ranks by value (equal values share a rank).
 */
export function readHdr(records, iso3to2) {
  if (!records.length) return { values: {}, year: null };
  const cols = Object.keys(records[0]);
  const years = cols.map((c) => c.match(/^hdi_(\d{4})$/)?.[1]).filter(Boolean).map(Number).sort();
  const num = (s) => (s === '' || s == null ? NaN : Number(s));
  let year = null;
  for (const y of [...years].reverse()) if (records.filter((r) => Number.isFinite(num(r[`hdi_${y}`]))).length > 150) { year = y; break; }
  if (!year) return { values: {}, year: null };
  const rankCol = cols.includes(`hdi_rank_${year}`) ? `hdi_rank_${year}` : null;
  const rows = records
    .map((r) => ({ iso2: iso3to2[r.iso3], hdi: num(r[`hdi_${year}`]), rank: rankCol ? num(r[rankCol]) : NaN }))
    .filter((r) => r.iso2 && Number.isFinite(r.hdi));
  if (!rankCol) {
    const sorted = [...rows].sort((a, b) => b.hdi - a.hdi);
    sorted.forEach((r, i) => { r.rank = i > 0 && sorted[i - 1].hdi === r.hdi ? sorted[i - 1].rank : i + 1; });
  }
  const ranked = rows.filter((r) => Number.isFinite(r.rank));
  const of = rankCol ? records.filter((r) => Number.isFinite(num(r[rankCol]))).length : ranked.length;
  const values = {};
  for (const r of rows) {
    values[r.iso2] = { hdi: { value: Math.round(r.hdi * 1000) / 1000, year, source: 'UNDP' } };
    if (Number.isFinite(r.rank)) values[r.iso2].hdiRank = { value: r.rank, of, year, source: 'UNDP' };
  }
  return { values, year };
}

/** Merge the sources into the facts file's "countries" object. */
export function buildFacts({ codes, wb, hdr, previous }) {
  const out = {};
  for (const code of codes) {
    const e = {};
    for (const field of Object.keys(INDICATORS)) {
      const v = wb[field]?.[code];
      if (v) e[field] = { value: field === 'population' ? Math.round(v.value) : Math.round(v.value), year: v.year, ...(field === 'population' ? {} : { currency: 'USD' }), source: 'World Bank' };
    }
    const h = hdr?.values?.[code];
    if (h) Object.assign(e, h);
    else if (!hdr?.year && previous?.[code]) {
      // UNDP couldn't be read this time: keep the last HDI figures rather than dropping them
      if (previous[code].hdi) e.hdi = previous[code].hdi;
      if (previous[code].hdiRank) e.hdiRank = previous[code].hdiRank;
    }
    if (Object.keys(e).length) out[code] = e;
  }
  return out;
}

/** Report: what changed, and anything that deserves a second look. */
export function report({ before, after, counted, overrideYearsByCode, names, hdrYear, now = new Date(), maxRows = 150 }) {
  const changes = [], warnings = [];
  const fmt = (f) => (f ? `${f.currency === 'EUR' ? '€' : f.currency === 'USD' ? '$' : ''}${f.value.toLocaleString('en-GB')}${f.year ? ` (${f.year})` : ''}` : 'none');
  for (const code of Object.keys({ ...before, ...after }).sort()) {
    for (const field of ['population', 'gdp', 'gdpPerCapita', 'hdi', 'hdiRank']) {
      const a = before[code]?.[field], b = after[code]?.[field];
      if (!a && !b) continue;
      const same = a && b && a.value === b.value && a.year === b.year && (a.currency ?? '') === (b.currency ?? '');
      if (same) continue;
      changes.push(`| ${names[code] ?? code} | ${field} | ${fmt(a)} | ${fmt(b)} |`);
      const limit = LIMITS[field];
      if (limit && a && b && (a.currency ?? '') === (b.currency ?? '') && a.value) {
        const d = Math.abs(b.value - a.value) / Math.abs(a.value);
        if (d > limit) warnings.push(`${names[code] ?? code}: ${field} moved ${(d * 100).toFixed(0)}% (${fmt(a)} to ${fmt(b)})`);
      }
      if (a && !b) warnings.push(`${names[code] ?? code}: ${field} is no longer provided by the source`);
    }
  }
  for (const code of counted) if (!after[code]?.population) warnings.push(`${names[code] ?? code}: no population figure (add one to overrides.yml if the sources don't cover it)`);
  const year = now.getFullYear();
  for (const [code, fields] of Object.entries(overrideYearsByCode)) for (const [field, y] of Object.entries(fields)) {
    if (year - y > 2) warnings.push(`${names[code] ?? code}: the hand-kept ${field} in overrides.yml is from ${y}`);
  }
  if (!hdrYear) warnings.push('UNDP: the Human Development Report file could not be read, so last month\'s HDI figures were kept. Check the downloads page, or set HDR_CSV_URL in the workflow.');
  // GitHub limits a pull request description to 65,536 characters, so long lists are cut
  const cut = (list, n) => (list.length > n ? [...list.slice(0, n), `| … | ${list.length - n} more | see the workflow log | |`] : list);
  const firstUsd = Object.values(before).some((e) => e?.gdp?.currency === 'EUR');
  const lines = [
    '## Country facts update',
    '',
    `Sources: World Bank API (current US$), UNDP Human Development Report${hdrYear ? ` (${hdrYear} data)` : ''}.`,
    ...(firstUsd ? ['', 'This update also switches GDP from the old euro figures to US dollars, so most GDP rows change.'] : []),
    '',
    warnings.length ? `### Worth a look (${warnings.length})\n\n${warnings.slice(0, 80).map((w) => `- ${w}`).join('\n')}${warnings.length > 80 ? `\n- …and ${warnings.length - 80} more in the workflow log` : ''}` : '### Worth a look\n\nNothing unusual.',
    '',
    `### Changes (${changes.length})`,
    '',
    changes.length ? ['| Country | Field | Before | After |', '|---|---|---|---|', ...cut(changes, maxRows)].join('\n') : 'No figures changed.',
    '',
    'Merging this pull request publishes the new figures.',
  ];
  const full = [...warnings.map((w) => `- ${w}`), ...changes];
  return { text: lines.join('\n'), full: full.join('\n'), changes: changes.length, warnings };
}

// ── Fetching ────────────────────────────────────────────────────────────────

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'preis.works country facts updater' } });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return await r.json();
    } catch (e) {
      if (attempt >= 3) throw new Error(`Could not fetch ${url}: ${e.message}`);
      await new Promise((res) => setTimeout(res, 2000 * attempt));
    }
  }
}

async function fetchWorldBank(field) {
  const json = await getJson(`${WB}/${INDICATORS[field]}?format=json&mrnev=1&per_page=20000`);
  if (!Array.isArray(json) || !Array.isArray(json[1])) throw new Error(`World Bank ${INDICATORS[field]}: unexpected response`);
  return json[1];
}

async function fetchHdrCsv() {
  let url = process.env.HDR_CSV_URL;
  if (!url) {
    const page = await fetch(HDR_PAGE, { headers: { 'user-agent': 'preis.works country facts updater' } }).then((r) => (r.ok ? r.text() : ''));
    const links = [...page.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => HDR_FILE.test(h));
    if (!links.length) return null;
    url = new URL(links[0], HDR_PAGE).href;
  }
  const r = await fetch(url, { headers: { 'user-agent': 'preis.works country facts updater' } });
  if (!r.ok) return null;
  // The file is published in Latin-1; decode explicitly so country names survive
  const buf = new Uint8Array(await r.arrayBuffer());
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.includes('�')) text = new TextDecoder('latin1').decode(buf);
  return { url, text };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const reportPath = args.includes('--report') ? args[args.indexOf('--report') + 1] : null;
  const dry = args.includes('--dry-run');

  const refText = await readFile(REFERENCE, 'utf8');
  const codes = yamlCodes(refText);
  const counted = countedCodes(refText);
  const names = Object.fromEntries([...refText.matchAll(/^([A-Z]{2}):\n\s+name:\s*"?([^"\n]+)"?/gm)].map((m) => [m[1], m[2]]));
  const previousFile = JSON.parse(await readFile(FACTS, 'utf8'));
  const previous = previousFile.countries ?? {};

  const wb = {}, iso3to2 = {};
  for (const field of Object.keys(INDICATORS)) {
    const { values, iso3 } = readWorldBank(await fetchWorldBank(field), codes);
    if (Object.keys(values).length < 150) throw new Error(`World Bank ${INDICATORS[field]}: only ${Object.keys(values).length} countries returned; stopping so nothing is lost`);
    wb[field] = values;
    Object.assign(iso3to2, iso3);
  }

  let hdr = { values: {}, year: null }, hdrUrl = null;
  try {
    const csv = await fetchHdrCsv();
    if (csv) { hdr = readHdr(parseCsv(csv.text), iso3to2); hdrUrl = csv.url; }
  } catch (e) {
    console.warn(`UNDP: ${e.message}`);
  }

  const countries = buildFacts({ codes, wb, hdr, previous });
  const rep = report({ before: previous, after: countries, counted, overrideYearsByCode: overrideYears(await readFile(OVERRIDES, 'utf8')), names, hdrYear: hdr.year });

  const out = {
    _about: 'Generated by scripts/travel/update-country-facts.mjs. Do not edit by hand: corrections go in overrides.yml.',
    generated: new Date().toISOString().slice(0, 10),
    sources: { worldBank: WB, undp: hdrUrl ?? previousFile.sources?.undp ?? HDR_PAGE },
    countries,
  };
  // Only touch the file when a figure changed, so a quiet month opens no pull request
  const changed = JSON.stringify(previous) !== JSON.stringify(countries);
  if (!dry && changed) await writeFile(FACTS, JSON.stringify(out, null, 1) + '\n');
  if (reportPath) await writeFile(reportPath, rep.text + '\n');
  console.log(rep.text);
  console.log('\nFull list:\n' + rep.full);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
