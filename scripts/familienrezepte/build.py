"""Assembles the Familienrezepte app from the prepared, private material.

Everything inside the book (recipes, Lena's lettering, her illustrations) is compressed and then encrypted with
AES-256-GCM. The key is stretched from the shared password with PBKDF2-SHA256 (600,000 rounds, fixed salt), so a
browser that has unlocked the book once keeps working after content updates; only a new password locks it again.
The password is read from the environment variable FR_PASS and is never written anywhere.

Usage: FR_PASS=... python3 build.py <work folder> <app folder>
  work folder: content.json, lettering.json, ill/ill_<page>.json, assets/*.png (see README.md)
  app folder:  public/projects/familienrezepte/app"""
import sys, os, json, math, gzip, hashlib, re, io
from PIL import Image
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

work, app = sys.argv[1], sys.argv[2]
pw = os.environ.get('FR_PASS')
if not pw: sys.exit('Set FR_PASS to the shared password')
ITER = 600000
SALT = hashlib.sha256(b'preis.works/familienrezepte').digest()[:16]
key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=SALT, iterations=ITER).derive(pw.encode())
os.makedirs(os.path.join(app, 'data'), exist_ok=True); os.makedirs(os.path.join(app, 'assets'), exist_ok=True)
versions = {}

def seal(name, obj):
    """gzip, then AES-GCM; file = 12-byte IV + ciphertext. Keeps the IV when the content is unchanged,
    so an unchanged file stays byte-identical and git sees no change"""
    plain = gzip.compress(json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode(), 9, mtime=0)
    path = os.path.join(app, 'data', name)
    tag = hashlib.sha256(key + plain).digest()
    iv = tag[:12]                                   # deterministic per content: same content, same file
    blob = iv + AESGCM(key).encrypt(iv, plain, None)
    open(path, 'wb').write(blob)
    versions['data/' + name] = hashlib.sha256(blob).hexdigest()[:10]
    return len(blob)

# ---------- pictures of the notebook (public) ----------
for f in ['sheet-right', 'sheet-left', 'page-right', 'page-left', 'endpaper-left', 'endpaper-right', 'cover-front', 'cover-elastic', 'cover-label', 'cover-back']:
    im = Image.open(os.path.join(work, 'assets', f + '.png'))
    out = os.path.join(app, 'assets', f + '.webp')
    im.save(out, 'WEBP', quality=90, method=6)
    versions['assets/' + f + '.webp'] = hashlib.sha256(open(out, 'rb').read()).hexdigest()[:10]

# ---------- content ----------
C = json.load(open(os.path.join(work, 'content.json')))
L = json.load(open(os.path.join(work, 'lettering.json')))
dup = {1: 'Oma H.', 3: 'Mutti'}                      # the two Kartoffelsalat recipes, told apart in the contents
hand = {}
for r in C['recipes']:
    k = str(r['no']); ps = L['titles'][k]
    if len(ps) > 1:   # a title she wrote on two lines becomes one line: the second part moved up beside the first
        a, c = ps; dx = a['x1'] + 27 - c['x0']; dy = a['base'] - c['base']
        ps = [dict(d=a['d'], d2=c['d'], dx=dx, dy=dy, w=dx + c['w'], h=max(a['h'], c['h'] + dy), base=a['base'],
                   x0=a['x0'], x1=dx + c['x1'], top=min(a['top'], c['top'] + dy))]
    p = dict(ps[0]); inkw = p['x1'] - p['x0']; asc = p['base'] - p['top']
    p['s'] = round(min(math.sqrt((14.5 * len(r['title']) / inkw) * (40 / asc)), 470 / inkw), 4)   # even letter size, never wider than the text
    hand[k] = p
p = dict(L['titles']['toc'][0]); p['s'] = 0.47; hand['toc'] = p
for k, v in L['attributions'].items():
    p = dict(v); p['s'] = round(15 / (p['base'] - p['top']), 4); hand[k] = p
for p in hand.values():
    for f in ('bot',): p.pop(f, None)
core = dict(dedication=C['meta']['dedication'],
            index=[dict(no=r['no'], title=r['title'], title_en=r['title_en'], dup=dup.get(r['no'])) for r in C['recipes']],
            recipes=[{k: r[k] for k in ('no', 'title', 'title_en', 'by', 'de', 'en')} for r in C['recipes']],
            hand=hand)
sizes = {'core': seal('core.bin', core)}

# ---------- illustrations: one file per recipe page, so pages fill in as they arrive ----------
num = re.compile(r'-?\d+\.?\d*')
def compact(d, k=2):
    """Absolute M/L/C path in units -> relative path in half units, whole numbers only (about half the size)"""
    out, cx, cy, sx, sy = [], 0, 0, 0, 0
    for cmd, args in re.findall(r'([MLCZ])([^MLCZ]*)', d):
        v = [round(float(x) * k) for x in num.findall(args)]
        if cmd == 'M':
            out.append(f'm{v[0]-cx} {v[1]-cy}'); cx, cy = v[0], v[1]; sx, sy = cx, cy
        elif cmd == 'L':
            out.append(f'l{v[0]-cx} {v[1]-cy}'); cx, cy = v[0], v[1]
        elif cmd == 'C':
            out.append('c' + ' '.join(str(v[i] - (cx if i % 2 == 0 else cy)) for i in range(6))); cx, cy = v[4], v[5]
        else:
            out.append('z'); cx, cy = sx, sy
    s = ''.join(out)
    return re.sub(r' -', '-', s)
for r in C['recipes']:
    n = r['no']; f = os.path.join(work, 'ill', f'ill_{n}.json')
    if not os.path.exists(f): continue
    d = json.load(open(f)); items = d['items']
    if n == 31 and os.path.exists(os.path.join(work, 'ill', 'ill_31b.json')):
        b = json.load(open(os.path.join(work, 'ill', 'ill_31b.json')))
        for it in b['items']:                       # the cheesecake slice from the back of the page: belongs at the foot
            it = dict(it); it['y'] = d['card'][1] * 0.86 - it['h']; it['x'] = d['card'][0] * 0.5 - it['w'] / 2; items.append(it)
    out = []
    for it in items:
        o = dict(x=it['x'], y=it['y'], w=it['w'], h=it['h'], layers=[dict(d=compact(l['d']), c=l['c']) for l in it['layers']])
        if it.get('white'): o['white'] = compact(it['white'])
        out.append(o)
    sizes[n] = seal(f'ill-{n:02d}.bin', dict(card=d['card'], items=out))

# ---------- the page ----------
versions['app.js'] = hashlib.sha256(open(os.path.join(app, 'app.js'), 'rb').read()).hexdigest()[:10]
here = os.path.dirname(os.path.abspath(__file__))
html = open(os.path.join(here, 'index.template.html')).read()
html = html.replace('__CRYPT__', json.dumps(dict(salt=__import__('base64').b64encode(SALT).decode(), iter=ITER)))
html = html.replace('__APPV__', versions['app.js'])
html = html.replace('__VERSIONS__', json.dumps(versions, separators=(',', ':')))
html = html.replace('__ILL__', json.dumps([r['no'] for r in C['recipes'] if os.path.exists(os.path.join(work, 'ill', f'ill_{r["no"]}.json'))]))
open(os.path.join(app, 'index.html'), 'w').write(html)
print('built:', {k: f'{v//1024} KB' for k, v in list(sizes.items())[:3]}, '... total', sum(sizes.values())//1024, 'KB encrypted')
