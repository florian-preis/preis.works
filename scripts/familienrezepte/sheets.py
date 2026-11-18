"""Paper for a page in motion (sheet-left/right), cut exactly to the outline of the top page in the photographed
notebook, so a turning page fits the book wherever it is: it dips into the gutter like the pages do, its free edge
lies on the top page's own edge (not on the stack of page edges beside it), and its corners are the top page's
corners. Lying flat, it covers the photographed page pixel for pixel: a turn starts and lands without any jump.

The picture is the photographed page itself (page-left/right), with everything outside the top page (board, stack,
background) painted over with the paper next to it, and an alpha channel that is the top page's outline. The same
outline is written to outline.json (top and foot of the paper at every unit across the sheet), which the app uses to
cut the light and shade on a turning page to the same shape.

Usage: python3 sheets.py <assets folder>    (reads page-left.png, page-right.png; writes sheet-left.png,
sheet-right.png, outline.json). notebook.py runs this at its end."""
import sys, json, numpy as np, cv2

SHEET_W, SHEET_H, TOP = 608, 994, 3          # a sheet is 608 x 994 units, its top on row 3 of the page pictures
T = 120.0                                    # board / paper threshold (luminance)
FORE = {'right': 604.8, 'left': 34.5}        # the top page's free edge, in page-picture columns (measured)
R = 16.0                                     # the top page's corner radius, in units (measured on all four corners)
SS = 4                                       # supersampling for the outline's anti-aliasing


def boundaries(page):
    """Top and foot of the paper in every column of a page picture: where the dark board line ends, to a tenth of a
    pixel. Columns without paper get NaN."""
    lum = page[..., :3].astype(np.float32).mean(2); a = page[..., 3].astype(np.float32)
    H, W = lum.shape; top = np.full(W, np.nan); bot = np.full(W, np.nan)
    for x in range(W):
        col = lum[:, x]; dark = (col < T) & (a[:, x] > 100)
        tb = np.where(dark[:45])[0]; bb = np.where(dark[H - 51:])[0] + H - 51
        if len(tb):
            y = tb[-1]; va, vb = col[y], col[y + 1]
            if vb > T: top[x] = y + (T - va) / (vb - va)
        if len(bb):
            y = bb[0]; va, vb = col[y - 1], col[y]
            if va > T: bot[x] = (y - 1) + (va - T) / (va - vb)
    return top, bot


