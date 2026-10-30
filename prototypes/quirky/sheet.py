# sheet.py out.png pose... — contact sheet of generated poses for review
import sys
from PIL import Image, ImageDraw
out, ks = sys.argv[1], sys.argv[2:]
W, H = 460, 257; cols = 4; rows = (len(ks) + cols - 1) // cols
s = Image.new('RGB', (W * cols, H * rows), 'white'); d = ImageDraw.Draw(s)
for i, k in enumerate(ks):
    try: im = Image.open(f'poses/{k}.png').convert('RGB').resize((W, H))
    except Exception: continue
    s.paste(im, ((i % cols) * W, (i // cols) * H)); d.text(((i % cols) * W + 8, (i // cols) * H + 6), k, fill='red')
s.save(out)
