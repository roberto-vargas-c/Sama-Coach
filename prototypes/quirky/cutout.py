# Cuts each figure (and the logo) out of its still as a transparent PNG.
# The scene is only pure white paper and a teal mat with a black outline, so anything else is the figure.
import cv2, numpy as np
bg = cv2.imread('bg-empty.png')
bg_line = cv2.dilate((bg.max(2) < 120).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0  # the mat's own outline
for name in ['mountain', 'warrior2', 'logo-on-mat']:
    im = cv2.imread(name + '.png'); hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    white = im.min(2) > 246
    teal = (hsv[..., 0] >= 78) & (hsv[..., 0] <= 100) & (hsv[..., 1] > 40)
    fig = ~white & ~teal
    near = np.abs(im.astype(int) - bg.astype(int)).max(2) < 40
    fig &= ~(bg_line & near)           # the mat outline where the figure doesn't cover it
    m = fig.astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 400: keep[lab == i] = 255
    a = cv2.GaussianBlur(keep, (3, 3), 0)
    x, y, w, h = cv2.boundingRect(keep)
    out = 'fig-' + name.replace('-on-mat', '') + '.png'
    cv2.imwrite(out, np.dstack([im, a])[y:y+h, x:x+w], [cv2.IMWRITE_PNG_COMPRESSION, 9])
    print(out, x, y, w, h)
