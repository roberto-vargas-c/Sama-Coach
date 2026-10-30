# Puts the line-style logo on the Mountain still's own mat, so the scene doesn't move between pose and logo.
import cv2, numpy as np
bg = cv2.imread('mountain.png'); lg = cv2.imread('logo.png')
out = bg.copy()
out[0:640, 520:870] = 255                      # the woman above the mat (plain white background)
out[600:728, 620:760] = bg[600:728, 480:620]   # legs and feet over the mat: the mat's columns are identical
hsv = cv2.cvtColor(lg, cv2.COLOR_BGR2HSV); h, s = hsv[..., 0], hsv[..., 1]
teal = (h >= 70) & (h <= 100)
fill = ((s > 22) & ~teal).astype(np.uint8) * 255
fill[:, :380] = 0; fill[:, 1000:] = 0
fill = cv2.morphologyEx(fill, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
cnts, _ = cv2.findContours(fill, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
cnts = [c for c in cnts if cv2.contourArea(c) > 20000]
m = np.zeros(fill.shape, np.uint8); cv2.drawContours(m, cnts, -1, 255, -1)
m = cv2.dilate(m, np.ones((9, 9), np.uint8))   # take the ink outline with each half
x, y, w, hh = cv2.boundingRect(m)
L, M = lg[y:y+hh, x:x+w], m[y:y+hh, x:x+w]
th = 300; sc = th / hh
L = cv2.resize(L, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA); M = cv2.resize(M, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
lh, lw = L.shape[:2]; cx, base = 690, 690
px, py = cx - lw // 2, base - lh
a = (M.astype(np.float32) / 255)[..., None]
reg = out[py:py+lh, px:px+lw]
out[py:py+lh, px:px+lw] = (L * a + reg * (1 - a)).astype(np.uint8)
cv2.imwrite('logo-on-mat.png', out)
