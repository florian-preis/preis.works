// Formatting for country facts and trip dates (British English).
import type { CountryFacts, Fact } from './types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parts(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, day };
}
function one(d: string) {
  const { y, m, day } = parts(d);
  return `${day ? `${day} ` : ''}${MONTHS[m - 1]} ${y}`;
}
/** "April 2022", "14 July 2021", "July to August 2021", "December 2021 to January 2022" */
export function formatPeriod(start: string, end?: string) {
  if (!end || end === start) return one(start);
  const a = parts(start), b = parts(end);
  if (a.y === b.y && !a.day && !b.day) return a.m === b.m ? one(start) : `${MONTHS[a.m - 1]} to ${MONTHS[b.m - 1]} ${a.y}`;
  if (a.y === b.y && a.m === b.m && a.day && b.day) return `${a.day} to ${b.day} ${MONTHS[a.m - 1]} ${a.y}`;
  return `${one(start)} to ${one(end)}`;
}
export const monthShort = (d: string) => MONTHS[parts(d).m - 1].slice(0, 3);

const nf = (n: number, digits = 0) => n.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
function big(n: number) {
  const a = Math.abs(n);
  if (a >= 1e12) return `${nf(n / 1e12, n / 1e12 >= 10 ? 1 : 2)} trillion`;
  if (a >= 1e9) return `${nf(n / 1e9, n / 1e9 >= 100 ? 0 : 1)} billion`;
  if (a >= 1e6) return `${nf(n / 1e6, n / 1e6 >= 100 ? 0 : 1)} million`;
  return nf(n);
}
const symbol = (f: Fact) => (f.currency === 'EUR' ? '€' : '$');
function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export interface FactRow { label: string; value: string | null; info?: string }

export function formatFacts(f: CountryFacts | undefined, capital?: string) {
  f = f ?? {};
  const rows: FactRow[] = [];
  rows.push({ label: 'Capital', value: capital ?? null });
  rows.push({ label: 'Population', value: f.population ? big(f.population.value) : null });
  rows.push({ label: 'GDP per person', value: f.gdpPerCapita ? `${symbol(f.gdpPerCapita)}${nf(f.gdpPerCapita.value)}` : null });
  rows.push({ label: 'GDP', value: f.gdp ? `${symbol(f.gdp)}${big(f.gdp.value)}` : null });
  const hdi = f.hdi ? nf(f.hdi.value, 3) + (f.hdiRank ? `, ${ordinal(f.hdiRank.value)} of ${f.hdiRank.of ?? 193}` : '') : null;
  rows.push({
    label: 'Human development',
    value: hdi,
    info: "The UN's Human Development Index combines life expectancy, education, and income into one score from 0 to 1. Countries are ranked from highest to lowest.",
  });

  // Source line: each source with the years its figures come from
  const bySource = new Map<string, Set<number>>();
  const add = (x?: Fact) => {
    if (!x) return;
    if (!bySource.has(x.source)) bySource.set(x.source, new Set());
    if (x.year) bySource.get(x.source)!.add(x.year);
  };
  [f.population, f.gdp, f.gdpPerCapita, f.hdi, f.hdiRank].forEach(add);
  const src = [...bySource].map(([s, ys]) => {
    const list = [...ys].sort();
    return list.length ? `${s} ${list.length > 1 ? `${list[0]} to ${list[list.length - 1]}` : list[0]}` : s;
  });
  const usd = [f.gdp, f.gdpPerCapita].some((x) => x && x.currency !== 'EUR');
  const eur = [f.gdp, f.gdpPerCapita].some((x) => x?.currency === 'EUR');
  let source = src.length ? `Source: ${src.join(', ')}` : '';
  if (usd || eur) source += `. GDP in current ${eur && !usd ? 'euros' : 'US dollars'}.`;
  return { rows, source };
}
