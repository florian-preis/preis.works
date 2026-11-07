// Builds everything the gowiththeflo app needs, and checks the travel content.
// Runs at build time only. Any problem stops the build with a clear message, so a
// mistake in a trip file never reaches the live site.
import { getCollection } from 'astro:content';
import factsFile from '../../content/travel/facts/country-facts.json';
import topo from './countries.topo.json';

import type { Fact, CountryFacts, PackedFacts, TripOut, TravelData } from './types';

const flagUrls = import.meta.glob<string>('../../node_modules/flag-icons/flags/4x3/*.svg', {
  query: '?url&no-inline',
  import: 'default',
  eager: true,
});

const today = new Date().toISOString().slice(0, 10);
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

export async function loadTravelData(): Promise<TravelData> {
  const problems: string[] = [];
  const warnings: string[] = [];

  const reference = await getCollection('countryReference');
  const ref: TravelData['ref'] = {};
  for (const r of reference) ref[r.id] = { n: r.data.name, cap: r.data.capital, c: r.data.counted, b: r.data.badge };

  const visited = (await getCollection('visited')).map((v) => v.id).sort();
  for (const code of visited) {
    if (!/^[A-Z]{2}$/.test(code)) problems.push(`countries.yml: "${code}" is not a two-letter country code`);
    else if (!ref[code]) problems.push(`countries.yml: ${code} is not a known country or territory (see facts/reference.yml)`);
  }

  // Every visited code should have a shape on the map, otherwise it can't light up
  const shapes = new Set((topo as any).objects.countries.geometries.map((g: any) => g.properties.iso));
  for (const code of visited) if (ref[code] && !shapes.has(code)) warnings.push(`${code} (${ref[code].n}) has no shape on the map, so it won't light up`);

  const total = Object.values(ref).filter((r) => r.c).length;
  if (total !== 197) problems.push(`facts/reference.yml marks ${total} places as counted; the counter expects 197`);

  // Trips
  const entries = await getCollection('trips');
  const seenText = new Map<string, string>();
  const trips: TripOut[] = [];
  const visitedSet = new Set(visited);
  for (const e of entries) {
    const d = e.data;
    const where = `trips/${e.id}.md`;
    if (d.draft) continue;
    const body = (e.body ?? '').trim();
    if (!body) problems.push(`${where}: the story is empty (write it below the second --- line, or set draft: true)`);
    if (d.start > today) problems.push(`${where}: start date ${d.start} is in the future`);
    if (d.end && d.end < d.start) problems.push(`${where}: end ${d.end} is before start ${d.start}`);
    if (d.end && d.end > today) problems.push(`${where}: end date ${d.end} is in the future`);
    for (const c of d.countries) {
      if (!ref[c]) problems.push(`${where}: ${c} is not a known country code`);
      else if (!visitedSet.has(c)) problems.push(`${where}: ${c} (${ref[c].n}) is missing from countries.yml`);
    }
    if (new Set(d.countries).size !== d.countries.length) problems.push(`${where}: a country is listed twice`);
    if (body) {
      const key = norm(body);
      const other = seenText.get(key);
      if (other) problems.push(`${where}: the story is identical to trips/${other}.md (one trip can list several countries instead)`);
      else seenText.set(key, e.id);
    }
    trips.push({
      id: e.id,
      title: d.title,
      start: d.start,
      end: d.end,
      countries: d.countries,
      with: d.with,
      html: e.rendered?.html ?? '',
    });
  }
  trips.sort((a, b) => b.start.localeCompare(a.start) || a.title.localeCompare(b.title));

  if (problems.length) {
    throw new Error(`gowiththeflo: please fix the travel content:\n  - ${problems.join('\n  - ')}`);
  }
  for (const w of warnings) console.warn(`gowiththeflo: ${w}`);

  // Facts: generated figures, with hand-kept overrides on top
  const full: Record<string, CountryFacts> = structuredClone((factsFile as any).countries ?? {});
  for (const o of await getCollection('factOverrides')) {
    if (!ref[o.id]) throw new Error(`gowiththeflo: facts/overrides.yml: ${o.id} is not a known country code`);
    full[o.id] = { ...(full[o.id] ?? {}), ...(o.data as CountryFacts) };
  }
  const sources: string[] = [];
  const facts: TravelData['facts'] = {};
  for (const [code, fields] of Object.entries(full)) {
    if (!ref[code]) continue;
    const packed: PackedFacts = {};
    for (const [k, f] of Object.entries(fields) as [keyof CountryFacts, Fact][]) {
      if (!f || typeof f.value !== 'number') continue;
      let si = sources.indexOf(f.source);
      if (si < 0) si = sources.push(f.source) - 1;
      const extra = f.currency ?? f.of;
      packed[k] = extra === undefined ? [f.value, f.year ?? null, si] : [f.value, f.year ?? null, si, extra];
    }
    facts[code] = packed;
  }

  const flags: Record<string, string> = {};
  for (const [path, url] of Object.entries(flagUrls)) {
    const code = path.split('/').pop()!.replace('.svg', '').toUpperCase();
    if (ref[code]) flags[code] = url;
  }

  const count = visited.filter((c) => ref[c]?.c).length;
  return { ref, visited, facts, sources, trips, total, count, flags };
}
