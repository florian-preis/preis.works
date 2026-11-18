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
# the foot of the paper in the new image: the last bright row above the board, away from the spine
col = g[:, 880:920].mean(1); PAPER_END = float(max(y for y in range(int(lines[-1]), NY1) if col[y] > 200)) + 0.5
mid = (NX0 + NX1) // 2; NSP = mid - 80 + int(np.argmin(g[500, mid - 80:mid + 80])) + 1
print('new spine', NSP, 'book', NX0, NX1, NY0, NY1)

# ---------- maps from the old frame to the new image ----------
def ymap(yo, cut=None):
    yo = np.asarray(yo, np.float32); yn = np.empty_like(yo)
    # above the first line and below the last: the board's edge and the paper's edge land exactly where the
    # pages expect them (paper from row 4 to 996, as in the photo), so a turning sheet (rows 3 to 997) matches
    top = yo < OLD[0]; yn[top] = np.interp(yo[top], [0.5, 4.0, OLD[0]], [NY0, NY0 + 3.5, lines[0]])
    bot = yo >= OLD[-1]; yn[bot] = np.interp(yo[bot], [OLD[-1], 996.0, 1003.5], [lines[-1], PAPER_END, NY1])
    mid_ = ~top & ~bot
    k = np.clip(np.floor((yo[mid_] - OLD[0]) / 29).astype(int), 0, K - 2); t = (yo[mid_] - OLD[k]) / 29
    past = (k > MID) | ((k == MID) & (t >= 0.5)) if cut is None else np.full(k.shape, cut)
    kn = np.where(past, k + CUT, k)                                         # past the cut: two lines further on
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
# the crease's shading varies a little down the page, so across the cut the two sides are blended over a band
YC = OLD[MID] + 14.5; BAND = 12
before = cv2.remap(s, mx, ymap(yy[:, 0], False)[:, None].repeat(W, 1), cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
after = cv2.remap(s, mx, ymap(yy[:, 0], True)[:, None].repeat(W, 1), cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
w = np.clip((yy[:, :1] - (YC - BAND)) / (2 * BAND), 0, 1)[..., None]
band = np.abs(yy[:, :1] - YC) < BAND
spread = np.where(band[..., None], before * (1 - w) + after * w, spread)
spread = np.clip(spread, 0, 255)
# check: the ruling now sits on the old lines
gg = spread[..., :3].mean(2); c = gg[:, 900:1100].mean(1); bg = cv2.GaussianBlur(c.reshape(-1, 1), (1, 0), 8).ravel()
found = [y for y in range(60, 990) if bg[y] - c[y] > 2.5 and c[y] <= c[y - 1] and c[y] < c[y + 1]]
print('ruling after the remap:', len(found), 'lines, worst offset %.2f' % max(abs(np.array(found)[:, None] - OLD[None, :]).min(1)))
# the ruling in the image is not quite level on the left page (it drifts by up to 3 px towards the outer edge), so
# each half is levelled column by column, as for the photo (moleskine.py)
def straighten(half):
    """The printed ruling drifts by a few pixels across the page in the photo. Measure the drift per column and
    slide each column up or down so every line is level; the page edges stay where they are."""
    g = cv2.cvtColor(half[..., :3].astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
    Hh, Ww = g.shape; pts = []
    for x0 in range(14, Ww-40, 12):
        prof = g[:, x0:x0+12].mean(1); prof = cv2.GaussianBlur(prof.reshape(-1, 1), (1, 0), 12).ravel() - prof
        for k in range(31):
            y = 77.5 + 29*k; seg = prof[int(y)-9:int(y)+10]; j = int(np.argmax(seg))
            if 0 < j < 18 and seg[j] > 2:
                d = seg[j-1] - 2*seg[j] + seg[j+1]; sub = 0.5*(seg[j-1]-seg[j+1])/d if d else 0
                pts.append((x0+6, y, int(y)-9 + j + sub - y))
    P = np.array(pts); X, Y, Z = P[:, 0]/Ww, P[:, 1]/Hh, P[:, 2]
    basis = lambda X, Y: np.stack([np.ones_like(X), X, X*X, X**3, Y, X*Y, X*X*Y, X**3*Y, Y*Y, X*Y*Y], -1)
    co, *_ = np.linalg.lstsq(basis(X, Y), Z, rcond=None)
    for _ in range(2):                                   # refit without stray measurements
        ok = np.abs(basis(X, Y) @ co - Z) < 1.2; co, *_ = np.linalg.lstsq(basis(X[ok], Y[ok]), Z[ok], rcond=None)
    yy, xx = np.mgrid[0:Hh, 0:Ww].astype(np.float32)
    dy = (basis(xx/Ww, yy/Hh) @ co).astype(np.float32)
    print('ruling drift px (min, max, left over):', round(float(Z.min()), 2), round(float(Z.max()), 2), round(float(np.abs(basis(X[ok], Y[ok]) @ co - Z[ok]).mean()), 2))
    yy, xx = np.mgrid[0:Hh, 0:Ww].astype(np.float32)
    wgt = np.clip(np.minimum(yy - 20, 985 - yy)/30.0, 0, 1)
    out_ = cv2.remap(half, xx, yy + dy*wgt, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return out_
spread = np.hstack([straighten(spread[:, :SP]), straighten(spread[:, SP:])])
spread = np.clip(spread, 0, 255).astype(np.uint8)
cv2.imwrite(f'{out}/spread.png', spread)
cv2.imwrite(f'{out}/page-right.png', spread[:, SP:])
cv2.imwrite(f'{out}/page-left.png', spread[:, :SP])
for nm, x0, x1 in [('left page, outer', 40, 70), ('left page', 200, 400), ('right page', 900, 1100), ('right page, outer', 1180, 1220)]:
    c = spread[..., :3].astype(np.float32).mean(2)[:, x0:x1].mean(1); bg = cv2.GaussianBlur(c.reshape(-1, 1), (1, 0), 6).ravel()
    f = [y for y in range(60, 990) if bg[y] - c[y] > 1.5 and c[y] <= c[y - 1] and c[y] < c[y + 1]]
    print('ruling, %s: %d lines, worst offset %.1f' % (nm, len(f), max(np.abs(np.array(f)[:, None] - OLD[None, :]).min(1))))

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

# ---------- paper for a page in motion ----------
# cut from the page pictures along the outline of the top page, so a turning page dips into the gutter and meets the
# stack of pages exactly like the pages lying open (sheets.py; it also writes outline.json for the app)
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sheets
sheets.make(out)
print('ok')
