"""Builds the cover label: a strip of white paper tape with Lena's "Familienrezepte" written on it.
The tape picks up the grain of the cover underneath, has slightly uneven hand-torn ends, and sits a little off straight.
Usage: python3 label.py <lettering.json> <cover-front.png> <out.png>"""
import sys, json, numpy as np, cv2, cairosvg, io
from PIL import Image
lj, cover, out = sys.argv[1:4]
rng = np.random.default_rng(11)
S = 3                              # pixels per cover-photo pixel
TW, TH = 310, 66                   # tape size in cover-photo pixels
PAD = 26
W, H = (TW+2*PAD)*S, (TH+2*PAD)*S
def smooth_noise(n, scale, amp):
    v = rng.normal(0, 1, n//scale+3); xs = np.arange(n)/scale
    return amp*np.interp(xs, np.arange(len(v)), v)
# mask: straight long edges with a hint of waviness, uneven torn ends
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
top = PAD*S + smooth_noise(W, 220, 0.5); bot = (PAD+TH)*S + smooth_noise(W, 220, 0.5)
lft = PAD*S + smooth_noise(H, 34, 4.0) + smooth_noise(H, 7, 1.6) + np.linspace(-5, 6, H)
rgt = (PAD+TW)*S + smooth_noise(H, 30, 4.5) + smooth_noise(H, 6, 1.8) + np.linspace(5, -4, H)
mask = ((yy >= top[None, :]) & (yy <= bot[None, :]) & (xx >= lft[:, None]) & (xx <= rgt[:, None])).astype(np.float32)
mask = cv2.GaussianBlur(mask, (0, 0), 0.8)
# paper: warm white, faint fibres, slow tonal drift
base = np.array([226, 233, 236], np.float32)            # BGR
tone = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 60)*38
fibre = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 1.2)*3.0
streak = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), sigmaX=40, sigmaY=1.0)*7
# the cover's grain pressing through the thin tape
c = cv2.imread(cover, cv2.IMREAD_UNCHANGED)[..., 0].astype(np.float32)
patch = c[280:280+TH+2*PAD, 90:90+TW+2*PAD]
grain = cv2.resize(patch - cv2.GaussianBlur(patch, (0, 0), 3), (W, H), interpolation=cv2.INTER_CUBIC)*1.6
lum = tone + fibre + streak + grain
# light falls from above: a brighter upper edge, a darker lower edge where the tape turns away
d_top = yy - top[None, :]; d_bot = bot[None, :] - yy
lum += 5*np.exp(-d_top/(1.5*S)) - 12*np.exp(-d_bot/(1.2*S)) - 5*(yy-PAD*S)/(TH*S)
img = np.clip(base[None, None, :] + lum[..., None], 0, 255)
# lettering, written with a pen: ink sinks in a little
L = json.load(open(lj))['titles']['toc']
x = 0; parts = []; hh = max(w['h'] for w in L)
for w in L:
    parts.append(f'<g transform="translate({x},0)"><path d="{w["d"]}"/></g>'); x += w['w']
lw = x
k = min(TW*0.80*S/lw, TH*1.12*S/hh)
ox = (W - lw*k)/2; oy = (H - hh*k)/2 + 1.5*S
svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}"><g transform="translate({ox},{oy}) scale({k})" fill="#000">{"".join(parts)}</g></svg>'
ink = np.array(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))))[..., 3].astype(np.float32)/255
ink = np.clip(cv2.GaussianBlur(ink, (0, 0), 0.9)*1.15, 0, 1)
inkcol = np.array([38, 34, 32], np.float32)
img = img*(1-ink[..., None]*0.93) + inkcol*ink[..., None]*0.93
rgba = np.dstack([img, mask*255*0.985])
# a thin contact shadow so the tape sits on the cover rather than floating over it
sh = cv2.GaussianBlur(np.roll(mask, 2, axis=0), (0, 0), 2.5)*0.55
a = np.maximum(mask*0.985, sh*(1-mask))
rgb = img*mask[..., None]
rgba = np.dstack([np.where(mask[..., None] > 0.01, img, 0), a*255])
M = cv2.getRotationMatrix2D((W/2, H/2), 1.6, 1.0)
rgba = cv2.warpAffine(rgba.astype(np.float32), M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
cv2.imwrite(out, np.clip(rgba, 0, 255).astype(np.uint8))
print(W, H, 'lettering box', lw, hh)
