"""Quality pass on Lena's lettering for the app.
- Evens out the space between words (levelling each word on its baseline left gaps from 19 to 56 units; her
  own spacing within words is untouched)
- Removes a stray stroke left of "Käsekuchen" (the edge of the card in the photo)
- Uses the rebuilt "Waffeln à la Preis" (alapreis.py)
- Measures every piece (ink box, tallest letter) for placing it on the page
Usage: python3 lettering_fix.py <lettering.json> <title28.json> <out.json>"""
import sys, json, re, io
import numpy as np, cairosvg
from PIL import Image
L = json.load(open(sys.argv[1])); t28 = json.load(open(sys.argv[2]))
num = r'-?\d+\.?\d*'
def subs(d): return re.findall(r'M[^M]*', d)
def box(s):
    n = [float(x) for x in re.findall(num, s)]; return min(n[0::2]), max(n[0::2]), min(n[1::2]), max(n[1::2])
def shift(s, dx):
    it = iter(re.findall(num, s)); pts = [(float(a)+dx, float(b)) for a, b in zip(it, it)]; i = iter(pts)
    return re.sub(num + r'\s+' + num, lambda m: '%.1f %.1f' % next(i), s)
GAP, SPLIT = 27, 17
def even_words(p, key):
    ss = subs(p['d']); bx = [box(s) for s in ss]
    if key == '31':      # a tall, thin stroke at the very left is the card's edge, not a letter
        keep = [i for i, b in enumerate(bx) if not (b[1]-b[0] < 6 and b[3]-b[2] > 60 and b[0] < 15)]
        ss = [ss[i] for i in keep]; bx = [bx[i] for i in keep]
    order = sorted(range(len(ss)), key=lambda i: bx[i][0])
    words, cur, right = [], [], None
    for i in order:
        if right is not None and bx[i][0] - right > SPLIT: words.append(cur); cur = []
        cur.append(i); right = max(right or -1e9, bx[i][1]) if cur[:-1] else bx[i][1] if right is None else max(right, bx[i][1])
    words.append(cur)
    out, x = [], None
    for w in words:
        x0 = min(bx[i][0] for i in w); x1 = max(bx[i][1] for i in w)
        dx = 0 if x is None else (x + GAP) - x0
        out += [shift(ss[i], dx) for i in w]; x = x1 + dx
    q = dict(p); q['d'] = ''.join(out); q['w'] = x + 6; return q, len(words)
def measure(p):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{int(p["w"])+2}" height="{int(p["h"])+2}"><path d="{p["d"]}"/></svg>'
    a = np.array(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))))[..., 3] > 100
    ys = np.where(a.any(1))[0]; xs = np.where(a.any(0))[0]
    return dict(x0=int(xs.min()), x1=int(xs.max()), top=int(ys.min()), bot=int(ys.max()))
out = {'titles': {}, 'attributions': {}}
for k, pieces in L['titles'].items():
    if k == '28': pieces = [t28]
    fixed = []
    for p in pieces:
        q, n = even_words(p, k) if k != 'toc' else (dict(p), 1)
        q.update(measure(q)); fixed.append(q)
    out['titles'][k] = fixed
for k, p in L['attributions'].items():
    q = dict(p); q.update(measure(q)); out['attributions'][k] = q
json.dump(out, open(sys.argv[3], 'w'), separators=(',', ':'))
print('ok', len(out['titles']))
