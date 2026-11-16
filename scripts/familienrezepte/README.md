# Familienrezepte: how the app is made

The app lives in `public/projects/familienrezepte/app/`. Everything inside the book (recipes, Lena's lettering, her illustrations) is encrypted in `data/`; only the notebook photographs, the icons, and the code are readable. The site build (Astro) does not touch any of this: the app is built here, on Florian's computer, and the finished files are committed.

## The private source

Nothing below is ever committed. It lives in `private/familienrezepte/` (git-ignored) and in Florian's private copy of `familienrezepte-originals.zip`.

- `photos/`: photos of every page of Lena's book (`p00-contents.jpeg`, `p01.jpeg` to `p33.jpeg`, `p11-back.jpeg`, `p31-back.jpeg`)
- `moleskine/`: the four notebook photos (`Front.png`, `Back.png`, `Open_with bookmark.png`, `Open_without bookmark.webp`)
- `lettering.json`: Lena's handwriting traced into vectors (from the earlier digitising chat)
- `work/`: everything the build reads
  - `content.json`: the recipes, German and English. **Edit recipes here**
  - `lettering.json`: the lettering after `lettering_fix.py`
  - `ill/ill_<page>.json`: the traced illustrations
  - `assets/*.png`: the prepared notebook pictures

## Rebuilding

Python 3 with `opencv-python numpy potracer cairosvg pillow cryptography`. Run from this folder; `P` is the private folder.

| Step | Command | When |
| --- | --- | --- |
| Notebook pictures | `python3 moleskine.py $P/moleskine $P/work/assets` | Only if the photos change |
| Cover label | `python3 label.py $P/lettering.json $P/work/assets/cover-front.png $P/work/assets/cover-label.png` | Only if the label changes |
| Lettering | `python3 alapreis.py $P/lettering.json $P/work/title28.json` then `python3 lettering_fix.py $P/lettering.json $P/work/title28.json $P/work/lettering.json` | Only if the lettering changes |
| Illustrations | `FR_PHOTOS=$P/photos FR_OUT=$P/work/ill python3 illus3.py 1 2 ... 33 31b` | Only if a tracing is redone. Search areas per page are in `REGIONS` |
| Icons | `FR_PHOTOS=$P/photos python3 icon.py ../../public/projects/familienrezepte/app` | Only if the icon changes |
| **The app** | `FR_PASS='the password' python3 build.py $P/work ../../public/projects/familienrezepte/app` | After any change to recipes, lettering, illustrations, or `app.js` |

The password is only ever typed into the command line; it is not stored anywhere. A rebuild with the same password keeps everyone's saved unlock working. A new password locks every browser until they enter the new one.

Files that did not change come out byte-identical, so a rebuild only shows real changes in GitHub Desktop.

## How the pieces fit

- `index.template.html`: the page and its styles; `build.py` fills in the file versions and writes `index.html`
- `app.js` (in the app folder): the notebook. Opening, turning, the back cover, unlocking, and the layout of each page: text first, then Lena's illustrations placed as close as possible to where she put them, without touching the text
- `data/core.bin`: recipes, lettering, contents; `data/ill-NN.bin`: the illustrations for page NN, loaded after the book opens
