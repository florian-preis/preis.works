// Describes the editable content in /content so the build can check it.
import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/projects' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      category: z.string(),
      order: z.number(),
      summary: z.string(),
      app: z.string().optional(),
      year: z.string().optional(),
      image: image().optional(),
      // Which part of the picture stays in view when it is cropped, as CSS object-position (x% y%)
      focus: z.string().default('50% 50%'),
      // Screens shown at the bottom of the project page, in order. alt: a short description for screen readers;
      // caption: the line under the screen in the lightbox (up to two lines on a computer)
      screens: z.array(z.object({ src: image(), alt: z.string(), caption: z.string().optional() })).default([]),
      draft: z.boolean().default(false),
    }),
});

// ── gowiththeflo (travel diary) ─────────────────────────────────────────────
// Month or day precision: 2021-07 or 2021-07-14. YAML turns full dates into Date
// objects, so those are converted back to text before checking the format.
const tripDate = z
  .union([z.string(), z.date()])
  .transform((v) => (typeof v === 'string' ? v.trim() : v.toISOString().slice(0, 10)))
  .pipe(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/, 'Write dates as YYYY-MM or YYYY-MM-DD'));
const countryCode = z.string().regex(/^[A-Z]{2}$/, 'Use two-letter country codes in capitals, e.g. DE');

const trips = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/travel/trips' }),
  schema: z.object({
    title: z.string().min(1),
    start: tripDate,
    end: tripDate.optional(),
    countries: z.array(countryCode).min(1, 'Name at least one country'),
    with: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

// Visited countries and territories: the map and the counter read this list
const visited = defineCollection({
  loader: file('content/travel/countries.yml'),
  schema: z.object({}).loose(),
});

// Names, capitals, and status for every country and territory on the map
const countryReference = defineCollection({
  loader: file('content/travel/facts/reference.yml'),
  schema: z.object({
    name: z.string(),
    capital: z.string().optional(),
    counted: z.boolean(),
    badge: z.string().optional(),
  }),
});

// Hand-kept figures where the World Bank and UNDP have none, or corrections
const fact = z.object({
  value: z.number(),
  year: z.number().int().nullable(),
  source: z.string(),
  currency: z.enum(['USD', 'EUR']).optional(),
  of: z.number().int().optional(),
});
const factOverrides = defineCollection({
  loader: file('content/travel/facts/overrides.yml'),
  schema: z.object({
    population: fact.optional(),
    gdp: fact.optional(),
    gdpPerCapita: fact.optional(),
    hdi: fact.optional(),
    hdiRank: fact.optional(),
  }),
});

export const collections = { projects, trips, visited, countryReference, factOverrides };
