# comp.py scene.png pose.png out.png : cut a pose (figure + its mat) out of its white background and lay it on a scene
import sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
bg = Image.open(sys.argv[1]).convert('RGB')
p = Image.open(sys.argv[2]).convert('RGB').resize(bg.size)
a = np.asarray(p).astype(int)
mn = a.min(2)
lab, n = ndimage.label(mn > 232)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
clear = np.isin(lab, list(edge))
# enclosed gaps (between legs, under arms) are pure white; skin is a warmer off-white
idx = np.arange(1, n + 1)
area = ndimage.sum(np.ones_like(mn), lab, idx)
meanmin = ndimage.mean(mn, lab, idx)
warm = ndimage.mean(a[:, :, 0] - a[:, :, 2], lab, idx)
gaps = idx[(area > 1500) & (meanmin >= 249) & (warm < 3)]
clear |= np.isin(lab, gaps)
alpha = Image.fromarray((~clear).astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(0.8))
bg.paste(p, (0, 0), alpha)
bg.save(sys.argv[3])
