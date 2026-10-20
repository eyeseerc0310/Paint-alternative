// Light / dark mode switch (moon / sun button beside the menu icon)
(function () {
  var btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  var root = document.documentElement;
  var fadeTimer;
  function label() {
    btn.setAttribute('aria-label', root.getAttribute('data-theme') === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
  label();
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var dark = root.getAttribute('data-theme') !== 'dark';
    function apply() {
      if (dark) root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
      label();
    }
    try { localStorage.setItem('theme-choice', dark ? 'dark' : 'light'); } catch (err) {}

    // A quick, soft fade from one look to the other: the colour tokens ease
    // to their new values together (in place: nothing covers the page, so
    // it keeps taking clicks and strokes, and nothing flashes). Browsers
    // that can't fade the tokens fade each element's colours instead.
    var cls = window.CSS && CSS.registerProperty ? 'theme-fading' : 'theme-fading-each';
    clearTimeout(fadeTimer); root.classList.remove('theme-fading', 'theme-fading-each');
    // (once the colours have settled, pictures drawn in them, like the
    // brushes' samples, are drawn again)
    var settled = function () { document.dispatchEvent(new Event('paint:theme')); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); settled(); return; }
    root.classList.add(cls);
    void root.offsetWidth;
    apply();
    fadeTimer = setTimeout(function () { root.classList.remove(cls); settled(); }, 450);
  });
})();

// Paint: the drawing app.
// Tools down the left: brush (with a list of brushes), eraser, smudge, blur,
// line, shapes (a list), fill, gradient, text (a list of fonts), select &
// move, cutout, magic wand, colour picker, hand and light & dark; mirror.
// (Filled shapes is a switch in the shapes list.) A selection stays while
// you draw, and keeps everything inside it, until its X closes it. Holding
// space grabs whatever the mouse is over (or the whole picture, over
// nothing). ADJUST opens sliders for the layer you're on. Down the right:
// two colours (a tap opens the colour picker), swatches, recent colours, size, opacity, undo / redo, open,
// clear, layers and SAVE. The picture can be zoomed (pinch, ctrl + scroll,
// the corner buttons) and moved around (hand, space, two fingers). An Apple
// Pencil's pressure thickens and thins the line. Strokes are drawn on a
// see-through sheet on top while the pointer is down, then laid onto the
// layer, so a stroke's opacity stays even.
(function () {
  var SWATCHES = ['#141414', '#ffffff', '#8a8a8a', '#d6332f', '#f08a24', '#f5d33a', '#3fa34d', '#2f7fd6', '#7b4bc9', '#e36aa6', '#8b5a2b', '#1f3d5c'];
  var BRUSHES = [['round', 'Round'], ['feather', 'Feather'], ['marker', 'Marker'], ['pencil', 'Pencil'], ['spray', 'Spray'], ['calligraphy', 'Calligraphy'], ['highlighter', 'Highlighter']];
  var SHAPES = [['rect', 'Rectangle'], ['rounded', 'Rounded'], ['ellipse', 'Ellipse'], ['triangle', 'Triangle'], ['star', 'Star'], ['arrow', 'Arrow']];
  var TONES = [['dodge', 'Lighten'], ['burn', 'Darken']];
  var BLENDS = [['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['darken', 'Darken'], ['lighten', 'Lighten'], ['color-dodge', 'Colour Dodge'],
    ['color-burn', 'Colour Burn'], ['soft-light', 'Soft Light'], ['hard-light', 'Hard Light'], ['difference', 'Difference'], ['exclusion', 'Exclusion'], ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Colour'], ['luminosity', 'Luminosity']];
  var SYMS = [['off', 'Off'], ['x', 'Vertical'], ['y', 'Horizontal'], ['xy', 'Quadrant'], ['radial', 'Radial']];
  // FONTS: a few that every device has, and a library from Google Fonts
  // (fetched the first time the text tool is used, then kept for offline)
  var GFONTS = [
    ['Sans Serif', 'sans-serif', ['Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Lato', 'Raleway', 'Work Sans', 'Nunito', 'Quicksand', 'Josefin Sans', 'Barlow Condensed', 'Oswald']],
    ['Serif', 'serif', ['Playfair Display', 'Merriweather', 'Lora', 'EB Garamond', 'Libre Baskerville', 'Cormorant Garamond', 'DM Serif Display', 'Roboto Slab', 'Cinzel']],
    ['Display', 'sans-serif', ['Bebas Neue', 'Anton', 'Abril Fatface', 'Alfa Slab One', 'Righteous', 'Bungee', 'Bangers', 'Fredoka', 'Comfortaa', 'Orbitron', 'Monoton', 'Black Ops One', 'Creepster', 'Press Start 2P']],
    ['Handwriting', 'cursive', ['Pacifico', 'Dancing Script', 'Caveat', 'Permanent Marker', 'Shadows Into Light', 'Great Vibes', 'Lobster', 'Satisfy', 'Sacramento', 'Indie Flower', 'Amatic SC', 'Kalam']],
    ['Monospace', 'monospace', ['JetBrains Mono', 'Space Mono', 'Courier Prime', 'Special Elite']]
  ];
  var FONTS = [['-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, "Helvetica Neue", Arial, sans-serif', 'System', 'Built In'], ['Georgia, "Times New Roman", serif', 'Georgia', 'Built In'],
    ['"Courier New", Courier, monospace', 'Typewriter', 'Built In'], ['"Marker Felt", "Chalkboard SE", "Comic Sans MS", cursive', 'Marker Felt', 'Built In'], ['Impact, "Arial Black", sans-serif', 'Impact', 'Built In']];
  GFONTS.forEach(function (g) { g[2].forEach(function (n) { FONTS.push(['"' + n + '", ' + g[1], n, g[0]]); }); });
  var fontsLink = null;
  function ensureFonts() {
    if (fontsLink) return;
    fontsLink = document.createElement('link'); fontsLink.rel = 'stylesheet';
    fontsLink.href = 'https://fonts.googleapis.com/css2?' + GFONTS.map(function (g) { return g[2].map(function (n) { return 'family=' + n.replace(/ /g, '+'); }).join('&'); }).join('&') + '&display=swap';
    document.head.appendChild(fontsLink);
  }
  function loadFont(f) { try { if (document.fonts) document.fonts.load('40px ' + f); } catch (x) {} }
  // the list of fonts, each name shown in its own face, under headings
  function fontList(attr) {
    var out = '', cat = '';
    FONTS.forEach(function (f) {
      if (f[2] !== cat) { cat = f[2]; out += '<div class="pf-h">' + cat + '</div>'; }
      out += '<button type="button" role="menuitemradio" ' + attr + '="' + f[0].replace(/"/g, '&quot;') + '" style="font-family:' + f[0].replace(/"/g, '\'') + '">' + f[1] + '</button>';
    });
    return out;
  }
  var TOOL_NAMES = { brush: 'Brush', eraser: 'Eraser', smudge: 'Smudge', blur: 'Blur', line: 'Line', shape: 'Shape', fill: 'Fill', gradient: 'Gradient',
    text: 'Text', select: 'Move', lasso: 'Move', circle: 'Move', wand: 'Move', move: 'Move', pen: 'Pen', picker: 'Edit', hand: 'Edit', tone: 'Light & Dark' };
  var app = null;

  function init(root) {
    if (root.dataset.ready) return;
    root.dataset.ready = '1';
    // (some controls live in the top bar, outside the drawing area)
    var $ = function (q) { return root.querySelector(q) || document.querySelector('.site-header ' + q); };
    var stage = $('.paint-stage'), world = $('.paint-world'), stack = $('.paint-layers'), guide = $('.paint-guide');
    // THE GRID (from the Symmetry panel): evenly spaced lines over the
    // picture, in its own units, so they stay put as it's zoomed, moved and
    // turned; a background on one element, not part of the picture (never
    // saved). Its lines are a screen pixel wide at any zoom, and zoomed far
    // out, only every second (fourth...) one shows, so it never turns solid.
    // Square, or ISOMETRIC: lines upright and at 30° either way, making
    // triangles whose sides are the spacing (a tile s√3 wide and s high,
    // its diagonals the slanted lines). Its opacity can be turned down, and
    // with Drawing Assist on, strokes keep along its lines' ways (gridDirs)
    var gridOn = stored('paint-grid-on', false) === true, gridSize = stored('paint-grid-size', 40), gridSeen = '';
    var gridKind = stored('paint-grid-kind', 'square') === 'iso' ? 'iso' : 'square', gridAlpha = Math.max(0.1, Math.min(1, +stored('paint-grid-alpha', 1) || 1));
    var gridEl = document.createElement('div'); gridEl.className = 'paint-grid'; gridEl.hidden = true; gridEl.setAttribute('aria-hidden', 'true'); guide.parentNode.insertBefore(gridEl, guide);
    function gridDraw() {
      gridEl.hidden = !gridOn; if (!gridOn) { gridSeen = ''; return; }
      var s = gridSize; while (s * view.k < 6) s *= 2;
      var key = gridKind + s + ':' + view.k + ':' + gridAlpha; if (key === gridSeen) return; gridSeen = key;
      gridEl.classList.toggle('iso', gridKind === 'iso');
      gridEl.style.setProperty('--gs', s + 'px'); gridEl.style.setProperty('--gx', (s * Math.sqrt(3)) + 'px'); gridEl.style.setProperty('--gw', (1 / view.k) + 'px');
      gridEl.style.opacity = gridAlpha;
    }
    // (the ways a stroke can keep to with the grid: across and up and down,
    // or upright and 30° either way for isometric)
    function gridDirs() { return gridKind === 'iso' ? [{ x: 0, y: 1 }, { x: Math.sqrt(3) / 2, y: 0.5 }, { x: Math.sqrt(3) / 2, y: -0.5 }] : [{ x: 1, y: 0 }, { x: 0, y: 1 }]; }
    // (the slider: 4 to 256 of the picture's pixels, finely at the small end)
    function gridFromSlider(v) { return Math.round(4 * Math.pow(64, v / 100)); }
    function gridToSlider(g) { return Math.round(Math.log(g / 4) / Math.log(64) * 100); }
    var ov = $('.paint-over'), octx = ov.getContext('2d');
    var colorDot = $('.paint-current span'), color2Dot = $('.paint-second span');
    var sizeIn = $('.paint-size'), alphaIn = $('.paint-alpha'), zoomVal = $('.paint-zoom-val'), selbar = $('.paint-selbar');
    // (the left bar: the tools, then Layers and the zoom; the bottom bar: size,
    // undo, the two colours, redo and opacity; the dock: the tool options)
    var left = $('.paint-left'), bbar = $('.paint-bottom'), dock = $('.paint-dock'), paintEl = root.querySelector('.paint') || root;

    // ---- a little label beside the mouse saying what each tool does ----
    var tip = document.createElement('div'), tipOn = null;
    tip.className = 'paint-tip'; tip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tip);
    function hideTip() { tipOn = null; tip.classList.remove('on'); }
    function placeTip(e) {
      var w = tip.offsetWidth, h = tip.offsetHeight, vw = document.documentElement.clientWidth;
      var x = e.clientX - 16 - w;
      if (x < 8) x = Math.min(e.clientX + 18, vw - w - 8);
      var y = Math.max(8, Math.min(e.clientY - h / 2, window.innerHeight - h - 8));
      tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    }
    function showTip(e) {
      if (e.pointerType === 'touch') return;
      var b = e.target.closest && e.target.closest('[data-tip]');
      if (!b || !b.matches('button') || b.matches('.paint-current, .paint-second') || !b.querySelector('svg') || b.innerText.trim() || e.buttons || !b.closest('.paint, .site-header, .paint-focusout')) { hideTip(); return; }
      if (b !== tipOn) { tipOn = b; tip.textContent = b.dataset.tip; }
      // (a top-bar button's label sits just under it; the others, by the pointer)
      if (b.closest('.site-header')) {
        var r = b.getBoundingClientRect(), w = tip.offsetWidth, vw = document.documentElement.clientWidth;
        tip.style.transform = 'translate(' + Math.round(Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2))) + 'px,' + Math.round(r.bottom + 8) + 'px)';
      } else placeTip(e);
      tip.classList.add('on');
    }
    document.addEventListener('pointerover', showTip);
    document.addEventListener('pointermove', function (e) { if (tipOn || (e.target.closest && e.target.closest('[data-tip]'))) showTip(e); });
    document.addEventListener('pointerdown', hideTip, true);
    document.addEventListener('keydown', hideTip, true);
    document.addEventListener('pageswap:start', function gone() {
      document.removeEventListener('pageswap:start', gone);
      tip.remove();
    });
    var st = { tool: 'brush', brush: 'round', shape: SHAPES.some(function (q) { return q[0] === stored('paint-shape', 'rect'); }) ? stored('paint-shape', 'rect') : 'rect', font: FONTS[0][0], color: '#141414', color2: '#ffffff',
      size: 6, alpha: +alphaIn.value / 100, solid: false, sym: 'off', tone: 'dodge' };
    var W = 0, H = 0, R = 1, view = { k: 1, x: 0, y: 0, r: 0 }, fitK = 1, fillK = 1;
    var layers = [], active = null, undo = [], redo = [], LIMIT = 14, recent = [];
    // MORE THAN ONE LAYER PICKED: a swipe right along a layer's row (again,
    // to let it go), or Shift-click (all between) and Ctrl/⌘-click (one more)
    // in the Layers panel. `also` holds the layers picked alongside the
    // current one; together they're moved, sized, turned and flipped (the
    // Move tool, or a selection), shown or hidden, faded, blended, locked,
    // duplicated, grouped, merged and deleted at once. A plain tap on a
    // layer picks just that one again
    var also = [];
    function tidyAlso() { also = also.filter(function (L) { return L !== active && layers.indexOf(L) >= 0; }); }
    function multi() { tidyAlso(); return !!active && also.length > 0; }
    function picks() { tidyAlso(); return active ? layers.filter(function (L) { return L === active || also.indexOf(L) >= 0; }) : []; }

    // ---- the picture: a stack of layers, zoomed and moved as one ----
    W = Math.max(1, Math.round(stage.clientWidth)); H = Math.max(1, Math.round(stage.clientHeight));
    R = Math.min(window.devicePixelRatio || 1, 2);
    world.style.width = W + 'px'; world.style.height = H + 'px';
    ov.width = Math.round(W * R); ov.height = Math.round(H * R); ov.style.width = W + 'px'; ov.style.height = H + 'px';
    function base(c) { c.setTransform(R, 0, 0, R, 0, 0); }
    base(octx);
    // (the selection's outline, and anything lifted with it, sit on a sheet of their own above)
    var sov = $('.paint-selov'), sctx = sov.getContext('2d'), selx = $('.paint-selx');
    sov.width = ov.width; sov.height = ov.height; sov.style.width = W + 'px'; sov.style.height = H + 'px';
    base(sctx);
    // (its outline, handles and guides go on a sheet the stage's size, drawn
    // through the view, so they reach past the picture's edges into the
    // workspace; what's lifted stays on the picture's own sheet, clipped as before)
    var selui = $('.paint-selui'), uctx = selui.getContext('2d');
    function uiSheet() {
      var d = Math.min(window.devicePixelRatio || 1, 3), w = Math.max(1, Math.round(stage.clientWidth * d)), h = Math.max(1, Math.round(stage.clientHeight * d));
      if (selui.width !== w || selui.height !== h) { selui.width = w; selui.height = h; }
      uctx.setTransform(1, 0, 0, 1, 0, 0); uctx.clearRect(0, 0, w, h);
      var c = Math.cos(view.r) * view.k * d, n = Math.sin(view.r) * view.k * d;
      uctx.setTransform(c, n, -n, c, view.x * d, view.y * d);
    }
    var count = 1;
    function makeLayer(name, white) {
      var c = document.createElement('canvas');
      c.width = ov.width; c.height = ov.height; c.style.width = W + 'px'; c.style.height = H + 'px';
      var x = c.getContext('2d', { willReadFrequently: true }); base(x);
      if (white) { x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); }
      // (bg: the white paper at the bottom; delete it and the picture is see-through)
      // (alphaLock: paint only goes where the layer already has some; clip:
      // it shows only where the layer below it has paint)
      return { cv: c, ctx: x, name: name, visible: true, bg: !!white, opacity: 1, blend: 'normal', alphaLock: false, clip: false, view: null, text: null, mask: null, editMask: false, group: null };
    }
    // CLIPPING MASKS: a clipped layer keeps all its own paint, and is shown
    // through the layer under it (the first one below that isn't clipped
    // itself, in the same group), on a copy made for showing it: so
    // unclipping brings it all back
    function clipBase(L) {
      var i = layers.indexOf(L);
      if (!L || !L.clip || i <= 0) return null;
      for (var j = i - 1; j >= 0; j--) { if (layers[j].group !== L.group) return null; if (!layers[j].clip) return layers[j]; }
      return null;
    }
    // LAYER MASKS: a grey picture the size of the layer; where it's white the
    // layer shows, where it's black it's hidden, and grey half shows it. It's
    // painted on like any layer (L.mask.P stands in for the layer while it
    // is), and turned into a see-through-ness (L.mask.a) to show it
    function makeMask(L, fill) {
      var m = { cv: document.createElement('canvas'), a: document.createElement('canvas') };
      m.cv.width = m.a.width = L.cv.width; m.cv.height = m.a.height = L.cv.height;
      m.ctx = m.cv.getContext('2d', { willReadFrequently: true }); base(m.ctx);
      m.actx = m.a.getContext('2d', { willReadFrequently: true });
      m.ctx.fillStyle = fill || '#fff'; m.ctx.fillRect(0, 0, W, H);
      m.P = { cv: m.cv, ctx: m.ctx, bg: true, alphaLock: false, clip: false, opacity: 1, blend: 'normal', visible: true, text: null, name: L.name + ' mask', isMask: true, owner: L, mask: null };
      return m;
    }
    // (the grey, as see-through-ness: all of it, or just the parts that
    // changed; with the stroke still on the sheet laid over it, at alpha)
    var mScratch = document.createElement('canvas');
    function maskAlpha(L, rects, alpha) {
      var m = L.mask; if (!m) return;
      var Wd = m.cv.width, Hd = m.cv.height;
      (rects || [[0, 0, Wd, Hd]]).forEach(function (r) {
        var x0 = Math.max(0, Math.floor(r[0])), y0 = Math.max(0, Math.floor(r[1])), x1 = Math.min(Wd, Math.ceil(r[2])), y1 = Math.min(Hd, Math.ceil(r[3])), w = x1 - x0, h = y1 - y0;
        if (w <= 0 || h <= 0) return;
        if (mScratch.width < w || mScratch.height < h) { mScratch.width = Math.max(mScratch.width, w); mScratch.height = Math.max(mScratch.height, h); }
        var x = mScratch.getContext('2d', { willReadFrequently: true });
        x.globalCompositeOperation = 'copy'; x.globalAlpha = 1; x.drawImage(m.cv, x0, y0, w, h, 0, 0, w, h);
        if (alpha) { x.globalCompositeOperation = 'source-over'; x.globalAlpha = alpha; x.drawImage(ov, x0, y0, w, h, 0, 0, w, h); x.globalAlpha = 1; }
        var d = x.getImageData(0, 0, w, h), D = d.data;
        for (var i = 0; i < D.length; i += 4) { D[i + 3] = (D[i] * 77 + D[i + 1] * 150 + D[i + 2] * 29) >> 8; D[i] = D[i + 1] = D[i + 2] = 255; }
        m.actx.putImageData(d, x0, y0);
      });
    }
    // (a layer's look on screen: its paint, through its mask, through the
    // layer it's clipped to; made on a copy, all of it or just some parts)
    function usesView(L) { return !!(clipBase(L) || L.mask); }
    function viewOf(L, rects) {
      var b = clipBase(L); if (!b && !L.mask) return L.cv;
      var v = L.view;
      if (!v || v.width !== L.cv.width || v.height !== L.cv.height) { v = L.view = document.createElement('canvas'); v.width = L.cv.width; v.height = L.cv.height; rects = null; }
      v.style.width = W + 'px'; v.style.height = H + 'px';
      var x = v.getContext('2d'); x.save();
      if (rects) { x.beginPath(); rects.forEach(function (r) { x.rect(r[0], r[1], r[2] - r[0], r[3] - r[1]); }); x.clip(); }
      x.globalCompositeOperation = 'copy'; x.drawImage(L.cv, 0, 0);
      x.globalCompositeOperation = 'destination-in';
      if (L.mask) x.drawImage(L.mask.a, 0, 0);
      if (b) x.drawImage(b.mask ? b.view || viewOf(b) : b.cv, 0, 0);
      x.restore();
      return v;
    }
    // (made again straight after any change, so it never lags a frame behind)
    function viewsSoon() { layers.forEach(function (L) { if (usesView(L)) viewOf(L); }); }
    // GROUPS: layers side by side in the list can be put in a group (a
    // folder): L.group, shared by them all. A group is shown, hidden, faded
    // and blended as one, and can be folded shut in the list
    var gCount = 0;
    function makeGroup(name) { return { id: ++gCount, name: name || 'Group ' + gCount, open: true, visible: true, opacity: 1, blend: 'normal', el: null }; }
    function mount() {
      endFillAnim();
      stack.innerHTML = '';
      var G = null;
      layers.forEach(function (L) {
        var el = viewOf(L); styleLayer(L);
        if (L.group && L.group !== G) { G = L.group; G.el = document.createElement('div'); G.el.className = 'paint-gstack'; styleGroup(G); stack.appendChild(G.el); }
        else if (!L.group) G = null;
        (L.group ? L.group.el : stack).appendChild(el);
      });
      if (sel && sel.more) drawMore();
      renderLayers();
    }
    function styleGroup(G) {
      if (!G.el) return;
      G.el.style.visibility = G.visible ? '' : 'hidden';
      G.el.style.opacity = G.opacity < 1 ? G.opacity : '';
      G.el.style.mixBlendMode = G.blend !== 'normal' ? G.blend : '';
    }
    // a layer's see-through-ness and blend mode show as it's drawn on screen
    // (and are worked in the same way when the picture is saved); a clipped
    // layer is hidden with the layer it's clipped to, and a layer in a
    // hidden group with the group
    function shownVisible(L) { var b = clipBase(L); return L.visible && (!b || b.visible) && (!L.group || L.group.visible); }
    function styleLayer(L) {
      var el = usesView(L) ? L.view || viewOf(L) : L.cv;
      el.style.visibility = (L.visible && (!clipBase(L) || clipBase(L).visible)) && !L.editing && !L.anim ? '' : 'hidden'; // (a text layer being typed into shows as the words being typed)
      el.style.opacity = L.opacity < 1 ? L.opacity : '';
      el.style.mixBlendMode = L.blend !== 'normal' ? L.blend : '';
    }
    // every visible layer, laid one on another (with its opacity and blend
    // mode, and its group's), onto a canvas: for saving, sharing and picking colours
    function flattenInto(x, sx, sy, sw, sh, dw, dh) {
      var put = function (c, src, alpha, blend) {
        c.save(); c.globalAlpha = alpha; if (blend !== 'normal') c.globalCompositeOperation = blend;
        if (sw == null) c.drawImage(src, 0, 0); else c.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh);
        c.restore();
      };
      for (var i = 0; i < layers.length; i++) {
        var L = layers[i], G = L.group;
        if (!G) { if (shownVisible(L)) put(x, viewOf(L), L.opacity, L.blend); continue; }
        // (a group: its layers together on a sheet of their own, then that, as one)
        var t = document.createElement('canvas'); t.width = sw == null ? x.canvas.width : dw; t.height = sw == null ? x.canvas.height : dh;
        var tx = t.getContext('2d');
        for (; i < layers.length && layers[i].group === G; i++) if (shownVisible(layers[i])) put(tx, viewOf(layers[i]), layers[i].opacity, layers[i].blend);
        i--;
        if (G.visible) { x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = G.opacity; if (G.blend !== 'normal') x.globalCompositeOperation = G.blend; x.drawImage(t, 0, 0); x.restore(); }
      }
    }
    // THE PICTURE'S SIZE, in real pixels (what a saved PNG comes out at);
    // on screen it's that over the pixel ratio
    function setDoc(pw, ph) {
      W = pw / R; H = ph / R;
      world.style.width = W + 'px'; world.style.height = H + 'px';
      ov.width = sov.width = pw; ov.height = sov.height = ph;
      ov.style.width = sov.style.width = W + 'px'; ov.style.height = sov.style.height = H + 'px';
      base(octx); base(sctx); drawGuide();
    }
    layers.push(makeLayer('Background', true)); active = layers[0]; mount();
    // (every layer can be deleted; drawing on the empty, see-through picture
    // then makes a new one, numbered from 1 again)
    function need() {
      if (active) return active;
      layers.push(makeLayer('Layer ' + (++count), false)); active = layers[0]; mount();
      return active;
    }

    function applyView() {
      world.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px)' + (view.r ? ' rotate(' + view.r + 'rad)' : '') + ' scale(' + view.k + ')';
      zoomVal.textContent = Math.round(view.k / fitK * 100) + '%';
      placeSelectionToolbar();
      if (textBox) placeTextBox();
      if (lasso && lasso.length) drawLasso(lassoHover); else if (sel && uctx) drawSelUi();
      placeSelX(); placeSelDist(); placeSymHandles(); gridDraw(); if (hoverPick && hoverPick.ev && !down) loupeShow(hoverPick, hoverPick.ev, pos(hoverPick.ev)); if (grad) { gradMarks(); gradZoomed(); }
    }
    // the zoom buttons sit above SAVE; on a phone (no room there) they sit
    // in the picture's corner instead
    // (the zoom buttons sit in the picture's bottom right corner)
    function phoneLayout() { return window.matchMedia('(max-width: 560px)').matches; }
    function placeZoom() {}
    // ("100%": as big as the space allows, with the same margin of the dotted
    // well all round, narrower on a phone; fillK just fills the space, and
    // is the first step in)
    function fitTo(sw, sh) {
      var m = phoneLayout() ? 10 : 34;
      fillK = Math.min(sw / W, sh / H) * 0.99;
      fitK = Math.max(fillK * 0.5, Math.min(fillK, (sw - 2 * m) / W, (sh - 2 * m) / H));
    }
    function fit() {
      placeZoom();
      var sw = stage.clientWidth, sh = stage.clientHeight;
      if (!sw || !sh) return;
      fitTo(sw, sh);
      view.k = fitK; view.r = 0; view.x = (sw - W * fitK) / 2; view.y = (sh - H * fitK) / 2; lastStage = { w: sw, h: sh };
      applyView();
    }
    // (the window changed size: the whole picture stays the whole picture;
    // zoomed in, the same spot stays in the middle at the same zoom)
    var lastStage = null;
    // (keep: the zoom stays as it is even when the whole picture was in
    // view, as focus mode's space grows and shrinks)
    function refit(keep) {
      var sw = stage.clientWidth, sh = stage.clientHeight, was = lastStage;
      if (!sw || !sh) return;
      if (!was || (!keep && !textBox && !view.r && Math.abs(view.k - fitK) < fitK * 0.002)) { fit(); return; }
      fitTo(sw, sh);
      view.x += (sw - was.w) / 2; view.y += (sh - was.h) / 2; lastStage = { w: sw, h: sh }; applyView();
    }
    // (the workspace easing to a new size: the picture is fitted to it a
    // frame at a time, until el's transition is over)
    var easeAnim = 0, easeEnd = 0;
    function refitWhile(el, keep) {
      cancelAnimationFrame(easeAnim); clearTimeout(easeEnd);
      var dur = (parseFloat(getComputedStyle(el).transitionDuration) || 0) * 1000, t0 = performance.now();
      (function frame(t) { refit(keep); if (t - t0 < dur + 34) easeAnim = requestAnimationFrame(frame); })(t0);
      easeEnd = setTimeout(function () { cancelAnimationFrame(easeAnim); refit(keep); relayout(); }, dur + 60);
    }
    function zoomAt(k, cx, cy) {
      k = Math.max(fitK * 0.25, Math.min(fitK * 10, k));
      view.x = cx - (cx - view.x) * k / view.k; view.y = cy - (cy - view.y) * k / view.k; view.k = k;
      applyView();
    }
    // a panel that drops down under a button in the top bar, lined up with
    // its right edge (or wherever it was last dragged to)
    function dropUnder(el, btn) {
      btn = hdrBtn(btn); if (!btn) return;
      var r = btn.getBoundingClientRect(), vw = document.documentElement.clientWidth;
      el.style.top = Math.round(r.bottom + 8) + 'px';
      el.style.left = Math.round(Math.max(8, Math.min(vw - el.offsetWidth - 8, r.right - el.offsetWidth + 4))) + 'px';
      keepOnScreen(el);
    }
    // (a button in the folded top bar can't be seen: what it opens drops
    // down from the bar's arrow instead)
    function hdrBtn(btn) { return btn && !document.documentElement.classList.contains('hdr-open') && btn.closest('.site-header') ? document.querySelector('.hdr-fold') || btn : btn; }
    // a panel that opens beside a button in the left bar, at its height
    // (towards the picture)
    function besideBar(el, btn) {
      if (!btn) return;
      var r = btn.getBoundingClientRect(), bar = btn.closest('.paint-bar') || btn, b = bar.getBoundingClientRect(), vw = document.documentElement.clientWidth, g = narrow() ? 6 : 10;
      var x = uiFlipped() ? b.left - el.offsetWidth - g : b.right + g;
      el.style.left = Math.round(Math.max(8, Math.min(vw - el.offsetWidth - 8, x))) + 'px';
      el.style.top = Math.round(Math.max(8, Math.min(window.innerHeight - el.offsetHeight - 8, r.top - 12))) + 'px';
      keepOnScreen(el);
    }
    // the zoom buttons: steps of 25%, but the first step in lands exactly on
    // filling the space (and stepping back out stops there and at 100%)
    function zoomStep(dir) {
      var k = view.k, t = k * (dir > 0 ? 1.25 : 0.8), e = 1e-4;
      if (dir > 0 && k < fillK - e && t > fillK) t = fillK;
      if (dir < 0 && k > fillK + e && t < fillK) t = fillK;
      if (dir < 0 && k > fitK + e && t < fitK) t = fitK;
      zoomAt(t, stage.clientWidth / 2, stage.clientHeight / 2);
    }
    // the picture on the screen: moved, turned (two fingers can turn it) and
    // zoomed. A point on the picture to the screen (in the stage), and back.
    function toScreen(p) { var c = Math.cos(view.r), s = Math.sin(view.r); return { x: view.x + view.k * (c * p.x - s * p.y), y: view.y + view.k * (s * p.x + c * p.y) }; }
    function fromScreen(sx, sy) { var c = Math.cos(view.r), s = Math.sin(view.r), dx = (sx - view.x) / view.k, dy = (sy - view.y) / view.k; return { x: c * dx + s * dy, y: -s * dx + c * dy }; }
    function pos(e) { var r = stage.getBoundingClientRect(); return fromScreen(e.clientX - r.left, e.clientY - r.top); }

    // ---- PANELS THAT CAN BE DRAGGED: by their title (or grip). Where each was
    // left is remembered; a double-click on the title puts it back. ----
    function panelOffset(el) { var t = (el.style.translate || '0px 0px').split(' '); return { x: parseFloat(t[0]) || 0, y: parseFloat(t[1]) || 0 }; }
    // (within the window, or within the box given: the tool panel stays on the picture's area)
    function narrow() { return document.documentElement.clientWidth <= 560; }
    function keepOnScreen(el, within) {
      if (el.hidden) return;
      var r = el.getBoundingClientRect(), o = panelOffset(el), dx = 0, dy = 0;
      if (typeof within === 'function') within = within();
      var B = within ? within.getBoundingClientRect() : { left: 0, top: 0, right: document.documentElement.clientWidth, bottom: window.innerHeight };
      if (r.right > B.right - 6) dx = B.right - 6 - r.right; if (r.left + dx < B.left + 6) dx = B.left + 6 - r.left;
      if (r.bottom > B.bottom - 6) dy = B.bottom - 6 - r.bottom; if (r.top + dy < B.top + 6) dy = B.top + 6 - r.top;
      if (dx || dy) el.style.translate = (o.x + dx) + 'px ' + (o.y + dy) + 'px';
    }
    // (btnHandle: a button that can be dragged too; a press that doesn't move
    // is still a click. moved: told when it's been dragged, or put back)
    function draggable(el, handle, key, btnHandle, within, moved0) {
      try { var saved = JSON.parse(localStorage.getItem('paint-pos-' + key)); if (saved) { el.style.translate = saved[0] + 'px ' + saved[1] + 'px'; requestAnimationFrame(function () { keepOnScreen(el, within); }); } } catch (x) {}
      el.addEventListener('pointerdown', function (e) {
        if (el.classList.contains('locked')) return; // (locked in its place)
        var bh = btnHandle && e.target.closest(btnHandle);
        var h = bh || e.target.closest(handle);
        if (!h || !el.contains(h) || e.button || (!bh && e.target.closest('button, input, select, textarea, a, [data-nodrag]'))) return;
        if (!bh) e.preventDefault();
        e.stopPropagation();
        var o = panelOffset(el), sx = e.clientX, sy = e.clientY, moved = !bh;
        // (it stops at the edge: it can't be dragged out of sight)
        var W0 = typeof within === 'function' ? within() : within;
        var r0 = el.getBoundingClientRect(), B = W0 ? W0.getBoundingClientRect() : { left: 0, top: 0, right: document.documentElement.clientWidth, bottom: window.innerHeight };
        var lim = { x0: B.left + 6 - r0.left, x1: Math.max(B.left + 6 - r0.left, B.right - 6 - r0.right), y0: B.top + 6 - r0.top, y1: Math.max(B.top + 6 - r0.top, B.bottom - 6 - r0.bottom) };
        var clampTo = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
        if (moved) { el.classList.add('dragging'); hideTip(); }
        try { h.setPointerCapture(e.pointerId); } catch (x) {}
        function mv(ev) {
          if (!moved) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return; moved = true; el.classList.add('dragging'); hideTip(); }
          el.style.translate = (o.x + clampTo(ev.clientX - sx, lim.x0, lim.x1)) + 'px ' + (o.y + clampTo(ev.clientY - sy, lim.y0, lim.y1)) + 'px';
        }
        function up() {
          h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
          if (!moved) return;
          // (a dragged button isn't clicked as well)
          if (bh) { var stop = function (ce) { ce.stopPropagation(); ce.preventDefault(); }; bh.addEventListener('click', stop, true); setTimeout(function () { bh.removeEventListener('click', stop, true); }, 0); }
          el.classList.remove('dragging'); keepOnScreen(el, within);
          var q = panelOffset(el); try { localStorage.setItem('paint-pos-' + key, JSON.stringify([q.x, q.y])); } catch (x) {}
          if (moved0) moved0();
        }
        h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
      });
      el.addEventListener('dblclick', function (e) {
        if (!e.target.closest(handle) || e.target.closest('button, input, select')) return;
        el.style.translate = ''; try { localStorage.removeItem('paint-pos-' + key); } catch (x) {}
        if (moved0) moved0();
      });
    }
    // ---- colours ----
    function setColor(c) {
      st.color = c; colorDot.style.background = c; pcSync('main'); if (textBox) styleTextBox(); brushSamples(); if (grad) gradTint(c);
      if (typeof adj !== 'undefined' && adj && adj.v.gmap === 'colours') adjustQueue(); // (the gradient map made from the colours follows them)
    }
    function setColor2(c) { st.color2 = c; color2Dot.style.background = c; if (textBox) styleTextBox(); pcSync('second'); if (typeof adj !== 'undefined' && adj && adj.v.gmap === 'colours') adjustQueue(); }
    // the colours used lately, in the colour picker (kept for next time)
    function pushRecent(c) {
      c = c.toLowerCase();
      recent = [c].concat(recent.filter(function (x) { return x !== c; })).slice(0, 12);
      storeIt('paint-recent-colours', recent);
    }
    function useColor() { pushRecent(st.color); }
    // ---- THE COLOUR PICKER. A tap on either of the two colours opens it
    // (dragging one still drops it onto the picture). A ring for the hue,
    // round a square for how rich (left to right) and how bright (top to
    // bottom) the colour is; sliders for those two; its values as HEX, RGB
    // or HSB to type in; the colours used lately; and palettes, some ready
    // made and your own (kept in this browser). Everything changes the
    // colour as you go. ----
    function hsv2rgb(h, s, v) { var f = function (n) { var k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); }; return [f(5), f(3), f(1)]; }
    function rgb2hsv(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
      if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
    }
    function hex2rgb(x) { var c = parseInt(x.slice(1), 16); return [c >> 16 & 255, c >> 8 & 255, c & 255]; }
    function rgb2hex(r, g, b) { return '#' + [r, g, b].map(function (v) { return (Math.max(0, Math.min(255, Math.round(v))) | 256).toString(16).slice(1); }).join(''); }
    function stored(key, def) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (x) { return def; } }
    function storeIt(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (x) {} }
    var READY_PALETTES = [
      { name: 'Basics', colors: SWATCHES, ready: true },
      { name: 'Greys', colors: ['#000000', '#1c1c1e', '#3a3a3c', '#545456', '#6e6e73', '#8e8e93', '#aeaeb2', '#c7c7cc', '#d1d1d6', '#e5e5ea', '#f2f2f7', '#ffffff'], ready: true },
      { name: 'Pastels', colors: ['#ffd1dc', '#ffdfc4', '#fff1b8', '#e2f5c4', '#c4ecd6', '#c2e6f2', '#c9d6ff', '#dccbff', '#f3c9f0', '#f7e1d0', '#e8e4d8', '#d9e4dd'], ready: true },
      { name: 'Earth', colors: ['#3e2723', '#5d4037', '#795548', '#8d6e63', '#a1887f', '#c2a878', '#deb887', '#cd853f', '#a0522d', '#6b8e23', '#556b2f', '#2f4f4f'], ready: true },
      { name: 'Skin', colors: ['#3b2219', '#5c3a21', '#8d5524', '#a16e4b', '#c68642', '#d4aa78', '#e0ac69', '#e6bc98', '#f1c27d', '#ffcd94', '#ffdbac', '#ffe0bd'], ready: true }
    ];
    var myPalettes = stored('paint-palettes', [{ name: 'My Colours', colors: [] }]);
    var palIndex = stored('paint-palette', READY_PALETTES.length);
    recent = stored('paint-recent-colours', []).filter(function (c) { return /^#[0-9a-f]{6}$/.test(c); }).slice(0, 12);
    function palettes() { return READY_PALETTES.concat(myPalettes); }
    // (colours that go with the one picked: round the hue ring from it)
    var HARMONIES = [['complementary', 'Complementary'], ['split', 'Split Complementary'], ['analogous', 'Analogous'], ['triadic', 'Triadic'], ['square', 'Square']];
    var HARM_TURNS = { complementary: [0, 180], split: [0, 150, 210], analogous: [-30, 0, 30], triadic: [0, 120, 240], square: [0, 90, 180, 270] };
    var harmony = stored('paint-harmony', 'complementary');
    var pc = document.createElement('div'), pcWhich = 'main', pcMode = stored('paint-colour-values', 'hex'), hsv = [0, 0, 0], pcWas = null;
    pc.className = 'paint-colorpanel'; pc.hidden = true; pc.setAttribute('role', 'dialog'); pc.setAttribute('aria-label', 'Colour');
    // (in the dock it has the tool settings' own top: their lock, a grip to
    // move it by while unlocked, and a button that folds the menu away)
    var pcTop = '<div class="pc-top"><span class="ctx-grip" aria-hidden="true" data-tip="Drag to move (double-click: back to its place)"></span>' +
      ($('.paint-ctx .ctx-lock') ? $('.paint-ctx .ctx-lock').outerHTML : '') +
      '<button type="button" class="ctx-min" aria-label="Fold the menu away" data-tip="Fold the menu away"><svg class="cm-hide" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg></button></div>';
    pc.innerHTML = pcTop +
      '<div class="pc-grab" aria-hidden="true" data-tip="Drag to move (double-click: back in place)"></div>' +
      '<div class="pc-head">' +
        '<div class="pa-tabs pc-which" role="tablist"><button type="button" role="tab" data-pc-which="main"><i></i>Main</button><button type="button" role="tab" data-pc-which="second"><i></i>Second</button></div>' +
        '<div class="pc-compare"><button type="button" class="pc-was" title="Go back to the colour before" aria-label="Go back to the colour before"></button><span class="pc-now"></span></div>' +
      '</div>' +
      '<div class="pc-disc"><canvas aria-hidden="true"></canvas><i class="pc-knob pc-hk"></i><i class="pc-knob pc-sk"></i></div>' +
      '<label class="pa-row pc-slide"><span>Saturation</span><output></output><input type="range" min="0" max="100" data-pc="s"></label>' +
      '<label class="pa-row pc-slide"><span>Brightness</span><output></output><input type="range" min="0" max="100" data-pc="v"></label>' +
      '<div class="pa-tabs pc-mode" role="tablist"><button type="button" role="tab" data-pc-mode="hex">HEX</button><button type="button" role="tab" data-pc-mode="rgb">RGB</button><button type="button" role="tab" data-pc-mode="hsb">HSB</button></div>' +
      '<div class="pc-values"></div>' +
      '<div class="pc-h pc-hrow"><span>Harmony</span><select class="p-field pc-harm" aria-label="Colour harmony">' +
        HARMONIES.map(function (h) { return '<option value="' + h[0] + '">' + h[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="pc-grid pc-harmony"></div>' +
      '<div class="pc-h">Recent</div><div class="pc-grid pc-recent"></div>' +
      '<div class="pc-palhead"><select class="p-field pc-pal" aria-label="Palette"></select>' +
        '<button type="button" class="pc-icon" data-pc-act="new" title="New palette" aria-label="New palette"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg></button>' +
        '<button type="button" class="pc-icon" data-pc-act="photo" title="New palette from a photo" aria-label="New palette from a photo"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="13" rx="2"/><circle cx="9.5" cy="11" r="1.6"/><path d="M5 17.5l4.5-4 3 2.5 3-3 3.5 3.5"/></svg></button>' +
        '<button type="button" class="pc-icon" data-pc-act="delete" title="Delete this palette" aria-label="Delete this palette"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg></button></div>' +
      '<div class="pc-grid pc-swatches"></div>' +
      '<p class="pc-note"></p>';
    bbar.appendChild(pc);
    draggable(pc, '.pc-grab', 'colour');
    var pcDisc = pc.querySelector('.pc-disc canvas'), pcHK = pc.querySelector('.pc-hk'), pcSK = pc.querySelector('.pc-sk');
    var DISC = 0, RING = 20, SQ = 0, SQ0 = 0;
    var ringImg = null;
    // (its size: 212 under the bottom bar, the dock's width less its edges in the dock)
    function discSize(n) {
      if (n === DISC) return;
      DISC = n; SQ = Math.floor((DISC / 2 - RING - 7) * Math.SQRT2); SQ0 = (DISC - SQ) / 2; ringImg = null;
      var d = pcDisc.parentNode; d.style.width = d.style.height = pcDisc.style.width = pcDisc.style.height = n + 'px';
      if (!pc.hidden) pcShow();
    }
    discSize(212);
    function drawDisc() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), c = pcDisc.getContext('2d'), m = DISC / 2;
      if (pcDisc.width !== DISC * dpr) { pcDisc.width = pcDisc.height = DISC * dpr; ringImg = null; }
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, DISC, DISC);
      if (!ringImg) {
        // (the hue ring, in fine slices, drawn once and kept)
        ringImg = document.createElement('canvas'); ringImg.width = ringImg.height = DISC * dpr;
        var r = ringImg.getContext('2d'); r.setTransform(dpr, 0, 0, dpr, 0, 0);
        for (var a = 0; a < 360; a += 0.5) {
          r.beginPath(); r.moveTo(m, m); r.arc(m, m, m, (a - 90.4) * Math.PI / 180, (a - 89.4) * Math.PI / 180); r.closePath();
          r.fillStyle = 'hsl(' + a + ',100%,50%)'; r.fill();
        }
        r.globalCompositeOperation = 'destination-out'; r.beginPath(); r.arc(m, m, m - RING, 0, Math.PI * 2); r.fill();
      }
      c.drawImage(ringImg, 0, 0, DISC, DISC);
      // (the square: the hue, washed to white to the left and darkened to black towards the bottom)
      var x0 = SQ0, y0 = SQ0, g;
      c.save(); c.beginPath(); if (c.roundRect) c.roundRect(x0, y0, SQ, SQ, 8); else c.rect(x0, y0, SQ, SQ); c.clip();
      c.fillStyle = 'hsl(' + hsv[0] + ',100%,50%)'; c.fillRect(x0, y0, SQ, SQ);
      g = c.createLinearGradient(x0, 0, x0 + SQ, 0); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x0, y0, SQ, SQ);
      g = c.createLinearGradient(0, y0, 0, y0 + SQ); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, '#000'); c.fillStyle = g; c.fillRect(x0, y0, SQ, SQ);
      c.restore();
    }
    function pcColor() { var c = hsv2rgb(hsv[0], hsv[1], hsv[2]); return rgb2hex(c[0], c[1], c[2]); }
    function pcTarget() { return pcWhich === 'main' ? st.color : st.color2; }
    // show it all for the colour as it is now (but not over the box being typed in)
    function pcShow(skip) {
      var hex = pcColor(), a = (hsv[0] - 90) * Math.PI / 180, mr = DISC / 2 - RING / 2;
      drawDisc();
      pcHK.style.translate = (DISC / 2 + Math.cos(a) * mr) + 'px ' + (DISC / 2 + Math.sin(a) * mr) + 'px';
      pcHK.style.background = 'hsl(' + hsv[0] + ',100%,50%)';
      pcSK.style.translate = (SQ0 + hsv[1] * SQ) + 'px ' + (SQ0 + (1 - hsv[2]) * SQ) + 'px';
      pcSK.style.background = hex;
      var s = pc.querySelector('[data-pc="s"]'), v = pc.querySelector('[data-pc="v"]'), full = hsv2rgb(hsv[0], 1, hsv[2]), lit = hsv2rgb(hsv[0], hsv[1], 1);
      s.value = Math.round(hsv[1] * 100); v.value = Math.round(hsv[2] * 100);
      s.previousElementSibling.textContent = s.value; v.previousElementSibling.textContent = v.value;
      s.style.setProperty('--track', 'linear-gradient(90deg,' + rgb2hex.apply(null, hsv2rgb(hsv[0], 0, hsv[2])) + ',' + rgb2hex.apply(null, full) + ')');
      v.style.setProperty('--track', 'linear-gradient(90deg,#000,' + rgb2hex.apply(null, lit) + ')');
      pc.querySelector('.pc-now').style.background = hex;
      pc.querySelector('.pc-was').style.background = pcWas || hex;
      pc.querySelector('[data-pc-which="main"] i').style.background = st.color;
      pc.querySelector('[data-pc-which="second"] i').style.background = st.color2;
      Array.prototype.forEach.call(pc.querySelectorAll('[data-pc-which]'), function (b) { b.setAttribute('aria-selected', b.dataset.pcWhich === pcWhich ? 'true' : 'false'); });
      Array.prototype.forEach.call(pc.querySelectorAll('[data-pc-mode]'), function (b) { b.setAttribute('aria-selected', b.dataset.pcMode === pcMode ? 'true' : 'false'); });
      var vals = pc.querySelector('.pc-values'), rgb = hex2rgb(hex);
      if (vals.dataset.mode !== pcMode) {
        vals.dataset.mode = pcMode;
        var fld = function (k, label, max) { return '<label><span>' + label + '</span><input class="p-field" data-pcv="' + k + '" ' + (max ? 'type="number" inputmode="numeric" min="0" max="' + max + '"' : 'type="text" maxlength="7" spellcheck="false" autocomplete="off" autocapitalize="off"') + '></label>'; };
        vals.innerHTML = pcMode === 'hex' ? fld('hex', 'Hex', 0) : pcMode === 'rgb' ? fld('r', 'R', 255) + fld('g', 'G', 255) + fld('b', 'B', 255) : fld('h', 'H °', 360) + fld('s', 'S %', 100) + fld('v', 'B %', 100);
      }
      var set = function (k, v2) { var i = vals.querySelector('[data-pcv="' + k + '"]'); if (i && i !== skip) i.value = v2; };
      set('hex', hex.toUpperCase()); set('r', rgb[0]); set('g', rgb[1]); set('b', rgb[2]);
      set('h', Math.round(hsv[0])); set('s', Math.round(hsv[1] * 100)); set('v', Math.round(hsv[2] * 100));
      // (the lists are only made again when what's in them changes, so a
      // click on one is never lost to it being remade under the pointer)
      var sw = function (c, i) { return '<button type="button" data-pc-color="' + c + '"' + (i != null ? ' data-pc-i="' + i + '"' : '') + ' style="background:' + c + '" aria-label="Colour ' + c + '"></button>'; };
      var fill = function (el, html) { if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } };
      pc.querySelector('.pc-harm').value = harmony;
      fill(pc.querySelector('.pc-harmony'), (HARM_TURNS[harmony] || [0]).map(function (t) { var c3 = hsv2rgb((hsv[0] + t + 360) % 360, hsv[1], hsv[2]); return sw(rgb2hex(c3[0], c3[1], c3[2])); }).join(''));
      fill(pc.querySelector('.pc-recent'), recent.length ? recent.map(function (c) { return sw(c); }).join('') : '<span class="pc-empty">Colours you use show up here</span>');
      var P = palettes(), p = P[Math.max(0, Math.min(P.length - 1, palIndex))];
      var sel2 = pc.querySelector('.pc-pal');
      fill(sel2, P.map(function (q, i) { return '<option value="' + i + '">' + q.name.replace(/</g, '&lt;') + '</option>'; }).join(''));
      sel2.value = String(P.indexOf(p));
      fill(pc.querySelector('.pc-swatches'), p.colors.map(function (c, i) { return sw(c, p.ready ? null : i); }).join('') +
        (p.ready ? '' : '<button type="button" class="pc-add" data-pc-act="add" title="Add this colour to the palette" aria-label="Add this colour to the palette"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v10M7 12h10"/></svg></button>'));
      var cur = hex.toLowerCase();
      Array.prototype.forEach.call(pc.querySelectorAll('[data-pc-color]'), function (b) { b.classList.toggle('on', b.dataset.pcColor.toLowerCase() === cur); });
      pc.querySelector('[data-pc-act="delete"]').disabled = !!p.ready || myPalettes.length < 2;
      pc.querySelector('.pc-note').textContent = p.ready ? 'A ready-made palette. Use + up here to start your own.' : 'Tap + in the grid to add the colour. Right-click (or press and hold) a colour to take it out.';
    }
    // a new colour: from the ring, the square, a slider or a box
    var pcBusy = false;
    function pcSet(h, s, v, skip) {
      hsv = [h, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, v))];
      var hex = pcColor(); pcBusy = true;
      if (pcWhich === 'main') setColor(hex);
      else setColor2(hex);
      pcBusy = false; pcShow(skip);
    }
    // (the colour changed some other way while it's open: a swatch, the colour picker tool, swapping)
    function pcSync(which) {
      if (!pc || pc.hidden || pcBusy || which !== pcWhich) return;
      var c = hex2rgb(pcTarget()), x = rgb2hsv(c[0], c[1], c[2]);
      hsv = [x[1] && x[2] ? x[0] : hsv[0], x[1], x[2]]; pcShow();
    }
    function pcFrom(hex, skip) { var c = hex2rgb(hex), x = rgb2hsv(c[0], c[1], c[2]); pcSet(x[1] && x[2] ? x[0] : hsv[0], x[1], x[2], skip); }
    function pcLoad() {
      // (from the colour itself; a grey keeps the hue it had, so it isn't lost)
      var c = hex2rgb(pcTarget()), x = rgb2hsv(c[0], c[1], c[2]);
      hsv = [x[1] && x[2] ? x[0] : hsv[0], x[1], x[2]]; pcWas = pcTarget(); pcShow();
    }
    // (it opens above the bottom bar, its middle over the two colours, as
    // far as the window allows; on a phone, along the bottom of the screen)
    function placePicker() {
      if (phoneLayout() || pc.parentNode === dock) { pc.style.left = ''; return; }
      var b = $('.paint-pair'), br = bbar.getBoundingClientRect(), pr = b.getBoundingClientRect(), vw = document.documentElement.clientWidth;
      var x = pr.left + pr.width / 2 - pc.offsetWidth / 2;
      x = Math.max(8, Math.min(vw - pc.offsetWidth - 8, x));
      pc.style.left = Math.round(x - br.left) + 'px';
    }
    function picker(which) {
      if (which && !pc.hidden && pcWhich === which) { minimizeToolMenu(); return; }
      if (which) {
        if (!pc.hidden) pcDone();
        if (anyMenu()) openMenu(null); if (!panel.hidden) layerPanel(false); if (adj) adjustDone();
        if (typeof bsBox !== 'undefined' && !bsBox.hidden) studio(false);
        pcWhich = which; pc.hidden = false; pcLoad(); placePicker(); if (pc.parentNode === dock) dockPlace(pc); else keepOnScreen(pc);
      } else if (!pc.hidden) { pcDone(); pc.hidden = true; }
      pairOpen(); ctxAside(); if (ctxEl) dockSync(ctxReady);
    }
    function pairOpen() {
      $('.paint-current').setAttribute('aria-expanded', !pc.hidden && pcWhich === 'main' ? 'true' : 'false');
      $('.paint-second').setAttribute('aria-expanded', !pc.hidden && pcWhich === 'second' ? 'true' : 'false');
    }
    // (a colour picked and kept goes into the recent ones)
    function pcDone() { if (pcWas && pcTarget().toLowerCase() !== pcWas.toLowerCase()) pushRecent(pcTarget()); }
    // dragging round the ring, or about the square
    pcDisc.parentNode.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      var el = pcDisc.parentNode, r0 = el.getBoundingClientRect(), k = r0.width / DISC;
      var at = function (ev) { return { x: (ev.clientX - r0.left) / k, y: (ev.clientY - r0.top) / k }; };
      var p = at(e), d = Math.hypot(p.x - DISC / 2, p.y - DISC / 2), ring = d > DISC / 2 - RING - 4;
      if (d > DISC / 2 + 4) return;
      if (!ring && (p.x < SQ0 - 8 || p.y < SQ0 - 8 || p.x > SQ0 + SQ + 8 || p.y > SQ0 + SQ + 8)) return;
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      el.classList.add('held');
      function mv(ev) {
        var q = at(ev);
        if (ring) pcSet((Math.atan2(q.x - DISC / 2, -(q.y - DISC / 2)) * 180 / Math.PI + 360) % 360, hsv[1], hsv[2]);
        else pcSet(hsv[0], (q.x - SQ0) / SQ, 1 - (q.y - SQ0) / SQ);
      }
      function up() { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.classList.remove('held'); }
      mv(e); el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
    pc.addEventListener('input', function (e) {
      var t = e.target;
      if (t.dataset.pc === 's') pcSet(hsv[0], t.value / 100, hsv[2], t);
      else if (t.dataset.pc === 'v') pcSet(hsv[0], hsv[1], t.value / 100, t);
      else if (t.dataset.pcv === 'hex') { var m = t.value.trim().replace(/^#?/, '#'); if (/^#[0-9a-f]{3}$/i.test(m)) m = '#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]; if (/^#[0-9a-f]{6}$/i.test(m)) pcFrom(m.toLowerCase(), t); }
      else if (/^[rgb]$/.test(t.dataset.pcv || '') && t.value !== '') { var vs = pc.querySelectorAll('[data-pcv]'), c = Array.prototype.map.call(vs, function (i) { return Math.max(0, Math.min(255, +i.value || 0)); }); pcFrom(rgb2hex(c[0], c[1], c[2]), t); }
      else if (/^[hsv]$/.test(t.dataset.pcv || '') && t.value !== '') { var w = Array.prototype.map.call(pc.querySelectorAll('[data-pcv]'), function (i) { return +i.value || 0; }); pcSet(Math.max(0, Math.min(360, w[0])) % 360, w[1] / 100, w[2] / 100, t); }
    });
    // (leaving a box tidies what was typed into it)
    pc.addEventListener('change', function (e) { if (e.target.dataset.pcv) pcShow(); });
    pc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); picker(null); return; }
      if (e.key === 'Enter' && e.target.dataset.pcv) { e.preventDefault(); e.target.blur(); }
      e.stopPropagation();
    });
    pc.querySelector('.pc-pal').addEventListener('change', function (e) { palIndex = +e.target.value; storeIt('paint-palette', palIndex); pcShow(); });
    pc.querySelector('.pc-harm').addEventListener('change', function (e) { harmony = e.target.value; storeIt('paint-harmony', harmony); pcShow(); });
    // A PALETTE FROM A PHOTO: its main colours, the most used first, but
    // each one clearly different from those already taken
    var photoIn = document.createElement('input'); photoIn.type = 'file'; photoIn.accept = 'image/*'; photoIn.hidden = true; pc.appendChild(photoIn);
    photoIn.addEventListener('change', function () {
      var f = photoIn.files && photoIn.files[0]; photoIn.value = ''; if (!f) return;
      var im = new Image(), url = URL.createObjectURL(f);
      im.onerror = function () { URL.revokeObjectURL(url); toast('That picture couldn’t be opened'); };
      im.onload = function () {
        URL.revokeObjectURL(url);
        var S = 72, k = Math.min(1, S / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h; var x = cv.getContext('2d'); x.drawImage(im, 0, 0, w, h);
        var d = x.getImageData(0, 0, w, h).data, bins = {};
        for (var i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 128) continue;
          var key = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4), b = bins[key] || (bins[key] = { n: 0, r: 0, g: 0, b: 0 });
          b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
        }
        var list = Object.keys(bins).map(function (q) { var b = bins[q]; return { n: b.n, c: [b.r / b.n, b.g / b.n, b.b / b.n] }; }).sort(function (a, b) { return b.n - a.n; });
        var picked = [];
        for (var t = 0; t < list.length && picked.length < 12; t++) {
          var c = list[t].c;
          if (picked.every(function (q) { return Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]) > 42; })) picked.push(c);
        }
        if (!picked.length) { toast('No colours found in that picture'); return; }
        var n = 1; while (myPalettes.some(function (q) { return q.name === 'Photo ' + n; })) n++;
        myPalettes.push({ name: 'Photo ' + n, colors: picked.map(function (c) { return rgb2hex(c[0], c[1], c[2]); }) });
        palIndex = READY_PALETTES.length + myPalettes.length - 1;
        storeIt('paint-palettes', myPalettes); storeIt('paint-palette', palIndex); pcShow();
        toast('Made a palette from the photo');
      };
      im.src = url;
    });
    pc.addEventListener('click', function (e) {
      if (e.target.closest('.pc-top .ctx-lock')) { lockToggle(); return; }
      if (e.target.closest('.pc-top .ctx-min')) { picker(null); if (!ctxEl.classList.contains('min')) ctxMin(true); return; }
      var w = e.target.closest('[data-pc-which]'); if (w) { if (w.dataset.pcWhich !== pcWhich) { pcDone(); pcWhich = w.dataset.pcWhich; pcLoad(); pairOpen(); } return; }
      var md = e.target.closest('[data-pc-mode]'); if (md) { pcMode = md.dataset.pcMode; storeIt('paint-colour-values', pcMode); pcShow(); return; }
      if (e.target.closest('.pc-was')) { if (pcWas) pcFrom(pcWas); return; }
      var c = e.target.closest('[data-pc-color]'); if (c) { pcFrom(c.dataset.pcColor); return; }
      var a = e.target.closest('[data-pc-act]'); if (!a) return;
      var P = palettes(), p = P[Math.max(0, Math.min(P.length - 1, palIndex))];
      if (a.dataset.pcAct === 'add' && !p.ready) { var hex = pcColor(); if (p.colors.indexOf(hex) < 0) p.colors.push(hex); }
      else if (a.dataset.pcAct === 'photo') { photoIn.click(); return; }
      else if (a.dataset.pcAct === 'new') {
        var n = 1; while (myPalettes.some(function (q) { return q.name === 'Palette ' + n; })) n++;
        myPalettes.push({ name: 'Palette ' + n, colors: [pcColor()] }); palIndex = READY_PALETTES.length + myPalettes.length - 1;
      }
      else if (a.dataset.pcAct === 'delete' && !p.ready && myPalettes.length > 1) { myPalettes.splice(myPalettes.indexOf(p), 1); palIndex = READY_PALETTES.length; }
      storeIt('paint-palettes', myPalettes); storeIt('paint-palette', palIndex); pcShow();
    });
    // taking a colour out of your own palette: right-click it, or press and hold
    function pcRemove(b) {
      var p = palettes()[palIndex]; if (!p || p.ready || b.dataset.pcI == null) return;
      p.colors.splice(+b.dataset.pcI, 1); storeIt('paint-palettes', myPalettes); pcShow();
    }
    pc.addEventListener('contextmenu', function (e) { var b = e.target.closest('.pc-swatches [data-pc-i]'); if (b) { e.preventDefault(); pcRemove(b); } });
    var pcHold = 0, pcHeld = false;
    pc.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('.pc-swatches [data-pc-i]'); if (!b || e.pointerType === 'mouse') return;
      pcHeld = false; clearTimeout(pcHold); pcHold = setTimeout(function () { pcHeld = true; pcRemove(b); }, 550);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { pc.addEventListener(t, function () { clearTimeout(pcHold); }); });
    pc.addEventListener('click', function (e) { if (pcHeld) { pcHeld = false; e.stopPropagation(); e.preventDefault(); } }, true);
    // SIZE goes from 1 to 500. The slider runs along a curve, so the small
    // sizes (most used, and where a pixel matters) get most of its length:
    // a quarter of the way is about 20, half way about 95.
    var MAX_SIZE = 500, SIZE_CURVE = 2.4;
    function sizeAt(pos) { return 1 + (MAX_SIZE - 1) * Math.pow(Math.max(0, Math.min(1000, pos)) / 1000, SIZE_CURVE); }
    function posOf(size) { return Math.round(1000 * Math.pow((size - 1) / (MAX_SIZE - 1), 1 / SIZE_CURVE)); }
    function setAlpha(a) { st.alpha = Math.max(0.05, Math.min(1, a)); alphaIn.value = Math.round(st.alpha * 100); alphaIn.nextElementSibling.textContent = alphaIn.value; }
    // SHAPES: one button for lines and shapes (the line is a tool of its own,
    // 'line', and the shapes 'shape', picked in its panel; the one last used
    // is remembered). BLEND: one button for smudge, blur, lighten and darken
    // (the tools 'smudge', 'blur' and 'tone', with st.tone for lighten or
    // darken), each keeping its own size and opacity
    var shapeKind = stored('paint-shape-kind', 'shape'), blendTool = stored('paint-blend-tool', 'smudge'), blendSet = stored('paint-blend-set', {}) || {}, blendOut = null;
    if (shapeKind !== 'line') shapeKind = 'shape';
    if (!/^(smudge|blur|tone)$/.test(blendTool)) blendTool = 'smudge';
    function isBlend(t) { return t === 'smudge' || t === 'blur' || t === 'tone'; }
    function blendMode() { return st.tool === 'tone' ? st.tone : st.tool; }
    function blendSave() { blendSet[blendMode()] = { size: st.size, alpha: st.alpha }; storeIt('paint-blend-set', blendSet); }
    function blendLoad() { var q = blendSet[blendMode()]; if (q) { setSize(q.size); setAlpha(q.alpha); } }
    var LINE_ICON = '<path d="M7.2 16.8l9.6-9.6"/><circle cx="5.8" cy="18.2" r="2"/><circle cx="18.2" cy="5.8" r="2"/>';
    function comboSync() {
      var sb = root.querySelector('.paint-shapebtn'), bb = root.querySelector('.paint-blendbtn');
      // (the Shapes button keeps its own icon, whichever kind is picked in its panel)
      if (sb) sb.dataset.tool = shapeKind;
      if (bb) bb.dataset.tool = blendTool;
    }
    comboSync();
    // (a Blend mode picked in its panel: lighten and darken are one tool, so
    // going between them keeps each one's own size and opacity here)
    function blendPick(m) {
      if (m === 'dodge' || m === 'burn') {
        if (st.tool === 'tone') { if (st.tone !== m) { blendSave(); st.tone = m; blendLoad(); } ctxSync(); ctxRender(); return; }
        st.tone = m; setTool('tone'); return;
      }
      setTool(m);
    }
    function setSize(v, fromSlider) {
      st.size = Math.max(1, Math.min(MAX_SIZE, Math.round(v)));
      if (!fromSlider) sizeIn.value = posOf(st.size);
      sizeIn.nextElementSibling.textContent = st.size;
    }

    // (lists that open beside the left toolbar: none now. The tools' own
    // lists, and symmetry's settings, are in the tool panel)
    var menus = {};
    function symOpts() { if (ctxView === 'sym') ctxSync(); }
    function openMenu(tool) {
      Object.keys(menus).forEach(function (t) {
        var m = menus[t], on = t === tool, btn = root.querySelector('button[data-tool="' + t + '"], button[data-menu="' + t + '"]');
        m.el.hidden = !on;
        btn.setAttribute('aria-expanded', on ? 'true' : 'false');
        if (on) {
          m.el.style.top = Math.max(0, Math.min(btn.offsetTop, left.clientHeight - m.el.offsetHeight)) + 'px';
          Array.prototype.forEach.call(m.el.querySelectorAll('button[data-val]'), function (b) { b.setAttribute('aria-checked', b.dataset.val === st[m.key] ? 'true' : 'false'); });
        }
      });
    }
    function anyMenu() { return Object.keys(menus).some(function (t) { return !menus[t].el.hidden; }); }

    // Tool activation and the panel being displayed are independent.
    function toolMenuOpen() {
      return !!(ctxEl && ((!ctxEl.classList.contains('min') && !ctxEl.hidden) || !pc.hidden || !adjBox.hidden || !bsBox.hidden));
    }
    function minimizeToolMenu() {
      if (!pc.hidden) picker(null);
      if (!adjBox.hidden || adj) adjustDone();
      if (!bsBox.hidden) studio(false);
      ctxMin(true); ctxAside();
    }
    function chooseTool(t, repeatOpens) {
      if (repeatOpens === true && st.tool === t && toolMenuOpen() && pc.hidden && adjBox.hidden && bsBox.hidden && ctxView === 'tool' && ctxToolId === t) {
        minimizeToolMenu(); return;
      }
      // (Fill, the colour picker and Move have no settings: they hide the
      // panel without folding it, so the next tool's settings come back)
      var bare = ctxView === 'tool' && !CTX[ctxToolId] && !ctxEl.classList.contains('min');
      var show = toolMenuOpen() || bare || (repeatOpens !== false && st.tool === t);
      if (show) {
        if (!pc.hidden) picker(null);
        if (!adjBox.hidden || adj) adjustDone();
        if (!bsBox.hidden) studio(false);
      }
      setTool(t, show);
      if (show && ctxEl.classList.contains('min')) ctxMin(false);
      ctxAside();
    }
    function setTool(t, showSettings) {
      if (lassoOn || selMode === 'lasso') { cancelLasso(); stage.classList.remove('closing'); }
      var tp = null;
      if (pen && t !== 'pen') { if (penText) { tp = t === 'text' && pathForText(); cancelPen(); } else finishPen(); }
      if (grad && t !== 'gradient') gradDone();
      if (selKindOf(t) && t !== selKind) { selKind = t; storeIt('paint-sel-kind', t); selBtnSync(); }
      if ((t === 'line' || t === 'shape') && t !== shapeKind) { shapeKind = t; storeIt('paint-shape-kind', t); comboSync(); }
      if (isBlend(t) && t !== blendTool) { blendTool = t; storeIt('paint-blend-tool', t); comboSync(); }
      var wasBlend = isBlend(st.tool);
      if (wasBlend) blendSave(); else if (isBlend(t)) blendOut = { size: st.size, alpha: st.alpha };
      // (putting the tool down leaves a selection exactly as it is)
      if (sel && (sel.auto || sel.text) && t !== 'move' && t !== 'none') commitSelection();
      if (adj) adjustDone(!showSettings);
      if (textBox) commitText();
      if (sel && !selTool(t) && t !== 'none') anchor();
      st.tool = t;
      if (isBlend(t)) blendLoad(); else if (wasBlend && blendOut) { setSize(blendOut.size); setAlpha(blendOut.alpha); blendOut = null; }
      Array.prototype.forEach.call(root.querySelectorAll('button[data-tool]'), function (b) { b.setAttribute('aria-pressed', b.dataset.tool === t ? 'true' : 'false'); });
      stage.dataset.tool = t; stage.classList.remove('can-move'); if (t !== 'picker' && typeof pickHoverEnd === 'function') pickHoverEnd();
      octx.clearRect(0, 0, W, H);
      if (showSettings) { ctxView = 'tool'; ctxToolId = t; } ctxRender();
      if (grad) gradDraw();
      if (t === 'move') movePick();
      if (tp) startText(tp.at, 0, null, tp.path);
    }

    // ---- undo / redo: snapshots of one layer, or of the layer list ----
    function snapOf(L) { return L.ctx.getImageData(0, 0, L.cv.width, L.cv.height); }
    // (each step has a name, for the HISTORY list; fewer steps are kept for
    // a big picture, so they don't fill up the memory)
    var trimmed = false;
    // HOW MANY LAYERS: as many as the memory allows for a picture this size
    // (up to 50); near the end, a warning that the app may slow down
    function maxLayers() { return Math.max(10, Math.min(50, Math.floor(900e6 / (ov.width * ov.height * 4)))); }
    var roomWarned = 0;
    function roomFor(n) {
      var max = maxLayers(), after = layers.length + (n || 1);
      if (after > max) { toast('Up to ' + max + ' layers for a picture this size: merge or delete one to add more'); return false; }
      if (after >= Math.ceil(max * 0.8) && roomWarned !== max) { roomWarned = max; toast('That\u2019s a lot of layers for a picture this size: the app may slow down'); }
      return true;
    }
    function limit() { return Math.max(4, Math.min(LIMIT, Math.floor(160e6 / (ov.width * ov.height * 4)))); }
    // (what could be redone is kept with the step, so a stroke that's called
    // off at once, like the first finger of a two-finger tap, gives it back)
    function push(e) { boxStale(e); endFillAnim(); gradGone = null; if (!e.label) e.label = TOOL_NAMES[st.tool] || 'Edit'; var prev = undo[undo.length - 1]; if (prev) delete prev.redoWas; e.redoWas = redo; undo.push(e); while (undo.length > limit()) { undo.shift(); trimmed = true; } redo = []; buttons(); autosave(); }
    // (a text layer's words are kept with its pixels; any other change to
    // its pixels makes it plain paint: undo brings the words back)
    function remember(label, quiet) {
      push({ L: active, data: snapOf(active), bg: active.bg, text: active.text, label: label });
      if (active.text) { active.text = null; renderLayers(); if (!quiet) toast('The text is now paint (undo to edit the words again)'); }
    }
    function props() { return layers.map(function (L) { var G = L.group; return { v: L.visible, o: L.opacity, b: L.blend, a: L.alphaLock, c: L.clip, t: L.text, m: L.mask, g: G, gp: G && [G.name, G.open, G.visible, G.opacity, G.blend] }; }); }
    function rememberLayers(label) { push({ list: layers.slice(), active: active, props: props(), label: label || 'Layers' }); }
    function docState() { return { doc: true, pw: ov.width, ph: ov.height, list: layers.slice(), active: active, props: props() }; }
    function rememberDoc(label) { if (grad) gradDone(); var e = docState(); e.label = label; push(e); }
    function capture(e) {
      if (e.parts) return { parts: e.parts.map(capture), label: e.label }; // (a step that changed a layer and the list, like Merge Down)
      var c = e.doc ? docState() : e.L ? { L: e.L, data: snapOf(e.L), bg: e.L.bg, text: e.L.text, name: e.L.name } : { list: layers.slice(), active: active, props: props() };
      c.label = e.label; if (e.pen) c.pen = e.pen; if (e.grad) c.grad = e.grad; return c;
    }
    function apply(e) {
      boxStale(e);
      if (e.parts) { e.parts.forEach(apply); viewsSoon(); return; }
      if (e.L) { if (e.L.isMask) { e.L.ctx.save(); e.L.ctx.setTransform(1, 0, 0, 1, 0, 0); e.L.ctx.putImageData(e.data, 0, 0); e.L.ctx.restore(); maskAlpha(e.L.owner); viewsSoon(); renderLayers(); return; }
        if (e.bg != null) e.L.bg = e.bg; if ('text' in e) e.L.text = e.text || null; if (e.name) e.L.name = e.name; e.L.ctx.save(); e.L.ctx.setTransform(1, 0, 0, 1, 0, 0); e.L.ctx.putImageData(e.data, 0, 0); e.L.ctx.restore(); viewsSoon(); renderLayers(); }
      else {
        if (e.doc) { clearSel(); if (e.pw !== ov.width || e.ph !== ov.height) setDoc(e.pw, e.ph); }
        layers = e.list.slice(); layers.forEach(function (L, i) { var q = e.props[i]; L.visible = q.v; L.opacity = q.o; L.blend = q.b; L.alphaLock = !!q.a; L.clip = !!q.c; if ('t' in q) L.text = q.t || null; if ('m' in q) { L.mask = q.m || null; if (!L.mask) L.editMask = false; } if ('g' in q) { L.group = q.g || null; if (q.gp) { L.group.name = q.gp[0]; L.group.open = q.gp[1]; L.group.visible = q.gp[2]; L.group.opacity = q.gp[3]; L.group.blend = q.gp[4]; } } });
        active = layers.indexOf(e.active) >= 0 ? e.active : layers[layers.length - 1] || null; mount();
        if (e.doc) fit();
      }
    }
    // (a path being made with the pen has steps of its own, a point or a
    // change at a time, undone and redone before the picture's; undoing a
    // path that was laid down brings it back to be worked on. whole: just
    // the picture's steps, for the History list)
    function doUndo(whole) {
      endFillAnim(); if (down) { cancelStroke(); return; }
      if (pen && !whole && penUndo()) return;
      if (!whole && selUndo()) return;
      if (pen) cancelPen(); // (an emptied path gives way)
      // (a gradient being made: its changes first; then a new one goes (redo
      // brings it back), and one brought back by undo gives way)
      if (grad && !whole) { if (gradUndo()) return; var fu = grad.fromUndo; if (!fu) gradGone = gradKeep(); gradCancel(); if (!fu) { buttons(); return; } }
      else if (grad) gradDone();
      var fx = fxStays(); if (adj && !fx) adjustDone(); if (textBox) commitText(); if (sel && (lifted() || sel.text)) commitSelection(); if (!undo.length) return;
      gradGone = null;
      var e = undo.pop(); redo.push(capture(e)); apply(e); if (e.pen && !whole) penRestore(e.pen); if (e.grad && !whole) gradRestore(e.grad, true); fxAfter(fx); buttons(); autosave();
    }
    function doRedo(whole) {
      endFillAnim(); if (down) return;
      if (pen && !whole && penRedo()) return;
      if (!whole && selRedo()) return;
      if (pen && pen.pts.length && !pen.fromUndo && !whole) return; // (a new path in the making: nothing ahead of it)
      if (pen) cancelPen(); // (a path brought back by undo gives way to it being laid down again)
      if (grad && !whole) { if (gradRedo()) return; if (!grad.fromUndo) return; gradCancel(); }
      else if (grad) gradDone();
      if (gradGone && !whole) { var gg = gradGone; gradGone = null; gradRestore(gg, false); return; }
      var fx = fxStays(); if (adj && !fx) adjustDone(); if (textBox) commitText(); if (sel && (lifted() || sel.text)) commitSelection(); if (!redo.length) return;
      var e = redo.pop(); undo.push(capture(e)); apply(e); fxAfter(fx); buttons(); autosave();
    }
    // (Effects open with nothing set, after Done: it stays open through undo
    // and redo, working from the picture as it then is)
    function fxStays() { return !!(adj && !adj.finishing && !adj.applying && !adjChanged()); }
    function fxAfter(on) { if (!on || !adj) return; if (layers.indexOf(adj.L) < 0 || adj.L !== active) adjustClose(); else adjustRebase(); }
    function buttons() { histButtons(); renderHistory(); }
    function histButtons() {
      var P = pen && pen.hist ? pen : null;
      var S = sel && selSteps() ? sel : null, G = grad && grad.hist ? grad : null;
      $('[data-act="undo"]').disabled = !undo.length && !(P && P.hist.length) && !(S && S.hist && S.hist.length) && !G;
      $('[data-act="redo"]').disabled = !(P && P.fut.length) && !(redo.length && !(P && P.pts.length && !P.fromUndo) && !(G && !G.fromUndo)) && !(S && S.fut && S.fut.length) && !(G && G.fut.length) && !(gradGone && !G);
    }

    // ---- brushes ----
    var down = null, pts = [];
    function strokeStyle(c) { c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = st.size; c.strokeStyle = c.fillStyle = st.color; }
    function kind() { return st.tool === 'eraser' ? 'eraser' : st.brush; }
    // ---- THE BRUSH ENGINE. A stroke is the pointer's points (with an Apple
    // Pencil's pressure), turned into a smooth curve sampled every pixel or
    // so, then drawn by its brush onto the see-through sheet. While drawing,
    // only the part of the picture the stroke has just changed is cleared and
    // drawn again: the start of a stroke never changes once the pointer has
    // moved on, so a long stroke costs no more per frame than a short one.
    // The same code draws the samples in the brush list and the preview
    // beside the size slider, so they always match the real thing. ----

    // BRUSH SETTINGS (the Brush Studio): every brush has its settings, which
    // can be changed (and put back); a changed one can be kept as a brush of
    // your own, and new ones made from stamps (dabs of a tip, spaced along
    // the line and jittered). psize: how much pressure changes the size;
    // curve: soft (a light touch is enough) to firm; tin / tout: how long the
    // tapered ends are (100 = as made); grain: the paper's tooth; angle: a
    // flat nib's slant; and for stamps: the tip, spacing (in % of the size),
    // scatter, size / opacity / angle jitter, and popacity, how much pressure
    // changes the opacity
    var BDEF = {
      round: { psize: 85, curve: 0, tin: 100, tout: 100, grain: 0 },
      pencil: { psize: 85, curve: 0, tin: 100, tout: 100, grain: 60 },
      feather: { grain: 0 },
      marker: { psize: 65, curve: 0, angle: -34, grain: 0 },
      highlighter: { psize: 65, curve: 0, angle: 77, grain: 0 },
      calligraphy: { psize: 65, curve: 0, angle: -45, grain: 0 },
      spray: {},
      eraser: { psize: 85, curve: 0 },
      stamp: { tip: 'dot', spacing: 25, scatter: 0, jsize: 0, jopacity: 0, jangle: 0, psize: 85, popacity: 0, curve: 0, tin: 100, tout: 100, grain: 0 }
    };
    var TIPS = [['dot', 'Hard'], ['soft', 'Soft'], ['square', 'Square'], ['chalk', 'Chalk'], ['splatter', 'Splatter']];
    var brushEdits = stored('paint-brush-edits', {}), myBrushes = stored('paint-my-brushes', []);
    // a brush by its id: its name, what kind it's made from, and its settings
    function bdef(id) {
      var mine = myBrushes.filter(function (b) { return b.id === id; })[0];
      var base = mine ? mine.base : id, set = {}, k, D = BDEF[base] || BDEF.round;
      for (k in D) set[k] = D[k];
      var ch = mine ? mine.set : brushEdits[id] || {};
      for (k in ch) if (k in D) set[k] = ch[k];
      var b = BRUSHES.filter(function (x) { return x[0] === id; })[0];
      return { id: id, name: mine ? mine.name : b ? b[1] : id === 'eraser' ? 'Eraser' : 'Brush', base: BDEF[base] ? base : 'round', set: set, mine: !!mine };
    }
    function baseOf(id) { return bdef(id).base; }
    function allBrushes() { return BRUSHES.concat(myBrushes.map(function (b) { return [b.id, b.name, true]; })); }
    // how much of the full size (or opacity) a pressure gives: pr (0-1) eased
    // along the curve, then mixed in by amount (0-100)
    function prF(pr, amount, curve) {
      if (pr == null) return 1;
      var p = Math.pow(Math.min(1, pr * 1.25), Math.pow(2, -(curve || 0) / 50)), a = (amount == null ? 85 : amount) / 100;
      return 1 - a + a * p;
    }
    // each brush's shape: its width (or flat nib), how its ends taper, how
    // finely it's sampled, and how far its paint reaches beyond the line
    function brushCfg(id, sz, color) {
      var D = bdef(id), k = D.base, S = D.set;
      var c = { kind: k, id: id, set: S, size: sz, color: color, tin: 0, tout: 0, step: Math.max(0.6, sz * 0.1) };
      if (k === 'round') { c.w = sz; c.tin = sz * 1.5; c.tout = sz * 1.2; }
      else if (k === 'eraser') { c.w = sz; }
      else if (k === 'pencil') { c.w = Math.max(1, sz * 0.38); c.tin = c.tout = Math.max(6, sz * 3); c.step = 0.6; }
      else if (k === 'marker') { c.len = Math.max(3, sz * 1.1); c.thick = Math.max(1.5, sz * 0.38); c.ang = -0.6; }
      else if (k === 'highlighter') { c.len = Math.max(10, sz * 2.2); c.thick = Math.max(3, sz * 0.5); c.ang = 1.35; }
      else if (k === 'calligraphy') { c.len = Math.max(4, sz * 1.5); c.thick = Math.max(1, sz * 0.09); c.ang = -Math.PI / 4; }
      else if (k === 'feather') { c.w = Math.max(3, sz) * 1.35; c.blur = Math.max(3, sz) * 0.85; }
      else if (k === 'stamp') { c.w = sz; c.tin = sz * 1.5; c.tout = sz * 1.2; c.step = Math.max(0.5, sz * 0.05); c.sp = Math.max(0.5, sz * S.spacing / 100); }
      if (S.angle != null) c.ang = S.angle * Math.PI / 180;
      if (S.tin != null) { c.tin *= S.tin / 100; c.tout *= S.tout / 100; }
      if (c.len) { c.step = Math.max(0.5, c.thick * 0.4); c.reach = c.len / 2 + c.thick + 1; }
      else c.reach = c.w * (0.62 + (S.scatter || 0) / 100) + (c.blur || 0) * 3 + 2;
      // (the paper's grain, rubbed out of the line: more for a small one)
      var g = (S.grain || 0) / 100; c.grain = g ? Math.max(g * 0.5, g * 1.033 - sz * 0.006) : 0;
      // (with tapering off, a line is the same thickness from end to end;
      // an Apple Pencil's pressure still thickens and thins it)
      if (taperOn === false) c.tin = c.tout = 0;
      c.live = c.tout; // (how far back from the tip it still changes)
      return c;
    }
    // the curve through the points (Catmull-Rom), sampled every `step`: each
    // sample with its distance along the stroke (d), pressure (pr) and which
    // way is "across" it (nx, ny). S.seg[i] is where input point i starts.
    function resample(P, step, prev, prevN) {
      var out = [{ x: P[0].x, y: P[0].y, pr: P[0].pr, d: 0 }], d = 0, seg = [0], i0 = 0, k0 = 0;
      // (from last time's curve: the pieces whose four points were all there
      // already are exactly the same, so they're kept as they were)
      if (prev && prev.seg && prevN >= 4 && P.length >= prevN) {
        i0 = prevN - 2; k0 = prev.seg[i0];
        out = prev.slice(0, k0 + 1); seg = prev.seg.slice(0, i0 + 1); d = out[k0].d;
      }
      for (var i = i0; i < P.length - 1; i++) {
        var p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
        var n = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
        for (var j = 1; j <= n; j++) {
          var t = j / n, t2 = t * t, t3 = t2 * t;
          var x = 0.5 * (2 * p1.x + (p2.x - p0.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (3 * p1.x - p0.x - 3 * p2.x + p3.x) * t3);
          var y = 0.5 * (2 * p1.y + (p2.y - p0.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (3 * p1.y - p0.y - 3 * p2.y + p3.y) * t3);
          var l = out[out.length - 1]; d += Math.hypot(x - l.x, y - l.y);
          out.push({ x: x, y: y, pr: p1.pr == null ? null : p1.pr + (p2.pr - p1.pr) * t, d: d });
        }
        seg.push(out.length - 1);
      }
      for (var k = Math.max(0, k0 - 2); k < out.length; k++) {
        var a = out[Math.max(0, k - 2)], b = out[Math.min(out.length - 1, k + 2)], tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty);
        out[k].nx = tl ? -ty / tl : 0; out[k].ny = tl ? tx / tl : 1; out[k].i = k;
      }
      out.seg = seg;
      return out;
    }
    // an Apple Pencil's pressure, smoothed (it sometimes reads 0 between readings)
    function smoothPr(raw) {
      if (!down || !down.pen) return null;
      var p = raw > 0 ? raw : (down.pr != null ? down.pr : 0.3);
      down.pr = down.pr == null ? p : down.pr * 0.6 + p * 0.4;
      return down.pr;
    }
    // how wide the stroke is at a point: the pressure, and the thin ends
    // (ease-out curves, so the line swells quickly from a fine point)
    // (a stroke only a little longer than it is wide is more like a dot: its
    // ends taper in less, so a tiny flick isn't lost next to a tap)
    function widthFn(base, tin, tout, total, set) {
      var memo = [], full = Math.min(1, total / (base * 2.5)), ps = set && set.psize, cv = set && set.curve;
      return function (s, tap) {
        if (!tap && memo[s.i] != null) return memo[s.i];
        var f = prF(s.pr, ps, cv);
        if (!tap) {
          if (tin) { var u = Math.min(1, s.d / tin); f *= 1 - full * 0.88 * (1 - u) * (1 - u); }
          if (tout) { var v = Math.min(1, Math.max(0, total - s.d) / tout); f *= 1 - full * 0.8 * (1 - v) * (1 - v); }
        }
        var w = Math.max(0.4, base * f);
        if (!tap) memo[s.i] = w;
        return w;
      };
    }
    // only what's near the area being redrawn is drawn at all (box.vis says,
    // for each sample, whether it's within reach of it)
    function near(s, box) { return !box || box.vis[s.i]; }
    function markNear(S, box, r) {
      var v = new Uint8Array(S.length);
      for (var i = 0; i < S.length; i++) { var s = S[i]; v[i] = s.x + r >= box[0] && s.x - r <= box[2] && s.y + r >= box[1] && s.y - r <= box[3] ? 1 : 0; }
      box.vis = v; return box;
    }
    // with symmetry copies, the parts to draw again are those (of any copy)
    // that come near any of the areas being redrawn: each area is taken back
    // through each copy's transform onto the stroke itself, and checked
    // against the stroke a stretch at a time, so it stays quick however
    // long the stroke and however many copies
    function markNearSym(S, box, rects, r, sym) {
      var v = new Uint8Array(S.length), N = 32, chunks = [], all = [[1, 0, 0, 1, 0, 0]].concat(sym), areas = [];
      for (var i = 0; i < S.length; i += N) {
        var b = [Infinity, Infinity, -Infinity, -Infinity];
        for (var j = i; j < Math.min(S.length, i + N); j++) { var q = S[j]; b[0] = Math.min(b[0], q.x); b[1] = Math.min(b[1], q.y); b[2] = Math.max(b[2], q.x); b[3] = Math.max(b[3], q.y); }
        chunks.push(b);
      }
      all.forEach(function (m) {
        var det = m[0] * m[3] - m[1] * m[2], inv = [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
        rects.forEach(function (rc) {
          var cs = [mapPt(inv, { x: rc[0] / R, y: rc[1] / R }), mapPt(inv, { x: rc[2] / R, y: rc[1] / R }), mapPt(inv, { x: rc[0] / R, y: rc[3] / R }), mapPt(inv, { x: rc[2] / R, y: rc[3] / R })];
          areas.push([Math.min(cs[0].x, cs[1].x, cs[2].x, cs[3].x) - r, Math.min(cs[0].y, cs[1].y, cs[2].y, cs[3].y) - r, Math.max(cs[0].x, cs[1].x, cs[2].x, cs[3].x) + r, Math.max(cs[0].y, cs[1].y, cs[2].y, cs[3].y) + r]);
        });
      });
      chunks.forEach(function (b, k) {
        for (var a = 0; a < areas.length; a++) {
          var A = areas[a];
          if (b[2] >= A[0] && b[0] <= A[2] && b[3] >= A[1] && b[1] <= A[3]) { v.fill(1, k * N, Math.min(S.length, k * N + N)); return; }
        }
      });
      box.vis = v; return box;
    }
    // a line of varying width with round ends, in runs of the same width.
    // It's drawn in fixed stretches of 32 samples, each its own path, whether
    // the whole line is being drawn or just part of it: so a stretch drawn
    // again comes out pixel for pixel the same (a line that folds back on
    // itself is filled a little differently depending on where its path
    // starts, which would show as a hairline where old met new). And a path
    // never turns back on itself: at a sharp turn (more than a right angle)
    // a new one starts, since a path folded over can be filled with a pale
    // notch where it overlaps itself.
    function ribbon(c, S, wf, box) {
      if (S.length === 1) { c.beginPath(); c.arc(S[0].x, S[0].y, wf(S[0], true) / 2, 0, Math.PI * 2); c.fill(); return; }
      c.lineCap = 'round'; c.lineJoin = 'round';
      var cur = -1, open = false, chunk = -1, show = true, dx = 0, dy = 0;
      for (var i = 1; i < S.length; i++) {
        var a = S[i - 1], b = S[i], ck = (i - 1) >> 5, ex = b.x - a.x, ey = b.y - a.y;
        var back = dx * ex + dy * ey < 0; if (ex || ey) { dx = ex; dy = ey; }
        if (ck !== chunk) {
          if (open) { c.stroke(); open = false; }
          chunk = ck; show = !box;
          for (var j = ck * 32; !show && j <= Math.min(S.length - 1, ck * 32 + 32); j++) if (near(S[j], box)) show = true;
        }
        if (!show) continue;
        var w = (wf(a) + wf(b)) / 2;
        w = w > 6 ? Math.round(w * 2) / 2 : Math.round(w * 4) / 4;
        if (w !== cur || !open || back) { if (open) c.stroke(); c.beginPath(); c.lineWidth = cur = w; c.moveTo(a.x, a.y); open = true; }
        c.lineTo(b.x, b.y);
      }
      if (open) c.stroke();
    }
    // a flat nib (marker, highlighter, calligraphy). Moving in a straight
    // line from one sample to the next, a rectangular nib covers exactly the
    // outline that wraps both of its positions (their convex hull), so the
    // stroke is those outlines joined: clean, continuous edges with no
    // sawtooth from the nib's corners
    function nibCorners(s, cfg) {
      var k = prF(s.pr, cfg.set.psize, cfg.set.curve), ca = Math.cos(cfg.ang), sa = Math.sin(cfg.ang);
      var hx = ca * cfg.len / 2 * k, hy = sa * cfg.len / 2 * k, tx = -sa * cfg.thick / 2, ty = ca * cfg.thick / 2;
      return [[s.x - hx - tx, s.y - hy - ty], [s.x + hx - tx, s.y + hy - ty], [s.x + hx + tx, s.y + hy + ty], [s.x - hx + tx, s.y - hy + ty]];
    }
    function hull(P) {
      // (Andrew's monotone chain; always wound the same way, so the shapes join)
      P.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      var cross = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }, lo = [], up = [], i;
      for (i = 0; i < P.length; i++) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], P[i]) <= 0) lo.pop(); lo.push(P[i]); }
      for (i = P.length - 1; i >= 0; i--) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], P[i]) <= 0) up.pop(); up.push(P[i]); }
      return lo.slice(0, -1).concat(up.slice(0, -1));
    }
    function chisel(c, S, cfg, box) {
      c.beginPath();
      var add = function (q) { c.moveTo(q[0][0], q[0][1]); for (var j = 1; j < q.length; j++) c.lineTo(q[j][0], q[j][1]); c.closePath(); };
      if (S.length === 1) { add(hull(nibCorners(S[0], cfg))); c.fill(); return; }
      var prevC = null;
      for (var i = 1; i < S.length; i++) {
        if (!near(S[i - 1], box) && !near(S[i], box)) { prevC = null; continue; }
        var a = prevC || nibCorners(S[i - 1], cfg), b = nibCorners(S[i], cfg);
        add(hull(a.concat(b))); prevC = b;
      }
      c.fill();
    }
    // PAPER TEXTURE, used to rub a little out of a pencil line so it catches
    // on the grain
    var textures = {};
    function texture(kindOf) {
      if (textures[kindOf]) return textures[kindOf];
      var S = 256, g = document.createElement('canvas'); g.width = g.height = S;
      var gx = g.getContext('2d'), im = gx.createImageData(S, S), d = im.data;
      for (var j = 0; j < d.length; j += 4) {
        var n = Math.random();
        d[j + 3] = n > 0.5 ? (n - 0.5) * 2 * 200 : 0;
      }
      gx.putImageData(im, 0, 0);
      return (textures[kindOf] = gx.createPattern(g, 'repeat'));
    }
    // rub the texture out of everything drawn (the grain stays put on the
    // paper, in the picture's own pixels, whatever the zoom)
    function rubOut(c, kindOf, a, px) {
      c.save(); c.setTransform(px / R, 0, 0, px / R, 0, 0);
      c.globalCompositeOperation = 'destination-out'; c.globalAlpha = a; c.fillStyle = texture(kindOf);
      c.fillRect(0, 0, c.canvas.width * R / px, c.canvas.height * R / px); c.restore();
    }
    function clipTo2(c, rects) { if (!rects) return; c.beginPath(); rects.forEach(function (r) { c.rect(r[0], r[1], r[2] - r[0], r[3] - r[1]); }); c.clip(); }
    // draw a stroke (its samples S) with a brush onto c, whose transform maps
    // the picture's units to the canvas; px is canvas pixels per unit. s8
    // keeps what's kept for the stroke: s8.sym, the symmetry copies. box (in units) and rects (in canvas pixels)
    // are the area being redrawn, or null for all of it.
    var featherSheet = null, taperOn = true;
    function strokeOn(c, S, cfg, s8, px, box, rects) {
      var k = cfg.kind, total = S[S.length - 1].d, sym = s8.sym || [];
      var rep = function (x, fn) {
        fn(x);
        if (!sym.length) return;
        var B = x.getTransform();
        sym.forEach(function (m) { x.setTransform(B.multiply(new DOMMatrix(m))); fn(x); });
        x.setTransform(B);
      };
      c.save(); c.fillStyle = c.strokeStyle = cfg.color;
      if (k === 'round' || k === 'eraser') {
        var wr = widthFn(cfg.w, cfg.tin, cfg.tout, total, cfg.set);
        rep(c, function (x) { ribbon(x, S, wr, box); });
      } else if (k === 'pencil') {
        // graphite: a fine line that tapers, catching on the paper's tooth;
        // pressing harder (or a bigger size) fills more of the grain in
        var wp = widthFn(cfg.w, cfg.tin, cfg.tout, total, cfg.set);
        rep(c, function (x) { ribbon(x, S, wp, box); });
      } else if (k === 'stamp') {
        rep(c, function (x) { stamps(x, S, cfg, box, total); });
      } else if (cfg.len) {
        rep(c, function (x) { chisel(x, S, cfg, box); });
      } else if (k === 'feather') {
        // an airbrush: the stroke as one very soft line. The line itself is
        // drawn off to the side and only its blurred shadow lands on the
        // picture, so nothing stacks up into rings.
        // (a very soft one is drawn at a fraction of the size and scaled up:
        // it looks just the same, and a big blur costs far less. Its pixels
        // line up with the same coarse grid whichever part is redrawn, so the
        // redrawn pieces meet without a seam.)
        var dev = cfg.blur * px, Sc = Math.max(1, Math.ceil(dev / 24)), cv = c.canvas, T = c.getTransform(), x = c, bb = null;
        if (Sc > 1) {
          bb = [0, 0, cv.width, cv.height];
          if (rects && rects.length) bb = [Math.min.apply(null, rects.map(function (r) { return r[0]; })), Math.min.apply(null, rects.map(function (r) { return r[1]; })), Math.max.apply(null, rects.map(function (r) { return r[2]; })), Math.max.apply(null, rects.map(function (r) { return r[3]; }))];
          bb[0] = Math.floor(bb[0] / Sc) * Sc; bb[1] = Math.floor(bb[1] / Sc) * Sc;
          var tw = Math.ceil((bb[2] - bb[0]) / Sc) + 1, th = Math.ceil((bb[3] - bb[1]) / Sc) + 1;
          var sp = featherSheet || (featherSheet = document.createElement('canvas'));
          if (sp.width < tw || sp.height < th) { sp.width = Math.max(sp.width, tw); sp.height = Math.max(sp.height, th); }
          x = sp.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, tw, th);
          x.setTransform(1 / Sc, 0, 0, 1 / Sc, -bb[0] / Sc, -bb[1] / Sc); x.transform(T.a, T.b, T.c, T.d, T.e, T.f);
        }
        var OFF = cv.width / px + cfg.reach * 4 + 50;
        x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = cfg.w; x.strokeStyle = x.fillStyle = '#000';
        x.shadowColor = cfg.color; x.shadowBlur = dev / Sc; x.shadowOffsetX = OFF * px / Sc; x.shadowOffsetY = 0;
        [S].concat(sym.map(function (m) { return S.map(function (q) { return mapPt(m, q); }); })).forEach(function (list) {
          x.beginPath();
          if (list.length === 1) { x.arc(list[0].x - OFF, list[0].y, cfg.w / 2, 0, Math.PI * 2); x.fill(); return; }
          var open = false;
          for (var i = 0; i < list.length; i++) {
            if (box && !near(S[i], box)) { open = false; continue; }
            x[open ? 'lineTo' : 'moveTo'](list[i].x - OFF, list[i].y); open = true;
          }
          x.stroke();
        });
        if (x !== c) {
          x.shadowColor = 'transparent';
          c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
          c.drawImage(x.canvas, 0, 0, tw, th, bb[0], bb[1], tw * Sc, th * Sc); c.restore();
        }
      }
      // (the paper's grain: only where it's being redrawn, since rubbing it
      // over the whole sheet would cost a lot)
      if (cfg.grain) {
        if (rects) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); clipTo2(c, rects); }
        rubOut(c, 'pencil', cfg.grain, px);
        if (rects) c.restore();
      }
      c.restore();
    }
    // STAMPS: a dab of the tip every so often along the line, each one
    // nudged, sized, faded and turned a little at random (the same way each
    // time it's drawn, so a part drawn again comes out the same)
    var tipCache = {};
    function tipOf(name, color) {
      var key = name + color; if (tipCache[key]) return tipCache[key];
      var N = 64, t = document.createElement('canvas'); t.width = t.height = N;
      var x = t.getContext('2d'), r = N / 2, i;
      x.fillStyle = '#fff';
      if (name === 'soft') { var g = x.createRadialGradient(r, r, 0, r, r, r); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, N, N); }
      else if (name === 'square') { x.fillRect(6, 6, N - 12, N - 12); }
      else if (name === 'splatter') { var rs = 7; for (i = 0; i < 26; i++) { rs = (rs * 9301 + 49297) % 233280; var a = rs / 233280 * Math.PI * 2; rs = (rs * 9301 + 49297) % 233280; var d = Math.sqrt(rs / 233280) * (r - 6); rs = (rs * 9301 + 49297) % 233280; x.beginPath(); x.arc(r + Math.cos(a) * d, r + Math.sin(a) * d, 1.5 + rs / 233280 * 4.5, 0, Math.PI * 2); x.fill(); } }
      else { x.beginPath(); x.arc(r, r, r - 1, 0, Math.PI * 2); x.fill(); }
      if (name === 'chalk') {
        // (a rough, dry edge and a broken-up middle)
        var im = x.getImageData(0, 0, N, N), d2 = im.data, sd = 11;
        for (i = 3; i < d2.length; i += 4) { sd = (sd * 9301 + 49297) % 233280; var px = (i >> 2) % N - r, py = ((i >> 2) / N | 0) - r, e = Math.hypot(px, py) / r; d2[i] = d2[i] * Math.max(0, Math.min(1, (sd / 233280) * 1.5 - e * 0.6)); }
        x.putImageData(im, 0, 0);
      }
      x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, N, N);
      return (tipCache[key] = t);
    }
    function rnd(k, n) { var v = Math.sin(k * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); }
    function stamps(c, S, cfg, box, total) {
      var T = cfg.set, tip = tipOf(T.tip, cfg.color), wf = widthFn(cfg.w, cfg.tin, cfg.tout, total, T), sp = cfg.sp, j = 0;
      var n = S.length === 1 ? 1 : Math.floor(total / sp) + 1;
      for (var k = 0; k < n; k++) {
        var d = k * sp; while (j < S.length - 2 && S[j + 1].d < d) j++;
        var a = S[j], b = S[Math.min(S.length - 1, j + 1)], u = b.d > a.d ? Math.max(0, Math.min(1, (d - a.d) / (b.d - a.d))) : 0;
        if (box && !near(a, box) && !near(b, box)) continue;
        var w = wf(a, S.length === 1) * (1 - (T.jsize || 0) / 100 * rnd(k, 3));
        var x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u;
        if (T.scatter) { var ra = rnd(k, 1) * Math.PI * 2, rr = rnd(k, 2) * T.scatter / 100 * cfg.w; x += Math.cos(ra) * rr; y += Math.sin(ra) * rr; }
        var al = (1 - (T.jopacity || 0) / 100 * rnd(k, 4)) * (T.popacity ? prF(a.pr, T.popacity, T.curve) : 1);
        var ang = Math.atan2(a.ny, a.nx) + (rnd(k, 5) - 0.5) * Math.PI * 2 * (T.jangle || 0) / 100;
        c.save(); c.globalAlpha *= al; c.translate(x, y); c.rotate(ang); c.drawImage(tip, -w / 2, -w / 2, w, w); c.restore();
      }
    }
    // the redraw area, in units and in sheet pixels: everything within reach
    // of the samples that changed (old and new), copied for any symmetry
    function changedFrom(prev, S, P, prevTotal, total, cfg, prevN) {
      // (the curve's last two pieces bend as new points come; the tip's taper moves)
      var n = Math.min(prevN, P.length), si = Math.max(0, n - 3), dSpline = S.seg[si] != null ? S[S.seg[si]].d : 0;
      return Math.max(0, Math.min(dSpline, Math.min(prevTotal, total) - cfg.live) - cfg.step * 4 - 1);
    }
    function boxOf(list, d0, r, box) {
      for (var i = list.length - 1; i >= 0 && list[i].d >= d0; i--) {
        var s = list[i]; box[0] = Math.min(box[0], s.x - r); box[1] = Math.min(box[1], s.y - r); box[2] = Math.max(box[2], s.x + r); box[3] = Math.max(box[3], s.y + r);
      }
      return box;
    }
    function deviceRects(box, sym) {
      var out = [], all = [[1, 0, 0, 1, 0, 0]].concat(sym || []);
      all.forEach(function (m) {
        var cs = [mapPt(m, { x: box[0], y: box[1] }), mapPt(m, { x: box[2], y: box[1] }), mapPt(m, { x: box[0], y: box[3] }), mapPt(m, { x: box[2], y: box[3] })];
        var x0 = Math.min.apply(null, cs.map(function (q) { return q.x; })), y0 = Math.min.apply(null, cs.map(function (q) { return q.y; }));
        var x1 = Math.max.apply(null, cs.map(function (q) { return q.x; })), y1 = Math.max.apply(null, cs.map(function (q) { return q.y; }));
        var r = [Math.max(0, Math.floor(x0 * R)), Math.max(0, Math.floor(y0 * R)), Math.min(ov.width, Math.ceil(x1 * R)), Math.min(ov.height, Math.ceil(y1 * R))];
        if (r[2] > r[0] && r[3] > r[1]) out.push(r);
      });
      return out;
    }
    // redrawing waits for the next frame, so a burst of pointer moves (an
    // Apple Pencil reports 240 a second) costs one redraw, not several
    var rsQueued = false;
    function renderSoon() { if (rsQueued) return; rsQueued = true; requestAnimationFrame(function () { if (rsQueued) renderStroke(); }); }
    var drawSpare = null;
    function renderStroke() {
      rsQueued = false;
      if (!down || !pts.length) return;
      var cfg = down.cfg || (down.cfg = brushCfg(kind(), st.size, st.tool === 'eraser' ? '#fff' : st.color));
      down.sym = copies();
      var prev = down.S, prevTail = prev ? prev.slice(prev.seg && down.n >= 4 ? prev.seg[Math.max(0, down.n - 3)] : 0) : null;
      var P = pts;
      var S = resample(P, cfg.step, prev, down.n), total = S[S.length - 1].d;
      var d0 = prev ? changedFrom(prev, S, P, down.total, total, cfg, down.n) : 0;
      if (down.total < (cfg.w || 0) * 2.5) d0 = 0; // (while it's that short, all of it changes as it grows)
      var box = boxOf(S, d0, cfg.reach, prevTail ? boxOf(prevTail, d0, cfg.reach, [Infinity, Infinity, -Infinity, -Infinity]) : [Infinity, Infinity, -Infinity, -Infinity]);
      var rects = box[2] > box[0] ? deviceRects(box, down.sym) : [];
      if (rects.length) { if (down.sym.length) markNearSym(S, box, rects, cfg.reach, down.sym); else markNear(S, box, cfg.reach); }
      // (smoothed points near the tip still move as the line goes on: only
      // those that are settled count as unchanged next time)
      down.S = S; down.total = total; down.n = down.raw && !down.shape ? Math.min(pts.length, down.settled) : pts.length;
      if (!rects.length) return;
      // (the part to redraw is drawn on a spare sheet with nothing cut away,
      // then just the redraw area is copied over: a line drawn cut to an area
      // isn't always filled quite the same as one drawn whole, and that showed
      // as faint seams where one frame's redraw met the last)
      var sc = drawSpare && drawSpare.width === ov.width && drawSpare.height === ov.height ? drawSpare : (drawSpare = document.createElement('canvas'));
      if (sc.width !== ov.width || sc.height !== ov.height) { sc.width = ov.width; sc.height = ov.height; }
      var sx = sc.getContext('2d'); sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, sc.width, sc.height); base(sx);
      strokeOn(sx, S, cfg, down, R, box, rects);
      octx.save();
      octx.setTransform(1, 0, 0, 1, 0, 0); clipTo2(octx, rects);
      rects.forEach(function (r) { var w = r[2] - r[0], h = r[3] - r[1]; octx.clearRect(r[0], r[1], w, h); octx.drawImage(sc, r[0], r[1], w, h, r[0], r[1], w, h); });
      base(octx);
      maskOv(rects); // (inside the redraw area only, so edges aren't masked twice)
      if (st.tool === 'eraser') eraseFromSheet(rects);
      octx.restore();
    }
    // THE ERASER works through the same engine: its stroke is drawn on the
    // (hidden) sheet, and the layer is shown as it was when the stroke began
    // with the sheet taken out of it at the eraser's opacity, so a stroke
    // rubs out evenly, never more where it crosses itself
    var eraseBase = null;
    function eraseStart() {
      if (!eraseBase || eraseBase.width !== active.cv.width || eraseBase.height !== active.cv.height) { eraseBase = document.createElement('canvas'); eraseBase.width = active.cv.width; eraseBase.height = active.cv.height; }
      var x = eraseBase.getContext('2d'); x.clearRect(0, 0, eraseBase.width, eraseBase.height); x.drawImage(active.cv, 0, 0);
    }
    function eraseFromSheet(rects) {
      var c = active.ctx; c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      if (rects) { clipTo2(c, rects); rects.forEach(function (r) { c.clearRect(r[0], r[1], r[2] - r[0], r[3] - r[1]); }); } else c.clearRect(0, 0, c.canvas.width, c.canvas.height);
      c.drawImage(eraseBase, 0, 0);
      c.globalAlpha = st.alpha; c.globalCompositeOperation = active.bg ? 'source-over' : 'destination-out';
      c.drawImage(ov, 0, 0); c.restore();
      if (active.isMask) { maskAlpha(active.owner, rects); viewOf(active.owner, rects); } // (on a mask: it shows as it goes)
      else if (usesView(active)) viewOf(active, rects);
    }
    // SYMMETRY: everything drawn is drawn again for each copy: mirrored
    // across an upright line (vertical), a level one (horizontal) or both
    // (quadrant), or turned round a centre (radial: 2 to 16 segments, each
    // mirrored as well if Mirror is on). The guide's centre can be dragged
    // anywhere and its axis turned (by the little handle at its end). Each
    // copy is a transform [a, b, c, d, e, f] of the picture.
    var symN = 6, symMirror = false, symC = { x: 0.5, y: 0.5 }, symA = 0;
    function mul(m, n) { return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; }
    function symCentre() { return { x: symC.x * W, y: symC.y * H }; }
    // (turned by a round the centre; mirrored across the line through it at angle a)
    function turn(a) { var c = symCentre(), co = Math.cos(a), si = Math.sin(a); return [co, si, -si, co, c.x - co * c.x + si * c.y, c.y - si * c.x - co * c.y]; }
    function flip(a) { var c = symCentre(), co = Math.cos(2 * a), si = Math.sin(2 * a); return [co, si, si, -co, c.x - co * c.x - si * c.y, c.y - si * c.x + co * c.y]; }
    function copies() {
      var out = [], i, up = symA - Math.PI / 2;
      if (st.sym === 'x') out = [flip(up)];
      else if (st.sym === 'y') out = [flip(symA)];
      else if (st.sym === 'xy') out = [flip(up), flip(symA), turn(Math.PI)];
      else if (st.sym === 'radial') {
        for (i = 1; i < symN; i++) out.push(turn(i * 2 * Math.PI / symN));
        if (symMirror) for (i = 0; i < symN; i++) out.push(mul(turn(i * 2 * Math.PI / symN), flip(up)));
      }
      return out;
    }
    function mapPt(m, q) { return { x: m[0] * q.x + m[2] * q.y + m[4], y: m[1] * q.x + m[3] * q.y + m[5] }; }
    function both(c, fn) {
      fn();
      copies().forEach(function (m) { c.save(); c.setTransform(R * m[0], R * m[1], R * m[2], R * m[3], R * m[4], R * m[5]); fn(); c.restore(); });
    }
    // the guide over the picture: its lines (full lines for a mirror, rays
    // out from the centre for radial), and its two handles on the screen
    var symDot = document.createElement('button'), symTurn = document.createElement('button');
    symDot.type = symTurn.type = 'button'; symDot.className = 'paint-symc'; symTurn.className = 'paint-symr';
    symDot.setAttribute('aria-label', 'Move the symmetry guide (double-click to put it back in the middle)'); symDot.title = 'Drag to move the guide · double-click to centre it';
    symTurn.setAttribute('aria-label', 'Turn the symmetry guide'); symTurn.title = 'Drag to turn the guide (Shift: steps of 15°)';
    symDot.hidden = symTurn.hidden = true; stage.appendChild(symDot); stage.appendChild(symTurn);
    function turnDir() { return st.sym === 'y' ? symA : symA - Math.PI / 2; }
    function drawGuide() {
      var L = Math.hypot(W, H) * 2, c = symCentre(), lines = [], i;
      var line = function (a, ray, at, cls) { var o = at || c; lines.push([ray ? o.x : o.x - Math.cos(a) * L, ray ? o.y : o.y - Math.sin(a) * L, o.x + Math.cos(a) * L, o.y + Math.sin(a) * L, cls || '']); };
      if (st.sym === 'x' || st.sym === 'xy') line(symA - Math.PI / 2);
      if (st.sym === 'y' || st.sym === 'xy') line(symA);
      if (st.sym === 'radial') for (i = 0; i < symN; i++) line(symA - Math.PI / 2 + i * 2 * Math.PI / symN, true);
      // (the drawing assist: the ruler's edge; or each vanishing point's rays,
      // and the horizon through the first two)
      if (gMode === 'ruler') line(rulA, false, rulCentre(), 'ruler');
      else if (gMode && gMode !== 'off') {
        var V = vpts();
        V.forEach(function (v, j) { for (var a = 0; a < 24; a++) line(a * Math.PI / 12, true, v, 'faint'); });
        if (V.length > 1) { var h = Math.atan2(V[1].y - V[0].y, V[1].x - V[0].x); line(h, false, V[0], 'horizon'); }
        else line(0, false, V[0], 'horizon');
      }
      guide.hidden = !lines.length;
      guide.innerHTML = lines.length ? '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' + lines.map(function (l) { return '<line' + (l[4] ? ' class="' + l[4] + '"' : '') + ' x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2] + '" y2="' + l[3] + '"/>'; }).join('') + '</svg>' : '';
      placeSymHandles();
    }
    // GUIDES: a ruler, or perspective with 1, 2 or 3 vanishing points, shown
    // over the picture (gMode); on their own they don't touch what's drawn.
    // DRAWING ASSIST (assistOn, its own switch): a stroke goes the way
    // closest to how it starts (along the ruler or square to it; toward a
    // vanishing point, or level or upright where those count; or, with no
    // ruler or perspective, along the grid's lines, shown or not, if it's
    // within ASSIST_TOL of one, so other ways stay freehand), and stays
    // straight along it, from just where it started. The way is chosen once,
    // after ASSIST_PX on the screen
    var assistOn = stored('paint-assist', false) === true, ASSIST_PX = 10, ASSIST_TOL = 20 * Math.PI / 180;
    var gMode = 'off', rulC = { x: 0.5, y: 0.5 }, rulA = 0, VP = [{ x: 0.5, y: 0.42 }, { x: 0.12, y: 0.42 }, { x: 0.88, y: 0.42 }, { x: 0.5, y: 1.25 }];
    function rulCentre() { return { x: rulC.x * W, y: rulC.y * H }; }
    // (1 point: the middle one; 2 points: left and right; 3: and one below)
    function vpIdx() { return gMode === 'p1' ? [0] : gMode === 'p2' ? [1, 2] : gMode === 'p3' ? [1, 2, 3] : []; }
    function vpts() { return vpIdx().map(function (i) { return { x: VP[i].x * W, y: VP[i].y * H }; }); }
    function assistDirs(s0) {
      if (gMode === 'off') return gridDirs();
      var out = [], unit = function (x, y) { var l = Math.hypot(x, y); if (l > 1e-6) out.push({ x: x / l, y: y / l }); };
      if (gMode === 'ruler') { unit(Math.cos(rulA), Math.sin(rulA)); unit(-Math.sin(rulA), Math.cos(rulA)); return out; }
      vpts().forEach(function (v) { unit(v.x - s0.x, v.y - s0.y); });
      if (gMode === 'p1') { unit(1, 0); unit(0, 1); } else if (gMode === 'p2') unit(0, 1);
      return out;
    }
    // (a point of the stroke, put on the line it's keeping to; a stroke
    // started in no way near one stays freehand (gfree). The line tool,
    // dyn, picks the nearest way again as it moves)
    function assist(q, dyn) {
      if (!assistOn || !down || !down.start || down.gfree) return q;
      var s0 = down.start, dx = q.x - s0.x, dy = q.y - s0.y, len = Math.hypot(dx, dy);
      if (!down.gdir || dyn) {
        if (len * view.k < ASSIST_PX) return dyn ? q : { x: s0.x, y: s0.y, pr: q.pr };
        var best = null, bd = gMode === 'off' ? ASSIST_TOL : 9; // (a ruler or perspective always takes its nearest way)
        assistDirs(s0).forEach(function (d) { var a = Math.acos(Math.min(1, Math.abs(dx * d.x + dy * d.y) / len)); if (a < bd) { bd = a; best = d; } });
        if (!best) { if (!dyn) down.gfree = true; return q; }
        if (dyn) { var t0 = dx * best.x + dy * best.y; return { x: s0.x + best.x * t0, y: s0.y + best.y * t0, pr: q.pr }; }
        down.gdir = best;
      }
      var d = down.gdir, t = dx * d.x + dy * d.y;
      return { x: s0.x + d.x * t, y: s0.y + d.y * t, pr: q.pr };
    }
    function setAssist(m) {
      gMode = m; drawGuide();
      mirrorLit();
      if (typeof ctxEl !== 'undefined' && ctxEl) ctxSync();
    }
    function setAssistOn(on) { assistOn = on; storeIt('paint-assist', on); mirrorLit(); if (typeof ctxEl !== 'undefined' && ctxEl) ctxSync(); }
    var TURN_R = 64; // (how far the turning handle sits from the centre, on the screen)
    function placeSymHandles() {
      if (!symDot) return; // (not made yet)
      placeAssist();
      var on = st.sym !== 'off';
      symDot.hidden = symTurn.hidden = !on;
      if (!on) return;
      var c = toScreen(symCentre()), x = c.x, y = c.y, d = turnDir() + view.r;
      symDot.style.translate = Math.round(x) + 'px ' + Math.round(y) + 'px';
      symTurn.style.translate = Math.round(x + Math.cos(d) * TURN_R) + 'px ' + Math.round(y + Math.sin(d) * TURN_R) + 'px';
    }
    // dragging them: the centre snaps to the middle of the picture, the
    // angle to upright and level (and to steps of 15° with Shift held)
    function symDrag(el, fn) {
      el.addEventListener('pointerdown', function (e) {
        if (e.button) return;
        e.preventDefault(); e.stopPropagation(); hideRing();
        try { el.setPointerCapture(e.pointerId); } catch (x) {}
        el.classList.add('held'); stage.classList.add('guiding'); busy(true, e);
        function mv(ev) { busyMove(ev); var r = stage.getBoundingClientRect(); fn(ev, ev.clientX - r.left, ev.clientY - r.top); drawGuide(); }
        function up() { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.classList.remove('held'); stage.classList.remove('guiding'); busy(false); }
        el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      });
    }
    symDrag(symDot, function (ev, sx, sy) {
      var q = fromScreen(sx, sy), px = q.x, py = q.y, snap = 8 / view.k;
      if (Math.abs(px - W / 2) < snap) px = W / 2;
      if (Math.abs(py - H / 2) < snap) py = H / 2;
      symC = { x: Math.max(0, Math.min(1, px / W)), y: Math.max(0, Math.min(1, py / H)) };
    });
    symDrag(symTurn, function (ev, sx, sy) {
      var c = toScreen(symCentre()), a = Math.atan2(sy - c.y, sx - c.x) - view.r, step = Math.PI / 12;
      a = st.sym === 'y' ? a : a + Math.PI / 2;
      var near = Math.round(a / step) * step;
      if (ev.shiftKey || Math.abs(a - near) < Math.PI / 60) a = near;
      symA = a;
    });
    symDot.addEventListener('dblclick', function () { symC = { x: 0.5, y: 0.5 }; symA = 0; drawGuide(); });
    // (the drawing assist's handles: the ruler's middle (move) and end (turn),
    // and a dot for each vanishing point; they can go off the picture's edge)
    var rulDot = document.createElement('button'), rulTurn = document.createElement('button'), vpEls = [];
    rulDot.type = rulTurn.type = 'button'; rulDot.className = 'paint-symc paint-gd'; rulTurn.className = 'paint-symr paint-gd';
    rulDot.setAttribute('aria-label', 'Move the ruler'); rulTurn.setAttribute('aria-label', 'Turn the ruler');
    rulDot.hidden = rulTurn.hidden = true; stage.appendChild(rulDot); stage.appendChild(rulTurn);
    for (var vi = 0; vi < 4; vi++) { var ve = document.createElement('button'); ve.type = 'button'; ve.className = 'paint-symc paint-gd paint-vp'; ve.setAttribute('aria-label', 'Move this vanishing point'); ve.hidden = true; stage.appendChild(ve); vpEls.push(ve); }
    function placeAssist() {
      if (!rulDot || !vpEls) return; // (not made yet)
      rulDot.hidden = rulTurn.hidden = gMode !== 'ruler';
      if (gMode === 'ruler') {
        var c = toScreen(rulCentre()), d = rulA + view.r;
        rulDot.style.translate = Math.round(c.x) + 'px ' + Math.round(c.y) + 'px';
        rulTurn.style.translate = Math.round(c.x + Math.cos(d) * TURN_R * 1.6) + 'px ' + Math.round(c.y + Math.sin(d) * TURN_R * 1.6) + 'px';
      }
      var ids = vpIdx();
      vpEls.forEach(function (el, i) { var on = ids.indexOf(i) >= 0; el.hidden = !on; if (on) { var q = toScreen({ x: VP[i].x * W, y: VP[i].y * H }); el.style.translate = Math.round(q.x) + 'px ' + Math.round(q.y) + 'px'; } });
    }
    symDrag(rulDot, function (ev, sx, sy) { var q = fromScreen(sx, sy); rulC = { x: Math.max(0, Math.min(1, q.x / W)), y: Math.max(0, Math.min(1, q.y / H)) }; });
    symDrag(rulTurn, function (ev, sx, sy) {
      var c = toScreen(rulCentre()), a = Math.atan2(sy - c.y, sx - c.x) - view.r, step = Math.PI / 12, near2 = Math.round(a / step) * step;
      if (ev.shiftKey || Math.abs(a - near2) < Math.PI / 60) a = near2;
      rulA = a;
    });
    vpEls.forEach(function (el, i) { symDrag(el, function (ev, sx, sy) { var q = fromScreen(sx, sy); VP[i] = { x: Math.max(-2, Math.min(3, q.x / W)), y: Math.max(-2, Math.min(3, q.y / H)) }; }); });
    function setSym(v) {
      st.sym = v; drawGuide(); symOpts(); mirrorLit();
    }
    // (lit while symmetry, a ruler or perspective, the grid or Drawing Assist is on)
    function mirrorLit() { var b = $('.paint-mirror'); if (b) b.setAttribute('aria-pressed', st.sym !== 'off' || gMode !== 'off' || gridOn || assistOn ? 'true' : 'false'); }
    function setGrid(on) { gridOn = on; storeIt('paint-grid-on', on); gridDraw(); mirrorLit(); if (typeof ctxEl !== 'undefined' && ctxEl) ctxSync(); }
    mirrorLit();
    // SPRAY: an airbrush's cloud of droplets. Where each lands is scattered
    // round the middle by a bell curve, so the cloud is thickest in the
    // middle and thins out smoothly to nothing: no edge, no ring. Droplets
    // are a mix of sizes (smaller and fainter further out), over a haze of
    // very fine ones. It builds up the longer it's held, and an Apple Pencil
    // sprays more the harder it's pressed. (They're drawn in a few batches,
    // by strength, so a cloud of hundreds costs only a few fills.)
    function sprayRadius(size) { return Math.max(5, size * 1.6); }
    function sprayReach(size) { return sprayRadius(size) * 1.6 + 1; }
    function spray(c, p, size, color, flow) {
      var sz = size || st.size, r = sprayRadius(sz), sig = r * 0.5, far = r * 1.55, f = flow == null ? 1 : flow;
      var n = Math.round(Math.min(1400, Math.max(r * 3, r * r * 0.17)) * f), dot = Math.min(1.25, 0.5 + sz * 0.012);
      var px = Math.hypot(c.getTransform().a, c.getTransform().b) || 1, tiny = 0.6 / px;
      var A = [0.22, 0.45, 0.7, 0.95], paths = A.map(function () { return new Path2D(); });
      function drop(spread, big, haze) {
        // (a bell curve in both directions; the rare one past the far edge is thrown again)
        var d, t = 0;
        do { d = spread * Math.sqrt(-2 * Math.log(Math.random() || 1e-9)); } while (d > far && ++t < 6);
        if (d > far) d = Math.random() * far;
        var a = Math.random() * Math.PI * 2, x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d, out = d / far;
        var rad = haze ? (0.25 + Math.random() * 0.25) * dot : big * (0.3 + Math.random() * Math.random() * 0.95) * (1 - out * 0.45);
        var k = haze ? 0 : Math.min(3, Math.floor(Math.random() * 4 * (1 - out * 0.6)));
        var q = paths[k];
        if (rad < tiny) q.rect(x - rad, y - rad, rad * 2, rad * 2);
        else { q.moveTo(x + rad, y); q.arc(x, y, rad, 0, Math.PI * 2); }
      }
      for (var i = 0; i < n; i++) drop(sig, dot, false);
      for (var j = 0; j < n * 0.9; j++) drop(sig * 1.12, dot, true);
      c.save(); c.fillStyle = color || st.color;
      for (var m = 0; m < A.length; m++) { c.globalAlpha = A[m]; c.fill(paths[m]); }
      c.restore();
    }
    var sprayTimer = 0;
    // how a stroke is laid onto the layer: its opacity, and (for the
    // highlighter) multiply
    function strokeLook(which) {
      var b = baseOf(which || (st.tool === 'brush' ? st.brush : ''));
      if (b === 'highlighter') return { mode: 'multiply', alpha: Math.min(st.alpha, 0.45) };
      return { mode: null, alpha: st.alpha * (b === 'marker' ? 0.88 : b === 'pencil' ? 0.92 : 1) };
    }
    // while it's being drawn, the see-through sheet shows the stroke just
    // as it will be laid down (at its opacity, and the layer's), so it
    // doesn't jump when the pointer lifts
    function liveLook() {
      var lk = strokeLook();
      if (st.tool === 'eraser') { ov.style.opacity = 0; ov.style.mixBlendMode = ''; return; }
      ov.style.opacity = lk.alpha * (active ? active.opacity : 1);
      ov.style.mixBlendMode = lk.mode || '';
    }
    function plainOv() { ov.style.opacity = ''; ov.style.mixBlendMode = ''; }
    function commit(mode, alpha) {
      var c = active.ctx;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      // (with alpha lock, the paint only lands on what's there, and keeps its see-through-ness)
      if (active.alphaLock && !mode) mode = 'source-atop';
      c.globalAlpha = alpha; if (mode) c.globalCompositeOperation = mode;
      c.drawImage(ov, 0, 0); c.restore();
      octx.clearRect(0, 0, W, H); plainOv(); viewsSoon();
    }

    // ---- smudge and blur: worked straight into the layer, a dab at a time ----
    var carry = [];
    function region(p) { var r = Math.max(4, st.size), s = Math.max(2, Math.round(2 * r * R)); return { x: Math.round((p.x - r) * R), y: Math.round((p.y - r) * R), s: s }; }
    function soft(cv) {
      // a soft round edge
      var x = cv.getContext('2d'), s = cv.width, g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.globalCompositeOperation = 'destination-in'; x.fillStyle = g; x.fillRect(0, 0, s, s); x.globalCompositeOperation = 'source-over';
    }
    function grab(q, into) {
      var c = into || document.createElement('canvas'); c.width = c.height = q.s;
      var x = c.getContext('2d'); x.clearRect(0, 0, q.s, q.s); x.drawImage(active.cv, q.x, q.y, q.s, q.s, 0, 0, q.s, q.s);
      return c;
    }
    function dab(p, i, first) {
      var q = region(p), c = active.ctx;
      c.save(); clipTo(c); dab1(q, c, i, first); c.restore();
    }
    function dab1(q, c, i, first) {
      if (st.tool === 'tone') {
        // LIGHT & DARK: the spot is lightened (screen) or darkened (multiply)
        // softly, only where there's paint, and laid back where it was
        var t3 = grab(q), was = grab(q), x3 = t3.getContext('2d'), s3 = q.s / 2;
        var rg = x3.createRadialGradient(s3, s3, 0, s3, s3, s3), a3 = 0.02 + 0.06 * st.alpha;
        rg.addColorStop(0, 'rgba(128,128,128,' + a3 + ')'); rg.addColorStop(0.55, 'rgba(128,128,128,' + a3 * 0.7 + ')'); rg.addColorStop(1, 'rgba(128,128,128,0)');
        x3.globalCompositeOperation = st.tone === 'burn' ? 'multiply' : 'screen'; x3.fillStyle = rg; x3.fillRect(0, 0, q.s, q.s);
        x3.globalCompositeOperation = 'destination-in'; x3.drawImage(was, 0, 0);
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(q.x, q.y, q.s, q.s); c.drawImage(t3, q.x, q.y);
        return;
      }
      if (st.tool === 'smudge') {
        if (first || !carry[i]) { carry[i] = grab(q); return; }
        var t = document.createElement('canvas'); t.width = t.height = q.s;
        t.getContext('2d').drawImage(carry[i], 0, 0, q.s, q.s); soft(t);
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.55 * st.alpha + 0.2; c.drawImage(t, q.x, q.y); c.restore();
        carry[i] = grab(q, carry[i]);
      } else {
        // blur: shrink the spot, grow it back (soft), and lay it over itself
        var small = document.createElement('canvas'), n = Math.max(2, Math.round(q.s / 5));
        small.width = small.height = n;
        small.getContext('2d').drawImage(active.cv, q.x, q.y, q.s, q.s, 0, 0, n, n);
        var t2 = document.createElement('canvas'); t2.width = t2.height = q.s;
        var tx = t2.getContext('2d'); tx.imageSmoothingQuality = 'high'; tx.drawImage(small, 0, 0, q.s, q.s); soft(t2);
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.5 * st.alpha + 0.15; c.drawImage(t2, q.x, q.y); c.restore();
      }
    }
    function dabs(a, b, first) {
      var step = Math.max(1, st.size / 4), d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / step));
      for (var j = 1; j <= n; j++) {
        var p = { x: a.x + (b.x - a.x) * j / n, y: a.y + (b.y - a.y) * j / n };
        dab(p, 0, first && j === 1);
        copies().forEach(function (m, n) { dab(mapPt(m, p), n + 1, first && j === 1); });
      }
      guard();
    }

    // ---- shapes ----
    function shapePath(c, a, b, shift) {
      var x = b.x, y = b.y, t = st.tool === 'line' ? 'line' : st.shape;
      if (shift && t === 'line') {
        var ang = Math.round(Math.atan2(y - a.y, x - a.x) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(x - a.x, y - a.y);
        x = a.x + Math.cos(ang) * len; y = a.y + Math.sin(ang) * len;
      } else if (shift) {
        var s = Math.max(Math.abs(x - a.x), Math.abs(y - a.y)); x = a.x + (x < a.x ? -s : s); y = a.y + (y < a.y ? -s : s);
      }
      var l = Math.min(a.x, x), tp = Math.min(a.y, y), w = Math.abs(x - a.x), h = Math.abs(y - a.y), cx = l + w / 2, cy = tp + h / 2;
      c.beginPath();
      if (t === 'line') { c.moveTo(a.x, a.y); c.lineTo(x, y); c.stroke(); return; }
      if (t === 'arrow') {
        // a line with a head at the end it's drawn to
        var an = Math.atan2(y - a.y, x - a.x), hl = Math.max(10, st.size * 3.2);
        c.moveTo(a.x, a.y); c.lineTo(x, y);
        c.moveTo(x - hl * Math.cos(an - 0.45), y - hl * Math.sin(an - 0.45)); c.lineTo(x, y); c.lineTo(x - hl * Math.cos(an + 0.45), y - hl * Math.sin(an + 0.45));
        c.stroke(); return;
      }
      if (t === 'rect') c.rect(l, tp, w, h);
      else if (t === 'rounded') { var r = Math.min(w, h) * 0.2; if (c.roundRect) c.roundRect(l, tp, w, h, r); else c.rect(l, tp, w, h); }
      else if (t === 'ellipse') c.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      else if (t === 'triangle') { c.moveTo(cx, tp); c.lineTo(l + w, tp + h); c.lineTo(l, tp + h); c.closePath(); }
      else if (t === 'star') {
        for (var i = 0; i < 10; i++) { var rr = i % 2 ? 0.42 : 1, ag = -Math.PI / 2 + i * Math.PI / 5; c[i ? 'lineTo' : 'moveTo'](cx + Math.cos(ag) * w / 2 * rr, cy + Math.sin(ag) * h / 2 * rr); }
        c.closePath();
      }
      if (st.solid) c.fill(); else c.stroke();
    }

    // ---- GRADIENTS: linear, radial (out from a centre), angular (round a
    // centre, like a clock's hand), diamond, or freeform (colour points
    // anywhere, blended smoothly). A drag makes one, from the colour to the
    // second colour, and it then stays to be worked on before it's laid down:
    // its ends (a radial, angular or diamond one's centre, which moves it all,
    // and its edge, which sizes and turns it) and its colour stops are
    // dragged on the picture (gradUi); a drag along its line moves it, a tap
    // on the line adds a stop, and a stop pulled well off the line goes. A
    // picked stop (or point) takes the colour in hand, and picking a colour
    // changes it; each has an opacity of its own. Done, Return, another tool
    // or a drag somewhere else lays it down, as one step that undo brings back
    // to work on (e.grad); its changes before then are steps of their own,
    // like the pen's (grad.hist / grad.fut). Linear, radial and angular are
    // drawn by the browser at full size; diamond and freeform are worked out a
    // pixel at a time, smaller while they're being changed (gradPixels) ----
    var GRAD_KINDS = [
      ['linear', 'Linear', 'Linear: from one end of the line to the other', '<rect x="4.5" y="4.5" width="15" height="15" rx="2.5"/><path d="M9 4.5v15" stroke-opacity=".3"/><path d="M12 4.5v15" stroke-opacity=".55"/><path d="M15 4.5v15" stroke-opacity=".8"/>'],
      ['radial', 'Radial', 'Radial: out from a centre, in rings', '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="4" stroke-opacity=".55"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'],
      ['angular', 'Angular', 'Angular: round a centre, like a clock’s hand', '<circle cx="12" cy="12" r="7.5" stroke-opacity=".4"/><path d="M12 12V4.5"/><path d="M12 4.5a7.5 7.5 0 1 1-7.5 7.5"/>'],
      ['diamond', 'Diamond', 'Diamond: out from a centre, in diamonds', '<path d="M12 3.5l8.5 8.5-8.5 8.5-8.5-8.5z"/><path d="M12 8.5l3.5 3.5-3.5 3.5-3.5-3.5z" stroke-opacity=".55"/>'],
      ['free', 'Freeform', 'Freeform: colour points anywhere, blended smoothly', '<circle cx="7.5" cy="8" r="2.2"/><circle cx="16.5" cy="9.5" r="2.2"/><circle cx="11" cy="16.5" r="2.2"/><path d="M9.7 8.3l4.6.9M15.2 11.4l-2.8 3.3M8.3 10.1l1.6 4.3" stroke-opacity=".45"/>']
    ];
    var gradKind = stored('paint-grad-kind', 'linear'); if (!GRAD_KINDS.some(function (k) { return k[0] === gradKind; })) gradKind = 'linear';
    // (gradGone: a gradient just let go by undo, for redo to bring back;
    // gradRun: a colour or opacity being changed, kept as one step)
    var grad = null, gradGone = null, gradRun = false, gradQuiet = false, gradFrame = 0, gradFull = 0;
    function gradCopy(g) {
      var P = function (q) { return { x: q.x, y: q.y }; };
      return { kind: g.kind, a: P(g.a), b: P(g.b), stops: g.stops.map(function (s) { return { t: s.t, c: s.c, o: s.o }; }),
        pts: g.pts.map(function (q) { return { x: q.x, y: q.y, c: q.c, o: q.o }; }), pick: g.pick ? { k: g.pick.k, i: g.pick.i } : null };
    }
    function gradKeep() { var k = gradCopy(grad); k.hist = grad.hist.slice(); return k; }
    function gradSnap() { return gradCopy(grad); }
    function gradPut(sn) { var g = gradCopy(sn); g.hist = grad.hist; g.fut = grad.fut; g.fromUndo = grad.fromUndo; grad = g; }
    function gradRecord(sn) {
      grad.hist.push(sn); grad.fut = []; gradGone = null;
      if (grad.fromUndo) { grad.fromUndo = false; redo = []; } // (changed: the one laid down before is no longer ahead)
      buttons();
    }
    function gradUndo() { if (!grad.hist.length) return false; grad.fut.push(gradSnap()); gradPut(grad.hist.pop()); gradShow(); return true; }
    function gradRedo() { if (!grad.fut.length) return false; grad.hist.push(gradSnap()); gradPut(grad.fut.pop()); gradShow(); return true; }
    function gradRestore(k, fromUndo) {
      grad = gradCopy(k); grad.hist = (k.hist || []).slice(); grad.fut = []; grad.fromUndo = !!fromUndo;
      if (st.tool !== 'gradient') setTool('gradient');
      gradShow();
    }
    function gradShow() { gradDraw(); buttons(); ctxSync(); ctxShow(); }
    // (colours go into the handles' drawing: only #rrggbb ones are taken)
    function gradCol(c) { return /^#[0-9a-f]{6}$/i.test(c) ? c : '#000000'; }
    function gradNew(a) { return { kind: gradKind, a: { x: a.x, y: a.y }, b: { x: a.x, y: a.y }, stops: [{ t: 0, c: gradCol(st.color), o: 1 }, { t: 1, c: gradCol(st.color2), o: 1 }], pts: [], pick: null, hist: [], fut: [] }; }
    function gradSort() { var pk = grad.pick && grad.pick.k === 's' ? grad.stops[grad.pick.i] : null; grad.stops.sort(function (a, b) { return a.t - b.t; }); if (pk) grad.pick.i = grad.stops.indexOf(pk); }
    function gradEmpty(g) { return g.kind === 'free' ? !g.pts.length : g.a.x === g.b.x && g.a.y === g.b.y; }
    // (the stop or point picked: the colour in hand becomes its colour, and
    // picking another colour changes it)
    function gradPicked() { var p = grad && grad.pick; return p ? (p.k === 's' ? grad.stops[p.i] : grad.pts[p.i]) || null : null; }
    function gradPick(k, i) { grad.pick = k ? { k: k, i: i } : null; var s = gradPicked(); if (s && !maskSwap && s.c.toLowerCase() !== st.color.toLowerCase()) { gradQuiet = true; setColor(s.c); gradQuiet = false; } }
    function gradTint(c) {
      var s = gradPicked(); if (!s || gradQuiet || !/^#[0-9a-f]{6}$/i.test(c) || s.c.toLowerCase() === c.toLowerCase()) return;
      if (!gradRun) { gradRecord(gradSnap()); gradRun = true; s = gradPicked(); }
      s.c = c; gradDraw(); gradBarSync();
    }
    function gradOpacity(o) {
      var s = gradPicked(); if (!s) return;
      if (!gradRun) { gradRecord(gradSnap()); gradRun = true; s = gradPicked(); }
      s.o = o; gradDraw(); ctxSync();
    }
    ['pointerup', 'pointercancel'].forEach(function (t) { document.addEventListener(t, function () { gradRun = false; }, true); });
    function hexRgb(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    // the colour at t along the stops: eased between each two (smoothstep, as
    // the gradient always was), weighted by how solid each is, so a colour
    // fading out doesn't go grey on the way
    function gradAt(S, t) {
      var i = 0; while (i < S.length - 2 && t > S[i + 1].t) i++;
      var s0 = S[i], s1 = S[Math.min(i + 1, S.length - 1)];
      var u = s1.t > s0.t ? Math.max(0, Math.min(1, (t - s0.t) / (s1.t - s0.t))) : t >= s1.t ? 1 : 0, e = u * u * (3 - 2 * u);
      var c0 = hexRgb(s0.c), c1 = hexRgb(s1.c), a0 = s0.o * (1 - e), a1 = s1.o * e, a = a0 + a1;
      if (a <= 0) return [c0[0] + (c1[0] - c0[0]) * e, c0[1] + (c1[1] - c0[1]) * e, c0[2] + (c1[2] - c0[2]) * e, 0];
      return [(c0[0] * a0 + c1[0] * a1) / a, (c0[1] * a0 + c1[1] * a1) / a, (c0[2] * a0 + c1[2] * a1) / a, a];
    }
    // (1024 colours along it, made again only when the stops change)
    var gradLutKey = '', gradLutC = null;
    function gradLut(S) {
      var key = JSON.stringify(S); if (key === gradLutKey) return gradLutC;
      var L = new Uint8ClampedArray(4096);
      for (var i = 0; i < 1024; i++) { var c = gradAt(S, i / 1023); L[i * 4] = c[0]; L[i * 4 + 1] = c[1]; L[i * 4 + 2] = c[2]; L[i * 4 + 3] = c[3] * 255; }
      gradLutKey = key; gradLutC = L; return L;
    }
    function gradCss(L, k) { return 'rgba(' + L[k] + ',' + L[k + 1] + ',' + L[k + 2] + ',' + (L[k + 3] / 255).toFixed(3) + ')'; }
    function gradNative(g) { return g.kind === 'linear' || g.kind === 'radial' || (g.kind === 'angular' && !!octx.createConicGradient); }
    function gradStyle(c, g, L) {
      var a = g.a, b = g.b, G;
      if (g.kind === 'linear') G = c.createLinearGradient(a.x, a.y, b.x, b.y);
      else if (g.kind === 'radial') G = c.createRadialGradient(a.x, a.y, 0, a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y));
      else G = c.createConicGradient(Math.atan2(b.y - a.y, b.x - a.x), a.x, a.y);
      for (var i = 0; i <= 128; i++) G.addColorStop(i / 128, gradCss(L, Math.round(i / 128 * 1023) * 4));
      return G;
    }
    // DIAMOND AND FREEFORM (and angular where the browser can't): a pixel at
    // a time, over the picture, in as many pixels as the budget allows
    // (stretched over it smoothly). Freeform mixes the points' colours, each
    // weighted by how near it is (1 / (distance² + a little)^1.5), so each
    // point holds its own colour round it and they blend smoothly between
    var gradCv = document.createElement('canvas'), gradCx = gradCv.getContext('2d');
    function gradPixels(g, L, budget) {
      var fw = ov.width, fh = ov.height, q = Math.min(1, Math.sqrt(budget / (fw * fh)));
      var w = Math.max(1, Math.round(fw * q)), h = Math.max(1, Math.round(fh * q));
      if (gradCv.width !== w || gradCv.height !== h) { gradCv.width = w; gradCv.height = h; }
      var img = gradCx.createImageData(w, h), d = img.data, sx = W / w, sy = H / h, x, y, k = 0, j, t;
      var a = g.a, b = g.b, r2 = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y) || 1;
      if (g.kind === 'diamond') {
        // (how far along the line to the corner, and across it, as fractions of it)
        var ux = (b.x - a.x) / r2, uy = (b.y - a.y) / r2, du = sx * ux, dv = -sx * uy;
        for (y = 0; y < h; y++) {
          var px0 = 0.5 * sx - a.x, py = (y + 0.5) * sy - a.y, u = px0 * ux + py * uy, v = -px0 * uy + py * ux;
          for (x = 0; x < w; x++, k += 4, u += du, v += dv) {
            t = (u < 0 ? -u : u) + (v < 0 ? -v : v); j = (t >= 1 ? 1023 : (t * 1023 + 0.5) | 0) * 4;
            d[k] = L[j]; d[k + 1] = L[j + 1]; d[k + 2] = L[j + 2]; d[k + 3] = L[j + 3];
          }
        }
      } else if (g.kind === 'angular') {
        var a0 = Math.atan2(b.y - a.y, b.x - a.x), TAU = Math.PI * 2;
        for (y = 0; y < h; y++) {
          var yy = (y + 0.5) * sy - a.y;
          for (x = 0; x < w; x++, k += 4) {
            t = (Math.atan2(yy, (x + 0.5) * sx - a.x) - a0) / TAU; t -= Math.floor(t); j = ((t * 1023 + 0.5) | 0) * 4;
            d[k] = L[j]; d[k + 1] = L[j + 1]; d[k + 2] = L[j + 2]; d[k + 3] = L[j + 3];
          }
        }
      } else {
        var P = g.pts, n = P.length, h2 = Math.pow(Math.hypot(W, H) * 0.01, 2), X = new Float64Array(n), Y = new Float64Array(n), CR = new Float64Array(n), CG = new Float64Array(n), CB = new Float64Array(n), CA = new Float64Array(n);
        P.forEach(function (q, i) { var c = hexRgb(q.c); X[i] = q.x; Y[i] = q.y; CA[i] = q.o; CR[i] = c[0] * q.o; CG[i] = c[1] * q.o; CB[i] = c[2] * q.o; });
        for (y = 0; y < h; y++) {
          var yc = (y + 0.5) * sy;
          for (x = 0; x < w; x++, k += 4) {
            var xc = (x + 0.5) * sx, sw = 0, sr = 0, sg = 0, sb = 0, sa = 0;
            for (var i = 0; i < n; i++) {
              var ex = xc - X[i], ey = yc - Y[i], q2 = ex * ex + ey * ey + h2, wt = 1 / (q2 * Math.sqrt(q2));
              sw += wt; sr += wt * CR[i]; sg += wt * CG[i]; sb += wt * CB[i]; sa += wt * CA[i];
            }
            if (sa > 0) { d[k] = sr / sa; d[k + 1] = sg / sa; d[k + 2] = sb / sa; }
            d[k + 3] = sa / sw * 255;
          }
        }
      }
      gradCx.putImageData(img, 0, 0);
      return gradCv;
    }
    // the gradient, filling a canvas whose units are the picture's
    // (budget: pixels to work out, for the pixel-at-a-time kinds)
    function gradFill(c, budget) {
      var g = grad, L = gradLut(g.stops);
      c.save();
      if (g.kind !== 'free' && gradNative(g)) { c.fillStyle = gradStyle(c, g, L); c.fillRect(0, 0, W, H); }
      else { var cv = gradPixels(g, L, budget); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(cv, 0, 0, W, H); }
      c.restore();
    }
    // WHILE IT'S BEING WORKED ON it's shown on a stand-in canvas over the
    // picture with about the screen's own detail (gradPv), not the
    // full-size sheet, so it keeps up on a big picture: only inside a
    // selection, and (as maskOv does for strokes) on the paint already there
    // with alpha lock, inside the layer's mask, or what it's clipped to.
    // quick: while it's changing (the pixel-at-a-time kinds coarser), then
    // properly once it rests. It's worked out at full size when laid down
    var gradPv = document.createElement('canvas'), gpx = gradPv.getContext('2d');
    gradPv.className = 'paint-gradpv'; gradPv.setAttribute('aria-hidden', 'true'); gradPv.hidden = true; ov.parentNode.insertBefore(gradPv, ov.nextSibling);
    function gradPaint(quick) {
      var g = grad;
      // (none: the stand-ins let go of their memory)
      if (!g) { gradPv.hidden = true; gradPv.width = gradPv.height = gradCv.width = gradCv.height = 1; return; }
      var fw = ov.width, fh = ov.height, q = Math.min(1, view.k * (window.devicePixelRatio || 1) / R, Math.sqrt(4e6 / (fw * fh)));
      var w = Math.max(1, Math.round(fw * q)), h = Math.max(1, Math.round(fh * q));
      if (gradPv.width !== w || gradPv.height !== h) { gradPv.width = w; gradPv.height = h; }
      gradPv.style.width = W + 'px'; gradPv.style.height = H + 'px';
      gpx.setTransform(1, 0, 0, 1, 0, 0); gpx.clearRect(0, 0, w, h);
      gradPv.style.opacity = st.alpha * (active ? active.opacity : 1); gradPv.hidden = false;
      if (gradEmpty(g)) return;
      gpx.setTransform(w / W, 0, 0, h / H, 0, 0);
      gradFill(gpx, quick ? Math.min(w * h, g.kind === 'free' ? 3e5 : 1.2e6) : Math.min(w * h, 4e6));
      gpx.save(); gpx.globalCompositeOperation = 'destination-in'; gpx.fillStyle = '#000';
      if (sel) { if (sel.mask) gpx.drawImage(sel.mask, sel.x, sel.y, sel.w, sel.h); else { selPath(gpx); gpx.fill(); } }
      var cb = active && !active.isMask && clipBase(active);
      if (active && !active.isMask) { if (active.alphaLock) gpx.drawImage(active.cv, 0, 0, W, H); if (active.mask) gpx.drawImage(active.mask.a, 0, 0, W, H); if (cb) gpx.drawImage(cb.mask ? cb.view || viewOf(cb) : cb.cv, 0, 0, W, H); }
      gpx.restore();
    }
    // (redrawn once a frame at most: the pixel-at-a-time kinds quickly while
    // they're being changed, then properly once they rest)
    function gradDraw() {
      gradMarks();
      if (!grad || gradFrame) return;
      gradFrame = requestAnimationFrame(function () {
        gradFrame = 0; if (!grad) return;
        var slow = grad.kind === 'free' || !gradNative(grad);
        gradPaint(slow); gradMarks();
        clearTimeout(gradFull); if (slow) gradFull = setTimeout(function () { if (grad && !down) gradPaint(false); }, 260);
      });
    }
    // (zoomed: shown again with the detail the screen now has, once it rests)
    function gradZoomed() { clearTimeout(gradFull); gradFull = setTimeout(function () { if (grad && !down) gradPaint(false); }, 200); }
    // ITS HANDLES, on the screen over the picture (so they're never cut off
    // at its edge, and stay the same size at any zoom): the line, with a dot
    // for each stop in its colour, and a dashed edge for radial, angular and
    // diamond; or a dot for each freeform point. The picked one is ringed
    var gradUi = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); gradUi.setAttribute('class', 'paint-gradui'); gradUi.setAttribute('aria-hidden', 'true'); gradUi.hidden = true;
    world.parentNode.insertBefore(gradUi, world.nextSibling);
    function gradMarks() {
      if (!grad) { if (!gradUi.hidden) { gradUi.hidden = true; gradUi.innerHTML = ''; } return; }
      var g = grad, h = '', f = function (v) { return Math.round(v * 10) / 10; }, pk = g.pick, drop = down && down.grad && down.off;
      var dot = function (q, c, o, on, r) { return '<g class="gu-dot' + (on ? ' on' : '') + (on && drop ? ' off' : '') + '"><circle class="gu-base" cx="' + f(q.x) + '" cy="' + f(q.y) + '" r="' + r + '"/><circle cx="' + f(q.x) + '" cy="' + f(q.y) + '" r="' + (r - 2.5) + '" fill="' + gradCol(c) + '" fill-opacity="' + (+o) + '"/></g>'; };
      if (g.kind === 'free') g.pts.forEach(function (q, i) { h += dot(toScreen(q), q.c, q.o, pk && pk.k === 'p' && pk.i === i, 8); });
      else {
        var A = toScreen(g.a), B = toScreen(g.b), dx = B.x - A.x, dy = B.y - A.y, r = Math.hypot(dx, dy);
        if (g.kind === 'radial' || g.kind === 'angular') h += '<circle class="gu-edge" cx="' + f(A.x) + '" cy="' + f(A.y) + '" r="' + f(r) + '"/>';
        if (g.kind === 'diamond') h += '<path class="gu-edge" d="M' + f(A.x + dx) + ' ' + f(A.y + dy) + 'L' + f(A.x - dy) + ' ' + f(A.y + dx) + 'L' + f(A.x - dx) + ' ' + f(A.y - dy) + 'L' + f(A.x + dy) + ' ' + f(A.y - dx) + 'Z"/>';
        var ln = 'x1="' + f(A.x) + '" y1="' + f(A.y) + '" x2="' + f(B.x) + '" y2="' + f(B.y) + '"';
        h += '<line class="gu-under" ' + ln + '/><line class="gu-line" ' + ln + '/>';
        var n = g.stops.length;
        g.stops.forEach(function (s, i) { h += dot({ x: A.x + dx * s.t, y: A.y + dy * s.t }, s.c, s.o, pk && pk.k === 's' && pk.i === i, i === 0 || i === n - 1 ? 8 : 6.5); });
      }
      gradUi.innerHTML = h; gradUi.hidden = false;
    }
    // what's under a point of the picture: an end (with its stop), a stop, a
    // freeform point, or the line (where, along it)
    function gradHit(p, tol) {
      var g = grad, best = null, bd = tol, d;
      if (g.kind === 'free') { g.pts.forEach(function (q, i) { d = Math.hypot(p.x - q.x, p.y - q.y); if (d <= bd) { bd = d; best = { k: 'p', i: i }; } }); return best; }
      var n = g.stops.length, at = function (s) { return { x: g.a.x + (g.b.x - g.a.x) * s.t, y: g.a.y + (g.b.y - g.a.y) * s.t }; };
      [0, n - 1].forEach(function (i) { var q = at(g.stops[i]); d = Math.hypot(p.x - q.x, p.y - q.y); if (d <= bd) { bd = d; best = { k: i ? 'b' : 'a', s: i }; } });
      for (var i = 1; i < n - 1; i++) { var q = at(g.stops[i]); d = Math.hypot(p.x - q.x, p.y - q.y); if (d <= bd) { bd = d; best = { k: 's', i: i }; } }
      if (best) return best;
      var vx = g.b.x - g.a.x, vy = g.b.y - g.a.y, l2 = vx * vx + vy * vy; if (!l2) return null;
      var t = ((p.x - g.a.x) * vx + (p.y - g.a.y) * vy) / l2, off = Math.abs((p.x - g.a.x) * vy - (p.y - g.a.y) * vx) / Math.sqrt(l2);
      return t > 0 && t < 1 && off <= tol ? { k: 'line', t: t } : null;
    }
    function gradDown(e, p) {
      var tol = (e.pointerType !== 'mouse' ? 20 : 10) / view.k;
      if (grad) {
        var sn = gradSnap(), h = gradHit(p, tol);
        if (h) {
          if (h.k === 'a' || h.k === 'b') gradPick('s', h.s); else if (h.k !== 'line') gradPick(h.k, h.i);
          if (h.k === 's') h.stop = grad.stops[h.i];
          down = { id: e.pointerId, start: p, last: p, grad: h, gradSnap: sn, g0: gradCopy(grad) }; gradShow(); return;
        }
        if (grad.kind === 'free') {
          // (a tap adds a colour point, in the colour in hand; it's picked
          // by tapping it, so the next colour chosen is for the next point)
          var q = p; grad.pts.push({ x: q.x, y: q.y, c: gradCol(st.color), o: 1 }); grad.pick = null;
          down = { id: e.pointerId, start: p, last: p, grad: { k: 'p', i: grad.pts.length - 1 }, gradSnap: sn, gradNew: true, g0: gradCopy(grad) }; gradShow(); return;
        }
        gradDone(); // (somewhere else: this one is laid down, and another begun)
        if (active && active.text && !paintAbove()) return;
      }
      grad = gradNew(p); gradGone = null;
      if (grad.kind === 'free') grad.pts = [{ x: grad.a.x, y: grad.a.y, c: gradCol(st.color), o: 1 }, { x: grad.a.x, y: grad.a.y, c: gradCol(st.color2), o: 1 }];
      down = { id: e.pointerId, start: p, last: p, grad: { k: 'new' } };
      gradShow();
    }
    // (Shift: the end turns in steps of 15° round the other end)
    function gradTurn(q, o, shift) {
      if (!shift) return q;
      var an = Math.round(Math.atan2(q.y - o.y, q.x - o.x) / (Math.PI / 12)) * (Math.PI / 12), l = Math.hypot(q.x - o.x, q.y - o.y);
      return { x: o.x + Math.cos(an) * l, y: o.y + Math.sin(an) * l };
    }
    function gradMove(p, e) {
      var dn = down, h = dn.grad, g = grad, g0 = dn.g0;
      if (!dn.moved && Math.hypot(p.x - dn.start.x, p.y - dn.start.y) * view.k < 3) return;
      dn.moved = true; dn.last = p;
      // (a handle moves as far as the pointer does, from where it was taken
      // hold of, so it doesn't jump to a finger that's a little off it)
      var shift = e.shiftKey, by = function (o) { return { x: o.x + p.x - dn.start.x, y: o.y + p.y - dn.start.y }; };
      if (h.k === 'new') { g.b = gradTurn({ x: p.x, y: p.y }, g.a, shift); if (g.kind === 'free') { g.pts[1].x = g.b.x; g.pts[1].y = g.b.y; } }
      else if (h.k === 'b') g.b = gradTurn(by(g0.b), g.a, shift);
      else if (h.k === 'a' && g.kind === 'linear') g.a = gradTurn(by(g0.a), g.b, shift);
      else if (h.k === 'a' || h.k === 'line') {
        // (a radial, angular or diamond one's centre, or the line: it all moves)
        var dx = p.x - dn.start.x, dy = p.y - dn.start.y;
        g.a = { x: g0.a.x + dx, y: g0.a.y + dy }; g.b = { x: g0.b.x + dx, y: g0.b.y + dy };
      } else if (h.k === 's') {
        // (along the line; pulled well off it, it goes when it's let go)
        var vx = g.b.x - g.a.x, vy = g.b.y - g.a.y, l2 = vx * vx + vy * vy || 1;
        h.stop.t = Math.max(0.001, Math.min(0.999, ((p.x - g.a.x) * vx + (p.y - g.a.y) * vy) / l2));
        dn.off = g.stops.length > 2 && Math.abs((p.x - g.a.x) * vy - (p.y - g.a.y) * vx) / Math.sqrt(l2) * view.k > 48;
        g.pick = { k: 's', i: 0 }; g.stops.sort(function (a, b) { return a.t - b.t; }); g.pick.i = g.stops.indexOf(h.stop);
      } else if (h.k === 'p') { var q = by(g0.pts[h.i]); g.pts[h.i].x = q.x; g.pts[h.i].y = q.y; }
      gradDraw(); if (h.k === 's') gradBarSync();
    }
    function gradUp() {
      var dn = down, h = dn.grad, g = grad; down = null;
      if (h.k === 'new') {
        // (a tap, not a drag: one a quarter of the picture across, to start from)
        if (!dn.moved) { g.b = { x: g.a.x + Math.max(W, H) / 4, y: g.a.y }; if (g.kind === 'free') g.pts.length = 1; }
      } else if (h.k === 'line' && !dn.moved) {
        // (a tap on the line: a stop there, in the colour the gradient has there)
        var c = gradAt(g.stops, h.t), s = { t: h.t, c: rgb2hex(c[0], c[1], c[2]), o: Math.round(c[3] * 100) / 100 };
        g.stops.push(s); g.stops.sort(function (a, b) { return a.t - b.t; }); gradPick('s', g.stops.indexOf(s)); gradRecord(dn.gradSnap);
      } else if (dn.off) { g.stops.splice(g.stops.indexOf(h.stop), 1); g.pick = null; gradRecord(dn.gradSnap); }
      else if (dn.moved || dn.gradNew) gradRecord(dn.gradSnap);
      gradShow();
    }
    function gradRemove() {
      var pk = grad && grad.pick; if (!pk) return;
      if (pk.k === 's' ? pk.i === 0 || pk.i === grad.stops.length - 1 : grad.pts.length < 2) return;
      var sn = gradSnap(); (pk.k === 's' ? grad.stops : grad.pts).splice(pk.i, 1); grad.pick = null; gradRecord(sn); gradShow();
    }
    // (end to end: the stops turned round; freeform: the points' colours)
    function gradReverse() {
      var sn = gradSnap(), g = grad, pk = g.pick;
      if (g.kind === 'free') { var cs = g.pts.map(function (q) { return [q.c, q.o]; }).reverse(); g.pts.forEach(function (q, i) { q.c = cs[i][0]; q.o = cs[i][1]; }); }
      else { g.stops = g.stops.map(function (s) { return { t: 1 - s.t, c: s.c, o: s.o }; }).reverse(); if (pk && pk.k === 's') pk.i = g.stops.length - 1 - pk.i; }
      gradRecord(sn); if (g.pick) gradPick(g.pick.k, g.pick.i); gradShow();
    }
    function gradSetKind(k) {
      gradKind = k; storeIt('paint-grad-kind', k);
      if (grad && grad.kind !== k) {
        var sn = gradSnap(), g = grad;
        // (freeform from the others: a point where each stop is)
        if (k === 'free' && !g.pts.length) g.pts = g.stops.map(function (s) { return { x: g.a.x + (g.b.x - g.a.x) * s.t, y: g.a.y + (g.b.y - g.a.y) * s.t, c: s.c, o: s.o }; });
        if (g.pick && (g.pick.k === 'p') !== (k === 'free')) g.pick = null;
        g.kind = k; gradRecord(sn);
      }
      if (grad) gradShow(); else ctxSync();
    }
    function gradCancel() {
      if (down && down.grad) down = null;
      grad = null; clearTimeout(gradFull); gradPaint(); gradMarks(); stage.classList.remove('can-move'); buttons(); ctxSync(); ctxShow();
    }
    function gradDone() { var sw = maskIn(); gradDone0(); if (sw) maskOut(); }
    function gradDone0() {
      if (!grad) return;
      if (gradEmpty(grad) || (active && active.text && !paintAbove())) { gradCancel(); return; }
      need();
      var keep = gradKeep();
      cancelAnimationFrame(gradFrame); gradFrame = 0; clearTimeout(gradFull);
      octx.clearRect(0, 0, W, H); gradFill(octx, grad.kind === 'free' ? 4e6 : Infinity); grainOver(); maskOv();
      remember('Gradient'); commit(null, st.alpha); undo[undo.length - 1].grad = keep;
      grad = null; gradGone = null; gradPaint(); gradMarks(); stage.classList.remove('can-move'); buttons(); ctxSync(); ctxShow(); useColor();
    }

    // a fine, invisible grain over the gradient as it's laid down: it breaks up
    // the steps a screen would otherwise show in a long, gentle blend
    function grainOver() {
      var d = octx.getImageData(0, 0, ov.width, ov.height), px = d.data;
      for (var i = 0; i < px.length; i += 4) {
        if (!px[i + 3]) continue;
        var n = (Math.random() + Math.random() - 1) * 2.2;
        px[i] += n; px[i + 1] += n; px[i + 2] += n;
      }
      octx.save(); octx.setTransform(1, 0, 0, 1, 0, 0); octx.putImageData(d, 0, 0); octx.restore();
    }

    // ---- fill and colour picker ----
    function hexOf(d) { return '#' + [d[0], d[1], d[2]].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }
    // PICKING A COLOUR: a loupe shows the pixels round the point, close up,
    // with the one that's picked in a square at its middle, and a ring all
    // round in that pixel's colour. With a mouse or the Pencil the loupe's
    // middle is the pointer itself (the system cursor hides while it shows),
    // and with the picker in hand it follows the pointer before a press, so
    // the colour can be seen before it's picked; a finger would hide it, so
    // there it sits just above (the square still the pixel under the finger).
    // The colour's picked where it's let go. One pixel is read for both the
    // square and the ring, from a flat copy of the picture, so what's shown is
    // what's picked, however the picture is zoomed, moved or turned
    var loupe = document.createElement('canvas'); loupe.className = 'paint-loupe'; loupe.hidden = true; loupe.setAttribute('aria-hidden', 'true');
    stage.appendChild(loupe);
    var LOUPE = 116, LOUPE_RING = 11, LOUPE_N = 13, loupeCells = document.createElement('canvas'), loupeOff = null, hoverPick = null;
    loupeCells.width = loupeCells.height = LOUPE_N + 2; // (two more than shown, so a turned view's corners are covered)
    document.addEventListener('paint:theme', function () { loupeOff = null; });
    function pickFlat() {
      var f = document.createElement('canvas'); f.width = ov.width; f.height = ov.height;
      var x = f.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, f.width, f.height); flattenInto(x);
      return { fx: x, flat: f };
    }
    function pickStart(e, p, alt) {
      var f = pickFlat(); hoverPick = null;
      down = { id: e.pointerId, start: p, last: p, pick: { fx: f.fx, flat: f.flat, was: st.color, alt: alt, finger: e.pointerType === 'touch' } };
      loupeAt(e, p);
    }
    function loupeAt(e, p) { down.last = p; loupeShow(down.pick, e, p); }
    // (the picker in hand, a mouse or the Pencil over the picture, nothing pressed)
    function pickHover(e) {
      if (!hoverPick) { var f = pickFlat(); hoverPick = { fx: f.fx, flat: f.flat, was: st.color, finger: false }; }
      hoverPick.ev = { clientX: e.clientX, clientY: e.clientY };
      loupeShow(hoverPick, e, pos(e));
    }
    function pickHoverEnd() { if (!hoverPick) return; hoverPick = null; if (!down || !down.pick) { loupe.hidden = true; stage.classList.remove('loupe-on'); } }
    // (anything that might change the picture: the copy is made again next time)
    document.addEventListener('keydown', function () { if (hoverPick) hoverPick.stale = true; }, true);
    document.addEventListener('pointerdown', function (e) { if (hoverPick && !stage.contains(e.target)) pickHoverEnd(); }, true);
    function loupeShow(k, e, p) {
      if (k === hoverPick && k.stale) { var f = pickFlat(); k.fx = f.fx; k.flat = f.flat; k.stale = false; }
      var S = LOUPE, d = Math.min(window.devicePixelRatio || 1, 2), sc = screen(e), r = S / 2, ring = LOUPE_RING, n = LOUPE_N, m = n + 2, h = (m - 1) / 2;
      var px = Math.floor(p.x * R), py = Math.floor(p.y * R), inside = px >= 0 && py >= 0 && px < k.flat.width && py < k.flat.height;
      // the pixels round it (clear past the picture's edge), and the one at the middle
      var data = k.fx.getImageData(px - h, py - h, m, m), mid = (h * m + h) * 4;
      var c = inside ? hexOf([data.data[mid], data.data[mid + 1], data.data[mid + 2]]) : null;
      k.now = c;
      if (loupe.width !== S * d) { loupe.width = loupe.height = S * d; loupe.style.width = loupe.style.height = S + 'px'; }
      var lx = sc.x - r, ly = sc.y - r;
      if (k.finger) { ly = sc.y - r - 64; if (ly < 4) ly = sc.y + 64 - r; }
      loupe.style.left = lx + 'px'; loupe.style.top = ly + 'px'; loupe.hidden = false;
      stage.classList.toggle('loupe-on', !k.finger);
      if (!loupeOff) loupeOff = getComputedStyle(stage).getPropertyValue('--stage').trim() || '#e5e5ea';
      loupeCells.getContext('2d').putImageData(data, 0, 0);
      var x = loupe.getContext('2d'), cell = (S - 2 * ring) / n;
      x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, S, S);
      // (big and square, turned as the picture is on the screen, the picked
      // pixel's square right in the middle)
      x.save(); x.beginPath(); x.arc(r, r, r - ring, 0, Math.PI * 2); x.clip();
      x.fillStyle = loupeOff; x.fillRect(0, 0, S, S);
      x.translate(r, r); if (view.r) x.rotate(view.r);
      x.imageSmoothingEnabled = false;
      x.drawImage(loupeCells, -m * cell / 2, -m * cell / 2, m * cell, m * cell);
      x.lineWidth = 1.5; x.strokeStyle = 'rgba(0,0,0,.55)'; x.strokeRect(-cell / 2, -cell / 2, cell, cell);
      x.strokeStyle = 'rgba(255,255,255,.8)'; x.strokeRect(-cell / 2 - 1.5, -cell / 2 - 1.5, cell + 3, cell + 3);
      x.restore();
      // (the ring: that one pixel's colour, all the way round)
      x.beginPath(); x.arc(r, r, r - ring / 2 - 0.5, 0, Math.PI * 2); x.lineWidth = ring; x.strokeStyle = c || loupeOff; x.stroke();
      x.beginPath(); x.arc(r, r, r - 1, 0, Math.PI * 2); x.lineWidth = 1; x.strokeStyle = 'rgba(0,0,0,.25)'; x.stroke();
      x.beginPath(); x.arc(r, r, r - ring - 0.5, 0, Math.PI * 2); x.strokeStyle = 'rgba(0,0,0,.18)'; x.stroke();
    }
    function pickEnd(cancel) {
      var k = down.pick; loupe.hidden = true; stage.classList.remove('loupe-on'); down = null;
      if (cancel || !k.now) return;
      setColor(k.now); useColor();
      if (!k.alt && st.tool === 'picker') setTool('brush');
    }
    // FILL: the area of (about) the same colour as the spot tapped. The soft
    // edge where it meets a line is filled too: each pixel there is part
    // line, part the old colour, and the old colour's share of it becomes the
    // new colour (it's worked out from the line's colour nearby), so the fill
    // runs right up under the line with no pale ring left round it.
    function fillAt(p) {
      var x0 = Math.floor(p.x * R), y0 = Math.floor(p.y * R), w = active.cv.width, h = active.cv.height;
      if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return null;
      var img = active.ctx.getImageData(0, 0, w, h), d = img.data, i0 = (y0 * w + x0) * 4;
      var tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], ta = d[i0 + 3];
      var c = parseInt(st.color.slice(1), 16), fr = c >> 16 & 255, fg = c >> 8 & 255, fb = c & 255, a = st.alpha;
      var seen = new Uint8Array(w * h), stack2 = [x0, y0], mp = sel ? selPixels() : null;
      if (mp && !mp[i0 + 3]) return null;
      if (active.alphaLock && !ta) return null; // (a locked layer can't be painted where it's empty)
      function like(k) { var j = k * 4; if (mp && !mp[j + 3]) return false; return Math.abs(d[j] - tr) + Math.abs(d[j + 1] - tg) + Math.abs(d[j + 2] - tb) + Math.abs(d[j + 3] - ta) <= 80; }
      var solid = a >= 1 && !active.alphaLock;
      function paint(j) {
        if (solid) { d[j] = fr; d[j + 1] = fg; d[j + 2] = fb; d[j + 3] = 255; return; }
        var da = d[j + 3] / 255, ob = a + da * (1 - a);
        d[j] = (fr * a + d[j] * da * (1 - a)) / ob; d[j + 1] = (fg * a + d[j + 1] * da * (1 - a)) / ob; d[j + 2] = (fb * a + d[j + 2] * da * (1 - a)) / ob;
        if (!active.alphaLock) d[j + 3] = ob * 255;
      }
      var bx0 = x0, bx1 = x0, by0 = y0, by1 = y0;
      while (stack2.length) {
        var y = stack2.pop(), x = stack2.pop(), k = y * w + x;
        while (x > 0 && !seen[k - 1] && like(k - 1)) { x--; k--; }
        var up = false, dn = false;
        if (x < bx0) bx0 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
        while (x < w && !seen[k] && like(k)) {
          seen[k] = 1; paint(k * 4); // (only pixels in the area change here, so the edge, worked out next, sees the picture as it was)
          if (y > 0) { var u = k - w; if (!seen[u] && like(u)) { if (!up) { stack2.push(x, y - 1); up = true; } } else up = false; }
          if (y < h - 1) { var v = k + w; if (!seen[v] && like(v)) { if (!dn) { stack2.push(x, y + 1); dn = true; } } else dn = false; }
          x++; k++;
        }
        if (x - 1 > bx1) bx1 = x - 1;
      }
      // colours as premultiplied (r, g, b, a), so see-through and solid layers work alike
      var T0 = tr * ta / 255, T1 = tg * ta / 255, T2 = tb * ta / 255, T3 = ta;
      // (and the new colour laid over the old one, the same way)
      var oa = a + ta / 255 * (1 - a), N0 = fr * a + T0 * (1 - a), N1 = fg * a + T1 * (1 - a), N2 = fb * a + T2 * (1 - a), N3 = oa * 255;
      // the soft edge: pixels just outside the area, up to two away from it
      // (the area grown by two pixels each way: along each row, then down
      // each column, and those it reaches that aren't in it are the edge)
      var X0 = Math.max(0, bx0 - 2), X1 = Math.min(w - 1, bx1 + 2), Y0 = Math.max(0, by0 - 2), Y1 = Math.min(h - 1, by1 + 2), bw = X1 - X0 + 1, bh = Y1 - Y0 + 1;
      var row = new Uint8Array(bw * bh), xx, yy, q, r0, out = [];
      for (yy = 0; yy < bh; yy++) {
        var sr = (yy + Y0) * w + X0; r0 = yy * bw;
        for (xx = 0; xx < bw; xx++) {
          if (!seen[sr + xx]) continue;
          var l = Math.max(0, xx - 2), rr = Math.min(bw - 1, xx + 2);
          for (var z = l; z <= rr; z++) row[r0 + z] = 1;
        }
      }
      for (yy = 0; yy < bh; yy++) for (xx = 0; xx < bw; xx++) {
        var qx = xx + X0, qy = yy + Y0; q = qy * w + qx;
        if (seen[q]) continue;
        var near2 = row[yy * bw + xx] || (yy > 0 && row[(yy - 1) * bw + xx]) || (yy > 1 && row[(yy - 2) * bw + xx]) || (yy < bh - 1 && row[(yy + 1) * bw + xx]) || (yy < bh - 2 && row[(yy + 2) * bw + xx]);
        if (!near2 || (mp && !mp[q * 4 + 3])) continue;
        var j = q * 4, al = d[j + 3] / 255, P0 = d[j] * al, P1 = d[j + 1] * al, P2 = d[j + 2] * al, P3 = d[j + 3];
        // (the line's own colour: the pixel nearby least like the old colour)
        var far = 0, L0 = 0, L1 = 0, L2 = 0, L3 = 0;
        for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) {
          var nx = qx + ox, ny = qy + oy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          var nq = ny * w + nx; if (seen[nq]) continue;
          var nj = nq * 4, na = d[nj + 3] / 255, Q0 = d[nj] * na, Q1 = d[nj + 1] * na, Q2 = d[nj + 2] * na, Q3 = d[nj + 3];
          var dd = Math.abs(Q0 - T0) + Math.abs(Q1 - T1) + Math.abs(Q2 - T2) + Math.abs(Q3 - T3);
          if (dd > far) { far = dd; L0 = Q0; L1 = Q1; L2 = Q2; L3 = Q3; }
        }
        if (far < 60) continue;
        var D0 = T0 - L0, D1 = T1 - L1, D2 = T2 - L2, D3 = T3 - L3, dl = D0 * D0 + D1 * D1 + D2 * D2 + D3 * D3;
        var t = ((P0 - L0) * D0 + (P1 - L1) * D1 + (P2 - L2) * D2 + (P3 - L3) * D3) / dl;
        t = Math.max(0, Math.min(1, t)); if (t < 0.02) continue;
        out.push(j, P0 + t * (N0 - T0), P1 + t * (N1 - T1), P2 + t * (N2 - T2), P3 + t * (N3 - T3));
      }
      // and its edge
      for (var e = 0; e < out.length; e += 5) {
        var j3 = out[e], o3 = out[e + 4], al3 = Math.max(0, Math.min(255, o3));
        if (al3 < 0.5) continue;
        d[j3] = Math.max(0, Math.min(255, out[e + 1] * 255 / o3)); d[j3 + 1] = Math.max(0, Math.min(255, out[e + 2] * 255 / o3)); d[j3 + 2] = Math.max(0, Math.min(255, out[e + 3] * 255 / o3));
        if (!active.alphaLock) d[j3 + 3] = al3; // (a locked layer's see-through stays as it was)
      }
      // (only the part that changed goes back)
      active.ctx.save(); active.ctx.setTransform(1, 0, 0, 1, 0, 0); active.ctx.putImageData(img, 0, 0, X0, Y0, bw, bh); active.ctx.restore();
      return { x0: X0, y0: Y0, x1: X1 + 1, y1: Y1 + 1 };
    }
    // FILLING, by a tap with the fill tool or by dropping a colour on the
    // picture: one way for both (mirrored by symmetry, onto a mask while
    // it's picked). The fill is laid down at once, so undo, saving and the
    // next stroke all see it, and is shown spreading out from where it
    // landed, on a stand-in for the layer that goes the moment anything
    // else happens
    var fillAnim = null, calm = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    function fillDrop(p, color) {
      endFillAnim();
      var keep = st.color; if (color) st.color = color;
      var sw = maskIn(true), L = active;
      remember('Fill');
      var top = undo[undo.length - 1], before = top && top.L === L ? top.data : null, box = null;
      [p].concat(copies().map(function (m) { return mapPt(m, p); })).forEach(function (q, i) {
        var b = fillAt(q); if (!b) return;
        box = box ? { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1), at: box.at.concat([q]) } : { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, at: [q] };
      });
      if (sw) maskOut();
      st.color = keep;
      if (box && before && !sw && !usesView(L) && !(calm && calm.matches)) spread(L, before, box);
      autosave();
      return !!box;
    }
    // (the drop of colour itself, where it lands: the same for a tap with the
    // fill tool as for a colour dragged there)
    function plopAt(cx, cy, color, b) {
      if (!b) { b = document.createElement('div'); b.className = 'paint-blob'; b.style.background = color; b.style.translate = (cx - 13) + 'px ' + (cy - 13) + 'px'; document.body.appendChild(b); }
      b.classList.add('plop'); setTimeout(function () { b.remove(); }, 260);
    }
    function spread(L, before, box) {
      var el = L.cv, cv = document.createElement('canvas'), x = cv.getContext('2d');
      cv.width = el.width; cv.height = el.height; cv.style.width = el.style.width; cv.style.height = el.style.height;
      cv.className = 'paint-fillanim'; cv.setAttribute('aria-hidden', 'true');
      cv.style.opacity = el.style.opacity; cv.style.mixBlendMode = el.style.mixBlendMode;
      x.putImageData(before, 0, 0);
      el.parentNode.insertBefore(cv, el.nextSibling); L.anim = true; styleLayer(L);
      // (as far as the farthest corner of what was filled; quick to start,
      // easing off as it reaches the edges, and never long)
      var at = box.at.map(function (q) { return { x: q.x * R, y: q.y * R }; }), far = 1;
      at.forEach(function (q) { [[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1]].forEach(function (c) { far = Math.max(far, Math.hypot(c[0] - q.x, c[1] - q.y)); }); });
      var dur = Math.min(520, 160 + far / R * view.k * 0.6), t0 = performance.now(), bw = box.x1 - box.x0, bh = box.y1 - box.y0;
      var A = fillAnim = { L: L, cv: cv, raf: 0 };
      function frame(now) {
        if (fillAnim !== A) return;
        var t = Math.min(1, (now - t0) / dur), r = Math.max(1, far * (1 - Math.pow(1 - t, 3)));
        // (inside the circles it's the layer as it is now; outside, as it was)
        x.save(); x.beginPath(); x.rect(box.x0, box.y0, bw, bh); x.clip();
        x.beginPath(); at.forEach(function (q) { x.moveTo(q.x + r, q.y); x.arc(q.x, q.y, r, 0, Math.PI * 2); }); x.clip();
        x.clearRect(box.x0, box.y0, bw, bh); x.drawImage(el, box.x0, box.y0, bw, bh, box.x0, box.y0, bw, bh); x.restore();
        if (t < 1) A.raf = requestAnimationFrame(frame); else endFillAnim();
      }
      A.raf = requestAnimationFrame(frame);
    }
    function endFillAnim() {
      var A = fillAnim; if (!A) return;
      fillAnim = null; cancelAnimationFrame(A.raf); A.cv.remove(); A.L.anim = false; styleLayer(A.L);
    }

    // ---- TEXT: type where you tap; it's laid onto the layer when you're
    // done. While typing, an Aa button sits by the words: it opens the text
    // options (font, size, bold / italic / underline / capitals, alignment,
    // letter spacing, line height, outline and shadow), which show live ----
    // TEXT LAYERS: the words go on a layer of their own, which keeps them
    // (L.text: the words, where they are, their box and how they look) and
    // is drawn from them, so they can be changed again: tap them with the
    // text tool to type, or move, size and turn them with Move. Drag before
    // typing to make a box the words wrap inside. Merging it into a layer
    // below (or Turn into Image, in its ••• menu) makes it plain paint.
    var textBox = null, textAt = null, textBtn = null, tpEl = null, textW = 0, textRot = 0, textLayer = null, textPath = null;
    // (fill: one colour, a blend from the main colour to the second, a
    // rainbow, or the two colours letter by letter; arc bends the lines
    // round a circle, up or down)
    var TX0 = { size: 48, bold: false, italic: false, underline: false, caps: false, align: 'left', spacing: 0, lh: 1.2, outline: 0, shadow: false, fill: 'solid', arc: 0 };
    var tx = {}; for (var tk0 in TX0) tx[tk0] = TX0[tk0];
    function fontSize() { return tx.size; }
    function fontName(v) { var f = FONTS.filter(function (x) { return x[0] === v; })[0]; return f ? f[1] : 'Font'; }
    function placeTextBox() {
      var k = view.k;
      var tp = toScreen(textAt); textBox.style.left = tp.x + 'px'; textBox.style.top = tp.y + 'px';
      textBox.style.fontSize = tx.size * k + 'px';
      textBox.style.width = textW ? textW * k + 'px' : '';
      textBox.style.letterSpacing = tx.spacing / 1000 * tx.size * k + 'px';
      textBox.style.lineHeight = tx.lh;
      textBox.style.transformOrigin = '0 0';
      // (turned with the picture, and with the words themselves; words in a
      // box sit inside it, otherwise they're lined up on where they started)
      var r = view.r + textRot;
      textBox.style.transform = (r ? 'rotate(' + r + 'rad) ' : '') + (textW ? '' : tx.align === 'center' ? 'translateX(-50%)' : tx.align === 'right' ? 'translateX(-100%)' : '');
      textBox.style.webkitTextStroke = tx.outline ? (tx.outline * tx.size / 100 * 2 * k) + 'px ' + st.color2 : '';
      textBox.style.textShadow = tx.shadow ? '0 ' + tx.size * 0.06 * k + 'px ' + tx.size * 0.12 * k + 'px rgba(0,0,0,.45)' : '';
      placeTextBtn(); textPreview();
    }
    function styleTextBox() {
      if (!textBox) return;
      var b = textBox.style;
      b.fontFamily = st.font; b.color = b.caretColor = st.color; b.opacity = st.alpha;
      b.fontWeight = tx.bold ? '700' : '400'; b.fontStyle = tx.italic ? 'italic' : 'normal';
      b.textDecoration = tx.underline ? 'underline' : 'none'; b.textTransform = tx.caps ? 'uppercase' : 'none'; b.textAlign = tx.align;
      placeTextBox();
    }
    function placeTextBtn() {
      if (!textBtn || !textBox) return;
      var x = textBox.offsetLeft + textBox.offsetWidth * (tx.align === 'center' ? 0.5 : tx.align === 'right' ? 0 : 1) + 10, y = textBox.offsetTop - 6;
      textBtn.style.left = Math.round(Math.max(4, Math.min(stage.clientWidth - 40, x))) + 'px';
      textBtn.style.top = Math.round(Math.max(4, Math.min(stage.clientHeight - 40, y))) + 'px';
      if (tpEl && !tpEl.hidden) placeTextPanel();
    }
    // (where to type: p is the top left of a box w wide, or, with no box,
    // the start of the line; L is a text layer whose words are being changed)
    // (path: words along a pen path, its points from where they start)
    function startText(p, w, L, path) {
      ensureFonts();
      textAt = { x: p.x, y: p.y }; textW = w || 0; textLayer = L || null; textRot = L ? L.text.rot || 0 : 0; textPath = L ? L.text.path || null : path || null;
      if (L) {
        // (its words come back as they were, in their font, size and colour)
        var T = L.text; st.font = T.font; loadFont(T.font);
        for (var k in TX0) tx[k] = T[k] != null ? T[k] : TX0[k];
        setColor(T.color); if (T.color2) setColor2(T.color2);
        st.alpha = T.alpha; alphaIn.value = Math.round(T.alpha * 100); alphaIn.nextElementSibling.textContent = alphaIn.value;
        L.editing = true; styleLayer(L);
      }
      textBox = document.createElement('div');
      textBox.className = 'paint-text' + (textW ? ' boxed' : ''); textBox.contentEditable = 'true'; textBox.spellcheck = false;
      if (L) textBox.textContent = L.text.str;
      stage.appendChild(textBox);
      textBtn = document.createElement('button');
      textBtn.type = 'button'; textBtn.className = 'paint-textbtn'; textBtn.setAttribute('aria-label', 'Text options'); textBtn.title = 'Text options: font, size, spacing and more';
      textBtn.innerHTML = '<span>Aa</span>';
      stage.appendChild(textBtn);
      // (pressing it mustn't take the typing away from the words)
      textBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); });
      textBtn.addEventListener('click', function (e) { e.stopPropagation(); textPanel(!tpEl || tpEl.hidden); });
      styleTextBox();
      setTimeout(function () {
        if (!textBox) return;
        textBox.focus({ preventScroll: true });
        // (changing words: the caret goes at the end of them)
        if (L && window.getSelection) { var rg = document.createRange(); rg.selectNodeContents(textBox); rg.collapse(false); var sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(rg); }
      }, 0);
      textBox.addEventListener('input', function () { placeTextBtn(); textPreview(); });
      textBox.addEventListener('keydown', function (e) {
        if (e.isComposing || e.keyCode === 229) return; // (an input method choosing its characters)
        // (Esc closes the options first, then lets the words go)
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (tpEl && !tpEl.hidden) textPanel(false); else cancelText(); }
        else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
      });
      textBox.addEventListener('blur', function () {
        setTimeout(function () {
          var a = document.activeElement;
          // (still typing if the focus went to the text options, the font
          // list, the colours or the opacity: those change the words)
          if (textBox && a !== textBox && !(a && a.closest && a.closest('.paint-textpanel, .paint-fontmenu, .paint-bottom, .paint-ctx'))) commitText();
        }, 0);
      });
      if (typeof ctxEl !== 'undefined' && ctxEl) ctxSync();
    }
    function cancelText() {
      if (textBox) { textBox.remove(); textBox = null; octx.clearRect(0, 0, W, H); }
      if (textBtn) { textBtn.remove(); textBtn = null; }
      if (textLayer) { textLayer.editing = false; styleLayer(textLayer); textLayer = null; }
      textPanel(false);
    }
    // the words being typed, as they'd be laid down
    function curText() {
      var T = { str: textBox ? textBox.innerText.replace(/\n$/, '') : '', x: textAt.x, y: textAt.y, w: textPath ? 0 : textW, rot: textRot, font: st.font, size: tx.size, color: st.color, color2: st.color2, alpha: st.alpha,
        bold: tx.bold, italic: tx.italic, underline: tx.underline, caps: tx.caps, align: tx.align, spacing: tx.spacing, lh: tx.lh, outline: tx.outline, shadow: tx.shadow, fill: tx.fill, arc: textPath ? 0 : tx.arc };
      if (textPath) T.path = textPath;
      return T;
    }
    function fancyText(T) { return (!!T.fill && T.fill !== 'solid') || !!T.arc || !!T.path; }
    // (words with a blend, letters of their own colours, or on a curve can't
    // be shown by the typing box: they're drawn on the sheet above the
    // picture as they're typed, and the box only takes the typing)
    function textPreview() {
      if (!textBox) return;
      var T = curText(), on = fancyText(T);
      textBox.classList.toggle('fancy', on); textBox.classList.toggle('curved', !!(T.arc || T.path));
      octx.clearRect(0, 0, W, H);
      if (!on) return;
      plainOv();
      if (T.path) {
        octx.save(); octx.translate(T.x, T.y); if (T.rot) octx.rotate(T.rot);
        penPathOn(octx, T.path.pts, T.path.closed); octx.lineWidth = 1 / view.k; octx.setLineDash([4 / view.k, 3 / view.k]); octx.strokeStyle = '#2f7fd6'; octx.stroke();
        octx.restore();
      }
      if (T.str) drawText(octx, T);
    }
    function textName(str) { return str.replace(/\s+/g, ' ').trim().slice(0, 20) || 'Text'; }
    function commitText() {
      if (!textBox) return;
      var T = curText(), str = T.str, L = textLayer;
      cancelText();
      var empty = !str.trim();
      if (L && layers.indexOf(L) >= 0) {
        // (a text layer's words, changed; all of them taken away, and the layer goes)
        if (empty) { var i = layers.indexOf(L); rememberLayers('Delete Text'); layers.splice(i, 1); active = layers[Math.max(0, i - 1)] || null; mount(); autosave(); return; }
        if (JSON.stringify(T) === JSON.stringify(L.text)) return;
        push({ L: L, data: snapOf(L), bg: L.bg, text: L.text, name: L.name, label: 'Edit Text' });
        if (L.name === textName(L.text.str)) L.name = textName(str);
        L.text = T; renderText(L); renderLayers(); useColor(); return;
      }
      if (empty) return;
      if (layers.length >= maxLayers()) {
        // (no room for another layer: the words are painted onto this one)
        need(); remember('Text', true);
        var c = active.ctx; c.save(); clipTo(c); if (active.alphaLock) c.globalCompositeOperation = 'source-atop'; drawText(c, T); c.restore();
        toast('No room for another layer: the words went onto this layer as paint'); useColor(); return;
      }
      rememberLayers('Text');
      var N = makeLayer(textName(str), false); N.text = T;
      layers.splice(active ? layers.indexOf(active) + 1 : layers.length, 0, N); N.group = active ? active.group : null; active = N;
      renderText(N); mount(); autosave(); useColor();
    }
    // HOW THE WORDS ARE LAID OUT, from where they start (0, 0): line by line,
    // wrapped inside the box if there is one; and the box round them all
    function textFont(T) { return (T.italic ? 'italic ' : '') + (T.bold ? '700 ' : '400 ') + T.size + 'px ' + T.font; }
    function wrapText(s, maxW, widthOf) {
      if (!(maxW > 0)) return [s];
      var out = [], cur = '';
      (s.match(/\s+|\S+/g) || ['']).forEach(function (tk) {
        if (/^\s/.test(tk)) { cur += tk; return; }
        if (cur.trim() && widthOf(cur + tk) > maxW) { out.push(cur.replace(/\s+$/, '')); cur = ''; }
        // (a word too long for the box is broken where it meets the edge)
        while (tk.length > 1 && widthOf(cur + tk) > maxW) {
          var n = 1; while (n < tk.length - 1 && widthOf(cur + tk.slice(0, n + 1)) <= maxW) n++;
          out.push(cur + tk.slice(0, n)); cur = ''; tk = tk.slice(n);
        }
        cur += tk;
      });
      out.push(cur.replace(/\s+$/, ''));
      return out;
    }
    function layoutText(c, T) {
      var fs = T.size, lh = fs * T.lh, ls = T.spacing / 1000 * fs;
      c.font = textFont(T);
      var native = 'letterSpacing' in c;
      if (native) c.letterSpacing = ls + 'px';
      // (placed exactly as the page lays out the typed words: each line's
      // baseline sits half the spare line height below its top, then the
      // font's ascent)
      var m = c.measureText('Hg'), A = m.fontBoundingBoxAscent != null ? m.fontBoundingBoxAscent : fs * 0.8, D = m.fontBoundingBoxDescent != null ? m.fontBoundingBoxDescent : fs * 0.2;
      var widthOf = function (t) {
        if (native || !ls) return c.measureText(t).width;
        var w = 0; for (var i = 0; i < t.length; i++) w += c.measureText(t[i]).width + ls; return w;
      };
      var rows = [];
      T.str.split('\n').forEach(function (par) { wrapText(T.caps ? par.toUpperCase() : par, T.w, widthOf).forEach(function (t) { rows.push(t); }); });
      var x0 = Infinity, x1 = -Infinity;
      var lines = rows.map(function (t, i) {
        var w = widthOf(t), x = T.w ? (T.align === 'center' ? (T.w - w) / 2 : T.align === 'right' ? T.w - w : 0) : (T.align === 'center' ? -w / 2 : T.align === 'right' ? -w : 0);
        if (t) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + w); }
        return { t: t, x: x, y: i * lh + (lh - (A + D)) / 2 + A, w: w };
      });
      if (!isFinite(x0)) { x0 = 0; x1 = 1; }
      var out = { lines: lines, native: native, ls: ls, box: { x: T.w ? 0 : x0, y: 0, w: T.w ? T.w : Math.max(1, x1 - x0), h: Math.max(lh, rows.length * lh) } };
      if (fancyText(T)) glyphsOf(T, out, widthOf, A, D);
      return out;
    }
    // LETTER BY LETTER: where each one goes (its middle, on the baseline)
    // and how it's turned. In a line as typed; round a circle (arc: the
    // lines bend round one middle, so they stay evenly apart); or along a
    // path, starting, centred or ending on it as the words are aligned
    function glyphsOf(T, out, widthOf, A, D) {
      var gl = [], k = 0, lines = out.lines;
      var each = function (t, x0, fn) {
        var prev = 0;
        for (var i = 0; i < t.length; i++) { var nx = widthOf(t.slice(0, i + 1)), ch = t[i]; fn(ch, x0 + prev, nx - prev, /\S/.test(ch) ? k++ : -1); prev = nx; }
      };
      if (T.path && T.path.pts && T.path.pts.length > 1) {
        var tr = pathTrack(T.path), str = lines.map(function (l) { return l.t; }).join(' '), tw = widthOf(str);
        var s0 = T.align === 'center' ? (tr.len - tw) / 2 : T.align === 'right' ? tr.len - tw : 0;
        each(str, s0, function (ch, x, w, n) {
          var m = trackAt(tr, x + w / 2), a = trackAt(tr, x), b = trackAt(tr, x + w);
          gl.push({ ch: ch, x: m.x, y: m.y, a: Math.atan2(b.y - a.y, b.x - a.x), w: w, k: n });
        });
      } else if (T.arc) {
        var wmax = Math.max.apply(null, lines.map(function (l) { return l.w; }).concat([1])), th = Math.abs(T.arc) / 100 * 1.8 * Math.PI;
        var r = wmax / th, s = T.arc > 0 ? 1 : -1, cx = out.box.x + out.box.w / 2, y1 = lines[0].y, cy = y1 + s * r;
        lines.forEach(function (l) {
          var rl = Math.max(T.size * 0.5, r - s * (l.y - y1));
          each(l.t, l.x, function (ch, x, w, n) {
            var f = (x + w / 2 - cx) / rl;
            gl.push({ ch: ch, x: cx + rl * Math.sin(f), y: cy - s * rl * Math.cos(f), a: s * f, w: w, k: n });
          });
        });
      } else lines.forEach(function (l) { each(l.t, l.x, function (ch, x, w, n) { gl.push({ ch: ch, x: x + w / 2, y: l.y, a: 0, w: w, k: n }); }); });
      out.glyphs = gl;
      if (!T.path && !T.arc) return;
      // (the box round them all, for picking them out and moving them)
      var bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      gl.forEach(function (g) {
        if (g.k < 0) return;
        var co = Math.cos(g.a), si = Math.sin(g.a);
        [[-g.w / 2, -A], [g.w / 2, -A], [-g.w / 2, D], [g.w / 2, D]].forEach(function (q) {
          var X = g.x + q[0] * co - q[1] * si, Y = g.y + q[0] * si + q[1] * co;
          bx0 = Math.min(bx0, X); bx1 = Math.max(bx1, X); by0 = Math.min(by0, Y); by1 = Math.max(by1, Y);
        });
      });
      out.box = isFinite(bx0) ? { x: bx0, y: by0, w: Math.max(1, bx1 - bx0), h: Math.max(1, by1 - by0) } : { x: 0, y: -A, w: 1, h: A + D };
    }
    // (a path, as short straight pieces, and how far along each one starts)
    function pathTrack(path) {
      var P = path.pts, pts = [{ x: P[0].x, y: P[0].y }];
      var add = function (q) { var l = pts[pts.length - 1]; if (Math.abs(q.x - l.x) + Math.abs(q.y - l.y) > 0.01) pts.push(q); };
      var seg = function (a, b) {
        if (!a.o && !b.i) { add({ x: b.x, y: b.y }); return; }
        var o = a.o || a, i = b.i || b;
        for (var n = 1; n <= 32; n++) { var t = n / 32, u = 1 - t; add({ x: u * u * u * a.x + 3 * u * u * t * o.x + 3 * u * t * t * i.x + t * t * t * b.x, y: u * u * u * a.y + 3 * u * u * t * o.y + 3 * u * t * t * i.y + t * t * t * b.y }); }
      };
      for (var j = 1; j < P.length; j++) seg(P[j - 1], P[j]);
      if (path.closed) seg(P[P.length - 1], P[0]);
      if (pts.length < 2) pts.push({ x: pts[0].x + 1, y: pts[0].y });
      var cum = [0]; for (j = 1; j < pts.length; j++) cum.push(cum[j - 1] + Math.hypot(pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y));
      return { pts: pts, cum: cum, len: cum[cum.length - 1], closed: !!path.closed };
    }
    // (the point d along it; before its start or past its end, the words
    // carry on straight, unless it goes all the way round)
    function trackAt(tr, d) {
      var c = tr.cum, n = c.length;
      if (tr.closed && tr.len) d = ((d % tr.len) + tr.len) % tr.len;
      var lo = 1, hi = n - 1;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (c[mid] < d) lo = mid + 1; else hi = mid; }
      var a = tr.pts[lo - 1], b = tr.pts[lo], t = (d - c[lo - 1]) / ((c[lo] - c[lo - 1]) || 1);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    function drawText(c, T) {
      c.save(); c.translate(T.x, T.y); if (T.rot) c.rotate(T.rot);
      var lay = layoutText(c, T), fs = T.size, ls = lay.ls, native = lay.native;
      c.textBaseline = 'alphabetic'; c.globalAlpha = T.alpha; c.lineJoin = 'round'; c.miterLimit = 2;
      function draw(t, x, y, how) {
        if (native || !ls) { c[how](t, x, y); return; }
        for (var i = 0; i < t.length; i++) { c[how](t[i], x, y); x += c.measureText(t[i]).width + ls; }
      }
      var shadow = function (on) { c.shadowColor = on ? 'rgba(0,0,0,.45)' : 'transparent'; c.shadowBlur = on ? fs * 0.12 * R : 0; c.shadowOffsetX = 0; c.shadowOffsetY = on ? fs * 0.06 * R : 0; };
      if (lay.glyphs) { drawGlyphs(c, T, lay, shadow); c.restore(); return lay.box; }
      lay.lines.forEach(function (l) {
        if (T.outline) { shadow(T.shadow); c.strokeStyle = T.color2 || '#fff'; c.lineWidth = T.outline * fs / 100 * 2; draw(l.t, l.x, l.y, 'strokeText'); shadow(false); }
        else shadow(T.shadow);
        c.fillStyle = T.color; draw(l.t, l.x, l.y, 'fillText');
        if (T.underline && l.t) c.fillRect(l.x, l.y + fs * 0.1, Math.max(0, l.w - (native ? 0 : ls)), Math.max(1, fs * 0.06));
        shadow(false);
      });
      c.restore();
      return lay.box;
    }
    // (letter by letter: outlines first, under all of them, then the
    // letters, each in its colour; a blend runs top to bottom over the
    // whole of the words, however each letter is turned)
    function drawGlyphs(c, T, lay, shadow) {
      var fs = T.size, B = lay.box, hc = hex2rgb(T.color), h0 = rgb2hsv(hc[0], hc[1], hc[2])[0];
      var colOf = function (g) {
        if (T.fill === 'rainbow') { var q = hsv2rgb((h0 + g.k * 40) % 360, 0.8, 0.92); return rgb2hex(q[0], q[1], q[2]); }
        return T.fill === 'two' && g.k % 2 ? T.color2 : T.color;
      };
      var blend = function (a, gx, gy) {
        var co = Math.cos(-a), si = Math.sin(-a), f = function (X, Y) { X -= gx; Y -= gy; return [X * co - Y * si, X * si + Y * co]; };
        var p = f(0, B.y), q = f(0, B.y + B.h), G = c.createLinearGradient(p[0], p[1], q[0], q[1]); G.addColorStop(0, T.color); G.addColorStop(1, T.color2); return G;
      };
      var put = function (g, fill) {
        c.save(); c.translate(g.x, g.y); if (g.a) c.rotate(g.a);
        if (fill) { c.fillStyle = T.fill === 'gradient' ? blend(g.a, g.x, g.y) : colOf(g); c.fillText(g.ch, -g.w / 2, 0); } else c.strokeText(g.ch, -g.w / 2, 0);
        c.restore();
      };
      var gl = lay.glyphs.filter(function (g) { return g.k >= 0; });
      if (T.outline) { shadow(T.shadow); c.strokeStyle = T.color2 || '#fff'; c.lineWidth = T.outline * fs / 100 * 2; gl.forEach(function (g) { put(g, false); }); shadow(false); }
      else shadow(T.shadow);
      gl.forEach(function (g) { put(g, true); });
      shadow(false);
      // (underlined, when the lines are straight)
      if (T.underline && !T.arc && !T.path) {
        c.fillStyle = T.fill === 'gradient' ? blend(0, 0, 0) : T.color;
        lay.lines.forEach(function (l) { if (l.t) c.fillRect(l.x, l.y + fs * 0.1, Math.max(0, l.w - (lay.native ? 0 : lay.ls)), Math.max(1, fs * 0.06)); });
      }
    }
    // a text layer, drawn again from its words
    function renderText(L, again) {
      var c = L.ctx; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, L.cv.width, L.cv.height); c.restore();
      var T = L.text; L.tbox = drawText(c, T); L.tboxFor = T;
      // (a font still on its way: drawn again once it's here)
      var f = textFont(T);
      if (!again && document.fonts && document.fonts.check && !document.fonts.check(f)) document.fonts.load(f).then(function () { if (L.text === T) { renderText(L, true); autosave(); } }, function () {});
      viewsSoon(); thumbsSoon();
    }
    var measureCtx = document.createElement('canvas').getContext('2d');
    function tboxOf(L) { if (L.tboxFor !== L.text) { L.tbox = layoutText(measureCtx, L.text).box; L.tboxFor = L.text; } return L.tbox; }
    // the text layer (the top one) whose words are under p, if any
    function textUnder(p) {
      for (var i = layers.length - 1; i >= 0; i--) {
        var L = layers[i]; if (!L.text || !shownVisible(L)) continue;
        var T = L.text, b = tboxOf(L), r = -(T.rot || 0), dx = p.x - T.x, dy = p.y - T.y, pad = 6 / view.k;
        var lx = dx * Math.cos(r) - dy * Math.sin(r), ly = dx * Math.sin(r) + dy * Math.cos(r);
        if (lx >= b.x - pad && lx <= b.x + b.w + pad && ly >= b.y - pad && ly <= b.y + b.h + pad) return L;
      }
      return null;
    }
    function editText(L) {
      if (textBox) commitText();
      if (sel) commitSelection();
      if (L !== active) { active = L; renderLayers(); }
      startText({ x: L.text.x, y: L.text.y }, L.text.w, L);
    }
    // the options panel (it floats beside the Aa button)
    function textPanel(open) {
      if (!open) { if (tpEl) tpEl.hidden = true; if (textBtn) textBtn.setAttribute('aria-expanded', 'false'); return; }
      if (!textBox) return;
      if (!tpEl) buildTextPanel();
      syncTextPanel(); tpEl.hidden = false; textBtn.setAttribute('aria-expanded', 'true'); placeTextPanel();
    }
    function placeTextPanel() {
      var r = textBtn.getBoundingClientRect(), w = tpEl.offsetWidth, h = tpEl.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
      // (on a phone it sits along the bottom of the screen, clear of the words)
      if (vw <= 600) { tpEl.style.left = Math.round((vw - w) / 2) + 'px'; tpEl.style.top = Math.round(vh - h - 8) + 'px'; keepOnScreen(tpEl); return; }
      var x = r.right + 10; if (x + w > vw - 8) x = r.left - w - 10; if (x < 8) x = Math.max(8, (vw - w) / 2);
      tpEl.style.left = Math.round(x) + 'px'; tpEl.style.top = Math.round(Math.max(8, Math.min(vh - h - 8, r.top - 20))) + 'px';
      keepOnScreen(tpEl);
    }
    var ICON = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; };
    function buildTextPanel() {
      tpEl = document.createElement('div'); tpEl.className = 'paint-textpanel'; tpEl.hidden = true; tpEl.setAttribute('role', 'dialog'); tpEl.setAttribute('aria-label', 'Text options');
      var range = function (key, label, min, max, step) { return '<label class="tp-row"><span>' + label + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + step + '" data-tp="' + key + '"><output data-tpo="' + key + '"></output></label>'; };
      tpEl.innerHTML = '<div class="tp-head"><span>Text</span><button type="button" class="tp-done" data-tpa="done">Done</button></div>' +
        '<button type="button" class="tp-font" data-tpa="fonts" aria-expanded="false"><span></span>' + ICON('<path d="M7 10l5 5 5-5"/>') + '</button>' +
        '<div class="tp-fonts" hidden>' + fontList('data-tpfont') + '</div>' +
        '<label class="tp-row tp-size"><span>Size</span><input type="range" min="8" max="400" step="1" data-tp="size"><input type="number" min="4" max="2000" data-tp="sizen" aria-label="Size"></label>' +
        '<div class="tp-styles">' +
          '<button type="button" data-tpt="bold" title="Bold" aria-label="Bold"><b>B</b></button>' +
          '<button type="button" data-tpt="italic" title="Italic" aria-label="Italic"><i>I</i></button>' +
          '<button type="button" data-tpt="underline" title="Underline" aria-label="Underline"><u>U</u></button>' +
          '<button type="button" data-tpt="caps" title="All capitals" aria-label="All capitals"><span>AA</span></button>' +
          '<button type="button" data-tpt="shadow" title="Shadow" aria-label="Shadow"><span class="tp-sh">S</span></button>' +
        '</div>' +
        '<div class="pa-tabs tp-align" role="group" aria-label="Alignment">' +
          '<button type="button" data-tpal="left" aria-label="Align left">' + ICON('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>') + '</button>' +
          '<button type="button" data-tpal="center" aria-label="Centre">' + ICON('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>') + '</button>' +
          '<button type="button" data-tpal="right" aria-label="Align right">' + ICON('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>') + '</button>' +
        '</div>' +
        range('spacing', 'Letter spacing', -150, 600, 5) + range('lh', 'Line height', 0.7, 3, 0.05) + range('outline', 'Outline', 0, 15, 0.5) +
        '<div class="tp-note">The outline uses your second colour.</div>';
      document.body.appendChild(tpEl);
      draggable(tpEl, '.tp-head', 'text');
      // (buttons keep the typing where it is; sliders and the number take
      // the focus only while they're used)
      tpEl.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) e.preventDefault(); });
      tpEl.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-tpa="done"]'))) { commitText(); return; }
        if ((b = e.target.closest('[data-tpa="fonts"]'))) { var l = tpEl.querySelector('.tp-fonts'); l.hidden = !l.hidden; b.setAttribute('aria-expanded', !l.hidden); if (!l.hidden) { var on = l.querySelector('[aria-checked="true"]'); if (on) on.scrollIntoView({ block: 'center' }); } placeTextPanel(); return; }
        if ((b = e.target.closest('[data-tpfont]'))) { st.font = b.dataset.tpfont; loadFont(st.font); afterTextChange(); return; }
        if ((b = e.target.closest('[data-tpt]'))) { tx[b.dataset.tpt] = !tx[b.dataset.tpt]; afterTextChange(); return; }
        if ((b = e.target.closest('[data-tpal]'))) { tx.align = b.dataset.tpal; afterTextChange(); return; }
      });
      tpEl.addEventListener('input', function (e) {
        var i = e.target.closest('[data-tp]'); if (!i) return;
        var k = i.dataset.tp;
        if (k === 'sizen') { var v = Math.round(+i.value); if (v >= 4 && v <= 2000) tx.size = v; }
        else tx[k] = +i.value;
        afterTextChange(k === 'sizen');
      });
      tpEl.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); textPanel(false); if (textBox) textBox.focus({ preventScroll: true }); } else if (e.key === 'Enter' && e.target.dataset.tp === 'sizen') { e.preventDefault(); textBox && textBox.focus({ preventScroll: true }); } });
    }
    function afterTextChange(typing) { styleTextBox(); syncTextPanel(typing); if (typeof ctxEl !== 'undefined' && ctxEl) ctxSync(); }
    function syncTextPanel(typingSize) {
      if (!tpEl) return;
      tpEl.querySelector('.tp-font span').textContent = fontName(st.font);
      tpEl.querySelector('.tp-font span').style.fontFamily = st.font;
      Array.prototype.forEach.call(tpEl.querySelectorAll('[data-tpfont]'), function (b) { b.setAttribute('aria-checked', b.dataset.tpfont === st.font ? 'true' : 'false'); });
      Array.prototype.forEach.call(tpEl.querySelectorAll('[data-tpt]'), function (b) { b.setAttribute('aria-pressed', tx[b.dataset.tpt] ? 'true' : 'false'); });
      Array.prototype.forEach.call(tpEl.querySelectorAll('[data-tpal]'), function (b) { b.setAttribute('aria-selected', tx.align === b.dataset.tpal ? 'true' : 'false'); });
      tpEl.querySelector('[data-tp="size"]').value = Math.min(400, tx.size);
      if (!typingSize) tpEl.querySelector('[data-tp="sizen"]').value = tx.size;
      tpEl.querySelector('[data-tp="spacing"]').value = tx.spacing; tpEl.querySelector('[data-tpo="spacing"]').textContent = tx.spacing;
      tpEl.querySelector('[data-tp="lh"]').value = tx.lh; tpEl.querySelector('[data-tpo="lh"]').textContent = tx.lh.toFixed(2);
      tpEl.querySelector('[data-tp="outline"]').value = tx.outline; tpEl.querySelector('[data-tpo="outline"]').textContent = tx.outline;
    }
    document.addEventListener('pointerdown', function (e) {
      if (tpEl && !tpEl.hidden && !e.target.closest('.paint-textpanel, .paint-textbtn, .paint-text, .paint-bottom, .paint-fontmenu')) textPanel(false);
    }, true);

    // ---- select and move: a box round part of the layer; drag it to move it ----
    var sel = null, selMode = null, selOff = null, lasso = [];
    // CUTOUT: drag to draw round something freehand (it closes when you let
    // go), or click to start placing points: each click adds a straight
    // line to the next point, and dragging between clicks draws a freehand
    // piece instead, so the two can be mixed. Click the first point (or
    // double-click, or press Return) to close it; Backspace takes the last
    // point away; Esc lets it go.
    var lassoOn = false, lassoHover = null;
    function nearStart(p, touch) {
      if (lasso.length < 3) return false;
      return Math.hypot(p.x - lasso[0].x, p.y - lasso[0].y) * view.k <= (touch ? 18 : 10);
    }
    function drawLasso(hover) {
      uiSheet();
      if (!lasso.length) return;
      var k = view.k, closing = hover && nearStart(hover, false);
      uctx.save(); uctx.lineWidth = 1.2 / k; uctx.setLineDash([5 / k, 4 / k]);
      uctx.beginPath(); lasso.forEach(function (q, i) { uctx[i ? 'lineTo' : 'moveTo'](q.x, q.y); });
      if (hover) uctx.lineTo(closing ? lasso[0].x : hover.x, closing ? lasso[0].y : hover.y);
      uctx.strokeStyle = '#000'; uctx.stroke(); uctx.lineDashOffset = 4.5 / k; uctx.strokeStyle = '#fff'; uctx.stroke();
      if (lassoOn) {
        // the corners as small dots, and the first point as a ring to click
        // (it fills in when the pointer is close enough to close the shape)
        uctx.setLineDash([]);
        lasso.forEach(function (q, i) {
          if (q.corner && i) { uctx.beginPath(); uctx.arc(q.x, q.y, 2.5 / k, 0, Math.PI * 2); uctx.fillStyle = '#fff'; uctx.fill(); uctx.lineWidth = 1 / k; uctx.strokeStyle = '#141414'; uctx.stroke(); }
        });
        var a = lasso[0], r = (closing ? 7 : 5) / k;
        uctx.beginPath(); uctx.arc(a.x, a.y, r, 0, Math.PI * 2);
        uctx.fillStyle = closing ? (getComputedStyle(root).getPropertyValue('--accent').trim() || '#ff3b30') : '#fff'; uctx.fill();
        uctx.lineWidth = 1.5 / k; uctx.strokeStyle = closing ? '#fff' : '#141414'; uctx.stroke();
      }
      uctx.restore();
    }
    function finishLasso() {
      var xs = lasso.map(function (q) { return q.x; }), ys = lasso.map(function (q) { return q.y; });
      var x0 = Math.max(0, Math.min.apply(null, xs)), y0 = Math.max(0, Math.min.apply(null, ys));
      var x1 = Math.min(W, Math.max.apply(null, xs)), y1 = Math.min(H, Math.max.apply(null, ys));
      sel = lasso.length > 2 && x1 - x0 > 3 && y1 - y0 > 3 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0, float: null, poly: lasso.map(function (q) { return { x: q.x - x0, y: q.y - y0 }; }) } : null;
      lassoOn = false; lassoHover = null; lasso = []; stage.classList.remove('closing'); toastEl.classList.remove('on');
      selbar.hidden = !sel; selMode = null; down = null; drawSel();
    }
    function cancelLasso() { lassoOn = false; lassoHover = null; lasso = []; if (selMode === 'lasso') selMode = null; sctx.clearRect(0, 0, W, H); uiSheet(); drawSel(); }
    function selTool(t) { return selKindOf(t) || t === 'move'; }
    // THE SELECTION TOOL: one button, four ways to select (picked in the
    // tool panel, and remembered): a cutout (the first time), a box, a circle
    // and the magic wand. The button shows the way in use
    var SEL_KINDS = [
      ['lasso', 'Cutout', '<path d="M7.4 15.6C5.3 14.5 4 12.8 4 10.9 4 7.4 7.6 4.5 12 4.5s8 2.9 8 6.4-3.6 6.4-8 6.4c-1 0-1.9-.1-2.8-.4" stroke-dasharray="2.4 2.1"/><circle cx="8.4" cy="16.4" r="1.4"/><path d="M8 17.8c-.6 1.2-.2 2.3 1 2.7"/>', 'Cutout (Q): draw round it, or click to place points'],
      ['select', 'Box', '<path d="M4 8.5V5a1 1 0 0 1 1-1h3.5M15.5 4H19a1 1 0 0 1 1 1v3.5M20 15.5V19a1 1 0 0 1-1 1h-3.5M8.5 20H5a1 1 0 0 1-1-1v-3.5"/><path d="M11 4h2M11 20h2M4 11v2M20 11v2"/>', 'Box (M): drag a box round it'],
      ['circle', 'Circle', '<circle cx="12" cy="12" r="8" stroke-dasharray="2.6 2.4"/>', 'Circle (C): drag an oval round it, Shift for a circle'],
      ['wand', 'Magic Wand', '<path d="M4.1 18.5l9-9a1.1 1.1 0 0 1 1.5 0l.4.4a1.1 1.1 0 0 1 0 1.5l-9 9a1.1 1.1 0 0 1-1.5 0l-.4-.4a1.1 1.1 0 0 1 0-1.5z"/><path d="M11.6 11l1.9 1.9"/><path d="M17.5 2.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/><path d="M9.5 3v2.5M8.25 4.25h2.5M20 11v2M19 12h2"/>', 'Magic Wand (W): tap an area of one colour']
    ];
    function selKindOf(t) { for (var i = 0; i < SEL_KINDS.length; i++) if (SEL_KINDS[i][0] === t) return SEL_KINDS[i]; return null; }
    var selKind = stored('paint-sel-kind', 'lasso'); if (!selKindOf(selKind)) selKind = 'lasso';
    function selBtnSync() {
      var b = root.querySelector('.paint-selbtn'), k = selKindOf(selKind); if (!b) return;
      b.dataset.tool = selKind; b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + k[2] + '</svg>';
      b.setAttribute('aria-label', 'Select: ' + k[1] + ' (M)');
    }
    // (a circle: its outline as points round the box it's dragged in)
    selBtnSync();
    function ovalPoly(w, h) { var P = []; for (var i = 0; i < 96; i++) { var a = i / 96 * Math.PI * 2; P.push({ x: w / 2 + Math.cos(a) * w / 2, y: h / 2 + Math.sin(a) * h / 2 }); } return P; }
    // MAGIC WAND: every connected pixel of a similar colour on the layer
    // (a mask, kept with the selection)
    // (with paint set, it picks up all the paint joined to that spot instead:
    // anything that isn't see-through, or on the background, isn't white)
    function wandAt(p, paint) {
      var x0 = Math.floor(p.x * R), y0 = Math.floor(p.y * R), w = active.cv.width, h = active.cv.height;
      if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return;
      var d = active.ctx.getImageData(0, 0, w, h).data, i0 = (y0 * w + x0) * 4, bg = active.bg;
      var tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], ta = d[i0 + 3];
      var seen = new Uint8Array(w * h), stack = [x0, y0], minX = x0, maxX = x0, minY = y0, maxY = y0;
      function like(k) {
        var j = k * 4;
        if (paint) return bg ? 765 - d[j] - d[j + 1] - d[j + 2] > 36 : d[j + 3] > 8;
        return Math.abs(d[j] - tr) + Math.abs(d[j + 1] - tg) + Math.abs(d[j + 2] - tb) + Math.abs(d[j + 3] - ta) <= 80;
      }
      if (paint && !like(y0 * w + x0)) return;
      while (stack.length) {
        var y = stack.pop(), x = stack.pop(), k = y * w + x;
        while (x > 0 && !seen[k - 1] && like(k - 1)) { x--; k--; }
        var up = false, dn = false;
        while (x < w && !seen[k] && like(k)) {
          seen[k] = 1; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (y > 0) { var u = k - w; if (!seen[u] && like(u)) { if (!up) { stack.push(x, y - 1); up = true; } } else up = false; }
          if (y < h - 1) { var v = k + w; if (!seen[v] && like(v)) { if (!dn) { stack.push(x, y + 1); dn = true; } } else dn = false; }
          x++; k++;
        }
      }
      // grow it a hair (about 1px) so the soft, anti-aliased edge goes with it
      var g = Math.max(1, Math.round(R)), grown = new Uint8Array(w * h);
      for (var gy = Math.max(0, minY - g); gy <= Math.min(h - 1, maxY + g); gy++) {
        for (var gx = Math.max(0, minX - g); gx <= Math.min(w - 1, maxX + g); gx++) {
          var hit = 0;
          for (var oy = -g; oy <= g && !hit; oy++) for (var ox = -g; ox <= g; ox++) {
            var yy2 = gy + oy, xx2 = gx + ox;
            if (yy2 >= 0 && yy2 < h && xx2 >= 0 && xx2 < w && seen[yy2 * w + xx2]) { hit = 1; break; }
          }
          grown[gy * w + gx] = hit;
        }
      }
      seen = grown; minX = Math.max(0, minX - g); minY = Math.max(0, minY - g); maxX = Math.min(w - 1, maxX + g); maxY = Math.min(h - 1, maxY + g);
      var mw = maxX - minX + 1, mh = maxY - minY + 1, m = document.createElement('canvas'); m.width = mw; m.height = mh;
      var mx = m.getContext('2d'), md = mx.createImageData(mw, mh);
      for (var yy = 0; yy < mh; yy++) for (var xx = 0; xx < mw; xx++) if (seen[(yy + minY) * w + xx + minX]) md.data[(yy * mw + xx) * 4 + 3] = 255;
      mx.putImageData(md, 0, 0);
      sel = { x: minX / R, y: minY / R, w: mw / R, h: mh / R, float: null, mask: m, maskData: md.data };
    }
    function tinted(m, color) {
      var t = document.createElement('canvas'); t.width = m.width; t.height = m.height;
      var x = t.getContext('2d'); x.drawImage(m, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, t.width, t.height);
      return t;
    }
    // (a lasso selection keeps its outline, relative to its box; a whole
    // layer's can be picked up anywhere in its box, gaps and all)
    // TURNING A SELECTION: its box (x, y, w, h) is turned by sel.rot round
    // its middle. These take a point between the picture and the box's own
    // (unturned) frame, and lay what's picked up down, turned.
    function selMid() { return { x: sel.x + sel.w / 2, y: sel.y + sel.h / 2 }; }
    function selLocal(p) { if (sel.quad) return quadLocal(p); var r = sel.rot || 0; if (!r) return p; var m = selMid(), dx = p.x - m.x, dy = p.y - m.y, c = Math.cos(r), s = Math.sin(r); return { x: m.x + c * dx + s * dy, y: m.y - s * dx + c * dy }; }
    function selWorld(p) { if (sel.quad) return quadWorld(p); var r = sel.rot || 0; if (!r) return p; var m = selMid(), dx = p.x - m.x, dy = p.y - m.y, c = Math.cos(r), s = Math.sin(r); return { x: m.x + c * dx - s * dy, y: m.y + s * dx + c * dy }; }
    // DISTORT: with it on, each corner of what's picked up moves on its own
    // and the pixels follow in perspective. sel.quad holds the four corners
    // (top left, top right, bottom right, bottom left) from the selection's
    // own corner (sel.x, sel.y), so moving it moves them all; the box
    // (sel.x, y, w, h) stays the frame the pixels, the outline and the
    // wand's shape are in, and a projective map takes that frame to the quad
    function quadMap(q) {
      // (the unit square to the four corners)
      var x0 = q[0].x, y0 = q[0].y, x1 = q[1].x, y1 = q[1].y, x2 = q[2].x, y2 = q[2].y, x3 = q[3].x, y3 = q[3].y;
      var dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3, g = 0, h = 0;
      if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) { var den = dx1 * dy2 - dx2 * dy1; g = (dx3 * dy2 - dx2 * dy3) / den; h = (dx1 * dy3 - dx3 * dy1) / den; }
      return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
    }
    function mapInv(M) {
      var a = M[0], b = M[1], c = M[2], d = M[3], e = M[4], f = M[5], g = M[6], h = M[7], i = M[8];
      var A = e * i - f * h, B = c * h - b * i, C = b * f - c * e, D = f * g - d * i, E = a * i - c * g, F = c * d - a * f, G = d * h - e * g, Hh = b * g - a * h, I = a * e - b * d;
      var det = a * A + b * D + c * G; if (!det) return null;
      return [A / det, B / det, C / det, D / det, E / det, F / det, G / det, Hh / det, I / det];
    }
    function mapAt(M, u, v) { var w = M[6] * u + M[7] * v + M[8]; return { x: (M[0] * u + M[1] * v + M[2]) / w, y: (M[3] * u + M[4] * v + M[5]) / w }; }
    function quadAbs() { return sel.quad.map(function (q) { return { x: sel.x + q.x, y: sel.y + q.y }; }); }
    function quadWorld(p) { var o = mapAt(quadMap(sel.quad), (p.x - sel.x) / sel.w, (p.y - sel.y) / sel.h); return { x: sel.x + o.x, y: sel.y + o.y }; }
    function quadLocal(p) { var Mi = mapInv(quadMap(sel.quad)); if (!Mi) return { x: -1e9, y: -1e9 }; var o = mapAt(Mi, p.x - sel.x, p.y - sel.y); return { x: sel.x + o.x * sel.w, y: sel.y + o.y * sel.h }; }
    function quadMid() { var Q = quadAbs(); return { x: (Q[0].x + Q[1].x + Q[2].x + Q[3].x) / 4, y: (Q[0].y + Q[1].y + Q[2].y + Q[3].y) / 4 }; }
    // (a corner can't be pulled across the others: the four stay a shape
    // that turns the same way all round, and not a sliver)
    function quadOk(q) {
      var sg = 0;
      for (var i = 0; i < 4; i++) {
        var a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4], cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
        if (Math.abs(cr) < 1e-6) return false;
        if (!sg) sg = cr > 0 ? 1 : -1; else if ((cr > 0 ? 1 : -1) !== sg) return false;
      }
      return true;
    }
    function quadTurn(q0, m, a) { var c = Math.cos(a), s = Math.sin(a); return q0.map(function (q) { var x = sel.x + q.x - m.x, y = sel.y + q.y - m.y; return { x: m.x + c * x - s * y - sel.x, y: m.y + s * x + c * y - sel.y }; }); }
    // (the pixels a canvas is warped from, kept for each canvas: at most a
    // few times as many as are drawn, so a big picture shrunk doesn't
    // shimmer; forgotten when its pixels change)
    // (paint-warp-gpu: off, the processor always; on, the chip even when it's
    // software; otherwise the chip unless it's software, for testing)
    var warpSrcs = new WeakMap(), warpPref = (function () { try { return localStorage.getItem('paint-warp-gpu') || 'auto'; } catch (x) { return 'auto'; } })(), warpUseGL = warpPref !== 'off';
    function warpForget(f) { if (f) { warpSrcs.delete(f); warpPvs.delete(f); if (warpGL && warpGL.tex.has(f)) { warpGL.gl.deleteTexture(warpGL.tex.get(f)); warpGL.tex.delete(f); } } }
    // (on the graphics chip when it can: the same map, worked a pixel at a
    // time by a shader, from a texture of the canvas with its smaller copies
    // for when it's drawn small, with a soft edge a screen pixel wide; drawn
    // straight away by whoever asked, as the chip's canvas is used again)
    var warpGL = null;
    function warpGLGet() {
      if (warpGL !== null) return warpGL;
      warpGL = false;
      try {
        var cv = document.createElement('canvas'), gl = cv.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });
        if (!gl) return false;
        var dbg = gl.getExtension('WEBGL_debug_renderer_info'), rn = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
        if (warpPref !== 'on' && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(rn)) return false;
        var sh = function (t, src) { var o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
        var pr = gl.createProgram();
        gl.attachShader(pr, sh(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}'));
        gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;uniform sampler2D u_t;uniform mat3 u_inv;uniform vec3 u_o;uniform vec2 u_src;out vec4 o;' +
          'void main(){vec2 w=vec2(u_o.x+gl_FragCoord.x,u_o.y-gl_FragCoord.y)/u_o.z;vec3 h=u_inv*vec3(w,1.0);vec2 uv=h.xy/h.z;' +
          'vec2 f=max(fwidth(uv*u_src),vec2(1e-4));vec2 e=min(uv,1.0-uv)*u_src/f;float a=clamp(min(e.x,e.y)+0.5,0.0,1.0);' +
          'o=a>0.0?texture(u_t,clamp(uv,0.0,1.0))*a:vec4(0.0);}'));
        gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        gl.useProgram(pr); gl.uniform1i(gl.getUniformLocation(pr, 'u_t'), 0);
        warpGL = { cv: cv, gl: gl, max: Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0], gl.getParameter(gl.MAX_VIEWPORT_DIMS)[1]), tex: new Map(),
          u: { inv: gl.getUniformLocation(pr, 'u_inv'), o: gl.getUniformLocation(pr, 'u_o'), src: gl.getUniformLocation(pr, 'u_src') } };
        cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); warpGL = false; });
      } catch (x) { warpGL = false; }
      return warpGL;
    }
    function warpTex(G, f) {
      var gl = G.gl, t = G.tex.get(f);
      if (t) { G.tex.delete(f); G.tex.set(f, t); return t; } // (the latest at the end)
      if (G.tex.size >= 8) { var k0 = G.tex.keys().next().value; gl.deleteTexture(G.tex.get(k0)); G.tex.delete(k0); }
      t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, f);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      G.tex.set(f, t); return t;
    }
    function warpOnGL(f, Mi, px0, py0, ow, oh, k) {
      var G = warpGLGet(); if (!G || f.width > G.max || f.height > G.max || ow > G.max || oh > G.max) return null;
      try {
        var gl = G.gl, t = warpTex(G, f);
        if (G.cv.width !== ow || G.cv.height !== oh) { G.cv.width = ow; G.cv.height = oh; }
        gl.viewport(0, 0, ow, oh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t);
        // (the map, in the picture's units, as a column-major matrix)
        gl.uniformMatrix3fv(G.u.inv, false, [Mi[0], Mi[3], Mi[6], Mi[1], Mi[4], Mi[7], Mi[2], Mi[5], Mi[8]]);
        gl.uniform3f(G.u.o, px0, py0 + oh, k); gl.uniform2f(G.u.src, f.width, f.height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        return gl.isContextLost() ? null : G.cv;
      } catch (x) { return null; }
    }
    function warpSrc(f, want) {
      var k = Math.min(1, Math.sqrt(Math.max(1, want * 3) / (f.width * f.height))), w = Math.max(1, Math.round(f.width * k)), h = Math.max(1, Math.round(f.height * k));
      var c = warpSrcs.get(f); if (c && c.w === w && c.h === h) return c;
      var cv = f; if (w !== f.width || h !== f.height) { cv = document.createElement('canvas'); cv.width = w; cv.height = h; var cx = cv.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(f, 0, 0, w, h); }
      c = { w: w, h: h, d: cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data }; warpSrcs.set(f, c); return c;
    }
    // (f drawn into the quad, at k pixels a picture unit: a canvas and where
    // it goes, in the picture's units; clip: only what's on the picture;
    // max: at most that many pixels, by making k smaller)
    function warpOf(f, k, clip, max) {
      var Q = quadAbs(), xs = Q.map(function (q) { return q.x; }), ys = Q.map(function (q) { return q.y; });
      var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys), x1 = Math.max.apply(null, xs), y1 = Math.max.apply(null, ys);
      if (clip) { x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1); }
      if (x1 <= x0 || y1 <= y0) return null;
      if (max && (x1 - x0) * (y1 - y0) * k * k > max) k = Math.sqrt(max / ((x1 - x0) * (y1 - y0)));
      var px0 = Math.floor(x0 * k), py0 = Math.floor(y0 * k), ow = Math.max(1, Math.ceil(x1 * k) - px0), oh = Math.max(1, Math.ceil(y1 * k) - py0);
      var Mi = mapInv(quadMap(Q)); if (!Mi) return null;
      if (warpUseGL) { var gc = warpOnGL(f, Mi, px0, py0, ow, oh, k); if (gc) return { cv: gc, x: px0 / k, y: py0 / k, w: ow / k, h: oh / k, gl: true }; }
      var S = warpSrc(f, ow * oh), sw = S.w, sh = S.h, d = S.d, out = new ImageData(ow, oh), o = out.data;
      for (var j = 0; j < oh; j++) {
        var wy = (py0 + j + 0.5) / k, wx0 = (px0 + 0.5) / k, dx = 1 / k;
        var U = Mi[0] * wx0 + Mi[1] * wy + Mi[2], V = Mi[3] * wx0 + Mi[4] * wy + Mi[5], Z = Mi[6] * wx0 + Mi[7] * wy + Mi[8];
        var dU = Mi[0] * dx, dV = Mi[3] * dx, dZ = Mi[6] * dx;
        for (var i = 0, n = j * ow * 4; i < ow; i++, n += 4, U += dU, V += dV, Z += dZ) {
          var sx = U / Z * sw - 0.5, sy = V / Z * sh - 0.5;
          if (!(sx > -1 && sy > -1 && sx < sw && sy < sh)) continue;
          // (between the four nearest pixels, weighted by how solid they are;
          // past the edge counts as clear, so the edge is soft)
          var ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy, A = 0, Rr = 0, G = 0, B = 0;
          for (var t = 0; t < 4; t++) {
            var tx = ix + (t & 1), ty = iy + (t >> 1);
            if (tx < 0 || ty < 0 || tx >= sw || ty >= sh) continue;
            var q = (ty * sw + tx) * 4, a = d[q + 3]; if (!a) continue;
            var wgt = ((t & 1) ? fx : 1 - fx) * ((t >> 1) ? fy : 1 - fy) * a;
            A += wgt; Rr += wgt * d[q]; G += wgt * d[q + 1]; B += wgt * d[q + 2];
          }
          if (A > 0) { o[n] = Rr / A; o[n + 1] = G / A; o[n + 2] = B / A; o[n + 3] = A; }
        }
      }
      var cv = document.createElement('canvas'); cv.width = ow; cv.height = oh; cv.getContext('2d').putImageData(out, 0, 0);
      return { cv: cv, x: px0 / k, y: py0 / k, w: ow / k, h: oh / k };
    }
    // (on the screen, at the picture's detail, so zooming in doesn't blur it:
    // on the processor, coarser while a corner is dragged, and kept until it
    // or the corners change)
    var warpPvs = new WeakMap();
    function warpShow(c, f) {
      var busy = selMode === 'distort' || selMode === 'qrot' || selMode === 'move', k = R;
      var key = [sel.x, sel.y, sel.w, sel.h, JSON.stringify(sel.quad), k, busy].join('|'), c0 = warpPvs.get(f);
      if (!c0 || c0.key !== key) {
        var r = warpOf(f, k, true, warpUseGL && warpGLGet() ? 0 : busy ? 4e5 : 2.5e6);
        if (r && r.gl) { c.drawImage(r.cv, r.x, r.y, r.w, r.h); return; } // (the chip's canvas is used again: drawn now, not kept)
        c0 = { key: key, r: r }; warpPvs.set(f, c0);
      }
      if (c0.r) c.drawImage(c0.r.cv, c0.r.x, c0.r.y, c0.r.w, c0.r.h);
    }
    function putFloat(c, f, pv) {
      var r = sel.rot || 0; f = f || sel.float;
      if (c !== sctx && c.canvas && !pv) c.canvas.boxV = (c.canvas.boxV || 0) + 1; // (a layer's paint changed: its box is measured again)
      if (sel.quad) { if (pv) { warpShow(c, f); return; } var wr = warpOf(f, R, true); if (wr) c.drawImage(wr.cv, wr.x, wr.y, wr.w, wr.h); return; }
      c.imageSmoothingQuality = f.width > sel.w * R * 1.5 ? 'high' : 'low'; // (a picture kept at its own size, drawn smaller)
      if (!r) { c.drawImage(f, sel.x, sel.y, sel.w, sel.h); return; }
      var m = selMid(); c.save(); c.translate(m.x, m.y); c.rotate(r); c.drawImage(f, -sel.w / 2, -sel.h / 2, sel.w, sel.h); c.restore();
    }
    // (something is picked up: on the current layer, or on each picked layer)
    function lifted() { return !!(sel && (sel.float || sel.more)); }
    function inSel(p) {
      if (sel) p = selLocal(p);
      if (!sel || p.x < sel.x || p.x > sel.x + sel.w || p.y < sel.y || p.y > sel.y + sel.h) return false;
      if (sel.whole) return true;
      if (sel.mask) {
        var mx = Math.floor((p.x - sel.x) / sel.w * sel.mask.width), my = Math.floor((p.y - sel.y) / sel.h * sel.mask.height);
        return mx >= 0 && my >= 0 && mx < sel.mask.width && my < sel.mask.height && sel.maskData[(my * sel.mask.width + mx) * 4 + 3] > 0;
      }
      if (!sel.poly) return true;
      var x = p.x - sel.x, y = p.y - sel.y, inside = false, P = sel.poly;
      for (var i = 0, j = P.length - 1; i < P.length; j = i++) {
        if ((P[i].y > y) !== (P[j].y > y) && x < (P[j].x - P[i].x) * (y - P[i].y) / (P[j].y - P[i].y) + P[i].x) inside = !inside;
      }
      return inside;
    }
    function outline(c, ox, oy, k) {
      c.beginPath();
      sel.poly.forEach(function (q, i) { c[i ? 'lineTo' : 'moveTo']((q.x + ox) * k, (q.y + oy) * k); });
      c.closePath();
    }
    // DRAWING INSIDE A SELECTION: with a selection made, every tool only
    // paints inside it (the box or the cutout's outline clips; a wand
    // selection's exact shape is kept by putting back what's outside it)
    function selPath(c) { if (sel.poly) outline(c, sel.x, sel.y, 1); else { c.beginPath(); c.rect(sel.x, sel.y, sel.w, sel.h); } }
    function clipTo(c) { if (!sel) return; if (sel.mask) { c.beginPath(); c.rect(sel.x, sel.y, sel.w, sel.h); } else selPath(c); c.clip(); }
    function maskOv(rects) {
      if (selTool(st.tool)) return;
      if (sel) {
        octx.save(); octx.globalCompositeOperation = 'destination-in';
        if (sel.mask) octx.drawImage(sel.mask, sel.x, sel.y, sel.w, sel.h); else { selPath(octx); octx.fillStyle = '#000'; octx.fill(); }
        octx.restore();
      }
      // (on an alpha-locked layer the stroke shows only where there's paint
      // already; on a clipped one, only where the layer it's clipped to has paint)
      // (painting a mask: the sheet stays hidden, and the layer shows the
      // stroke's effect as it's drawn)
      if (active && active.isMask) {
        ov.style.opacity = 0;
        if (st.tool !== 'eraser') { maskAlpha(active.owner, rects, strokeLook().alpha); viewOf(active.owner, rects); }
        return;
      }
      var b = active && clipBase(active);
      if (st.tool !== 'eraser' && active && (active.alphaLock || b || active.mask)) {
        octx.save(); octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalCompositeOperation = 'destination-in';
        if (active.alphaLock) octx.drawImage(active.cv, 0, 0);
        if (active.mask) octx.drawImage(active.mask.a, 0, 0);
        if (b) octx.drawImage(b.mask ? b.view || viewOf(b) : b.cv, 0, 0);
        octx.restore();
      }
    }
    // PAINTING ON A MASK: while a layer's mask is picked, the tools that paint
    // work on the mask instead, in greys (each colour's lightness): black
    // hides the layer, white shows it, and the eraser brings it back
    var maskSwap = null;
    // (stretched a little, so the near-black and near-white swatches hide
    // and show the layer completely)
    function greyOf(c) { var r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16), l = 0.299 * r + 0.587 * g + 0.114 * b; l = Math.round(Math.max(0, Math.min(255, (l - 24) / (232 - 24) * 255))); return hexOf([l, l, l]); }
    function maskIn(any) {
      if (maskSwap || !active || !active.editMask || !active.mask) return false;
      if (!any && !/^(brush|eraser|line|shape|gradient|fill|pen|smudge|blur|tone)$/.test(st.tool)) return false;
      maskSwap = { L: active, c1: st.color, c2: st.color2 };
      st.color = greyOf(st.color); st.color2 = greyOf(st.color2);
      active = active.mask.P; return true;
    }
    function maskOut() {
      if (!maskSwap) return;
      var L = maskSwap.L; st.color = maskSwap.c1; st.color2 = maskSwap.c2; maskSwap = null; active = L;
      maskAlpha(L); viewsSoon(); thumbsSoon(); plainOv();
    }
    function selPixels() {
      var m = document.createElement('canvas'); m.width = ov.width; m.height = ov.height;
      var x = m.getContext('2d'); base(x);
      if (sel.mask) x.drawImage(sel.mask, sel.x, sel.y, sel.w, sel.h); else { selPath(x); x.fill(); }
      return x.getImageData(0, 0, m.width, m.height).data;
    }
    function keepOutside() {
      var m = sel.mask, k = document.createElement('canvas'); k.width = m.width; k.height = m.height;
      var kx = k.getContext('2d');
      kx.drawImage(active.cv, Math.round(sel.x * R), Math.round(sel.y * R), m.width, m.height, 0, 0, m.width, m.height);
      kx.globalCompositeOperation = 'destination-out'; kx.drawImage(m, 0, 0);
      return k;
    }
    function guard() {
      if (!down || !down.keep || !sel || !sel.mask) return;
      var c = active.ctx, x = Math.round(sel.x * R), y = Math.round(sel.y * R), k = down.keep;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      c.beginPath(); c.rect(x, y, k.width, k.height); c.clip();
      c.globalCompositeOperation = 'destination-in'; c.drawImage(sel.mask, x, y);
      c.globalCompositeOperation = 'source-over'; c.drawImage(k, x, y);
      c.restore();
    }
    // whatever was lifted is laid back down, but the selection stays
    // (a turned selection is put down and closed: painting inside one isn't
    // possible, only inside an upright one)
    function anchor(keep) {
      if (!lifted()) return;
      if (sel.more) putMore(); else putFloat(active.ctx); sel.float = null; sel.hist = sel.fut = null; sel.src = null;
      if ((sel.rot || sel.quad) && !keep) { clearSel(); autosave(); return; }
      drawSel(); autosave();
    }
    function clearSel() { if (sel && sel.more) sel.more.forEach(function (it) { if (it.cv) it.cv.remove(); }); var had = sel && (sel.hist || sel.fut); sel = null; selbar.hidden = true; selectionToolbarSync(); selx.hidden = true; if (seldist) seldist.hidden = true; sctx.clearRect(0, 0, W, H); if (!lasso.length) uiSheet(); cornerCursor(null); stage.classList.remove('can-move', 'moving'); scaleSync(); if (had) histButtons(); }
    // A SELECTION'S OWN STEPS: while something is picked up, each move, size,
    // turn (or size typed in Scale) is a step of its own, which undo and redo
    // take first; undone past the first, it goes back down where it was
    // (and, for Distort, its corners, and what's picked up as it was: locking
    // the corners again works the pixels into a box of their own)
    function selGeo() { return { x: sel.x, y: sel.y, w: sel.w, h: sel.h, rot: sel.rot || 0, poly: sel.poly || null, quad: sel.quad ? sel.quad.slice() : null, float: sel.float, fl: sel.more ? sel.more.map(function (it) { return it.f; }) : null, mask: sel.mask, maskData: sel.maskData, softMask: sel.softMask }; }
    function sameQuad(a, b) { if (!a || !b) return a === b; for (var i = 0; i < 4; i++) if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false; return true; }
    function selRecord() { if (!sel) return; if (!sel.hist) sel.hist = []; sel.hist.push(selGeo()); sel.fut = []; histButtons(); }
    // (a press that changed nothing isn't a step)
    function selTrim() { var g = sel && sel.hist && sel.hist[sel.hist.length - 1]; if (g && g.x === sel.x && g.y === sel.y && g.w === sel.w && g.h === sel.h && g.rot === (sel.rot || 0) && sameQuad(g.quad, sel.quad || null) && g.float === sel.float) { sel.hist.pop(); histButtons(); } }
    function selPut(g) {
      sel.x = g.x; sel.y = g.y; sel.w = g.w; sel.h = g.h; sel.rot = g.rot; sel.poly = g.poly; sel.quad = g.quad; sel.softMask = g.softMask;
      if (g.float !== sel.float) { sel.float = g.float; sel.fboxOf = null; }
      if (g.fl && sel.more) sel.more.forEach(function (it, i) { if (g.fl[i] !== undefined) it.f = g.fl[i]; });
      if (g.mask !== sel.mask) { sel.mask = g.mask; sel.maskData = g.maskData; sel.tint = null; }
      refitMask(); drawSel(); autosave();
    }
    function selSteps() { return !!(sel && (lifted() || (sel.hist && sel.hist.length) || (sel.fut && sel.fut.length) || (sel.text && sel.lifted))); }
    function selUndo() { if (!selSteps() || !sel.hist || !sel.hist.length) return false; sel.fut.push(selGeo()); selPut(sel.hist.pop()); histButtons(); return true; }
    function selRedo() { if (!selSteps() || !sel.fut || !sel.fut.length) return false; sel.hist.push(selGeo()); selPut(sel.fut.pop()); histButtons(); return true; }
    // SCALE: the size of what's selected, as a percentage of its own size (a
    // picture added: the picture's own size; anything else: the size it was
    // when it was selected). A size typed in is laid on at once, about the
    // middle, keeping its proportions; the arrow keys go up and down
    var scaleEl = $('.paint-scale'), scaleIn = scaleEl.querySelector('.ps-in'), scaleLock = scaleEl.querySelector('.ps-lock'), scaleT = 0;
    var keepRatio = stored('paint-keep-ratio', true) !== false;
    function scalePct() { return sel && sel.base ? sel.w / sel.base.w * 100 : 100; }
    function scaleShow(v) { return String(Math.round(v * 10) / 10 >= 10 ? Math.round(v) : Math.round(v * 10) / 10); }
    function scaleSync() {
      if (!scaleEl) return;
      var on = !!(sel && !sel.thing && !sel.quad && selMode !== 'new' && selMode !== 'lasso' && !lassoOn && sel.w > 0 && sel.h > 0);
      if (on && !sel.base) sel.base = { w: sel.text ? sel.w0 : sel.w, h: sel.text ? sel.h * sel.w0 / sel.w : sel.h };
      if (scaleEl.hidden === on) scaleEl.hidden = !on;
      scaleLock.setAttribute('aria-pressed', keepRatio ? 'true' : 'false');
      if (on && document.activeElement !== scaleIn) scaleIn.value = scaleShow(scalePct());
    }
    function scaleTo(pct) {
      if (!sel || selMode || sel.quad || !(pct > 0)) return;
      if (adj) adjustDone(true);
      var nw = Math.max(1 / R, Math.min(W * 20, sel.base.w * pct / 100)), k = nw / sel.w;
      if (Math.abs(k - 1) < 1e-9) return;
      lift(); selRecord();
      var m = selMid(), nh = Math.max(1 / R, sel.h * k), P = sel.poly;
      sel.w = nw; sel.h = nh; sel.x = m.x - nw / 2; sel.y = m.y - nh / 2;
      if (P) sel.poly = P.map(function (q) { return { x: q.x * k, y: q.y * k }; });
      refitMask(); drawSel(); autosave();
    }
    function scaleRead() { var v = parseFloat(String(scaleIn.value).replace(',', '.').replace(/[^0-9.]/g, '')); return v > 0 ? Math.min(2000, v) : null; }
    scaleIn.addEventListener('focus', function () { scaleIn.select(); });
    scaleIn.addEventListener('blur', function () { clearTimeout(scaleT); var v = scaleRead(); if (v) scaleTo(v); scaleSync(); });
    scaleIn.addEventListener('input', function () { clearTimeout(scaleT); scaleT = setTimeout(function () { var v = scaleRead(); if (v) scaleTo(v); }, 320); });
    scaleIn.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); clearTimeout(scaleT); var v = scaleRead(); if (v) scaleTo(v); scaleIn.value = scaleShow(scalePct()); scaleIn.select(); }
      else if (e.key === 'Escape') { e.preventDefault(); clearTimeout(scaleT); scaleIn.blur(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); clearTimeout(scaleT); var d = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1), c = Math.round(scalePct()); scaleTo(Math.max(1, c + d)); scaleIn.value = scaleShow(scalePct()); }
    });
    scaleLock.addEventListener('click', function () { keepRatio = !keepRatio; storeIt('paint-keep-ratio', keepRatio); scaleSync(); toast(keepRatio ? 'Keeping proportions (hold Shift to stretch)' : 'Free to stretch (hold Shift to keep proportions)'); });
    // the little X on the selection's top left corner closes it
    function placeSelX() { selx.hidden = true; }
    // THE DISTORT BUTTON, over the top of a selection: tapped, its corners
    // come apart (each one moves on its own, the pixels following in
    // perspective); tapped again, they're locked together again, and what's
    // picked up is worked into a box of its own, to move, size and turn as
    // before. Not for words: they'd stop being words
    var seldist = $('.paint-seldist');
    function distortable() {
      if (!sel || sel.thing || sel.text || !(sel.w > 0 && sel.h > 0) || selMode === 'new' || selMode === 'lasso' || lassoOn) return false;
      var its = sel.more || sel.items || (!lifted() && multi() ? picks().map(function (L) { return { L: L }; }) : []);
      return !its.some(function (it) { return it.L.text; });
    }
    function placeSelDist() {
      if (!seldist) return;
      var show = distortable() && (!selMode || /^(scale|rotate|distort|qrot)$/.test(selMode));
      seldist.hidden = !show; if (!show) return;
      var on = !!sel.quad, t = on ? 'Lock the corners together again' : 'Distort: drag each corner on its own';
      if (seldist.getAttribute('aria-pressed') !== String(on)) { seldist.setAttribute('aria-pressed', on ? 'true' : 'false'); seldist.dataset.tip = t; }
      // (out past the round handle, from the middle of the top edge; or, if
      // that's off the top or under Scale, out from the middle of the bottom)
      var tp, n, bp;
      if (on) { var qt = quadTop(), Q = quadAbs(); tp = { x: qt.x, y: qt.y }; n = qt.n; bp = { x: (Q[2].x + Q[3].x) / 2, y: (Q[2].y + Q[3].y) / 2 }; }
      else { var r = sel.rot || 0; tp = selWorld({ x: sel.x + sel.w / 2, y: sel.y }); bp = selWorld({ x: sel.x + sel.w / 2, y: sel.y + sel.h }); n = { x: Math.sin(r), y: -Math.cos(r) }; }
      var vr = view.r || 0, nx = Math.cos(vr) * n.x - Math.sin(vr) * n.y, ny = Math.sin(vr) * n.x + Math.cos(vr) * n.y;
      var bw = seldist.offsetWidth || 90, bh = seldist.offsetHeight || 28, sc = toScreen(tp), x = sc.x + nx * 54 - bw / 2, y = sc.y + ny * 54 - bh / 2;
      var sr = scaleEl && !scaleEl.hidden ? scaleEl.getBoundingClientRect() : null, gr = stage.getBoundingClientRect();
      var under = sr && x < sr.right - gr.left + 4 && x + bw > sr.left - gr.left - 4 && y < sr.bottom - gr.top + 6;
      if (y < 4 || under) { var sb = toScreen(bp); x = sb.x - nx * 32 - bw / 2; y = sb.y - ny * 32 - bh / 2; }
      seldist.style.left = Math.round(Math.max(4, Math.min(stage.clientWidth - bw - 4, x))) + 'px';
      seldist.style.top = Math.round(Math.max(4, Math.min(stage.clientHeight - bh - 4, y))) + 'px';
    }
    function distortOn() {
      if (!distortable()) return;
      if (adj) adjustDone(true);
      lift(); selRecord();
      var cs = [{ x: sel.x, y: sel.y }, { x: sel.x + sel.w, y: sel.y }, { x: sel.x + sel.w, y: sel.y + sel.h }, { x: sel.x, y: sel.y + sel.h }].map(selWorld);
      sel.quad = cs.map(function (q) { return { x: q.x - sel.x, y: q.y - sel.y }; }); sel.rot = 0;
      drawSel(); autosave();
    }
    function distortOff() {
      if (!sel || !sel.quad) return;
      if (adj) adjustDone(true);
      selRecord();
      // (each picked-up canvas worked into the box round the four corners, at
      // the picture's detail, and the outline with it: a plain box's becomes
      // a cutout's four corners, a wand's shape is worked the same way)
      var Q = quadAbs(), xs = Q.map(function (q) { return q.x; }), ys = Q.map(function (q) { return q.y; });
      var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys), x1 = Math.max.apply(null, xs), y1 = Math.max.apply(null, ys);
      var k = Math.min(R, 8192 / Math.max(1e-6, x1 - x0, y1 - y0));
      var bake = function (f) { if (!f) return f; var r = warpOf(f, k, false), c = document.createElement('canvas'); c.width = Math.max(1, Math.round((x1 - x0) * k)); c.height = Math.max(1, Math.round((y1 - y0) * k)); if (r) c.getContext('2d').drawImage(r.cv, (r.x - x0) * k, (r.y - y0) * k, r.w * k, r.h * k); return c; };
      var poly = sel.poly ? sel.poly.map(function (q) { var w = selWorld({ x: sel.x + q.x, y: sel.y + q.y }); return { x: w.x - x0, y: w.y - y0 }; }) : sel.mask ? null : Q.map(function (q) { return { x: q.x - x0, y: q.y - y0 }; });
      var mask = null, md = null;
      if (sel.mask) {
        var mb = bake(sel.mask), mx = mb.getContext('2d'), id = mx.getImageData(0, 0, mb.width, mb.height);
        if (!sel.softMask) for (var i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] > 100 ? 255 : 0;
        mx.putImageData(id, 0, 0); mask = mb; md = id.data;
      }
      if (sel.more) sel.more.forEach(function (it) { if (it.f) { var b = bake(it.f); if (sel.float === it.f) sel.float = b; it.f = b; } });
      else sel.float = bake(sel.float);
      sel.x = x0; sel.y = y0; sel.w = x1 - x0; sel.h = y1 - y0; sel.rot = 0; sel.quad = null; sel.poly = poly; sel.fboxOf = null; sel.src = null; sel.base = null; // (Scale starts again from this size)
      if (sel.mask) { sel.mask = mask; sel.maskData = md; sel.tint = null; }
      drawSel(); autosave();
    }
    if (seldist) seldist.addEventListener('click', function () { if (!sel) return; if (sel.quad) distortOff(); else distortOn(); });
    function lift(keep) {
      // (a text layer's words aren't lifted: they're drawn again where they go)
      if (sel.text) { if (!sel.lifted) { push({ L: sel.text, data: snapOf(sel.text), bg: sel.text.bg, text: sel.text.text, label: 'Move Text' }); sel.lifted = true; } return; }
      // the pixels come up off the layer (or a copy of them does)
      if (sel.float || sel.more) return;
      // (with more than one layer picked, they all come up together)
      if (!sel.thing && (sel.items || multi())) {
        var items = sel.items || picks().filter(function (L) { return !L.text; }).map(function (L) { return { L: L, m: null }; });
        if (items.length > 1 || (items.length && items[0].L !== active) || items.some(function (it) { return it.L.text; })) { liftMany(items, keep); return; }
      }
      remember('Move');
      sel.float = liftFrom(active, null, keep); viewsSoon();
      // (a picture just added: what comes up is the picture at its own size,
      // so making it bigger again loses nothing)
      if (sel.src) { sel.float = sel.src; sel.src = null; }
    }
    // (L's pixels inside the selection, as a canvas of their own; and, unless
    // keep, a hole left where they were. m: a shape of its own to lift, in
    // the selection's box)
    function liftFrom(L, m, keep) {
      var f = document.createElement('canvas'); f.width = Math.max(1, Math.round(sel.w * R)); f.height = Math.max(1, Math.round(sel.h * R));
      var fx = f.getContext('2d'), mk = m || sel.mask;
      fx.drawImage(L.cv, Math.round(sel.x * R), Math.round(sel.y * R), f.width, f.height, 0, 0, f.width, f.height);
      if (sel.poly) { fx.globalCompositeOperation = 'destination-in'; outline(fx, 0, 0, R); fx.fill(); fx.globalCompositeOperation = 'source-over'; }
      if (mk) { fx.globalCompositeOperation = 'destination-in'; fx.drawImage(mk, 0, 0, f.width, f.height); fx.globalCompositeOperation = 'source-over'; }
      if (!keep && mk) {
        var cm = L.ctx; cm.save(); cm.setTransform(1, 0, 0, 1, 0, 0);
        cm.globalCompositeOperation = 'destination-out'; cm.drawImage(mk, Math.round(sel.x * R), Math.round(sel.y * R), f.width, f.height);
        cm.globalCompositeOperation = 'source-over';
        if (L.bg) cm.drawImage(tinted(mk, '#fff'), Math.round(sel.x * R), Math.round(sel.y * R), f.width, f.height);
        cm.restore();
      } else if (!keep) {
        var c = L.ctx; c.save();
        if (sel.poly) { outline(c, sel.x, sel.y, 1); c.clip(); }
        c.clearRect(sel.x, sel.y, sel.w, sel.h);
        if (L.bg) { c.fillStyle = '#fff'; c.fillRect(sel.x, sel.y, sel.w, sel.h); }
        c.restore();
      }
      return f;
    }
    // SEVERAL LAYERS PICKED UP AT ONCE: each one's pixels come up on their
    // own (shown, while they're moved, on a sheet just above their layer, so
    // what's above and below still is), and a text layer's words are moved,
    // sized and turned with them, so they stay words. One step to undo.
    function liftMany(items, keep) {
      push({ parts: items.map(function (it) { return { L: it.L, data: snapOf(it.L), bg: it.L.bg, text: it.L.text, name: it.L.name }; }), label: 'Move Layers' });
      sel.more = items.map(function (it) {
        if (it.L.text) { var T = it.L.text; return { L: it.L, T0: T, ox: T.x - sel.x, oy: T.y - sel.y, w0: sel.w, h0: sel.h, r0: sel.rot || 0 }; }
        return { L: it.L, f: liftFrom(it.L, it.m, keep) };
      });
      var mine = sel.more.filter(function (it) { return it.L === active && it.f; })[0];
      sel.float = mine ? mine.f : null; sel.items = null; viewsSoon();
    }
    function putMore() {
      sel.more.forEach(function (it) { if (it.f) putFloat(it.L.ctx, it.f); if (it.cv) it.cv.remove(); });
      sel.more = null; sel.float = null; viewsSoon(); thumbsSoon();
    }
    // (each picked-up layer's sheet, drawn where it's been moved to)
    function drawMore() {
      sel.more.forEach(function (it) {
        if (it.T0) {
          var sx = sel.w / it.w0, sy = sel.h / it.h0, T0 = it.T0, A = selWorld({ x: sel.x + it.ox * sx, y: sel.y + it.oy * sy }), T = {};
          for (var k in T0) T[k] = T0[k];
          T.size = Math.round(T0.size * sx * 100) / 100; T.w = T0.w * sx; T.rot = (T0.rot || 0) + (sel.rot || 0) - it.r0; T.x = A.x; T.y = A.y;
          if (T0.path) { var mp = function (h) { return h ? { x: h.x * sx, y: h.y * sx } : null; }; T.path = { closed: T0.path.closed, pts: T0.path.pts.map(function (q) { return { x: q.x * sx, y: q.y * sx, i: mp(q.i), o: mp(q.o) }; }) }; }
          it.L.text = T; renderText(it.L); return;
        }
        var el = usesView(it.L) ? it.L.view || viewOf(it.L) : it.L.cv;
        if (!it.cv) { it.cv = document.createElement('canvas'); it.cv.width = it.L.cv.width; it.cv.height = it.L.cv.height; it.cv.className = 'paint-liftov'; it.cv.setAttribute('aria-hidden', 'true'); }
        it.cv.style.width = it.L.cv.style.width; it.cv.style.height = it.L.cv.style.height;
        if (it.cv.previousSibling !== el && el.parentNode) el.parentNode.insertBefore(it.cv, el.nextSibling);
        it.cv.style.opacity = el.style.opacity; it.cv.style.mixBlendMode = el.style.mixBlendMode; it.cv.style.visibility = el.style.visibility;
        var x = it.cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, it.cv.width, it.cv.height); base(x); putFloat(x, it.f, true);
      });
    }
    function drawSel() {
      sctx.clearRect(0, 0, W, H);
      placeSelX(); selButtons(); scaleSync(); placeSelDist(); selectionToolbarSync();
      if (!sel) { if (!lasso.length) uiSheet(); return; }
      if (sel.text && sel.lifted) placeTextSel();
      if (sel.more) drawMore(); else if (sel.float) putFloat(sctx, null, true);
      // a wand selection shows as a light blue wash over what's picked (on the picture)
      if (sel.mask && !sel.thing) {
        sctx.save(); sctx.globalAlpha = 0.35;
        if (sel.quad) warpShow(sctx, sel.tint || (sel.tint = tinted(sel.mask, '#2f7fd6')));
        else { if (sel.rot) { var m0 = selMid(); sctx.translate(m0.x, m0.y); sctx.rotate(sel.rot); sctx.translate(-m0.x, -m0.y); } sctx.drawImage(sel.tint || (sel.tint = tinted(sel.mask, '#2f7fd6')), sel.x, sel.y, sel.w, sel.h); }
        sctx.restore();
      }
      drawSelUi();
    }
    // the outline, handles and Smart Guides' lines, on the stage's sheet
    // (drawn again whenever the view moves, so they stay on what's picked)
    function drawSelUi() {
      uiSheet();
      if (!sel) return;
      if (sel.thing) { if (snap && snap.lines.length) drawSnapLines(); return; }
      if (sel.quad) { drawQuadSel(); if (snap && snap.lines.length) drawSnapLines(); return; }
      // (the outline and handles are drawn in the box's own frame, turned with it)
      var turned = !!sel.rot;
      if (turned) { var m0 = selMid(); uctx.save(); uctx.translate(m0.x, m0.y); uctx.rotate(sel.rot); uctx.translate(-m0.x, -m0.y); }
      uctx.save(); uctx.lineWidth = 1 / view.k;
      var edge = function () { if (sel.poly) outline(uctx, sel.x, sel.y, 1); else { uctx.beginPath(); uctx.rect(sel.x, sel.y, sel.w, sel.h); } uctx.stroke(); };
      uctx.setLineDash([5 / view.k, 4 / view.k]); uctx.strokeStyle = '#000'; edge();
      uctx.lineDashOffset = 4.5 / view.k; uctx.strokeStyle = '#fff'; edge();
      // little squares on the corners: drag one to make it bigger or smaller
      if (selMode !== 'new') {
        var hs = 7 / view.k; uctx.setLineDash([]); uctx.fillStyle = '#fff'; uctx.strokeStyle = '#141414';
        localCorners().forEach(function (q) { uctx.fillRect(q.x - hs / 2, q.y - hs / 2, hs, hs); uctx.strokeRect(q.x - hs / 2, q.y - hs / 2, hs, hs); });
        // (a round handle below the bottom: drag it to turn the selection)
        var tp = { x: sel.x + sel.w / 2, y: sel.y + sel.h }, rh = rotHandleLocal();
        uctx.beginPath(); uctx.moveTo(tp.x, tp.y); uctx.lineTo(rh.x, rh.y - 5 / view.k); stem();
        uctx.beginPath(); uctx.arc(rh.x, rh.y, 5 / view.k, 0, Math.PI * 2); uctx.fill(); uctx.stroke();
      }
      uctx.restore();
      if (turned) uctx.restore();
      if (snap && snap.lines.length) drawSnapLines();
    }
    // (the round handle's stem, with a soft light edge so it shows on the
    // dark workspace past the picture too)
    function stem() { uctx.save(); uctx.strokeStyle = 'rgba(255, 255, 255, .7)'; uctx.lineWidth = 3 / view.k; uctx.stroke(); uctx.restore(); uctx.stroke(); }
    // (distorting: the outline and the wand's wash as the pixels go, a
    // square on each corner to pull it on its own, and the round handle)
    function drawQuadSel() {
      uctx.save(); uctx.lineWidth = 1 / view.k;
      var pts = sel.poly ? sel.poly.map(function (q) { return selWorld({ x: sel.x + q.x, y: sel.y + q.y }); }) : quadAbs();
      var edge = function () { uctx.beginPath(); pts.forEach(function (q, i) { uctx[i ? 'lineTo' : 'moveTo'](q.x, q.y); }); uctx.closePath(); uctx.stroke(); };
      uctx.setLineDash([5 / view.k, 4 / view.k]); uctx.strokeStyle = '#000'; edge();
      uctx.lineDashOffset = 4.5 / view.k; uctx.strokeStyle = '#fff'; edge();
      if (sel.poly) { uctx.setLineDash([2 / view.k, 3 / view.k]); uctx.lineDashOffset = 0; uctx.strokeStyle = 'rgba(255, 255, 255, .7)'; var Q = quadAbs(); uctx.beginPath(); Q.forEach(function (q, i) { uctx[i ? 'lineTo' : 'moveTo'](q.x, q.y); }); uctx.closePath(); uctx.stroke(); }
      var hs = 8 / view.k, cs = corners(); uctx.setLineDash([]); uctx.fillStyle = '#fff'; uctx.strokeStyle = '#141414';
      cs.forEach(function (q) { if (q.c !== 'rot') { uctx.fillRect(q.x - hs / 2, q.y - hs / 2, hs, hs); uctx.strokeRect(q.x - hs / 2, q.y - hs / 2, hs, hs); } });
      var rh = cs[4], tm = quadBottom();
      uctx.beginPath(); uctx.moveTo(tm.x, tm.y); uctx.lineTo(rh.x - tm.n.x * 5 / view.k, rh.y - tm.n.y * 5 / view.k); stem();
      uctx.beginPath(); uctx.arc(rh.x, rh.y, 5 / view.k, 0, Math.PI * 2); uctx.fill(); uctx.stroke();
      uctx.restore();
    }
    // (the middle of the top edge, and the way out from it)
    function quadTop() {
      var Q = quadAbs(), m = quadMid(), x = (Q[0].x + Q[1].x) / 2, y = (Q[0].y + Q[1].y) / 2, ex = Q[1].x - Q[0].x, ey = Q[1].y - Q[0].y, l = Math.hypot(ex, ey) || 1, nx = ey / l, ny = -ex / l;
      if (nx * (x - m.x) + ny * (y - m.y) < 0) { nx = -nx; ny = -ny; }
      return { x: x, y: y, n: { x: nx, y: ny } };
    }
    // The bottom edge shares the same outward-normal geometry.
    function quadBottom() {
      var Q = quadAbs(), m = quadMid(), x = (Q[3].x + Q[2].x) / 2, y = (Q[3].y + Q[2].y) / 2, ex = Q[2].x - Q[3].x, ey = Q[2].y - Q[3].y, l = Math.hypot(ex, ey) || 1, nx = ey / l, ny = -ex / l;
      if (nx * (x - m.x) + ny * (y - m.y) < 0) { nx = -nx; ny = -ny; }
      return { x: x, y: y, n: { x: nx, y: ny } };
    }
    // SMART GUIDES: while something is dragged, its box (what's really in it,
    // as it's turned and sized) snaps to the picture's middle, and to the
    // edges and middles of what's on the other layers, each way on its own:
    // within a few screen pixels it takes the line (and keeps it until it's
    // pulled a little further away), and a thin line shows what lines up.
    // The picture's middle wins a tie. The other layers' boxes are measured
    // once (a small copy, then the exact edge), and again only when they change
    var smartOn = stored('paint-smart-guides', true) !== false, snap = null, boxCache = new WeakMap();
    var SNAP_PX = 6, SNAP_LET = 10; // (in screen pixels: to take a line, and to let it go)
    function smartGuides(on) { smartOn = on; storeIt('paint-smart-guides', on); var b = hb('guides'); if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false'); snapEnd(); }
    // (a step that changes a layer's paint: its box is measured again; steps
    // that change only the list of layers leave every layer's paint as it was)
    function boxStale(e) {
      if (!e) return;
      if (e.parts) { e.parts.forEach(boxStale); return; }
      if (e.L && e.L.cv) e.L.cv.boxV = (e.L.cv.boxV || 0) + 1;
    }
    // (the box round what's painted on a canvas, in its own pixels; null if nothing)
    var boxScratch = document.createElement('canvas');
    function paintBox(cv) {
      var w = cv.width, h = cv.height; if (!w || !h) return null;
      var s = Math.min(1, 256 / Math.max(w, h)), sw = Math.max(1, Math.ceil(w * s)), sh = Math.max(1, Math.ceil(h * s));
      boxScratch.width = sw; boxScratch.height = sh;
      var bx = boxScratch.getContext('2d', { willReadFrequently: true }); bx.clearRect(0, 0, sw, sh); bx.drawImage(cv, 0, 0, sw, sh);
      var d = bx.getImageData(0, 0, sw, sh).data, x0 = sw, y0 = sh, x1 = -1, y1 = -1, x, y;
      for (y = 0; y < sh; y++) for (x = 0; x < sw; x++) if (d[(y * sw + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return null;
      if (s === 1) return { x0: x0, y0: y0, x1: x1 + 1, y1: y1 + 1 };
      // (then each edge exactly, in the strip of full-size pixels it can be in)
      var cx = cv.getContext('2d'), k = 1 / s, clamp = function (v, m) { return Math.max(0, Math.min(m, v)); };
      var ya = clamp(Math.floor((y0 - 1) * k), h), yb = clamp(Math.ceil((y1 + 2) * k), h), xa = clamp(Math.floor((x0 - 1) * k), w), xb = clamp(Math.ceil((x1 + 2) * k), w);
      var scan = function (sx, sy, sw2, sh2, byCol, fromEnd) {
        if (sw2 <= 0 || sh2 <= 0) return -1;
        var q = cx.getImageData(sx, sy, sw2, sh2).data, n = byCol ? sw2 : sh2, m = byCol ? sh2 : sw2;
        for (var i = 0; i < n; i++) { var a = fromEnd ? n - 1 - i : i; for (var j = 0; j < m; j++) { var px = byCol ? a : j, py = byCol ? j : a; if (q[(py * sw2 + px) * 4 + 3]) return a; } }
        return -1;
      };
      var L0 = clamp(Math.floor((x0 - 1) * k), w), L1 = clamp(Math.ceil((x0 + 1) * k), w), R0 = clamp(Math.floor(x1 * k), w), R1 = clamp(Math.ceil((x1 + 2) * k), w);
      var T0 = clamp(Math.floor((y0 - 1) * k), h), T1 = clamp(Math.ceil((y0 + 1) * k), h), B0 = clamp(Math.floor(y1 * k), h), B1 = clamp(Math.ceil((y1 + 2) * k), h);
      var l = scan(L0, ya, L1 - L0, yb - ya, true, false), r = scan(R0, ya, R1 - R0, yb - ya, true, true);
      var t = scan(xa, T0, xb - xa, T1 - T0, false, false), b = scan(xa, B0, xb - xa, B1 - B0, false, true);
      return { x0: l < 0 ? x0 * k : L0 + l, x1: r < 0 ? (x1 + 1) * k : R0 + r + 1, y0: t < 0 ? y0 * k : T0 + t, y1: b < 0 ? (y1 + 1) * k : B0 + b + 1 };
    }
    // (a text layer's box, as its words are turned: the box round the turned box)
    function wordsBox(L) {
      var T = L.text, b = tboxOf(L), r = T.rot || 0, co = Math.cos(r), si = Math.sin(r), xs = [], ys = [];
      [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].forEach(function (q) { xs.push(T.x + co * q[0] - si * q[1]); ys.push(T.y + si * q[0] + co * q[1]); });
      return { x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys), x1: Math.max.apply(null, xs), y1: Math.max.apply(null, ys) };
    }
    // (each other layer's box, in the picture's units)
    function layerBox(L, fresh) {
      if (L.text) return wordsBox(L);
      var c = boxCache.get(L.cv), v = L.cv.boxV || 0;
      if (!c || c.v !== v || fresh) { var b = paintBox(L.cv); c = { v: v, b: b ? { x0: b.x0 / R, y0: b.y0 / R, x1: b.x1 / R, y1: b.y1 / R } : null }; boxCache.set(L.cv, c); }
      return c.b;
    }
    // (what's being moved: its real box, turned and sized with the selection)
    function movingBox() {
      var f = { x0: 0, y0: 0, x1: 1, y1: 1 };
      if (sel.float && !sel.more && !sel.text) {
        if (sel.fboxOf !== sel.float) { var b = paintBox(sel.float), fw = sel.float.width, fh = sel.float.height; sel.fbox = b ? { x0: b.x0 / fw, y0: b.y0 / fh, x1: b.x1 / fw, y1: b.y1 / fh } : f; sel.fboxOf = sel.float; }
        f = sel.fbox;
      }
      var xs = [], ys = [];
      [[f.x0, f.y0], [f.x1, f.y0], [f.x0, f.y1], [f.x1, f.y1]].forEach(function (q) { var p = selWorld({ x: sel.x + q[0] * sel.w, y: sel.y + q[1] * sel.h }); xs.push(p.x); ys.push(p.y); });
      return { x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys), x1: Math.max.apply(null, xs), y1: Math.max.apply(null, ys) };
    }
    function snapStart() {
      var B = movingBox(), moving = [];
      if (sel.more) sel.more.forEach(function (it) { moving.push(it.L); });
      if (sel.items) sel.items.forEach(function (it) { moving.push(it.L); });
      if (sel.text) moving.push(sel.text);
      var boxes = [];
      layers.forEach(function (L) {
        if (L.bg || !shownVisible(L) || moving.indexOf(L) >= 0) return;
        // (the layer it was lifted from: what's left on it, measured afresh)
        var b = L === active && lifted() && !sel.more ? layerBox(L, true) : L === active && !L.text && !lifted() ? null : layerBox(L);
        if (b && b.x1 - b.x0 > 0 && b.y1 - b.y0 > 0) boxes.push(b);
      });
      var X = [{ v: W / 2, c: true }], Y = [{ v: H / 2, c: true }];
      boxes.forEach(function (b) { [b.x0, (b.x0 + b.x1) / 2, b.x1].forEach(function (v) { X.push({ v: v, b: b }); }); [b.y0, (b.y0 + b.y1) / 2, b.y1].forEach(function (v) { Y.push({ v: v, b: b }); }); });
      // (where the box's edges and middle are, from the selection's corner)
      snap = { ox: [B.x0 - sel.x, (B.x0 + B.x1) / 2 - sel.x, B.x1 - sel.x], oy: [B.y0 - sel.y, (B.y0 + B.y1) / 2 - sel.y, B.y1 - sel.y], bw: B.x1 - B.x0, bh: B.y1 - B.y0, X: X, Y: Y, hx: null, hy: null, lines: [] };
    }
    // (one way: the line it takes, if any, given where the pointer puts it)
    function snapAxis(raw, off, T, held) {
      var take = SNAP_PX / view.k, keep = SNAP_LET / view.k;
      if (held && Math.abs(raw + off[held.i] - held.t.v) < keep) return held;
      var best = null, bd = take;
      T.forEach(function (t) {
        // (the picture's middle: only for the box's middle, and ahead on a tie)
        for (var i = t.c ? 1 : 0; i < (t.c ? 2 : 3); i++) { var d = Math.abs(raw + off[i] - t.v) - (t.c ? 0.5 / view.k : 0); if (d < bd) { bd = d; best = { t: t, i: i }; } }
      });
      return best;
    }
    function snapMove() {
      if (!smartOn || !sel || sel.w <= 0) { if (snap) snapEnd(); return; }
      if (!snap) snapStart();
      var S = snap, rx = sel.x, ry = sel.y;
      S.hx = snapAxis(rx, S.ox, S.X, S.hx); S.hy = snapAxis(ry, S.oy, S.Y, S.hy);
      if (S.hx) sel.x = S.hx.t.v - S.ox[S.hx.i];
      if (S.hy) sel.y = S.hy.t.v - S.oy[S.hy.i];
      // (the lines: the picture's middle right across; along what lines up
      // otherwise, from end to end of all the boxes on it)
      var bx0 = sel.x + S.ox[0], bx1 = sel.x + S.ox[2], by0 = sel.y + S.oy[0], by1 = sel.y + S.oy[2], e = 0.5 / view.k, lines = [];
      if (S.hx) {
        var vx = S.hx.t.v;
        if (S.hx.t.c) lines.push([vx, 0, vx, H]);
        else { var a = by0, z = by1; S.X.forEach(function (t) { if (t.b && Math.abs(t.v - vx) < e) { a = Math.min(a, t.b.y0); z = Math.max(z, t.b.y1); } }); lines.push([vx, a, vx, z]); }
      }
      if (S.hy) {
        var vy = S.hy.t.v;
        if (S.hy.t.c) lines.push([0, vy, W, vy]);
        else { var a2 = bx0, z2 = bx1; S.Y.forEach(function (t) { if (t.b && Math.abs(t.v - vy) < e) { a2 = Math.min(a2, t.b.x0); z2 = Math.max(z2, t.b.x1); } }); lines.push([a2, vy, z2, vy]); }
      }
      S.lines = lines;
    }
    function snapEnd() { if (!snap) return; var had = snap.lines.length; snap = null; if (had) drawSel(); }
    var snapInk = null;
    document.addEventListener('paint:theme', function () { snapInk = null; });
    function drawSnapLines() {
      if (!snapInk) snapInk = getComputedStyle(document.documentElement).getPropertyValue('--snap').trim() || '#ff2d78';
      uctx.save(); uctx.setLineDash([]); uctx.lineCap = 'butt';
      // (a soft light edge under a thin line, so it shows on light and dark paint)
      snap.lines.forEach(function (l) { uctx.beginPath(); uctx.moveTo(l[0], l[1]); uctx.lineTo(l[2], l[3]); uctx.strokeStyle = 'rgba(255, 255, 255, .55)'; uctx.lineWidth = 3 / view.k; uctx.stroke(); uctx.strokeStyle = snapInk; uctx.lineWidth = 1 / view.k; uctx.stroke(); });
      uctx.restore();
    }
    // MOVE ON A TEXT LAYER: the box round its words is moved, sized (keeping
    // its shape) and turned like a selection, and the words are drawn again
    // to fit it: bigger or smaller type, so they stay words
    function textSel(L) {
      var T = L.text, b = tboxOf(L), r = T.rot || 0, co = Math.cos(r), si = Math.sin(r), mx = b.x + b.w / 2, my = b.y + b.h / 2;
      var M = { x: T.x + co * mx - si * my, y: T.y + si * mx + co * my };
      sel = { x: M.x - b.w / 2, y: M.y - b.h / 2, w: b.w, h: b.h, rot: r, float: null, whole: true, auto: true, text: L, T0: T, tax: -b.x, tay: -b.y, w0: b.w };
      selbar.hidden = false; drawSel();
    }
    function placeTextSel() {
      var s = sel.w / sel.w0, T0 = sel.T0, A = selWorld({ x: sel.x + sel.tax * s, y: sel.y + sel.tay * s });
      var T = {}; for (var k in T0) T[k] = T0[k];
      T.size = Math.round(T0.size * s * 100) / 100; T.w = T0.w * s; T.rot = sel.rot || 0; T.x = A.x; T.y = A.y;
      if (T0.path) { var m = function (h) { return h ? { x: h.x * s, y: h.y * s } : null; }; T.path = { closed: T0.path.closed, pts: T0.path.pts.map(function (q) { return { x: q.x * s, y: q.y * s, i: m(q.i), o: m(q.o) }; }) }; }
      sel.text.text = T; renderText(sel.text);
    }
    // (what a selection of words can do: turn, be put down, or go)
    function selButtons() {
      var t = !!(sel && sel.text), many = !!(sel && (sel.more || sel.items || (multi() && !sel.thing && !sel.text)));
      var words = many && (sel.more || sel.items || []).some(function (it) { return it.L.text; });
      Array.prototype.forEach.call((selectionSlot || selbar).querySelectorAll('[data-sel]'), function (b) {
        var k = b.dataset.sel;
        b.disabled = (t && !/^(rot90|done|delete|copy|paste)$/.test(k)) || (many && (/^(duplicate|invert|layer)$/.test(k) || (words && /^(fliph|flipv|delete)$/.test(k))));
        if (/^(all|deselect|done|paste)$/.test(k)) b.disabled = false;
        if (k === 'region-invert') b.disabled = t || many || !!(sel && sel.thing);
        b.title = many && b.disabled ? 'Not with more than one layer picked' : '';
      });
    }
    // MOVE: what's on the layer is picked up whole, ready to move, size or
    // turn (a selection already made is used as it is)
    function movePick() {
      if (sel || !active) return;
      if (multi()) { manySel(); return; }
      if (active.text) textSel(active); else { layerSel(active); if (sel) sel.auto = true; }
    }
    // (the box round everything on the picked layers, the words of text
    // layers too; the white Background gives only what's drawn on it)
    function manySel() {
      var U = null, items = [], grow = function (x0, y0, x1, y1) { U = U ? { x0: Math.min(U.x0, x0), y0: Math.min(U.y0, y0), x1: Math.max(U.x1, x1), y1: Math.max(U.y1, y1) } : { x0: x0, y0: y0, x1: x1, y1: y1 }; };
      picks().forEach(function (L) {
        if (L.text) {
          var T = L.text, b = tboxOf(L), r = T.rot || 0, co = Math.cos(r), si = Math.sin(r), xs = [], ys = [];
          [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].forEach(function (q) { xs.push(T.x + co * q[0] - si * q[1]); ys.push(T.y + si * q[0] + co * q[1]); });
          grow(Math.min.apply(null, xs) * R, Math.min.apply(null, ys) * R, Math.max.apply(null, xs) * R, Math.max.apply(null, ys) * R); items.push({ L: L, m: null }); return;
        }
        var w = L.cv.width, h = L.cv.height, d = L.ctx.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (var y = 0, k = 0; y < h; y++) for (var x = 0; x < w; x++, k++) { var j = k * 4; if (L.bg ? 765 - d[j] - d[j + 1] - d[j + 2] > 36 : d[j + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
        if (x1 < 0) return;
        grow(x0, y0, x1 + 1, y1 + 1); items.push({ L: L, m: null, d: d });
      });
      if (!U) return;
      U = { x0: Math.max(0, Math.floor(U.x0)), y0: Math.max(0, Math.floor(U.y0)), x1: Math.min(ov.width, Math.ceil(U.x1)), y1: Math.min(ov.height, Math.ceil(U.y1)) };
      var mw = Math.max(1, U.x1 - U.x0), mh = Math.max(1, U.y1 - U.y0);
      // (the Background's white isn't picked up: just what's drawn on it)
      items.forEach(function (it) {
        if (!it.L.bg || !it.d) { delete it.d; return; }
        var m = document.createElement('canvas'); m.width = mw; m.height = mh;
        var mx = m.getContext('2d'), md = mx.createImageData(mw, mh), w = it.L.cv.width, d = it.d;
        for (var yy = 0; yy < mh; yy++) for (var xx = 0; xx < mw; xx++) { var j = ((yy + U.y0) * w + xx + U.x0) * 4; if (765 - d[j] - d[j + 1] - d[j + 2] > 36) md.data[(yy * mw + xx) * 4 + 3] = 255; }
        mx.putImageData(md, 0, 0); it.m = m; delete it.d;
      });
      sel = { x: U.x0 / R, y: U.y0 / R, w: mw / R, h: mh / R, float: null, whole: true, auto: true, items: items };
      selbar.hidden = false; drawSel();
    }
    function rotHandleLocal() { return { x: sel.x + sel.w / 2, y: sel.y + sel.h + 26 / view.k }; }
    function localCorners() { return [{ x: sel.x, y: sel.y, c: 'nw' }, { x: sel.x + sel.w, y: sel.y, c: 'ne' }, { x: sel.x, y: sel.y + sel.h, c: 'sw' }, { x: sel.x + sel.w, y: sel.y + sel.h, c: 'se' }]; }
    function corners() {
      if (sel.quad) { var Q = quadAbs(), t = quadBottom(), g = 26 / view.k; return [{ x: Q[0].x, y: Q[0].y, c: 'nw', i: 0 }, { x: Q[1].x, y: Q[1].y, c: 'ne', i: 1 }, { x: Q[3].x, y: Q[3].y, c: 'sw', i: 3 }, { x: Q[2].x, y: Q[2].y, c: 'se', i: 2 }, { x: t.x + t.n.x * g, y: t.y + t.n.y * g, c: 'rot' }]; }
      var out = localCorners().map(function (q) { var w = selWorld(q); return { x: w.x, y: w.y, c: q.c }; });
      var rh = selWorld(rotHandleLocal()); out.push({ x: rh.x, y: rh.y, c: 'rot' });
      return out;
    }
    // which corner (if any) the pointer is on, within a few screen pixels
    function cornerAt(p, touch) {
      if (!sel || selMode || sel.thing) return null;
      var r = (touch ? 18 : 9) / view.k, hit = null;
      corners().forEach(function (q) { if (!hit && Math.abs(p.x - q.x) <= r && Math.abs(p.y - q.y) <= r) hit = q; });
      return hit;
    }
    function cornerCursor(q) {
      // (the corners' arrows turn with the selection, near enough)
      var t = sel && sel.rot ? Math.round(sel.rot / (Math.PI / 2)) & 1 : 0, a = q && (q.c === 'nw' || q.c === 'se'), b = q && (q.c === 'ne' || q.c === 'sw');
      stage.classList.toggle('corner-nwse', !!(t ? b : a));
      stage.classList.toggle('corner-nesw', !!(t ? a : b));
      stage.classList.toggle('corner-rot', !!q && q.c === 'rot');
    }
    // after a wand selection is resized, its shape is redrawn at the new size
    function refitMask() {
      if (!sel.mask) return;
      var w = Math.max(1, Math.round(sel.w * R)), h = Math.max(1, Math.round(sel.h * R));
      if (w === sel.mask.width && h === sel.mask.height) return;
      var m = document.createElement('canvas'); m.width = w; m.height = h;
      var x = m.getContext('2d'); x.drawImage(sel.mask, 0, 0, w, h);
      var d = x.getImageData(0, 0, w, h);
      if (!sel.softMask) for (var i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 100 ? 255 : 0;
      x.putImageData(d, 0, 0);
      sel.mask = m; sel.maskData = d.data; sel.tint = null;
    }
    function commitSelection() {
      if (!sel) return;
      if (sel.more) { putMore(); autosave(); }
      else if (sel.float) { putFloat(active.ctx); autosave(); }
      clearSel();
    }
    function invertSel() {
      if (!sel) return;
      if (adj) adjustDone();
      var inv = function (d) { for (var i = 0; i < d.length; i += 4) if (d[i + 3]) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; } };
      if (sel.float) {
        // (something lifted and being moved: its own pixels)
        var fx = sel.float.getContext('2d'), fd = fx.getImageData(0, 0, sel.float.width, sel.float.height); inv(fd.data); fx.putImageData(fd, 0, 0); warpForget(sel.float);
      } else {
        remember('Invert');
        var c = active.ctx, img = c.getImageData(0, 0, active.cv.width, active.cv.height), d = img.data, m = selPixels();
        for (var i = 0; i < d.length; i += 4) if (m[i + 3] > 127 && d[i + 3]) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.putImageData(img, 0, 0); c.restore();
      }
      drawSel(); autosave();
    }
    function selectAll() { if (textBox) commitText(); commitSelection(); need(); sel = { x: 0, y: 0, w: W, h: H, float: null }; selbar.hidden = false; drawSel(); }
    // COPY: what's selected, as it would be laid down (moved, sized, turned
    // or distorted; on every picked layer), kept here and put on the system
    // clipboard as a PNG; nothing on the picture changes. PASTE puts it on a
    // layer of its own where it was, picked up with the Move tool, at its
    // own pixels (selClip stays until the next copy, whatever's committed)
    var selClip = null, pasteWait = 0;
    // (how the focus last moved: by Tab, or by a press; a
    // control reached from the keyboard keeps Return for itself)
    var keyNav = false;
    document.addEventListener('pointerdown', function () { keyNav = false; }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Tab') keyNav = true; }, true);
    function selBounds() {
      var pts = sel.quad ? quadAbs() : localCorners().map(selWorld), xs = pts.map(function (q) { return q.x; }), ys = pts.map(function (q) { return q.y; });
      var x0 = Math.floor(Math.min.apply(null, xs) * R), y0 = Math.floor(Math.min.apply(null, ys) * R);
      var x1 = Math.ceil(Math.max.apply(null, xs) * R), y1 = Math.ceil(Math.max.apply(null, ys) * R);
      return { x: x0 / R, y: y0 / R, w: Math.max(1, x1 - x0) / R, h: Math.max(1, y1 - y0) / R };
    }
    function copySel() {
      if (!sel || !(sel.w > 0 && sel.h > 0)) return;
      var cv = document.createElement('canvas'), c, b;
      if (lifted()) {
        // (picked up: drawn as it would be put down, past the picture's edge too)
        b = selBounds(); cv.width = Math.round(b.w * R); cv.height = Math.round(b.h * R);
        c = cv.getContext('2d', { willReadFrequently: true }); c.setTransform(R, 0, 0, R, -b.x * R, -b.y * R); // (drawn as on a layer, to the pixel)
        if (sel.more) sel.more.forEach(function (it) { if (it.f) putFloat(c, it.f); }); else putFloat(c);
      } else if (sel.rot || sel.quad) {
        // (words being moved and turned: what's on their layer round them)
        b = selBounds(); cv.width = Math.round(b.w * R); cv.height = Math.round(b.h * R);
        cv.getContext('2d').drawImage((sel.text || active).cv, -b.x * R, -b.y * R);
      } else {
        // (still in place: each picked layer's pixels inside it, as Move would lift them)
        var its = sel.text ? [{ L: sel.text }] : sel.items || (multi() ? picks() : [active]).map(function (L) { return { L: L }; });
        b = { x: Math.round(sel.x * R) / R, y: Math.round(sel.y * R) / R, w: Math.max(1, Math.round(sel.w * R)) / R, h: Math.max(1, Math.round(sel.h * R)) / R };
        cv.width = Math.round(b.w * R); cv.height = Math.round(b.h * R); c = cv.getContext('2d');
        its.forEach(function (it) { if (it.L) c.drawImage(liftFrom(it.L, it.m || null, true), 0, 0); });
      }
      selClip = { cv: cv, x: b.x, y: b.y, w: b.w, h: b.h };
      // (the system clipboard too, where the browser allows it: a promise
      // made now, inside the click or key, as Safari needs)
      try {
        if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': new Promise(function (ok) { cv.toBlob(ok, 'image/png'); }) })]).catch(function () {});
        }
      } catch (x) {}
      toast('Copied: paste it with ' + CMD.trim() + (MAC ? 'V' : '+V') + ' or Paste');
    }
    function pasteClip() {
      var c = selClip; if (!c) { toast('Nothing copied yet: select something and Copy it'); return; }
      if (!roomFor()) return;
      finishWork(); rememberLayers('Paste');
      var L = makeLayer('Pasted', false); L.ctx.drawImage(c.cv, c.x, c.y, c.w, c.h);
      layers.splice(active ? layers.indexOf(active) + 1 : layers.length, 0, L); L.group = active ? active.group : null; active = L; mount();
      var src = document.createElement('canvas'); src.width = c.cv.width; src.height = c.cv.height; src.getContext('2d').drawImage(c.cv, 0, 0);
      sel = { x: c.x, y: c.y, w: c.w, h: c.h, float: null, whole: true, auto: true, src: src, base: { w: c.w, h: c.h } };
      setTool('move'); selbar.hidden = false; drawSel();
      toast('Pasted on a new layer: drag it into place, size or turn it');
      autosave();
    }
    // (a picture on the system clipboard: the one copied here, at its own
    // pixels, if it's the same; anything else comes in as a picture)
    function pasteFile(file) {
      if (!selClip) { addPicture(file, 'paste'); return; }
      var im = new Image(), url = URL.createObjectURL(file);
      im.onload = function () {
        URL.revokeObjectURL(url);
        var a = selClip.cv, same = im.naturalWidth === a.width && im.naturalHeight === a.height;
        if (same) {
          var t = document.createElement('canvas'); t.width = a.width; t.height = a.height; var tx = t.getContext('2d', { willReadFrequently: true }); tx.drawImage(im, 0, 0);
          var d1 = tx.getImageData(0, 0, a.width, a.height).data, d2 = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, step = Math.max(4, Math.floor(d1.length / 4 / 4000) * 4);
          for (var i = 0; i < d1.length && same; i += step) if (Math.abs(d1[i + 3] - d2[i + 3]) > 2 || (d2[i + 3] > 32 && (Math.abs(d1[i] - d2[i]) > 6 || Math.abs(d1[i + 1] - d2[i + 1]) > 6 || Math.abs(d1[i + 2] - d2[i + 2]) > 6))) same = false;
        }
        if (same) pasteClip(); else addPicture(file, 'paste');
      };
      im.onerror = function () { URL.revokeObjectURL(url); pasteClip(); };
      im.src = url;
    }
    // (the Paste buttons: what was copied here; or, with nothing copied
    // here, a picture from the system clipboard, where it can be read)
    function pasteAny() {
      clearTimeout(pasteWait); pasteWait = 0;
      if (selClip || !(navigator.clipboard && navigator.clipboard.read)) { pasteClip(); return; }
      navigator.clipboard.read().then(function (items) {
        for (var i = 0; i < items.length; i++) {
          var ty = items[i].types.filter(function (t) { return /^image\//.test(t); })[0];
          if (ty) return items[i].getType(ty).then(function (blob) { addPicture(new File([blob], 'pasted.png', { type: ty }), 'paste'); });
        }
        pasteClip();
      }).catch(function () { pasteClip(); });
    }
    function selAction(a) {
      if (a === 'all') { selectAll(); return; }
      if (a === 'paste') { pasteAny(); return; }
      if (!sel) return;
      if (a === 'copy') { copySel(); return; }
      if (a === 'deselect') { commitSelection(); return; }
      if (a === 'region-invert') { changeSelectionMask('invert', 0); return; }
      if (sel.text && a === 'delete') { var TL = sel.text; clearSel(); active = TL; layerAct('delete'); return; }
      if (sel.text && a !== 'rot90' && a !== 'done') return;
      if (a === 'done') { commitSelection(); return; }
      if (a === 'invert') { invertSel(); return; }
      if (a === 'rot90' && sel.quad) { lift(); selRecord(); sel.quad = quadTurn(sel.quad.slice(), quadMid(), Math.PI / 2); drawSel(); autosave(); return; }
      if (a === 'rot90') { lift(); selRecord(); var r9 = (sel.rot || 0) + Math.PI / 2; sel.rot = Math.abs(Math.atan2(Math.sin(r9), Math.cos(r9))) < 1e-6 ? 0 : Math.atan2(Math.sin(r9), Math.cos(r9)); drawSel(); return; }
      if (a === 'layer') {
        // CUT TO LAYER: the selection comes out onto a layer of its own
        if (!roomFor()) return;
        var wasDown = !sel.float; lift(); // (not called lifted: that would hide lifted(), which Delete uses)
        var mv = wasDown ? undo.pop() : null; rememberLayers('Cut to Layer');
        if (mv) { var ls = undo.pop(); delete mv.redoWas; push({ parts: [mv, ls], label: 'Cut to Layer' }); }
        var L = makeLayer('Cutout', false); putFloat(L.ctx);
        layers.splice(layers.indexOf(active) + 1, 0, L); L.group = active.group; active = L;
        clearSel(); mount(); return;
      }
      if (a === 'delete') { if (!lifted()) lift(); if (sel.more) sel.more.forEach(function (it) { it.f = null; }); sel.float = null; clearSel(); autosave(); return; }
      if (a === 'duplicate') {
        // DUPLICATE: the selection is copied onto a new layer just above, picked
        // up and ready to move (the original stays where it is)
        if (!roomFor()) return;
        var f;
        if ((sel.rot || sel.quad) && sel.float) {
          // (a turned or distorted one: what's picked up is put down, and a copy of it carries on)
          f = document.createElement('canvas'); f.width = sel.float.width; f.height = sel.float.height; f.getContext('2d').drawImage(sel.float, 0, 0);
          anchor(true);
        } else { anchor(); lift(true); f = sel.float; sel.float = null; undo.pop(); }
        rememberLayers('Copy');
        var L2 = makeLayer('Copy', false); layers.splice(layers.indexOf(active) + 1, 0, L2); L2.group = active.group; active = L2; mount();
        sel.float = f; sel.x += 14; sel.y += 14; drawSel(); autosave(); return;
      }
      lift();
      var flip = function (f) {
        var g = document.createElement('canvas'); g.width = f.width; g.height = f.height;
        var gx = g.getContext('2d');
        if (a === 'fliph') { gx.translate(f.width, 0); gx.scale(-1, 1); } else { gx.translate(0, f.height); gx.scale(1, -1); }
        gx.drawImage(f, 0, 0); return g;
      };
      if (sel.more) { sel.more.forEach(function (it) { if (it.f) { var was = it.f; it.f = flip(was); if (sel.float === was) sel.float = it.f; } }); }
      else sel.float = flip(sel.float);
      sel.hist = []; sel.fut = []; histButtons();
      if (sel.poly) sel.poly = sel.poly.map(function (q) { return a === 'fliph' ? { x: sel.w - q.x, y: q.y } : { x: q.x, y: sel.h - q.y }; });
      if (sel.mask) {
        var m2 = document.createElement('canvas'); m2.width = sel.mask.width; m2.height = sel.mask.height;
        var mx2 = m2.getContext('2d');
        if (a === 'fliph') { mx2.translate(m2.width, 0); mx2.scale(-1, 1); } else { mx2.translate(0, m2.height); mx2.scale(1, -1); }
        mx2.drawImage(sel.mask, 0, 0); sel.mask = m2; sel.maskData = mx2.getImageData(0, 0, m2.width, m2.height).data; sel.tint = null;
      }
      drawSel();
    }

    // ---- layers ----
    var panel = document.createElement('div');
    panel.className = 'paint-layerpanel'; panel.hidden = true;
    root.appendChild(panel);
    draggable(panel, '.pl-title', 'layers');
    renderLayers();
    function renderLayers() {
      if (!panel) return;
      var esc = function (t) { return t.replace(/[<&"]/g, function (ch) { return ch === '<' ? '&lt;' : ch === '&' ? '&amp;' : '&quot;'; }); };
      var EYE = function (on) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (on ? '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>' : '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.6 3.3M6.4 7.6A15 15 0 0 0 2.5 12s3.5 6 9.5 6a9 9 0 0 0 4.1-1"/>') + '</svg>'; };
      var shownG = []; tidyAlso();
      var rows = layers.slice().reverse().map(function (L) {
        var i = layers.indexOf(L), G = L.group, head = '';
        // (a group: its row, then its layers, unless it's folded shut)
        if (G && shownG.indexOf(G) < 0) {
          shownG.push(G);
          var gm0 = membersOf(G);
          head = '<div class="pl-row pl-grp' + (focusG === G ? ' on' : '') + (gm0.length && gm0.every(function (M) { return M === active || also.indexOf(M) >= 0; }) && also.length ? ' also' : '') + (G.visible ? '' : ' off') + '" data-gid="' + G.id + '">' +
            '<button type="button" class="pl-eye" data-geye="' + G.id + '" aria-label="' + (G.visible ? 'Hide' : 'Show') + ' ' + esc(G.name) + '" aria-pressed="' + (!G.visible) + '">' + EYE(G.visible) + '</button>' +
            '<button type="button" class="pl-fold" data-gfold="' + G.id + '" aria-expanded="' + G.open + '" aria-label="' + (G.open ? 'Fold' : 'Open') + ' the group"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>' +
            '<button type="button" class="pl-name" data-gname="' + G.id + '" title="Tap again to rename"><svg class="pl-folder" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/></svg><span>' + esc(G.name) + '</span></button>' +
            '<button type="button" class="pl-more" data-gmore="' + G.id + '" aria-haspopup="menu" aria-label="Options for ' + esc(G.name) + '" title="Group options"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg></button></div>';
        }
        if (G && !G.open) return head;
        return head + '<div class="pl-row' + (L === active && !focusG ? ' on' : '') + (also.indexOf(L) >= 0 && !focusG ? ' also' : '') + (clipBase(L) ? ' clipped' : '') + (G ? ' in-grp' : '') + '" data-i="' + i + '">' +
          '<button type="button" class="pl-eye" data-layer-eye="' + i + '" aria-label="' + (L.visible ? 'Hide' : 'Show') + ' ' + esc(L.name) + '" aria-pressed="' + (!L.visible) + '">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true">' + (L.visible ? '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>' : '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.6 3.3M6.4 7.6A15 15 0 0 0 2.5 12s3.5 6 9.5 6a9 9 0 0 0 4.1-1"/>') + '</svg></button>' +
          '<canvas class="pl-thumb' + (L.mask && !L.editMask ? ' picked' : '') + '" data-thumb="' + i + '" aria-hidden="true"></canvas>' +
          (L.mask ? '<canvas class="pl-thumb pl-mthumb' + (L.editMask ? ' picked' : '') + '" data-mthumb="' + i + '" role="button" aria-label="The mask: tap to paint on it" title="The mask: tap to paint on it (black hides, white shows)"></canvas>' : '') +
          '<button type="button" class="pl-name" data-layer="' + i + '" title="Tap again to rename"><span>' + L.name.replace(/[<&]/g, function (ch) { return ch === '<' ? '&lt;' : '&amp;'; }) + '</span>' +
            (L.text ? '<svg class="pl-tag" viewBox="0 0 24 24" role="img" aria-label="Text layer"><path d="M6 7.5V5h12v2.5"/><path d="M12 5v14"/><path d="M9.5 19h5"/></svg>' : '') +
            (L.alphaLock ? '<svg class="pl-tag" viewBox="0 0 24 24" role="img" aria-label="Alpha lock on"><rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/></svg>' : '') + '</button>' +
          '<button type="button" class="pl-more" data-layer-more="' + i + '" aria-haspopup="menu" aria-label="Options for ' + esc(L.name) + '" title="Layer options"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg></button>' +
          '<span class="pl-grip" aria-label="Drag to reorder" title="Drag to reorder"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="7" r="1.3"/><circle cx="15" cy="7" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="17" r="1.3"/><circle cx="15" cy="17" r="1.3"/></svg></span></div>';
      }).join('');
      if (!layers.length) rows = '<div class="pl-empty">No layers. Draw, or tap + to add one.</div>';
      var pr = focusG ? '<div class="pl-props"><label class="pl-op"><span>Group</span><input type="range" min="0" max="100" value="' + Math.round(focusG.opacity * 100) + '" data-group-op aria-label="Group opacity"><output>' + Math.round(focusG.opacity * 100) + '%</output></label>' +
        '<label class="pl-bl"><span>Blend</span><select data-group-blend aria-label="Group blend mode">' + BLENDS.map(function (b) { return '<option value="' + b[0] + '"' + (b[0] === focusG.blend ? ' selected' : '') + '>' + b[1] + '</option>'; }).join('') + '</select></label></div>' :
        active ? '<div class="pl-props"><label class="pl-op"><span>Opacity</span><input type="range" min="0" max="100" value="' + Math.round(active.opacity * 100) + '" data-layer-op aria-label="Layer opacity"><output>' + Math.round(active.opacity * 100) + '%</output></label>' +
        '<label class="pl-bl"><span>Blend</span><select data-layer-blend aria-label="Blend mode">' + BLENDS.map(function (b) { return '<option value="' + b[0] + '"' + (b[0] === active.blend ? ' selected' : '') + '>' + b[1] + '</option>'; }).join('') + '</select></label></div>' : '';
      thumbsSoon();
      var nPick = also.length ? also.length + 1 : 0;
      panel.innerHTML = '<div class="pl-title">Layers' + (nPick ? '<span class="pl-count" aria-live="polite">' + nPick + ' picked</span>' : '') + '</div><div class="pl-list">' + rows + '</div>' + pr +
        '<div class="pl-acts">' +
          '<button type="button" data-layer-act="add" title="New layer" aria-label="New layer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>' +
          '<button type="button" data-layer-act="group" title="' + (nPick ? 'Put the picked layers in a new group' : 'Put the layer in a new group') + '" aria-label="New group"' + (active && (nPick || !active.group) ? '' : ' disabled') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M12 11v5M9.5 13.5h5"/></svg></button>' +
          '<button type="button" data-layer-act="up" title="Move up" aria-label="Move layer up"' + (nPick || !active || layers.indexOf(active) === layers.length - 1 ? ' disabled' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>' +
          '<button type="button" data-layer-act="down" title="Move down" aria-label="Move layer down"' + (nPick || !active || layers.indexOf(active) < 1 ? ' disabled' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg></button>' +
          '<button type="button" data-layer-act="delete" title="' + (nPick ? 'Delete the picked layers' : 'Delete layer') + '" aria-label="' + (nPick ? 'Delete the picked layers' : 'Delete layer') + '"' + (active ? '' : ' disabled') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 12h8l1-12"/></svg></button>' +
        '</div>';
    }
    // LAYER PREVIEWS: a little picture of what's on each layer (over a
    // checkerboard, so see-through parts show), kept up to date while the
    // panel is open; rest the mouse on one for a bigger look
    var thumbQ = false;
    function thumbsSoon() { if (thumbQ) return; thumbQ = true; requestAnimationFrame(function () { thumbQ = false; drawThumbs(); }); }
    function drawThumbs() {
      if (!panel || panel.hidden) return;
      var k = Math.min(44 / ov.width, 32 / ov.height), tw = Math.max(4, Math.round(ov.width * k)), th = Math.max(4, Math.round(ov.height * k)), d = Math.min(window.devicePixelRatio || 1, 2);
      Array.prototype.forEach.call(panel.querySelectorAll('[data-thumb]'), function (c) {
        var L = layers[+c.dataset.thumb]; if (!L) return;
        if (c.width !== tw * d) { c.width = tw * d; c.height = th * d; c.style.width = tw + 'px'; c.style.height = th + 'px'; }
        var x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.imageSmoothingQuality = 'high'; x.drawImage(L.cv, 0, 0, c.width, c.height);
      });
      Array.prototype.forEach.call(panel.querySelectorAll('[data-mthumb]'), function (c) {
        var L = layers[+c.dataset.mthumb]; if (!L || !L.mask) return;
        if (c.width !== tw * d) { c.width = tw * d; c.height = th * d; c.style.width = tw + 'px'; c.style.height = th + 'px'; }
        var x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(L.mask.cv, 0, 0, c.width, c.height);
      });
      if (peekL) drawPeek();
    }
    var peek = document.createElement('div'), peekL = null;
    peek.className = 'pl-peek'; peek.hidden = true; peek.innerHTML = '<canvas></canvas><span></span>';
    document.body.appendChild(peek);
    function drawPeek() {
      var c = peek.firstChild, k = Math.min(220 / ov.width, 180 / ov.height), d = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(ov.width * k), h = Math.round(ov.height * k);
      c.width = w * d; c.height = h * d; c.style.width = w + 'px'; c.style.height = h + 'px';
      c.getContext('2d').drawImage(peekL.cv, 0, 0, c.width, c.height);
      peek.lastChild.textContent = peekL.name;
    }
    function showPeek(t) {
      peekL = layers[+t.dataset.thumb]; if (!peekL) return;
      drawPeek(); peek.hidden = false;
      var r = t.getBoundingClientRect(), pr = panel.getBoundingClientRect();
      peek.style.left = Math.max(8, pr.left - peek.offsetWidth - 10) + 'px';
      peek.style.top = Math.max(8, Math.min(window.innerHeight - peek.offsetHeight - 8, r.top + r.height / 2 - peek.offsetHeight / 2)) + 'px';
    }
    function hidePeek() { peekCancel(); peekL = null; peek.hidden = true; }
    // (only a mouse resting on a preview shows the bigger look: never a
    // finger or the Pencil, nor anything pressed, swiped or dragged, which
    // is picking layers or moving them)
    var peekT = 0, peekAt = null;
    function peekCancel() { clearTimeout(peekT); peekAt = null; }
    panel.addEventListener('pointermove', function (e) {
      var busyRow = e.buttons || swipe || (swallow && performance.now() - swallow.t < 400);
      if (e.pointerType !== 'mouse' || busyRow) { if (peekL || peekAt) hidePeek(); return; }
      var t = e.target.closest('[data-thumb]');
      if (!t) { if (peekL || peekAt) hidePeek(); return; }
      if (peekAt === t || (peekL && peekL === layers[+t.dataset.thumb])) return;
      peekCancel(); peekAt = t;
      peekT = setTimeout(function () { if (peekAt === t && document.contains(t) && !swipe) { peekAt = null; showPeek(t); } }, peekL ? 0 : 280);
    });
    panel.addEventListener('pointerdown', hidePeek);
    panel.addEventListener('pointerleave', hidePeek);
    function layerPanel(open) {
      if (!open) hidePeek(); else thumbsSoon();
      panel.hidden = !open;
      $('[data-act="layers"]').setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) besideBar(panel, $('[data-act="layers"]'));
      $('[data-act="layers"]').setAttribute('aria-pressed', open ? 'true' : 'false');
    }
    // renaming: tap the picked layer's name again (or double-click any name)
    function rename(i) {
      var btn = panel.querySelector('[data-layer="' + i + '"]'); if (!btn) return;
      var L = layers[i], inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'pl-input'; inp.value = L.name; inp.maxLength = 24; inp.setAttribute('aria-label', 'Layer name');
      btn.replaceWith(inp); inp.focus({ preventScroll: true }); inp.select();
      var done = false;
      function finish(keep) {
        if (done) return; done = true;
        if (keep && inp.value.trim()) L.name = inp.value.trim();
        renderLayers(); layerPanel(true); autosave();
      }
      inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); });
      inp.addEventListener('blur', function () { finish(true); });
    }
    panel.addEventListener('dblclick', function (e) { var n = e.target.closest('[data-layer]'); if (n) rename(+n.dataset.layer); });
    // EACH LAYER'S OPTIONS: the ••• button on its row (or right-click the
    // row, or press and hold it) opens a list of everything that can be done
    // with it
    var lmenu = document.createElement('div');
    lmenu.className = 'paint-lmenu'; lmenu.hidden = true; lmenu.setAttribute('role', 'menu');
    document.body.appendChild(lmenu);
    document.addEventListener('pageswap:start', function gone() { document.removeEventListener('pageswap:start', gone); lmenu.remove(); });
    // (above: from a button, where the menu goes if there's no room under it,
    // so it never covers the button that opened it)
    function layerMenu(i, x, y, fromRight, above) {
      var L = layers[i]; if (!L) return;
      var n = layers.length, item = function (k, label, opt) {
        opt = opt || {};
        return '<button type="button" role="' + (opt.check != null ? 'menuitemcheckbox' : 'menuitem') + '" data-lm="' + k + '"' + (opt.check != null ? ' aria-checked="' + opt.check + '"' : '') + (opt.off ? ' disabled' : '') + (opt.danger ? ' class="lm-danger"' : '') + '>' + label + '</button>';
      };
      var lowest = layers[0] && layers[0].bg ? 1 : 0, P = picks();
      if (multi() && P.indexOf(L) >= 0) {
        lmenu.innerHTML = '<div class="lm-note">' + P.length + ' layers picked</div>' +
          item('m-hide', P.some(function (M) { return M.visible; }) ? 'Hide' : 'Show') + item('m-lock', 'Alpha Lock', { check: P.every(function (M) { return M.alphaLock; }) }) +
          '<hr>' + item('m-duplicate', 'Duplicate', { off: n + P.length > maxLayers() }) + item('m-group', 'Group') + item('m-merge', 'Merge Layers') +
          '<hr>' + item('rename', 'Rename', { off: true }) + item('merge', 'Merge Down', { off: true }) + item('addmask', 'Add Mask', { off: true }) + item('clip', 'Clipping Mask', { off: true }) + item('up', 'Move Up', { off: true }) + item('down', 'Move Down', { off: true }) +
          '<hr>' + item('m-deselect', 'Pick Just This One') + item('m-delete', 'Delete ' + P.length + ' Layers', { danger: true });
        lmenu.dataset.i = i; lmenu.dataset.g = ''; lmenu.hidden = false;
        var left0 = fromRight ? x - lmenu.offsetWidth : x;
        if (above != null && y + lmenu.offsetHeight > window.innerHeight - 8 && above - lmenu.offsetHeight >= 8) y = above - lmenu.offsetHeight;
        lmenu.style.left = Math.max(8, Math.min(left0, document.documentElement.clientWidth - lmenu.offsetWidth - 8)) + 'px';
        lmenu.style.top = Math.max(8, Math.min(y, window.innerHeight - lmenu.offsetHeight - 8)) + 'px';
        return;
      }
      lmenu.innerHTML =
        (L.text ? item('edittext', 'Edit Text') + item('raster', 'Turn into Image') + '<hr>' : '') +
        item('select', 'Select') + item('rename', 'Rename') + item('duplicate', 'Duplicate', { off: n >= maxLayers() }) +
        item('merge', 'Merge Down', { off: i === 0 || !L.visible || layers[i - 1].group !== L.group }) + (L.group ? item('leavegroup', 'Remove from Group') : '') +
        '<hr>' + (L.mask ? (L.editMask ? item('editlayer', 'Paint on the Layer') : item('editmask', 'Paint on the Mask')) + item('invertmask', 'Invert Mask') + item('applymask', 'Apply Mask') + item('deletemask', 'Delete Mask', { danger: true }) : item('addmask', sel ? 'Add Mask from Selection' : 'Add Mask')) +
        '<hr>' + item('lock', 'Alpha Lock', { check: L.alphaLock }) + item('clip', 'Clipping Mask', { check: L.clip, off: i === 0 }) +
        '<hr>' + item('hide', L.visible ? 'Hide' : 'Show') + item('up', 'Move Up', { off: i === n - 1 }) + item('down', 'Move Down', { off: i < 1 }) +
        '<hr>' + item('delete', 'Delete', { danger: true });
      lmenu.dataset.i = i; lmenu.dataset.g = ''; lmenu.hidden = false;
      var left = fromRight ? x - lmenu.offsetWidth : x;
      if (above != null && y + lmenu.offsetHeight > window.innerHeight - 8 && above - lmenu.offsetHeight >= 8) y = above - lmenu.offsetHeight;
      lmenu.style.left = Math.max(8, Math.min(left, document.documentElement.clientWidth - lmenu.offsetWidth - 8)) + 'px';
      lmenu.style.top = Math.max(8, Math.min(y, window.innerHeight - lmenu.offsetHeight - 8)) + 'px';
    }
    panel.addEventListener('contextmenu', function (e) {
      var row = e.target.closest('.pl-row'); if (!row) return;
      e.preventDefault(); layerMenu(+row.dataset.i, e.clientX, e.clientY);
    });
    var holdTimer = 0;
    panel.addEventListener('pointerdown', function (e) {
      var row = e.target.closest('.pl-row'); if (!row || e.pointerType === 'mouse' || e.target.closest('.pl-grip, .pl-more')) return;
      var x = e.clientX, y = e.clientY; clearTimeout(holdTimer);
      holdTimer = setTimeout(function () { held = true; layerMenu(+row.dataset.i, x, y); }, 550);
    });
    // (lifting the finger after a hold mustn't also pick or rename the layer)
    var held = false;
    panel.addEventListener('click', function (e) { if (held) { held = false; e.stopPropagation(); e.preventDefault(); } }, true);
    ['pointerup', 'pointercancel', 'pointermove'].forEach(function (t) { panel.addEventListener(t, function (e) { if (t !== 'pointermove' || e.pointerType !== 'mouse') clearTimeout(holdTimer); }); });
    // the ••• button: opens its layer's list (or shuts it again)
    panel.addEventListener('click', function (e) {
      var m = e.target.closest('[data-layer-more]'); if (!m) return;
      e.stopPropagation();
      var i = +m.dataset.layerMore;
      if (!lmenu.hidden && +lmenu.dataset.i === i) { lmenu.hidden = true; return; }
      var r = m.getBoundingClientRect(); layerMenu(i, r.right, r.bottom + 4, true, r.top - 4);
    });
    lmenu.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lm]'); if (!b || b.disabled) return;
      lmenu.hidden = true;
      if (lmenu.dataset.g) { var G = groupOf(lmenu.dataset.g); if (G) groupOption(b.dataset.lm, G); return; }
      var L = layers[+lmenu.dataset.i];
      if (L) layerOption(b.dataset.lm, L);
    });
    var focusG = null, maskTold = false;
    function groupOf(id) { for (var i = 0; i < layers.length; i++) if (layers[i].group && layers[i].group.id === +id) return layers[i].group; return null; }
    function membersOf(G) { return layers.filter(function (L) { return L.group === G; }); }
    // (after layers move: one lands among a group's layers and joins it, or
    // is moved out of its group's run and leaves it; a group stays together)
    function fixGroups(moved) {
      moved.forEach(function (M) {
        var i = layers.indexOf(M), below = layers[i - 1], above = layers[i + 1];
        if (below && above && below.group && below.group === above.group) M.group = below.group;
        else if (M.group && !(below && below.group === M.group) && !(above && above.group === M.group)) M.group = membersOf(M.group).length > 1 ? null : M.group;
      });
    }
    function groupMenu(G, x, y, fromRight, above) {
      var item = function (k, label, opt) { opt = opt || {}; return '<button type="button" role="menuitem" data-lm="' + k + '"' + (opt.off ? ' disabled' : '') + (opt.danger ? ' class="lm-danger"' : '') + '>' + label + '</button>'; };
      var M = membersOf(G), lo = layers.indexOf(M[0]), hi = layers.indexOf(M[M.length - 1]), bottom = layers[0] && layers[0].bg ? 1 : 0;
      lmenu.innerHTML = item('g-rename', 'Rename') + item('g-merge', 'Merge Group') + item('g-ungroup', 'Ungroup') +
        '<hr>' + item('g-hide', G.visible ? 'Hide' : 'Show') + item('g-up', 'Move Up', { off: hi >= layers.length - 1 }) + item('g-down', 'Move Down', { off: lo <= bottom }) +
        '<hr>' + item('g-delete', 'Delete Group', { danger: true });
      lmenu.dataset.i = ''; lmenu.dataset.g = G.id; lmenu.hidden = false;
      var left = fromRight ? x - lmenu.offsetWidth : x;
      lmenu.style.left = Math.max(8, Math.min(left, document.documentElement.clientWidth - lmenu.offsetWidth - 8)) + 'px';
      if (above != null && y + lmenu.offsetHeight > window.innerHeight - 8 && above - lmenu.offsetHeight >= 8) y = above - lmenu.offsetHeight;
      lmenu.style.top = Math.max(8, Math.min(y, window.innerHeight - lmenu.offsetHeight - 8)) + 'px';
    }
    function groupOption(a, G) {
      if (adj) adjustDone(); if (textBox) commitText(); if (sel) commitSelection();
      var M = membersOf(G); if (!M.length) return;
      var lo = layers.indexOf(M[0]), hi = layers.indexOf(M[M.length - 1]);
      if (a === 'g-rename') { renameGroup(G); return; }
      if (a === 'g-hide') { rememberLayers(G.visible ? 'Hide Group' : 'Show Group'); G.visible = !G.visible; }
      else if (a === 'g-ungroup') { rememberLayers('Ungroup'); M.forEach(function (L) { L.group = null; }); if (focusG === G) focusG = null; }
      else if (a === 'g-delete') { rememberLayers('Delete Group'); layers.splice(lo, M.length); if (M.indexOf(active) >= 0) active = layers[Math.max(0, lo - 1)] || null; if (focusG === G) focusG = null; }
      else if (a === 'g-merge') {
        // (its layers laid together as they look, the group's fade and blend too, onto one layer)
        rememberLayers('Merge Group');
        var N = makeLayer(G.name, false), keep = G.visible; G.visible = true;
        var t = document.createElement('canvas'); t.width = ov.width; t.height = ov.height; var tx = t.getContext('2d');
        M.forEach(function (L) { if (!shownVisible(L)) return; tx.save(); tx.globalAlpha = L.opacity; if (L.blend !== 'normal') tx.globalCompositeOperation = L.blend; tx.drawImage(viewOf(L), 0, 0); tx.restore(); });
        G.visible = keep; N.ctx.save(); N.ctx.setTransform(1, 0, 0, 1, 0, 0); N.ctx.drawImage(t, 0, 0); N.ctx.restore();
        N.opacity = G.opacity; N.blend = G.blend; N.visible = G.visible;
        layers.splice(lo, M.length, N); active = N; if (focusG === G) focusG = null;
      }
      else if (a === 'g-up' || a === 'g-down') {
        // (the whole group moves past the layer, or the group, next to it)
        var nb = a === 'g-up' ? layers[hi + 1] : layers[lo - 1]; if (!nb) return;
        var span = nb.group ? membersOf(nb.group).length : 1;
        if (a === 'g-down' && layers[0].bg && lo - span < 1) return;
        rememberLayers(a === 'g-up' ? 'Move Group Up' : 'Move Group Down');
        layers.splice(lo, M.length);
        var at = a === 'g-up' ? lo + span : lo - span;
        Array.prototype.splice.apply(layers, [at, 0].concat(M));
      }
      mount(); layerPanel(true); autosave();
    }
    function renameGroup(G) {
      var btn = panel.querySelector('[data-gname="' + G.id + '"]'); if (!btn) return;
      var inp = document.createElement('input'), done = false;
      inp.type = 'text'; inp.className = 'pl-input'; inp.value = G.name; inp.maxLength = 24; inp.setAttribute('aria-label', 'Group name');
      btn.replaceWith(inp); inp.focus({ preventScroll: true }); inp.select();
      var finish = function (keep) { if (done) return; done = true; if (keep && inp.value.trim() && inp.value.trim() !== G.name) { rememberLayers('Rename Group'); G.name = inp.value.trim(); } renderLayers(); layerPanel(true); autosave(); };
      inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); });
      inp.addEventListener('blur', function () { finish(true); });
    }
    // MASKS, from the layer's ••• menu: add one (with a selection made, it
    // shows just what's inside it), paint on it, flip it, fix it into the
    // layer for good, or take it away
    function editMaskOf(L, on) {
      L.editMask = !!(on && L.mask); active = L; focusG = null;
      if (L.editMask && !maskTold) { maskTold = true; toast('Painting on the mask: black hides the layer, white shows it'); }
      renderLayers();
    }
    function maskOption(a, L) {
      if (a === 'addmask') {
        rememberLayers('Add Mask');
        L.mask = makeMask(L, sel ? '#000' : '#fff');
        if (sel) { var c = L.mask.ctx; c.save(); c.fillStyle = '#fff'; if (sel.mask) c.drawImage(tinted(sel.mask, '#fff'), sel.x, sel.y, sel.w, sel.h); else { selPath(c); c.fill(); } c.restore(); clearSel(); }
        maskAlpha(L); editMaskOf(L, true);
      } else if (a === 'invertmask') {
        push({ L: L.mask.P, data: snapOf(L.mask.P), label: 'Invert Mask' });
        var c2 = L.mask.ctx, img = c2.getImageData(0, 0, L.mask.cv.width, L.mask.cv.height), d = img.data;
        for (var i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
        c2.save(); c2.setTransform(1, 0, 0, 1, 0, 0); c2.putImageData(img, 0, 0); c2.restore(); maskAlpha(L);
      } else if (a === 'applymask') {
        push({ parts: [{ L: L, data: snapOf(L), bg: L.bg, text: L.text, name: L.name }, { list: layers.slice(), active: active, props: props() }], label: 'Apply Mask' });
        var c3 = L.ctx; c3.save(); c3.setTransform(1, 0, 0, 1, 0, 0); c3.globalCompositeOperation = 'destination-in'; c3.drawImage(L.mask.a, 0, 0); c3.restore();
        L.mask = null; L.editMask = false; L.text = null; L.bg = false;
      } else if (a === 'deletemask') { rememberLayers('Delete Mask'); L.mask = null; L.editMask = false; }
      else if (a === 'editmask') { editMaskOf(L, true); return; }
      else if (a === 'editlayer') { editMaskOf(L, false); return; }
      mount(); layerPanel(true); autosave();
    }
    function layerOption(a, L) {
      if (a === 'm-deselect') { if (sel) commitSelection(); active = L; also = []; renderLayers(); layerPanel(true); if (st.tool === 'move') movePick(); return; }
      if (/^m-/.test(a)) { multiOption(a); return; }
      if (/mask$|^editlayer$/.test(a)) { if (adj) adjustDone(); if (textBox) commitText(); maskOption(a, L); return; }
      if (a === 'select') { layerPanel(false); selectLayer(L); return; }
      if (a === 'edittext' && L.text) { layerPanel(false); if (st.tool !== 'text') setTool('text'); editText(L); return; }
      if (adj) adjustDone(); if (textBox) commitText(); if (sel) commitSelection();
      var i = layers.indexOf(L);
      if (L !== active) { active = L; renderLayers(); }
      if (a === 'rename') { layerPanel(true); rename(i); return; }
      if (a === 'up' || a === 'down' || a === 'delete') { layerAct(a); return; }
      if (a === 'raster') { if (L.text) { push({ L: L, data: snapOf(L), bg: L.bg, text: L.text, label: 'Turn into Image' }); L.text = null; } }
      else if (a === 'leavegroup') {
        // (out of the group: it goes just above or below the group's run)
        rememberLayers('Remove from Group');
        var GM = membersOf(L.group), top = layers.indexOf(GM[GM.length - 1]);
        layers.splice(i, 1); layers.splice(top, 0, L); L.group = null;
      }
      else if (a === 'hide') { L.visible = !L.visible; }
      else if (a === 'lock') { rememberLayers(L.alphaLock ? 'Alpha Lock Off' : 'Alpha Lock'); L.alphaLock = !L.alphaLock; }
      else if (a === 'clip') { rememberLayers(L.clip ? 'Release Clipping Mask' : 'Clipping Mask'); L.clip = !L.clip; }
      else if (a === 'duplicate') {
        if (!roomFor()) return;
        rememberLayers('Duplicate Layer');
        var D = dupOf(L);
        layers.splice(i + 1, 0, D); active = D;
      } else if (a === 'merge') {
        // (it's laid onto the one below as it looks: its opacity, blend mode
        // and clipping; one undo puts both back)
        var B = layers[i - 1]; if (!B || !L.visible) return;
        // (the words of a text layer become paint, and so does a text layer below)
        push({ parts: [{ L: B, data: snapOf(B), bg: B.bg, text: B.text }, { list: layers.slice(), active: active, props: props() }], label: 'Merge Down' });
        B.text = null;
        var src = viewOf(L), c = B.ctx;
        // (a mask on the layer below is fixed into it first, so it looks the same)
        if (B.mask) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-in'; c.drawImage(B.mask.a, 0, 0); c.restore(); B.mask = null; B.editMask = false; }
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = L.opacity; if (L.blend !== 'normal') c.globalCompositeOperation = L.blend;
        c.drawImage(src, 0, 0); c.restore();
        layers.splice(i, 1); active = B;
      }
      mount(); layerPanel(true); autosave();
    }
    document.addEventListener('pointerdown', function (e) { if (!lmenu.hidden && !e.target.closest('.paint-lmenu, [data-layer-more]')) lmenu.hidden = true; }, true);
    function selectLayer(L) {
      if (adj) adjustDone(); if (textBox) commitText(); commitSelection();
      active = L; renderLayers();
      // (the Select tool comes up, so a drag moves it rather than painting;
      // for words, Move, so they stay words)
      if (L.text) { setTool('move'); return; }
      if (!selTool(st.tool)) setTool(selKind);
      layerSel(L);
    }
    function layerSel(L) {
      var w = L.cv.width, h = L.cv.height, d = L.ctx.getImageData(0, 0, w, h).data, minX = w, minY = h, maxX = -1, maxY = -1, on = new Uint8Array(w * h);
      for (var y = 0, k = 0; y < h; y++) for (var x = 0; x < w; x++, k++) {
        var j = k * 4;
        if (L.bg ? 765 - d[j] - d[j + 1] - d[j + 2] > 36 : d[j + 3] > 0) { on[k] = 1; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      if (maxX < 0) return; // (nothing on it)
      var mw = maxX - minX + 1, mh = maxY - minY + 1, m = document.createElement('canvas'); m.width = mw; m.height = mh;
      var mx = m.getContext('2d'), md = mx.createImageData(mw, mh);
      for (var yy = 0; yy < mh; yy++) for (var xx = 0; xx < mw; xx++) if (on[(yy + minY) * w + xx + minX]) md.data[(yy * mw + xx) * 4 + 3] = 255;
      mx.putImageData(md, 0, 0);
      sel = { x: minX / R, y: minY / R, w: mw / R, h: mh / R, float: null, mask: m, maskData: md.data, whole: true };
      selbar.hidden = false; drawSel();
    }
    // (picking more layers, or letting one go: Ls are the layers of a row,
    // one, or a group's; all picked already, and they're let go)
    function pickToggle(Ls) {
      if (adj) adjustDone(); if (textBox) commitText(); if (sel) commitSelection();
      tidyAlso(); focusG = null;
      var P = picks(), off = Ls.every(function (L) { return P.indexOf(L) >= 0; });
      if (off) {
        also = also.filter(function (L) { return Ls.indexOf(L) < 0; });
        // (the current layer let go: the top one still picked takes its place)
        if (Ls.indexOf(active) >= 0) { if (!also.length) { renderLayers(); return; } also = layers.filter(function (L) { return also.indexOf(L) >= 0; }); active = also.pop(); }
      } else {
        if (!active) active = Ls[Ls.length - 1];
        Ls.forEach(function (L) { if (L !== active && also.indexOf(L) < 0) also.push(L); });
        if (Ls.length === 1 && Ls[0].editMask) Ls[0].editMask = false;
      }
      renderLayers(); layerPanel(true);
      if (st.tool === 'move') movePick();
    }
    function pickRun(L) {
      if (!active) { pickToggle([L]); return; }
      var a = layers.indexOf(active), b = layers.indexOf(L), lo = Math.min(a, b), hi = Math.max(a, b), run = [];
      for (var k = lo; k <= hi; k++) if (layers[k] !== active) run.push(layers[k]);
      if (sel) commitSelection(); focusG = null;
      run.forEach(function (M) { if (also.indexOf(M) < 0) also.push(M); });
      renderLayers(); layerPanel(true); if (st.tool === 'move') movePick();
    }
    // (a click with Shift or Ctrl/⌘ held picks rather than switches)
    function pickKeys(e, L) {
      if (e.shiftKey) { pickRun(L); return true; }
      if (e.metaKey || e.ctrlKey) { pickToggle([L]); return true; }
      return false;
    }
    // (keys: Shift or Ctrl/⌘ with Return or Space on a layer's name, as a click)
    panel.addEventListener('keydown', function (e) {
      if (!(e.key === 'Enter' || e.key === ' ') || !(e.shiftKey || e.metaKey || e.ctrlKey)) return;
      var n = e.target.closest('[data-layer]'); if (!n) return;
      e.preventDefault(); e.stopPropagation(); pickKeys(e, layers[+n.dataset.layer]);
    });
    // THE SWIPE: a row slides right under the finger (or Pencil, or mouse);
    // let go past the line and its layer is picked, or let go. A drag up or
    // down is left alone, for the list to scroll; the grip still reorders
    var swipe = null, swallow = null;
    panel.addEventListener('pointerdown', function (e) {
      swallow = null;
      var row = e.target.closest('.pl-row'); if (!row || e.button || e.target.closest('.pl-grip, .pl-more, input, select')) return;
      swipe = { row: row, id: e.pointerId, x: e.clientX, y: e.clientY, on: false };
    });
    panel.addEventListener('pointermove', function (e) {
      var w = swipe; if (!w || e.pointerId !== w.id) return;
      var dx = e.clientX - w.x, dy = e.clientY - w.y;
      if (!w.on) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }
        if (dx < 12 || dx < Math.abs(dy) * 1.5) return;
        w.on = true; clearTimeout(holdTimer); hidePeek(); w.row.classList.add('swiping'); try { w.row.setPointerCapture(e.pointerId); } catch (x) {}
      }
      var t = Math.max(0, dx < 56 ? dx : 56 + (dx - 56) * 0.2);
      w.row.style.transform = 'translateX(' + t + 'px)'; w.row.classList.toggle('will', dx >= 44);
    });
    function swipeEnd(e) {
      var w = swipe; if (!w || e.pointerId !== w.id) return;
      swipe = null; if (!w.on) return;
      swallow = { row: w.row, t: performance.now() };
      var go = w.row.classList.contains('will') && e.type === 'pointerup';
      w.row.classList.remove('swiping', 'will'); w.row.style.transform = '';
      if (!go) return;
      var Ls = w.row.dataset.gid ? membersOf(groupOf(w.row.dataset.gid)) : [layers[+w.row.dataset.i]];
      if (Ls.length && Ls[0]) setTimeout(function () { pickToggle(Ls); }, 120); // (after the row has slid back)
    }
    panel.addEventListener('pointerup', swipeEnd); panel.addEventListener('pointercancel', swipeEnd);
    // (the click at the end of a swipe isn't a tap on the row)
    panel.addEventListener('click', function (e) {
      var w = swallow; swallow = null;
      if (w && performance.now() - w.t < 450 && e.target.closest('.pl-row') === w.row) { e.stopPropagation(); e.preventDefault(); }
    }, true);
    // A FEW LAYERS AT ONCE, from the ••• menu of any of them (or the panel's
    // own Group and Delete buttons)
    function dupOf(L) {
      var D = makeLayer(L.name + ' copy', false);
      D.ctx.save(); D.ctx.setTransform(1, 0, 0, 1, 0, 0); D.ctx.drawImage(L.cv, 0, 0); D.ctx.restore();
      D.visible = L.visible; D.opacity = L.opacity; D.blend = L.blend; D.alphaLock = L.alphaLock; D.clip = L.clip; D.text = L.text; D.group = L.group;
      if (L.mask) { D.mask = makeMask(D); D.mask.ctx.save(); D.mask.ctx.setTransform(1, 0, 0, 1, 0, 0); D.mask.ctx.drawImage(L.mask.cv, 0, 0); D.mask.ctx.restore(); maskAlpha(D); }
      return D;
    }
    function multiOption(a) {
      if (adj) adjustDone(); if (textBox) commitText(); if (sel) commitSelection();
      var P = picks(); if (!P.length) return;
      if (a === 'm-deselect') { also = []; renderLayers(); layerPanel(true); if (st.tool === 'move') movePick(); return; }
      if (a === 'm-hide') { var show = !P.some(function (L) { return L.visible; }); rememberLayers(show ? 'Show Layers' : 'Hide Layers'); P.forEach(function (L) { L.visible = show; }); }
      else if (a === 'm-lock') { var on = !P.every(function (L) { return L.alphaLock; }); rememberLayers(on ? 'Alpha Lock' : 'Alpha Lock Off'); P.forEach(function (L) { L.alphaLock = on; }); }
      else if (a === 'm-delete') {
        rememberLayers('Delete Layers');
        var lo = layers.indexOf(P[0]); layers = layers.filter(function (L) { return P.indexOf(L) < 0; });
        active = layers[Math.max(0, Math.min(layers.length - 1, lo - 1))] || null; also = []; if (!layers.length) count = 0;
      } else if (a === 'm-duplicate') {
        if (!roomFor(P.length)) return;
        rememberLayers('Duplicate Layers');
        // (each copy just above its layer; the copies are what's picked after)
        var made = P.map(function (L) { var D = dupOf(L); layers.splice(layers.indexOf(L) + 1, 0, D); return [L, D]; });
        made.forEach(function (c) { if (c[0] === active) active = c[1]; });
        also = made.map(function (c) { return c[1]; }).filter(function (D) { return D !== active; });
      } else if (a === 'm-group') {
        // (gathered together, in the order they were, where the top one was;
        // never in the middle of another group; the white Background stays put)
        var Q = P.filter(function (L) { return !(L.bg && layers.indexOf(L) === 0); }); if (!Q.length) return;
        rememberLayers('Group Layers');
        var G = makeGroup(), top = layers.indexOf(Q[Q.length - 1]), below = null;
        for (var k = top - 1; k >= 0; k--) if (Q.indexOf(layers[k]) < 0) { below = layers[k]; break; }
        var rest = layers.filter(function (L) { return Q.indexOf(L) < 0; }), at = below ? rest.indexOf(below) + 1 : 0;
        while (at > 0 && at < rest.length && rest[at - 1].group && rest[at - 1].group === rest[at].group) at++;
        Array.prototype.splice.apply(rest, [at, 0].concat(Q)); layers = rest; Q.forEach(function (L) { L.group = G; }); focusG = null;
      } else if (a === 'm-merge') {
        // (onto the lowest of them, as they look, in order; hidden ones are left as they are)
        var V = P.filter(function (L) { return L.visible; }); if (V.length < 2) { toast('Pick two or more layers that are showing to merge them'); return; }
        var B = V[0];
        push({ parts: [{ L: B, data: snapOf(B), bg: B.bg, text: B.text }, { list: layers.slice(), active: active, props: props() }], label: 'Merge Layers' });
        B.text = null; var c = B.ctx;
        if (B.mask) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-in'; c.drawImage(B.mask.a, 0, 0); c.restore(); B.mask = null; B.editMask = false; }
        V.slice(1).forEach(function (L) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = L.opacity; if (L.blend !== 'normal') c.globalCompositeOperation = L.blend; c.drawImage(viewOf(L), 0, 0); c.restore(); });
        layers = layers.filter(function (L) { return V.indexOf(L) < 1; }); active = B; also = [];
      }
      mount(); layerPanel(true); autosave();
    }
    // reordering: drag a layer by its grip (or by its row, see below)
    panel.addEventListener('pointerdown', function (e) {
      var g = e.target.closest('.pl-grip'); if (!g) return;
      e.preventDefault(); e.stopPropagation();
      reorder(g.closest('.pl-row'), g, e.pointerId, e.clientY);
    });
    // THE BACKGROUND is the white paper and stays at the bottom; but it's
    // where a picture starts, so it's often drawn on. Moving it (or moving
    // a layer under it) moves its drawing instead: lifted off as a layer of
    // its own, its white made see-through (a stroke laid over white comes
    // back as itself, soft edges and all), the paper staying where it was
    function bgBlank(B) {
      var p = snapOf(B).data;
      for (var k = 0; k < p.length; k += 4) if (p[k + 3] && (p[k] < 255 || p[k + 1] < 255 || p[k + 2] < 255)) return false;
      return true;
    }
    function bgLift(B, label) {
      if (bgBlank(B)) { toast('The Background is blank paper, so it stays at the bottom'); return null; }
      if (sel) commitSelection();
      push({ parts: [{ L: B, data: snapOf(B), bg: true, text: B.text, name: B.name }, { list: layers.slice(), active: active, props: props() }], label: label });
      var d = snapOf(B), p = d.data;
      for (var k = 0; k < p.length; k += 4) {
        var m = Math.max(255 - p[k], 255 - p[k + 1], 255 - p[k + 2]), a0 = p[k + 3];
        if (!m || !a0) { p[k + 3] = 0; continue; }
        var a = m / 255;
        p[k] = Math.round(255 - (255 - p[k]) / a); p[k + 1] = Math.round(255 - (255 - p[k + 1]) / a); p[k + 2] = Math.round(255 - (255 - p[k + 2]) / a);
        p[k + 3] = Math.round(m * a0 / 255);
      }
      var D = makeLayer('Layer ' + (++count), false);
      D.ctx.save(); D.ctx.setTransform(1, 0, 0, 1, 0, 0); D.ctx.putImageData(d, 0, 0); D.ctx.restore();
      D.visible = B.visible; D.opacity = B.opacity; D.blend = B.blend; D.group = B.group;
      B.ctx.save(); B.ctx.setTransform(1, 0, 0, 1, 0, 0); B.ctx.fillStyle = '#fff'; B.ctx.fillRect(0, 0, B.cv.width, B.cv.height); B.ctx.restore();
      B.text = null; B.opacity = 1; B.blend = 'normal'; B.group = null;
      if (active === B) active = D;
      toast('Your drawing on the Background is now ' + D.name + ', so it can move; the white paper stays at the bottom');
      return D;
    }
    function reorder(row, g, id, y0, ev0) {
      var list = row.parentNode;
      try { g.setPointerCapture(id); } catch (x) {}
      row.classList.remove('lifted'); row.classList.add('dragging');
      // (the row takes every place the pointer has passed, however far it
      // went since the last move, and never goes under the white Background)
      var gap = parseFloat(getComputedStyle(list).rowGap) || 0;
      var paper = layers[0] && layers[0].bg && bgBlank(layers[0]); // (blank paper: nothing to lift, so nothing goes under it)
      var isBg = function (r) { return paper && r && r.dataset.i != null && layers[+r.dataset.i] && layers[+r.dataset.i].bg; };
      function mv(ev) {
        if (ev.pointerId !== id) return;
        // (a step is a row and the gap after it; the row changes places a
        // little past half a step, and a change moves it a whole step, so a
        // shaky hand on the line doesn't flick it back and forth)
        for (;;) {
          var dy = ev.clientY - y0, prev = row.previousElementSibling, next = row.nextElementSibling;
          var sn = next ? next.offsetHeight + gap : 0, sp = prev ? prev.offsetHeight + gap : 0;
          if (next && !isBg(next) && dy > sn / 2 + 3) { list.insertBefore(next, row); y0 += sn; }
          else if (prev && dy < -sp / 2 - 3) { list.insertBefore(row, prev); y0 -= sp; }
          else break;
        }
        row.style.transform = 'translateY(' + (ev.clientY - y0) + 'px)';
      }
      function up(ev) {
        if (ev.pointerId !== id) return;
        window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true);
        reorderDone = performance.now();
        row.classList.remove('dragging'); row.style.transform = '';
        // the list shows the top layer first (a folded group's row stands for
        // all its layers)
        var M = layers[+row.dataset.i], order = [];
        Array.prototype.forEach.call(list.children, function (r) {
          if (r.dataset.gid) { var G = groupOf(r.dataset.gid); if (G && !G.open) order = order.concat(membersOf(G).reverse()); }
          else if (r.dataset.i != null) order.push(layers[+r.dataset.i]);
        });
        order.reverse();
        // (where it was dropped decides its group: just under a group's open
        // title, or between two of its layers, it joins; anywhere else, it's on its own)
        var pr = row.previousElementSibling, nx = row.nextElementSibling, inG = function (r) { return r && r.dataset.i != null && layers[+r.dataset.i].group; };
        var Gt = pr && pr.dataset.gid ? (groupOf(pr.dataset.gid) && groupOf(pr.dataset.gid).open ? groupOf(pr.dataset.gid) : null) : inG(pr) && inG(pr) === inG(nx) ? inG(pr) : null;
        // (the white Background always stays at the bottom)
        // (the Background left the bottom: its drawing goes where it was put,
        // its paper stays; blank paper just stays)
        var b0 = layers[0], D = b0.bg && order[0] !== b0 && order.length === layers.length ? bgLift(b0, 'Reorder Layers') : null;
        if (b0.bg && order[0] !== b0) { var at = order.indexOf(b0); if (D) order[at] = D; else order.splice(at, 1); order.unshift(b0); }
        if (D) { if (M === b0) M = D; layers = order; M.group = Gt; mount(); }
        else if (order.length === layers.length && (order.some(function (L, i) { return L !== layers[i]; }) || M.group !== Gt)) { if (sel) commitSelection(); rememberLayers('Reorder Layers'); layers = order; M.group = Gt; mount(); }
        else renderLayers();
        layerPanel(true);
      }
      // (followed on the whole window: moving the row in the list, or the
      // pointer leaving it, mustn't lose the drag)
      window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
      if (ev0) mv(ev0); // (the move that started it counts too)
    }
    // ...or by the row itself: with a mouse, a drag up or down (the wheel
    // scrolls the list); with a finger or the Pencil, a moment's hold lifts
    // the row and then it follows (a quick drag still scrolls, a swipe right
    // still picks, and a longer still hold still opens the layer's menu)
    var rowLift = null;
    panel.addEventListener('pointerdown', function (e) {
      var row = e.target.closest('.pl-row[data-i]'); rowLift = null;
      if (!row || e.button || e.target.closest('.pl-grip, .pl-more, .pl-eye, input, select')) return;
      rowLift = { row: row, id: e.pointerId, x: e.clientX, y: e.clientY, mouse: e.pointerType === 'mouse', up: false, t: 0 };
      if (!rowLift.mouse) { var L = rowLift; L.t = setTimeout(function () { if (rowLift === L) { L.up = true; row.classList.add('lifted'); } }, 280); }
    });
    panel.addEventListener('pointermove', function (e) {
      var L = rowLift; if (!L || e.pointerId !== L.id) return;
      if (!lmenu.hidden) { clearTimeout(L.t); L.row.classList.remove('lifted'); rowLift = null; return; } // (the hold opened its menu)
      var dx = e.clientX - L.x, dy = e.clientY - L.y, far = Math.hypot(dx, dy);
      if (L.mouse ? far > 6 && Math.abs(dy) > Math.abs(dx) : L.up && far > 4) {
        rowLift = null; clearTimeout(L.t); clearTimeout(holdTimer); swipe = null; hidePeek();
        reorder(L.row, L.row, L.id, L.y, e);
      } else if (!L.up && (L.mouse ? Math.abs(dx) > 6 : far > 8)) { rowLift = null; clearTimeout(L.t); }
    });
    ['pointerup', 'pointercancel'].forEach(function (t) { panel.addEventListener(t, function () { if (rowLift) { clearTimeout(rowLift.t); rowLift.row.classList.remove('lifted'); rowLift = null; } }); });
    // (once lifted, a finger's drag moves the row rather than scrolling the list)
    panel.addEventListener('touchmove', function (e) { if ((rowLift && rowLift.up) || panel.querySelector('.pl-row.dragging')) e.preventDefault(); }, { passive: false });
    // (the click at the end of a drag isn't a tap on the row, or a rename)
    var reorderDone = 0;
    panel.addEventListener('click', function (e) { if (performance.now() - reorderDone < 400 && e.target.closest('.pl-row')) { e.stopPropagation(); e.preventDefault(); } }, true);
    function layerAct(a) {
      if (multi() && (a === 'group' || a === 'delete')) { multiOption('m-' + a); return; }
      if (sel) commitSelection();
      var i = layers.indexOf(active);
      if (a === 'add') {
        if (!roomFor()) return;
        rememberLayers('New Layer');
        var L = makeLayer('Layer ' + (++count), false); layers.splice(i + 1, 0, L); L.group = active ? active.group : null; active = L;
      } else if (a === 'group') {
        if (!active || active.group) return;
        rememberLayers('New Group'); active.group = makeGroup(); focusG = null;
      } else if (a === 'delete') {
        // any layer can go, the Background and the last one too (then the
        // picture is see-through, and new layers count from 1 again)
        if (!active) return;
        rememberLayers('Delete Layer');
        layers.splice(i, 1);
        active = layers[Math.max(0, i - 1)] || null;
        if (!layers.length) count = 0;
      } else if (a === 'up' && active && i < layers.length - 1 && active.bg && i === 0) {
        // (the Background's drawing goes up past the layer above; its paper stays)
        var D = bgLift(active, 'Move Layer Up'); if (!D) return;
        layers.splice(2, 0, D);
      } else if (a === 'up' && active && i < layers.length - 1 && !active.bg) {
        rememberLayers('Move Layer Up'); layers.splice(i, 1); layers.splice(i + 1, 0, active); fixGroups([active]);
      } else if (a === 'down' && active && i === 1 && layers[0].bg) {
        // (under the Background: under its drawing, which is lifted off the paper)
        var B = layers[0], X = active, D2 = bgLift(B, 'Move Layer Down'); if (!D2) return;
        layers.splice(1, 0, D2); active = X; // ([paper, drawing, X] -> [paper, X, drawing])
        layers.splice(layers.indexOf(X), 1); layers.splice(1, 0, X); fixGroups([X]);
      } else if (a === 'down' && active && i > (layers[0].bg ? 1 : 0)) {
        rememberLayers('Move Layer Down'); layers.splice(i, 1); layers.splice(i - 1, 0, active); fixGroups([active]);
      } else return;
      mount(); layerPanel(true);
    }

    // ---- EFFECTS: everything that changes the look of the picked layer
    // (only inside the selection, if there is one), in sections that fold:
    // Light, Levels, Curves, Hue & Saturation, White Balance, Gradient Map,
    // Detail, Pixelate, Blur and Finish. It's shown live, and kept with DONE ----
    // (each slider: key, name, lowest; they all go up to 100, and start at 0)
    var FX = [
      ['light', 'Light', [['exposure', 'Exposure', -100], ['brilliance', 'Brilliance', -100], ['contrast', 'Contrast', -100], ['highlights', 'Highlights', -100], ['shadows', 'Shadows', -100], ['whites', 'Whites', -100], ['blacks', 'Blacks', -100]]],
      ['levels', 'Levels'],
      ['curves', 'Curves'],
      ['hsl', 'Hue & Saturation', [['hue', 'Hue', -100], ['saturation', 'Saturation', -100], ['vibrance', 'Vibrance', -100], ['lightness', 'Lightness', -100]]],
      ['wb', 'White Balance', [['warmth', 'Warmth', -100], ['tint', 'Tint', -100]]],
      ['gmap', 'Gradient Map'],
      ['detail', 'Detail', [['sharpen', 'Sharpen', 0], ['clarity', 'Clarity', -100], ['grain', 'Grain', 0]]],
      ['pixel', 'Pixelate', [['pixelate', 'Block Size', 0]]],
      ['blur', 'Blur'],
      ['finish', 'Finish', [['vignette', 'Vignette', -100], ['fade', 'Fade', 0]]]
    ];
    // (what each section holds, to tell when it's been changed, and to put it back)
    var FX_KEYS = { light: FX[0][2].map(function (a) { return a[0]; }), levels: ['lb', 'lg', 'lw', 'ob', 'ow'], curves: ['curve'], hsl: FX[3][2].map(function (a) { return a[0]; }),
      wb: ['warmth', 'tint'], gmap: ['gmap', 'gms', 'gmr'], detail: ['sharpen', 'clarity', 'grain'], pixel: ['pixelate'], blur: ['gblur', 'mblur', 'mangle'], finish: ['vignette', 'fade'] };
    // GRADIENT MAP: the picture's light and dark, recoloured along a gradient
    // (dark at the start, light at the end); "Your Colours" runs from the
    // second colour to the main one
    var GMAPS = [['colours', 'Your Colours'], ['noir', 'Noir', ['#000000', '#ffffff']], ['sepia', 'Sepia', ['#1b0f05', '#7a4a24', '#f3e1c0']],
      ['sunset', 'Sunset', ['#1a0b3d', '#a8327c', '#f98c4a', '#ffe9a8']], ['ocean', 'Ocean', ['#021428', '#0b5a9c', '#49b6e6', '#e6fbff']],
      ['duotone', 'Duotone', ['#2b1a6b', '#f7d64a']], ['magma', 'Magma', ['#000004', '#51127c', '#b73779', '#fc8961', '#fcfdbf']], ['mint', 'Mint', ['#0b2e2a', '#2f9e83', '#d9f7e8']]];
    function gmStops(id) { if (id === 'colours') return [st.color2, st.color]; var g = GMAPS.filter(function (x) { return x[0] === id; })[0]; return g ? g[2] : null; }
    var adjBox = document.createElement('div'), adj = null;
    adjBox.className = 'paint-adjust'; adjBox.hidden = true; adjBox.setAttribute('role', 'dialog'); adjBox.setAttribute('aria-label', 'Effects');
    var FX_CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10l4 4 4-4"/></svg>';
    // (the sliders whose tracks show what they do: fxTracks, below)
    var FX_TRACKS = { hue: 1, saturation: 1, vibrance: 1, lightness: 1, warmth: 1, tint: 1 };
    var sliderRow = function (a) {
      return '<label class="pa-row" data-adj-row="' + a[0] + '"><span>' + a[1] + '</span><output>' + (a[3] || 0) + '</output>' +
        '<input type="range" min="' + a[2] + '" max="' + (a[4] || 100) + '" step="1" value="' + (a[3] || 0) + '" data-adj="' + a[0] + '"' + (a[3] ? ' data-def="' + a[3] + '"' : '') + (FX_TRACKS[a[0]] ? ' class="fx-track"' : '') + '></label>';
    };
    // (motion blur's way: across, up and down, and the two diagonals, or any angle on the slider)
    var FX_DIRS = [[0, 'Across', '<path d="M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3"/>'], [90, 'Up and down', '<path d="M12 4v16M9 7l3-3 3 3M9 17l3 3 3-3"/>'], [45, 'Diagonal, rising', '<path d="M6 18L18 6M10 6h8v8"/>'], [135, 'Diagonal, falling', '<path d="M6 6l12 12M18 10v8h-8"/>']];
    var fxBody = {
      blur: '<div class="pa-list">' + sliderRow(['gblur', 'Gaussian', 0]) + sliderRow(['mblur', 'Motion', 0]) + sliderRow(['mangle', 'Angle', 0, 0, 180]) +
        '<div class="pa-tabs fx-dirs" role="group" aria-label="Motion direction">' + FX_DIRS.map(function (d) { return '<button type="button" data-fxdir="' + d[0] + '" aria-label="' + d[1] + '" aria-pressed="false" data-tip="Motion: ' + d[1].toLowerCase() + ' (' + d[0] + '\u00b0)"><svg viewBox="0 0 24 24" aria-hidden="true">' + d[2] + '</svg></button>'; }).join('') + '</div></div>',
      levels: '<div class="pa-levels"><canvas class="lv-hist" width="256" height="100"></canvas>' +
        '<div class="lv-track" data-lv="in"><i data-k="lb" class="lv-b"></i><i data-k="lg" class="lv-g"></i><i data-k="lw" class="lv-w"></i></div>' +
        '<div class="lv-nums"><output data-o="lb">0</output><output data-o="lg">1.00</output><output data-o="lw">255</output></div>' +
        '<div class="lv-sub">Output</div><div class="lv-grad"></div>' +
        '<div class="lv-track" data-lv="out"><i data-k="ob" class="lv-b"></i><i data-k="ow" class="lv-w"></i></div>' +
        '<div class="lv-nums"><output data-o="ob">0</output><output data-o="ow">255</output></div></div>',
      curves: '<div class="pa-curves"><canvas class="cv-graph" aria-label="Curve"></canvas>' +
        '<div class="cv-help">Tap the line to add a point, drag to bend it. Double-tap a point, or drag it off, to remove it.</div></div>',
      gmap: '<div class="gm-list" role="radiogroup" aria-label="Gradient">' +
          '<button type="button" class="gm-chip gm-none" data-gm="" role="radio" aria-checked="true" data-tip="No gradient map"><i></i><span>None</span></button>' +
          GMAPS.map(function (g) { return '<button type="button" class="gm-chip" data-gm="' + g[0] + '" role="radio" aria-checked="false" data-tip="' + g[1] + '"><i></i><span>' + g[1] + '</span></button>'; }).join('') + '</div>' +
        sliderRow(['gms', 'Strength', 0, 100]) +
        '<button type="button" class="gm-rev" data-gmrev aria-pressed="false" data-tip="Run the gradient the other way: light to dark">Reverse</button>'
    };
    adjBox.innerHTML = pcTop + '<div class="pa-title">Effects <span class="pa-sub">Current layer</span></div><div class="fx-secs">' +
      FX.map(function (f) {
        var body = f[2] ? '<div class="pa-list">' + f[2].map(sliderRow).join('') + '</div>' : fxBody[f[0]];
        return '<section class="pr-sec fx-sec" data-fx="' + f[0] + '"><div class="fx-head">' +
          '<button type="button" class="pr-head" aria-expanded="true"><span>' + f[1] + '<i class="fx-dot" aria-hidden="true"></i></span>' + FX_CHEV + '</button>' +
          '<button type="button" class="fx-reset" data-fx-reset="' + f[0] + '" aria-label="Reset ' + f[1] + '" data-tip="Put ' + f[1] + ' back as it was"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M5 4.5v3.8h3.8"/></svg></button></div>' +
          '<div class="pr-body"><div class="pr-in">' + body + '</div></div></section>';
      }).join('') + '</div>' +
      '<div class="pa-acts"><button type="button" data-adj-act="reset">Reset All</button><button type="button" data-adj-act="done" data-tip="Apply it, and carry on with another effect (with nothing set: close)">Done</button></div>';
    left.appendChild(adjBox);
    // Start a fresh effect from the current drawing after a canvas gesture,
    // whether its next control is reached by pointer or keyboard.
    function resumeEffects(e) {
      if (!adj && !adjBox.hidden && !e.target.closest('.pc-top')) adjustOpen(true);
    }
    adjBox.addEventListener('pointerdown', resumeEffects);
    adjBox.addEventListener('focusin', resumeEffects);
    adjBox.addEventListener('click', function (e) {
      if (e.target.closest('.pc-top .ctx-lock')) { lockToggle(); return; }
      if (e.target.closest('.pc-top .ctx-min')) { adjustDone(); ctxMin(true); }
    });
    // (the sections fold by their titles, and stay as they were left; Light starts open)
    Array.prototype.forEach.call(adjBox.querySelectorAll('.fx-sec'), function (sec) {
      var hd = sec.querySelector('.pr-head'), k = 'paint-fx-' + sec.dataset.fx;
      var shut = function (on) { sec.classList.toggle('closed', on); hd.setAttribute('aria-expanded', on ? 'false' : 'true'); if (!on) fxShown(sec.dataset.fx); };
      var was = null; try { was = localStorage.getItem(k); } catch (x) {}
      shut(was ? was === 'closed' : sec.dataset.fx !== 'light');
      hd.addEventListener('click', function () { var on = !sec.classList.contains('closed'); shut(on); try { localStorage.setItem(k, on ? 'closed' : 'open'); } catch (x) {} });
    });
    Array.prototype.forEach.call(adjBox.querySelectorAll('.gm-chip[data-gm]'), function (b) { var st0 = gmStops(b.dataset.gm); if (st0) b.querySelector('i').style.background = 'linear-gradient(to right,' + st0.join(',') + ')'; });
    function fxShown(f) { if (!adj) return; if (f === 'levels') { drawHist(); syncLevels(); } else if (f === 'curves') drawCurve(); }
    // (a section that's been changed shows a dot, and its reset button)
    function fxOn(k) {
      var v = adj.v;
      if (k === 'curve') return !!v.curve;
      if (k === 'gmap') return !!v.gmap;
      if (k === 'gms' || k === 'gmr' || k === 'mangle') return false; // (a way, or an angle, alone changes nothing)
      if (k in LV) return v[k] != null && v[k] !== LV[k];
      return !!v[k];
    }
    // (hue: the colour turned round the colour wheel, keeping its brightness;
    // c and s are the turn's cosine and sine, and o takes the result)
    function hueTurn(r, g, b, c, s, o) {
      var yy = 0.299 * r + 0.587 * g + 0.114 * b, ii = 0.596 * r - 0.274 * g - 0.322 * b, qq = 0.211 * r - 0.523 * g + 0.312 * b;
      var i2 = ii * c - qq * s, q2 = ii * s + qq * c;
      o[0] = yy + 0.956 * i2 + 0.621 * q2; o[1] = yy - 0.272 * i2 - 0.647 * q2; o[2] = yy - 1.106 * i2 + 1.703 * q2;
    }
    // THE SLIDERS SHOW WHAT THEY DO: Hue's track is a red turned by the same
    // sums as the picture, all the way round; Saturation, Vibrance and
    // Lightness run grey, black or white into that colour as Hue has left
    // it; Warmth runs blue to amber, Tint green to magenta
    function fxTracks() {
      var get = function (k) { var i = adjBox.querySelector('[data-adj="' + k + '"]'); return i ? +i.value / 100 : 0; };
      var set = function (k, cs) { var i = adjBox.querySelector('[data-adj="' + k + '"]'); if (i) i.style.setProperty('--track', 'linear-gradient(to right, ' + cs.join(', ') + ')'); };
      var cl = function (v) { return Math.max(0, Math.min(255, Math.round(v))); };
      var css = function (c) { return 'rgb(' + c.map(cl).join(', ') + ')'; };
      var turn = function (t) { var o = [0, 0, 0]; hueTurn(232, 52, 44, Math.cos(t * Math.PI), Math.sin(t * Math.PI), o); return o.map(cl); };
      var round = []; for (var j = -6; j <= 6; j++) round.push(css(turn(j / 6)));
      var C = turn(get('hue')), y = 0.299 * C[0] + 0.587 * C[1] + 0.114 * C[2];
      var grey = [y, y, y], soft = C.map(function (v) { return y + (v - y) * 0.45; }), vivid = C.map(function (v) { return y + (v - y) * 1.5; });
      set('hue', round); set('saturation', [css(grey), css(C), css(vivid)]); set('vibrance', [css(soft), css(C), css(vivid)]);
      set('lightness', ['#000', css(C), '#fff']);
      set('warmth', ['rgb(72, 136, 236)', 'rgb(206, 206, 206)', 'rgb(244, 164, 56)']); set('tint', ['rgb(64, 176, 96)', 'rgb(206, 206, 206)', 'rgb(214, 86, 200)']);
    }
    // (tracks: the coloured slider tracks too, which only change with Hue)
    function fxMarks(tracks) {
      if (tracks) fxTracks();
      Array.prototype.forEach.call(adjBox.querySelectorAll('.fx-sec'), function (sec) { sec.classList.toggle('changed', !!adj && FX_KEYS[sec.dataset.fx].some(fxOn)); });
      var on = adj && adj.v.gmap || '';
      Array.prototype.forEach.call(adjBox.querySelectorAll('[data-gm]'), function (b) { b.setAttribute('aria-checked', b.dataset.gm === on ? 'true' : 'false'); });
      var rv = adjBox.querySelector('[data-gmrev]'); rv.setAttribute('aria-pressed', adj && adj.v.gmr ? 'true' : 'false');
      var ang = adj && adj.v.mangle || 0;
      Array.prototype.forEach.call(adjBox.querySelectorAll('[data-fxdir]'), function (b) { b.setAttribute('aria-pressed', +b.dataset.fxdir === ang ? 'true' : 'false'); });
      if (adj && adj.v.gmap === 'colours') adjBox.querySelector('[data-gm="colours"] i').style.background = 'linear-gradient(to right,' + gmStops('colours').join(',') + ')';
    }
    function fxReset(f) {
      if (!adj) return;
      FX_KEYS[f].forEach(function (k) { delete adj.v[k]; });
      Array.prototype.forEach.call(adjBox.querySelectorAll('.fx-sec[data-fx="' + f + '"] input[data-adj]'), function (i) { i.value = i.dataset.def || 0; i.previousElementSibling.textContent = i.value; });
      if (f === 'levels') syncLevels(); if (f === 'curves') drawCurve();
      adjustQueue(f === 'hsl');
    }
    // LEVELS: black, mid (gamma x 100) and white in, black and white out
    var LV = { lb: 0, lg: 100, lw: 255, ob: 0, ow: 255 };
    function lv(k) { return adj && adj.v[k] != null ? adj.v[k] : LV[k]; }
    function adjChanged() { return !!adj && Object.keys(adj.v).some(fxOn); }
    // CURVES: points (in 0-255) joined by a natural cubic spline; the tones
    // just stop at pure black and pure white. 256 values out of it.
    function curveLut(P0) {
      var P = P0.map(function (q) { return [q[0], q[1]]; }).sort(function (a, b) { return a[0] - b[0]; });
      for (var t = 1; t < P.length; t++) if (P[t][0] - P[t - 1][0] < 0.5) P[t][0] = P[t - 1][0] + 0.5; // (two at the same place: a hair apart)
      var n = P.length, out = new Float32Array(256), i, x;
      if (n < 3) {
        for (x = 0; x < 256; x++) { var u0 = (x - P[0][0]) / Math.max(0.5, P[1][0] - P[0][0]); out[x] = Math.max(0, Math.min(255, x <= P[0][0] ? P[0][1] : x >= P[1][0] ? P[1][1] : P[0][1] + (P[1][1] - P[0][1]) * u0)); }
        return out;
      }
      // second derivatives (natural ends), by the usual tridiagonal sweep
      var h = [], al = [], l = [1], mu = [0], z = [0], c = new Array(n).fill(0);
      for (i = 0; i < n - 1; i++) h[i] = P[i + 1][0] - P[i][0];
      for (i = 1; i < n - 1; i++) al[i] = 3 / h[i] * (P[i + 1][1] - P[i][1]) - 3 / h[i - 1] * (P[i][1] - P[i - 1][1]);
      for (i = 1; i < n - 1; i++) { l[i] = 2 * (P[i + 1][0] - P[i - 1][0]) - h[i - 1] * mu[i - 1]; mu[i] = h[i] / l[i]; z[i] = (al[i] - h[i - 1] * z[i - 1]) / l[i]; }
      var bb = [], dd = [];
      for (i = n - 2; i >= 0; i--) { c[i] = (i ? z[i] : 0) - (i ? mu[i] * c[i + 1] : 0); bb[i] = (P[i + 1][1] - P[i][1]) / h[i] - h[i] * (c[i + 1] + 2 * c[i]) / 3; dd[i] = (c[i + 1] - c[i]) / (3 * h[i]); }
      for (x = 0, i = 0; x < 256; x++) {
        var y;
        if (x <= P[0][0]) y = P[0][1];
        else if (x >= P[n - 1][0]) y = P[n - 1][1];
        else { while (i < n - 2 && x > P[i + 1][0]) i++; var dx = x - P[i][0]; y = P[i][1] + bb[i] * dx + c[i] * dx * dx + dd[i] * dx * dx * dx; }
        out[x] = Math.max(0, Math.min(255, y));
      }
      return out;
    }
    function curvePts() { return (adj && adj.v.curve) || [[0, 0], [255, 255]]; }
    // the layer's spread of tones (inside the selection, if there is one),
    // scaled so a few tall spikes don't flatten the rest
    // (worked out the first time Levels or Curves is shown, then kept)
    function adjHist() { if (!adj.hist) adj.hist = adjHistogram(); return adj.hist; }
    function adjHistogram() {
      var d = adj.src ? adj.src.data : adj.L.ctx.getImageData(0, 0, adj.L.cv.width, adj.L.cv.height).data;
      var m = adj.src ? adj.mask : adj.selOn && sel ? selPixels() : null, h = new Float32Array(256), i, step = 4 * Math.max(1, Math.ceil(d.length / 4 / 2e6));
      for (i = 0; i < d.length; i += step) { if (!d[i + 3] || (m && !m[i + 3])) continue; h[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++; }
      var top = Array.prototype.slice.call(h).sort(function (a, b) { return a - b; })[250] || 1;
      for (i = 0; i < 256; i++) h[i] = Math.min(1, h[i] / top);
      return h;
    }
    function midPos() { var lb = lv('lb'), lw = lv('lw'); return lb + (lw - lb) * Math.pow(0.5, lv('lg') / 100); }
    function syncLevels() {
      var put = function (k, v) { adjBox.querySelector('[data-k="' + k + '"]').style.left = v / 255 * 100 + '%'; };
      put('lb', lv('lb')); put('lw', lv('lw')); put('lg', midPos()); put('ob', lv('ob')); put('ow', lv('ow'));
      ['lb', 'lw', 'ob', 'ow'].forEach(function (k) { adjBox.querySelector('[data-o="' + k + '"]').textContent = lv(k); });
      adjBox.querySelector('[data-o="lg"]').textContent = (lv('lg') / 100).toFixed(2);
    }
    function drawHist() {
      var c = adjBox.querySelector('.lv-hist'), x = c.getContext('2d');
      x.clearRect(0, 0, 256, 100); if (!adj || adjBox.querySelector('.fx-sec[data-fx="levels"]').classList.contains('closed')) return;
      x.fillStyle = getComputedStyle(c).color;
      var hs = adjHist(); for (var i = 0; i < 256; i++) { var v = hs[i] * 100; x.fillRect(i, 100 - v, 1, v); }
    }
    adjBox.querySelector('.pa-levels').addEventListener('pointerdown', function (e) {
      var tr = e.target.closest('.lv-track'); if (!tr || !adj) return;
      e.preventDefault();
      var r = tr.getBoundingClientRect(), at = function (ev) { return Math.max(0, Math.min(255, (ev.clientX - r.left) / r.width * 255)); };
      // the nearest handle to the pointer is the one that moves
      var v0 = at(e), keys = tr.dataset.lv === 'in' ? ['lb', 'lg', 'lw'] : ['ob', 'ow'], pos = function (kk) { return kk === 'lg' ? midPos() : lv(kk); };
      var k = keys.reduce(function (best, kk) { return Math.abs(pos(kk) - v0) < Math.abs(pos(best) - v0) ? kk : best; }, keys[0]);
      try { tr.setPointerCapture(e.pointerId); } catch (x) {}
      function mv(ev) {
        if (!adj) return;
        var v = Math.round(at(ev));
        if (k === 'lb') adj.v.lb = Math.min(v, lv('lw') - 2);
        else if (k === 'lw') adj.v.lw = Math.max(v, lv('lb') + 2);
        else if (k === 'lg') { var t = Math.max(0.01, Math.min(0.99, (at(ev) - lv('lb')) / Math.max(1, lv('lw') - lv('lb')))); adj.v.lg = Math.round(Math.max(10, Math.min(999, Math.log(t) / Math.log(0.5) * 100))); }
        else adj.v[k] = v;
        syncLevels(); adjustQueue();
      }
      function done() { tr.removeEventListener('pointermove', mv); tr.removeEventListener('pointerup', done); tr.removeEventListener('pointercancel', done); }
      mv(e);
      tr.addEventListener('pointermove', mv); tr.addEventListener('pointerup', done); tr.addEventListener('pointercancel', done);
    });
    // double-click (or double-tap) a handle's number to put it back
    adjBox.querySelector('.pa-levels').addEventListener('dblclick', function (e) {
      var o = e.target.closest('[data-o]'); if (!o || !adj) return;
      delete adj.v[o.dataset.o]; syncLevels(); adjustQueue();
    });
    var cvG = adjBox.querySelector('.cv-graph'), CP = 7, cvLastTap = 0;
    function cvSize() { var w = cvG.clientWidth || 220, h = Math.round(w * 0.85); cvG.style.height = h + 'px'; if (cvG.width !== Math.round(w * R)) { cvG.width = Math.round(w * R); cvG.height = Math.round(h * R); } return { w: w, h: h }; }
    function drawCurve() {
      if (adjBox.hidden || adjBox.querySelector('.fx-sec[data-fx="curves"]').classList.contains('closed')) return;
      var sz = cvSize(), c = cvG.getContext('2d'), W2 = sz.w - 2 * CP, H2 = sz.h - 2 * CP, P = curvePts(), cs = getComputedStyle(adjBox);
      var ink = cs.getPropertyValue('--text').trim() || '#1d1d1f', acc = cs.getPropertyValue('--accent').trim() || '#ff3b30';
      c.setTransform(R, 0, 0, R, 0, 0); c.clearRect(0, 0, sz.w, sz.h); c.translate(CP, CP); // (a margin, so the end points show whole)
      c.save(); c.globalAlpha = 0.06; c.fillStyle = ink; c.fillRect(0, 0, W2, H2); c.restore();
      // the layer's tones, faintly underneath
      if (adj) { var hs = adjHist(); c.save(); c.globalAlpha = 0.14; c.fillStyle = ink; for (var i = 0; i < 256; i++) { var v = hs[i] * H2 * 0.9; c.fillRect(i / 256 * W2, H2 - v, W2 / 256 + 0.5, v); } c.restore(); }
      c.save(); c.globalAlpha = 0.18; c.strokeStyle = ink; c.lineWidth = 1;
      for (var g = 1; g < 4; g++) { c.beginPath(); c.moveTo(g * W2 / 4, 0); c.lineTo(g * W2 / 4, H2); c.moveTo(0, g * H2 / 4); c.lineTo(W2, g * H2 / 4); c.stroke(); }
      c.beginPath(); c.moveTo(0, H2); c.lineTo(W2, 0); c.setLineDash([3, 3]); c.stroke(); c.restore(); // (the straight line, where it started)
      var L = curveLut(P);
      c.strokeStyle = ink; c.lineWidth = 1.75; c.beginPath();
      for (var x = 0; x < 256; x++) c[x ? 'lineTo' : 'moveTo'](x / 255 * W2, H2 - L[x] / 255 * H2);
      c.stroke();
      P.forEach(function (q) { c.beginPath(); c.arc(q[0] / 255 * W2, H2 - q[1] / 255 * H2, 5, 0, Math.PI * 2); c.fillStyle = acc; c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke(); });
    }
    function setCurve(P) {
      // (back to a straight line: no curve at all)
      if (P.length === 2 && P[0][0] === 0 && P[0][1] === 0 && P[1][0] === 255 && P[1][1] === 255) delete adj.v.curve; else adj.v.curve = P;
      drawCurve(); adjustQueue();
    }
    cvG.addEventListener('pointerdown', function (e) {
      if (!adj) return;
      e.preventDefault();
      var r0 = cvG.getBoundingClientRect(), r = { left: r0.left + CP, top: r0.top + CP, width: r0.width - 2 * CP, height: r0.height - 2 * CP, bottom: r0.bottom - CP };
      var at = function (ev) { return [Math.max(0, Math.min(255, (ev.clientX - r.left) / r.width * 255)), Math.max(0, Math.min(255, (1 - (ev.clientY - r.top) / r.height) * 255))]; };
      var P = curvePts().map(function (q) { return q.slice(); }), a = at(e), hit = -1, best = 1e9;
      P.forEach(function (q, i) { var d = Math.hypot((q[0] - a[0]) / 255 * r.width, (q[1] - a[1]) / 255 * r.height); if (d < best) { best = d; hit = i; } });
      var now = Date.now();
      if (best <= 14 && now - cvLastTap < 350 && P.length > 2) { P.splice(hit, 1); setCurve(P); cvLastTap = 0; return; } // double-tap: gone
      cvLastTap = now;
      if (best > 14) {
        // a new point, on the line where it was tapped
        var L = curveLut(P), nx = Math.round(a[0]), ny = Math.round(L[nx]);
        if (P.some(function (q) { return q[0] === nx; })) nx = Math.min(255, nx + 1);
        P.push([nx, ny]); P.sort(function (x, y) { return x[0] - y[0]; });
        hit = P.findIndex(function (q) { return q[0] === nx && q[1] === ny; });
        setCurve(P);
      }
      try { cvG.setPointerCapture(e.pointerId); } catch (x) {}
      function mv(ev) {
        if (!adj) return;
        // a point goes wherever it's dragged (dragged well off the graph, it
        // goes, as long as two are left)
        var q = at(ev), Q = P.map(function (x) { return x.slice(); });
        Q[hit] = [Math.round(q[0]), Math.round(q[1])];
        if (P.length > 2 && (ev.clientY < r.top - 30 || ev.clientY > r.bottom + 30)) Q.splice(hit, 1);
        Q.sort(function (a, b) { return a[0] - b[0]; });
        setCurve(Q);
      }
      function up() { cvG.removeEventListener('pointermove', mv); cvG.removeEventListener('pointerup', up); cvG.removeEventListener('pointercancel', up); }
      cvG.addEventListener('pointermove', mv); cvG.addEventListener('pointerup', up); cvG.addEventListener('pointercancel', up);
    });
    // ---- EFFECTS, FAST. The look is worked out pixel by pixel by fxKernel,
    // a function that stands on its own, so the very same sums run on the
    // main thread (when the effect is kept) and in a worker (live, without
    // holding up the page). With WebGL 2 the live look is drawn by the
    // graphics chip (fxGL): the same sums in a shader, on a canvas standing
    // in for the layer, so nothing is read back or written to the layer while
    // the sliders move, and Done renders it once at full size ----
    // (the settings as numbers and tables: the tone curve, brilliance and
    // the gradient map worked out once for all 256 levels)
    function fxParams() {
      var v = adj.v, val = function (k) { return (v[k] || 0) / 100; };
      var ex = Math.pow(2, val('exposure') * 1.5), co = val('contrast'), hi = val('highlights'), sh = val('shadows'), wh = val('whites'), bl = val('blacks'), fa = val('fade');
      var lut = new Uint8ClampedArray(256), blut = new Float32Array(256), br = val('brilliance');
      var lb = lv('lb'), lw = lv('lw'), lg = lv('lg') / 100, ob = lv('ob'), ow = lv('ow'), cl8 = v.curve ? curveLut(v.curve) : null;
      for (var i = 0; i < 256; i++) {
        // (levels first, then the curve, then the sliders)
        var x = Math.max(0, Math.min(1, (i - lb) / Math.max(1, lw - lb)));
        x = (ob + Math.pow(x, 1 / lg) * (ow - ob)) / 255;
        if (cl8) { var cx8 = x * 255, c0 = Math.min(254, Math.floor(cx8)), cf = cx8 - c0; x = (cl8[c0] * (1 - cf) + cl8[c0 + 1] * cf) / 255; }
        x *= ex;
        x += sh * 0.3 * (1 - sstep(0, 0.55, x)) * (sh > 0 ? 1 - x : x);
        x += hi * 0.3 * sstep(0.45, 1, x) * (hi > 0 ? 1 - x : x);
        x += wh * 0.22 * sstep(0.55, 1.05, x);
        x += bl * 0.16 * Math.pow(1 - Math.min(1, x), 3);
        x = Math.max(0, Math.min(1, x));
        x = co >= 0 ? x + co * 0.9 * (x * x * (3 - 2 * x) - x) * 1.6 : 0.5 + (x - 0.5) * (1 + co * 0.6);
        x = fa ? x * (1 - fa * 0.22) + fa * 0.12 : x;
        lut[i] = Math.round(Math.max(0, Math.min(1, x)) * 255);
        // brilliance: brings up the darker parts and holds back the brightest
        var L = i / 255; blut[i] = L ? Math.max(0, L + br * (0.45 * L * (1 - L) * (1 - L) - 0.25 * L * L * (1 - L))) / L : 1;
      }
      var hu = val('hue') * Math.PI, gm = null, gms = (v.gms != null ? v.gms : 100) / 100;
      if (v.gmap && gms) {
        var gst = gmStops(v.gmap).map(function (c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; });
        if (v.gmr) gst.reverse();
        gm = new Uint8ClampedArray(768);
        for (var gi = 0; gi < 256; gi++) {
          var gt = gi / 255 * (gst.length - 1), g0 = Math.min(gst.length - 2, Math.floor(gt)), gf = gt - g0;
          for (var gc = 0; gc < 3; gc++) gm[gi * 3 + gc] = gst[g0][gc] + (gst[g0 + 1][gc] - gst[g0][gc]) * gf;
        }
      }
      var gb = v.gblur ? (0.4 + Math.pow(val('gblur'), 1.6) * 40) * R : 0, md = v.mblur ? (1 + Math.pow(val('mblur'), 1.5) * 150) * R : 0;
      return { lut: lut, blut: blut, br: br, sat: 1 + val('saturation'), vib: val('vibrance'), wa: val('warmth') * 28, ti: val('tint') * 24,
        hu: hu, hc: Math.cos(hu), hs: Math.sin(hu), lt: val('lightness'), gm: gm, gms: gms,
        shp: val('sharpen') * 1.6, cl: val('clarity') * 0.7, vg: val('vignette'), gr: val('grain') * 38, wideR: Math.max(6, Math.round(14 * R)),
        // PIXELATE: square blocks from 2 to 80 of the picture's pixels (more
        // finely at the small end), each the average of what's in it
        px: v.pixelate ? Math.max(2, Math.round((1 + Math.pow(val('pixelate'), 1.6) * 79) * R)) : 0,
        // BLUR: Gaussian, up to a spread of 40 of the picture's pixels; motion,
        // up to 150 long, at the angle set (both finely at the small end)
        gb: gb, md: md, ang: v.mangle || 0, bl: fxBlurPlan(gb, md, v.mangle || 0) };
    }
    // HOW A BLUR IS WORKED, the same by the graphics chip, the worker and the
    // main thread: the layer (its colours weighted by how solid they are, so
    // see-through edges don't darken) is made smaller by f first when the
    // blur is big enough not to show it; Gaussian is three box blurs each way
    // (radii br); motion is n1 samples s1 apart along the angle, then n2
    // filling the gaps between them; then it's brought back to full size
    function fxBlurPlan(sigma, dist, deg) {
      if (sigma < 0.6 && dist < 1) return null;
      var fg = 1, fm = 1; while (sigma / fg > 3 && fg < 64) fg *= 2; while (dist / fm > 12 && fm < 64) fm *= 2;
      var f = Math.max(sigma >= 0.6 ? fg : 1, dist >= 1 ? fm : 1), B = { f: f, br: null, n1: 1, s1: 0, n2: 1, dx: 1, dy: 0 };
      if (sigma >= 0.6) {
        var sg = sigma / f, wi = Math.sqrt(12 * sg * sg / 3 + 1), wl = Math.floor(wi); if (wl % 2 === 0) wl--;
        var mi = Math.round((12 * sg * sg - 3 * wl * wl - 12 * wl - 9) / (-4 * wl - 4)), br = [];
        for (var i = 0; i < 3; i++) br.push(((i < mi ? wl : wl + 2) - 1) / 2);
        if (br.some(function (r) { return r > 0; })) B.br = br;
      }
      if (dist >= 1) {
        var d = dist / f, a = deg * Math.PI / 180;
        B.n1 = Math.max(1, Math.ceil(Math.sqrt(d))); B.s1 = d / B.n1; B.n2 = Math.max(1, Math.ceil(B.s1));
        B.dx = Math.cos(a); B.dy = -Math.sin(a);
      }
      if (!B.br && B.n1 === 1 && B.n2 === 1) return null;
      return B;
    }
    // (the blur itself, by the processor: s in, the blurred layer out, both RGBA.
    // Nothing from outside: it also runs in the worker)
    function fxBlurRun(B, s, W, H) {
      var f = B.f, w = Math.ceil(W / f), h = Math.ceil(H / f), n = w * h, A = new Float32Array(n * 4), C = new Float32Array(n * 4), x, y, k, j, q, t;
      if (f === 1) { for (k = 0; k < n * 4; k += 4) { var a1 = s[k + 3] / 255; A[k] = s[k] * a1; A[k + 1] = s[k + 1] * a1; A[k + 2] = s[k + 2] * a1; A[k + 3] = s[k + 3]; } }
      else {
        var cnt = new Float32Array(n);
        for (y = 0; y < H; y++) { var by = (y / f | 0) * w; for (x = 0, k = y * W * 4; x < W; x++, k += 4) { j = by + (x / f | 0); q = j * 4; var a2 = s[k + 3] / 255; A[q] += s[k] * a2; A[q + 1] += s[k + 1] * a2; A[q + 2] += s[k + 2] * a2; A[q + 3] += s[k + 3]; cnt[j]++; } }
        for (j = 0; j < n; j++) { var m = 1 / cnt[j]; q = j * 4; A[q] *= m; A[q + 1] *= m; A[q + 2] *= m; A[q + 3] *= m; }
      }
      // (a box blur one way, the edges carried on as they are)
      var box = function (src, dst, r, across) {
        var len = across ? w : h, lines = across ? h : w, st = across ? 4 : w * 4, inv = 1 / (2 * r + 1);
        for (var L = 0; L < lines; L++) {
          var b0 = across ? L * w * 4 : L * 4;
          for (var c = 0; c < 4; c++) {
            var sum = 0, i;
            for (i = -r; i <= r; i++) sum += src[b0 + Math.min(len - 1, Math.max(0, i)) * st + c];
            for (i = 0; i < len; i++) { dst[b0 + i * st + c] = sum * inv; sum += src[b0 + Math.min(len - 1, i + r + 1) * st + c] - src[b0 + Math.max(0, i - r) * st + c]; }
          }
        }
      };
      if (B.br) for (t = 0; t < 3; t++) if (B.br[t]) { box(A, C, B.br[t], true); box(C, A, B.br[t], false); }
      // (one pass of the motion blur: N samples, sp apart, along the angle)
      var at = function (src, fx, fy, o) {
        fx = Math.max(0, Math.min(w - 1, fx)); fy = Math.max(0, Math.min(h - 1, fy));
        var x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
        var i00 = (y0 * w + x0) * 4, i10 = (y0 * w + x1) * 4, i01 = (y1 * w + x0) * 4, i11 = (y1 * w + x1) * 4;
        for (var c = 0; c < 4; c++) { var top = src[i00 + c] + (src[i10 + c] - src[i00 + c]) * tx, bot = src[i01 + c] + (src[i11 + c] - src[i01 + c]) * tx; o[c] += top + (bot - top) * ty; }
      };
      var pass = function (src, dst, N, sp) {
        var o = [0, 0, 0, 0], inv = 1 / N;
        for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
          o[0] = o[1] = o[2] = o[3] = 0;
          for (var i = 0; i < N; i++) { var off = (i - (N - 1) / 2) * sp; at(src, xx + B.dx * off, yy + B.dy * off, o); }
          var kk = (yy * w + xx) * 4; dst[kk] = o[0] * inv; dst[kk + 1] = o[1] * inv; dst[kk + 2] = o[2] * inv; dst[kk + 3] = o[3] * inv;
        }
      };
      if (B.n1 > 1) { pass(A, C, B.n1, B.s1); t = A; A = C; C = t; }
      if (B.n2 > 1) { pass(A, C, B.n2, B.s1 / B.n2); t = A; A = C; C = t; }
      // (back to full size, and the colours un-weighted)
      var out = new Uint8ClampedArray(W * H * 4), px = [0, 0, 0, 0];
      for (y = 0; y < H; y++) for (x = 0, k = y * W * 4; x < W; x++, k += 4) {
        px[0] = px[1] = px[2] = px[3] = 0;
        if (f === 1) { q = (y * w + x) * 4; px[0] = A[q]; px[1] = A[q + 1]; px[2] = A[q + 2]; px[3] = A[q + 3]; } else at(A, (x + 0.5) / f - 0.5, (y + 0.5) / f - 0.5, px);
        var pa = px[3];
        if (pa > 0) { out[k] = px[0] * 255 / pa; out[k + 1] = px[1] * 255 / pa; out[k + 2] = px[2] * 255 / pa; }
        out[k + 3] = pa;
      }
      return out;
    }
    // THE PIXELS: s in, o out (both RGBA), m the selection (or null), blur
    // and wide the soft copies for sharpen and clarity; only the rows and
    // columns of the box (where the selection is) are worked: outside it, o
    // already holds s. (Nothing from outside: it also runs in the worker.)
    function fxKernel(P, s, o, m, blur, wide, W2, H2, bx, bs) {
      var src = bs || s; // (blurred first, if there's a blur)
      function sstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
      function hueTurn(r, g, b, c, s, o) {
        var yy = 0.299 * r + 0.587 * g + 0.114 * b, ii = 0.596 * r - 0.274 * g - 0.322 * b, qq = 0.211 * r - 0.523 * g + 0.312 * b;
        var i2 = ii * c - qq * s, q2 = ii * s + qq * c;
        o[0] = yy + 0.956 * i2 + 0.621 * q2; o[1] = yy - 0.272 * i2 - 0.647 * q2; o[2] = yy - 1.106 * i2 + 1.703 * q2;
      }
      var lut = P.lut, blut = P.blut, br = P.br, sat = P.sat, vib = P.vib, wa = P.wa, ti = P.ti, hu = P.hu, hc = P.hc, hs = P.hs, ho = [0, 0, 0], lt = P.lt;
      var gm = P.gm, gms = P.gms, shp = P.shp, cl = P.cl, vg = P.vg, gr = P.gr;
      var cx = W2 / 2, cy = H2 / 2, rr = 1 / Math.hypot(cx, cy);
      // (pixelate: the blocks' averages, a row of blocks at a time, as the
      // rows reach it; ps can be fractional, for a smaller copy)
      var ps = P.px || 0, pa = null, prow = -1, pb0 = 0;
      for (var y = bx.y0; y < bx.y1; y++) {
        if (ps && Math.floor(y / ps) !== prow) {
          prow = Math.floor(y / ps);
          var ya = y, yb = y + 1; while (ya > 0 && Math.floor((ya - 1) / ps) === prow) ya--; while (yb < H2 && Math.floor(yb / ps) === prow) yb++;
          pb0 = Math.floor(bx.x0 / ps); var pb1 = Math.floor(Math.max(bx.x0, bx.x1 - 1) / ps), nb = pb1 - pb0 + 1;
          var xa = bx.x0, xb = Math.max(bx.x0 + 1, bx.x1); while (xa > 0 && Math.floor((xa - 1) / ps) === pb0) xa--; while (xb < W2 && Math.floor(xb / ps) === pb1) xb++;
          if (!pa || pa.length < nb * 5) pa = new Float64Array(nb * 5); else pa.fill(0, 0, nb * 5);
          for (var yy = ya; yy < yb; yy++) for (var xx = xa, kk = (yy * W2 + xa) * 4; xx < xb; xx++, kk += 4) {
            var bi = (Math.floor(xx / ps) - pb0) * 5, aa = src[kk + 3];
            pa[bi] += src[kk] * aa; pa[bi + 1] += src[kk + 1] * aa; pa[bi + 2] += src[kk + 2] * aa; pa[bi + 3] += aa; pa[bi + 4]++;
          }
          for (var q5 = 0; q5 < nb * 5; q5 += 5) { var sa = pa[q5 + 3]; pa[q5 + 4] = Math.round(sa / pa[q5 + 4]); if (sa) { pa[q5] = Math.round(pa[q5] / sa); pa[q5 + 1] = Math.round(pa[q5 + 1] / sa); pa[q5 + 2] = Math.round(pa[q5 + 2] / sa); } }
        }
        for (var x2 = bx.x0, k = (y * W2 + x2) * 4; x2 < bx.x1; x2++, k += 4) {
          if (m && !m[k + 3]) { o[k] = s[k]; o[k + 1] = s[k + 1]; o[k + 2] = s[k + 2]; o[k + 3] = s[k + 3]; continue; }
          var a = src[k + 3], r = src[k], g = src[k + 1], b = src[k + 2];
          if (ps) { var pq = (Math.floor(x2 / ps) - pb0) * 5; a = pa[pq + 4]; r = pa[pq]; g = pa[pq + 1]; b = pa[pq + 2]; }
          if (!a) { o[k] = r; o[k + 1] = g; o[k + 2] = b; o[k + 3] = 0; continue; }
          var j = (k >> 2) * 3;
          if (shp) { var bb = blur; r += shp * (r - bb[j]); g += shp * (g - bb[j + 1]); b += shp * (b - bb[j + 2]); }
          if (cl) { var ww = wide, lw = (s[k] - ww[j] + s[k + 1] - ww[j + 1] + s[k + 2] - ww[j + 2]) / 3; r += cl * lw; g += cl * lw; b += cl * lw; }
          r = lut[r < 0 ? 0 : r > 255 ? 255 : r | 0]; g = lut[g < 0 ? 0 : g > 255 ? 255 : g | 0]; b = lut[b < 0 ? 0 : b > 255 ? 255 : b | 0];
          var l = 0.299 * r + 0.587 * g + 0.114 * b;
          if (br) { var f = blut[l | 0]; r *= f; g *= f; b *= f; l *= f; }
          if (sat !== 1 || vib) {
            var mx = Math.max(r, g, b), mn = Math.min(r, g, b), ff = sat * (1 + vib * (1 - (mx - mn) / 255) * (vib > 0 ? 1 : 0.8));
            r = l + (r - l) * ff; g = l + (g - l) * ff; b = l + (b - l) * ff;
          }
          if (hu) { hueTurn(r, g, b, hc, hs, ho); r = ho[0]; g = ho[1]; b = ho[2]; }
          if (lt) { if (lt > 0) { r += (255 - r) * lt * 0.85; g += (255 - g) * lt * 0.85; b += (255 - b) * lt * 0.85; } else { r *= 1 + lt * 0.85; g *= 1 + lt * 0.85; b *= 1 + lt * 0.85; } }
          if (wa) { r += wa; b -= wa; }
          if (ti) { g -= ti; r += ti * 0.35; b += ti * 0.35; }
          if (gm) { var gl = (0.299 * r + 0.587 * g + 0.114 * b) | 0; gl = gl < 0 ? 0 : gl > 255 ? 255 : gl; r += (gm[gl * 3] - r) * gms; g += (gm[gl * 3 + 1] - g) * gms; b += (gm[gl * 3 + 2] - b) * gms; }
          if (vg) { var dv = sstep(0.3, 1.05, Math.hypot(x2 - cx, y - cy) * rr) * vg * 0.75, gv = vg > 0 ? 1 - dv : 1; r = vg > 0 ? r * gv : r - dv * (255 - r); g = vg > 0 ? g * gv : g - dv * (255 - g); b = vg > 0 ? b * gv : b - dv * (255 - b); }
          if (gr) { var n = ((Math.imul(k >> 2, 2654435761) >>> 0) % 1000 / 1000 - 0.5) * gr; r += n; g += n; b += n; }
          o[k] = r; o[k + 1] = g; o[k + 2] = b; o[k + 3] = a;
        }
      }
    }
    // (where the selection is: the only part worth working on)
    function maskBox(m, W2, H2) {
      if (!m) return { x0: 0, y0: 0, x1: W2, y1: H2 };
      var x0 = W2, y0 = H2, x1 = -1, y1 = -1;
      for (var y = 0, k = 3; y < H2; y++) for (var x = 0; x < W2; x++, k += 4) if (m[k]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return x1 < 0 ? { x0: 0, y0: 0, x1: 0, y1: 0 } : { x0: x0, y0: y0, x1: x1 + 1, y1: y1 + 1 };
    }

    // THE WORKER: the live look worked out off the main thread (only the
    // newest settings are worked: any asked for in between are skipped), in
    // two buffers that go back and forth, so nothing new is made each time
    var fxW = null;
    function fxWorker() {
      if (fxW || typeof Worker === 'undefined' || typeof Blob === 'undefined') return fxW;
      try {
        var code = boxBlur.toString() + '\n' + fxKernel.toString() + '\n' + fxBlurRun.toString() + '\n' +
          'var S = {}, free = {};\n' +
          'onmessage = function (e) { var d = e.data, k = d.prev ? "p" : "f", Q = S[k];\n' +
          '  if (d.t === "src") { S[k] = { s: d.s, m: d.m, W: d.W, H: d.H, box: d.box, blur: null, wide: null }; free[k] = []; return; }\n' +
          '  if (d.t === "end") { S = {}; free = {}; return; }\n' +
          '  if (d.t === "back") { if (Q && d.buf.length === Q.s.length) free[k].push(d.buf); return; }\n' +
          '  if (d.t === "run" && Q) { var P = d.P;\n' +
          '    if (P.shp && !Q.blur) Q.blur = boxBlur(Q.s, Q.W, Q.H, 1);\n' +
          '    if (P.cl && !Q.wide) Q.wide = boxBlur(Q.s, Q.W, Q.H, P.wideR);\n' +
          '    var o = free[k].pop() || new Uint8ClampedArray(Q.s);\n' +
          '    var bs = null; if (P.bl) { var bk = JSON.stringify(P.bl); if (Q.bkey !== bk) { Q.bs = fxBlurRun(P.bl, Q.s, Q.W, Q.H); Q.bkey = bk; } bs = Q.bs; }\n' +
          '    fxKernel(P, Q.s, o, Q.m, Q.blur, Q.wide, Q.W, Q.H, Q.box, bs);\n' +
          '    postMessage({ t: "out", ver: d.ver, sid: d.sid, prev: d.prev, buf: o }, [o.buffer]); } };';
        fxW = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
        fxW.onmessage = fxFromWorker;
        fxW.onerror = function () { fxW = null; if (adj) { adj.mode = 'cpu'; adjustQueue(); } };
      } catch (x) { fxW = null; }
      return fxW;
    }
    var fxSid = 0;
    function fxFromWorker(e) {
      var d = e.data; if (d.t !== 'out') return;
      if (!adj || adj.mode !== 'worker' || d.sid !== adj.sid) return;
      adj.busy = false;
      if (d.prev) { var pv = adj.prev; pv.ctx.putImageData(new ImageData(d.buf, pv.w, pv.h), 0, 0); fxPrevShow(true); }
      else { adjustPut(new ImageData(d.buf, adj.src.width, adj.src.height)); adj.shown = d.ver; fxPrevShow(false); }
      fxW.postMessage({ t: 'back', buf: d.buf, prev: d.prev }, [d.buf.buffer]); // (the buffer goes back, for the next time)
      if (adj.finishing && adj.shown === adj.ver) { adjustDone(); return; } // (kept: the full size is here)
      if (adj.applying && adj.shown === adj.ver) { adjustApply(); return; }
      if (adj.want) { var w = adj.want; adj.want = null; fxPost(w); }
    }
    function fxPost(job) {
      if (job.prev && job.ver !== adj.ver) return; // (a newer look is on its way)
      if (!job.prev && job.ver === adj.shown) return; // (already there)
      adj.busy = true; fxW.postMessage({ t: 'run', P: job.P, ver: job.ver, sid: adj.sid, prev: job.prev });
    }
    // WHILE A SLIDER MOVES, without the graphics chip: the live look is worked
    // on a copy the size the layer is seen at (no more than about 1.5 million
    // pixels), shown on a canvas in its place; a moment after the slider
    // stops, the full size is worked and laid on the layer. (The soft
    // copies, grain and vignette are scaled to match.)
    function fxPrevMake() {
      var cv = adj.L.cv, q = Math.min(1, view.k * (window.devicePixelRatio || 1) / R, Math.sqrt(1.5e6 / (cv.width * cv.height)));
      if (q > 0.85 || usesView(adj.L)) return null; // (near full size, or seen through a mask or a clip: the full size it is)
      var w = Math.max(1, Math.round(cv.width * q)), h = Math.max(1, Math.round(cv.height * q));
      var c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d', { willReadFrequently: true });
      x.imageSmoothingQuality = 'high'; x.drawImage(cv, 0, 0, w, h);
      var s0 = x.getImageData(0, 0, w, h).data, m = null;
      if (adj.selOn && sel) { var mc = document.createElement('canvas'); mc.width = w; mc.height = h; var mx = mc.getContext('2d', { willReadFrequently: true }); mx.drawImage(selCanvas(), 0, 0, w, h); m = mx.getImageData(0, 0, w, h).data; }
      fxW.postMessage({ t: 'src', prev: true, s: s0, m: m, W: w, H: h, box: maskBox(m, w, h) }, [s0.buffer]);
      c.className = 'paint-fxprev'; c.style.width = cv.style.width; c.style.height = cv.style.height;
      return { q: q, w: w, h: h, cv: c, ctx: x };
    }
    function fxPrevShow(on) {
      var pv = adj.prev, L = adj.L; if (!pv) return;
      if (on && pv.cv.previousSibling !== L.cv) {
        if (!adj.hidSet) { adj.hid = L.cv.style.visibility; adj.hidSet = true; }
        pv.cv.style.opacity = L.cv.style.opacity; pv.cv.style.mixBlendMode = L.cv.style.mixBlendMode; pv.cv.style.visibility = adj.hid;
        L.cv.parentNode.insertBefore(pv.cv, L.cv.nextSibling); L.cv.style.visibility = 'hidden';
      } else if (!on && pv.cv.parentNode) { pv.cv.parentNode.removeChild(pv.cv); L.cv.style.visibility = adj.hid || ''; }
    }
    function fxPrevP(P) {
      var q = adj.prev.q, o = {}; for (var k in P) o[k] = P[k];
      o.wideR = Math.max(1, Math.round(P.wideR * q)); o.shp = P.shp * q; o.gr = P.gr * Math.max(q, 0.5); o.px = P.px * q;
      o.bl = fxBlurPlan(P.gb * q, P.md * q, P.ang); // (a blur the size it is on the smaller copy)
      return o;
    }

    // THE GRAPHICS CHIP (WebGL 2): the layer as a texture; two passes of a
    // box blur make the soft copies for sharpen and clarity (once each, then
    // kept); the effect is drawn on a canvas standing in for the layer
    var fxG = null;
    var FX_VS = '#version 300 es\nin vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
    var FX_FS = '#version 300 es\nprecision highp float; precision highp int; precision highp sampler2D;\n' +
      'uniform sampler2D u_src, u_mask, u_lut, u_wide, u_pix, u_bsrc; uniform int u_hasMask, u_flip, u_W, u_H, u_gm, u_px, u_hasBl;\n' +
      'uniform float u_shp, u_cl, u_br, u_sat, u_vib, u_hu, u_hc, u_hs, u_lt, u_wa, u_ti, u_gms, u_vg, u_gr, u_rr; uniform vec2 u_c;\n' +
      'out vec4 frag;\n' +
      'float sstep(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }\n' +
      'float lutAt(float v) { int i = v < 0.0 ? 0 : v > 255.0 ? 255 : int(v); return texelFetch(u_lut, ivec2(i, 0), 0).r; }\n' +
      'vec3 px(int x, int y) { return floor(texelFetch(u_src, ivec2(clamp(x, 0, u_W - 1), clamp(y, 0, u_H - 1)), 0).rgb * 255.0 + 0.5); }\n' +
      'void main() {\n' +
      '  ivec2 q = ivec2(gl_FragCoord.xy); if (u_flip == 1) q.y = u_H - 1 - q.y;\n' +
      '  vec4 S = texelFetch(u_src, q, 0); vec3 s = floor(S.rgb * 255.0 + 0.5);\n' +
      '  bool inM = u_hasMask == 0 || texelFetch(u_mask, q, 0).a > 0.0;\n' +
      '  vec4 SB = u_hasBl == 1 && inM ? texelFetch(u_bsrc, q, 0) : S; float a = SB.a; vec3 sb = floor(SB.rgb * 255.0 + 0.5); vec3 c = sb, r0 = sb;\n' +
      '  if (u_px > 0 && inM) { vec4 B = texelFetch(u_pix, q / u_px, 0); r0 = B.rgb; a = B.a / 255.0; c = r0; }\n' +
      '  if (a > 0.0 && inM) {\n' +
      '    vec3 r = r0;\n' +
      '    if (u_shp != 0.0) { vec3 bb = vec3(0.0); for (int dy = -1; dy <= 1; dy++) bb += (px(q.x - 1, q.y + dy) + px(q.x, q.y + dy) + px(q.x + 1, q.y + dy)) / 3.0; bb /= 3.0; r += u_shp * (r - bb); }\n' +
      '    if (u_cl != 0.0) { float lw = (s.r + s.g + s.b - texelFetch(u_wide, q, 0).r) / 3.0; r += u_cl * lw; }\n' +
      '    r = vec3(lutAt(r.r), lutAt(r.g), lutAt(r.b));\n' +
      '    float l = 0.299 * r.r + 0.587 * r.g + 0.114 * r.b;\n' +
      '    if (u_br != 0.0) { float f = texelFetch(u_lut, ivec2(int(l), 0), 0).g; r *= f; l *= f; }\n' +
      '    if (u_sat != 1.0 || u_vib != 0.0) { float mx = max(max(r.r, r.g), r.b), mn = min(min(r.r, r.g), r.b); float ff = u_sat * (1.0 + u_vib * (1.0 - (mx - mn) / 255.0) * (u_vib > 0.0 ? 1.0 : 0.8)); r = l + (r - l) * ff; }\n' +
      '    if (u_hu != 0.0) { float yy = 0.299 * r.r + 0.587 * r.g + 0.114 * r.b, ii = 0.596 * r.r - 0.274 * r.g - 0.322 * r.b, qq = 0.211 * r.r - 0.523 * r.g + 0.312 * r.b;\n' +
      '      float i2 = ii * u_hc - qq * u_hs, q2 = ii * u_hs + qq * u_hc; r = vec3(yy + 0.956 * i2 + 0.621 * q2, yy - 0.272 * i2 - 0.647 * q2, yy - 1.106 * i2 + 1.703 * q2); }\n' +
      '    if (u_lt != 0.0) { if (u_lt > 0.0) r += (255.0 - r) * u_lt * 0.85; else r *= 1.0 + u_lt * 0.85; }\n' +
      '    if (u_wa != 0.0) { r.r += u_wa; r.b -= u_wa; }\n' +
      '    if (u_ti != 0.0) { r.g -= u_ti; r.r += u_ti * 0.35; r.b += u_ti * 0.35; }\n' +
      '    if (u_gm == 1) { int gl = clamp(int(0.299 * r.r + 0.587 * r.g + 0.114 * r.b), 0, 255); vec3 G = texelFetch(u_lut, ivec2(gl, 1), 0).rgb; r += (G - r) * u_gms; }\n' +
      '    if (u_vg != 0.0) { float dv = sstep(0.3, 1.05, length(vec2(q) - u_c) * u_rr) * u_vg * 0.75; if (u_vg > 0.0) r *= 1.0 - dv; else r -= dv * (255.0 - r); }\n' +
      '    if (u_gr != 0.0) { uint h = uint(q.y * u_W + q.x) * 2654435761u; r += (float(h % 1000u) / 1000.0 - 0.5) * u_gr; }\n' +
      '    c = clamp(roundEven(r), 0.0, 255.0);\n' +
      '  }\n' +
      '  frag = u_flip == 1 ? vec4(c / 255.0 * a, a) : vec4(c / 255.0, a);\n' +
      '}';
    // (one pass of the box blur, one way: the first from the layer, in 0-255)
    // (clarity's soft copy: only the three channels added together matter
    // to it, so that's all that's blurred, into one float channel)
    var FX_BS = '#version 300 es\nprecision highp float; precision highp int; precision highp sampler2D;\n' +
      'uniform sampler2D u_in; uniform int u_r, u_dir, u_W, u_H; out vec4 frag;\n' +
      'void main() { ivec2 q = ivec2(gl_FragCoord.xy); float t = 0.0;\n' +
      '  for (int d = -u_r; d <= u_r; d++) { ivec2 p = u_dir == 0 ? ivec2(clamp(q.x + d, 0, u_W - 1), q.y) : ivec2(q.x, clamp(q.y + d, 0, u_H - 1));\n' +
      '    vec4 v = texelFetch(u_in, p, 0); t += u_dir == 0 ? dot(floor(v.rgb * 255.0 + 0.5), vec3(1.0)) : v.r; }\n' +
      '  frag = vec4(t / float(2 * u_r + 1), 0.0, 0.0, 1.0); }';
    // (pixelate's blocks, by the graphics chip: each one's colours, weighted
    // by how solid they are, added along its rows, then down its columns,
    // and averaged, into a texture one texel a block)
    var FX_PS = '#version 300 es\nprecision highp float; precision highp int; precision highp sampler2D;\n' +
      'uniform sampler2D u_in; uniform int u_b, u_dir, u_W, u_H; out vec4 frag;\n' +
      'void main() { ivec2 q = ivec2(gl_FragCoord.xy); vec4 t = vec4(0.0);\n' +
      '  if (u_dir == 0) { for (int d = 0; d < u_b; d++) { int x = q.x * u_b + d; if (x >= u_W) break; vec4 v = texelFetch(u_in, ivec2(x, q.y), 0); t += vec4(floor(v.rgb * 255.0 + 0.5) * v.a, v.a); } frag = t; return; }\n' +
      '  int n = 0; for (int d = 0; d < u_b; d++) { int y = q.y * u_b + d; if (y >= u_H) break; t += texelFetch(u_in, ivec2(q.x, y), 0); n++; }\n' +
      '  float cnt = float(min(u_b, u_W - q.x * u_b) * n);\n' +
      '  frag = t.a > 0.0 ? vec4(floor(t.rgb / t.a + 0.5), floor(t.a * 255.0 / cnt + 0.5)) : vec4(0.0); }';
    // THE BLUR on the graphics chip, the same steps as fxBlurRun: made smaller
    // (and weighted by how solid), box blurs each way, the motion passes,
    // then back to full size, un-weighted, into a texture the effect reads
    var FX_HEAD = '#version 300 es\nprecision highp float; precision highp int; precision highp sampler2D;\n';
    var FX_AT = 'vec4 at(vec2 f) { f = clamp(f, vec2(0.0), vec2(float(u_w - 1), float(u_h - 1))); ivec2 p0 = ivec2(floor(f)), p1 = min(p0 + 1, ivec2(u_w - 1, u_h - 1)); vec2 t = f - vec2(p0);\n' +
      '  vec4 a = texelFetch(u_in, p0, 0), b = texelFetch(u_in, ivec2(p1.x, p0.y), 0), c = texelFetch(u_in, ivec2(p0.x, p1.y), 0), d = texelFetch(u_in, p1, 0);\n' +
      '  vec4 top = a + (b - a) * t.x, bot = c + (d - c) * t.x; return top + (bot - top) * t.y; }\n';
    var FX_BD = FX_HEAD + 'uniform sampler2D u_in; uniform int u_f, u_W, u_H; out vec4 frag;\n' +
      'void main() { ivec2 q = ivec2(gl_FragCoord.xy); vec4 t = vec4(0.0); float n = 0.0;\n' +
      '  for (int dy = 0; dy < u_f; dy++) { int y = q.y * u_f + dy; if (y >= u_H) break; for (int dx = 0; dx < u_f; dx++) { int x = q.x * u_f + dx; if (x >= u_W) break;\n' +
      '    vec4 v = texelFetch(u_in, ivec2(x, y), 0); float a = floor(v.a * 255.0 + 0.5); t += vec4(floor(v.rgb * 255.0 + 0.5) * (a / 255.0), a); n += 1.0; } }\n' +
      '  frag = t / n; }';
    var FX_BB = FX_HEAD + 'uniform sampler2D u_in; uniform int u_r, u_dir, u_w, u_h; out vec4 frag;\n' +
      'void main() { ivec2 q = ivec2(gl_FragCoord.xy); vec4 t = vec4(0.0);\n' +
      '  for (int d = -u_r; d <= u_r; d++) t += texelFetch(u_in, u_dir == 0 ? ivec2(clamp(q.x + d, 0, u_w - 1), q.y) : ivec2(q.x, clamp(q.y + d, 0, u_h - 1)), 0);\n' +
      '  frag = t / float(2 * u_r + 1); }';
    var FX_BM = FX_HEAD + 'uniform sampler2D u_in; uniform int u_N, u_w, u_h; uniform float u_sp; uniform vec2 u_d; out vec4 frag;\n' + FX_AT +
      'void main() { vec2 q = vec2(ivec2(gl_FragCoord.xy)); vec4 t = vec4(0.0);\n' +
      '  for (int i = 0; i < u_N; i++) t += at(q + u_d * ((float(i) - float(u_N - 1) / 2.0) * u_sp));\n' +
      '  frag = t / float(u_N); }';
    var FX_BU = FX_HEAD + 'uniform sampler2D u_in; uniform int u_f, u_w, u_h; out vec4 frag;\n' + FX_AT +
      'void main() { ivec2 q = ivec2(gl_FragCoord.xy); vec4 v = u_f == 1 ? texelFetch(u_in, q, 0) : at((vec2(q) + 0.5) / float(u_f) - 0.5);\n' +
      '  frag = v.a > 0.0 ? vec4(v.rgb / v.a, v.a / 255.0) : vec4(0.0); }';
    function fxGLMake() {
      if (fxG) return fxG.lost ? null : fxG;
      var cv = document.createElement('canvas'), gl = null;
      try { gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false }); } catch (x) {}
      if (!gl) { fxG = { lost: true }; return null; }
      // (WebGL drawn by the processor, not a graphics chip, is slower than
      // the worker: so it's left alone, unless asked for)
      var dbg = gl.getExtension('WEBGL_debug_renderer_info'), rn = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '', pref = stored('paint-fx-gpu', 'auto');
      if (pref === 'off' || (pref !== 'on' && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(rn))) { fxG = { lost: true }; return null; }
      var sh = function (type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      var prog = function (fs) { var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, FX_VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
      try {
        var g = { cv: cv, gl: gl, main: prog(FX_FS), blur: prog(FX_BS), pix: prog(FX_PS), bd: prog(FX_BD), bb: prog(FX_BB), bm: prog(FX_BM), bu: prog(FX_BU), u: {}, lost: false,
          float: !!gl.getExtension('EXT_color_buffer_float'), max: Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0], gl.getParameter(gl.MAX_VIEWPORT_DIMS)[1]) };
        g.main.uk = 'm'; g.pix.uk = 'p'; g.blur.uk = 'b'; g.bd.uk = 'd'; g.bb.uk = 'x'; g.bm.uk = 'y'; g.bu.uk = 'u'; // (each one's uniforms kept apart)
        var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); g.lost = true; if (adj && adj.mode === 'gl') fxToCPU(); });
        fxG = g;
      } catch (x) { fxG = { lost: true }; return null; }
      return fxG;
    }
    function fxUni(p, n) { var k = (p.uk || 'b') + n; if (!(k in fxG.u)) fxG.u[k] = fxG.gl.getUniformLocation(p, n); return fxG.u[k]; }
    function fxTex(w, h, fmt, data) {
      var gl = fxG.gl, t = gl.createTexture(); gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, t); // (on a unit no sampler reads, so a texture being drawn into is never read at once)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (fmt === 'f') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data || null);
      else if (fmt === 'h') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else if (fmt === 'r') gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, w, h, 0, gl.RED, gl.FLOAT, data || null);
      else if (fmt === 'img') { gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, data); }
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data || null);
      return t;
    }
    function fxTarget(t) { var gl = fxG.gl, f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; }
    // (clarity's soft copy: two passes, one way then the other, kept until
    // Effects closes; a chip that can't draw into float textures gets it
    // worked out by the same sums as the main thread's)
    function fxGLBlur(r) {
      var gl = fxG.gl, w = adj.gw, h = adj.gh;
      if (!fxG.float) {
        var d = adj.L.ctx.getImageData(0, 0, w, h).data, b = boxBlur(d, w, h, r), one = new Float32Array(w * h);
        for (var i = 0; i < one.length; i++) one[i] = b[i * 3] + b[i * 3 + 1] + b[i * 3 + 2];
        return fxTex(w, h, 'r', one);
      }
      var mid = fxTex(w, h, 'r'), out = fxTex(w, h, 'r'), f1 = fxTarget(mid), f2;
      gl.useProgram(fxG.blur); gl.viewport(0, 0, w, h);
      gl.uniform1i(fxUni(fxG.blur, 'u_r'), r); gl.uniform1i(fxUni(fxG.blur, 'u_W'), w); gl.uniform1i(fxUni(fxG.blur, 'u_H'), h); gl.uniform1i(fxUni(fxG.blur, 'u_in'), 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, adj.gt.src);
      gl.uniform1i(fxUni(fxG.blur, 'u_dir'), 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      f2 = fxTarget(out); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mid);
      gl.uniform1i(fxUni(fxG.blur, 'u_dir'), 1); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(f1); gl.deleteFramebuffer(f2); gl.deleteTexture(mid);
      return out;
    }
    // (the blocks for a block size: worked once for each size, and kept; a
    // chip that can't draw into float textures gets them from the same sums
    // as the main thread's)
    // (the blurred layer, worked once for each blur, and kept)
    function fxGLBlurTex(B) {
      var gl = fxG.gl, T = adj.gt, W2 = adj.gw, H2 = adj.gh, key = JSON.stringify(B);
      if (T.bsrc && T.bkey === key) return T.bsrc;
      if (T.bsrc) { gl.deleteTexture(T.bsrc); T.bsrc = null; }
      // (a chip that can't draw into float textures: the processor's sums, sent up)
      if (!fxG.float) { var d0 = adj.gsrc || (adj.gsrc = adj.L.ctx.getImageData(0, 0, W2, H2).data); adj.gbsArr = fxBlurRun(B, d0, W2, H2); T.bsrc = fxTex(W2, H2, '', new Uint8Array(adj.gbsArr.buffer)); T.bkey = key; return T.bsrc; }
      var f = B.f, w = Math.ceil(W2 / f), h = Math.ceil(H2 / f), fmt = w * h > 2e6 ? 'h' : 'f', A = fxTex(w, h, fmt), C = fxTex(w, h, fmt), tmp;
      var i1 = function (p, n, v) { gl.uniform1i(fxUni(p, n), v); };
      var run = function (p, out, ow, oh, input, set) {
        var fb = fxTarget(out); gl.useProgram(p); gl.viewport(0, 0, ow, oh);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, input); i1(p, 'u_in', 0); set(p);
        gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb);
      };
      run(fxG.bd, A, w, h, T.src, function (p) { i1(p, 'u_f', f); i1(p, 'u_W', W2); i1(p, 'u_H', H2); });
      if (B.br) B.br.forEach(function (r) {
        if (!r) return;
        run(fxG.bb, C, w, h, A, function (p) { i1(p, 'u_r', r); i1(p, 'u_dir', 0); i1(p, 'u_w', w); i1(p, 'u_h', h); });
        run(fxG.bb, A, w, h, C, function (p) { i1(p, 'u_r', r); i1(p, 'u_dir', 1); i1(p, 'u_w', w); i1(p, 'u_h', h); });
      });
      var mot = function (N, sp) { run(fxG.bm, C, w, h, A, function (p) { i1(p, 'u_N', N); gl.uniform1f(fxUni(p, 'u_sp'), sp); gl.uniform2f(fxUni(p, 'u_d'), B.dx, B.dy); i1(p, 'u_w', w); i1(p, 'u_h', h); }); tmp = A; A = C; C = tmp; };
      if (B.n1 > 1) mot(B.n1, B.s1);
      if (B.n2 > 1) mot(B.n2, B.s1 / B.n2);
      var out = fxTex(W2, H2, '');
      run(fxG.bu, out, W2, H2, A, function (p) { i1(p, 'u_f', f); i1(p, 'u_w', w); i1(p, 'u_h', h); });
      gl.deleteTexture(A); gl.deleteTexture(C);
      T.bsrc = out; T.bkey = key; return out;
    }
    function fxGLPix(b, bsrc) {
      var gl = fxG.gl, T = adj.gt, w = adj.gw, h = adj.gh, nx = Math.ceil(w / b), ny = Math.ceil(h / b), pk = b + '|' + (bsrc ? T.bkey : '');
      if (T.pix && T.pixB === pk) return T.pix;
      if (T.pix) { gl.deleteTexture(T.pix); T.pix = null; }
      if (!fxG.float) {
        var d = bsrc ? adj.gbsArr : adj.gsrc || (adj.gsrc = adj.L.ctx.getImageData(0, 0, w, h).data), one = new Float32Array(nx * ny * 4);
        for (var by = 0; by < ny; by++) for (var bx = 0; bx < nx; bx++) {
          var t0 = 0, t1 = 0, t2 = 0, ta = 0, n = 0;
          for (var y = by * b; y < Math.min(h, by * b + b); y++) for (var x = bx * b, k = (y * w + x) * 4; x < Math.min(w, bx * b + b); x++, k += 4) { var a = d[k + 3]; t0 += d[k] * a; t1 += d[k + 1] * a; t2 += d[k + 2] * a; ta += a; n++; }
          var o = (by * nx + bx) * 4; one[o + 3] = Math.round(ta / n); if (ta) { one[o] = Math.round(t0 / ta); one[o + 1] = Math.round(t1 / ta); one[o + 2] = Math.round(t2 / ta); }
        }
        T.pix = fxTex(nx, ny, 'f', one); T.pixB = pk; return T.pix;
      }
      var mid = fxTex(nx, h, 'f'), out = fxTex(nx, ny, 'f'), f1 = fxTarget(mid), f2, Pg = fxG.pix;
      gl.useProgram(Pg); gl.viewport(0, 0, nx, h);
      gl.uniform1i(fxUni(Pg, 'u_b'), b); gl.uniform1i(fxUni(Pg, 'u_W'), w); gl.uniform1i(fxUni(Pg, 'u_H'), h); gl.uniform1i(fxUni(Pg, 'u_in'), 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bsrc || T.src);
      gl.uniform1i(fxUni(Pg, 'u_dir'), 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      f2 = fxTarget(out); gl.viewport(0, 0, nx, ny); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mid);
      gl.uniform1i(fxUni(Pg, 'u_dir'), 1); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(f1); gl.deleteFramebuffer(f2); gl.deleteTexture(mid);
      T.pix = out; T.pixB = pk; return out;
    }
    // (the effect, drawn: on the stand-in canvas, or, flip 0, the right way
    // up into a texture to be read back when it's kept)
    function fxGLDraw(P, toTex) {
      var gl = fxG.gl, T = adj.gt, w = adj.gw, h = adj.gh, M = fxG.main;
      if (P.cl && !T.wide) T.wide = fxGLBlur(P.wideR);
      var bsrc = P.bl ? fxGLBlurTex(P.bl) : null, pix = P.px ? fxGLPix(P.px, bsrc) : null;
      var lt = new Float32Array(256 * 2 * 4);
      for (var i = 0; i < 256; i++) { lt[i * 4] = P.lut[i]; lt[i * 4 + 1] = P.blut[i]; if (P.gm) { lt[1024 + i * 4] = P.gm[i * 3]; lt[1025 + i * 4] = P.gm[i * 3 + 1]; lt[1026 + i * 4] = P.gm[i * 3 + 2]; } }
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.lut); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 2, gl.RGBA, gl.FLOAT, lt);
      var units = [['u_src', T.src], ['u_mask', T.mask || T.src], ['u_lut', T.lut], ['u_wide', T.wide || T.src], ['u_pix', pix || T.lut], ['u_bsrc', bsrc || T.src]];
      gl.useProgram(M);
      units.forEach(function (q, n) { gl.activeTexture(gl.TEXTURE0 + n); gl.bindTexture(gl.TEXTURE_2D, q[1]); gl.uniform1i(fxUni(M, q[0]), n); });
      var i1 = function (n, v) { gl.uniform1i(fxUni(M, n), v); }, f1 = function (n, v) { gl.uniform1f(fxUni(M, n), v); };
      i1('u_hasMask', T.mask ? 1 : 0); i1('u_flip', toTex ? 0 : 1); i1('u_W', w); i1('u_H', h); i1('u_gm', P.gm ? 1 : 0); i1('u_px', pix ? P.px : 0); i1('u_hasBl', bsrc ? 1 : 0);
      f1('u_shp', P.shp); f1('u_cl', P.cl); f1('u_br', P.br); f1('u_sat', P.sat); f1('u_vib', P.vib); f1('u_hu', P.hu); f1('u_hc', P.hc); f1('u_hs', P.hs);
      f1('u_lt', P.lt); f1('u_wa', P.wa); f1('u_ti', P.ti); f1('u_gms', P.gms); f1('u_vg', P.vg); f1('u_gr', P.gr);
      gl.uniform2f(fxUni(M, 'u_c'), w / 2, h / 2); f1('u_rr', 1 / Math.hypot(w / 2, h / 2));
      var tex = null, fb = null;
      if (toTex) { tex = fxTex(w, h, ''); fb = fxTarget(tex); } else gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h); gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!toTex) return null;
      var px = new Uint8ClampedArray(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteTexture(tex);
      return new ImageData(px, w, h);
    }
    // (the stand-in canvas takes the layer's place, the same size, blend and see-through-ness)
    function fxGLShow(on) {
      var L = adj.L, c = fxG.cv;
      if (on) {
        c.width = adj.gw; c.height = adj.gh; c.style.width = L.cv.style.width; c.style.height = L.cv.style.height;
        if (!adj.hidSet) { adj.hid = L.cv.style.visibility; adj.hidSet = true; } // (how the layer was seen, to put back)
        c.style.opacity = L.cv.style.opacity; c.style.mixBlendMode = L.cv.style.mixBlendMode; c.style.visibility = adj.hid;
        L.cv.parentNode.insertBefore(c, L.cv.nextSibling); L.cv.style.visibility = 'hidden';
      } else {
        if (c.parentNode) c.parentNode.removeChild(c);
        L.cv.style.visibility = adj.hid || '';
      }
    }
    function fxGLFree() {
      var T = adj && adj.gt; if (!T || !fxG || !fxG.gl) return;
      var gl = fxG.gl; ['src', 'mask', 'lut', 'wide', 'pix', 'bsrc'].forEach(function (k) { if (T[k]) gl.deleteTexture(T[k]); });
      adj.gt = null; adj.gsrc = null; adj.gbsArr = null;
    }
    // (the graphics chip went away mid-way: carry on without it)
    function fxToCPU() { try { fxGLShow(false); } catch (x) {} adj.gt = null; adj.mode = fxWorker() ? 'worker' : 'cpu'; fxSource(); adjustQueue(); }
    // (the layer's own pixels and the selection's, for the main thread and the worker)
    function fxSource() {
      if (adj.src) return;
      var cv = adj.L.cv; adj.src = adj.L.ctx.getImageData(0, 0, cv.width, cv.height);
      adj.mask = adj.selOn ? selPixels() : null; adj.box = maskBox(adj.mask, cv.width, cv.height);
      if (adj.mode === 'worker') { adj.sid = ++fxSid; var cp = new Uint8ClampedArray(adj.src.data), mc = adj.mask ? new Uint8ClampedArray(adj.mask) : null; fxW.postMessage({ t: 'src', s: cp, m: mc, W: cv.width, H: cv.height, box: adj.box }, mc ? [cp.buffer, mc.buffer] : [cp.buffer]); adj.prev = fxPrevMake(); }
    }
    // (the selection as a picture, for the graphics chip)
    function selCanvas() { var m = document.createElement('canvas'); m.width = ov.width; m.height = ov.height; var x = m.getContext('2d'); base(x); if (sel.mask) x.drawImage(sel.mask, sel.x, sel.y, sel.w, sel.h); else { selPath(x); x.fill(); } return m; }

    function adjustOpen(resume) {
      if (!resume && !adj && !adjBox.hidden) { adjustClose(); return; }
      if (!pc.hidden) picker(null);
      if (adj) { var was = adj.finishing; adjustDone(); if (!was) return; }
      if (typeof bsBox !== 'undefined' && !bsBox.hidden) studio(false);
      if (!active) return;
      if (textBox) commitText(); openMenu(null); layerPanel(false); anchor();
      var cv = active.cv;
      adj = { L: active, src: null, out: null, mask: null, box: null, selOn: !!sel, v: {}, blur: null, wide: null, queued: false, hist: null, ver: 0, shown: 0, mode: 'cpu' };
      // the graphics chip if it can (the layer seen on its own, and not too
      // big for it); otherwise the worker; otherwise the main thread
      var g = !usesView(active) && fxGLMake();
      if (g && cv.width <= g.max && cv.height <= g.max) { adj.mode = 'gl'; adj.gw = cv.width; adj.gh = cv.height; }
      else adj.mode = fxWorker() ? 'worker' : 'cpu';
      // (the copies it works from are made when a slider first moves, or once
      // the panel has popped open, so opening it is instant)
      adj.prepT = setTimeout(function () { if (adj) fxPrepare(); }, 420);
      Array.prototype.forEach.call(adjBox.querySelectorAll('input[data-adj]'), function (i) { i.value = i.dataset.def || 0; i.previousElementSibling.textContent = i.value; });
      adjBox.querySelector('.pa-sub').textContent = sel ? 'Inside the selection' : active.name;
      adjBox.hidden = false; fxMarks(true); fxShown('levels'); fxShown('curves'); ctxEl.classList.add('aside'); // (the tool panel steps aside while Effects is open)
      dockPlace(adjBox); dockSync(ctxReady);
      if (adjBox.parentNode === left) { adjBox.style.top = Math.max(0, Math.min($('[data-act="adjust"]').offsetTop - 40, left.clientHeight - adjBox.offsetHeight)) + 'px'; keepOnScreen(adjBox); }
      $('[data-act="adjust"]').setAttribute('aria-expanded', 'true');
    }
    function fxPrepare() {
      if (adj.ready) return; adj.ready = true; clearTimeout(adj.prepT);
      if (adj.mode === 'gl') {
        try { adj.gt = { src: fxTex(0, 0, 'img', adj.L.cv), mask: adj.selOn && sel ? fxTex(0, 0, 'img', selCanvas()) : null, lut: fxTex(256, 2, 'f') }; return; }
        catch (x) { fxGLFree(); adj.gt = null; adj.mode = fxWorker() ? 'worker' : 'cpu'; }
      }
      fxSource();
    }
    function adjustClose(keepOpen) {
      if (adj) {
        clearTimeout(adj.prepT);
        if (adj.mode === 'gl') { fxGLShow(false); fxGLFree(); }
        if (adj.mode === 'worker' && fxW) { clearTimeout(adj.settle); fxPrevShow(false); fxW.postMessage({ t: 'end' }); } // (the worker lets its copies go)
      }
      adj = null; adjBox.hidden = !keepOpen; delete adjBox.dataset.finishing; $('[data-act="adjust"]').setAttribute('aria-expanded', keepOpen ? 'true' : 'false'); ctxAside(); dockSync(ctxReady);
    }
    function adjustPut(img) { var c = adj.L.ctx; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.putImageData(img, 0, 0); c.restore(); if (usesView(adj.L)) viewOf(adj.L); }
    // KEPT: the full-size result, worked out once (by the graphics chip, or
    // by the same sums as the live look), laid on the layer as one step
    function adjustKeep() {
      var before;
      if (adj.mode === 'gl') {
        before = adj.L.ctx.getImageData(0, 0, adj.gw, adj.gh); // (the layer itself was never touched: it's as it was)
        var out = null; try { out = fxGLDraw(fxParams(), true); } catch (x) { out = null; }
        if (!out) { fxGLShow(false); fxGLFree(); adj.mode = 'cpu'; fxSource(); adjustRender(); } else adjustPut(out);
      } else {
        before = adj.src;
        if (adj.shown !== adj.ver || adj.queued) adjustRender(); // (unless the full-size look is already the one wanted)
      }
      push({ L: adj.L, data: before, text: adj.L.text, label: 'Effects' }); if (adj.L.text) { adj.L.text = null; renderLayers(); }
    }
    // (the worker is still on the full size: it's kept as soon as it's here)
    function adjustWait() {
      clearTimeout(adj.settle);
      if (!adj.queued) { var full = { P: fxParams(), ver: adj.ver }; if (adj.busy) adj.want = full; else fxPost(full); }
    }
    // CLOSING (another tool, undo, saving...): what's set is kept, and the panel goes
    function adjustDone(keepOpen) {
      if (!adj) { if (!keepOpen && !adjBox.hidden) adjustClose(); return; }
      if (adjChanged()) {
        fxPrepare();
        if (!keepOpen && adj.mode === 'worker' && !adj.finishing && adj.shown !== adj.ver) {
          // (the panel goes now, and the full size goes down as soon as it's
          // ready; anything done before then finishes it first, here)
          adj.finishing = true; adj.applying = false; adjBox.dataset.finishing = '1';
          adjBox.hidden = true; ctxEl.classList.remove('aside'); $('[data-act="adjust"]').setAttribute('aria-expanded', 'false');
          ctxAside(); dockSync(ctxReady); adjustWait(); return;
        }
        adjustKeep();
      } else if (adj.mode !== 'gl' && adj.src) adjustPut(adj.src);
      adjustClose(keepOpen);
    }
    // DONE: what's set is kept (one step, to undo) and the sliders go back
    // to the start, the panel staying open for the next effect, which works
    // on the picture as it now is. Done with nothing set closes the panel.
    function adjustApply() {
      if (!adj || adj.finishing) return;
      if (!adjChanged()) { adjustDone(); return; }
      fxPrepare();
      if (adj.mode === 'worker' && adj.shown !== adj.ver) { if (!adj.applying) { adj.applying = true; adjBox.dataset.finishing = '1'; adjustWait(); } return; }
      adj.applying = false; delete adjBox.dataset.finishing;
      adjustKeep(); adjustRebase();
      toast('Applied (undo takes it back). Ready for the next effect');
    }
    // (starting again from the layer as it is: the copies made from it go,
    // to be made again when a slider next moves, and every slider is back
    // at its start)
    function adjustRebase() {
      clearTimeout(adj.prepT);
      if (adj.mode === 'gl') { fxGLShow(false); fxGLFree(); }
      if (adj.mode === 'worker') { clearTimeout(adj.settle); fxPrevShow(false); adj.prev = null; adj.busy = false; adj.want = null; }
      adj.src = adj.out = adj.mask = adj.box = adj.blur = adj.wide = adj.hist = adj.bs = adj.bkey = null; adj.ready = false; adj.queued = false;
      adj.selOn = adj.selOn && !!sel; adj.v = {}; adj.ver++; adj.shown = adj.ver;
      Array.prototype.forEach.call(adjBox.querySelectorAll('input[data-adj]'), function (i) { i.value = i.dataset.def || 0; i.previousElementSibling.textContent = i.value; });
      fxMarks(true); fxShown('levels'); fxShown('curves');
      adj.prepT = setTimeout(function () { if (adj) fxPrepare(); }, 420);
    }
    function adjustCancel() { if (!adj) return; if (adj.mode !== 'gl' && adj.src) adjustPut(adj.src); adjustClose(); }
    function adjustQueue(hue) { adj.ver++; fxMarks(hue); if (adj.queued) return; adj.queued = true; requestAnimationFrame(function () { if (adj && adj.queued) adjustLive(); }); }
    // THE LIVE LOOK, once a frame at most: drawn by the graphics chip, or
    // asked of the worker (the newest settings only), or worked out here
    function adjustLive() {
      adj.queued = false; fxPrepare();
      if (adj.mode === 'gl') {
        try {
          if (fxG.cv.previousSibling !== adj.L.cv) fxGLShow(true); // (the layers were laid out again: back in its place)
          fxGLDraw(fxParams(), false); adj.shown = adj.ver; return;
        } catch (x) { fxToCPU(); return; }
      }
      if (adj.mode === 'worker') {
        var P = fxParams(), job = adj.prev && !adj.finishing && !adj.applying ? { P: fxPrevP(P), ver: adj.ver, prev: true } : { P: P, ver: adj.ver };
        if (adj.busy) adj.want = job; else fxPost(job);
        if (adj.prev && !adj.finishing && !adj.applying) { clearTimeout(adj.settle); adj.settle = setTimeout(function () { if (!adj || adj.mode !== 'worker') return; var full = { P: fxParams(), ver: adj.ver }; if (adj.busy) adj.want = full; else fxPost(full); }, 180); }
        return;
      }
      adjustRender();
    }
    // a soft copy of the layer (a box blur, one way then the other), for
    // sharpen (small) and clarity (wide)
    function boxBlur(d, w, h, r) {
      var a = new Float32Array(w * h * 3), b = new Float32Array(w * h * 3), x, y, c, n = 2 * r + 1;
      for (y = 0; y < h; y++) for (c = 0; c < 3; c++) {
        var s = 0, row = y * w;
        for (x = -r; x <= r; x++) s += d[(row + Math.min(w - 1, Math.max(0, x))) * 4 + c];
        for (x = 0; x < w; x++) { a[(row + x) * 3 + c] = s / n; s += d[(row + Math.min(w - 1, x + r + 1)) * 4 + c] - d[(row + Math.max(0, x - r)) * 4 + c]; }
      }
      // (then down the columns, all of them at once, a row at a time: the
      // same sums, in the same order, but reading the memory in its order)
      var w3 = w * 3, T = new Float64Array(w3), i, o, p, q;
      for (y = -r; y <= r; y++) { o = Math.min(h - 1, Math.max(0, y)) * w3; for (i = 0; i < w3; i++) T[i] += a[o + i]; }
      for (y = 0; y < h; y++) {
        o = y * w3; p = Math.min(h - 1, y + r + 1) * w3; q = Math.max(0, y - r) * w3;
        for (i = 0; i < w3; i++) { b[o + i] = T[i] / n; T[i] += a[p + i] - a[q + i]; }
      }
      return b;
    }
    function sstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
    // (on the main thread: the full size, for keeping, or when there's no worker)
    function adjustRender() {
      adj.queued = false; fxSource();
      var P = fxParams(), s = adj.src.data, W2 = adj.src.width, H2 = adj.src.height;
      if (!adj.out) adj.out = new ImageData(new Uint8ClampedArray(s), W2, H2);
      if (P.shp && !adj.blur) adj.blur = boxBlur(s, W2, H2, 1);
      if (P.cl && !adj.wide) adj.wide = boxBlur(s, W2, H2, P.wideR);
      var bs = null; if (P.bl) { var bk = JSON.stringify(P.bl); if (adj.bkey !== bk) { adj.bs = fxBlurRun(P.bl, s, W2, H2); adj.bkey = bk; } bs = adj.bs; }
      fxKernel(P, s, adj.out.data, adj.mask, adj.blur, adj.wide, W2, H2, adj.box, bs);
      adjustPut(adj.out); adj.shown = adj.ver;
    }
    adjBox.addEventListener('click', function (e) {
      if (!adj) return;
      var g = e.target.closest('[data-gm]'); if (g) { if (g.dataset.gm) adj.v.gmap = g.dataset.gm; else delete adj.v.gmap; adjustQueue(); return; }
      if (e.target.closest('[data-gmrev]')) { adj.v.gmr = !adj.v.gmr; if (!adj.v.gmap) adj.v.gmap = 'colours'; adjustQueue(); return; }
      var rs = e.target.closest('[data-fx-reset]'); if (rs) { fxReset(rs.dataset.fxReset); return; }
      var fd = e.target.closest('[data-fxdir]');
      if (fd) { var ai = adjBox.querySelector('[data-adj="mangle"]'); ai.value = fd.dataset.fxdir; ai.previousElementSibling.textContent = ai.value; adj.v.mangle = +ai.value; adjustQueue(); return; }
    });
    adjBox.addEventListener('input', function (e) {
      var i = e.target.closest('[data-adj]'); if (!i || !adj || adj.applying) return;
      adj.v[i.dataset.adj] = +i.value; i.previousElementSibling.textContent = i.value; adjustQueue(i.dataset.adj === 'hue');
    });
    // double-click (or double-tap) a slider's name to put it back to 0
    adjBox.addEventListener('dblclick', function (e) {
      var row = e.target.closest('[data-adj-row]'); if (!row || !adj) return;
      var i = row.querySelector('input'); i.value = i.dataset.def || 0; i.previousElementSibling.textContent = i.value; adj.v[i.dataset.adj] = +i.value; adjustQueue(i.dataset.adj === 'hue');
    });

    // ---- THE BRUSH STUDIO: the brush in hand's settings, with a stroke of
    // it (pressed lightly, then hard, then lightly) to show what they do ----
    var BS_SECS = [
      ['tip', 'Tip', ['stamp']],
      ['jitter', 'Jitter', ['stamp']],
      ['pressure', 'Pressure', ['round', 'pencil', 'marker', 'highlighter', 'calligraphy', 'stamp']],
      ['taper', 'Tapered Ends', ['round', 'pencil', 'stamp']],
      ['nib', 'Nib', ['marker', 'highlighter', 'calligraphy']],
      ['grain', 'Paper Grain', ['round', 'pencil', 'feather', 'marker', 'highlighter', 'calligraphy', 'stamp']]
    ];
    // (each setting: key, name, lowest, highest, and which kinds of brush have it)
    var BS_ROWS = {
      tip: [['spacing', 'Spacing', 2, 200]],
      jitter: [['scatter', 'Scatter', 0, 100], ['jsize', 'Size', 0, 100], ['jopacity', 'Opacity', 0, 100], ['jangle', 'Angle', 0, 100]],
      pressure: [['psize', 'Size', 0, 100], ['popacity', 'Opacity', 0, 100, ['stamp']], ['curve', 'Soft ↔ Firm', -100, 100]],
      taper: [['tin', 'Start', 0, 200], ['tout', 'End', 0, 200]],
      nib: [['angle', 'Angle', -90, 90]],
      grain: [['grain', 'Grain', 0, 100]]
    };
    var bsBox = document.createElement('div'), bsId = null;
    bsBox.className = 'paint-adjust paint-studio'; bsBox.hidden = true; bsBox.setAttribute('role', 'dialog'); bsBox.setAttribute('aria-label', 'Brush Studio');
    left.appendChild(bsBox);
    draggable(bsBox, '.pa-title', 'studio');
    function studio(open) {
      if (!open) { bsBox.hidden = true; bsId = null; ctxEl.classList.remove('aside'); return; }
      if (adj) adjustDone();
      bsId = st.brush; studioBuild(); bsBox.hidden = false; ctxEl.classList.add('aside'); studioPreview(); // (again, now it can be measured)
      bsBox.style.top = Math.max(0, Math.min(left.clientHeight - bsBox.offsetHeight, 40)) + 'px'; keepOnScreen(bsBox);
      if (narrow()) picker(null);
    }
    function studioBuild() {
      var D = bdef(bsId), k = D.base, S = D.set;
      var row = function (r) {
        return '<label class="pa-row" data-adj-row="' + r[0] + '"><span>' + r[1] + '</span><output>' + S[r[0]] + '</output>' +
          '<input type="range" min="' + r[2] + '" max="' + r[3] + '" step="1" value="' + S[r[0]] + '" data-bs="' + r[0] + '"></label>';
      };
      var secs = BS_SECS.filter(function (q) { return q[2].indexOf(k) >= 0; }).map(function (q) {
        var body = (q[0] === 'tip' ? '<div class="gm-list bs-tips" role="radiogroup" aria-label="Tip">' + TIPS.map(function (t) { return '<button type="button" class="gm-chip" role="radio" data-bs-tip="' + t[0] + '" aria-checked="' + (S.tip === t[0]) + '"><canvas class="bs-tip" data-tipprev="' + t[0] + '" aria-hidden="true"></canvas><span>' + t[1] + '</span></button>'; }).join('') + '</div>' : '') +
          '<div class="pa-list">' + BS_ROWS[q[0]].filter(function (r) { return !r[4] || r[4].indexOf(k) >= 0; }).map(row).join('') + '</div>';
        var was = null; try { was = localStorage.getItem('paint-bs-' + q[0]); } catch (x) {}
        return '<section class="pr-sec fx-sec' + (was === 'closed' ? ' closed' : '') + '" data-bsec="' + q[0] + '"><div class="fx-head"><button type="button" class="pr-head" aria-expanded="' + (was !== 'closed') + '"><span>' + q[1] + '</span>' + FX_CHEV + '</button></div>' +
          '<div class="pr-body"><div class="pr-in">' + body + '</div></div></section>';
      }).join('');
      var edited = !D.mine && brushEdits[bsId] && Object.keys(brushEdits[bsId]).length;
      bsBox.innerHTML = '<div class="pa-title">Brush Studio <span class="pa-sub">' + (D.mine ? 'My brush' : D.name) + '</span></div>' +
        (D.mine ? '<label class="bs-name"><span>Name</span><input type="text" class="p-field" maxlength="24" data-bs-name value="' + D.name.replace(/"/g, '&quot;') + '"></label>' : '') +
        (secs || '<p class="cv-help">This brush has no settings to change. Save it as a new brush to make one of your own from it.</p>') +
        // (the stroke stays in view at the foot, above the buttons, while the settings scroll)
        '<div class="bs-foot"><canvas class="bs-prev" aria-label="How the brush looks"></canvas><div class="pa-acts">' + (D.mine ? '<button type="button" data-bs-act="delete" class="bs-del">Delete</button>' : '<button type="button" data-bs-act="reset"' + (edited ? '' : ' disabled') + '>Reset</button>') +
        '<button type="button" data-bs-act="saveas" data-tip="Keep these settings as a brush of your own">Save Copy</button><button type="button" data-adj-act="done" data-bs-act="done">Done</button></div></div>';
      Array.prototype.forEach.call(bsBox.querySelectorAll('[data-tipprev]'), function (c) {
        var d = Math.min(window.devicePixelRatio || 1, 2); c.width = c.height = 22 * d; c.style.width = c.style.height = '22px';
        c.getContext('2d').drawImage(tipOf(c.dataset.tipprev, getComputedStyle(bsBox).color), 0, 0, c.width, c.height);
      });
      studioPreview();
    }
    function studioPreview() {
      var c = bsBox.querySelector('.bs-prev'); if (!c) return;
      c.style.width = c.style.height = ''; // (the size the panel gives it, not the last drawing's)
      var w = (c.clientWidth || 222), P = [], sz = Math.max(6, Math.min(26, st.size)), h = c.clientHeight || 64;
      for (var i = 0; i <= 40; i++) { var t = i / 40; P.push({ x: 14 + (w - 28) * t, y: h / 2 + Math.sin(t * Math.PI * 2) * h * 0.19, pr: 0.15 + 0.85 * Math.sin(t * Math.PI) }); }
      // (in the panel's own ink, so it always shows against it)
      drawPreview(c, bsId, sz, getComputedStyle(bsBox).color, P, w, h, 1, true);
    }
    function studioSet(key, v) {
      var D = bdef(bsId);
      if (D.mine) { myBrushes.forEach(function (b) { if (b.id === bsId) b.set[key] = v; }); storeIt('paint-my-brushes', myBrushes); }
      else { (brushEdits[bsId] = brushEdits[bsId] || {})[key] = v; storeIt('paint-brush-edits', brushEdits); var rs = bsBox.querySelector('[data-bs-act="reset"]'); if (rs) rs.disabled = false; }
      studioPreview(); brushSamples();
    }
    bsBox.addEventListener('input', function (e) {
      var i = e.target.closest('[data-bs]'); if (i) { i.previousElementSibling.textContent = i.value; studioSet(i.dataset.bs, +i.value); return; }
      var nm = e.target.closest('[data-bs-name]');
      if (nm && nm.value.trim()) { myBrushes.forEach(function (b) { if (b.id === bsId) b.name = nm.value.trim(); }); storeIt('paint-my-brushes', myBrushes); ctxSync(); }
    });
    bsBox.addEventListener('keydown', function (e) { if (e.target.closest('[data-bs-name]')) e.stopPropagation(); });
    bsBox.addEventListener('dblclick', function (e) {
      // (a setting's name, double-clicked: back as the brush was made)
      var row = e.target.closest('[data-adj-row]'); if (!row) return;
      var i = row.querySelector('[data-bs]'), D = BDEF[bdef(bsId).base]; if (!i || !(i.dataset.bs in D)) return;
      i.value = D[i.dataset.bs]; i.previousElementSibling.textContent = i.value; studioSet(i.dataset.bs, D[i.dataset.bs]);
    });
    bsBox.addEventListener('click', function (e) {
      var hd = e.target.closest('.pr-head');
      if (hd) { var sec = hd.closest('.fx-sec'), on = !sec.classList.contains('closed'); sec.classList.toggle('closed', on); hd.setAttribute('aria-expanded', on ? 'false' : 'true'); try { localStorage.setItem('paint-bs-' + sec.dataset.bsec, on ? 'closed' : 'open'); } catch (x) {} return; }
      var tp = e.target.closest('[data-bs-tip]');
      if (tp) { studioSet('tip', tp.dataset.bsTip); Array.prototype.forEach.call(bsBox.querySelectorAll('[data-bs-tip]'), function (b) { b.setAttribute('aria-checked', b === tp ? 'true' : 'false'); }); return; }
      var a = e.target.closest('[data-bs-act]'); if (!a) return;
      var w = a.dataset.bsAct, D = bdef(bsId);
      if (w === 'done') { studio(false); return; }
      if (w === 'reset') { delete brushEdits[bsId]; storeIt('paint-brush-edits', brushEdits); studioBuild(); brushSamples(); return; }
      if (w === 'delete') { myBrushes = myBrushes.filter(function (b) { return b.id !== bsId; }); storeIt('paint-my-brushes', myBrushes); if (st.brush === bsId) st.brush = 'round'; studio(false); ctxSync(); brushSamples(); toast('Brush deleted'); return; }
      if (w === 'saveas') { newBrush(D.base, D.set, D.name + ' copy'); return; }
    });
    // a brush of your own: from the one in hand, or a new stamp brush
    function newBrush(base, set, name) {
      var n = 1; while (myBrushes.some(function (b) { return b.id === 'u' + n; })) n++;
      var cp = {}; for (var k in set) cp[k] = set[k];
      myBrushes.push({ id: 'u' + n, name: (name || 'Brush ' + n).slice(0, 24), base: base, set: cp });
      storeIt('paint-my-brushes', myBrushes);
      st.brush = 'u' + n; if (st.tool !== 'brush') setTool('brush'); ctxSync(); brushSamples(); studio(true);
      toast('Saved as a new brush, in My Brushes');
    }

    // ---- the mouse's brush-size ring ----
    // (a ring on the screen, so it can follow an Apple Pencil, hovering or drawing)
    var ringEl = document.createElement('div'); ringEl.className = 'paint-ring'; ringEl.hidden = true; stage.appendChild(ringEl);
    function brushR() {
      if (st.tool === 'brush') { var b = { highlighter: Math.max(10, st.size * 2.2), pencil: Math.max(1, st.size * 0.38), marker: Math.max(3, st.size * 1.1), calligraphy: Math.max(4, st.size * 1.5), spray: Math.max(5, st.size * 1.6) * 2 }[baseOf(st.brush)]; if (b) return b / 2; }
      return /smudge|blur|tone/.test(st.tool) ? Math.max(4, st.size) : st.size / 2;
    }
    function showRing(p) {
      if (!p || !/brush|eraser|smudge|blur|tone/.test(st.tool) || spaceGrab) { ringEl.hidden = true; return; }
      var d = Math.max(2, brushR() * 2 * view.k);
      ringEl.hidden = false; ringEl.style.width = ringEl.style.height = d + 'px';
      var sp = toScreen(p); ringEl.style.transform = 'translate(' + (sp.x - d / 2) + 'px,' + (sp.y - d / 2) + 'px)';
    }
    function hideRing() { ringEl.hidden = true; }
    function ring(p) { octx.clearRect(0, 0, W, H); showRing(p); }

    // ---- while the size or opacity slider moves: the brush, shown big in
    // the middle of the picture, at its real size and see-through-ness ----
    // (a short stroke of the real brush, drawn by the engine at its real
    // size on screen, opacity and all)
    var prev = document.createElement('div'), prevTimer = 0;
    prev.className = 'paint-preview'; prev.innerHTML = '<canvas aria-hidden="true"></canvas>'; stage.appendChild(prev);
    function preview() {
      var k = st.tool === 'eraser' ? 'eraser' : st.tool === 'brush' ? st.brush : 'round';
      // what a single click (or tap) puts down, at the size it really is
      // (unless that wouldn't fit on the picture), in the middle of the card
      var cfg = baseOf(k) === 'spray' ? null : brushCfg(k, st.size, '#000');
      var reach = cfg ? (cfg.len ? cfg.len / 2 + cfg.thick : cfg.w / 2 + (cfg.blur || 0) * 1.7) + 1 : sprayRadius(st.size) * 1.35;
      var fit2 = Math.min(1, Math.min(stage.clientWidth, stage.clientHeight) * 0.8 / (reach * 2 * view.k)), unit = view.k * fit2;
      var wU = Math.max(reach * 2, 28 / unit);
      drawPreview(prev.firstChild, k, st.size, k === 'eraser' ? '#000' : st.color, [{ x: wU / 2, y: wU / 2 }], wU, wU, unit);
      prev.classList.add('on'); clearTimeout(prevTimer);
      if (!sliderHeld) prevTimer = setTimeout(hidePreview, 900);
      brushSamples();
    }
    // draw a stroke of brush k along P (in units) onto canvas cv, wU x hU
    // units big, at `unit` screen pixels per unit; shown at the brush's
    // opacity (and blend)
    function drawPreview(cv, k, size, color, P, wU, hU, unit, flat) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), px = unit * dpr;
      cv.width = Math.max(1, Math.round(wU * px)); cv.height = Math.max(1, Math.round(hU * px));
      cv.style.width = wU * unit + 'px'; cv.style.height = hU * unit + 'px';
      var x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); x.setTransform(px, 0, 0, px, 0, 0);
      if (baseOf(k) === 'spray') {
        // (just as it's sprayed: a puff where it starts, then one every so often along the way)
        var gap = Math.max(2, sprayRadius(size) * 0.3), left = 0;
        spray(x, P[0], size, color, 1);
        for (var i = 1; i < P.length; i++) {
          var a = P[i - 1], b = P[i], d = Math.hypot(b.x - a.x, b.y - a.y);
          for (var t = gap - left; t <= d; t += gap) spray(x, { x: a.x + (b.x - a.x) * t / d, y: a.y + (b.y - a.y) * t / d }, size, color, 0.5);
          left = (left + d) % gap;
        }
      } else {
        var cfg = brushCfg(k, size, color);
        strokeOn(x, resample(P, cfg.step), cfg, { preview: true }, px, null, null);
        // (the eraser shows what it leaves: see-through, as a checkerboard,
        // on the card's white paper)
        if (k === 'eraser') {
          var t = document.createElement('canvas'); t.width = t.height = 10;
          var tx = t.getContext('2d'); tx.fillStyle = '#fff'; tx.fillRect(0, 0, 10, 10); tx.fillStyle = '#dcdcdc'; tx.fillRect(0, 0, 5, 5); tx.fillRect(5, 5, 5, 5);
          x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = x.createPattern(t, 'repeat'); x.fillRect(0, 0, cv.width, cv.height); x.restore();
        }
      }
      var lk = k === 'eraser' ? { alpha: 1 } : strokeLook(k);
      cv.style.opacity = lk.alpha; cv.style.mixBlendMode = (!flat && lk.mode) || '';
    }
    function hidePreview() { clearTimeout(prevTimer); prev.classList.remove('on'); }
    // it stays up while a slider is held, and goes once it's let go. The
    // letting go is heard anywhere on the page, not just on the slider: the
    // pointer often ends up off it (above all when it's pulled right down to
    // the smallest size), and some browsers (Safari) then send the release
    // elsewhere. The slider's own "set" (change), losing focus, or the window
    // losing focus end it too, so it can never be left showing.
    var sliderHeld = false;
    function releaseSlider() {
      if (!sliderHeld) return;
      sliderHeld = false; clearTimeout(prevTimer); prevTimer = setTimeout(hidePreview, 700);
    }
    [sizeIn, alphaIn].forEach(function (i) {
      i.addEventListener('pointerdown', function () { sliderHeld = true; if (!textBox) preview(); });
      ['change', 'blur', 'lostpointercapture'].forEach(function (t) { i.addEventListener(t, releaseSlider); });
    });
    ['pointerup', 'pointercancel'].forEach(function (t) { document.addEventListener(t, releaseSlider, true); });
    window.addEventListener('blur', releaseSlider);
    // the samples in the brush list: a little stroke of each, in the colour
    // and at the opacity in use (redrawn whenever the list is open and
    // either changes)
    // (in the brush list, or the context bar and its list; with no box given,
    // in all of them that are showing)
    document.addEventListener('paint:theme', function () { brushSamples(); if (typeof bsBox !== 'undefined' && !bsBox.hidden) studioPreview(); });
    function brushSamples(box) {
      if (!box) {
        if (typeof ctxTool !== 'undefined' && ctxTool && ctxTool.querySelector('[data-prev]')) brushSamples(ctxTool);
        if (typeof ctxList !== 'undefined' && ctxList && !ctxList.hidden) brushSamples(ctxList);
        return;
      }
      var host = box;
      // the samples use the current colour, unless it would vanish against the
      // menu (black in dark mode, white in light): then they use the menu's text
      // colour. Multiply only shows on a light menu, so a dark one draws flat.
      var ink = getComputedStyle(host).color, m = ink.match(/[\d.]+/g) || [0, 0, 0];
      var lumOf = function (r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
      var c = parseInt(st.color.slice(1), 16), textL = lumOf(+m[0], +m[1], +m[2]), dark = textL > 0.5;
      var col = Math.abs(lumOf(c >> 16 & 255, c >> 8 & 255, c & 255) - (dark ? 0.1 : 0.97)) < 0.22 ? '#' + [m[0], m[1], m[2]].map(function (v) { return (+v | 256).toString(16).slice(1); }).join('') : st.color;
      Array.prototype.forEach.call(host.querySelectorAll('[data-prev]'), function (cv) {
        var k = cv.dataset.prev, bk = baseOf(k), sz = bk === 'spray' ? 3 : bk === 'highlighter' ? 4 : bk === 'stamp' ? 6 : 5, P = [];
        for (var i = 0; i <= 16; i++) { var t = i / 16; P.push({ x: 6 + 34 * t, y: 10 + Math.sin(t * Math.PI * 2) * 3.2 }); }
        drawPreview(cv, k, sz, col, P, 46, 20, 1, dark);
      });
    }

    // ---- THE PEN: a path, one point at a time. A click makes a corner; a
    // drag from a new point pulls out its handles, for a smooth curve.
    // Points and handles can be dragged again while it's being made (Alt
    // moves one handle on its own). Clicking the first point closes it;
    // Done, Return or a double-click lays it down as it is. It's drawn in
    // the colour, at the size and opacity, as an outline, filled, or both ----
    var pen = null, penHover = null, penStroke = stored('paint-pen-stroke', true), penFill = stored('paint-pen-fill', false), penText = stored('paint-pen-text', false);
    // (the path's steps: hist holds how it was before each point placed or
    // changed, fut what was undone; fromUndo: brought back by undoing the
    // step that laid it down, which is still there to redo)
    function newPen() { return { pts: [], closed: false, hist: [], fut: [] }; }
    function penPts(P) { var h = function (v) { return v ? { x: v.x, y: v.y } : null; }; return P.map(function (q) { return { x: q.x, y: q.y, i: h(q.i), o: h(q.o) }; }); }
    function penSnap() { return { pts: penPts(pen.pts), closed: !!pen.closed }; }
    function penPut(sn) { pen.pts = penPts(sn.pts); pen.closed = sn.closed; penHover = null; }
    function penRecord(sn) {
      pen.hist.push(sn); pen.fut = [];
      if (pen.fromUndo) { pen.fromUndo = false; redo = []; } // (changed: the path laid down before is no longer ahead)
      buttons();
    }
    function penUndo() { if (!pen.hist.length) return false; pen.fut.push(penSnap()); penPut(pen.hist.pop()); drawPen(); buttons(); ctxSync(); return true; }
    function penRedo() { if (!pen.fut.length) return false; pen.hist.push(penSnap()); penPut(pen.fut.pop()); drawPen(); buttons(); ctxSync(); return true; }
    function penRestore(k) {
      pen = { pts: penPts(k.pts), closed: k.closed, hist: k.hist.slice(), fut: [], fromUndo: true }; penHover = null;
      if (st.tool !== 'pen') setTool('pen');
      drawPen(); ctxSync();
    }
    function penPathOn(c, P, closed) {
      var seg = function (a, b) { if (a.o || b.i) { var o = a.o || a, i = b.i || b; c.bezierCurveTo(o.x, o.y, i.x, i.y, b.x, b.y); } else c.lineTo(b.x, b.y); };
      c.beginPath(); c.moveTo(P[0].x, P[0].y);
      for (var j = 1; j < P.length; j++) seg(P[j - 1], P[j]);
      if (closed) { seg(P[P.length - 1], P[0]); c.closePath(); }
    }
    function drawPen() {
      octx.clearRect(0, 0, W, H); drawSel();
      var pd = typeof ctxTool !== 'undefined' && ctxTool && ctxTool.querySelectorAll('[data-ctx="pendone"], [data-ctx="pencancel"]');
      if (pd) Array.prototype.forEach.call(pd, function (b) { b.disabled = !pen || pen.pts.length < (b.dataset.ctx === 'pencancel' ? 1 : 2); });
      histButtons();
      if (!pen || !pen.pts.length) { plainOv(); return; }
      var P = pen.pts, k = view.k;
      ov.style.opacity = st.alpha * (active ? active.opacity : 1); ov.style.mixBlendMode = '';
      strokeStyle(octx);
      // (for words, the path is only the line they'll follow: it isn't painted)
      if (!penText) both(octx, function () {
        if (P.length < 2) return;
        penPathOn(octx, P, pen.closed);
        if (penFill && (pen.closed || P.length > 2)) octx.fill();
        if (penStroke || !penFill) octx.stroke();
      });
      maskOv();
      // (the points, their handles, and where the next piece would go, on the
      // selection's sheet: not part of the drawing)
      var c = sctx, blue = '#2f7fd6', last = P[P.length - 1];
      c.save(); c.lineWidth = 1 / k; c.strokeStyle = blue;
      if (penText && P.length > 1) { c.lineWidth = 1.5 / k; penPathOn(c, P, pen.closed); c.stroke(); c.lineWidth = 1 / k; }
      if (penHover && !down && !pen.closed) {
        c.setLineDash([4 / k, 3 / k]); c.beginPath(); c.moveTo(last.x, last.y);
        if (last.o) c.quadraticCurveTo(last.o.x, last.o.y, penHover.x, penHover.y); else c.lineTo(penHover.x, penHover.y);
        c.stroke(); c.setLineDash([]);
      }
      P.forEach(function (q, i) {
        [q.i, q.o].forEach(function (h) {
          if (!h) return;
          c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(h.x, h.y); c.stroke();
          c.beginPath(); c.arc(h.x, h.y, 3.5 / k, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); c.stroke();
        });
        var z = (i === 0 ? 10 : 7) / k; c.fillStyle = i === P.length - 1 && i ? blue : '#fff';
        if (i === 0) { c.beginPath(); c.arc(q.x, q.y, z / 2, 0, Math.PI * 2); c.fill(); c.stroke(); }
        else { c.fillRect(q.x - z / 2, q.y - z / 2, z, z); c.strokeRect(q.x - z / 2, q.y - z / 2, z, z); }
      });
      c.restore();
    }
    function penHit(p, r) {
      if (!pen) return null;
      for (var i = pen.pts.length - 1; i >= 0; i--) {
        var q = pen.pts[i];
        if (q.o && Math.hypot(p.x - q.o.x, p.y - q.o.y) <= r) return { q: q, h: 'o' };
        if (q.i && Math.hypot(p.x - q.i.x, p.y - q.i.y) <= r) return { q: q, h: 'i' };
        if (Math.hypot(p.x - q.x, p.y - q.y) <= r) return { q: q, h: 'p' };
      }
      return null;
    }
    // (Backspace: the last point goes, as a step that can be undone)
    function penBack() { if (!pen || !pen.pts.length) return; var sn = penSnap(); pen.pts.pop(); pen.closed = false; penRecord(sn); drawPen(); ctxSync(); }
    function cancelPen() { pen = null; penHover = null; octx.clearRect(0, 0, W, H); plainOv(); drawSel(); buttons(); ctxSync(); }
    function finishPen() { var sw = maskIn(); finishPen0(); if (sw) maskOut(); }
    // TEXT ON A PATH: the path being made becomes the line the words are
    // typed along (kept with them, from where they start, so they can be
    // moved, sized and turned, and typed into again)
    // (Text, in the pen's settings, can be picked before the path is
    // drawn: then finishing it starts the words, rather than painting it)
    function pathForText() {
      if (!pen || pen.pts.length < 2) return null;
      var P = pen.pts, o = P[0], rel = function (q) { return q ? { x: q.x - o.x, y: q.y - o.y } : null; };
      return { at: { x: o.x, y: o.y }, path: { pts: P.map(function (q) { return { x: q.x - o.x, y: q.y - o.y, i: rel(q.i), o: rel(q.o) }; }), closed: !!pen.closed } };
    }
    function textOnPath() {
      var tp = pathForText(); if (!tp) return;
      cancelPen(); setTool('text'); startText(tp.at, 0, null, tp.path);
    }
    function finishPen0() {
      if (!pen) return;
      if (pen.pts.length < 2) { cancelPen(); return; }
      if (penText) { textOnPath(); return; }
      if (active && active.text && !paintAbove()) { cancelPen(); return; }
      need();
      penHover = null; drawPen();
      // (the path, and how it was made, go with the step: undoing it brings
      // the path back to carry on with)
      var keep = { pts: penPts(pen.pts), closed: !!pen.closed, hist: pen.hist.slice() };
      remember('Pen'); commit(null, st.alpha); undo[undo.length - 1].pen = keep;
      pen = null; drawSel(); buttons(); ctxSync(); useColor();
    }
    // PAINTING WHILE A TEXT LAYER IS PICKED: the paint goes on a new layer
    // just above it, so the words stay words
    function paintAbove() {
      if (layers.length >= maxLayers()) { toast('No room for another layer: merge the text down (or Turn into Image) to paint on it'); return false; }
      rememberLayers('New Layer');
      var L = makeLayer('Layer ' + (++count), false); layers.splice(layers.indexOf(active) + 1, 0, L); L.group = active.group; active = L; mount();
      toast('Painting on a new layer, so the text stays editable');
      return true;
    }

    // ---- pointers: drawing, moving the picture around, pinching to zoom ----
    var fingerTap = null, firstDown = 0, tapLater = null;
    var pointers = {}, ptype = {}, gesture = null, pan = null, spaceDown = false, spaceGrab = null, lastMouse = null;
    function screen(e) { var r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function cancelStroke() { cancelStroke0(); maskOut(); penBack0(); selectionToolbarSync(); }
    function cancelStroke0() {
      clearTimeout(holdTimerS);
      if (!down) return;
      stage.classList.remove('moving');
      if (selMode === 'lasso') { if (lassoOn) { lasso.pop(); selMode = null; down = null; drawLasso(lassoHover); } else { down = null; cancelLasso(); } return; }
      if (selMode === 'scale' || selMode === 'rotate' || selMode === 'distort' || selMode === 'qrot') { refitMask(); selTrim(); selMode = null; down = null; selbar.classList.remove('away'); drawSel(); return; }
      if (selMode === 'new') { selMode = null; down = null; clearSel(); return; }
      if (selMode === 'move') { selTrim(); snapEnd(); selMode = null; down = null; stage.classList.remove('moving'); drawSel(); return; }
      if (down.pick) { pickEnd(true); return; }
      if (down.grad) { var dg = down; down = null; if (dg.grad.k === 'new') gradCancel(); else { gradPut(dg.gradSnap); gradShow(); } return; }
      if (down.penSnap && pen) { penPut(down.penSnap); down = null; if (pen.pts.length || pen.hist.length || pen.fut.length) { drawPen(); ctxSync(); } else cancelPen(); return; }
      clearInterval(sprayTimer);
      if (down.snap) { var e = undo.pop(); if (e) { apply(e); if (e.redoWas) redo = e.redoWas; } buttons(); }
      down = null; octx.clearRect(0, 0, W, H); plainOv();
    }
    function begin(e) { var sw = maskIn(); begin0(e); if (sw && !down) maskOut(); selectionToolbarSync(); }
    function begin0(e) {
      var p = pos(e), t = st.tool, cq = cornerAt(p, e.pointerType !== 'mouse');
      if (!/^(picker|move|text|pen)$/.test(t)) need();
      if (cq && sel.quad) {
        // (distorting: a corner goes where it's pulled, on its own; the round
        // handle turns all four round their middle)
        lift(); selRecord();
        if (cq.c === 'rot') { var qm = quadMid(); down = { id: e.pointerId, start: p, last: p, qturn: { a0: Math.atan2(p.y - qm.y, p.x - qm.x), q0: sel.quad.slice(), m: qm } }; selMode = 'qrot'; }
        else { var qc = sel.quad[cq.i]; down = { id: e.pointerId, start: p, last: p, qi: cq.i, qoff: { x: sel.x + qc.x - p.x, y: sel.y + qc.y - p.y } }; selMode = 'distort'; }
        selbar.classList.add('away'); return;
      }
      if (cq && cq.c === 'rot') {
        lift(); selRecord(); var m = selMid();
        down = { id: e.pointerId, start: p, last: p, turn: { a0: Math.atan2(p.y - m.y, p.x - m.x), r0: sel.rot || 0 } };
        selMode = 'rotate'; selbar.classList.add('away'); return;
      }
      if (cq) {
        lift(); selRecord();
        // the opposite corner stays put (where it is on the picture, however the box is turned)
        var A = selWorld({ x: cq.c[1] === 'w' ? sel.x + sel.w : sel.x, y: cq.c[0] === 'n' ? sel.y + sel.h : sel.y });
        down = { id: e.pointerId, start: p, last: p, scale: { A: A, w: sel.w, h: sel.h, poly: sel.poly, sx: cq.c[1] === 'w' ? -1 : 1, sy: cq.c[0] === 'n' ? -1 : 1 } };
        selMode = 'scale'; selbar.classList.add('away'); return;
      }
      if (!selTool(t) && sel) anchor();
      if (t === 'picker') { pickStart(e, p, false); return; }
      // hold Alt (Option) with any drawing tool to pick up a colour instead
      if ((e.altKey || (e.pointerType === 'pen' && e.button === 2)) && !selTool(t) && t !== 'hand') { if (textBox) commitText(); pickStart(e, p, true); return; }
      if (t === 'text') {
        if (textBox) { commitText(); return; }
        // (tapping words already on the picture changes them; anywhere else,
        // a tap starts a line, and a drag makes a box for the words)
        var TL = textUnder(p); if (TL) { editText(TL); return; }
        down = { id: e.pointerId, start: p, last: p, textDrag: true }; return;
      }
      if (t === 'move') {
        if (!sel) movePick();
        if (!sel) { toast(active ? 'There\u2019s nothing on this layer to move' : 'There\u2019s no layer to move'); return; }
        selMode = 'move'; selOff = { x: p.x - sel.x, y: p.y - sel.y }; lift(); selRecord(); stage.classList.add('moving');
        down = { id: e.pointerId, start: p, last: p }; return;
      }
      if (t === 'pen') {
        var pr = (e.pointerType !== 'mouse' ? 16 : 8) / view.k;
        if (!pen) pen = newPen();
        var sn = penSnap();
        // the first point again closes the path: a drag from it shapes the
        // closing curve, and the path is finished when it's let go
        if (!pen.closed && pen.pts.length >= 2 && Math.hypot(p.x - pen.pts[0].x, p.y - pen.pts[0].y) <= pr) {
          pen.closed = true; penHover = null; down = { id: e.pointerId, start: p, last: p, penClose: pen.pts[0], penSnap: sn }; drawPen(); return;
        }
        var ph = penHit(p, pr);
        if (ph) { down = { id: e.pointerId, start: p, last: p, penEdit: ph, penSnap: sn }; return; }
        if (pen.closed) return; // (a closed path takes no more points: Done lays it down)
        var pa = { x: p.x, y: p.y, i: null, o: null }; pen.pts.push(pa);
        down = { id: e.pointerId, start: p, last: p, penNew: pa, penSnap: sn }; penHover = null; drawPen(); return;
      }
      // (brushes, lines and shapes on a text layer: onto a new layer above it)
      if (active && active.text && /^(brush|line|shape|gradient)$/.test(t) && !paintAbove()) return;
      if (selTool(t)) {
        if (t === 'lasso' && lassoOn) {
          // placing points: the first point closes it; anywhere else adds a
          // corner (and a drag from there draws a freehand piece)
          if (nearStart(p, e.pointerType !== 'mouse')) { finishLasso(); return; }
          p.corner = true; lasso.push(p); selMode = 'lasso';
          down = { id: e.pointerId, start: p, last: p, poly: true };
          drawLasso(null); return;
        }
        if (inSel(p)) { selMode = 'move'; selOff = { x: p.x - sel.x, y: p.y - sel.y }; lift(); selRecord(); stage.classList.add('moving'); }
        else if (t === 'wand') { commitSelection(); wandAt(p); selbar.hidden = !sel; drawSel(); return; }
        else if (t === 'lasso') { commitSelection(); selMode = 'lasso'; p.corner = true; lasso = [p]; }
        else { commitSelection(); selMode = 'new'; sel = { x: p.x, y: p.y, w: 0, h: 0, ax: p.x, ay: p.y, float: null, oval: t === 'circle' }; }
        down = { id: e.pointerId, start: p, last: p };
        return;
      }
      if (t === 'fill') { if (fillDrop(p)) plopAt(e.clientX, e.clientY, st.color); useColor(); return; }
      if (t === 'gradient') { gradDown(e, p); return; }
      if (t === 'eraser' && active.alphaLock) { toast('Alpha lock is on for this layer: paint over it instead'); return; }
      remember();
      down = { id: e.pointerId, start: p, last: p, pen: e.pointerType === 'pen', snap: true };
      liveLook();
      if (sel && sel.mask && /smudge|blur|tone/.test(t)) down.keep = keepOutside();
      pts = [p];
      octx.clearRect(0, 0, W, H);
      if (t === 'smudge' || t === 'blur' || t === 'tone') { dabs(p, p, true); return; }
      if (t === 'eraser') { p.pr = smoothPr(e.pressure); eraseStart(); renderStroke(); return; }
      if (t === 'brush') {
        p.pr = smoothPr(e.pressure);
        if (baseOf(kind()) === 'spray') {
          // (held still, it keeps spraying: as much more as the time that's passed)
          var flow = function (pr) { return pr == null ? 1 : 0.25 + 0.75 * Math.min(1, pr * 1.25); }, t0 = performance.now();
          down.flow = flow;
          both(octx, function () { spray(octx, p, null, null, flow(p.pr)); }); maskOv();
          clearInterval(sprayTimer); sprayTimer = setInterval(function () {
            var now = performance.now(), dt = Math.min(3, (now - t0) / 35), q = pts[pts.length - 1]; t0 = now;
            both(octx, function () { spray(octx, q, null, null, flow(q.pr) * dt * 0.55); }); maskOv();
          }, 35);
        }
        else renderStroke();
        return;
      }
      strokeStyle(octx); // line and shapes
    }
    function move(e) {
      var evs = e.getCoalescedEvents && e.getCoalescedEvents().length ? e.getCoalescedEvents() : [e];
      var p = pos(e), t = st.tool;
      if (down.pick) { loupeAt(e, p); return; }
      if (down.grad) { gradMove(p, e); return; }
      if (down.textDrag) {
        // (the box the words will go in)
        down.last = p; var a0 = down.start;
        octx.clearRect(0, 0, W, H); octx.save(); octx.lineWidth = 1 / view.k; octx.setLineDash([5 / view.k, 4 / view.k]); octx.strokeStyle = '#2f7fd6';
        octx.strokeRect(Math.min(a0.x, p.x), Math.min(a0.y, p.y), Math.abs(p.x - a0.x), Math.abs(p.y - a0.y)); octx.restore();
        return;
      }
      if (down.penNew || down.penClose) {
        var a = down.penNew || down.penClose;
        if (Math.hypot(p.x - a.x, p.y - a.y) * view.k > 3) { a.o = { x: p.x, y: p.y }; a.i = { x: 2 * a.x - p.x, y: 2 * a.y - p.y }; }
        down.last = p; drawPen(); return;
      }
      if (down.penEdit) {
        var h = down.penEdit, q = h.q, ddx = p.x - down.last.x, ddy = p.y - down.last.y; if (ddx || ddy) down.moved = true;
        if (h.h === 'p') { q.x += ddx; q.y += ddy; if (q.i) { q.i.x += ddx; q.i.y += ddy; } if (q.o) { q.o.x += ddx; q.o.y += ddy; } }
        else {
          // (the handle opposite stays in line, as long as it was, unless Alt is held)
          q[h.h] = { x: p.x, y: p.y }; var oh = h.h === 'o' ? 'i' : 'o';
          if (q[oh] && !e.altKey) { var ln = Math.hypot(q[oh].x - q.x, q[oh].y - q.y), an = Math.atan2(q.y - p.y, q.x - p.x); q[oh] = { x: q.x + Math.cos(an) * ln, y: q.y + Math.sin(an) * ln }; }
        }
        down.last = p; drawPen(); return;
      }
      if (selMode === 'distort') {
        var nq = sel.quad.slice(); nq[down.qi] = { x: p.x + down.qoff.x - sel.x, y: p.y + down.qoff.y - sel.y };
        if (quadOk(nq)) sel.quad = nq;
        drawSel(); return;
      }
      if (selMode === 'qrot') {
        var qt = down.qturn, qa = Math.atan2(p.y - qt.m.y, p.x - qt.m.x) - qt.a0;
        if (e.shiftKey) qa = Math.round(qa / (Math.PI / 12)) * (Math.PI / 12);
        sel.quad = quadTurn(qt.q0, qt.m, qa); drawSel(); return;
      }
      if (selMode === 'rotate') {
        // free to turn; it settles on upright and sideways when close (and
        // goes in steps of 15° with shift held)
        var mm = selMid(), ta = down.turn.r0 + Math.atan2(p.y - mm.y, p.x - mm.x) - down.turn.a0, st15 = Math.PI / 12, q90 = Math.round(ta / (Math.PI / 2)) * (Math.PI / 2);
        if (e.shiftKey) ta = Math.round(ta / st15) * st15; else if (Math.abs(ta - q90) < Math.PI / 60) ta = q90;
        ta = Math.atan2(Math.sin(ta), Math.cos(ta)); if (Math.abs(ta) < 1e-6) ta = 0;
        sel.rot = ta; drawSel(); return;
      }
      if (selMode === 'scale') {
        // keeping its proportions (or free to stretch, with Keep proportions
        // off in Scale); shift held does the other one
        var z = down.scale, r = sel.rot || 0, co = Math.cos(r), si = Math.sin(r), vx = p.x - z.A.x, vy = p.y - z.A.y;
        var lx = co * vx + si * vy, ly = -si * vx + co * vy;
        var nw = Math.max(4 / view.k, lx * z.sx), nh = Math.max(4 / view.k, ly * z.sy);
        if (sel.text || keepRatio !== !!e.shiftKey) { var kk = Math.max(nw / z.w, nh / z.h); nw = z.w * kk; nh = z.h * kk; }
        var hx = z.sx * nw / 2, hy = z.sy * nh / 2, cx = z.A.x + co * hx - si * hy, cy = z.A.y + si * hx + co * hy;
        sel.w = nw; sel.h = nh; sel.x = cx - nw / 2; sel.y = cy - nh / 2;
        if (z.poly) sel.poly = z.poly.map(function (q) { return { x: q.x * nw / z.w, y: q.y * nh / z.h }; });
        drawSel(); return;
      }
      if (selMode === 'lasso') {
        // the cutout's outline follows the pointer
        evs.forEach(function (ev) { var q = pos(ev), l = lasso[lasso.length - 1]; if (Math.hypot(q.x - l.x, q.y - l.y) > 2 / view.k) lasso.push(q); });
        down.dragged = down.dragged || Math.hypot(p.x - down.start.x, p.y - down.start.y) * view.k > 5;
        drawLasso(null);
        return;
      }
      if (selTool(t)) {
        if (selMode === 'move') { sel.x = p.x - selOff.x; sel.y = p.y - selOff.y; snapMove(); }
        else {
          var bw = Math.abs(p.x - sel.ax), bh = Math.abs(p.y - sel.ay);
          if (sel.oval && e.shiftKey) bw = bh = Math.max(bw, bh); // (Shift: a circle)
          sel.x = p.x < sel.ax ? sel.ax - bw : sel.ax; sel.y = p.y < sel.ay ? sel.ay - bh : sel.ay; sel.w = bw; sel.h = bh;
          if (sel.oval) sel.poly = ovalPoly(bw, bh); // (then it's a shape like a cutout's: everything works on it the same)
        }
        drawSel(); return;
      }
      if (t === 'smudge' || t === 'blur' || t === 'tone') {
        var a0 = down.last;
        evs.forEach(function (ev) { var q = pos(ev); dabs(down.last, q, false); down.last = q; });
        if (active.isMask || usesView(active)) { var rr = (st.size * 2 + 4) * R, b1 = down.last, rc = [[Math.min(a0.x, b1.x) * R - rr, Math.min(a0.y, b1.y) * R - rr, Math.max(a0.x, b1.x) * R + rr, Math.max(a0.y, b1.y) * R + rr]]; if (active.isMask) { maskAlpha(active.owner, rc); viewOf(active.owner, rc); } else viewOf(active, rc); }
        return;
      }
      if (t === 'eraser' || (t === 'brush' && baseOf(kind()) !== 'spray')) {
        evs.forEach(function (ev) {
          var q = assist(pos(ev)); q.pr = smoothPr(ev.pressure);
          if (down.shape) { var sc = ev.shiftKey !== shiftHeld; shiftHeld = ev.shiftKey; shapeFollow(q, sc); return; }
          holdStill(q);
          if (!smoothing) { var l = pts[pts.length - 1]; if (Math.hypot(q.x - l.x, q.y - l.y) > 0.6 / view.k) pts.push(q); return; }
          addSmoothed(q);
        });
        renderSoon(); return;
      }
      if (t === 'brush') {
        // (spray: droplets along the way, and more while it's held still)
        evs.forEach(function (ev) {
          // (evenly along the way, one puff every so often, so a fast stroke is
          // as even as a slow one, just lighter)
          var q = assist(pos(ev)), l = down.last, gap = Math.max(2, sprayRadius(st.size) * 0.3), d = Math.hypot(q.x - l.x, q.y - l.y);
          q.pr = smoothPr(ev.pressure); pts.push(q);
          if (d < gap) return;
          var n = Math.floor(d / gap), fl = down.flow(q.pr) * 0.5;
          for (var j = 1; j <= n; j++) { var m = { x: l.x + (q.x - l.x) * j * gap / d, y: l.y + (q.y - l.y) * j * gap / d }; both(octx, function () { spray(octx, m, null, null, fl); }); }
          down.last = { x: l.x + (q.x - l.x) * n * gap / d, y: l.y + (q.y - l.y) * n * gap / d };
        });
        maskOv();
        return;
      }
      // line and shapes
      octx.clearRect(0, 0, W, H); strokeStyle(octx);
      if (t === 'line') p = assist(p, true);
      both(octx, function () { shapePath(octx, down.start, p, e.shiftKey); });
      maskOv();
    }
    // SNAP TO SHAPE: hold still at the end of a line (half a second) and a
    // rough straight line, ellipse, circle or rectangle becomes a perfect
    // one, drawn with the same brush. Keep holding and move to adjust it: a
    // line's end follows, a shape grows and shrinks round its middle.
    var smoothing = stored('paint-smoothing', 0), snapShapes = stored('paint-snap-shapes', true), holdTimerS = 0;
    taperOn = stored('paint-taper', true);
    // SMOOTHING that never lags: each point of the line is the average of the
    // pointer's path a little way either side of it (along the line), and
    // that way shrinks to nothing at both ends. So the line always ends right
    // under the pointer, and is steadied behind it as it goes on: nothing
    // trails, and nothing moves when it's let go. (Smoothing sets how far
    // either side is averaged: up to 64 screen pixels.)
    function addSmoothed(q) {
      var raw = down.raw || (down.raw = [{ x: pts[0].x, y: pts[0].y, pr: pts[0].pr, s: 0 }]), last = raw[raw.length - 1];
      var step = Math.hypot(q.x - last.x, q.y - last.y); if (step <= 0.6 / view.k) return;
      var prevEnd = last.s, end = prevEnd + step, Wd = smoothing / 100 * 64 / view.k;
      raw.push({ x: q.x, y: q.y, pr: q.pr, s: end });
      // (only the points whose stretch either side reached past the old end can change)
      var i = pts.length; while (i > 0 && raw[i - 1].s > prevEnd - Wd) i--;
      for (; i < raw.length; i++) {
        var si = raw[i].s, h = Math.min(Wd, si, end - si);
        if (h < 1e-6) { pts[i] = { x: raw[i].x, y: raw[i].y, pr: raw[i].pr }; continue; }
        var lo = i; while (lo > 0 && raw[lo - 1].s >= si - h) lo--;
        var sx = 0, sy = 0, sw = 0, sp = 0, spw = 0;
        for (var j = lo; j < raw.length && raw[j].s <= si + h; j++) {
          var w = 1 - Math.abs(raw[j].s - si) / h; if (w <= 0) continue;
          sx += raw[j].x * w; sy += raw[j].y * w; sw += w;
          if (raw[j].pr != null) { sp += raw[j].pr * w; spw += w; }
        }
        pts[i] = { x: sx / sw, y: sy / sw, pr: spw ? sp / spw : raw[i].pr };
      }
      // (settled: far enough back that nothing still to come reaches them)
      var k = pts.length; while (k > 0 && raw[k - 1].s > end - Wd) k--;
      down.settled = k;
    }
    function holdStill(q) {
      if (!snapShapes || (down && down.gdir)) return; // (a stroke Drawing Assist keeps straight stays as it is)
      var a = down.holdAt;
      if (a && Math.hypot(q.x - a.x, q.y - a.y) <= 4 / view.k) return;
      down.holdAt = { x: q.x, y: q.y };
      clearTimeout(holdTimerS);
      var d0 = down;
      holdTimerS = setTimeout(function () { if (down === d0 && !down.shape) quickShape(); }, 550);
    }
    function along(a, b, step) { var n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step)), out = []; for (var i = 0; i < n; i++) out.push({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }); return out; }
    function recognise(P) {
      var n = P.length; if (n < 6) return null;
      var len = 0, i; for (i = 1; i < n; i++) len += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y);
      if (len * view.k < 40) return null;
      var a = P[0], b = P[n - 1], chord = Math.hypot(b.x - a.x, b.y - a.y);
      // (a line: everything close to the straight line from end to end)
      if (chord > len * 0.85) {
        var dev = 0;
        for (i = 0; i < n; i++) dev = Math.max(dev, Math.abs((b.x - a.x) * (a.y - P[i].y) - (a.x - P[i].x) * (b.y - a.y)) / chord);
        if (dev < Math.max(6 / view.k, chord * 0.07)) return { kind: 'line', name: 'Line', a: a, b: b };
      }
      // (a shape: it comes back round near where it began)
      if (chord > Math.max(len * 0.22, 36 / view.k)) return null;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      P.forEach(function (q) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); });
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
      if (rx * view.k < 8 || ry * view.k < 8) return null;
      var e1 = 0, e2 = 0;
      P.forEach(function (q) {
        e1 += Math.abs(Math.hypot((q.x - cx) / rx, (q.y - cy) / ry) - 1);
        e2 += Math.min(q.x - x0, x1 - q.x, q.y - y0, y1 - q.y) / Math.min(rx, ry);
      });
      e1 /= n; e2 /= n;
      if (e2 < 0.09 && e2 < e1 * 0.75) return { kind: 'rect', name: 'Rectangle', cx: cx, cy: cy, rx: rx, ry: ry };
      if (e1 < 0.13) {
        if (Math.abs(rx - ry) < Math.max(rx, ry) * 0.14) { rx = ry = (rx + ry) / 2; return { kind: 'ellipse', name: 'Circle', cx: cx, cy: cy, rx: rx, ry: ry, a0: Math.atan2(a.y - cy, a.x - cx) }; }
        return { kind: 'ellipse', name: 'Ellipse', cx: cx, cy: cy, rx: rx, ry: ry, a0: Math.atan2(a.y - cy, a.x - cx) };
      }
      return null;
    }
    function shapePts(sh, k) {
      var out = [], step = Math.max(1, st.size * 0.25), i;
      // (with Shift held, an ellipse is a circle and a rectangle a square, as
      // round as it is on average; let go and it's as it was)
      sh = Object.create(sh);
      if (shiftHeld && sh.kind !== 'line') sh.rx = sh.ry = (sh.rx + sh.ry) / 2;
      if (shiftHeld && sh.kind === 'line') {
        var an = Math.round(Math.atan2(sh.b.y - sh.a.y, sh.b.x - sh.a.x) / (Math.PI / 12)) * (Math.PI / 12), ln = Math.hypot(sh.b.x - sh.a.x, sh.b.y - sh.a.y);
        sh.b = { x: sh.a.x + Math.cos(an) * ln, y: sh.a.y + Math.sin(an) * ln };
      }
      if (sh.kind === 'line') { out = along(sh.a, sh.b, step); out.push({ x: sh.b.x, y: sh.b.y }); }
      else if (sh.kind === 'rect') {
        var c = [{ x: sh.cx - sh.rx * k, y: sh.cy - sh.ry * k }, { x: sh.cx + sh.rx * k, y: sh.cy - sh.ry * k }, { x: sh.cx + sh.rx * k, y: sh.cy + sh.ry * k }, { x: sh.cx - sh.rx * k, y: sh.cy + sh.ry * k }];
        for (i = 0; i < 4; i++) out = out.concat(along(c[i], c[(i + 1) % 4], step));
        out.push(c[0], along(c[0], c[1], step)[1] || c[1]);
      } else {
        var N = Math.max(48, Math.round(Math.PI * (sh.rx + sh.ry) * k / step));
        for (i = 0; i <= N + 1; i++) { var t = sh.a0 + i / N * Math.PI * 2; out.push({ x: sh.cx + Math.cos(t) * sh.rx * k, y: sh.cy + Math.sin(t) * sh.ry * k }); }
      }
      var pr = down.shapePr; out.forEach(function (q) { q.pr = pr; });
      return out;
    }
    function redrawShape(k) {
      pts = shapePts(down.shape, k); down.S = null; down.n = 0; down.total = 0;
      octx.clearRect(0, 0, W, H); if (st.tool === 'eraser') eraseFromSheet(null);
      renderStroke();
    }
    function quickShape() {
      var sh = recognise(pts); if (!sh) return;
      var prs = pts.filter(function (q) { return q.pr != null; }).map(function (q) { return q.pr; });
      down.shapePr = prs.length ? prs.reduce(function (a, b) { return a + b; }, 0) / prs.length : null;
      // (a perfect shape doesn't taper: its ends meet cleanly)
      down.cfg = brushCfg(kind(), st.size, st.tool === 'eraser' ? '#fff' : st.color); down.cfg.tin = down.cfg.tout = down.cfg.live = 0;
      down.shape = sh; sh.hold = down.holdAt; sh.k = 1;
      redrawShape(1);
      toast(sh.name + ': keep holding to adjust');
    }
    // (Shift pressed or let go while a snapped shape is held: it changes there and then)
    var shiftHeld = false;
    function shiftChanged(on) {
      if (shiftHeld === on) return;
      shiftHeld = on;
      if (down && down.shape) redrawShape(down.shape.k || 1);
    }
    function shapeFollow(q, force) {
      var sh = down.shape;
      if (sh.kind === 'line') { sh.b = q; redrawShape(1); return; }
      var d0 = Math.hypot(sh.hold.x - sh.cx, sh.hold.y - sh.cy) || 1, k = Math.max(0.05, Math.hypot(q.x - sh.cx, q.y - sh.cy) / d0);
      if (!force && Math.abs(k - sh.k) * Math.max(sh.rx, sh.ry) * view.k < 0.5) return;
      sh.k = k; redrawShape(k);
    }
    function end() { end0(); maskOut(); penBack0(); selectionToolbarSync(); }
    function end0() {
      var t = st.tool;
      clearTimeout(holdTimerS);
      if (down.pick) { pickEnd(false); return; }
      if (down.grad) { gradUp(); return; }
      if (down.penNew || down.penEdit || down.penClose) {
        var dn = down; down = null;
        if (dn.penNew || dn.penClose || dn.moved) penRecord(dn.penSnap);
        if (dn.penClose) { finishPen(); return; }
        drawPen(); ctxSync(); return;
      }
      if (down.textDrag) {
        var a0 = down.start, b0 = down.last, bw = Math.abs(b0.x - a0.x);
        down = null; octx.clearRect(0, 0, W, H);
        if (bw * view.k > 16) startText({ x: Math.min(a0.x, b0.x), y: Math.min(a0.y, b0.y) }, bw); else startText(a0, 0);
        return;
      }
      // (a smoothed line catches up with where the pointer was let go)

      if (rsQueued) renderStroke(); // (the last frame, before it's laid down)
      clearInterval(sprayTimer);
      if (selMode === 'scale' || selMode === 'rotate' || selMode === 'distort' || selMode === 'qrot') { refitMask(); selTrim(); selMode = null; down = null; selbar.classList.remove('away'); drawSel(); autosave(); return; }
      if (selMode === 'lasso') {
        // already placing points: carry on (a click made a corner, a drag a
        // freehand piece)
        if (down.poly) { var tip = lasso[lasso.length - 1]; if (down.dragged) tip.corner = true; selMode = null; down = null; drawLasso(lassoHover); return; }
        // the first press: a click starts placing points; a drag was a
        // freehand cutout, finished as soon as it's let go
        if (!down.dragged) {
          lassoOn = true; lasso = [lasso[0]]; selMode = null; down = null; drawLasso(null);
          toast('Click to add points \u00b7 click the first point to finish');
          return;
        }
        finishLasso(); return;
      }
      if (selTool(t)) {
        if (selMode === 'new' && (sel.w < 3 || sel.h < 3)) sel = null;
        if (selMode === 'move') { selTrim(); snapEnd(); }
        stage.classList.remove('moving'); selbar.hidden = !sel; selMode = null; down = null; drawSel(); autosave(); return;
      }
      down = null; autosave();
      if (t === 'smudge' || t === 'blur' || t === 'tone') { carry = []; return; }
      if (t === 'eraser') { octx.clearRect(0, 0, W, H); plainOv(); return; }
      var lk = strokeLook(); commit(lk.mode, lk.alpha);
      useColor();
    }

    // (the controls that sit on the picture: pressing them doesn't paint)
    var STAGE_UI = '.selection-slot, .paint-zoom, .paint-ctx, .ctx-list, .paint-selbar, .paint-text, .paint-selx, .paint-seldist, .paint-scale';
    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest(STAGE_UI)) return;
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
      if (spaceGrab) { e.preventDefault(); return; } // (space is already holding something)
      if (anyMenu()) openMenu(null);
      if (!panel.hidden) layerPanel(false);
      if (adj) adjustDone(true);
      e.preventDefault();
      // (a tap on the picture takes the typing away from a field in a panel,
      // so the shortcuts work again)
      var ae = document.activeElement; if (!textBox && ae && ae.blur && /^(input|select|textarea)$/i.test(ae.tagName)) ae.blur();
      // APPLE PENCIL AND A RESTING HAND: while the Pencil is on the picture,
      // or was a moment ago, a touch is ignored (it used to count as a pinch:
      // 800% at once); once the Pencil has been used, one finger doesn't
      // paint (unless that's turned off in Touch Gestures), but two still
      // zoom, move and turn the picture, and taps still undo
      if (e.pointerType === 'pen') { lastPen = performance.now(); tapLater = null; holdOff(); waitOff(); if (!penSeen) { penSeen = true; if (fingerDraw === 'pencil') toast('Apple Pencil draws now; fingers zoom and move the picture'); } }
      if (e.pointerType === 'touch' && (Object.keys(ptype).some(function (id) { return ptype[id] === 'pen'; }) || performance.now() - lastPen < 600)) return;
      // the first finger (or a mouse or Pencil) starts afresh, forgetting any
      // touch whose lift went missing
      if (e.isPrimary) {
        if (e.pointerType === 'pen' && down && !down.pen) cancelStroke(); // (a palm got there first)
        pointers = {}; ptype = {}; gesture = null; fingerTap = null; firstDown = performance.now(); tapLater = null; offTap = noTap = null; holdOff(); waitOff();
        if (pan) { pan = null; stage.classList.remove('panning'); }
      }
      try { stage.setPointerCapture(e.pointerId); } catch (x) {}
      busy(true, e);
      if (e.pointerType === 'mouse') hideRing();
      pointers[e.pointerId] = screen(e); ptype[e.pointerId] = e.pointerType;
      var ids = Object.keys(pointers);
      // only two fingers pinch
      if (ids.length === 2 && ptype[ids[0]] === 'touch' && ptype[ids[1]] === 'touch') {
        // two fingers: pinch to zoom, drag to move the picture, twist to turn
        // it. (A quick tap with two fingers is undo, with three, redo.)
        cancelStroke(); pan = null; tapLater = null; offTap = noTap = null; holdOff(); waitOff();
        pinchFrom(ids);
        fingerTap = { n: 2, t0: firstDown, from: {}, moved: false };
        ids.forEach(function (id) { fingerTap.from[id] = { x: pointers[id].x, y: pointers[id].y }; });
        return;
      }
      if (ids.length >= 3 && fingerTap) { fingerTap.n = Math.max(fingerTap.n, ids.length); fingerTap.from[e.pointerId] = { x: pointers[e.pointerId].x, y: pointers[e.pointerId].y }; return; }
      if (ids.length > 1) return;
      var penBtn = e.pointerType === 'pen' && (e.button === 5 || e.button === 2 || (e.buttons & 32));
      if (st.tool === 'hand' || spaceDown || e.button === 1 || (st.tool === 'none' && !penBtn && !e.altKey)) {
        var s = screen(e); pan = { x: s.x, y: s.y, vx: view.x, vy: view.y }; stage.classList.add('panning');
        if (st.tool === 'none') noTap = { id: e.pointerId, s: s, on: !offPic(pos(e)) };
        return;
      }
      // (a finger's tap with fill, the colour picker, the wand or text acts
      // when it lifts: a second finger may be about to land, for undo)
      // (once the Pencil is in use a finger doesn't paint, but it can still
      // take hold of a gradient's handles)
      var fingerOff = e.pointerType === 'touch' && fingerDraw === 'pencil' && penSeen;
      if (fingerOff && st.tool === 'gradient' && grad && gradHit(pos(e), 20 / view.k)) fingerOff = false;
      // A CLICK ON THE EMPTY SPACE AROUND THE PICTURE puts the tool down
      // (when it lifts without moving: a stroke may start off the edge).
      // Work in progress goes first: the words being typed, a path, a
      // cutout or a gradient being made. A selection stays just as it is,
      // and pressing on it, or on its handles off the edge, still works it.
      // (a finger that doesn't paint, once the Pencil's in use, can still
      // put the tool down; dragged, it does nothing, as before)
      var p0 = pos(e);
      if (offPic(p0) && !penBtn && !e.altKey && !(sel && (selMode || inSel(p0))) && !textBox && !lassoOn && !(pen && pen.pts.length) && !grad && !cornerAt(p0, e.pointerType !== 'mouse')) {
        offTap = { id: e.pointerId, s: screen(e), ev: fingerOff ? null : { clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType, pressure: e.pressure, altKey: false, button: 0 } };
        return;
      }
      if (fingerOff) return;
      if (e.pointerType === 'touch') holdOn(e);
      if (e.pointerType === 'touch' && /^(fill|wand)$/.test(st.tool)) {
        tapLater = { id: e.pointerId, ev: { clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType, pressure: e.pressure, altKey: false, button: 0 } };
        return;
      }
      // (one finger waits a moment, or until it moves, before it starts
      // anything: a second finger landing just after makes it a pinch, and
      // nothing is begun only to be called off; with a selection open it
      // waits a little longer, so a two-finger move of the picture whose
      // fingers land apart doesn't start a new selection or drop this one)
      if (e.pointerType === 'touch') {
        var ev = { clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, pointerType: 'touch', pressure: e.pressure, altKey: false, button: 0 }, hold = !!(sel && !sel.thing);
        touchWait = { id: e.pointerId, ev: ev, s: screen(e), far: hold ? 12 : 6, t: setTimeout(waitGo, hold ? 200 : 70) };
        return;
      }
      // (a Pencil's eraser end rubs out, and its barrel button picks a colour)
      if (e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32)) && st.tool !== 'eraser' && !selTool(st.tool) && !/^(text|pen|hand)$/.test(st.tool)) { penErase = st.tool; st.tool = 'eraser'; }
      begin(e);
    });
    var offTap = null, noTap = null;
    function offPic(p) { return p.x < 0 || p.y < 0 || p.x > W || p.y > H; }
    var touchWait = null, penErase = null, lastPen = -1e9, penSeen = false, fingerDraw = stored('paint-finger-draw', 'pencil');
    function waitGo() { var w = touchWait; touchWait = null; if (w) { clearTimeout(w.t); if (pointers[w.id] && Object.keys(pointers).length === 1 && !gesture) begin(w.ev); } }
    function waitOff() { if (touchWait) { clearTimeout(touchWait.t); touchWait = null; } }
    function penBack0() { if (penErase) { st.tool = penErase; penErase = null; } }
    // (two fingers: where they started, to zoom, move and turn from; taken
    // again whenever the fingers on the picture change)
    function pinchFrom(ids) {
      var a = pointers[ids[0]], b = pointers[ids[1]], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gesture = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, a: Math.atan2(b.y - a.y, b.x - a.x), k: view.k, r: view.r, p: fromScreen(mid.x, mid.y) };
    }
    // TOUCH AND HOLD: one finger kept still on the picture for half a second
    // does what's set for it (what it began, a dot of paint say, is called off)
    var holdG = null;
    function holdOn(e) {
      holdOff();
      if (gest.hold === 'none') return;
      var s0 = screen(e);
      holdG = { id: e.pointerId, s: s0, ev: { pointerId: e.pointerId, pointerType: 'touch', clientX: e.clientX, clientY: e.clientY }, t: setTimeout(function () {
        var h = holdG; holdG = null;
        if (!h || !pointers[h.id] || Object.keys(pointers).length !== 1 || gesture || (down && down.id !== h.id) || pen || lassoOn) return;
        if (down) cancelStroke(); tapLater = null; pan = null; stage.classList.remove('panning');
        gestureDo(gest.hold, h.s, gest.hold === 'pick' ? h.ev : null);
      }, 500) };
    }
    function holdOff() { if (holdG) { clearTimeout(holdG.t); holdG = null; } }
    stage.addEventListener('pointermove', function (e) {
      if (pointers[e.pointerId]) { pointers[e.pointerId] = screen(e); busyMove(e); }
      if (holdG && holdG.id === e.pointerId) { var hs = screen(e); if (Math.hypot(hs.x - holdG.s.x, hs.y - holdG.s.y) > 8) holdOff(); else { holdG.ev.clientX = e.clientX; holdG.ev.clientY = e.clientY; } }
      if (touchWait && touchWait.id === e.pointerId) { var ws = screen(e); if (Math.hypot(ws.x - touchWait.s.x, ws.y - touchWait.s.y) > touchWait.far) waitGo(); }
      if (offTap && offTap.id === e.pointerId) { var os = screen(e); if (Math.hypot(os.x - offTap.s.x, os.y - offTap.s.y) > (e.pointerType === 'mouse' ? 3 : 6)) { var o = offTap; offTap = null; if (o.ev) begin(o.ev); } }
      if (noTap && noTap.id === e.pointerId) { var ns = screen(e); if (Math.hypot(ns.x - noTap.s.x, ns.y - noTap.s.y) > 6) noTap = null; }
      if (e.pointerType === 'pen') lastPen = performance.now();
      // (a mouse button let go of somewhere the page didn't hear it, like over a menu of the browser's own)
      if (e.pointerType === 'mouse' && down && e.pointerId === down.id && !e.buttons) { up(e); return; }
      if (fingerTap && fingerTap.from[e.pointerId] && pointers[e.pointerId]) {
        var f0 = fingerTap.from[e.pointerId], f1 = pointers[e.pointerId];
        if (Math.hypot(f1.x - f0.x, f1.y - f0.y) > 12) fingerTap.moved = true;
      }
      if (gesture) {
        var ids = Object.keys(pointers); if (ids.length < 2) return;
        var a = pointers[ids[0]], b = pointers[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        var k = Math.max(fitK * 0.25, Math.min(fitK * 10, gesture.k * d / gesture.d));
        // (turning: free, but it settles on upright, sideways and upside down
        // when it's close to one of them)
        var r = gesture.r + Math.atan2(b.y - a.y, b.x - a.x) - gesture.a;
        r = Math.atan2(Math.sin(r), Math.cos(r));
        var q = Math.round(r / (Math.PI / 2)) * (Math.PI / 2); if (Math.abs(r - q) < Math.PI / 36) r = q;
        if (Math.abs(r) < 1e-6) r = 0;
        view.k = k; view.r = r;
        var c = Math.cos(r), s = Math.sin(r), P = gesture.p;
        view.x = mx - k * (c * P.x - s * P.y); view.y = my - k * (s * P.x + c * P.y); applyView();
        return;
      }
      if (pan) { var s = screen(e); view.x = pan.vx + s.x - pan.x; view.y = pan.vy + s.y - pan.y; applyView(); return; }
      if (down && e.pointerId === down.id) { move(e); if (down && down.pen) showRing(pos(e)); return; }
      if (lassoOn && !down) { lassoHover = pos(e); drawLasso(lassoHover); stage.classList.toggle('closing', nearStart(lassoHover, e.pointerType !== 'mouse')); return; }
      if (st.tool === 'pen' && pen && pen.pts.length && !down && !e.target.closest(STAGE_UI)) { penHover = pos(e); drawPen(); hideRing(); return; }
      // (over a gradient's handles, or its line: they can be dragged)
      if (st.tool === 'gradient' && grad && !down && !spaceDown && !spaceGrab) { lastMouse = { s: screen(e), p: pos(e) }; stage.classList.toggle('can-move', !e.target.closest(STAGE_UI) && !!gradHit(lastMouse.p, (e.pointerType === 'mouse' ? 10 : 20) / view.k)); return; }
      // (the picker in hand: the loupe follows a mouse or a hovering Pencil)
      if (st.tool === 'picker' && !down && (e.pointerType === 'mouse' || e.pointerType === 'pen')) {
        if (e.target.closest(STAGE_UI) || spaceDown || spaceGrab) pickHoverEnd(); else { hideRing(); pickHover(e); return; }
      } else if (hoverPick) pickHoverEnd();
      // an Apple Pencil hovering over the picture shows the brush size too
      if (e.pointerType === 'pen' && !down) { showRing(pos(e)); return; }
      if (e.pointerType !== 'mouse' || down) return;
      if (e.target.closest(STAGE_UI)) { hideRing(); octx.clearRect(0, 0, W, H); return; } // (over the bars that sit on the picture)
      lastMouse = { s: screen(e), p: pos(e) };
      if (spaceDown && !spaceGrab) grabWithSpace();
      if (spaceGrab) { hideRing(); moveGrab(); return; }
      var cq = cornerAt(lastMouse.p, false); cornerCursor(cq);
      stage.classList.toggle('can-move', !cq && selTool(st.tool) && !!sel && !sel.thing && inSel(lastMouse.p));
      if (cq) { octx.clearRect(0, 0, W, H); hideRing(); return; }
      ring(lastMouse.p);
    });
    // HOLD SPACE: the mouse grabs whatever it's over (the selection, or the
    // drawn thing under it, on whichever layer it's on) and moves it about;
    // over nothing, it grabs the whole picture. Letting go puts it down.
    function paintAt(p) {
      var x = Math.floor(p.x * R), y = Math.floor(p.y * R);
      if (x < 0 || y < 0 || x >= ov.width || y >= ov.height) return null;
      for (var i = layers.length - 1; i >= 0; i--) {
        var L = layers[i]; if (!L.visible) continue;
        var d = L.ctx.getImageData(x, y, 1, 1).data;
        if (L.bg ? 765 - d[0] - d[1] - d[2] > 36 : d[3] > 8) return L;
      }
      return null;
    }
    function grabWithSpace() {
      if (!lastMouse || down || pan || gesture || textBox) return;
      var p = lastMouse.p, s = lastMouse.s, L;
      if (adj) adjustDone();
      if (sel && !selMode && inSel(p)) { lift(); selRecord(); spaceGrab = { sel: true, ox: p.x - sel.x, oy: p.y - sel.y }; }
      else if ((L = paintAt(p))) {
        commitSelection();
        if (L !== active) { active = L; renderLayers(); }
        if (L.text) { textSel(L); selbar.hidden = true; } else wandAt(p, true);
        if (!sel) return;
        sel.thing = true; lift();
        spaceGrab = { sel: true, thing: true, ox: p.x - sel.x, oy: p.y - sel.y }; drawSel();
      }
      else spaceGrab = { x: s.x, y: s.y, vx: view.x, vy: view.y };
      stage.classList.add('panning'); octx.clearRect(0, 0, W, H); busy(true);
    }
    function moveGrab() {
      if (spaceGrab.sel) { sel.x = lastMouse.p.x - spaceGrab.ox; sel.y = lastMouse.p.y - spaceGrab.oy; snapMove(); drawSel(); }
      else { view.x = spaceGrab.vx + lastMouse.s.x - spaceGrab.x; view.y = spaceGrab.vy + lastMouse.s.y - spaceGrab.y; applyView(); }
    }
    function letGoOfSpace() {
      spaceDown = false; stage.classList.remove('space'); if (spaceGrab && !Object.keys(pointers).length) busy(false);
      if (!spaceGrab) return;
      snapEnd(); if (spaceGrab.thing) commitSelection(); else if (spaceGrab.sel) { selTrim(); autosave(); }
      spaceGrab = null; stage.classList.remove('panning');
    }
    window.addEventListener('blur', function () { busy(false); letGoOfSpace(); stage.classList.remove('picking'); shiftChanged(false); });
    function up(e) {
      if (holdG && holdG.id === e.pointerId) holdOff();
      if (touchWait && touchWait.id === e.pointerId) { if (e.type === 'pointerup') waitGo(); else waitOff(); }
      delete pointers[e.pointerId]; delete ptype[e.pointerId];
      if (!Object.keys(pointers).length) busy(false);
      if (e.pointerType === 'pen') hideRing();
      if (offTap && offTap.id === e.pointerId) { offTap = null; if (e.type === 'pointerup') { setTool('none'); hideRing(); } return; }
      if (noTap && noTap.id === e.pointerId) { var nt = noTap; noTap = null; if (e.type === 'pointerup' && nt.on) toast('Pick a tool to draw'); }
      // (all the fingers of a quick, still tap are up: undo, or redo)
      if (fingerTap && !Object.keys(pointers).length) {
        var ft = fingerTap; fingerTap = null;
        if (!ft.moved && e.type === 'pointerup' && performance.now() - ft.t0 < 400 + (ft.n - 2) * 100) {
          // (what's set for that many fingers; it happens where they were)
          var ks = Object.keys(ft.from), at = { x: 0, y: 0 }; ks.forEach(function (id) { at.x += ft.from[id].x / ks.length; at.y += ft.from[id].y / ks.length; });
          gestureDo(gest['tap' + Math.min(4, ft.n)], at);
          gesture = null; return;
        }
      }
      if (gesture) { var left2 = Object.keys(pointers); if (left2.length < 2) gesture = null; else pinchFrom(left2); return; }
      if (tapLater && tapLater.id === e.pointerId) { var tl = tapLater; tapLater = null; if (e.type === 'pointerup' && !Object.keys(pointers).length) begin(tl.ev); return; }
      if (pan) { pan = null; stage.classList.remove('panning'); return; }
      if (down && e.pointerId === down.id) end();
    }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('dblclick', function () {
      if (lassoOn && st.tool === 'lasso' && !down) finishLasso();
      // (a double-click lays the path down: the second click's point is dropped)
      if (pen && st.tool === 'pen' && !down) { var P = pen.pts; while (P.length > 2 && Math.hypot(P[P.length - 1].x - P[P.length - 2].x, P[P.length - 1].y - P[P.length - 2].y) * view.k < 4) P.pop(); finishPen(); }
    });
    stage.addEventListener('contextmenu', function (e) { if (sel && !selMode && inSel(pos(e))) { e.preventDefault(); if (!(sel.more || sel.items || (multi() && !sel.thing))) invertSel(); } });
    // (the system taking the screen mid-stroke: a finger's stroke is called
    // off, as it may have been the start of a gesture; a Pencil's or a
    // mouse's is kept as far as it got)
    stage.addEventListener('pointercancel', function (e) { if (down && e.pointerId === down.id) { if (e.pointerType === 'touch') cancelStroke(); else end(); } up(e); });
    stage.addEventListener('pointerleave', function (e) { if (!down) pickHoverEnd(); if (lassoOn && !down) { lassoHover = null; drawLasso(null); stage.classList.remove('closing'); } if (!down) hideRing(); if (!down && e.pointerType === 'mouse') { octx.clearRect(0, 0, W, H); if (!spaceGrab) lastMouse = null; } });
    // ctrl / cmd + scroll (and a trackpad pinch) zooms; scrolling moves a zoomed-in picture
    var wheelT = 0;
    stage.addEventListener('wheel', function (e) {
      var s = screen(e);
      if (!e.target.closest(STAGE_UI) && (e.ctrlKey || e.metaKey || view.k > fillK * 1.01)) { busy(true); clearTimeout(wheelT); wheelT = setTimeout(function () { if (!Object.keys(pointers).length) busy(false); }, 260); }
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(view.k * Math.exp(-e.deltaY * 0.01), s.x, s.y); }
      else if (view.k > fillK * 1.01) { e.preventDefault(); view.x -= e.deltaX; view.y -= e.deltaY; applyView(); }
    }, { passive: false });
    var g0 = 1;
    // (a Mac trackpad's pinch; on an iPad, fingers are already handled above)
    stage.addEventListener('gesturestart', function (e) { e.preventDefault(); g0 = view.k; });
    stage.addEventListener('gesturechange', function (e) { e.preventDefault(); if (Object.keys(ptype).length) return; var s = screen(e); zoomAt(g0 * e.scale, s.x, s.y); });

    // ---- the buttons ----
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-ctx-new]')) { ctxClose(); newBrush('stamp', BDEF.stamp); return; }
      var pk = e.target.closest('[data-pick]');
      if (pk && pk.dataset.pick === 'font' && textBox) { st.font = pk.dataset.val; loadFont(st.font); openMenu(null); ctxClose(); afterTextChange(); ctxSync(); return; }
      if (pk && pk.dataset.pick === 'brush' && !bsBox.hidden) { st.brush = pk.dataset.val; ctxClose(); ctxSync(); studio(true); return; }
      if (pk) { st[pk.dataset.pick] = pk.dataset.val; if (pk.dataset.pick === 'font') loadFont(st.font); openMenu(null); ctxClose(); setTool({ brush: 'brush', shape: 'shape', font: 'text', tone: 'tone' }[pk.dataset.pick]); ctxSync(); return; }
      if (e.target.closest('.paint-selx')) { commitSelection(); return; }
      var t = e.target.closest('button[data-tool]'); // (the picture carries data-tool too, for its cursor)
      if (t) {
        // (the tool in hand, again: brings back its panel if it was folded away)
        var tl = t.dataset.tool;
        chooseTool(tl, true); openMenu(null); return;
      }
      var s = e.target.closest('[data-color]'); if (s) { setColor(s.dataset.color); if (/eraser|picker|smudge|blur|tone|hand|select|lasso|circle|wand|none/.test(st.tool)) setTool('brush'); return; }
      var pr = e.target.closest('.paint-current, .paint-second');
      // (Enter or Space on it; a tap or a drag was dealt with already, and the
      // click after a touch can look just like a key's)
      if (pr) { if (e.detail === 0 && performance.now() - pairPressed > 800) picker(pr.classList.contains('paint-current') ? 'main' : 'second'); return; }
      if (e.target.closest('.paint-swap')) { var c1 = st.color; setColor(st.color2); setColor2(c1); return; }
      if (e.target.closest('.paint-mirror')) { if (toolMenuOpen() && pc.hidden && adjBox.hidden && bsBox.hidden && ctxView === 'sym') minimizeToolMenu(); else { if (!pc.hidden) picker(null); if (!adjBox.hidden || adj) adjustDone(); if (!bsBox.hidden) studio(false); ctxSymView(true); } return; }
      var z = e.target.closest('[data-zoom]');
      if (z) { var cx = stage.clientWidth / 2, cy = stage.clientHeight / 2; if (z.dataset.zoom === 'fit') fit(); else zoomStep(z.dataset.zoom === 'in' ? 1 : -1); return; }
      var sa = e.target.closest('[data-sel]'); if (sa) { if (adj) adjustDone(true); selAction(sa.dataset.sel); return; }
      var ge = e.target.closest('[data-geye]'); if (ge) { var G1 = groupOf(ge.dataset.geye); if (G1) { G1.visible = !G1.visible; mount(); layerPanel(true); autosave(); } return; }
      var gf = e.target.closest('[data-gfold]'); if (gf) { var G2 = groupOf(gf.dataset.gfold); if (G2) { G2.open = !G2.open; renderLayers(); layerPanel(true); autosave(); } return; }
      var gn = e.target.closest('[data-gname]'); if (gn) { var G3 = groupOf(gn.dataset.gname); if (!G3) return; if ((e.shiftKey || e.metaKey || e.ctrlKey) && membersOf(G3).length) { pickToggle(membersOf(G3)); return; } if (focusG === G3) { renameGroup(G3); return; } focusG = G3; renderLayers(); layerPanel(true); return; }
      var gm = e.target.closest('[data-gmore]'); if (gm) { e.stopPropagation(); var G4 = groupOf(gm.dataset.gmore); if (!G4) return; if (!lmenu.hidden && lmenu.dataset.g === gm.dataset.gmore) { lmenu.hidden = true; return; } var rg = gm.getBoundingClientRect(); groupMenu(G4, rg.right, rg.bottom + 4, true, rg.top - 4); return; }
      var mt = e.target.closest('[data-mthumb]'); if (mt) { if (sel) commitSelection(); editMaskOf(layers[+mt.dataset.mthumb], true); layerPanel(true); return; }
      var lt = e.target.closest('[data-thumb]'); if (lt) { var L5 = layers[+lt.dataset.thumb]; if (L5) { if (pickKeys(e, L5)) return; if (also.length || L5 !== active) { if (sel) commitSelection(); also = []; } editMaskOf(L5, false); if (st.tool === 'move') movePick(); layerPanel(true); } return; }
      var le = e.target.closest('[data-layer-eye]'); if (le) { var L = layers[+le.dataset.layerEye]; L.visible = !L.visible; mount(); layerPanel(true); autosave(); return; }
      var ln = e.target.closest('[data-layer]');
      if (ln) { var L2 = layers[+ln.dataset.layer]; if (pickKeys(e, L2)) return; if (L2 === active && !focusG && !also.length) { rename(+ln.dataset.layer); return; } if (sel) commitSelection(); active = L2; also = []; focusG = null; renderLayers(); if (st.tool === 'move') movePick(); layerPanel(true); return; }
      var la = e.target.closest('[data-layer-act]'); if (la) { layerAct(la.dataset.layerAct); return; }
      var sv = e.target.closest('[data-save]'); if (sv) { savePanel(false); save(sv.dataset.save); return; }
      var aa = e.target.closest('[data-adj-act]');
      if (aa) { var w2 = aa.dataset.adjAct; if (w2 === 'done') { if (aa.closest('.paint-adjust') === adjBox) adjustApply(); else adjustDone(); } else { adjustCancel(); adjustOpen(); } return; }
      var a = e.target.closest('[data-act]'); if (!a) return;
      runAct(a.dataset.act);
    });
    // the actions behind the buttons (some in the top bar, some here)
    function runAct(w) {
      if (w === 'layers') { openMenu(null); closeDrops(); savePanel(false); layerPanel(panel.hidden); }
      else if (w === 'adjust') { if (!adjBox.hidden) minimizeToolMenu(); else adjustOpen(); }
      else if (w === 'undo') doUndo();
      else if (w === 'redo') doRedo();
      else if (w === 'clear') {
        if (sel) commitSelection();
        if (!active) return;
        remember('Clear Layer', true); active.ctx.clearRect(0, 0, W, H);
        if (active.bg) { active.ctx.fillStyle = '#fff'; active.ctx.fillRect(0, 0, W, H); }
        autosave();
      }
      else if (w === 'save') { openMenu(null); layerPanel(false); closeDrops(); savePanel(saveMenu.hidden); }
    }
    document.addEventListener('pointerdown', function (e) {
      if (!document.contains(root)) return;
      if (anyMenu() && !e.target.closest('.paint-brushes, button[data-tool], .paint-mirror')) openMenu(null);
      if (!panel.hidden && !e.target.closest('.paint-layerpanel, .paint-lmenu, [data-act="layers"]')) layerPanel(false);
      // (the colour picker stays open for the top bar's Settings, its menu,
      // and the arrow that opens the bar to reach it)
      if (!pc.hidden && !e.target.closest('.paint-colorpanel, .paint-current, .paint-second, .paint-swap, button[data-tool], .selection-slot, .paint-ctx, .paint-settings-toggle, [data-hb="settings"], .paint-settings, .hdr-fold') && !stage.contains(e.target)) picker(null);
      if ((!adjBox.hidden || adj) && !e.target.closest('.paint-adjust, [data-act="adjust"], .paint-zoom, button[data-tool], .selection-slot, .paint-ctx, .paint-settings-toggle')) adjustDone(stage.contains(e.target));
      if (!saveMenu.hidden && !e.target.closest('.paint-savemenu, [data-act="save"]')) savePanel(false);
      if (!moreBox.hidden && !e.target.closest('.paint-moremenu, [data-hb="more"]')) moreMenu(false);
    }, true);
    sizeIn.addEventListener('input', function () { setSize(sizeAt(+sizeIn.value), true); if (textBox) placeTextBox(); preview(); });
    alphaIn.addEventListener('input', function () { st.alpha = +alphaIn.value / 100; alphaIn.nextElementSibling.textContent = alphaIn.value; if (textBox) styleTextBox(); else preview(); });

    // ---- DRAG A COLOUR onto the picture: it drops in and spreads out to
    // fill the area it lands on (like the fill tool). Any swatch, a recent
    // colour, or the two main colours at the top. A tap on one of those two
    // (it barely moved) opens the colour picker instead, so a drag never
    // does. (A tap is told apart here, not by the click after it: a touch
    // that moved can still end in a click.) ----
    var blob = null, pairPressed = -1e9;
    function colourDrag(e) {
      var sw = e.target.closest('.paint-current, .paint-second, .paint-colorpanel [data-pc-color]');
      if (!sw || (e.pointerType === 'mouse' && e.button !== 0)) return;
      var main = sw.classList.contains('paint-current'), pair = main || sw.classList.contains('paint-second');
      var start = { x: e.clientX, y: e.clientY, c: sw.dataset.pcColor || (main ? st.color : st.color2), el: sw, id: e.pointerId, on: false };
      e.preventDefault(); // (no text selection or focus ring from a drag)
      try { sw.setPointerCapture(e.pointerId); } catch (x) {}
      function mv(ev) {
        if (!start.on) {
          if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
          start.on = true; clearTimeout(pcHold); // (a drag isn't a press and hold)
          blob = document.createElement('div'); blob.className = 'paint-blob'; blob.style.background = start.c; busy(true);
          document.body.appendChild(blob);
        }
        // (placed with translate, not transform: its grow-and-plop scale is
        // applied after a translate, so it can't throw the position off)
        blob.style.translate = (ev.clientX - 13) + 'px ' + (ev.clientY - 13) + 'px';
        var over = document.elementFromPoint(ev.clientX, ev.clientY);
        blob.classList.toggle('over', !!(over && over.closest('.paint-stage')));
      }
      function done(ev) {
        sw.removeEventListener('pointermove', mv); sw.removeEventListener('pointerup', done); sw.removeEventListener('pointercancel', done);
        if (start.on) busy(false);
        // (the click that follows a press on the two colours is never acted on:
        // the tap opened the picker here already, and a drag shouldn't)
        if (pair) pairPressed = performance.now();
        if (!start.on) { if (pair && ev.type === 'pointerup') picker(main ? 'main' : 'second'); return; }
        // (it was dragged, so the tap that follows isn't a colour pick)
        var stop = function (c) { c.stopPropagation(); c.preventDefault(); };
        sw.addEventListener('click', stop, true); setTimeout(function () { sw.removeEventListener('click', stop, true); }, 400);
        // (this drag's own blob: another drag may have begun before it's gone)
        var b = blob; blob = null;
        var over = ev.type === 'pointerup' && document.elementFromPoint(ev.clientX, ev.clientY);
        if (b) { if (over && over.closest('.paint-stage')) plopAt(0, 0, '', b); else { b.classList.add('gone'); setTimeout(function () { b.remove(); }, ev.type === 'pointerup' ? 260 : 0); } }
        if (over && over.closest('.paint-stage') && !over.closest(STAGE_UI)) {
          var r = stage.getBoundingClientRect();
          plopFill(fromScreen(ev.clientX - r.left, ev.clientY - r.top), start.c);
        }
      }
      sw.addEventListener('pointermove', mv); sw.addEventListener('pointerup', done); sw.addEventListener('pointercancel', done);
    }
    paintEl.addEventListener('pointerdown', colourDrag); // (the bottom bar's two colours, and the picker's, wherever it is)
    function plopFill(p, color) {
      if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) return;
      if (adj) adjustDone(); if (textBox) commitText(); need(); anchor();
      fillDrop(p, color); pushRecent(color);
    }
    $('.paint-open input').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      if (isProject(f)) openProject(f); else addPicture(f, 'open');
      e.target.value = '';
    });
    // ---- A PROJECT FILE (.paint): the whole drawing, every layer with its
    // settings, and your own palettes, in one file to keep, carry to another
    // device and open again to carry on. (Saved pictures are flattened; this
    // isn't.) ----
    // (a text layer's words, from a file: only what's expected, of the right kinds)
    function textFrom(t) {
      if (!t || typeof t !== 'object' || typeof t.str !== 'string') return null;
      var num = function (v, d) { v = +v; return isFinite(v) ? v : d; }, col = function (c, d) { return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : d; };
      var out = { str: t.str.slice(0, 5000), x: num(t.x, 0), y: num(t.y, 0), w: Math.max(0, num(t.w, 0)), rot: num(t.rot, 0), font: typeof t.font === 'string' ? t.font.slice(0, 200) : FONTS[0][0],
        size: Math.max(1, Math.min(4000, num(t.size, 48))), color: col(t.color, '#141414'), color2: col(t.color2, '#ffffff'), alpha: Math.max(0, Math.min(1, num(t.alpha, 1))),
        bold: !!t.bold, italic: !!t.italic, underline: !!t.underline, caps: !!t.caps, align: /^(left|center|right)$/.test(t.align) ? t.align : 'left',
        spacing: num(t.spacing, 0), lh: Math.max(0.5, Math.min(4, num(t.lh, 1.2))), outline: Math.max(0, Math.min(30, num(t.outline, 0))), shadow: !!t.shadow,
        fill: /^(solid|gradient|rainbow|two)$/.test(t.fill) ? t.fill : 'solid', arc: Math.max(-100, Math.min(100, num(t.arc, 0))) };
      // (words on a path: its points, and their handles)
      var pt = function (q) { return q && typeof q === 'object' && isFinite(+q.x) && isFinite(+q.y) ? { x: +q.x, y: +q.y } : null; };
      if (t.path && Array.isArray(t.path.pts) && t.path.pts.length > 1 && t.path.pts.length <= 2000) {
        var pts = t.path.pts.map(function (q) { var a = pt(q); if (a) { a.i = pt(q.i); a.o = pt(q.o); } return a; });
        if (pts.every(Boolean)) { out.path = { pts: pts, closed: !!t.path.closed }; out.arc = 0; out.w = 0; }
      }
      return out;
    }
    function isProject(f) { return /\.paint$/i.test(f.name || '') || f.type === 'application/x-paint-alternative'; }
    function saveProject() {
      finishWork();
      var gl = []; layers.forEach(function (L) { if (L.group && gl.indexOf(L.group) < 0) gl.push(L.group); });
      var out = { app: 'Paint Alternative', version: 1, width: ov.width, height: ov.height, active: layers.indexOf(active), palettes: myPalettes,
        groups: gl.map(function (G) { return { name: G.name, open: G.open, visible: G.visible, opacity: G.opacity, blend: G.blend }; }),
        layers: layers.map(function (L) { return { name: L.name, visible: L.visible, bg: L.bg, opacity: L.opacity, blend: L.blend, alphaLock: L.alphaLock, clip: L.clip, text: L.text || null, group: gl.indexOf(L.group), mask: L.mask ? L.mask.cv.toDataURL('image/png') : null, png: L.cv.toDataURL('image/png') }; }) };
      var blob = new Blob([JSON.stringify(out)], { type: 'application/x-paint-alternative' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'drawing.paint';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      toast('Saved the project: open it again to carry on');
    }
    function openProject(file) {
      var rd = new FileReader();
      rd.onerror = function () { toast('That project couldn’t be opened'); };
      rd.onload = function () {
        var d; try { d = JSON.parse(rd.result); } catch (x) { d = null; }
        if (!d || !d.layers || !d.layers.length || !(d.width > 0) || !(d.height > 0) || d.width > MAXPX || d.height > MAXPX || d.width * d.height > MAXAREA) { toast('That isn’t a Paint Alternative project'); return; }
        var nMax = Math.max(10, Math.min(50, Math.floor(900e6 / (Math.round(d.width) * Math.round(d.height) * 4))));
        Promise.all(d.layers.slice(0, nMax).map(function (l) {
          var load = function (src) { return new Promise(function (ok) { if (typeof src !== 'string' || !/^data:image\/png;base64,/.test(src)) { ok(null); return; } var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = src; }); };
          return Promise.all([load(l.png), load(l.mask)]);
        })).then(function (pairs) {
          var ims = pairs.map(function (q) { return q[0]; }), mims = pairs.map(function (q) { return q[1]; });
          var gs = (Array.isArray(d.groups) ? d.groups : []).slice(0, 50).map(function (q) { var G = makeGroup(String(q && q.name || '').slice(0, 24) || null); G.open = !q || q.open !== false; G.visible = !q || q.visible !== false; G.opacity = q && q.opacity >= 0 && q.opacity <= 1 ? +q.opacity : 1; G.blend = q && BLENDS.some(function (b) { return b[0] === q.blend; }) ? q.blend : 'normal'; return G; });
          // (it opens as a drawing of its own: the one that was there stays
          // in the gallery, or, where there's no gallery, undo brings it back)
          archive(function (kept) {
          gid = newGid();
          if (kept) { undo = []; redo = []; trimmed = false; } else rememberDoc('Open Project');
          docName = String(file.name || '').replace(/\.paint$/i, '').slice(0, 40) || null;
          setDoc(Math.round(d.width), Math.round(d.height));
          layers = d.layers.slice(0, nMax).map(function (l, i) {
            var L = makeLayer(String(l.name || 'Layer ' + (i + 1)).slice(0, 24), false);
            L.bg = !!l.bg; L.visible = l.visible !== false; L.opacity = Math.max(0, Math.min(1, +l.opacity || (l.opacity === 0 ? 0 : 1)));
            L.blend = BLENDS.some(function (b) { return b[0] === l.blend; }) ? l.blend : 'normal'; L.alphaLock = !!l.alphaLock; L.clip = !!l.clip; L.text = textFrom(l.text);
            if (ims[i]) { L.ctx.save(); L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.drawImage(ims[i], 0, 0); L.ctx.restore(); }
            L.group = gs[l.group | 0] && l.group >= 0 ? gs[l.group | 0] : null;
            if (mims[i]) { L.mask = makeMask(L); L.mask.ctx.save(); L.mask.ctx.setTransform(1, 0, 0, 1, 0, 0); L.mask.ctx.drawImage(mims[i], 0, 0); L.mask.ctx.restore(); maskAlpha(L); }
            return L;
          });
          active = layers[Math.max(0, Math.min(layers.length - 1, d.active | 0))];
          count = layers.length;
          // (palettes it brings that aren't here already are added)
          if (Array.isArray(d.palettes)) {
            d.palettes.forEach(function (q) {
              if (!q || typeof q.name !== 'string' || !Array.isArray(q.colors)) return;
              var cs = q.colors.filter(function (c) { return /^#[0-9a-f]{6}$/i.test(c); }).slice(0, 64);
              if (!myPalettes.some(function (m) { return m.name === q.name; })) myPalettes.push({ name: q.name.slice(0, 40), colors: cs });
            });
            storeIt('paint-palettes', myPalettes);
          }
          mount(); fit(); buttons(); autosave();
          toast('Opened the project');
          });
        });
      };
      rd.readAsText(file);
    }
    var saveMenu = document.createElement('div');
    saveMenu.className = 'paint-savemenu'; saveMenu.hidden = true; saveMenu.setAttribute('role', 'menu');
    saveMenu.innerHTML = '<button type="button" role="menuitem" data-save="png">PNG<small>Keeps see-through parts</small></button>' +
      '<button type="button" role="menuitem" data-save="jpeg">JPEG<small>Smaller file</small></button>' +
      '<button type="button" role="menuitem" data-save="share">Share\u2026<small>Messages, Photos, Mail\u2026</small></button>' +
      '<button type="button" role="menuitem" data-save="project">Project<small>Every layer, to carry on later</small></button>';
    root.appendChild(saveMenu);
    function savePanel(open) {
      saveMenu.hidden = !open;
      var b = $('[data-act="save"]'); b.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) dropUnder(saveMenu, b);
    }
    function save(type) {
      if (type === 'share') { share(); return; }
      if (type === 'project') { saveProject(); return; }
      if (grad) gradDone(); if (adj) adjustDone();
      if (textBox) commitText();
      if (sel) commitSelection();
      flatBlob(type, function (blob) { if (blob) download(blob, type === 'jpeg' ? 'jpg' : 'png'); });
    }

    // ---- the drawing is kept in the browser (layers and all), so it's
    // still there after leaving the page or closing the tab. The top bar
    // says how that's going: Saved, Saving… (a change is about to be kept),
    // or Not saved (this browser won't keep it) ----
    var statusEl = document.querySelector('.doc-status');
    function docStatus(state) {
      if (!statusEl || statusEl.dataset.state === state) return;
      statusEl.dataset.state = state;
      statusEl.querySelector('span').textContent = state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving' : 'Not saved';
    }
    var saveTimer = 0, restoring = true, saveGen = 0;
    function db(fn) {
      try {
        var r = indexedDB.open('paint-alternative', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('s'); };
        r.onsuccess = function () { var D = r.result; D.onversionchange = function () { D.close(); }; try { fn(D.transaction('s', 'readwrite').objectStore('s')); } catch (x) {} D.close(); };
      } catch (x) {}
    }
    function autosave() { thumbsSoon(); viewsSoon(); if (!restoring) docStatus('saving'); if (restoring) return; clearTimeout(saveTimer); saveTimer = setTimeout(storeNow, 1000); }
    function storeNow() {
      clearTimeout(saveTimer); saveTimer = 0;
      if (!window.indexedDB) { docStatus('off'); return; }
      if (restoring || !window.Promise) return;
      var gen = ++saveGen;
      docInfo(function (info) {
        if (!info || gen !== saveGen) return;
        db(function (os) { var q = os.put(info, 'picture'); q.onsuccess = function () { if (!saveTimer) docStatus('saved'); }; q.onerror = function () { docStatus('off'); }; });
      });
    }
    // the drawing as it's kept: its size, its layers (each as a PNG, with its
    // mask) and their groups, and which drawing of the gallery it is
    function docInfo(then) {
      var info = { R: R, pw: ov.width, ph: ov.height, active: layers.indexOf(active), count: count, gid: gid, name: docName }, gl = [];
      layers.forEach(function (L) { if (L.group && gl.indexOf(L.group) < 0) gl.push(L.group); });
      info.groups = gl.map(function (G) { return { name: G.name, open: G.open, visible: G.visible, opacity: G.opacity, blend: G.blend }; });
      Promise.all(layers.map(function (L) {
        var cv = L.cv;
        var up = sel && sel.more ? sel.more.filter(function (it) { return it.L === L && it.f; })[0] : null;
        if (up || (sel && sel.float && !sel.more && L === active)) {
          // (anything lifted and still being moved is kept where it is now)
          cv = document.createElement('canvas'); cv.width = L.cv.width; cv.height = L.cv.height;
          var x = cv.getContext('2d'); x.drawImage(L.cv, 0, 0); base(x); putFloat(x, up && up.f);
        }
        return new Promise(function (ok) {
          cv.toBlob(function (b) {
            var o = { name: L.name, visible: L.visible, bg: L.bg, opacity: L.opacity, blend: L.blend, alphaLock: L.alphaLock, clip: L.clip, text: L.text || null, group: gl.indexOf(L.group), blob: b };
            if (L.mask) L.mask.cv.toBlob(function (mb) { o.mblob = mb; ok(o); }, 'image/png'); else ok(o);
          }, 'image/png');
        });
      })).then(function (list) {
        if (list.some(function (l) { return !l.blob; })) { then(null); return; }
        info.layers = list; then(info);
      }, function () { then(null); });
    }
    function restore() {
      var got = false, fin = false;
      var done = function () { if (fin) return; fin = true; restoring = false; opened(); if (undo.length) autosave(); };
      if (!window.indexedDB || !window.createImageBitmap) { done(); return; }
      setTimeout(function () { if (!got) done(); }, 3000); // (a browser that doesn't answer isn't waited on)
      setTimeout(done, 20000);
      db(function (os) {
        var g = os.get('picture');
        g.onerror = done;
        g.onsuccess = function () {
          got = true;
          var d = g.result;
          if (!d || !d.layers) { done(); return; }
          if (undo.length || fin) { keepAside(d); done(); return; }
          applyInfo(d, function () { return !undo.length && !fin; }, function (put) {
            if (put) { gid = d.gid || null; docName = d.name || null; } else keepAside(d);
            done();
          });
        };
      });
    }
    function keepAside(d) {
      var id = d.gid || newGid(); d.gid = id;
      galList(function (list) {
        if (!list || list.some(function (e) { return e.id === id; })) return;
        dbAsk(function (os) { return os.put(d, 'g:' + id); }, function (v) {
          if (v === undefined) return;
          list.unshift({ id: id, name: d.name || nextName(list), t: Date.now(), w: d.pw, h: d.ph, thumb: '' }); galSave(list, function () {});
        });
      });
    }
    // THE OPENING: the app's mark shows until the drawing is back (and the
    // type is here, or a moment has passed), then fades into the workspace.
    // It's never held back on purpose beyond its own short entrance; if
    // opening takes a while, a quiet bar shows under it
    var splash = document.querySelector('.app-splash');
    if (splash) setTimeout(function () { if (splash) splash.classList.add('slow'); }, 1200);
    function opened() {
      if (!splash) return;
      var s = splash; splash = null;
      var fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (ok) { setTimeout(ok, 700); })]) : Promise.resolve();
      fonts.then(function () {
        var calmNow = calm && calm.matches, wait = calmNow ? 0 : Math.max(0, 560 - performance.now());
        setTimeout(function () { requestAnimationFrame(function () { s.classList.add('out'); setTimeout(function () { s.remove(); }, 400); }); }, wait);
      });
    }
    // (a kept drawing, put back: ready() says whether it still should be,
    // once its pictures are ready)
    function applyInfo(d, ready, done) {
      Promise.all(d.layers.map(function (l) { return createImageBitmap(l.blob); }).concat(d.layers.map(function (l) { return l.mblob ? createImageBitmap(l.mblob).catch(function () { return null; }) : null; }))).then(function (ims) {
        var mims = ims.slice(d.layers.length), gs = (d.groups || []).map(function (q) { var G = makeGroup(q.name); G.open = q.open !== false; G.visible = q.visible !== false; G.opacity = q.opacity != null ? q.opacity : 1; G.blend = q.blend || 'normal'; return G; });
        if (!ready()) { done(); return; } // (they've started drawing already)
        // (a picture of a chosen size comes back at that size; an older
        // one, at the size of the screen)
        if (d.pw && d.ph) setDoc(d.pw, d.ph);
        layers = d.layers.map(function (l, i) {
          var L = makeLayer(l.name, l.bg != null ? l.bg : i === 0); L.visible = l.visible !== false;
          L.opacity = l.opacity != null ? l.opacity : 1; L.blend = l.blend || 'normal'; L.alphaLock = !!l.alphaLock; L.clip = !!l.clip; L.text = textFrom(l.text);
          L.group = gs[l.group] || null;
          if (mims[i]) { L.mask = makeMask(L); L.mask.ctx.save(); L.mask.ctx.setTransform(1, 0, 0, 1, 0, 0); L.mask.ctx.drawImage(mims[i], 0, 0, L.cv.width, L.cv.height); L.mask.ctx.restore(); maskAlpha(L); }
          if (d.pw) L.ctx.drawImage(ims[i], 0, 0, ims[i].width / R, ims[i].height / R);
          else L.ctx.drawImage(ims[i], 0, 0, ims[i].width / d.R, ims[i].height / d.R);
          return L;
        });
        active = layers[Math.max(0, Math.min(layers.length - 1, d.active | 0))] || null;
        count = layers.length ? Math.max(count, d.count | 0) : 0;
        ims.forEach(function (b) { if (b && b.close) b.close(); });
        mount(); if (d.pw) fit(); done(true);
      }, function () { done(); });
    }
    // ---- THE GALLERY: every drawing, kept in this browser. The one being
    // drawn is the autosave ('picture'); each is also kept as 'g:' and its
    // id, with a list of them all ('gallery': names, when each was last
    // drawn on, its size and a small picture of it). The one in hand is
    // brought up to date when the gallery opens and before another one is
    // opened or started ----
    var gid = null, docName = null;
    function newGid() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    // (each call answers once, and soon: a browser that won't keep things
    // still gets an answer)
    function dbAsk(fn, cb) {
      var said = false, say = function (v) { if (!said) { said = true; cb(v); } };
      if (!window.indexedDB) { say(undefined); return; }
      setTimeout(function () { say(undefined); }, 4000);
      try {
        var r = indexedDB.open('paint-alternative', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('s'); };
        r.onerror = function () { say(undefined); };
        r.onsuccess = function () { var D = r.result; try { var q = fn(D.transaction('s', 'readwrite').objectStore('s')); q.onsuccess = function () { say(q.result === undefined ? null : q.result); }; q.onerror = function () { say(undefined); }; } catch (x) { say(undefined); } D.close(); };
      } catch (x) { say(undefined); }
    }
    function galList(cb) { dbAsk(function (os) { return os.get('gallery'); }, function (v) { cb(v === undefined ? null : Array.isArray(v) ? v : []); }); }
    function galSave(list, cb) { dbAsk(function (os) { return os.put(list, 'gallery'); }, function (v) { cb(v !== undefined); }); }
    // (the picture small, for the gallery; and whether there's anything on it)
    function thumbOf() {
      var f = document.createElement('canvas'); f.width = ov.width; f.height = ov.height; flattenInto(f.getContext('2d'));
      var k = Math.min(1, 320 / Math.max(f.width, f.height)), t = document.createElement('canvas');
      t.width = Math.max(1, Math.round(f.width * k)); t.height = Math.max(1, Math.round(f.height * k));
      var x = t.getContext('2d'); x.drawImage(f, 0, 0, t.width, t.height);
      var d = x.getImageData(0, 0, t.width, t.height).data, blank = true;
      for (var i = 0; i < d.length && blank; i += 4) if (d[i + 3] > 8 && d[i] + d[i + 1] + d[i + 2] < 740) blank = false;
      return { url: t.toDataURL('image/png'), blank: blank && layers.every(function (L) { return !L.text; }) };
    }
    // KEEP the drawing in hand in the gallery (an empty page that was never
    // kept isn't); then(true) once it's kept, or there was nothing to keep
    function archive(then, list0) {
      finishWork(); if (!gid) gid = newGid();
      var go = function (list) {
        if (!list) { then(false); return; }
        var th = thumbOf(), i = -1; list.forEach(function (e, j) { if (e.id === gid) i = j; });
        if (th.blank && i < 0) { then(true, list); return; }
        docInfo(function (info) {
          if (!info) { then(false); return; }
          dbAsk(function (os) { return os.put(info, 'g:' + gid); }, function (v) {
            if (v === undefined) { then(false); return; }
            var e = i >= 0 ? list[i] : { id: gid };
            if (i < 0) { docName = docName || nextName(list); list.unshift(e); }
            e.name = docName || e.name; e.t = Date.now(); e.w = ov.width; e.h = ov.height; e.thumb = th.url;
            galSave(list, function (ok) { then(ok, list); });
          });
        });
      };
      if (list0) go(list0); else galList(go);
    }
    function nextName(list) { for (var n = list.length + 1; ; n++) { var nm = 'Drawing ' + n; if (!list.some(function (e) { return e.name === nm; })) return nm; } }
    // OPEN one: the one in hand is kept first, and the new one starts with
    // nothing to undo
    // (gone: the one in hand was just deleted, so it isn't kept)
    function openDrawing(id, gone) {
      if (id === gid) { closeSheet(); return; }
      (gone ? function (f) { galList(function (l) { f(!!l, l); }); } : archive)(function (ok, list) {
        if (!ok) { toast('This browser can\u2019t keep a gallery'); return; }
        var e = list.filter(function (x) { return x.id === id; })[0];
        dbAsk(function (os) { return os.get('g:' + id); }, function (d) {
          if (!d || !d.layers || !e) { toast('That drawing couldn\u2019t be opened'); return; }
          applyInfo(d, function () { return true; }, function (put) {
            if (!put) { toast('That drawing couldn\u2019t be opened'); return; }
            gid = id; docName = e.name; undo = []; redo = []; trimmed = false; buttons(); storeNow();
            closeSheet(); toast('Opened ' + e.name);
          });
        });
      });
    }
    function galDate(t) {
      var d = new Date(t), now = new Date();
      if (d.toDateString() === now.toDateString()) return 'Today, ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
    }
    var galBox = null;
    function gallery() {
      galBox = openSheet('gal', '<div class="pa-sheet-title">Gallery</div><div class="gal-grid" aria-busy="true"></div>' +
        '<div class="pa-sheet-acts"><button type="button" class="pa-primary" data-close>Done</button></div>');
      galBox.querySelector('[data-close]').addEventListener('click', closeSheet);
      galBox.addEventListener('click', galClick);
      galBox.addEventListener('keydown', function (e) { var i = e.target.closest('.gal-rename'); if (!i) return; e.stopPropagation(); if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') i.blur(); else if (e.key === 'Escape') { i.dataset.cancel = '1'; i.blur(); } });
      galBox.addEventListener('focusout', function (e) { var i = e.target.closest('.gal-rename'); if (i) renameDone(i); });
      archive(function (ok, list) {
        if (!galBox || !galBox.isConnected) return;
        if (!ok && !list) { galBox.querySelector('.gal-grid').outerHTML = '<div class="ns-note">This browser isn\u2019t keeping things (a private window, perhaps), so there\u2019s no gallery. Save keeps a copy.</div>'; return; }
        galDraw(list || []);
      });
    }
    var PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>', DOTS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/></svg>';
    function galDraw(list) {
      list.sort(function (a, b) { return (b.t || 0) - (a.t || 0); }); // (the latest first)
      galBox.galList = list;
      var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
      var g = galBox.querySelector('.gal-grid'); g.removeAttribute('aria-busy');
      g.innerHTML = '<button type="button" class="gal-new" data-gal="new"><span class="gal-th">' + PLUS + '</span><b>New Drawing</b></button>' +
        list.map(function (e) {
          var cur = e.id === gid;
          return '<div class="gal-card' + (cur ? ' on' : '') + '" data-id="' + esc(e.id) + '">' +
            '<button type="button" class="gal-open" data-gal="open" aria-label="Open ' + esc(e.name) + '"' + (cur ? ' aria-current="true"' : '') + '><span class="gal-th"><img src="' + esc(e.thumb || '') + '" alt=""></span></button>' +
            '<div class="gal-meta"><span class="gal-name">' + esc(e.name) + '</span><small>' + (cur ? 'Open now' : galDate(e.t)) + ' \u00b7 ' + e.w + ' \u00d7 ' + e.h + '</small></div>' +
            '<button type="button" class="gal-more" data-gal="more" aria-label="Options for ' + esc(e.name) + '" aria-expanded="false" data-tip="Rename, duplicate or delete">' + DOTS + '</button>' +
            '<div class="gal-acts" role="menu" hidden><button type="button" role="menuitem" data-gal="rename">Rename</button><button type="button" role="menuitem" data-gal="dup">Duplicate</button><button type="button" role="menuitem" class="gal-del" data-gal="del">Delete</button></div></div>';
        }).join('');
      if (!list.length) g.insertAdjacentHTML('beforeend', '<div class="ns-note gal-empty">Your drawings are kept here as you make them.</div>');
    }
    function galClick(e) {
      var b = e.target.closest('[data-gal]'); if (!b) { galMenus(null); return; }
      var w = b.dataset.gal, card = b.closest('.gal-card'), id = card && card.dataset.id, list = galBox.galList || [];
      var ent = list.filter(function (x) { return x.id === id; })[0];
      if (w === 'new') { closeSheet(); newSheet(); return; }
      if (w === 'open') { openDrawing(id); return; }
      if (w === 'settings') { settingsMenu(); return; }
      if (w === 'more') { galMenus(card.querySelector('.gal-acts').hidden ? card : null); return; }
      if (w === 'rename') {
        galMenus(null);
        var nm = card.querySelector('.gal-name'), inp = document.createElement('input');
        inp.className = 'p-field gal-rename'; inp.value = ent.name; inp.maxLength = 40; inp.setAttribute('aria-label', 'Name');
        nm.replaceWith(inp); inp.focus(); inp.select(); return;
      }
      if (w === 'dup') {
        galMenus(null);
        dbAsk(function (os) { return os.get('g:' + id); }, function (d) {
          if (!d) { toast('That drawing couldn\u2019t be copied'); return; }
          var nid = newGid(); d.gid = nid; d.name = ent.name + ' Copy';
          dbAsk(function (os) { return os.put(d, 'g:' + nid); }, function (v) {
            if (v === undefined) { toast('That drawing couldn\u2019t be copied'); return; }
            var c = {}; for (var k in ent) c[k] = ent[k]; c.id = nid; c.name = d.name; c.t = Date.now();
            list.splice(list.indexOf(ent), 0, c);
            galSave(list, function () { galDraw(list); });
          });
        });
        return;
      }
      if (w === 'del') {
        // (asked twice: the second press deletes it for good)
        if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'Delete for Good'; return; }
        galMenus(null);
        list.splice(list.indexOf(ent), 1);
        dbAsk(function (os) { return os.delete('g:' + id); }, function () {
          galSave(list, function () {
            if (id !== gid) { galDraw(list); return; }
            // (the one in hand: the next one opens, or a fresh page)
            gid = null; docName = null;
            if (list.length) openDrawing(list[0].id, true);
            else { gid = newGid(); undo = []; redo = []; newPicture0(ov.width, ov.height, true); galDraw(list); }
          });
        });
      }
    }
    function galMenus(card) {
      Array.prototype.forEach.call(galBox.querySelectorAll('.gal-card'), function (c) {
        var on = c === card, m = c.querySelector('.gal-acts'); m.hidden = !on; c.querySelector('.gal-more').setAttribute('aria-expanded', on ? 'true' : 'false');
        if (!on) { var d = m.querySelector('.gal-del'); d.classList.remove('sure'); d.textContent = 'Delete'; }
      });
    }
    function renameDone(inp) {
      if (!inp.isConnected || inp.dataset.done) return; inp.dataset.done = '1';
      var card = inp.closest('.gal-card'), list = galBox.galList, ent = list.filter(function (x) { return x.id === card.dataset.id; })[0], nm = inp.value.trim().slice(0, 40);
      if (nm && !inp.dataset.cancel && ent) { ent.name = nm; if (ent.id === gid) { docName = nm; autosave(); } galSave(list, function () {}); }
      galDraw(list);
    }

    // ---- GESTURES: what each touch gesture does (kept for next time).
    // Pinching, moving and turning with two fingers always work ----
    var GACTS = [['none', 'Nothing'], ['undo', 'Undo'], ['redo', 'Redo'], ['eraser', 'Brush \u21c4 Eraser'], ['pick', 'Colour Picker'], ['swap', 'Swap Colours'], ['focus', 'Focus Mode'], ['fit', 'Fit the Picture'], ['layers', 'Layers'], ['gallery', 'Gallery']];
    var GDEF = { tap2: 'undo', tap3: 'redo', tap4: 'focus', hold: 'none' }, GNAMES = { tap2: 'Two-finger tap', tap3: 'Three-finger tap', tap4: 'Four-finger tap', hold: 'Touch and hold' };
    var gest = (function () { var g = stored('paint-gestures', {}), o = {}; for (var k in GDEF) o[k] = GACTS.some(function (a) { return a[0] === g[k]; }) ? g[k] : GDEF[k]; return o; })();
    function gactName(a) { return (GACTS.filter(function (x) { return x[0] === a; })[0] || GACTS[0])[1]; }
    var lastPaint = 'brush';
    // (at: where on the screen it happened; ev: the finger, for the picker
    // to follow while it's held)
    function gestureDo(a, at, ev) {
      if (a === 'undo') { if (undo.length || (pen && pen.pts.length) || grad) { doUndo(); toast('Undo'); } }
      else if (a === 'redo') { if (redo.length) { doRedo(); toast('Redo'); } }
      else if (a === 'eraser') { if (st.tool === 'eraser') setTool(lastPaint); else { lastPaint = st.tool; setTool('eraser'); } toast(st.tool === 'eraser' ? 'Eraser' : TOOL_NAMES[st.tool] || 'Brush'); }
      else if (a === 'pick') {
        var r = stage.getBoundingClientRect(), e = ev || { pointerId: -1, pointerType: 'touch', clientX: r.left + at.x, clientY: r.top + at.y };
        pickStart(e, fromScreen(at.x, at.y), true);
        if (!ev) pickEnd(false);
      }
      else if (a === 'swap') { var c1 = st.color; setColor(st.color2); setColor2(c1); }
      else if (a === 'focus') focusMode(!document.documentElement.classList.contains('focus-mode'));
      else if (a === 'fit') fit();
      else if (a === 'layers') layerPanel(panel.hidden);
      else if (a === 'gallery') gallery();
    }
    function gestureSheet() {
      var box = openSheet('gs', '<div class="pa-sheet-title">Touch Gestures</div><div class="gs-list">' +
        Object.keys(GDEF).map(function (k) { return '<label class="gs-row"><span>' + GNAMES[k] + '</span><select class="p-field" data-gest="' + k + '">' + GACTS.map(function (a) { return '<option value="' + a[0] + '"' + (gest[k] === a[0] ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('') + '</select></label>'; }).join('') +
        '<label class="gs-row"><span>Draw with a finger</span><select class="p-field" data-finger><option value="pencil"' + (fingerDraw === 'pencil' ? ' selected' : '') + '>Until Apple Pencil is used</option><option value="always"' + (fingerDraw === 'always' ? ' selected' : '') + '>Always</option></select></label>' +
        '</div><div class="ns-note">Touch and hold: keep one finger still on the picture for half a second. Pinching to zoom, and moving and turning the picture with two fingers, always work.</div>' +
        '<div class="pa-sheet-acts"><button type="button" data-gs="reset">Reset</button><button type="button" class="pa-primary" data-gs="done">Done</button></div>');
      box.addEventListener('change', function (e) { var k = e.target.dataset.gest; if (k) { gest[k] = e.target.value; storeIt('paint-gestures', gest); } if ('finger' in e.target.dataset) { fingerDraw = e.target.value; storeIt('paint-finger-draw', fingerDraw); } });
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-gs]'); if (!b) return;
        if (b.dataset.gs === 'done') { closeSheet(); return; }
        for (var k in GDEF) { gest[k] = GDEF[k]; box.querySelector('[data-gest="' + k + '"]').value = GDEF[k]; }
        storeIt('paint-gestures', gest); fingerDraw = 'pencil'; storeIt('paint-finger-draw', fingerDraw); box.querySelector('[data-finger]').value = 'pencil';
      });
    }

    document.addEventListener('pageswap:start', function away() { document.removeEventListener('pageswap:start', away); if (saveTimer) storeNow(); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && grad && !down && document.contains(root)) gradDone(); if (document.visibilityState === 'hidden' && saveTimer && document.contains(root)) storeNow(); });
    window.addEventListener('pagehide', function () { if (saveTimer && document.contains(root)) storeNow(); });

    // ---- a short message that slides up from the bottom, then goes ----
    var toastEl = document.createElement('div'), toastTimer = 0;
    toastEl.className = 'paint-toast'; toastEl.setAttribute('role', 'status');
    document.body.appendChild(toastEl);
    function toast(msg) {
      toastEl.textContent = msg; toastEl.classList.add('on');
      clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 2600);
    }
    // (anything half-done is finished before the picture as a whole changes)
    function finishWork() {
      if (grad) gradDone(); if (adj) adjustDone(); if (textBox) commitText(); if (sel) commitSelection();
      openMenu(null); layerPanel(false); savePanel(false);
    }

    // ---- the header: New, Image, History, Share, Shortcuts (and Install) ----
    var header = document.querySelector('.site-header');
    function hb(name) { return header && header.querySelector('[data-hb="' + name + '"]'); }
    if (hb('guides')) hb('guides').setAttribute('aria-pressed', smartOn ? 'true' : 'false');
    // a list that drops down from a header button
    function placeDrop(el, btn) {
      if (!btn.offsetParent && hb('more')) btn = hb('more'); // (on a phone the button is in the ••• menu)
      btn = hdrBtn(btn);
      var r = btn.getBoundingClientRect();
      el.style.left = 'auto';
      el.style.top = Math.round(r.bottom + 8) + 'px';
      el.style.right = Math.round(Math.max(8, document.documentElement.clientWidth - r.right - 4)) + 'px';
    }
    function dropdown(cls) { var d = document.createElement('div'); d.className = 'paint-drop ' + cls; d.hidden = true; document.body.appendChild(d); return d; }
    function closeDrops() {
      var any = false;
      [imgMenu, histBox, moreBox, settingsBox].forEach(function (d) { if (d && !d.hidden) { d.hidden = true; any = true; } });
      if (hb('settings')) hb('settings').setAttribute('aria-expanded', 'false');
      if (hb('more')) hb('more').setAttribute('aria-expanded', 'false');
      hb('image').setAttribute('aria-expanded', 'false'); hb('history').setAttribute('aria-expanded', 'false');
      return any;
    }

    // ---- sheets: a panel in the middle of the screen over a dimmed page ----
    var sheetEl = null;
    var sheetFrom = null;
    function openSheet(cls, html) {
      var from = sheetEl ? sheetFrom : document.activeElement;
      closeSheet(); closeDrops(); finishMenus(); lmenu.hidden = true; ctxClose(); if (typeof bsBox !== 'undefined' && !bsBox.hidden) studio(false);
      sheetFrom = from;
      sheetEl = document.createElement('div'); sheetEl.className = 'pa-sheet-wrap';
      sheetEl.innerHTML = '<div class="pa-sheet ' + cls + '" role="dialog" aria-modal="true">' + html + '</div>';
      document.body.appendChild(sheetEl);
      var t = sheetEl.querySelector('.pa-sheet-title'); if (t) { t.id = 'pa-sheet-t'; sheetEl.firstChild.setAttribute('aria-labelledby', 'pa-sheet-t'); }
      sheetEl.addEventListener('pointerdown', function (e) { if (e.target === sheetEl) closeSheet(); });
      // (Tab goes round the sheet's own controls)
      sheetEl.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var f = Array.prototype.filter.call(sheetEl.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])'), function (x) { return !x.disabled && x.offsetParent; });
        if (!f.length) return;
        var i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      });
      void sheetEl.offsetWidth; sheetEl.classList.add('in');
      var first = sheetEl.querySelector('.pa-primary') || sheetEl.querySelector('button, input, select'); if (first) first.focus({ preventScroll: true });
      return sheetEl.firstChild;
    }
    function closeSheet() {
      if (!sheetEl) return false; var s = sheetEl, from = sheetFrom; sheetEl = null; sheetFrom = null; s.classList.remove('in'); setTimeout(function () { s.remove(); }, 220);
      if (from && from.focus && document.contains(from) && !from.closest('.pa-sheet-wrap')) from.focus({ preventScroll: true });
      return true;
    }

    // ---- NEW PICTURE: a fresh picture of a chosen size ----
    var MAXPX = 4096, MAXAREA = 4096 * 4096;
    function presets() {
      return [['screen', 'Fit Screen', Math.round(stage.clientWidth * R), Math.round(stage.clientHeight * R)], ['square', 'Square', 2048, 2048],
        ['wide', 'Landscape 16:9', 1920, 1080], ['tall', 'Portrait 9:16', 1080, 1920], ['photo', 'Photo 4:3', 2048, 1536],
        ['a4', 'A4 Paper', 2480, 3508], ['insta', 'Instagram Post', 1080, 1350]];
    }
    function newSheet() {
      var P = presets();
      var box = openSheet('ns', '<div class="pa-sheet-title">New Picture</div>' +
        '<div class="ns-grid">' + P.map(function (q) {
          var k = 34 / Math.max(q[2], q[3]);
          return '<button type="button" class="ns-pre" data-pre="' + q[0] + '"><i style="width:' + Math.max(8, Math.round(q[2] * k)) + 'px;height:' + Math.max(8, Math.round(q[3] * k)) + 'px"></i><b>' + q[1] + '</b><small>' + q[2] + ' × ' + q[3] + '</small></button>';
        }).join('') + '</div>' +
        '<div class="ns-row"><label>Width<input type="number" inputmode="numeric" min="16" max="' + MAXPX + '" data-ns="w"></label>' +
        '<button type="button" class="ns-swap" aria-label="Swap width and height" title="Swap width and height"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg></button>' +
        '<label>Height<input type="number" inputmode="numeric" min="16" max="' + MAXPX + '" data-ns="h"></label><span class="ns-unit">pixels</span></div>' +
        '<div class="ns-row ns-row-bg"><span class="ns-lab">Background</span><div class="pa-tabs ns-bg" role="tablist"><button type="button" role="tab" data-bg="white" aria-selected="true">White</button><button type="button" role="tab" data-bg="clear" aria-selected="false">Transparent</button></div></div>' +
        '<div class="ns-note">The picture you\u2019re on stays in your Gallery.</div><div class="ns-err" hidden></div>' +
        '<div class="pa-sheet-acts"><button type="button" data-ns-act="cancel">Cancel</button><button type="button" class="pa-primary" data-ns-act="create">Create</button></div>');
      var wIn = box.querySelector('[data-ns="w"]'), hIn = box.querySelector('[data-ns="h"]'), err = box.querySelector('.ns-err'), bg = 'white';
      function pick(id) {
        Array.prototype.forEach.call(box.querySelectorAll('.ns-pre'), function (b) { b.setAttribute('aria-pressed', b.dataset.pre === id ? 'true' : 'false'); });
        var q = P.filter(function (x) { return x[0] === id; })[0]; if (q) { wIn.value = q[2]; hIn.value = q[3]; }
        err.hidden = true;
      }
      wIn.value = ov.width; hIn.value = ov.height; pick(null);
      box.addEventListener('click', function (e) {
        var pr = e.target.closest('[data-pre]'); if (pr) { pick(pr.dataset.pre); return; }
        if (e.target.closest('.ns-swap')) { var t = wIn.value; wIn.value = hIn.value; hIn.value = t; pick(null); return; }
        var b = e.target.closest('[data-bg]');
        if (b) { bg = b.dataset.bg; Array.prototype.forEach.call(box.querySelectorAll('[data-bg]'), function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); }); return; }
        var a = e.target.closest('[data-ns-act]'); if (!a) return;
        if (a.dataset.nsAct === 'cancel') { closeSheet(); return; }
        var w = Math.round(+wIn.value), h = Math.round(+hIn.value);
        if (!(w >= 16 && h >= 16 && w <= MAXPX && h <= MAXPX)) { err.textContent = 'Width and height can be from 16 to ' + MAXPX + ' pixels.'; err.hidden = false; return; }
        if (w * h > MAXAREA) { err.textContent = 'That’s too big: make it smaller (up to about 16 million pixels).'; err.hidden = false; return; }
        closeSheet(); newPicture(w, h, bg === 'white');
      });
      [wIn, hIn].forEach(function (i) { i.addEventListener('input', function () { pick(null); }); i.addEventListener('keydown', function (e) { if (e.key === 'Enter') box.querySelector('[data-ns-act="create"]').click(); }); });
    }
    function newPicture(pw, ph, white) {
      finishWork();
      // (the drawing that was there stays in the gallery; where the browser
      // can't keep one, undo brings it back instead)
      archive(function (kept) {
        gid = newGid(); docName = null;
        if (kept) { undo = []; redo = []; trimmed = false; } else rememberDoc('New Picture');
        newPicture0(pw, ph, white);
      });
    }
    function newPicture0(pw, ph, white) {
      setDoc(pw, ph);
      count = 1;
      layers = [makeLayer(white ? 'Background' : 'Layer 1', white)]; active = layers[0];
      mount(); fit(); buttons(); autosave();
    }

    // ---- IMAGE: rotate, flip or crop the whole picture (every layer) ----
    // (on a phone the top bar keeps undo, redo, save and layers; the rest
    // is in its ••• menu)
    var GEST_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10"/><path d="M12 9.5a1.5 1.5 0 0 1 3 0V11"/><path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a5.5 5.5 0 0 1-5.5 5.5h-.6a5 5 0 0 1-4-2l-2.6-3.4a1.5 1.5 0 0 1 2.3-1.9L9 14"/></svg>';
    var moreBox = dropdown('paint-moremenu'); moreBox.setAttribute('role', 'menu');
    function moreMenu(open) {
      if (!open) { moreBox.hidden = true; hb('more').setAttribute('aria-expanded', 'false'); return; }
      closeDrops(); otherPopovers();
      var it = function (k, label) { var src = k === 'open' ? header.querySelector('.paint-open svg') : k === 'theme' ? header.querySelector('.theme-toggle svg') : hb(k) && hb(k).querySelector('svg'); return '<button type="button" role="menuitem" data-more="' + k + '">' + (src ? src.outerHTML : '') + label + '</button>'; };
      moreBox.innerHTML = it('gallery', 'Gallery') + it('new', 'New Picture') + it('open', 'Open…') + it('share', 'Share') + '<hr>' + it('image', 'Crop, Rotate & Flip') + it('history', 'History') + '<hr>' +
        it('focus', 'Focus Mode') + it('guides', smartOn ? 'Smart Guides: On' : 'Smart Guides: Off') + it('help', 'Shortcuts') + '<button type="button" role="menuitem" data-more="gestures">' + GEST_ICON + 'Touch Gestures</button>' + it('theme', document.documentElement.getAttribute('data-theme') === 'dark' ? 'Light Mode' : 'Dark Mode');
      moreBox.hidden = false; hb('more').setAttribute('aria-expanded', 'true'); placeDrop(moreBox, hb('more'));
    }
    moreBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-more]'); if (!b) return;
      var k = b.dataset.more; moreMenu(false);
      if (k === 'open') header.querySelector('.paint-open input').click();
      else if (k === 'gestures') gestureSheet();
      else if (k === 'theme') header.querySelector('.theme-toggle').click();
      else if (hb(k)) { var t = hb(k); setTimeout(function () { t.click(); }, 0); }
    });
    var settingsBox = dropdown('paint-settings');
    settingsBox.setAttribute('role', 'menu');
    settingsBox.setAttribute('aria-label', 'Settings');
    function uiFlipped() { return document.documentElement.classList.contains('ui-flipped'); }
    function applyUIFlip() {
      var floating = [ctxEl, pc, adjBox].map(function (el) { return { el: el, rect: el.getBoundingClientRect() }; });
      document.documentElement.classList.toggle('ui-flipped');
      storeIt('paint-ui-flipped', uiFlipped());
      if (!ctxLocked) {
        floating.forEach(function (q) {
          if (q.el.hidden || !q.rect.width) return;
          q.el.style.translate = '';
          var base = q.el.getBoundingClientRect();
          q.el.style.translate = (document.documentElement.clientWidth - q.rect.right - base.left) + 'px ' + (q.rect.top - base.top) + 'px';
        });
        var o = panelOffset(ctxEl); storeIt('paint-pos-ctx2', [o.x, o.y]);
      }
      refit(true); relayout(); placeSelectionToolbar();
    }
    var uiFlipBusy = false;
    async function flipUI() {
      if (uiFlipBusy) return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { applyUIFlip(); return; }
      uiFlipBusy = true;
      var html = document.documentElement, centre = $('.paint-centre');
      var panels = [header, left, dock];
      if (!panel.hidden) panels.push(panel);
      // (the selection panel goes with the left toolbar, as they all do)
      if (selectionSlot && selectionSlot.classList.contains('on')) panels.push(selectionSlot);
      var animations = [], css = getComputedStyle(html);
      var duration = parseFloat(css.getPropertyValue('--dur-flip')) * 1000 || 600;
      var easing = css.getPropertyValue('--ease-flip').trim() || 'ease-in-out';
      function outside(el) {
        var r = el.getBoundingClientRect(), lo = r.left, hi = r.right;
        if (el === dock) [ctxEl, pc, adjBox].forEach(function (p) {
          if (p.hidden || p.classList.contains('min') || p.classList.contains('aside')) return;
          var q = p.getBoundingClientRect(); lo = Math.min(lo, q.left); hi = Math.max(hi, q.right);
        });
        return (lo + hi) / 2 < innerWidth / 2 ? -hi - 24 : innerWidth - lo + 24;
      }
      function motion(el, frames, time, fill) {
        var a = el.animate(frames, { duration: time, easing: easing, fill: fill || 'none' });
        animations.push(a); return a.finished.catch(function () {});
      }
      html.classList.add('ui-flipping'); hideTip(); ctxClose();
      try {
        await Promise.all(panels.map(function (el) {
          return motion(el, [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(' + outside(el) + 'px)', opacity: 0 }], duration / 2, 'forwards');
        }));
        var before = centre.getBoundingClientRect();
        animations.forEach(function (a) { a.cancel(); }); animations = [];
        applyUIFlip();
        var dx = before.left - centre.getBoundingClientRect().left;
        var pending = [motion(centre, [{ transform: 'translateX(' + dx + 'px)' }, { transform: 'translateX(0)' }], duration)];
        panels.forEach(function (el) {
          pending.push(motion(el, [{ transform: 'translateX(' + outside(el) + 'px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], duration));
        });
        await Promise.all(pending);
      } finally {
        animations.forEach(function (a) { a.cancel(); });
        html.classList.remove('ui-flipping'); uiFlipBusy = false;
        refit(true); relayout();
      }
    }
    function settingsMenu() {
      var open = settingsBox.hidden;
      closeDrops();
      if (!open) return;
      otherPopovers();
      var theme = header.querySelector('.theme-toggle');
      settingsBox.innerHTML = '<button type="button" role="menuitem" data-setting="theme">' + theme.querySelector('svg').outerHTML + (document.documentElement.getAttribute('data-theme') === 'dark' ? 'Light mode' : 'Dark mode') + '</button><button type="button" role="menuitem" data-setting="help">' + hb('help').querySelector('svg').outerHTML + 'Keyboard shortcuts</button><button type="button" role="menuitem" data-setting="gestures">' + GEST_ICON + 'Touch gestures</button><button type="button" role="menuitemcheckbox" aria-checked="' + uiFlipped() + '" data-setting="flip"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 8h6M6 5l3 3-3 3M21 16h-6M18 13l-3 3 3 3"/></svg>Flip UI<span class="settings-check" aria-hidden="true">' + (uiFlipped() ? '✓' : '') + '</span></button>';
      settingsBox.hidden = false;
      hb('settings').setAttribute('aria-expanded', 'true');
      placeDrop(settingsBox, hb('settings'));
      var r = settingsBox.getBoundingClientRect();
      if (r.left < 8) { settingsBox.style.right = 'auto'; settingsBox.style.left = '8px'; }
      settingsBox.querySelector('button').focus();
    }
    settingsBox.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDrops(); hb('settings').focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        var items = Array.from(settingsBox.querySelectorAll('button'));
        items[(items.indexOf(document.activeElement) + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
      }
    });
    settingsBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-setting]'); if (!b) return;
      closeDrops(); hb('settings').focus();
      if (b.dataset.setting === 'theme') header.querySelector('.theme-toggle').click();
      else if (b.dataset.setting === 'gestures') gestureSheet();
      else if (b.dataset.setting === 'flip') flipUI();
      else helpSheet();
    });
    // FOCUS MODE: just the picture. The bars fade away and the picture gets
    // the whole window; \ (or Esc, or the button in the corner) brings them back
    var focusOut = document.createElement('button');
    focusOut.type = 'button'; focusOut.className = 'paint-focusout'; focusOut.setAttribute('aria-label', 'Show the tools again'); focusOut.dataset.tip = 'Show the tools again (\\ or Esc)';
    focusOut.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4"/><path d="M20 9h-3.5A1.5 1.5 0 0 1 15 7.5V4"/><path d="M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20"/><path d="M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20"/></svg>';
    document.body.appendChild(focusOut);
    focusOut.addEventListener('click', function () { focusMode(false); });
    // FOCUS MODE: the tools go and the picture's space grows to fill the
    // screen, smoothly, the picture keeping its zoom and staying centred
    // (and back again). Where the space ends up is measured first, with
    // nothing moving; then everything eases there together, the space by
    // its size, which the picture follows a frame at a time
    var focusAnim = 0, focusEnd = 0;
    function focusMode(on) {
      var html = document.documentElement;
      if (on === html.classList.contains('focus-mode')) return;
      finishMenus(); hideTip();
      cancelAnimationFrame(focusAnim); clearTimeout(focusEnd);
      var from = stage.getBoundingClientRect();
      ['flex', 'maxWidth', 'width', 'height', 'transition'].forEach(function (k) { stage.style[k] = ''; });
      html.classList.add('focus-measure'); html.classList.remove('focusing');
      html.classList.toggle('focus-mode', on);
      var to = { w: stage.clientWidth, h: stage.clientHeight };
      html.classList.toggle('focus-mode', !on);
      stage.style.flex = 'none'; stage.style.maxWidth = 'none'; stage.style.width = from.width + 'px'; stage.style.height = from.height + 'px';
      void getComputedStyle(stage).width;
      html.classList.remove('focus-measure'); html.classList.add('focusing');
      void getComputedStyle(stage).width;
      html.classList.toggle('focus-mode', on);
      if (hb('focus')) hb('focus').setAttribute('aria-pressed', on ? 'true' : 'false');
      stage.style.transition = 'width var(--dur-slow) var(--ease), height var(--dur-slow) var(--ease)';
      stage.style.width = to.w + 'px'; stage.style.height = to.h + 'px';
      var t0 = performance.now(), dur = (parseFloat(getComputedStyle(stage).transitionDuration) || 0) * 1000;
      (function frame(t) {
        refit(true);
        if (t - t0 < dur + 34) focusAnim = requestAnimationFrame(frame);
      })(t0);
      focusEnd = setTimeout(function () {
        cancelAnimationFrame(focusAnim);
        ['flex', 'maxWidth', 'width', 'height', 'transition'].forEach(function (k) { stage.style[k] = ''; });
        html.classList.remove('focusing');
        refit(true); relayout();
      }, dur + 60);
      if (on) toast('Focus mode: press \\ or Esc to bring the tools back');
    }
    function relayout() {
      closeDrops(); ctxClose(); lmenu.hidden = true;
      if (!panel.hidden) besideBar(panel, $('[data-act="layers"]'));
      if (!saveMenu.hidden) dropUnder(saveMenu, $('[data-act="save"]'));
      if (!pc.hidden) { placePicker(); keepOnScreen(pc); }
      placeSelectionPopover();
      if (tpEl && !tpEl.hidden && textBtn) placeTextPanel();
      [adjBox, bsBox].forEach(function (el) { keepOnScreen(el); });
      if (ctxEl) { dockPanels(); keepOnScreen(ctxEl, ctxBox()); dockSync(false); }
    }
    // THE TOP BAR FOLDS to a thin strip, and opens again, by the arrow at its
    // end. Its height eases, and the picture's space with it (the bar never
    // covers the picture); the picture is fitted to the space a frame at a
    // time (or, zoomed in, keeps its zoom and stays centred)
    var hdrFold = header && header.querySelector('.hdr-fold'), hdrAnim = 0, hdrEnd = 0;
    function hdrSync() {
      if (!hdrFold) return;
      var o = document.documentElement.classList.contains('hdr-open'), t = o ? 'Hide the toolbar' : 'Show the toolbar';
      hdrFold.setAttribute('aria-expanded', o ? 'true' : 'false'); hdrFold.setAttribute('aria-label', t); hdrFold.dataset.tip = t;
    }
    function headerOpen(on) {
      var html = document.documentElement;
      if (!hdrFold || on === html.classList.contains('hdr-open') || html.classList.contains('focus-mode')) return;
      closeDrops(); moreMenu(false); savePanel(false); hideTip();
      cancelAnimationFrame(hdrAnim); clearTimeout(hdrEnd);
      void getComputedStyle(html).getPropertyValue('--hdr');
      html.classList.add('hdr-anim');
      html.classList.toggle('hdr-open', on); hdrSync();
      try { localStorage.setItem('paint-hdr-open', on ? '1' : '0'); } catch (x) {}
      var t0 = performance.now(), dur = (parseFloat(getComputedStyle(html).transitionDuration) || 0) * 1000;
      (function frame(t) { refit(); placeSelectionToolbar(); if (t - t0 < dur + 34) hdrAnim = requestAnimationFrame(frame); })(t0);
      hdrEnd = setTimeout(function () {
        cancelAnimationFrame(hdrAnim); html.classList.remove('hdr-anim');
        refit(); relayout(); placeSelectionToolbar();
      }, dur + 60);
    }
    if (hdrFold) { hdrSync(); hdrFold.addEventListener('click', function () { headerOpen(!document.documentElement.classList.contains('hdr-open')); }); }
    function finishMenus() { openMenu(null); layerPanel(false); savePanel(false); closeDrops(); moreMenu(false); if (!pc.hidden) picker(null); }
    // (before a drop-down from the top bar opens: the others go)
    function otherPopovers() { openMenu(null); layerPanel(false); savePanel(false); lmenu.hidden = true; ctxClose(); }
    var imgMenu = dropdown('paint-imgmenu');
    imgMenu.setAttribute('role', 'menu');
    function imageMenu(open) {
      if (!open) { imgMenu.hidden = true; hb('image').setAttribute('aria-expanded', 'false'); return; }
      closeDrops(); otherPopovers();
      var ico = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; };
      imgMenu.innerHTML =
        '<button type="button" role="menuitem" data-img="left">' + ico('<path d="M9 4.5L5.5 8 9 11.5"/><path d="M5.5 8H14a5 5 0 0 1 5 5v6"/>') + 'Rotate Left</button>' +
        '<button type="button" role="menuitem" data-img="right">' + ico('<path d="M15 4.5L18.5 8 15 11.5"/><path d="M18.5 8H10a5 5 0 0 0-5 5v6"/>') + 'Rotate Right</button>' +
        '<button type="button" role="menuitem" data-img="fliph">' + ico('<path d="M12 3.5v17" stroke-dasharray="2 2"/><path d="M9.5 7L4 17h5.5z"/><path d="M14.5 7L20 17h-5.5z"/>') + 'Flip Horizontal</button>' +
        '<button type="button" role="menuitem" data-img="flipv">' + ico('<path d="M3.5 12h17" stroke-dasharray="2 2"/><path d="M7 9.5L17 4v5.5z"/><path d="M7 14.5L17 20v-5.5z"/>') + 'Flip Vertical</button>' +
        '<button type="button" role="menuitem" data-img="crop"' + (sel ? '' : ' disabled') + '>' + ico('<path d="M6.5 3v14.5H21"/><path d="M3 6.5h14.5V21"/>') + 'Crop to Selection</button>' +
        '<button type="button" role="menuitem" data-img="clear"' + (active ? '' : ' disabled') + '>' + ico('<path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 12h8l1-12"/>') + 'Clear Layer</button>' +
        '<div class="pd-info">' + (sel ? '' : 'Make a selection to crop to it.<br>') + 'Picture: ' + ov.width + ' × ' + ov.height + ' pixels</div>';
      imgMenu.hidden = false; hb('image').setAttribute('aria-expanded', 'true'); placeDrop(imgMenu, hb('image'));
    }
    // every layer is redrawn onto a new one of the new size (the old ones are
    // kept, unchanged, for undo)
    function transformDoc(label, pw, ph, draw) {
      rememberDoc(label);
      var olds = layers, act = olds.indexOf(active);
      setDoc(pw, ph);
      layers = olds.map(function (L) {
        var N = makeLayer(L.name, L.bg); N.visible = L.visible; N.opacity = L.opacity; N.blend = L.blend; N.alphaLock = L.alphaLock; N.clip = L.clip; N.group = L.group;
        N.ctx.save(); N.ctx.setTransform(1, 0, 0, 1, 0, 0); draw(N.ctx, L.cv); N.ctx.restore();
        if (L.mask) { N.mask = makeMask(N, '#000'); N.mask.ctx.save(); N.mask.ctx.setTransform(1, 0, 0, 1, 0, 0); draw(N.mask.ctx, L.mask.cv); N.mask.ctx.restore(); maskAlpha(N); }
        return N;
      });
      active = layers[act] || null;
      mount(); fit(); autosave();
    }
    function imageAct(a) {
      imageMenu(false);
      if (a === 'clear') { runAct('clear'); return; }
      var cropBox = null;
      if (a === 'crop') {
        if (!sel) return;
        var x0 = Math.max(0, Math.round(sel.x * R)), y0 = Math.max(0, Math.round(sel.y * R));
        var x1 = Math.min(ov.width, Math.round((sel.x + sel.w) * R)), y1 = Math.min(ov.height, Math.round((sel.y + sel.h) * R));
        if (x1 - x0 < 2 || y1 - y0 < 2) return;
        cropBox = [x0, y0, x1 - x0, y1 - y0];
      }
      finishWork();
      var pw = ov.width, ph = ov.height;
      if (a === 'left') transformDoc('Rotate Left', ph, pw, function (c, s) { c.translate(0, pw); c.rotate(-Math.PI / 2); c.drawImage(s, 0, 0); });
      else if (a === 'right') transformDoc('Rotate Right', ph, pw, function (c, s) { c.translate(ph, 0); c.rotate(Math.PI / 2); c.drawImage(s, 0, 0); });
      else if (a === 'fliph') transformDoc('Flip Horizontal', pw, ph, function (c, s) { c.translate(pw, 0); c.scale(-1, 1); c.drawImage(s, 0, 0); });
      else if (a === 'flipv') transformDoc('Flip Vertical', pw, ph, function (c, s) { c.translate(0, ph); c.scale(1, -1); c.drawImage(s, 0, 0); });
      else if (cropBox) transformDoc('Crop', cropBox[2], cropBox[3], function (c, s) { c.drawImage(s, -cropBox[0], -cropBox[1]); });
    }
    imgMenu.addEventListener('click', function (e) { var b = e.target.closest('[data-img]'); if (b && !b.disabled) imageAct(b.dataset.img); });

    // ---- PICTURES IN: open, paste (cmd / ctrl + V) or drop one on the page;
    // it comes in on a layer of its own ----
    function addPicture(file, how) {
      if (!file || !/^image\//.test(file.type)) { if (how !== 'open') toast('That isn’t a picture'); return; }
      var im = new Image(), url = URL.createObjectURL(file);
      im.onload = function () {
        URL.revokeObjectURL(url);
        if (!roomFor()) return;
        finishWork();
        rememberLayers(how === 'open' ? 'Open Picture' : 'Add Picture');
        // (opened: it fills the picture; pasted or dropped: its own size,
        // made smaller if it wouldn't fit)
        var nw = im.naturalWidth / R, nh = im.naturalHeight / R, k = how === 'open' ? Math.min(W / nw, H / nh) : Math.min(1, W / nw, H / nh);
        var w = nw * k, h = nh * k, x = (W - w) / 2, y = (H - h) / 2, L = makeLayer(how === 'open' ? 'Picture' : 'Pasted', false);
        L.ctx.imageSmoothingQuality = 'high'; L.ctx.drawImage(im, x, y, w, h);
        layers.splice(active ? layers.indexOf(active) + 1 : layers.length, 0, L); L.group = active ? active.group : null; active = L; mount();
        // SELECTED, READY TO TRANSFORM: the Move tool, with the picture's box
        // round it to drag, size by its corners (keeping its proportions) or
        // turn by its round handle, and Scale showing its size; what's picked
        // up is the picture itself at its own size (up to 16 million pixels)
        var fk = Math.min(1, Math.sqrt(16e6 / (im.naturalWidth * im.naturalHeight))), src = document.createElement('canvas');
        src.width = Math.max(1, Math.round(im.naturalWidth * fk)); src.height = Math.max(1, Math.round(im.naturalHeight * fk));
        var sx = src.getContext('2d'); sx.imageSmoothingQuality = 'high'; sx.drawImage(im, 0, 0, src.width, src.height);
        sel = { x: x, y: y, w: w, h: h, float: null, whole: true, auto: true, src: src, base: { w: nw, h: nh } };
        setTool('move'); selbar.hidden = false; drawSel();
        toast(how === 'open' ? 'Opened on a new layer: drag, size or turn it' : 'Added on a new layer: drag it into place, size or turn it');
        autosave();
      };
      im.onerror = function () { URL.revokeObjectURL(url); toast('That picture couldn’t be opened'); };
      im.src = url;
    }
    document.addEventListener('paste', function (e) {
      if (!document.contains(root) || sheetEl) return;
      var t = e.target; if (t && (t.isContentEditable || /input|textarea/i.test(t.tagName || ''))) return;
      clearTimeout(pasteWait); pasteWait = 0;
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) if (items[i].kind === 'file' && /^image\//.test(items[i].type)) { e.preventDefault(); pasteFile(items[i].getAsFile()); return; }
      if (selClip) { e.preventDefault(); pasteClip(); }
    });
    function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
    document.addEventListener('dragover', function (e) { if (!hasFiles(e) || !document.contains(root)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; stage.classList.add('drop'); });
    document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) stage.classList.remove('drop'); });
    document.addEventListener('drop', function (e) {
      if (!hasFiles(e) || !document.contains(root)) return;
      e.preventDefault(); stage.classList.remove('drop');
      var fs = e.dataTransfer.files || [], pj = Array.prototype.filter.call(fs, isProject)[0];
      if (pj) { openProject(pj); return; }
      var f = Array.prototype.filter.call(fs, function (x) { return /^image\//.test(x.type); })[0];
      if (f) addPicture(f, 'drop'); else toast('That isn’t a picture');
    });

    // ---- LAYERS: each one's opacity and blend mode ----
    var opPending = false;
    panel.addEventListener('input', function (e) {
      var go = e.target.closest('[data-group-op]');
      if (go && focusG) { if (!opPending) { rememberLayers('Group Opacity'); opPending = true; } focusG.opacity = +go.value / 100; styleGroup(focusG); go.nextElementSibling.textContent = go.value + '%'; autosave(); return; }
      var o = e.target.closest('[data-layer-op]'); if (!o || !active) return;
      if (!opPending) { rememberLayers('Layer Opacity'); opPending = true; }
      picks().forEach(function (L) { L.opacity = +o.value / 100; styleLayer(L); }); if (sel && sel.more) drawSel(); o.nextElementSibling.textContent = o.value + '%'; autosave();
    });
    panel.addEventListener('change', function (e) {
      if (e.target.closest('[data-layer-op], [data-group-op]')) { opPending = false; return; }
      var gb = e.target.closest('[data-group-blend]'); if (gb && focusG) { rememberLayers('Group Blend'); focusG.blend = gb.value; styleGroup(focusG); autosave(); return; }
      var b = e.target.closest('[data-layer-blend]'); if (!b || !active) return;
      rememberLayers('Blend Mode'); picks().forEach(function (L) { L.blend = b.value; styleLayer(L); }); if (sel && sel.more) drawSel(); autosave();
    });

    // ---- HISTORY: every step that can be undone, oldest at the top; tap
    // one to go straight back (or forward) to it ----
    var histBox = dropdown('paint-history');
    function renderHistory() {
      if (!histBox || histBox.hidden) return;
      var cur = undo.length, rows = [[0, trimmed ? 'Earlier' : 'Start']];
      undo.forEach(function (e, i) { rows.push([i + 1, e.label]); });
      for (var j = redo.length - 1, n = cur + 1; j >= 0; j--, n++) rows.push([n, redo[j].label]);
      histBox.innerHTML = '<div class="pd-title">History</div><div class="ph-list">' + rows.map(function (r) {
        return '<button type="button" data-hist="' + r[0] + '" class="' + (r[0] === cur ? 'on' : r[0] > cur ? 'ahead' : '') + '">' + r[1] + '</button>';
      }).join('') + '</div><div class="pd-info">' + (undo.length + redo.length ? 'Tap a step to go back to it.' : 'Nothing to undo yet.') + '</div>';
      var on = histBox.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    }
    function historyPanel(open) {
      if (!open) { histBox.hidden = true; hb('history').setAttribute('aria-expanded', 'false'); return; }
      closeDrops(); otherPopovers(); histBox.hidden = false; hb('history').setAttribute('aria-expanded', 'true'); renderHistory(); placeDrop(histBox, hb('history'));
    }
    histBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-hist]'); if (!b) return;
      var n = +b.dataset.hist, total = undo.length + redo.length;
      if (adj) adjustDone(); if (textBox) commitText(); if (lifted()) commitSelection(); if (pen) cancelPen(); if (grad) gradDone();
      n = Math.min(n, undo.length + redo.length); if (undo.length + redo.length !== total) n = undo.length; // (finishing something made a new step)
      while (undo.length > n) doUndo(true);
      while (undo.length < n && redo.length) doRedo(true);
    });

    // ---- KEYBOARD SHORTCUTS: press ? for the list ----
    var MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent), CMD = MAC ? '⌘' : 'Ctrl ';
    function helpSheet() {
      // (keys as keys; a touch gesture, or the word after a key, as words)
      var isKey = function (x) { return x.length <= 2 || /^(Ctrl|Alt|Shift|Space|Esc|Del|Enter|Backspace|Tab)$/.test(x) || /^[⌘⇧⌥⌫↩←↑→↓]/.test(x); };
      var k = function (keys) {
        var t = keys.split(' ');
        if (!isKey(t[0])) return '<span class="hs-gest">' + keys + '</span>';
        return t.map(function (x) { return isKey(x) ? '<kbd>' + x + '</kbd>' : '<span class="hs-word">' + x + '</span>'; }).join('');
      };
      var group = function (title, rows) { return '<div class="hs-group"><div class="hs-h">' + title + '</div>' + rows.map(function (r) { return '<div class="hs-row"><span>' + r[0] + '</span><span>' + k(r[1]) + '</span></div>'; }).join('') + '</div>'; };
      openSheet('hs', '<div class="pa-sheet-title">Keyboard Shortcuts</div><div class="hs-cols">' +
        group('Tools', [['Brush', 'B'], ['Eraser', 'E'], ['Fill', 'F'], ['Gradient', 'G'], ['Colour picker', 'I'], ['Shapes: line', 'L'], ['Shapes', 'R'], ['Text', 'T'], ['Pen', 'P'], ['Blend: smudge', 'S'], ['Blend: blur', 'U'], ['Blend: lighten or darken', 'O'], ['Select: box', 'M'], ['Select: cutout', 'Q'], ['Select: circle', 'C'], ['Select: magic wand', 'W'], ['Move', 'V'], ['Move around', 'H']]) +
        group('Edit', [['Undo', CMD + 'Z'], ['Redo', (MAC ? '⇧⌘' : 'Ctrl ') + (MAC ? 'Z' : 'Y')], ['Select all', CMD + 'A'], ['Copy selection', CMD + 'C'], ['Paste (on a new layer)', CMD + 'V'], ['Delete selection', MAC ? '⌫' : 'Del'], ['Commit selection', MAC ? '↩' : 'Enter'], ['Nudge selection', '← ↑ → ↓'], ['Nudge by 10', '⇧ ←'], ['Finish cutout', MAC ? '↩' : 'Enter'], ['Cutout: last point off', MAC ? '⌫' : 'Backspace'], ['Pen: lay the path down', MAC ? '↩' : 'Enter'], ['Gradient: lay it down', MAC ? '↩' : 'Enter'], ['Gradient: remove the picked stop', MAC ? '⌫' : 'Del'], ['Close / cancel', 'Esc']]) +
        group('Layers', [['Pick more layers', 'Swipe a layer right'], ['Pick all between', '⇧ click'], ['Pick one more (or one less)', CMD + 'click'], ['Pick just one again', 'Tap a layer'], ['Let the picked ones go', 'Esc']]) +
        group('Brush & colour', [['Smaller brush', '['], ['Bigger brush', ']'], ['Swap colours', 'X'], ['Pick a colour', MAC ? '⌥ click' : 'Alt click'], ['Effects', 'A']]) +
        group('View', [['Zoom in', '+'], ['Zoom out', '−'], ['Fit (and upright)', '0'], ['Grab & move', 'Space drag'], ['Zoom', CMD + 'scroll'], ['These shortcuts', '?']]) +
        group('Touch & Pencil', Object.keys(GDEF).filter(function (g) { return gest[g] !== 'none'; }).map(function (g) { return [gactName(gest[g]), GNAMES[g]]; }).concat([['Zoom & move', 'Pinch'], ['Turn the canvas', 'Twist two fingers'], ['Snap to a shape', 'Hold at the end'], ['Circle or square', 'Shift while snapped'], ['Layer options', '•••']])) +
        '</div><div class="pa-sheet-acts"><button type="button" class="pa-primary" data-close>Done</button></div>');
      sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
    }

    // ---- SHARE: the picture as a PNG, to Messages, Photos, Mail... (or,
    // where sharing isn't there, copied so it can be pasted) ----
    function flatBlob(type, done) {
      var jpg = type === 'jpeg', out = document.createElement('canvas'); out.width = ov.width; out.height = ov.height;
      var x = out.getContext('2d');
      if (jpg) { x.fillStyle = '#fff'; x.fillRect(0, 0, out.width, out.height); }
      flattenInto(x);
      out.toBlob(done, jpg ? 'image/jpeg' : 'image/png', 0.93);
    }
    function share() {
      if (grad) gradDone(); if (adj) adjustDone(); if (textBox) commitText(); if (sel) commitSelection();
      flatBlob('png', function (blob) {
        if (!blob) return;
        var f = window.File ? new File([blob], 'drawing.png', { type: 'image/png' }) : null;
        if (f && navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: 'Drawing' }).catch(function () {}); return; }
        if (navigator.clipboard && window.ClipboardItem) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function () { toast('Copied: paste it anywhere'); }, function () { download(blob, 'png'); });
          return;
        }
        download(blob, 'png');
      });
    }
    function download(blob, ext) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'drawing.' + ext;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }

    // ---- INSTALL: where the browser offers it, a button to add the app ----
    var installEv = null;
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEv = e; hb('install').hidden = false; });
    window.addEventListener('appinstalled', function () { installEv = null; hb('install').hidden = true; toast('Installed'); });

    if (header) header.addEventListener('click', function (e) {
      var ac = e.target.closest('[data-act]'); if (ac) { runAct(ac.dataset.act); return; }
      var b = e.target.closest('[data-hb]'); if (!b) return;
      var w = b.dataset.hb;
      if (w === 'focus') { focusMode(!document.documentElement.classList.contains('focus-mode')); return; }
      if (w === 'guides') { smartGuides(!smartOn); toast(smartOn ? 'Smart Guides on: what you move snaps into line' : 'Smart Guides off'); return; }
      if (w === 'settings') { settingsMenu(); return; }
      if (w === 'more') { moreMenu(moreBox.hidden); return; }
      if (w === 'new') newSheet();
      else if (w === 'gallery') { closeDrops(); gallery(); }
      else if (w === 'image') imageMenu(imgMenu.hidden);
      else if (w === 'history') historyPanel(histBox.hidden);
      else if (w === 'share') { closeDrops(); share(); }
      else if (w === 'help') helpSheet();
      else if (w === 'install' && installEv) { installEv.prompt(); installEv.userChoice.then(function () { installEv = null; hb('install').hidden = true; }); }
    });
    document.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.paint-drop, [data-hb="image"], [data-hb="history"], [data-hb="more"], [data-hb="settings"]')) closeDrops();
    }, true);

    // ---- THE CONTEXT BAR: what the tool in hand can be set to, at the top of
    // the picture. A brush: which brush, smoothing, tapered ends and snapping
    // to shapes; shapes: which shape, outline or filled; text: font, size,
    // bold / italic / underline, alignment and more; light & dark: which;
    // the others say how they're used. With a selection it shows what can be
    // done with it (copy, flip, turn, invert, delete, cut to a layer, done). ----
    // A selection's actions stand in a panel of their own just under the
    // left toolbar, built like it (the same card, groups and buttons), as
    // tall as the room left above the bottom of the picture's space (its
    // buttons scroll if they need more); their options open beside it.
    var selectionSlot, selectionPop, selectionOpen = '', selectionAnchor = null;
    function buildSelectionToolbar() {
      selectionSlot = document.createElement('div'); selectionSlot.className = 'selection-slot';
      paintEl.appendChild(selectionSlot); selectionSlot.appendChild(selbar);
      selbar.className = 'paint-selbar paint-bar selection-toolbar';
      selbar.setAttribute('role', 'toolbar'); selbar.setAttribute('aria-label', 'Selection actions');
      var svg = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; };
      var icons = {
        all: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3"/>',
        deselect: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M8 8l8 8M16 8l-8 8"/>',
        invert: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16M4 12h8"/><path d="M12 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6z" fill="currentColor" stroke="none" opacity=".25"/>',
        feather: '<path d="M5 19l10-10M8 16l-1-5 8-7a4 4 0 0 1 5 5l-7 8-5-1M12 12h5"/>',
        grow: '<rect x="8" y="8" width="8" height="8" rx="1"/><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
        fliph: '<path d="M12 3v18M8 6l-5 6 5 6zM16 6l5 6-5 6z"/>',
        flipv: '<path d="M3 12h18M6 8l6-5 6 5zM6 16l6 5 6-5z"/>',
        rotate: '<path d="M5 9a8 8 0 1 1-1 6M5 4v5h5"/>',
        copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M15 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/>',
        delete: '<path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/>',
        transform: '<rect x="5" y="5" width="14" height="14" rx="1"/><path d="M3 3h4v4H3zM17 3h4v4h-4zM3 17h4v4H3zM17 17h4v4h-4z" fill="var(--panel-solid)"/>',
        more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
        rot90: '<rect x="3.5" y="10" width="10.5" height="10.5" rx="1.5"/><path d="M9.5 4.5H12a8 8 0 0 1 8 8v1.5M17 11.5l3 3 3-3"/>',
        colours: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',
        paste: '<path d="M9 4.5H7.5a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2H15"/><rect x="9" y="3" width="6" height="3.5" rx="1"/>',
        duplicate: '<path d="M11 3.5l7.5 3.75L11 11 3.5 7.25z"/><path d="M3.5 11.5L11 15.25l2.5-1.25"/><path d="M18 14v7M14.5 17.5h7"/>',
        cut: '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8.2 8.3L20 18M8.2 15.7L20 6"/>'
      };
      var button = function (attr, key, label, icon, extra) { return '<button type="button" ' + attr + '="' + key + '" aria-label="' + label + '" data-tip="' + label + '"' + (extra || '') + '>' + svg(icons[icon]) + '</button>'; };
      // (the groups, and their dividers, as in the left toolbar)
      var group = function (b) { return '<div class="paint-group">' + b + '</div>'; };
      // (what's picked and its edge; what's done to its pixels: where they
      // are, which way round, their colours; the clipboard and layers; taking
      // it away or letting it go; and, at the foot where it stays in view,
      // Commit, which lays it down)
      selbar.innerHTML = '<div class="paint-toolgroups">' +
        group(button('data-sel', 'all', 'Select All', 'all', ' class="selection-secondary"') + button('data-sel', 'region-invert', 'Invert Selection', 'invert') +
          button('data-selection-pop', 'feather', 'Feather Selection', 'feather', ' class="selection-secondary" aria-expanded="false"') +
          button('data-selection-pop', 'grow', 'Expand or Contract Selection', 'grow', ' class="selection-secondary" aria-expanded="false"')) +
        group(button('data-selection-pop', 'transform', 'Transform Selection', 'transform', ' aria-expanded="false"') +
          button('data-selection-pop', 'rotate', 'Rotate Selection', 'rotate', ' class="selection-secondary" aria-expanded="false"') +
          button('data-sel', 'rot90', 'Rotate 90°', 'rot90') + button('data-sel', 'invert', 'Invert Colours', 'colours') +
          button('data-sel', 'fliph', 'Flip Horizontal', 'fliph', ' class="selection-secondary"') + button('data-sel', 'flipv', 'Flip Vertical', 'flipv', ' class="selection-secondary"')) +
        group(button('data-sel', 'copy', 'Copy Selection', 'copy') + button('data-sel', 'paste', 'Paste', 'paste') +
          button('data-sel', 'duplicate', 'Duplicate to New Layer', 'duplicate') + button('data-sel', 'layer', 'Cut to Layer', 'cut')) +
        group(button('data-sel', 'delete', 'Delete Selection', 'delete') + button('data-sel', 'deselect', 'Deselect', 'deselect')) + '</div>' +
        '<div class="selection-foot"><button type="button" class="selection-commit" data-sel="done" aria-label="Commit Selection" data-tip="Commit: lay the selection down as it is and close it (Return)"><span aria-hidden="true">Commit</span></button></div>';
      selbar.querySelector('.paint-toolgroups').addEventListener('scroll', selFades, { passive: true });
      // (an arrow over each edge with more past it: a press scrolls a group's worth)
      selArrows = ['up', 'down'].map(function (dir) {
        var a = document.createElement('button'); a.type = 'button'; a.className = 'sel-more sel-more-' + dir; a.tabIndex = -1;
        a.setAttribute('aria-hidden', 'true'); a.dataset.tip = dir === 'up' ? 'More above' : 'More below';
        a.innerHTML = svg(dir === 'up' ? '<path d="M6 15l6-6 6 6"/>' : '<path d="M6 9l6 6 6-6"/>');
        a.addEventListener('click', function () { selStep(dir === 'up' ? -1 : 1); });
        selbar.appendChild(a); return a;
      });
      selectionPop = document.createElement('div'); selectionPop.className = 'selection-pop'; selectionPop.hidden = true;
      selectionPop.setAttribute('role', 'dialog'); selectionPop.setAttribute('aria-label', 'Selection options'); selectionSlot.appendChild(selectionPop);
      // Reuse the existing scale and perspective controls, including all their listeners.
      var transform = document.createElement('div'); transform.className = 'selection-transform'; transform.hidden = true;
      transform.appendChild(scaleEl); if (seldist) transform.appendChild(seldist); selectionPop.appendChild(transform);
      selbar.addEventListener('click', function (e) {
        var b = e.target.closest('[data-selection-pop]'); if (!b || b.disabled) return;
        openSelectionPopover(b.dataset.selectionPop, b);
      });
      selectionPop.addEventListener('click', function (e) {
        var more = e.target.closest('[data-selection-more]');
        if (more) { var action = more.dataset.selectionMore; openSelectionPopover(action, selectionAnchor); return; }
        var apply = e.target.closest('[data-selection-apply]'); if (!apply) return;
        var input = selectionPop.querySelector('input[data-selection-value]'), n = Number(input && input.value);
        if (!Number.isFinite(n) || !input.checkValidity()) { input && input.reportValidity(); return; }
        var kind = apply.dataset.selectionApply;
        if (kind === 'rotate') rotateSelection(n); else changeSelectionMask(kind, n);
        closeSelectionPopover(true);
      });
      selectionPop.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); closeSelectionPopover(true); }
        if (e.key === 'Enter' && e.target.matches('[data-selection-value]')) { e.preventDefault(); var b = selectionPop.querySelector('[data-selection-apply]'); if (b) b.click(); }
      });
      document.addEventListener('pointerdown', function (e) { if (!e.target.closest('.selection-slot')) closeSelectionPopover(); }, true);
      selectionSlot.inert = true;
      // (it follows the left toolbar and the picture's space, however they
      // change: the window, the top menu folding, the sides swapping)
      var ro = new ResizeObserver(placeSelectionToolbar); ro.observe(stage); ro.observe(left); ro.observe(paintEl);
      window.addEventListener('resize', placeSelectionToolbar);
      left.addEventListener('transitionend', placeSelectionToolbar);
      placeSelectionToolbar();
    }
    function closeSelectionPopover(focus) {
      if (!selectionPop) return;
      selectionPop.hidden = true; selectionOpen = '';
      selbar.querySelectorAll('[data-selection-pop]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      if (focus && selectionAnchor && document.contains(selectionAnchor)) selectionAnchor.focus({ preventScroll: true });
    }
    function selectionCanMask() { return !!(sel && !sel.text && !sel.thing && !sel.more && !sel.items && !multi()); }
    function selectionToolbarSync() {
      if (!selectionSlot) return;
      var on = !!(sel && !sel.thing && sel.w > 0 && sel.h > 0 && selMode !== 'new' && selMode !== 'lasso' && !lassoOn);
      if (selectionSlot.classList.contains('on') !== on) {
        selectionSlot.classList.toggle('on', on); selectionSlot.inert = !on;
        selbar.hidden = !on; if (!on) closeSelectionPopover();
        // (a selection turning up folds the top menu, as its own arrow does,
        // to give the panel room; it can be opened again as ever)
        if (on && document.documentElement.classList.contains('hdr-open')) headerOpen(false);
        placeSelectionToolbar();
        if (on) selNudge();
      }
      if (selbar.hidden === on) selbar.hidden = !on;
      if (ctxTool) { var all = ctxTool.querySelector('[data-ctx="all"]'); if (all && all.hidden !== on) all.hidden = on; }
      // (it stays in view while the selection is moved, sized or turned)
      selectionSlot.inert = !on;
      var masking = selectionCanMask();
      selbar.querySelectorAll('[data-selection-pop="feather"], [data-selection-pop="grow"]').forEach(function (b) { b.disabled = !masking; });
      var tr = selbar.querySelector('[data-selection-pop="transform"]'); if (tr) tr.disabled = !sel || !!sel.thing;
      var rot = selbar.querySelector('[data-selection-pop="rotate"]'); if (rot) rot.disabled = !sel || !!sel.thing;
      paintEl.classList.toggle('selection-active', on);
      placeSelectionToolbar();
    }
    function openSelectionPopover(kind, anchor) {
      if (!sel) return;
      if (selectionOpen === kind && !selectionPop.hidden) { closeSelectionPopover(); return; }
      closeSelectionPopover(); selectionOpen = kind; selectionAnchor = anchor;
      selectionPop.querySelectorAll('.selection-pop-content').forEach(function (e) { e.remove(); });
      var transform = selectionPop.querySelector('.selection-transform'); transform.hidden = kind !== 'transform';
      var content = document.createElement('div'); content.className = 'selection-pop-content';
      if (kind === 'more') {
        var rows = [['all','Select All'], ['region-invert','Invert Selection'], ['fliph','Flip Horizontal'], ['flipv','Flip Vertical'], ['rot90','Rotate 90°'], ['invert','Invert Colours'], ['copy','Copy'], ['paste','Paste'], ['duplicate','Duplicate to New Layer'], ['layer','Cut to Layer'], ['done','Commit Selection']];
        content.innerHTML = rows.map(function (q) { return '<button type="button" data-sel="' + q[0] + '">' + q[1] + '</button>'; }).join('') +
          '<button type="button" data-selection-more="feather"' + (!selectionCanMask() ? ' disabled' : '') + '>Feather Selection…</button><button type="button" data-selection-more="grow"' + (!selectionCanMask() ? ' disabled' : '') + '>Expand / Contract…</button><button type="button" data-selection-more="rotate">Rotate…</button>';
      } else if (kind === 'transform') {
        content.innerHTML = '<p>Drag the selection to move it. Drag a corner to resize or the round handle to rotate.</p>';
        scaleSync(); placeSelDist();
      } else {
        if ((kind === 'grow' || kind === 'feather') && !selectionCanMask()) return;
        var label = kind === 'rotate' ? 'Rotation (degrees)' : kind === 'feather' ? 'Feather radius (px)' : 'Expand / Contract (px)';
        var min = kind === 'rotate' ? -360 : kind === 'grow' ? -100 : 0, max = kind === 'rotate' ? 360 : 100;
        content.innerHTML = '<label>' + label + '<input type="number" data-selection-value aria-label="' + label + '" min="' + min + '" max="' + max + '" step="1" value="' + (kind === 'rotate' ? 90 : kind === 'feather' ? 5 : 8) + '"></label>' +
          (kind === 'grow' ? '<p>Positive expands; negative contracts.</p>' : '') + '<button type="button" class="selection-apply" data-selection-apply="' + kind + '">Apply</button>';
      }
      selectionPop.appendChild(content); selectionPop.hidden = false;
      selButtons(); if (anchor) anchor.setAttribute('aria-expanded', 'true'); placeSelectionPopover();
      var input = content.querySelector('input'); if (input) { input.focus({ preventScroll: true }); input.select(); }
    }
    // (when its buttons don't all fit, the edge with more past it fades, so
    // it reads as something to scroll)
    var selArrows = null, selNudged = stored('paint-sel-nudged', false);
    function selFades() {
      var g = selbar.querySelector('.paint-toolgroups'); if (!g) return;
      var up = g.scrollTop > 1, dn = g.scrollTop + g.clientHeight < g.scrollHeight - 1;
      g.classList.toggle('more-above', up); g.classList.toggle('more-below', dn);
      if (!selArrows) return;
      selArrows[0].classList.toggle('on', up); selArrows[1].classList.toggle('on', dn);
      selArrows[0].style.top = (g.offsetTop + 4) + 'px';
      selArrows[1].style.top = (g.offsetTop + g.clientHeight - selArrows[1].offsetHeight - 4) + 'px';
    }
    // (an arrow pressed: the next group past that edge comes fully into view,
    // clear of the fade)
    function selStep(dir) {
      var g = selbar.querySelector('.paint-toolgroups'), top = g.scrollTop, h = g.clientHeight, max = g.scrollHeight - h, gr = g.getBoundingClientRect();
      var fade = parseFloat(getComputedStyle(g).getPropertyValue('--fade')) || 28, t = top, kids = Array.prototype.slice.call(g.children);
      var at = function (e) { var r = e.getBoundingClientRect(); return { a: r.top - gr.top + top, b: r.bottom - gr.top + top }; };
      if (dir > 0) { for (var i = 0; i < kids.length; i++) { var q = at(kids[i]); if (q.b > top + h + 1) { t = Math.max(top + 1, Math.min(q.a - fade, q.b - h + fade)); break; } } }
      else { for (var j = kids.length - 1; j >= 0; j--) { var w = at(kids[j]); if (w.a < top - 1) { t = Math.min(top - 1, Math.max(w.b - h + fade, w.a - fade)); break; } } }
      g.scrollTo({ top: Math.max(0, Math.min(max, t)), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    // (the first time it turns up with more than fits: it scrolls a little
    // way down and back, once, to show that it does)
    function selNudge() {
      if (selNudged || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var g = selbar.querySelector('.paint-toolgroups');
      if (!g || g.scrollHeight - g.clientHeight < 8 || g.scrollTop > 0) return;
      selNudged = true; storeIt('paint-sel-nudged', true);
      setTimeout(function () {
        if (!selectionSlot.classList.contains('on') || g.scrollTop > 0) return;
        g.scrollTo({ top: Math.min(40, g.scrollHeight - g.clientHeight), behavior: 'smooth' });
        setTimeout(function () { g.scrollTo({ top: 0, behavior: 'smooth' }); }, 560);
      }, 520);
    }
    function placeSelectionToolbar() {
      if (!selectionSlot) return;
      var P = paintEl.getBoundingClientRect(), L = left.getBoundingClientRect(), V = stage.getBoundingClientRect();
      var gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--menu-stack-gap')) || 12;
      // (down to the bottom of the colour bar, Commit at its foot; to the
      // picture's space's when that bar is away, as in focus mode)
      var B = bbar.getBoundingClientRect(), foot = B.height && B.bottom <= window.innerHeight + 1 ? Math.max(B.bottom, V.bottom) : V.bottom;
      var top = L.bottom + gap, room = Math.max(0, Math.min(foot, window.innerHeight) - top);
      selectionSlot.style.left = (L.left - P.left) + 'px'; selectionSlot.style.top = (top - P.top) + 'px';
      selectionSlot.style.width = L.width + 'px'; selbar.style.height = selbar.style.maxHeight = room + 'px';
      selFades();
      placeSelectionPopover();
    }
    // (an option opens beside the panel, towards the picture, level with its
    // button, and kept within the picture's space)
    function placeSelectionPopover() {
      if (!selectionPop || selectionPop.hidden || !selectionAnchor) return;
      var a = selectionAnchor.getBoundingClientRect(), r = selectionSlot.getBoundingClientRect(), v = stage.getBoundingClientRect();
      var gap = parseFloat(getComputedStyle(selectionPop).getPropertyValue('--selection-pop-gap')) || 8;
      var lo = Math.max(v.top, 0) + 8, hi = Math.min(v.bottom, window.innerHeight) - 8;
      selectionPop.style.maxHeight = Math.max(40, hi - lo) + 'px';
      var h = selectionPop.offsetHeight, y = Math.max(lo, Math.min(hi - h, a.top));
      selectionPop.style.top = Math.round(y - r.top) + 'px'; selectionPop.style.bottom = 'auto';
      selectionPop.style.left = uiFlipped() ? Math.round(-selectionPop.offsetWidth - gap) + 'px' : Math.round(r.width + gap) + 'px';
    }
    function rotateSelection(degrees) {
      if (!sel || selMode || !Number.isFinite(degrees)) return;
      if (adj) adjustDone(true);
      lift(); selRecord(); var radians = degrees * Math.PI / 180;
      if (sel.quad) sel.quad = quadTurn(sel.quad.slice(), quadMid(), radians);
      else sel.rot = Math.atan2(Math.sin((sel.rot || 0) + radians), Math.cos((sel.rot || 0) + radians));
      drawSel(); autosave();
    }
    // Convert the current selection shape (including rotation/perspective) to document pixels.
    function selectionDocumentMask() {
      var m = document.createElement('canvas'); m.width = ov.width; m.height = ov.height; var c = m.getContext('2d'); base(c);
      if (sel.quad) {
        var local = document.createElement('canvas'); local.width = Math.max(1, Math.round(sel.w * R)); local.height = Math.max(1, Math.round(sel.h * R));
        var lc = local.getContext('2d');
        if (sel.mask) lc.drawImage(sel.mask, 0, 0, local.width, local.height);
        else { lc.scale(R, R); if (sel.poly) { outline(lc, 0, 0, 1); lc.fill(); } else lc.fillRect(0, 0, sel.w, sel.h); }
        warpShow(c, local);
      } else {
        var mid = selMid(); c.translate(mid.x, mid.y); c.rotate(sel.rot || 0); c.translate(-mid.x, -mid.y);
        if (sel.mask) c.drawImage(sel.mask, sel.x, sel.y, sel.w, sel.h); else { selPath(c); c.fill(); }
      }
      return m;
    }
    // Separable alpha filters: linear-time feathering and monotone-window grow/shrink.
    function selectionAlphaFilter(src, w, h, radius, average, expand) {
      var tmp = new Float32Array(w * h), out = new Float32Array(w * h), queue = new Int32Array(Math.max(w, h) + 2 * radius + 1);
      function pass(input, output, length, count, stride, rowStride) {
        for (var line = 0; line < count; line++) {
          var offset = line * rowStride, sum = 0, head = 0, tail = 0;
          for (var j = -radius; j < length + radius; j++) {
            var value = j < 0 || j >= length ? 0 : input[offset + j * stride];
            if (average) {
              sum += value;
              var old = j - 2 * radius - 1;
              if (old >= 0 && old < length) sum -= input[offset + old * stride];
            } else {
              while (tail > head) { var q = queue[tail - 1], v = q < 0 || q >= length ? 0 : input[offset + q * stride]; if (expand ? v > value : v < value) break; tail--; }
              queue[tail++] = j; while (tail > head && queue[head] < j - 2 * radius) head++;
            }
            var at = j - radius;
            if (at >= 0 && at < length) { var q0 = queue[head]; output[offset + at * stride] = average ? sum / (2 * radius + 1) : (q0 < 0 || q0 >= length ? 0 : input[offset + q0 * stride]); }
          }
        }
      }
      pass(src, tmp, w, h, 1, w); pass(tmp, out, h, w, w, 1); return out;
    }
    function changeSelectionMask(kind, amount) {
      if (!selectionCanMask() || selMode) return;
      if (kind !== 'invert' && !amount) return;
      if (adj) adjustDone(true);
      var canvas = selectionDocumentMask(), c = canvas.getContext('2d'), image = c.getImageData(0, 0, canvas.width, canvas.height), w = canvas.width, h = canvas.height;
      var alpha = new Float32Array(w * h), i;
      for (i = 0; i < alpha.length; i++) alpha[i] = image.data[i * 4 + 3];
      if (kind === 'invert') for (i = 0; i < alpha.length; i++) alpha[i] = 255 - alpha[i];
      else if (kind === 'feather') { var r = Math.max(1, Math.round(amount * R / 2)); for (var n = 0; n < 3; n++) alpha = selectionAlphaFilter(alpha, w, h, r, true, false); }
      else alpha = selectionAlphaFilter(alpha, w, h, Math.max(1, Math.round(Math.abs(amount) * R)), false, amount > 0);
      var old = sel, history = old.hist ? old.hist.slice() : [], undoShape = selGeo();
      // Put transformed content down before changing the area, so it is never lost.
      if (lifted()) { commitSelection(); history = []; } else history.push(undoShape);
      var x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { i = y * w + x; var a = Math.round(alpha[i]); image.data[i * 4 + 3] = a; if (a) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
      if (x1 < 0) { clearSel(); return; }
      c.putImageData(image, 0, 0); var crop = document.createElement('canvas'); crop.width = x1 - x0 + 1; crop.height = y1 - y0 + 1;
      var cc = crop.getContext('2d'); cc.drawImage(canvas, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
      sel = { x: x0 / R, y: y0 / R, w: crop.width / R, h: crop.height / R, float: null, mask: crop, maskData: cc.getImageData(0, 0, crop.width, crop.height).data, softMask: kind === 'feather' || old.softMask, hist: history, fut: [] };
      selbar.hidden = false; drawSel(); histButtons(); autosave();
    }

    var ctxEl = $('.paint-ctx'), ctxTool = ctxEl.querySelector('.ctx-tool'), ctxFor = null, ctxToolId = 'brush', ctxView = ctxView || 'tool';
    var settingsToggle = $('.paint-settings-toggle');
    settingsToggle.addEventListener('click', function () {
      var open = toolMenuOpen();
      if (!pc.hidden) picker(null);
      if (!adjBox.hidden || adj) adjustDone();
      if (!bsBox.hidden) studio(false);
      ctxMin(open); ctxAside();
    });
    function settingsToggleSync() {
      if (!settingsToggle) return;
      var open = toolMenuOpen();
      // (greyed out for a tool with no settings, while nothing else is open)
      settingsToggle.disabled = !open && !!ctxEl && ctxEl.hidden;
      settingsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      settingsToggle.setAttribute('aria-label', open ? 'Hide tool settings' : 'Show tool settings');
    }
    buildSelectionToolbar();
    // THE DOCK: locked (ctxLocked, its lock button), the tool options stand
    // in a space of their own at the right of the workspace, so they never
    // cover the picture, and can't be dragged; folded to their button, the
    // space goes and the picture's grows into it, easing. Unlocked, they
    // float: dragged anywhere, never making room. Locking puts them back in
    // their place. On a phone it's a strip over the picture
    // (the box it's kept in: the stage on a phone; otherwise the workspace,
    // a little larger, so in its own place, flush with the workspace's
    // edge, it isn't nudged in)
    function ctxBox() {
      if (phoneLayout()) return stage;
      return { getBoundingClientRect: function () { var r = paintEl.getBoundingClientRect(); return { left: r.left - 6, top: r.top - 6, right: r.right + 6, bottom: r.bottom + 6 }; } };
    }
    function ctxDocked() { var o = panelOffset(ctxEl); return !o.x && !o.y; }
    var ctxLocked = (function () { try { var v = localStorage.getItem('paint-ctx-lock'); return v != null ? v === 'true' : !localStorage.getItem('paint-pos-ctx2'); } catch (x) { return true; } })();
    function ctxLock(on) {
      ctxLocked = on; storeIt('paint-ctx-lock', on); ctxEl.classList.toggle('locked', on);
      var t = on ? 'Unlock the tool settings, to move them' : 'Lock the tool settings in their place beside the picture (it makes room for them)';
      [ctxEl, pc, adjBox].forEach(function (el) { var b = el.querySelector('.ctx-lock'); if (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.setAttribute('aria-label', t); b.dataset.tip = t; } });
      hideTip(); [pc, adjBox].forEach(function (el) { el.classList.toggle('locked', on); });
      if (on) { ctxEl.style.translate = ''; try { localStorage.removeItem('paint-pos-ctx2'); } catch (x) {} }
      dockSync(ctxReady);
    }
    // (wider screens: Effects and the colour picker open in the dock's place,
    // as wide as it, over the tool settings, which step aside; on a phone
    // where they were, beside the left bar and over the bottom bar)
    var DOCKED_PANELS = [[adjBox, left], [pc, bbar]];
    function dockPanels() {
      var d = !phoneLayout();
      DOCKED_PANELS.forEach(function (x) {
        var el = x[0], home = d ? dock : x[1];
        el.classList.toggle('in-dock', d); el.classList.toggle('locked', ctxLocked); // (in its place: not dragged about; the picker, while the settings are unlocked, by its grip)
        if (el.parentNode !== home) { home.appendChild(el); el.style.translate = el.style.top = el.style.left = ''; }
        if (d) dockPlace(el);
      });
      discSize(d ? Math.max(150, (parseFloat(getComputedStyle(paintEl).getPropertyValue('--ctx-w')) || 196) - 20) : 212);
      if (!pc.hidden) placePicker();
      ctxAside();
    }
    // (in the dock they open from the tool settings: locked, in the dock's
    // place; unlocked, where the settings were moved to, kept in the workspace)
    // (worked out from the layout, not measured: it may be popping in)
    function dockPlace(el) {
      if (el.parentNode !== dock) return;
      if (ctxLocked || el.hidden) { el.style.translate = ''; return; }
      var o = panelOffset(ctxEl), d = dock.getBoundingClientRect(), W = paintEl.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
      var anchor = uiFlipped() ? d.left : d.right - w;
      var x = Math.max(W.left, Math.min(W.right - w, anchor + o.x)), y = Math.max(W.top, Math.min(W.bottom - h, d.top + o.y));
      el.style.translate = Math.round(x - anchor) + 'px ' + Math.round(y - d.top) + 'px';
    }
    // Locking returns the settings to their place without changing their folded state.
    function lockToggle() {
      ctxLock(!ctxLocked);
      if (!pc.hidden) dockPlace(pc);
      if (!adjBox.hidden) dockPlace(adjBox);
    }
    function ctxAside() { if (ctxEl) ctxEl.classList.toggle('aside', !adjBox.hidden || (typeof bsBox !== 'undefined' && !bsBox.hidden) || (!pc.hidden && pc.parentNode === dock)); }
    function dockSync(ease) {
      settingsToggleSync();
      if (ctxLocked && !ctxDocked()) ctxEl.style.translate = ''; // (locked: always in its place)
      var on = !phoneLayout() && ctxLocked && (!ctxEl.classList.contains('min') || (!pc.hidden && pc.parentNode === dock) || (!adjBox.hidden && adjBox.parentNode === dock));
      var mini = !phoneLayout() && ctxLocked && !on;
      if (paintEl.classList.contains('dock-on') === on && paintEl.classList.contains('dock-mini') === mini) return;
      if (!ease) paintEl.classList.add('dock-instant');
      paintEl.classList.toggle('dock-on', on); paintEl.classList.toggle('dock-mini', mini);
      if (!ease) { void dock.offsetWidth; paintEl.classList.remove('dock-instant'); refit(); return; }
      refitWhile(dock);
    }
    draggable(ctxEl, '.ctx-grip', 'ctx2', '.paint-ctx.min .ctx-min', ctxBox, function () { dockSync(true); });
    // (the colour picker, unlocked, by its own grip: the tool settings move with it, so it opens there again)
    [pc, adjBox].forEach(function (el) {
      draggable(el, '.pc-top .ctx-grip', 'ctx2', null, ctxBox, function () {
        ctxEl.style.translate = el.style.translate; keepOnScreen(ctxEl, ctxBox());
        var q = panelOffset(ctxEl); storeIt('paint-pos-ctx2', [q.x, q.y]);
      });
    });
    var CI = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; };
    var CHEV = '<svg class="ctx-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10l4 4 4-4"/></svg>';
    var SHAPE_ICONS = { rect: '<rect x="4.5" y="6" width="15" height="12" rx="1"/>', rounded: '<rect x="4.5" y="6" width="15" height="12" rx="3.5"/>', ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6"/>',
      triangle: '<path d="M12 5.5l7.5 13h-15z"/>', star: '<path d="M12 4.5l2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 16.3l-4.6 2.5.9-5.2-3.8-3.6 5.2-.7z"/>', arrow: '<path d="M5 19L19 5"/><path d="M11 5h8v8"/>' };
    var hint = function (t) { return '<span class="ctx-hint">' + t + '</span>'; };
    var sep = '<span class="ctx-sep" aria-hidden="true"></span>';
    var chip = function (k, label, icon, tip) { return '<button type="button" class="ctx-chip" data-ctx="' + k + '" aria-pressed="false" data-tip="' + tip + '">' + CI(icon) + '<span>' + label + '</span></button>'; };
    var smoothRow = '<label class="ctx-slider" data-tip="Smoothing: irons out wobbles. The line still ends right under the pen"><span>Smoothing</span><input type="range" min="0" max="100" data-ctx="smoothing" aria-label="Smoothing"><output>Off</output></label>';
    var snapChip = chip('snap', 'Snap', '<path d="M5 18.5c3-9 11-12 14-12"/><circle cx="19" cy="6.5" r="1.6"/>', 'Snap to shape: hold still at the end of a line, ellipse or rectangle to make it perfect (Shift: a circle or square)');
    var taperChip = chip('taper', 'Taper', '<path d="M3.5 12c4-3 13-3 17 0-4 3-13 3-17 0z"/>', 'Tapered ends: thin, pointed ends on each stroke (off: even thickness all the way)');
    var TFILLS = [['solid', 'Solid', 'One colour'], ['gradient', 'Blend', 'Blend from the main colour (top) to the second (bottom)'], ['rainbow', 'Rainbow', 'Each letter a colour of the rainbow, starting from the main colour'], ['two', 'Duo', 'Letters in the two colours, turn and turn about']];
    // (the selection tool's ways, as a segmented control at the top of its panel)
    function selWays(how) {
      return '<div class="pa-tabs ctx-seg" role="tablist" aria-label="Select with">' + SEL_KINDS.map(function (q) { return '<button type="button" role="tab" data-ctx-sel="' + q[0] + '" aria-label="' + q[1] + '" data-tip="' + q[3] + '">' + CI(q[2]) + '</button>'; }).join('') + '</div>' +
        hint('<b>' + selKindOf(st.tool)[1] + '</b> \u00b7 ' + how) + '<button type="button" class="ctx-btn" data-ctx="all" data-tip="Select everything (Ctrl+A)">Select All</button>' +
        '<button type="button" class="ctx-btn" data-ctx="paste" data-tip="Paste what was copied, on a new layer where it was (Ctrl+V)">Paste</button>';
    }
    // (the Shapes tool's kinds: the line, then each shape, in one segmented control)
    function shapeWays() {
      return '<div class="pa-tabs ctx-seg" role="tablist" aria-label="Line or shape"><button type="button" role="tab" data-ctx-shape="line" aria-label="Line" data-tip="Line (L)">' + CI(LINE_ICON) + '</button>' +
        SHAPES.map(function (q) { return '<button type="button" role="tab" data-ctx-shape="' + q[0] + '" aria-label="' + q[1] + '" data-tip="' + q[1] + '">' + CI(SHAPE_ICONS[q[0]] || '') + '</button>'; }).join('') + '</div>';
    }
    // (the Blend tool's modes)
    var BLEND_MODES = [['smudge', 'Smudge', 'Smudge (S): push and blend colours together like a finger'], ['blur', 'Blur', 'Blur (U): soften the paint you brush over'], ['dodge', 'Lighten', 'Lighten (O): brush light into the picture'], ['burn', 'Darken', 'Darken (O): brush shadow into the picture']];
    function blendWays(how) {
      return '<div class="pa-tabs ctx-seg ctx-seg-2x2" role="tablist" aria-label="Blend">' + BLEND_MODES.map(function (q) { return '<button type="button" role="tab" data-ctx-blend="' + q[0] + '" data-tip="' + q[2] + '">' + q[1] + '</button>'; }).join('') + '</div>' + hint(how);
    }
    var CTX = {
      brush: function () {
        return '<button type="button" class="ctx-btn" data-ctx="brushes" aria-haspopup="menu" aria-expanded="false" data-tip="Choose a brush"><canvas class="pb-prev" data-ctxprev aria-hidden="true"></canvas><span data-ctxname></span>' + CHEV + '</button>' +
          '<button type="button" class="ctx-btn" data-ctx="bstudio" data-tip="Brush Studio: this brush\u2019s settings (pressure, tapered ends, grain and more), or make a brush of your own">' + CI('<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>') + '<span>Brush Settings</span></button>' +
          sep + smoothRow + sep + taperChip + snapChip;
      },
      eraser: function () { return hint('Rubs out on the current layer') + sep + smoothRow + sep + snapChip; },
      smudge: function () { return blendWays('Drag to push and blend the paint'); },
      blur: function () { return blendWays('Drag to soften the paint'); },
      tone: function () { return blendWays('Brush over the picture to lighten or darken it, like in a darkroom'); },
      line: function () { return shapeWays() + hint('Drag to draw a line · <b>Shift</b> for steps of 45°'); },
      shape: function () {
        return shapeWays() + sep +
          '<div class="pa-tabs ctx-seg" role="tablist" aria-label="Fill"><button type="button" role="tab" data-ctx-fill="0">Outline</button><button type="button" role="tab" data-ctx-fill="1">Filled</button></div>' + hint('<b>Shift</b>: perfect shape');
      },
      text: function () {
        return '<button type="button" class="ctx-btn" data-ctx="fonts" aria-haspopup="menu" aria-expanded="false" data-tip="Font"><span data-ctxfont></span>' + CHEV + '</button>' +
          '<label class="ctx-field" data-tip="Text size"><span>Size</span><input type="number" class="p-field ctx-num" min="4" max="2000" data-ctx="tsize" aria-label="Text size"></label>' + sep +
          '<div class="pa-tabs ctx-seg" role="group" aria-label="Style">' +
            '<button type="button" data-ctx-t="bold" aria-label="Bold" data-tip="Bold"><b>B</b></button><button type="button" data-ctx-t="italic" aria-label="Italic" data-tip="Italic"><i style="font-family: Georgia, serif">I</i></button><button type="button" data-ctx-t="underline" aria-label="Underline" data-tip="Underline"><u>U</u></button></div>' + sep +
          '<div class="pa-tabs ctx-seg" role="tablist" aria-label="Alignment">' + ['left', 'center', 'right'].map(function (a) { return '<button type="button" role="tab" data-ctx-al="' + a + '" aria-label="Align ' + a + '" data-tip="Align ' + a + '">' + CI(a === 'left' ? '<path d="M4 6.5h16M4 10.5h10M4 14.5h16M4 18.5h10"/>' : a === 'center' ? '<path d="M4 6.5h16M7 10.5h10M4 14.5h16M7 18.5h10"/>' : '<path d="M4 6.5h16M10 10.5h10M4 14.5h16M10 18.5h10"/>') + '</button>'; }).join('') + '</div>' + sep +
          '<button type="button" class="ctx-btn" data-ctx="tmore" data-tip="Spacing, line height, capitals, outline and shadow (while typing)">More</button>' + sep +
          '<div class="pa-tabs ctx-seg ctx-seg-fit" role="tablist" aria-label="Fill">' + TFILLS.map(function (f) { return '<button type="button" role="tab" data-ctx-tf="' + f[0] + '" data-tip="' + f[2] + '">' + f[1] + '</button>'; }).join('') + '</div>' +
          '<label class="ctx-slider" data-tpath-off data-tip="Curve: bend the words into an arch (to the right) or a dip (to the left)"><span>Curve</span><input type="range" min="-100" max="100" step="1" data-ctx="tarc" aria-label="Curve"><output>0</output></label>' +
          '<div data-tpath-on>' + hint('The words follow the path') + '</div>' +
          '<button type="button" class="ctx-btn" data-ctx="tpathoff" data-tpath-on data-tip="Take the words off the path, back onto a straight line">' + CI('<path d="M4 17h16"/><path d="M4 11c4-5 12-5 16 0" stroke-dasharray="2 2"/>') + '<span>Straighten</span></button>' +
          '<div data-tpath-off>' + hint('For words along a line, draw it with the Pen, then pick <b>Text on Path</b>') + '</div>';
      },
      gradient: function () {
        return '<div class="pa-tabs ctx-seg" role="tablist" aria-label="Gradient">' + GRAD_KINDS.map(function (q) { return '<button type="button" role="tab" data-ctx-gk="' + q[0] + '" aria-label="' + q[1] + '" data-tip="' + q[2] + '">' + CI(q[3]) + '</button>'; }).join('') + '</div>' +
          '<span class="ctx-hint" data-gradhint></span>' +
          '<div class="ctx-gbar" data-gbar data-grad-on data-tip="The colour stops: tap to add one, drag one along to move it, or off the bar to take it away"><i></i></div>' +
          '<label class="ctx-slider" data-grad-pick data-tip="How solid the picked colour is"><span>Stop Opacity</span><input type="range" min="0" max="100" data-ctx="gstopo" aria-label="Opacity of the picked colour"><output>100%</output></label>' +
          '<button type="button" class="ctx-btn" data-ctx="gstopdel" data-grad-pick data-tip="Take the picked colour away (Delete)">' + CI('<circle cx="12" cy="12" r="7.5"/><path d="M8.5 12h7"/>') + '<span>Remove Stop</span></button>' + sep +
          '<button type="button" class="ctx-btn" data-ctx="swap" data-tip="Swap Colours (X): the two colours; while a gradient is being made, it turns it end to end">' + CI('<path d="M7 7h11l-3-3M17 17H6l3 3"/>') + '<span>Swap Colours</span></button>' +
          '<button type="button" class="ctx-btn" data-ctx="gradcancel" data-grad-on data-tip="Let the gradient go (Esc)">Cancel</button>' +
          '<button type="button" class="ctx-btn ctx-done" data-ctx="graddone" data-grad-on data-tip="Lay the gradient down (Return)">Done</button>';
      },
      select: function () { return selWays('Drag a box round what to select'); },
      lasso: function () { return selWays('Draw round it, or click to place points'); },
      circle: function () { return selWays('Drag an oval round it \u00b7 <b>Shift</b> for a circle'); },
      wand: function () { return selWays('Tap an area of one colour'); },
      pen: function () {
        return '<span class="ctx-hint" data-penhint></span>' + sep +
          chip('penstroke', 'Outline', '<path d="M5 18C8 6 16 6 19 18"/>', 'Draw the path as a line, at the brush size') +
          chip('penfill', 'Fill', '<path d="M5 18C8 6 16 6 19 18z" fill="currentColor" fill-opacity=".35"/>', 'Fill the inside of the path with the colour') + sep +
          chip('pentext', 'Text on Path', '<path d="M4 19c3-6 13-6 16 0"/><path d="M8.5 5h7M12 5v8"/>', 'Words that follow the path: pick it before drawing, or once the path is drawn') + sep +
          '<button type="button" class="ctx-btn" data-ctx="pencancel" data-tip="Let the path go (Esc)">Cancel</button>' +
          '<button type="button" class="ctx-btn ctx-done" data-ctx="pendone" data-tip="Lay the path down (Return, or double-click)">Done</button>';
      },
      // symmetry: which kind, radial's segments and mirror, and putting the guide back
      sym: function () {
        var box = '<rect x="4.5" y="4.5" width="15" height="15" rx="2.5"/>', dash = ' stroke-dasharray="2 1.8"';
        var SI = { x: box + '<path d="M12 4.5v15"' + dash + '/>', y: box + '<path d="M4.5 12h15"' + dash + '/>', xy: box + '<path d="M12 4.5v15M4.5 12h15"' + dash + '/>',
          radial: '<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5v15M5.5 8.25l13 7.5M5.5 15.75l13-7.5"' + dash + '/>' };
        var AI = { off: 'Off', ruler: 'Ruler', p1: '1-Pt', p2: '2-Pt', p3: '3-Pt' }, ATIP = { off: 'No ruler or perspective guide', ruler: 'Ruler: a straight edge to draw by (with Drawing Assist on, strokes keep along it, or square to it)', p1: 'One-point perspective (with Drawing Assist on, strokes run toward the point, or level, or upright)', p2: 'Two-point perspective (with Drawing Assist on, strokes run toward either point, or upright)', p3: 'Three-point perspective (with Drawing Assist on, strokes run toward any of the three points)' };
        return '<div class="ctx-title">Guides</div><div class="ctx-sub">Symmetry</div>' +
          '<div class="pa-tabs ctx-seg" role="tablist" aria-label="Symmetry">' + SYMS.map(function (y) { return '<button type="button" role="tab" data-ctx-sym="' + y[0] + '" aria-label="' + y[1] + '" data-tip="' + y[1] + '">' + (SI[y[0]] ? CI(SI[y[0]]) : 'Off') + '</button>'; }).join('') + '</div>' +
          '<div class="ctx-field" data-ctx="symn" data-sym-when="radial"><span>Segments</span><span class="p-step"><button type="button" data-symd="-1" aria-label="Fewer segments">&#8722;</button><output>6</output><button type="button" data-symd="1" aria-label="More segments">+</button></span></div>' +
          '<div data-sym-when="radial">' + chip('symmirror', 'Mirror', '<path d="M12 4v16"' + dash + '/><path d="M9 8l-4 8h4zM15 8l4 8h-4z"/>', 'Mirror each segment too') + '</div>' +
          '<div data-sym-when="on">' + hint('Drag the guide&#39;s centre to move it, and its handle to turn it') + '</div>' +
          '<button type="button" class="ctx-btn" data-ctx="symreset" data-sym-when="on" data-tip="Put the guide back in the middle, upright">' + CI('<circle cx="12" cy="12" r="7.5"' + dash + '/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>') + '<span>Centre the Guide</span></button>' +
          '<div class="ctx-sub">Ruler &amp; Perspective</div>' +
          '<div class="pa-tabs ctx-seg" role="tablist" aria-label="Ruler and perspective">' + ['off', 'ruler', 'p1', 'p2', 'p3'].map(function (m) { return '<button type="button" role="tab" data-ctx-assist="' + m + '" data-tip="' + ATIP[m] + '">' + AI[m] + '</button>'; }).join('') + '</div>' +
          '<div data-assist-on>' + hint('Drag its points to move it. With Drawing Assist on, strokes keep to it') + '</div>' +
          '<button type="button" class="ctx-btn" data-ctx="assistreset" data-assist-on data-tip="Put the ruler, or the vanishing points, back where they started">' + CI('<path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M5 4.5v3.8h3.8"/>') + '<span>Reset Guide</span></button>' +
          '<div class="ctx-sub">Grid</div>' +
          chip('grid', 'Show Grid', '<rect x="4.5" y="4.5" width="15" height="15" rx="2.5"/><path d="M9.5 4.5v15M14.5 4.5v15M4.5 9.5h15M4.5 14.5h15"/>', 'Show a grid over the picture, to draw to (it isn&#39;t part of the picture, and isn&#39;t saved)') +
          '<div class="pa-tabs ctx-seg" role="tablist" aria-label="Grid" data-grid-on><button type="button" role="tab" data-ctx-gridk="square" data-tip="Square: lines across and up and down">Square</button><button type="button" role="tab" data-ctx-gridk="iso" data-tip="Isometric: lines upright and at 30° either way, for drawing in isometric">Isometric</button></div>' +
          '<label class="ctx-slider" data-grid-on data-tip="How far apart the grid&#39;s lines are, in the picture&#39;s pixels (isometric: the side of each triangle)"><span>Spacing</span><input type="range" min="0" max="100" data-ctx="gridsize" aria-label="Grid spacing"><output>40</output></label>' +
          '<label class="ctx-slider" data-grid-on data-tip="How strongly the grid shows"><span>Opacity</span><input type="range" min="10" max="100" data-ctx="gridalpha" aria-label="Grid opacity"><output>100%</output></label>' +
          chip('assist', 'Drawing Assist', '<path d="M6 4.5v7a6 6 0 0 0 12 0v-7h-3.5v7a2.5 2.5 0 0 1-5 0v-7z"/><path d="M6 8h3.5M14.5 8H18"/>', 'Drawing Assist: strokes keep straight along the ruler, toward the vanishing points, or (with neither) along the grid&#39;s lines, from wherever they start. Off: everything is freehand') +
          '<button type="button" class="ctx-btn ctx-done" data-ctx="symdone" data-tip="Back to the tool&#39;s settings">Done</button>';
      },
      hand: function () { return hint('Drag to move · pinch to zoom · twist to turn') + '<button type="button" class="ctx-btn" data-zoom="fit" data-tip="The whole picture, upright (0)">Fit</button>'; }
    };
    // (the little lists that drop down from it: the brushes, the fonts)
    var ctxList = document.createElement('div'); ctxList.className = 'ctx-list'; ctxList.hidden = true; ctxList.setAttribute('role', 'menu'); stage.appendChild(ctxList);
    function ctxDrop(kind, btn) {
      if (!ctxList.hidden && ctxList.dataset.kind === kind) { ctxClose(); return; }
      ctxList.dataset.kind = kind;
      var bRow = function (b) { return '<button type="button" role="menuitemradio" data-pick="brush" data-val="' + b[0] + '" aria-checked="' + (st.brush === b[0]) + '"><canvas class="pb-prev" data-prev="' + b[0] + '" aria-hidden="true"></canvas><span>' + b[1].replace(/[<&]/g, '') + '</span></button>'; };
      if (kind === 'brushes') ctxList.innerHTML = BRUSHES.map(bRow).join('') + (myBrushes.length ? '<div class="pf-h">My Brushes</div>' + allBrushes().filter(function (b) { return b[2]; }).map(bRow).join('') : '') +
        '<button type="button" class="ctx-newbrush" data-ctx-new><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>New Brush</span></button>';
      else { ensureFonts(); ctxList.innerHTML = fontList('data-pick="font" data-val'); ctxList.classList.add('paint-fontmenu'); }
      if (kind === 'brushes') ctxList.classList.remove('paint-fontmenu');
      ctxList.hidden = false;
      Array.prototype.forEach.call(ctxList.querySelectorAll('[data-val]'), function (b) { b.setAttribute('aria-checked', b.dataset.val === (kind === 'fonts' ? st.font : st.brush) ? 'true' : 'false'); });
      if (kind === 'brushes') brushSamples(ctxList);
      // (beside the bar when it stands up, under the button when it's a strip)
      var r = btn.getBoundingClientRect(), sr = stage.getBoundingClientRect(), cr = ctxEl.getBoundingClientRect();
      var side = getComputedStyle(ctxEl).flexDirection === 'column';
      var top = side ? r.top - sr.top - 5 : r.bottom - sr.top + 6;
      if (kind === 'fonts') ctxList.style.maxHeight = Math.max(160, stage.clientHeight - (side ? 12 : top) - 20) + 'px';
      if (side) top = Math.max(6, Math.min(stage.clientHeight - ctxList.offsetHeight - 6, top));
      // (beside it on the side towards the picture's middle: left of it when it's docked at the right)
      var toLeft = cr.left + cr.width / 2 > sr.left + sr.width / 2;
      ctxList.style.left = Math.round(Math.max(6, Math.min(stage.clientWidth - ctxList.offsetWidth - 6, side ? (toLeft ? cr.left - sr.left - ctxList.offsetWidth - 6 : cr.right - sr.left + 6) : r.left - sr.left))) + 'px';
      ctxList.style.top = Math.round(top) + 'px';
      if (kind === 'fonts') { var on = ctxList.querySelector('[aria-checked="true"]'); if (on) on.scrollIntoView({ block: 'nearest' }); }
      btn.setAttribute('aria-expanded', 'true');
    }
    // WHILE THE PICTURE IS BEING WORKED ON (drawing, erasing, moving,
    // sizing or turning, panning, zooming...) the floating panel fades out
    // of the way, and comes back when it's let go. (A press on the picture
    // waits until it moves, or is held a moment, so a tap or a click
    // doesn't make it flicker.)
    var busyTimer = 0, busyOn = false, busyAt = null;
    function busy(on, e) {
      if (!ctxEl) return;
      if (!on) { clearTimeout(busyTimer); busyTimer = 0; busyAt = null; busyOn = false; [ctxEl, pc, adjBox].forEach(function (el) { el.classList.remove('busy'); }); return; }
      if (busyOn) return;
      if (!e) { clearTimeout(busyTimer); busyTimer = 0; busyAt = null; busyOn = true; [ctxEl, pc, adjBox].forEach(function (el) { el.classList.toggle('busy', !ctxLocked); }); return; }
      if (busyTimer) return;
      busyAt = { x: e.clientX, y: e.clientY }; busyTimer = setTimeout(function () { busy(true); }, 300);
    }
    function busyMove(e) { if (busyAt && Math.hypot(e.clientX - busyAt.x, e.clientY - busyAt.y) > 6) busy(true); }
    function ctxClose() { ctxList.hidden = true; Array.prototype.forEach.call(ctxTool.querySelectorAll('[aria-expanded="true"]'), function (b) { b.setAttribute('aria-expanded', 'false'); }); }
    function ctxRender() {
      if (!ctxEl) return;
      ctxClose();
      var key = ctxView === 'sym' ? 'sym' : (ctxToolId || 'brush');
      if (key !== ctxFor) { ctxFor = key; ctxTool.innerHTML = CTX[key] ? CTX[key]() : ''; }
      var mb = $('.paint-mirror'); if (mb) mb.setAttribute('aria-expanded', ctxView === 'sym' ? 'true' : 'false');
      ctxSync(); ctxShow();
      // (and the bottom bar: which of size and opacity this tool uses; the
      // other is greyed out, so nothing moves)
      var uses = { brush: 'so', eraser: 'so', smudge: 'so', blur: 'so', tone: 'so', line: 'so', shape: 'so', pen: 'so', fill: 'o', gradient: 'o', text: 'o' }[st.tool] || '';
      bbar.dataset.uses = uses; sizeIn.disabled = uses.indexOf('s') < 0; alphaIn.disabled = uses.indexOf('o') < 0;
    }
    // (symmetry's settings take the panel's place while they're open)
    function ctxSymView(on) {
      ctxView = on ? 'sym' : 'tool';
      if (on && ctxEl.classList.contains('min')) ctxMin(false);
      ctxRender();
    }
    // (folded away to one button, and back; remembered)
    var ctxSizeMotion = null;
    function ctxMin(on) {
      if (ctxEl.classList.contains('min') === on) { dockSync(ctxReady); return; }
      if (on && ctxEl.contains(document.activeElement)) settingsToggle.focus();
      var before = ctxEl.getBoundingClientRect();
      if (ctxSizeMotion) { ctxSizeMotion.cancel(); ctxSizeMotion = null; }
      ctxClose(); hideTip();
      ctxEl.classList.toggle('min', on);
      var m = ctxEl.querySelector('.ctx-min'), t = on ? 'Show the tool settings' : 'Hide the tool settings';
      m.setAttribute('aria-expanded', on ? 'false' : 'true'); m.setAttribute('aria-label', t); m.dataset.tip = t;
      storeIt('paint-ctx-min', on);
      if (!on) keepOnScreen(ctxEl, ctxBox()); // (opened out where it was dragged to: still all in view)
      dockSync(ctxReady);
      if (ctxReady && !matchMedia('(prefers-reduced-motion: reduce)').matches && before.width && before.height) {
        var after = ctxEl.getBoundingClientRect(), css = getComputedStyle(ctxEl);
        var top = parseFloat(css.top) || 0;
        var duration = parseFloat(css.getPropertyValue('--dur-slow')) * 1000 || 420;
        ctxSizeMotion = ctxEl.animate([
          { width: before.width + 'px', height: before.height + 'px', top: (top + before.top - after.top) + 'px', overflow: 'hidden', visibility: 'visible', opacity: on ? 1 : 0 },
          { width: after.width + 'px', height: after.height + 'px', top: top + 'px', overflow: 'hidden', visibility: 'visible', opacity: on ? 0 : 1 }
        ], { duration: duration, easing: css.getPropertyValue('--ease').trim() || 'ease' });
        if (!on) ctxTool.animate([{opacity: 0}, {opacity: 1}], {duration: duration, easing: 'ease'});
      }
    }
    function ctxShow() {
      ctxEl.classList.remove('has-sel');
      ctxEl.hidden = !ctxTool.innerHTML;
      settingsToggleSync();
      selectionToolbarSync();
    }
    function ctxSync() {
      var q = function (sel) { return ctxTool.querySelector(sel); }, set = function (sel, attr, on) { var e = q(sel); if (e) e.setAttribute(attr, on ? 'true' : 'false'); };
      var name = q('[data-ctxname]');
      if (name) { if (!allBrushes().some(function (x) { return x[0] === st.brush; })) st.brush = 'round'; name.textContent = bdef(st.brush).name; var cv = q('[data-ctxprev]'); cv.dataset.prev = st.brush; brushSamples(ctxTool); }
      var sm = q('[data-ctx="smoothing"]'); if (sm) { sm.value = smoothing; sm.nextElementSibling.textContent = smoothing ? smoothing : 'Off'; }
      set('[data-ctx="taper"]', 'aria-pressed', taperOn); set('[data-ctx="snap"]', 'aria-pressed', snapShapes);
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-tone]'), function (b) { b.setAttribute('aria-selected', b.dataset.ctxTone === st.tone ? 'true' : 'false'); });
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-sel]'), function (b) { b.setAttribute('aria-selected', b.dataset.ctxSel === st.tool ? 'true' : 'false'); });
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-shape]'), function (b) { var k = b.dataset.ctxShape; b.setAttribute('aria-selected', (k === 'line' ? st.tool === 'line' : st.tool === 'shape' && k === st.shape) ? 'true' : 'false'); });
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-blend]'), function (b) { b.setAttribute('aria-selected', isBlend(st.tool) && b.dataset.ctxBlend === blendMode() ? 'true' : 'false'); });
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-fill]'), function (b) { b.setAttribute('aria-selected', (b.dataset.ctxFill === '1') === !!st.solid ? 'true' : 'false'); });
      var fn = q('[data-ctxfont]'); if (fn) { fn.textContent = fontName(st.font); fn.style.fontFamily = st.font; }
      var ts = q('[data-ctx="tsize"]'); if (ts && document.activeElement !== ts) ts.value = tx.size;
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-t]'), function (b) { b.setAttribute('aria-selected', tx[b.dataset.ctxT] ? 'true' : 'false'); });
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-al]'), function (b) { b.setAttribute('aria-selected', tx.align === b.dataset.ctxAl ? 'true' : 'false'); });
      var tm = q('[data-ctx="tmore"]'); if (tm) tm.disabled = !textBox;
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-tf]'), function (b) { b.setAttribute('aria-selected', tx.fill === b.dataset.ctxTf ? 'true' : 'false'); });
      var ta = q('[data-ctx="tarc"]'); if (ta) { ta.value = tx.arc; ta.nextElementSibling.textContent = tx.arc; }
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-tpath-on]'), function (e) { e.hidden = !(textBox && textPath); });
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-tpath-off]'), function (e) { e.hidden = !!(textBox && textPath); });
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-sym]'), function (b) { b.setAttribute('aria-selected', b.dataset.ctxSym === st.sym ? 'true' : 'false'); });
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-sym-when]'), function (e) { var w = e.dataset.symWhen; e.hidden = w === 'radial' ? st.sym !== 'radial' : st.sym === 'off'; });
      var sn = q('[data-ctx="symn"] output'); if (sn) { sn.textContent = symN; q('[data-symd="-1"]').disabled = symN <= 2; q('[data-symd="1"]').disabled = symN >= 16; }
      set('[data-ctx="symmirror"]', 'aria-pressed', symMirror);
      set('[data-ctx="grid"]', 'aria-pressed', gridOn); set('[data-ctx="assist"]', 'aria-pressed', assistOn);
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-gridk]'), function (b) { b.setAttribute('aria-selected', b.dataset.ctxGridk === gridKind ? 'true' : 'false'); });
      var ga = q('[data-ctx="gridalpha"]'); if (ga) { if (document.activeElement !== ga) ga.value = Math.round(gridAlpha * 100); ga.nextElementSibling.textContent = Math.round(gridAlpha * 100) + '%'; }
      gradSync(q);
      var gz = q('[data-ctx="gridsize"]'); if (gz) { if (document.activeElement !== gz) gz.value = gridToSlider(gridSize); gz.nextElementSibling.textContent = gridSize + ' px'; }
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-grid-on]'), function (e) { e.hidden = !gridOn; });
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-assist]'), function (b) { b.setAttribute('aria-selected', b.dataset.ctxAssist === gMode ? 'true' : 'false'); });
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-assist-on]'), function (e) { e.hidden = gMode === 'off'; });
      set('[data-ctx="penstroke"]', 'aria-pressed', penStroke); set('[data-ctx="penfill"]', 'aria-pressed', penFill); set('[data-ctx="pentext"]', 'aria-pressed', penText);
      var ph = q('[data-penhint]'); if (ph) ph.textContent = 'Click to add points \u00b7 drag to curve \u00b7 click the first point to close' + (penText ? ', then type: the words follow the path' : '');
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx="penstroke"], [data-ctx="penfill"]'), function (b) { b.disabled = penText; });
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx="pendone"], [data-ctx="pencancel"]'), function (b) { b.disabled = !pen || pen.pts.length < (b.dataset.ctx === 'pencancel' ? 1 : 2); });
    }
    // (the gradient's part of it: its kind, what to do next, the stops bar,
    // and the picked stop's or point's opacity)
    function gradHint() {
      var k = grad ? grad.kind : gradKind;
      if (!grad) return { linear: 'Drag across the picture: from the colour to the second colour', radial: 'Drag out from where the middle goes', angular: 'Drag out from the middle: the colours go round it', diamond: 'Drag out from the middle to a corner', free: 'Tap to place colour points (or drag for two)' }[k];
      if (k === 'free') return 'Choose a colour, then tap to add a point in it \u00b7 drag one to move it \u00b7 tap one to pick it, then a colour to change it';
      return (k === 'linear' ? 'Drag the ends' : 'Drag the middle to move it, the end to size and turn it') + ' \u00b7 tap the line to add a colour stop \u00b7 pick a stop, then a colour';
    }
    function gradSync(q) {
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-gk]'), function (b) { b.setAttribute('aria-selected', b.dataset.ctxGk === (grad ? grad.kind : gradKind) ? 'true' : 'false'); });
      var gh = q('[data-gradhint]'); if (!gh) return;
      gh.textContent = gradHint();
      var gp = gradPicked(), pk = grad && grad.pick;
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-grad-on]'), function (e) { e.hidden = !grad || (e.hasAttribute('data-gbar') && grad.kind === 'free'); });
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-grad-pick]'), function (e) { e.hidden = !gp; });
      var go = q('[data-ctx="gstopo"]'); if (go && gp) { if (document.activeElement !== go) go.value = Math.round(gp.o * 100); go.nextElementSibling.textContent = Math.round(gp.o * 100) + '%'; go.previousElementSibling.textContent = pk.k === 's' ? 'Stop Opacity' : 'Point Opacity'; }
      var gd = q('[data-ctx="gstopdel"]'); if (gd && gp) { gd.disabled = pk.k === 's' ? pk.i === 0 || pk.i === grad.stops.length - 1 : grad.pts.length < 2; gd.querySelector('span').textContent = pk.k === 's' ? 'Remove Stop' : 'Remove Point'; }
      gradBarSync();
    }
    // THE STOPS BAR: the gradient's colours, a marker for each stop. A tap
    // adds a stop (in the colour there); a marker is picked, and dragged
    // along to move it, or off the bar to take it away. The ends stay put
    var GB_PAD = 9;
    function gradBarSync() {
      var bar = ctxTool.querySelector('[data-gbar]'); if (!bar || !grad || grad.kind === 'free') return;
      var S = grad.stops, L = gradLut(S), cs = [], pk = grad.pick;
      for (var i = 0; i <= 16; i++) cs.push(gradCss(L, Math.round(i / 16 * 1023) * 4) + ' ' + (i / 16 * 100) + '%');
      bar.firstChild.style.setProperty('--gb', 'linear-gradient(to right,' + cs.join(',') + ')');
      var ms = bar.querySelectorAll('b');
      if (ms.length !== S.length) { Array.prototype.forEach.call(ms, function (m) { m.remove(); }); S.forEach(function () { bar.appendChild(document.createElement('b')); }); ms = bar.querySelectorAll('b'); }
      S.forEach(function (s, i) { var m = ms[i]; m.style.left = 'calc(' + GB_PAD + 'px + (100% - ' + 2 * GB_PAD + 'px) * ' + s.t + ')'; m.style.setProperty('--c', s.c); m.style.setProperty('--o', s.o); m.classList.toggle('on', !!pk && pk.k === 's' && pk.i === i); });
    }
    ctxEl.addEventListener('pointerdown', function (e) {
      var bar = e.target.closest('[data-gbar]'); if (!bar || !grad || e.button) return;
      e.preventDefault();
      var r = bar.getBoundingClientRect(), span = r.width - 2 * GB_PAD, tAt = function (x) { return Math.max(0, Math.min(1, (x - r.left - GB_PAD) / span)); };
      var S = grad.stops, t = tAt(e.clientX), best = -1, bd = (e.pointerType === 'mouse' ? 9 : 14) / span, sn = gradSnap(), made = false;
      S.forEach(function (s, i) { var d = Math.abs(s.t - t); if (d <= bd) { bd = d; best = i; } });
      if (best < 0) { var c = gradAt(S, t), ns = { t: Math.max(0.001, Math.min(0.999, t)), c: rgb2hex(c[0], c[1], c[2]), o: Math.round(c[3] * 100) / 100 }; S.push(ns); gradSort(); best = S.indexOf(ns); made = true; }
      var stop = S[best], inner = best > 0 && best < S.length - 1, moved = made, off = false;
      gradPick('s', best); gradShow();
      try { bar.setPointerCapture(e.pointerId); } catch (x) {}
      function mv(ev) {
        if (!inner) return;
        off = grad.stops.length > 2 && Math.abs(ev.clientY - (r.top + r.height / 2)) > 36;
        stop.t = Math.max(0.001, Math.min(0.999, tAt(ev.clientX))); gradSort(); moved = true;
        bar.classList.toggle('gb-off', off); gradDraw(); gradBarSync();
      }
      function up() {
        bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); bar.classList.remove('gb-off');
        if (!grad) return;
        if (off) { grad.stops.splice(grad.stops.indexOf(stop), 1); grad.pick = null; }
        if (moved || off) gradRecord(sn);
        gradShow();
      }
      bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
    });
    ctxEl.addEventListener('change', function () { gradRun = false; });
    new MutationObserver(ctxShow).observe(selbar, { attributes: true, attributeFilter: ['hidden', 'class'] });
    var ctxReady = false;
    try { if (localStorage.getItem('paint-ctx-min') === 'true') ctxMin(true); } catch (x) {}
    ctxLock(ctxLocked); dockSync(false); dockPanels(); ctxReady = true;
    ctxEl.addEventListener('input', function (e) {
      var k = e.target.dataset.ctx;
      if (k === 'smoothing') { smoothing = +e.target.value; storeIt('paint-smoothing', smoothing); ctxSync(); }
      else if (k === 'gridsize') { gridSize = gridFromSlider(+e.target.value); storeIt('paint-grid-size', gridSize); gridDraw(); ctxSync(); }
      else if (k === 'gridalpha') { gridAlpha = Math.max(0.1, Math.min(1, +e.target.value / 100)); storeIt('paint-grid-alpha', gridAlpha); gridDraw(); ctxSync(); }
      else if (k === 'gstopo') gradOpacity(+e.target.value / 100);
      else if (k === 'tsize') { var v = Math.round(+e.target.value); if (v >= 4 && v <= 2000) { tx.size = v; if (textBox) afterTextChange(true); } }
      else if (k === 'tarc') { tx.arc = +e.target.value; if (textBox) afterTextChange(); else ctxSync(); }
    });
    ctxEl.addEventListener('keydown', function (e) { if (e.target.dataset.ctx === 'tsize') { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); if (textBox) textBox.focus({ preventScroll: true }); } } });
    ctxEl.addEventListener('pointerdown', function (e) { if (anyMenu()) openMenu(null); if (textBox && e.target.closest('button')) e.preventDefault(); }); // (so the words being typed keep the caret)
    ctxEl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !ctxEl.contains(b)) return;
      if (b.classList.contains('ctx-min')) { ctxMin(!ctxEl.classList.contains('min')); return; }
      if (b.classList.contains('ctx-lock')) { lockToggle(); return; }
      var k = b.dataset.ctx;
      if (k === 'brushes' || k === 'fonts') { ctxDrop(k, b); return; }
      if (k === 'bstudio') { studio(bsBox.hidden || bsId !== st.brush); return; }
      if (b.dataset.ctxSym) { setSym(b.dataset.ctxSym); return; }
      if (b.dataset.symd) { symN = Math.max(2, Math.min(16, symN + +b.dataset.symd)); drawGuide(); ctxSync(); return; }
      if (k === 'symmirror') { symMirror = !symMirror; drawGuide(); ctxSync(); return; }
      if (k === 'grid') { setGrid(!gridOn); return; }
      if (b.dataset.ctxGridk) { gridKind = b.dataset.ctxGridk; storeIt('paint-grid-kind', gridKind); gridDraw(); ctxSync(); return; }
      if (k === 'assist') { setAssistOn(!assistOn); return; }
      if (b.dataset.ctxGk) { gradSetKind(b.dataset.ctxGk); return; }
      if (k === 'graddone') { gradDone(); return; }
      if (k === 'gradcancel') { gradCancel(); return; }
      if (k === 'gstopdel') { gradRemove(); return; }
      if (k === 'symreset') { symC = { x: 0.5, y: 0.5 }; symA = 0; drawGuide(); return; }
      if (k === 'symdone') { ctxSymView(false); return; }
      if (b.dataset.ctxAssist) { setAssist(b.dataset.ctxAssist); return; }
      if (k === 'assistreset') { rulC = { x: 0.5, y: 0.5 }; rulA = 0; VP = [{ x: 0.5, y: 0.42 }, { x: 0.12, y: 0.42 }, { x: 0.88, y: 0.42 }, { x: 0.5, y: 1.25 }]; drawGuide(); return; }
      if (k === 'penstroke' || k === 'penfill') {
        if (k === 'penstroke') penStroke = !penStroke; else penFill = !penFill;
        if (!penStroke && !penFill) { if (k === 'penstroke') penFill = true; else penStroke = true; } // (one of them, at least)
        storeIt('paint-pen-stroke', penStroke); storeIt('paint-pen-fill', penFill); ctxSync(); if (pen) drawPen(); return;
      }
      if (k === 'pendone') { finishPen(); return; }
      if (k === 'pencancel') { cancelPen(); return; }
      if (k === 'pentext') {
        // (on with a path already drawn: the words start along it now;
        // otherwise it's the mode the next path is drawn in)
        if (!penText && pen && pen.pts.length >= 2) { textOnPath(); return; }
        penText = !penText; storeIt('paint-pen-text', penText); ctxSync(); if (pen) drawPen(); return;
      }
      if (k === 'tpathoff') { textPath = null; if (textBox) afterTextChange(); return; }
      if (b.dataset.ctxTf) { tx.fill = b.dataset.ctxTf; if (textBox) afterTextChange(); ctxSync(); return; }
      if (k === 'taper') { taperOn = !taperOn; storeIt('paint-taper', taperOn); ctxSync(); brushSamples(); return; }
      if (k === 'snap') { snapShapes = !snapShapes; storeIt('paint-snap-shapes', snapShapes); ctxSync(); return; }
      if (k === 'swap' && grad && st.tool === 'gradient') { gradReverse(); return; }
      if (k === 'swap') { var c1 = st.color; setColor(st.color2); setColor2(c1); return; }
      if (k === 'all') { selectAll(); return; }
      if (k === 'paste') { pasteAny(); return; }
      if (k === 'tmore') { if (textBox) textPanel(!tpEl || tpEl.hidden); return; }
      if (b.dataset.ctxTone) { st.tone = b.dataset.ctxTone; ctxSync(); return; }
      if (b.dataset.ctxSel) { chooseTool(b.dataset.ctxSel, false); return; }
      if (b.dataset.ctxShape) { var sk = b.dataset.ctxShape; if (sk === 'line') { if (st.tool !== 'line') setTool('line'); return; } st.shape = sk; storeIt('paint-shape', sk); if (st.tool !== 'shape') setTool('shape'); else ctxSync(); return; }
      if (b.dataset.ctxBlend) { blendPick(b.dataset.ctxBlend); return; }
      if (b.dataset.ctxFill) { st.solid = b.dataset.ctxFill === '1'; ctxSync(); return; }
      if (b.dataset.ctxT) { tx[b.dataset.ctxT] = !tx[b.dataset.ctxT]; if (textBox) afterTextChange(); ctxSync(); return; }
      if (b.dataset.ctxAl) { tx.align = b.dataset.ctxAl; if (textBox) afterTextChange(); ctxSync(); return; }
    });
    document.addEventListener('pointerdown', function (e) { if (!ctxList.hidden && !e.target.closest('.ctx-list, [data-ctx="brushes"], [data-ctx="fonts"]')) ctxClose(); }, true);

    setColor(st.color); setColor2(st.color2); setSize(st.size); setTool('brush'); buttons(); fit(); restore();
    // (the paper texture is made ahead, when the page is idle, so the first
    // pencil stroke doesn't stutter while it's made)
    (window.requestIdleCallback || function (f) { setTimeout(f, 600); })(function () { texture('pencil'); });
    app = {
      root: root, fit: function () { refit(); relayout(); },
      key: function (e) {
        if (e.key === 'Shift') shiftChanged(true);
        var k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
        if (sheetEl) {
          if (k === 'escape') { var ga = sheetEl.querySelector('.gal-acts:not([hidden])'); if (ga) galMenus(null); else closeSheet(); }
          return;
        }
        if (k === 'escape' && closeDrops()) return;
        if (k === 'escape' && document.documentElement.classList.contains('focus-mode')) { focusMode(false); return; }
        if (k === 'escape' && !pc.hidden) { picker(null); return; }
        if (e.target && (e.target.isContentEditable || (/input|textarea|select/i.test(e.target.tagName || '') && e.target.type !== 'range'))) return;
        if (mod && k === 'z' && lassoOn && !e.shiftKey) { e.preventDefault(); if (lasso.length > 1) { lasso.pop(); drawLasso(lassoHover); } else cancelLasso(); return; } // (while placing points: the last one)
        if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
        if (mod && k === 'y') { e.preventDefault(); doRedo(); return; }
        if (mod && k === 'a') { e.preventDefault(); selectAll(); return; }
        // (copy what's selected; paste: the paste event brings what's on the
        // clipboard, and if the browser sends none, what was copied here)
        if (mod && k === 'c' && !e.shiftKey && sel) { e.preventDefault(); if (!e.repeat) copySel(); return; }
        if (mod && k === 'v' && !e.shiftKey) { if (!e.repeat) { clearTimeout(pasteWait); pasteWait = setTimeout(pasteAny, 150); } return; }
        if (k === 'alt') { stage.classList.add('picking'); e.preventDefault(); return; }
        // the arrow keys nudge a selection (a pixel at a time; 10 with shift)
        if (sel && !selMode && !mod && /^arrow/.test(k) && e.target.type !== 'range') {
          e.preventDefault(); lift(); selRecord();
          var d = e.shiftKey ? 10 : 1;
          if (k === 'arrowleft') sel.x -= d; else if (k === 'arrowright') sel.x += d; else if (k === 'arrowup') sel.y -= d; else sel.y += d;
          drawSel(); autosave(); return;
        }
        if (mod || e.altKey) return;
        if (k === ' ') { if (!spaceDown) { spaceDown = true; stage.classList.add('space'); grabWithSpace(); } e.preventDefault(); return; }
        if (lassoOn) {
          if (k === 'enter') { e.preventDefault(); finishLasso(); return; }
          if (k === 'escape') { cancelLasso(); stage.classList.remove('closing'); return; }
          if (k === 'backspace' || k === 'delete') { e.preventDefault(); if (lasso.length > 1) lasso.pop(); else cancelLasso(); drawLasso(lassoHover); return; }
        }
        if (pen && st.tool === 'pen') {
          if (k === 'enter') { e.preventDefault(); finishPen(); return; }
          if (k === 'escape') { cancelPen(); return; }
          if (k === 'backspace' || k === 'delete') { e.preventDefault(); penBack(); return; }
        }
        if (grad && st.tool === 'gradient') {
          if (k === 'enter') { e.preventDefault(); gradDone(); return; }
          if (k === 'escape') { gradCancel(); return; }
          if (k === 'backspace' || k === 'delete') { e.preventDefault(); gradRemove(); return; }
        }
        if (k === 'escape' && !lmenu.hidden) { lmenu.hidden = true; return; }
        if (k === 'escape' && !panel.hidden && multi()) { multiOption('m-deselect'); return; }
        if (k === 'escape' && !ctxList.hidden) { ctxClose(); return; }
        if (k === 'escape' && !saveMenu.hidden) { savePanel(false); return; }
        if (k === 'escape' && adj) { adjustCancel(); return; }
        if (k === 'escape' && !bsBox.hidden) { studio(false); return; }
        if (k === 'escape') { openMenu(null); layerPanel(false); if (sel) commitSelection(); return; }
        if ((k === 'delete' || k === 'backspace') && sel) { e.preventDefault(); selAction('delete'); return; }
        if (k === 'enter' && sel) {
          // (Return commits, as the Commit button does, wherever the focus is,
          // except on a control reached with the keyboard, which keeps it;
          // once, and not in the middle of a drag)
          var fb = e.target && e.target.closest && e.target.closest('button, a[href], [role="button"], [role="menuitem"], [role="tab"], [role="option"], [role="switch"]');
          if (fb && keyNav && !fb.classList.contains('selection-commit')) return;
          e.preventDefault(); if (!e.repeat && !down && !selMode) selAction('done'); return;
        }
        var map = { b: 'brush', e: 'eraser', s: 'smudge', u: 'blur', l: 'line', r: 'shape', f: 'fill', g: 'gradient', t: 'text', m: 'select', q: 'lasso', c: 'circle', w: 'wand', v: 'move', p: 'pen', i: 'picker', h: 'hand', o: 'tone' };
        if (map[k]) chooseTool(map[k], false);
        else if (k === 'a') adjustOpen();
        else if (k === 'x') { var c1 = st.color; setColor(st.color2); setColor2(c1); }
        else if (k === '[') setSize(Math.min(st.size - 1, st.size / 1.15));
        else if (k === ']') setSize(Math.max(st.size + 1, st.size * 1.15));
        else if (k === '+' || k === '=') zoomStep(1);
        else if (k === '-') zoomStep(-1);
        else if (k === '0') fit();
        else if (e.key === '?') helpSheet();
        else if (e.key === '\\') focusMode(!document.documentElement.classList.contains('focus-mode'));
        else if (k === 'n' && !mod) newSheet();
      },
      keyup: function (e) { if (e.key === 'Shift') shiftChanged(false); if (e.key === ' ') letGoOfSpace(); else if (e.key === 'Alt') stage.classList.remove('picking'); }
    };
  }
  function setup() {
    var root = document.querySelector('main:not([aria-hidden]) .paint:not(.dr)');
    if (root) init(root); else app = null;
  }
  window.addEventListener('resize', function () { if (app && document.contains(app.root)) app.fit(); });
  document.addEventListener('keydown', function (e) { if (app && document.contains(app.root)) app.key(e); });
  document.addEventListener('keyup', function (e) { if (app && document.contains(app.root)) app.keyup(e); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
  document.addEventListener('pageswap:done', setup);
})();






