// geometry for checking what Vector mode made (a path's d, as serialize() gives it)
// area of a serialized path's d (cubic segments sampled), signed sum
function bez(a, b, c, d, t) { const u = 1 - t; return [u*u*u*a[0] + 3*u*u*t*b[0] + 3*u*t*t*c[0] + t*t*t*d[0], u*u*u*a[1] + 3*u*u*t*b[1] + 3*u*t*t*c[1] + t*t*t*d[1]]; }
exports.flat = (sp) => { const P = sp.pts, n = P.length, out = [], N = sp.closed ? n : n - 1; for (let i = 0; i < N; i++) { const a = P[i], b = P[(i + 1) % n]; for (let k = 0; k < 24; k++) out.push(bez([a.x, a.y], [a.ox, a.oy], [b.ix, b.iy], [b.x, b.y], k / 24)); } if (!sp.closed && n) out.push([P[n-1].x, P[n-1].y]); return out; };
exports.area = (d) => { let t = 0; d.forEach(sp => { const f = exports.flat(sp); let a = 0; for (let i = 0; i < f.length; i++) { const p = f[i], q = f[(i + 1) % f.length]; a += p[0]*q[1] - q[0]*p[1]; } t += a / 2; }); return t; };
exports.bbox = (d) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; d.forEach(sp => exports.flat(sp).forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); })); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
