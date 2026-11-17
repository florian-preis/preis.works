"""App icon and favicons: the orange apple from the Apfelküchle page (Florian's redrawn illustration 25_03),
centred on the notebook's paper tone.
Usage: python3 icon.py <private work folder> <out folder>
       e.g. python3 icon.py ../../../private/familienrezepte/work ../../public/projects/familienrezepte/app
Writes icon-512.png, icon-192.png, icon-maskable-512.png, apple-touch-icon.png (180), favicon-32.png, favicon-16.png"""
import sys, os
from PIL import Image, ImageEnhance, ImageDraw

work, out = sys.argv[1], sys.argv[2]
BG = (238, 235, 227)                                   # #EEEBE3, the paper tone
src = Image.open(os.path.join(work, 'ill-new', '25_03.webp')).convert('RGBA')
src = src.crop(src.getchannel('A').point(lambda a: 255 if a > 12 else 0).getbbox())

def render(size, fill, boost=1.0, round_=0.0):
    # draw large, then shrink once, so small sizes stay crisp
    big = size * 4
    k = fill * big / max(src.size)
    im = src.resize((round(src.width * k), round(src.height * k)), Image.LANCZOS)
    if boost != 1.0:                                   # at favicon sizes a little more colour keeps the apple readable
        rgb = ImageEnhance.Contrast(ImageEnhance.Color(im.convert('RGB')).enhance(boost)).enhance(1 + (boost - 1) / 2)
        rgb.putalpha(im.getchannel('A')); im = rgb
    canvas = Image.new('RGBA', (big, big), BG + (255,))
    canvas.alpha_composite(im, ((big - im.width) // 2, (big - im.height) // 2))
    if not round_:
        return canvas.convert('RGB').resize((size, size), Image.LANCZOS)
    # rounded corners, as the tile sits in a browser tab or on a desktop
    mask = Image.new('L', (big, big), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), radius=round(big * round_), fill=255)
    canvas.putalpha(mask)
    return canvas.resize((size, size), Image.LANCZOS)

# large sizes keep air round the picture; the maskable one keeps it inside the safe circle phones crop to;
# small ones fill more to stay legible in a browser tab
# phones round or mask the home-screen icons themselves (apple-touch, maskable), so those stay square and opaque;
# the favicons and the plain app icons get their own rounded corners. In a browser tab the apple sits with a
# little air around it
for name, size, fill, boost, rnd in [('icon-512.png', 512, 0.70, 1.0, 0.22), ('icon-192.png', 192, 0.70, 1.0, 0.22),
                                     ('icon-maskable-512.png', 512, 0.58, 1.0, 0), ('apple-touch-icon.png', 180, 0.70, 1.0, 0),
                                     ('favicon-32.png', 32, 0.80, 1.15, 0.25), ('favicon-16.png', 16, 0.84, 1.25, 0.25)]:
    render(size, fill, boost, rnd).save(os.path.join(out, name), optimize=True)
print('icons written')
