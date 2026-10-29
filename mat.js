/* Sama mat finder: where the yoga mat lies in a camera picture, and where you stand on it.
   Classic image work on a small copy of the frame (about 160 px wide), so it costs a millisecond or two on a phone.
   1. The body is masked out with thick strokes along the detected bones, so it neither seeds nor blocks the search.
   2. The floor right around the points that touch the ground (feet, or the lowest joints) is sampled, and its dominant
      colour is taken as the mat's: you are almost always standing, sitting or lying on it.
   3. The mat grows out from there through pixels close to that colour, and stops where the colour jumps (the mat's edge).
   4. Its left and right edges are fitted as straight lines and cut at its far and near ends: a trapezoid, which is what a
      flat rectangle on the floor looks like to a camera standing roughly level, in front of the mat or beside it.
   5. A homography turns any picture point into mat coordinates: u across the picture (0 left edge, 1 right edge),
      v into it (0 far end, 1 near end).
   It does not work when the mat has the floor's colour, or when patterns break it into pieces; it then reports nothing. */
(function(root){
  const BONES = [[5,6],[5,7],[7,9],[6,8],[8,10],[5,11],[6,12],[11,12],[11,13],[13,15],[12,14],[14,16],[15,23],[15,25],[16,24],[16,26]];
  const GROUND = [15,16,23,24,25,26]; // ankles, heels, toes
  const VIS = .3;

  function ycc(px, n){ // RGBA → Y, Cb, Cr, with a 3×3 box blur to quiet the sensor noise
    const Y = new Float32Array(n), B = new Float32Array(n), R = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4){ const r = px[j], g = px[j+1], b = px[j+2];
      Y[i] = .299*r + .587*g + .114*b; B[i] = 128 - .1687*r - .3313*g + .5*b; R[i] = 128 + .5*r - .4187*g - .0813*b; }
    return [Y, B, R];
  }
  function blur(a, W, H){ // separable 3-tap box, edges clamped
    const t = new Float32Array(a.length), o = new Float32Array(a.length);
    for (let y = 0; y < H; y++){ const r = y*W; for (let x = 0; x < W; x++) t[r + x] = (a[r + Math.max(0, x - 1)] + a[r + x] + a[r + Math.min(W - 1, x + 1)])/3; }
    for (let y = 0; y < H; y++){ const u = Math.max(0, y - 1)*W, d = Math.min(H - 1, y + 1)*W, r = y*W; for (let x = 0; x < W; x++) o[r + x] = (t[u + x] + t[r + x] + t[d + x])/3; }
    return o;
  }
  // colour distance: brightness counts for less than hue, so shadows and light falling across the mat stay "mat"
  const dist = (C, i, m) => { const a = (C[0][i] - m[0])*.45, b = C[1][i] - m[1], c = C[2][i] - m[2]; return Math.sqrt(a*a + b*b + c*c); };

  function bodyMask(K, W, H, k){
    const M = new Uint8Array(W*H), vis = i => K[i] && K[i].s >= VIS;
    const disc = (cx, cy, r) => { const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x - cx)**2 + (y - cy)**2 <= r*r) M[y*W + x] = 1; };
    for (const [a, b] of BONES){ if (!vis(a) || !vis(b)) continue;
      const torso = (a === 5 || a === 6) && (b === 11 || b === 12) || a === 5 && b === 6 || a === 11 && b === 12, r = (torso ? .2 : b >= 23 ? .07 : .11)*k;
      const L = Math.hypot(K[b].x - K[a].x, K[b].y - K[a].y), n = Math.max(1, Math.ceil(L/Math.max(1, r*.6)));
      for (let t = 0; t <= n; t++) disc(K[a].x + (K[b].x - K[a].x)*t/n, K[a].y + (K[b].y - K[a].y)*t/n, r); }
    if (vis(5) && vis(6) && vis(11) && vis(12)){ // fill the torso between shoulders and hips
      const q = [K[5], K[6], K[12], K[11]]; for (let s = 0; s <= 12; s++) for (let t = 0; t <= 12; t++){ const a = s/12, b = t/12;
        const x = (q[0].x*(1-a) + q[1].x*a)*(1-b) + (q[3].x*(1-a) + q[2].x*a)*b, y = (q[0].y*(1-a) + q[1].y*a)*(1-b) + (q[3].y*(1-a) + q[2].y*a)*b; disc(x, y, .12*k); } }
    const hd = [0, 3, 4].filter(vis); if (hd.length){ const cx = hd.reduce((s, i) => s + K[i].x, 0)/hd.length, cy = hd.reduce((s, i) => s + K[i].y, 0)/hd.length; disc(cx, cy, .22*k); }
    return M;
  }
  function bodyScale(K, W, H){
    const vis = i => K[i] && K[i].s >= VIS, d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), c = [];
    if (vis(5) && vis(6) && vis(11) && vis(12)) c.push(d({x:(K[5].x + K[6].x)/2, y:(K[5].y + K[6].y)/2}, {x:(K[11].x + K[12].x)/2, y:(K[11].y + K[12].y)/2}));
    for (const [a, b, l] of [[11,13,.9],[12,14,.9],[13,15,.85],[14,16,.85],[5,6,.75]]) if (vis(a) && vis(b)) c.push(d(K[a], K[b])/l);
    return c.length ? Math.max(4, Math.min(Math.max(W, H)*.5, Math.max(...c))) : Math.max(W, H)*.12;
  }
  // the points that touch the floor: the feet when seen, else the lowest few joints (sitting, lying, on hands and knees)
  function contacts(K){
    const vis = i => K[i] && K[i].s >= VIS, f = GROUND.filter(vis);
    if (f.length >= 2) return f.map(i => K[i]);
    return K.map((p, i) => ({p, i})).filter(o => o.i >= 5 && vis(o.i)).sort((a, b) => b.p.y - a.p.y).slice(0, 3).map(o => o.p);
  }

  // px: RGBA bytes of a W×H picture; K: keypoints in that picture's pixels; prev: an earlier result, whose colour seeds this one
  function find(px, W, H, K, prev){
    const n = W*H, C = ycc(px, n).map(a => blur(a, W, H));
    const k = bodyScale(K, W, H), M = bodyMask(K, W, H, k), feet = contacts(K);
    if (!feet.length) return null;
    // 1. sample the floor around the contacts, on the ground side of them
    const S = [];
    for (const p of feet) for (let a = 0; a < 24; a++){ const t = a/24*Math.PI*2; if (Math.sin(t) < -.35) continue; // not above the foot
      for (const rr of [.22, .32, .45]){ const x = Math.round(p.x + Math.cos(t)*rr*k), y = Math.round(p.y + Math.sin(t)*rr*k*.6 + .04*k);
        if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = y*W + x; if (!M[i]) S.push(i); } }
    if (S.length < 8) return null;
    const med = j => { const v = S.map(i => C[j][i]).sort((a, b) => a - b); return v[v.length >> 1]; };
    let m = prev && prev.color ? prev.color : [med(0), med(1), med(2)];
    let seeds = S.filter(i => dist(C, i, m) < 16);
    if (prev && prev.color && seeds.length < S.length*.3){ m = [med(0), med(1), med(2)]; seeds = S.filter(i => dist(C, i, m) < 16); } // the old colour is gone: look afresh
    if (seeds.length < S.length*.3) return null; // no one colour around the feet: not standing on anything we can tell
    m = [0, 1, 2].map(j => seeds.reduce((s, i) => s + C[j][i], 0)/seeds.length);
    const sd = Math.sqrt(seeds.reduce((s, i) => s + dist(C, i, m)**2, 0)/seeds.length);
    const T1 = Math.max(14, Math.min(26, 2.6*sd + 8)), T2 = 7;
    // 2. grow the region through like colour, stopping at sharp steps
    const R = new Uint8Array(n), q = new Int32Array(n); let qh = 0, qt = 0;
    for (const i of seeds) if (!R[i]){ R[i] = 1; q[qt++] = i; }
    while (qh < qt){ const i = q[qh++], x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]){
        if (j < 0 || j >= n || R[j] || M[j]) continue;
        if (dist(C, j, m) > T1 || dist(C, j, [C[0][i], C[1][i], C[2][i]]) > T2) continue;
        R[j] = 1; q[qt++] = j; } }
    const area = qt;
    if (area < n*.012 || area > n*.7) return null; // a speck, or the whole floor
    // 3. the edges: per row the outermost mat pixels, kept only where they do not sit against the body
    const rows = [];
    for (let y = 0; y < H; y++){ let a = -1, b = -1, c = 0; for (let x = 0; x < W; x++) if (R[y*W + x]){ if (a < 0) a = x; b = x; }
      if (a >= 0) for (let x = a; x <= b; x++) if (R[y*W + x] || M[y*W + x]) c++; // the body lying or standing on the mat counts as mat here
      const near = (x0, d) => { for (let t = 1; t <= 4; t++){ const x = x0 + d*t; if (x >= 0 && x < W && M[y*W + x]) return true; } return false; };
      if (c >= 3) rows.push({y, a, b, c, la: a > 0 && !near(a, -1), lb: b < W - 1 && !near(b, 1), ea: a === 0, eb: b === W - 1}); }
    if (rows.length < 4) return null;
    const wMed = rows.map(r => r.b - r.a).sort((a, b) => a - b)[rows.length >> 1], solid = rows.filter(r => r.b - r.a >= wMed*.3 && r.c >= (r.b - r.a + 1)*.35);
    if (solid.length < 4) return null;
    const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(p*(arr.length - 1))))];
    const ys = solid.map(r => r.y), yT = pct(ys, .01), yB = pct(ys, .99);
    if (yB - yT < 3) return null;
    const fit = (pts, fallback) => { // x = s*y + c, least squares with one round of trimming
      if (pts.length < 3) return fallback;
      let use = pts; for (let it = 0; it < 2; it++){ const N = use.length, my = use.reduce((s, p) => s + p[1], 0)/N, mx = use.reduce((s, p) => s + p[0], 0)/N;
        let sxy = 0, syy = 0; for (const p of use){ sxy += (p[1] - my)*(p[0] - mx); syy += (p[1] - my)**2; }
        const s = syy > 0 ? sxy/syy : 0, c = mx - s*my; if (it) return {s, c};
        const res = use.map(p => Math.abs(p[0] - (s*p[1] + c))), cut = Math.max(1.5, 2.5*res.slice().sort((a, b) => a - b)[res.length >> 1]);
        const keep = use.filter((p, i) => res[i] <= cut); if (keep.length < 3) return {s, c}; use = keep; }
    };
    const inT = r => r.y >= yT && r.y <= yB;
    const Lp = solid.filter(r => inT(r) && (r.la || r.ea)).map(r => [r.a, r.y]), Rp = solid.filter(r => inT(r) && (r.lb || r.eb)).map(r => [r.b, r.y]);
    const minA = Math.min(...solid.map(r => r.a)), maxB = Math.max(...solid.map(r => r.b));
    const L = fit(Lp, {s:0, c:minA}), Rt = fit(Rp, {s:0, c:maxB});
    const xl = y => Math.max(-W*.2, L.s*y + L.c), xr = y => Math.min(W*1.2, Rt.s*y + Rt.c);
    const quad = [[xl(yT), yT], [xr(yT), yT], [xr(yB + 1), yB + 1], [xl(yB + 1), yB + 1]];
    const wt = quad[1][0] - quad[0][0], wb = quad[2][0] - quad[3][0];
    if (wt < 2 || wb < 2 || wt > wb*1.6) return null; // the far end can't look much wider than the near one
    // 4. how well the trapezoid is filled by mat (or by the body lying on it): a mat is solid, a floor pattern is not
    let inQ = 0, hit = 0;
    for (let y = Math.ceil(yT); y <= yB; y++){ const a = Math.max(0, Math.ceil(xl(y))), b = Math.min(W - 1, Math.floor(xr(y)));
      for (let x = a; x <= b; x++){ inQ++; const i = y*W + x; if (R[i] || M[i]) hit++; } }
    const fill = inQ ? hit/inQ : 0;
    const cut = {left: Lp.length < 3 || solid.filter(r => r.ea).length > solid.length*.3, right: Rp.length < 3 || solid.filter(r => r.eb).length > solid.length*.3, near: yB >= H - 2, far: yT <= 1};
    if (cut.left && cut.right) return null; // no side edge in sight: most likely the floor itself, not a mat
    const conf = Math.max(0, Math.min(1, (fill - .45)/.4)) * Math.min(1, area/(n*.04)) * (cut.far ? .5 : 1);
    if (conf < .15) return null;
    return {quad: quad.map(([x, y]) => [x/W, y/H]), conf, fill, color: m, area: area/n, cut};
  }

  // homography from the four picture corners (TL, TR, BR, BL) to the unit square, and back
  function solve(A, b){ const N = b.length; for (let c = 0; c < N; c++){ let p = c; for (let r = c + 1; r < N; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]]; if (Math.abs(A[c][c]) < 1e-12) return null;
      for (let r = 0; r < N; r++){ if (r === c) continue; const f = A[r][c]/A[c][c]; for (let k = c; k < N; k++) A[r][k] -= f*A[c][k]; b[r] -= f*b[c]; } }
    return b.map((v, i) => v/A[i][i]); }
  function homography(from, to){
    const A = [], b = []; for (let i = 0; i < 4; i++){ const [x, y] = from[i], [u, v] = to[i];
      A.push([x, y, 1, 0, 0, 0, -u*x, -u*y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v*x, -v*y]); b.push(v); }
    const h = solve(A, b); return h && [...h, 1]; }
  const apply = (h, x, y) => { const w = h[6]*x + h[7]*y + h[8]; return [(h[0]*x + h[1]*y + h[2])/w, (h[3]*x + h[4]*y + h[5])/w]; };
  const SQ = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const toMat = (quad, x, y) => { const h = homography(quad, SQ); return h ? apply(h, x, y) : null; };
  const fromMat = (quad, u, v) => { const h = homography(SQ, quad); return h ? apply(h, u, v) : null; };

  // which way the mat runs: a mat seen from beside it looks much wider than deep, one seen from its end looks long and narrow.
  // aspect = the picture's width / height, since the quad is in shares of the frame.
  function placeOf(quad, aspect = 1){
    const w = ((quad[1][0] - quad[0][0]) + (quad[2][0] - quad[3][0]))/2*aspect, h = ((quad[3][1] - quad[0][1]) + (quad[2][1] - quad[1][1]))/2;
    return w > h*2.2 ? 'side' : 'front';
  }
  // where you are on the mat: the floor contacts in mat coordinates, their middle, and what to say about it.
  // place: 'front' (camera looks along the mat, u runs across its width) or 'side' (camera looks across it, u runs along it)
  function locate(quad, K, place){
    const pts = contacts(K); if (!pts.length) return null;
    const uv = pts.map(p => toMat(quad, p.x, p.y)).filter(Boolean); if (!uv.length) return null;
    const c = [uv.reduce((s, p) => s + p[0], 0)/uv.length, uv.reduce((s, p) => s + p[1], 0)/uv.length];
    const out = (p, e) => p[0] < -e || p[0] > 1 + e || p[1] < -e || p[1] > 1 + e;
    // how far from the middle, in each direction, as a share of the half-length (1 = at the edge); the width is the narrow way
    const across = place === 'side' ? 1 : 0, du = (c[0] - .5)*2, dv = (c[1] - .5)*2, dw = across ? dv : du, dl = across ? du : dv;
    let state = 'centre';
    if (out(c, .02) || uv.filter(p => out(p, .08)).length > uv.length/2) state = 'off';
    else if (Math.abs(dw) > .6 || Math.abs(dl) > .78 || uv.some(p => out(p, .02))) state = 'edge'; // the middle drifting out, or a foot over the edge
    return {pts: uv, c, state, du, dv};
  }

  root.SamaMat = {find, toMat, fromMat, locate, placeOf, contacts};
  if (typeof module !== 'undefined') module.exports = root.SamaMat;
})(typeof window !== 'undefined' ? window : globalThis);
