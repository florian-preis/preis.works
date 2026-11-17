"""The open notebook from Florian's bookmark-free spread (moleskine-double-spread.png, 17 November 2026), fitted
into the book's existing geometry so nothing else in the app has to change: 1283 x 1006, spine at x 640, ruling
at 77.5 + 29k (31 lines), page block edges where they were. The image is a little larger, its pages a little wider,
and it has two more ruled lines, so it is remapped, not just scaled:
  - across: the page-block edges and the gutter keep their size; only the plain paper in between is narrowed
  - down: each ruled line lands on the old line positions; two line pitches are taken out in the middle of the
    page (the paper is the same in every pitch, so the cut cannot be seen); the margins above and below follow
Then the same derived pictures as before: page-left/right, sheet-left/right (paper for a page in motion),
endpaper-left/right (inside covers, without ruling). The covers stay from the photos (moleskine.py).
Usage: python3 notebook.py <moleskine-double-spread.png> <output folder>"""
import sys, numpy as np, cv2
src, out = sys.argv[1], sys.argv[2]
rng = np.random.default_rng(7)
s = cv2.imread(src, cv2.IMREAD_UNCHANGED).astype(np.float32)
g = s[..., :3].mean(2); A = s[..., 3]
ys, xs = np.where(A > 128); NX0, NX1, NY0, NY1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
W, H, SP, K = 1283, 1006, 640, 31

# ---------- where the ruled lines are in the new image (sub-pixel, both pages) ----------
def line_centres(x0, x1):
    c = g[:, x0:x1].mean(1); bg = cv2.GaussianBlur(c.reshape(-1, 1), (1, 0), 8).ravel(); d = np.clip(bg - c, 0, None)
    out_ = []
    for y in range(NY0 + 40, NY1 - 20):
        if d[y] > 2.5 and d[y] >= d[y - 1] and d[y] > d[y + 1]:
            w = d[y - 2:y + 3]; out_.append(float((np.arange(y - 2, y + 3) * w).sum() / w.sum()))
    return np.array(out_)
la, lb = line_centres(250, 450), line_centres(900, 1100)
lines = np.array([b for b in lb if np.abs(la - b).min() < 1.5])            # lines seen on both pages
gap = np.median(np.diff(lines)); print('new ruling: %d lines, pitch %.3f, first %.2f, last %.2f' % (len(lines), gap, lines[0], lines[-1]))
CUT = len(lines) - K                                                       # pitches to take out
MID = K // 2

# ---------- the old geometry, measured from the photo version ----------
OLD = 77.5 + 29 * np.arange(K)
OTOP, OBOT = 3.0, 1002.0                                                   # top of the board, foot of the board
OGL, OGR = 640 - 60, 640 + 60                                              # gutter kept at its own size
# new gutter: the darkest column near the middle
mid = (NX0 + NX1) // 2; NSP = mid - 80 + int(np.argmin(g[500, mid - 80:mid + 80])) + 1
print('new spine', NSP, 'book', NX0, NX1, NY0, NY1)

# ---------- maps from the old frame to the new image ----------
def ymap(yo):
    yo = np.asarray(yo, np.float32); yn = np.empty_like(yo)
    top = yo < OLD[0]; yn[top] = NY0 + (yo[top] - OTOP) * (lines[0] - NY0) / (OLD[0] - OTOP)
    bot = yo >= OLD[-1]; yn[bot] = lines[-1] + (yo[bot] - OLD[-1]) * (NY1 - lines[-1]) / (OBOT - OLD[-1])
    mid_ = ~top & ~bot
    k = np.clip(np.floor((yo[mid_] - OLD[0]) / 29).astype(int), 0, K - 2); t = (yo[mid_] - OLD[k]) / 29
    kn = np.where((k > MID) | ((k == MID) & (t >= 0.5)), k + CUT, k)        # past the cut: two lines further on
    yn[mid_] = lines[kn] + t * (lines[np.minimum(kn + 1, len(lines) - 1)] - lines[kn])
    return yn
