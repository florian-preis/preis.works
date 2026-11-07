"""Builds the gowiththeflo base map. Run it only when the map's look or borders change.

    python3 scripts/travel/build-map.py <shaded-relief.jpg>

Inputs (all public domain, from Natural Earth, naturalearthdata.com):
  - Natural Earth I shaded relief, 10800 x 5400 equirectangular image
    (the 1:50m "Natural Earth I with Shaded Relief" raster, e.g. as shipped in the
    basemap-data Python package: mpl_toolkits/basemap_data/shadedrelief.jpg)
  - ne_50m_admin_0_countries.geojson and ne_50m_lakes.geojson, downloaded by this
    script from github.com/nvkelso/natural-earth-vector

Outputs:
  - public/projects/travel-diary/map/relief/{z}/{x}/{y}.webp  512 px tiles, zoom 0 to 4
  - src/travel/countries.topo.json  country shapes with an "iso" code per map unit

Needs Python 3 with numpy, pillow, and scipy, and Node (for mapshaper via npx).
The water colour here must match WATER in src/travel/app.ts and --water in app.css.
"""
import json, os, subprocess, sys, urllib.request
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
WORK = os.path.join(ROOT, 'node_modules', '.cache', 'travel-map')
TILES = os.path.join(ROOT, 'public', 'projects', 'travel-diary', 'map', 'relief')
TOPO = os.path.join(ROOT, 'src', 'travel', 'countries.topo.json')
NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'
W, H = 10800, 5400
WATER = np.array([0xDA, 0xDF, 0xDE], np.float32) / 255
SATURATION = 0.38   # how much of the original terrain colour survives (0 = grey)


def download(name):
    os.makedirs(WORK, exist_ok=True)
    path = os.path.join(WORK, name)
    if not os.path.exists(path):
        urllib.request.urlretrieve(NE + name, path)
    return json.load(open(path))


# ── Country shapes: one map unit per code ───────────────────────────────────
MERGE = {'SOL': 'SO', 'CYN': 'CY', 'KAS': 'IN', 'IOA': 'AU', 'ATC': 'AU'}  # Somaliland, N. Cyprus, Siachen, Australian bits


def overseas(code, lon, lat):
    """French and Dutch overseas parts get their own territory codes."""
    if code == 'FR':
        if -56 < lon < -51 and 1 < lat < 6.5: return 'GF'
        if -61.3 < lon < -60.7 and 14.3 < lat < 15: return 'MQ'
        if -62 < lon < -60.9 and 15.8 < lat < 16.6: return 'GP'
        if 44.9 < lon < 45.4 and -13.1 < lat < -12.5: return 'YT'
        if 55 < lon < 56 and -21.5 < lat < -20.8: return 'RE'
    if code == 'NL' and lon < -30: return 'BQ'
    return code


def countries():
    src = download('ne_50m_admin_0_countries.geojson')
    out = {}
    for f in src['features']:
        p = f['properties']
        code = MERGE.get(p['ADM0_A3'], p['ISO_A2_EH'])
        g = f['geometry']
        for pl in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]):
            ring = pl[0]
            c = overseas(code, sum(x for x, _ in ring) / len(ring), sum(y for _, y in ring) / len(ring))
            out.setdefault(c, []).append(pl)
    assert '-99' not in out, 'a Natural Earth unit has no code; add it to MERGE'
    fc = {'type': 'FeatureCollection', 'features': [
        {'type': 'Feature', 'properties': {'iso': k}, 'geometry': {'type': 'MultiPolygon', 'coordinates': v}}
        for k, v in sorted(out.items())]}
    path = os.path.join(WORK, 'countries.geojson')
    json.dump(fc, open(path, 'w'))
    subprocess.run(['npx', '-y', 'mapshaper@0.7.101', path, '-simplify', '45%', 'keep-shapes', '-clean',
                    '-o', 'format=topojson', 'quantization=1e5', TOPO], check=True)
    return fc


# ── Relief tiles ────────────────────────────────────────────────────────────
def recolour(rgb, sat=SATURATION, light=0.10, warm=(0.93, 0.91, 0.86)):
    a = rgb.astype(np.float32) / 255.0
    L = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    shade = L - ndimage.uniform_filter(L, 9)          # fine relief detail
    grey = L[..., None]
    col = grey + (a - grey) * sat                     # mute the colours
    col = col * (1 - light) + light                   # lift towards paper
    col = col * np.array(warm)[None, None, :] / max(warm)
    return np.clip(col + shade[..., None] * 0.9, 0, 1)


def mask(features, scale=2):
    img = Image.new('L', (W * scale, H * scale), 0)
    d = ImageDraw.Draw(img)
    for f in features:
        g = f['geometry']
        for pl in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]):
            pts = [((x + 180) / 360 * W * scale, (90 - y) / 180 * H * scale) for x, y in pl[0]]
            if len(pts) > 2: d.polygon(pts, fill=255)
    return np.array(img.resize((W, H), Image.LANCZOS), np.float32) / 255


def tiles(relief_path, fc):
    lakes = [f for f in download('ne_50m_lakes.geojson')['features'] if (f['properties'].get('scalerank') or 0) <= 5]
    m = mask(fc['features']) * (1 - mask(lakes))
    rgb = recolour(np.array(Image.open(relief_path).convert('RGB').resize((W, H), Image.LANCZOS)))
    comp = Image.fromarray((np.clip(rgb * m[..., None] + WATER * (1 - m[..., None]), 0, 1) * 255).astype(np.uint8))
    pyramid = [np.array(comp, np.float32)]
    while pyramid[-1].shape[1] > 1400:
        im = Image.fromarray(pyramid[-1].astype(np.uint8))
        pyramid.append(np.array(im.resize((im.width // 2, im.height // 2), Image.LANCZOS), np.float32))
    T = 512
    for z in range(5):
        world = T * 2 ** z
        src = pyramid[max([i for i, p in enumerate(pyramid) if p.shape[1] >= world * 0.9] or [0])]
        sw, sh = src.shape[1], src.shape[0]
        j, i = np.mgrid[0:T, 0:T].astype(np.float64)
        for x in range(2 ** z):
            for y in range(2 ** z):
                X = (x * T + i + 0.5) / world
                Y = (y * T + j + 0.5) / world
                lon = X * 360 - 180
                lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * Y))))
                sx, sy = (lon + 180) / 360 * sw - 0.5, (90 - lat) / 180 * sh - 0.5
                tile = np.stack([ndimage.map_coordinates(src[..., c], [sy, sx], order=1, mode='nearest') for c in range(3)], -1)
                os.makedirs(f'{TILES}/{z}/{x}', exist_ok=True)
                Image.fromarray(np.clip(tile, 0, 255).astype(np.uint8)).save(f'{TILES}/{z}/{x}/{y}.webp', 'WEBP', quality=82, method=6)
        print('zoom', z, 'done')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    tiles(sys.argv[1], countries())
