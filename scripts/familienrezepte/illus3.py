"""Traces Lena's painted cut-outs into colour-layered vector shapes (third version, builds on illus2.py).
What is new: each cut-out is found by its paper (whiter than the card around it), and everything painted inside
that paper is the picture. So grey or pale parts (a pot, a spoon, a sugar packet) are kept, the paper itself and
its shadow line are dropped, and two cut-outs in one search box come out as two items.
Usage: python3 illus3.py <page> [<page> ...]   -> writes ill_<page>.json into $FR_OUT (default .)
Search boxes per page are in REGIONS (photo pixels); pages not listed use the automatic finder."""
import sys, os, json, cv2, numpy as np, potrace
from detect import load, white_card
from spacing import line_spacing
from find_items import find_items

# Search boxes (x0, y0, x1, y1) in photo pixels, read off the photos where the automatic finder misses parts
REGIONS = {
    2: [(600, 1500, 1310, 1960)],
    3: [(1300, 440, 1580, 690), (1090, 1760, 1670, 2200), (780, 2110, 1070, 2350)],
    8: [(630, 1790, 1450, 2140), (1360, 510, 1710, 780)],
    10: [(1330, 540, 1560, 710), (700, 1980, 1340, 2420)],
    13: [(1290, 420, 1530, 620), (780, 2030, 1360, 2290)],
    14: [(1360, 390, 1640, 920), (890, 1830, 1210, 2160)],
    15: [(1160, 310, 1740, 980), (320, 1940, 1080, 2300)],
    16: [(1220, 530, 1600, 870), (1300, 880, 1720, 1180), (850, 1990, 1480, 2295)],
    17: [(1240, 540, 1590, 860), (1560, 770, 1780, 1030), (420, 2040, 910, 2220)],
    20: [(1340, 540, 1650, 810), (1290, 1890, 1730, 2330), (1000, 2190, 1290, 2410)],
    24: [(1200, 460, 1700, 1060), (330, 2150, 750, 2362)],
    27: [(1330, 530, 1680, 1000), (760, 1690, 1340, 2290)],
    '31b': [(620, 1270, 1520, 1870)],
    32: [(1550, 310, 1750, 530), (640, 1940, 960, 2370), (1050, 2010, 1430, 2370)],
}

DARK = {32: 9, 8: 10, 20: 10}
COL = {3: 7}        # pages with very pale painted parts (the stripes of a bowl)      # pages whose grey parts (a glass) are close to the card's tone
PAGE = None

def fill_holes(m):
    # a one-pixel frame first, so the flood always starts outside the shape, even when it touches the edge
    p = np.pad(m, 1); h, w = p.shape; ff = p.copy(); mask = np.zeros((h+2, w+2), np.uint8)
    cv2.floodFill(ff, mask, (0, 0), 1)
    return (p | (1 - ff))[1:-1, 1:-1]

def path_d(bw, k, tol=0.9):
    pth = potrace.Bitmap(~bw).trace(turdsize=30, alphamax=1.1, opticurve=True, opttolerance=tol)
    def f(q):
        a, b = round(q.x*k, 1), round(q.y*k, 1)
        return f"{a:g} {b:g}"
    d = []
    for cv in pth:
        d.append("M" + f(cv.start_point))
        for sg in cv.segments:
            d.append(("L" + f(sg.c) + "L" + f(sg.end_point)) if sg.is_corner else ("C" + f(sg.c1) + " " + f(sg.c2) + " " + f(sg.end_point)))
        d.append("Z")
    return "".join(d)

