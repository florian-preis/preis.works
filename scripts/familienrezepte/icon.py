"""App icon and favicons: the herbs from the Kartoffelpuffer page, traced finely, centred on the notebook's paper tone.
Usage: FR_PHOTOS=<page photos> python3 icon.py <out folder>
Writes icon-512.png, icon-192.png, apple-touch-icon.png (180), favicon-32.png, favicon-16.png"""
import sys, os, io, cairosvg
import illus3
from detect import load, white_card
from spacing import line_spacing
from PIL import Image
out = sys.argv[1]
PAGE, REGION = 5, (1330, 630, 1600, 920)
BG = '#EEEBE3'
illus3.PAGE = PAGE
im = load(PAGE); s = 60.0 / line_spacing(PAGE)
m, off, bal = max(illus3.paint_items(im, REGION), key=lambda t: t[0].sum())
it = illus3.vectorise4(m, off, bal, s, K=16, up=5)
dark = sorted(it['layers'][1:], key=lambda l: sum(int(l['c'][i:i+2], 16) for i in (1, 3, 5)))[0]['c']
def render(size, fill, stroke=0.0):
    w, h = it['w'], it['h']; k = fill * size / max(w, h); tx, ty = (size - w*k) / 2, (size - h*k) / 2
    g = ''.join(f'<path d="{l["d"]}" fill="{l["c"]}"/>' for l in it['layers'])
    # at favicon sizes a thin outline in the darkest green keeps the stems from vanishing
    st = f'<path d="{it["layers"][0]["d"]}" fill="{dark}" stroke="{dark}" stroke-width="{stroke/k:.2f}" stroke-linejoin="round"/>' if stroke else ''
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size*4}" height="{size*4}" viewBox="0 0 {size} {size}">'
           f'<rect width="{size}" height="{size}" fill="{BG}"/><g transform="translate({tx:.2f},{ty:.2f}) scale({k:.5f})">{st}{g}</g></svg>')
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))).convert('RGB').resize((size, size), Image.LANCZOS)
# large sizes keep air round the picture (phones crop to a safe zone); small ones fill more to stay legible
for name, size, fill, stroke in [('icon-512.png', 512, 0.66, 0), ('icon-192.png', 192, 0.66, 0), ('apple-touch-icon.png', 180, 0.68, 0),
                                 ('favicon-32.png', 32, 0.94, 0.9), ('favicon-16.png', 16, 0.98, 0.7)]:
    render(size, fill, stroke).save(os.path.join(out, name), optimize=True)
print('icons written')
