// PHOTO MODE'S PRESETS (window.PaintPhotoPresets, read by photo.js): what
// each is called, which tab it's under, and its recipe. A recipe is data
// only; photo.js does the rendering.
//   v     the very same settings the sliders set (a preset moves each slider
//         by its value less where the slider starts, so what's set by hand
//         stays and adds to it); curve, hsl and grade as in photo.js
//   look  what only a film's preset sets, in linear light as the film met
//         it: mat, a colour matrix (rows add to one, so greys stay grey:
//         how its layers' sensitivities overlap); rgb, its own curve for a
//         channel ({ r, g, b }, points 0 to 255, after the main curve:
//         where its colours cross over); mono, a black-and-white film's
//         sensitivity to red, green and blue (made to add to one)
// The film looks are digital emulations inspired by each stock: a scanned
// or printed film looks as it does through its exposure, development and
// scanning too, so each aims at one documented, representative rendering
// (as a lab scan of it, exposed at box speed), not an exact copy. What each
// one is based on is noted with it; where a figure is given it's the
// manufacturer's (Kodak's Print Grain Index, Fujifilm's and Kodak's RMS
// granularity), and the rest is drawn from the stocks' published
// descriptions and side-by-side reviews.
(function () {
  'use strict';
  // (a curve's points, and colour grading's four, written short)
  var G = function (sh, mid, hi, all, blend, bal) { return { sh: sh || [0, 0, 0], mid: mid || [0, 0, 0], hi: hi || [0, 0, 0], all: all || [0, 0, 0], blend: blend == null ? 50 : blend, bal: bal || 0 }; };
  var list = [
    // KODAK PORTRA 400. The everyday Portra: the same natural skin as 160 a
    // touch richer in colour and contrast, smooth transitions, highlights
    // that roll off rather than clip (it takes overexposure well), fine
    // grain for its speed (T-grain, made to scan well).
    { id: 'portra400', name: 'Portra 400', cat: 'colour', group: 'film',
      v: { contrast: -2, highlights: -14, shadows: 8, whites: -6, temp: 6, saturation: -6, vibrance: 6,
        curve: [[0, 8], [60, 57], [128, 131], [200, 205], [255, 246]],
        hsl: { orange: [-3, -6, 8], red: [0, -8, 0], yellow: [-4, -6, 0], green: [-12, -12, -2], blue: [-4, -6, 2] },
        grade: G([195, 7, 0], null, [38, 8, 0], null, 50, 0),
        grain: 20, grainSize: 26, grainRough: 30, grainCol: 30 },
      look: { mat: [0.96, 0.03, 0.01, 0.03, 0.95, 0.02, 0.01, 0.04, 0.95] } },
    // KODAK GOLD 200. Consumer negative: warm, golden, nostalgic snapshot
    // colour; saturated yellows and oranges, warm greens, a little more
    // contrast than Portra (Print Grain Index 44).
    { id: 'gold200', name: 'Gold 200', cat: 'colour', group: 'film',
      v: { contrast: 8, highlights: -10, shadows: 6, temp: 12, tint: 3, saturation: 6, vibrance: 6,
        curve: [[0, 8], [64, 58], [128, 130], [192, 200], [255, 244]],
        hsl: { yellow: [-4, 16, 4], orange: [0, 8, 2], red: [0, 6, 0], green: [-14, 0, 0], blue: [0, 4, -4] },
        grade: G([25, 6, 0], null, [45, 14, 0], null, 50, 0),
        grain: 22, grainSize: 28, grainRough: 35, grainCol: 35 } },
    // FUJIFILM SUPERIA X-TRA 400. Fujifilm's consumer negative (its fourth,
    // cyan-sensitive layer for fluorescent light): greens that go cool and
    // cyan, cool green-cyan shadows, slightly pink skin, crisp consumer
    // contrast and visible grain.
    { id: 'superia400', name: 'Superia 400', cat: 'colour', group: 'film',
      v: { contrast: 10, highlights: -8, shadows: 4, temp: -2, saturation: 6, vibrance: 6,
        curve: [[0, 5], [64, 57], [128, 130], [192, 202], [255, 246]],
        hsl: { green: [12, 6, -4], aqua: [0, 8, 0], orange: [-3, -4, 2], red: [-3, 4, 0], blue: [-6, 4, 0] },
        grain: 26, grainSize: 30, grainRough: 45, grainCol: 40 },
      look: { rgb: { g: [[0, 5], [128, 130], [255, 252]], b: [[0, 3], [128, 127], [255, 250]] } } },
    // FUJICOLOR C200. Everyday daylight negative: natural, rich greens,
    // moderate contrast (a little more than Gold), a greenish cast in the
    // shadows and a magenta tint in the highlights, fine but visible grain.
    { id: 'c200', name: 'Fujicolor C200', cat: 'colour', group: 'film',
      v: { contrast: 6, highlights: -10, shadows: 6, saturation: 2, vibrance: 6,
        curve: [[0, 8], [64, 60], [128, 129], [192, 198], [255, 246]],
        hsl: { green: [6, 10, -2], blue: [-4, 2, 2] },
        grade: G(null, null, [330, 3, 0], null, 50, 0),
        grain: 22, grainSize: 26, grainRough: 40, grainCol: 35 },
      look: { rgb: { g: [[0, 8], [128, 129], [255, 253]] } } },
    // CINESTILL 800T. Kodak Vision3 500T motion-picture film with its
    // rem-jet backing taken off: balanced for 3,200K tungsten, so ambient
    // and daylight go cool and teal while warm lamps stay warm; red halation
    // round bright lights (the backing used to stop it: here a restrained
    // glow on strong highlights only, its own Halation slider, so it can be
    // turned down or off); moderate contrast, grain of a pushed 500-speed
    // film.
    { id: 'cinestill800t', name: 'CineStill 800T', cat: 'colour', group: 'film',
      v: { contrast: 6, highlights: -10, shadows: 6, temp: -8, tint: -2, saturation: 2, vibrance: 6,
        curve: [[0, 10], [64, 58], [128, 130], [192, 200], [255, 244]],
        hsl: { orange: [-2, 8, 4], yellow: [-6, 4, 0], red: [0, 6, 0], blue: [-6, -4, 0], aqua: [0, 6, -4] },
        grade: G([190, 18, 0], null, [35, 8, 0], null, 60, 0),
        grain: 30, grainSize: 30, grainRough: 40, grainCol: 45, halation: 30 },
      look: { rgb: { b: [[0, 9], [128, 129], [255, 250]] } } },
    // CINESTILL 50D. Kodak Vision3 50D, the finest-grained motion-picture
    // stock: daylight-balanced, clean and slightly cool, a cinema
    // negative's wide latitude and low contrast, crisp; only a hint of the
    // missing backing's halation at its slow speed.
    { id: 'cinestill50d', name: 'CineStill 50D', cat: 'colour', group: 'film',
      v: { contrast: 4, highlights: -10, shadows: 8, temp: -3, saturation: 4, vibrance: 8,
        curve: [[0, 6], [64, 60], [128, 129], [192, 200], [255, 250]],
        hsl: { blue: [-2, 6, -2], green: [0, 4, 0] },
        grain: 10, grainSize: 14, grainRough: 15, grainCol: 20, halation: 8 } },

    // ======================= COLOUR: LOOKS =======================
    { id: 'natural', name: 'Natural', cat: 'colour', v: { exposure: 4, contrast: 8, highlights: -18, shadows: 16, whites: 6, blacks: -6, vibrance: 14, clarity: 6, texture: 6, sharpen: 30 } },
    { id: 'neutral', name: 'Neutral', cat: 'colour', v: { contrast: 4, highlights: -10, shadows: 8, vibrance: 4 } },
    { id: 'warmportrait', name: 'Warm Portrait', cat: 'colour', v: { exposure: 6, contrast: 4, highlights: -22, shadows: 20, temp: 16, tint: 4, vibrance: 10, saturation: -4, texture: -12, clarity: -8, hsl: { orange: [0, -8, 12], red: [0, -6, 6] } } },
    { id: 'cinematic', name: 'Cinematic', cat: 'colour', v: { contrast: 18, highlights: -32, shadows: 22, blacks: -14, temp: -6, saturation: -12, vibrance: 8, clarity: 10, vignette: 22, curve: [[0, 14], [64, 54], [192, 206], [255, 240]], grade: { sh: [195, 32, 0], mid: [0, 0, 0], hi: [36, 30, 0], all: [0, 0, 0], blend: 60, bal: 0 } } },
    { id: 'coolcinematic', name: 'Cool Cinematic', cat: 'colour', v: { contrast: 16, highlights: -24, shadows: 14, blacks: -10, temp: -14, tint: -2, saturation: -14, vibrance: 4, clarity: 8, vignette: 16, curve: [[0, 12], [64, 54], [192, 204], [255, 240]], grade: G([210, 24, 0], null, [200, 8, 0], null, 55, 0) } },
    { id: 'tealorange', name: 'Teal & Orange', cat: 'colour', v: { contrast: 14, highlights: -16, shadows: 10, saturation: -6, vibrance: 10, hsl: { orange: [0, 10, 4], aqua: [0, 10, 0], blue: [-14, 0, -6], green: [18, -20, -6] }, grade: G([190, 40, 0], null, [32, 34, 0], null, 55, 0) } },
    { id: 'goldenhour', name: 'Golden Hour', cat: 'colour', v: { exposure: 6, highlights: -26, shadows: 18, temp: 30, tint: 8, vibrance: 22, dehaze: 6, vignette: 14, grade: { sh: [28, 12, 0], mid: [0, 0, 0], hi: [42, 34, 0], all: [0, 0, 0], blend: 60, bal: 15 } } },
    { id: 'pastel', name: 'Soft Pastel', cat: 'colour', v: { exposure: 14, contrast: -26, highlights: -20, shadows: 30, whites: 8, saturation: -18, vibrance: 18, temp: 4, curve: [[0, 40], [128, 140], [255, 248]], hsl: { blue: [0, -10, 16], magenta: [0, -6, 14], aqua: [0, -6, 14] } } },
    { id: 'cooleditorial', name: 'Cool Editorial', cat: 'colour', v: { contrast: 16, highlights: -14, whites: 10, blacks: -10, temp: -18, tint: -4, saturation: -14, vibrance: 6, clarity: 12, texture: 8, sharpen: 40 } },
    { id: 'richcolour', name: 'Rich Colour', cat: 'colour', v: { contrast: 12, blacks: -8, saturation: 10, vibrance: 26, dehaze: 6, clarity: 6, hsl: { red: [0, 8, -4], blue: [0, 10, -8], green: [0, 8, -4] } } },
    { id: 'softmatte', name: 'Soft Matte', cat: 'colour', v: { contrast: -18, highlights: -18, shadows: 22, saturation: -10, clarity: -10, curve: [[0, 34], [80, 84], [180, 186], [255, 244]] } },
    { id: 'classicfilm', name: 'Classic Film', cat: 'colour', v: { contrast: 10, highlights: -14, shadows: 8, temp: 6, saturation: -12, grain: 26, grainSize: 30, curve: [[0, 20], [60, 52], [128, 132], [200, 210], [255, 242]], grade: { sh: [200, 14, 0], mid: [35, 8, 0], hi: [48, 16, 0], all: [0, 0, 0], blend: 55, bal: 0 } } },
    { id: 'landscape', name: 'Landscape', cat: 'colour', v: { contrast: 14, highlights: -36, shadows: 26, whites: 8, blacks: -10, vibrance: 28, saturation: 6, clarity: 16, dehaze: 18, texture: 10, hsl: { blue: [-4, 12, -14], green: [-8, 10, -6], aqua: [0, 10, -8] } } },
    { id: 'studio', name: 'Clean Studio', cat: 'colour', v: { exposure: 10, contrast: 10, highlights: -8, shadows: 10, whites: 18, blacks: -4, saturation: -6, vibrance: 6, texture: 6, sharpen: 45, nr: 12 } },

    // ===================== BLACK & WHITE: FILM STOCKS =====================
    // Each film's own sensitivity to red, green and blue (mono), so the
    // same scene goes to grey differently: an ordinary panchromatic film is
    // more blue-sensitive than the eye (skies lighter, unfiltered); an
    // orthopanchromatic one sees less red (red goes darker); an
    // extended-red one more (foliage and skin lighter, blue skies darker).
    // KODAK TRI-X 400. The documentary classic: a traditional (cubic) grain,
    // clearly there and crisp (RMS 17), high acutance, a medium toe and a
    // noticeable shoulder, strong midtones.
    { id: 'trix400', name: 'Tri-X 400', cat: 'bw', group: 'film',
      v: { contrast: 14, highlights: -6, shadows: 2, clarity: 8, sharpen: 25,
        curve: [[0, 6], [50, 44], [128, 131], [205, 214], [255, 248]],
        grain: 34, grainSize: 34, grainRough: 70 },
      look: { mono: [0.30, 0.55, 0.15] } },
    // KODAK T-MAX 100. T-grain: very fine grain (RMS 8), excellent detail, a
    // long straight-line curve that separates tones cleanly into bright
    // highlights.
    { id: 'tmax100', name: 'T-Max 100', cat: 'bw', group: 'film',
      v: { contrast: 10, clarity: 6, sharpen: 30,
        curve: [[0, 4], [64, 59], [128, 128], [192, 198], [255, 254]],
        grain: 12, grainSize: 16, grainRough: 25 },
      look: { mono: [0.33, 0.53, 0.14] } },
    // KODAK T-MAX 400. A 400 with much finer, more controlled grain than
    // Tri-X (RMS 10 against 17), strong detail, a straighter curve and long
    // tonal range.
    { id: 'tmax400', name: 'T-Max 400', cat: 'bw', group: 'film',
      v: { contrast: 12, clarity: 6, sharpen: 25,
        curve: [[0, 4], [64, 58], [128, 129], [192, 200], [255, 252]],
        grain: 20, grainSize: 22, grainRough: 35 },
      look: { mono: [0.32, 0.54, 0.14] } },
    // ILFORD HP5 PLUS 400. Traditional grain, medium contrast (softer than
    // Tri-X), forgiving and versatile, a classic documentary look.
    { id: 'hp5', name: 'HP5 Plus 400', cat: 'bw', group: 'film',
      v: { contrast: 8, highlights: -6, shadows: 4,
        curve: [[0, 8], [64, 60], [128, 130], [192, 198], [255, 246]],
        clarity: 4, grain: 32, grainSize: 32, grainRough: 65 },
      look: { mono: [0.30, 0.56, 0.14] } },
    // ILFORD FP4 PLUS 125. A traditional medium-speed film: fine grain,
    // controlled contrast, smooth classic tonality.
    { id: 'fp4', name: 'FP4 Plus 125', cat: 'bw', group: 'film',
      v: { contrast: 6, highlights: -4, shadows: 2,
        curve: [[0, 6], [64, 60], [128, 129], [192, 197], [255, 248]],
        grain: 18, grainSize: 22, grainRough: 50 },
      look: { mono: [0.29, 0.57, 0.14] } },
    // ILFORD DELTA 100. Core-shell tabular grain: very fine and even, clean
    // detail, refined transitions.
    { id: 'delta100', name: 'Delta 100', cat: 'bw', group: 'film',
      v: { contrast: 10, sharpen: 25,
        curve: [[0, 4], [64, 59], [128, 129], [192, 198], [255, 252]],
        grain: 10, grainSize: 14, grainRough: 15 },
      look: { mono: [0.31, 0.56, 0.13] } },
    // ILFORD DELTA 400. A contemporary 400: tabular grain finer and more even
    // than HP5's, a crisper, cleaner look at the same speed.
    { id: 'delta400', name: 'Delta 400', cat: 'bw', group: 'film',
      v: { contrast: 12, highlights: -4, sharpen: 20,
        curve: [[0, 4], [64, 58], [128, 130], [192, 199], [255, 250]],
        grain: 22, grainSize: 24, grainRough: 30 },
      look: { mono: [0.31, 0.55, 0.14] } },
    // ILFORD DELTA 3200. Really about ISO 1000, made to be pushed: a
    // pronounced, compact grain (finer than a pushed traditional film, still
    // big), compressed shadows and a low-light contrast.
    { id: 'delta3200', name: 'Delta 3200', cat: 'bw', group: 'film',
      v: { contrast: 20, shadows: -6, blacks: -10, texture: -4,
        curve: [[0, 6], [64, 46], [128, 130], [200, 214], [255, 246]],
        grain: 62, grainSize: 46, grainRough: 60 },
      look: { mono: [0.30, 0.55, 0.15] } },
    // ILFORD PAN F PLUS 50. Very fine grain, outstanding sharpness and edge
    // contrast, rich tones with a high contrast that comes easily (and
    // shadows that need their exposure).
    { id: 'panf', name: 'Pan F Plus 50', cat: 'bw', group: 'film',
      v: { contrast: 16, blacks: -4, clarity: 10, texture: 2, sharpen: 25,
        curve: [[0, 0], [64, 54], [128, 128], [192, 204], [255, 255]],
        grain: 6, grainSize: 10, grainRough: 15 },
      look: { mono: [0.27, 0.57, 0.16] } },
    // FUJIFILM NEOPAN ACROS 100 II. Orthopanchromatic: less sensitive to red
    // than a true panchromatic film, so reds and skin go a little darker and
    // blue a little lighter; very fine grain (RMS 7), clean and smooth, fine
    // tonal separation.
    { id: 'acros', name: 'Acros 100 II', cat: 'bw', group: 'film',
      v: { contrast: 12, sharpen: 25,
        curve: [[0, 4], [64, 58], [128, 128], [192, 200], [255, 252]],
        grain: 8, grainSize: 12, grainRough: 10 },
      look: { mono: [0.20, 0.62, 0.18] } },
    // ROLLEI RETRO 80S. Extended red sensitivity (to about 750nm): foliage and
    // skin lighter, blue skies darker, haze cut, without a filter; higher
    // than usual contrast and strong detail.
    { id: 'retro80s', name: 'Retro 80S', cat: 'bw', group: 'film',
      v: { contrast: 22, blacks: -6, clarity: 10, sharpen: 30,
        curve: [[0, 0], [64, 50], [128, 128], [192, 206], [255, 254]],
        grain: 12, grainSize: 14, grainRough: 25 },
      look: { mono: [0.46, 0.46, 0.08] } },

    // ===================== BLACK & WHITE: LOOKS =====================
    { id: 'bw', name: 'Classic Mono', cat: 'bw', v: { contrast: 22, highlights: -16, shadows: 14, whites: 12, blacks: -14, saturation: -100, clarity: 14, grain: 12, hsl: { red: [0, 0, 10], orange: [0, 0, 14], blue: [0, 0, -18], aqua: [0, 0, -8] } } },
    { id: 'softmono', name: 'Soft Mono', cat: 'bw', v: { contrast: -14, highlights: -10, shadows: 14, clarity: -6, curve: [[0, 22], [128, 134], [255, 242]] }, look: { mono: [0.30, 0.55, 0.15] } },
    { id: 'hcmono', name: 'High Contrast', cat: 'bw', v: { contrast: 44, whites: 14, blacks: -20, clarity: 16, texture: 6 }, look: { mono: [0.45, 0.45, 0.10] } },
    { id: 'mattemono', name: 'Matte Black', cat: 'bw', v: { contrast: 10, highlights: -8, curve: [[0, 40], [64, 74], [128, 130], [255, 240]] }, look: { mono: [0.30, 0.56, 0.14] } },
    { id: 'silvergelatin', name: 'Silver Gelatin', cat: 'bw', v: { contrast: 14, highlights: -8, curve: [[0, 6], [64, 58], [128, 130], [200, 206], [255, 246]], grain: 10, grade: G([30, 10, 0], null, null, [40, 8, 0], 50, 0) }, look: { mono: [0.31, 0.55, 0.14] } },
    { id: 'fineart', name: 'Fine Art', cat: 'bw', v: { contrast: 8, highlights: -14, shadows: 10, clarity: 4, texture: 4, grade: G([220, 6, 0], null, null, null, 50, 0) }, look: { mono: [0.30, 0.55, 0.15] } },
    { id: 'highkey', name: 'High Key', cat: 'bw', v: { exposure: 12, contrast: -10, highlights: -6, shadows: 24, whites: 12, curve: [[0, 30], [128, 160], [255, 255]] }, look: { mono: [0.32, 0.54, 0.14] } },
    { id: 'lowkey', name: 'Low Key', cat: 'bw', v: { exposure: -14, contrast: 24, highlights: -12, blacks: -22, vignette: 24 }, look: { mono: [0.30, 0.56, 0.14] } },
    { id: 'architectural', name: 'Architectural', cat: 'bw', v: { contrast: 28, clarity: 18, texture: 10, sharpen: 40 }, look: { mono: [0.55, 0.38, 0.07] } },
    { id: 'portraitmono', name: 'Portrait Mono', cat: 'bw', v: { contrast: 6, highlights: -10, shadows: 10, texture: -10, clarity: -6 }, look: { mono: [0.40, 0.48, 0.12] } },
    { id: 'noir', name: 'Noir', cat: 'bw', v: { contrast: 40, highlights: -10, blacks: -26, vignette: 38, grain: 18, grainRough: 50, curve: [[0, 0], [70, 40], [128, 128], [190, 214], [255, 255]] }, look: { mono: [0.32, 0.56, 0.12] } },
    { id: 'newspaper', name: 'Newsprint', cat: 'bw', v: { contrast: 30, texture: -6, curve: [[0, 36], [80, 70], [160, 180], [255, 232]], grain: 45, grainSize: 55, grainRough: 90, grade: G(null, null, null, [45, 8, 0], 50, 0) }, look: { mono: [0.30, 0.56, 0.14] } }
  ];
  window.PaintPhotoPresets = { cats: [['colour', 'Colour'], ['bw', 'Black & White']], groups: [['film', 'Film stocks'], ['look', 'Looks']], list: list };
})();
