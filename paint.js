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
    text: 'Text', select: 'Move', lasso: 'Move', wand: 'Move', picker: 'Edit', hand: 'Edit', tone: 'Light & Dark' };
  var app = null;

  function init(root) {
    if (root.dataset.ready) return;
    root.dataset.ready = '1';
    // (some controls live in the top bar, outside the drawing area)
    var $ = function (q) { return root.querySelector(q) || document.querySelector('.site-header ' + q); };
    var stage = $('.paint-stage'), world = $('.paint-world'), stack = $('.paint-layers'), guide = $('.paint-guide');
    var ov = $('.paint-over'), octx = ov.getContext('2d');
    var colorDot = $('.paint-current span'), color2Dot = $('.paint-second span');
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
      var b = e.target.closest && e.target.closest('[data-tip]');
      if (!b || e.buttons || !b.closest('.paint, .site-header, .paint-focusout')) { hideTip(); return; }
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
    var st = { tool: 'brush', brush: 'round', shape: 'rect', font: FONTS[0][0], color: '#141414', color2: '#ffffff',
      size: 6, alpha: +alphaIn.value / 100, solid: false, sym: 'off', tone: 'dodge' };
    var W = 0, H = 0, R = 1, view = { k: 1, x: 0, y: 0, r: 0 }, fitK = 1, fillK = 1;
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
      // (alphaLock: paint only goes where the layer already has some; clip:
      // it shows only where the layer below it has paint)
      return { cv: c, ctx: x, name: name, visible: true, bg: !!white, opacity: 1, blend: 'normal', alphaLock: false, clip: false, view: null };
    }
    // CLIPPING MASKS: a clipped layer keeps all its own paint, and is shown
    // through the layer under it (the first one below that isn't clipped
    // itself), on a copy made for showing it: so unclipping brings it all back
    function clipBase(L) {
      var i = layers.indexOf(L);
      if (!L || !L.clip || i <= 0) return null;
      for (var j = i - 1; j >= 0; j--) if (!layers[j].clip) return layers[j];
      return null;
    }
    function viewOf(L) {
      var b = clipBase(L); if (!b) return L.cv;
      var v = L.view;
      if (!v || v.width !== L.cv.width || v.height !== L.cv.height) { v = L.view = document.createElement('canvas'); v.width = L.cv.width; v.height = L.cv.height; }
      v.style.width = W + 'px'; v.style.height = H + 'px';
      var x = v.getContext('2d'); x.globalCompositeOperation = 'copy'; x.drawImage(L.cv, 0, 0);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(b.cv, 0, 0); x.globalCompositeOperation = 'source-over';
      return v;
    }
    // (made again straight after any change, so it never lags a frame behind)
    function viewsSoon() { layers.forEach(function (L) { if (clipBase(L)) viewOf(L); }); }
    function mount() {
      stack.innerHTML = '';
      layers.forEach(function (L) { var el = viewOf(L); styleLayer(L); stack.appendChild(el); });
      renderLayers();
    }
    // a layer's see-through-ness and blend mode show as it's drawn on screen
    // (and are worked in the same way when the picture is saved); a clipped
    // layer is hidden with the layer it's clipped to
    function shownVisible(L) { var b = clipBase(L); return L.visible && (!b || b.visible); }
    function styleLayer(L) {
      var el = clipBase(L) ? L.view || viewOf(L) : L.cv;
      el.style.visibility = shownVisible(L) ? '' : 'hidden';
      el.style.opacity = L.opacity < 1 ? L.opacity : '';
      el.style.mixBlendMode = L.blend !== 'normal' ? L.blend : '';
    }
    // every visible layer, laid one on another (with its opacity and blend
    // mode), onto a canvas: for saving, sharing and picking colours
    function flattenInto(x, sx, sy, sw, sh, dw, dh) {
      layers.forEach(function (L) {
        if (!shownVisible(L)) return;
        var src = viewOf(L);
        x.save(); x.globalAlpha = L.opacity; if (L.blend !== 'normal') x.globalCompositeOperation = L.blend;
        if (sw == null) x.drawImage(src, 0, 0); else x.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh);
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
      world.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px)' + (view.r ? ' rotate(' + view.r + 'rad)' : '') + ' scale(' + view.k + ')';
      zoomVal.textContent = Math.round(view.k / fitK * 100) + '%';
      if (textBox) placeTextBox();
      placeSelX(); placeSymHandles();
    }
    // the zoom buttons sit above SAVE; on a phone (no room there) they sit
    // in the picture's corner instead
    // (the zoom buttons sit in the picture's bottom right corner)
    function phoneLayout() { return window.matchMedia('(max-width: 560px)').matches; }
    function placeZoom() {}
    function fit() {
      placeZoom();
      var sw = stage.clientWidth, sh = stage.clientHeight;
      if (!sw || !sh) return;
      // ("100%" leaves a small margin round the picture, except on a phone,
      // where every bit of width counts; fillK just fills the space)
      // (the first step in, which just fills the space, reads 110%)
      fillK = Math.min(sw / W, sh / H) * 0.99;
      fitK = phoneLayout() ? fillK : fillK / 1.1;
      view.k = fitK; view.r = 0; view.x = (sw - W * fitK) / 2; view.y = (sh - H * fitK) / 2;
      applyView();
    }
    function zoomAt(k, cx, cy) {
      k = Math.max(fitK * 0.25, Math.min(fitK * 10, k));
      view.x = cx - (cx - view.x) * k / view.k; view.y = cy - (cy - view.y) * k / view.k; view.k = k;
      applyView();
    }
    // a panel that drops down under a button in the top bar, lined up with
    // its right edge (or wherever it was last dragged to)
    function dropUnder(el, btn) {
      if (!btn) return;
      var r = btn.getBoundingClientRect(), vw = document.documentElement.clientWidth;
      el.style.top = Math.round(r.bottom + 8) + 'px';
      el.style.left = Math.round(Math.max(8, Math.min(vw - el.offsetWidth - 8, r.right - el.offsetWidth + 4))) + 'px';
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
    function keepOnScreen(el) {
      if (el.hidden) return;
      var r = el.getBoundingClientRect(), o = panelOffset(el), vw = document.documentElement.clientWidth, vh = window.innerHeight, dx = 0, dy = 0;
      if (r.right > vw - 6) dx = vw - 6 - r.right; if (r.left + dx < 6) dx = 6 - r.left;
      if (r.bottom > vh - 6) dy = vh - 6 - r.bottom; if (r.top + dy < 6) dy = 6 - r.top;
      if (dx || dy) el.style.translate = (o.x + dx) + 'px ' + (o.y + dy) + 'px';
    }
    function draggable(el, handle, key) {
      try { var saved = JSON.parse(localStorage.getItem('paint-pos-' + key)); if (saved) el.style.translate = saved[0] + 'px ' + saved[1] + 'px'; } catch (x) {}
      el.addEventListener('pointerdown', function (e) {
        var h = e.target.closest(handle);
        if (!h || !el.contains(h) || e.button || e.target.closest('button, input, select, textarea, a, [data-nodrag]')) return;
        e.preventDefault(); e.stopPropagation();
        var o = panelOffset(el), sx = e.clientX, sy = e.clientY;
        el.classList.add('dragging'); hideTip();
        try { h.setPointerCapture(e.pointerId); } catch (x) {}
        function mv(ev) { el.style.translate = (o.x + ev.clientX - sx) + 'px ' + (o.y + ev.clientY - sy) + 'px'; }
        function up() {
          h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
          el.classList.remove('dragging'); keepOnScreen(el);
          var q = panelOffset(el); try { localStorage.setItem('paint-pos-' + key, JSON.stringify([q.x, q.y])); } catch (x) {}
        }
        h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
      });
      el.addEventListener('dblclick', function (e) {
        if (!e.target.closest(handle) || e.target.closest('button, input, select')) return;
        el.style.translate = ''; try { localStorage.removeItem('paint-pos-' + key); } catch (x) {}
      });
    }
    // the right-hand panel's sections fold away by their titles (and stay so)
    Array.prototype.forEach.call(right.querySelectorAll('.pr-sec'), function (sec) {
      var hd = sec.querySelector('.pr-head'), k = 'paint-sec-' + sec.dataset.sec;
      var shut = function (on) { sec.classList.toggle('closed', on); hd.setAttribute('aria-expanded', on ? 'false' : 'true'); };
      try { shut(localStorage.getItem(k) === 'closed'); } catch (x) {}
      hd.addEventListener('click', function () { var on = !sec.classList.contains('closed'); shut(on); try { localStorage.setItem(k, on ? 'closed' : 'open'); } catch (x) {} });
    });

    // ---- colours ----
    var sw = $('.paint-swatches');
    SWATCHES.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.style.background = c; b.dataset.color = c; b.setAttribute('aria-label', 'Colour ' + c);
      sw.appendChild(b);
    });
    var recentBox = $('.paint-recent');
    function setColor(c) {
      st.color = c; colorDot.style.background = c; pcSync('main'); if (textBox) styleTextBox(); brushSamples();
      Array.prototype.forEach.call(root.querySelectorAll('.paint-swatches button, .paint-recent button'), function (b) { b.classList.toggle('on', b.dataset.color.toLowerCase() === c.toLowerCase()); });
    }
    function setColor2(c) { st.color2 = c; color2Dot.style.background = c; if (textBox) styleTextBox(); pcSync('second'); }
    // the colours used lately: the last four as quick swatches here, and
    // more in the colour picker (kept for next time)
    function pushRecent(c) {
      c = c.toLowerCase();
      recent = [c].concat(recent.filter(function (x) { return x !== c; })).slice(0, 12);
      storeIt('paint-recent-colours', recent); showRecent();
    }
    function showRecent() {
      recentBox.innerHTML = recent.slice(0, 4).map(function (x) { return '<button type="button" data-color="' + x + '" style="background:' + x + '" aria-label="Recent colour ' + x + '"></button>'; }).join('');
      setColor(st.color);
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
    pc.innerHTML =
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
        '<button type="button" class="pc-icon" data-pc-act="new" title="New palette" aria-label="New palette"><svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg></button>' +
        '<button type="button" class="pc-icon" data-pc-act="photo" title="New palette from a photo" aria-label="New palette from a photo"><svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="13" rx="2"/><circle cx="9.5" cy="11" r="1.6"/><path d="M5 17.5l4.5-4 3 2.5 3-3 3.5 3.5"/></svg></button>' +
        '<button type="button" class="pc-icon" data-pc-act="delete" title="Delete this palette" aria-label="Delete this palette"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg></button></div>' +
      '<div class="pc-grid pc-swatches"></div>' +
      '<p class="pc-note"></p>';
    right.appendChild(pc);
    draggable(pc, '.pc-grab', 'colour');
    var pcDisc = pc.querySelector('.pc-disc canvas'), pcHK = pc.querySelector('.pc-hk'), pcSK = pc.querySelector('.pc-sk');
    var DISC = 212, RING = 20, SQ = Math.floor((DISC / 2 - RING - 7) * Math.SQRT2), SQ0 = (DISC - SQ) / 2;
    var ringImg = null;
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
        (p.ready ? '' : '<button type="button" class="pc-add" data-pc-act="add" title="Add this colour to the palette" aria-label="Add this colour to the palette"><svg viewBox="0 0 24 24"><path d="M12 7v10M7 12h10"/></svg></button>'));
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
      if (pcWhich === 'main') { setColor(hex); if (/eraser|picker|smudge|blur|tone|hand|select|lasso|wand/.test(st.tool)) setTool('brush'); }
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
    function placePicker() {
      if (phoneLayout()) { pc.style.top = ''; return; }
      var b = $('.paint-pair'); pc.style.top = Math.max(0, Math.min(b.offsetTop, right.clientHeight - pc.offsetHeight)) + 'px';
    }
    function picker(which) {
      if (which && (pc.hidden || which !== pcWhich)) {
        if (!pc.hidden) pcDone();
        if (anyMenu()) openMenu(null); if (!panel.hidden) layerPanel(false); if (adj) adjustDone();
        pcWhich = which; pc.hidden = false; pcLoad(); placePicker(); keepOnScreen(pc);
      } else if (!pc.hidden) { pcDone(); pc.hidden = true; }
      pairOpen();
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
    function setSize(v, fromSlider) {
      st.size = Math.max(1, Math.min(MAX_SIZE, Math.round(v)));
      if (!fromSlider) sizeIn.value = posOf(st.size);
      sizeIn.nextElementSibling.textContent = st.size;
    }

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
    // (under the list: radial's segments and mirror, and putting the guide back)
    menus.sym.el.insertAdjacentHTML('beforeend',
      '<div class="pm-opts">' +
        '<div class="pm-row psym-for-radial"><span>Segments</span><span class="p-step"><button type="button" data-symn="-1" aria-label="Fewer segments">&#8722;</button><output>6</output><button type="button" data-symn="1" aria-label="More segments">+</button></span></div>' +
        '<button type="button" class="psym-mirror psym-for-radial" role="menuitemcheckbox" aria-checked="false"><i class="psym psym-mirror-i"></i><span>Mirror</span></button>' +
        '<button type="button" class="psym-reset"><i class="psym psym-reset-i"></i><span>Centre the guide</span></button>' +
      '</div>');
    function symOpts() {
      var m = menus.sym.el;
      Array.prototype.forEach.call(m.querySelectorAll('.psym-for-radial'), function (e) { e.hidden = st.sym !== 'radial'; });
      m.querySelector('.pm-opts').hidden = st.sym === 'off';
      m.querySelector('.pm-opts output').textContent = symN;
      m.querySelector('.psym-mirror').setAttribute('aria-checked', symMirror ? 'true' : 'false');
      m.querySelector('[data-symn="-1"]').disabled = symN <= 2; m.querySelector('[data-symn="1"]').disabled = symN >= 16;
    }
    menus.sym.el.addEventListener('click', function (e) {
      var n = e.target.closest('[data-symn]');
      if (n) { symN = Math.max(2, Math.min(16, symN + +n.dataset.symn)); }
      else if (e.target.closest('.psym-mirror')) symMirror = !symMirror;
      else if (e.target.closest('.psym-reset')) { symC = { x: 0.5, y: 0.5 }; symA = 0; }
      else return;
      e.stopPropagation(); drawGuide(); symOpts();
    });
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
          Array.prototype.forEach.call(m.el.querySelectorAll('button[data-val], .paint-solid'), function (b) { b.setAttribute('aria-checked', (b.dataset.val == null ? st.solid : b.dataset.val === st[m.key]) ? 'true' : 'false'); });
          if (t === 'sym') symOpts();
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
      stage.dataset.tool = t; stage.classList.remove('can-move');
      octx.clearRect(0, 0, W, H);
      ctxRender();
    }

    // ---- undo / redo: snapshots of one layer, or of the layer list ----
    function snapOf(L) { return L.ctx.getImageData(0, 0, L.cv.width, L.cv.height); }
    // (each step has a name, for the HISTORY list; fewer steps are kept for
    // a big picture, so they don't fill up the memory)
    var trimmed = false;
    function limit() { return Math.max(4, Math.min(LIMIT, Math.floor(160e6 / (ov.width * ov.height * 4)))); }
    // (what could be redone is kept with the step, so a stroke that's called
    // off at once, like the first finger of a two-finger tap, gives it back)
    function push(e) { if (!e.label) e.label = TOOL_NAMES[st.tool] || 'Edit'; e.redoWas = redo; undo.push(e); while (undo.length > limit()) { undo.shift(); trimmed = true; } redo = []; buttons(); autosave(); }
    function remember(label) { push({ L: active, data: snapOf(active), bg: active.bg, label: label }); }
    function props() { return layers.map(function (L) { return { v: L.visible, o: L.opacity, b: L.blend, a: L.alphaLock, c: L.clip }; }); }
    function rememberLayers(label) { push({ list: layers.slice(), active: active, props: props(), label: label || 'Layers' }); }
    function docState() { return { doc: true, pw: ov.width, ph: ov.height, list: layers.slice(), active: active, props: props() }; }
    function rememberDoc(label) { var e = docState(); e.label = label; push(e); }
    function capture(e) {
      if (e.parts) return { parts: e.parts.map(capture), label: e.label }; // (a step that changed a layer and the list, like Merge Down)
      var c = e.doc ? docState() : e.L ? { L: e.L, data: snapOf(e.L), bg: e.L.bg } : { list: layers.slice(), active: active, props: props() };
      c.label = e.label; return c;
    }
    function apply(e) {
      if (e.parts) { e.parts.forEach(apply); viewsSoon(); return; }
      if (e.L) { if (e.bg != null) e.L.bg = e.bg; e.L.ctx.save(); e.L.ctx.setTransform(1, 0, 0, 1, 0, 0); e.L.ctx.putImageData(e.data, 0, 0); e.L.ctx.restore(); renderLayers(); }
      else {
        if (e.doc) { clearSel(); if (e.pw !== ov.width || e.ph !== ov.height) setDoc(e.pw, e.ph); }
        layers = e.list.slice(); layers.forEach(function (L, i) { var q = e.props[i]; L.visible = q.v; L.opacity = q.o; L.blend = q.b; L.alphaLock = !!q.a; L.clip = !!q.c; });
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
      else if (k === 'feather') { c.w = Math.max(3, sz) * 1.35; c.blur = Math.max(3, sz) * 0.85; }
      if (c.len) { c.step = Math.max(0.5, c.thick * 0.4); c.reach = c.len / 2 + c.thick + 1; }
      else c.reach = c.w * 0.62 + (c.blur || 0) * 3 + 2;
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
    function widthFn(base, tin, tout, total) {
      var memo = [], full = Math.min(1, total / (base * 2.5));
      return function (s, tap) {
        if (!tap && memo[s.i] != null) return memo[s.i];
        var f = s.pr == null ? 1 : 0.15 + 0.85 * Math.min(1, s.pr * 1.25);
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
        var wr = widthFn(cfg.w, cfg.tin, cfg.tout, total);
        rep(c, function (x) { ribbon(x, S, wr, box); });
      } else if (k === 'pencil') {
        // graphite: a fine line that tapers, catching on the paper's tooth;
        // pressing harder (or a bigger size) fills more of the grain in
        var wp = widthFn(cfg.w, cfg.tin, cfg.tout, total);
        rep(c, function (x) { ribbon(x, S, wp, box); });
        // (the grain only where it's being redrawn: rubbing it over the whole sheet would cost a lot)
        if (rects) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); clipTo2(c, rects); }
        rubOut(c, 'pencil', Math.max(0.3, 0.62 - cfg.size * 0.006), px);
        if (rects) c.restore();
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
      if (st.sym === 'off') { guide.hidden = true; placeSymHandles(); return; }
      var L = Math.hypot(W, H) * 2, c = symCentre(), lines = [], i;
      var line = function (a, ray) { lines.push([ray ? c.x : c.x - Math.cos(a) * L, ray ? c.y : c.y - Math.sin(a) * L, c.x + Math.cos(a) * L, c.y + Math.sin(a) * L]); };
      if (st.sym === 'x' || st.sym === 'xy') line(symA - Math.PI / 2);
      if (st.sym === 'y' || st.sym === 'xy') line(symA);
      if (st.sym === 'radial') for (i = 0; i < symN; i++) line(symA - Math.PI / 2 + i * 2 * Math.PI / symN, true);
      guide.hidden = false;
      guide.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + lines.map(function (l) { return '<line x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2] + '" y2="' + l[3] + '"/>'; }).join('') + '</svg>';
      placeSymHandles();
    }
    var TURN_R = 64; // (how far the turning handle sits from the centre, on the screen)
    function placeSymHandles() {
      if (!symDot) return; // (not made yet)
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
        el.classList.add('held'); stage.classList.add('guiding');
        function mv(ev) { var r = stage.getBoundingClientRect(); fn(ev, ev.clientX - r.left, ev.clientY - r.top); drawGuide(); }
        function up() { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.classList.remove('held'); stage.classList.remove('guiding'); }
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
    function setSym(v) {
      st.sym = v; drawGuide(); symOpts();
      var b = $('.paint-mirror'); b.setAttribute('aria-pressed', v !== 'off' ? 'true' : 'false');
    }
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
      var b = which || (st.tool === 'brush' ? st.brush : '');
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
    // FILL: the area of (about) the same colour as the spot tapped. The soft
    // edge where it meets a line is filled too: each pixel there is part
    // line, part the old colour, and the old colour's share of it becomes the
    // new colour (it's worked out from the line's colour nearby), so the fill
    // runs right up under the line with no pale ring left round it.
    function fillAt(p) {
      var x0 = Math.floor(p.x * R), y0 = Math.floor(p.y * R), w = active.cv.width, h = active.cv.height;
      if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return;
      var img = active.ctx.getImageData(0, 0, w, h), d = img.data, i0 = (y0 * w + x0) * 4;
      var tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], ta = d[i0 + 3];
      var c = parseInt(st.color.slice(1), 16), fr = c >> 16 & 255, fg = c >> 8 & 255, fb = c & 255, a = st.alpha;
      var seen = new Uint8Array(w * h), stack2 = [x0, y0], mp = sel ? selPixels() : null;
      if (mp && !mp[i0 + 3]) return;
      if (active.alphaLock && !ta) return; // (a locked layer can't be painted where it's empty)
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
      var tp = toScreen(textAt); textBox.style.left = tp.x + 'px'; textBox.style.top = tp.y + 'px';
      textBox.style.fontSize = tx.size * k + 'px';
      textBox.style.letterSpacing = tx.spacing / 1000 * tx.size * k + 'px';
      textBox.style.lineHeight = tx.lh;
      textBox.style.transformOrigin = '0 0';
      textBox.style.transform = (view.r ? 'rotate(' + view.r + 'rad) ' : '') + (tx.align === 'center' ? 'translateX(-50%)' : tx.align === 'right' ? 'translateX(-100%)' : '');
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
      c.save(); clipTo(c); if (active.alphaLock) c.globalCompositeOperation = 'source-atop';
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
      keepOnScreen(tpEl);
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
    // (a lasso selection keeps its outline, relative to its box; a whole
    // layer's can be picked up anywhere in its box, gaps and all)
    // TURNING A SELECTION: its box (x, y, w, h) is turned by sel.rot round
    // its middle. These take a point between the picture and the box's own
    // (unturned) frame, and lay what's picked up down, turned.
    function selMid() { return { x: sel.x + sel.w / 2, y: sel.y + sel.h / 2 }; }
    function selLocal(p) { var r = sel.rot || 0; if (!r) return p; var m = selMid(), dx = p.x - m.x, dy = p.y - m.y, c = Math.cos(r), s = Math.sin(r); return { x: m.x + c * dx + s * dy, y: m.y - s * dx + c * dy }; }
    function selWorld(p) { var r = sel.rot || 0; if (!r) return p; var m = selMid(), dx = p.x - m.x, dy = p.y - m.y, c = Math.cos(r), s = Math.sin(r); return { x: m.x + c * dx - s * dy, y: m.y + s * dx + c * dy }; }
    function putFloat(c) {
      var r = sel.rot || 0;
      if (!r) { c.drawImage(sel.float, sel.x, sel.y, sel.w, sel.h); return; }
      var m = selMid(); c.save(); c.translate(m.x, m.y); c.rotate(r); c.drawImage(sel.float, -sel.w / 2, -sel.h / 2, sel.w, sel.h); c.restore();
    }
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
    function maskOv() {
      if (selTool(st.tool)) return;
      if (sel) {
        octx.save(); octx.globalCompositeOperation = 'destination-in';
        if (sel.mask) octx.drawImage(sel.mask, sel.x, sel.y, sel.w, sel.h); else { selPath(octx); octx.fillStyle = '#000'; octx.fill(); }
        octx.restore();
      }
      // (on an alpha-locked layer the stroke shows only where there's paint
      // already; on a clipped one, only where the layer it's clipped to has paint)
      var b = active && clipBase(active);
      if (st.tool !== 'eraser' && active && (active.alphaLock || b)) {
        octx.save(); octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalCompositeOperation = 'destination-in';
        if (active.alphaLock) octx.drawImage(active.cv, 0, 0);
        if (b) octx.drawImage(b.cv, 0, 0);
        octx.restore();
      }
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
      if (!sel || !sel.float) return;
      putFloat(active.ctx); sel.float = null;
      if (sel.rot && !keep) { clearSel(); autosave(); return; }
      drawSel(); autosave();
    }
    function clearSel() { sel = null; selbar.hidden = true; selx.hidden = true; sctx.clearRect(0, 0, W, H); cornerCursor(null); stage.classList.remove('can-move', 'moving'); }
    // the little X on the selection's top left corner closes it
    function placeSelX() {
      if (!sel || (selMode && selMode !== 'scale' && selMode !== 'rotate') || sel.thing) { selx.hidden = true; return; }
      selx.hidden = false;
      var sc = toScreen(selWorld({ x: sel.x, y: sel.y })), x = sc.x, y = sc.y;
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
      if (sel.float) putFloat(sctx);
      if (sel.thing) return;
      // (the outline and handles are drawn in the box's own frame, turned with it)
      var turned = !!sel.rot;
      if (turned) { var m0 = selMid(); sctx.save(); sctx.translate(m0.x, m0.y); sctx.rotate(sel.rot); sctx.translate(-m0.x, -m0.y); }
      // a wand selection shows as a light blue wash over what's picked
      if (sel.mask) { sctx.save(); sctx.globalAlpha = 0.35; sctx.drawImage(sel.tint || (sel.tint = tinted(sel.mask, '#2f7fd6')), sel.x, sel.y, sel.w, sel.h); sctx.restore(); }
      sctx.save(); sctx.lineWidth = 1 / view.k;
      var edge = function () { if (sel.poly) outline(sctx, sel.x, sel.y, 1); else { sctx.beginPath(); sctx.rect(sel.x, sel.y, sel.w, sel.h); } sctx.stroke(); };
      sctx.setLineDash([5 / view.k, 4 / view.k]); sctx.strokeStyle = '#000'; edge();
      sctx.lineDashOffset = 4.5 / view.k; sctx.strokeStyle = '#fff'; edge();
      // little squares on the corners: drag one to make it bigger or smaller
      if (selMode !== 'new') {
        var hs = 7 / view.k; sctx.setLineDash([]); sctx.fillStyle = '#fff'; sctx.strokeStyle = '#141414';
        localCorners().forEach(function (q) { sctx.fillRect(q.x - hs / 2, q.y - hs / 2, hs, hs); sctx.strokeRect(q.x - hs / 2, q.y - hs / 2, hs, hs); });
        // (and a round handle above the top: drag it to turn the selection)
        var tp = { x: sel.x + sel.w / 2, y: sel.y }, rh = rotHandleLocal();
        sctx.beginPath(); sctx.moveTo(tp.x, tp.y); sctx.lineTo(rh.x, rh.y + 5 / view.k); sctx.stroke();
        sctx.beginPath(); sctx.arc(rh.x, rh.y, 5 / view.k, 0, Math.PI * 2); sctx.fill(); sctx.stroke();
      }
      sctx.restore();
      if (turned) sctx.restore();
    }
    function rotHandleLocal() { return { x: sel.x + sel.w / 2, y: sel.y - 26 / view.k }; }
    function localCorners() { return [{ x: sel.x, y: sel.y, c: 'nw' }, { x: sel.x + sel.w, y: sel.y, c: 'ne' }, { x: sel.x, y: sel.y + sel.h, c: 'sw' }, { x: sel.x + sel.w, y: sel.y + sel.h, c: 'se' }]; }
    function corners() {
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
      for (var i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 100 ? 255 : 0;
      x.putImageData(d, 0, 0);
      sel.mask = m; sel.maskData = d.data; sel.tint = null;
    }
    function commitSelection() {
      if (!sel) return;
      if (sel.float) { putFloat(active.ctx); autosave(); }
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
      if (a === 'rot90') { lift(); var r9 = (sel.rot || 0) + Math.PI / 2; sel.rot = Math.abs(Math.atan2(Math.sin(r9), Math.cos(r9))) < 1e-6 ? 0 : Math.atan2(Math.sin(r9), Math.cos(r9)); drawSel(); return; }
      if (a === 'layer') {
        // CUT TO LAYER: the selection comes out onto a layer of its own
        lift();
        rememberLayers('Cut to Layer');
        var L = makeLayer('Cutout', false); putFloat(L.ctx);
        layers.splice(layers.indexOf(active) + 1, 0, L); active = L;
        clearSel(); mount(); return;
      }
      if (a === 'delete') { if (!sel.float) lift(); sel.float = null; clearSel(); autosave(); return; }
      if (a === 'copy') {
        // COPY: the selection is copied onto a new layer just above, picked
        // up and ready to move (the original stays where it is)
        if (layers.length >= 10) return;
        var f;
        if (sel.rot && sel.float) {
          // (a turned one: what's picked up is put down, and a copy of it carries on)
          f = document.createElement('canvas'); f.width = sel.float.width; f.height = sel.float.height; f.getContext('2d').drawImage(sel.float, 0, 0);
          anchor(true);
        } else { anchor(); lift(true); f = sel.float; sel.float = null; undo.pop(); }
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
    root.appendChild(panel);
    draggable(panel, '.pl-title', 'layers');
    renderLayers();
    function renderLayers() {
      if (!panel) return;
      var rows = layers.slice().reverse().map(function (L) {
        var i = layers.indexOf(L);
        return '<div class="pl-row' + (L === active ? ' on' : '') + (clipBase(L) ? ' clipped' : '') + '" data-i="' + i + '">' +
          '<button type="button" class="pl-eye" data-layer-eye="' + i + '" aria-label="' + (L.visible ? 'Hide' : 'Show') + ' ' + L.name + '" aria-pressed="' + (!L.visible) + '">' +
            '<svg viewBox="0 0 24 24">' + (L.visible ? '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>' : '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.6 3.3M6.4 7.6A15 15 0 0 0 2.5 12s3.5 6 9.5 6a9 9 0 0 0 4.1-1"/>') + '</svg></button>' +
          '<canvas class="pl-thumb" data-thumb="' + i + '" aria-hidden="true"></canvas>' +
          '<button type="button" class="pl-name" data-layer="' + i + '" title="Tap again to rename"><span>' + L.name.replace(/[<&]/g, function (ch) { return ch === '<' ? '&lt;' : '&amp;'; }) + '</span>' +
            (L.alphaLock ? '<svg class="pl-tag" viewBox="0 0 24 24" aria-label="Alpha lock on"><rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/></svg>' : '') + '</button>' +
          '<button type="button" class="pl-more" data-layer-more="' + i + '" aria-haspopup="menu" aria-label="Options for ' + L.name.replace(/"/g, '&quot;') + '" title="Layer options"><svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg></button>' +
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
      if (open) dropUnder(panel, $('[data-act="layers"]'));
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
      inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); });
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
    function layerMenu(i, x, y, fromRight) {
      var L = layers[i]; if (!L) return;
      var n = layers.length, item = function (k, label, opt) {
        opt = opt || {};
        return '<button type="button" role="' + (opt.check != null ? 'menuitemcheckbox' : 'menuitem') + '" data-lm="' + k + '"' + (opt.check != null ? ' aria-checked="' + opt.check + '"' : '') + (opt.off ? ' disabled' : '') + (opt.danger ? ' class="lm-danger"' : '') + '>' + label + '</button>';
      };
      var lowest = layers[0] && layers[0].bg ? 1 : 0;
      lmenu.innerHTML =
        item('select', 'Select') + item('rename', 'Rename') + item('duplicate', 'Duplicate', { off: n >= 10 }) +
        item('merge', 'Merge Down', { off: i === 0 || !L.visible }) +
        '<hr>' + item('lock', 'Alpha Lock', { check: L.alphaLock }) + item('clip', 'Clipping Mask', { check: L.clip, off: i === 0 }) +
        '<hr>' + item('hide', L.visible ? 'Hide' : 'Show') + item('up', 'Move Up', { off: i === n - 1 || L.bg }) + item('down', 'Move Down', { off: i <= lowest }) +
        '<hr>' + item('delete', 'Delete', { danger: true });
      lmenu.dataset.i = i; lmenu.hidden = false;
      var left = fromRight ? x - lmenu.offsetWidth : x;
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
      var r = m.getBoundingClientRect(); layerMenu(i, r.right, r.bottom + 4, true);
    });
    lmenu.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lm]'); if (!b || b.disabled) return;
      var L = layers[+lmenu.dataset.i]; lmenu.hidden = true;
      if (L) layerOption(b.dataset.lm, L);
    });
    function layerOption(a, L) {
      if (a === 'select') { layerPanel(false); selectLayer(L); return; }
      if (adj) adjustDone(); if (textBox) commitText(); if (sel) commitSelection();
      var i = layers.indexOf(L);
      if (L !== active) { active = L; renderLayers(); }
      if (a === 'rename') { layerPanel(true); rename(i); return; }
      if (a === 'up' || a === 'down' || a === 'delete') { layerAct(a); return; }
      if (a === 'hide') { L.visible = !L.visible; }
      else if (a === 'lock') { rememberLayers(L.alphaLock ? 'Alpha Lock Off' : 'Alpha Lock'); L.alphaLock = !L.alphaLock; }
      else if (a === 'clip') { rememberLayers(L.clip ? 'Release Clipping Mask' : 'Clipping Mask'); L.clip = !L.clip; }
      else if (a === 'duplicate') {
        if (layers.length >= 10) { toast('Up to 10 layers'); return; }
        rememberLayers('Duplicate Layer');
        var D = makeLayer(L.name + ' copy', false);
        D.ctx.save(); D.ctx.setTransform(1, 0, 0, 1, 0, 0); D.ctx.drawImage(L.cv, 0, 0); D.ctx.restore();
        D.visible = L.visible; D.opacity = L.opacity; D.blend = L.blend; D.alphaLock = L.alphaLock; D.clip = L.clip;
        layers.splice(i + 1, 0, D); active = D;
      } else if (a === 'merge') {
        // (it's laid onto the one below as it looks: its opacity, blend mode
        // and clipping; one undo puts both back)
        var B = layers[i - 1]; if (!B || !L.visible) return;
        push({ parts: [{ L: B, data: snapOf(B), bg: B.bg }, { list: layers.slice(), active: active, props: props() }], label: 'Merge Down' });
        var src = viewOf(L), c = B.ctx;
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
      // (the Select tool comes up, so a drag moves it rather than painting)
      if (!selTool(st.tool)) setTool('select');
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
    draggable(adjBox, '.pa-title', 'adjust');
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
      if (st.tool === 'brush') { var b = { highlighter: Math.max(10, st.size * 2.2), pencil: Math.max(1, st.size * 0.38), marker: Math.max(3, st.size * 1.1), calligraphy: Math.max(4, st.size * 1.5), spray: Math.max(5, st.size * 1.6) * 2 }[st.brush]; if (b) return b / 2; }
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
      var cfg = k === 'spray' ? null : brushCfg(k, st.size, '#000');
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
      if (k === 'spray') {
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
    function brushSamples(box) {
      if (!box) {
        if (menus.brush && !menus.brush.el.hidden) brushSamples(menus.brush.el);
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
        var k = cv.dataset.prev, sz = k === 'spray' ? 3 : k === 'highlighter' ? 4 : 5, P = [];
        for (var i = 0; i <= 16; i++) { var t = i / 16; P.push({ x: 6 + 34 * t, y: 10 + Math.sin(t * Math.PI * 2) * 3.2 }); }
        drawPreview(cv, k, sz, col, P, 46, 20, 1, dark);
      });
    }

    // ---- pointers: drawing, moving the picture around, pinching to zoom ----
    var fingerTap = null, firstDown = 0, tapLater = null;
    var pointers = {}, ptype = {}, gesture = null, pan = null, spaceDown = false, spaceGrab = null, lastMouse = null;
    function screen(e) { var r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function cancelStroke() {
      clearTimeout(holdTimerS);
      if (!down) return;
      stage.classList.remove('moving');
      if (selMode === 'lasso') { if (lassoOn) { lasso.pop(); selMode = null; down = null; drawLasso(lassoHover); } else { down = null; cancelLasso(); } return; }
      if (selMode === 'scale' || selMode === 'rotate') { refitMask(); selMode = null; down = null; selbar.classList.remove('away'); drawSel(); return; }
      clearInterval(sprayTimer);
      if (down.snap) { var e = undo.pop(); if (e) { apply(e); if (e.redoWas) redo = e.redoWas; } buttons(); }
      down = null; octx.clearRect(0, 0, W, H); plainOv();
    }
    function begin(e) {
      var p = pos(e), t = st.tool, cq = cornerAt(p, e.pointerType !== 'mouse');
      if (t !== 'picker') need();
      if (cq && cq.c === 'rot') {
        lift(); var m = selMid();
        down = { id: e.pointerId, start: p, last: p, turn: { a0: Math.atan2(p.y - m.y, p.x - m.x), r0: sel.rot || 0 } };
        selMode = 'rotate'; selbar.classList.add('away'); return;
      }
      if (cq) {
        lift();
        // the opposite corner stays put (where it is on the picture, however the box is turned)
        var A = selWorld({ x: cq.c[1] === 'w' ? sel.x + sel.w : sel.x, y: cq.c[0] === 'n' ? sel.y + sel.h : sel.y });
        down = { id: e.pointerId, start: p, last: p, scale: { A: A, w: sel.w, h: sel.h, poly: sel.poly, sx: cq.c[1] === 'w' ? -1 : 1, sy: cq.c[0] === 'n' ? -1 : 1 } };
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
        if (inSel(p)) { selMode = 'move'; selOff = { x: p.x - sel.x, y: p.y - sel.y }; lift(); stage.classList.add('moving'); }
        else if (t === 'wand') { commitSelection(); wandAt(p); selbar.hidden = !sel; drawSel(); return; }
        else if (t === 'lasso') { commitSelection(); selMode = 'lasso'; p.corner = true; lasso = [p]; }
        else { commitSelection(); selMode = 'new'; sel = { x: p.x, y: p.y, w: 0, h: 0, ax: p.x, ay: p.y, float: null }; }
        down = { id: e.pointerId, start: p, last: p };
        return;
      }
      if (t === 'fill') { remember(); fillAt(p); copies().forEach(function (m) { fillAt(mapPt(m, p)); }); useColor(); return; }
      if (t === 'eraser' && active.alphaLock) { toast('Alpha lock is on for this layer: paint over it instead'); return; }
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
        if (kind() === 'spray') {
          // (held still, it keeps spraying: as much more as the time that's passed)
          var flow = function (pr) { return pr == null ? 1 : 0.25 + 0.75 * Math.min(1, pr * 1.25); }, t0 = performance.now();
          down.flow = flow;
          both(octx, function () { spray(octx, p, null, null, flow(p.pr)); }); maskOv();
          sprayTimer = setInterval(function () {
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
      if (selMode === 'rotate') {
        // free to turn; it settles on upright and sideways when close (and
        // goes in steps of 15° with shift held)
        var mm = selMid(), ta = down.turn.r0 + Math.atan2(p.y - mm.y, p.x - mm.x) - down.turn.a0, st15 = Math.PI / 12, q90 = Math.round(ta / (Math.PI / 2)) * (Math.PI / 2);
        if (e.shiftKey) ta = Math.round(ta / st15) * st15; else if (Math.abs(ta - q90) < Math.PI / 60) ta = q90;
        ta = Math.atan2(Math.sin(ta), Math.cos(ta)); if (Math.abs(ta) < 1e-6) ta = 0;
        sel.rot = ta; drawSel(); return;
      }
      if (selMode === 'scale') {
        // free to stretch; hold shift for a perfect square (let go of shift
        // and it's free again)
        var z = down.scale, r = sel.rot || 0, co = Math.cos(r), si = Math.sin(r), vx = p.x - z.A.x, vy = p.y - z.A.y;
        var lx = co * vx + si * vy, ly = -si * vx + co * vy;
        var nw = Math.max(4 / view.k, lx * z.sx), nh = Math.max(4 / view.k, ly * z.sy);
        if (e.shiftKey) nw = nh = Math.max(nw, nh);
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
        if (selMode === 'move') { sel.x = p.x - selOff.x; sel.y = p.y - selOff.y; }
        else { sel.x = Math.min(sel.ax, p.x); sel.y = Math.min(sel.ay, p.y); sel.w = Math.abs(p.x - sel.ax); sel.h = Math.abs(p.y - sel.ay); }
        drawSel(); return;
      }
      if (t === 'smudge' || t === 'blur' || t === 'tone') { evs.forEach(function (ev) { var q = pos(ev); dabs(down.last, q, false); down.last = q; }); return; }
      if (t === 'gradient') { gradient(down.start, p); return; }
      if (t === 'eraser' || (t === 'brush' && kind() !== 'spray')) {
        evs.forEach(function (ev) {
          var q = pos(ev); q.pr = smoothPr(ev.pressure);
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
          var q = pos(ev), l = down.last, gap = Math.max(2, sprayRadius(st.size) * 0.3), d = Math.hypot(q.x - l.x, q.y - l.y);
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
      if (!snapShapes) return;
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
    function end() {
      var t = st.tool;
      clearTimeout(holdTimerS);
      // (a smoothed line catches up with where the pointer was let go)

      if (rsQueued) renderStroke(); // (the last frame, before it's laid down)
      clearInterval(sprayTimer);
      if (selMode === 'scale' || selMode === 'rotate') { refitMask(); selMode = null; down = null; selbar.classList.remove('away'); drawSel(); autosave(); return; }
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
        stage.classList.remove('moving'); selbar.hidden = !sel; selMode = null; down = null; drawSel(); autosave(); return;
      }
      down = null; autosave();
      if (t === 'smudge' || t === 'blur' || t === 'tone') { carry = []; return; }
      if (t === 'eraser') { octx.clearRect(0, 0, W, H); plainOv(); return; }
      if (t === 'gradient') { grainOver(); maskOv(); }
      var lk = strokeLook(); commit(lk.mode, lk.alpha);
      useColor();
    }

    // (the controls that sit on the picture: pressing them doesn't paint)
    var STAGE_UI = '.paint-zoom, .paint-ctx, .ctx-list, .paint-selbar, .paint-text, .paint-selx';
    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest(STAGE_UI)) return;
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
        pointers = {}; ptype = {}; gesture = null; fingerTap = null; firstDown = performance.now();
        if (pan) { pan = null; stage.classList.remove('panning'); }
      }
      try { stage.setPointerCapture(e.pointerId); } catch (x) {}
      if (e.pointerType === 'mouse') hideRing();
      pointers[e.pointerId] = screen(e); ptype[e.pointerId] = e.pointerType;
      var ids = Object.keys(pointers);
      // only two fingers pinch
      if (ids.length === 2 && ptype[ids[0]] === 'touch' && ptype[ids[1]] === 'touch') {
        // two fingers: pinch to zoom, drag to move the picture, twist to turn
        // it. (A quick tap with two fingers is undo, with three, redo.)
        cancelStroke(); pan = null; tapLater = null;
        var a = pointers[ids[0]], b = pointers[ids[1]], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        gesture = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, a: Math.atan2(b.y - a.y, b.x - a.x), k: view.k, r: view.r, p: fromScreen(mid.x, mid.y) };
        fingerTap = { n: 2, t0: firstDown, from: {}, moved: false };
        ids.forEach(function (id) { fingerTap.from[id] = { x: pointers[id].x, y: pointers[id].y }; });
        return;
      }
      if (ids.length === 3 && fingerTap) { fingerTap.n = 3; fingerTap.from[e.pointerId] = { x: pointers[e.pointerId].x, y: pointers[e.pointerId].y }; return; }
      if (ids.length > 1) return;
      if (st.tool === 'hand' || spaceDown || e.button === 1) { var s = screen(e); pan = { x: s.x, y: s.y, vx: view.x, vy: view.y }; stage.classList.add('panning'); return; }
      // (a finger's tap with fill, the colour picker, the wand or text acts
      // when it lifts: a second finger may be about to land, for undo)
      if (e.pointerType === 'touch' && /^(fill|picker|wand|text)$/.test(st.tool)) {
        tapLater = { id: e.pointerId, ev: { clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType, pressure: e.pressure, altKey: false, button: 0 } };
        return;
      }
      begin(e);
    });
    stage.addEventListener('pointermove', function (e) {
      if (pointers[e.pointerId]) pointers[e.pointerId] = screen(e);
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
      if (down && e.pointerId === down.id) { move(e); ctxThru(e); if (down && down.pen) showRing(pos(e)); return; }
      if (lassoOn && !down) { lassoHover = pos(e); drawLasso(lassoHover); stage.classList.toggle('closing', nearStart(lassoHover, e.pointerType !== 'mouse')); return; }
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
    window.addEventListener('blur', function () { letGoOfSpace(); stage.classList.remove('picking'); shiftChanged(false); });
    function up(e) {
      delete pointers[e.pointerId]; delete ptype[e.pointerId];
      ctxThru(null);
      if (e.pointerType === 'pen') hideRing();
      // (all the fingers of a quick, still tap are up: undo, or redo)
      if (fingerTap && !Object.keys(pointers).length) {
        var ft = fingerTap; fingerTap = null;
        if (!ft.moved && e.type === 'pointerup' && performance.now() - ft.t0 < 400) {
          if (ft.n === 2 && undo.length) { doUndo(); toast('Undo'); } else if (ft.n === 3 && redo.length) { doRedo(); toast('Redo'); }
          gesture = null; return;
        }
      }
      if (gesture) { if (Object.keys(pointers).length < 2) gesture = null; return; }
      if (tapLater && tapLater.id === e.pointerId) { var tl = tapLater; tapLater = null; if (e.type === 'pointerup' && !Object.keys(pointers).length) begin(tl.ev); return; }
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
      if (pk && pk.dataset.pick === 'font' && textBox) { st.font = pk.dataset.val; loadFont(st.font); openMenu(null); ctxClose(); afterTextChange(); ctxSync(); return; }
      if (pk) { st[pk.dataset.pick] = pk.dataset.val; if (pk.dataset.pick === 'font') loadFont(st.font); openMenu(null); ctxClose(); setTool({ brush: 'brush', shape: 'shape', font: 'text', tone: 'tone' }[pk.dataset.pick]); ctxSync(); return; }
      if (e.target.closest('.paint-selx')) { commitSelection(); return; }
      var t = e.target.closest('button[data-tool]'); // (the picture carries data-tool too, for its cursor)
      if (t) {
        var tl = t.dataset.tool, reopen = menus[tl] && (st.tool !== tl || menus[tl].el.hidden);
        setTool(tl); openMenu(menus[tl] && reopen ? tl : null); return;
      }
      var s = e.target.closest('[data-color]'); if (s) { setColor(s.dataset.color); if (/eraser|picker|smudge|blur|tone|hand|select|lasso|wand/.test(st.tool)) setTool('brush'); return; }
      var pr = e.target.closest('.paint-current, .paint-second');
      // (Enter or Space on it; a tap or a drag was dealt with already, and the
      // click after a touch can look just like a key's)
      if (pr) { if (e.detail === 0 && performance.now() - pairPressed > 800) picker(pr.classList.contains('paint-current') ? 'main' : 'second'); return; }
      if (e.target.closest('.paint-swap')) { var c1 = st.color; setColor(st.color2); setColor2(c1); return; }
      if (e.target.closest('.paint-solid')) { st.solid = !st.solid; $('.paint-solid').setAttribute('aria-checked', st.solid ? 'true' : 'false'); if (st.tool !== 'shape') setTool('shape'); ctxSync(); return; }
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
      runAct(a.dataset.act);
    });
    // the actions behind the buttons (some in the top bar, some here)
    function runAct(w) {
      if (w === 'layers') { openMenu(null); closeDrops(); savePanel(false); layerPanel(panel.hidden); }
      else if (w === 'adjust') adjustOpen();
      else if (w === 'undo') doUndo();
      else if (w === 'redo') doRedo();
      else if (w === 'clear') {
        if (sel) commitSelection();
        if (!active) return;
        remember('Clear Layer'); active.ctx.clearRect(0, 0, W, H);
        if (active.bg) { active.ctx.fillStyle = '#fff'; active.ctx.fillRect(0, 0, W, H); }
        autosave();
      }
      else if (w === 'save') { openMenu(null); layerPanel(false); closeDrops(); savePanel(saveMenu.hidden); }
    }
    document.addEventListener('pointerdown', function (e) {
      if (!document.contains(root)) return;
      if (anyMenu() && !e.target.closest('.paint-brushes, button[data-tool], .paint-mirror')) openMenu(null);
      if (!panel.hidden && !e.target.closest('.paint-layerpanel, [data-act="layers"]')) layerPanel(false);
      if (!pc.hidden && !e.target.closest('.paint-colorpanel, .paint-current, .paint-second, .paint-swap')) picker(null);
      if (adj && !e.target.closest('.paint-adjust, [data-act="adjust"], .paint-zoom')) adjustDone();
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
    right.addEventListener('pointerdown', function (e) {
      var sw = e.target.closest('.paint-swatches button, .paint-recent button, .paint-current, .paint-second');
      if (!sw || (e.pointerType === 'mouse' && e.button !== 0)) return;
      var main = sw.classList.contains('paint-current'), pair = main || sw.classList.contains('paint-second');
      var start = { x: e.clientX, y: e.clientY, c: sw.dataset.color || (main ? st.color : st.color2), el: sw, id: e.pointerId, on: false };
      if (pair) e.preventDefault(); // (no text selection or focus ring from a drag)
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
        // (the click that follows a press on the two colours is never acted on:
        // the tap opened the picker here already, and a drag shouldn't)
        if (pair) pairPressed = performance.now();
        if (!start.on) { if (pair && ev.type === 'pointerup') picker(main ? 'main' : 'second'); return; }
        // (it was dragged, so the tap that follows isn't a colour pick)
        var stop = function (c) { c.stopPropagation(); c.preventDefault(); };
        sw.addEventListener('click', stop, true); setTimeout(function () { sw.removeEventListener('click', stop, true); }, 400);
        // (this drag's own blob: another drag may have begun before it's gone)
        var b = blob; blob = null;
        if (b) setTimeout(function () { b.remove(); }, ev.type === 'pointerup' ? 260 : 0);
        var over = ev.type === 'pointerup' && document.elementFromPoint(ev.clientX, ev.clientY);
        if (b) { b.classList.add(over && over.closest('.paint-stage') ? 'plop' : 'gone'); }
        if (over && over.closest('.paint-stage') && !over.closest(STAGE_UI)) {
          var r = stage.getBoundingClientRect();
          plopFill(fromScreen(ev.clientX - r.left, ev.clientY - r.top), start.c);
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
      if (isProject(f)) openProject(f); else addPicture(f, 'open');
      e.target.value = '';
    });
    // ---- A PROJECT FILE (.paint): the whole drawing, every layer with its
    // settings, and your own palettes, in one file to keep, carry to another
    // device and open again to carry on. (Saved pictures are flattened; this
    // isn't.) ----
    function isProject(f) { return /\.paint$/i.test(f.name || '') || f.type === 'application/x-paint-alternative'; }
    function saveProject() {
      finishWork();
      var out = { app: 'Paint Alternative', version: 1, width: ov.width, height: ov.height, active: layers.indexOf(active), palettes: myPalettes,
        layers: layers.map(function (L) { return { name: L.name, visible: L.visible, bg: L.bg, opacity: L.opacity, blend: L.blend, alphaLock: L.alphaLock, clip: L.clip, png: L.cv.toDataURL('image/png') }; }) };
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
        if (!d || !d.layers || !d.layers.length || !(d.width > 0) || !(d.height > 0) || d.width > 8192 || d.height > 8192) { toast('That isn’t a Paint Alternative project'); return; }
        Promise.all(d.layers.slice(0, 10).map(function (l) {
          return new Promise(function (ok) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = typeof l.png === 'string' && /^data:image\/png;base64,/.test(l.png) ? l.png : ''; });
        })).then(function (ims) {
          finishWork();
          // (one undo goes back to the drawing that was there before)
          rememberDoc('Open Project');
          setDoc(Math.round(d.width), Math.round(d.height));
          layers = d.layers.slice(0, 10).map(function (l, i) {
            var L = makeLayer(String(l.name || 'Layer ' + (i + 1)).slice(0, 24), false);
            L.bg = !!l.bg; L.visible = l.visible !== false; L.opacity = Math.max(0, Math.min(1, +l.opacity || (l.opacity === 0 ? 0 : 1)));
            L.blend = BLENDS.some(function (b) { return b[0] === l.blend; }) ? l.blend : 'normal'; L.alphaLock = !!l.alphaLock; L.clip = !!l.clip;
            if (ims[i]) { L.ctx.save(); L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.drawImage(ims[i], 0, 0); L.ctx.restore(); }
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
          mount(); fit(); autosave();
          toast('Opened the project');
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
      if (adj) adjustDone();
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
      statusEl.lastChild.textContent = state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : 'Not saved';
    }
    var saveTimer = 0, restoring = true;
    function db(fn) {
      try {
        var r = indexedDB.open('paint-alternative', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('s'); };
        r.onsuccess = function () { try { fn(r.result.transaction('s', 'readwrite').objectStore('s')); } catch (x) {} };
      } catch (x) {}
    }
    function autosave() { thumbsSoon(); viewsSoon(); if (!restoring) docStatus('saving'); if (restoring) return; clearTimeout(saveTimer); saveTimer = setTimeout(storeNow, 1000); }
    function storeNow() {
      clearTimeout(saveTimer); saveTimer = 0;
      if (!window.indexedDB) { docStatus('off'); return; }
      if (restoring || !window.Promise) return;
      var info = { R: R, pw: ov.width, ph: ov.height, active: layers.indexOf(active), count: count };
      Promise.all(layers.map(function (L) {
        var cv = L.cv;
        if (sel && sel.float && L === active) {
          // (anything lifted and still being moved is kept where it is now)
          cv = document.createElement('canvas'); cv.width = L.cv.width; cv.height = L.cv.height;
          var x = cv.getContext('2d'); x.drawImage(L.cv, 0, 0); base(x); putFloat(x);
        }
        return new Promise(function (ok) { cv.toBlob(function (b) { ok({ name: L.name, visible: L.visible, bg: L.bg, opacity: L.opacity, blend: L.blend, alphaLock: L.alphaLock, clip: L.clip, blob: b }); }, 'image/png'); });
      })).then(function (list) {
        if (list.some(function (l) { return !l.blob; })) return;
        info.layers = list;
        db(function (os) { var q = os.put(info, 'picture'); q.onsuccess = function () { if (!saveTimer) docStatus('saved'); }; q.onerror = function () { docStatus('off'); }; });
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
              L.opacity = l.opacity != null ? l.opacity : 1; L.blend = l.blend || 'normal'; L.alphaLock = !!l.alphaLock; L.clip = !!l.clip;
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
      [imgMenu, histBox, moreBox].forEach(function (d) { if (!d.hidden) { d.hidden = true; any = true; } });
      if (hb('more')) hb('more').setAttribute('aria-expanded', 'false');
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
    // (on a phone the top bar keeps undo, redo, save and layers; the rest
    // is in its ••• menu)
    var moreBox = dropdown('paint-moremenu'); moreBox.setAttribute('role', 'menu');
    function moreMenu(open) {
      if (!open) { moreBox.hidden = true; hb('more').setAttribute('aria-expanded', 'false'); return; }
      closeDrops();
      var it = function (k, label) { var src = k === 'open' ? header.querySelector('.paint-open svg') : k === 'theme' ? header.querySelector('.theme-toggle svg') : hb(k) && hb(k).querySelector('svg'); return '<button type="button" role="menuitem" data-more="' + k + '">' + (src ? src.outerHTML : '') + label + '</button>'; };
      moreBox.innerHTML = it('new', 'New Picture') + it('open', 'Open…') + it('share', 'Share') + '<hr>' + it('image', 'Crop, Rotate & Flip') + it('history', 'History') + '<hr>' +
        it('focus', 'Focus Mode') + it('help', 'Shortcuts') + it('theme', document.documentElement.getAttribute('data-theme') === 'dark' ? 'Light Mode' : 'Dark Mode');
      moreBox.hidden = false; hb('more').setAttribute('aria-expanded', 'true'); placeDrop(moreBox, hb('more'));
    }
    moreBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-more]'); if (!b) return;
      var k = b.dataset.more; moreMenu(false);
      if (k === 'open') header.querySelector('.paint-open input').click();
      else if (k === 'theme') header.querySelector('.theme-toggle').click();
      else if (hb(k)) { var t = hb(k); setTimeout(function () { t.click(); }, 0); }
    });
    // FOCUS MODE: just the picture. The bars fade away and the picture gets
    // the whole window; \ (or Esc, or the button in the corner) brings them back
    var focusOut = document.createElement('button');
    focusOut.type = 'button'; focusOut.className = 'paint-focusout'; focusOut.setAttribute('aria-label', 'Show the tools again'); focusOut.dataset.tip = 'Show the tools again (\\ or Esc)';
    focusOut.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4"/><path d="M20 9h-3.5A1.5 1.5 0 0 1 15 7.5V4"/><path d="M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20"/><path d="M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20"/></svg>';
    document.body.appendChild(focusOut);
    focusOut.addEventListener('click', function () { focusMode(false); });
    function focusMode(on) {
      var html = document.documentElement;
      if (on === html.classList.contains('focus-mode')) return;
      finishMenus();
      html.classList.toggle('focus-mode', on);
      if (hb('focus')) hb('focus').setAttribute('aria-pressed', on ? 'true' : 'false');
      fit();
      if (on) toast('Focus mode: press \\ or Esc to bring the tools back');
    }
    function finishMenus() { openMenu(null); layerPanel(false); savePanel(false); closeDrops(); moreMenu(false); if (!pc.hidden) picker(null); }
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
        var N = makeLayer(L.name, L.bg); N.visible = L.visible; N.opacity = L.opacity; N.blend = L.blend; N.alphaLock = L.alphaLock; N.clip = L.clip;
        N.ctx.save(); N.ctx.setTransform(1, 0, 0, 1, 0, 0); draw(N.ctx, L.cv); N.ctx.restore();
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
      var fs = e.dataTransfer.files || [], pj = Array.prototype.filter.call(fs, isProject)[0];
      if (pj) { openProject(pj); return; }
      var f = Array.prototype.filter.call(fs, function (x) { return /^image\//.test(x.type); })[0];
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
        group('View', [['Zoom in', '+'], ['Zoom out', '−'], ['Fit (and upright)', '0'], ['Grab & move', 'Space drag'], ['Zoom', CMD + 'scroll'], ['These shortcuts', '?']]) +
        group('Touch & Pencil', [['Undo', 'Two-finger tap'], ['Redo', 'Three-finger tap'], ['Zoom & move', 'Pinch'], ['Turn the canvas', 'Twist two fingers'], ['Snap to a shape', 'Hold at the end'], ['Circle or square', 'Shift while snapped'], ['Layer options', '•••']]) +
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
      var ac = e.target.closest('[data-act]'); if (ac) { runAct(ac.dataset.act); return; }
      var b = e.target.closest('[data-hb]'); if (!b) return;
      var w = b.dataset.hb;
      if (w === 'focus') { focusMode(!document.documentElement.classList.contains('focus-mode')); return; }
      if (w === 'more') { moreMenu(moreBox.hidden); return; }
      if (w === 'new') newSheet();
      else if (w === 'image') imageMenu(imgMenu.hidden);
      else if (w === 'history') historyPanel(histBox.hidden);
      else if (w === 'share') { closeDrops(); share(); }
      else if (w === 'help') helpSheet();
      else if (w === 'install' && installEv) { installEv.prompt(); installEv.userChoice.then(function () { installEv = null; hb('install').hidden = true; }); }
    });
    document.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.paint-drop, [data-hb="image"], [data-hb="history"], [data-hb="more"]')) closeDrops();
    }, true);

    // ---- THE CONTEXT BAR: what the tool in hand can be set to, at the top of
    // the picture. A brush: which brush, smoothing, tapered ends and snapping
    // to shapes; shapes: which shape, outline or filled; text: font, size,
    // bold / italic / underline, alignment and more; light & dark: which;
    // the others say how they're used. With a selection it shows what can be
    // done with it (copy, flip, turn, invert, delete, cut to a layer, done). ----
    var ctxEl = $('.paint-ctx'), ctxTool = ctxEl.querySelector('.ctx-tool'), ctxFor = null;
    ctxEl.appendChild(selbar);
    draggable(ctxEl, '.ctx-grip', 'ctx2');
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
    var CTX = {
      brush: function () {
        return '<button type="button" class="ctx-btn" data-ctx="brushes" aria-haspopup="menu" aria-expanded="false" data-tip="Choose a brush"><canvas class="pb-prev" data-ctxprev aria-hidden="true"></canvas><span data-ctxname></span>' + CHEV + '</button>' +
          sep + smoothRow + sep + taperChip + snapChip;
      },
      eraser: function () { return hint('Rubs out on the current layer') + sep + smoothRow + sep + snapChip; },
      smudge: function () { return hint('Drag to push and blend the paint'); },
      blur: function () { return hint('Drag to soften the paint'); },
      tone: function () { return '<div class="pa-tabs ctx-seg" role="tablist" aria-label="Light or dark">' + TONES.map(function (t) { return '<button type="button" role="tab" data-ctx-tone="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' + hint('Brush over the picture'); },
      line: function () { return hint('Drag to draw a line · <b>Shift</b> for steps of 45°'); },
      shape: function () {
        return '<div class="pa-tabs ctx-seg" role="tablist" aria-label="Shape">' + SHAPES.map(function (q) { return '<button type="button" role="tab" data-ctx-shape="' + q[0] + '" aria-label="' + q[1] + '" data-tip="' + q[1] + '">' + CI(SHAPE_ICONS[q[0]] || '') + '</button>'; }).join('') + '</div>' + sep +
          '<div class="pa-tabs ctx-seg" role="tablist" aria-label="Fill"><button type="button" role="tab" data-ctx-fill="0">Outline</button><button type="button" role="tab" data-ctx-fill="1">Filled</button></div>' + hint('<b>Shift</b>: square');
      },
      text: function () {
        return '<button type="button" class="ctx-btn" data-ctx="fonts" aria-haspopup="menu" aria-expanded="false" data-tip="Font"><span data-ctxfont></span>' + CHEV + '</button>' +
          '<label class="ctx-field" data-tip="Text size"><span>Size</span><input type="number" class="p-field ctx-num" min="4" max="2000" data-ctx="tsize" aria-label="Text size"></label>' + sep +
          '<div class="pa-tabs ctx-seg" role="group" aria-label="Style">' +
            '<button type="button" data-ctx-t="bold" aria-label="Bold" data-tip="Bold"><b>B</b></button><button type="button" data-ctx-t="italic" aria-label="Italic" data-tip="Italic"><i style="font-family: Georgia, serif">I</i></button><button type="button" data-ctx-t="underline" aria-label="Underline" data-tip="Underline"><u>U</u></button></div>' + sep +
          '<div class="pa-tabs ctx-seg" role="tablist" aria-label="Alignment">' + ['left', 'center', 'right'].map(function (a) { return '<button type="button" role="tab" data-ctx-al="' + a + '" aria-label="Align ' + a + '" data-tip="Align ' + a + '">' + CI(a === 'left' ? '<path d="M4 6.5h16M4 10.5h10M4 14.5h16M4 18.5h10"/>' : a === 'center' ? '<path d="M4 6.5h16M7 10.5h10M4 14.5h16M7 18.5h10"/>' : '<path d="M4 6.5h16M10 10.5h10M4 14.5h16M10 18.5h10"/>') + '</button>'; }).join('') + '</div>' + sep +
          '<button type="button" class="ctx-btn" data-ctx="tmore" data-tip="Spacing, line height, capitals, outline and shadow (while typing)">More</button>';
      },
      fill: function () { return hint('Tap an area to fill it · or drag a colour onto the picture'); },
      gradient: function () { return hint('Drag to blend from the main colour to the second') + '<button type="button" class="ctx-btn" data-ctx="swap" data-tip="Swap the two colours (X)">' + CI('<path d="M7 7h11l-3-3M17 17H6l3 3"/>') + '<span>Swap Colours</span></button>'; },
      picker: function () { return hint('Tap the picture to pick up a colour · or <b>Alt</b>-click with any tool'); },
      select: function () { return hint('Drag a box round what to select') + '<button type="button" class="ctx-btn" data-ctx="all" data-tip="Select everything (Ctrl+A)">Select All</button>'; },
      lasso: function () { return hint('Draw round it, or click to place points') + '<button type="button" class="ctx-btn" data-ctx="all" data-tip="Select everything (Ctrl+A)">Select All</button>'; },
      wand: function () { return hint('Tap an area of one colour') + '<button type="button" class="ctx-btn" data-ctx="all" data-tip="Select everything (Ctrl+A)">Select All</button>'; },
      hand: function () { return hint('Drag to move · pinch to zoom · twist to turn') + '<button type="button" class="ctx-btn" data-zoom="fit" data-tip="The whole picture, upright (0)">Fit</button>'; }
    };
    // (the little lists that drop down from it: the brushes, the fonts)
    var ctxList = document.createElement('div'); ctxList.className = 'ctx-list'; ctxList.hidden = true; ctxList.setAttribute('role', 'menu'); stage.appendChild(ctxList);
    function ctxDrop(kind, btn) {
      if (!ctxList.hidden && ctxList.dataset.kind === kind) { ctxClose(); return; }
      ctxList.dataset.kind = kind;
      if (kind === 'brushes') ctxList.innerHTML = BRUSHES.map(function (b) { return '<button type="button" role="menuitemradio" data-pick="brush" data-val="' + b[0] + '" aria-checked="' + (st.brush === b[0]) + '"><canvas class="pb-prev" data-prev="' + b[0] + '" aria-hidden="true"></canvas><span>' + b[1] + '</span></button>'; }).join('');
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
      ctxList.style.left = Math.round(Math.max(6, Math.min(stage.clientWidth - ctxList.offsetWidth - 6, side ? cr.right - sr.left + 6 : r.left - sr.left))) + 'px';
      ctxList.style.top = Math.round(top) + 'px';
      if (kind === 'fonts') { var on = ctxList.querySelector('[aria-checked="true"]'); if (on) on.scrollIntoView({ block: 'nearest' }); }
      btn.setAttribute('aria-expanded', 'true');
    }
    // (a stroke that passes under the bar: the bar fades and lets it through)
    var thruBox = null;
    function ctxThru(e) {
      if (!e) { thruBox = null; ctxEl.classList.remove('thru'); return; }
      if (!thruBox) thruBox = ctxEl.hidden ? { left: 0, right: -1, top: 0, bottom: -1 } : ctxEl.getBoundingClientRect();
      var b = thruBox, m = 14;
      ctxEl.classList.toggle('thru', e.clientX > b.left - m && e.clientX < b.right + m && e.clientY > b.top - m && e.clientY < b.bottom + m);
    }
    function ctxClose() { ctxList.hidden = true; Array.prototype.forEach.call(ctxEl.querySelectorAll('[aria-expanded="true"]'), function (b) { b.setAttribute('aria-expanded', 'false'); }); }
    function ctxRender() {
      if (!ctxEl) return;
      ctxClose();
      if (st.tool !== ctxFor) { ctxFor = st.tool; ctxTool.innerHTML = CTX[st.tool] ? CTX[st.tool]() : ''; }
      ctxSync(); ctxShow();
      // (and the right-hand panel: which of size and opacity this tool uses)
      var uses = { brush: 'so', eraser: 'so', smudge: 'so', blur: 'so', tone: 'so', line: 'so', shape: 'so', fill: 'o', gradient: 'o', text: 'o' }[st.tool] || '';
      right.dataset.uses = uses;
      var lab = right.querySelector('.pr-tool'); if (lab) lab.textContent = { line: 'Stroke', shape: 'Stroke', eraser: 'Eraser', smudge: 'Smudge', blur: 'Blur', tone: 'Light & Dark', fill: 'Fill', gradient: 'Gradient', text: 'Text' }[st.tool] || 'Brush';
    }
    function ctxShow() {
      var has = !selbar.hidden;
      ctxEl.classList.toggle('has-sel', has);
      ctxEl.classList.toggle('away', selbar.classList.contains('away'));
      ctxEl.hidden = !has && !ctxTool.innerHTML;
    }
    function ctxSync() {
      var q = function (sel) { return ctxTool.querySelector(sel); }, set = function (sel, attr, on) { var e = q(sel); if (e) e.setAttribute(attr, on ? 'true' : 'false'); };
      var name = q('[data-ctxname]');
      if (name) { var b = BRUSHES.filter(function (x) { return x[0] === st.brush; })[0]; name.textContent = b ? b[1] : ''; var cv = q('[data-ctxprev]'); cv.dataset.prev = st.brush; brushSamples(ctxTool); }
      var sm = q('[data-ctx="smoothing"]'); if (sm) { sm.value = smoothing; sm.nextElementSibling.textContent = smoothing ? smoothing : 'Off'; }
      set('[data-ctx="taper"]', 'aria-pressed', taperOn); set('[data-ctx="snap"]', 'aria-pressed', snapShapes);
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-tone]'), function (b) { b.setAttribute('aria-selected', b.dataset.ctxTone === st.tone ? 'true' : 'false'); });
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-shape]'), function (b) { b.setAttribute('aria-selected', b.dataset.ctxShape === st.shape ? 'true' : 'false'); });
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-fill]'), function (b) { b.setAttribute('aria-selected', (b.dataset.ctxFill === '1') === !!st.solid ? 'true' : 'false'); });
      var fn = q('[data-ctxfont]'); if (fn) { fn.textContent = fontName(st.font); fn.style.fontFamily = st.font; }
      var ts = q('[data-ctx="tsize"]'); if (ts && document.activeElement !== ts) ts.value = tx.size;
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-t]'), function (b) { b.setAttribute('aria-selected', tx[b.dataset.ctxT] ? 'true' : 'false'); });
      Array.prototype.forEach.call(ctxTool.querySelectorAll('[data-ctx-al]'), function (b) { b.setAttribute('aria-selected', tx.align === b.dataset.ctxAl ? 'true' : 'false'); });
      var tm = q('[data-ctx="tmore"]'); if (tm) tm.disabled = !textBox;
    }
    new MutationObserver(ctxShow).observe(selbar, { attributes: true, attributeFilter: ['hidden', 'class'] });
    ctxEl.addEventListener('input', function (e) {
      var k = e.target.dataset.ctx;
      if (k === 'smoothing') { smoothing = +e.target.value; storeIt('paint-smoothing', smoothing); ctxSync(); }
      else if (k === 'tsize') { var v = Math.round(+e.target.value); if (v >= 4 && v <= 2000) { tx.size = v; if (textBox) afterTextChange(true); } }
    });
    ctxEl.addEventListener('keydown', function (e) { if (e.target.dataset.ctx === 'tsize') { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); if (textBox) textBox.focus({ preventScroll: true }); } } });
    ctxEl.addEventListener('pointerdown', function (e) { if (anyMenu()) openMenu(null); if (textBox && e.target.closest('button')) e.preventDefault(); }); // (so the words being typed keep the caret)
    ctxEl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !ctxEl.contains(b)) return;
      var k = b.dataset.ctx;
      if (k === 'brushes' || k === 'fonts') { ctxDrop(k, b); return; }
      if (k === 'taper') { taperOn = !taperOn; storeIt('paint-taper', taperOn); ctxSync(); brushSamples(); return; }
      if (k === 'snap') { snapShapes = !snapShapes; storeIt('paint-snap-shapes', snapShapes); ctxSync(); return; }
      if (k === 'swap') { var c1 = st.color; setColor(st.color2); setColor2(c1); return; }
      if (k === 'all') { selectAll(); return; }
      if (k === 'tmore') { if (textBox) textPanel(!tpEl || tpEl.hidden); return; }
      if (b.dataset.ctxTone) { st.tone = b.dataset.ctxTone; ctxSync(); return; }
      if (b.dataset.ctxShape) { st.shape = b.dataset.ctxShape; ctxSync(); return; }
      if (b.dataset.ctxFill) { st.solid = b.dataset.ctxFill === '1'; var so = $('.paint-solid'); if (so) so.setAttribute('aria-checked', st.solid ? 'true' : 'false'); ctxSync(); return; }
      if (b.dataset.ctxT) { tx[b.dataset.ctxT] = !tx[b.dataset.ctxT]; if (textBox) afterTextChange(); ctxSync(); return; }
      if (b.dataset.ctxAl) { tx.align = b.dataset.ctxAl; if (textBox) afterTextChange(); ctxSync(); return; }
    });
    document.addEventListener('pointerdown', function (e) { if (!ctxList.hidden && !e.target.closest('.ctx-list, [data-ctx="brushes"], [data-ctx="fonts"]')) ctxClose(); }, true);

    setColor(st.color); setColor2(st.color2); showRecent(); setSize(st.size); setTool('brush'); buttons(); fit(); restore();
    // (the paper texture is made ahead, when the page is idle, so the first
    // pencil stroke doesn't stutter while it's made)
    (window.requestIdleCallback || function (f) { setTimeout(f, 600); })(function () { texture('pencil'); });
    app = {
      root: root, fit: fit,
      key: function (e) {
        if (e.key === 'Shift') shiftChanged(true);
        var k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
        if (sheetEl) { if (k === 'escape') closeSheet(); return; }
        if (k === 'escape' && closeDrops()) return;
        if (k === 'escape' && document.documentElement.classList.contains('focus-mode')) { focusMode(false); return; }
        if (k === 'escape' && !pc.hidden) { picker(null); return; }
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
