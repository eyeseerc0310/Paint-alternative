// SHARED PICTURE SUMS (window.PaintFX): what Paint's Effects and Photo
// mode both use to work out a picture's tones, so there's one way of doing
// each: Paint's fxParams builds its tables from these, and Photo mode builds
// its finer ones from the very same sums. Nothing here touches the page.
(function () {
  'use strict';
  function sstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  // THE TONE SLIDERS on a value from 0 to 1 (exposure already applied):
  // shadows, highlights, whites and blacks lift or hold back their own part
  // of the range, then contrast (an S, or flatter), then fade (the blacks
  // lifted, the whites brought down). t: { sh, hi, wh, bl, co, fa }, each -1
  // to 1 (fade 0 to 1)
  function toneAt(x, t) {
    var sh = t.sh || 0, hi = t.hi || 0, wh = t.wh || 0, bl = t.bl || 0, co = t.co || 0, fa = t.fa || 0;
    x += sh * 0.3 * (1 - sstep(0, 0.55, x)) * (sh > 0 ? 1 - x : x);
    x += hi * 0.3 * sstep(0.45, 1, x) * (hi > 0 ? 1 - x : x);
    x += wh * 0.22 * sstep(0.55, 1.05, x);
    x += bl * 0.16 * Math.pow(1 - Math.min(1, x), 3);
    x = Math.max(0, Math.min(1, x));
    x = co >= 0 ? x + co * 0.9 * (x * x * (3 - 2 * x) - x) * 1.6 : 0.5 + (x - 0.5) * (1 + co * 0.6);
    x = fa ? x * (1 - fa * 0.22) + fa * 0.12 : x;
    return x;
  }
  // BRILLIANCE: the factor a value L (0 to 1) is multiplied by; it brings up
  // the darker parts and holds back the brightest
  function brilliance(L, br) { return L ? Math.max(0, L + br * (0.45 * L * (1 - L) * (1 - L) - 0.25 * L * L * (1 - L))) / L : 1; }
  // CURVES: points (in 0-255) joined by a natural cubic spline; the tones
  // just stop at pure black and pure white. n values out of it (256 unless
  // asked for more), each for an input of i / (n - 1) * 255.
  function curveLut(P0, n) {
    n = n || 256;
    var P = P0.map(function (q) { return [q[0], q[1]]; }).sort(function (a, b) { return a[0] - b[0]; });
    for (var t = 1; t < P.length; t++) if (P[t][0] - P[t - 1][0] < 0.5) P[t][0] = P[t - 1][0] + 0.5; // (two at the same place: a hair apart)
    var m = P.length, out = new Float32Array(n), i, j, x, sc = 255 / (n - 1);
    if (m < 3) {
      for (j = 0; j < n; j++) { x = j * sc; var u0 = (x - P[0][0]) / Math.max(0.5, P[1][0] - P[0][0]); out[j] = Math.max(0, Math.min(255, x <= P[0][0] ? P[0][1] : x >= P[1][0] ? P[1][1] : P[0][1] + (P[1][1] - P[0][1]) * u0)); }
      return out;
    }
    // second derivatives (natural ends), by the usual tridiagonal sweep
    var h = [], al = [], l = [1], mu = [0], z = [0], c = new Array(m).fill(0);
    for (i = 0; i < m - 1; i++) h[i] = P[i + 1][0] - P[i][0];
    for (i = 1; i < m - 1; i++) al[i] = 3 / h[i] * (P[i + 1][1] - P[i][1]) - 3 / h[i - 1] * (P[i][1] - P[i - 1][1]);
    for (i = 1; i < m - 1; i++) { l[i] = 2 * (P[i + 1][0] - P[i - 1][0]) - h[i - 1] * mu[i - 1]; mu[i] = h[i] / l[i]; z[i] = (al[i] - h[i - 1] * z[i - 1]) / l[i]; }
    var bb = [], dd = [];
    for (i = m - 2; i >= 0; i--) { c[i] = (i ? z[i] : 0) - (i ? mu[i] * c[i + 1] : 0); bb[i] = (P[i + 1][1] - P[i][1]) / h[i] - h[i] * (c[i + 1] + 2 * c[i]) / 3; dd[i] = (c[i + 1] - c[i]) / (3 * h[i]); }
    for (j = 0, i = 0; j < n; j++) {
      x = j * sc;
      var y;
      if (x <= P[0][0]) y = P[0][1];
      else if (x >= P[m - 1][0]) y = P[m - 1][1];
      else { while (i < m - 2 && x > P[i + 1][0]) i++; var dx = x - P[i][0]; y = P[i][1] + bb[i] * dx + c[i] * dx * dx + dd[i] * dx * dx * dx; }
      out[j] = Math.max(0, Math.min(255, y));
    }
    return out;
  }
  window.PaintFX = { sstep: sstep, toneAt: toneAt, brilliance: brilliance, curveLut: curveLut };
})();
