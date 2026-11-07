// Site configuration. Most of the time you never need to touch this file.
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://preis.works',
  trailingSlash: 'always',
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
  vite: {
    // Today's date as the build sees it, used by the travel diary's "date in the future" check
    define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  },
});
