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

DARK = {32: 9, 8: 10, 20: 10, 16: 10}
COL = {3: 7, 16: 7}        # pages with very pale painted parts (the stripes of a bowl)      # pages whose grey parts (a glass) are close to the card's tone
PAGE = None
FRAC = []
RECT = []
MINFRAC = 0.6
ON_PAPER = {20}
PAD = {24: 8, '31b': 8}   # pages where the spiral binding sits close to a painting: search only the area drawn
NOPLATE = {33}      # a baking tin with rounded corners, which looks like a plate to the measurements

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
    strong = (chroma > 22).astype(np.uint8)                       # clearly coloured: keep even one-pixel stems
    col = cv2.morphologyEx(col, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) | (strong & col)
    dark = (L < lcard - DARK.get(PAGE, 16)).astype(np.uint8)
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    paint = col | dark
    if PAGE in ON_PAPER:     # keep only paint that sits on the white paper of a cut-out
        bright = (L > np.percentile(L, 92) - 14).astype(np.uint8)
        stk = fill_holes(cv2.morphologyEx(bright, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))))
        stk = cv2.morphologyEx(stk, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
        paint &= cv2.erode(stk, np.ones((5, 5), np.uint8))
    hline = paint & ~cv2.morphologyEx(paint, cv2.MORPH_OPEN, np.ones((11, 1), np.uint8))
    vline = paint & ~cv2.morphologyEx(paint, cv2.MORPH_OPEN, np.ones((1, 11), np.uint8))
    paint = paint & ~(((hline | vline) > 0) & (chroma < 17) & (L > lcard - 45)).astype(np.uint8)
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
            if max(w, h) > 4*min(w, h) and dist[m].max() < 7 and chroma[m].mean() < 32 and L[m].mean() > lcard - 40: keep[j] = False
            if w > 5*h and h < 40 and chroma[m].mean() < 18: keep[j] = False   # a flat, colourless band: the card's edge
    paint = (keep[cl] & (cl > 0)).astype(np.uint8)
    paint = cv2.morphologyEx(paint, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    grp = cv2.dilate(paint, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (51, 51)))
    n, gl, gs, _ = cv2.connectedComponentsWithStats(grp, 8)
    out = []
    for j in range(1, n):
        m = (gl == j) & (paint > 0)
        if m.sum() < 500: continue
        # crumbs: tiny, colourless bits that only joined the group by being near it (a cut edge, a speck)
        n4, cl4, st4, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
        for q in range(1, n4):
            if st4[q, 4] < max(150, 0.01 * m.sum()) and chroma[cl4 == q].mean() < 20: m[cl4 == q] = False
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

def ellipse_mask(shape, e, scale=1.0, ss=4):
    (cx, cy), (w, h), ang = e
    m = np.zeros((shape[0]*ss, shape[1]*ss), np.uint8)
    cv2.ellipse(m, ((cx*ss, cy*ss), (w*scale*ss, h*scale*ss), ang), 255, -1, cv2.LINE_AA)
    return cv2.resize(m, (shape[1], shape[0]), interpolation=cv2.INTER_AREA)

def find_plate(mm, lab):
    """A plate seen from above: the painted rim is an ellipse. Returns (ellipse, rim thickness) or None.
    The ellipse is fitted to the outline of everything painted; it counts as a plate when the outline is close to an
    ellipse and paint runs along most of it (the rim), even if the brush left gaps."""
    H, W = mm.shape
    if max(H, W) < 110 or PAGE in NOPLATE: return None
    comp = cv2.morphologyEx(mm, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    body = cv2.morphologyEx(fill_holes(comp), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (35, 35)))
    if body.sum() > 0: comp = body
    cs, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    hull = cv2.convexHull(c)
    if len(hull) < 5: return None
    e = cv2.fitEllipse(hull)
    (cx, cy), (ew, eh), ang = e
    if max(ew, eh) / max(1, min(ew, eh)) > 2.2 or min(ew, eh) < 90: return None
    hm = np.zeros_like(mm); cv2.drawContours(hm, [hull], -1, 1, -1)
    em = ellipse_mask(mm.shape, e) > 127
    iou = (em & (hm > 0)).sum() / max(1, (em | (hm > 0)).sum())
    if iou < 0.92: return None
    # the outline itself must follow the ellipse closely (a rounded baking tin does not, at its corners)
    pts_c = c[::3, 0, :].astype(np.float32)
    th = np.radians(ang); dx, dy = pts_c[:, 0] - cx, pts_c[:, 1] - cy
    xr, yr = dx*np.cos(th) + dy*np.sin(th), -dx*np.sin(th) + dy*np.cos(th)
    rr = np.sqrt((xr / (ew/2))**2 + (yr / (eh/2))**2)
    (rw, rh) = cv2.minAreaRect(c)[1]
    RECT.append(cv2.contourArea(c) / max(1, rw * rh))
    if RECT[-1] > 0.86: return None     # square-cornered, like a baking tin
    FRAC.append(((rr > 0.93) & (rr < 1.07)).mean())
    if FRAC[-1] < MINFRAC: return None
    # paint along the outline: sample the ellipse and look for paint just inside it
    near = cv2.dilate(mm, np.ones((9, 9), np.uint8)) > 0
    pts = cv2.ellipse2Poly((int(cx), int(cy)), (int(ew/2) - 3, int(eh/2) - 3), int(ang), 0, 360, 4)
    pts = pts[(pts[:, 0] >= 0) & (pts[:, 0] < W) & (pts[:, 1] >= 0) & (pts[:, 1] < H)]
    cover = near[pts[:, 1], pts[:, 0]].mean() if len(pts) else 0
    if cover < 0.6: return None
    band = (ellipse_mask(mm.shape, e, 1.0, 2) > 127) & ~(ellipse_mask(mm.shape, e, 1 - 16 / min(ew, eh), 2) > 127) & (mm > 0)
    if band.sum() < 100: return None
    yy, xx = np.nonzero(band); angs = (np.degrees(np.arctan2(yy - cy, xx - cx)) + 360) % 360
    Lb, ab_, bb = lab[..., 0][band], lab[..., 1][band], lab[..., 2][band]
    ref = np.array([np.median(Lb), np.median(ab_), np.median(bb)])
    good = 0
    for k in range(8):
        sel = (angs >= 45*k) & (angs < 45*(k+1))
        if sel.sum() < 15: continue
        med = np.array([np.median(Lb[sel]), np.median(ab_[sel]), np.median(bb[sel])])
        if np.linalg.norm((med - ref) * [0.6, 1, 1]) < 16: good += 1
    if good < 6: return None
    # just inside the rim lies the plate itself: pale and quiet. A round, evenly painted thing (a cabbage) has none
    ring = (ellipse_mask(mm.shape, e, 0.93, 2) > 127) & ~(ellipse_mask(mm.shape, e, 0.84, 2) > 127)
    rl = lab[..., 1][ring] - 128, lab[..., 2][ring] - 128
    if ring.sum() > 50 and np.median(np.hypot(*rl)) > 20: return None
    # a plate has a rim and something different inside it
    inn = (ellipse_mask(mm.shape, e, 0.7, 2) > 127) & (mm > 0)
    if inn.sum() > 100:
        refi = np.array([np.median(lab[..., 0][inn]), np.median(lab[..., 1][inn]), np.median(lab[..., 2][inn])])
        if np.linalg.norm((refi - ref) * [0.6, 1, 1]) < 12 and (mm[ellipse_mask(mm.shape, e, 0.7, 2) > 127] > 0).mean() > 0.85: return None
    # how thick the rim is: walk inwards in thin rings until the paint thins out
    prof = []
    for k in range(1, 30):
        ring = (ellipse_mask(mm.shape, e, 1 - (k - 1) / (0.5*min(ew, eh)), 2) > 127) & ~(ellipse_mask(mm.shape, e, 1 - k / (0.5*min(ew, eh)), 2) > 127)
        prof.append(mm[ring].mean() if ring.any() else 0)
    prof = np.array(prof); peak = int(prof[:12].argmax())
    t = peak + 1
    while t < len(prof) and prof[t] > 0.5 * prof[peak]: t += 1
    return e, float(np.clip(t * 0.7, 3, 7))

def vectorise4(m, off, bal, s, K=12, up=3, pad=14):
    ys, xs = np.where(m)
    bx0, by0 = max(0, xs.min()-pad), max(0, ys.min()-pad)
    bx1, by1 = min(m.shape[1], xs.max()+1+pad), min(m.shape[0], ys.max()+1+pad)
    crop = bal[by0:by1, bx0:bx1]; mm = m[by0:by1, bx0:bx1]
    lab0 = cv2.cvtColor(cv2.bilateralFilter(crop, 7, 20, 4), cv2.COLOR_BGR2LAB).astype(np.float32)
    plate = find_plate(mm, lab0)
    big = cv2.resize(crop, None, fx=up, fy=up, interpolation=cv2.INTER_CUBIC)
    sm = cv2.bilateralFilter(big, 9, 24, 5)
    paint = cv2.resize(mm*255, None, fx=up, fy=up, interpolation=cv2.INTER_LINEAR) > 127
    lab = cv2.cvtColor(sm, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1]-128, lab[..., 2]-128
    def colour_of(px):
        col = px.reshape(-1, 3).mean(0)[::-1]
        hsv = cv2.cvtColor(np.uint8([[col]]), cv2.COLOR_RGB2HSV)[0, 0].astype(float); hsv[1] = min(255, hsv[1]*1.04)
        return '#%02x%02x%02x' % tuple(int(v) for v in cv2.cvtColor(np.uint8([[hsv]]), cv2.COLOR_HSV2RGB)[0, 0])
    def trace(msk, blur=0.8):
        return path_d(cv2.GaussianBlur(msk, (0, 0), up*blur) > 120, s/up)
    layers, white = [], ''
    if plate:
        e, t = plate
        (cx, cy), (ew, eh), ang = e
        E = ((cx*up, cy*up), (ew*up, eh*up), ang)
        outer = ellipse_mask(paint.shape, E, 1.0, 2) > 127
        inner = ellipse_mask(paint.shape, E, 1 - 2*t/min(ew, eh), 2) > 127
        rim = outer & ~inner
        ch = np.sqrt(a*a + b*b)
        inside = inner & paint
        washpx = inside & (ch <= np.percentile(ch[inside], 40)) & (L > np.percentile(L[inside], 30)) if inside.any() else inner
        washcol = colour_of(sm[washpx]) if washpx.sum() > 50 else '#f4f1e8'
        wl = np.array(cv2.cvtColor(np.uint8([[[int(washcol[5:7], 16), int(washcol[3:5], 16), int(washcol[1:3], 16)]]]), cv2.COLOR_BGR2LAB)[0, 0], np.float32)
        dE = np.sqrt((L - wl[0])**2 + (a - (wl[1]-128))**2 + (b - (wl[2]-128))**2)
        rp = rim & paint
        rimpx = rp & (dE >= np.percentile(dE[rp], 65)) if rp.sum() > 50 else rim
        rimcol = colour_of(sm[rimpx])
        white = trace(outer.astype(np.uint8)*255, 0.3)
        layers.append(dict(d=trace(inner.astype(np.uint8)*255, 0.3), c=washcol))
        layers.append(dict(d=trace(rim.astype(np.uint8)*255, 0.3), c=rimcol))
        # the food: paint inside the rim that is clearly not the wash
        food = paint & cv2.erode(inner.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & (dE > 19)
        rl = np.array(cv2.cvtColor(np.uint8([[[int(rimcol[5:7], 16), int(rimcol[3:5], 16), int(rimcol[1:3], 16)]]]), cv2.COLOR_BGR2LAB)[0, 0], np.float32)
        dR = np.sqrt((L - rl[0])**2 + (a - (rl[1]-128))**2 + (b - (rl[2]-128))**2)
        nearrim = ~(ellipse_mask(paint.shape, E, 1 - 5*t/min(ew, eh), 2) > 127)
        food &= ~(nearrim & (dR < 22))                                   # leftovers of the painted rim
        food = cv2.morphologyEx(food.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))).astype(bool)
        # anything painted outside the plate (a spoon resting on it) stays too
        away = paint & ~cv2.dilate(outer.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (8*up+1, 8*up+1))).astype(bool)
        n3, al_, ast, _ = cv2.connectedComponentsWithStats(away.astype(np.uint8), 8)
        ak = np.zeros(n3, bool); ak[1:] = ast[1:, 4] >= 150*up*up      # only something substantial, such as a spoon
        food |= ak[al_] & (al_ > 0)
        region = food
    else:
        # small gaps in the paint are filled with the paint around them; real paper (the hole in a pretzel,
        # the loop of a handle, the white of a fried egg) stays open and shows the page
        filled = fill_holes(cv2.morphologyEx(paint.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3*up, 3*up))))
        holes = (filled > 0) & ~paint
        n2, hl, hs, _ = cv2.connectedComponentsWithStats(holes.astype(np.uint8), 8)
        hk = np.zeros(n2, bool); hk[1:] = hs[1:, 4] < 0.003 * filled.sum()
        region = paint | (hk[hl] & (hl > 0))
    if region.sum() > 30:
        X = np.stack([L[region], a[region]*1.4, b[region]*1.4], 1)
        K = max(3, min(K, int(region.sum() / (up*up*350)) + 3))
        rs = np.random.default_rng(1).choice(len(X), min(len(X), 60000), replace=False)
        cv2.setRNGSeed(3)
        _, _, cent = cv2.kmeans(X[rs], K, None, (cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER, 80, 0.2), 6, cv2.KMEANS_PP_CENTERS)
        lbl = np.full(region.shape, -1, int)
        lbl[region] = np.stack([((X-c)**2).sum(1) for c in cent], 1).argmin(1)
        kk = 7 if region.sum() > 40000*up*up/9 else 5
        votes = np.stack([cv2.blur((lbl == k).astype(np.float32), (kk, kk)) for k in range(K)], 0)
        lbl = np.where(region, votes.argmax(0), -1)
        order = [k for k in np.argsort(-cent[:, 0]) if (lbl == k).sum() > 20*up*up] or [k for k in np.argsort(-cent[:, 0]) if (lbl == k).any()]
        layers.append(dict(d=trace(region.astype(np.uint8)*255, 1.0 if plate else 1.2), c=colour_of(sm[lbl == order[0]])))
        for k in order[1:]:
            msk = cv2.dilate((lbl == k).astype(np.uint8)*255, np.ones((3, 3), np.uint8))
            layers.append(dict(d=trace(msk), c=colour_of(sm[lbl == k])))
    out = dict(w=round(crop.shape[1]*s, 1), h=round(crop.shape[0]*s, 1), px=int(off[0]+bx0), py=int(off[1]+by0), layers=layers)
    if white: out['white'] = white
    if plate: out['plate'] = True
    return out

def page(p):
    global PAGE; PAGE = p
    im, auto, _, _ = find_items(p)
    card, (cx, cy, cw, ch) = white_card(im)
    sp = line_spacing(p if p != '31b' else 31); s = 60.0/sp
    regions = REGIONS.get(p) or [(x-70, y-70, x+w+70, y+h+70) for (x, y, w, h) in auto]
    items, seen = [], []
    for r in regions:
        x0, y0, x1, y1 = r; P = PAD.get(p, 70)
        # look a little wider than drawn, but never past the edge of Lena's card (the table and the spiral are not paint)
        sx0, sy0 = max(x0 - P, cx + 8), max(y0 - P, cy + 8)
        sx1, sy1 = min(x1 + P, cx + cw - 8), min(y1 + P, cy + ch - 8)
        if p in ('31b', 20): sx0, sy0, sx1, sy1 = x0 - P, y0 - P, x1 + P, y1 + P
        for m, off, bal in paint_items(im, (sx0, sy0, sx1, sy1)):
            ys, xs = np.where(m); key = (int(xs.mean())+off[0], int(ys.mean())+off[1])
            if not (x0 - 20 <= key[0] <= x1 + 20 and y0 - 20 <= key[1] <= y1 + 20): continue
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
