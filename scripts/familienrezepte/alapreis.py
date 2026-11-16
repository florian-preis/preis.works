"""Title 28: turns Lena's "Waffeln ala Preis" into "Waffeln à la Preis" using her own strokes.
Opens a word space after the first "a" and sets a grave accent over it, made from the bar she writes over an "ä"
(taken from "Käsekuchen", title 31) and tilted.
Usage: python3 alapreis.py <lettering.json> <out.json>"""
import sys, json, re, math
L = json.load(open(sys.argv[1]))['titles']
num = r'-?\d+\.?\d*'
def subs(d): return re.findall(r'M[^M]*', d)
def box(s):
    n = [float(x) for x in re.findall(num, s)]; return min(n[0::2]), max(n[0::2]), min(n[1::2]), max(n[1::2])
def xf(s, f):
    it = iter(re.findall(num, s)); pts = [f(float(a), float(b)) for a, b in zip(it, it)]; i = iter(pts)
    def rep(m):
        x, y = next(i); return f'{x:.1f} {y:.1f}'
    return re.sub(num + r'\s+' + num, rep, s)
p = dict(L['28'][0]); GAP = 17
out = []
for s in subs(p['d']):
    out.append(xf(s, lambda x, y: (x + GAP, y)) if box(s)[0] >= 305 else s)
bar = [s for s in subs(L['31'][0]['d']) if 65 < box(s)[0] < 75 and box(s)[3] < 95][0]
x0, x1, y0, y1 = box(bar); cx, cy = (x0+x1)/2, (y0+y1)/2
a = math.radians(30); k = 0.8; tx, ty = 293, 79          # above the first "a" (which spans x 273..311, top y 95)
out.append(xf(bar, lambda x, y: (tx + k*((x-cx)*math.cos(a) - (y-cy)*math.sin(a)), ty + k*((x-cx)*math.sin(a) + (y-cy)*math.cos(a)))))
p['d'] = ''.join(out); p['w'] = p['w'] + GAP
json.dump(p, open(sys.argv[2], 'w'))
