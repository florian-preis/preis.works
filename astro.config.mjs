// Site configuration. Most of the time you never need to touch this file.
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { existsSync, readdirSync } from 'node:fs';

const site = 'https://preis.works';
// The apps in public/projects/<name>/app/ are plain files, so the sitemap is told about them here.
// A new app is picked up by itself.
const apps = readdirSync('public/projects')
  .filter((name) => existsSync(`public/projects/${name}/app/index.html`))
  .map((name) => `${site}/projects/${name}/app/`);

export default defineConfig({
  site,
  trailingSlash: 'always',
  integrations: [sitemap({ filter: (page) => !page.includes('/404'), customPages: apps })],
  vite: {
    // Today's date as the build sees it, used by the travel diary's "date in the future" check
    define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  },
});
