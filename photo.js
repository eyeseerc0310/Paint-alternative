// PHOTO MODE (window.PaintPhoto, PH in paint.js): the third workspace, a
// photo editor in the manner of Lightroom. The photo as it came in is never
// changed: what's set is kept as numbers (doc.v), and the photo is worked
// out from them on the graphics chip each time it's shown or saved. Paint
// hands over what's shared through the bridge in init (the stage, the tool
// panel, the left bar, undo and redo, the zoom, sheets, saving files,
// autosave, toasts); the tone sums are Paint's own (fx-shared.js).
(function () {
  'use strict';
  var FX = window.PaintFX;
  var B = null, on = false, stageEl = null, cv = null, gl = null, groupEl = null, histEl = null, emptyEl = null, amtEl = null, amtDrag = false;
  // the photo in hand: its name, size, the file it came from (kept as it
  // was: what's saved, and what export works from) and the settings
  var doc = null, img = null, rev = 0;
  var hist = [], fut = [], dragging = false, before = false, cat = 'edit';
  var view = { x: 0, y: 0, k: 1, fit: true };

  // ---- THE SETTINGS: each slider's key, name, lowest, highest (-100 to
  // 100 unless said) and how its value reads ----
  var DEF = {
    exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, brightness: 0, curve: null,
    temp: 0, tint: 0, vibrance: 0, saturation: 0, hsl: null, grade: null,
    texture: 0, clarity: 0, dehaze: 0, vignette: 0, vigMid: 50, grain: 0, grainSize: 25, grainRough: 0, grainCol: 0, halation: 0,
    sharpen: 0, sRadius: 10, sDetail: 25, sMask: 0, nr: 0, nrColor: 0,
    distort: 0, lensVig: 0, caR: 0, caB: 0, vert: 0, horiz: 0, scale: 100,
    angle: 0, rot: 0, flipH: false, flipV: false, crop: null, asp: 'orig', aspT: false,
    masks: null, preset: null, pamt: 100
  };
  var SECS = [
    { id: 'light', name: 'Light', rows: [['exposure', 'Exposure', -100, 100, 'ev'], ['contrast', 'Contrast'], ['highlights', 'Highlights'], ['shadows', 'Shadows'], ['whites', 'Whites'], ['blacks', 'Blacks'], ['brightness', 'Brightness']], curve: true },
    { id: 'colour', name: 'Colour', rows: [['temp', 'Temperature'], ['tint', 'Tint'], ['vibrance', 'Vibrance'], ['saturation', 'Saturation']], mixer: true, grading: true },
    { id: 'effects', name: 'Effects', rows: [['texture', 'Texture'], ['clarity', 'Clarity'], ['dehaze', 'Dehaze'], ['vignette', 'Vignette'], ['vigMid', 'Vignette Midpoint', 0, 100], ['grain', 'Grain', 0, 100], ['grainSize', 'Grain Size', 0, 100], ['grainRough', 'Grain Roughness', 0, 100], ['grainCol', 'Colour Grain', 0, 100], ['halation', 'Halation', 0, 100]] },
    { id: 'detail', name: 'Detail', rows: [['sharpen', 'Sharpening', 0, 150], ['sRadius', 'Radius', 5, 30, 'r'], ['sDetail', 'Detail', 0, 100], ['sMask', 'Masking', 0, 100], ['nr', 'Noise Reduction', 0, 100], ['nrColor', 'Colour Noise Reduction', 0, 100]] },
    { id: 'optics', name: 'Optics & Geometry', rows: [['distort', 'Distortion'], ['lensVig', 'Lens Vignetting'], ['caR', 'Red / Cyan Fringe'], ['caB', 'Blue / Yellow Fringe'], ['vert', 'Vertical'], ['horiz', 'Horizontal'], ['scale', 'Scale', 50, 150, '%']] }
  ];
  // (the crop's own: the straightening angle, in tenths of a degree on its slider)
  var ANGLE = ['angle', 'Straighten', -45, 45, 'deg'];
  // the crop's shapes: width over height (Original: the photo's own, as turned)
  var ASPECTS = [['orig', 'Original'], ['free', 'Free'], ['1:1', '1 : 1'], ['4:5', '4 : 5'], ['3:2', '3 : 2'], ['16:9', '16 : 9']];
  // (the colour mixer's eight bands, round the colour wheel, in degrees)
  var BANDS = [['red', 'Red', 0, '#e5483a'], ['orange', 'Orange', 30, '#f08a2c'], ['yellow', 'Yellow', 60, '#e9c92f'], ['green', 'Green', 120, '#4cae4f'],
    ['aqua', 'Aqua', 180, '#36b9c4'], ['blue', 'Blue', 240, '#3d6fe0'], ['purple', 'Purple', 270, '#8a52d6'], ['magenta', 'Magenta', 300, '#d64fae']];
  var GRADES = [['sh', 'Shadows'], ['mid', 'Midtones'], ['hi', 'Highlights'], ['all', 'Global']];
  var band = 'red', gradeAt = 'sh';
  function fresh() { var v = {}; for (var k in DEF) v[k] = DEF[k]; return v; }
  function copyV(v) { return JSON.parse(JSON.stringify(v)); }
  function isDef(v, k) { var d = DEF[k]; return d === null ? !v[k] : v[k] === d; }
  function anySet(v) { return Object.keys(DEF).some(function (k) { return !isDef(v, k); }); }
  function show(k, val) {
    var r = rowOf(k);
    if (r && r[4] === 'ev') return (val > 0 ? '+' : '') + (val * 0.05).toFixed(2);
    if (r && r[4] === 'r') return (val / 10).toFixed(1);
    if (r && r[4] === '%' || k === 'b_size' || k === 'b_flow' || k === 'b_feather') return val + '%';
    if (r && r[4] === 'deg') return (+val).toFixed(1) + '°';
    return String(val);
  }
  function rowOf(k) { if (k === 'angle') return ANGLE; for (var i = 0; i < SECS.length; i++) for (var j = 0; j < SECS[i].rows.length; j++) if (SECS[i].rows[j][0] === k) return SECS[i].rows[j]; return null; }

  // ---- THE PRESETS: their names, categories and recipes are data, in
  // photo-presets.js (window.PaintPhotoPresets); each recipe is a set of the
  // very same settings (v), and a film's look as well (look: its colour
  // matrix, its own curve for each channel, a black-and-white film's
  // spectral mix), which only a preset can set ----
  var PDATA = window.PaintPhotoPresets || { cats: [['colour', 'Colour'], ['bw', 'Black & White']], list: [] }, PRESETS = PDATA.list, PCATS = PDATA.cats;
  var presetBase = null, presetPick = null, thumbs = {}, thumbRev = -1;
  // A PRESET IS A LAYER OF ITS OWN over the settings set by hand (doc.v),
  // named by doc.v.preset: what's shown and saved is eff(v), each slider the
  // hand's value plus what the preset moves it by (its value less where the
  // slider starts), the preset's curve after the hand's, its colour mixer
  // added band by band, its colour grading where the hand's has none. So
  // Original (no preset) takes off only the preset, another preset takes its
  // place, and nothing set by hand, before or after, is lost.
  function presetOf(id) { for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i]; return null; }
  // HOW MUCH OF IT (v.pamt, the bottom bar's slider, 0 to 100): the preset
  // as it's laid over what's set by hand, scaled from none of it to all of
  // it: each slider's offset, its curve's points and each channel's from the
  // straight line, its mixer and grading, its matrix from none, its black and
  // white mix (blended in the shader, u_monoA). At 0 it's exactly the hand's.
  function amtOf(v) { return v.pamt == null ? 1 : Math.max(0, Math.min(100, +v.pamt || 0)) / 100; }
  function curveAt(c, a) { return a === 1 ? c : c.map(function (q) { return [q[0], q[0] + (q[1] - q[0]) * a]; }); }
  function pAt(v) {
    var q = v.preset && presetOf(v.preset), a = q ? amtOf(v) : 0; if (!q || !a) return null;
    if (a === 1) return { q: q, v: q.v, look: q.look };
    var o = {}, pv = q.v, L = q.look;
    for (var k in pv) {
      if (typeof pv[k] === 'number') o[k] = DEF[k] + (pv[k] - DEF[k]) * a;
      else if (k === 'curve') o.curve = curveAt(pv.curve, a);
      else if (k === 'hsl') { o.hsl = {}; for (var b in pv.hsl) o.hsl[b] = pv.hsl[b].map(function (x) { return x * a; }); }
      else if (k === 'grade') { o.grade = {}; for (var gk in pv.grade) { var g = pv.grade[gk]; o.grade[gk] = Array.isArray(g) ? [g[0], g[1] * a, g[2] * a] : g; } }
    }
    var lk = null;
    if (L) { lk = {}; if (L.mat) lk.mat = L.mat.map(function (x, i) { var id = i % 4 === 0 ? 1 : 0; return id + (x - id) * a; });
      if (L.rgb) { lk.rgb = {}; for (var c in L.rgb) lk.rgb[c] = curveAt(L.rgb[c], a); }
      if (L.mono) { lk.mono = L.mono; lk.monoA = a; } }
    return { q: q, v: o, look: lk };
  }
  function scalarK(k) { return typeof DEF[k] === 'number' && !!rowOf(k); }
  function rangeOf(k) { var r = rowOf(k); return [r && r[2] != null ? r[2] : -100, r && r[3] != null ? r[3] : 100]; }
  function offOf(v, k) { var P = pAt(v); return P && typeof P.v[k] === 'number' ? P.v[k] - DEF[k] : 0; }
  function eff(v) {
    var P = pAt(v); if (!P) return v;
    var e = copyV(v), pv = P.v;
    if (P.look) e.plook = P.look; // (the film's own: matrix, channel curves, spectral mix)
    for (var k in pv) {
      if (scalarK(k)) { var rg = rangeOf(k); e[k] = Math.max(rg[0], Math.min(rg[1], v[k] + pv[k] - DEF[k])); }
      else if (k === 'curve') e.pcurve = pv.curve;
      else if (k === 'hsl') { e.hsl = e.hsl || {}; for (var b in pv.hsl) { var m = e.hsl[b] || [0, 0, 0]; e.hsl[b] = m.map(function (x, i) { return Math.max(-100, Math.min(100, x + pv.hsl[b][i])); }); } }
      else if (k === 'grade') e.grade = gradeMix(v.grade, pv.grade);
    }
    return e;
  }
  // (colour grading: each of the four the hand's where it tints, the preset's otherwise)
  function gradeMix(m, p) {
    if (!m) return copyV(p);
    var o = copyV(m); GRADES.forEach(function (g) { var a = m[g[0]]; if (!a || (!a[1] && !a[2])) o[g[0]] = p[g[0]].slice(); });
    if (m.blend === 50 && !m.bal) { o.blend = p.blend; o.bal = p.bal; }
    return o;
  }

  // ---- THE GRAPHICS CHIP. The photo is a texture (with its smaller
  // copies, so a zoomed-out view and the soft copies read cleanly); once
  // per photo a working copy about 1,024 pixels across is made, in linear
  // light, with its darkest channel kept beside it, and blurred two ways
  // (clarity's soft copy and dehaze's wide one). Each look is one pass,
  // DEV, in floating point from end to end, drawn straight to the screen
  // (or, for saving, into a texture the photo's size) ----
  var P = {}, T = {}, vao = null, fbs = {}, F16 = false, maxTex = 4096;
  var VS = '#version 300 es\nin vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
  var HEAD = '#version 300 es\nprecision highp float; precision highp int; precision highp sampler2D;\n' +
    'vec3 lin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }\n' +
    'vec3 enc(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }\n' +
    'float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }\n';
  // (the working copy: linear light, and the darkest channel for dehaze)
  var COPY = HEAD + 'uniform sampler2D u_in; uniform float u_lod; uniform vec2 u_size; uniform int u_lin; out vec4 frag;\n' +
    'void main() { vec2 uv = gl_FragCoord.xy / u_size; uv.y = 1.0 - uv.y; vec4 s = textureLod(u_in, uv, u_lod); vec3 c = u_lin == 1 ? lin(s.rgb) : s.rgb;\n' +
    // (2: the brightest of the working copy, as the light that halates: weighted, so what's pushed
    // up by exposure halates too, and all but nothing from the middle tones)
    '  if (u_lin == 2) { float w = smoothstep(0.3, 1.0, dot(c, vec3(0.2126, 0.7152, 0.0722))); frag = vec4(c * w * w, 1.0); return; }\n' +
    '  frag = vec4(c, u_lin == 1 ? min(min(c.r, c.g), c.b) : s.a); }';
  // (a Gaussian blur one way, sigma in the texture's own pixels)
  var BLUR = HEAD + 'uniform sampler2D u_in; uniform vec2 u_dir, u_size; uniform float u_sig; out vec4 frag;\n' +
    'void main() { vec2 uv = gl_FragCoord.xy / u_size; vec4 t = vec4(0.0); float w = 0.0; int r = int(ceil(u_sig * 3.0));\n' +
    '  for (int i = -60; i <= 60; i++) { if (i < -r || i > r) continue; float f = exp(-0.5 * float(i * i) / (u_sig * u_sig)); t += texture(u_in, uv + u_dir * float(i) / u_size) * f; w += f; }\n' +
    '  frag = t / w; }';
  var DEV = HEAD +
    'uniform sampler2D u_src, u_bm, u_bl, u_lut, u_hl; uniform vec2 u_o, u_s, u_out, u_img; uniform float u_lod; uniform int u_neutral;\n' +
    'uniform mat3 u_A, u_P, u_B; uniform float u_k, u_car, u_cab, u_lv; uniform vec2 u_px;\n' +
    // (the masks: up to four, each a kind (1 linear, 2 radial, 3 brush), its shape and its own settings)
    'uniform int u_nm, u_show; uniform int u_mk[4]; uniform vec4 u_mg[4], u_mh[4], u_ma[4], u_mb[4]; uniform vec2 u_asp; uniform sampler2D u_br0, u_br1, u_br2, u_br3;\n' +
    'uniform vec3 u_wb; uniform float u_ev, u_dh, u_cl, u_tx, u_sh, u_sOff, u_sDet, u_sMask, u_nr, u_nrc, u_sat, u_vib, u_vg, u_vgMid, u_gr, u_grSize, u_grRough, u_grCol, u_fp, u_hal;\n' +
    // (a film's own, from its preset: its colour matrix and its spectral mix, for black and white)
    'uniform int u_mat, u_mono; uniform mat3 u_M; uniform vec3 u_monoW; uniform float u_monoA;\n' +
    'uniform int u_mix; uniform vec3 u_hsl[8]; uniform float u_hc[8];\n' +
    'uniform int u_grade; uniform vec3 u_gS, u_gM, u_gH, u_gA; uniform float u_gBlend, u_gBal;\n' +
    'out vec4 frag;\n' +
    // (the photo's own values made linear, then white balance and exposure; the soft copies are linear already)
    'vec3 prep(vec3 s) { return lin(s) * u_wb * u_ev; }\n' +
    'vec3 at(vec2 uv, float d) { return prep(textureLod(u_src, uv, u_lod + d).rgb); }\n' +
    'vec3 hsv(vec3 c) { vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));\n' +
    '  float d = q.x - min(q.w, q.y); return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x); }\n' +
    'vec3 rgb(vec3 c) { vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0); return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y); }\n' +
    'vec3 tint(vec3 g) { return (rgb(vec3(g.x / 360.0, 1.0, 1.0)) - vec3(0.5)) * g.y / 100.0 * 0.35 + vec3(g.z / 100.0 * 0.25); }\n' +
    'float hash(vec2 p) { uvec2 q = uvec2(ivec2(p)); uint h = q.x * 2654435761u ^ q.y * 2246822519u; h ^= h >> 13; h *= 3266489917u; h ^= h >> 16; return float(h % 10000u) / 10000.0; }\n' +
    'float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }\n' +
    // how much of a mask's look a place takes: a linear one full before its first line and none past
    // its last, a radial one inside its ellipse softening by its feather, a brush one as painted
    'float maskW(int i, vec2 uv) { vec2 q = uv * u_asp; float w = 0.0; int k = u_mk[i]; vec4 g = u_mg[i], h = u_mh[i];\n' +
    '  if (k == 1) { vec2 d = g.zw - g.xy; float t = dot(q - g.xy, d) / max(dot(d, d), 1e-8); w = 1.0 - smoothstep(0.0, 1.0, t); }\n' +
    '  else if (k == 2) { vec2 r = q - g.xy; float ca = cos(h.x), sa = sin(h.x); r = vec2(ca * r.x + sa * r.y, -sa * r.x + ca * r.y); float el = length(r / max(g.zw, vec2(1e-4))); w = 1.0 - smoothstep(1.0 - max(h.y, 0.001), 1.0, el); }\n' +
    '  else if (k == 3) { w = i == 0 ? texture(u_br0, uv).a : i == 1 ? texture(u_br1, uv).a : i == 2 ? texture(u_br2, uv).a : texture(u_br3, uv).a; }\n' +
    '  return h.w > 0.5 ? 1.0 - w : w; }\n' +
    'void main() {\n' +
    // where in the photo: the output's place (ou, 0 to 1 across what's kept by the crop) taken back
    // through the straightening, the perspective, the lens and the turn (geo)
    '  vec2 fc = vec2(gl_FragCoord.x, u_out.y - gl_FragCoord.y); vec2 ou = (fc - u_o) * u_s;\n' +
    '  if (ou.x < 0.0 || ou.y < 0.0 || ou.x > 1.0 || ou.y > 1.0) { frag = vec4(0.0); return; }\n' +
    '  vec3 hh = u_P * (u_A * vec3(ou, 1.0)); vec2 n = hh.xy / hh.z; float r2 = dot(n, n); vec2 nl = n * (1.0 + u_k * r2);\n' +
    '  vec2 uv = (u_B * vec3(nl, 1.0)).xy;\n' +
    '  if (hh.z <= 0.0 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { frag = vec4(0.0); return; }\n' +
    '  vec4 S = textureLod(u_src, uv, u_lod);\n' +
    // (colour fringes: red and blue each read from a touch further in or out)
    '  if (u_car != 0.0) S.r = textureLod(u_src, (u_B * vec3(nl * (1.0 + u_car), 1.0)).xy, u_lod).r;\n' +
    '  if (u_cab != 0.0) S.b = textureLod(u_src, (u_B * vec3(nl * (1.0 + u_cab), 1.0)).xy, u_lod).b;\n' +
    '  if (u_neutral == 1) { frag = vec4(S.rgb * S.a, S.a); return; }\n' +
    '  vec3 c = prep(S.rgb); if (u_lv != 0.0) c *= exp2(u_lv * r2 * 1.5);\n' +
    // the masks' own settings, each weighted by how much of it this place takes, added up
    '  float lex = 0.0, lco = 0.0, lhi = 0.0, lsh = 0.0, lte = 0.0, lti = 0.0, lsa = 0.0, lcl = 0.0, wShow = 0.0;\n' +
    '  for (int i = 0; i < 4; i++) { if (i >= u_nm) break; float w = maskW(i, uv); if (i == u_show) wShow = w;\n' +
    '    lex += w * u_ma[i].x; lco += w * u_ma[i].y; lhi += w * u_ma[i].z; lsh += w * u_ma[i].w; lte += w * u_mb[i].x; lti += w * u_mb[i].y; lsa += w * u_mb[i].z; lcl += w * u_mb[i].w; }\n' +
    '  if (lex != 0.0 || lte != 0.0 || lti != 0.0) { vec3 g3 = vec3(exp2(0.8 * lte + 0.15 * lti), exp2(-0.6 * lti), exp2(-0.8 * lte + 0.15 * lti)); g3 /= dot(g3, vec3(0.2126, 0.7152, 0.0722)); c *= exp2(lex) * g3; }\n' +
    // a film's response, in linear light as it met the light: how its layers see the colours (a
    // matrix whose rows add to one, so a grey stays grey), and a black-and-white film's
    // sensitivity to red, green and blue, making the one grey
    '  if (u_mat == 1) c = max(u_M * c, 0.0);\n' +
    '  if (u_mono == 1) c = mix(c, vec3(max(dot(c, u_monoW), 0.0)), u_monoA);\n' +
    // halation: the brightest light spreading back through the base into the red-sensitive
    // layer, a warm glow round the strong highlights only (the highlights blurred, u_hl, so a
    // small lamp glows as much as a big one), less what this place's own light gives it, so it
    // rings round a light rather than tinting what's bright itself; on black and white, grey
    '  if (u_hal > 0.0) { vec3 wl = vec3(0.2126, 0.7152, 0.0722); float Yh = dot(texture(u_hl, uv).rgb * u_wb * u_ev, wl), Ys = dot(c, wl) / max(u_ev, 1e-4), ws = smoothstep(0.3, 1.0, Ys);\n' +
    '    float rg = max(Yh - Ys * ws * ws * u_ev, 0.0) * mix(1.0, 2.0, smoothstep(0.5, 1.0, Yh)); c += (u_mono == 1 ? vec3(0.45) : vec3(1.0, 0.24, 0.07)) * min(rg, 1.0) * u_hal; }\n' +
    // dehaze: the haze the darkest channel shows, taken out (or added)
    '  if (u_dh != 0.0) { float A = 0.95 * max(u_ev, 0.01) * max(max(u_wb.r, u_wb.g), u_wb.b); float dk = texture(u_bl, uv).a * u_ev;\n' +
    '    if (u_dh > 0.0) { float t = max(0.12, 1.0 - u_dh * 0.92 * dk / A); c = max((c - A) / t + A, 0.0); } else c = mix(c, vec3(A * 0.8), -u_dh * 0.45); }\n' +
    // (the brightest a shoulder, not a cliff, once the light is pushed up: from 1 when it isn't, so
    // a photo with nothing set comes out exactly as it went in, down to 0.8 a stop up; past it, the
    // colour is kept and only the light held)
    '  float kn = 1.0 - 0.2 * clamp(max(u_ev * max(max(u_wb.r, u_wb.g), u_wb.b), 1.0) - 1.0, 0.0, 1.0), m = max(max(c.r, c.g), c.b);\n' +
    '  if (m > kn) c *= (kn < 0.999 ? kn + (1.0 - kn) * (1.0 - exp(-(m - kn) / (1.0 - kn))) : 1.0) / m;\n' +
    '  vec3 e = enc(c); float L = luma(e);\n' +
    // noise: the light smoothed where it's flat, the colour from a softer copy
    '  if (u_nr > 0.0) { float LB = luma(enc(at(uv, 1.0))); float k = u_nr * (1.0 - smoothstep(0.03, 0.18, abs(L - LB))); e += (LB - L) * k; L = luma(e); }\n' +
    '  if (u_nrc > 0.0) { vec3 eC = enc(at(uv, 2.5)); e = L + mix(e - L, eC - luma(eC), u_nrc); }\n' +
    // detail: texture (fine), clarity (wide, the middle tones), sharpening
    '  if (u_tx != 0.0) { float LS = luma(enc(at(uv, 1.5))); e += (L - LS) * u_tx * 1.4; }\n' +
    '  float clT = u_cl + lcl; if (clT != 0.0) { float LM = luma(enc(texture(u_bm, uv).rgb * u_wb * u_ev)); float mt = 1.0 - pow(2.0 * clamp(L, 0.0, 1.0) - 1.0, 2.0); e += (L - LM) * clT * 1.3 * mt; }\n' +
    '  if (u_sh > 0.0) { float LR = luma(enc(at(uv, u_sOff))); float d = clamp(L - LR, -mix(0.025, 0.35, u_sDet), mix(0.025, 0.35, u_sDet));\n' +
    '    float mw = 1.0; if (u_sMask > 0.0) { float ed = abs(L - luma(enc(at(uv, 2.5)))); mw = smoothstep(u_sMask * 0.06, u_sMask * 0.06 + 0.04, ed); }\n' +
    '    e += d * u_sh * 2.0 * mw * mix(0.6, 1.4, u_sDet); }\n' +
    // the tones: Paint's tone sums, brightness and the curve, as one table
    '  e = clamp(e, 0.0, 1.0); vec2 lt = vec2(0.5 / 1024.0 + e.r * 1023.0 / 1024.0, 0.5);\n' +
    // (each channel through its own column: the same unless a film's preset curves one of them)
    '  e = vec3(texture(u_lut, vec2(0.5 / 1024.0 + e.r * 1023.0 / 1024.0, 0.5)).r, texture(u_lut, vec2(0.5 / 1024.0 + e.g * 1023.0 / 1024.0, 0.5)).g, texture(u_lut, vec2(0.5 / 1024.0 + e.b * 1023.0 / 1024.0, 0.5)).b);\n' +
    // (the masks' tones: Paint's sums again, as toneAt in fx-shared.js)
    '  if (lco != 0.0 || lhi != 0.0 || lsh != 0.0) { vec3 x = clamp(e, 0.0, 1.0);\n' +
    '    x += lsh * 0.3 * (1.0 - smoothstep(0.0, 0.55, x)) * mix(x, 1.0 - x, step(0.0, lsh)); x += lhi * 0.3 * smoothstep(0.45, 1.0, x) * mix(x, 1.0 - x, step(0.0, lhi)); x = clamp(x, 0.0, 1.0);\n' +
    '    e = lco >= 0.0 ? x + lco * 0.9 * (x * x * (3.0 - 2.0 * x) - x) * 1.6 : 0.5 + (x - 0.5) * (1.0 + lco * 0.6); }\n' +
    // the colour mixer: each band's hue, saturation and luminance
    '  if (u_mix == 1) { vec3 h = hsv(e); float dh = 0.0, ds = 0.0, dl = 0.0, tw = 0.0;\n' +
    '    for (int i = 0; i < 8; i++) { float c0 = u_hc[i], cp = u_hc[(i + 7) % 8], cn = u_hc[(i + 1) % 8];\n' +
    '      float d = h.x - c0; d -= floor(d + 0.5); float hw = d < 0.0 ? fract(c0 - cp) : fract(cn - c0); float w = clamp(1.0 - abs(d) / max(hw, 1e-3), 0.0, 1.0); w = w * w * (3.0 - 2.0 * w);\n' +
    '      dh += w * u_hsl[i].x; ds += w * u_hsl[i].y; dl += w * u_hsl[i].z; tw += w; }\n' +
    '    if (tw > 0.0) { dh /= tw; ds /= tw; dl /= tw; }\n' +
    '    float sw = smoothstep(0.02, 0.25, h.y); h.x = fract(h.x + dh * 30.0 / 360.0 * sw); h.y = clamp(h.y * (1.0 + ds), 0.0, 1.0); e = rgb(h); e *= 1.0 + dl * 0.6 * sw * h.y; }\n' +
    // vibrance and saturation: Paint's sums, in 0 to 1
    '  float satT = u_sat * (1.0 + lsa); if (satT != 1.0 || u_vib != 0.0) { float l = luma(e), mx = max(max(e.r, e.g), e.b), mn = min(min(e.r, e.g), e.b); float ff = max(satT, 0.0) * (1.0 + u_vib * (1.0 - (mx - mn)) * (u_vib > 0.0 ? 1.0 : 0.8)); e = l + (e - l) * ff; }\n' +
    // colour grading: the shadows, midtones and highlights each tinted, and all of it
    '  if (u_grade == 1) { float Y = clamp(luma(e), 0.0, 1.0), mid = 0.5 + u_gBal * 0.25, bw = 0.15 + u_gBlend * 0.5;\n' +
    '    float wS = 1.0 - smoothstep(mid - bw, mid, Y), wH = smoothstep(mid, mid + bw, Y), wM = clamp(1.0 - wS - wH, 0.0, 1.0);\n' +
    '    e += tint(u_gS) * wS + tint(u_gM) * wM + tint(u_gH) * wH + tint(u_gA); }\n' +
    // vignette (Paint's, round the photo) and grain (fixed to the photo, not the screen)
    '  if (u_vg != 0.0) { vec2 dv = (ou - 0.5) * vec2(u_img.x / max(u_img.x, u_img.y), u_img.y / max(u_img.x, u_img.y)); float r = length(dv) / length(vec2(u_img.x, u_img.y) / max(u_img.x, u_img.y) * 0.5);\n' +
    '    float s0 = mix(0.05, 0.75, u_vgMid); float k = smoothstep(s0, 1.08, r) * u_vg * 0.75; if (u_vg > 0.0) e *= 1.0 - k; else e -= k * (1.0 - e); }\n' +
    // grain: fixed to the photo (its size a part of the frame, so a photo of any size has the same
    // grain), never redrawn differently; grains smaller than a pixel seen average out (u_fp, the
    // photo's pixels a pixel shown), as on a film scanned smaller, so it neither shimmers when
    // zoomed out nor changes with the size saved. Roughness: a finer third layer, crisper grains
    // and clumping (its strength varying slowly across the frame); colour: each channel its own
    '  if (u_gr > 0.0) { float ge = max(u_grSize, u_fp), att = u_grSize / ge; vec2 gp = uv * u_px / ge;\n' +
    '    float n0 = noise(gp), n1 = noise(gp * 2.1 + 17.0), n = mix(n0 * 0.6 + n1 * 0.4, n0 * 0.45 + n1 * 0.33 + noise(gp * 4.3 + vec2(5.0, 29.0)) * 0.22, u_grRough) - 0.5;\n' +
    '    n = mix(n, clamp(n * 2.2, -0.5, 0.5), u_grRough * 0.5); float cl = mix(1.0, 0.45 + 1.1 * noise(gp * 0.19 + vec2(41.0, 7.0)), u_grRough * 0.8);\n' +
    '    vec3 nv = vec3(n); if (u_grCol > 0.0) nv = mix(nv, vec3(noise(gp + vec2(31.7, 11.0)), noise(gp * 1.07 + vec2(3.3, 57.0)), noise(gp * 0.93 + vec2(77.0, 19.0))) - 0.5, u_grCol);\n' +
    '    float l = luma(e); e += nv * u_gr * 0.22 * att * cl * (0.4 + 4.0 * l * (1.0 - l)); }\n' +
    '  e = clamp(e, 0.0, 1.0); if (u_show >= 0) e = mix(e, vec3(1.0, 0.16, 0.12), wShow * 0.55);\n' +
    '  frag = vec4(e * S.a, S.a); }';

  function prog(fs) {
    var p = gl.createProgram(), sh = function (t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); gl.attachShader(p, o); };
    sh(gl.VERTEX_SHADER, VS); sh(gl.FRAGMENT_SHADER, fs); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    p.u = {}; return p;
  }
  function U(p, n) { if (!(n in p.u)) p.u[n] = gl.getUniformLocation(p, n); return p.u[n]; }
  function glInit() {
    if (gl) return true;
    try {
      gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
      if (!gl) return false;
      F16 = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
      gl.getExtension('OES_texture_float_linear');
      maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 16384);
      P.copy = prog(COPY); P.blur = prog(BLUR); P.dev = prog(DEV);
      vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); gl = null; T = {}; P = {}; BRC = {}; });
      cv.addEventListener('webglcontextrestored', function () { if (glInit() && img) { upload(); draw(); } });
      return true;
    } catch (x) { gl = null; return false; }
  }
  function tex(w, h, fmt, filter) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (fmt === 'f') gl.texImage2D(gl.TEXTURE_2D, 0, F16 ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, F16 ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    else if (fmt === 'r') gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, w, h, 0, gl.RED, gl.FLOAT, null);
    else if (fmt === 'rgb16') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    t.w = w; t.h = h; return t;
  }
  function target(t) { var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; }
  function pass(p, out, w, h, set) {
    var f = out ? target(out) : null; if (!out) gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(p); gl.viewport(0, 0, w, h); set(p); gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (f) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(f); }
  }
  function bind(p, n, unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(U(p, n), unit); }
  // THE PHOTO, UP: as big as the chip takes (the photo itself is kept as
  // it came, for saving), with its smaller copies; then the working copy
  // and its blurs (the highlights' own for halation), made once
  function upload() {
    ['src', 'wk', 'bm', 'bl', 'hl', 'lut'].forEach(function (k) { if (T[k]) gl.deleteTexture(T[k]); T[k] = null; });
    Object.keys(BRC).forEach(function (id) { if (BRC[id].tex) gl.deleteTexture(BRC[id].tex); }); BRC = {};
    var w = img.w, h = img.h, s = Math.min(1, maxTex / Math.max(w, h)), el = img.el;
    if (s < 1) { var c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s); c.getContext('2d').drawImage(el, 0, 0, c.width, c.height); el = c; }
    T.src = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, T.src);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, el);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    T.srcW = el.width; T.srcH = el.height; T.scale = s;
    // the working copy, about 1,024 across, and its blurs
    var q = Math.min(1, 1024 / Math.max(T.srcW, T.srcH)), ww = Math.max(1, Math.round(T.srcW * q)), wh = Math.max(1, Math.round(T.srcH * q)), lod = Math.max(0, Math.log2(1 / q));
    T.wk = tex(ww, wh, 'f');
    pass(P.copy, T.wk, ww, wh, function (p) { bind(p, 'u_in', 0, T.src); gl.uniform1f(U(p, 'u_lod'), lod); gl.uniform2f(U(p, 'u_size'), ww, wh); gl.uniform1i(U(p, 'u_lin'), 1); });
    T.bm = blurOf(T.wk, ww, wh, Math.max(ww, wh) * 0.012);
    var qw = Math.max(1, Math.round(ww / 4)), qh = Math.max(1, Math.round(wh / 4)), small = tex(qw, qh, 'f');
    pass(P.copy, small, qw, qh, function (p) { bind(p, 'u_in', 0, T.wk); gl.uniform1f(U(p, 'u_lod'), 0); gl.uniform2f(U(p, 'u_size'), qw, qh); gl.uniform1i(U(p, 'u_lin'), 0); });
    T.bl = blurOf(small, qw, qh, Math.max(qw, qh) * 0.05); gl.deleteTexture(small);
    var hl = tex(ww, wh, 'f');
    pass(P.copy, hl, ww, wh, function (p) { bind(p, 'u_in', 0, T.wk); gl.uniform1f(U(p, 'u_lod'), 0); gl.uniform2f(U(p, 'u_size'), ww, wh); gl.uniform1i(U(p, 'u_lin'), 2); });
    T.hl = blurOf(hl, ww, wh, Math.max(ww, wh) * 0.006); gl.deleteTexture(hl);
    T.lut = tex(1024, 1, 'rgb16'); T.lutKey = null;
  }
  // (a Gaussian blur, one way then the other)
  function blurOf(t, w, h, sig) {
    var a = tex(w, h, 'f'), b = tex(w, h, 'f');
    var run = function (inT, outT, dx, dy) { pass(P.blur, outT, w, h, function (p) { bind(p, 'u_in', 0, inT); gl.uniform2f(U(p, 'u_dir'), dx, dy); gl.uniform2f(U(p, 'u_size'), w, h); gl.uniform1f(U(p, 'u_sig'), Math.min(20, sig)); }); };
    run(t, a, 1, 0); run(a, b, 0, 1); gl.deleteTexture(a); return b;
  }
  // THE TONE TABLE: Paint's tone sums (shadows, highlights, whites, blacks,
  // contrast), then brightness, then the curve, 1,024 steps of it
  function toneTable(v) {
    var rgbC = v.plook && v.plook.rgb || null;
    var key = [v.contrast, v.highlights, v.shadows, v.whites, v.blacks, v.brightness, JSON.stringify(v.curve), JSON.stringify(v.pcurve || null), JSON.stringify(rgbC)].join('|');
    var tn = { sh: v.shadows / 100, hi: v.highlights / 100, wh: v.whites / 100, bl: v.blacks / 100, co: v.contrast / 100 }, br = v.brightness / 100;
    var cl = v.curve ? FX.curveLut(v.curve, 1024) : null, pl = v.pcurve ? FX.curveLut(v.pcurve, 1024) : null, o = new Float32Array(4096);
    var ch = ['r', 'g', 'b'].map(function (c) { return rgbC && rgbC[c] ? FX.curveLut(rgbC[c], 1024) : null; });
    var through = function (L, x) { var f = Math.max(0, Math.min(1, x)) * 1023, i0 = Math.min(1022, Math.floor(f)), t = f - i0; return (L[i0] * (1 - t) + L[i0 + 1] * t) / 255; };
    for (var i = 0; i < 1024; i++) {
      var x = FX.toneAt(i / 1023, tn);
      if (br) x = Math.pow(Math.max(0, Math.min(1, x)), Math.pow(2, -br * 0.9));
      if (cl) x = through(cl, x);
      if (pl) x = through(pl, x); // (the preset's curve, after the hand's)
      x = Math.max(0, Math.min(1, x));
      // (then a film's own curve for each channel: where its colours cross over)
      for (var c = 0; c < 3; c++) o[i * 4 + c] = ch[c] ? Math.max(0, Math.min(1, through(ch[c], x))) : x;
      o[i * 4 + 3] = 1;
    }
    return { key: key, data: o };
  }
  // DEVELOP: the settings as the pass's numbers. out: the size drawn
  // (w, h); o and s: where the photo's corner falls and how many of the
  // photo's widths a pixel is; lod: how far down its smaller copies to read
  // ---- GEOMETRY: the photo turned by quarters and flipped (the frame),
  // straightened (filled, so no corner shows), its perspective and its lens
  // put right, then cropped. Worked backwards for each pixel shown: from
  // its place in what the crop keeps to the photo's own (u_A, u_P, the
  // lens, u_B) ----
  function frameOf(v) { return (v.rot & 1) ? { w: img.h, h: img.w } : { w: img.w, h: img.h }; }
  function cropOf(v, full) { return full || !v.crop ? { x: 0, y: 0, w: 1, h: 1 } : v.crop; }
  function outSize(v, full) { var f = frameOf(v), c = cropOf(v, full); return { w: Math.max(1, Math.round(c.w * f.w)), h: Math.max(1, Math.round(c.h * f.h)) }; }
  function fillZoom(a, W, H) { a = Math.abs(a); var cs = Math.cos(a), sn = Math.sin(a); return Math.max((W * cs + H * sn) / W, (W * sn + H * cs) / H); }
  function geo(v, full) {
    var f = frameOf(v), c = cropOf(v, full), W = f.w, H = f.h, d = Math.hypot(W, H) / 2, a = v.angle * Math.PI / 180;
    var z = fillZoom(a, W, H) * v.scale / 100, cs = Math.cos(a), sn = Math.sin(a), k = 1 / (z * d);
    var ax = c.w * W, bx = c.x * W - W / 2, ay = c.h * H, by = c.y * H - H / 2;
    var A = [k * cs * ax, k * sn * ay, k * (cs * bx + sn * by), -k * sn * ax, k * cs * ay, k * (-sn * bx + cs * by), 0, 0, 1];
    var Pm = [1, 0, 0, 0, 1, 0, -v.horiz / 100 * 0.5, -v.vert / 100 * 0.5, 1];
    var iw = img.w, ih = img.h, fx = v.flipH ? -d : d, fy = v.flipV ? -d : d, r = v.rot & 3, Bm;
    if (r === 0) Bm = [fx / iw, 0, W / 2 / iw, 0, fy / ih, H / 2 / ih];
    else if (r === 1) Bm = [0, fy / iw, H / 2 / iw, -fx / ih, 0, (ih - W / 2) / ih];
    else if (r === 2) Bm = [-fx / iw, 0, (iw - W / 2) / iw, 0, -fy / ih, (ih - H / 2) / ih];
    else Bm = [0, -fy / iw, (iw - H / 2) / iw, fx / ih, 0, W / 2 / ih];
    Bm.push(0, 0, 1);
    return { A: A, P: Pm, B: Bm, k: -v.distort / 100 * 0.25, car: v.caR / 100 * 0.004, cab: v.caB / 100 * 0.004, lv: v.lensVig / 100, z: z, out: outSize(v, full) };
  }
  // (a 3 x 3 by rows, as the graphics chip takes it: by columns)
  function cm(m) { return new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]); }
  function develop(v, out, o, s, lod, neutral, full) {
    v = eff(v);
    var p = P.dev, tb = toneTable(v), G = geo(v, full);
    if (T.lutKey !== tb.key) { gl.bindTexture(gl.TEXTURE_2D, T.lut); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1024, 1, gl.RGBA, gl.FLOAT, tb.data); T.lutKey = tb.key; }
    var t = v.temp / 100, ti = v.tint / 100, kr = Math.pow(2, 0.8 * t + 0.15 * ti), kg = Math.pow(2, -0.6 * ti), kb = Math.pow(2, -0.8 * t + 0.15 * ti), ln = 0.2126 * kr + 0.7152 * kg + 0.0722 * kb;
    pass(p, out.tex || null, out.w, out.h, function (p) {
      bind(p, 'u_src', 0, T.src); bind(p, 'u_bm', 1, T.bm); bind(p, 'u_bl', 2, T.bl); bind(p, 'u_lut', 3, T.lut); bind(p, 'u_hl', 9, T.hl);
      var f1 = function (n, x) { gl.uniform1f(U(p, n), x); };
      gl.uniform2f(U(p, 'u_o'), o.x, o.y); gl.uniform2f(U(p, 'u_s'), s.x, s.y); gl.uniform2f(U(p, 'u_out'), out.w, out.h); gl.uniform2f(U(p, 'u_img'), G.out.w, G.out.h); gl.uniform2f(U(p, 'u_px'), img.w, img.h);
      gl.uniformMatrix3fv(U(p, 'u_A'), false, cm(G.A)); gl.uniformMatrix3fv(U(p, 'u_P'), false, cm(G.P)); gl.uniformMatrix3fv(U(p, 'u_B'), false, cm(G.B));
      f1('u_k', G.k); f1('u_car', G.car); f1('u_cab', G.cab); f1('u_lv', G.lv);
      maskUniforms(p, v, neutral);
      f1('u_lod', lod); gl.uniform1i(U(p, 'u_neutral'), neutral ? 1 : 0);
      gl.uniform3f(U(p, 'u_wb'), kr / ln, kg / ln, kb / ln); f1('u_ev', Math.pow(2, v.exposure * 0.05));
      f1('u_dh', v.dehaze / 100); f1('u_cl', v.clarity / 100); f1('u_tx', v.texture / 100);
      // (sharpening's radius: from half a pixel to three, as a step down the smaller copies)
      f1('u_sh', v.sharpen / 100); f1('u_sOff', Math.max(0.3, Math.log2(v.sRadius / 10 * 2))); f1('u_sDet', v.sDetail / 100); f1('u_sMask', v.sMask / 100);
      f1('u_nr', v.nr / 100); f1('u_nrc', v.nrColor / 100);
      f1('u_sat', 1 + v.saturation / 100); f1('u_vib', v.vibrance / 100);
      f1('u_vg', v.vignette / 100); f1('u_vgMid', v.vigMid / 100);
      // (grain's size in the photo's pixels: as on a frame 3,000 across, so the same part of any
      // photo; and how many of them a pixel drawn covers)
      var gs = (0.6 + v.grainSize / 100 * 3.4) * Math.max(img.w, img.h) / 3000, OF = outSize(v, full);
      f1('u_gr', v.grain / 100); f1('u_grSize', gs); f1('u_grRough', v.grainRough / 100); f1('u_grCol', v.grainCol / 100); f1('u_fp', Math.max(1e-3, s.x * OF.w / G.z));
      f1('u_hal', v.halation / 100);
      var lk = v.plook || null, M = lk && lk.mat, mw = lk && lk.mono;
      gl.uniform1i(U(p, 'u_mat'), M ? 1 : 0); if (M) gl.uniformMatrix3fv(U(p, 'u_M'), false, cm(M));
      gl.uniform1i(U(p, 'u_mono'), mw ? 1 : 0); if (mw) { var ms = mw[0] + mw[1] + mw[2]; gl.uniform3f(U(p, 'u_monoW'), mw[0] / ms, mw[1] / ms, mw[2] / ms); f1('u_monoA', lk.monoA != null ? lk.monoA : 1); }
      var hs = v.hsl, mixOn = !!hs && BANDS.some(function (b) { var q = hs[b[0]]; return q && (q[0] || q[1] || q[2]); });
      gl.uniform1i(U(p, 'u_mix'), mixOn ? 1 : 0);
      var hv = new Float32Array(24), hc = new Float32Array(8);
      BANDS.forEach(function (b, i) { var q = (hs && hs[b[0]]) || [0, 0, 0]; hv[i * 3] = q[0] / 100; hv[i * 3 + 1] = q[1] / 100; hv[i * 3 + 2] = q[2] / 100; hc[i] = b[2] / 360; });
      gl.uniform3fv(U(p, 'u_hsl'), hv); gl.uniform1fv(U(p, 'u_hc'), hc);
      var g = v.grade, gOn = !!g && GRADES.some(function (q) { return g[q[0]] && (g[q[0]][1] || g[q[0]][2]); });
      gl.uniform1i(U(p, 'u_grade'), gOn ? 1 : 0);
      var gv = function (n, k) { var q = (g && g[k]) || [0, 0, 0]; gl.uniform3f(U(p, n), q[0], q[1], q[2]); };
      gv('u_gS', 'sh'); gv('u_gM', 'mid'); gv('u_gH', 'hi'); gv('u_gA', 'all');
      f1('u_gBlend', g ? (g.blend != null ? g.blend : 50) / 100 : 0.5); f1('u_gBal', g ? (g.bal || 0) / 100 : 0);
    });
  }

  // ---- ON THE SCREEN: only what's in view is worked out, at the screen's
  // own detail; while a slider moves, at half of it (quick, a touch soft),
  // then sharp again as soon as it's let go of ----
  var raf = 0, quick = false;
  function draw() { if (!raf) raf = requestAnimationFrame(drawNow); amtSync(); }
  // (the bottom bar's one slider: how much of the preset in use, greyed out
  // with none; a drag is one step, or part of trying presets while they're
  // being tried, so Cancel and Done take it with them)
  function amtSync() {
    if (!amtEl) return;
    var q = doc && doc.v.preset && presetOf(doc.v.preset), i = amtEl.querySelector('input'), n = q ? Math.round(amtOf(doc.v) * 100) : 100;
    amtEl.classList.toggle('off', !q); i.disabled = !q;
    if (+i.value !== n) i.value = n;
    var t = n + '%', o = amtEl.querySelector('output'), nm = amtEl.querySelector('.pho-amount-name'), name = q ? q.name : 'No preset';
    if (o.textContent !== t) o.textContent = t; if (nm.textContent !== name) nm.textContent = name;
  }
  function amtInput(e) {
    if (!on || !doc || !doc.v.preset) return;
    if (!amtDrag) { if (!presetPick) record('Preset Amount'); amtDrag = true; }
    quick = true; doc.v.pamt = Math.max(0, Math.min(100, Math.round(+e.target.value))); if (cat === 'edit') marks(); draw();
  }
  function amtChange() { if (!amtDrag) return; amtDrag = false; quick = false; draw(); if (cat === 'edit') panelSync(); histButtons(); B.autosave(); }
  function drawNow() {
    raf = 0;
    if (!on || !gl || !img || !T.src) return;
    var dpr = window.devicePixelRatio || 1, q = quick ? 0.5 : 1, W = stageEl.clientWidth, H = stageEl.clientHeight;
    var cw = Math.max(1, Math.round(W * dpr * q)), ch = Math.max(1, Math.round(H * dpr * q));
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    var sc = dpr * q, kk = view.k * sc; // (screen pixels a photo pixel)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cw, ch); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    var F = outSize(doc.v, cropping), z = geo(doc.v, cropping).z;
    onScreen = true;
    develop(doc.v, { w: cw, h: ch }, { x: view.x * sc, y: view.y * sc }, { x: 1 / (kk * F.w), y: 1 / (kk * F.h) }, Math.max(0, Math.log2(T.srcW / img.w / kk / z)), before, cropping);
    onScreen = false;
    stageEl.classList.toggle('pho-before', before); cropSync(); mSync();
  }

  // ---- THE VIEW: fitted with the dotted well's margin all round, zoomed
  // about a point, moved by a drag or two fingers ----
  // (the room the photo is fitted into: all of the stage, but on a phone
  // what's under the panel's strip along its top)
  function free() {
    var W = stageEl.clientWidth, H = stageEl.clientHeight, top = 0, pan = B.ctxTool.closest('.paint-ctx');
    if (pan && window.matchMedia('(max-width: 560px)').matches && !pan.hidden && !pan.classList.contains('min') && pan.offsetParent) {
      var r = pan.getBoundingClientRect(), sr = stageEl.getBoundingClientRect(); top = Math.max(0, Math.min(H * 0.6, r.bottom - sr.top));
    }
    var h = H - top, m = Math.min(28, Math.max(8, Math.min(W, h) * 0.04));
    var F = outSize(doc.v, cropping);
    return { W: W, H: h, top: top, m: m, k: Math.min((W - 2 * m) / F.w, (h - 2 * m) / F.h), F: F };
  }
  function fit() {
    if (!img) return;
    var f = free();
    view.k = f.k; view.x = (f.W - f.F.w * view.k) / 2; view.y = f.top + (f.H - f.F.h * view.k) / 2; view.fit = true;
    zoomShow(); draw();
  }
  function fitK() { return free().k; }
  function zoomAt(k, sx, sy) {
    if (!img) return;
    k = Math.max(fitK() * 0.25, Math.min(32, k));
    view.x = sx - (sx - view.x) * k / view.k; view.y = sy - (sy - view.y) * k / view.k; view.k = k; view.fit = false;
    zoomShow(); draw();
  }
  function zoomStep(d) { zoomAt(view.k * (d > 0 ? 1.25 : 0.8), stageEl.clientWidth / 2, stageEl.clientHeight / 2); }
  function zoomShow() { if (B && B.zoomVal && img) B.zoomVal.textContent = Math.round(view.k * 100) + '%'; }
  function relayout() { if (!on || !img) return; if (view.fit) fit(); else draw(); }

  // ---- THE POINTER: a drag moves the photo (two fingers move and zoom);
  // pressed and held still, the photo shows as it came, until let go ----
  var pts = {}, press = null, pinch = null, holdT = 0;
  function local(e) { var r = stageEl.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function onPhoto(p) { if (!img) return false; var F = outSize(doc.v, cropping); return p.x >= view.x && p.y >= view.y && p.x <= view.x + F.w * view.k && p.y <= view.y + F.h * view.k; }
  function down(e) {
    e.stopPropagation(); // (the painting's own handlers, round the stage, never see Photo's presses)
    if (!img || (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1)) return;
    e.preventDefault(); try { stageEl.setPointerCapture(e.pointerId); } catch (x) {}
    pts[e.pointerId] = local(e);
    var ids = Object.keys(pts);
    if (ids.length === 2) {
      clearTimeout(holdT); setBefore(false); if (cdrag && cdrag.rec) { cropUp(); } cdrag = null; if (mdrag) maskUp();
      var a = pts[ids[0]], b = pts[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, vx: view.x, vy: view.y }; press = null; return;
    }
    var p = pts[e.pointerId];
    if (cropping && cropDown(p, e.pointerType !== 'mouse')) { press = null; return; }
    if (cat === 'masks' && maskDown(p, e)) { press = null; return; }
    press = { x: p.x, y: p.y, vx: view.x, vy: view.y, moved: false };
    clearTimeout(holdT);
    if (!cropping && cat !== 'masks' && onPhoto(p) && e.button === 0) holdT = setTimeout(function () { if (press && !press.moved) setBefore(true); }, 180);
  }
  function move(e) {
    e.stopPropagation();
    if (!pts[e.pointerId]) { if (cat === 'masks') maskHover(local(e)); return; }
    pts[e.pointerId] = local(e);
    var ids = Object.keys(pts);
    if (cdrag && ids.length === 1) { cropMove(pts[e.pointerId]); return; }
    if (mdrag && ids.length === 1) { maskMove(pts[e.pointerId]); return; }
    if (pinch && ids.length === 2) {
      var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var k = Math.max(fitK() * 0.25, Math.min(32, pinch.k * d / Math.max(1, pinch.d)));
      view.x = mx - (pinch.mx - pinch.vx) * k / pinch.k; view.y = my - (pinch.my - pinch.vy) * k / pinch.k; view.k = k; view.fit = false; zoomShow(); draw(); return;
    }
    if (!press) return;
    var p = pts[e.pointerId];
    if (!press.moved && Math.hypot(p.x - press.x, p.y - press.y) > 6 && !before) { press.moved = true; clearTimeout(holdT); stageEl.classList.add('pho-moving'); }
    if (press.moved) { view.x = press.vx + p.x - press.x; view.y = press.vy + p.y - press.y; view.fit = false; draw(); }
  }
  function up(e) {
    e.stopPropagation();
    delete pts[e.pointerId];
    if (Object.keys(pts).length < 2) pinch = null;
    if (!Object.keys(pts).length) { clearTimeout(holdT); press = null; setBefore(false); stageEl.classList.remove('pho-moving'); cropUp(); maskUp(); }
  }
  function wheel(e) {
    e.stopPropagation();
    if (!img) return;
    e.preventDefault();
    var p = local(e);
    if (e.ctrlKey || e.metaKey) zoomAt(view.k * Math.pow(2, -e.deltaY * (e.deltaMode ? 0.05 : 0.002)), p.x, p.y);
    else { view.x -= e.deltaX; view.y -= e.deltaY; view.fit = false; draw(); }
  }
  function setBefore(b) { if (before === b) return; before = b; draw(); }

  // ---- UNDO: each step the settings as they were (and the photo, when
  // it changed); a slider's whole drag is one step ----
  function snap() { return { v: copyV(doc.v), img: img, doc: { name: doc.name, w: doc.w, h: doc.h, type: doc.type, blob: doc.blob } }; }
  function record(label) { if (!doc) return; hist.push({ s: snap(), label: label }); if (hist.length > 200) hist.shift(); fut = []; histButtons(); }
  function putBack(s) {
    var srcChanged = s.img !== img;
    doc.v = copyV(s.v); doc.name = s.doc.name; doc.w = s.doc.w; doc.h = s.doc.h; doc.type = s.doc.type; doc.blob = s.doc.blob; img = s.img;
    if (srcChanged) { rev++; thumbs = {}; if (img && gl) upload(); if (img) fit(); emptySync(); }
    presetBase = null; presetPick = null; changed(true);
  }
  function undo() { if (!hist.length) return; var e = hist.pop(); fut.push({ s: snap(), label: e.label }); putBack(e.s); B.toast('Undid ' + e.label); }
  function redo() { if (!fut.length) return; var e = fut.pop(); hist.push({ s: snap(), label: e.label }); putBack(e.s); B.toast('Redid ' + e.label); }
  function histButtons() {
    if (!B) return; B.undoBtn.disabled = !hist.length; B.redoBtn.disabled = !fut.length;
    if (histEl) { histEl.querySelector('[data-pact="undo"]').disabled = !hist.length; histEl.querySelector('[data-pact="redo"]').disabled = !fut.length; }
  }
  // (something changed: drawn again, the panel brought up to date, kept)
  function changed(panel) { draw(); if (panel) panelRefresh(); else marks(); histButtons(); B.autosave(); }

  // ---- THE PHOTO COMES IN: from a file (Open, a drop, a paste) or from
  // another workspace; anything a browser can show natively is decoded
  // here; RAW files and TIFF are worked by their own decoders ----
  var RAW_EXT = /\.(dng|cr2|cr3|nef|nrw|arw|srf|sr2|raf|orf|rw2|pef|srw|3fr|iiq|erf|kdc|dcr|mos|x3f)$/i;
  function kindOf(file) {
    var n = (file.name || '').toLowerCase(), t = (file.type || '').toLowerCase();
    if (RAW_EXT.test(n) || /image\/x-(adobe-dng|canon|nikon|sony|fuji)/.test(t)) return 'raw';
    if (/\.tiff?$/.test(n) || t === 'image/tiff') return 'tiff';
    if (/\.(heic|heif)$/.test(n) || /image\/hei[cf]/.test(t)) return 'heic';
    return 'image';
  }
  function decode(blob) {
    // (the browser's own decoder, the photo turned as its EXIF says)
    if (window.createImageBitmap) return createImageBitmap(blob, { imageOrientation: 'from-image' }).catch(function () { return viaImg(blob); });
    return viaImg(blob);
  }
  function viaImg(blob) {
    return new Promise(function (ok, no) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () { URL.revokeObjectURL(u); ok(im); }; im.onerror = function () { URL.revokeObjectURL(u); no(new Error('decode')); }; im.src = u;
    });
  }
  function openFile(file, name) {
    var kind = kindOf(file);
    if (kind === 'raw' && B.decoders && B.decoders.raw) B.toast('Developing the RAW file…'); // (a big one takes a few seconds)
    if (kind === 'heic' && B.decoders && B.decoders.heic) return B.decoders.heic(file).then(function (r) { take(r.el, { name: name || file.name, type: 'image/heic', blob: file, w: r.w, h: r.h }); }, function (x) { B.toast(x && x.message || 'That HEIC photo couldn’t be opened'); });
    if (kind === 'raw' && B.decoders && B.decoders.raw) return B.decoders.raw(file).then(function (r) { take(r.el, { name: name || file.name, type: 'raw', blob: file, w: r.w, h: r.h, meta: r.meta }); }, function (x) { B.toast(x && x.message || 'That RAW file couldn’t be opened'); });
    if (kind === 'raw') { B.toast('RAW files (' + (file.name.split('.').pop() || '').toUpperCase() + ') can’t be opened in this version yet'); return Promise.resolve(); }
    if (kind === 'tiff' && B.decoders && B.decoders.tiff) return B.decoders.tiff(file).then(function (r) { take(r.el, { name: name || file.name, type: 'tiff', blob: file, w: r.w, h: r.h }); }, function () { B.toast('That TIFF couldn’t be opened'); });
    return decode(file).then(function (el) {
      take(el, { name: name || file.name || 'Photo', type: file.type || 'image', blob: file, w: el.width || el.naturalWidth, h: el.height || el.naturalHeight });
    }, function () { B.toast(kind === 'heic' ? 'This browser can’t open HEIC photos (Safari can)' : kind === 'tiff' ? 'This browser can’t open TIFF files' : 'That file couldn’t be opened as a photo'); });
  }
  // (a picture from another workspace: kept as a PNG, so it saves like any photo)
  function takeCanvas(c, name) {
    return new Promise(function (ok) { c.toBlob(function (b) { take(c, { name: name, type: 'image/png', blob: b, w: c.width, h: c.height }); ok(); }, 'image/png'); });
  }
  function take(el, d) {
    if (!doc) doc = { v: fresh() };
    record('Open Photo');
    doc.name = d.name; doc.type = d.type; doc.blob = d.blob; doc.w = d.w; doc.h = d.h; doc.meta = d.meta || null;
    doc.v = fresh(); // (a new photo starts from nothing set)
    img = { el: el, w: d.w, h: d.h }; rev++; thumbs = {}; presetBase = null; presetPick = null; cropping = cat === 'crop';
    if (gl || glInit()) upload();
    emptySync(); if (on) { fit(); panelRefresh(); }
    histButtons(); B.autosave();
  }

  // ---- THE PANEL: the left bar's categories (Edit, Presets), each
  // filling the tool settings panel; Edit's sections fold like Effects' ----
  var CATS = [['edit', 'Edit', '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'],
    ['crop', 'Crop & Straighten', '<path d="M7 3v12a2 2 0 0 0 2 2h12"/><path d="M3 7h12a2 2 0 0 1 2 2v12"/>'],
    ['masks', 'Masks', '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M12 8h6M12 12h8M12 16h6"/>'],
    ['presets', 'Presets', '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>']];
  var CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9.5l5 5 5-5"/></svg>'; // (Paint's one chevron, .chev)
  var RESET = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M5 4.5v3.8h3.8"/></svg>';
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function slider(k, name, lo, hi, cls, step) {
    lo = lo == null ? -100 : lo; hi = hi == null ? 100 : hi;
    return '<label class="pa-row" data-pk-row="' + k + '"><span>' + name + '</span><output>0</output>' +
      '<input type="range" min="' + lo + '" max="' + hi + '" step="' + (step || 1) + '" value="0" data-pk="' + k + '" aria-label="' + esc(name) + '"' + (cls ? ' class="' + cls + '"' : '') + '></label>';
  }
  function section(id, name, body) {
    var was = null; try { was = localStorage.getItem('paint-pho-' + id); } catch (x) {}
    var shut = was ? was === 'closed' : id !== 'light';
    return '<section class="pr-sec fx-sec' + (shut ? ' closed' : '') + '" data-psec="' + id + '"><div class="fx-head">' +
      '<button type="button" class="pr-head" aria-expanded="' + !shut + '"><span>' + name + '<i class="fx-dot" aria-hidden="true"></i></span>' + CHEV + '</button>' +
      '<button type="button" class="fx-reset" data-preset-sec="' + id + '" aria-label="Reset ' + name + '" data-tip="Put ' + name + ' back as it was">' + RESET + '</button></div>' +
      '<div class="pr-body"><div class="pr-in">' + body + '</div></div></section>';
  }
  function panelHTML() {
    if (!doc || !img) return '<div class="ctx-hint pho-hint">Open a photo to edit it: JPEG, PNG, WebP or HEIC.</div><button type="button" class="ctx-btn" data-pa="open">' + CI('<path d="M4 7.5V18a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18V9.5A1.5 1.5 0 0 0 18.5 8H12l-2-2.5H5.5A1.5 1.5 0 0 0 4 7v.5z"/>') + '<span>Open Photo</span></button>';
    if (cat === 'presets') return presetsHTML();
    if (cat === 'crop') return cropHTML();
    if (cat === 'masks') return masksHTML();
    return '<div class="pho-edit">' + SECS.map(function (S) {
      var body = '<div class="pa-list">' + S.rows.map(function (r) { return slider(r[0], r[1], r[2], r[3], { temp: 'fx-track pho-temp', tint: 'fx-track pho-tint' }[r[0]]); }).join('') + '</div>';
      if (S.curve) body += '<div class="pho-sub">Tone curve</div><div class="pa-curves pho-curve"><canvas class="cv-graph" aria-label="Tone curve"></canvas><div class="cv-help">Tap the line to add a point, drag to bend it. Double-tap a point to remove it.</div></div>';
      if (S.mixer) body += '<div class="pho-sub">Colour mixer</div><div class="pho-bands" role="radiogroup" aria-label="Colour">' + BANDS.map(function (b) { return '<button type="button" role="radio" data-band="' + b[0] + '" aria-checked="false" aria-label="' + b[1] + '" data-tip="' + b[1] + '" style="--c:' + b[3] + '"></button>'; }).join('') + '</div>' +
        '<div class="pa-list">' + slider('mxH', 'Hue') + slider('mxS', 'Saturation') + slider('mxL', 'Luminance') + '</div>';
      if (S.grading) body += '<div class="pho-sub">Colour grading</div><div class="pa-tabs pho-gtabs" role="tablist" aria-label="Colour grading">' + GRADES.map(function (g) { return '<button type="button" role="tab" data-grade="' + g[0] + '" aria-selected="false">' + g[1] + '</button>'; }).join('') + '</div>' +
        '<div class="pa-list">' + slider('gH', 'Hue', 0, 360, 'fx-track pho-hue') + slider('gS', 'Saturation', 0, 100) + slider('gL', 'Luminance') + slider('gBlend', 'Blending', 0, 100) + slider('gBal', 'Balance') + '</div>';
      return section(S.id, S.name, body);
    }).join('') + '</div><div class="pa-acts pho-acts"><button type="button" data-pa="reset">Reset All</button></div>';
  }
  function CI(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; }
  // ---- MASKS (local adjustments): up to four, each a part of the photo
  // with settings of its own (exposure, contrast, highlights, shadows,
  // temperature, tint, saturation, clarity) on top of the rest. Linear (full
  // before its first line, fading to none at its last), radial (inside an
  // ellipse, softened by its feather) or painted with a brush. Their shapes
  // are in the photo's own units (q: across the long side 0 to 1), so they
  // stay on what they cover through a crop, a turn or a straightening; the
  // brush's strokes are kept as points and painted again when needed ----
  var mSlide = false, mPick = null, mFresh = null, mdrag = null, mHover = null, muiEl = null, onScreen = false, BRC = {};
  var mOver = (function () { try { return localStorage.getItem('paint-pho-overlay') !== '0'; } catch (e) { return true; } })();
  var BRS = (function () { var d = { size: 12, feather: 50, flow: 60, erase: false }; try { var q = JSON.parse(localStorage.getItem('paint-pho-brush') || 'null'); if (q) for (var k in d) if (typeof q[k] === typeof d[k]) d[k] = q[k]; } catch (e) {} return d; })();
  var MADJ = [['ex', 'Exposure'], ['co', 'Contrast'], ['hi', 'Highlights'], ['sh', 'Shadows'], ['te', 'Temperature'], ['ti', 'Tint'], ['sa', 'Saturation'], ['cl', 'Clarity']];
  var MKINDS = { brush: ['Brush', '<path d="M14.5 4.5l5 5L10 19H5v-5z"/><path d="M12.5 6.5l5 5"/>'], linear: ['Linear', '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M4 14h16" stroke-dasharray="2 2.5"/>'], radial: ['Radial', '<ellipse cx="12" cy="12" rx="8" ry="6"/><ellipse cx="12" cy="12" rx="4" ry="3" stroke-dasharray="2 2"/>'] };
  var MICON = { inv: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>', eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>', del: '<path d="M6 6l12 12M18 6L6 18"/>' };
  function pickedMask() { var ms = doc && doc.v.masks; if (!ms) return null; for (var i = 0; i < ms.length; i++) if (ms[i].id === mPick) return ms[i]; return null; }
  function aspQ() { var L = Math.max(img.w, img.h); return { x: img.w / L, y: img.h / L }; }
  function maskList(v) { return (v.masks || []).filter(function (m) { return m.on; }).slice(0, 4); }
  function dummyTex() { if (!T.dummy) { T.dummy = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, T.dummy); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); } return T.dummy; }
  function maskUniforms(p, v, neutral) {
    var ms = maskList(v), mk = new Int32Array(4), mg = new Float32Array(16), mh = new Float32Array(16), ma = new Float32Array(16), mb = new Float32Array(16), shw = -1, aq = aspQ();
    ms.forEach(function (m, i) {
      var g = m.g, a = m.a, inv = m.inv ? 1 : 0;
      if (m.kind === 'linear') { mk[i] = 1; mg.set([g.x0, g.y0, g.x1, g.y1], i * 4); mh.set([0, 0, 0, inv], i * 4); }
      else if (m.kind === 'radial') { mk[i] = 2; mg.set([g.cx, g.cy, g.rx, g.ry], i * 4); mh.set([g.ang, g.fe / 100, 0, inv], i * 4); }
      else { mk[i] = 3; mh.set([0, 0, 0, inv], i * 4); }
      ma.set([a.ex / 100 * 4, a.co / 100, a.hi / 100, a.sh / 100], i * 4); mb.set([a.te / 100, a.ti / 100, a.sa / 100, a.cl / 100], i * 4);
      if (onScreen && cat === 'masks' && m.id === mPick && mOver && !mSlide) shw = i;
    });
    // (the brush's paint is made and sent up on a unit nothing reads, unit 8,
    // before any is bound: binding it on the unit in use would put it in the
    // place of the tone table, and the whole photo would come out black)
    gl.activeTexture(gl.TEXTURE8);
    var tx = []; for (var j = 0; j < 4; j++) tx[j] = ms[j] && ms[j].kind === 'brush' ? brushTex(ms[j]) : dummyTex();
    for (var i = 0; i < 4; i++) bind(p, 'u_br' + i, 4 + i, tx[i]);
    gl.uniform1i(U(p, 'u_nm'), neutral ? 0 : ms.length); gl.uniform1i(U(p, 'u_show'), shw);
    gl.uniform1iv(U(p, 'u_mk'), mk); gl.uniform4fv(U(p, 'u_mg'), mg); gl.uniform4fv(U(p, 'u_mh'), mh); gl.uniform4fv(U(p, 'u_ma'), ma); gl.uniform4fv(U(p, 'u_mb'), mb);
    gl.uniform2f(U(p, 'u_asp'), aq.x, aq.y);
  }
  // THE BRUSH'S PAINT: a canvas 1,024 across the photo's long side for each
  // brush mask (its alpha the mask), made again from the strokes when they
  // change other than by being painted just now
  var BR_L = 1024;
  function brushKey(m) { var st = m.g.st, l = st[st.length - 1]; return st.length + ':' + (l ? l.p.length : 0) + ':' + rev; }
  function brushTex(m) {
    var aq = aspQ(), W = Math.max(1, Math.round(BR_L * aq.x)), H = Math.max(1, Math.round(BR_L * aq.y)), b = BRC[m.id];
    if (!b || b.cv.width !== W || b.cv.height !== H) { b = BRC[m.id] = { cv: document.createElement('canvas'), key: null, tex: null, dirty: true }; b.cv.width = W; b.cv.height = H; }
    var key = brushKey(m);
    if (b.key !== key) { brushRedraw(b, m); b.key = key; b.dirty = true; }
    if (!b.tex) { b.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, b.tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); b.dirty = true; }
    if (b.dirty) { gl.bindTexture(gl.TEXTURE_2D, b.tex); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, b.cv); b.dirty = false; }
    return b.tex;
  }
  function brushRedraw(b, m) {
    var x = b.cv.getContext('2d'); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, b.cv.width, b.cv.height);
    m.g.st.forEach(function (st) { var c = 0; for (var i = 0; i + 1 < st.p.length; i += 2) c = stampSeg(x, st, i ? st.p[i - 2] : st.p[0], i ? st.p[i - 1] : st.p[1], st.p[i], st.p[i + 1], i ? c : -1); });
  }
  // (soft round dabs a quarter of their size apart from one point to the next;
  // carry: how far along the next dab is, -1 for a stroke's first point)
  function stampSeg(x, st, x0, y0, x1, y1, carry) {
    var R = Math.max(0.75, st.s * BR_L / 2), step = Math.max(0.5, R * 0.25), ax = x0 * BR_L, ay = y0 * BR_L, bx = x1 * BR_L, by = y1 * BR_L, d = Math.hypot(bx - ax, by - ay);
    x.globalCompositeOperation = st.er ? 'destination-out' : 'source-over';
    var dab = function (px, py) { var g = x.createRadialGradient(px, py, R * (1 - st.f) * 0.999, px, py, R); g.addColorStop(0, 'rgba(0,0,0,' + st.fl + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, R, 0, Math.PI * 2); x.fill(); };
    if (carry < 0) { dab(ax, ay); carry = 0; }
    var t = step - carry;
    while (t <= d) { dab(ax + (bx - ax) * t / Math.max(d, 1e-6), ay + (by - ay) * t / Math.max(d, 1e-6)); t += step; }
    return d - (t - step);
  }
  // FROM THE SCREEN TO THE PHOTO AND BACK, through the same geometry as the
  // graphics chip's (geo): a point on the stage to the photo's own place
  // (0 to 1 each way), and back
  function mul3(m, v) { return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; }
  function inv3(m) {
    var a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5], g = m[6], h = m[7], i = m[8], A = e * i - f * h, Bq = -(d * i - f * g), C = d * h - e * g, det = a * A + b * Bq + c * C;
    if (Math.abs(det) < 1e-12) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, Bq / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
  }
  function toSrc(p) {
    var G = geo(doc.v, cropping), F = G.out, ou = [(p.x - view.x) / (view.k * F.w), (p.y - view.y) / (view.k * F.h), 1];
    var h = mul3(G.P, mul3(G.A, ou)), n = [h[0] / h[2], h[1] / h[2]], s = 1 + G.k * (n[0] * n[0] + n[1] * n[1]), u = mul3(G.B, [n[0] * s, n[1] * s, 1]);
    return { x: u[0], y: u[1] };
  }
  function toScr(u) {
    var G = geo(doc.v, cropping), F = G.out, nl = mul3(inv3(G.B), [u.x, u.y, 1]), n = [nl[0], nl[1]];
    for (var i = 0; i < 6; i++) { var s = 1 + G.k * (n[0] * n[0] + n[1] * n[1]); n = [nl[0] / s, nl[1] / s]; }
    var m = mul3(inv3(G.P), [n[0], n[1], 1]), ou = mul3(inv3(G.A), [m[0] / m[2], m[1] / m[2], 1]);
    return { x: view.x + ou[0] * view.k * F.w, y: view.y + ou[1] * view.k * F.h };
  }
  function toQ(p) { var u = toSrc(p), a = aspQ(); return { x: u.x * a.x, y: u.y * a.y }; }
  function qScr(x, y) { var a = aspQ(); return toScr({ x: x / a.x, y: y / a.y }); }
  // (the handles a press can take hold of, on the screen)
  function mHandles(m) {
    var g = m.g, out = [];
    if (m.kind === 'linear') { var a = qScr(g.x0, g.y0), b = qScr(g.x1, g.y1); out.push(['l0', a], ['l1', b], ['lmove', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }]); }
    else if (m.kind === 'radial') { var ca = Math.cos(g.ang), sa = Math.sin(g.ang); out.push(['rx', qScr(g.cx + g.rx * ca, g.cy + g.rx * sa)], ['rx', qScr(g.cx - g.rx * ca, g.cy - g.rx * sa)], ['ry', qScr(g.cx - g.ry * sa, g.cy + g.ry * ca)], ['ry', qScr(g.cx + g.ry * sa, g.cy - g.ry * ca)], ['rc', qScr(g.cx, g.cy)]); }
    return out;
  }
  function maskDown(p, e) {
    if (!img || !doc) return false;
    var pin = null, PR = e.pointerType === 'mouse' ? 10 : 18;
    (doc.v.masks || []).forEach(function (q) { if (q.id === mPick || !q.on) return; var c = pinOf(q); if (c && Math.hypot(c.x - p.x, c.y - p.y) < PR) pin = q; });
    if (pin) { mPick = pin.id; mFresh = null; mHover = null; changed(true); return true; }
    var m = pickedMask(); if (!m) return false;
    if (m.kind === 'brush') {
      record('Brush');
      var q = toQ(p), st = { s: BRS.size / 100, f: BRS.feather / 100, fl: BRS.flow / 100, er: BRS.erase || !!e.altKey, p: [rq(q.x), rq(q.y)] };
      m.g.st.push(st); mdrag = { kind: 'brush', m: m, st: st, carry: -1, touch: e.pointerType === 'touch' }; mHover = p; brushPaint(st, st.p[0], st.p[1], st.p[0], st.p[1]); draw(); return true;
    }
    var R = e.pointerType === 'mouse' ? 12 : 22, hit = null;
    if (mFresh === m.id) { mdrag = { kind: 'draw', m: m, p0: p, q0: toQ(p), g0: copyV(m.g), rec: false }; return true; } // (a new one: the first drag draws it)
    mHandles(m).forEach(function (h) { if (!hit && Math.hypot(h[1].x - p.x, h[1].y - p.y) < R) hit = h[0]; });
    if (!hit && m.kind === 'radial') { var q2 = toQ(p), g = m.g, dx = q2.x - g.cx, dy = q2.y - g.cy, c = Math.cos(g.ang), sn = Math.sin(g.ang), ex = (c * dx + sn * dy) / g.rx, ey = (-sn * dx + c * dy) / g.ry; if (ex * ex + ey * ey < 1 && mFresh !== m.id) hit = 'rc'; }
    if (!hit && mFresh !== m.id) return false;
    mdrag = { kind: hit || 'draw', m: m, p0: p, q0: toQ(p), g0: copyV(m.g), rec: false };
    return true;
  }
  function rq(x) { return Math.round(x * 1e4) / 1e4; }
  function brushPaint(st, x0, y0, x1, y1) {
    var m = mdrag.m, b = BRC[m.id]; if (!b) return; // (its canvas comes with the first draw)
    mdrag.carry = stampSeg(b.cv.getContext('2d'), st, x0, y0, x1, y1, mdrag.carry); b.key = brushKey(m); b.dirty = true;
  }
  function maskMove(p) {
    var d = mdrag, m = d.m, g = m.g, q = toQ(p);
    if (d.kind === 'brush') { var st = d.st, n = st.p.length, lx = st.p[n - 2], ly = st.p[n - 1]; if (Math.hypot(q.x - lx, q.y - ly) * BR_L < 0.75) return; st.p.push(rq(q.x), rq(q.y)); if (!BRC[m.id]) draw(); brushPaint(st, lx, ly, rq(q.x), rq(q.y)); draw(); mHover = p; mSync(); return; }
    if (!d.rec) { if (Math.hypot(p.x - d.p0.x, p.y - d.p0.y) < 3) return; record('Mask'); d.rec = true; }
    var g0 = d.g0, dx = q.x - d.q0.x, dy = q.y - d.q0.y;
    if (d.kind === 'draw') {
      if (m.kind === 'linear') { g.x0 = d.q0.x; g.y0 = d.q0.y; g.x1 = q.x; g.y1 = q.y; }
      else { g.cx = d.q0.x; g.cy = d.q0.y; g.rx = g.ry = Math.max(0.005, Math.hypot(dx, dy)); g.ang = 0; }
    } else if (d.kind === 'l0') { g.x0 = q.x; g.y0 = q.y; }
    else if (d.kind === 'l1') { g.x1 = q.x; g.y1 = q.y; }
    else if (d.kind === 'lmove') { g.x0 = g0.x0 + dx; g.y0 = g0.y0 + dy; g.x1 = g0.x1 + dx; g.y1 = g0.y1 + dy; }
    else if (d.kind === 'rc') { g.cx = g0.cx + dx; g.cy = g0.cy + dy; }
    else { var c = Math.cos(g.ang), sn = Math.sin(g.ang), ox = q.x - g.cx, oy = q.y - g.cy; if (d.kind === 'rx') g.rx = Math.max(0.005, Math.abs(c * ox + sn * oy)); else g.ry = Math.max(0.005, Math.abs(-sn * ox + c * oy)); }
    draw(); // (at full detail: only the sliders work at half)
  }
  function maskUp() {
    var d = mdrag; mdrag = null; if (!d) return;
    if (d.kind === 'brush' || d.rec) { if (d.kind === 'draw') mFresh = null; draw(); B.autosave(); histButtons(); thumbsSoon(); }
    else draw();
    if (d.kind === 'brush' && d.touch) { mHover = null; mSync(); } // (a finger leaves no circle behind; a mouse or a hovering Pencil keeps it)
  }
  function maskHover(p) { var m = pickedMask(); var was = mHover; mHover = m && m.kind === 'brush' ? p : null; if (was || mHover) mSync(); }
  // (the brush's size slider: Paint's own preview, in the middle of the
  // picture, the size it really paints at this zoom, feather and all)
  var peekHeld = false;
  function brushPeek(held) {
    if (!B.discPreview) return;
    if (!held) { if (peekHeld) B.discPreview(null); peekHeld = false; return; }
    peekHeld = true;
    var c = qScr(aspQ().x / 2, aspQ().y / 2), e = qScr(aspQ().x / 2 + BRS.size / 100, aspQ().y / 2);
    B.discPreview({ d: Math.hypot(e.x - c.x, e.y - c.y), feather: BRS.feather / 100, flow: BRS.flow / 100, erase: BRS.erase });
  }
  // (where each mask's pin goes: what a press there picks)
  function pinOf(m) {
    var g = m.g;
    if (m.kind === 'linear') return qScr((g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2);
    if (m.kind === 'radial') return qScr(g.cx, g.cy);
    var n = 0, x = 0, y = 0; g.st.forEach(function (st) { if (st.er) return; for (var i = 0; i < st.p.length; i += 2) { x += st.p[i]; y += st.p[i + 1]; n++; } });
    return n ? qScr(x / n, y / n) : null;
  }
  // ON THE SCREEN: the picked mask's lines and handles, or the brush's circle
  function mSync() {
    if (!muiEl) return;
    var m = on && img && cat === 'masks' && !before ? pickedMask() : null, h = '';
    // (the other masks' pins: a tap on one picks it)
    if (on && img && cat === 'masks' && !before) (doc.v.masks || []).forEach(function (q) { if (q.id === mPick || !q.on) return; var c = pinOf(q); if (c) h += '<circle class="pin" cx="' + c.x + '" cy="' + c.y + '" r="6"/>'; });
    if (m && m.kind === 'linear') {
      var g = m.g, a = qScr(g.x0, g.y0), b = qScr(g.x1, g.y1), dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, px = -dy / l * 3000, py = dx / l * 3000, mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      [a, mid, b].forEach(function (c, i) { h += '<line x1="' + (c.x - px) + '" y1="' + (c.y - py) + '" x2="' + (c.x + px) + '" y2="' + (c.y + py) + '"' + (i === 1 ? ' class="dash"' : '') + '/>'; });
      h += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" class="dash"/>';
      [a, b, mid].forEach(function (c, i) { h += '<circle cx="' + c.x + '" cy="' + c.y + '" r="' + (i === 2 ? 5 : 6) + '"/>'; });
    } else if (m && m.kind === 'radial') {
      var r = m.g, ring = function (k) { var pts = []; for (var i = 0; i <= 72; i++) { var t = i / 72 * Math.PI * 2, ex = Math.cos(t) * r.rx * k, ey = Math.sin(t) * r.ry * k, c = Math.cos(r.ang), sn = Math.sin(r.ang), s2 = qScr(r.cx + c * ex - sn * ey, r.cy + sn * ex + c * ey); pts.push(s2.x.toFixed(1) + ',' + s2.y.toFixed(1)); } return pts.join(' '); };
      h += '<polyline points="' + ring(1) + '"/>';
      if (r.fe > 0 && r.fe < 100) h += '<polyline class="dash" points="' + ring(1 - r.fe / 100) + '"/>';
      mHandles(m).forEach(function (q) { h += '<circle cx="' + q[1].x + '" cy="' + q[1].y + '" r="' + (q[0] === 'rc' ? 5 : 6) + '"/>'; });
    } else if (m && m.kind === 'brush' && mHover) {
      var q0 = toQ(mHover), e0 = qScr(q0.x, q0.y), e1 = qScr(q0.x + BRS.size / 200, q0.y), rr = Math.hypot(e1.x - e0.x, e1.y - e0.y);
      // (Paint's ring: dark inside a light edge, the size it paints; the feather's inner edge dashed)
      h += '<circle class="ring-o" cx="' + mHover.x + '" cy="' + mHover.y + '" r="' + (rr + 1) + '"/><circle class="ring" cx="' + mHover.x + '" cy="' + mHover.y + '" r="' + rr + '"/>';
      if (BRS.feather > 0) h += '<circle class="ring dash" cx="' + mHover.x + '" cy="' + mHover.y + '" r="' + rr * (1 - BRS.feather / 100) + '"/>';
    }
    muiEl.innerHTML = h;
  }
  // THE PANEL: add a mask; the masks, each picked, inverted, hidden or
  // deleted; the picked one's settings (and the brush's)
  function masksHTML() {
    var ms = doc.v.masks || [], m = pickedMask(), full = ms.length >= 4;
    var ib = function (a, name, icon, pressed) { return '<button type="button" class="ctx-btn ctx-icon" data-pa="' + a + '" aria-label="' + name + '" data-tip="' + name + '"' + (pressed != null ? ' aria-pressed="' + pressed + '"' : '') + '>' + CI(icon) + '</button>'; };
    var h = '<div class="pho-masks"><div class="pho-sub">Add a mask</div><div class="pho-madd">' + Object.keys(MKINDS).map(function (k) { return '<button type="button" class="ctx-btn" data-pa="madd" data-kind="' + k + '"' + (full ? ' disabled' : '') + ' data-tip="' + (full ? 'Four masks at most' : 'A new ' + MKINDS[k][0].toLowerCase() + ' mask') + '">' + CI(MKINDS[k][1]) + '<span>' + MKINDS[k][0] + '</span></button>'; }).join('') + '</div>';
    if (!ms.length) return h + '<p class="ctx-hint pho-hint">A mask changes one part of the photo: paint it with a brush, or let it fade in from a line or a circle. Each has its own sliders.</p><div class="pa-acts pho-acts"><button type="button" class="pho-done" data-pa="mdone">Done</button></div></div>';
    h += '<div class="pho-mlist" role="listbox" aria-label="Masks">' + ms.map(function (q) {
      return '<div class="pho-mrow" data-mid="' + q.id + '" aria-selected="' + (q.id === mPick) + '"><button type="button" class="pho-mname" data-pa="mpick" role="option" aria-selected="' + (q.id === mPick) + '">' + CI(MKINDS[q.kind][1]) + '<span>' + esc(q.name) + '</span></button>' +
        ib('minv', 'Invert', MICON.inv, q.inv) + ib('mvis', 'Show', MICON.eye, q.on) + ib('mdel', 'Delete', MICON.del) + '</div>';
    }).join('') + '</div>';
    if (m) {
      h += '<label class="pho-switch"><span>Show the mask</span><input type="checkbox" data-pa="mover"' + (mOver ? ' checked' : '') + '></label>';
      if (m.kind === 'brush') h += '<div class="pa-tabs ctx-seg pho-bseg" role="tablist" aria-label="Brush"><button type="button" role="tab" data-pa="mpaint" aria-selected="' + !BRS.erase + '">Paint</button><button type="button" role="tab" data-pa="merase" aria-selected="' + BRS.erase + '">Erase</button></div>' +
        '<div class="pa-list">' + slider('b_size', 'Size', 1, 60) + slider('b_feather', 'Feather', 0, 100) + slider('b_flow', 'Flow', 5, 100) + '</div>';
      if (m.kind === 'radial') h += '<div class="pa-list">' + slider('m_fe', 'Feather', 0, 100) + '</div>';
      if (mFresh === m.id) h += '<p class="ctx-hint pho-hint">' + (m.kind === 'linear' ? 'Drag on the photo from where it’s full to where it fades out.' : 'Drag on the photo from the middle out.') + '</p>';
      h += '<div class="pho-sub">' + esc(m.name) + '</div><div class="pa-list">' + MADJ.map(function (q) { return slider('m_' + q[0], q[1]); }).join('') + '</div>';
    }
    return h + '<div class="pa-acts pho-acts"><button type="button" class="pho-done" data-pa="mdone">Done</button></div></div>';
  }
  function marksMasks() {
    Array.prototype.forEach.call(B.ctxTool.querySelectorAll('[data-pa="mover"]'), function (b) { b.checked = mOver; });
  }
  function maskAct(a, row, btn) {
    var v = doc.v, id = row ? +row.dataset.mid : null, m = null;
    (v.masks || []).forEach(function (q) { if (q.id === id) m = q; });
    if (a === 'madd') {
      var kind = btn && MKINDS[btn.dataset.kind] ? btn.dataset.kind : 'brush';
      if ((v.masks || []).length >= 4) return;
      record('Add Mask');
      var aq = aspQ(), ms = v.masks = v.masks || [], nid = ms.reduce(function (x, q) { return Math.max(x, q.id); }, 0) + 1, cnt = ms.filter(function (q) { return q.kind === kind; }).length + 1;
      var nm = { id: nid, kind: kind, name: MKINDS[kind][0] + ' ' + cnt, on: true, inv: false, a: { ex: 0, co: 0, hi: 0, sh: 0, te: 0, ti: 0, sa: 0, cl: 0 } };
      nm.g = kind === 'linear' ? { x0: aq.x / 2, y0: aq.y * 0.2, x1: aq.x / 2, y1: aq.y * 0.55 } : kind === 'radial' ? { cx: aq.x / 2, cy: aq.y / 2, rx: Math.min(aq.x, aq.y) * 0.3, ry: Math.min(aq.x, aq.y) * 0.3, ang: 0, fe: 50 } : { st: [] };
      ms.push(nm); mPick = nid; mFresh = kind === 'brush' ? null : nid; changed(true); return;
    }
    if (a === 'mover') { mOver = !mOver; try { localStorage.setItem('paint-pho-overlay', mOver ? '1' : '0'); } catch (e) {} draw(); return; }
    if (a === 'mpaint' || a === 'merase') { BRS.erase = a === 'merase'; try { localStorage.setItem('paint-pho-brush', JSON.stringify(BRS)); } catch (e) {} panelSync(); Array.prototype.forEach.call(B.ctxTool.querySelectorAll('[data-pa="mpaint"], [data-pa="merase"]'), function (b) { b.setAttribute('aria-selected', b.dataset.pa === a ? 'true' : 'false'); }); return; }
    if (!m) return;
    if (a === 'mpick') { if (mPick !== id) { mPick = id; mFresh = null; changed(true); } return; }
    if (a === 'minv') { record('Invert Mask'); m.inv = !m.inv; changed(true); return; }
    if (a === 'mvis') { record(m.on ? 'Hide Mask' : 'Show Mask'); m.on = !m.on; changed(true); return; }
    if (a === 'mdel') { record('Delete Mask'); v.masks = v.masks.filter(function (q) { return q.id !== id; }); if (!v.masks.length) v.masks = null; if (mPick === id) mPick = v.masks ? v.masks[v.masks.length - 1].id : null; delete BRC[id]; changed(true); }
  }
  // (masks from a file: only what's known, every number in its range)
  function checkMasks(ms) {
    if (!Array.isArray(ms)) return null;
    var num = function (x, lo, hi, d) { return typeof x === 'number' && isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; }, seen = {}, out = [];
    ms.slice(0, 4).forEach(function (m, i) {
      if (!m || !MKINDS[m.kind]) return;
      var id = Math.max(1, Math.round(num(m.id, 1, 1e6, i + 1))); while (seen[id]) id++; seen[id] = 1;
      var n = { id: id, kind: m.kind, name: String(m.name || MKINDS[m.kind][0]).slice(0, 30), on: m.on !== false, inv: m.inv === true, a: {} }, g = m.g || {};
      MADJ.forEach(function (q) { n.a[q[0]] = Math.round(num(m.a && m.a[q[0]], -100, 100, 0)); });
      if (m.kind === 'linear') n.g = { x0: num(g.x0, -2, 3, 0.5), y0: num(g.y0, -2, 3, 0.2), x1: num(g.x1, -2, 3, 0.5), y1: num(g.y1, -2, 3, 0.5) };
      else if (m.kind === 'radial') n.g = { cx: num(g.cx, -2, 3, 0.5), cy: num(g.cy, -2, 3, 0.5), rx: num(g.rx, 0.005, 5, 0.2), ry: num(g.ry, 0.005, 5, 0.2), ang: num(g.ang, -7, 7, 0), fe: Math.round(num(g.fe, 0, 100, 50)) };
      else n.g = { st: (Array.isArray(g.st) ? g.st : []).slice(0, 2000).map(function (st) { st = st || {}; return { s: num(st.s, 0.002, 1, 0.1), f: num(st.f, 0, 1, 0.5), fl: num(st.fl, 0.01, 1, 0.6), er: st.er === true, p: Array.isArray(st.p) ? st.p.slice(0, 40000).map(function (x) { return num(x, -2, 3, 0); }) : [] }; }).filter(function (st) { return st.p.length >= 2 && !(st.p.length & 1); }) };
      out.push(n);
    });
    return out.length ? out : null;
  }

  // ---- CROP & STRAIGHTEN: the whole frame shows, with what the crop keeps
  // lit and the rest dimmed; its corners and sides are dragged (keeping the
  // shape picked), its inside moves it. The straightening angle turns the
  // photo under it (filled, so no corner ever shows); the quarter turns and
  // flips turn the frame, the crop with it ----
  var cropping = false, cropEl = null, cdrag = null;
  var CROP_ICONS = { rotl: '<path d="M4 9h11a5 5 0 0 1 0 10h-3"/><path d="M8 5L4 9l4 4"/>', rotr: '<path d="M20 9H9a5 5 0 0 0 0 10h3"/><path d="M16 5l4 4-4 4"/>',
    fliph: '<path d="M12 3v18"/><path d="M8 7L3 12l5 5z"/><path d="M16 7l5 5-5 5z"/>', flipv: '<path d="M3 12h18"/><path d="M7 8l5-5 5 5z"/><path d="M7 16l5 5 5-5z"/>',
    swap: '<rect x="5" y="3" width="10" height="14" rx="1.5"/><path d="M19 9v10a2 2 0 0 1-2 2H9"/>' };
  function cropHTML() {
    var ib = function (a, name) { return '<button type="button" class="ctx-btn ctx-icon" data-pa="' + a + '" aria-label="' + name + '" data-tip="' + name + '">' + CI(CROP_ICONS[a]) + '</button>'; };
    return '<div class="pho-cropset"><div class="pho-sub">Shape</div><div class="pa-tabs ctx-seg pho-asp" role="tablist" aria-label="Crop shape">' +
      ASPECTS.map(function (q) { return '<button type="button" role="tab" data-pasp="' + q[0] + '" aria-selected="false">' + q[1] + '</button>'; }).join('') + '</div>' +
      '<div class="pa-list">' + slider('angle', 'Straighten', -45, 45, '', 0.1) + '</div>' +
      '<div class="pho-turns">' + ib('rotl', 'Turn Left') + ib('rotr', 'Turn Right') + ib('fliph', 'Flip Across') + ib('flipv', 'Flip Upside Down') + ib('swap', 'Portrait or Landscape') + '</div>' +
      '<div class="pa-acts pho-acts"><button type="button" data-pa="cropreset">Reset</button><button type="button" class="pho-done" data-pa="cropdone">Done</button></div></div>';
  }
  // (width over height of a shape, in the frame's pixels; null: any shape)
  function aspOf(v) {
    if (v.asp === 'free') return null;
    var f = frameOf(v), q = v.asp === 'orig' ? f.w / f.h : (function (t) { return +t[0] / +t[1]; })(v.asp.split(':'));
    return v.aspT ? 1 / q : q;
  }
  // (the largest of that shape inside a box, about its middle)
  function fitAsp(c, R, f) {
    if (!R) return c;
    var W = c.w * f.w, H = c.h * f.h, w = W, h = w / R; if (h > H) { h = H; w = h * R; }
    return { x: c.x + (c.w - w / f.w) / 2, y: c.y + (c.h - h / f.h) / 2, w: w / f.w, h: h / f.h };
  }
  // (a shape picked: the largest crop of it, in the middle of the whole frame,
  // worked out from the frame each time, never from the crop there was, so
  // picking shapes in any order always gives the same crop for each, and
  // Original the whole frame again; Free keeps the crop as it is)
  function aspCrop(v) {
    if (v.asp === 'free') return cropOf(v);
    if (v.asp === 'orig' && !v.aspT) return null;
    return fitAsp({ x: 0, y: 0, w: 1, h: 1 }, aspOf(v), frameOf(v));
  }
  function setCrop(c) { doc.v.crop = c && (c.x > 1e-4 || c.y > 1e-4 || c.w < 0.9999 || c.h < 0.9999) ? { x: c.x, y: c.y, w: c.w, h: c.h } : null; }
  function cropSync() {
    if (!cropEl) return;
    cropEl.hidden = !(on && cropping && img && !before);
    if (cropEl.hidden) return;
    var f = frameOf(doc.v), c = cropOf(doc.v);
    cropEl.style.left = (view.x + c.x * f.w * view.k) + 'px'; cropEl.style.top = (view.y + c.y * f.h * view.k) + 'px';
    cropEl.style.width = (c.w * f.w * view.k) + 'px'; cropEl.style.height = (c.h * f.h * view.k) + 'px';
  }
  // (what a press on the crop takes hold of: corners and sides by their
  // edges, within a finger's reach, or the inside)
  function cropHit(p, touch) {
    var f = frameOf(doc.v), c = cropOf(doc.v), x0 = view.x + c.x * f.w * view.k, y0 = view.y + c.y * f.h * view.k, x1 = x0 + c.w * f.w * view.k, y1 = y0 + c.h * f.h * view.k, R = touch ? 22 : 12;
    var l = Math.abs(p.x - x0) < R, r = Math.abs(p.x - x1) < R, t = Math.abs(p.y - y0) < R, b = Math.abs(p.y - y1) < R;
    var inX = p.x > x0 - R && p.x < x1 + R, inY = p.y > y0 - R && p.y < y1 + R;
    var e = { l: l && inY, r: r && inY && !l, t: t && inX, b: b && inX && !t };
    if (e.l || e.r || e.t || e.b) return { kind: 'size', e: e };
    if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) return { kind: 'move' };
    return null;
  }
  function cropDown(p, touch) {
    var h = cropHit(p, touch); if (!h) return false;
    cdrag = { h: h, p: p, c: Object.assign({}, cropOf(doc.v)), rec: false };
    return true;
  }
  function cropMove(p) {
    if (!cdrag) return;
    if (!cdrag.rec) { record('Crop'); cdrag.rec = true; }
    var f = frameOf(doc.v), c0 = cdrag.c, dx = (p.x - cdrag.p.x) / (f.w * view.k), dy = (p.y - cdrag.p.y) / (f.h * view.k), c;
    if (cdrag.h.kind === 'move') c = { x: Math.max(0, Math.min(1 - c0.w, c0.x + dx)), y: Math.max(0, Math.min(1 - c0.h, c0.y + dy)), w: c0.w, h: c0.h };
    else c = cropSize(c0, cdrag.h.e, dx, dy, aspOf(doc.v), f);
    setCrop(c); draw(); marksCrop();
  }
  // (a side or corner dragged, in fractions of the frame; the shape kept, the
  // opposite side or corner held, never past the frame or smaller than 3%)
  function cropSize(c0, e, dx, dy, R, f) {
    var mn = 0.03, x0 = c0.x, y0 = c0.y, x1 = c0.x + c0.w, y1 = c0.y + c0.h;
    if (e.l) x0 = Math.max(0, Math.min(x1 - mn, x0 + dx)); if (e.r) x1 = Math.min(1, Math.max(x0 + mn, x1 + dx));
    if (e.t) y0 = Math.max(0, Math.min(y1 - mn, y0 + dy)); if (e.b) y1 = Math.min(1, Math.max(y0 + mn, y1 + dy));
    if (!R) return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    var corner = (e.l || e.r) && (e.t || e.b), W = (x1 - x0) * f.w, H = (y1 - y0) * f.h;
    // (the size it may grow to: up to the frame's edge on the side being pulled; about its middle for a side)
    var ax = e.l ? x1 : e.r ? x0 : (x0 + x1) / 2, ay = e.t ? y1 : e.b ? y0 : (y0 + y1) / 2;
    var maxW = (e.l ? ax : e.r ? 1 - ax : 2 * Math.min(ax, 1 - ax)) * f.w, maxH = (e.t ? ay : e.b ? 1 - ay : 2 * Math.min(ay, 1 - ay)) * f.h;
    if (corner) { if (W / H > R) H = W / R; else W = H * R; }
    else if (e.l || e.r) H = W / R; else W = H * R;
    var k = Math.min(1, maxW / W, maxH / H); W *= k; H *= k;
    var w = W / f.w, h = H / f.h;
    return { x: e.l ? ax - w : e.r ? ax : ax - w / 2, y: e.t ? ay - h : e.b ? ay : ay - h / 2, w: w, h: h };
  }
  function cropUp() { if (cdrag && cdrag.rec) { quick = false; draw(); B.autosave(); thumbsSoon(); histButtons(); } cdrag = null; }
  function marksCrop() { if (!B || !B.ctxTool) return; Array.prototype.forEach.call(B.ctxTool.querySelectorAll('[data-pasp]'), function (b) { b.setAttribute('aria-selected', b.dataset.pasp === doc.v.asp ? 'true' : 'false'); }); }
  // (a quarter turn or a flip of the frame: the crop goes round with it)
  function turn(how) {
    var v = doc.v, c = cropOf(v), n;
    record({ rotl: 'Turn Left', rotr: 'Turn Right', fliph: 'Flip', flipv: 'Flip' }[how]);
    if (how === 'rotr') { v.rot = (v.rot + 1) & 3; n = { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w }; var t = v.flipH; v.flipH = v.flipV; v.flipV = t; }
    else if (how === 'rotl') { v.rot = (v.rot + 3) & 3; n = { x: c.y, y: 1 - c.x - c.w, w: c.h, h: c.w }; var t2 = v.flipH; v.flipH = v.flipV; v.flipV = t2; }
    else if (how === 'fliph') { v.flipH = !v.flipH; n = { x: 1 - c.x - c.w, y: c.y, w: c.w, h: c.h }; }
    else { v.flipV = !v.flipV; n = { x: c.x, y: 1 - c.y - c.h, w: c.w, h: c.h }; }
    setCrop(n); fit(); changed(true);
  }
  // THE PRESETS' PANEL: Colour and Black & White as tabs (only which are
  // shown: switching neither puts one on nor takes one off), Original first
  // in each, then the films and the other looks under headings of their own
  var ptab = null;
  function presetsHTML() {
    var now = doc.v.preset || 'original', cur = now !== 'original' && presetOf(now);
    if (!ptab) ptab = cur ? cur.cat : PCATS[0][0];
    var btn = function (id, name) { return '<button type="button" class="pho-preset" role="radio" data-pp="' + id + '" aria-checked="' + (now === id) + '"><canvas aria-hidden="true"></canvas><span>' + esc(name) + '</span></button>'; };
    var html = '<div class="pa-tabs pho-ptabs" role="tablist" aria-label="Preset category">' + PCATS.map(function (c) { return '<button type="button" role="tab" data-ptab="' + c[0] + '" aria-selected="' + (c[0] === ptab) + '">' + esc(c[1]) + '</button>'; }).join('') + '</div>' +
      '<div class="pho-presets" role="radiogroup" aria-label="Presets">' + btn('original', 'Original');
    (PDATA.groups || [['film', 'Film stocks'], ['look', 'Looks']]).forEach(function (g) {
      var items = PRESETS.filter(function (q) { return q.cat === ptab && (q.group || 'look') === g[0]; });
      if (items.length) html += '<div class="pho-sub pho-pgroup">' + esc(g[1]) + '</div>' + items.map(function (q) { return btn(q.id, q.name); }).join('');
    });
    return html + '</div><div class="pa-acts pho-acts"><button type="button" data-pa="pcancel"' + (presetPick ? '' : ' disabled') + '>Cancel</button><button type="button" class="pho-done" data-pa="pdone"' + (presetPick ? '' : ' disabled') + '>Done</button></div>';
  }
  // (the panel's values from the settings)
  function getK(k) {
    var v = doc.v;
    if (k.slice(0, 2) === 'm_') { var pm = pickedMask(); return !pm ? 0 : k === 'm_fe' ? pm.g.fe : pm.a[k.slice(2)]; }
    if (k.slice(0, 2) === 'b_') return BRS[k.slice(2)];
    v = eff(v);
    if (k === 'mxH' || k === 'mxS' || k === 'mxL') { var q = (v.hsl && v.hsl[band]) || [0, 0, 0]; return q[{ mxH: 0, mxS: 1, mxL: 2 }[k]]; }
    if (k === 'gH' || k === 'gS' || k === 'gL') { var g = (v.grade && v.grade[gradeAt]) || [0, 0, 0]; return g[{ gH: 0, gS: 1, gL: 2 }[k]]; }
    if (k === 'gBlend') return v.grade && v.grade.blend != null ? v.grade.blend : 50;
    if (k === 'gBal') return v.grade ? v.grade.bal || 0 : 0;
    return v[k];
  }
  function setK(k, x) {
    var v = doc.v;
    if (k.slice(0, 2) === 'm_') { var pm = pickedMask(); if (pm) { if (k === 'm_fe') pm.g.fe = x; else pm.a[k.slice(2)] = x; } return; }
    if (k.slice(0, 2) === 'b_') { BRS[k.slice(2)] = x; try { localStorage.setItem('paint-pho-brush', JSON.stringify(BRS)); } catch (e) {} return; }
    var pq = pAt(v), pv = pq ? pq.v : {};
    if (k === 'mxH' || k === 'mxS' || k === 'mxL') { var ix = { mxH: 0, mxS: 1, mxL: 2 }[k], po = pv.hsl && pv.hsl[band] ? pv.hsl[band][ix] : 0; v.hsl = v.hsl || {}; var q = v.hsl[band] = (v.hsl[band] || [0, 0, 0]).slice(); q[ix] = x - po; if (!q[0] && !q[1] && !q[2]) delete v.hsl[band]; if (!Object.keys(v.hsl).length) v.hsl = null; return; }
    if (k === 'gH' || k === 'gS' || k === 'gL' || k === 'gBlend' || k === 'gBal') {
      // (the grading seen, the preset's included, becomes the hand's, then changes)
      if (pv.grade) v.grade = gradeMix(v.grade, pv.grade);
      var g = v.grade = v.grade || { sh: [0, 0, 0], mid: [0, 0, 0], hi: [0, 0, 0], all: [0, 0, 0], blend: 50, bal: 0 };
      if (k === 'gBlend') g.blend = x; else if (k === 'gBal') g.bal = x; else { var a = g[gradeAt] = (g[gradeAt] || [0, 0, 0]).slice(); a[{ gH: 0, gS: 1, gL: 2 }[k]] = x; }
      if (GRADES.every(function (q) { return !g[q[0]][1] && !g[q[0]][2]; }) && g.blend === 50 && !g.bal) v.grade = null;
      return;
    }
    v[k] = scalarK(k) ? x - offOf(v, k) : x;
  }
  function panelSync() {
    var el = B.ctxTool; if (!doc || !img) return;
    Array.prototype.forEach.call(el.querySelectorAll('[data-pk]'), function (i) { var x = getK(i.dataset.pk); i.value = x; i.previousElementSibling.textContent = show(i.dataset.pk, +x); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-band]'), function (b) { b.setAttribute('aria-checked', b.dataset.band === band ? 'true' : 'false'); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-grade]'), function (b) { b.setAttribute('aria-selected', b.dataset.grade === gradeAt ? 'true' : 'false'); });
    // (the hue slider's track: the colour wheel; the mixer's: the band's colour)
    var gh = el.querySelector('[data-pk="gH"]'); if (gh) gh.style.setProperty('--track', 'linear-gradient(to right, #e5483a, #e9c92f, #4cae4f, #36b9c4, #3d6fe0, #d64fae, #e5483a)');
    marks(); curveDraw(); if (cat === 'presets') thumbsDraw(); if (cat === 'crop') marksCrop(); if (cat === 'masks') marksMasks();
    Array.prototype.forEach.call(el.querySelectorAll('[data-pp]'), function (b) { b.setAttribute('aria-checked', b.dataset.pp === (doc.v.preset || 'original') ? 'true' : 'false'); });
  }
  // (a section that's been changed shows a dot, and its reset button)
  var SEC_KEYS = { light: ['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'brightness', 'curve'], colour: ['temp', 'tint', 'vibrance', 'saturation', 'hsl', 'grade'],
    effects: ['texture', 'clarity', 'dehaze', 'vignette', 'vigMid', 'grain', 'grainSize', 'grainRough', 'grainCol', 'halation'], detail: ['sharpen', 'sRadius', 'sDetail', 'sMask', 'nr', 'nrColor'],
    optics: ['distort', 'lensVig', 'caR', 'caB', 'vert', 'horiz', 'scale'] };
  function marks() {
    if (!doc) return;
    var E = eff(doc.v);
    Array.prototype.forEach.call(B.ctxTool.querySelectorAll('[data-psec]'), function (s) { s.classList.toggle('changed', SEC_KEYS[s.dataset.psec].some(function (k) { return !isDef(E, k); })); });
  }
  var panelKey = null;
  function panelRefresh() { if (!on) return; B.ctxRefresh(); }
  function pickCat(c) {
    cat = c; if (c !== 'presets' && presetPick) presetCancel();
    if (c === 'presets') ptab = null; // (opened afresh: on the tab of the preset in use)
    var was = cropping; cropping = c === 'crop' && !!img; mFresh = null;
    if (c === 'masks' && doc && doc.v.masks && !pickedMask()) mPick = doc.v.masks[doc.v.masks.length - 1].id;
    groupSync(); B.showPanel(); panelRefresh();
    if (was !== cropping && img) fit(); else draw();
    mSync();
  }
  function groupSync() { if (!groupEl) return; Array.prototype.forEach.call(groupEl.querySelectorAll('[data-pcat]'), function (b) { b.setAttribute('aria-pressed', b.dataset.pcat === cat ? 'true' : 'false'); }); }
  // THE PANEL'S CONTROLS
  function panelInput(e) {
    if (!on || !doc) return;
    var i = e.target.closest('[data-pk]'); if (!i) return;
    if (/^b_/.test(i.dataset.pk)) { setK(i.dataset.pk, +i.value); i.previousElementSibling.textContent = show(i.dataset.pk, +i.value); brushPeek(true); return; }
    if (!dragging) { record(labelOf(i.dataset.pk)); dragging = true; }
    // (a mask's own setting: its red steps aside, so what it does shows)
    mSlide = /^m_/.test(i.dataset.pk) && i.dataset.pk !== 'm_fe';
    quick = true; setK(i.dataset.pk, +i.value); i.previousElementSibling.textContent = show(i.dataset.pk, +i.value);
    if (presetPick) { presetBase = null; presetPick = null; }
    marks(); draw();
  }
  function panelChange(e) {
    if (!on || !doc || !e.target.closest('[data-pk]')) return;
    if (/^b_/.test(e.target.closest('[data-pk]').dataset.pk)) { brushPeek(false); return; }
    dragging = false; quick = false; mSlide = false; draw(); histButtons(); B.autosave(); thumbsSoon();
  }
  function labelOf(k) { if (/^m_/.test(k)) return 'Mask'; var r = rowOf(k); return r ? r[1] : { mxH: 'Colour Mixer', mxS: 'Colour Mixer', mxL: 'Colour Mixer', gH: 'Colour Grading', gS: 'Colour Grading', gL: 'Colour Grading', gBlend: 'Colour Grading', gBal: 'Colour Grading' }[k] || 'Edit'; }
  function panelClick(e) {
    if (!on) return;
    var t = e.target;
    var hd = t.closest('[data-psec] .pr-head');
    if (hd) { var sec = hd.closest('[data-psec]'), shut = !sec.classList.contains('closed'); sec.classList.toggle('closed', shut); hd.setAttribute('aria-expanded', shut ? 'false' : 'true'); try { localStorage.setItem('paint-pho-' + sec.dataset.psec, shut ? 'closed' : 'open'); } catch (x) {} if (!shut) curveDraw(); return; }
    var rs = t.closest('[data-preset-sec]'); if (rs && doc) { record('Reset ' + rs.closest('[data-psec]').querySelector('.pr-head span').firstChild.textContent); SEC_KEYS[rs.dataset.presetSec].forEach(function (k) { doc.v[k] = copyV({ x: DEF[k] }).x; }); changed(true); return; }
    var bd = t.closest('[data-band]'); if (bd) { band = bd.dataset.band; panelSync(); return; }
    var gr = t.closest('[data-grade]'); if (gr) { gradeAt = gr.dataset.grade; panelSync(); return; }
    var pt = t.closest('[data-ptab]'); if (pt) { if (ptab !== pt.dataset.ptab) { ptab = pt.dataset.ptab; panelRefresh(); var sc = thumbScroller(); if (sc) sc.scrollTop = 0; } return; }
    var pp = t.closest('[data-pp]'); if (pp) { presetTry(pp.dataset.pp); return; }
    var as = t.closest('[data-pasp]'); if (as && doc) { if (doc.v.asp !== as.dataset.pasp) { record('Crop Shape'); doc.v.asp = as.dataset.pasp; setCrop(aspCrop(doc.v)); draw(); changed(true); } return; }
    var a = t.closest('[data-pa]'); if (!a) return;
    if (a.dataset.pa === 'open') B.openPicker();
    else if (a.dataset.pa === 'reset' && doc && anySet(doc.v)) { record('Reset All'); doc.v = fresh(); changed(true); }
    else if (a.dataset.pa === 'pcancel') presetCancel();
    else if (/^(rotl|rotr|fliph|flipv)$/.test(a.dataset.pa) && doc) turn(a.dataset.pa);
    else if (a.dataset.pa === 'swap' && doc) { record('Crop Shape'); doc.v.aspT = !doc.v.aspT; if (doc.v.asp === 'free') doc.v.asp = 'orig'; setCrop(aspCrop(doc.v)); draw(); changed(true); }
    else if (a.dataset.pa === 'cropreset' && doc) { record('Reset Crop'); ['crop', 'angle', 'rot', 'flipH', 'flipV', 'asp', 'aspT'].forEach(function (k) { doc.v[k] = copyV({ x: DEF[k] }).x; }); fit(); changed(true); }
    else if (a.dataset.pa === 'cropdone' || a.dataset.pa === 'mdone') pickCat('edit');
    else if (/^m/.test(a.dataset.pa) && doc) maskAct(a.dataset.pa, a.closest('[data-mid]'), a);
    else if (a.dataset.pa === 'pdone') presetDone();
  }
  // (double-click or double-tap a slider's name: back to where it starts)
  function panelDbl(e) {
    if (!on || !doc) return;
    var row = e.target.closest('[data-pk-row]'); if (!row) return;
    var k = row.dataset.pkRow, d = k === 'gBlend' ? 50 : k in DEF ? DEF[k] : 0;
    if (scalarK(k)) { if (doc.v[k] === d) return; record(labelOf(k)); doc.v[k] = d; changed(true); return; }
    if (+getK(k) === d) return;
    record(labelOf(k)); setK(k, d); changed(true);
  }

  // ---- THE TONE CURVE: points from 0 to 255, joined as Paint's Curves
  // joins them (the same spline, fx-shared.js) ----
  var CP = 7, cvTap = 0;
  function curvePts() { return (doc && doc.v.curve) || [[0, 0], [255, 255]]; }
  function curveDraw() {
    var c = B.ctxTool.querySelector('.pho-curve .cv-graph'); if (!c || !c.offsetParent) return;
    var w = c.clientWidth || 220, h = Math.round(w * 0.75), R = window.devicePixelRatio || 1;
    c.style.height = h + 'px'; if (c.width !== Math.round(w * R)) { c.width = Math.round(w * R); c.height = Math.round(h * R); }
    var x = c.getContext('2d'), W2 = w - 2 * CP, H2 = h - 2 * CP, cs = getComputedStyle(B.ctxTool), ink = cs.getPropertyValue('--text').trim() || '#1d1d1f', acc = cs.getPropertyValue('--accent').trim() || '#ff3b30';
    x.setTransform(R, 0, 0, R, 0, 0); x.clearRect(0, 0, w, h); x.translate(CP, CP);
    x.save(); x.globalAlpha = 0.06; x.fillStyle = ink; x.fillRect(0, 0, W2, H2); x.restore();
    x.save(); x.globalAlpha = 0.18; x.strokeStyle = ink; x.lineWidth = 1;
    for (var g = 1; g < 4; g++) { x.beginPath(); x.moveTo(g * W2 / 4, 0); x.lineTo(g * W2 / 4, H2); x.moveTo(0, g * H2 / 4); x.lineTo(W2, g * H2 / 4); x.stroke(); }
    x.beginPath(); x.moveTo(0, H2); x.lineTo(W2, 0); x.setLineDash([3, 3]); x.stroke(); x.restore();
    var P = curvePts(), L = FX.curveLut(P, 256);
    x.strokeStyle = ink; x.lineWidth = 1.75; x.beginPath();
    for (var i = 0; i < 256; i++) x[i ? 'lineTo' : 'moveTo'](i / 255 * W2, H2 - L[i] / 255 * H2);
    x.stroke();
    P.forEach(function (q) { x.beginPath(); x.arc(q[0] / 255 * W2, H2 - q[1] / 255 * H2, 5, 0, Math.PI * 2); x.fillStyle = acc; x.fill(); x.lineWidth = 2; x.strokeStyle = '#fff'; x.stroke(); });
  }
  function setCurve(P) { doc.v.curve = P.length === 2 && P[0][0] === 0 && P[0][1] === 0 && P[1][0] === 255 && P[1][1] === 255 ? null : P; curveDraw(); marks(); quick = true; draw(); }
  function curveDown(e) {
    var c = e.target.closest('.pho-curve .cv-graph'); if (!c || !on || !doc) return;
    e.preventDefault();
    var r0 = c.getBoundingClientRect(), r = { left: r0.left + CP, top: r0.top + CP, width: r0.width - 2 * CP, height: r0.height - 2 * CP, bottom: r0.bottom - CP };
    var at = function (ev) { return [Math.max(0, Math.min(255, (ev.clientX - r.left) / r.width * 255)), Math.max(0, Math.min(255, (1 - (ev.clientY - r.top) / r.height) * 255))]; };
    var P = curvePts().map(function (q) { return q.slice(); }), a = at(e), hit = -1, best = 1e9;
    P.forEach(function (q, i) { var d = Math.hypot((q[0] - a[0]) / 255 * r.width, (q[1] - a[1]) / 255 * r.height); if (d < best) { best = d; hit = i; } });
    var now = Date.now();
    record('Tone Curve');
    if (best <= 14 && now - cvTap < 350 && P.length > 2) { P.splice(hit, 1); setCurve(P); cvTap = 0; quick = false; draw(); B.autosave(); return; }
    cvTap = now;
    if (best > 14) {
      var L = FX.curveLut(P, 256), nx = Math.round(a[0]), ny = Math.round(L[nx]);
      if (P.some(function (q) { return q[0] === nx; })) nx = Math.min(255, nx + 1);
      P.push([nx, ny]); P.sort(function (p1, p2) { return p1[0] - p2[0]; }); hit = P.findIndex(function (q) { return q[0] === nx && q[1] === ny; }); setCurve(P);
    }
    try { c.setPointerCapture(e.pointerId); } catch (x) {}
    var mv = function (ev) {
      var q = at(ev), Q = P.map(function (x) { return x.slice(); }); Q[hit] = [Math.round(q[0]), Math.round(q[1])];
      if (P.length > 2 && (ev.clientY < r.top - 30 || ev.clientY > r.bottom + 30)) Q.splice(hit, 1);
      Q.sort(function (p1, p2) { return p1[0] - p2[0]; }); setCurve(Q);
    };
    var upc = function () { c.removeEventListener('pointermove', mv); c.removeEventListener('pointerup', upc); c.removeEventListener('pointercancel', upc); quick = false; draw(); B.autosave(); thumbsSoon(); };
    c.addEventListener('pointermove', mv); c.addEventListener('pointerup', upc); c.addEventListener('pointercancel', upc);
  }

  // ---- PRESETS: a tap tries one (it only changes which preset lies over
  // what's set by hand, so trying another never adds to the last, and
  // Original takes it off); Done keeps it as one step, Cancel (or leaving)
  // puts back the one there was ----
  function presetVals(id, base) { var v = copyV(base || fresh()); v.preset = id === 'original' ? null : id; v.pamt = 100; return v; }
  function presetTry(id) {
    if (!doc || (id !== 'original' && !presetOf(id))) return;
    if (!presetPick) presetBase = copyV(doc.v);
    var nid = id === 'original' ? null : id; if (nid !== doc.v.preset) doc.v.pamt = 100; // (another preset: all of it, to begin with)
    presetPick = id; doc.v.preset = nid; draw(); panelSync();
    var acts = B.ctxTool.querySelectorAll('[data-pa="pcancel"], [data-pa="pdone"]'); Array.prototype.forEach.call(acts, function (b) { b.disabled = false; });
  }
  function presetCancel() {
    if (!presetPick) return;
    doc.v = presetBase; presetBase = null; presetPick = null; draw(); if (on) panelRefresh();
  }
  function presetDone() {
    if (!presetPick) return;
    var id = doc.v.preset, was = presetBase.preset, name = id ? presetOf(id).name : 'Original', now = copyV(doc.v);
    if (id !== was) { doc.v = presetBase; record(id ? 'Preset: ' + name : 'No Preset'); doc.v = now; }
    presetBase = null; presetPick = null;
    if (id !== was) B.toast(id ? name + ' kept: every setting can still be changed' : 'The preset is off: what you set yourself is kept');
    cat = 'edit'; groupSync(); changed(true);
  }
  // (each preset's look, on a small copy of this photo: worked out a few at
  // a time between frames, the ones in view first, so the panel opens at once
  // and the photo never waits for them; each is kept until the photo or what's
  // set changes; a new run (the panel drawn again, a tab, a change) calls off
  // the last one)
  var thumbT = 0, thumbGen = 0, thumbQ = null;
  function thumbsSoon() { clearTimeout(thumbT); thumbT = setTimeout(function () { thumbs = {}; thumbGen++; if (on && cat === 'presets') thumbsDraw(); }, 400); }
  function thumbScroller() { var el = B && B.ctxTool; while (el && el !== document.body) { var o = getComputedStyle(el).overflowY; if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el; el = el.parentElement; } return null; }
  function thumbPut(b, t) { var c = b.querySelector('canvas'); if (!c || c.dataset.t === t.id) return; c.width = t.data.width; c.height = t.data.height; c.getContext('2d').putImageData(t.data, 0, 0); c.dataset.t = t.id; }
  function thumbsDraw() {
    if (!gl || !img || !T.src) return;
    var gen = ++thumbGen, todo = [];
    Array.prototype.forEach.call(B.ctxTool.querySelectorAll('[data-pp]'), function (b) { var t = thumbs[b.dataset.pp]; if (t) thumbPut(b, t); else todo.push(b); });
    if (!todo.length) { thumbQ = null; return; }
    thumbQ = { gen: gen, base: copyV(presetBase || doc.v), todo: todo, size: Math.round(96 * Math.min(2, window.devicePixelRatio || 1)) };
    requestAnimationFrame(thumbStep);
  }
  function thumbStep() {
    var Q = thumbQ; if (!Q || Q.gen !== thumbGen || !on || cat !== 'presets' || !gl || !T.src) return;
    var sc = thumbScroller(), vr = sc ? sc.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    var away = function (b) { var r = b.getBoundingClientRect(); return r.bottom < vr.top ? vr.top - r.bottom : r.top > vr.bottom ? r.top - vr.bottom : 0; };
    Q.todo = Q.todo.filter(function (b) { return document.contains(b); });
    Q.todo.sort(function (a, b) { return away(a) - away(b); });
    var t0 = performance.now();
    while (Q.todo.length && (performance.now() - t0 < 8)) {
      var b = Q.todo.shift(), id = b.dataset.pp;
      if (!thumbs[id]) thumbs[id] = { id: id + ':' + thumbGen, data: render(presetVals(id, Q.base), Q.size) };
      thumbPut(b, thumbs[id]);
    }
    if (Q.todo.length) requestAnimationFrame(thumbStep); else thumbQ = null;
  }
  // (the photo worked out at a size, into a texture, and read back)
  function render(v, long, wanted) {
    var O = outSize(v), s = wanted ? 1 : Math.min(1, long / Math.max(O.w, O.h)), w = wanted ? wanted.w : Math.max(1, Math.round(O.w * s)), h = wanted ? wanted.h : Math.max(1, Math.round(O.h * s));
    var t = tex(w, h, ''), f = target(t);
    develop(v, { tex: t, w: w, h: h }, { x: 0, y: 0 }, { x: 1 / w, y: 1 / h }, Math.max(0, Math.log2(T.srcW / img.w * O.w / w / geo(v).z)), false);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    var px = new Uint8ClampedArray(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(f); gl.deleteTexture(t);
    // (drawn upside down into the texture: the rows the right way round, un-premultiplied)
    var out = new ImageData(w, h), od = out.data, row = w * 4;
    for (var y = 0; y < h; y++) od.set(px.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    for (var i = 0; i < od.length; i += 4) { var a = od[i + 3]; if (a && a < 255) { od[i] = od[i] * 255 / a; od[i + 1] = od[i + 1] * 255 / a; od[i + 2] = od[i + 2] * 255 / a; } }
    return out;
  }

  // ---- SAVING A PHOTO: the full-size photo worked out from the photo as it
  // came (never the screen's look), at its own size or one asked for, as
  // JPEG (with its quality), PNG, WebP or TIFF; a JPEG from a JPEG keeps its
  // EXIF (set upright, as the pixels now are) ----
  function exportBlob(o) {
    if (!img || !gl) return Promise.reject(new Error('No photo'));
    var O = outSize(doc.v), w = Math.max(1, Math.round(o.w || O.w)), h = Math.max(1, Math.round(o.h || O.h)), lim = Math.min(maxTex, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
    if (w > lim || h > lim) { var s = lim / Math.max(w, h); w = Math.floor(w * s); h = Math.floor(h * s); B.toast('Saved at ' + w + ' × ' + h + ', the largest this device can work out'); }
    var data = render(doc.v, 0, { w: w, h: h });
    if (o.type === 'tiff') return Promise.resolve(new Blob([tiff(data)], { type: 'image/tiff' }));
    var c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(data, 0, 0);
    var mime = o.type === 'png' ? 'image/png' : o.type === 'webp' ? 'image/webp' : 'image/jpeg';
    return new Promise(function (ok, no) {
      c.toBlob(function (b) {
        if (!b) { no(new Error('encode')); return; }
        if (mime !== 'image/jpeg' || o.meta === false || !doc.blob || !/jpe?g/i.test(doc.type || '')) { ok(b); return; }
        withExif(b, doc.blob).then(ok, function () { ok(b); });
      }, mime, o.quality != null ? o.quality : 0.92);
    });
  }
  // (a TIFF: 8 bits a channel, RGB, see-through kept if there is any, one strip)
  function tiff(im) {
    var w = im.width, h = im.height, d = im.data, alpha = false, i;
    for (i = 3; i < d.length; i += 4) if (d[i] < 255) { alpha = true; break; }
    var spp = alpha ? 4 : 3, n = w * h * spp, tags = alpha ? 12 : 11, ifd = 8, ifdLen = 2 + tags * 12 + 4, bps = ifd + ifdLen, data = bps + spp * 2 + 16;
    var buf = new ArrayBuffer(data + n), v = new DataView(buf), u8 = new Uint8Array(buf);
    v.setUint16(0, 0x4949); v.setUint16(2, 42, true); v.setUint32(4, ifd, true); v.setUint16(ifd, tags, true);
    var e = ifd + 2, tag = function (t, type, cnt, val) { v.setUint16(e, t, true); v.setUint16(e + 2, type, true); v.setUint32(e + 4, cnt, true); if (type === 3 && cnt === 1) v.setUint16(e + 8, val, true); else v.setUint32(e + 8, val, true); e += 12; };
    tag(256, 4, 1, w); tag(257, 4, 1, h); tag(258, 3, spp, bps); tag(259, 3, 1, 1); tag(262, 3, 1, 2); tag(273, 4, 1, data); tag(277, 3, 1, spp); tag(278, 4, 1, h); tag(279, 4, 1, n);
    tag(282, 5, 1, bps + spp * 2); tag(283, 5, 1, bps + spp * 2 + 8); if (alpha) tag(338, 3, 1, 2);
    v.setUint32(e, 0, true);
    for (i = 0; i < spp; i++) v.setUint16(bps + i * 2, 8, true);
    v.setUint32(bps + spp * 2, 72, true); v.setUint32(bps + spp * 2 + 4, 1, true); v.setUint32(bps + spp * 2 + 8, 72, true); v.setUint32(bps + spp * 2 + 12, 1, true);
    for (var p = 0, q = data; p < d.length; p += 4) { u8[q++] = d[p]; u8[q++] = d[p + 1]; u8[q++] = d[p + 2]; if (alpha) u8[q++] = d[p + 3]; }
    return buf;
  }
  // (the original's EXIF (APP1) put into the new JPEG, its orientation set
  // to upright, since the pixels have been turned already)
  function withExif(jpg, orig) {
    return Promise.all([jpg.arrayBuffer(), orig.slice(0, 256 * 1024).arrayBuffer()]).then(function (r) {
      var a = new Uint8Array(r[0]), o = new Uint8Array(r[1]);
      if (o[0] !== 0xFF || o[1] !== 0xD8) return new Blob([a], { type: 'image/jpeg' });
      var p = 2, app1 = null;
      while (p + 4 < o.length && o[p] === 0xFF) {
        var mk = o[p + 1], len = (o[p + 2] << 8) | o[p + 3];
        if (mk === 0xE1 && o[p + 4] === 0x45 && o[p + 5] === 0x78 && o[p + 6] === 0x69 && o[p + 7] === 0x66) { app1 = o.slice(p, p + 2 + len); break; }
        if (mk === 0xDA) break; p += 2 + len;
      }
      if (!app1) return new Blob([a], { type: 'image/jpeg' });
      uprightExif(app1);
      return new Blob([a.subarray(0, 2), app1, a.subarray(2)], { type: 'image/jpeg' });
    });
  }
  function uprightExif(s) {
    var t = 10, le = s[t] === 0x49, dv = new DataView(s.buffer, s.byteOffset, s.byteLength);
    var g16 = function (o) { return dv.getUint16(o, le); }, g32 = function (o) { return dv.getUint32(o, le); };
    var ifd = t + g32(t + 4); if (ifd + 2 > s.length) return;
    for (var i = 0, n = g16(ifd); i < n; i++) { var e = ifd + 2 + i * 12; if (e + 12 > s.length) return; if (g16(e) === 0x0112) dv.setUint16(e + 8, 1, le); }
  }
  // (the full-size photo as a canvas: what goes across to Paint or Vector)
  function rasterFull() {
    if (!img || !gl) return null;
    var O = outSize(doc.v), lim = Math.min(maxTex, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)), s = Math.min(1, lim / Math.max(O.w, O.h));
    var data = render(doc.v, 0, { w: Math.round(O.w * s), h: Math.round(O.h * s) }), c = document.createElement('canvas');
    c.width = data.width; c.height = data.height; c.getContext('2d').putImageData(data, 0, 0); return c;
  }
  // THE SAVE SHEET: format, quality, size and whether to keep the EXIF
  function saveSheet() {
    if (!img) { B.toast('Open a photo first'); return; }
    var O = outSize(doc.v), fmt = 'jpeg', box = B.openSheet('pho-save', '<div class="pa-sheet-title">Save Photo</div>' +
      '<div class="pa-tabs" role="tablist" aria-label="Format">' + [['jpeg', 'JPEG'], ['png', 'PNG'], ['webp', 'WebP'], ['tiff', 'TIFF']].map(function (f) { return '<button type="button" role="tab" data-pf="' + f[0] + '" aria-selected="' + (f[0] === fmt) + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<label class="pa-row" data-pq-row><span>Quality</span><output>92</output><input type="range" min="40" max="100" step="1" value="92" data-pq aria-label="Quality"></label>' +
      '<div class="pho-size"><label><span>Width</span><input class="p-field" type="number" min="1" data-pw value="' + O.w + '"></label><span aria-hidden="true">×</span><label><span>Height</span><input class="p-field" type="number" min="1" data-ph value="' + O.h + '"></label>' +
      '<button type="button" class="pho-full" data-pfull>Full Size</button></div>' +
      '<label class="vm-ask" data-pmeta-row><input type="checkbox" data-pmeta checked> Keep the photo’s EXIF details</label>' +
      '<div class="pa-sheet-acts"><button type="button" data-ps="cancel">Cancel</button><button type="button" class="pa-primary" data-ps="save">Save</button></div>');
    var q = box.querySelector('[data-pq]'), wI = box.querySelector('[data-pw]'), hI = box.querySelector('[data-ph]');
    var sync = function () {
      Array.prototype.forEach.call(box.querySelectorAll('[data-pf]'), function (b) { b.setAttribute('aria-selected', b.dataset.pf === fmt ? 'true' : 'false'); });
      box.querySelector('[data-pq-row]').hidden = !(fmt === 'jpeg' || fmt === 'webp');
      box.querySelector('[data-pmeta-row]').hidden = !(fmt === 'jpeg' && /jpe?g/i.test(doc.type || ''));
    };
    sync();
    q.addEventListener('input', function () { q.previousElementSibling.textContent = q.value; });
    // (width and height keep the photo's proportions)
    wI.addEventListener('input', function () { if (+wI.value > 0) hI.value = Math.max(1, Math.round(+wI.value * O.h / O.w)); });
    hI.addEventListener('input', function () { if (+hI.value > 0) wI.value = Math.max(1, Math.round(+hI.value * O.w / O.h)); });
    box.addEventListener('click', function (e) {
      var f = e.target.closest('[data-pf]'); if (f) { fmt = f.dataset.pf; sync(); return; }
      if (e.target.closest('[data-pfull]')) { wI.value = O.w; hI.value = O.h; return; }
      var a = e.target.closest('[data-ps]'); if (!a) return;
      if (a.dataset.ps === 'cancel') { B.closeSheet(); return; }
      var o = { type: fmt, w: +wI.value || O.w, h: +hI.value || O.h, quality: +q.value / 100, meta: box.querySelector('[data-pmeta]').checked };
      B.closeSheet(); B.toast('Working out the full-size photo…');
      setTimeout(function () {
        exportBlob(o).then(function (b) { B.download(b, fmt === 'jpeg' ? 'jpg' : fmt === 'tiff' ? 'tif' : fmt, (doc.name || 'Photo').replace(/\.[^.]+$/, '') + ' edited'); }, function () { B.toast('That couldn’t be saved'); });
      }, 30);
    });
  }

  // ---- KEEPING IT: the settings and the photo's own file (a Blob, as it
  // came), kept with the drawing ----
  function serialize() { return doc && doc.blob ? { name: doc.name, type: doc.type, w: doc.w, h: doc.h, v: copyV(doc.v), blob: doc.blob, cat: cat } : null; }
  function load(d) {
    hist = []; fut = []; presetBase = null; presetPick = null; thumbs = {};
    if (!d || !d.blob) { doc = null; img = null; rev++; emptySync(); histButtons(); return Promise.resolve(); }
    doc = { name: d.name, type: d.type, w: d.w, h: d.h, blob: d.blob, v: checkV(d.v) }; cat = d.cat === 'presets' ? 'presets' : 'edit';
    var k = kindOf({ name: d.name, type: d.type }), dec = k !== 'image' && B.decoders && B.decoders[k];
    var go = dec ? dec(d.blob).then(function (r) { return r.el; }) : decode(d.blob); // (RAW, TIFF and HEIC through their decoders again)
    return go.then(function (el) {
      img = { el: el, w: el.width || el.naturalWidth || d.w, h: el.height || el.naturalHeight || d.h }; doc.w = img.w; doc.h = img.h; rev++;
      if (gl || glInit()) upload();
      emptySync(); if (on) { fit(); panelRefresh(); }
    }, function () { doc = null; img = null; emptySync(); });
  }
  // (settings from a file: only what's known, each a number in its range)
  function checkV(v) {
    var o = fresh(); if (!v || typeof v !== 'object') return o;
    for (var k in DEF) {
      if (k === 'curve') { if (Array.isArray(v.curve) && v.curve.length >= 2 && v.curve.length <= 16 && v.curve.every(function (q) { return Array.isArray(q) && q.length === 2 && q.every(isFinite); })) o.curve = v.curve.map(function (q) { return [Math.max(0, Math.min(255, +q[0])), Math.max(0, Math.min(255, +q[1]))]; }); continue; }
      if (k === 'hsl') { if (v.hsl && typeof v.hsl === 'object') { o.hsl = {}; BANDS.forEach(function (b) { var q = v.hsl[b[0]]; if (Array.isArray(q) && q.length === 3) o.hsl[b[0]] = q.map(function (x) { return Math.max(-100, Math.min(100, +x || 0)); }); }); if (!Object.keys(o.hsl).length) o.hsl = null; } continue; }
      if (k === 'grade') { if (v.grade && typeof v.grade === 'object') { var g = v.grade, ok3 = function (q) { return Array.isArray(q) && q.length === 3 ? [Math.max(0, Math.min(360, +q[0] || 0)), Math.max(0, Math.min(100, +q[1] || 0)), Math.max(-100, Math.min(100, +q[2] || 0))] : [0, 0, 0]; }; o.grade = { sh: ok3(g.sh), mid: ok3(g.mid), hi: ok3(g.hi), all: ok3(g.all), blend: Math.max(0, Math.min(100, g.blend != null ? +g.blend : 50)), bal: Math.max(-100, Math.min(100, +g.bal || 0)) }; } continue; }
      if (k === 'masks') { o.masks = checkMasks(v.masks); continue; }
      if (k === 'preset') { o.preset = typeof v.preset === 'string' && presetOf(v.preset) ? v.preset : null; continue; }
      if (k === 'pamt') { o.pamt = typeof v.pamt === 'number' && isFinite(v.pamt) ? Math.max(0, Math.min(100, Math.round(v.pamt))) : 100; continue; }
      if (k === 'flipH' || k === 'flipV' || k === 'aspT') { o[k] = v[k] === true; continue; }
      if (k === 'rot') { o.rot = (Math.round(+v.rot) || 0) & 3; continue; }
      if (k === 'asp') { o.asp = ASPECTS.some(function (q) { return q[0] === v.asp; }) ? v.asp : 'orig'; continue; }
      if (k === 'crop') { var c = v.crop; if (c && [c.x, c.y, c.w, c.h].every(function (x) { return typeof x === 'number' && isFinite(x); }) && c.w > 0.005 && c.h > 0.005 && c.x >= 0 && c.y >= 0 && c.x + c.w <= 1.0001 && c.y + c.h <= 1.0001) o.crop = { x: c.x, y: c.y, w: c.w, h: c.h }; continue; }
      if (k === 'angle') { if (typeof v.angle === 'number' && isFinite(v.angle)) o.angle = Math.max(-45, Math.min(45, Math.round(v.angle * 10) / 10)); continue; }
      var r = rowOf(k), lo = r && r[2] != null ? r[2] : -100, hi = r && r[3] != null ? r[3] : 100, sp = hi - lo;
      if (typeof v[k] === 'number' && isFinite(v[k])) o[k] = Math.max(lo - sp, Math.min(hi + sp, Math.round(+v[k])));
    }
    return o;
  }
  function isEmpty() { return !img; }

  // ---- IN AND OUT OF PHOTO MODE ----
  function emptySync() { if (emptyEl) emptyEl.hidden = !!img; if (cv) cv.hidden = !img; }
  function enter(flat) {
    on = true; stageEl.hidden = false; groupEl.hidden = false; histEl.hidden = false; amtEl.hidden = false; amtSync();
    if (!gl && !glInit()) { B.toast('Photo mode needs WebGL 2, which this browser doesn’t offer'); }
    else if (img && !T.src) upload();
    groupSync(); emptySync(); histButtons();
    var go = flat ? takeCanvas(flat, 'Painting') : Promise.resolve();
    go.then(function () { if (on) { fit(); panelRefresh(); } });
  }
  function leave() {
    if (presetPick) presetCancel();
    on = false; clearTimeout(holdT); before = false; press = null; pinch = null; pts = {}; cdrag = null;
    if (cat === 'crop' || cat === 'masks') { cat = 'edit'; cropping = false; } mFresh = null; mdrag = null;
    if (stageEl) stageEl.hidden = true; if (groupEl) groupEl.hidden = true; if (histEl) histEl.hidden = true; if (amtEl) amtEl.hidden = true;
  }
  function key(e) {
    var k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return true; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return true; }
    if (mod && k === '0') { e.preventDefault(); fit(); return true; }
    if (mod || e.altKey) return false;
    if (k === '\\') { e.preventDefault(); setBefore(true); return true; } // (held: the photo as it came)
    if (k === 'escape' && presetPick) { presetCancel(); return true; }
    if (k === '0') { fit(); return true; }
    if (k === '+' || k === '=') { zoomStep(1); return true; }
    if (k === '-') { zoomStep(-1); return true; }
    return false;
  }
  function keyup(e) { if (e.key === '\\') setBefore(false); }

  // ---- SETTING UP ----
  function init(bridge) {
    B = bridge;
    stageEl = document.createElement('div'); stageEl.className = 'pho-stage'; stageEl.hidden = true;
    cv = document.createElement('canvas'); cv.className = 'pho-cv'; cv.hidden = true; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Photo');
    emptyEl = document.createElement('div'); emptyEl.className = 'pho-empty';
    emptyEl.innerHTML = '<p>Open a photo to start: JPEG, PNG, WebP or HEIC</p><button type="button" class="pa-primary pho-open" data-pa="open">Open Photo</button>';
    cropEl = document.createElement('div'); cropEl.className = 'pho-crop'; cropEl.hidden = true; cropEl.setAttribute('aria-hidden', 'true');
    cropEl.innerHTML = '<i class="pho-ch tl"></i><i class="pho-ch tr"></i><i class="pho-ch bl"></i><i class="pho-ch br"></i>';
    muiEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); muiEl.setAttribute('class', 'pho-mui'); muiEl.setAttribute('aria-hidden', 'true');
    stageEl.appendChild(cv); stageEl.appendChild(cropEl); stageEl.appendChild(muiEl); stageEl.appendChild(emptyEl);
    stageEl.addEventListener('pointerleave', function () { if (mHover) { mHover = null; mSync(); } });
    emptyEl.addEventListener('click', function (e) { if (e.target.closest('[data-pa="open"]')) B.openPicker(); });
    B.stage.appendChild(stageEl);
    stageEl.addEventListener('pointerdown', function (e) { if (e.target.closest('.pho-empty')) return; down(e); });
    stageEl.addEventListener('pointermove', move); stageEl.addEventListener('pointerup', up); stageEl.addEventListener('pointercancel', up);
    stageEl.addEventListener('wheel', wheel, { passive: false });
    stageEl.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); });
    stageEl.addEventListener('dblclick', function (e) { e.stopPropagation(); if (!img) return; var p = local(e); if (view.fit) zoomAt(1, p.x, p.y); else fit(); });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) { stageEl.addEventListener(t, function (e) { e.stopPropagation(); e.preventDefault(); }); });
    if (window.ResizeObserver) { var ro = new ResizeObserver(function () { relayout(); }); ro.observe(B.stage); var pan = B.ctxTool.closest('.paint-ctx'); if (pan) ro.observe(pan); }
    // (the left bar, a column of six: the four categories, Fit and the
    // settings panel's own button (from the bottom bar, which Photo mode
    // hasn't got); then Undo and Redo; then the zoom. No Layers: a photo has none)
    groupEl = document.createElement('div'); groupEl.className = 'paint-group pho-group'; groupEl.hidden = true;
    groupEl.setAttribute('role', 'group'); groupEl.setAttribute('aria-label', 'Photo tools');
    groupEl.innerHTML = CATS.map(function (c) { return '<button type="button" data-pcat="' + c[0] + '" aria-label="' + c[1] + '" aria-pressed="false" data-tip="' + c[1] + '">' + CI(c[2]) + '</button>'; }).join('') +
      '<button type="button" data-pzoom="fit" class="pho-fit" aria-label="Fit the photo (0)" data-tip="Fit (0): the whole photo">' + CI('<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M3.5 8V5a1.5 1.5 0 0 1 1.5-1.5h3M16 3.5h3A1.5 1.5 0 0 1 20.5 5v3M20.5 16v3a1.5 1.5 0 0 1-1.5 1.5h-3M8 20.5H5A1.5 1.5 0 0 1 3.5 19v-3"/>') + '</button>' +
      '<button type="button" class="pho-panelbtn" aria-label="Settings panel" aria-expanded="true" data-tip="Settings panel: show or hide it">' + CI('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M14.5 4.5v15M16.8 9h1.5M16.8 12h1.5M16.8 15h1.5"/>') + '</button>';
    B.leftViewGroup.parentNode.insertBefore(groupEl, B.leftViewGroup);
    groupEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pcat]'); if (b) { pickCat(b.dataset.pcat); return; }
      if (e.target.closest('.pho-panelbtn') && B.settingsBtn) B.settingsBtn.click();
    });
    histEl = document.createElement('div'); histEl.className = 'paint-group pho-hist'; histEl.hidden = true;
    histEl.setAttribute('role', 'group'); histEl.setAttribute('aria-label', 'Undo and redo');
    histEl.innerHTML = '<button type="button" data-pact="undo" aria-label="Undo" data-tip="Undo (Ctrl+Z)" disabled>' + CI('<path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H11"/>') + '</button>' +
      '<button type="button" data-pact="redo" aria-label="Redo" data-tip="Redo (Ctrl+Y)" disabled>' + CI('<path d="M15 7l4.5 4.5L15 16"/><path d="M19 11.5H9.5a5 5 0 0 0 0 10H13"/>') + '</button>';
    B.leftViewGroup.parentNode.insertBefore(histEl, B.leftViewGroup);
    // (where the bottom bar is in Paint: the preset's amount)
    amtEl = document.createElement('div'); amtEl.className = 'pho-amount'; amtEl.hidden = true;
    amtEl.setAttribute('role', 'group'); amtEl.setAttribute('aria-label', 'Preset amount');
    amtEl.innerHTML = '<label class="pb-slider"><span class="pho-amount-name" data-tip="How much of the preset: 0% is the photo as you set it, 100% the whole preset. Double-click to put it back to 100%">No preset</span>' +
      '<input type="range" min="0" max="100" step="1" value="100" aria-label="Preset amount" disabled><output>100%</output></label>';
    var bb = B.root.querySelector('.paint-bottom'); if (bb) bb.parentNode.insertBefore(amtEl, bb.nextSibling);
    amtEl.querySelector('input').addEventListener('input', amtInput);
    amtEl.querySelector('input').addEventListener('change', amtChange);
    amtEl.querySelector('.pho-amount-name').addEventListener('dblclick', function () {
      if (!on || !doc || !doc.v.preset || amtOf(doc.v) === 1) return;
      if (!presetPick) record('Preset Amount'); doc.v.pamt = 100; draw(); if (cat === 'edit') panelSync(); histButtons(); B.autosave();
    });
    // (the panel's button shows whether the panel is open, as the bottom bar's did)
    if (B.settingsBtn && window.MutationObserver) {
      var pb = groupEl.querySelector('.pho-panelbtn'), sync = function () { pb.setAttribute('aria-expanded', B.settingsBtn.getAttribute('aria-expanded') === 'true' ? 'true' : 'false'); };
      new MutationObserver(sync).observe(B.settingsBtn, { attributes: true, attributeFilter: ['aria-expanded'] }); sync();
    }
    B.ctxTool.addEventListener('click', panelClick); B.ctxTool.addEventListener('input', panelInput); B.ctxTool.addEventListener('change', panelChange);
    B.ctxTool.addEventListener('dblclick', panelDbl);
    // (the brush preview goes once its slider is let go of, wherever the pointer is then: Safari can send the release elsewhere)
    ['pointerup', 'pointercancel', 'blur'].forEach(function (t) { window.addEventListener(t, function () { if (peekHeld) brushPeek(false); }, true); });
    B.ctxTool.addEventListener('pointerdown', curveDown);
    document.addEventListener('paint:theme', function () { if (on) curveDraw(); });
    // (while Photo mode shows: undo, redo and the zoom are Photo's; its own buttons in the left
    // bar are data-pact and data-pzoom, so nothing looking for the painting's finds them)
    document.addEventListener('click', function (e) {
      if (!on) return;
      var t = e.target.closest('[data-zoom], [data-pzoom], [data-act="undo"], [data-act="redo"], [data-pact]'); if (!t || !B.root.contains(t)) return;
      e.stopPropagation(); e.preventDefault();
      var act = t.dataset.pact || t.dataset.act;
      if (act === 'undo') undo(); else if (act === 'redo') redo();
      else if (t.dataset.zoom === 'in') zoomStep(1); else if (t.dataset.zoom === 'out') zoomStep(-1); else fit();
    }, true);
  }

  // (a still tap on the empty workspace lets go of the mask in hand: its
  // brush or handles; Photo's other categories hold no tool)
  function toolDown() {
    if (!on || !doc || cat !== 'masks' || !mPick || mdrag) return false;
    mPick = null; mFresh = null; mHover = null; changed(true); mSync(); return true;
  }

  window.PaintPhoto = {
    toolDown: toolDown,
    init: init, enter: enter, leave: leave, key: key, keyup: keyup, load: load, serialize: serialize, isEmpty: isEmpty,
    panelHTML: panelHTML, panelSync: panelSync, openFile: openFile, saveSheet: saveSheet, exportBlob: exportBlob, raster: rasterFull,
    histButtons: histButtons, relayout: relayout, isOn: function () { return on; }, kindOf: kindOf,
    // (for the tests: the settings, the stage's state)
    state: function () { return { v: doc ? copyV(doc.v) : null, e: doc ? copyV(eff(doc.v)) : null, w: img ? img.w : 0, h: img ? img.h : 0, view: { x: view.x, y: view.y, k: view.k }, before: before, quick: quick, hist: hist.length, fut: fut.length, preset: presetPick, cat: cat, gl: !!gl, mask: mPick, mSlide: mSlide, mOver: mOver, ring: muiEl ? muiEl.querySelectorAll('circle.ring').length : 0 }; }
  };
})();
