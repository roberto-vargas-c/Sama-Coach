# Builds the app's line-style assets from prototypes/quirky:
#   line/poses/<id>.webp  the figure alone, cut out of its still (white paper, mat and mat outline removed)
#   line/poses/man/<id>.webp  the same for the man (prototypes/quirky/man/<id>.png, the same poses redrawn as a man)
#   line/scenes/<k>.webp  the six scene backgrounds
#   line/logo.webp        the logo the transition rolls through
#   line/index.json       per pose: where the cut-out sits in the 1376 x 768 frame and the corners of its mat,
#                         so the app draws the mat in code and keeps it still while the figure changes ("man": the same for the man);
#                         "flip": 1 marks a still drawn facing the other way from the app's figure (tools/line_flip.json)
# Run: python3 tools/line_assets.py   (needs opencv-python-headless, scipy, pillow)
import json, pathlib, sys
import cv2, numpy as np
from scipy import ndimage
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'prototypes' / 'quirky'
OUT = ROOT / 'line'
(OUT / 'poses' / 'man').mkdir(parents=True, exist_ok=True); (OUT / 'scenes').mkdir(parents=True, exist_ok=True)

def webp(rgba, path, q=82):
    Image.fromarray(rgba).save(path, 'WEBP', quality=q, method=6)

def paper_mask(a):
    """White paper: white regions touching the frame edge, plus large pure-white enclosed gaps (between legs, under arms)."""
    mn = a.min(2)
    lab, n = ndimage.label(mn > 232)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    clear = np.isin(lab, list(edge))
    idx = np.arange(1, n + 1)
    if n:
        area = ndimage.sum(np.ones_like(mn), lab, idx)
        meanmin = ndimage.mean(mn, lab, idx)
        warm = ndimage.mean(a[:, :, 0].astype(int) - a[:, :, 2], lab, idx)
        clear |= np.isin(lab, idx[(area > 1500) & (meanmin >= 249) & (warm < 3)])
    return clear

def mat_quad(teal):
    """The mat is a trapezoid with level front and back edges. The figure hides parts of it, so each side edge is the
    supporting line that the most rows of teal touch (occlusion only ever pulls a row's end inwards)."""
    lab, n = ndimage.label(teal)
    if not n: return None
    sizes = ndimage.sum(teal, lab, range(1, n + 1))
    keep = np.isin(lab, 1 + np.flatnonzero(sizes > 300))
    rows = np.flatnonzero(keep.any(1))
    if len(rows) < 10: return None
    y0, y1 = rows.min(), rows.max()
    ys = rows[(rows > y0 + 2) & (rows < y1 - 2)]
    xl = np.array([np.flatnonzero(keep[y]).min() for y in ys]); xr = np.array([np.flatnonzero(keep[y]).max() for y in ys])
    def edge(xe, sign):  # sign -1: left edge (minimum), +1: right edge (maximum)
        best = None
        for s in np.linspace(-2, 2, 401):
            v = sign * (xe - s * (ys - y1)); a = v.max()
            sc = np.count_nonzero(a - v < 2)
            if best is None or sc > best[0]: best = (sc, s, sign * a)
        _, s, a = best
        return lambda y: a + s * (y - y1)
    L, R = edge(xl, -1), edge(xr, 1)
    yt, yb = y0 - .5, y1 + .5
    return np.array([[L(yt), yt], [R(yt), yt], [R(yb), yb], [L(yb), yb]]), keep

