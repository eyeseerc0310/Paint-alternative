/* PAINT ALTERNATIVE: VECTOR MODE. A workspace of its own beside the
   painting, kept with the same drawing: its own artboard, layers, objects,
   undo and redo, view and selection. paint.js starts it with a bridge (B)
   to what it shares: the stage, the left bar, the tool settings panel, the
   layers button, the bottom bar's undo and redo, saving and toasts.
   Nothing here ever touches the painting; artwork only goes across as a
   copy (raster() one way, enter(flat) the other). */
(function () {
  'use strict';
  var B = null;                       // (the bridge from paint.js)
  var doc = null;                     // (the vector document; null until Vector mode is first opened)
  var assets = {};                    // id -> { src: a data URL, w, h }: pictures, shared by objects and undo steps
  var imgs = {};                      // id -> an <img>, loaded, for drawing on a canvas
  var hist = [], fut = [], HMAX = 200;
  var sel = [];                       // (the picked objects' ids)
  var on = false;                     // (Vector mode is showing)
  var view = { x: 0, y: 0, k: 1, fit: true }, fitK = 1;
  var tool = 'select', cat = 'selection', lastTool = {};
  var stageEl, worldEl, boardEl, artEl, uiEl, groupEl, vlp, objEls = {};
  var SVGNS = 'http://www.w3.org/2000/svg';

  // ---- THE TOOLS: one registry for the categories in the left bar and
  // the tools in each, so the bar and the panel are both made from it.
  // (an action does something at once, and doesn't become the tool in hand)
  var CI = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; };
  var ICONS = {
    select: '<path d="M6 3.5l12 9-5.2 1.1 3.2 6.3-2.6 1.3-3.2-6.4L6 18.5z"/>',
    hand: '<path d="M8 12.5V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5V5a1.5 1.5 0 0 1 3 0v5.5"/><path d="M14 10.5V6.5a1.5 1.5 0 0 1 3 0V14a6.5 6.5 0 0 1-6.5 6.5h-.4a5.5 5.5 0 0 1-4.4-2.2L3.6 15.4a1.5 1.5 0 0 1 2.3-1.9L8 15.5"/>',
    zoom: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5M10.5 8v5"/>',
    fit: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M3.5 8V5a1.5 1.5 0 0 1 1.5-1.5h3M16 3.5h3A1.5 1.5 0 0 1 20.5 5v3M20.5 16v3a1.5 1.5 0 0 1-1.5 1.5h-3M8 20.5H5A1.5 1.5 0 0 1 3.5 19v-3"/>',
    actual: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 10l1.5-1v6M14 10l1.5-1v6"/><path d="M12 11v.01M12 14v.01"/>'
  };
  var CATS = [
    { id: 'selection', name: 'Selection', icon: 'select', tools: ['select'], def: 'select' },
    { id: 'navigation', name: 'Navigation', icon: 'hand', tools: ['hand', 'zoom', 'fit', 'actual'], def: 'hand' }
  ];
  var TOOLS = {
    select: { name: 'Selection', key: 'V', tip: 'Selection (V): pick objects to move or size them; drag round several' },
    hand: { name: 'Hand', key: 'H', tip: 'Hand (H): drag to move round the artboard. Space does it with any tool' },
    zoom: { name: 'Zoom', key: 'Z', tip: 'Zoom (Z): tap to zoom in, Alt-tap to zoom out, drag a box to zoom to it' },
    fit: { name: 'Fit to Screen', key: '0', action: true, tip: 'Fit to Screen (0): the whole artboard' },
    actual: { name: 'Actual Size', key: '⌘1', action: true, tip: 'Actual Size (Ctrl/⌘ 1): one pixel of the artboard to one on the screen' }
  };
  function catOf(t) { return CATS.filter(function (c) { return c.tools.indexOf(t) >= 0; })[0]; }

  // ---- THE DOCUMENT ----
  function uid(p) { return (p || 'v') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function blank(w, h) {
    return { v: 1, w: w, h: h, n: 1, cur: 'L1', layers: [{ id: 'L1', name: 'Layer 1', visible: true, locked: false, open: true, items: [] }] };
  }
  function layerOf(id) { return doc.layers.filter(function (L) { return L.id === id; })[0] || null; }
  function curLayer() { return layerOf(doc.cur) || doc.layers[doc.layers.length - 1] || null; }
  function allObjs() { var out = []; doc.layers.forEach(function (L) { L.items.forEach(function (o) { out.push(o); }); }); return out; }
  function objById(id) { var r = null; doc.layers.forEach(function (L) { L.items.forEach(function (o) { if (o.id === id) r = o; }); }); return r; }
  function layerOfObj(o) { return doc.layers.filter(function (L) { return L.items.indexOf(o) >= 0; })[0] || null; }
  function picked() { return sel.map(objById).filter(Boolean); }
  // (what can be worked on: shown and not locked, itself and its layer)
  function editable(o) { var L = layerOfObj(o); return !!(o && L && o.visible && L.visible && !o.locked && !L.locked); }
  function isEmpty() { return !doc || !allObjs().length; }

  // ---- PICTURES: kept once, as data URLs (so they save anywhere), and
  // loaded once for drawing on a canvas ----
  function addAsset(src, w, h) { var id = uid('a'); assets[id] = { src: src, w: w, h: h }; return id; }
  function imgFor(id) {
    if (imgs[id]) return imgs[id];
    var a = assets[id]; if (!a) return null;
    var im = new Image(); im.decoding = 'async'; im.src = a.src; imgs[id] = im;
    im.ready = new Promise(function (ok) { if (im.complete && im.naturalWidth) ok(); else { im.onload = function () { ok(); }; im.onerror = function () { ok(); }; } });
    return im;
  }

  // ---- UNDO AND REDO: Vector mode's own steps (the painting has its own) ----
  function snap() { return JSON.stringify({ layers: doc.layers, cur: doc.cur, n: doc.n, w: doc.w, h: doc.h, sel: sel }); }
  function restore(s) { var d = JSON.parse(s); doc.layers = d.layers; doc.cur = d.cur; doc.n = d.n; doc.w = d.w; doc.h = d.h; sel = d.sel.filter(function (id) { return !!objById(id); }); }
  function record(label) { hist.push({ s: snap(), label: label }); if (hist.length > HMAX) hist.shift(); fut = []; histButtons(); }
  function undo() { if (!hist.length) return; var e = hist.pop(); fut.push({ s: snap(), label: e.label }); restore(e.s); changed(true); }
  function redo() { if (!fut.length) return; var e = fut.pop(); hist.push({ s: snap(), label: e.label }); restore(e.s); changed(true); }
  function histButtons() {
    if (!B || !on) return;
    B.undoBtn.disabled = !hist.length; B.redoBtn.disabled = !fut.length;
  }

  // ---- THE VIEW: the artboard on the screen, moved and zoomed ----
  function toScreen(p) { return { x: view.x + p.x * view.k, y: view.y + p.y * view.k }; }
  function fromScreen(x, y) { return { x: (x - view.x) / view.k, y: (y - view.y) / view.k }; }
  function stageXY(e) { var r = stageEl.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  // (fitted: the same margin all round, and clear of the Paint / Vector
  // switch at the top)
  var fitM = 34, fitT = 34;
  function fitView() {
    var sw = stageEl.clientWidth, sh = stageEl.clientHeight; if (!sw || !sh || !doc) return;
    fitM = fitT = B.phone() ? 10 : 34;
    var me = B.modeEl; if (me && me.offsetParent) fitT = Math.max(fitM, me.getBoundingClientRect().bottom - stageEl.getBoundingClientRect().top + 8);
    fitK = Math.max(0.01, Math.min((sw - 2 * fitM) / doc.w, (sh - fitT - fitM) / doc.h));
  }
  function fit() {
    fitView(); if (!doc) return;
    var sw = stageEl.clientWidth, sh = stageEl.clientHeight;
    view.k = fitK; view.x = (sw - doc.w * fitK) / 2; view.y = fitT + (sh - fitT - fitM - doc.h * fitK) / 2; view.fit = true;
    applyView();
  }
  function zoomAt(k, cx, cy) {
    k = Math.max(fitK * 0.1, Math.min(fitK * 64, k));
    view.x = cx - (cx - view.x) * k / view.k; view.y = cy - (cy - view.y) * k / view.k; view.k = k; view.fit = false;
    applyView();
  }
  function zoomStep(dir) { zoomAt(view.k * (dir > 0 ? 1.25 : 0.8), stageEl.clientWidth / 2, stageEl.clientHeight / 2); }
  function actualSize() { zoomAt(1, stageEl.clientWidth / 2, stageEl.clientHeight / 2); }
  function applyView() {
    if (!worldEl) return;
    worldEl.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.k + ')';
    if (on && B.zoomVal) B.zoomVal.textContent = Math.round(view.k / fitK * 100) + '%';
    drawUI();
  }
  // (the stage changing size: a fitted artboard stays fitted, otherwise
  // what was in the middle stays in the middle)
  var lastSize = null;
  function relayout() {
    if (!on || !doc) return;
    var sw = stageEl.clientWidth, sh = stageEl.clientHeight; if (!sw || !sh) return;
    if (view.fit || !lastSize) { lastSize = { w: sw, h: sh }; fit(); return; }
    fitView(); view.x += (sw - lastSize.w) / 2; view.y += (sh - lastSize.h) / 2; lastSize = { w: sw, h: sh }; applyView();
  }

  // ---- DRAWING IT: the artwork as SVG (crisp at any zoom); the selection's
  // boxes and handles on a sheet of the screen's own above it ----
  function svg(tag, attrs) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function renderArt() {
    if (!doc || !artEl) return;
    boardEl.style.width = doc.w + 'px'; boardEl.style.height = doc.h + 'px';
    artEl.setAttribute('width', doc.w); artEl.setAttribute('height', doc.h); artEl.setAttribute('viewBox', '0 0 ' + doc.w + ' ' + doc.h);
    var keep = {};
    doc.layers.forEach(function (L) {
      L.items.forEach(function (o) {
        keep[o.id] = true;
        var el = objEls[o.id], a = assets[o.asset];
        if (!el) { el = objEls[o.id] = svg('image', { preserveAspectRatio: 'none' }); }
        if (a && el.getAttribute('href') !== a.src) el.setAttribute('href', a.src);
        el.setAttribute('x', o.x); el.setAttribute('y', o.y); el.setAttribute('width', Math.max(0.01, o.w)); el.setAttribute('height', Math.max(0.01, o.h));
        el.setAttribute('opacity', o.opacity);
        el.style.display = o.visible && L.visible ? '' : 'none';
        artEl.appendChild(el); // (in stack order: the last appended is on top)
      });
    });
    Object.keys(objEls).forEach(function (id) { if (!keep[id]) { objEls[id].remove(); delete objEls[id]; } });
  }
  function boundsOf(list) {
    if (!list.length) return null;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    list.forEach(function (o) { x0 = Math.min(x0, o.x); y0 = Math.min(y0, o.y); x1 = Math.max(x1, o.x + o.w); y1 = Math.max(y1, o.y + o.h); });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  var HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  function handlePts(b) {
    var a = toScreen({ x: b.x, y: b.y }), z = toScreen({ x: b.x + b.w, y: b.y + b.h }), mx = (a.x + z.x) / 2, my = (a.y + z.y) / 2;
    return { nw: [a.x, a.y], n: [mx, a.y], ne: [z.x, a.y], e: [z.x, my], se: [z.x, z.y], s: [mx, z.y], sw: [a.x, z.y], w: [a.x, my] };
  }
  var marquee = null, zoomBox = null;
  function drawUI() {
    if (!uiEl) return;
    var w = stageEl.clientWidth, h = stageEl.clientHeight, out = '';
    uiEl.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    var list = picked();
    list.forEach(function (o) {
      var a = toScreen(o), z = toScreen({ x: o.x + o.w, y: o.y + o.h });
      out += '<rect class="vs-box" x="' + a.x + '" y="' + a.y + '" width="' + (z.x - a.x) + '" height="' + (z.y - a.y) + '"/>';
    });
    var b = boundsOf(list.filter(editable));
    if (b && tool === 'select') {
      if (list.length > 1) { var a2 = toScreen(b), z2 = toScreen({ x: b.x + b.w, y: b.y + b.h }); out += '<rect class="vs-bounds" x="' + a2.x + '" y="' + a2.y + '" width="' + (z2.x - a2.x) + '" height="' + (z2.y - a2.y) + '"/>'; }
      var hp = handlePts(b);
      HANDLES.forEach(function (k) { out += '<rect class="vs-handle" x="' + (hp[k][0] - 4) + '" y="' + (hp[k][1] - 4) + '" width="8" height="8"/>'; });
    }
    var r = marquee || zoomBox;
    if (r) out += '<rect class="vs-marquee" x="' + Math.min(r.x0, r.x1) + '" y="' + Math.min(r.y0, r.y1) + '" width="' + Math.abs(r.x1 - r.x0) + '" height="' + Math.abs(r.y1 - r.y0) + '"/>';
    uiEl.innerHTML = out;
  }
  // (anything that changes the artwork: drawn again, the panels brought up
  // to date, and kept)
  function changed(save) {
    renderArt(); drawUI(); panelSync(); layersRender(); histButtons();
    if (save !== false) B.autosave();
  }

  // ---- PICKING ----
  function hitObj(p) {
    for (var i = doc.layers.length - 1; i >= 0; i--) {
      var L = doc.layers[i]; if (!L.visible || L.locked) continue;
      for (var j = L.items.length - 1; j >= 0; j--) {
        var o = L.items[j];
        if (o.visible && !o.locked && p.x >= o.x && p.x <= o.x + o.w && p.y >= o.y && p.y <= o.y + o.h) return o;
      }
    }
    return null;
  }
  function hitHandle(s, touch) {
    var b = boundsOf(picked().filter(editable)); if (!b || tool !== 'select') return null;
    var hp = handlePts(b), r = touch ? 16 : 8, hit = null;
    HANDLES.forEach(function (k) { if (!hit && Math.abs(s.x - hp[k][0]) <= r && Math.abs(s.y - hp[k][1]) <= r) hit = k; });
    return hit;
  }
  function setSel(ids) { sel = ids.slice(); var o = objById(sel[sel.length - 1]); if (o) doc.cur = layerOfObj(o).id; drawUI(); panelSync(); layersRender(); B.autosave(); }

  // ---- POINTERS: one finger, the mouse or the Pencil works the tool in
  // hand; two fingers move and zoom the view (a quick tap with two is
  // undo, with three redo); Space, the middle button or the Hand tool pan ----
  var pts = {}, drag = null, pinch = null, taps = null, spaceDown = false;
  function cursorFor(s, touch) {
    if (spaceDown || tool === 'hand') return drag && drag.kind === 'pan' ? 'grabbing' : 'grab';
    if (tool === 'zoom') return 'zoom-in';
    var h = hitHandle(s, touch);
    if (h) return h === 'n' || h === 's' ? 'ns-resize' : h === 'e' || h === 'w' ? 'ew-resize' : h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize';
    var o = hitObj(fromScreen(s.x, s.y));
    return o && sel.indexOf(o.id) >= 0 ? 'move' : 'default';
  }
  function down(e) {
    e.stopPropagation(); if (e.button === 2) return;
    try { stageEl.setPointerCapture(e.pointerId); } catch (x) {}
    var s = stageXY(e); pts[e.pointerId] = s;
    var ids = Object.keys(pts);
    if (e.pointerType === 'touch') {
      if (!taps || ids.length === 1) taps = { n: 0, t0: performance.now(), moved: false };
      taps.n = Math.max(taps.n, ids.length);
    }
    if (ids.length === 2 && e.pointerType === 'touch') {
      // (two fingers: what the first began is ended, kept as it is)
      if (drag) endDrag();
      var a = pts[ids[0]], c = pts[ids[1]];
      pinch = { d: Math.hypot(a.x - c.x, a.y - c.y) || 1, mx: (a.x + c.x) / 2, my: (a.y + c.y) / 2, k: view.k, vx: view.x, vy: view.y };
      return;
    }
    if (ids.length > 1) return;
    var touch = e.pointerType !== 'mouse';
    if (spaceDown || e.button === 1 || tool === 'hand') { drag = { kind: 'pan', s0: s, vx: view.x, vy: view.y }; stageEl.style.cursor = 'grabbing'; return; }
    if (tool === 'zoom') { drag = { kind: 'zoom', s0: s, alt: e.altKey }; return; }
    var p = fromScreen(s.x, s.y), h = hitHandle(s, touch);
    if (h) {
      var b = boundsOf(picked().filter(editable));
      drag = { kind: 'size', h: h, b: b, s0: s, objs: picked().filter(editable).map(function (o) { return { o: o, x: o.x, y: o.y, w: o.w, h: o.h }; }), moved: false };
      return;
    }
    var o = hitObj(p);
    if (o) {
      if (e.shiftKey) { var i = sel.indexOf(o.id); setSel(i >= 0 ? sel.filter(function (x) { return x !== o.id; }) : sel.concat(o.id)); if (i >= 0) return; }
      else if (sel.indexOf(o.id) < 0) setSel([o.id]);
      drag = { kind: 'move', s0: s, p0: p, objs: picked().filter(editable).map(function (q) { return { o: q, x: q.x, y: q.y }; }), moved: false };
      return;
    }
    if (!e.shiftKey && sel.length) setSel([]);
    drag = { kind: 'marquee', s0: s, base: e.shiftKey ? sel.slice() : [] };
  }
  function move(e) {
    e.stopPropagation();
    var s = stageXY(e), touch = e.pointerType !== 'mouse';
    if (pts[e.pointerId]) pts[e.pointerId] = s;
    if (taps && pts[e.pointerId] && e.pointerType === 'touch') taps.moved = taps.moved || false;
    if (pinch) {
      var ids = Object.keys(pts); if (ids.length < 2) return;
      var a = pts[ids[0]], c = pts[ids[1]], d = Math.hypot(a.x - c.x, a.y - c.y) || 1, mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
      if (taps && (Math.abs(d - pinch.d) > 10 || Math.hypot(mx - pinch.mx, my - pinch.my) > 10)) taps.moved = true;
      var k = Math.max(fitK * 0.1, Math.min(fitK * 64, pinch.k * d / pinch.d));
      view.x = mx - (pinch.mx - pinch.vx) * k / pinch.k; view.y = my - (pinch.my - pinch.vy) * k / pinch.k; view.k = k; view.fit = false;
      applyView(); return;
    }
    if (!drag) { stageEl.style.cursor = cursorFor(s, touch); return; }
    if (taps && Math.hypot(s.x - drag.s0.x, s.y - drag.s0.y) > 8) taps.moved = true;
    var p = fromScreen(s.x, s.y);
    if (drag.kind === 'pan') { view.x = drag.vx + s.x - drag.s0.x; view.y = drag.vy + s.y - drag.s0.y; view.fit = false; applyView(); return; }
    if (drag.kind === 'zoom') { if (Math.hypot(s.x - drag.s0.x, s.y - drag.s0.y) > 4) { zoomBox = { x0: drag.s0.x, y0: drag.s0.y, x1: s.x, y1: s.y }; drawUI(); } return; }
    if (drag.kind === 'marquee') {
      marquee = { x0: drag.s0.x, y0: drag.s0.y, x1: s.x, y1: s.y };
      var q0 = fromScreen(Math.min(marquee.x0, marquee.x1), Math.min(marquee.y0, marquee.y1)), q1 = fromScreen(Math.max(marquee.x0, marquee.x1), Math.max(marquee.y0, marquee.y1));
      var inBox = [];
      doc.layers.forEach(function (L) { if (!L.visible || L.locked) return; L.items.forEach(function (o) { if (o.visible && !o.locked && o.x < q1.x && o.x + o.w > q0.x && o.y < q1.y && o.y + o.h > q0.y) inBox.push(o.id); }); });
      sel = drag.base.concat(inBox.filter(function (id) { return drag.base.indexOf(id) < 0; }));
      drawUI(); panelSync(); layersRender(); return;
    }
    var touchSlop = e.pointerType === 'touch' ? 6 : 2;
    if (!drag.moved && Math.hypot(s.x - drag.s0.x, s.y - drag.s0.y) < touchSlop) return;
    if (!drag.moved) { drag.moved = true; record(drag.kind === 'move' ? 'Move' : 'Resize'); }
    if (drag.kind === 'move') {
      var dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
      drag.objs.forEach(function (q) { q.o.x = q.x + dx; q.o.y = q.y + dy; });
    } else if (drag.kind === 'size') sizeTo(drag, p, e.shiftKey);
    renderArt(); drawUI(); panelSync();
  }
  // (a handle pulled: the opposite side stays put; a corner keeps the
  // proportions, Shift lets them go)
  function sizeTo(d, p, shift) {
    var b = d.b, h = d.h, x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
    if (h.indexOf('w') >= 0) x0 = Math.min(p.x, x1 - 1); if (h.indexOf('e') >= 0) x1 = Math.max(p.x, x0 + 1);
    if (h.indexOf('n') >= 0) y0 = Math.min(p.y, y1 - 1); if (h.indexOf('s') >= 0) y1 = Math.max(p.y, y0 + 1);
    var sx = (x1 - x0) / b.w, sy = (y1 - y0) / b.h;
    if (h.length === 2 && !shift) {
      var k = Math.max(sx, sy); sx = sy = k;
      if (h.indexOf('w') >= 0) x0 = x1 - b.w * k; else x1 = x0 + b.w * k;
      if (h.indexOf('n') >= 0) y0 = y1 - b.h * k; else y1 = y0 + b.h * k;
    }
    d.objs.forEach(function (q) {
      q.o.x = x0 + (q.x - b.x) * sx; q.o.y = y0 + (q.y - b.y) * sy; q.o.w = Math.max(1, q.w * sx); q.o.h = Math.max(1, q.h * sy);
    });
  }
  function endDrag() {
    var d = drag; drag = null;
    if (!d) return;
    if (d.kind === 'zoom') {
      if (zoomBox && Math.abs(zoomBox.x1 - zoomBox.x0) > 8 && Math.abs(zoomBox.y1 - zoomBox.y0) > 8) {
        var bw = Math.abs(zoomBox.x1 - zoomBox.x0), bh = Math.abs(zoomBox.y1 - zoomBox.y0), cx = (zoomBox.x0 + zoomBox.x1) / 2, cy = (zoomBox.y0 + zoomBox.y1) / 2;
        var k = view.k * Math.min(stageEl.clientWidth / bw, stageEl.clientHeight / bh);
        var c = fromScreen(cx, cy); zoomAt(k, cx, cy);
        var s2 = toScreen(c); view.x += stageEl.clientWidth / 2 - s2.x; view.y += stageEl.clientHeight / 2 - s2.y; applyView();
      } else zoomAt(view.k * (d.alt ? 0.5 : 2), d.s0.x, d.s0.y);
      zoomBox = null; drawUI(); return;
    }
    if (d.kind === 'marquee') { marquee = null; setSel(sel); return; }
    if ((d.kind === 'move' || d.kind === 'size') && d.moved) changed();
  }
  function up(e) {
    e.stopPropagation();
    delete pts[e.pointerId];
    var n = Object.keys(pts).length;
    if (pinch) { if (n < 2) pinch = null; }
    else if (drag) endDrag();
    if (!n && taps) {
      var t = taps; taps = null;
      if (t.n >= 2 && !t.moved && performance.now() - t.t0 < 300 && e.type === 'pointerup') { if (t.n >= 3) redo(); else undo(); B.toast(t.n >= 3 ? 'Redo' : 'Undo'); }
    }
    stageEl.style.cursor = cursorFor(stageXY(e), e.pointerType !== 'mouse');
  }
  function wheel(e) {
    e.stopPropagation(); e.preventDefault();
    var s = stageXY(e);
    if (e.ctrlKey || e.metaKey) zoomAt(view.k * Math.exp(-e.deltaY * 0.01), s.x, s.y);
    else { view.x -= e.deltaX; view.y -= e.deltaY; view.fit = false; applyView(); }
  }

  // ---- EDITING ----
  function nudge(dx, dy) {
    var list = picked().filter(editable); if (!list.length) return;
    record('Nudge'); list.forEach(function (o) { o.x += dx; o.y += dy; }); changed();
  }
  function deleteSel() {
    var list = picked().filter(function (o) { var L = layerOfObj(o); return !o.locked && !L.locked; }); if (!list.length) return;
    record('Delete');
    doc.layers.forEach(function (L) { L.items = L.items.filter(function (o) { return list.indexOf(o) < 0; }); });
    sel = []; changed();
  }
  function selectAll() {
    var ids = []; doc.layers.forEach(function (L) { if (L.visible && !L.locked) L.items.forEach(function (o) { if (o.visible && !o.locked) ids.push(o.id); }); });
    setSel(ids);
  }
  // (a picture in: on the current layer, or a new one if that's hidden or
  // locked; its own size if it fits, otherwise fitted to the artboard)
  function place(src, w, h, name, fitAll) {
    var a = addAsset(src, w, h), L = curLayer();
    var k = fitAll ? Math.min(doc.w / w, doc.h / h) : Math.min(1, doc.w * 0.9 / w, doc.h * 0.9 / h);
    var o = { id: uid('o'), type: 'image', name: name, asset: a, x: (doc.w - w * k) / 2, y: (doc.h - h * k) / 2, w: w * k, h: h * k, opacity: 1, visible: true, locked: false };
    return { o: o, L: L };
  }
  function newLayer(name) {
    doc.n += 1;
    var L = { id: 'L' + Date.now().toString(36) + doc.n, name: name || 'Layer ' + doc.n, visible: true, locked: false, open: true, items: [] };
    var cur = curLayer(), i = cur ? doc.layers.indexOf(cur) + 1 : doc.layers.length;
    doc.layers.splice(i, 0, L); doc.cur = L.id; return L;
  }
  function addImageFile(file) {
    if (!file || !/^image\//.test(file.type)) { B.toast('That isn’t a picture'); return; }
    var rd = new FileReader();
    rd.onload = function () {
      var im = new Image();
      im.onload = function () {
        if (!doc) return;
        record('Place Picture');
        var r = place(rd.result, im.naturalWidth, im.naturalHeight, (file.name || 'Picture').replace(/\.[a-z0-9]+$/i, '').slice(0, 40), false);
        var L = r.L; if (!L || L.locked || !L.visible) L = newLayer();
        L.items.push(r.o); sel = [r.o.id]; doc.cur = L.id; setTool('select'); changed();
        B.toast('Placed the picture: drag it, or its corners to size it');
      };
      im.onerror = function () { B.toast('That picture couldn’t be opened'); };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  }

  // ---- TOOLS AND THE PANEL: the panel shows the category's tools at
  // the top, the tool's settings (or the picked objects') under them ----
  function setTool(t) {
    var T = TOOLS[t]; if (!T) return;
    if (T.action) { if (t === 'fit') fit(); else if (t === 'actual') actualSize(); return; }
    tool = t; var c = catOf(t); cat = c.id; lastTool[cat] = t;
    groupSync(); panelRefresh(); drawUI(); stageEl.style.cursor = tool === 'hand' ? 'grab' : tool === 'zoom' ? 'zoom-in' : 'default';
  }
  function pickCat(id) {
    var c = CATS.filter(function (q) { return q.id === id; })[0]; if (!c) return;
    B.showPanel();
    if (id === cat) return; // (picking it again leaves the panel as it is)
    setTool(lastTool[id] || c.def);
  }
  function groupSync() {
    if (!groupEl) return;
    Array.prototype.forEach.call(groupEl.querySelectorAll('[data-vcat]'), function (b) { b.setAttribute('aria-pressed', b.dataset.vcat === cat ? 'true' : 'false'); });
  }
  var hint = function (t) { return '<span class="ctx-hint">' + t + '</span>'; };
  var sep = '<span class="ctx-sep" aria-hidden="true"></span>';
  var esc = function (t) { return String(t).replace(/[<&"]/g, function (ch) { return ch === '<' ? '&lt;' : ch === '&' ? '&amp;' : '&quot;'; }); };
  var panelKey = '';
  function panelHTML() {
    var c = CATS.filter(function (q) { return q.id === cat; })[0] || CATS[0];
    var top = '<div class="vec-tools" role="group" aria-label="' + c.name + ' tools">' + c.tools.map(function (t) {
      var T = TOOLS[t];
      return '<button type="button" class="vec-tool" data-vtool="' + t + '"' + (T.action ? '' : ' aria-pressed="' + (t === tool) + '"') + ' data-tip="' + esc(T.tip) + '">' + CI(ICONS[t]) + '<span>' + T.name + '</span></button>';
    }).join('') + '</div>';
    panelKey = keyNow();
    return '<div class="vec-panel"><div class="vec-cat">' + c.name + '</div>' + top + sep + '<div class="vec-set">' + settingsHTML() + '</div></div>';
  }
  function keyNow() { var list = picked(); return cat + '|' + tool + '|' + list.length + '|' + (list.length === 1 ? list[0].id : ''); }
  function field(k, label) { return '<label class="ctx-field" data-tip="' + label + '"><span>' + label + '</span><input type="number" class="p-field ctx-num" step="1" data-v="' + k + '" aria-label="' + label + '"></label>'; }
  function chip(k, label, icon, tip) { return '<button type="button" class="ctx-chip" data-v="' + k + '" aria-pressed="false" data-tip="' + tip + '">' + CI(icon) + '<span>' + label + '</span></button>'; }
  function settingsHTML() {
    if (tool === 'hand') return hint('Drag to move round the artboard. With any tool: hold <b>Space</b>, drag with the middle button, scroll, or use two fingers');
    if (tool === 'zoom') return hint('Tap to zoom in · <b>Alt</b>-tap to zoom out · drag a box to zoom to it') + '<div class="vec-zoomrow">' + btn('zoomout', 'Zoom Out', '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5"/>') + btn('zoomin', 'Zoom In', ICONS.zoom) + '</div>';
    var list = picked();
    if (!list.length) return hint('Tap a picture to pick it · drag round several · <b>Shift</b> adds or takes away') + hint('Artboard ' + Math.round(doc.w) + ' × ' + Math.round(doc.h));
    var one = list.length === 1 ? list[0] : null;
    return (one ? '<div class="vec-name">' + esc(one.name || 'Picture') + '</div>' : '<div class="vec-name">' + list.length + ' objects</div>') +
      '<div class="vec-fields">' + field('x', 'X') + field('y', 'Y') + field('w', 'W') + field('h', 'H') + '</div>' +
      '<label class="ctx-slider" data-tip="How solid it is: fade a picture to trace over it"><span>Opacity</span><input type="range" min="0" max="100" data-v="op" aria-label="Opacity"><output>100%</output></label>' + sep +
      chip('hide', 'Hidden', '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.4 3M6.5 7.6C4 9.3 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 4-.9"/>', 'Hidden: out of sight, and out of the way when picking') +
      chip('lock', 'Locked', '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/>', 'Locked: it stays put, and can’t be picked on the artboard (pick it in Layers)') + sep +
      btn('fitboard', 'Fit to Artboard', ICONS.fit) + btn('del', 'Delete', '<path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/>');
  }
  function btn(k, label, icon) { return '<button type="button" class="ctx-btn" data-v="' + k + '">' + CI(icon) + '<span>' + label + '</span></button>'; }
  // (the panel made again only when what it shows changes; otherwise its
  // values brought up to date, so a field being typed in keeps its place)
  function panelRefresh() { if (on) B.ctxRefresh(); } // (which brings its values up to date: panelSync)
  function panelSync() {
    if (!on || !B.ctxTool) return;
    if (keyNow() !== panelKey) { panelRefresh(); return; }
    var q = function (k) { return B.ctxTool.querySelector('[data-v="' + k + '"]'); }, list = picked();
    if (!list.length) return;
    var b = boundsOf(list), f = { x: b.x, y: b.y, w: b.w, h: b.h };
    ['x', 'y', 'w', 'h'].forEach(function (k) { var i = q(k); if (i && document.activeElement !== i) i.value = Math.round(f[k]); });
    var op = q('op'); if (op) { var v = Math.round(list[0].opacity * 100); if (document.activeElement !== op) op.value = v; op.nextElementSibling.textContent = v + '%'; }
    var hd = q('hide'); if (hd) hd.setAttribute('aria-pressed', list.every(function (o) { return !o.visible; }) ? 'true' : 'false');
    var lk = q('lock'); if (lk) lk.setAttribute('aria-pressed', list.every(function (o) { return o.locked; }) ? 'true' : 'false');
    Array.prototype.forEach.call(B.ctxTool.querySelectorAll('[data-v="x"], [data-v="y"], [data-v="w"], [data-v="h"], [data-v="fitboard"]'), function (i) { i.disabled = !list.some(editable); });
  }
  var opGesture = false;
  function panelClick(e) {
    if (!on) return;
    var t = e.target.closest('[data-vtool]'); if (t) { setTool(t.dataset.vtool); return; }
    var b = e.target.closest('[data-v]'); if (!b || b.tagName === 'INPUT') return;
    var k = b.dataset.v, list = picked();
    if (k === 'zoomin') { zoomStep(1); return; }
    if (k === 'zoomout') { zoomStep(-1); return; }
    if (!list.length) return;
    if (k === 'hide') { var hide = !list.every(function (o) { return !o.visible; }); record(hide ? 'Hide' : 'Show'); list.forEach(function (o) { o.visible = !hide; }); changed(); }
    else if (k === 'lock') { var lock = !list.every(function (o) { return o.locked; }); record(lock ? 'Lock' : 'Unlock'); list.forEach(function (o) { o.locked = lock; }); changed(); }
    else if (k === 'del') deleteSel();
    else if (k === 'fitboard') {
      var ed = list.filter(editable), bb = boundsOf(ed); if (!bb) return;
      var s = Math.min(doc.w / bb.w, doc.h / bb.h), ox = (doc.w - bb.w * s) / 2, oy = (doc.h - bb.h * s) / 2;
      record('Fit to Artboard'); ed.forEach(function (o) { o.x = ox + (o.x - bb.x) * s; o.y = oy + (o.y - bb.y) * s; o.w *= s; o.h *= s; }); changed();
    }
  }
  function panelInput(e) {
    if (!on) return;
    var i = e.target.closest('[data-v="op"]'); if (!i) return;
    if (!opGesture) { opGesture = true; record('Opacity'); }
    var v = Math.max(0, Math.min(100, +i.value)) / 100;
    picked().forEach(function (o) { o.opacity = v; }); i.nextElementSibling.textContent = Math.round(v * 100) + '%';
    renderArt(); layersRender();
  }
  function panelChange(e) {
    if (!on) return;
    var i = e.target.closest('[data-v]'); if (!i) return;
    if (i.dataset.v === 'op') { opGesture = false; changed(); return; }
    var k = i.dataset.v; if (!/^[xywh]$/.test(k)) return;
    var list = picked().filter(editable), b = boundsOf(list), v = +i.value; if (!b || !isFinite(v)) { panelSync(); return; }
    record('Position');
    if (k === 'x' || k === 'y') { var d = v - b[k]; list.forEach(function (o) { o[k] += d; }); }
    else {
      var s = Math.max(1, v) / b[k];
      list.forEach(function (o) { if (k === 'w') { o.x = b.x + (o.x - b.x) * s; o.w *= s; } else { o.y = b.y + (o.y - b.y) * s; o.h *= s; } });
    }
    changed();
  }

  // ---- LAYERS: its own panel, opened from the left bar's Layers button.
  // Each layer, its objects under it; show or hide, lock, rename, order ----
  var EYE = function (vis) { return CI(vis ? '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>' : '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.4 3M6.5 7.6C4 9.3 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 4-.9"/>'); };
  var LOCK = function (lk) { return CI(lk ? '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/>' : '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 5.6-1.5"/>'); };
  function layersOpen() { return vlp && !vlp.hidden; }
  function layersPanel(open) {
    if (!vlp) return;
    vlp.hidden = !open; B.layersBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); B.layersBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
    if (open) { layersRender(); B.besideBar(vlp, B.layersBtn); }
  }
  function layersRender() {
    if (!layersOpen() || !doc) return;
    var rows = doc.layers.slice().reverse().map(function (L) {
      var head = '<div class="pl-row vl-layer' + (L.id === doc.cur ? ' on' : '') + (L.visible ? '' : ' off') + '" data-vl="' + L.id + '">' +
        '<button type="button" class="pl-eye" data-vl-eye="' + L.id + '" aria-label="' + (L.visible ? 'Hide ' : 'Show ') + esc(L.name) + '" aria-pressed="' + !L.visible + '">' + EYE(L.visible) + '</button>' +
        '<button type="button" class="pl-fold" data-vl-fold="' + L.id + '" aria-expanded="' + L.open + '" aria-label="' + (L.open ? 'Fold' : 'Open') + ' ' + esc(L.name) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>' +
        '<button type="button" class="pl-name" data-vl-name="' + L.id + '" title="Tap again to rename"><span>' + esc(L.name) + '</span></button>' +
        '<button type="button" class="pl-eye vl-lock" data-vl-lock="' + L.id + '" aria-label="' + (L.locked ? 'Unlock ' : 'Lock ') + esc(L.name) + '" aria-pressed="' + L.locked + '">' + LOCK(L.locked) + '</button></div>';
      if (!L.open) return head;
      return head + L.items.slice().reverse().map(function (o) {
        return '<div class="pl-row in-grp' + (sel.indexOf(o.id) >= 0 ? ' on' : '') + (o.visible ? '' : ' off') + '" data-vo="' + o.id + '">' +
          '<button type="button" class="pl-eye" data-vo-eye="' + o.id + '" aria-label="' + (o.visible ? 'Hide ' : 'Show ') + esc(o.name) + '" aria-pressed="' + !o.visible + '">' + EYE(o.visible) + '</button>' +
          '<button type="button" class="pl-name" data-vo-name="' + o.id + '"><svg class="pl-folder" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 16l4.5-4.5 4 4L15 13l5 5"/><circle cx="15.5" cy="9" r="1.5"/></svg><span>' + esc(o.name || 'Picture') + '</span></button>' +
          '<button type="button" class="pl-eye vl-lock" data-vo-lock="' + o.id + '" aria-label="' + (o.locked ? 'Unlock ' : 'Lock ') + esc(o.name) + '" aria-pressed="' + o.locked + '">' + LOCK(o.locked) + '</button></div>';
      }).join('');
    }).join('');
    var cur = curLayer(), ci = doc.layers.indexOf(cur), objs = picked();
    var canUp = objs.length ? objs.every(function (o) { var L = layerOfObj(o); return L.items.indexOf(o) < L.items.length - 1; }) : ci < doc.layers.length - 1;
    var canDown = objs.length ? objs.every(function (o) { return layerOfObj(o).items.indexOf(o) > 0; }) : ci > 0;
    var canDel = objs.length ? objs.some(function (o) { return !o.locked && !layerOfObj(o).locked; }) : doc.layers.length > 1;
    vlp.innerHTML = '<div class="pl-title">Vector Layers</div><div class="pl-list">' + rows + '</div>' +
      '<div class="pl-acts">' +
        '<button type="button" data-vl-act="add" title="New layer" aria-label="New layer">' + CI('<path d="M12 5v14M5 12h14"/>') + '</button>' +
        '<button type="button" data-vl-act="up" title="Move up" aria-label="Move up"' + (canUp ? '' : ' disabled') + '>' + CI('<path d="M12 19V5M6 11l6-6 6 6"/>') + '</button>' +
        '<button type="button" data-vl-act="down" title="Move down" aria-label="Move down"' + (canDown ? '' : ' disabled') + '>' + CI('<path d="M12 5v14M6 13l6 6 6-6"/>') + '</button>' +
        '<button type="button" data-vl-act="del" title="' + (objs.length ? 'Delete the picked objects' : 'Delete the layer') + '" aria-label="Delete"' + (canDel ? '' : ' disabled') + '>' + CI('<path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/>') + '</button>' +
      '</div>';
  }
  function layersClick(e) {
    var b = e.target.closest('button'); if (!b || !doc) return;
    var d = b.dataset, L, o;
    if (d.vlEye) { L = layerOf(d.vlEye); record(L.visible ? 'Hide Layer' : 'Show Layer'); L.visible = !L.visible; changed(); }
    else if (d.vlLock) { L = layerOf(d.vlLock); record(L.locked ? 'Unlock Layer' : 'Lock Layer'); L.locked = !L.locked; changed(); }
    else if (d.vlFold) { L = layerOf(d.vlFold); L.open = !L.open; layersRender(); B.autosave(); }
    else if (d.vlName) {
      L = layerOf(d.vlName);
      if (doc.cur === L.id && !sel.length) { rename(b, L.name, function (v) { record('Rename Layer'); L.name = v; changed(); }); return; }
      doc.cur = L.id; sel = []; drawUI(); panelSync(); layersRender(); B.autosave();
    }
    else if (d.voEye) { o = objById(d.voEye); record(o.visible ? 'Hide' : 'Show'); o.visible = !o.visible; changed(); }
    else if (d.voLock) { o = objById(d.voLock); record(o.locked ? 'Unlock' : 'Lock'); o.locked = !o.locked; changed(); }
    else if (d.voName) {
      o = objById(d.voName);
      if (sel.length === 1 && sel[0] === o.id) { rename(b, o.name, function (v) { record('Rename'); o.name = v; changed(); }); return; }
      if (e.shiftKey || e.metaKey || e.ctrlKey) setSel(sel.indexOf(o.id) >= 0 ? sel.filter(function (x) { return x !== o.id; }) : sel.concat(o.id));
      else setSel([o.id]);
      if (tool !== 'select') setTool('select');
    }
    else if (d.vlAct === 'add') { record('New Layer'); newLayer(); sel = []; changed(); }
    else if (d.vlAct === 'up' || d.vlAct === 'down') order(d.vlAct === 'up' ? 1 : -1);
    else if (d.vlAct === 'del') {
      if (sel.length) deleteSel();
      else if (doc.layers.length > 1) { var cur = curLayer(), i = doc.layers.indexOf(cur); record('Delete Layer'); doc.layers.splice(i, 1); doc.cur = (doc.layers[Math.max(0, i - 1)] || doc.layers[0]).id; changed(); }
    }
  }
  // (up or down: the picked objects within their layers, or the layer itself)
  function order(dir) {
    var objs = picked();
    if (objs.length) {
      record(dir > 0 ? 'Bring Forward' : 'Send Backward');
      var byL = objs.slice().sort(function (a, b) { var A = layerOfObj(a).items.indexOf(a), Bi = layerOfObj(b).items.indexOf(b); return dir > 0 ? Bi - A : A - Bi; });
      byL.forEach(function (o) { var L = layerOfObj(o), i = L.items.indexOf(o), j = i + dir; if (j < 0 || j >= L.items.length) return; L.items.splice(i, 1); L.items.splice(j, 0, o); });
    } else {
      var cur = curLayer(), i = doc.layers.indexOf(cur), j = i + dir; if (j < 0 || j >= doc.layers.length) return;
      record(dir > 0 ? 'Move Layer Up' : 'Move Layer Down'); doc.layers.splice(i, 1); doc.layers.splice(j, 0, cur);
    }
    changed();
  }
  function rename(btn, name, done) {
    var i = document.createElement('input'); i.className = 'pl-rename p-field'; i.value = name; i.maxLength = 40;
    var span = btn.querySelector('span'); span.hidden = true; btn.appendChild(i); i.focus(); i.select();
    var fin = function (ok) { if (!i.parentNode) return; var v = i.value.trim(); i.remove(); span.hidden = false; if (ok && v && v !== name) done(v); else layersRender(); };
    i.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); });
    i.addEventListener('blur', function () { fin(true); });
    i.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  // ---- ARTWORK ACROSS: a copy, never the original ----
  // (the artwork as pixels, fitted into pw × ph the way the artboard fits
  // there, see-through where nothing is)
  function raster(pw, ph, white) {
    var list = []; if (doc) doc.layers.forEach(function (L) { if (L.visible) L.items.forEach(function (o) { if (o.visible) list.push(o); }); });
    return Promise.all(list.map(function (o) { var im = imgFor(o.asset); return im ? im.ready : null; })).then(function () {
      var c = document.createElement('canvas'); c.width = pw; c.height = ph;
      var x = c.getContext('2d'); if (white) { x.fillStyle = '#fff'; x.fillRect(0, 0, pw, ph); }
      if (!doc) return c;
      var s = Math.min(pw / doc.w, ph / doc.h), ox = (pw - doc.w * s) / 2, oy = (ph - doc.h * s) / 2;
      x.imageSmoothingQuality = 'high';
      list.forEach(function (o) { var im = imgFor(o.asset); if (!im || !im.naturalWidth) return; x.globalAlpha = o.opacity; x.drawImage(im, ox + o.x * s, oy + o.y * s, o.w * s, o.h * s); });
      return c;
    });
  }
  function svgText() {
    var out = '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' + doc.w + '" height="' + doc.h + '" viewBox="0 0 ' + doc.w + ' ' + doc.h + '">\n';
    doc.layers.forEach(function (L) {
      if (!L.visible) return;
      out += '<g id="' + esc(L.name).replace(/\s+/g, '_') + '">\n';
      L.items.forEach(function (o) { var a = assets[o.asset]; if (!o.visible || !a) return; out += '<image x="' + o.x + '" y="' + o.y + '" width="' + o.w + '" height="' + o.h + '" opacity="' + o.opacity + '" preserveAspectRatio="none" href="' + a.src + '"/>\n'; });
      out += '</g>\n';
    });
    return out + '</svg>\n';
  }
  function exportBlob(type) {
    if (!doc) return Promise.resolve(null);
    if (type === 'svg') return Promise.resolve(new Blob([svgText()], { type: 'image/svg+xml' }));
    return raster(Math.round(doc.w), Math.round(doc.h), type === 'jpeg').then(function (c) { return new Promise(function (ok) { c.toBlob(ok, type === 'jpeg' ? 'image/jpeg' : 'image/png', 0.93); }); });
  }

  // ---- KEEPING IT: with the drawing, in the browser and in project files ----
  function serialize() {
    if (!doc) return null;
    var used = {}; allObjs().forEach(function (o) { if (assets[o.asset]) used[o.asset] = assets[o.asset]; });
    return { v: 1, w: doc.w, h: doc.h, n: doc.n, cur: doc.cur, layers: JSON.parse(JSON.stringify(doc.layers)), view: { x: view.x, y: view.y, k: view.k, fit: view.fit }, sel: sel.slice(), tool: tool, assets: used };
  }
  function num(v, d) { v = +v; return isFinite(v) ? v : d; }
  function load(d) {
    hist = []; fut = []; sel = []; imgs = {}; assets = {};
    Object.keys(objEls).forEach(function (id) { objEls[id].remove(); }); objEls = {};
    if (!d || !Array.isArray(d.layers) || !(d.w > 0) || !(d.h > 0)) { doc = null; view.fit = true; if (on) leave(); return; }
    var as = d.assets && typeof d.assets === 'object' ? d.assets : {};
    Object.keys(as).forEach(function (id) { var a = as[id]; if (a && typeof a.src === 'string' && /^data:image\//.test(a.src)) assets[id] = { src: a.src, w: num(a.w, 1), h: num(a.h, 1) }; });
    doc = { v: 1, w: num(d.w, 1024), h: num(d.h, 768), n: d.n | 0 || 1, cur: String(d.cur || ''), layers: d.layers.slice(0, 200).map(function (L, i) {
      return { id: String(L.id || 'L' + i), name: String(L.name || 'Layer ' + (i + 1)).slice(0, 40), visible: L.visible !== false, locked: !!L.locked, open: L.open !== false,
        items: (Array.isArray(L.items) ? L.items : []).filter(function (o) { return o && o.type === 'image' && assets[o.asset]; }).slice(0, 2000).map(function (o) {
          return { id: String(o.id), type: 'image', name: String(o.name || 'Picture').slice(0, 40), asset: o.asset, x: num(o.x, 0), y: num(o.y, 0), w: Math.max(1, num(o.w, 1)), h: Math.max(1, num(o.h, 1)), opacity: Math.max(0, Math.min(1, num(o.opacity, 1))), visible: o.visible !== false, locked: !!o.locked };
        }) };
    }) };
    if (!doc.layers.length) doc.layers = blank(doc.w, doc.h).layers;
    if (!layerOf(doc.cur)) doc.cur = doc.layers[doc.layers.length - 1].id;
    sel = (Array.isArray(d.sel) ? d.sel : []).filter(function (id) { return !!objById(id); });
    if (d.view && isFinite(d.view.k) && d.view.k > 0) { view.x = num(d.view.x, 0); view.y = num(d.view.y, 0); view.k = d.view.k; view.fit = !!d.view.fit; } else view.fit = true;
    lastSize = null;
    if (TOOLS[d.tool] && !TOOLS[d.tool].action) { tool = d.tool; cat = catOf(tool).id; lastTool[cat] = tool; }
    renderArt();
    if (on) { relayout(); changed(false); }
  }

  // ---- IN AND OUT OF VECTOR MODE ----
  // (flat: a copy of the painting to bring in, as a picture on a layer of
  // its own; the first time, a blank artboard the painting's size)
  function enter(flat) {
    var sz = B.docSize();
    if (!doc) { doc = blank(sz.pw, sz.ph); view.fit = true; lastSize = null; }
    on = true; stageEl.hidden = false; groupEl.hidden = false;
    renderArt();
    if (view.fit || !lastSize) { lastSize = { w: stageEl.clientWidth, h: stageEl.clientHeight }; if (view.fit) fit(); else { fitView(); applyView(); } } else relayout();
    if (flat) {
      record('Bring Artwork');
      var n = 1; doc.layers.forEach(function (L) { if (/^Painting( \d+)?$/.test(L.name)) n++; });
      var L = newLayer(n > 1 ? 'Painting ' + n : 'Painting');
      var r = place(flat.toDataURL('image/png'), flat.width, flat.height, 'Painting', true);
      L.items.push(r.o); sel = [r.o.id]; doc.cur = L.id; setTool('select');
    }
    groupSync(); changed(!!flat);
    stageEl.style.cursor = tool === 'hand' ? 'grab' : tool === 'zoom' ? 'zoom-in' : 'default';
  }
  function leave() {
    on = false; if (stageEl) stageEl.hidden = true; if (groupEl) groupEl.hidden = true;
    layersPanel(false); drag = null; pinch = null; pts = {}; marquee = zoomBox = null; spaceDown = false;
  }
  // (keys while Vector mode is showing: true when it's dealt with one)
  function key(e) {
    var k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return true; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return true; }
    if (mod && k === 'a') { e.preventDefault(); selectAll(); return true; }
    if (mod && k === '1') { e.preventDefault(); actualSize(); return true; }
    if (mod && (k === 'c' || k === 'v' || k === 'x')) return true; // (a picture pasted comes in by the paste event)
    if (mod || e.altKey) return false;
    if (k === ' ') { e.preventDefault(); if (!spaceDown) { spaceDown = true; stageEl.style.cursor = 'grab'; } return true; }
    if (k === 'escape') { if (layersOpen()) layersPanel(false); else if (sel.length) setSel([]); return true; }
    if ((k === 'delete' || k === 'backspace') && sel.length) { e.preventDefault(); deleteSel(); return true; }
    if (/^arrow/.test(k) && sel.length) { e.preventDefault(); var d = e.shiftKey ? 10 : 1; nudge(k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0, k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0); return true; }
    if (k === 'v') { setTool('select'); return true; }
    if (k === 'h') { setTool('hand'); return true; }
    if (k === 'z') { setTool('zoom'); return true; }
    if (k === '0') { fit(); return true; }
    if (k === '+' || k === '=') { zoomStep(1); return true; }
    if (k === '-') { zoomStep(-1); return true; }
    if (k === 'enter' && sel.length) { setSel([]); return true; }
    return false;
  }
  function keyup(e) { if (e.key === ' ') { spaceDown = false; stageEl.style.cursor = tool === 'hand' ? 'grab' : 'default'; } }

  // ---- SETTING UP: the stage's vector sheet, the left bar's categories,
  // the layers panel, and what's routed here while Vector mode is showing ----
  function init(bridge) {
    B = bridge;
    stageEl = document.createElement('div'); stageEl.className = 'vec-stage'; stageEl.hidden = true;
    stageEl.innerHTML = '<div class="vec-world"><div class="vec-board"></div></div><svg class="vec-ui" aria-hidden="true"></svg>';
    worldEl = stageEl.querySelector('.vec-world'); boardEl = stageEl.querySelector('.vec-board'); uiEl = stageEl.querySelector('.vec-ui');
    artEl = svg('svg', { class: 'vec-art', 'aria-hidden': 'true' }); worldEl.appendChild(artEl);
    B.stage.appendChild(stageEl);
    stageEl.addEventListener('pointerdown', down); stageEl.addEventListener('pointermove', move);
    stageEl.addEventListener('pointerup', up); stageEl.addEventListener('pointercancel', up);
    stageEl.addEventListener('wheel', wheel, { passive: false });
    stageEl.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); });
    stageEl.addEventListener('pointerleave', function (e) { e.stopPropagation(); });
    ['gesturestart', 'gesturechange', 'gestureend', 'dblclick'].forEach(function (t) { stageEl.addEventListener(t, function (e) { e.stopPropagation(); if (t !== 'dblclick') e.preventDefault(); }); });
    if (window.ResizeObserver) new ResizeObserver(function () { relayout(); }).observe(B.stage);
    // (the left bar: the categories, just above Layers and the zoom)
    groupEl = document.createElement('div'); groupEl.className = 'paint-group vec-group'; groupEl.hidden = true;
    groupEl.setAttribute('role', 'group'); groupEl.setAttribute('aria-label', 'Vector tools');
    groupEl.innerHTML = CATS.map(function (c) { return '<button type="button" data-vcat="' + c.id + '" aria-label="' + c.name + '" aria-pressed="false" data-tip="' + esc(c.name + ': ' + c.tools.map(function (t) { return TOOLS[t].name; }).join(', ')) + '">' + CI(ICONS[c.icon]) + '</button>'; }).join('');
    B.leftViewGroup.parentNode.insertBefore(groupEl, B.leftViewGroup);
    groupEl.addEventListener('click', function (e) { var b = e.target.closest('[data-vcat]'); if (b) pickCat(b.dataset.vcat); });
    // (the tool settings panel's own controls, when it shows Vector's)
    B.ctxTool.addEventListener('click', panelClick); B.ctxTool.addEventListener('input', panelInput); B.ctxTool.addEventListener('change', panelChange);
    // (the layers panel, built like the painting's)
    vlp = document.createElement('div'); vlp.className = 'paint-layerpanel vec-layerpanel'; vlp.hidden = true; vlp.setAttribute('role', 'dialog'); vlp.setAttribute('aria-label', 'Vector layers');
    B.root.appendChild(vlp); B.draggable(vlp, '.pl-title', 'vlayers');
    vlp.addEventListener('click', layersClick);
    // (while Vector mode shows, the left bar's Layers button, the zoom and
    // the bottom bar's undo and redo are Vector's)
    document.addEventListener('click', function (e) {
      if (!on) return;
      var t = e.target.closest('[data-act="layers"], [data-zoom], [data-act="undo"], [data-act="redo"]'); if (!t || !B.root.contains(t)) return;
      e.stopPropagation(); e.preventDefault();
      if (t.dataset.act === 'layers') layersPanel(!layersOpen());
      else if (t.dataset.act === 'undo') undo();
      else if (t.dataset.act === 'redo') redo();
      else if (t.dataset.zoom === 'in') zoomStep(1);
      else if (t.dataset.zoom === 'out') zoomStep(-1);
      else fit();
    }, true);
    document.addEventListener('pointerdown', function (e) { if (on && layersOpen() && !e.target.closest('.vec-layerpanel, [data-act="layers"]')) layersPanel(false); }, true);
  }

  window.PaintVector = {
    init: init, enter: enter, leave: leave, load: load, serialize: serialize, isEmpty: isEmpty,
    panelHTML: panelHTML, key: key, keyup: keyup, histButtons: histButtons, raster: raster, exportBlob: exportBlob,
    addImageFile: addImageFile, relayout: relayout, panelSync: panelSync, isOn: function () { return on; }
  };
})();
