// Tests for the country facts update, using small fixtures in the shape the
// World Bank API and the UNDP file use. Run: node --test scripts/travel/update-country-facts.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yamlCodes, countedCodes, overrideYears, readWorldBank, parseCsv, readHdr, buildFacts, report } from './update-country-facts.mjs';

const REF = `# comment\nDK:\n  name: Denmark\n  capital: Copenhagen\n  counted: true\nHK:\n  name: Hong Kong\n  counted: false\n  badge: Special administrative region of China\nTW:\n  name: Taiwan\n  counted: true\n`;

test('reads codes and counted codes from reference.yml', () => {
  assert.deepEqual(yamlCodes(REF), ['DK', 'HK', 'TW']);
  assert.deepEqual(countedCodes(REF), ['DK', 'TW']);
});

test('reads years from overrides.yml', () => {
  const y = overrideYears(`TW:\n  population: { value: 1, year: 2021, source: X }\n  gdp: { value: 2, year: 2024, currency: EUR, source: X }\n`);
  assert.deepEqual(y, { TW: { population: 2021, gdp: 2024 } });
});

const wbRows = [
  { indicator: { id: 'SP.POP.TOTL' }, country: { id: 'DK', value: 'Denmark' }, countryiso3code: 'DNK', date: '2024', value: 5961249 },
  { indicator: { id: 'SP.POP.TOTL' }, country: { id: 'HK', value: 'Hong Kong SAR, China' }, countryiso3code: 'HKG', date: '2024', value: 7524100 },
  { indicator: { id: 'SP.POP.TOTL' }, country: { id: '1W', value: 'World' }, countryiso3code: 'WLD', date: '2024', value: 8e9 },
  { indicator: { id: 'SP.POP.TOTL' }, country: { id: 'XX', value: 'Nowhere' }, countryiso3code: 'XXX', date: '2024', value: null },
];

test('keeps only known countries from World Bank rows', () => {
  const { values, iso3 } = readWorldBank(wbRows, ['DK', 'HK', 'TW']);
  assert.deepEqual(values, { DK: { value: 5961249, year: 2024 }, HK: { value: 7524100, year: 2024 } });
  assert.deepEqual(iso3, { DNK: 'DK', HKG: 'HK' });
});

test('parses CSV with quotes and commas', () => {
  const r = parseCsv('iso3,country,hdi_2023\r\nDNK,Denmark,0.962\r\nCIV,"Côte d\'Ivoire, Republic of",0.582\n');
  assert.equal(r.length, 2);
  assert.equal(r[1].country, "Côte d'Ivoire, Republic of");
});

const hdrRows = () => {
  const rows = [];
  for (let i = 0; i < 160; i++) rows.push({ iso3: `X${i}`, hdi_rank_2023: String(i + 3), hdi_2022: '0.5', hdi_2023: '0.5' });
  rows.push({ iso3: 'DNK', hdi_rank_2023: '2', hdi_2022: '0.950', hdi_2023: '0.9621' });
  rows.push({ iso3: 'HKG', hdi_rank_2023: '1', hdi_2022: '0.955', hdi_2023: '0.955' });
  rows.push({ iso3: 'ZZZ', hdi_rank_2023: '', hdi_2022: '', hdi_2023: '' });
  return rows;
};

test('reads the latest HDI year and UNDP ranks', () => {
  const { values, year } = readHdr(hdrRows(), { DNK: 'DK', HKG: 'HK' });
  assert.equal(year, 2023);
  assert.deepEqual(values.DK.hdi, { value: 0.962, year: 2023, source: 'UNDP' });
  assert.equal(values.DK.hdiRank.value, 2);
  assert.equal(values.DK.hdiRank.of, 162);
});

test('ranks by value when UNDP gives no rank column', () => {
  const rows = hdrRows().map(({ hdi_rank_2023, ...r }) => r);
  const { values } = readHdr(rows, { DNK: 'DK', HKG: 'HK' });
  assert.equal(values.DK.hdiRank.value, 1);
  assert.equal(values.HK.hdiRank.value, 2);
});

test('builds facts in US dollars and keeps old HDI when UNDP fails', () => {
  const wb = { population: { DK: { value: 5961249, year: 2024 } }, gdp: { DK: { value: 4.0e11, year: 2024 } }, gdpPerCapita: { DK: { value: 67000.4, year: 2024 } } };
  const previous = { DK: { hdi: { value: 0.952, year: null, source: 'UNDP' } } };
  const f = buildFacts({ codes: ['DK', 'TW'], wb, hdr: { values: {}, year: null }, previous });
  assert.equal(f.DK.gdp.currency, 'USD');
  assert.equal(f.DK.gdpPerCapita.value, 67000);
  assert.equal(f.DK.population.currency, undefined);
  assert.deepEqual(f.DK.hdi, previous.DK.hdi);
  assert.equal(f.TW, undefined);
});

test('report flags big moves, missing figures, and old overrides', () => {
  const before = { DK: { population: { value: 100, year: 2023, source: 'World Bank' } } };
  const after = { DK: { population: { value: 120, year: 2024, source: 'World Bank' } } };
  const r = report({ before, after, counted: ['DK', 'TW'], overrideYearsByCode: { TW: { population: 2021 } }, names: { DK: 'Denmark', TW: 'Taiwan' }, hdrYear: 2023, now: new Date('2026-11-07') });
  assert.equal(r.changes, 1);
  assert.ok(r.warnings.some((w) => w.startsWith('Denmark: population moved 20%')));
  assert.ok(r.warnings.some((w) => w.startsWith('Taiwan: no population')));
  assert.ok(r.warnings.some((w) => w.includes('from 2021')));
});

test('report does not compare euros with dollars', () => {
  const before = { DK: { gdp: { value: 395.9e9, year: 2024, currency: 'EUR', source: 'World Bank' } } };
  const after = { DK: { gdp: { value: 4.0e11, year: 2024, currency: 'USD', source: 'World Bank' } } };
  const r = report({ before, after, counted: [], overrideYearsByCode: {}, names: {}, hdrYear: 2023 });
  assert.equal(r.changes, 1);
  assert.equal(r.warnings.length, 0);
});