def cut(name, src=SRC / 'poses', out=OUT / 'poses'):
    a = np.asarray(Image.open(src / f'{name}.png').convert('RGB'))
    H, W = a.shape[:2]
    hsv = cv2.cvtColor(a, cv2.COLOR_RGB2HSV)
    teal = (hsv[..., 0] >= 75) & (hsv[..., 0] <= 100) & (hsv[..., 1] > 35) & (hsv[..., 2] > 90)
    q = mat_quad(teal)
    alpha = ~paper_mask(a)
    mat = None
    if q is not None:
        quad, matpx = q
        poly = np.zeros((H, W), np.uint8); cv2.fillPoly(poly, [quad.round().astype(np.int32)], 1)
        border = np.zeros((H, W), np.uint8); cv2.polylines(border, [quad.round().astype(np.int32)], True, 1, 11)
        dark = a.max(2) < 120
        # the teal itself, softened edge pixels between teal and ink, and the mat's ink outline next to the teal
        tealish = (hsv[..., 0] >= 70) & (hsv[..., 0] <= 105) & (hsv[..., 1] > 20) & (a.max(2) > 110)
        # the mat's ink outline where it shows: dark pixels along an edge with the mat's teal just inside it (looking across
        # the edge, towards the middle). A limb or sock crossing the edge has its own ink there, not teal, so it stays whole.
        outline = np.zeros((H, W), bool); qi = quad.round().astype(np.int32); mid = quad.mean(0)
        for i in range(4):
            p0, p1 = quad[i], quad[(i + 1) % 4]
            band = np.zeros((H, W), np.uint8); cv2.line(band, tuple(map(int, qi[i])), tuple(map(int, qi[(i + 1) % 4])), 1, 11)
            d = p1 - p0; nrm = np.array([-d[1], d[0]]) / np.hypot(*d)
            if np.dot(mid - (p0 + p1) / 2, nrm) < 0: nrm = -nrm
            inside = np.zeros((H, W), bool)
            for k in range(1, 9):
                M = np.float32([[1, 0, -nrm[0] * k], [0, 1, -nrm[1] * k]])
                inside |= cv2.warpAffine(teal.astype(np.uint8), M, (W, H), flags=cv2.INTER_NEAREST) > 0
            outline |= dark & (band > 0) & inside
        drop = teal | (tealish & (poly > 0)) | outline
        # light anti-aliasing round that outline only: a light pixel elsewhere in the band is the figure crossing the mat's edge
        # (a face, a hand), and dropping it cut a stripe through the figure
        by_line = cv2.dilate((outline | teal).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        drop |= (border > 0) & ~dark & ~(a.min(2) < 200) & by_line
        alpha &= ~drop
        col = np.median(a[teal], 0).astype(int).tolist()
        mat = {'q': [[round(x, 1), round(y, 1)] for x, y in quad], 'c': '#%02X%02X%02X' % tuple(col)}
    # keep the figure only: drop specks left over from the outline
    m = alpha.astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 120: keep[lab == i] = 1
    x, y, w, h = cv2.boundingRect(keep)
    al = cv2.GaussianBlur(keep * 255, (3, 3), 0)
    rgba = np.dstack([a, al])[y:y + h, x:x + w]
    webp(rgba, out / f'{name}.webp')
    return {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h), **({'mat': mat} if mat else {})}

def main(only=None):
    names = sorted(p.stem for p in (SRC / 'poses').glob('*.png'))
    men = {p.stem for p in (SRC / 'man').glob('*.png')}
    idx, man = {}, {}
    path = OUT / 'index.json'
    if only and path.exists(): j = json.loads(path.read_text()); idx, man = j['poses'], j.get('man', {})
    for nm in (only or names):
        idx[nm] = cut(nm); print(nm, idx[nm].get('mat', {}).get('q'))
        if nm in men: man[nm] = cut(nm, SRC / 'man', OUT / 'poses' / 'man'); print(' man', man[nm].get('mat', {}).get('q'))
    if not only:
        for s in (SRC / 'scenes').glob('*.png'):
            if s.stem == 'preview': continue
            Image.open(s).convert('RGB').save(OUT / 'scenes' / f'{s.stem}.webp', 'WEBP', quality=80, method=6)
        lg = Image.open(SRC / 'fig-logo.png').convert('RGBA'); Image.fromarray(np.asarray(lg)).save(OUT / 'logo.webp', 'WEBP', quality=85, method=6)
    flip = json.loads((ROOT / 'tools' / 'line_flip.json').read_text())  # stills drawn facing the other way from the app's figure
    for d, f in ((idx, 'woman'), (man, 'man')):
        for k, e in d.items():
            e.pop('flip', None)
            if k in flip[f]: e['flip'] = 1
    path.write_text(json.dumps({'frame': [1376, 768], 'logo': {'w': 301, 'h': 297}, 'poses': dict(sorted(idx.items())), 'man': dict(sorted(man.items()))}, separators=(',', ':')))

if __name__ == '__main__':
    main(sys.argv[1:] or None)
