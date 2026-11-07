// Describes the editable content in /content so the build can check it.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
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
      draft: z.boolean().default(false),
    }),
});

export const collections = { projects };
