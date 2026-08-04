# preis.works

Personal site of Florian Preis. Static site built by Jekyll and served by GitHub Pages.
No build tools are needed on your machine: GitHub builds the site on every push to `main`.

## How the site is put together

| File or folder | What it does | How often you touch it |
|---|---|---|
| `_layouts/default.html` | The page shell: head, nav, footer, script wiring | Almost never |
| `_includes/chrome.css` | Shared design: colour tokens, navbar, mobile drawer, footer | When changing site-wide design |
| `_includes/chrome.js` | Shared behaviour: navbar pill on scroll, hamburger, footer year | Almost never |
| `_includes/nav.html` | The navbar and mobile drawer markup | When adding a nav item |
| `_includes/footer.html` | The footer markup and social links | Rarely |
| `_includes/about.css` / `.js` | Styles and scripts used only by the About page | When changing that page |
| `_includes/photography.css` / `.js` | Styles and scripts used only by the gallery | When changing that page |
| `_includes/projects.css` | Styles used only by the Projects page | When changing that page |
| `index.html` | About page content | When editing your bio |
| `photography.html` | Gallery page content | Rarely |
| `projects.html` | Project cards | When adding a project |
| `photography/` | Photo files, named `YYYYMMDD_Caption.jpg` | Every time you publish photos |
| `projects/` | The three standalone project apps | Independent of the rest of the site |

## The one rule that matters

**To change the navbar, footer, or any site-wide design value, edit the file in `_includes/`.
Never edit those things inside a page file.** That is the whole point of this structure:
one change, three pages updated.

## Page front matter

Each page starts with a small block that tells the layout what to do:

```yaml
---
layout: default
title: Photography | Florian Preis
nav_active: photography      # which nav item is highlighted: about, photography, projects
page_css: photography.css    # which file in _includes/ holds this page's styles
page_js: photography.js      # which file in _includes/ holds this page's scripts
---
```

## Adding a photo

Put the file in `photography/`. That is the whole job: the gallery reads the folder at build time.


Name every file exactly `YYYYMMDD_Caption.jpg`. The date and caption shown on the site are
read from the filename, so the name is the content.

## The project apps

`projects/cogniflow.html`, `projects/knowhere.html`, and `projects/travel-diary.html` are
self-contained applications with their own design languages. They deliberately do not use
the shared chrome. Leave them alone unless you are working on that specific app.

## If a deploy goes wrong

GitHub Pages keeps serving the last successful build. If a push fails to build, the live
site does not change. Check the Actions tab in GitHub for the error.
