"""Prepares the Moleskine photos: removes the ribbon from the open spread and rebuilds a plain gutter,
splits off the elastic band from the front cover, removes the logo from the back cover.
Usage: python3 moleskine.py <folder with the four photos> <output folder>"""
import sys, numpy as np, cv2
src, out = sys.argv[1], sys.argv[2]
rng = np.random.default_rng(7)

# ---------- open spread ----------
s = cv2.imread(f'{src}/Open_with bookmark.png', cv2.IMREAD_UNCHANGED).astype(np.float32)
H, W = s.shape[:2]
SP = 640                      # the spine (middle of the ribbon)
L0, R0 = 626, 655             # columns covered by the ribbon and its shadow
left = s[:, L0-6:L0].mean(axis=1, keepdims=True)      # per row: what the left page looks like next to the ribbon
right = s[:, R0+1:R0+7].mean(axis=1, keepdims=True)
fill = s.copy()
fill[:, L0:SP] = left; fill[:, SP:R0+1] = right
# carry the paper's fine grain across, taken from the strips beside the ribbon
gl = s[:, L0-(SP-L0):L0, :3] - cv2.blur(s[:, L0-(SP-L0):L0, :3], (5, 5))
gr = s[:, R0+1:R0+1+(R0+1-SP), :3] - cv2.blur(s[:, R0+1:R0+1+(R0+1-SP), :3], (5, 5))
fill[:, L0:SP, :3] += gl[:, ::-1]; fill[:, SP:R0+1, :3] += gr[:, ::-1]
# the gutter: pages curve down into the fold. Left page falls away into shadow, right page rises out of it
x = np.arange(W, dtype=np.float32)
shade = np.ones(W, np.float32)
dl = np.clip(SP - x, 0, None); dr = np.clip(x - SP + 1, 0, None)
shade[x < SP] = (1 - 0.30*np.exp(-dl/2.2) - 0.13*np.exp(-dl/9.0) - 0.05*np.exp(-dl/30.0))[x < SP]
shade[x >= SP] = (1 - 0.22*np.exp(-dr/1.6) - 0.07*np.exp(-dr/7.0) - 0.03*np.exp(-dr/26.0))[x >= SP]
# only apply the extra shading where the ribbon was plus a gentle tail, the photo already has its own falloff
page_rows = np.zeros((H, 1, 1), np.float32); page_rows[4:999] = 1
fill[..., :3] = fill[..., :3] * (1 - page_rows * (1 - shade[None, :, None]))
fill[1004:, :, 3] = 0         # the ribbon's tail below the book
fill[:1, :, 3] = np.minimum(fill[:1, :, 3], s[:1, 600:601, 3])
fill = np.clip(fill, 0, 255)[:1006]

