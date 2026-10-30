# Builds gallery.html: the Mountain still in each style, inlined as JPEG data URIs.
import base64, io, pathlib
from PIL import Image
D = pathlib.Path(__file__).parent
STYLES = [
  ('watercolor', 'Watercolor', 'Loose washes, pigment blooms, light pencil line. The current test.'),
  ('gouache', 'Gouache', 'Flat matte shapes, mid-century picture book, no outlines.'),
  ('pencil', 'Colored pencil', 'Visible strokes and hatching on textured paper.'),
  ('collage', 'Cut paper', 'Shapes cut and torn from colored paper, soft layer shadows.'),
  ('riso', 'Risograph', 'Two or three spot inks, grain, slight misregistration.'),
  ('pastel', 'Chalk pastel', 'Smudged, velvety color with pastel grain.'),
  ('ink', 'Ink line', 'Even black outlines, flat fills, no shading.'),
]
def uri(p):
  im = Image.open(p).convert('RGB'); im.thumbnail((1100, 1100)); b = io.BytesIO(); im.save(b, 'JPEG', quality=84)
  return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
cards = ''.join(f'<figure><img src="{uri(D / (k + ".png"))}" alt="{n} style, woman in mountain pose on a yoga mat" loading="lazy">'
                f'<figcaption><b>{n}</b><span>{d}</span></figcaption></figure>' for k, n, d in STYLES if (D / (k + '.png')).exists())
(D / 'gallery.html').write_text((D / 'gallery.template.html').read_text().replace('__CARDS__', cards))