EDGE = 62                                                                  # page-block edge strip at either side, kept 1:1
def xmap(xo):
    xo = np.asarray(xo, np.float32); xn = np.empty_like(xo)
    a = xo < EDGE; xn[a] = NX0 + (xo[a] - 3)
    b = (xo >= EDGE) & (xo < OGL); xn[b] = NX0 + EDGE - 3 + (xo[b] - EDGE) * ((NSP - 60) - (NX0 + EDGE - 3)) / (OGL - EDGE)
    c = (xo >= OGL) & (xo < OGR); xn[c] = NSP + (xo[c] - 640)
    re = W - 4 - EDGE
    d = (xo >= OGR) & (xo < re); xn[d] = NSP + 60 + (xo[d] - OGR) * ((NX1 - EDGE) - (NSP + 60)) / (re - OGR)
    e = xo >= re; xn[e] = NX1 - EDGE + (xo[e] - re)
    return xn
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
mx = xmap(xx[0])[None, :].repeat(H, 0); my = ymap(yy[:, 0])[:, None].repeat(W, 1)
spread = cv2.remap(s, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
spread = np.clip(spread, 0, 255)
# check: the ruling now sits on the old lines
gg = spread[..., :3].mean(2); c = gg[:, 900:1100].mean(1); bg = cv2.GaussianBlur(c.reshape(-1, 1), (1, 0), 8).ravel()
found = [y for y in range(60, 990) if bg[y] - c[y] > 2.5 and c[y] <= c[y - 1] and c[y] < c[y + 1]]
print('ruling after the remap:', len(found), 'lines, worst offset %.2f' % max(abs(np.array(found)[:, None] - OLD[None, :]).min(1)))
spread = spread.astype(np.uint8)
cv2.imwrite(f'{out}/spread.png', spread)
cv2.imwrite(f'{out}/page-right.png', spread[:, SP:])
cv2.imwrite(f'{out}/page-left.png', spread[:, :SP])

# ---------- inside covers: the same halves without the ruling ----------
k = 13
def endpaper(half, box):
    p = half.copy()
    med = np.stack([np.median(np.lib.stride_tricks.sliding_window_view(np.pad(p[..., c], ((k // 2, k // 2), (0, 0)), mode='edge'), k, axis=0), axis=-1) for c in range(3)], axis=-1)
    m = np.zeros(p.shape[:2], np.float32); y0, y1, x0, x1 = box; m[y0:y1, x0:x1] = 1; m = cv2.GaussianBlur(m, (0, 0), 3)[..., None]
    grain = rng.normal(0, 1.1, p.shape[:2]).astype(np.float32)[..., None]
    p[..., :3] = np.clip(p[..., :3] * (1 - m) + (med + grain) * m, 0, 255)
    return p
cv2.imwrite(f'{out}/endpaper-left.png', endpaper(spread[:, :SP], (30, 975, 12, SP)))
cv2.imwrite(f'{out}/endpaper-right.png', endpaper(spread[:, SP:], (30, 975, 0, W - SP - 12)))

# ---------- paper for a page in motion: no cover, no page-block lines, paper to every edge ----------
def clean_sheet(page, x0, x1, src_cols, dst_cols):
    sh = page[3:997, x0:x1, :3].astype(np.float32).copy()
    a, b = src_cols; c, d = dst_cols; w = d - c
    sh[:, c:d] = sh[:, a:a + w]
    lum = sh.mean(2); bad = (lum < 175).astype(np.uint8); bad[40:-40, 40:-40] = 0
    bad = cv2.dilate(bad, np.ones((3, 3), np.uint8))
    return cv2.inpaint(np.clip(sh, 0, 255).astype(np.uint8), bad, 4, cv2.INPAINT_TELEA)
cv2.imwrite(f'{out}/sheet-right.png', clean_sheet(spread[:, SP:], 0, 608, (555, 580), (583, 608)))
cv2.imwrite(f'{out}/sheet-left.png', clean_sheet(spread[:, :SP], 32, 640, (50, 75), (0, 25)))
print('ok')