def defringe(im, px=2):
    """The product photos carry a pale halo along the cut-out edge: pull the edge in by a couple of pixels."""
    a = im[..., 3].copy()
    core = cv2.erode((a > 200).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=px).astype(np.float32)
    im[..., 3] = np.minimum(a, cv2.GaussianBlur(core, (0, 0), 0.7)*255)
    return im

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
fill = defringe(fill)
fill = np.hstack([straighten(fill[:, :SP]), straighten(fill[:, SP:])])
spread = np.clip(fill, 0, 255).astype(np.uint8)
cv2.imwrite(f'{out}/spread.png', spread)
cv2.imwrite(f'{out}/page-right.png', spread[:, SP:])
cv2.imwrite(f'{out}/page-left.png', spread[:, :SP])
# inside front cover: the same left half with the ruling taken out (a plain endpaper)
lp = spread[:, :SP].copy()
plain = cv2.medianBlur(lp[..., :3], 1)
k = 13
med = np.stack([cv2.medianBlur(np.ascontiguousarray(lp[..., c].T), k).T for c in range(3)], axis=-1)  # median along x keeps rules; do along y instead
med = np.stack([np.median(np.lib.stride_tricks.sliding_window_view(np.pad(lp[..., c], ((k//2, k//2), (0, 0)), mode='edge'), k, axis=0), axis=-1) for c in range(3)], axis=-1)
m = np.zeros(lp.shape[:2], np.float32); m[30:975, 12:SP] = 1; m = cv2.GaussianBlur(m, (0, 0), 3)[..., None]
grain = rng.normal(0, 1.1, lp.shape[:2]).astype(np.float32)[..., None]
lp[..., :3] = np.clip(lp[..., :3]*(1-m) + (med + grain)*m, 0, 255)
cv2.imwrite(f'{out}/endpaper-left.png', lp)
# inside back cover: the right half without the ruling, the same way
rp = spread[:, SP:].copy()
med = np.stack([np.median(np.lib.stride_tricks.sliding_window_view(np.pad(rp[..., c], ((k//2, k//2), (0, 0)), mode='edge'), k, axis=0), axis=-1) for c in range(3)], axis=-1)
m = np.zeros(rp.shape[:2], np.float32); m[30:975, 0:rp.shape[1]-12] = 1; m = cv2.GaussianBlur(m, (0, 0), 3)[..., None]
grain = rng.normal(0, 1.1, rp.shape[:2]).astype(np.float32)[..., None]
rp[..., :3] = np.clip(rp[..., :3]*(1-m) + (med + grain)*m, 0, 255)
cv2.imwrite(f'{out}/endpaper-right.png', rp)

# ---------- front cover ----------
f = cv2.imread(f'{src}/Front.png', cv2.IMREAD_UNCHANGED).astype(np.float32)   # grey + alpha, read as BGRA
f[1004:, :, 3] = 0            # ribbon tail
f[985:, 35:95, 3] = np.minimum(f[985:, 35:95, 3], f[985:, 100:101, 3])   # the stub of ribbon that peeks out under the cover's lower edge
E0, E1 = 541, 583             # elastic band and its shadow
D = 70
noel = f.copy()
w = np.ones(f.shape[1], np.float32); xx = np.arange(f.shape[1])
w = np.clip(np.minimum(xx - (E0-8), (E1+8) - xx) / 8.0, 0, 1)[None, :, None]   # feathered mask over the band
shifted = np.roll(f, D, axis=1)                                                  # leather from 70 px to the left
noel = f*(1-w) + shifted*w
noel[..., 3] = np.where((xx[None, :] >= E0-8) & (xx[None, :] <= E1+8), np.minimum(shifted[..., 3], 255), f[..., 3])
cv2.imwrite(f'{out}/cover-front.png', np.clip(defringe(noel[:1004]), 0, 255).astype(np.uint8))
el = f.copy()
ew = np.clip(np.minimum(xx - (E0+3), (E1-3) - xx) / 2.0, 0, 1)[None, :]
el[..., 3] = el[..., 3] * ew
cv2.imwrite(f'{out}/cover-elastic.png', np.clip(el, 0, 255).astype(np.uint8)[:1004, E0:E1+1])
cv2.imwrite(f'{out}/cover-front-with-elastic.png', np.clip(f, 0, 255).astype(np.uint8)[:1006])

# ---------- back cover ----------
b = cv2.imread(f'{src}/Back.png', cv2.IMREAD_UNCHANGED).astype(np.float32)
b[1004:, :, 3] = 0
b[985:, 575:625, 3] = np.minimum(b[985:, 575:625, 3], b[985:, 560:561, 3])
y0, y1, x0, x1 = 912, 958, 225, 445
mask = np.zeros(b.shape[:2], np.float32); mask[y0:y1, x0:x1] = 1; mask = cv2.GaussianBlur(mask, (0, 0), 5)[..., None]
donor = np.roll(b, 70, axis=0)                                                   # leather from 70 px above
b = b*(1-mask) + donor*mask
cv2.imwrite(f'{out}/cover-back.png', np.clip(defringe(b[:1004]), 0, 255).astype(np.uint8))
print('ok', spread.shape)
