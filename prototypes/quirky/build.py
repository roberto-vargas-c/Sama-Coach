# Builds stills.html from the styles gallery template: the two poses and the logo in the quirky line style.
import base64, io, pathlib
from PIL import Image
D = pathlib.Path(__file__).parent
ITEMS = [('mountain', 'Mountain', 'Pose one.'), ('logo-on-mat', 'Logo on the mat', 'Shared by every pose, placed on the same mat.'), ('warrior2', 'Warrior II', 'Pose two.')]
def uri(p):
  im = Image.open(p).convert('RGB'); im.thumbnail((1100, 1100)); b = io.BytesIO(); im.save(b, 'JPEG', quality=86)
  return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
cards = ''.join(f'<figure><img src="{uri(D / (k + ".png"))}" alt="{n}, quirky flat line style"><figcaption><b>{n}</b><span>{d}</span></figcaption></figure>' for k, n, d in ITEMS)
t = (D.parent / 'styles' / 'gallery.template.html').read_text()
t = t.replace('<title>Sama Character Styles</title>', '<title>Sama Line Style</title>').replace('One pose, seven styles', 'Quirky line style')
t = t.replace('The same Mountain pose redrawn by Krea in each style, keeping the character, colors and framing. Pick the ones worth taking further and they get the second pose and the logo melt.',
              'Thin wobbly ink outlines and flat fills, after the reference Roberto shared. Both poses and the logo share the same mat and framing, so the scene stays put when the pose changes.')
(D / 'stills.html').write_text(t.replace('__CARDS__', cards))
