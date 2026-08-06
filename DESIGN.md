# preis.works — design language

The projects page is the reference implementation. When redesigning anything else on this
site, match what is described here rather than inventing a parallel system.

Established August 2026. Applies to `index`, `photography`, and `projects`. The three
standalone apps in `projects/` keep their own identities and are out of scope.

---

## Direction

Evolution within an existing signature, not a redesign. Crisp, high-contrast, precise.
Reference points: Kompas, Kontrapunkt, Re-public, FutureBrand, Wimbledon.

**Not warm, textured, papery, or soft.** A warm off-white and paper-grain direction was
built and rejected. Do not revisit it.

**Not theatrical.** The reference sites are agencies performing capability, and four of five
lead with full-screen video. This is a personal site with a photo, four sentences, and three
side projects. Borrow their scale and rigour, not their showmanship.

**Elevation does not mean bigger.** Given four sizes for the opening line, the smallest was
chosen. Refinement comes from typeface, craft detail, interaction, and colour, not scale.

---

## Typography

**Inter**, variable weight, loaded from Google Fonts. Falls back to Helvetica Neue.

Chosen over Helvetica for a functional reason: Inter is variable, so weight itself becomes
animatable. Inter was preferred over Instrument Sans, Schibsted Grotesk, Geist, and Space
Grotesk. Do not switch to a second typeface; single-typeface was tested against a serif
pairing and won.

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Wordmark | 12px | 600 | 0.22em, uppercase |
| Card title | 27px | 300 | -0.022em |
| Lead line (About) | 20px | 400 | -0.012em |
| Body | 14–15px | 400 | normal |
| Tag / micro label | 10–11px | 400–500 | 0.18–0.22em, uppercase |

Tracking tightens as size grows and loosens as it shrinks. Weight drops to 300 above ~28px,
because Inter at 400 gets heavy at display sizes.

**High contrast body text.** Body copy is `#1a1a1a`, not grey. Grey body text on white is
the clearest tell of a template and was explicitly moved away from.

---

## Colour

| Token | Value | Use |
|---|---|---|
| `--bg` | `#ffffff` | page ground |
| `--text` | `#111111` | primary text |
| body copy | `#1a1a1a` | paragraphs |
| `--muted` | `#888888` | secondary text |
| `--border` | `#e5e5e5` | dividers |
| card border | `rgba(20,17,15,.09)` | rounded cards, at rest |
| card border hover | `rgba(20,17,15,.16)` | rounded cards, hover |
| chip fill | `#f2f2f1` | tags and pill buttons |

**The ink surface** is shared by the footer and the mobile menu. They are the same object
seen in two places, so they use one set of tokens and must never drift apart:

```
--ink-surface: #111111       --ink-on:    rgba(255,255,255,0.74)
--ink-grain:   0.20          --ink-on-hi: #ffffff
```

Both carry the identical animated grain: same SVG noise, 180px tiles, `--ink-grain` opacity,
`grainDrift 8s steps(10, end)`. A deep blue gradient footer was built and rejected.

**Illustration canvases** are the only other place colour appears.

Project illustration canvases use the same blue family with a **subtle pink** in the
mid-tones, never at the bright end, so it reads as a bloom in the canvas rather than a colour
applied to the artwork. Gradient ids `r4A` `r4B` `r4C`, vignette `r4Vig`, grain filters
`g4coarse` `g4mid` `g4fine`, all defined inline in `projects.html`.

---

## Shape

- Card radius **22px**, nested panel radius **14px**, **8px** of card between them
- Chips and pill buttons: `border-radius: 100px`
- Navbar pill (pre-existing): `border-radius: 100px`

The nesting is the point. A rounded card with a square panel pressed to its edge still reads
as a rectangle with filed corners.

**Open question:** the photography grid and the footer bar are still hard-edged. If the
rounding extends site-wide, that is a deliberate decision to make, not something to drift
into page by page.

## Mobile menu

