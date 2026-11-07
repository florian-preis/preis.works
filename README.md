# preis.works

Personal site of Florian Preis, built with [Astro](https://astro.build) and published to GitHub Pages.

## Where things live

Your content sits in three top-level folders. Everything under `src/` is the site's code, which you rarely need to open.

| Folder or file | What it holds | You edit it when |
|---|---|---|
| `photography/` | Every photo on the Photography page | Adding or removing a photo |
| `content/about.md` | The about text on the home page | Changing your introduction |
| `content/veil.json` | Home page veil settings: colour or black and white, seconds per photo, photos to leave out, crop points for phones | Changing the veil |
| `content/projects/` | One file per project: name, category, description, "Why I made it", year, picture | Editing or adding a project |
| `content/projects/images/` | Project pictures (mockups or screenshots) | Swapping a project picture |
| `content/travel/` | gowiththeflo, the travel diary: trips, visited countries, country facts | Adding a trip or a country |
| `public/projects/<name>/app/` | The project apps themselves (one HTML file each; gowiththeflo is the exception, see below) | Updating an app |
| `public/` | Files served as they are: fonts, logo, favicon, social card, CNAME | Rarely |
| `src/` | Site code: pages, layout, nav, styles, scripts | Design or behaviour changes |
| `src/data/site.ts` | Name, email, LinkedIn, Instagram, nav labels | Changing contact details |
| `src/styles/global.css` | Colours, content width, fonts, motion timing | Changing the look site-wide |

## Common tasks

**Add a photo.** Put the file in `photography/`, named `YYYYMMDD_Caption.jpg`, for example `20260219_Staircase at Marina Bay Sands, Singapore.jpg`. The date and caption on the site come from the filename. Sizes for the grid and the lightbox are generated automatically when the site builds.

**Change the veil.** The veil shows every photo in `photography/`, in a random order on each visit. In `content/veil.json`, set `tone` to `muted` or `mono`, list filenames under `exclude` to leave photos out, and add a filename with a crop point under `focus` (e.g. `"20250310_Sossusvlei, Namibia.jpg": "30% 50%"`, 30% from the left, halfway down) to keep a subject in frame on phones.

**Write "Why I made it" for a project.** Open the project's file in `content/projects/` and write below the second `---` line. While it is empty, the section stays hidden.

**Add a project.** Copy one of the files in `content/projects/`, rename it (the filename becomes the address, e.g. `photobook.md` → `/projects/photobook/`), and fill in the fields. `order` sets the position: 1 is shown first, so give the newest project 1 and move the others down. If it has an app, put it in `public/projects/<name>/app/index.html` and set `app:` to that address. Set `draft: true` to keep a project off the site while you work on it.

**Add a trip to gowiththeflo.** The easiest way is the "log my trip" skill in Claude: it interviews you and opens a pull request; merging it publishes the entry. By hand: add a file to `content/travel/trips/` named `YYYY-MM-short-title.md` (copy an existing one). In the header, `title`, `start` (`2022-04` or `2022-04-14`), optionally `end`, `countries` as two-letter codes (`[NL, DE, FR]`, one trip can cover several), and optionally `with`. The story goes below the second `---` line; `draft: true` keeps it off the site. A new country also needs a line in `content/travel/countries.yml`, which is the list the map and the counter read. The build checks all of this (codes, dates, countries missing from the list, the same story twice) and stops with a message naming the file if something is off, so a mistake never reaches the live site.

**Country facts in gowiththeflo.** Population, GDP, and the Human Development Index come from the World Bank and the UN (UNDP). On the 3rd of each month, the "Update country facts" workflow fetches the latest figures and, if anything changed, opens a pull request with a report of the changes and anything unusual. Merging it publishes the figures. You can also start it from the Actions tab. Names, capitals, and which places count towards the 197 are hand-kept in `content/travel/facts/reference.yml`; figures for places the sources skip (Taiwan, Vatican City) go in `content/travel/facts/overrides.yml`. One-time setting for the pull requests: Settings > Actions > General > Workflow permissions > "Allow GitHub Actions to create and approve pull requests".

**How gowiththeflo is built.** Unlike the other apps, it is an Astro page (`src/pages/projects/travel-diary/app/index.astro`, code in `src/travel/`), so it can read the travel content at build time. The map is MapLibre with self-hosted Natural Earth data: relief tiles in `public/projects/travel-diary/map/relief/` and country shapes in `src/travel/countries.topo.json`, both made by `scripts/travel/build-map.py` (only needed if the map's look or borders change).

**Change contact details.** Edit `src/data/site.ts`.

## Publishing

- Work on a branch other than `main`, then merge into `main` when ready.
- Every push to `main` builds and publishes the site automatically (`.github/workflows/deploy.yml`). If a build fails, nothing changes on the live site. Progress is visible in the repository's Actions tab.
- Every pull request into `main` gets a "Check" that builds the site without publishing it (`.github/workflows/check.yml`), so a broken trip file shows up before merging.

## Running it on your own computer (optional)

Requires Node.js 22 or later.

```
npm install      # once
npm run dev      # live preview at http://localhost:4321
npm run build    # the finished site, in dist/
```
