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
  - `assets/*.png`: the prepared notebook pictures; `assets/outline.json`: the outline of the top page (from `sheets.py`)

## Rebuilding

Python 3 with `opencv-python numpy potracer cairosvg pillow cryptography`. Run from this folder; `P` is the private folder.

| Step | Command | When |
| --- | --- | --- |
| Notebook pictures | `python3 moleskine.py $P/moleskine $P/work/assets` | Only if the photos change. Makes the covers and label base; since 17 November its open-spread pictures are replaced by the next step |
| Open notebook | `python3 notebook.py $P/moleskine/moleskine-double-spread.png $P/work/assets` | After `moleskine.py`, or if the open-spread image changes. Fits the bookmark-free spread into the book's existing geometry (page-left/right, endpapers), then runs `sheets.py` |
| Turning sheets | `python3 sheets.py $P/work/assets` | Run by `notebook.py`; on its own only if page-left/right change by hand. Cuts sheet-left/right (the paper of a page in motion) from the page pictures along the top page's outline and writes `outline.json` |
| Cover label | `python3 label.py $P/lettering.json $P/work/assets/cover-front.png $P/work/assets/cover-label.png` | Only if the label changes |
| Lettering | `python3 alapreis.py $P/lettering.json $P/work/title28.json` then `python3 lettering_fix.py $P/lettering.json $P/work/title28.json $P/work/lettering.json` | Only if the lettering changes |
| Illustrations | `FR_PHOTOS=$P/photos FR_OUT=$P/work/ill python3 illus3.py 1 2 ... 33 31b` | Only if a tracing is redone. Search areas per page are in `REGIONS` |
| Icons | `python3 icon.py ../../../private/familienrezepte/work ../../public/projects/familienrezepte/app` | Only if the icon changes (orange apple, 25_03) |
| **The app** | `FR_PASS='the password' python3 build.py $P/work ../../public/projects/familienrezepte/app` | After any change to recipes, lettering, illustrations, or `app.js` |

The password is only ever typed into the command line; it is not stored anywhere. A rebuild with the same password keeps everyone's saved unlock working. A new password locks every browser until they enter the new one.

Files that did not change come out byte-identical, so a rebuild only shows real changes in GitHub Desktop.

## How the pieces fit

- `index.template.html`: the page and its styles; `build.py` fills in the file versions and the top page's outline and writes `index.html`
- `app.js` (in the app folder): the notebook. Opening, turning, the back cover, unlocking, and the layout of each page: text first, then Lena's illustrations placed as close as possible to where she put them, without touching the text. Where one arrangement of pictures suits both languages, German and English share it, so switching the language moves nothing
- `data/core.bin`: recipes, lettering, contents; `data/ill-NN.bin`: the illustrations for page NN, loaded after the book opens

## How a page turns (since 18 November)

A turning page is a row of flat vertical strips (about 30, or 14 per page when riffling to a page from the contents), each a copy of the page cut to its slice. Every frame the strips are only moved and narrowed (`transform`), never repainted: the light and shade across the bend are drawn into one small canvas per page, and the shadow it casts into another. This keeps turns at the screen's full frame rate on laptops and phones. The strips are cut from `sheet-left/right`, which follow the photographed top page exactly (its dip into the gutter, its free edge, its corners), so a page starts and lands without any jump. The next and previous pages are prepared while the reader is idle, so a turn starts at once. Illustrations that arrive during a turn are placed after it ends.
