# Builds all-poses.html: every generated pose in the line style, in the app's order, for review.
import base64, io, pathlib, html
from PIL import Image
D = pathlib.Path(__file__).parent
rows = [l.split('|') for l in (D / 'poses.txt').read_text().strip().split('\n')]
def uri(p):
    im = Image.open(p).convert('RGB').crop((150, 0, 1226, 768)); im.thumbnail((520, 520))  # trim the empty sides
    b = io.BytesIO(); im.save(b, 'JPEG', quality=80); return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
done = [r for r in rows if (D / 'poses' / f'{r[0]}.png').exists()]
cards = ''.join(f'<figure><img src="{uri(D / "poses" / (r[0] + ".png"))}" alt="{html.escape(r[2])} in the line style" loading="lazy">'
                f'<figcaption><b>{html.escape(r[2])}</b><span>{html.escape(r[1])} · {r[3]} view</span></figcaption></figure>' for r in done)
t = (D.parent / 'styles' / 'gallery.template.html').read_text()
t = t.replace('<title>Sama Character Styles</title>', '<title>Sama Line Style Poses</title>').replace('One pose, seven styles', f'{len(done)} of {len(rows)} poses')
t = t.replace('The same Mountain pose redrawn by Krea in each style, keeping the character, colors and framing. Pick the ones worth taking further and they get the second pose and the logo melt.',
              'Every pose generated so far in the quirky line style, in the app’s order. Each was drawn by Krea from the Mountain still for the character and the app’s own figure for the exact position.')
t = t.replace('minmax(min(100%, 460px), 1fr)', 'minmax(min(100%, 260px), 1fr)').replace('font-size: 19px', 'font-size: 16px')
(D / 'all-poses.html').write_text(t.replace('__CARDS__', cards)); print(len(done), 'poses')