A full-screen sheet on the ink surface, not a drawer. It sits below the navbar in z-order and
the navbar goes transparent while open, so the wordmark and close button stay in place. Links
at 27px weight 300. Escape closes it, tapping a link closes it, and body scrolling is locked
while it is open.

`html` carries `scrollbar-gutter: stable` site-wide, and it is load-bearing rather than
cosmetic. Locking page scroll removes the scrollbar, and where scrollbars occupy layout width
that widens the viewport by ~15px, which slides the fixed navbar's right edge sideways
mid-transition. Reserving the gutter keeps the viewport width constant. Do not remove it. The previous white drawer was rejected: white on a white page separated by
one hairline is indistinguishable from the content behind it.

## Photography delivery

Three sizes per photo, none committed, all regenerated on every build:

| | Width | Use | Total |
|---|---|---|---|
| original | as shot | source of truth | 46.2 MB |
| `thumb/` | 600px WebP | the grid | 1.7 MB |
| `view/` | 2000px WebP | the lightbox | 16.5 MB |

The lightbox shows the already-cached grid thumbnail behind a 12px blur while the full image
downloads, then swaps. It preloads one image either side, no more, because preloading further
competes for bandwidth with the picture on screen.

---

## Motion

Three durations, one curve. Never invent a fourth.

```
--ease:   cubic-bezier(0.22, 0.61, 0.36, 1)
--m-fast: 0.18s    hover states, colour changes
--m-base: 0.3s     transforms, borders, weight
--m-slow: 0.6s     reveals
```

Before this, the site had six different transition durations and four easing curves written
in isolation. Motion that is nearly-but-not-quite consistent is what reads as amateur.

**Wordmark:** a single quiet thickening from weight 600 to 700 on hover, nothing per-letter.
A staggered per-letter bloom to weight 900 was built and rejected as too much. The logo sits
at the left of a `space-between` row, so the extra width grows into empty space.

**Cards:** border darkens, 2px lift, diffuse shadow at 5.5% opacity, arrow nudges 3px.

**Illustrations:** one behaviour per app, each derived from what the app actually does.
Everything is slow on purpose.

| | Behaviour | Timing |
|---|---|---|
| cogniflow | Bars step up one pitch, then rest | 2.6s cycle, move over 22% |
| gowiththeflo | Sphere rotates on a vertical axis | 38s per half revolution |
| knowhere | Squares take turns fading to filled | 30s cycle, one reveal every 7.5s |

`prefers-reduced-motion` stops all of it.

---

## Illustration system

Abstract, generative, speculative rather than familiar. Deep blue gradient canvases with
grain and vignette, white line work.

Each illustration is built on a **different structure**, which is what stops the set
collapsing into variations of one idea:

- **cogniflow** — temporal. Text moves, the reading point does not
- **gowiththeflo** — spatial. A sphere turning, equator and two perpendicular meridians bright
- **knowhere** — relational. Four options, one confirmed

Rules that make them a set: one canvas ratio (1000×625), one line colour, white only, grain
and vignette on all three, and slow timing throughout.

**Do not** emulate the apps' interfaces. That was tried and rejected: three apps with
conflicting identities cannot be made to cohere on one page.

---

## Deliberately rejected

Recorded so they are not re-proposed.

- Warm paper palette and page-wide grain texture
- A blue gradient footer
- A per-letter weight bloom on the wordmark
- A brand mark beside the wordmark. Book, slides, aperture, and monogram directions were all
  explored and dropped. The wordmark stands alone
- A second typeface
- Larger display type on the About page
- Screenshot or interface-mockup previews
- Hand-drawn SVG interface approximations, which is what the old projects page used

---

## Known trade-offs

**The blue-pink gradient dates the work.** Blue to magenta reads clearly as 2025–26 in a way
Inter on white does not. Acceptable for a sandbox page, but it was chosen knowingly.

**Inter loads from Google Fonts.** One third-party request per page. Self-hosting a woff2 in
`assets/` would remove the dependency and is a reasonable later improvement.

**Rounded corners are currently only on the projects page.** See the open question above.
