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

    // Slow, gentle fade: every colour on the page eases to its new value
    // together, in place. Photos never change, and nothing is lifted out of
    // the page, so nothing can show through the header or pop at the end.
    clearTimeout(fadeTimer);
    root.classList.add('theme-fading');
    void root.offsetWidth;
    apply();
    fadeTimer = setTimeout(function () { root.classList.remove('theme-fading'); }, 1600);
  });
})();

// The header's height, so the drawing area fills the rest of the screen
(function () {
  var header = document.querySelector('.site-header');
  function measure() { if (header) document.documentElement.style.setProperty('--hdr', header.getBoundingClientRect().height + 'px'); }
  measure();
  window.addEventListener('resize', measure);
})();

// Paint: the drawing app.
// Tools down the left: brush (with a list of brushes), eraser, smudge, blur,
// line, shapes (a list), fill, gradient, text (a list of fonts), select &
// move, cutout, magic wand, colour picker, hand and light & dark; mirror.
// (Filled shapes is a switch in the shapes list.) A selection stays while
// you draw, and keeps everything inside it, until its X closes it. Holding
// space grabs whatever the mouse is over (or the whole picture, over
// nothing). ADJUST opens sliders for the layer you're on. Down the right:
// two colours, swatches, recent colours, size, opacity, undo / redo, open,
// clear, layers and SAVE. The picture can be zoomed (pinch, ctrl + scroll,
// the corner buttons) and moved around (hand, space, two fingers). An Apple
// Pencil's pressure thickens and thins the line. Strokes are drawn on a
// see-through sheet on top while the pointer is down, then laid onto the
// layer, so a stroke's opacity stays even.
(function () {
  var SWATCHES = ['#141414', '#ffffff', '#8a8a8a', '#d6332f', '#f08a24', '#f5d33a', '#3fa34d', '#2f7fd6', '#7b4bc9', '#e36aa6', '#8b5a2b', '#1f3d5c'];
  var BRUSHES = [['round', 'Round'], ['feather', 'Feather'], ['marker', 'Marker'], ['pencil', 'Pencil'], ['spray', 'Spray'], ['calligraphy', 'Calligraphy'], ['highlighter', 'Highlighter'], ['watercolor', 'Watercolour'], ['chalk', 'Chalk'], ['oil', 'Oil Paint']];
  var SHAPES = [['rect', 'Rectangle'], ['rounded', 'Rounded'], ['ellipse', 'Ellipse'], ['triangle', 'Triangle'], ['star', 'Star'], ['arrow', 'Arrow']];
  var TONES = [['dodge', 'Lighten'], ['burn', 'Darken']];
  var BLENDS = [['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['darken', 'Darken'], ['lighten', 'Lighten'], ['color-dodge', 'Colour Dodge'],
    ['color-burn', 'Colour Burn'], ['soft-light', 'Soft Light'], ['hard-light', 'Hard Light'], ['difference', 'Difference'], ['exclusion', 'Exclusion'], ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Colour'], ['luminosity', 'Luminosity']];
  var SYMS = [['off', 'Off'], ['x', 'Left & Right'], ['y', 'Top & Bottom'], ['xy', 'Four Ways'], ['r6', 'Radial'], ['k12', 'Kaleidoscope']];
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
    text: 'Text', select: 'Move', lasso: 'Move', wand: 'Move', picker: 'Edit', hand: 'Edit', tone: 'Light & Dark' };
  var app = null;

  function init(root) {
    if (root.dataset.ready) return;
    root.dataset.ready = '1';
    var $ = function (q) { return root.querySelector(q); };
    var stage = $('.paint-stage'), world = $('.paint-world'), stack = $('.paint-layers'), guide = $('.paint-guide');
    var ov = $('.paint-over'), octx = ov.getContext('2d');
    var colorIn = $('.paint-current input'), colorDot = $('.paint-current span');
    var color2In = $('.paint-second input'), color2Dot = $('.paint-second span');
    var sizeIn = $('.paint-size'), alphaIn = $('.paint-alpha'), zoomVal = $('.paint-zoom-val'), selbar = $('.paint-selbar');
    var left = $('.paint-left'), right = $('.paint-right');

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
      var b = e.target.closest('button[data-tip]');
      if (!b || e.buttons) { hideTip(); return; }
      if (b !== tipOn) { tipOn = b; tip.textContent = b.dataset.tip; }
      placeTip(e);
      tip.classList.add('on');
    }
    left.addEventListener('pointerover', showTip);
    left.addEventListener('pointermove', showTip);
    left.addEventListener('pointerleave', hideTip);
    left.addEventListener('pointerdown', hideTip);
    document.addEventListener('pageswap:start', function gone() {
      document.removeEventListener('pageswap:start', gone);
      tip.remove();
    });
    var st = { tool: 'brush', brush: 'round', shape: 'rect', font: FONTS[0][0], color: colorIn.value, color2: color2In.value,
      size: +sizeIn.value, alpha: +alphaIn.value / 100, solid: false, sym: 'off', tone: 'dodge' };
    var W = 0, H = 0, R = 1, view = { k: 1, x: 0, y: 0 }, fitK = 1, fillK = 1;
    var layers = [], active = null, undo = [], redo = [], LIMIT = 14, recent = [];

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
    var count = 1;
    function makeLayer(name, white) {
      var c = document.createElement('canvas');
      c.width = ov.width; c.height = ov.height; c.style.width = W + 'px'; c.style.height = H + 'px';
      var x = c.getContext('2d', { willReadFrequently: true }); base(x);
      if (white) { x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); }
      // (bg: the white paper at the bottom; delete it and the picture is see-through)
      return { cv: c, ctx: x, name: name, visible: true, bg: !!white, opacity: 1, blend: 'normal' };
    }
    function mount() {
      stack.innerHTML = '';
      layers.forEach(function (L) { styleLayer(L); stack.appendChild(L.cv); });
      renderLayers();
    }
    // a layer's see-through-ness and blend mode show as it's drawn on screen
    // (and are worked in the same way when the picture is saved)
    function styleLayer(L) {
      L.cv.style.visibility = L.visible ? '' : 'hidden';
      L.cv.style.opacity = L.opacity < 1 ? L.opacity : '';
      L.cv.style.mixBlendMode = L.blend !== 'normal' ? L.blend : '';
    }
    // every visible layer, laid one on another (with its opacity and blend
    // mode), onto a canvas: for saving, sharing and picking colours
    function flattenInto(x, sx, sy, sw, sh, dw, dh) {
      layers.forEach(function (L) {
        if (!L.visible) return;
        x.save(); x.globalAlpha = L.opacity; if (L.blend !== 'normal') x.globalCompositeOperation = L.blend;
        if (sw == null) x.drawImage(L.cv, 0, 0); else x.drawImage(L.cv, sx, sy, sw, sh, 0, 0, dw, dh);
        x.restore();
      });
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
      world.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.k + ')';
      zoomVal.textContent = Math.round(view.k / fitK * 100) + '%';
      if (textBox) placeTextBox();
      placeSelX();
    }
    // the zoom buttons sit above SAVE; on a phone (no room there) they sit
    // in the picture's corner instead
    var zoomBox = $('.paint-zoom'), saveBtn = $('[data-act="save"]');
    function phoneLayout() { return window.matchMedia('(max-width: 560px)').matches; }
    function placeZoom() {
      if (phoneLayout()) { if (zoomBox.parentNode !== stage) stage.appendChild(zoomBox); }
      else if (zoomBox.nextElementSibling !== saveBtn) saveBtn.parentNode.insertBefore(zoomBox, saveBtn);
    }
    placeZoom();
    function fit() {
      placeZoom();
      var sw = stage.clientWidth, sh = stage.clientHeight;
      if (!sw || !sh) return;
      // ("100%" leaves a small margin round the picture, except on a phone,
      // where every bit of width counts; fillK just fills the space)
      // (the first step in, which just fills the space, reads 110%)
      fillK = Math.min(sw / W, sh / H) * 0.99;
      fitK = phoneLayout() ? fillK : fillK / 1.1;
      view.k = fitK; view.x = (sw - W * fitK) / 2; view.y = (sh - H * fitK) / 2;
      applyView();
    }
    function zoomAt(k, cx, cy) {
      k = Math.max(fitK * 0.25, Math.min(fitK * 10, k));
      view.x = cx - (cx - view.x) * k / view.k; view.y = cy - (cy - view.y) * k / view.k; view.k = k;
      applyView();
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
    function pos(e) { var r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k }; }

    // ---- colours ----
    var sw = $('.paint-swatches');
    SWATCHES.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.style.background = c; b.dataset.color = c; b.setAttribute('aria-label', 'Colour ' + c);
      sw.appendChild(b);
    });
    var recentBox = $('.paint-recent');
    function setColor(c) {
      st.color = c; colorIn.value = c; colorDot.style.background = c; if (textBox) styleTextBox(); if (menus.brush && !menus.brush.el.hidden) brushSamples();
      Array.prototype.forEach.call(root.querySelectorAll('.paint-swatches button, .paint-recent button'), function (b) { b.classList.toggle('on', b.dataset.color.toLowerCase() === c.toLowerCase()); });
    }
    function setColor2(c) { st.color2 = c; color2In.value = c; color2Dot.style.background = c; if (textBox) styleTextBox(); }
    function useColor() {
      // the last few colours used, as quick swatches
      var c = st.color.toLowerCase();
      recent = [c].concat(recent.filter(function (x) { return x !== c; })).slice(0, 4);
      recentBox.innerHTML = recent.map(function (x) { return '<button type="button" data-color="' + x + '" style="background:' + x + '" aria-label="Recent colour ' + x + '"></button>'; }).join('');
      setColor(st.color);
    }
    function setSize(v) { st.size = Math.max(1, Math.min(80, Math.round(v))); sizeIn.value = st.size; sizeIn.nextElementSibling.textContent = st.size; }

    // ---- lists that open beside a tool: brushes, shapes, fonts ----
    var menus = {};
    function makeMenu(tool, items, key, sample) {
      var m = document.createElement('div');
      m.className = 'paint-brushes'; m.setAttribute('role', 'menu'); m.hidden = true;
      m.innerHTML = items.map(function (it) {
        return '<button type="button" role="menuitemradio" data-pick="' + key + '" data-val="' + it[0].replace(/"/g, '&quot;') + '">' + sample(it) + '<span>' + it[1] + '</span></button>';
      }).join('');
      left.appendChild(m);
      menus[tool] = { el: m, key: key };
    }
    makeMenu('brush', BRUSHES, 'brush', function (b) { return '<canvas class="pb-prev" data-prev="' + b[0] + '" aria-hidden="true"></canvas>'; });
    makeMenu('shape', SHAPES, 'shape', function (s) { return '<i class="ps-' + s[0] + '"></i>'; });
    // (the text tool's list: every font, by kind, in a scrolling list)
    var fm = document.createElement('div');
    fm.className = 'paint-brushes paint-fontmenu'; fm.setAttribute('role', 'menu'); fm.hidden = true;
    fm.innerHTML = fontList('data-pick="font" data-val');
    left.appendChild(fm); menus.text = { el: fm, key: 'font' };
    makeMenu('tone', TONES, 'tone', function (t) { return '<i class="pt-' + t[0] + '"></i>'; });
    makeMenu('sym', SYMS, 'sym', function (y) { return '<i class="psym psym-' + y[0] + '"></i>'; });
    // filled shapes: a switch at the foot of the shapes list
    menus.shape.el.insertAdjacentHTML('beforeend', '<button type="button" class="paint-solid" role="menuitemcheckbox" aria-checked="false"><i class="ps-fill"></i><span>Filled</span></button>');
    function openMenu(tool) {
      Object.keys(menus).forEach(function (t) {
        var m = menus[t], on = t === tool, btn = root.querySelector('button[data-tool="' + t + '"], button[data-menu="' + t + '"]');
        m.el.hidden = !on;
        btn.setAttribute('aria-expanded', on ? 'true' : 'false');
        if (on) {
          if (t === 'text') ensureFonts();
          if (t === 'brush') brushSamples();
          m.el.style.top = Math.max(0, Math.min(btn.offsetTop, left.clientHeight - m.el.offsetHeight)) + 'px';
          Array.prototype.forEach.call(m.el.querySelectorAll('button'), function (b) { b.setAttribute('aria-checked', (b.dataset.val == null ? st.solid : b.dataset.val === st[m.key]) ? 'true' : 'false'); });
          if (t === 'text') { var on = m.el.querySelector('[aria-checked="true"]'); if (on) on.scrollIntoView({ block: 'nearest' }); }
        }
      });
    }
    function anyMenu() { return Object.keys(menus).some(function (t) { return !menus[t].el.hidden; }); }

    function setTool(t) {
      if (lassoOn || selMode === 'lasso') { cancelLasso(); stage.classList.remove('closing'); }
      if (adj) adjustDone();
      if (textBox) commitText();
      if (sel && !selTool(t)) anchor();
      st.tool = t;
      Array.prototype.forEach.call(root.querySelectorAll('button[data-tool]'), function (b) { b.setAttribute('aria-pressed', b.dataset.tool === t ? 'true' : 'false'); });
      stage.dataset.tool = t;
      octx.clearRect(0, 0, W, H);
    }

    // ---- undo / redo: snapshots of one layer, or of the layer list ----
    function snapOf(L) { return L.ctx.getImageData(0, 0, L.cv.width, L.cv.height); }
    // (each step has a name, for the HISTORY list; fewer steps are kept for
    // a big picture, so they don't fill up the memory)
    var trimmed = false;
    function limit() { return Math.max(4, Math.min(LIMIT, Math.floor(160e6 / (ov.width * ov.height * 4)))); }
    function push(e) { if (!e.label) e.label = TOOL_NAMES[st.tool] || 'Edit'; undo.push(e); while (undo.length > limit()) { undo.shift(); trimmed = true; } redo = []; buttons(); autosave(); }
    function remember(label) { push({ L: active, data: snapOf(active), bg: active.bg, label: label }); }
    function props() { return layers.map(function (L) { return { v: L.visible, o: L.opacity, b: L.blend }; }); }
    function rememberLayers(label) { push({ list: layers.slice(), active: active, props: props(), label: label || 'Layers' }); }
    function docState() { return { doc: true, pw: ov.width, ph: ov.height, list: layers.slice(), active: active, props: props() }; }
    function rememberDoc(label) { var e = docState(); e.label = label; push(e); }
    function capture(e) {
      var c = e.doc ? docState() : e.L ? { L: e.L, data: snapOf(e.L), bg: e.L.bg } : { list: layers.slice(), active: active, props: props() };
      c.label = e.label; return c;
    }
    function apply(e) {
      if (e.L) { if (e.bg != null) e.L.bg = e.bg; e.L.ctx.save(); e.L.ctx.setTransform(1, 0, 0, 1, 0, 0); e.L.ctx.putImageData(e.data, 0, 0); e.L.ctx.restore(); renderLayers(); }
      else {
        if (e.doc) { clearSel(); if (e.pw !== ov.width || e.ph !== ov.height) setDoc(e.pw, e.ph); }
        layers = e.list.slice(); layers.forEach(function (L, i) { var q = e.props[i]; L.visible = q.v; L.opacity = q.o; L.blend = q.b; });
        active = layers.indexOf(e.active) >= 0 ? e.active : layers[layers.length - 1] || null; mount();
        if (e.doc) fit();
      }
    }
    function doUndo() { if (adj) adjustDone(); if (textBox) commitText(); if (sel && sel.float) commitSelection(); if (!undo.length) return; var e = undo.pop(); redo.push(capture(e)); apply(e); buttons(); autosave(); }
    function doRedo() { if (!redo.length) return; var e = redo.pop(); undo.push(capture(e)); apply(e); buttons(); autosave(); }
    function buttons() { $('[data-act="undo"]').disabled = !undo.length; $('[data-act="redo"]').disabled = !redo.length; renderHistory(); }

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

    // each brush's shape: its width (or flat nib), how its ends taper, how
    // finely it's sampled, and how far its paint reaches beyond the line
    function brushCfg(k, sz, color) {
      var c = { kind: k, size: sz, color: color, tin: 0, tout: 0, step: Math.max(0.6, sz * 0.1) };
      if (k === 'round') { c.w = sz; c.tin = sz * 1.5; c.tout = sz * 1.2; }
      else if (k === 'eraser') { c.w = sz; }
      else if (k === 'pencil') { c.w = Math.max(1, sz * 0.38); c.tin = c.tout = Math.max(6, sz * 3); c.step = 0.6; }
      else if (k === 'marker') { c.len = Math.max(3, sz * 1.1); c.thick = Math.max(1.5, sz * 0.38); c.ang = -0.6; }
      else if (k === 'highlighter') { c.len = Math.max(10, sz * 2.2); c.thick = Math.max(3, sz * 0.5); c.ang = 1.35; }
      else if (k === 'calligraphy') { c.len = Math.max(4, sz * 1.5); c.thick = Math.max(1, sz * 0.09); c.ang = -Math.PI / 4; }
      else if (k === 'watercolor') { c.w = Math.max(4, sz * 1.8); c.tin = c.tout = c.w * 0.4; c.blur = Math.max(1.2, c.w * 0.12); }
      else if (k === 'chalk') { c.w = Math.max(3, sz * 1.3); c.tin = c.tout = sz * 0.8; }
      else if (k === 'oil') { c.w = Math.max(2, sz * 1.25); c.tin = sz * 0.9; c.tout = sz * 1.2; c.dry = sz * 3.5; }
      else if (k === 'feather') { c.w = Math.max(3, sz) * 1.35; c.blur = Math.max(3, sz) * 0.85; }
      if (c.len) { c.step = Math.max(0.5, c.thick * 0.4); c.reach = c.len / 2 + c.thick + 1; }
      else c.reach = c.w * (k === 'watercolor' ? 0.7 : 0.62) + (c.blur || 0) * 3 + 2;
      c.live = Math.max(c.tout, c.dry || 0); // (how far back from the tip it still changes)
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
    function widthFn(base, tin, tout, total, wob) {
      var memo = [];
      return function (s, tap) {
        if (!tap && memo[s.i] != null) return memo[s.i];
        var f = s.pr == null ? 1 : 0.15 + 0.85 * Math.min(1, s.pr * 1.25);
        if (!tap) {
          if (tin) { var u = Math.min(1, s.d / tin); f *= 0.12 + 0.88 * (1 - (1 - u) * (1 - u)); }
          if (tout) { var v = Math.min(1, Math.max(0, total - s.d) / tout); f *= 0.2 + 0.8 * (1 - (1 - v) * (1 - v)); }
        }
        if (wob) f *= 1 + wob(s.d);
        var w = Math.max(0.4, base * f);
        if (!tap) memo[s.i] = w;
        return w;
      };
    }
    // a slow, smooth wobble along the stroke (the same for the whole stroke):
    // edges that wander a little, like real paint
    function wobble(s8, scale, amp) {
      var ph = s8.ph || (s8.ph = [Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3]);
      return function (d) { var t = d / scale; return amp * (Math.sin(t + ph[0]) + 0.6 * Math.sin(t * 2.3 + ph[1]) + 0.35 * Math.sin(t * 5.1 + ph[2])) / 1.95; };
    }
    // only what's near the area being redrawn is drawn at all (box.vis says,
    // for each sample, whether it's within reach of it)
    function near(s, box) { return !box || box.vis[s.i]; }
    function markNear(S, box, r) {
      var v = new Uint8Array(S.length);
      for (var i = 0; i < S.length; i++) { var s = S[i]; v[i] = s.x + r >= box[0] && s.x - r <= box[2] && s.y + r >= box[1] && s.y - r <= box[3] ? 1 : 0; }
      box.vis = v; return box;
    }
    // a line of varying width with round ends, in runs of the same width
    function ribbon(c, S, wf, box) {
      if (S.length === 1) { c.beginPath(); c.arc(S[0].x, S[0].y, wf(S[0], true) / 2, 0, Math.PI * 2); c.fill(); return; }
      c.lineCap = 'round'; c.lineJoin = 'round';
      var cur = -1, open = false;
      for (var i = 1; i < S.length; i++) {
        var a = S[i - 1], b = S[i];
        if (!near(a, box) && !near(b, box)) { if (open) { c.stroke(); open = false; cur = -1; } continue; }
        var w = (wf(a) + wf(b)) / 2;
        w = w > 6 ? Math.round(w * 2) / 2 : Math.round(w * 4) / 4;
        if (w !== cur || !open) { if (open) c.stroke(); c.beginPath(); c.lineWidth = cur = w; c.moveTo(a.x, a.y); open = true; }
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
      var k = s.pr == null ? 1 : 0.35 + 0.65 * Math.min(1, s.pr * 1.25), ca = Math.cos(cfg.ang), sa = Math.sin(cfg.ang);
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
    // strands along the stroke (chalk's streaks, oil paint's bristles), each
    // at its own place across it, width, shade and strength, narrowing with it
    function strands(c, S, list, wf, box, from) {
      c.lineCap = 'round'; c.lineJoin = 'round';
      list.forEach(function (q) {
        c.globalAlpha = q.a; c.strokeStyle = q.col; c.lineWidth = q.w;
        c.beginPath(); var open = false;
        for (var i = from || 0; i < S.length; i++) {
          var s = S[i];
          // (a strand that comes and goes is on or off by its distance along
          // the stroke, so it's drawn the same however it's redrawn)
          if (!near(s, box) || (q.gap && Math.sin(s.d / q.gap[0] + q.gap[1]) < q.gap[2])) { open = false; continue; }
          var k = wf(s, S.length === 1) * q.o;
          var x = s.x + s.nx * k, y = s.y + s.ny * k;
          if (!open) { c.moveTo(x, y); open = true; if (S.length === 1) c.lineTo(x + 0.01, y); } else c.lineTo(x, y);
        }
        c.stroke();
      });
      c.globalAlpha = 1;
    }
    function shade(hex, f) {
      var c = parseInt(hex.slice(1), 16), m = function (v) { return Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))); };
      return 'rgb(' + m(c >> 16 & 255) + ',' + m(c >> 8 & 255) + ',' + m(c & 255) + ')';
    }
    // PAPER TEXTURES, used to rub a little out of a stroke so it catches on
    // the grain: fine (pencil), coarse and clumpy (chalk), soft blotches
    // (watercolour's mottling) and fine granulation (watercolour's pigment)
    var textures = {};
    function texture(kindOf) {
      if (textures[kindOf]) return textures[kindOf];
      var S = 256, g = document.createElement('canvas'); g.width = g.height = S;
      var gx = g.getContext('2d'), im = gx.createImageData(S, S), d = im.data;
      // smooth noise: a few octaves of small random grids, scaled up softly
      function smooth(cells) {
        var s2 = document.createElement('canvas'); s2.width = s2.height = cells;
        var sx = s2.getContext('2d'), si = sx.createImageData(cells, cells);
        for (var i = 0; i < si.data.length; i += 4) si.data[i + 3] = Math.random() * 255;
        sx.putImageData(si, 0, 0);
        // (laid out 3 x 3 before it's scaled up, so the middle one's edges
        // blend into its neighbours and the pattern repeats without seams)
        var t3 = document.createElement('canvas'); t3.width = t3.height = cells * 3;
        var tx = t3.getContext('2d'); for (var ox = 0; ox < 3; ox++) for (var oy = 0; oy < 3; oy++) tx.drawImage(s2, ox * cells, oy * cells);
        var big = document.createElement('canvas'); big.width = big.height = S;
        var bx = big.getContext('2d'); bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high';
        bx.drawImage(t3, -S, -S, S * 3, S * 3);
        return bx.getImageData(0, 0, S, S).data;
      }
      var lo = kindOf === 'chalk' ? smooth(24) : kindOf === 'cloud' ? smooth(10) : null, mid = kindOf === 'chalk' ? smooth(128) : kindOf === 'cloud' ? smooth(24) : null;
      for (var j = 0; j < d.length; j += 4) {
        var n = Math.random(), v;
        if (kindOf === 'pencil') v = n > 0.5 ? (n - 0.5) * 2 * 200 : 0;
        else if (kindOf === 'chalk') { v = mid[j + 3] / 255 * 0.55 + lo[j + 3] / 255 * 0.2 + n * 0.25; v = v > 0.5 ? Math.min(255, (v - 0.5) * 1400) : 0; }
        else if (kindOf === 'cloud') { v = lo[j + 3] / 255 * 0.65 + mid[j + 3] / 255 * 0.35; v = Math.max(0, v - 0.35) * 330; }
        else v = n < 0.45 ? Math.random() * 110 : 0; // grain
        d[j + 3] = v;
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
    // see-through layers of a brush (watercolour's bleed and pale middle) are
    // drawn whole on a spare sheet of their own, then laid on once, so the
    // overlapping round ends inside a line never double up
    var spares = {};
    function pass(c, s8, id, rects, fn, alpha, op, filter) {
      var cv = c.canvas, sp = s8.sp || (s8.sp = {}), x = sp[id];
      if (!x) {
        // (the main sheet's spares are kept from stroke to stroke, cleared at the start of each)
        var pool = s8.preview ? {} : spares;
        x = pool[id];
        if (!x || x.canvas.width !== cv.width || x.canvas.height !== cv.height) { var e = document.createElement('canvas'); e.width = cv.width; e.height = cv.height; x = pool[id] = e.getContext('2d'); }
        x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
        sp[id] = x;
      }
      var T = c.getTransform();
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0); clipTo2(x, rects); x.clearRect(0, 0, cv.width, cv.height);
      x.setTransform(T); x.fillStyle = x.strokeStyle = c.fillStyle; fn(x); x.restore();
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = alpha; if (op) c.globalCompositeOperation = op; if (filter) c.filter = filter;
      c.drawImage(x.canvas, 0, 0); c.restore();
    }
    // draw a stroke (its samples S) with a brush onto c, whose transform maps
    // the picture's units to the canvas; px is canvas pixels per unit. s8
    // keeps what's chosen once per stroke (strands, wobble, spare sheets) and
    // s8.sym the symmetry copies. box (in units) and rects (in canvas pixels)
    // are the area being redrawn, or null for all of it.
    function strokeOn(c, S, cfg, s8, px, box, rects) {
      var k = cfg.kind, total = S[S.length - 1].d, sym = s8.sym || [];
      if (sym.length) box = null; // (with copies, everything is drawn; the redraw area still limits the work)
      var rep = function (x, fn) {
        fn(x);
        if (!sym.length) return;
        var B = x.getTransform();
        sym.forEach(function (m) { x.setTransform(B.multiply(new DOMMatrix(m))); fn(x); });
        x.setTransform(B);
      };
      c.save(); c.fillStyle = c.strokeStyle = cfg.color;
      if (k === 'round' || k === 'eraser') {
        var wr = widthFn(cfg.w, cfg.tin, cfg.tout, total);
        rep(c, function (x) { ribbon(x, S, wr, box); });
      } else if (k === 'pencil') {
        // graphite: a fine line that tapers, catching on the paper's tooth;
        // pressing harder (or a bigger size) fills more of the grain in
        var wp = widthFn(cfg.w, cfg.tin, cfg.tout, total);
        rep(c, function (x) { ribbon(x, S, wp, box); });
        rubOut(c, 'pencil', Math.max(0.3, 0.62 - cfg.size * 0.006), px);
      } else if (cfg.len) {
        rep(c, function (x) { chisel(x, S, cfg, box); });
      } else if (k === 'watercolor') {
        // a wash: wandering edges and a soft bleed beyond them, paler in the
        // middle where the pigment has run to the rim, mottled and grainy.
        // It's laid down with multiply, so washes that cross build up
        var ww = cfg.w, wob = wobble(s8, ww * 1.6, 0.1);
        var wBleed = widthFn(ww * 1.22, cfg.tin, cfg.tout, total, wob), wBody = widthFn(ww, cfg.tin, cfg.tout, total, wob), wMid = widthFn(ww * 0.7, cfg.tin, cfg.tout, total, wob);
        pass(c, s8, 'bleed', rects, function (x) { rep(x, function (y) { ribbon(y, S, wBleed, box); }); }, 0.2, null, 'blur(' + cfg.blur * 1.5 * px + 'px)');
        rep(c, function (x) { ribbon(x, S, wBody, box); });
        pass(c, s8, 'mid', rects, function (x) { rep(x, function (y) { ribbon(y, S, wMid, box); }); }, 0.4, 'destination-out', 'blur(' + cfg.blur * px + 'px)');
        rubOut(c, 'cloud', 0.32, px);
        rubOut(c, 'grain', 0.5, px);
      } else if (k === 'chalk') {
        // chalk: a dense, dusty band whose edges break up, a few lighter
        // streaks along it, and the paper's coarse tooth showing through
        var rough = wobble(s8, Math.max(2, cfg.w * 0.12), 0.1), wcb = widthFn(cfg.w, cfg.tin, cfg.tout, total, rough);
        if (!s8.streaks) {
          var L = [], n = Math.max(2, Math.min(6, Math.round(cfg.size / 6)));
          for (var q = 0; q < n; q++) L.push({ o: (Math.random() - 0.5) * 0.8, w: Math.max(0.5, cfg.w * 0.025), a: 0.12 + Math.random() * 0.1, col: '#000', gap: [cfg.w * (1 + Math.random() * 2), Math.random() * 6.3, -0.2] });
          s8.streaks = L;
        }
        rep(c, function (x) { ribbon(x, S, wcb, box); });
        c.save(); c.globalCompositeOperation = 'destination-out';
        rep(c, function (x) { strands(x, S, s8.streaks, wcb, box); });
        c.restore();
        rubOut(c, 'chalk', 0.85, px);
      } else if (k === 'oil') {
        // oil paint: a body of paint, with the brush's bristles dragged
        // through it (fine streaks a touch lighter and darker, that come and
        // go), a soft sheen along one side, and the brush running dry towards
        // the end of a long stroke
        var wo = widthFn(cfg.w, cfg.tin, cfg.tout, total, wobble(s8, cfg.w * 1.2, 0.05));
        if (!s8.bristles) {
          var nb = Math.max(8, Math.min(26, Math.round(cfg.size / 1.4))), B = [];
          for (var r = 0; r < nb; r++) {
            var f = Math.random() < 0.5 ? 0.78 + Math.random() * 0.12 : 1.1 + Math.random() * 0.12;
            B.push({ o: (Math.random() - 0.5) * 0.92, w: Math.max(0.5, cfg.w * (0.03 + Math.random() * 0.05)), a: 0.28 + Math.random() * 0.3, col: shade(cfg.color, f), gap: Math.random() < 0.6 ? [cfg.w * (0.8 + Math.random() * 2.5), Math.random() * 6.3, -0.75 + Math.random() * 0.5] : null });
          }
          B.push({ o: -0.28, w: Math.max(0.6, cfg.w * 0.07), a: 0.22, col: shade(cfg.color, 1.35) }); // (the sheen)
          s8.bristles = B;
          s8.dryset = B.filter(function (b, i) { return i % 2 === 0; }).map(function (b) { return { o: b.o, w: b.w * 1.6, a: 1, col: '#000' }; });
        }
        rep(c, function (x) { ribbon(x, S, wo, box); strands(x, S, s8.bristles, wo, box); });
        // dry brush: gaps opening up between the bristles over the last part
        // of a long stroke (a short dab stays fully loaded)
        var dz = Math.min(cfg.dry, total * 0.45), strength = Math.min(1, total / (cfg.w * 10));
        if (dz > 1 && strength > 0.05) {
          var start = 0; while (start < S.length && S[start].d < total - dz) start++;
          for (var g0 = Math.max(0, start - 1); g0 < S.length - 1; g0 += 4) {
            var seg = S.slice(g0, Math.min(S.length, g0 + 5)), u = Math.min(1, Math.max(0, (seg[0].d - (total - dz)) / dz));
            if (box && !seg.some(function (s) { return near(s, box); })) continue;
            c.save(); c.globalCompositeOperation = 'destination-out';
            s8.dryset.forEach(function (q) { q.a = Math.pow(u, 1.6) * 0.85 * strength; });
            rep(c, function (x) { strands(x, seg, s8.dryset, wo, box); });
            c.restore();
          }
        }
      } else if (k === 'feather') {
        // an airbrush: the stroke as one very soft line. The line itself is
        // drawn off to the side and only its blurred shadow lands on the
        // picture, so nothing stacks up into rings.
        var OFF = c.canvas.width / px + cfg.reach * 4 + 50;
        c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = cfg.w; c.strokeStyle = c.fillStyle = '#000';
        c.shadowColor = cfg.color; c.shadowBlur = cfg.blur * px; c.shadowOffsetX = OFF * px; c.shadowOffsetY = 0;
        [S].concat(sym.map(function (m) { return S.map(function (q) { return mapPt(m, q); }); })).forEach(function (list) {
          c.beginPath();
          if (list.length === 1) { c.arc(list[0].x - OFF, list[0].y, cfg.w / 2, 0, Math.PI * 2); c.fill(); return; }
          var open = false;
          for (var i = 0; i < list.length; i++) {
            if (box && !near(S[i], box)) { open = false; continue; }
            c[open ? 'lineTo' : 'moveTo'](list[i].x - OFF, list[i].y); open = true;
          }
          c.stroke();
        });
      }
      c.restore();
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
    function renderStroke() {
      rsQueued = false;
      if (!down || !pts.length) return;
      var cfg = down.cfg || (down.cfg = brushCfg(kind(), st.size, st.tool === 'eraser' ? '#fff' : st.color));
      down.sym = copies();
      var prev = down.S, prevTail = prev ? prev.slice(prev.seg && down.n >= 4 ? prev.seg[Math.max(0, down.n - 3)] : 0) : null;
      var S = resample(pts, cfg.step, prev, down.n), total = S[S.length - 1].d;
      var d0 = prev ? changedFrom(prev, S, pts, down.total, total, cfg, down.n) : 0;
      var box = boxOf(S, d0, cfg.reach, prevTail ? boxOf(prevTail, d0, cfg.reach, [Infinity, Infinity, -Infinity, -Infinity]) : [Infinity, Infinity, -Infinity, -Infinity]);
      var rects = box[2] > box[0] ? deviceRects(box, down.sym) : [];
      if (rects.length) markNear(S, box, cfg.reach);
      down.S = S; down.total = total; down.n = pts.length;
      if (!rects.length) return;
      octx.save();
      octx.setTransform(1, 0, 0, 1, 0, 0); clipTo2(octx, rects); rects.forEach(function (r) { octx.clearRect(r[0], r[1], r[2] - r[0], r[3] - r[1]); }); base(octx);
      strokeOn(octx, S, cfg, down, R, box, rects);
      maskOv(); // (inside the redraw area only, so edges aren't masked twice)
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
    }
    // SYMMETRY: everything drawn is drawn again for each copy: mirrored
    // across the middle, both ways, or turned round the centre (radial: six
    // turns; kaleidoscope: six turns, each mirrored as well). Each copy is a
    // transform [a, b, c, d, e, f] of the picture.
    function mul(m, n) { return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; }
    function turn(a) { var cx = W / 2, cy = H / 2, co = Math.cos(a), si = Math.sin(a); return [co, si, -si, co, cx - co * cx + si * cy, cy - si * cx - co * cy]; }
    function copies() {
      var fx = [-1, 0, 0, 1, W, 0], fy = [1, 0, 0, -1, 0, H], out = [], i;
      if (st.sym === 'x') out = [fx];
      else if (st.sym === 'y') out = [fy];
      else if (st.sym === 'xy') out = [fx, fy, mul(fx, fy)];
      else if (st.sym === 'r6' || st.sym === 'k12') {
        for (i = 1; i < 6; i++) out.push(turn(i * Math.PI / 3));
        if (st.sym === 'k12') for (i = 0; i < 6; i++) out.push(mul(turn(i * Math.PI / 3), fx));
      }
      return out;
    }
    function mapPt(m, q) { return { x: m[0] * q.x + m[2] * q.y + m[4], y: m[1] * q.x + m[3] * q.y + m[5] }; }
    function both(c, fn) {
      fn();
      copies().forEach(function (m) { c.save(); c.setTransform(R * m[0], R * m[1], R * m[2], R * m[3], R * m[4], R * m[5]); fn(); c.restore(); });
    }
    // the guide lines over the picture, showing the symmetry
    function drawGuide() {
      if (st.sym === 'off') { guide.hidden = true; return; }
      var L = Math.hypot(W, H), lines = [];
      if (st.sym === 'x' || st.sym === 'xy') lines.push([W / 2, 0, W / 2, H]);
      if (st.sym === 'y' || st.sym === 'xy') lines.push([0, H / 2, W, H / 2]);
      if (st.sym === 'r6' || st.sym === 'k12') for (var i = 0; i < (st.sym === 'k12' ? 6 : 3); i++) { var a = Math.PI / 2 + i * Math.PI / (st.sym === 'k12' ? 6 : 3); lines.push([W / 2 - Math.cos(a) * L, H / 2 - Math.sin(a) * L, W / 2 + Math.cos(a) * L, H / 2 + Math.sin(a) * L]); }
      guide.hidden = false;
      guide.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + lines.map(function (l) { return '<line x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2] + '" y2="' + l[3] + '"/>'; }).join('') + '</svg>';
    }
    function setSym(v) {
      st.sym = v; drawGuide();
      var b = $('.paint-mirror'); b.setAttribute('aria-pressed', v !== 'off' ? 'true' : 'false');
    }
    function hexA(hex, a) { var c = parseInt(hex.slice(1), 16); return 'rgba(' + (c >> 16 & 255) + ',' + (c >> 8 & 255) + ',' + (c & 255) + ',' + a + ')'; }
    // SPRAY: a soft, round cloud of fine droplets, thickest in the middle,
    // over a faint mist (it builds up the longer it's held)
    function spray(c, p, size, color) {
      var hex = color || st.color, r = Math.max(5, (size || st.size) * 1.6), n = Math.round(Math.min(520, Math.max(r * 2.4, r * r * 0.16)));
      c.save();
      var mist = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      mist.addColorStop(0, hexA(hex, 0.05)); mist.addColorStop(0.6, hexA(hex, 0.025)); mist.addColorStop(1, hexA(hex, 0));
      c.fillStyle = mist; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = hex;
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, g = Math.sqrt(-2 * Math.log(Math.random() || 1e-6)) * 0.42, d = Math.min(1, g) * r, s2 = 0.3 + Math.random() * Math.random() * 0.9;
        c.globalAlpha = 0.35 + Math.random() * 0.65;
        c.beginPath(); c.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, s2, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
    var sprayTimer = 0;
    // how a stroke is laid onto the layer: its opacity, and (for the
    // highlighter and watercolour) multiply
    function strokeLook(which) {
      var b = which || (st.tool === 'brush' ? st.brush : '');
      if (b === 'highlighter') return { mode: 'multiply', alpha: Math.min(st.alpha, 0.45) };
      if (b === 'watercolor') return { mode: 'multiply', alpha: st.alpha * 0.85 };
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
      c.globalAlpha = alpha; if (mode) c.globalCompositeOperation = mode;
      c.drawImage(ov, 0, 0); c.restore();
      octx.clearRect(0, 0, W, H); plainOv();
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

    // ---- gradient: from the colour to the second colour, across the drag ----
    function gradient(a, b) {
      octx.clearRect(0, 0, W, H);
      var g = octx.createLinearGradient(a.x, a.y, b.x, b.y);
      // eased (smoothstep), so it fades in and out of each colour gently
      var c1 = parseInt(st.color.slice(1), 16), c2 = parseInt(st.color2.slice(1), 16);
      for (var i = 0; i <= 24; i++) {
        var t = i / 24, e = t * t * (3 - 2 * t), mix = function (sh) { var u = c1 >> sh & 255, v = c2 >> sh & 255; return Math.round(u + (v - u) * e); };
        g.addColorStop(t, 'rgb(' + mix(16) + ',' + mix(8) + ',' + mix(0) + ')');
      }
      octx.fillStyle = g;
      if (sel && sel.poly) { outline(octx, sel.x, sel.y, 1); octx.fill(); }
      else if (sel && sel.mask) { octx.fillRect(sel.x, sel.y, sel.w, sel.h); octx.save(); octx.globalCompositeOperation = 'destination-in'; octx.drawImage(sel.mask, sel.x, sel.y, sel.w, sel.h); octx.restore(); }
      else if (sel) octx.fillRect(sel.x, sel.y, sel.w, sel.h); else octx.fillRect(0, 0, W, H);
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
    function sampleAt(p) {
      var t = document.createElement('canvas'); t.width = t.height = 1;
      var x = t.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 1, 1);
      flattenInto(x, Math.floor(p.x * R), Math.floor(p.y * R), 1, 1, 1, 1);
      return hexOf(x.getImageData(0, 0, 1, 1).data);
    }
    function fillAt(p) {
      var x0 = Math.floor(p.x * R), y0 = Math.floor(p.y * R), w = active.cv.width, h = active.cv.height;
      if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return;
      var img = active.ctx.getImageData(0, 0, w, h), d = img.data, i0 = (y0 * w + x0) * 4;
      var tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], ta = d[i0 + 3];
      var c = parseInt(st.color.slice(1), 16), fr = c >> 16 & 255, fg = c >> 8 & 255, fb = c & 255, a = st.alpha;
      var seen = new Uint8Array(w * h), stack2 = [x0, y0], mp = sel ? selPixels() : null;
      if (mp && !mp[i0 + 3]) return;
      function like(k) { var j = k * 4; if (mp && !mp[j + 3]) return false; return Math.abs(d[j] - tr) + Math.abs(d[j + 1] - tg) + Math.abs(d[j + 2] - tb) + Math.abs(d[j + 3] - ta) <= 80; }
      function paint(j) {
        var da = d[j + 3] / 255, oa = a + da * (1 - a);
        d[j] = (fr * a + d[j] * da * (1 - a)) / oa; d[j + 1] = (fg * a + d[j + 1] * da * (1 - a)) / oa; d[j + 2] = (fb * a + d[j + 2] * da * (1 - a)) / oa; d[j + 3] = oa * 255;
      }
      while (stack2.length) {
        var y = stack2.pop(), x = stack2.pop(), k = y * w + x;
        while (x > 0 && !seen[k - 1] && like(k - 1)) { x--; k--; }
        var up = false, dn = false;
        while (x < w && !seen[k] && like(k)) {
          seen[k] = 1; paint(k * 4);
          if (y > 0) { var u = k - w; if (!seen[u] && like(u)) { if (!up) { stack2.push(x, y - 1); up = true; } } else up = false; }
          if (y < h - 1) { var v = k + w; if (!seen[v] && like(v)) { if (!dn) { stack2.push(x, y + 1); dn = true; } } else dn = false; }
          x++; k++;
        }
      }
      active.ctx.save(); active.ctx.setTransform(1, 0, 0, 1, 0, 0); active.ctx.putImageData(img, 0, 0); active.ctx.restore();
    }

    // ---- TEXT: type where you tap; it's laid onto the layer when you're
    // done. While typing, an Aa button sits by the words: it opens the text
    // options (font, size, bold / italic / underline / capitals, alignment,
    // letter spacing, line height, outline and shadow), which show live ----
    var textBox = null, textAt = null, textBtn = null, tpEl = null;
    var tx = { size: 48, bold: false, italic: false, underline: false, caps: false, align: 'left', spacing: 0, lh: 1.2, outline: 0, shadow: false };
    function fontSize() { return tx.size; }
    function fontName(v) { var f = FONTS.filter(function (x) { return x[0] === v; })[0]; return f ? f[1] : 'Font'; }
    function placeTextBox() {
      var k = view.k;
      textBox.style.left = view.x + textAt.x * k + 'px'; textBox.style.top = view.y + textAt.y * k + 'px';
      textBox.style.fontSize = tx.size * k + 'px';
      textBox.style.letterSpacing = tx.spacing / 1000 * tx.size * k + 'px';
      textBox.style.lineHeight = tx.lh;
      textBox.style.transform = tx.align === 'center' ? 'translateX(-50%)' : tx.align === 'right' ? 'translateX(-100%)' : '';
      textBox.style.webkitTextStroke = tx.outline ? (tx.outline * tx.size / 100 * 2 * k) + 'px ' + st.color2 : '';
      textBox.style.textShadow = tx.shadow ? '0 ' + tx.size * 0.06 * k + 'px ' + tx.size * 0.12 * k + 'px rgba(0,0,0,.45)' : '';
      placeTextBtn();
    }
    function styleTextBox() {
      if (!textBox) return;
      var b = textBox.style;
      b.fontFamily = st.font; b.color = st.color; b.opacity = st.alpha;
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
    function startText(p) {
      ensureFonts();
      textAt = p;
      textBox = document.createElement('div');
      textBox.className = 'paint-text'; textBox.contentEditable = 'true'; textBox.spellcheck = false;
      stage.appendChild(textBox);
      textBtn = document.createElement('button');
      textBtn.type = 'button'; textBtn.className = 'paint-textbtn'; textBtn.setAttribute('aria-label', 'Text options'); textBtn.title = 'Text options: font, size, spacing and more';
      textBtn.innerHTML = '<span>Aa</span>';
      stage.appendChild(textBtn);
      // (pressing it mustn't take the typing away from the words)
      textBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); });
      textBtn.addEventListener('click', function (e) { e.stopPropagation(); textPanel(!tpEl || tpEl.hidden); });
      styleTextBox();
      setTimeout(function () { textBox && textBox.focus({ preventScroll: true }); }, 0);
      textBox.addEventListener('input', placeTextBtn);
      textBox.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelText(); }
        else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
      });
      textBox.addEventListener('blur', function () {
        setTimeout(function () {
          var a = document.activeElement;
          // (still typing if the focus went to the text options, the font
          // list, the colours or the opacity: those change the words)
          if (textBox && a !== textBox && !(a && a.closest && a.closest('.paint-textpanel, .paint-fontmenu, .paint-colors, .paint-sliders'))) commitText();
        }, 0);
      });
    }
    function cancelText() {
      if (textBox) { textBox.remove(); textBox = null; }
      if (textBtn) { textBtn.remove(); textBtn = null; }
      textPanel(false);
    }
    function commitText() {
      if (!textBox) return;
      var lines = textBox.innerText.replace(/\n$/, '').split('\n');
      cancelText();
      if (!lines.join('').trim()) return;
      remember('Text');
      var c = active.ctx, fs = tx.size, lh = fs * tx.lh, ls = tx.spacing / 1000 * fs;
      c.save(); clipTo(c);
      c.font = (tx.italic ? 'italic ' : '') + (tx.bold ? '700 ' : '400 ') + fs + 'px ' + st.font;
      c.textBaseline = 'alphabetic'; c.globalAlpha = st.alpha; c.lineJoin = 'round'; c.miterLimit = 2;
      var native = 'letterSpacing' in c;
      if (native) c.letterSpacing = ls + 'px';
      // (placed exactly as the page laid out the typed words: each line's
      // baseline sits half the spare line height below its top, then the
      // font's ascent)
      var m = c.measureText('Hg'), A = m.fontBoundingBoxAscent != null ? m.fontBoundingBoxAscent : fs * 0.8, D = m.fontBoundingBoxDescent != null ? m.fontBoundingBoxDescent : fs * 0.2;
      function widthOf(t) {
        if (native || !ls) return c.measureText(t).width;
        var w = 0; for (var i = 0; i < t.length; i++) w += c.measureText(t[i]).width + ls; return w;
      }
      function draw(t, x, y, how) {
        if (native || !ls) { c[how](t, x, y); return; }
        for (var i = 0; i < t.length; i++) { c[how](t[i], x, y); x += c.measureText(t[i]).width + ls; }
      }
      lines.forEach(function (l, i) {
        var t = tx.caps ? l.toUpperCase() : l, w = widthOf(t);
        var x = tx.align === 'center' ? textAt.x - w / 2 : tx.align === 'right' ? textAt.x - w : textAt.x;
        var y = textAt.y + i * lh + (lh - (A + D)) / 2 + A;
        var shadow = function (on) { c.shadowColor = on ? 'rgba(0,0,0,.45)' : 'transparent'; c.shadowBlur = on ? fs * 0.12 * R : 0; c.shadowOffsetX = 0; c.shadowOffsetY = on ? fs * 0.06 * R : 0; };
        if (tx.outline) { shadow(tx.shadow); c.strokeStyle = st.color2; c.lineWidth = tx.outline * fs / 100 * 2; draw(t, x, y, 'strokeText'); shadow(false); }
        else shadow(tx.shadow);
        c.fillStyle = st.color; draw(t, x, y, 'fillText');
        if (tx.underline) c.fillRect(x, y + fs * 0.1, Math.max(0, w - (native ? 0 : ls)), Math.max(1, fs * 0.06));
        shadow(false);
      });
      c.restore();
      useColor();
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
      if (vw <= 600) { tpEl.style.left = Math.round((vw - w) / 2) + 'px'; tpEl.style.top = Math.round(vh - h - 8) + 'px'; return; }
      var x = r.right + 10; if (x + w > vw - 8) x = r.left - w - 10; if (x < 8) x = Math.max(8, (vw - w) / 2);
      tpEl.style.left = Math.round(x) + 'px'; tpEl.style.top = Math.round(Math.max(8, Math.min(vh - h - 8, r.top - 20))) + 'px';
    }
    var ICON = function (d) { return '<svg viewBox="0 0 24 24">' + d + '</svg>'; };
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
    function afterTextChange(typing) { styleTextBox(); syncTextPanel(typing); }
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
      if (tpEl && !tpEl.hidden && !e.target.closest('.paint-textpanel, .paint-textbtn, .paint-text, .paint-colors, .paint-sliders, .paint-fontmenu')) textPanel(false);
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
      sctx.clearRect(0, 0, W, H);
      if (!lasso.length) return;
      var k = view.k, closing = hover && nearStart(hover, false);
      sctx.save(); sctx.lineWidth = 1.2 / k; sctx.setLineDash([5 / k, 4 / k]);
      sctx.beginPath(); lasso.forEach(function (q, i) { sctx[i ? 'lineTo' : 'moveTo'](q.x, q.y); });
      if (hover) sctx.lineTo(closing ? lasso[0].x : hover.x, closing ? lasso[0].y : hover.y);
      sctx.strokeStyle = '#000'; sctx.stroke(); sctx.lineDashOffset = 4.5 / k; sctx.strokeStyle = '#fff'; sctx.stroke();
      if (lassoOn) {
        // the corners as small dots, and the first point as a ring to click
        // (it fills in when the pointer is close enough to close the shape)
        sctx.setLineDash([]);
        lasso.forEach(function (q, i) {
          if (q.corner && i) { sctx.beginPath(); sctx.arc(q.x, q.y, 2.5 / k, 0, Math.PI * 2); sctx.fillStyle = '#fff'; sctx.fill(); sctx.lineWidth = 1 / k; sctx.strokeStyle = '#141414'; sctx.stroke(); }
        });
        var a = lasso[0], r = (closing ? 7 : 5) / k;
        sctx.beginPath(); sctx.arc(a.x, a.y, r, 0, Math.PI * 2);
        sctx.fillStyle = closing ? (getComputedStyle(root).getPropertyValue('--accent').trim() || '#ff3b30') : '#fff'; sctx.fill();
        sctx.lineWidth = 1.5 / k; sctx.strokeStyle = closing ? '#fff' : '#141414'; sctx.stroke();
      }
      sctx.restore();
    }
    function finishLasso() {
      var xs = lasso.map(function (q) { return q.x; }), ys = lasso.map(function (q) { return q.y; });
      var x0 = Math.max(0, Math.min.apply(null, xs)), y0 = Math.max(0, Math.min.apply(null, ys));
      var x1 = Math.min(W, Math.max.apply(null, xs)), y1 = Math.min(H, Math.max.apply(null, ys));
      sel = lasso.length > 2 && x1 - x0 > 3 && y1 - y0 > 3 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0, float: null, poly: lasso.map(function (q) { return { x: q.x - x0, y: q.y - y0 }; }) } : null;
      lassoOn = false; lassoHover = null; lasso = []; stage.classList.remove('closing'); toastEl.classList.remove('on');
      selbar.hidden = !sel; selMode = null; down = null; drawSel();
    }
    function cancelLasso() { lassoOn = false; lassoHover = null; lasso = []; if (selMode === 'lasso') selMode = null; sctx.clearRect(0, 0, W, H); drawSel(); }
    function selTool(t) { return t === 'select' || t === 'lasso' || t === 'wand'; }
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
    // (a lasso selection keeps its outline, relative to its box)
    function inSel(p) {
      if (!sel || p.x < sel.x || p.x > sel.x + sel.w || p.y < sel.y || p.y > sel.y + sel.h) return false;
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
    function maskOv() {
      if (!sel || selTool(st.tool)) return;
      octx.save(); octx.globalCompositeOperation = 'destination-in';
      if (sel.mask) octx.drawImage(sel.mask, sel.x, sel.y, sel.w, sel.h); else { selPath(octx); octx.fillStyle = '#000'; octx.fill(); }
      octx.restore();
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
    function anchor() {
      if (!sel || !sel.float) return;
      active.ctx.drawImage(sel.float, sel.x, sel.y, sel.w, sel.h); sel.float = null; drawSel(); autosave();
    }
    function clearSel() { sel = null; selbar.hidden = true; selx.hidden = true; sctx.clearRect(0, 0, W, H); cornerCursor(null); }
    // the little X on the selection's top left corner closes it
    function placeSelX() {
      if (!sel || (selMode && selMode !== 'scale') || sel.thing) { selx.hidden = true; return; }
      selx.hidden = false;
      var x = view.x + sel.x * view.k, y = view.y + sel.y * view.k;
      selx.style.left = Math.round(Math.max(3, Math.min(stage.clientWidth - 25, x - 11))) + 'px';
      selx.style.top = Math.round(Math.max(3, Math.min(stage.clientHeight - 25, y - 11))) + 'px';
    }
    function lift(keep) {
      // the pixels come up off the layer (or a copy of them does)
      if (sel.float) return;
      remember('Move');
      var f = document.createElement('canvas'); f.width = Math.max(1, Math.round(sel.w * R)); f.height = Math.max(1, Math.round(sel.h * R));
      var fx = f.getContext('2d');
      fx.drawImage(active.cv, Math.round(sel.x * R), Math.round(sel.y * R), f.width, f.height, 0, 0, f.width, f.height);
      if (sel.poly) { fx.globalCompositeOperation = 'destination-in'; outline(fx, 0, 0, R); fx.fill(); fx.globalCompositeOperation = 'source-over'; }
      if (sel.mask) { fx.globalCompositeOperation = 'destination-in'; fx.drawImage(sel.mask, 0, 0, f.width, f.height); fx.globalCompositeOperation = 'source-over'; }
      if (!keep && sel.mask) {
        var cm = active.ctx; cm.save(); cm.setTransform(1, 0, 0, 1, 0, 0);
        cm.globalCompositeOperation = 'destination-out'; cm.drawImage(sel.mask, Math.round(sel.x * R), Math.round(sel.y * R));
        cm.globalCompositeOperation = 'source-over';
        if (active.bg) cm.drawImage(tinted(sel.mask, '#fff'), Math.round(sel.x * R), Math.round(sel.y * R));
        cm.restore();
      } else if (!keep) {
        var c = active.ctx; c.save();
        if (sel.poly) { outline(c, sel.x, sel.y, 1); c.clip(); }
        c.clearRect(sel.x, sel.y, sel.w, sel.h);
        if (active.bg) { c.fillStyle = '#fff'; c.fillRect(sel.x, sel.y, sel.w, sel.h); }
        c.restore();
      }
      sel.float = f;
    }
    function drawSel() {
      sctx.clearRect(0, 0, W, H);
      placeSelX();
      if (!sel) return;
      if (sel.float) sctx.drawImage(sel.float, sel.x, sel.y, sel.w, sel.h);
      if (sel.thing) return;
      // a wand selection shows as a light blue wash over what's picked
      else if (sel.mask) { sctx.save(); sctx.globalAlpha = 0.35; sctx.drawImage(sel.tint || (sel.tint = tinted(sel.mask, '#2f7fd6')), sel.x, sel.y, sel.w, sel.h); sctx.restore(); }
      sctx.save(); sctx.lineWidth = 1 / view.k;
      var edge = function () { if (sel.poly) outline(sctx, sel.x, sel.y, 1); else { sctx.beginPath(); sctx.rect(sel.x, sel.y, sel.w, sel.h); } sctx.stroke(); };
      sctx.setLineDash([5 / view.k, 4 / view.k]); sctx.strokeStyle = '#000'; edge();
      sctx.lineDashOffset = 4.5 / view.k; sctx.strokeStyle = '#fff'; edge();
      // little squares on the corners: drag one to make it bigger or smaller
      if (selMode !== 'new') {
        var hs = 7 / view.k; sctx.setLineDash([]); sctx.fillStyle = '#fff'; sctx.strokeStyle = '#141414';
        corners().forEach(function (q) { sctx.fillRect(q.x - hs / 2, q.y - hs / 2, hs, hs); sctx.strokeRect(q.x - hs / 2, q.y - hs / 2, hs, hs); });
      }
      sctx.restore();
    }
    function corners() { return [{ x: sel.x, y: sel.y, c: 'nw' }, { x: sel.x + sel.w, y: sel.y, c: 'ne' }, { x: sel.x, y: sel.y + sel.h, c: 'sw' }, { x: sel.x + sel.w, y: sel.y + sel.h, c: 'se' }]; }
    // which corner (if any) the pointer is on, within a few screen pixels
    function cornerAt(p, touch) {
      if (!sel || selMode || sel.thing) return null;
      var r = (touch ? 18 : 9) / view.k, hit = null;
      corners().forEach(function (q) { if (!hit && Math.abs(p.x - q.x) <= r && Math.abs(p.y - q.y) <= r) hit = q; });
      return hit;
    }
    function cornerCursor(q) {
      stage.classList.toggle('corner-nwse', !!q && (q.c === 'nw' || q.c === 'se'));
      stage.classList.toggle('corner-nesw', !!q && (q.c === 'ne' || q.c === 'sw'));
    }
    // after a wand selection is resized, its shape is redrawn at the new size
    function refitMask() {
      if (!sel.mask) return;
      var w = Math.max(1, Math.round(sel.w * R)), h = Math.max(1, Math.round(sel.h * R));
      if (w === sel.mask.width && h === sel.mask.height) return;
      var m = document.createElement('canvas'); m.width = w; m.height = h;
      var x = m.getContext('2d'); x.drawImage(sel.mask, 0, 0, w, h);
      var d = x.getImageData(0, 0, w, h);
      for (var i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 100 ? 255 : 0;
      x.putImageData(d, 0, 0);
      sel.mask = m; sel.maskData = d.data; sel.tint = null;
    }
    function commitSelection() {
      if (!sel) return;
      if (sel.float) { active.ctx.drawImage(sel.float, sel.x, sel.y, sel.w, sel.h); autosave(); }
      clearSel();
    }
    function invertSel() {
      if (!sel) return;
      if (adj) adjustDone();
      var inv = function (d) { for (var i = 0; i < d.length; i += 4) if (d[i + 3]) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; } };
      if (sel.float) {
        // (something lifted and being moved: its own pixels)
        var fx = sel.float.getContext('2d'), fd = fx.getImageData(0, 0, sel.float.width, sel.float.height); inv(fd.data); fx.putImageData(fd, 0, 0);
      } else {
        remember('Invert');
        var c = active.ctx, img = c.getImageData(0, 0, active.cv.width, active.cv.height), d = img.data, m = selPixels();
        for (var i = 0; i < d.length; i += 4) if (m[i + 3] > 127 && d[i + 3]) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.putImageData(img, 0, 0); c.restore();
      }
      drawSel(); autosave();
    }
    function selectAll() { if (textBox) commitText(); commitSelection(); need(); sel = { x: 0, y: 0, w: W, h: H, float: null }; selbar.hidden = false; drawSel(); }
    function selAction(a) {
      if (!sel) return;
      if (a === 'done') { commitSelection(); return; }
      if (a === 'invert') { invertSel(); return; }
      if (a === 'layer') {
        // CUT TO LAYER: the selection comes out onto a layer of its own
        lift();
        rememberLayers('Cut to Layer');
        var L = makeLayer('Cutout', false); L.ctx.drawImage(sel.float, sel.x, sel.y, sel.w, sel.h);
        layers.splice(layers.indexOf(active) + 1, 0, L); active = L;
        clearSel(); mount(); return;
      }
      if (a === 'delete') { if (!sel.float) lift(); sel.float = null; clearSel(); autosave(); return; }
      if (a === 'copy') {
        // COPY: the selection is copied onto a new layer just above, picked
        // up and ready to move (the original stays where it is)
        if (layers.length >= 10) return;
        anchor(); lift(true);
        var f = sel.float; sel.float = null; undo.pop();
        rememberLayers('Copy');
        var L2 = makeLayer('Copy', false); layers.splice(layers.indexOf(active) + 1, 0, L2); active = L2; mount();
        sel.float = f; sel.x += 14; sel.y += 14; drawSel(); autosave(); return;
      }
      lift();
      var f = sel.float, g = document.createElement('canvas'); g.width = f.width; g.height = f.height;
      var gx = g.getContext('2d');
      if (a === 'fliph') { gx.translate(f.width, 0); gx.scale(-1, 1); } else { gx.translate(0, f.height); gx.scale(1, -1); }
      gx.drawImage(f, 0, 0); sel.float = g;
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
    right.appendChild(panel);
    renderLayers();
    function renderLayers() {
      if (!panel) return;
      var rows = layers.slice().reverse().map(function (L) {
        var i = layers.indexOf(L);
        return '<div class="pl-row' + (L === active ? ' on' : '') + '" data-i="' + i + '">' +
          '<button type="button" class="pl-eye" data-layer-eye="' + i + '" aria-label="' + (L.visible ? 'Hide' : 'Show') + ' ' + L.name + '" aria-pressed="' + (!L.visible) + '">' +
            '<svg viewBox="0 0 24 24">' + (L.visible ? '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>' : '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.6 3.3M6.4 7.6A15 15 0 0 0 2.5 12s3.5 6 9.5 6a9 9 0 0 0 4.1-1"/>') + '</svg></button>' +
          '<canvas class="pl-thumb" data-thumb="' + i + '" aria-hidden="true"></canvas>' +
          '<button type="button" class="pl-name" data-layer="' + i + '" title="Tap again to rename">' + L.name.replace(/[<&]/g, function (ch) { return ch === '<' ? '&lt;' : '&amp;'; }) + '</button>' +
          '<span class="pl-grip" aria-label="Drag to reorder" title="Drag to reorder"><svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="1.3"/><circle cx="15" cy="7" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="17" r="1.3"/><circle cx="15" cy="17" r="1.3"/></svg></span></div>';
      }).join('');
      if (!layers.length) rows = '<div class="pl-empty">No layers. Draw, or tap + to add one.</div>';
      var pr = active ? '<div class="pl-props"><label class="pl-op"><span>Opacity</span><input type="range" min="0" max="100" value="' + Math.round(active.opacity * 100) + '" data-layer-op aria-label="Layer opacity"><output>' + Math.round(active.opacity * 100) + '%</output></label>' +
        '<label class="pl-bl"><span>Blend</span><select data-layer-blend aria-label="Blend mode">' + BLENDS.map(function (b) { return '<option value="' + b[0] + '"' + (b[0] === active.blend ? ' selected' : '') + '>' + b[1] + '</option>'; }).join('') + '</select></label></div>' : '';
      thumbsSoon();
      panel.innerHTML = '<div class="pl-title">Layers</div><div class="pl-list">' + rows + '</div>' + pr +
        '<div class="pl-acts">' +
          '<button type="button" data-layer-act="add" title="New layer" aria-label="New layer"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>' +
          '<button type="button" data-layer-act="up" title="Move up" aria-label="Move layer up"' + (!active || layers.indexOf(active) === layers.length - 1 || active.bg ? ' disabled' : '') + '><svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>' +
          '<button type="button" data-layer-act="down" title="Move down" aria-label="Move layer down"' + (!active || layers.indexOf(active) <= (layers[0].bg ? 1 : 0) ? ' disabled' : '') + '><svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg></button>' +
          '<button type="button" data-layer-act="delete" title="Delete layer" aria-label="Delete layer"' + (active ? '' : ' disabled') + '><svg viewBox="0 0 24 24"><path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 12h8l1-12"/></svg></button>' +
        '</div>';
    }
    // LAYER PREVIEWS: a little picture of what's on each layer (over a
    // checkerboard, so see-through parts show), kept up to date while the
    // panel is open; hover one (or press it) for a bigger look
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
    function hidePeek() { peekL = null; peek.hidden = true; }
    panel.addEventListener('pointerover', function (e) { var t = e.target.closest('[data-thumb]'); if (t) showPeek(t); else if (peekL) hidePeek(); });
    panel.addEventListener('pointerleave', hidePeek);
    function layerPanel(open) {
      if (!open) hidePeek(); else thumbsSoon();
      panel.hidden = !open;
      $('[data-act="layers"]').setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { var b = $('[data-act="layers"]'); panel.style.top = Math.max(0, Math.min(b.offsetTop - panel.offsetHeight + b.offsetHeight, right.clientHeight - panel.offsetHeight)) + 'px'; }
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
      inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); });
      inp.addEventListener('blur', function () { finish(true); });
    }
    panel.addEventListener('dblclick', function (e) { var n = e.target.closest('[data-layer]'); if (n) rename(+n.dataset.layer); });
    // RIGHT-CLICK A LAYER (or press and hold it): SELECT, which selects
    // everything on that layer
    var lmenu = document.createElement('div');
    lmenu.className = 'paint-lmenu'; lmenu.hidden = true; lmenu.setAttribute('role', 'menu');
    lmenu.innerHTML = '<button type="button" role="menuitem" data-lmenu="select">Select</button>';
    document.body.appendChild(lmenu);
    document.addEventListener('pageswap:start', function gone() { document.removeEventListener('pageswap:start', gone); lmenu.remove(); });
    function layerMenu(i, x, y) {
      lmenu.dataset.i = i; lmenu.hidden = false;
      lmenu.style.left = Math.min(x, document.documentElement.clientWidth - lmenu.offsetWidth - 8) + 'px';
      lmenu.style.top = Math.min(y, window.innerHeight - lmenu.offsetHeight - 8) + 'px';
    }
    panel.addEventListener('contextmenu', function (e) {
      var row = e.target.closest('.pl-row'); if (!row) return;
      e.preventDefault(); layerMenu(+row.dataset.i, e.clientX, e.clientY);
    });
    var holdTimer = 0;
    panel.addEventListener('pointerdown', function (e) {
      var row = e.target.closest('.pl-row'); if (!row || e.pointerType === 'mouse' || e.target.closest('.pl-grip')) return;
      var x = e.clientX, y = e.clientY; clearTimeout(holdTimer);
      holdTimer = setTimeout(function () { held = true; layerMenu(+row.dataset.i, x, y); }, 550);
    });
    // (lifting the finger after a hold mustn't also pick or rename the layer)
    var held = false;
    panel.addEventListener('click', function (e) { if (held) { held = false; e.stopPropagation(); e.preventDefault(); } }, true);
    ['pointerup', 'pointercancel', 'pointermove'].forEach(function (t) { panel.addEventListener(t, function (e) { if (t !== 'pointermove' || e.pointerType !== 'mouse') clearTimeout(holdTimer); }); });
    lmenu.addEventListener('click', function (e) {
      if (!e.target.closest('[data-lmenu]')) return;
      var L = layers[+lmenu.dataset.i]; lmenu.hidden = true; layerPanel(false);
      if (L) selectLayer(L);
    });
    document.addEventListener('pointerdown', function (e) { if (!lmenu.hidden && !e.target.closest('.paint-lmenu')) lmenu.hidden = true; }, true);
    function selectLayer(L) {
      if (adj) adjustDone(); if (textBox) commitText(); commitSelection();
      active = L; renderLayers();
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
      sel = { x: minX / R, y: minY / R, w: mw / R, h: mh / R, float: null, mask: m, maskData: md.data };
      selbar.hidden = false; drawSel();
    }
    // reordering: drag a layer by its grip
    panel.addEventListener('pointerdown', function (e) {
      var g = e.target.closest('.pl-grip'); if (!g) return;
      e.preventDefault(); e.stopPropagation();
      var row = g.closest('.pl-row'), list = row.parentNode, y0 = e.clientY;
      try { g.setPointerCapture(e.pointerId); } catch (x) {}
      row.classList.add('dragging');
      function mv(ev) {
        var dy = ev.clientY - y0, prev = row.previousElementSibling, next = row.nextElementSibling;
        if (next && dy > next.offsetHeight / 2) { list.insertBefore(next, row); y0 += next.offsetHeight + 2; }
        else if (prev && dy < -prev.offsetHeight / 2) { list.insertBefore(row, prev); y0 -= prev.offsetHeight + 2; }
        row.style.transform = 'translateY(' + (ev.clientY - y0) + 'px)';
      }
      function up() {
        g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
        row.classList.remove('dragging'); row.style.transform = '';
        // the list shows the top layer first
        var order = Array.prototype.map.call(list.children, function (r) { return layers[+r.dataset.i]; }).reverse();
        // (the white Background always stays at the bottom)
        var b0 = layers[0]; if (b0.bg && order[0] !== b0) { order.splice(order.indexOf(b0), 1); order.unshift(b0); }
        if (order.some(function (L, i) { return L !== layers[i]; })) { if (sel) commitSelection(); rememberLayers('Reorder Layers'); layers = order; mount(); }
        else renderLayers();
        layerPanel(true);
      }
      g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    });
    function layerAct(a) {
      if (sel) commitSelection();
      var i = layers.indexOf(active);
      if (a === 'add') {
        if (layers.length >= 10) { toast('Up to 10 layers'); return; }
        rememberLayers('New Layer');
        var L = makeLayer('Layer ' + (++count), false); layers.splice(i + 1, 0, L); active = L;
      } else if (a === 'delete') {
        // any layer can go, the Background and the last one too (then the
        // picture is see-through, and new layers count from 1 again)
        if (!active) return;
        rememberLayers('Delete Layer');
        layers.splice(i, 1);
        active = layers[Math.max(0, i - 1)] || null;
        if (!layers.length) count = 0;
      } else if (a === 'up' && active && i < layers.length - 1 && !active.bg) {
        rememberLayers('Move Layer Up'); layers.splice(i, 1); layers.splice(i + 1, 0, active);
      } else if (a === 'down' && active && i > (layers[0].bg ? 1 : 0)) {
        rememberLayers('Move Layer Down'); layers.splice(i, 1); layers.splice(i - 1, 0, active);
      } else return;
      mount(); layerPanel(true);
    }

    // ---- ADJUST: sliders that change the picked layer (only inside the
    // selection, if there is one); it's shown live and kept with DONE ----
    var ADJ = [['exposure', 'Exposure', -100], ['contrast', 'Contrast', -100], ['brilliance', 'Brilliance', -100], ['highlights', 'Highlights', -100],
      ['shadows', 'Shadows', -100], ['whites', 'Whites', -100], ['blacks', 'Blacks', -100], ['saturation', 'Saturation', -100], ['vibrance', 'Vibrance', -100],
      ['warmth', 'Warmth', -100], ['tint', 'Tint', -100], ['sharpen', 'Sharpen', 0], ['clarity', 'Clarity', -100], ['vignette', 'Vignette', -100], ['grain', 'Grain', 0], ['fade', 'Fade', 0]];
    var adjBox = document.createElement('div'), adj = null;
    adjBox.className = 'paint-adjust'; adjBox.hidden = true; adjBox.setAttribute('role', 'dialog'); adjBox.setAttribute('aria-label', 'Adjust');
    // (three tabs along the top: the sliders, LEVELS and CURVES; switching
    // tabs keeps what's been done, and DONE keeps the lot)
    var ADJ_TABS = [['adjust', 'Adjust'], ['levels', 'Levels'], ['curves', 'Curves']], adjTab = 'adjust';
    adjBox.innerHTML = '<div class="pa-title">Adjust <span>Current layer</span></div>' +
      '<div class="pa-tabs" role="tablist">' + ADJ_TABS.map(function (t) { return '<button type="button" role="tab" data-adj-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="pa-list" data-tab="adjust">' + ADJ.map(function (a) {
      return '<label class="pa-row" data-adj-row="' + a[0] + '"><span>' + a[1] + '</span><output>0</output>' +
        '<input type="range" min="' + a[2] + '" max="100" step="1" value="0" data-adj="' + a[0] + '"></label>';
    }).join('') + '</div>' +
      '<div class="pa-levels" data-tab="levels" hidden><canvas class="lv-hist" width="256" height="100"></canvas>' +
      '<div class="lv-track" data-lv="in"><i data-k="lb" class="lv-b"></i><i data-k="lg" class="lv-g"></i><i data-k="lw" class="lv-w"></i></div>' +
      '<div class="lv-nums"><output data-o="lb">0</output><output data-o="lg">1.00</output><output data-o="lw">255</output></div>' +
      '<div class="lv-sub">Output</div><div class="lv-grad"></div>' +
      '<div class="lv-track" data-lv="out"><i data-k="ob" class="lv-b"></i><i data-k="ow" class="lv-w"></i></div>' +
      '<div class="lv-nums"><output data-o="ob">0</output><output data-o="ow">255</output></div></div>' +
      '<div class="pa-curves" data-tab="curves" hidden><canvas class="cv-graph" aria-label="Curve"></canvas>' +
      '<div class="cv-help">Tap the line to add a point, drag to bend it. Double-tap a point, or drag it off, to remove it.</div></div>' +
      '<div class="pa-acts"><button type="button" data-adj-act="reset">Reset</button><button type="button" data-adj-act="cancel">Cancel</button><button type="button" data-adj-act="done">Done</button></div>';
    left.appendChild(adjBox);
    // LEVELS: black, mid (gamma x 100) and white in, black and white out
    var LV = { lb: 0, lg: 100, lw: 255, ob: 0, ow: 255 };
    function lv(k) { return adj && adj.v[k] != null ? adj.v[k] : LV[k]; }
    function adjChanged() { return !!adj && Object.keys(adj.v).some(function (k) { return k === 'curve' ? !!adj.v.curve : adj.v[k] !== (k in LV ? LV[k] : 0); }); }
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
    function adjHistogram() {
      var d = adj.src.data, m = adj.mask, h = new Float32Array(256), i;
      for (i = 0; i < d.length; i += 4) { if (!d[i + 3] || (m && !m[i + 3])) continue; h[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++; }
      var top = Array.prototype.slice.call(h).sort(function (a, b) { return a - b; })[250] || 1;
      for (i = 0; i < 256; i++) h[i] = Math.min(1, h[i] / top);
      return h;
    }
    function adjShowTab(t) {
      adjTab = t;
      Array.prototype.forEach.call(adjBox.querySelectorAll('[data-tab]'), function (b) { b.hidden = b.dataset.tab !== t; });
      Array.prototype.forEach.call(adjBox.querySelectorAll('[data-adj-tab]'), function (b) { b.setAttribute('aria-selected', b.dataset.adjTab === t ? 'true' : 'false'); });
      if (t === 'levels') { drawHist(); syncLevels(); } else if (t === 'curves') drawCurve();
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
      x.clearRect(0, 0, 256, 100); if (!adj) return;
      x.fillStyle = getComputedStyle(c).color;
      for (var i = 0; i < 256; i++) { var v = adj.hist[i] * 100; x.fillRect(i, 100 - v, 1, v); }
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
      if (adjBox.hidden || adjTab !== 'curves') return;
      var sz = cvSize(), c = cvG.getContext('2d'), W2 = sz.w - 2 * CP, H2 = sz.h - 2 * CP, P = curvePts(), cs = getComputedStyle(adjBox);
      var ink = cs.getPropertyValue('--text').trim() || '#1d1d1f', acc = cs.getPropertyValue('--accent').trim() || '#ff3b30';
      c.setTransform(R, 0, 0, R, 0, 0); c.clearRect(0, 0, sz.w, sz.h); c.translate(CP, CP); // (a margin, so the end points show whole)
      c.save(); c.globalAlpha = 0.06; c.fillStyle = ink; c.fillRect(0, 0, W2, H2); c.restore();
      // the layer's tones, faintly underneath
      if (adj && adj.hist) { c.save(); c.globalAlpha = 0.14; c.fillStyle = ink; for (var i = 0; i < 256; i++) { var v = adj.hist[i] * H2 * 0.9; c.fillRect(i / 256 * W2, H2 - v, W2 / 256 + 0.5, v); } c.restore(); }
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
    function adjustOpen() {
      if (adj) { adjustDone(); return; }
      if (!active) return;
      if (textBox) commitText(); openMenu(null); layerPanel(false); anchor();
      var cv = active.cv, src = active.ctx.getImageData(0, 0, cv.width, cv.height);
      adj = { L: active, src: src, out: new ImageData(new Uint8ClampedArray(src.data), cv.width, cv.height), mask: sel ? selPixels() : null, v: {}, blur: null, wide: null, queued: false };
      adj.hist = adjHistogram();
      Array.prototype.forEach.call(adjBox.querySelectorAll('input[data-adj]'), function (i) { i.value = 0; i.previousElementSibling.textContent = '0'; });
      adjBox.hidden = false; adjShowTab(adjTab); adjBox.style.top = Math.max(0, Math.min($('[data-act="adjust"]').offsetTop - 40, left.clientHeight - adjBox.offsetHeight)) + 'px';
      $('[data-act="adjust"]').setAttribute('aria-expanded', 'true');
    }
    function adjustClose() { adj = null; adjBox.hidden = true; $('[data-act="adjust"]').setAttribute('aria-expanded', 'false'); }
    function adjustPut(img) { var c = adj.L.ctx; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.putImageData(img, 0, 0); c.restore(); }
    function adjustDone() {
      if (!adj) return;
      if (adjChanged()) { if (adj.queued) adjustRender(); push({ L: adj.L, data: adj.src, label: 'Adjust' }); } else adjustPut(adj.src);
      adjustClose();
    }
    function adjustCancel() { if (!adj) return; adjustPut(adj.src); adjustClose(); }
    function adjustQueue() { if (adj.queued) return; adj.queued = true; requestAnimationFrame(function () { if (adj && adj.queued) adjustRender(); }); }
    // a soft copy of the layer (a box blur, one way then the other), for
    // sharpen (small) and clarity (wide)
    function boxBlur(d, w, h, r) {
      var a = new Float32Array(w * h * 3), b = new Float32Array(w * h * 3), x, y, c, n = 2 * r + 1;
      for (y = 0; y < h; y++) for (c = 0; c < 3; c++) {
        var s = 0, row = y * w;
        for (x = -r; x <= r; x++) s += d[(row + Math.min(w - 1, Math.max(0, x))) * 4 + c];
        for (x = 0; x < w; x++) { a[(row + x) * 3 + c] = s / n; s += d[(row + Math.min(w - 1, x + r + 1)) * 4 + c] - d[(row + Math.max(0, x - r)) * 4 + c]; }
      }
      for (x = 0; x < w; x++) for (c = 0; c < 3; c++) {
        var t = 0;
        for (y = -r; y <= r; y++) t += a[(Math.min(h - 1, Math.max(0, y)) * w + x) * 3 + c];
        for (y = 0; y < h; y++) { b[(y * w + x) * 3 + c] = t / n; t += a[(Math.min(h - 1, y + r + 1) * w + x) * 3 + c] - a[(Math.max(0, y - r) * w + x) * 3 + c]; }
      }
      return b;
    }
    function sstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
    function adjustRender() {
      adj.queued = false;
      var v = adj.v, val = function (k) { return (v[k] || 0) / 100; };
      var ex = Math.pow(2, val('exposure') * 1.5), co = val('contrast'), hi = val('highlights'), sh = val('shadows'), wh = val('whites'), bl = val('blacks'), fa = val('fade');
      // one curve for the tones, worked out once for all 256 levels
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
      var sat = 1 + val('saturation'), vib = val('vibrance'), wa = val('warmth') * 28, ti = val('tint') * 24;
      var shp = val('sharpen') * 1.6, cl = val('clarity') * 0.7, vg = val('vignette'), gr = val('grain') * 38;
      var W2 = adj.src.width, H2 = adj.src.height, s = adj.src.data, o = adj.out.data, m = adj.mask;
      if (shp && !adj.blur) adj.blur = boxBlur(s, W2, H2, 1);
      if (cl && !adj.wide) adj.wide = boxBlur(s, W2, H2, Math.max(6, Math.round(14 * R)));
      var cx = W2 / 2, cy = H2 / 2, rr = 1 / Math.hypot(cx, cy);
      for (var y = 0, k = 0; y < H2; y++) {
        for (var x2 = 0; x2 < W2; x2++, k += 4) {
          var a = s[k + 3];
          if (!a || (m && !m[k + 3])) { o[k] = s[k]; o[k + 1] = s[k + 1]; o[k + 2] = s[k + 2]; o[k + 3] = a; continue; }
          var r = s[k], g = s[k + 1], b = s[k + 2], j = (k >> 2) * 3;
          if (shp) { var bb = adj.blur; r += shp * (r - bb[j]); g += shp * (g - bb[j + 1]); b += shp * (b - bb[j + 2]); }
          if (cl) { var ww = adj.wide, lw = (s[k] - ww[j] + s[k + 1] - ww[j + 1] + s[k + 2] - ww[j + 2]) / 3; r += cl * lw; g += cl * lw; b += cl * lw; }
          r = lut[r < 0 ? 0 : r > 255 ? 255 : r | 0]; g = lut[g < 0 ? 0 : g > 255 ? 255 : g | 0]; b = lut[b < 0 ? 0 : b > 255 ? 255 : b | 0];
          var l = 0.299 * r + 0.587 * g + 0.114 * b;
          if (br) { var f = blut[l | 0]; r *= f; g *= f; b *= f; l *= f; }
          if (sat !== 1 || vib) {
            var mx = Math.max(r, g, b), mn = Math.min(r, g, b), ff = sat * (1 + vib * (1 - (mx - mn) / 255) * (vib > 0 ? 1 : 0.8));
            r = l + (r - l) * ff; g = l + (g - l) * ff; b = l + (b - l) * ff;
          }
          if (wa) { r += wa; b -= wa; }
          if (ti) { g -= ti; r += ti * 0.35; b += ti * 0.35; }
          if (vg) { var dv = sstep(0.3, 1.05, Math.hypot(x2 - cx, y - cy) * rr) * vg * 0.75, gv = vg > 0 ? 1 - dv : 1; r = vg > 0 ? r * gv : r - dv * (255 - r); g = vg > 0 ? g * gv : g - dv * (255 - g); b = vg > 0 ? b * gv : b - dv * (255 - b); }
          if (gr) { var n = ((Math.imul(k >> 2, 2654435761) >>> 0) % 1000 / 1000 - 0.5) * gr; r += n; g += n; b += n; }
          o[k] = r; o[k + 1] = g; o[k + 2] = b; o[k + 3] = a;
        }
      }
      adjustPut(adj.out);
    }
    adjBox.addEventListener('input', function (e) {
      var i = e.target.closest('[data-adj]'); if (!i || !adj) return;
      adj.v[i.dataset.adj] = +i.value; i.previousElementSibling.textContent = i.value; adjustQueue();
    });
    // double-click (or double-tap) a slider's name to put it back to 0
    adjBox.addEventListener('dblclick', function (e) {
      var row = e.target.closest('[data-adj-row]'); if (!row || !adj) return;
      var i = row.querySelector('input'); i.value = 0; i.previousElementSibling.textContent = '0'; adj.v[i.dataset.adj] = 0; adjustQueue();
    });

    // ---- the mouse's brush-size ring ----
    // (a ring on the screen, so it can follow an Apple Pencil, hovering or drawing)
    var ringEl = document.createElement('div'); ringEl.className = 'paint-ring'; ringEl.hidden = true; stage.appendChild(ringEl);
    function brushR() {
      if (st.tool === 'brush') { var b = { highlighter: Math.max(10, st.size * 2.2), watercolor: Math.max(4, st.size * 1.8), chalk: st.size * 1.3, oil: st.size * 1.25, pencil: Math.max(1, st.size * 0.38), marker: Math.max(3, st.size * 1.1), calligraphy: Math.max(4, st.size * 1.5), spray: Math.max(5, st.size * 1.6) * 2 }[st.brush]; if (b) return b / 2; }
      return /smudge|blur|tone/.test(st.tool) ? Math.max(4, st.size) : st.size / 2;
    }
    function showRing(p) {
      if (!p || !/brush|eraser|smudge|blur|tone/.test(st.tool) || spaceGrab) { ringEl.hidden = true; return; }
      var d = Math.max(2, brushR() * 2 * view.k);
      ringEl.hidden = false; ringEl.style.width = ringEl.style.height = d + 'px';
      ringEl.style.transform = 'translate(' + (view.x + p.x * view.k - d / 2) + 'px,' + (view.y + p.y * view.k - d / 2) + 'px)';
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
      var cfg = k === 'spray' ? null : brushCfg(k, st.size, '#000'), ext = k === 'spray' ? Math.max(5, st.size * 1.6) * 2 : cfg.len || cfg.w;
      var reach = k === 'spray' ? ext / 2 + 1 : cfg.reach, L = Math.max(ext * 2.2, 18 / view.k);
      // (as big as it really is, unless that wouldn't fit on the picture)
      var fit2 = Math.min(1, stage.clientWidth * 0.8 / ((L + reach * 2) * view.k), stage.clientHeight * 0.8 / ((reach * 2 + ext * 0.3) * view.k));
      var unit = view.k * fit2, wU = L + reach * 2, hU = reach * 2 + ext * 0.3, P = [];
      for (var i = 0; i <= 12; i++) { var t = i / 12; P.push({ x: reach + L * t, y: hU / 2 + Math.sin((t - 0.5) * Math.PI) * ext * 0.12 }); }
      drawPreview(prev.firstChild, k, st.size, k === 'eraser' ? '#ffffff' : st.color, P, wU, hU, unit);
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
      if (k === 'spray') {
        for (var i = 1; i < P.length; i++) {
          var a = P[i - 1], b = P[i], n = Math.max(1, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(2, size * 0.35)));
          for (var j = 0; j < n; j++) spray(x, { x: a.x + (b.x - a.x) * j / n, y: a.y + (b.y - a.y) * j / n }, size, color);
        }
      } else {
        var cfg = brushCfg(k, size, color);
        strokeOn(x, resample(P, cfg.step), cfg, { preview: true }, px, null, null);
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
    function brushSamples() {
      if (!menus.brush || menus.brush.el.hidden) return;
      // the samples use the current colour, unless it would vanish against the
      // menu (black in dark mode, white in light): then they use the menu's text
      // colour. Multiply only shows on a light menu, so a dark one draws flat.
      var ink = getComputedStyle(menus.brush.el).color, m = ink.match(/[\d.]+/g) || [0, 0, 0];
      var lumOf = function (r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
      var c = parseInt(st.color.slice(1), 16), textL = lumOf(+m[0], +m[1], +m[2]), dark = textL > 0.5;
      var col = Math.abs(lumOf(c >> 16 & 255, c >> 8 & 255, c & 255) - (dark ? 0.1 : 0.97)) < 0.22 ? '#' + [m[0], m[1], m[2]].map(function (v) { return (+v | 256).toString(16).slice(1); }).join('') : st.color;
      Array.prototype.forEach.call(menus.brush.el.querySelectorAll('[data-prev]'), function (cv) {
        var k = cv.dataset.prev, sz = k === 'spray' ? 3 : k === 'highlighter' ? 4 : 5, P = [];
        for (var i = 0; i <= 16; i++) { var t = i / 16; P.push({ x: 6 + 34 * t, y: 10 + Math.sin(t * Math.PI * 2) * 3.2 }); }
        drawPreview(cv, k, sz, col, P, 46, 20, 1, dark);
      });
    }

    // ---- pointers: drawing, moving the picture around, pinching to zoom ----
    var pointers = {}, ptype = {}, gesture = null, pan = null, spaceDown = false, spaceGrab = null, lastMouse = null;
    function screen(e) { var r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function cancelStroke() {
      if (!down) return;
      if (selMode === 'lasso') { if (lassoOn) { lasso.pop(); selMode = null; down = null; drawLasso(lassoHover); } else { down = null; cancelLasso(); } return; }
      if (selMode === 'scale') { refitMask(); selMode = null; down = null; selbar.classList.remove('away'); drawSel(); return; }
      clearInterval(sprayTimer);
      if (down.snap) { var e = undo.pop(); if (e) apply(e); buttons(); }
      down = null; octx.clearRect(0, 0, W, H); plainOv();
    }
    function begin(e) {
      var p = pos(e), t = st.tool, cq = cornerAt(p, e.pointerType !== 'mouse');
      if (t !== 'picker') need();
      if (cq) {
        lift();
        // the opposite corner stays put
        down = { id: e.pointerId, start: p, last: p, scale: { ax: cq.c[1] === 'w' ? sel.x + sel.w : sel.x, ay: cq.c[0] === 'n' ? sel.y + sel.h : sel.y, w: sel.w, h: sel.h, poly: sel.poly, sx: cq.c[1] === 'w' ? -1 : 1, sy: cq.c[0] === 'n' ? -1 : 1 } };
        selMode = 'scale'; selbar.classList.add('away'); return;
      }
      if (!selTool(t) && sel) anchor();
      if (t === 'picker') { setColor(sampleAt(p)); setTool('brush'); return; }
      // hold Alt (Option) with any drawing tool to pick up a colour instead
      if (e.altKey && !selTool(t) && t !== 'hand') { if (textBox) commitText(); setColor(sampleAt(p)); return; }
      if (t === 'text') { if (textBox) { commitText(); return; } startText(p); return; }
      if (selTool(t)) {
        if (t === 'lasso' && lassoOn) {
          // placing points: the first point closes it; anywhere else adds a
          // corner (and a drag from there draws a freehand piece)
          if (nearStart(p, e.pointerType !== 'mouse')) { finishLasso(); return; }
          p.corner = true; lasso.push(p); selMode = 'lasso';
          down = { id: e.pointerId, start: p, last: p, poly: true };
          drawLasso(null); return;
        }
        if (inSel(p)) { selMode = 'move'; selOff = { x: p.x - sel.x, y: p.y - sel.y }; lift(); }
        else if (t === 'wand') { commitSelection(); wandAt(p); selbar.hidden = !sel; drawSel(); return; }
        else if (t === 'lasso') { commitSelection(); selMode = 'lasso'; p.corner = true; lasso = [p]; }
        else { commitSelection(); selMode = 'new'; sel = { x: p.x, y: p.y, w: 0, h: 0, ax: p.x, ay: p.y, float: null }; }
        down = { id: e.pointerId, start: p, last: p };
        return;
      }
      if (t === 'fill') { remember(); fillAt(p); copies().forEach(function (m) { fillAt(mapPt(m, p)); }); useColor(); return; }
      remember();
      down = { id: e.pointerId, start: p, last: p, pen: e.pointerType === 'pen', snap: true };
      liveLook();
      if (sel && sel.mask && /smudge|blur|tone/.test(t)) down.keep = keepOutside();
      pts = [p];
      octx.clearRect(0, 0, W, H);
      if (t === 'smudge' || t === 'blur' || t === 'tone') { dabs(p, p, true); return; }
      if (t === 'gradient') return;
      if (t === 'eraser') { p.pr = smoothPr(e.pressure); eraseStart(); renderStroke(); return; }
      if (t === 'brush') {
        p.pr = smoothPr(e.pressure);
        if (kind() === 'spray') { both(octx, function () { spray(octx, p); }); maskOv(); sprayTimer = setInterval(function () { both(octx, function () { spray(octx, pts[pts.length - 1]); }); maskOv(); }, 35); }
        else renderStroke();
        return;
      }
      strokeStyle(octx); // line and shapes
    }
    function move(e) {
      var evs = e.getCoalescedEvents && e.getCoalescedEvents().length ? e.getCoalescedEvents() : [e];
      var p = pos(e), t = st.tool;
      if (selMode === 'scale') {
        // free to stretch; hold shift for a perfect square (let go of shift
        // and it's free again)
        var z = down.scale, nw = Math.max(4 / view.k, (p.x - z.ax) * z.sx), nh = Math.max(4 / view.k, (p.y - z.ay) * z.sy);
        if (e.shiftKey) nw = nh = Math.max(nw, nh);
        sel.w = nw; sel.h = nh; sel.x = z.sx > 0 ? z.ax : z.ax - nw; sel.y = z.sy > 0 ? z.ay : z.ay - nh;
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
        if (selMode === 'move') { sel.x = p.x - selOff.x; sel.y = p.y - selOff.y; }
        else { sel.x = Math.min(sel.ax, p.x); sel.y = Math.min(sel.ay, p.y); sel.w = Math.abs(p.x - sel.ax); sel.h = Math.abs(p.y - sel.ay); }
        drawSel(); return;
      }
      if (t === 'smudge' || t === 'blur' || t === 'tone') { evs.forEach(function (ev) { var q = pos(ev); dabs(down.last, q, false); down.last = q; }); return; }
      if (t === 'gradient') { gradient(down.start, p); return; }
      if (t === 'eraser' || (t === 'brush' && kind() !== 'spray')) {
        evs.forEach(function (ev) { var q = pos(ev), l = pts[pts.length - 1]; if (Math.hypot(q.x - l.x, q.y - l.y) > 0.6 / view.k) { q.pr = smoothPr(ev.pressure); pts.push(q); } });
        renderSoon(); return;
      }
      if (t === 'brush') {
        // (spray: droplets along the way, and more while it's held still)
        evs.forEach(function (ev) {
          var q = pos(ev), l = down.last, d = Math.hypot(q.x - l.x, q.y - l.y), n = Math.max(1, Math.floor(d / Math.max(2, st.size * 0.35)));
          for (var j = 1; j <= n; j++) { var m = { x: l.x + (q.x - l.x) * j / n, y: l.y + (q.y - l.y) * j / n }; both(octx, function () { spray(octx, m); }); }
          down.last = q; pts.push(q);
        });
        maskOv();
        return;
      }
      // line and shapes
      octx.clearRect(0, 0, W, H); strokeStyle(octx);
      both(octx, function () { shapePath(octx, down.start, p, e.shiftKey); });
      maskOv();
    }
    function end() {
      var t = st.tool;
      if (rsQueued) renderStroke(); // (the last frame, before it's laid down)
      clearInterval(sprayTimer);
      if (selMode === 'scale') { refitMask(); selMode = null; down = null; selbar.classList.remove('away'); drawSel(); autosave(); return; }
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
        selbar.hidden = !sel; selMode = null; down = null; drawSel(); autosave(); return;
      }
      down = null; autosave();
      if (t === 'smudge' || t === 'blur' || t === 'tone') { carry = []; return; }
      if (t === 'eraser') { octx.clearRect(0, 0, W, H); plainOv(); return; }
      if (t === 'gradient') { grainOver(); maskOv(); }
      var lk = strokeLook(); commit(lk.mode, lk.alpha);
      useColor();
    }

    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.paint-zoom, .paint-selbar, .paint-text, .paint-selx')) return;
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
      if (spaceGrab) { e.preventDefault(); return; } // (space is already holding something)
      if (anyMenu()) openMenu(null);
      if (!panel.hidden) layerPanel(false);
      if (adj) adjustDone();
      e.preventDefault();
      // palm rejection: while the Pencil is on the picture, a hand resting
      // on the screen is ignored (it used to count as a pinch: 800% at once)
      if (e.pointerType === 'touch' && Object.keys(ptype).some(function (id) { return ptype[id] === 'pen'; })) return;
      // the first finger (or a mouse or Pencil) starts afresh, forgetting any
      // touch whose lift went missing
      if (e.isPrimary) {
        if (e.pointerType === 'pen' && down && !down.pen) cancelStroke(); // (a palm got there first)
        pointers = {}; ptype = {}; gesture = null;
        if (pan) { pan = null; stage.classList.remove('panning'); }
      }
      try { stage.setPointerCapture(e.pointerId); } catch (x) {}
      if (e.pointerType === 'mouse') hideRing();
      pointers[e.pointerId] = screen(e); ptype[e.pointerId] = e.pointerType;
      var ids = Object.keys(pointers);
      // only two fingers pinch
      if (ids.length === 2 && ptype[ids[0]] === 'touch' && ptype[ids[1]] === 'touch') {
        // two fingers: pinch to zoom, drag to move the picture
        cancelStroke(); pan = null;
        var a = pointers[ids[0]], b = pointers[ids[1]];
        gesture = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: view.k, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, vx: view.x, vy: view.y };
        return;
      }
      if (ids.length > 1) return;
      if (st.tool === 'hand' || spaceDown || e.button === 1) { var s = screen(e); pan = { x: s.x, y: s.y, vx: view.x, vy: view.y }; stage.classList.add('panning'); return; }
      begin(e);
    });
    stage.addEventListener('pointermove', function (e) {
      if (pointers[e.pointerId]) pointers[e.pointerId] = screen(e);
      if (gesture) {
        var ids = Object.keys(pointers); if (ids.length < 2) return;
        var a = pointers[ids[0]], b = pointers[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        var k = Math.max(fitK * 0.25, Math.min(fitK * 10, gesture.k * d / gesture.d));
        var px = (gesture.mx - gesture.vx) / gesture.k, py = (gesture.my - gesture.vy) / gesture.k;
        view.k = k; view.x = mx - px * k; view.y = my - py * k; applyView();
        return;
      }
      if (pan) { var s = screen(e); view.x = pan.vx + s.x - pan.x; view.y = pan.vy + s.y - pan.y; applyView(); return; }
      if (down && e.pointerId === down.id) { move(e); if (down && down.pen) showRing(pos(e)); return; }
      if (lassoOn && !down) { lassoHover = pos(e); drawLasso(lassoHover); stage.classList.toggle('closing', nearStart(lassoHover, e.pointerType !== 'mouse')); return; }
      // an Apple Pencil hovering over the picture shows the brush size too
      if (e.pointerType === 'pen' && !down) { showRing(pos(e)); return; }
      if (e.pointerType !== 'mouse' || down) return;
      lastMouse = { s: screen(e), p: pos(e) };
      if (spaceDown && !spaceGrab) grabWithSpace();
      if (spaceGrab) { hideRing(); moveGrab(); return; }
      var cq = cornerAt(lastMouse.p, false); cornerCursor(cq);
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
      if (sel && !selMode && inSel(p)) { lift(); spaceGrab = { sel: true, ox: p.x - sel.x, oy: p.y - sel.y }; }
      else if ((L = paintAt(p))) {
        commitSelection();
        if (L !== active) { active = L; renderLayers(); }
        wandAt(p, true);
        if (!sel) return;
        sel.thing = true; lift();
        spaceGrab = { sel: true, thing: true, ox: p.x - sel.x, oy: p.y - sel.y }; drawSel();
      }
      else spaceGrab = { x: s.x, y: s.y, vx: view.x, vy: view.y };
      stage.classList.add('panning'); octx.clearRect(0, 0, W, H);
    }
    function moveGrab() {
      if (spaceGrab.sel) { sel.x = lastMouse.p.x - spaceGrab.ox; sel.y = lastMouse.p.y - spaceGrab.oy; drawSel(); }
      else { view.x = spaceGrab.vx + lastMouse.s.x - spaceGrab.x; view.y = spaceGrab.vy + lastMouse.s.y - spaceGrab.y; applyView(); }
    }
    function letGoOfSpace() {
      spaceDown = false; stage.classList.remove('space');
      if (!spaceGrab) return;
      if (spaceGrab.thing) commitSelection(); else if (spaceGrab.sel) autosave();
      spaceGrab = null; stage.classList.remove('panning');
    }
    window.addEventListener('blur', function () { letGoOfSpace(); stage.classList.remove('picking'); });
    function up(e) {
      delete pointers[e.pointerId]; delete ptype[e.pointerId];
      if (e.pointerType === 'pen') hideRing();
      if (gesture) { if (Object.keys(pointers).length < 2) gesture = null; return; }
      if (pan) { pan = null; stage.classList.remove('panning'); return; }
      if (down && e.pointerId === down.id) end();
    }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('dblclick', function () { if (lassoOn && st.tool === 'lasso' && !down) finishLasso(); });
    stage.addEventListener('contextmenu', function (e) { if (sel && !selMode && inSel(pos(e))) { e.preventDefault(); invertSel(); } });
    stage.addEventListener('pointercancel', function (e) { if (down && e.pointerId === down.id) cancelStroke(); up(e); });
    stage.addEventListener('pointerleave', function (e) { if (lassoOn && !down) { lassoHover = null; drawLasso(null); stage.classList.remove('closing'); } if (!down) hideRing(); if (!down && e.pointerType === 'mouse') { octx.clearRect(0, 0, W, H); if (!spaceGrab) lastMouse = null; } });
    // ctrl / cmd + scroll (and a trackpad pinch) zooms; scrolling moves a zoomed-in picture
    stage.addEventListener('wheel', function (e) {
      var s = screen(e);
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(view.k * Math.exp(-e.deltaY * 0.01), s.x, s.y); }
      else if (view.k > fillK * 1.01) { e.preventDefault(); view.x -= e.deltaX; view.y -= e.deltaY; applyView(); }
    }, { passive: false });
    var g0 = 1;
    stage.addEventListener('gesturestart', function (e) { e.preventDefault(); g0 = view.k; });
    stage.addEventListener('gesturechange', function (e) { e.preventDefault(); var s = screen(e); zoomAt(g0 * e.scale, s.x, s.y); });

    // ---- the buttons ----
    root.addEventListener('click', function (e) {
      var pk = e.target.closest('[data-pick]');
      if (pk && pk.dataset.pick === 'sym') { setSym(pk.dataset.val); openMenu(null); return; }
      if (pk && pk.dataset.pick === 'font' && textBox) { st.font = pk.dataset.val; loadFont(st.font); openMenu(null); afterTextChange(); return; }
      if (pk) { st[pk.dataset.pick] = pk.dataset.val; if (pk.dataset.pick === 'font') loadFont(st.font); openMenu(null); setTool({ brush: 'brush', shape: 'shape', font: 'text', tone: 'tone' }[pk.dataset.pick]); return; }
      if (e.target.closest('.paint-selx')) { commitSelection(); return; }
      var t = e.target.closest('button[data-tool]'); // (the picture carries data-tool too, for its cursor)
      if (t) {
        var tl = t.dataset.tool, reopen = menus[tl] && (st.tool !== tl || menus[tl].el.hidden);
        setTool(tl); openMenu(menus[tl] && reopen ? tl : null); return;
      }
      var s = e.target.closest('[data-color]'); if (s) { setColor(s.dataset.color); if (/eraser|picker|smudge|blur|tone|hand|select|lasso|wand/.test(st.tool)) setTool('brush'); return; }
      if (e.target.closest('.paint-swap')) { var c1 = st.color; setColor(st.color2); setColor2(c1); return; }
      if (e.target.closest('.paint-solid')) { st.solid = !st.solid; $('.paint-solid').setAttribute('aria-checked', st.solid ? 'true' : 'false'); if (st.tool !== 'shape') setTool('shape'); return; }
      if (e.target.closest('.paint-mirror')) { openMenu(menus.sym.el.hidden ? 'sym' : null); return; }
      var z = e.target.closest('[data-zoom]');
      if (z) { var cx = stage.clientWidth / 2, cy = stage.clientHeight / 2; if (z.dataset.zoom === 'fit') fit(); else zoomStep(z.dataset.zoom === 'in' ? 1 : -1); return; }
      var sa = e.target.closest('[data-sel]'); if (sa) { selAction(sa.dataset.sel); return; }
      var le = e.target.closest('[data-layer-eye]'); if (le) { var L = layers[+le.dataset.layerEye]; L.visible = !L.visible; mount(); layerPanel(true); autosave(); return; }
      var ln = e.target.closest('[data-layer]');
      if (ln) { var L2 = layers[+ln.dataset.layer]; if (L2 === active) { rename(+ln.dataset.layer); return; } if (sel) commitSelection(); active = L2; renderLayers(); layerPanel(true); return; }
      var la = e.target.closest('[data-layer-act]'); if (la) { layerAct(la.dataset.layerAct); return; }
      var sv = e.target.closest('[data-save]'); if (sv) { savePanel(false); save(sv.dataset.save); return; }
      var at2 = e.target.closest('[data-adj-tab]'); if (at2) { adjShowTab(at2.dataset.adjTab); return; }
      var aa = e.target.closest('[data-adj-act]');
      if (aa) { var w2 = aa.dataset.adjAct; if (w2 === 'done') adjustDone(); else if (w2 === 'cancel') adjustCancel(); else { adjustCancel(); adjustOpen(); } return; }
      var a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'layers') { openMenu(null); layerPanel(panel.hidden); }
      else if (a.dataset.act === 'adjust') adjustOpen();
      else if (a.dataset.act === 'undo') doUndo();
      else if (a.dataset.act === 'redo') doRedo();
      else if (a.dataset.act === 'clear') {
        if (sel) commitSelection();
        if (!active) return;
        remember('Clear'); active.ctx.clearRect(0, 0, W, H);
        if (active.bg) { active.ctx.fillStyle = '#fff'; active.ctx.fillRect(0, 0, W, H); }
      }
      else if (a.dataset.act === 'save') { openMenu(null); layerPanel(false); savePanel(saveMenu.hidden); }
    });
    document.addEventListener('pointerdown', function (e) {
      if (!document.contains(root)) return;
      if (anyMenu() && !e.target.closest('.paint-brushes, button[data-tool], .paint-mirror')) openMenu(null);
      if (!panel.hidden && !e.target.closest('.paint-layerpanel, [data-act="layers"]')) layerPanel(false);
      if (adj && !e.target.closest('.paint-adjust, [data-act="adjust"], .paint-zoom')) adjustDone();
      if (!saveMenu.hidden && !e.target.closest('.paint-savemenu, [data-act="save"]')) savePanel(false);
    }, true);
    colorIn.addEventListener('input', function () { setColor(colorIn.value); if (/eraser|picker|smudge|blur|tone|hand|select|lasso|wand/.test(st.tool)) setTool('brush'); });
    color2In.addEventListener('input', function () { setColor2(color2In.value); });
    sizeIn.addEventListener('input', function () { setSize(+sizeIn.value); if (textBox) placeTextBox(); preview(); });
    alphaIn.addEventListener('input', function () { st.alpha = +alphaIn.value / 100; alphaIn.nextElementSibling.textContent = alphaIn.value; if (textBox) styleTextBox(); else preview(); });

    // ---- DRAG A COLOUR onto the picture: it drops in and spreads out to
    // fill the area it lands on (like the fill tool). Any swatch, a recent
    // colour, or the two main colours at the top (a tap on those still
    // opens the colour picker) ----
    var blob = null;
    right.addEventListener('pointerdown', function (e) {
      var sw = e.target.closest('.paint-swatches button, .paint-recent button, .paint-current, .paint-second');
      if (!sw || (e.pointerType === 'mouse' && e.button !== 0)) return;
      var start = { x: e.clientX, y: e.clientY, c: sw.dataset.color || sw.querySelector('input').value, el: sw, id: e.pointerId, on: false };
      try { sw.setPointerCapture(e.pointerId); } catch (x) {}
      function mv(ev) {
        if (!start.on) {
          if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
          start.on = true;
          blob = document.createElement('div'); blob.className = 'paint-blob'; blob.style.background = start.c;
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
        if (!start.on) return;
        // (it was dragged, so the tap that follows isn't a colour pick)
        var stop = function (c) { c.stopPropagation(); c.preventDefault(); };
        // (a main colour that was dragged doesn't also open the colour picker)
        var fi = sw.querySelector && sw.querySelector('input'); if (fi) fi.blur();
        sw.addEventListener('click', stop, true); setTimeout(function () { sw.removeEventListener('click', stop, true); }, 0);
        setTimeout(function () { var b = blob; blob = null; if (b) b.remove(); }, ev.type === 'pointerup' ? 260 : 0);
        var over = ev.type === 'pointerup' && document.elementFromPoint(ev.clientX, ev.clientY);
        if (blob) { blob.classList.add(over && over.closest('.paint-stage') ? 'plop' : 'gone'); }
        if (over && over.closest('.paint-stage') && !over.closest('.paint-zoom, .paint-selbar, .paint-selx')) {
          var r = stage.getBoundingClientRect();
          plopFill({ x: (ev.clientX - r.left - view.x) / view.k, y: (ev.clientY - r.top - view.y) / view.k }, start.c);
        }
      }
      sw.addEventListener('pointermove', mv); sw.addEventListener('pointerup', done); sw.addEventListener('pointercancel', done);
    });
    function plopFill(p, color) {
      if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) return;
      if (adj) adjustDone(); if (textBox) commitText(); need(); anchor();
      var L = active, before = document.createElement('canvas'); before.width = L.cv.width; before.height = L.cv.height;
      before.getContext('2d').drawImage(L.cv, 0, 0);
      remember('Fill');
      var keep = st.color; st.color = color; fillAt(p); st.color = keep;
      var after = document.createElement('canvas'); after.width = L.cv.width; after.height = L.cv.height;
      after.getContext('2d').drawImage(L.cv, 0, 0);
      // the new colour spreads out from where it landed (slow, fast, slow)
      var far = Math.max(Math.hypot(p.x, p.y), Math.hypot(W - p.x, p.y), Math.hypot(p.x, H - p.y), Math.hypot(W - p.x, H - p.y));
      var t0 = performance.now(), dur = 520 + Math.min(380, far * 0.4), c = L.ctx;
      function frame(now) {
        var t = Math.min(1, (now - t0) / dur), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, L.cv.width, L.cv.height); c.drawImage(before, 0, 0); c.restore();
        c.save(); c.beginPath(); c.arc(p.x, p.y, Math.max(0.5, far * e), 0, Math.PI * 2); c.clip();
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, L.cv.width, L.cv.height); c.drawImage(after, 0, 0); c.restore();
        if (t < 1) requestAnimationFrame(frame); else autosave();
      }
      requestAnimationFrame(frame);
    }
    $('.paint-open input').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      addPicture(f, 'open'); e.target.value = '';
    });
    var saveMenu = document.createElement('div');
    saveMenu.className = 'paint-savemenu'; saveMenu.hidden = true; saveMenu.setAttribute('role', 'menu');
    saveMenu.innerHTML = '<button type="button" role="menuitem" data-save="png">PNG<small>Keeps see-through parts</small></button>' +
      '<button type="button" role="menuitem" data-save="jpeg">JPEG<small>Smaller file</small></button>' +
      '<button type="button" role="menuitem" data-save="share">Share\u2026<small>Messages, Photos, Mail\u2026</small></button>';
    right.appendChild(saveMenu);
    function savePanel(open) {
      saveMenu.hidden = !open;
      var b = $('[data-act="save"]'); b.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) saveMenu.style.top = Math.max(0, Math.min(b.offsetTop + b.offsetHeight - saveMenu.offsetHeight, right.clientHeight - saveMenu.offsetHeight)) + 'px';
    }
    function save(type) {
      if (type === 'share') { share(); return; }
      if (adj) adjustDone();
      if (textBox) commitText();
      if (sel) commitSelection();
      flatBlob(type, function (blob) { if (blob) download(blob, type === 'jpeg' ? 'jpg' : 'png'); });
    }

    // ---- the drawing is kept in the browser (layers and all), so it's
    // still there after leaving the page or closing the tab ----
    var saveTimer = 0, restoring = true;
    function db(fn) {
      try {
        var r = indexedDB.open('paint-alternative', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('s'); };
        r.onsuccess = function () { try { fn(r.result.transaction('s', 'readwrite').objectStore('s')); } catch (x) {} };
      } catch (x) {}
    }
    function autosave() { thumbsSoon(); if (restoring) return; clearTimeout(saveTimer); saveTimer = setTimeout(storeNow, 1000); }
    function storeNow() {
      clearTimeout(saveTimer);
      if (restoring || !window.Promise) return;
      var info = { R: R, pw: ov.width, ph: ov.height, active: layers.indexOf(active), count: count };
      Promise.all(layers.map(function (L) {
        var cv = L.cv;
        if (sel && sel.float && L === active) {
          // (anything lifted and still being moved is kept where it is now)
          cv = document.createElement('canvas'); cv.width = L.cv.width; cv.height = L.cv.height;
          var x = cv.getContext('2d'); x.drawImage(L.cv, 0, 0); base(x); x.drawImage(sel.float, sel.x, sel.y, sel.w, sel.h);
        }
        return new Promise(function (ok) { cv.toBlob(function (b) { ok({ name: L.name, visible: L.visible, bg: L.bg, opacity: L.opacity, blend: L.blend, blob: b }); }, 'image/png'); });
      })).then(function (list) {
        if (list.some(function (l) { return !l.blob; })) return;
        info.layers = list;
        db(function (os) { os.put(info, 'picture'); });
      });
    }
    function restore() {
      var done = function () { restoring = false; };
      if (!window.indexedDB || !window.createImageBitmap) { done(); return; }
      setTimeout(done, 3000); // (never wait on it for long)
      db(function (os) {
        var g = os.get('picture');
        g.onerror = done;
        g.onsuccess = function () {
          var d = g.result;
          if (!d || !d.layers || undo.length || !restoring) { done(); return; }
          Promise.all(d.layers.map(function (l) { return createImageBitmap(l.blob); })).then(function (ims) {
            if (undo.length || !restoring) { done(); return; } // (they've started drawing already)
            // (a picture of a chosen size comes back at that size; an older
            // one, at the size of the screen)
            if (d.pw && d.ph) setDoc(d.pw, d.ph);
            layers = d.layers.map(function (l, i) {
              var L = makeLayer(l.name, l.bg != null ? l.bg : i === 0); L.visible = l.visible !== false;
              L.opacity = l.opacity != null ? l.opacity : 1; L.blend = l.blend || 'normal';
              if (d.pw) L.ctx.drawImage(ims[i], 0, 0, ims[i].width / R, ims[i].height / R);
              else L.ctx.drawImage(ims[i], 0, 0, ims[i].width / d.R, ims[i].height / d.R);
              return L;
            });
            active = layers[Math.max(0, Math.min(layers.length - 1, d.active | 0))] || null;
            count = layers.length ? Math.max(count, d.count | 0) : 0;
            mount(); if (d.pw) fit(); done();
          }, done);
        };
      });
    }
    document.addEventListener('pageswap:start', function away() { document.removeEventListener('pageswap:start', away); if (saveTimer) storeNow(); });
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
      if (adj) adjustDone(); if (textBox) commitText(); if (sel) commitSelection();
      openMenu(null); layerPanel(false); savePanel(false);
    }

    // ---- the header: New, Image, History, Share, Shortcuts (and Install) ----
    var header = document.querySelector('.site-header');
    function hb(name) { return header && header.querySelector('[data-hb="' + name + '"]'); }
    // a list that drops down from a header button
    function placeDrop(el, btn) {
      var r = btn.getBoundingClientRect();
      el.style.top = Math.round(r.bottom + 8) + 'px';
      el.style.right = Math.round(Math.max(8, document.documentElement.clientWidth - r.right - 4)) + 'px';
    }
    function dropdown(cls) { var d = document.createElement('div'); d.className = 'paint-drop ' + cls; d.hidden = true; document.body.appendChild(d); return d; }
    function closeDrops() {
      var any = false;
      [imgMenu, histBox].forEach(function (d) { if (!d.hidden) { d.hidden = true; any = true; } });
      hb('image').setAttribute('aria-expanded', 'false'); hb('history').setAttribute('aria-expanded', 'false');
      return any;
    }

    // ---- sheets: a panel in the middle of the screen over a dimmed page ----
    var sheetEl = null;
    function openSheet(cls, html) {
      closeSheet(); closeDrops();
      sheetEl = document.createElement('div'); sheetEl.className = 'pa-sheet-wrap';
      sheetEl.innerHTML = '<div class="pa-sheet ' + cls + '" role="dialog" aria-modal="true">' + html + '</div>';
      document.body.appendChild(sheetEl);
      sheetEl.addEventListener('pointerdown', function (e) { if (e.target === sheetEl) closeSheet(); });
      void sheetEl.offsetWidth; sheetEl.classList.add('in');
      return sheetEl.firstChild;
    }
    function closeSheet() { if (!sheetEl) return false; var s = sheetEl; sheetEl = null; s.classList.remove('in'); setTimeout(function () { s.remove(); }, 220); return true; }

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
        '<button type="button" class="ns-swap" aria-label="Swap width and height" title="Swap width and height"><svg viewBox="0 0 24 24"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg></button>' +
        '<label>Height<input type="number" inputmode="numeric" min="16" max="' + MAXPX + '" data-ns="h"></label><span class="ns-unit">pixels</span></div>' +
        '<div class="ns-row ns-row-bg"><span class="ns-lab">Background</span><div class="pa-tabs ns-bg" role="tablist"><button type="button" role="tab" data-bg="white" aria-selected="true">White</button><button type="button" role="tab" data-bg="clear" aria-selected="false">Transparent</button></div></div>' +
        '<div class="ns-note">This replaces the current picture. You can undo it.</div><div class="ns-err" hidden></div>' +
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
      rememberDoc('New Picture');
      setDoc(pw, ph);
      count = 1;
      layers = [makeLayer(white ? 'Background' : 'Layer 1', white)]; active = layers[0];
      mount(); fit(); autosave();
    }

    // ---- IMAGE: rotate, flip or crop the whole picture (every layer) ----
    var imgMenu = dropdown('paint-imgmenu');
    imgMenu.setAttribute('role', 'menu');
    function imageMenu(open) {
      if (!open) { imgMenu.hidden = true; hb('image').setAttribute('aria-expanded', 'false'); return; }
      closeDrops();
      var ico = function (d) { return '<svg viewBox="0 0 24 24">' + d + '</svg>'; };
      imgMenu.innerHTML =
        '<button type="button" role="menuitem" data-img="left">' + ico('<path d="M9 4.5L5.5 8 9 11.5"/><path d="M5.5 8H14a5 5 0 0 1 5 5v6"/>') + 'Rotate Left</button>' +
        '<button type="button" role="menuitem" data-img="right">' + ico('<path d="M15 4.5L18.5 8 15 11.5"/><path d="M18.5 8H10a5 5 0 0 0-5 5v6"/>') + 'Rotate Right</button>' +
        '<button type="button" role="menuitem" data-img="fliph">' + ico('<path d="M12 3.5v17" stroke-dasharray="2 2"/><path d="M9.5 7L4 17h5.5z"/><path d="M14.5 7L20 17h-5.5z"/>') + 'Flip Horizontal</button>' +
        '<button type="button" role="menuitem" data-img="flipv">' + ico('<path d="M3.5 12h17" stroke-dasharray="2 2"/><path d="M7 9.5L17 4v5.5z"/><path d="M7 14.5L17 20v-5.5z"/>') + 'Flip Vertical</button>' +
        '<button type="button" role="menuitem" data-img="crop"' + (sel ? '' : ' disabled') + '>' + ico('<path d="M6.5 3v14.5H21"/><path d="M3 6.5h14.5V21"/>') + 'Crop to Selection</button>' +
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
        var N = makeLayer(L.name, L.bg); N.visible = L.visible; N.opacity = L.opacity; N.blend = L.blend;
        N.ctx.save(); N.ctx.setTransform(1, 0, 0, 1, 0, 0); draw(N.ctx, L.cv); N.ctx.restore();
        return N;
      });
      active = layers[act] || null;
      mount(); fit(); autosave();
    }
    function imageAct(a) {
      imageMenu(false);
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
        if (layers.length >= 10) { toast('Up to 10 layers: delete one to add a picture'); return; }
        finishWork();
        rememberLayers(how === 'open' ? 'Open Picture' : 'Add Picture');
        // (opened: it fills the picture; pasted or dropped: its own size,
        // made smaller if it wouldn't fit)
        var nw = im.naturalWidth / R, nh = im.naturalHeight / R, k = how === 'open' ? Math.min(W / nw, H / nh) : Math.min(1, W / nw, H / nh);
        var w = nw * k, h = nh * k, x = (W - w) / 2, y = (H - h) / 2, L = makeLayer(how === 'open' ? 'Picture' : 'Pasted', false);
        L.ctx.drawImage(im, x, y, w, h);
        layers.splice(active ? layers.indexOf(active) + 1 : layers.length, 0, L); active = L; mount();
        if (how !== 'open') {
          // picked up, ready to move into place or size with its corners
          setTool('select'); sel = { x: x, y: y, w: w, h: h, float: null }; selbar.hidden = false; drawSel();
          toast('Added on a new layer: drag it into place');
        }
        autosave();
      };
      im.onerror = function () { URL.revokeObjectURL(url); toast('That picture couldn’t be opened'); };
      im.src = url;
    }
    document.addEventListener('paste', function (e) {
      if (!document.contains(root) || sheetEl) return;
      var t = e.target; if (t && (t.isContentEditable || /input|textarea/i.test(t.tagName || ''))) return;
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) if (items[i].kind === 'file' && /^image\//.test(items[i].type)) { e.preventDefault(); addPicture(items[i].getAsFile(), 'paste'); return; }
    });
    function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
    document.addEventListener('dragover', function (e) { if (!hasFiles(e) || !document.contains(root)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; stage.classList.add('drop'); });
    document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) stage.classList.remove('drop'); });
    document.addEventListener('drop', function (e) {
      if (!hasFiles(e) || !document.contains(root)) return;
      e.preventDefault(); stage.classList.remove('drop');
      var f = Array.prototype.filter.call(e.dataTransfer.files || [], function (x) { return /^image\//.test(x.type); })[0];
      if (f) addPicture(f, 'drop'); else toast('That isn’t a picture');
    });

    // ---- LAYERS: each one's opacity and blend mode ----
    var opPending = false;
    panel.addEventListener('input', function (e) {
      var o = e.target.closest('[data-layer-op]'); if (!o || !active) return;
      if (!opPending) { rememberLayers('Layer Opacity'); opPending = true; }
      active.opacity = +o.value / 100; styleLayer(active); o.nextElementSibling.textContent = o.value + '%'; autosave();
    });
    panel.addEventListener('change', function (e) {
      if (e.target.closest('[data-layer-op]')) { opPending = false; return; }
      var b = e.target.closest('[data-layer-blend]'); if (!b || !active) return;
      rememberLayers('Blend Mode'); active.blend = b.value; styleLayer(active); autosave();
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
      closeDrops(); histBox.hidden = false; hb('history').setAttribute('aria-expanded', 'true'); renderHistory(); placeDrop(histBox, hb('history'));
    }
    histBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-hist]'); if (!b) return;
      var n = +b.dataset.hist, total = undo.length + redo.length;
      if (adj) adjustDone(); if (textBox) commitText(); if (sel && sel.float) commitSelection();
      n = Math.min(n, undo.length + redo.length); if (undo.length + redo.length !== total) n = undo.length; // (finishing something made a new step)
      while (undo.length > n) doUndo();
      while (undo.length < n && redo.length) doRedo();
    });

    // ---- KEYBOARD SHORTCUTS: press ? for the list ----
    var MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent), CMD = MAC ? '⌘' : 'Ctrl ';
    function helpSheet() {
      var k = function (keys) { return keys.split(' ').map(function (x) { return '<kbd>' + x + '</kbd>'; }).join(''); };
      var group = function (title, rows) { return '<div class="hs-group"><div class="hs-h">' + title + '</div>' + rows.map(function (r) { return '<div class="hs-row"><span>' + r[0] + '</span><span>' + k(r[1]) + '</span></div>'; }).join('') + '</div>'; };
      openSheet('hs', '<div class="pa-sheet-title">Keyboard Shortcuts</div><div class="hs-cols">' +
        group('Tools', [['Brush', 'B'], ['Eraser', 'E'], ['Fill', 'F'], ['Gradient', 'G'], ['Colour picker', 'I'], ['Line', 'L'], ['Shapes', 'R'], ['Text', 'T'], ['Smudge', 'S'], ['Blur', 'U'], ['Light & dark', 'O'], ['Select', 'M'], ['Cutout', 'Q'], ['Magic wand', 'W'], ['Move around', 'H']]) +
        group('Edit', [['Undo', CMD + 'Z'], ['Redo', (MAC ? '⇧⌘' : 'Ctrl ') + (MAC ? 'Z' : 'Y')], ['Select all', CMD + 'A'], ['Paste a picture', CMD + 'V'], ['Delete selection', MAC ? '⌫' : 'Del'], ['Finish selection', MAC ? '↩' : 'Enter'], ['Nudge selection', '← ↑ → ↓'], ['Nudge by 10', '⇧ ←'], ['Finish cutout', MAC ? '↩' : 'Enter'], ['Cutout: last point off', MAC ? '⌫' : 'Backspace'], ['Close / cancel', 'Esc']]) +
        group('Brush & colour', [['Smaller brush', '['], ['Bigger brush', ']'], ['Swap colours', 'X'], ['Pick a colour', MAC ? '⌥ click' : 'Alt click'], ['Adjust', 'A']]) +
        group('View', [['Zoom in', '+'], ['Zoom out', '−'], ['Fit', '0'], ['Grab & move', 'Space drag'], ['Zoom', CMD + 'scroll'], ['These shortcuts', '?']]) +
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
      if (adj) adjustDone(); if (textBox) commitText(); if (sel) commitSelection();
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
      var b = e.target.closest('[data-hb]'); if (!b) return;
      var w = b.dataset.hb;
      if (w === 'new') newSheet();
      else if (w === 'image') imageMenu(imgMenu.hidden);
      else if (w === 'history') historyPanel(histBox.hidden);
      else if (w === 'share') { closeDrops(); share(); }
      else if (w === 'help') helpSheet();
      else if (w === 'install' && installEv) { installEv.prompt(); installEv.userChoice.then(function () { installEv = null; hb('install').hidden = true; }); }
    });
    document.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.paint-drop, [data-hb="image"], [data-hb="history"]')) closeDrops();
    }, true);

    setColor(st.color); setColor2(st.color2); setTool('brush'); buttons(); fit(); restore();
    // (the paper textures are made ahead, when the page is idle, so the first
    // stroke with pencil, chalk or watercolour doesn't stutter while they're made)
    (window.requestIdleCallback || function (f) { setTimeout(f, 600); })(function () { ['pencil', 'chalk', 'cloud', 'grain'].forEach(texture); });
    app = {
      root: root, fit: fit,
      key: function (e) {
        var k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
        if (sheetEl) { if (k === 'escape') closeSheet(); return; }
        if (k === 'escape' && closeDrops()) return;
        if (e.target && (e.target.isContentEditable || (/input|textarea|select/i.test(e.target.tagName || '') && e.target.type !== 'range'))) return;
        if (mod && k === 'z' && lassoOn && !e.shiftKey) { e.preventDefault(); if (lasso.length > 1) { lasso.pop(); drawLasso(lassoHover); } else cancelLasso(); return; } // (while placing points: the last one)
        if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
        if (mod && k === 'y') { e.preventDefault(); doRedo(); return; }
        if (mod && k === 'a') { e.preventDefault(); selectAll(); return; }
        if (k === 'alt') { stage.classList.add('picking'); e.preventDefault(); return; }
        // the arrow keys nudge a selection (a pixel at a time; 10 with shift)
        if (sel && !selMode && !mod && /^arrow/.test(k) && e.target.type !== 'range') {
          e.preventDefault(); lift();
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
        if (k === 'escape' && !lmenu.hidden) { lmenu.hidden = true; return; }
        if (k === 'escape' && adj) { adjustCancel(); return; }
        if (k === 'escape') { openMenu(null); layerPanel(false); if (sel) commitSelection(); return; }
        if ((k === 'delete' || k === 'backspace') && sel) { e.preventDefault(); selAction('delete'); return; }
        if (k === 'enter' && sel) { selAction('done'); return; }
        var map = { b: 'brush', e: 'eraser', s: 'smudge', u: 'blur', l: 'line', r: 'shape', f: 'fill', g: 'gradient', t: 'text', m: 'select', q: 'lasso', w: 'wand', i: 'picker', h: 'hand', o: 'tone' };
        if (map[k]) setTool(map[k]);
        else if (k === 'a') adjustOpen();
        else if (k === 'x') { var c1 = st.color; setColor(st.color2); setColor2(c1); }
        else if (k === '[') setSize(st.size - (st.size > 10 ? 4 : 1));
        else if (k === ']') setSize(st.size + (st.size >= 10 ? 4 : 1));
        else if (k === '+' || k === '=') zoomStep(1);
        else if (k === '-') zoomStep(-1);
        else if (k === '0') fit();
        else if (e.key === '?') helpSheet();
      },
      keyup: function (e) { if (e.key === ' ') letGoOfSpace(); else if (e.key === 'Alt') stage.classList.remove('picking'); }
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