def paint_items(im, region, up=3):
    """Everything painted inside one search box, split into separate items by distance.
    Paint is coloured (chroma) or clearly darker than the card (a grey pot, a spoon). Thin dark marks, such as the
    ruled lines, handwriting, and the shadow line of a cut edge, are removed by a morphological opening."""
    x0, y0, x1, y1 = [int(v) for v in region]
    x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(im.shape[1], x1), min(im.shape[0], y1)
    crop = im[y0:y1, x0:x1]
    g = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY); hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    paper = crop[(g > np.percentile(g, 93)) & (hsv[..., 1] < 30)]
    ref = np.median(paper, 0) if len(paper) > 50 else np.array([235, 235, 235.])
    bal = np.clip(crop.astype(np.float32) * (248.0 / ref), 0, 255).astype(np.uint8)
    lab = cv2.cvtColor(cv2.bilateralFilter(bal, 7, 20, 4), cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1]-128, lab[..., 2]-128
    chroma = np.sqrt(a*a + b*b)
    border = np.concatenate([L[:6].ravel(), L[-6:].ravel(), L[:, :6].ravel(), L[:, -6:].ravel()])
    lcard = np.median(border)
    cbord = np.concatenate([chroma[:6].ravel(), chroma[-6:].ravel(), chroma[:, :6].ravel(), chroma[:, -6:].ravel()])
    col = (chroma > max(COL.get(PAGE, 10), np.median(cbord) + 8)).astype(np.uint8)      # tinted paper (the back of a page) is not paint
    col = cv2.morphologyEx(col, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    dark = (L < lcard - DARK.get(PAGE, 16)).astype(np.uint8)
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    paint = col | dark
    n, cl, st, _ = cv2.connectedComponentsWithStats(paint, 8)
    keep = np.zeros(n, bool)
    for j in range(1, n):
        x, y, w, h, ar = st[j]
        if ar < 40: continue
        m = cl == j
        coloured = col[m].mean()
        if (coloured > 0.15 and ar >= 60) or (ar >= 1200 and ar / (w*h) > 0.25): keep[j] = True
    # thin, weakly coloured marks are the shadow line along a cut edge, not paint
    dist = cv2.distanceTransform(paint, cv2.DIST_L2, 3)
    for j in range(1, n):
        if keep[j]:
            m = cl == j
            if dist[m].max() < 3.2 and chroma[m].mean() < 22: keep[j] = False
            x, y, w, h, ar = st[j]
            if max(w, h) > 4*min(w, h) and dist[m].max() < 4 and chroma[m].mean() < 30: keep[j] = False   # shadow line of a cut edge
            if w > 5*h and h < 40 and chroma[m].mean() < 18: keep[j] = False   # a flat, colourless band: the card's edge
    paint = (keep[cl] & (cl > 0)).astype(np.uint8)
    paint = cv2.morphologyEx(paint, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    grp = cv2.dilate(paint, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (51, 51)))
    n, gl, gs, _ = cv2.connectedComponentsWithStats(grp, 8)
    out = []
    for j in range(1, n):
        m = (gl == j) & (paint > 0)
        if m.sum() < 500: continue
        ys, xs = np.where(m); w, h = np.ptp(xs)+1, np.ptp(ys)+1
        if w/h > 7 or h/w > 7: continue                          # the card's edge, a spiral, a strip of table
        if m.sum() < 2500 and col[m].mean() < 0.3: continue      # handwriting next to a picture
        if m.sum() < 8000 and col[m].mean() < 0.02: continue     # the black spiral, a dark corner
        if m.sum() < 1500 and col[m].mean() < 0.5: continue      # a speck of shadow or dirt
        if m.sum() < 3000 and chroma[m].mean() < 18: continue      # a pale speck of shadow
        ys2, xs2 = np.where(m); H, W = m.shape
        edge = ys2.min() <= 2 or xs2.min() <= 2 or ys2.max() >= H-3 or xs2.max() >= W-3
        if edge and w > 3*h and chroma[m].mean() < 25: continue   # a strip of the card's edge or its shadow, cut by the search box
        out.append((m.astype(np.uint8), (x0, y0), bal))
    return out

def vectorise4(m, off, bal, s, K=12, up=3, pad=6):
    ys, xs = np.where(m)
    bx0, by0 = max(0, xs.min()-pad), max(0, ys.min()-pad)
    bx1, by1 = min(m.shape[1], xs.max()+1+pad), min(m.shape[0], ys.max()+1+pad)
    crop = bal[by0:by1, bx0:bx1]; mm = m[by0:by1, bx0:bx1]
    big = cv2.resize(crop, None, fx=up, fy=up, interpolation=cv2.INTER_CUBIC)
    sm = cv2.bilateralFilter(big, 9, 24, 5)
    paint = cv2.resize(mm*255, None, fx=up, fy=up, interpolation=cv2.INTER_LINEAR) > 127
    lab = cv2.cvtColor(sm, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1]-128, lab[..., 2]-128
    X = np.stack([L[paint], a[paint]*1.4, b[paint]*1.4], 1)
    K = max(3, min(K, int(paint.sum() / (up*up*350)) + 3))
    rs = np.random.default_rng(1).choice(len(X), min(len(X), 60000), replace=False)
    cv2.setRNGSeed(3)
    _, _, cent = cv2.kmeans(X[rs], K, None, (cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER, 80, 0.2), 6, cv2.KMEANS_PP_CENTERS)
    lbl = np.full(paint.shape, -1, int)
    lbl[paint] = np.stack([((X-c)**2).sum(1) for c in cent], 1).argmin(1)
    votes = np.stack([cv2.blur((lbl == k).astype(np.float32), (5, 5)) for k in range(K)], 0)
    lbl = np.where(paint, votes.argmax(0), -1)
    def colour(msk):
        col = sm[msk].reshape(-1, 3).mean(0)[::-1]
        hsv = cv2.cvtColor(np.uint8([[col]]), cv2.COLOR_RGB2HSV)[0, 0].astype(float); hsv[1] = min(255, hsv[1]*1.08)
        return '#%02x%02x%02x' % tuple(int(v) for v in cv2.cvtColor(np.uint8([[hsv]]), cv2.COLOR_HSV2RGB)[0, 0])
    def trace(msk, blur=0.8):
        return path_d(cv2.GaussianBlur(msk, (0, 0), up*blur) > 120, s/up)
    order = [k for k in np.argsort(-cent[:, 0]) if (lbl == k).sum() > 20*up*up] or [k for k in np.argsort(-cent[:, 0]) if (lbl == k).any()]
    filled = fill_holes(paint.astype(np.uint8))
    holes = (filled > 0) & ~paint
    n2, hl, hs, _ = cv2.connectedComponentsWithStats(holes.astype(np.uint8), 8)
    hk = np.zeros(n2, bool); hk[1:] = hs[1:, 4] >= 120*up*up
    holes = (hk[hl] & (hl > 0)).astype(np.uint8)*255
    white = trace(cv2.dilate(holes, np.ones((5, 5), np.uint8)), 0.8) if holes.any() and holes.sum()/255 < 0.25*paint.sum() else ''
    layers = [dict(d=trace(paint.astype(np.uint8)*255, 1.2), c=colour(lbl == order[0]))]
    for k in order[1:]:
        msk = cv2.dilate((lbl == k).astype(np.uint8)*255, np.ones((3, 3), np.uint8))
        layers.append(dict(d=trace(msk), c=colour(lbl == k)))
    out = dict(w=round(crop.shape[1]*s, 1), h=round(crop.shape[0]*s, 1), px=int(off[0]+bx0), py=int(off[1]+by0), layers=layers)
    if white: out['white'] = white
    return out

def page(p):
    global PAGE; PAGE = p
    im, auto, _, _ = find_items(p)
    card, (cx, cy, cw, ch) = white_card(im)
    sp = line_spacing(p if p != '31b' else 31); s = 60.0/sp
    regions = REGIONS.get(p) or [(x-70, y-70, x+w+70, y+h+70) for (x, y, w, h) in auto]
    items, seen = [], []
    for r in regions:
        for m, off, bal in paint_items(im, r):
            ys, xs = np.where(m); key = (int(xs.mean())+off[0], int(ys.mean())+off[1])
            if any(abs(key[0]-k[0]) < 25 and abs(key[1]-k[1]) < 25 for k in seen): continue
            seen.append(key)
            v = vectorise4(m, off, bal, s)
            v['x'] = round((v.pop('px')-cx)*s, 1); v['y'] = round((v.pop('py')-cy)*s, 1)
            items.append(v)
    items.sort(key=lambda v: (v['y'], v['x']))
    return dict(card=[round(cw*s, 1), round(ch*s, 1)], items=items)

if __name__ == '__main__':
    out = os.environ.get('FR_OUT', '.')
    for a in sys.argv[1:]:
        p = int(a) if a.isdigit() else a
        d = page(p)
        json.dump(d, open(os.path.join(out, f'ill_{a}.json'), 'w'), separators=(',', ':'))
        print(a, len(d['items']), 'items', sum(len(l['d']) for v in d['items'] for l in v['layers'])//1024, 'KB', [(v['w'], v['h']) for v in d['items']], flush=True)
