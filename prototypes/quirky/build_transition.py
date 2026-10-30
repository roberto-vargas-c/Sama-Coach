# Builds transition.html: inlines the empty scene and the cut-outs, with where each one sits on the stage.
import base64, json, pathlib
from PIL import Image
D = pathlib.Path(__file__).parent
POS = {'mountain': (558, 51), 'warrior2': (395, 52), 'logo': (540, 391)}  # from cutout.py
def uri(p, mime): return f'data:{mime};base64,' + base64.b64encode(p.read_bytes()).decode()
s = (D / 'transition.template.html').read_text()
bg = D / 'bg-empty.jpg'; Image.open(D / 'bg-empty.png').convert('RGB').save(bg, quality=88)
s = s.replace('__BG__', uri(bg, 'image/jpeg'))
pos = {}
for k, (x, y) in POS.items():
    f = D / f'fig-{k}.png'; w, h = Image.open(f).size
    pos[k] = {'x': x, 'y': y, 'w': w, 'h': h}
    s = s.replace(f'__FIG_{k}__', uri(f, 'image/png'))
(D / 'transition.html').write_text(s.replace('__POS__', json.dumps(pos)))
