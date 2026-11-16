"""Finds every painted cut-out on a page photo, anywhere on the card.
Two clues are combined: the cut-out paper is whiter than the textured card around it (that finds the stickers,
including grey or pale paintings such as a pot or a sugar packet), and paint is coloured (that finds paintings
whose paper edge is hard to see). Cut-outs that sit close together are kept as one group (a bowl and its
potatoes); distant ones stay separate (herbs top right, a plate at the bottom)."""
import cv2, numpy as np
from detect import load, white_card

def fill_holes(m):
    h, w = m.shape; ff = m.copy(); mask = np.zeros((h+2, w+2), np.uint8)
    cv2.floodFill(ff, mask, (0, 0), 1)
    return m | (1 - ff)

def find_items(p, link=70):
    im = load(p)
    card, box = white_card(im)                       # eroded card, so its own bright border is excluded
    inner = cv2.erode(card, np.ones((25, 25), np.uint8))
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
    loc = cv2.GaussianBlur(g, (0, 0), 5)
    small = cv2.resize(g, None, fx=0.1, fy=0.1).astype(np.uint8)
    bg = cv2.resize(cv2.medianBlur(small, 21), (g.shape[1], g.shape[0])).astype(np.float32)
    bright = ((loc - bg) > 7).astype(np.uint8) & inner
    bright = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)))
    sticker = fill_holes(bright)
    sticker = cv2.morphologyEx(sticker, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)))
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    paint = ((hsv[..., 1] > 42) & (hsv[..., 2] > 60) & (inner > 0)).astype(np.uint8)
    paint = cv2.morphologyEx(paint, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    # a sticker counts if it holds something painted or dark (not just a bright patch of card)
    n, sl, ss, _ = cv2.connectedComponentsWithStats(sticker, 8)
    dark = (g < 150).astype(np.uint8)
    keep = np.zeros(n, bool)
    for j in range(1, n):
        x, y, w, h, a = ss[j]
        if a < 2500 or w < 35 or h < 35: continue
        m = sl == j
        if (paint[m].mean() > 0.04 or dark[m].mean() > 0.10) and a / (w*h) > 0.35: keep[j] = True
    found = (keep[sl] & (sl > 0)).astype(np.uint8)
    # paint outside any sticker found (an edge too faint to see) still counts, if it is a substantial blob
    n, pl, ps, _ = cv2.connectedComponentsWithStats(paint, 8)
    for j in range(1, n):
        x, y, w, h, a = ps[j]
        if a >= 600 and w >= 12 and h >= 12 and h / max(w, 1) < 8 and w / max(h, 1) < 8:
            found |= (pl == j).astype(np.uint8)
    grp = cv2.dilate(found, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2*link+1, 2*link+1)))
    n, gl, gs, _ = cv2.connectedComponentsWithStats(grp, 8)
    items = []
    for j in range(1, n):
        ys, xs = np.where((gl == j) & (found > 0))
        if len(xs) < 800: continue
        items.append((int(xs.min()), int(ys.min()), int(xs.max()-xs.min()+1), int(ys.max()-ys.min()+1)))
    return im, items, box, (found > 0)

if __name__ == '__main__':
    import sys
    from PIL import Image, ImageDraw
    pages = [int(a) if a.isdigit() else a for a in sys.argv[1:]]
    for p in pages:
        im, items, box, _ = find_items(p)
        o = Image.fromarray(cv2.cvtColor(im, cv2.COLOR_BGR2RGB)); d = ImageDraw.Draw(o)
        for (x, y, w, h) in items: d.rectangle((x-10, y-10, x+w+10, y+h+10), outline=(255, 0, 0), width=8)
        o.thumbnail((450, 600)); o.save(f'det-{p}.png'); print(p, items)
