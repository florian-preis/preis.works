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
| `public/projects/<name>/app/` | The project apps themselves (one HTML file each) | Updating an app |
| `public/` | Files served as they are: fonts, logo, favicon, social card, CNAME | Rarely |
| `src/` | Site code: pages, layout, nav, styles, scripts | Design or behaviour changes |
| `src/data/site.ts` | Name, email, LinkedIn, Instagram, nav labels | Changing contact details |
| `src/styles/global.css` | Colours, content width, fonts, motion timing | Changing the look site-wide |

## Common tasks

**Add a photo.** Put the file in `photography/`, named `YYYYMMDD_Caption.jpg`, for example `20260219_Staircase at Marina Bay Sands, Singapore.jpg`. The date and caption on the site come from the filename. Sizes for the grid and the lightbox are generated automatically when the site builds.

**Change the veil.** The veil shows every photo in `photography/`, in a random order on each visit. In `content/veil.json`, set `tone` to `muted` or `mono`, list filenames under `exclude` to leave photos out, and add a filename with a crop point under `focus` (e.g. `"20250310_Sossusvlei, Namibia.jpg": "30% 50%"`, 30% from the left, halfway down) to keep a subject in frame on phones.

**Write "Why I made it" for a project.** Open the project's file in `content/projects/` and write below the second `---` line. While it is empty, the section stays hidden.

**Add a project.** Copy one of the files in `content/projects/`, rename it (the filename becomes the address, e.g. `photobook.md` → `/projects/photobook/`), and fill in the fields. `order` sets the position: 1 is shown first, so give the newest project 1 and move the others down. If it has an app, put it in `public/projects/<name>/app/index.html` and set `app:` to that address. Set `draft: true` to keep a project off the site while you work on it.

**Change contact details.** Edit `src/data/site.ts`.

## Publishing

- Work on a branch other than `main`, then merge into `main` when ready.
- Every push to `main` builds and publishes the site automatically (`.github/workflows/deploy.yml`). If a build fails, nothing changes on the live site. Progress is visible in the repository's Actions tab.

## Running it on your own computer (optional)

Requires Node.js 22 or later.

```
npm install      # once
npm run dev      # live preview at http://localhost:4321
npm run build    # the finished site, in dist/
```
