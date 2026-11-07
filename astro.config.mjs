// Site configuration. Most of the time you never need to touch this file.
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://preis.works',
  trailingSlash: 'always',
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
});