def smooth(v, k=5):
    """Light smoothing of a measured edge, so the outline has no pixel noise; NaNs stay NaN"""
    ok = ~np.isnan(v); out = v.copy()
    if ok.sum() < k: return out
    idx = np.where(ok)[0]; vals = v[ok]
    pad = np.pad(vals, k // 2, mode='edge'); sm = np.convolve(pad, np.ones(k) / k, mode='valid')
    out[idx] = sm
    return out


def outline(side, page):
    """The top page's outline in sheet coordinates: for every sheet column, the top and foot of its paper, with the
    free edge and the rounded corners cut in. Returns arrays over x = 0..608 (NaN where there is no paper)."""
    top, bot = boundaries(page)
    top, bot = smooth(top), smooth(bot)
    x0 = 32 if side == 'left' else 0                         # sheet column 0 in the page picture
    xs = np.arange(SHEET_W + 1, dtype=np.float32)
    px = xs + x0
    t = np.interp(px, np.arange(len(top))[~np.isnan(top)], top[~np.isnan(top)]) - TOP
    b = np.interp(px, np.arange(len(bot))[~np.isnan(bot)], bot[~np.isnan(bot)]) - TOP
    fe = FORE[side] - x0                                     # the free edge, in sheet columns
    # rounded corners at the free edge: a circle of radius R touching the free edge and the top (foot) line
    if side == 'right':
        cx = fe - R; inside = xs <= fe
        near = xs > cx
        dx = np.clip(xs - cx, 0, R)
    else:
        cx = fe + R; inside = xs >= fe
        near = xs < cx
        dx = np.clip(cx - xs, 0, R)
    ct = np.interp(cx + x0, np.arange(len(top))[~np.isnan(top)], top[~np.isnan(top)]) - TOP + R   # centres
    cb = np.interp(cx + x0, np.arange(len(bot))[~np.isnan(bot)], bot[~np.isnan(bot)]) - TOP - R
    arc = np.sqrt(np.clip(R * R - dx * dx, 0, None))
    t = np.where(near, np.maximum(t, ct - arc), t)
    b = np.where(near, np.minimum(b, cb + arc), b)
    t = np.where(inside, np.maximum(t, 0), np.nan); b = np.where(inside, np.minimum(b, SHEET_H), np.nan)
    return xs, t, b, fe


def mask(side, xs, t, b, fe):
    """Coverage of the outline per pixel, by supersampling"""
    hs = np.arange(SHEET_H * SS, dtype=np.float32) / SS + 0.5 / SS
    ws = np.arange(SHEET_W * SS, dtype=np.float32) / SS + 0.5 / SS
    tt = np.interp(ws, xs, np.nan_to_num(t, nan=1e9)); bb = np.interp(ws, xs, np.nan_to_num(b, nan=-1e9))
    inx = (ws <= fe) if side == 'right' else (ws >= fe)
    m = (hs[:, None] > tt[None, :]) & (hs[:, None] < bb[None, :]) & inx[None, :]
    m = m.reshape(SHEET_H, SS, SHEET_W, SS).mean((1, 3))
    return (m * 255).round().astype(np.uint8)


def sheet(side, page):
    x0 = 32 if side == 'left' else 0
    xs, t, b, fe = outline(side, page)
    a = mask(side, xs, t, b, fe)
    rgb = page[TOP:TOP + SHEET_H, x0:x0 + SHEET_W, :3].copy()
    # everything outside the outline (board line, stack, background), and the photo's bright rim and edge line just
    # inside it, becomes paper: a page in motion is plain paper to its edges (as before), so nothing dark or white
    # travels with it. Only the side at the spine keeps its photographed shading
    full = (a >= 250).astype(np.uint8)
    pad = 4
    if side == 'right': padded = cv2.copyMakeBorder(full, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0); padded[:, :pad] = padded[:, pad:pad + 1]
    else: padded = cv2.copyMakeBorder(full, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0); padded[:, -pad:] = padded[:, -pad - 1:-pad]
    inner = cv2.erode(padded, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))[pad:-pad, pad:-pad]
    rgb = cv2.inpaint(rgb, (1 - inner).astype(np.uint8), 6, cv2.INPAINT_TELEA)
    out = np.dstack([rgb, a])
    nums = lambda v: [None if np.isnan(q) else round(float(q), 2) for q in v]
    return out, dict(edge=round(float(fe), 2), top=nums(t), foot=nums(b))


def make(d):
    """Write sheet-left.png, sheet-right.png and outline.json into folder d, from page-left.png and page-right.png there"""
    data = {}
    for side in ('left', 'right'):
        page = cv2.imread(f'{d}/page-{side}.png', cv2.IMREAD_UNCHANGED)
        img, o = sheet(side, page)
        cv2.imwrite(f'{d}/sheet-{side}.png', img); data[side] = o
        tops = [q for q in o['top'] if q is not None]; foots = [q for q in o['foot'] if q is not None]
        print(side, 'paper from column', next(i for i, q in enumerate(o['top']) if q is not None),
              'to', len(o['top']) - 1 - next(i for i, q in enumerate(reversed(o['top'])) if q is not None),
              '| top %.1f..%.1f, foot %.1f..%.1f' % (min(tops), max(tops), min(foots), max(foots)))
    json.dump(data, open(f'{d}/outline.json', 'w'), separators=(',', ':'))


if __name__ == '__main__':
    make(sys.argv[1]); print('ok')
