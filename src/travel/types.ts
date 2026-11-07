// Shapes shared by the build (data.ts) and the browser (app.ts).

export type Fact = { value: number; year: number | null; source: string; currency?: string; of?: number };
export type CountryFacts = Partial<Record<'population' | 'gdp' | 'gdpPerCapita' | 'hdi' | 'hdiRank', Fact>>;

export interface TripOut {
  id: string;
  title: string;
  start: string;
  end?: string;
  countries: string[];
  with?: string;
  html: string;
}

// Facts travel to the browser in a compact form: [value, year, source index, currency or "of"]
export type PackedFact = [number, number | null, number, (string | number)?];
export type PackedFacts = Partial<Record<keyof CountryFacts, PackedFact>>;
export function unpackFacts(p: PackedFacts | undefined, sources: string[]): CountryFacts {
  const out: CountryFacts = {};
  for (const [k, v] of Object.entries(p ?? {}) as [keyof CountryFacts, PackedFact][]) {
    const f: Fact = { value: v[0], year: v[1], source: sources[v[2]] };
    if (typeof v[3] === 'string') f.currency = v[3];
    if (typeof v[3] === 'number') f.of = v[3];
    out[k] = f;
  }
  return out;
}

export interface TravelData {
  ref: Record<string, { n: string; cap?: string; c: boolean; b?: string }>;
  visited: string[];
  facts: Record<string, PackedFacts>;
  sources: string[];
  trips: TripOut[];
  total: number;
  count: number;
  flags: Record<string, string>;
}

