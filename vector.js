/* PAINT ALTERNATIVE: VECTOR MODE. A workspace of its own beside the
   painting, kept with the same drawing: its own artboard, layers (and
   sublayers), groups and objects, undo and redo, view and selection.
   paint.js starts it with a bridge (B) to what it shares: the stage, the
   left bar, the tool settings panel, the layers button, the bottom bar
   (stroke width, undo, fill, swap, stroke, redo, opacity, quick options),
   the colour picker, saving and toasts. Nothing here ever touches the
   painting; artwork only goes across as a copy (raster() one way,
   enter(flat) the other).

   The parts, in order: THE TOOLS (one registry: categories, tools, icons,
   keys) · GEOMETRY (cubic Béziers: split, flatten, nearest, fit) · THE
   DOCUMENT (the tree of layers, groups and objects; live shapes; how each
   looks) · DRAWING IT (SVG on the screen, a canvas for pixels) · UNDO ·
   THE VIEW · PICKING · each tool's pointer handling · THE PANEL ·
   THE BOTTOM BAR · LAYERS · keeping it · in and out. */
(function () {
  'use strict';
  var B = null;                       // (the bridge from paint.js)
  var doc = null;                     // (the vector document; null until Vector mode is first opened)
  var assets = {};                    // id -> { src: a data URL, w, h }: pictures, shared by objects and undo steps
  var imgs = {};                      // id -> an <img>, loaded, for drawing on a canvas
  var hist = [], fut = [], HMAX = 200;
  var sel = [];                       // (the picked nodes' ids)
  var asel = {};                      // (anchors picked for editing: object id -> { 'si:pi': 1 })
  var on = false;
  var view = { x: 0, y: 0, k: 1, r: 0, fit: true }, fitK = 1;
  var tool = 'select', cat = 'selection', lastTool = {};
  var focusF = -1, focusS = -1;       // (which fill and which stroke the colours edit: -1, the top one)
  var stageEl, worldEl, boardsEl, gridEl, artEl, artRoot, defsEl, uiEl, groupEl, vlp, ctxMenu;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var KAPPA = 0.5522847498;

  // ---- THE TOOLS: one registry for the categories in the left bar and
  // the tools in each, so the bar and the panel are both made from it ----
  var CI = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; };
  var ARROW = 'M6 3.5l12 9-5.2 1.1 3.2 6.3-2.6 1.3-3.2-6.4L6 18.5z';
  var NIB = '<path d="M12.5 4.2l6 6-2.7 6.3-7.6 3.3-3.4-3.4 3.3-7.6z"/><path d="M5 19l5.3-5.3"/><circle cx="11.6" cy="12.4" r="1.6"/>';
  var SNIB = '<path d="M10.5 3.2l5 5-2.2 5.3-6.4 2.8-2.9-2.9 2.8-6.4z"/><path d="M4 16.4l4.5-4.5"/>';
  var ICONS = {
    select: '<path d="' + ARROW + '" fill="currentColor"/>',
    direct: '<path d="' + ARROW + '"/>',
    lasso: '<path d="M8 15.2C5.4 14.1 3.8 12.3 3.8 10.3 3.8 6.8 7.5 4 12 4s8.2 2.8 8.2 6.3-3.7 6.3-8.2 6.3" stroke-dasharray="2.4 2.1"/><path d="M8.5 13.5l1 7 1.7-2.2 2.8.4z" fill="currentColor"/>',
    wand: '<path d="M4 20l10.5-10.5"/><path d="M14.5 9.5l2-2"/><path d="M18 3v2.5M21 6.5h-2.5M20.2 3.8l-1.6 1.6M14.2 4.6l1.2 1.2M19.6 10.1l-1.2-1.2"/>',
    groupsel: '<path d="M4.5 3.5l10 7.5-4.3.9 2.7 5.3-2.2 1.1-2.7-5.4-3.5 3.1z"/><path d="M18 14v6.5M14.75 17.25h6.5"/>',
    pen: NIB,
    curvature: '<path d="M3.5 19C6 9.5 10.5 15.5 13 9.5"/><path d="M14 5l5 5-3.5 1.5-3-3z"/><circle cx="3.5" cy="19" r="1"/>',
    anchor: '<path d="M5 20.5L12 8l7 12.5"/><rect x="10" y="3.5" width="4" height="4" rx=".7"/>',
    convert: '<path d="M4 18.5c2-8.5 14-8.5 16 0"/><rect x="10" y="8" width="4" height="4" rx=".7"/><path d="M4 10h4.5M15.5 10H20"/>',
    addpt: SNIB + '<path d="M18 14.5v6M15 17.5h6"/>',
    delpt: SNIB + '<path d="M15 17.5h6"/>',
    scissors: '<circle cx="6.5" cy="7" r="2.6"/><circle cx="6.5" cy="17" r="2.6"/><path d="M8.7 8.5L20 16M8.7 15.5L20 8"/>',
    knife: '<path d="M3.5 20.5L16.5 7.5l3 3-8.5 8.5z"/><path d="M16.5 7.5L19 5"/>',
    join: '<path d="M3 18c3 0 4.5-10 9-10s6 10 9 10"/><circle cx="12" cy="8" r="1.8" fill="currentColor"/>',
    simplify: '<path d="M3.5 12l2-2.5 2 2.5 2-2.5 2 2.5 2-2.5 2 2.5 2-2.5 2 2.5" opacity=".5"/><path d="M3.5 18c5.5-5 11.5-5 17 0"/>',
    rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
    rrect: '<rect x="4" y="6" width="16" height="12" rx="4"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6.5"/>',
    polygon: '<path d="M12 3.5l7.5 4.25v8.5L12 20.5l-7.5-4.25v-8.5z"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8z"/>',
    spiral: '<path d="M12 12.4c.6 0 1 .5 1 1 0 .9-.9 1.6-1.9 1.5-1.4-.1-2.3-1.4-2.1-2.8.3-1.8 2-3 3.8-2.7 2.3.4 3.7 2.6 3.3 4.9-.5 2.8-3.2 4.6-6 4.1C7 17.9 4.9 14.8 5.5 11.4 6.2 7.4 10 4.9 14 5.6"/>',
    line: '<path d="M5 19L19 5"/>',
    arc: '<path d="M5 19C5 11 11 5 19 5"/>',
    rgrid: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/>',
    pgrid: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3.5v17M3.5 12h17"/>',
    solid: '<rect x="4.5" y="4.5" width="15" height="15" rx="2.5" fill="currentColor" fill-opacity=".8"/>',
    gradient: '<rect x="4.5" y="4.5" width="15" height="15" rx="2.5"/><path d="M4.5 7A2.5 2.5 0 0 1 7 4.5h2v15H7A2.5 2.5 0 0 1 4.5 17z" fill="currentColor" stroke="none"/><path d="M9 4.5h3.5v15H9z" fill="currentColor" opacity=".55" stroke="none"/><path d="M12.5 4.5H16v15h-3.5z" fill="currentColor" opacity=".22" stroke="none"/>',
    eyedropper: '<path d="M14.6 4.6a2.7 2.7 0 0 1 3.8 0l1 1a2.7 2.7 0 0 1 0 3.8l-1.9 1.9.7.7-1.5 1.5-5.7-5.7 1.5-1.5.7.7z"/><path d="M11.9 9.6l-6.5 6.5a2 2 0 0 0-.6 1.4V19.2h1.7a2 2 0 0 0 1.4-.6l6.5-6.5"/>',
    swatches: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="4" y="13" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    vfill: '<path d="M10.6 4.2l7.7 7.7-6.4 6.4a2 2 0 0 1-2.8 0l-4.9-4.9a2 2 0 0 1 0-2.8z"/><path d="M4.6 12.4h13.2"/><path d="M10.6 4.2L8.4 2"/><path d="M20.5 15.2c.9 1.3 1.5 2.3 1.5 3.1a1.5 1.5 0 0 1-3 0c0-.8.6-1.8 1.5-3.1z"/>',
    cpick: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5V9M12 15v5.5M3.5 12H9M15 12h5.5"/>',
    swidth: '<path d="M4 6h16" stroke-width="1"/><path d="M4 11.5h16" stroke-width="2.2"/><path d="M4 17.5h16" stroke-width="3.6"/>',
    vwidth: '<path d="M3.5 13C8 8.5 16 8.5 20.5 13 16 15.5 8 15.5 3.5 13z"/><circle cx="12" cy="9.7" r="1.4" fill="currentColor"/>',
    sprofile: '<path d="M4 7c5-2.6 11-2.6 16 0-5 2.6-11 2.6-16 0z"/><path d="M4 17c4-3.6 12-1.5 16 0-4 1.5-12 3.6-16 0z"/>',
    capjoin: '<path d="M7 19.5V9h10" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round" opacity=".3"/><path d="M7 19.5V9h10"/>',
    dash: '<path d="M3.5 12h3.5M10 12h3.5M16.5 12h4" stroke-width="2.4"/>',
    appear: '<rect x="4" y="4" width="12" height="12" rx="2"/><rect x="8" y="8" width="12" height="12" rx="2" fill="currentColor" fill-opacity=".25"/>',
    opacity: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
    blend: '<circle cx="9.5" cy="12" r="5.5"/><circle cx="14.5" cy="12" r="5.5"/><path d="M12 7.3a5.5 5.5 0 0 1 0 9.4 5.5 5.5 0 0 1 0-9.4z" fill="currentColor" stroke="none" opacity=".45"/>',
    hand: '<path d="M8 12.5V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5V5a1.5 1.5 0 0 1 3 0v5.5"/><path d="M14 10.5V6.5a1.5 1.5 0 0 1 3 0V14a6.5 6.5 0 0 1-6.5 6.5h-.4a5.5 5.5 0 0 1-4.4-2.2L3.6 15.4a1.5 1.5 0 0 1 2.3-1.9L8 15.5"/>',
    zoom: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5M10.5 8v5"/>',
    fit: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M3.5 8V5a1.5 1.5 0 0 1 1.5-1.5h3M16 3.5h3A1.5 1.5 0 0 1 20.5 5v3M20.5 16v3a1.5 1.5 0 0 1-1.5 1.5h-3M8 20.5H5A1.5 1.5 0 0 1 3.5 19v-3"/>',
    actual: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 10l1.5-1v6M14 10l1.5-1v6"/><path d="M12 11v.01M12 14v.01"/>',
    rotview: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4.5h-4.5"/><rect x="8.5" y="9" width="7" height="6" rx="1"/>',
    shapes: '<rect x="3.5" y="11.5" width="8" height="8" rx="1.5"/><circle cx="16" cy="8" r="4.5"/><path d="M16.5 14.5l4 6h-8z"/>',
    fillcat: '<path d="M10.6 4.2l7.7 7.7-6.4 6.4a2 2 0 0 1-2.8 0l-4.9-4.9a2 2 0 0 1 0-2.8z" fill="currentColor" fill-opacity=".3"/><path d="M10.6 4.2L8.4 2"/><path d="M20.5 15.2c.9 1.3 1.5 2.3 1.5 3.1a1.5 1.5 0 0 1-3 0c0-.8.6-1.8 1.5-3.1z"/>',
    pencil: '<path d="M15.5 4.5l4 4L8.5 19.5 4 20l.5-4.5z"/><path d="M13 7l4 4"/>',
    vbrush: '<path d="M20.5 3.5c-3.5 1.5-7.5 5-9.5 8l2 2c3-2 6.5-6 7.5-10z"/><path d="M10.5 12.5c-2.5 0-4 1.5-4 3.5 0 1.3-.8 2.3-2.5 2.8 3 1.8 7.5.7 8.5-3.8"/>',
    blob: '<path d="M20 3.5l.5.5-7 7.5-1.5-1.5z"/><path d="M11 10.5c-1.8-.3-3.5 1-3.5 2.8 0 1-.6 1.6-1.6 1.9 1.7 1.2 4.4 1 5.8-.8.6-.8.6-1.9.3-2.4z" fill="currentColor" fill-opacity=".35"/><path d="M3.5 20c2.5-2 5-2 7.5-.5 2 1.2 4 1.5 6.5-.5" stroke-width="2.4" opacity=".6"/>',
    smooth: '<path d="M16.5 3.5l4 4-9 9-4.5.5.5-4.5z"/><path d="M3 20.5c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0"/>',
    veraser: '<path d="M8.5 19.5l-4-4a1.5 1.5 0 0 1 0-2.1l9-9a1.5 1.5 0 0 1 2.1 0l4.5 4.5a1.5 1.5 0 0 1 0 2.1L12 19.5z"/><path d="M9 9l6.5 6.5M8.5 19.5h11"/>',
    builder: '<circle cx="9.5" cy="10" r="5.5"/><circle cx="14.5" cy="14" r="5.5"/><path d="M14.5 10a5.5 5.5 0 0 1 .5 2.3 5.5 5.5 0 0 1-.5 2.2 5.5 5.5 0 0 1-5-4.5 5.5 5.5 0 0 1 5 0z" fill="currentColor" fill-opacity=".35" stroke="none"/>',
    union: '<path d="M4 4h10v6h6v10H10v-6H4z" fill="currentColor" fill-opacity=".35"/>',
    minus: '<path d="M4 4h10v6h-4v4H4z" fill="currentColor" fill-opacity=".35"/><path d="M10 10h10v10H10z" stroke-dasharray="2 2"/>',
    intersect: '<path d="M4 4h10v10H4zM10 10h10v10H10z" stroke-dasharray="2 2"/><path d="M10 10h4v4h-4z" fill="currentColor" fill-opacity=".5"/>',
    exclude: '<path d="M4 4h10v6h-4v4H4zM14 10h6v10H10v-6h4z" fill="currentColor" fill-opacity=".35"/><path d="M10 10h4v4h-4z"/>',
    divide: '<path d="M4 4h10v10H4zM10 10h10v10H10z"/><path d="M10 10h4v4h-4z" fill="currentColor" fill-opacity=".35"/>',
    compound: '<path fill-rule="evenodd" d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="currentColor" fill-opacity=".35"/>',
    clipmask: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5" stroke-dasharray="2 2" opacity=".6"/><circle cx="12" cy="12" r="5.5"/><path d="M8.5 14.5l2.5-2.5 2 2 1.5-1.5 2 2" />',
    ftrans: '<rect x="6" y="7" width="12" height="12" stroke-dasharray="2 2"/><rect x="4.5" y="5.5" width="3" height="3" rx=".6"/><rect x="16.5" y="5.5" width="3" height="3" rx=".6"/><rect x="4.5" y="17.5" width="3" height="3" rx=".6"/><rect x="16.5" y="17.5" width="3" height="3" rx=".6"/><path d="M12 7V3.5"/><circle cx="12" cy="2.8" r=".8" fill="currentColor"/>',
    move: '<path d="M12 3v18M3 12h18M9.5 5.5L12 3l2.5 2.5M9.5 18.5L12 21l2.5-2.5M5.5 9.5L3 12l2.5 2.5M18.5 9.5L21 12l-2.5 2.5"/>',
    scale: '<rect x="4" y="10" width="10" height="10" rx="1"/><path d="M10 4h10v10" stroke-dasharray="2 2"/><path d="M11 13l8-8M14 5h5v5"/>',
    rotate: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4h-4"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
    reflect: '<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M9.5 6L3.5 18h6z"/><path d="M14.5 6l6 12h-6z" fill="currentColor" fill-opacity=".35"/>',
    shear: '<rect x="4" y="5" width="12" height="14" stroke-dasharray="2 2" opacity=".55"/><path d="M8 5h12l-4 14H4z"/>',
    distort: '<path d="M4 6l16-2-3 16-11-3z"/><circle cx="4" cy="6" r="1.4" fill="currentColor"/><circle cx="20" cy="4" r="1.4" fill="currentColor"/><circle cx="17" cy="20" r="1.4" fill="currentColor"/><circle cx="6" cy="17" r="1.4" fill="currentColor"/>',
    text: '<path d="M5 6.5v-2h14v2M12 4.5v15M9 19.5h6"/>',
    areatext: '<rect x="3.5" y="3.5" width="17" height="17" rx="2" stroke-dasharray="2 2"/><path d="M8 8.5v-1h8v1M12 7.5v9M10.5 16.5h3"/>',
    ptext: '<path d="M3.5 19C7 10 17 10 20.5 19" stroke-dasharray="2 2"/><path d="M8 6.5V5h8v1.5M12 5v8M10.5 13h3"/>',
    vtext: '<path d="M6.5 5h-2v14h2M4.5 12h15M19.5 9.5v5"/>',
    chedit: '<path d="M4 7V5h10v2M9 5v13M7 18h4"/><rect x="14" y="11" width="6.5" height="8" rx="1" stroke-dasharray="2 1.5"/>',
    outlines: '<path d="M4 20L10 4h4l6 16h-4l-1.4-4H9.4L8 20z"/><path d="M10.6 12.5h2.8L12 8.5z"/>',
    align: '<path d="M4 3v18"/><rect x="7" y="6" width="12" height="4.5" rx="1"/><rect x="7" y="13.5" width="7" height="4.5" rx="1"/>',
    distribute: '<path d="M4 3v18M20 3v18"/><rect x="7.5" y="7" width="3" height="10" rx="1"/><rect x="13.5" y="7" width="3" height="10" rx="1"/>',
    dspace: '<rect x="3.5" y="7" width="4" height="10" rx="1"/><rect x="16.5" y="7" width="4" height="10" rx="1"/><path d="M9.5 12h5M11 10.5L9.5 12l1.5 1.5M13 10.5l1.5 1.5-1.5 1.5"/>',
    front: '<path d="M7 3.5h10M12 6.5v8M9 9.5l3-3 3 3"/><path d="M4 16.5l8 4 8-4"/>',
    fwd: '<path d="M12 4v9M8.5 7.5L12 4l3.5 3.5"/><path d="M4 15l8 4 8-4"/>',
    back: '<path d="M12 4v9M8.5 9.5L12 13l3.5-3.5"/><path d="M4 15l8 4 8-4"/>',
    backmost: '<path d="M12 3.5v8M9 8.5l3 3 3-3M7 14.5h10"/><path d="M4 17.5l8 4 8-4"/>',
    groupun: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5" stroke-dasharray="2.5 2"/><rect x="7" y="7" width="6" height="6" rx="1"/><circle cx="15" cy="15" r="3"/>',
    vblend: '<circle cx="5.5" cy="17.5" r="2.5"/><circle cx="9.8" cy="13.6" r="2.3" opacity=".75"/><circle cx="14.2" cy="10.2" r="2.3" opacity=".5"/><circle cx="18.5" cy="6.5" r="2.5" fill="currentColor"/>',
    warp: '<path d="M4 7c4-3 12 3 16 0v10c-4 3-12-3-16 0z"/><path d="M4 12c4-3 12 3 16 0" opacity=".5"/>',
    envelope: '<path d="M4 5c5 2 11 2 16 0l-1 14c-4-2-10-2-14 0z"/><path d="M12 5.8l-.3 13M4.5 12c5 1.5 10 1.5 15 0" opacity=".55"/>',
    offset: '<rect x="8" y="8" width="8" height="8" rx="1.5"/><rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke-dasharray="2.5 2"/>',
    repeat: '<circle cx="12" cy="5.5" r="2.3"/><circle cx="18" cy="15.5" r="2.3" opacity=".6"/><circle cx="6" cy="15.5" r="2.3" opacity=".6"/><path d="M15.5 6.8a7.5 7.5 0 0 1 3.2 5.2M5.3 12a7.5 7.5 0 0 1 3.2-5.2M9.5 19.4a7.5 7.5 0 0 0 5 0" opacity=".45"/>',
    pattern: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.7" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.7" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.7" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.7" fill="currentColor"/>',
    transp: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M12 3.5h6a2.5 2.5 0 0 1 2.5 2.5v6H12zM3.5 12H12v8.5H6A2.5 2.5 0 0 1 3.5 18z" fill="currentColor" fill-opacity=".35" stroke="none"/>',
    artboard: '<rect x="6" y="6" width="12" height="12" rx="1"/><path d="M6 2.5V4M18 2.5V4M6 20v1.5M18 20v1.5M2.5 6H4M2.5 18H4M20 6h1.5M20 18h1.5"/>',
    abnew: '<rect x="3.5" y="3.5" width="12" height="12" rx="1.5"/><path d="M18.5 14.5v6M15.5 17.5h6"/>',
    abresize: '<rect x="3.5" y="3.5" width="11" height="11" rx="1.5"/><path d="M14.5 9.5h6v11h-11v-6" stroke-dasharray="2 2"/><path d="M12 12l6.5 6.5M18.5 14v4.5H14"/>',
    abdup: '<rect x="3.5" y="3.5" width="11" height="11" rx="1.5"/><path d="M17.5 9.5h1.5a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 9.5 19v-1.5"/><path d="M9 6.5v5M6.5 9h5"/>',
    abarr: '<rect x="3.5" y="4" width="7" height="9" rx="1"/><rect x="13.5" y="11" width="7" height="9" rx="1"/><path d="M7 16.5v1a2 2 0 0 0 2 2h1.5M17 7.5v-1a2 2 0 0 0-2-2h-1.5"/>',
    abset: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M7.5 9h9M7.5 15h9"/><circle cx="10" cy="9" r="1.7" fill="currentColor"/><circle cx="14.5" cy="15" r="1.7" fill="currentColor"/>',
    rulers: '<path d="M3.5 3.5h17v5h-12v12h-5z"/><path d="M8.5 3.5V6M12.5 3.5v2M16.5 3.5V6M3.5 12.5h2M3.5 16.5H6"/>',
    guides: '<path d="M3 8h18M15 3v18" stroke-dasharray="2.5 2"/><rect x="5" y="11" width="6.5" height="6.5" rx="1"/>',
    smartg: '<rect x="4" y="6" width="6" height="11" rx="1"/><rect x="14" y="10" width="6" height="7" rx="1"/><path d="M2.5 20h19" stroke-dasharray="2 2"/>',
    grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" stroke-dasharray="1.5 1.5"/>',
    snapgrid: '<path d="M3.5 8h17M3.5 16h17M8 3.5v17M16 3.5v17" opacity=".5"/><circle cx="16" cy="16" r="2.6" fill="currentColor"/>',
    snappts: '<path d="M4 19.5L12 7l8 12.5" opacity=".5"/><rect x="9.25" y="4.25" width="5.5" height="5.5" rx=".8"/><circle cx="12" cy="7" r="1.1" fill="currentColor"/>',
    snapobj: '<circle cx="11" cy="13" r="7.5"/><rect x="14" y="4" width="5.5" height="5.5" rx=".8" fill="currentColor"/>',
    measure: '<path d="M3.5 17.5L17.5 3.5l3 3-14 14z"/><path d="M8 13l1.5 1.5M10.5 10.5l2 2M13 8l1.5 1.5M15.5 5.5l2 2"/>'
  };
  // (the categories, in the left bar's order, and the tools in each)
  var CATS = [
    { id: 'selection', name: 'Selection', icon: 'select', tools: ['select', 'direct', 'lasso', 'wand', 'groupsel'] },
    { id: 'paths', name: 'Pen & Paths', icon: 'pen', tools: ['pen', 'curvature', 'anchor', 'addpt', 'delpt', 'convert', 'scissors', 'knife', 'join', 'simplify'] },
    { id: 'drawing', name: 'Drawing', icon: 'pencil', tools: ['pencil', 'vbrush', 'blob', 'smooth', 'veraser'] },
    { id: 'shapes', name: 'Shapes', icon: 'shapes', tools: ['rect', 'rrect', 'ellipse', 'polygon', 'star', 'spiral', 'line', 'arc', 'rgrid', 'pgrid'] },
    { id: 'shapeops', name: 'Shape Operations', icon: 'builder', tools: ['builder', 'union', 'minus', 'intersect', 'exclude', 'divide', 'compound', 'clipmask'] },
    { id: 'transform', name: 'Transform', icon: 'ftrans', tools: ['ftrans', 'move', 'scale', 'rotate', 'reflect', 'shear', 'distort'] },
    { id: 'type', name: 'Typography', icon: 'text', tools: ['text', 'areatext', 'ptext', 'vtext', 'chedit', 'outlines'] },
    { id: 'fill', name: 'Fill & Color', icon: 'fillcat', tools: ['solid', 'gradient', 'eyedropper', 'swatches', 'vfill', 'cpick'] },
    { id: 'stroke', name: 'Stroke & Appearance', icon: 'swidth', tools: ['swidth', 'vwidth', 'sprofile', 'capjoin', 'dash', 'appear', 'opacity', 'blend'] },
    { id: 'effects', name: 'Effects', icon: 'warp', tools: ['vblend', 'warp', 'envelope', 'offset', 'repeat', 'pattern', 'transp'] },
    { id: 'arrange', name: 'Align & Arrange', icon: 'align', tools: ['align', 'distribute', 'dspace', 'fwd', 'back', 'front', 'backmost', 'groupun'] },
    { id: 'boards', name: 'Artboards', icon: 'artboard', tools: ['artboard', 'abnew', 'abresize', 'abdup', 'abarr', 'abset'] },
    { id: 'navigation', name: 'Navigation', icon: 'hand', tools: ['hand', 'zoom', 'fit', 'actual', 'rotview'] },
    { id: 'precision', name: 'Guides & Precision', icon: 'rulers', tools: ['rulers', 'guides', 'smartg', 'grid', 'snapgrid', 'snappts', 'snapobj', 'measure'] }
  ];
  var TOOLS = {
    select: { name: 'Selection', key: 'v', tip: 'Selection (V): pick objects to move or size them; drag round several. Alt-drag copies' },
    direct: { name: 'Direct Selection', key: 'a', tip: 'Direct Selection (A): pick and drag a path’s anchor points and their handles' },
    lasso: { name: 'Lasso', key: 'q', tip: 'Lasso (Q): draw round anchor points (or whole objects) to pick them' },
    wand: { name: 'Magic Wand', key: 'y', tip: 'Magic Wand (Y): tap an object to pick everything like it' },
    groupsel: { name: 'Group Selection', tip: 'Group Selection: tap an object inside a group to pick it alone; tap again for the group round it' },
    pen: { name: 'Pen', key: 'p', tip: 'Pen (P): click for corners, drag for curves; click the first point to close' },
    curvature: { name: 'Curvature', tip: 'Curvature: click points and the path curves smoothly through them; double-click for a corner' },
    anchor: { name: 'Anchor Point', tip: 'Anchor Point: tap a curved point to make it a corner, drag one to pull out handles, drag a handle on its own' },
    addpt: { name: 'Add Anchor', tip: 'Add Anchor Point: tap a path to add a point without changing its shape' },
    delpt: { name: 'Delete Anchor', tip: 'Delete Anchor Point: tap a point to take it away, keeping the shape as near as it can' },
    convert: { name: 'Convert Point', tip: 'Convert Anchor Point: tap a point to switch it between corner and smooth; tap a segment to straighten or curve it' },
    scissors: { name: 'Scissors', key: 'c', tip: 'Scissors (C): tap a path to cut it there' },
    knife: { name: 'Knife', tip: 'Knife: drag across shapes to cut them into pieces' },
    join: { name: 'Join Paths', key: 'j', tip: 'Join Paths (J): drag from one open end to another to join them (Ctrl/⌘ J joins the picked paths)' },
    simplify: { name: 'Simplify Path', tip: 'Simplify Path: fewer anchor points, the same shape. Tap a path, or set how close and use Simplify' },
    rect: { name: 'Rectangle', key: 'm', shape: true, tip: 'Rectangle (M): drag to draw; Shift for a square, Alt from the middle. Tap to make one the size set here' },
    rrect: { name: 'Rounded Rectangle', shape: true, tip: 'Rounded Rectangle: drag to draw; Shift for a square, Alt from the middle' },
    ellipse: { name: 'Ellipse', key: 'l', shape: true, tip: 'Ellipse (L): drag to draw; Shift for a circle, Alt from the middle' },
    polygon: { name: 'Polygon', shape: true, tip: 'Polygon: drag out from the middle; the direction turns it, Shift keeps it upright' },
    star: { name: 'Star', shape: true, tip: 'Star: drag out from the middle; the direction turns it, Shift keeps it upright' },
    spiral: { name: 'Spiral', shape: true, tip: 'Spiral: drag out from the middle' },
    line: { name: 'Line', shape: true, tip: 'Line: drag to draw; Shift for steps of 45°, Alt from the middle' },
    arc: { name: 'Arc', shape: true, tip: 'Arc: drag from where it starts to where it ends' },
    rgrid: { name: 'Rectangular Grid', shape: true, tip: 'Rectangular Grid: drag to draw a grid of rows and columns' },
    pgrid: { name: 'Polar Grid', shape: true, tip: 'Polar Grid: drag to draw rings and spokes' },
    solid: { name: 'Solid Fill', tip: 'Solid Fill: tap objects to fill them with the fill colour' },
    gradient: { name: 'Gradient', key: 'g', tip: 'Gradient (G): tap an object to give it the gradient; drag across it to set the direction' },
    eyedropper: { name: 'Eyedropper', key: 'i', tip: 'Eyedropper (I): tap an object to copy how it looks onto what’s picked; Shift-tap for just the colour under the pointer' },
    swatches: { name: 'Swatches', tip: 'Swatches: tap a swatch for the picked objects’ fill or stroke' },
    vfill: { name: 'Vector Fill', key: 'k', tip: 'Vector Fill (K): tap inside a shape to fill it, or inside an area closed off by lines to fill that area with a new shape' },
    cpick: { name: 'Color Picker', tip: 'Color Picker: set the fill and stroke colours exactly' },
    swidth: { name: 'Stroke Width', tip: 'Stroke Width: how thick the outline is' },
    vwidth: { name: 'Variable Width', key: 'W', tip: 'Variable Width (Shift W): drag out from a stroke to make it wider there; drag a width point along it; double-tap one to take it away' },
    sprofile: { name: 'Stroke Profiles', tip: 'Stroke Profiles: tapered, bulging or pinched strokes' },
    capjoin: { name: 'Caps & Joins', tip: 'Caps and Joins: the ends of open paths, and their corners' },
    dash: { name: 'Dashed Strokes', tip: 'Dashed Strokes: dashes and gaps along the stroke' },
    appear: { name: 'Fills & Strokes', tip: 'Multiple Fills and Strokes: more than one fill and stroke on an object, stacked' },
    opacity: { name: 'Opacity', tip: 'Opacity: how solid objects are, and their fill and stroke on their own' },
    blend: { name: 'Blend Modes', tip: 'Blend Modes: how objects mix with what’s under them' },
    hand: { name: 'Hand', key: 'h', tip: 'Hand (H): drag to move round the artboard. Space does it with any tool' },
    // (no tool in hand: a tap on the empty workspace puts it down, as in Paint;
    // in no category, so nothing in the left bar is lit, and a drag moves round)
    none: { name: 'No Tool', tip: 'No tool: drag to move round the artboard. Pick a tool on the left to carry on' },
    zoom: { name: 'Zoom', key: 'z', tip: 'Zoom (Z): tap to zoom in, Alt-tap to zoom out, drag a box to zoom to it' },
    fit: { name: 'Fit to Screen', action: true, tip: 'Fit to Screen (0): the whole artboard, upright' },
    actual: { name: 'Actual Size', action: true, tip: 'Actual Size (Ctrl/⌘ 1): one pixel of the artboard to one on the screen' },
    rotview: { name: 'Rotate View', key: 'H', tip: 'Rotate View (Shift H): drag to turn the view (the artwork stays as it is); Shift for steps of 15°' },
    pencil: { name: 'Pencil', tip: 'Pencil: draw freehand lines; they’re smoothed into curves' },
    vbrush: { name: 'Vector Brush', key: 'b', tip: 'Vector Brush (B): brush strokes that stay editable paths: round, tapered, brush pen or calligraphic' },
    blob: { name: 'Blob Brush', key: 'B', tip: 'Blob Brush (Shift B): paint filled shapes that merge with others of the same colour' },
    smooth: { name: 'Smooth', tip: 'Smooth: drag along a picked path to smooth it there' },
    veraser: { name: 'Vector Eraser', key: 'E', tip: 'Vector Eraser (Shift E): rub out parts of shapes and lines' },
    builder: { name: 'Shape Builder', key: 'M', tip: 'Shape Builder (Shift M): drag across the parts of the picked shapes to join them; Alt-drag to take parts away' },
    union: { name: 'Union', action: true, tip: 'Pathfinder Union: the picked shapes become one' },
    minus: { name: 'Subtract', action: true, tip: 'Pathfinder Subtract: the shapes in front cut away the one at the back' },
    intersect: { name: 'Intersect', action: true, tip: 'Pathfinder Intersect: just where the picked shapes overlap' },
    exclude: { name: 'Exclude', action: true, tip: 'Pathfinder Exclude: where they overlap is cut away' },
    divide: { name: 'Divide', action: true, tip: 'Pathfinder Divide: cut into separate pieces wherever they cross' },
    compound: { name: 'Compound Path', action: true, tip: 'Compound Path (Ctrl/⌘ 8): the picked paths become one, with holes where they overlap; again to release' },
    clipmask: { name: 'Clipping Mask', action: true, tip: 'Clipping Mask (Ctrl/⌘ 7): the shape on top shows only what’s inside it; again to release' },
    ftrans: { name: 'Free Transform', key: 'e', tip: 'Free Transform (E): size, turn and slant what’s picked with its handles' },
    move: { name: 'Move', tip: 'Move: drag what’s picked from anywhere, or move it by an exact distance' },
    scale: { name: 'Scale', key: 's', tip: 'Scale (S): size what’s picked from a point; tap to set the point' },
    rotate: { name: 'Rotate', key: 'r', tip: 'Rotate (R): turn what’s picked about a point; tap to set the point' },
    reflect: { name: 'Reflect', key: 'o', tip: 'Reflect (O): mirror what’s picked across a line' },
    shear: { name: 'Shear', tip: 'Shear: slant what’s picked' },
    distort: { name: 'Distort', tip: 'Distort: pull each corner of what’s picked on its own, in perspective' },
    text: { name: 'Text', key: 't', tip: 'Text (T): tap for a line of text, drag for a text box; tap text to edit it' },
    areatext: { name: 'Area Text', tip: 'Area Text: tap inside a shape to fill it with text' },
    ptext: { name: 'Text on Path', tip: 'Text on Path: tap a path to write along it' },
    vtext: { name: 'Vertical Text', tip: 'Vertical Text: text in columns, top to bottom' },
    chedit: { name: 'Character Editing', key: 'T', tip: 'Character Editing (Shift T): move, turn, size or colour one letter on its own' },
    outlines: { name: 'Convert to Outlines', action: true, tip: 'Convert to Outlines (Ctrl/⌘ Shift O): the picked text as paths, letter by letter' },
    align: { name: 'Align', tip: 'Align: line up what’s picked by its edges or middles' },
    distribute: { name: 'Distribute', tip: 'Distribute: spread what’s picked out evenly' },
    dspace: { name: 'Distribute Spacing', tip: 'Distribute Spacing: the same gap between each of what’s picked' },
    fwd: { name: 'Bring Forward', action: true, tip: 'Bring Forward (Ctrl/⌘ ]): up one' },
    back: { name: 'Send Backward', action: true, tip: 'Send Backward (Ctrl/⌘ [): down one' },
    front: { name: 'Bring to Front', action: true, tip: 'Bring to Front (Ctrl/⌘ Shift ]): to the top of its layer' },
    backmost: { name: 'Send to Back', action: true, tip: 'Send to Back (Ctrl/⌘ Shift [): to the bottom of its layer' },
    groupun: { name: 'Group / Ungroup', action: true, tip: 'Group (Ctrl/⌘ G) what’s picked, or ungroup a picked group (Ctrl/⌘ Shift G)' },
    vblend: { name: 'Blend', key: 'w', tip: 'Blend (W): tap one shape, then another, for the shapes and colours in between' },
    warp: { name: 'Warp', key: 'R', tip: 'Warp (Shift R): bend what’s picked into an arc, a flag, a wave and more; change it any time' },
    envelope: { name: 'Envelope Distort', tip: 'Envelope Distort: a mesh over what’s picked; drag its points to bend what’s inside' },
    offset: { name: 'Offset Path', tip: 'Offset Path: a new path round the picked ones, a set distance out (or in)' },
    repeat: { name: 'Repeat', tip: 'Repeat: copies of what’s picked round a circle, in a grid or mirrored; they follow the original' },
    pattern: { name: 'Pattern', tip: 'Pattern: make a repeating tile from art, and fill shapes or strokes with it' },
    transp: { name: 'Transparency', tip: 'Transparency: opacity, blend modes, opacity masks and fades' },
    artboard: { name: 'Artboard', key: 'O', tip: 'Artboard (Shift O): tap an artboard to make it active; drag it to move it, its handles to size it; drag on the pasteboard for a new one' },
    abnew: { name: 'Create Artboard', tip: 'Create Artboard: tap the pasteboard for one the size set, or drag one out' },
    abresize: { name: 'Resize Artboard', tip: 'Resize Artboard: drag the active artboard’s handles, or type its size' },
    abdup: { name: 'Duplicate Artboard', action: true, tip: 'Duplicate Artboard: a copy of the active artboard, and what’s on it, beside the others' },
    abarr: { name: 'Rearrange Artboards', tip: 'Rearrange Artboards: their order, and laying them out in a grid, a row or a column' },
    abset: { name: 'Artboard Settings', tip: 'Artboard Settings: the active artboard’s name, place, size and background' },
    rulers: { name: 'Rulers', tip: 'Rulers: along the top and left, from the artboard’s corner; drag out of one for a guide' },
    guides: { name: 'Guides', tip: 'Guides (Ctrl/⌘ ; shows or hides them): tap to place one, drag one to move it' },
    smartg: { name: 'Smart Guides', tip: 'Smart Guides: line things up with the edges and middles of others as you move and draw' },
    grid: { name: 'Grid', tip: 'Grid (Ctrl/⌘ \' shows or hides it): lines at a set spacing, behind the art or in front' },
    snapgrid: { name: 'Snap to Grid', tip: 'Snap to Grid: points, edges and moves keep to the grid' },
    snappts: { name: 'Snap to Points', tip: 'Snap to Points: drawing and dragging catch on anchor points' },
    snapobj: { name: 'Snap to Objects', tip: 'Snap to Objects: drawing and dragging catch on other objects’ outlines' },
    measure: { name: 'Measure', tip: 'Measure: drag from one point to another for the distance and angle' }
  };
  function catOf(t) { return CATS.filter(function (c) { return c.tools.indexOf(t) >= 0; })[0]; }
  // (each tool's own settings, remembered between visits)
  var TS = { rect: { w: 200, h: 140 }, rrect: { w: 200, h: 140, r: 24 }, ellipse: { w: 200, h: 140 }, polygon: { r: 90, n: 6 }, star: { r: 100, r2: 45, n: 5 },
    spiral: { r: 100, decay: 80, segs: 10, cw: 1 }, line: { len: 200, ang: 0 }, arc: { w: 160, h: 160, slope: 0, closed: 0, fill: 0 },
    rgrid: { w: 240, h: 180, rows: 4, cols: 4, frame: 1, fill: 0 }, pgrid: { w: 200, h: 200, rings: 4, spokes: 6, fill: 0 },
    pen: { auto: 1 }, lasso: { what: 'anchors' }, wand: { fill: 1, stroke: 0, width: 0, op: 0, blend: 0, tol: 32 },
    simplify: { tol: 2.5, corner: 1 }, gradient: { kind: 'l', to: 'f' }, swatches: { to: 'f' }, cpick: { to: 'f' },
    pencil: { smooth: 40, fill: 0, close: 1, edit: 1 }, vbrush: { kind: 'taper', w: 8, smooth: 50, angle: 30, round: 30, press: 1, edit: 0, close: 0 }, blob: { w: 24, sel: 0 }, smooth: { str: 50, r: 30 }, veraser: { w: 24 },
    builder: { mode: 'merge', col: 'own' }, xf: { ref: 'c', strokes: 0 }, ftrans: { side: 'scale' }, move: { dx: 10, dy: 10 }, scale: { uni: 1, u: 100, h: 100, v: 100 }, rotate: { a: 45 }, reflect: { axis: 'v', a: 90 }, shear: { a: 20, axis: 'h' },
    type: { font: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, "Helvetica Neue", Arial, sans-serif', size: 48, weight: 400, italic: 0, lead: 1.2, track: 0, align: 'left' }, align: { to: 'sel', gap: 20 },
    prec: { rulers: 0, units: 'px', smart: 0, grid: 0, gsize: 32, gsub: 4, gfront: 0, snapGrid: 0, snapPts: 0, snapObj: 0, guides: 1, glock: 0, gnew: 'h' },
    abnew: { w: 1080, h: 1080 }, abresize: { ref: 'c' }, abarr: { layout: 'grow', cols: 2, gap: 60, art: 1 },
    vblend: { mode: 'steps', steps: 4 }, warp: { st: 'arc', bend: 50, hd: 0, vd: 0, dir: 'h' }, env: { rows: 3, cols: 3 }, offset: { d: 10, join: 'round', ml: 4 },
    repeat: { k: 'radial', n: 8, r: 120, rows: 3, cols: 3, gx: 20, gy: 20, a: 90, off: 0 }, pattern: { to: 'f', cur: '' }, transp: { dir: 'h' },
    trace: { mode: 'colour', n: 6, th: 128, noise: 3, smooth: 40, white: 1 } };
  try { var ts0 = JSON.parse(localStorage.getItem('paint-vec-tools') || 'null'); if (ts0 && typeof ts0 === 'object') Object.keys(TS).forEach(function (k) { if (ts0[k] && typeof ts0[k] === 'object') Object.keys(TS[k]).forEach(function (q) { if (typeof ts0[k][q] === typeof TS[k][q]) TS[k][q] = ts0[k][q]; }); }); } catch (x) {}
  var tsTimer = 0;
  function tsSave() { clearTimeout(tsTimer); tsTimer = setTimeout(function () { try { localStorage.setItem('paint-vec-tools', JSON.stringify(TS)); } catch (x) {} }, 300); }

  // ---- GEOMETRY: a path is a list of subpaths ({ pts, closed }); each point
  // is an anchor with its two handles ({ x, y, ix, iy, ox, oy, s }, s:
  // smooth; a handle on its anchor is no handle). A segment is a cubic
  // Bézier from a point, by its out handle and the next one's in handle ----
  function P(x, y) { return { x: x, y: y, ix: x, iy: y, ox: x, oy: y, s: 0 }; }
  function cp(q) { var r = { x: q.x, y: q.y, ix: q.ix, iy: q.iy, ox: q.ox, oy: q.oy, s: q.s ? 1 : 0 }; if (q.a) r.a = 1; return r; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function segN(sp) { return sp.pts.length < 2 ? 0 : sp.closed ? sp.pts.length : sp.pts.length - 1; }
  function seg(sp, i) {
    var a = sp.pts[i], b = sp.pts[(i + 1) % sp.pts.length];
    return [{ x: a.x, y: a.y }, { x: a.ox, y: a.oy }, { x: b.ix, y: b.iy }, { x: b.x, y: b.y }];
  }
  function straight(s) { return Math.abs(s[1].x - s[0].x) + Math.abs(s[1].y - s[0].y) + Math.abs(s[2].x - s[3].x) + Math.abs(s[2].y - s[3].y) < 1e-9; }
  function bez(s, t) {
    var u = 1 - t;
    return { x: u * u * u * s[0].x + 3 * u * u * t * s[1].x + 3 * u * t * t * s[2].x + t * t * t * s[3].x,
             y: u * u * u * s[0].y + 3 * u * u * t * s[1].y + 3 * u * t * t * s[2].y + t * t * t * s[3].y };
  }
  function bezD(s, t) { // (the direction along it)
    var u = 1 - t;
    return { x: 3 * u * u * (s[1].x - s[0].x) + 6 * u * t * (s[2].x - s[1].x) + 3 * t * t * (s[3].x - s[2].x),
             y: 3 * u * u * (s[1].y - s[0].y) + 6 * u * t * (s[2].y - s[1].y) + 3 * t * t * (s[3].y - s[2].y) };
  }
  function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  function splitBez(s, t) {
    var a = lerp(s[0], s[1], t), b = lerp(s[1], s[2], t), c = lerp(s[2], s[3], t), d = lerp(a, b, t), e = lerp(b, c, t), m = lerp(d, e, t);
    return [[s[0], a, d, m], [m, e, c, s[3]]];
  }
  // (a point put into segment i at t, the shape unchanged; the new point's index)
  function insertAt(sp, i, t) {
    var s = seg(sp, i), h = splitBez(s, t), a = sp.pts[i], b = sp.pts[(i + 1) % sp.pts.length], line = straight(s);
    var m = P(h[0][3].x, h[0][3].y);
    if (!line) { a.ox = h[0][1].x; a.oy = h[0][1].y; m.ix = h[0][2].x; m.iy = h[0][2].y; m.ox = h[1][1].x; m.oy = h[1][1].y; b.ix = h[1][2].x; b.iy = h[1][2].y; m.s = 1; }
    sp.pts.splice(i + 1, 0, m);
    return i + 1;
  }
  function segBox(s) {
    var x0 = Math.min(s[0].x, s[3].x), x1 = Math.max(s[0].x, s[3].x), y0 = Math.min(s[0].y, s[3].y), y1 = Math.max(s[0].y, s[3].y);
    if (!straight(s)) ['x', 'y'].forEach(function (k) {
      var a = -s[0][k] + 3 * s[1][k] - 3 * s[2][k] + s[3][k], b = 2 * (s[0][k] - 2 * s[1][k] + s[2][k]), c = s[1][k] - s[0][k], ts = [];
      if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) ts.push(-c / b); }
      else { var D = b * b - 4 * a * c; if (D >= 0) { var q = Math.sqrt(D); ts.push((-b + q) / (2 * a), (-b - q) / (2 * a)); } }
      ts.forEach(function (t) { if (t > 0 && t < 1) { var v = bez(s, t)[k]; if (k === 'x') { x0 = Math.min(x0, v); x1 = Math.max(x1, v); } else { y0 = Math.min(y0, v); y1 = Math.max(y1, v); } } });
    });
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  function dBox(d) {
    var b = null, one = function (q) { if (!b) b = { x0: q.x0, y0: q.y0, x1: q.x1, y1: q.y1 }; else { b.x0 = Math.min(b.x0, q.x0); b.y0 = Math.min(b.y0, q.y0); b.x1 = Math.max(b.x1, q.x1); b.y1 = Math.max(b.y1, q.y1); } };
    d.forEach(function (sp) {
      if (!sp.pts.length) return;
      one({ x0: sp.pts[0].x, y0: sp.pts[0].y, x1: sp.pts[0].x, y1: sp.pts[0].y });
      for (var i = 0; i < segN(sp); i++) one(segBox(seg(sp, i)));
    });
    return b ? { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 } : null;
  }
  // (a segment as short lines, each point knowing where along the segment it is)
  function flatSeg(s, tol, out, si, i, first) {
    var n = 1;
    if (!straight(s)) { var net = dist(s[0], s[1]) + dist(s[1], s[2]) + dist(s[2], s[3]); n = Math.max(2, Math.min(200, Math.ceil(Math.sqrt(net / Math.max(tol, 1e-3)) * 1.6))); }
    for (var k = first ? 0 : 1; k <= n; k++) { var t = k / n, q = bez(s, t); out.push({ x: q.x, y: q.y, si: si, i: i, t: t }); }
  }
  function flat(sp, tol, si) {
    var out = [];
    if (!sp.pts.length) return out;
    if (sp.pts.length === 1) { out.push({ x: sp.pts[0].x, y: sp.pts[0].y, si: si, i: 0, t: 0 }); return out; }
    for (var i = 0; i < segN(sp); i++) flatSeg(seg(sp, i), tol, out, si, i, i === 0);
    return out;
  }
  // (the nearest place on a path to p: subpath, segment, t, the point and how far)
  function nearest(d, p, tol) {
    var best = null;
    d.forEach(function (sp, si) {
      var f = flat(sp, tol || 0.5, si);
      if (f.length === 1) { var d1 = dist(p, f[0]); if (!best || d1 < best.d) best = { si: si, i: 0, t: 0, x: f[0].x, y: f[0].y, d: d1 }; return; }
      for (var k = 0; k + 1 < f.length; k++) {
        var a = f[k], b = f[k + 1], ta = a.i === b.i ? a.t : 0;
        var dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy, u = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0;
        var x = a.x + dx * u, y = a.y + dy * u, dd = Math.hypot(p.x - x, p.y - y);
        if (!best || dd < best.d) best = { si: si, i: b.i, t: ta + (b.t - ta) * u, x: x, y: y, d: dd };
      }
    });
    return best;
  }
  // (inside the shape, by the non-zero rule, as its fill sees it)
  function inside(d, p, rule) {
    var w = 0;
    d.forEach(function (sp) {
      var f = flat(sp, 0.5, 0); if (f.length < 3) return;
      for (var k = 0; k < f.length; k++) {
        var a = f[k], b = f[(k + 1) % f.length], c = (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
        if (a.y <= p.y) { if (b.y > p.y && c > 0) w++; } else if (b.y <= p.y && c < 0) w--;
      }
    });
    return rule === 'evenodd' ? w % 2 !== 0 : w !== 0;
  }
  function inPoly(poly, p) {
    var c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; }
    return c;
  }
  var r2 = function (v) { return Math.round(v * 100) / 100; };
  function dStr(d) {
    var out = '';
    d.forEach(function (sp) {
      if (!sp.pts.length) return;
      out += 'M' + r2(sp.pts[0].x) + ' ' + r2(sp.pts[0].y);
      for (var i = 0; i < segN(sp); i++) {
        var s = seg(sp, i);
        if (straight(s)) { if (!(sp.closed && i === segN(sp) - 1)) out += 'L' + r2(s[3].x) + ' ' + r2(s[3].y); }
        else out += 'C' + r2(s[1].x) + ' ' + r2(s[1].y) + ' ' + r2(s[2].x) + ' ' + r2(s[2].y) + ' ' + r2(s[3].x) + ' ' + r2(s[3].y);
      }
      if (sp.closed) out += 'Z';
    });
    return out || 'M0 0';
  }
  // (the fewest points keeping within eps of a line)
  function rdp(pts, eps) {
    if (pts.length < 3) return pts.slice();
    var keep = new Array(pts.length), stack = [[0, pts.length - 1]]; keep[0] = keep[pts.length - 1] = true;
    while (stack.length) {
      var r = stack.pop(), a = pts[r[0]], b = pts[r[1]], m = -1, md = 0;
      for (var i = r[0] + 1; i < r[1]; i++) {
        var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), dd = L ? Math.abs(dy * pts[i].x - dx * pts[i].y + b.x * a.y - b.y * a.x) / L : dist(pts[i], a);
        if (dd > md) { md = dd; m = i; }
      }
      if (md > eps && m > 0) { keep[m] = true; stack.push([r[0], m], [m, r[1]]); }
    }
    return pts.filter(function (q, i) { return keep[i]; });
  }
  // FITTING CURVES to points (Schneider's method): as few cubic segments as
  // keep within err of them, to simplify paths and to follow freehand lines
  function v2(x, y) { return { x: x, y: y }; }
  function vsub(a, b) { return v2(a.x - b.x, a.y - b.y); }
  function vadd(a, b) { return v2(a.x + b.x, a.y + b.y); }
  function vmul(a, k) { return v2(a.x * k, a.y * k); }
  function vdot(a, b) { return a.x * b.x + a.y * b.y; }
  function vnorm(a) { var L = Math.hypot(a.x, a.y) || 1; return v2(a.x / L, a.y / L); }
  function fitCurves(pts, err, tl, tr) {
    var Q = []; pts.forEach(function (q) { if (!Q.length || dist(q, Q[Q.length - 1]) > 1e-6) Q.push(v2(q.x, q.y)); });
    if (Q.length < 2) return [];
    var out = [];
    fitPart(Q, 0, Q.length - 1, tl || vnorm(vsub(Q[1], Q[0])), tr || vnorm(vsub(Q[Q.length - 2], Q[Q.length - 1])), err, out, 0);
    return out;
  }
  function fitPart(Q, a, b, tl, tr, err, out, depth) {
    if (b - a === 1 || depth > 40) { var dd = dist(Q[a], Q[b]) / 3; out.push([Q[a], vadd(Q[a], vmul(tl, dd)), vadd(Q[b], vmul(tr, dd)), Q[b]]); return; }
    var u = [0]; for (var i = a + 1; i <= b; i++) u.push(u[u.length - 1] + dist(Q[i], Q[i - 1]));
    var tot = u[u.length - 1] || 1; u = u.map(function (v) { return v / tot; });
    var bz = genBez(Q, a, b, u, tl, tr), e = maxErr(Q, a, b, bz, u);
    if (e.d < err) { out.push(bz); return; }
    if (e.d < err * 4) {
      for (var it = 0; it < 6; it++) {
        u = u.map(function (t, j) { return newton(bz, Q[a + j], t); });
        bz = genBez(Q, a, b, u, tl, tr); e = maxErr(Q, a, b, bz, u);
        if (e.d < err) { out.push(bz); return; }
      }
    }
    var s = Math.max(a + 1, Math.min(b - 1, e.i)), tc = vnorm(vsub(Q[s - 1], Q[s + 1]));
    fitPart(Q, a, s, tl, tc, err, out, depth + 1); fitPart(Q, s, b, vmul(tc, -1), tr, err, out, depth + 1);
  }
  function genBez(Q, a, b, u, tl, tr) {
    var p0 = Q[a], p3 = Q[b], c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
    for (var i = 0; i < u.length; i++) {
      var t = u[i], s = 1 - t, b1 = 3 * t * s * s, b2 = 3 * t * t * s, A1 = vmul(tl, b1), A2 = vmul(tr, b2);
      c00 += vdot(A1, A1); c01 += vdot(A1, A2); c11 += vdot(A2, A2);
      var tmp = vsub(Q[a + i], vadd(vmul(p0, s * s * s + b1), vmul(p3, b2 + t * t * t)));
      x0 += vdot(A1, tmp); x1 += vdot(A2, tmp);
    }
    var det = c00 * c11 - c01 * c01, al = 0, ar = 0, L = dist(p0, p3), eps = 1e-6 * L;
    if (Math.abs(det) > 1e-12) { al = (x0 * c11 - x1 * c01) / det; ar = (c00 * x1 - c01 * x0) / det; }
    if (al < eps || ar < eps || al > L * 3 || ar > L * 3) { al = ar = L / 3; }
    return [p0, vadd(p0, vmul(tl, al)), vadd(p3, vmul(tr, ar)), p3];
  }
  function maxErr(Q, a, b, bz, u) {
    var md = 0, mi = Math.floor((a + b) / 2);
    for (var i = a + 1; i < b; i++) { var d2 = dist(bez(bz, u[i - a]), Q[i]); if (d2 > md) { md = d2; mi = i; } }
    return { d: md, i: mi };
  }
  function newton(bz, p, t) {
    var q = bez(bz, t), d1 = bezD(bz, t), u = 1 - t;
    var d2 = { x: 6 * u * (bz[2].x - 2 * bz[1].x + bz[0].x) + 6 * t * (bz[3].x - 2 * bz[2].x + bz[1].x), y: 6 * u * (bz[2].y - 2 * bz[1].y + bz[0].y) + 6 * t * (bz[3].y - 2 * bz[2].y + bz[1].y) };
    var num = (q.x - p.x) * d1.x + (q.y - p.y) * d1.y, den = d1.x * d1.x + d1.y * d1.y + (q.x - p.x) * d2.x + (q.y - p.y) * d2.y;
    return Math.max(0, Math.min(1, Math.abs(den) < 1e-12 ? t : t - num / den));
  }
  // (fitted segments as a subpath's points)
  function bzPts(list, closed) {
    if (!list.length) return [];
    var pts = [P(list[0][0].x, list[0][0].y)];
    list.forEach(function (s) {
      var a = pts[pts.length - 1]; a.ox = s[1].x; a.oy = s[1].y;
      var b = P(s[3].x, s[3].y); b.ix = s[2].x; b.iy = s[2].y; pts.push(b);
    });
    if (closed && pts.length > 2 && dist(pts[0], pts[pts.length - 1]) < 1e-6) { var e = pts.pop(); pts[0].ix = e.ix; pts[0].iy = e.iy; }
    pts.forEach(function (q) { q.s = isSmooth(q) ? 1 : 0; });
    return pts;
  }
  function isSmooth(q) {
    var ax = q.x - q.ix, ay = q.y - q.iy, bx = q.ox - q.x, by = q.oy - q.y, la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    return la > 1e-6 && lb > 1e-6 && (ax * bx + ay * by) / (la * lb) > 0.995;
  }
  // (handles that make the curve go smoothly through its neighbours)
  function autoSmooth(sp, i) {
    var n = sp.pts.length, q = sp.pts[i];
    var pv = sp.closed || i > 0 ? sp.pts[(i - 1 + n) % n] : null, nx = sp.closed || i < n - 1 ? sp.pts[(i + 1) % n] : null;
    if (pv && nx && pv !== q) {
      var t = vnorm(vsub(nx, pv)), a = dist(q, pv) / 3, b = dist(q, nx) / 3;
      q.ix = q.x - t.x * a; q.iy = q.y - t.y * a; q.ox = q.x + t.x * b; q.oy = q.y + t.y * b;
    } else if (nx) { q.ix = q.x; q.iy = q.y; q.ox = q.x + (nx.x - q.x) / 3; q.oy = q.y + (nx.y - q.y) / 3; }
    else if (pv) { q.ox = q.x; q.oy = q.y; q.ix = q.x + (pv.x - q.x) / 3; q.iy = q.y + (pv.y - q.y) / 3; }
    q.s = 1;
  }
  // (the Curvature tool's points keep their curves as their neighbours move)
  function reflowAuto(sp) {
    var n = sp.pts.length;
    sp.pts.forEach(function (q, i) {
      if (!q.a) return;
      var pv = sp.closed || i > 0 ? sp.pts[(i - 1 + n) % n] : null, nx = sp.closed || i < n - 1 ? sp.pts[(i + 1) % n] : null;
      if (pv && nx && n > 2) { var tx = (nx.x - pv.x) / 6, ty = (nx.y - pv.y) / 6; q.ix = q.x - tx; q.iy = q.y - ty; q.ox = q.x + tx; q.oy = q.y + ty; q.s = 1; }
      else if (nx && n > 2 && !sp.closed) { var m = sp.pts[(i + 2) % n]; q.ix = q.x; q.iy = q.y; q.ox = q.x + (nx.x - q.x) / 3 - (m.x - q.x) / 12; q.oy = q.y + (nx.y - q.y) / 3 - (m.y - q.y) / 12; q.s = 0; }
      else if (pv && n > 2 && !sp.closed) { var m2 = sp.pts[(i - 2 + n) % n]; q.ox = q.x; q.oy = q.y; q.ix = q.x + (pv.x - q.x) / 3 - (m2.x - q.x) / 12; q.iy = q.y + (pv.y - q.y) / 3 - (m2.y - q.y) / 12; q.s = 0; }
      else { q.ix = q.x; q.iy = q.y; q.ox = q.x; q.oy = q.y; q.s = 0; }
    });
  }
  function moveAnchor(q, dx, dy) { q.x += dx; q.y += dy; q.ix += dx; q.iy += dy; q.ox += dx; q.oy += dy; }
  function hasIn(q) { return Math.abs(q.ix - q.x) + Math.abs(q.iy - q.y) > 1e-9; }
  function hasOut(q) { return Math.abs(q.ox - q.x) + Math.abs(q.oy - q.y) > 1e-9; }
  // (a matrix [a, b, c, d, e, f] on a point, and undone)
  function mx(m, p) { return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] }; }
  function mInv(m) { var det = m[0] * m[3] - m[1] * m[2] || 1e-12; return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det]; }
  function dXform(d, m) {
    d.forEach(function (sp) { sp.pts.forEach(function (q) { var a = mx(m, q), i = mx(m, { x: q.ix, y: q.iy }), o = mx(m, { x: q.ox, y: q.oy }); q.x = a.x; q.y = a.y; q.ix = i.x; q.iy = i.y; q.ox = o.x; q.oy = o.y; }); });
  }
  function dCopy(d) { return d.map(function (sp) { return { pts: sp.pts.map(cp), closed: !!sp.closed }; }); }
  // (matrices made and put together: mMul(a, b) is b, then a; mAbout turns,
  // sizes or slants about a point)
  var I6 = [1, 0, 0, 1, 0, 0];
  function mMul(a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; }
  function mAbout(m, o) { return mMul([1, 0, 0, 1, o.x, o.y], mMul(m, [1, 0, 0, 1, -o.x, -o.y])); }
  function mRot(a, o) { var c = Math.cos(a), s = Math.sin(a); return mAbout([c, s, -s, c, 0, 0], o); }
  function mScale(sx, sy, o) { return mAbout([sx, 0, 0, sy, 0, 0], o); }
  function mShear(kx, ky, o) { return mAbout([1, ky, kx, 1, 0, 0], o); }
  function mRefl(a, o) { var c = Math.cos(2 * a), s = Math.sin(2 * a); return mAbout([c, s, s, -c, 0, 0], o); } // (across the line through o at angle a)
  function axisAl(m) { return Math.abs(m[1]) < 1e-12 && Math.abs(m[2]) < 1e-12; }
  function mDet(m) { return m[0] * m[3] - m[1] * m[2]; }
  // (a projective map taking four corners to four others, for Distort)
  function homog(s, d) {
    var A = [], bv = [];
    for (var i = 0; i < 4; i++) {
      var x = s[i].x, y = s[i].y, u = d[i].x, v = d[i].y;
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); bv.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); bv.push(v);
    }
    for (var c = 0; c < 8; c++) {
      var pv = c; for (var r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[pv][c])) pv = r;
      if (Math.abs(A[pv][c]) < 1e-12) return null;
      var t = A[c]; A[c] = A[pv]; A[pv] = t; var tb = bv[c]; bv[c] = bv[pv]; bv[pv] = tb;
      for (r = 0; r < 8; r++) if (r !== c && A[r][c]) { var f = A[r][c] / A[c][c]; for (var k = c; k < 8; k++) A[r][k] -= f * A[c][k]; bv[r] -= f * bv[c]; }
    }
    return bv.map(function (v, j) { return v / A[j][j]; }).concat([1]);
  }
  function hmap(H, p) { var w = H[6] * p.x + H[7] * p.y + H[8]; return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w }; }
  // (the length of a subpath, sampled: points with how far along each is)
  // (straight runs are filled in too, so widths along them change smoothly)
  function measure(sp, tol) {
    var f0 = flat(sp, tol || 0.3, 0), f = [], L = 0, tot = 0;
    f0.forEach(function (q, k) { if (k) tot += dist(q, f0[k - 1]); });
    var step = Math.max(0.5, tot / 240);
    f0.forEach(function (q, k) {
      if (k) { var a = f0[k - 1], dd = dist(q, a), n = Math.floor(dd / step); for (var j = 1; j < n; j++) f.push({ x: a.x + (q.x - a.x) * j / n, y: a.y + (q.y - a.y) * j / n, si: q.si, i: q.i, t: q.t }); }
      f.push(q);
    });
    f.forEach(function (q, k) { if (k) L += dist(q, f[k - 1]); q.s = L; });
    return { f: f, L: L };
  }

  // ---- THE DOCUMENT: layers (doc.layers, top last), which hold sublayers,
  // groups and objects (paths and pictures), in stack order. Every node has
  // an id, a name, visible and locked; containers have items and open ----
  function uid(p) { return (p || 'v') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function isCont(n) { return !!n && (n.type === 'layer' || n.type === 'group'); }
  function walk(list, fn, parent, depth) {
    for (var i = 0; i < list.length; i++) { var n = list[i]; if (fn(n, parent || null, i, list, depth || 0) === false) continue; if (isCont(n)) walk(n.items, fn, n, (depth || 0) + 1); }
  }
  function where(id) { var r = null; if (doc) walk(doc.layers, function (n, p, i, list) { if (!r && n.id === id) r = { n: n, p: p, i: i, list: list }; }); return r; }
  function byId(id) { var w = where(id); return w ? w.n : null; }
  function chain(id) { // (the node's containers, outermost first, and the node)
    var out = null;
    (function go(list, path) { list.forEach(function (n) { if (out) return; var p2 = path.concat(n); if (n.id === id) out = p2; else if (isCont(n)) go(n.items, p2); }); })(doc ? doc.layers : [], []);
    return out || [];
  }
  function parentOf(n) { var w = where(n.id); return w ? w.p : null; }
  function layerOf(n) { var c = chain(n.id); for (var i = c.length - 2; i >= 0; i--) if (c[i].type === 'layer') return c[i]; return null; }
  // (what the Selection tool picks: the outermost group within its layer)
  function topPick(n) { var c = chain(n.id); for (var i = 0; i < c.length; i++) if (c[i].type !== 'layer') return c[i]; return n; }
  function shownN(n) { return chain(n.id).every(function (q) { return q.visible; }); }
  function editable(n) { var c = chain(n.id); return c.length > 0 && c.every(function (q) { return q.visible && !q.locked; }); }
  function leaves(n, out) { out = out || []; if (isCont(n)) n.items.forEach(function (q) { leaves(q, out); }); else out.push(n); return out; }
  function allLeaves() { var out = []; if (doc) doc.layers.forEach(function (L) { leaves(L, out); }); return out; }
  function isEmpty() { return !doc || !allLeaves().length; }
  function picked() { return sel.map(byId).filter(Boolean); }
  function curLayer() { var L = doc && byId(doc.cur); if (!L || L.type !== 'layer') { L = doc.layers[doc.layers.length - 1]; if (L) doc.cur = L.id; } return L; }
  function nodeBox(n) {
    if (hasFx(n)) return nodeBox(shownOf(n));
    if (n.omask && n.items.length > 1) return n.omask.clip ? nodeBox(n.items[n.items.length - 1]) : boxOf(n.items.slice(0, -1));
    if (n.type === 'path') return dBox(n.d);
    if (n.type === 'image' || n.type === 'text') return quadBox(nodeQuad(n));
    if (n.clip && n.items.length) return nodeBox(n.items[n.items.length - 1]);
    return boxOf(n.items);
  }
  // (the four corners of a picture or words, as turned, slanted or sized)
  function nodeQuad(n) {
    var b = n.type === 'text' ? textBox(n) : { x: n.x, y: n.y, w: n.w, h: n.h };
    var q = [v2(b.x, b.y), v2(b.x + b.w, b.y), v2(b.x + b.w, b.y + b.h), v2(b.x, b.y + b.h)];
    return n.mt ? q.map(function (p) { return mx(n.mt, p); }) : q;
  }
  function quadBox(q) { var xs = q.map(function (p) { return p.x; }), ys = q.map(function (p) { return p.y; }), x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys); return { x: x0, y: y0, w: Math.max.apply(null, xs) - x0, h: Math.max.apply(null, ys) - y0 }; }
  function boxOf(list) {
    var b = null;
    list.forEach(function (n) { var q = nodeBox(n); if (!q) return; if (!b) b = { x0: q.x, y0: q.y, x1: q.x + q.w, y1: q.y + q.h }; else { b.x0 = Math.min(b.x0, q.x); b.y0 = Math.min(b.y0, q.y); b.x1 = Math.max(b.x1, q.x + q.w); b.y1 = Math.max(b.y1, q.y + q.h); } });
    return b ? { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 } : null;
  }

  // LIVE SHAPES: a shape keeps what it was made from (n.live), so its
  // settings can still be changed; editing its points makes it a plain path
  function liveGen(L) {
    var d = [], k = L.k;
    var poly = function (pts, closed) { return { pts: pts.map(function (q) { return P(q.x, q.y); }), closed: closed }; };
    var ell = function (cx, cy, rx, ry) {
      var a = [P(cx + rx, cy), P(cx, cy + ry), P(cx - rx, cy), P(cx, cy - ry)], kx = rx * KAPPA, ky = ry * KAPPA;
      a[0].iy = cy - ky; a[0].oy = cy + ky; a[1].ox = cx - kx; a[1].ix = cx + kx; a[2].iy = cy + ky; a[2].oy = cy - ky; a[3].ix = cx - kx; a[3].ox = cx + kx;
      a.forEach(function (q) { q.s = 1; }); return { pts: a, closed: true };
    };
    if (k === 'rect') d.push(poly([v2(L.x, L.y), v2(L.x + L.w, L.y), v2(L.x + L.w, L.y + L.h), v2(L.x, L.y + L.h)], true));
    else if (k === 'rrect') {
      var r = Math.max(0, Math.min(L.r, L.w / 2, L.h / 2)), x = L.x, y = L.y, w = L.w, h = L.h, c = r * KAPPA;
      if (r < 0.01) d.push(poly([v2(x, y), v2(x + w, y), v2(x + w, y + h), v2(x, y + h)], true));
      else {
        var pts = [P(x + r, y), P(x + w - r, y), P(x + w, y + r), P(x + w, y + h - r), P(x + w - r, y + h), P(x + r, y + h), P(x, y + h - r), P(x, y + r)];
        pts[1].ox = x + w - r + c; pts[2].iy = y + r - c; pts[3].oy = y + h - r + c; pts[4].ix = x + w - r + c;
        pts[5].ox = x + r - c; pts[6].iy = y + h - r + c; pts[7].oy = y + r - c; pts[0].ix = x + r - c;
        d.push({ pts: pts, closed: true });
      }
    }
    else if (k === 'ellipse') d.push(ell(L.x + L.w / 2, L.y + L.h / 2, L.w / 2, L.h / 2));
    else if (k === 'polygon' || k === 'star') {
      var n = Math.max(3, Math.round(L.n)), out = [];
      for (var i = 0; i < n * (k === 'star' ? 2 : 1); i++) {
        var a = L.a + i * Math.PI * 2 / (n * (k === 'star' ? 2 : 1)), rr = k === 'star' && i % 2 ? L.r2 : L.r;
        out.push(v2(L.cx + Math.cos(a) * rr, L.cy + Math.sin(a) * rr));
      }
      d.push(poly(out, true));
    }
    else if (k === 'spiral') {
      var dir = L.cw ? 1 : -1, th = L.a, rk = L.r, p0 = v2(L.cx + Math.cos(th) * rk, L.cy + Math.sin(th) * rk), sp = { pts: [P(p0.x, p0.y)], closed: false };
      for (var s = 0; s < Math.max(1, Math.round(L.segs)); s++) {
        var cx = p0.x - Math.cos(th) * rk, cy = p0.y - Math.sin(th) * rk, th2 = th + dir * Math.PI / 2;
        var p1 = v2(cx + Math.cos(th2) * rk, cy + Math.sin(th2) * rk), h = rk * KAPPA, last = sp.pts[sp.pts.length - 1];
        last.ox = p0.x - Math.sin(th) * dir * h; last.oy = p0.y + Math.cos(th) * dir * h;
        var q = P(p1.x, p1.y); q.ix = p1.x + Math.sin(th2) * dir * h; q.iy = p1.y - Math.cos(th2) * dir * h; q.s = 1;
        sp.pts.push(q); p0 = p1; th = th2; rk *= Math.max(0.05, Math.min(0.99, L.decay / 100));
      }
      sp.pts.forEach(function (q2) { q2.s = isSmooth(q2) ? 1 : 0; });
      d.push(sp);
    }
    else if (k === 'line') d.push(poly([v2(L.x1, L.y1), v2(L.x2, L.y2)], false));
    else if (k === 'arc') {
      var A = P(L.x1, L.y1), Bq = P(L.x2, L.y2), C = v2(L.x1, L.y2), kk = Math.max(0, Math.min(1.8, KAPPA * (1 + L.slope / 100)));
      A.ox = A.x + (C.x - A.x) * kk; A.oy = A.y + (C.y - A.y) * kk; Bq.ix = Bq.x + (C.x - Bq.x) * kk; Bq.iy = Bq.y + (C.y - Bq.y) * kk;
      d.push(L.closed ? { pts: [A, Bq, P(C.x, C.y)], closed: true } : { pts: [A, Bq], closed: false });
    }
    else if (k === 'rgrid') {
      if (L.frame) d.push(poly([v2(L.x, L.y), v2(L.x + L.w, L.y), v2(L.x + L.w, L.y + L.h), v2(L.x, L.y + L.h)], true));
      for (var r1 = 1; r1 < L.rows; r1++) d.push(poly([v2(L.x, L.y + L.h * r1 / L.rows), v2(L.x + L.w, L.y + L.h * r1 / L.rows)], false));
      for (var c1 = 1; c1 < L.cols; c1++) d.push(poly([v2(L.x + L.w * c1 / L.cols, L.y), v2(L.x + L.w * c1 / L.cols, L.y + L.h)], false));
      if (!L.frame) { d.push(poly([v2(L.x, L.y), v2(L.x + L.w, L.y)], false), poly([v2(L.x, L.y + L.h), v2(L.x + L.w, L.y + L.h)], false), poly([v2(L.x, L.y), v2(L.x, L.y + L.h)], false), poly([v2(L.x + L.w, L.y), v2(L.x + L.w, L.y + L.h)], false)); }
    }
    else if (k === 'pgrid') {
      var gx = L.x + L.w / 2, gy = L.y + L.h / 2, rings = Math.max(1, Math.round(L.rings));
      for (var g = rings; g >= 1; g--) d.push(ell(gx, gy, L.w / 2 * g / rings, L.h / 2 * g / rings));
      for (var sk = 0; sk < Math.round(L.spokes); sk++) { var an = -Math.PI / 2 + sk * Math.PI * 2 / Math.round(L.spokes); d.push(poly([v2(gx, gy), v2(gx + Math.cos(an) * L.w / 2, gy + Math.sin(an) * L.h / 2)], false)); }
    }
    return d;
  }
  var BOXY = { rect: 1, rrect: 1, ellipse: 1, rgrid: 1, pgrid: 1 }, CENTRED = { polygon: 1, star: 1, spiral: 1 };
  // (a live shape moved or sized: its settings follow, or, turned, slanted
  // or stretched in a way they can't follow, it keeps a matrix of its own, L.m)
  function liveXform(L, m) {
    var R = L.m ? null : liveFit(L, m);
    if (!R) { R = JSON.parse(JSON.stringify(L)); R.m = mMul(m, L.m || I6); }
    return R;
  }
  function genLive(L) { var d = liveGen(L); if (L.m) dXform(d, L.m); return d; }
  function liveFit(L, m) {
    if (m[1] || m[2]) return null;
    var R = JSON.parse(JSON.stringify(L));
    if (BOXY[L.k]) {
      var a = mx(m, v2(L.x, L.y)), b = mx(m, v2(L.x + L.w, L.y + L.h));
      R.x = Math.min(a.x, b.x); R.y = Math.min(a.y, b.y); R.w = Math.abs(b.x - a.x); R.h = Math.abs(b.y - a.y);
      if (L.k === 'rrect') R.r = L.r * Math.min(Math.abs(m[0]), Math.abs(m[3]));
      return R;
    }
    if (L.k === 'line' || L.k === 'arc') {
      if (L.k === 'arc' && m[0] * m[3] < 0) return null;
      var p1 = mx(m, v2(L.x1, L.y1)), p2 = mx(m, v2(L.x2, L.y2)); R.x1 = p1.x; R.y1 = p1.y; R.x2 = p2.x; R.y2 = p2.y; return R;
    }
    if (CENTRED[L.k]) {
      if (m[0] <= 0 || m[3] <= 0 || Math.abs(m[0] - m[3]) > 1e-6 * Math.max(1, m[0])) return null;
      var c = mx(m, v2(L.cx, L.cy)); R.cx = c.x; R.cy = c.y; R.r = L.r * m[0]; if (L.k === 'star') R.r2 = L.r2 * m[0];
      return R;
    }
    return null;
  }
  // (move, size, turn or slant a node by an affine matrix; strokes keep
  // their widths. Pictures and words that can't stay upright keep a matrix, mt)
  function xform(n, m) {
    if (isCont(n)) { n.items.forEach(function (q) { xform(q, m); }); return; }
    if (n.type === 'path') {
      dXform(n.d, m);
      if (n.live) n.live = liveXform(n.live, m);
      return;
    }
    if (n.type === 'text') { textXform(n, m); return; }
    if (n.type === 'image') {
      if (n.mt || !axisAl(m)) { n.mt = mMul(m, n.mt || I6); return; }
      var a = mx(m, v2(n.x, n.y)), b = mx(m, v2(n.x + n.w, n.y + n.h));
      if (b.x < a.x) n.fx = n.fx ? 0 : 1; if (b.y < a.y) n.fy = n.fy ? 0 : 1;
      n.x = Math.min(a.x, b.x); n.y = Math.min(a.y, b.y); n.w = Math.max(0.5, Math.abs(b.x - a.x)); n.h = Math.max(0.5, Math.abs(b.y - a.y));
    }
  }
  function unlive(n) { if (n && n.live) delete n.live; }

  // HOW AN OBJECT LOOKS: its appearance (n.app), fills and strokes stacked
  // from the bottom: { k: 'f', p, o, on } and { k: 's', p, o, on, w, cap,
  // join, ml, dash, prof }. A paint p is null (none), { t: 'c', c } (solid),
  // or a gradient across the object ({ t: 'l', st, x1, y1, x2, y2 } or
  // { t: 'r', st, cx, cy, r }, in fractions of its box; stops { t, c, o })
  var HEX = /^#[0-9a-f]{6}$/i;
  function defApp() { return [{ k: 'f', p: { t: 'c', c: '#ffffff' }, o: 1, on: 1 }, { k: 's', p: { t: 'c', c: '#1d1d1f' }, o: 1, on: 1, w: 2, cap: 'butt', join: 'miter', ml: 10, dash: null, prof: null }]; }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function topOf(app, k) { for (var i = app.length - 1; i >= 0; i--) if (app[i].k === k) return i; return -1; }
  // (the item the colours change: the one focused in Fills & Strokes, or the top one)
  function itemOf(app, k, make) {
    var f = k === 'f' ? focusF : focusS, i = f >= 0 && app[f] && app[f].k === k ? f : topOf(app, k);
    if (i < 0 && make) { var it = k === 'f' ? { k: 'f', p: null, o: 1, on: 1 } : clone(defApp()[1]); if (k === 's') it.p = null; if (k === 'f') app.unshift(it); else app.push(it); i = app.indexOf(it); }
    return i >= 0 ? app[i] : null;
  }
  function paintCss(p) {
    if (!p) return '';
    if (p.t === 'c') return p.c;
    if (p.t === 'p') return 'repeating-linear-gradient(45deg, var(--muted) 0 2px, var(--paper) 2px 5px)';
    return 'linear-gradient(90deg,' + p.st.map(function (s) { return rgba(s.c, s.o) + ' ' + Math.round(s.t * 100) + '%'; }).join(',') + ')';
  }
  function rgba(c, o) { var n = parseInt(c.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + (o == null ? 1 : r2(o)) + ')'; }
  function gradOf(c) { return { t: 'l', st: [{ t: 0, c: '#ffffff', o: 1 }, { t: 1, c: c || '#000000', o: 1 }], x1: 0, y1: 0.5, x2: 1, y2: 0.5 }; }
  // WIDTH PROFILES: how wide the stroke is along its length (1 is its width)
  var PROFILES = [['none', 'Uniform', null], ['both', 'Taper Both', [[0, 0], [0.5, 1], [1, 0]]], ['start', 'Taper Start', [[0, 0], [1, 1]]], ['end', 'Taper End', [[0, 1], [1, 0]]],
    ['bulge', 'Bulge', [[0, 0.3], [0.5, 1.5], [1, 0.3]]], ['pinch', 'Pinch', [[0, 1.2], [0.5, 0.25], [1, 1.2]]], ['wave', 'Wave', [[0, 0.4], [0.25, 1.3], [0.5, 0.4], [0.75, 1.3], [1, 0.4]]]];
  function profAt(prof, t) {
    if (!prof || !prof.length) return 1;
    if (t <= prof[0].t) return prof[0].w;
    for (var i = 1; i < prof.length; i++) if (t <= prof[i].t) { var a = prof[i - 1], b = prof[i], u = (t - a.t) / Math.max(1e-9, b.t - a.t); u = u * u * (3 - 2 * u); return a.w + (b.w - a.w) * u; }
    return prof[prof.length - 1].w;
  }
  // (a stroke whose width changes along it, drawn as a filled outline)
  function outlineD(d, it) {
    var out = '', w = it.w, cap = it.cap;
    d.forEach(function (sp) {
      var m = measure(sp, 0.3), f = [];
      m.f.forEach(function (q) { if (!f.length || dist(q, f[f.length - 1]) > 0.05) f.push(q); });
      if (f.length < 2 || m.L <= 0) return;
      var L = m.L, left = [], right = [], tan = [];
      for (var k = 0; k < f.length; k++) {
        var a = f[Math.max(0, k - 1)], b = f[Math.min(f.length - 1, k + 1)];
        if (sp.closed && (k === 0 || k === f.length - 1)) { a = f[f.length - 2]; b = f[1]; }
        var t = vnorm(vsub(b, a)), hw = w / 2 * profAt(it.prof, f[k].s / L);
        tan.push(t); left.push(v2(f[k].x - t.y * hw, f[k].y + t.x * hw)); right.push(v2(f[k].x + t.y * hw, f[k].y - t.x * hw));
      }
      var pstr = function (list) { return list.map(function (q, i) { return (i ? 'L' : 'M') + r2(q.x) + ' ' + r2(q.y); }).join('') + 'Z'; };
      if (sp.closed) { out += pstr(left) + pstr(right.reverse()); return; }
      var capPts = function (c, t, hw, from) {
        var pts = [];
        if (cap === 'round') for (var j = 1; j < 12; j++) { var an = Math.atan2(from.y - c.y, from.x - c.x) - j * Math.PI / 12; pts.push(v2(c.x + Math.cos(an) * hw, c.y + Math.sin(an) * hw)); }
        else if (cap === 'square') { pts.push(v2(from.x + t.x * hw, from.y + t.y * hw)); var o2 = v2(2 * c.x - from.x, 2 * c.y - from.y); pts.push(v2(o2.x + t.x * hw, o2.y + t.y * hw)); }
        return pts;
      };
      var n = f.length - 1, he = w / 2 * profAt(it.prof, 1), hs = w / 2 * profAt(it.prof, 0);
      var poly = left.concat(capPts(f[n], tan[n], he, left[n])).concat(right.slice().reverse()).concat(capPts(f[0], vmul(tan[0], -1), hs, right[0]));
      out += pstr(poly);
    });
    return out || 'M0 0';
  }

  // ---- DRAWING IT: each node as SVG (crisp at any zoom) for the screen and
  // for saving, and on a canvas for pixels (raster(), the Vector Fill, the
  // eyedropper). Both from the same appearance, so they look alike ----
  var esc = function (t) { return String(t).replace(/[<&"']/g, function (ch) { return ch === '<' ? '&lt;' : ch === '&' ? '&amp;' : ch === '"' ? '&quot;' : '&#39;'; }); };
  var BLENDS = [['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['darken', 'Darken'], ['lighten', 'Lighten'], ['color-dodge', 'Color Dodge'], ['color-burn', 'Color Burn'],
    ['hard-light', 'Hard Light'], ['soft-light', 'Soft Light'], ['difference', 'Difference'], ['exclusion', 'Exclusion'], ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Color'], ['luminosity', 'Luminosity']];
  function gAttrs(n, forScreen) {
    var a = forScreen ? ' data-v="' + n.id + '"' : '';
    if (!n.visible) a += ' display="none"';
    if (n.opacity != null && n.opacity < 1) a += ' opacity="' + r2(n.opacity) + '"';
    var st = (n.blend && n.blend !== 'normal' ? 'mix-blend-mode:' + n.blend + ';' : '') + (n.iso ? 'isolation:isolate;' : '');
    if (st) a += ' style="' + st + '"';
    return a;
  }
  function gradDef(id, p) {
    var stops = p.st.map(function (s) { return '<stop offset="' + r2(s.t) + '" stop-color="' + s.c + '" stop-opacity="' + r2(s.o) + '"/>'; }).join('');
    return p.t === 'r' ? '<radialGradient id="' + id + '" cx="' + r2(p.cx) + '" cy="' + r2(p.cy) + '" r="' + r2(p.r) + '">' + stops + '</radialGradient>'
      : '<linearGradient id="' + id + '" x1="' + r2(p.x1) + '" y1="' + r2(p.y1) + '" x2="' + r2(p.x2) + '" y2="' + r2(p.y2) + '">' + stops + '</linearGradient>';
  }
  function nodeSvg(n, forScreen) {
    if (!forScreen && !n.visible) return '';
    if (hasFx(n)) return nodeSvg(shownOf(n), forScreen);
    if (n.omask && n.items.length > 1) return maskSvg(n, forScreen);
    if (isCont(n)) {
      // (a clipping group: its top object is the shape the rest are seen through)
      var cl = n.clip && n.items.length > 1 ? n.items[n.items.length - 1] : null;
      if (!cl) return '<g' + gAttrs(n, forScreen) + '>' + n.items.map(function (q) { return nodeSvg(q, forScreen); }).join('') + '</g>';
      return '<g' + gAttrs(n, forScreen) + '><defs><clipPath id="vc-' + n.id + '"><path d="' + dStr(cl.d) + '"' + (cl.rule === 'evenodd' ? ' clip-rule="evenodd"' : '') + '/></clipPath></defs><g clip-path="url(#vc-' + n.id + ')">' +
        n.items.slice(0, -1).map(function (q) { return nodeSvg(q, forScreen); }).join('') + '</g></g>';
    }
    var mt = n.mt ? ' transform="matrix(' + n.mt.map(function (v) { return Math.round(v * 1e6) / 1e6; }).join(' ') + ')"' : '';
    if (n.type === 'image') {
      var tr = n.fx || n.fy ? ' transform="translate(' + r2(n.x + n.w / 2) + ' ' + r2(n.y + n.h / 2) + ') scale(' + (n.fx ? -1 : 1) + ' ' + (n.fy ? -1 : 1) + ') translate(' + r2(-n.x - n.w / 2) + ' ' + r2(-n.y - n.h / 2) + ')"' : '';
      return '<g' + gAttrs(n, forScreen) + mt + '><use href="#va-' + n.asset + '" x="' + r2(n.x) + '" y="' + r2(n.y) + '" width="' + r2(Math.max(0.01, n.w)) + '" height="' + r2(Math.max(0.01, n.h)) + '"' + tr + '/></g>';
    }
    if (n.type === 'text') return '<g' + gAttrs(n, forScreen) + mt + '>' + textSvg(n) + '</g>';
    var D = dStr(n.d), defs = '', body = '', rule = n.rule === 'evenodd' ? ' fill-rule="evenodd"' : '';
    n.app.forEach(function (it, i) {
      if (!it.on || !it.p) return;
      var paint = it.p.t === 'c' ? it.p.c : 'url(#vg-' + n.id + '-' + i + ')';
      if (it.p.t !== 'c') defs += it.p.t === 'p' ? patDef('vg-' + n.id + '-' + i, it.p) : gradDef('vg-' + n.id + '-' + i, it.p);
      var op = it.o < 1 ? (it.k === 'f' ? ' fill-opacity="' : ' opacity="') + r2(it.o) + '"' : '';
      if (it.k === 'f') body += '<path d="' + D + '" fill="' + paint + '"' + rule + op + ' stroke="none"/>';
      else if (it.w > 0) {
        if (it.prof) body += '<path d="' + outlineD(n.d, it) + '" fill="' + paint + '"' + op + ' stroke="none"/>';
        else body += '<path d="' + D + '" fill="none" stroke="' + paint + '" stroke-width="' + r2(it.w) + '" stroke-linecap="' + it.cap + '" stroke-linejoin="' + it.join + '" stroke-miterlimit="' + r2(it.ml) + '"' +
          (it.dash && it.dash.length ? ' stroke-dasharray="' + it.dash.map(r2).join(' ') + '"' : '') + op + '/>';
      }
    });
    return '<g' + gAttrs(n, forScreen) + '>' + (defs ? '<defs>' + defs + '</defs>' : '') + body + '</g>';
  }
  function symbolOf(id) { var a = assets[id]; return '<symbol id="va-' + id + '" viewBox="0 0 ' + a.w + ' ' + a.h + '" preserveAspectRatio="none"><image width="' + a.w + '" height="' + a.h + '" preserveAspectRatio="none" href="' + a.src + '"/></symbol>'; }
  // (on a canvas, already set to the artboard's units)
  function cPaint(x, p, b, o) {
    if (p.t === 'c') return rgba(p.c, o);
    if (p.t === 'p') return patCanvas(x, p);
    var g = p.t === 'r' ? x.createRadialGradient(b.x + p.cx * b.w, b.y + p.cy * b.h, 0, b.x + p.cx * b.w, b.y + p.cy * b.h, p.r * (b.w + b.h) / 2)
      : x.createLinearGradient(b.x + p.x1 * b.w, b.y + p.y1 * b.h, b.x + p.x2 * b.w, b.y + p.y2 * b.h);
    p.st.forEach(function (s) { g.addColorStop(Math.max(0, Math.min(1, s.t)), rgba(s.c, s.o * o)); });
    return g;
  }
  function cDraw(x, n) {
    if (!n.visible) return;
    if (hasFx(n)) { cDraw(x, shownOf(n)); return; }
    if (n.omask && n.items.length > 1) { maskDraw(x, n); return; }
    var op = n.opacity == null ? 1 : n.opacity, bl = n.blend && n.blend !== 'normal' ? n.blend : null;
    if (isCont(n)) {
      var cl = n.clip && n.items.length > 1 ? n.items[n.items.length - 1] : null, inner = cl ? n.items.slice(0, -1) : n.items;
      var drawIn = function (cx) { cx.save(); if (cl) cx.clip(new Path2D(dStr(cl.d)), cl.rule === 'evenodd' ? 'evenodd' : 'nonzero'); inner.forEach(function (q) { cDraw(cx, q); }); cx.restore(); };
      if (n.type === 'group' && (op < 1 || bl || n.iso)) {
        var t = document.createElement('canvas'); t.width = x.canvas.width; t.height = x.canvas.height;
        var tx = t.getContext('2d'); tx.setTransform(x.getTransform()); drawIn(tx);
        x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = op; if (bl) x.globalCompositeOperation = bl; x.drawImage(t, 0, 0); x.restore();
      } else drawIn(x);
      return;
    }
    x.save(); if (bl) x.globalCompositeOperation = bl;
    if (n.mt) x.transform(n.mt[0], n.mt[1], n.mt[2], n.mt[3], n.mt[4], n.mt[5]);
    if (n.type === 'image') {
      var im = imgFor(n.asset);
      if (im && im.naturalWidth) { x.globalAlpha = op; x.translate(n.x + n.w / 2, n.y + n.h / 2); x.scale(n.fx ? -1 : 1, n.fy ? -1 : 1); x.imageSmoothingQuality = 'high'; x.drawImage(im, -n.w / 2, -n.h / 2, n.w, n.h); }
      x.restore(); return;
    }
    if (n.type === 'text') { textDraw(x, n, op); x.restore(); return; }
    var path = new Path2D(dStr(n.d)), b = dBox(n.d) || { x: 0, y: 0, w: 1, h: 1 }, rule = n.rule === 'evenodd' ? 'evenodd' : 'nonzero';
    n.app.forEach(function (it) {
      if (!it.on || !it.p) return;
      x.globalAlpha = op;
      if (it.k === 'f') {
        if (it.p.t === 'c') { x.fillStyle = rgba(it.p.c, it.o); x.fill(path, rule); }
        else if (it.p.t === 'p') { x.save(); x.globalAlpha = op * it.o; x.fillStyle = patCanvas(x, it.p); x.fill(path, rule); x.restore(); }
        else { // (a gradient across the box, exactly as SVG lays it: clipped, in the box's units)
          x.save(); x.clip(path, rule); x.transform(Math.max(b.w, 1e-6), 0, 0, Math.max(b.h, 1e-6), b.x, b.y);
          x.fillStyle = cPaint(x, it.p, { x: 0, y: 0, w: 1, h: 1 }, it.o); x.fillRect(0, 0, 1, 1); x.restore();
        }
      } else if (it.w > 0) {
        if (it.prof) { x.fillStyle = cPaint(x, it.p, b, it.o); x.fill(new Path2D(outlineD(n.d, it))); }
        else {
          x.strokeStyle = cPaint(x, it.p, b, it.o); x.lineWidth = it.w; x.lineCap = it.cap; x.lineJoin = it.join; x.miterLimit = it.ml;
          x.setLineDash(it.dash && it.dash.length ? it.dash : []); x.stroke(path); x.setLineDash([]);
        }
      }
    });
    x.restore();
  }
  // PICTURES: kept once, as data URLs (so they save anywhere), and loaded
  // once for drawing on a canvas
  function addAsset(src, w, h) { var id = uid('a'); assets[id] = { src: src, w: w, h: h }; ensureDefs(); return id; }
  function imgFor(id) {
    if (imgs[id]) return imgs[id];
    var a = assets[id]; if (!a) return null;
    var im = new Image(); im.decoding = 'async'; im.src = a.src; imgs[id] = im;
    im.ready = new Promise(function (ok) { if (im.complete && im.naturalWidth) ok(); else { im.onload = function () { ok(); }; im.onerror = function () { ok(); }; } });
    return im;
  }
  function ensureDefs() {
    if (!defsEl) return;
    Object.keys(assets).forEach(function (id) {
      if (defsEl.querySelector('[id="va-' + id + '"]')) return;
      var a = assets[id], s = document.createElementNS(SVGNS, 'symbol'), im = document.createElementNS(SVGNS, 'image');
      s.setAttribute('id', 'va-' + id); s.setAttribute('viewBox', '0 0 ' + a.w + ' ' + a.h); s.setAttribute('preserveAspectRatio', 'none');
      im.setAttribute('width', a.w); im.setAttribute('height', a.h); im.setAttribute('preserveAspectRatio', 'none'); im.setAttribute('href', a.src);
      s.appendChild(im); defsEl.appendChild(s);
    });
  }

  // ---- WORDS: a text object (type 'text') is laid out from its words
  // (txt) and type settings each time it's drawn: point text from (x, y),
  // area text inside its shape (area, a path), text on a path (pd) from a
  // fraction along it (off); vert stacks the letters in columns. Letters
  // picked out with Character Editing keep their own nudges, turn, size and
  // colour in ch, by where they are in txt. Laid out with the canvas's
  // measures, drawn as SVG <text> (a position for each letter) and on a canvas ----
  var TX = { ctx: null, cache: new Map(), loads: {} };
  function tctx() { if (!TX.ctx) TX.ctx = document.createElement('canvas').getContext('2d'); return TX.ctx; }
  function tFont(n, size) { return (n.italic ? 'italic ' : '') + (n.weight >= 600 ? 700 : 400) + ' ' + r2(size || n.size) + 'px ' + n.font; }
  // (a web font is fetched the first time it's used; what was measured
  // with a stand-in is laid out again once it has come)
  function fontWant(n) {
    var f = n.font; if (TX.loads[f] || !document.fonts) return;
    if (B && B.ensureFonts) B.ensureFonts();
    TX.loads[f] = 1;
    try { document.fonts.load(tFont(n, 40)).then(function (l) { if (l && l.length) relayText(); else setTimeout(function () { document.fonts.load(tFont(n, 40)).then(relayText, function () {}); }, 1200); }, function () {}); } catch (x) {}
  }
  function relayText() { TX.cache.clear(); if (on && doc && allLeaves().some(function (q) { return q.type === 'text'; })) { renderArt(); drawUI(); } }
  function chOf(n, u) { var k = n.ch && n.ch[u]; return k || null; }
  // (where every letter goes: { g: letters, car: a place for the caret
  // before each of txt's characters and after the last, asc, desc, over })
  function textLayout(n) {
    var key = JSON.stringify([n.txt, n.font, n.size, n.weight, n.italic, n.lead, n.track, n.align, n.kind, n.vert, n.x, n.y, n.area, n.pd, n.off, n.flip]);
    var hit = TX.cache.get(key); if (hit) return hit;
    fontWant(n);
    var x = tctx(); x.font = tFont(n); var mm = x.measureText('Hg'), S = n.size;
    var asc = mm.fontBoundingBoxAscent || S * 0.8, desc = mm.fontBoundingBoxDescent || S * 0.2, lh = S * n.lead, tr = n.track / 1000 * S;
    var L = { g: [], car: [], asc: asc, desc: desc, over: false, lh: lh };
    var W = function (t) { return x.measureText(t).width; };
    // (one line of letters: their places along it, and how wide it is)
    var runOf = function (t) { var ch = Array.from(t), xs = [], acc = ''; ch.forEach(function (c, i) { xs.push(W(acc) + i * tr); acc += c; }); var w = ch.length ? W(acc) + (ch.length - 1) * tr : 0; return { ch: ch, xs: xs, w: w, adv: ch.map(function (c, i) { return (i + 1 < ch.length ? xs[i + 1] - tr : w) - xs[i]; }) }; };
    var put = function (run, u, x0, y, ln, gap) {
      var extra = 0;
      run.ch.forEach(function (c, i) {
        var sp = /\s/.test(c), gx = x0 + run.xs[i] + extra;
        L.g.push({ c: c, u: u, x: gx, y: y, r: 0, s: 1, w: run.adv[i], ln: ln, sp: sp });
        L.car[u] = { x: gx, y: y, r: 0 }; u += c.length;
        if (sp && gap) extra += gap;
      });
      L.car[u] = { x: x0 + run.w + extra, y: y, r: 0 };
      return u;
    };
    var u = 0, paras = n.txt.split('\n');
    if (n.kind === 'path' && n.pd && n.pd[0]) {
      var sp0 = { pts: n.pd[0].pts.map(cp), closed: n.pd[0].closed }; if (n.flip) reverseSp(sp0);
      var M = measure(sp0, 0.3), run = runOf(n.txt.replace(/\n/g, ' ')), Lp = M.L;
      var start = n.off * Lp - (n.align === 'center' ? run.w / 2 : n.align === 'right' ? run.w : 0);
      var at = function (d) { if (sp0.closed) d = ((d % Lp) + Lp) % Lp; return Lp > 0 ? pointAtDist(M, Math.max(0, Math.min(Lp, d))) : { x: n.pd[0].pts[0].x, y: n.pd[0].pts[0].y, tan: v2(1, 0) }; };
      run.ch.forEach(function (c, i) {
        var d = start + run.xs[i] + run.adv[i] / 2, q = at(d), a = Math.atan2(q.tan.y, q.tan.x), hid = !sp0.closed && (d < 0 || d > Lp);
        L.g.push({ c: c, u: u, x: q.x - q.tan.x * run.adv[i] / 2, y: q.y - q.tan.y * run.adv[i] / 2, r: a, s: 1, w: run.adv[i], ln: 0, sp: /\s/.test(c), hid: hid });
        L.car[u] = { x: q.x - q.tan.x * run.adv[i] / 2, y: q.y - q.tan.y * run.adv[i] / 2, r: a }; u += c.length;
        if (hid) L.over = true;
      });
      var qe = at(start + run.w); L.car[u] = { x: qe.x, y: qe.y, r: Math.atan2(qe.tan.y, qe.tan.x) };
      for (var k = 0; k <= n.txt.length; k++) if (!L.car[k]) L.car[k] = L.car[u];
      TX.cache.set(key, L); if (TX.cache.size > 300) TX.cache.delete(TX.cache.keys().next().value);
      return L;
    }
    if (n.vert) {
      // (columns from right to left, each letter upright, one under the other)
      var box = n.kind === 'area' && n.area ? dBox(n.area) : null, cell = S + tr, colX = box ? box.x + box.w - lh / 2 : n.x, top = box ? box.y : n.y, ln = 0;
      paras.forEach(function (para, pi) {
        var y = top;
        Array.from(para).forEach(function (c) {
          if (box && y + cell > box.y + box.h + 0.5 && y > top) { colX -= lh; y = top; ln++; }
          if (box && colX - S / 2 < box.x - 0.5) { L.over = true; L.car[u] = { x: colX, y: y, r: 0, v: 1 }; u += c.length; return; }
          var w = W(c);
          L.g.push({ c: c, u: u, x: colX - w / 2, y: y + S / 2 + (asc - desc) / 2, r: 0, s: 1, w: w, ln: ln, sp: /\s/.test(c), vc: 1 });
          L.car[u] = { x: colX, y: y, r: 0, v: 1 }; u += c.length; y += cell;
        });
        L.car[u] = { x: colX, y: y, r: 0, v: 1 }; u += 1;
        if (pi < paras.length - 1) { colX -= lh; ln++; }
      });
      TX.cache.set(key, L); return L;
    }
    if (n.kind === 'area' && n.area) {
      var bx = dBox(n.area) || { x: 0, y: 0, w: 1, h: 1 }, rings = n.area.map(function (sp) { return flat({ pts: sp.pts, closed: true }, 0.5, 0); });
      // (the widest stretch across the shape at a line's top and bottom both)
      var span = function (y0, y1) {
        var cut = function (y) { var xs = []; rings.forEach(function (r) { for (var i = 0; i < r.length; i++) { var a = r[i], b = r[(i + 1) % r.length]; if ((a.y > y) !== (b.y > y)) xs.push(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x)); } }); xs.sort(function (a, b) { return a - b; }); var out = []; for (var i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]); return out; };
        var A = cut(y0), Bs = cut(y1), best = null;
        A.forEach(function (a) { Bs.forEach(function (b) { var l = Math.max(a[0], b[0]), r = Math.min(a[1], b[1]); if (r - l > 0 && (!best || r - l > best[1] - best[0])) best = [l, r]; }); });
        return best;
      };
      var y = bx.y + asc, ln2 = 0, stop = false;
      paras.forEach(function (para, pi) {
        var toks = para.match(/\S+\s*|\s+/g) || [], first = true;
        while ((toks.length || first) && !stop) {
          first = false;
          if (y + desc > bx.y + bx.h + 0.5) { stop = true; break; }
          var sp = span(y - asc, y + desc), g2 = 0;
          while (!sp && y + desc <= bx.y + bx.h + 0.5 && g2++ < 400) { y += lh / 4; sp = span(y - asc, y + desc); }
          if (!sp) { stop = true; break; }
          var avail = sp[1] - sp[0], line = '';
          while (toks.length) {
            var t = toks[0], tryL = line + t;
            if (!line || runOf(tryL.replace(/\s+$/, '')).w <= avail + 0.01) {
              if (!line && runOf(t.replace(/\s+$/, '')).w > avail) { // (a word too long for the line: as many letters as fit)
                var cs = Array.from(t), cut = 1; while (cut < cs.length && runOf(cs.slice(0, cut + 1).join('')).w <= avail) cut++;
                line = cs.slice(0, cut).join(''); toks[0] = cs.slice(cut).join(''); if (!toks[0]) toks.shift(); break;
              }
              line = tryL; toks.shift();
            } else break;
          }
          var trim = line.replace(/\s+$/, ''), rw = runOf(trim).w, last = !toks.length;
          var gap = 0, spaces = (trim.match(/\s/g) || []).length;
          if (n.align === 'justify' && !last && spaces) gap = (avail - rw) / spaces;
          var x0 = sp[0] + (n.align === 'center' ? (avail - rw) / 2 : n.align === 'right' ? avail - rw : 0);
          var run2 = runOf(line); u = put(run2, u, x0, y, ln2, gap);
          y += lh; ln2++;
        }
        if (stop) { L.over = true; for (var k = u; k <= n.txt.length; k++) if (!L.car[k]) L.car[k] = L.car[u] || { x: bx.x, y: bx.y + asc, r: 0 }; return; }
        u += 1; // (the line break)
      });
      for (var k2 = 0; k2 <= n.txt.length; k2++) if (!L.car[k2]) L.car[k2] = { x: bx.x, y: bx.y + asc, r: 0 };
      TX.cache.set(key, L); return L;
    }
    // (point text: each line from (x, y), a line height apart)
    paras.forEach(function (para, pi) {
      var run3 = runOf(para), x0 = n.x - (n.align === 'center' ? run3.w / 2 : n.align === 'right' ? run3.w : 0);
      u = put(run3, u, x0, n.y + pi * lh, pi, 0) + 1;
    });
    TX.cache.set(key, L); if (TX.cache.size > 300) TX.cache.delete(TX.cache.keys().next().value);
    return L;
  }
  // (a point a distance along a measured subpath, and the way it's going there)
  function pointAtDist(M, want) {
    var f = M.f, lo = 1, hi = f.length - 1;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (f[mid].s < want) lo = mid + 1; else hi = mid; }
    var a = f[Math.max(0, lo - 1)], b = f[lo] || a, u = (want - a.s) / Math.max(1e-9, b.s - a.s);
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, tan: vnorm(vsub(b, a)) };
  }
  // (a letter's own matrix: where it sits, turned and sized, with its nudges)
  function glyphM(n, g) {
    var k = chOf(n, g.u), r = g.r + (k && k.r ? k.r * Math.PI / 180 : 0), s = g.s * (k && k.s ? k.s : 1), c = Math.cos(r) * s, sn = Math.sin(r) * s;
    return [c, sn, -sn, c, g.x + (k && k.dx || 0), g.y + (k && k.dy || 0)];
  }
  function glyphQuad(n, g, L) { var m = glyphM(n, g); return [v2(0, -L.asc), v2(g.w, -L.asc), v2(g.w, L.desc), v2(0, L.desc)].map(function (p) { return mx(m, p); }); }
  // (the box round the words, before their own matrix: an area's shape, or the letters)
  function textBox(n) {
    if (n.kind === 'area' && n.area) return dBox(n.area) || { x: 0, y: 0, w: 1, h: 1 };
    var L = textLayout(n), pts = [];
    L.g.forEach(function (g) { if (!g.hid) pts = pts.concat(glyphQuad(n, g, L)); });
    if (!pts.length) { var c = L.car[0] || { x: n.x, y: n.y }; return L.car[0] && L.car[0].v ? { x: c.x - n.size / 2, y: c.y, w: n.size, h: n.size } : { x: c.x, y: c.y - L.asc, w: Math.max(1, n.size * 0.1), h: L.asc + L.desc }; }
    return quadBox(pts);
  }
  // (which letter is under p (in the words' own space), or -1)
  function glyphAt(n, q, tol) {
    var L = textLayout(n), best = -1;
    L.g.forEach(function (g, i) {
      if (g.hid) return; var m = glyphM(n, g), l = mx(mInv(m), q), s = Math.hypot(m[0], m[1]) || 1, t = tol / s;
      if (l.x >= -t && l.x <= g.w + t && l.y >= -L.asc - t && l.y <= L.desc + t) best = i;
    });
    return best;
  }
  function textHit(n, p, tol) {
    var q = n.mt ? mx(mInv(n.mt), p) : p;
    if (n.kind === 'area' && n.area) { if (inside(n.area, q)) return true; var ne = nearest(n.area, q, 0.5); return !!ne && ne.d <= tol; }
    if (glyphAt(n, q, tol) >= 0) return true;
    var b = textBox(n); return q.x >= b.x - tol && q.x <= b.x + b.w + tol && q.y >= b.y - tol && q.y <= b.y + b.h + tol && !textLayout(n).g.length;
  }
  // (the caret's place nearest p (in the words' own space): an index into txt)
  function caretAt(n, q) {
    var L = textLayout(n), best = 0, bd = Infinity;
    L.car.forEach(function (c, i) {
      if (!c) return; var a, b;
      if (c.v) { a = v2(c.x - n.size / 2, c.y); b = v2(c.x + n.size / 2, c.y); }
      else { var sn = Math.sin(c.r), cs = Math.cos(c.r); a = v2(c.x + sn * L.asc, c.y - cs * L.asc); b = v2(c.x - sn * L.desc, c.y + cs * L.desc); }
      var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2)) : 0, d = Math.hypot(q.x - a.x - dx * t, q.y - a.y - dy * t);
      if (d < bd - 1e-9) { bd = d; best = i; }
    });
    return best;
  }
  // (moved, sized, turned: point text moves and takes a bigger size, an
  // area's shape is sized and the words flow again, text on a path goes
  // with its path; anything else is kept as a matrix of its own)
  function textXform(n, m) {
    var det = Math.abs(mDet(m));
    if (n.kind === 'path') { dXform(n.pd, m); n.size = Math.max(0.5, Math.min(4000, n.size * Math.sqrt(det))); return; }
    var move = axisAl(m) && Math.abs(m[0] - 1) < 1e-12 && Math.abs(m[3] - 1) < 1e-12;
    if (n.mt) { n.mt = mMul(m, n.mt); return; }
    if (move) { n.x += m[4]; n.y += m[5]; if (n.area) dXform(n.area, m); return; }
    if (axisAl(m) && m[0] > 0 && m[3] > 0) {
      if (n.kind === 'area' && n.area) { dXform(n.area, m); return; }
      if (Math.abs(m[0] - m[3]) < 1e-6 * Math.max(1, m[0])) {
        var p = mx(m, n); n.x = p.x; n.y = p.y; n.size = Math.max(0.5, Math.min(4000, n.size * m[0]));
        if (n.ch) Object.keys(n.ch).forEach(function (k) { var c = n.ch[k]; if (c.dx) c.dx *= m[0]; if (c.dy) c.dy *= m[0]; });
        return;
      }
    }
    n.mt = m.slice();
  }
  // (as SVG: the letters with nothing of their own share one <text> per
  // fill or stroke, a place and turn for each; the rest are drawn one by one)
  function textSvg(n) {
    var L = textLayout(n), gl = L.g.filter(function (g) { return !g.sp && !g.hid; }), defs = '', body = '';
    var fa = ' font-family="' + esc(n.font) + '" font-size="' + r2(n.size) + '"' + (n.weight >= 600 ? ' font-weight="700"' : '') + (n.italic ? ' font-style="italic"' : '');
    var own = function (g) { var k = chOf(n, g.u); return g.s !== 1 || (k && (k.s && k.s !== 1)) || g.c.length > 1; };
    n.app.forEach(function (it, i) {
      if (!it.on || !it.p || (it.k === 's' && !(it.w > 0))) return;
      var paint = it.p.t === 'c' ? it.p.c : 'url(#vg-' + n.id + '-' + i + ')';
      if (it.p.t !== 'c') defs += it.p.t === 'p' ? patDef('vg-' + n.id + '-' + i, it.p) : gradDef('vg-' + n.id + '-' + i, it.p);
      var at = function (pt) { return it.k === 'f' ? ' fill="' + pt + '"' + (it.o < 1 ? ' fill-opacity="' + r2(it.o) + '"' : '') + ' stroke="none"' : ' fill="none" stroke="' + pt + '" stroke-width="' + r2(it.w) + '" stroke-linejoin="' + it.join + '" stroke-linecap="' + it.cap + '"' + (it.o < 1 ? ' stroke-opacity="' + r2(it.o) + '"' : ''); };
      var plain = [], one = [];
      gl.forEach(function (g) { var k = chOf(n, g.u); if (own(g) || (k && k.c && it.k === 'f')) one.push(g); else plain.push(g); });
      if (plain.length) {
        var rot = plain.some(function (g) { var k = chOf(n, g.u); return g.r || (k && k.r); });
        body += '<text' + at(paint) + fa + ' x="' + plain.map(function (g) { var k = chOf(n, g.u); return r2(g.x + (k && k.dx || 0)); }).join(' ') + '" y="' + plain.map(function (g) { var k = chOf(n, g.u); return r2(g.y + (k && k.dy || 0)); }).join(' ') + '"' +
          (rot ? ' rotate="' + plain.map(function (g) { var k = chOf(n, g.u); return r2(g.r * 180 / Math.PI + (k && k.r || 0)); }).join(' ') + '"' : '') + '>' + esc(plain.map(function (g) { return g.c; }).join('')) + '</text>';
      }
      one.forEach(function (g) {
        var k = chOf(n, g.u), m = glyphM(n, g);
        body += '<text' + at(k && k.c && it.k === 'f' ? k.c : paint) + fa + ' transform="matrix(' + m.map(function (v) { return Math.round(v * 1e5) / 1e5; }).join(' ') + ')">' + esc(g.c) + '</text>';
      });
    });
    return (defs ? '<defs>' + defs + '</defs>' : '') + body;
  }
  // (on a canvas: letter by letter; a gradient through the letters' shapes)
  function textDraw(x, n, op) {
    var L = textLayout(n), gl = L.g.filter(function (g) { return !g.sp && !g.hid; }), b = textBox(n);
    var each = function (cx, it, style) {
      cx.font = tFont(n); cx.textBaseline = 'alphabetic'; cx.textAlign = 'left';
      gl.forEach(function (g) {
        var m = glyphM(n, g), s = Math.hypot(m[0], m[1]) || 1; cx.save(); cx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        if (it.k === 'f') { cx.fillStyle = style(g); cx.fillText(g.c, 0, 0); }
        else { cx.strokeStyle = style(g); cx.lineWidth = it.w / s; cx.lineJoin = it.join; cx.lineCap = it.cap; cx.strokeText(g.c, 0, 0); }
        cx.restore();
      });
    };
    n.app.forEach(function (it) {
      if (!it.on || !it.p || (it.k === 's' && !(it.w > 0))) return;
      x.globalAlpha = op;
      if (it.p.t === 'c') { each(x, it, function (g) { var k = chOf(n, g.u); return rgba(k && k.c && it.k === 'f' ? k.c : it.p.c, it.o); }); return; }
      var t = document.createElement('canvas'); t.width = x.canvas.width; t.height = x.canvas.height;
      var tx = t.getContext('2d'); tx.setTransform(x.getTransform()); each(tx, it, function () { return '#000'; });
      tx.globalCompositeOperation = 'source-in'; tx.fillStyle = cPaint(tx, it.p, b, it.o); tx.fillRect(b.x - b.w, b.y - b.h, b.w * 3, b.h * 3);
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(t, 0, 0); x.restore();
    });
  }

  // ---- SHAPE OPERATIONS: Pathfinder, Shape Builder, the Blob Brush and
  // the Vector Eraser all work on one PLANAR ARRANGEMENT of the shapes:
  // each shape flattened to rings (a point knows if it was an anchor, and a
  // smooth one), every crossing found (in a grid, so it's quick), the edges
  // cut there and joined into faces. Each face knows which shapes it's
  // inside (by their own fill rule), so an operation only says which faces
  // to keep; the edges between kept and dropped faces are the result, and
  // its curves are fitted again between anchors and crossings ----
  function boolTol(paths) { var b = boxOf(paths); var dg = b ? Math.hypot(b.w, b.h) : 100; return Math.max(0.02, Math.min(0.25, dg / 8000)); }
  // (a path's subpaths as closed rings of points)
  function pathRings(d, tol) {
    var out = [];
    d.forEach(function (sp) {
      if (sp.pts.length < 2) return;
      var N = sp.pts.length, f = flat({ pts: sp.pts, closed: true }, tol, 0), R = [];
      f.forEach(function (q, k) {
        var anc = k === 0 || q.t === 1, ai = k === 0 ? 0 : (q.i + 1) % N, v = { x: q.x, y: q.y, b: anc, sm: anc && !!sp.pts[ai].s };
        var last = R[R.length - 1];
        if (last && Math.abs(last.x - v.x) + Math.abs(last.y - v.y) < 1e-9) { if (anc) { last.b = true; last.sm = last.sm || v.sm; } return; }
        R.push(v);
      });
      if (R.length > 1 && Math.abs(R[0].x - R[R.length - 1].x) + Math.abs(R[0].y - R[R.length - 1].y) < 1e-9) R.pop();
      if (R.length >= 3) out.push(R);
    });
    return out;
  }
  function shapeOf(n, tol) { return { rings: pathRings(n.d, tol), rule: n.rule === 'evenodd' ? 'e' : 'n' }; }
  function windAt(rings, p) {
    var w = 0;
    rings.forEach(function (r) {
      for (var i = 0, n = r.length; i < n; i++) {
        var a = r[i], b = r[(i + 1) % n], c = (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
        if (a.y <= p.y) { if (b.y > p.y && c > 0) w++; } else if (b.y <= p.y && c < 0) w--;
      }
    });
    return w;
  }
  function inShape(sh, p) { if (sh.box && (p.x < sh.box.x0 || p.x > sh.box.x1 || p.y < sh.box.y0 || p.y > sh.box.y1)) return false; var w = windAt(sh.rings, p); return sh.rule === 'e' ? w % 2 !== 0 : w !== 0; }
  function planar(shapes) {
    var V = [], segs = [], x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    shapes.forEach(function (sh) {
      var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      sh.rings.forEach(function (r) { r.forEach(function (v) { b.x0 = Math.min(b.x0, v.x); b.y0 = Math.min(b.y0, v.y); b.x1 = Math.max(b.x1, v.x); b.y1 = Math.max(b.y1, v.y); }); });
      sh.box = b; x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
    });
    if (!isFinite(x0)) return null;
    var diag = Math.hypot(x1 - x0, y1 - y0) || 1, eps = diag * 1e-9 + 1e-9, cellE = eps * 4, VH = new Map();
    // (points closer than eps are one point)
    var vid = function (p, brk, sm) {
      var cx = Math.floor(p.x / cellE), cy = Math.floor(p.y / cellE);
      for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) {
        var l = VH.get((cx + i) + ',' + (cy + j)); if (!l) continue;
        for (var k = 0; k < l.length; k++) { var w = V[l[k]]; if (Math.abs(w.x - p.x) <= eps && Math.abs(w.y - p.y) <= eps) { if (brk) w.b = true; if (!sm) w.sm = false; return l[k]; } }
      }
      var id = V.length; V.push({ x: p.x, y: p.y, b: !!brk, sm: !!sm, out: [] });
      var key = cx + ',' + cy, l2 = VH.get(key); if (l2) l2.push(id); else VH.set(key, [id]);
      return id;
    };
    shapes.forEach(function (sh) { sh.rings.forEach(function (r) { for (var i = 0; i < r.length; i++) { var a = r[i], b = r[(i + 1) % r.length]; if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > eps) segs.push({ a: a, b: b, cuts: [] }); } }); });
    // (crossings: segments sorted into a grid, each pair in a cell tried once)
    var avg = 0; segs.forEach(function (q) { avg += dist(q.a, q.b); }); avg /= Math.max(1, segs.length);
    var cell = Math.max(avg * 2, diag / 400, 1e-6), G = new Map(), seen = new Set(), N = segs.length;
    segs.forEach(function (q, i) {
      var gx0 = Math.floor((Math.min(q.a.x, q.b.x) - x0) / cell), gx1 = Math.floor((Math.max(q.a.x, q.b.x) - x0) / cell), gy0 = Math.floor((Math.min(q.a.y, q.b.y) - y0) / cell), gy1 = Math.floor((Math.max(q.a.y, q.b.y) - y0) / cell);
      for (var gx = gx0; gx <= gx1; gx++) for (var gy = gy0; gy <= gy1; gy++) { var k = gx * 1000 + gy, l = G.get(k); if (l) l.push(i); else G.set(k, [i]); }
    });
    var isect = function (S, T) {
      var p = S.a, r = vsub(S.b, S.a), q = T.a, s = vsub(T.b, T.a), rxs = r.x * s.y - r.y * s.x, qp = vsub(q, p), rr = vdot(r, r), ss = vdot(s, s), lr = Math.sqrt(rr), ls = Math.sqrt(ss);
      if (Math.abs(rxs) <= 1e-10 * lr * ls) {
        if (Math.abs(qp.x * r.y - qp.y * r.x) > eps * lr) return;
        [T.a, T.b].forEach(function (e) { var t = vdot(vsub(e, p), r) / rr; if (t > 1e-12 && t < 1 - 1e-12) S.cuts.push({ t: t, p: e, x: true }); });
        [S.a, S.b].forEach(function (e) { var u = vdot(vsub(e, q), s) / ss; if (u > 1e-12 && u < 1 - 1e-12) T.cuts.push({ t: u, p: e, x: true }); });
        return;
      }
      var t = (qp.x * s.y - qp.y * s.x) / rxs, u = (qp.x * r.y - qp.y * r.x) / rxs, e1 = 1e-9;
      if (t < -e1 || t > 1 + e1 || u < -e1 || u > 1 + e1) return;
      var X = t <= e1 ? S.a : t >= 1 - e1 ? S.b : u <= e1 ? T.a : u >= 1 - e1 ? T.b : { x: p.x + r.x * t, y: p.y + r.y * t };
      if (t > e1 && t < 1 - e1) S.cuts.push({ t: t, p: X, x: true });
      if (u > e1 && u < 1 - e1) T.cuts.push({ t: u, p: X, x: true });
    };
    G.forEach(function (l) {
      for (var i = 0; i < l.length; i++) for (var j = i + 1; j < l.length; j++) {
        var a = Math.min(l[i], l[j]), b = Math.max(l[i], l[j]), pk = a * N + b; if (seen.has(pk)) continue; seen.add(pk);
        var S = segs[a], T = segs[b];
        if (Math.max(S.a.x, S.b.x) < Math.min(T.a.x, T.b.x) - eps || Math.max(T.a.x, T.b.x) < Math.min(S.a.x, S.b.x) - eps || Math.max(S.a.y, S.b.y) < Math.min(T.a.y, T.b.y) - eps || Math.max(T.a.y, T.b.y) < Math.min(S.a.y, S.b.y) - eps) continue;
        isect(S, T);
      }
    });
    // (the edges, each once, with a half for each way along it)
    var E = new Set(), hes = [];
    var addE = function (u, v) { if (u === v) return; var key = u < v ? u + '_' + v : v + '_' + u; if (E.has(key)) return; E.add(key); var h = { o: u, d: v }, t = { o: v, d: u }; h.tw = t; t.tw = h; hes.push(h, t); V[u].out.push(h); V[v].out.push(t); };
    segs.forEach(function (S) {
      S.cuts.sort(function (a, b) { return a.t - b.t; });
      var ids = [vid(S.a, S.a.b, S.a.sm)]; S.cuts.forEach(function (c) { ids.push(vid(c.p, c.x || c.p.b, !c.x && c.p.sm)); }); ids.push(vid(S.b, S.b.b, S.b.sm));
      for (var k = 0; k + 1 < ids.length; k++) addE(ids[k], ids[k + 1]);
    });
    V.forEach(function (v) {
      if (v.out.length > 2) { v.b = true; v.sm = false; } // (where more than two edges meet: a corner to keep)
      v.out.forEach(function (h) { var w = V[h.d]; h.an = Math.atan2(w.y - v.y, w.x - v.x); });
      v.out.sort(function (a, b) { return a.an - b.an; }); v.out.forEach(function (h, i) { h.ix = i; });
    });
    hes.forEach(function (h) { var L = V[h.d].out; h.nx = L[(h.tw.ix - 1 + L.length) % L.length]; });
    // (the cycles: a bounded face goes round with a positive area, the
    // outside of each connected piece with a negative one)
    var C = [];
    hes.forEach(function (h) {
      if (h.cy != null) return;
      var c = { h: [], area: 0 }, cur = h, g = 0;
      do { cur.cy = C.length; c.h.push(cur); var a = V[cur.o], b = V[cur.d]; c.area += a.x * b.y - b.x * a.y; cur = cur.nx; } while (cur !== h && ++g < 2000000);
      c.area /= 2; C.push(c);
    });
    // (which shapes each cycle's side is inside, from a point just to its left)
    var off0 = diag * 1e-5 + 1e-7;
    C.forEach(function (c) {
      var best = null, bl = -1;
      c.h.forEach(function (h) { var a = V[h.o], b = V[h.d], l = dist(a, b), w = (h.tw.cy !== h.cy ? 1 : 0) * 1e9 + l; if (w > bl) { bl = w; best = h; } });
      var a = V[best.o], b = V[best.d], l = dist(a, b) || 1, off = Math.min(l * 0.25, off0);
      c.sp = v2((a.x + b.x) / 2 - (b.y - a.y) / l * off, (a.y + b.y) / 2 + (b.x - a.x) / l * off);
      c.mem = shapes.map(function (sh) { return inShape(sh, c.sp); });
    });
    return { V: V, hes: hes, C: C, shapes: shapes, diag: diag };
  }
  // (the faces: each bounded cycle, with the outsides of the pieces inside it as its holes)
  function arrFaces(A) {
    if (A.F) return A.F;
    var pos = [], F = [], minA = A.diag * A.diag * 1e-12;
    A.C.forEach(function (c, i) {
      c.poly = c.h.map(function (h) { return A.V[h.o]; }); var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      c.poly.forEach(function (v) { b.x0 = Math.min(b.x0, v.x); b.y0 = Math.min(b.y0, v.y); b.x1 = Math.max(b.x1, v.x); b.y1 = Math.max(b.y1, v.y); }); c.box = b;
      if (c.area > minA) { c.face = F.length; F.push({ c: i, holes: [], mem: c.mem, area: c.area }); pos.push(i); } else c.face = -1;
    });
    A.C.forEach(function (c, i) {
      if (c.face >= 0) return;
      var s = c.sp, best = -1;
      F.forEach(function (f, k) { var pc = A.C[f.c]; if (s.x >= pc.box.x0 && s.x <= pc.box.x1 && s.y >= pc.box.y0 && s.y <= pc.box.y1 && (best < 0 || f.area < F[best].area) && inPoly(pc.poly, s)) best = k; });
      c.face = best; if (best >= 0) F[best].holes.push(i);
    });
    A.F = F; return F;
  }
  // (the rings round the kept cycles: the half-edges with a kept cycle on
  // their left and a dropped one on their right, joined end to end)
  function arrExtract(A, keep) {
    var K = A.C.map(function (c, i) { return !!keep(i, c); }), isB = function (h) { return K[h.cy] && !K[h.tw.cy]; }, done = new Set(), out = [];
    A.hes.forEach(function (h) {
      if (done.has(h) || !isB(h)) return;
      var ring = [], cur = h, g = 0;
      do {
        done.add(cur); ring.push(A.V[cur.o]);
        var n = cur.nx, g2 = 0; while (!isB(n) && ++g2 < 100000) n = n.tw.nx;
        cur = n;
      } while (cur !== h && !done.has(cur) && ++g < 2000000);
      out.push(ring);
    });
    return out.map(despike).filter(function (r) { return r.length >= 3 && Math.abs(ringArea(r)) > A.diag * A.diag * 1e-12; });
  }
  function ringArea(r) { var a = 0; for (var i = 0; i < r.length; i++) { var p = r[i], q = r[(i + 1) % r.length]; a += p.x * q.y - q.x * p.y; } return a / 2; }
  // (no doubling back on itself, no point twice in a row)
  function despike(r) {
    var out = r.slice(), ch = true, g = 0;
    while (ch && out.length > 2 && g++ < 10000) {
      ch = false;
      for (var i = 0; i < out.length && out.length > 2; i++) {
        var a = out[(i - 1 + out.length) % out.length], b = out[i], c = out[(i + 1) % out.length];
        if (a === b) { out.splice(i, 1); ch = true; break; }
        if (a === c) { out.splice(i, 1); out.splice(i % out.length, 1); ch = true; break; }
      }
    }
    return out;
  }
  // (a ring back to curves: between anchors and corners, the run of points
  // fitted again; a smooth anchor keeps the same way out both sides)
  function ringToSp(R, err) {
    var n = R.length, brk = []; R.forEach(function (v, i) { if (v.b) brk.push(i); });
    var at = function (i) { return R[((i % n) + n) % n]; }, segs = [];
    if (!brk.length) { segs = fitCurves(R.concat([R[0]]), err); return { pts: bzPts(segs, true), closed: true }; }
    for (var k = 0; k < brk.length; k++) {
      var i = brk[k], j = k + 1 < brk.length ? brk[k + 1] : brk[0] + n, run = [];
      for (var q = i; q <= j; q++) run.push(at(q));
      var a = run[0], b = run[run.length - 1];
      if (run.length === 2 || run.every(function (p) { var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy); return (L ? Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / L : dist(p, a)) <= err * 0.35; })) { segs.push([v2(a.x, a.y), v2(a.x, a.y), v2(b.x, b.y), v2(b.x, b.y)]); continue; }
      var tl = a.sm ? vnorm(vsub(at(i + 1), at(i - 1))) : null, tr = b.sm ? vnorm(vsub(at(j - 1), at(j + 1))) : null;
      segs = segs.concat(fitCurves(run, err, tl, tr));
    }
    return cleanSp({ pts: bzPts(segs, true), closed: true });
  }
  // (a corner in the middle of a straight line isn't one)
  function cleanSp(sp) {
    var pts = sp.pts, g = 0;
    for (var i = 0; i < pts.length && pts.length > 3 && g++ < 100000; i++) {
      var n = pts.length, a = pts[(i - 1 + n) % n], q = pts[i], b = pts[(i + 1) % n];
      if (hasIn(q) || hasOut(q) || hasOut(a) || hasIn(b)) continue;
      var c = (q.x - a.x) * (b.y - q.y) - (q.y - a.y) * (b.x - q.x), L = dist(a, q) * dist(q, b);
      if (L > 0 && Math.abs(c) <= 1e-6 * L && (q.x - a.x) * (b.x - q.x) + (q.y - a.y) * (b.y - q.y) > 0) { pts.splice(i, 1); i--; }
    }
    return sp;
  }
  function ringsToD(rings, err) { return rings.map(function (r) { return ringToSp(r, err); }).filter(function (sp) { return sp.pts.length >= 2; }); }
  // (one operation on the shapes (bottom first): the rings of what's kept)
  var OPS = {
    union: function (m) { return m.some(Boolean); },
    intersect: function (m) { return m.length > 0 && m.every(Boolean); },
    minus: function (m) { return m[0] && !m.slice(1).some(Boolean); },
    exclude: function (m) { return m.filter(Boolean).length % 2 === 1; }
  };
  function boolRings(shapes, op) { var A = planar(shapes); if (!A) return []; return arrExtract(A, function (i, c) { return OPS[op](c.mem); }); }
  // (rings into separate shapes: each outline with the holes inside it)
  function splitRings(rings) {
    var outs = [], holes = [];
    rings.forEach(function (r) { (ringArea(r) > 0 ? outs : holes).push(r); });
    var groups = outs.map(function (r) { return { o: r, a: ringArea(r), h: [] }; });
    holes.forEach(function (h) {
      var best = null; groups.forEach(function (g) { if (inPoly(g.o, h[0]) && (!best || g.a < best.a)) best = g; });
      if (best) best.h.push(h); else if (groups[0]) groups[0].h.push(h);
    });
    return groups.map(function (g) { return [g.o].concat(g.h); });
  }

  // ---- LIVE EFFECTS: a path or group can carry a warp or an envelope
  // (n.efx), a group can be a blend (n.blnd: its items the keys, the steps
  // between made as it's drawn) or a repeat (n.rep: radial, grid or
  // mirror copies of its items). What's drawn, hit and boxed is a stand-in
  // made from them (shownOf); the objects themselves stay as they were, so
  // they can still be edited, and Expand makes the stand-in real ----
  var SHOWN = new Map();
  function hasFx(n) { return !!(n && (n.efx || n.rep || n.blnd)); }
  function shownOf(n) {
    if (!hasFx(n)) return n;
    var key = JSON.stringify(n), hit = SHOWN.get(n.id); if (hit && hit.key === key) return hit.v;
    var v = makeShown(n); SHOWN.set(n.id, { key: key, v: v }); if (SHOWN.size > 400) SHOWN.delete(SHOWN.keys().next().value);
    return v;
  }
  function makeShown(n) {
    var c = clone(n); delete c.efx; delete c.rep; delete c.blnd;
    if (n.type === 'path') { c.d = effD(n.d, n.efx, dBox(n.d)); return c; }
    if (!isCont(n)) return c;
    c.items = n.items.map(function (q) { return clone(shownOf(q)); });
    if (n.blnd) c.items = blendItems(c.items, n.blnd, n.id);
    if (n.rep) c.items = repeatItems(c.items, n.rep, n.id);
    if (n.efx) { var b = boxOf(c.items); if (b) c.items.forEach(function (q) { leaves(q).forEach(function (l) { if (l.type === 'path') l.d = effD(l.d, n.efx, b); }); }); }
    return c;
  }
  // (a path's subpaths cut finer, so a warp bends it smoothly)
  function finer(d, b) {
    var step = Math.max(b.w, b.h) / 24;
    return d.map(function (sp) {
      var out = { pts: sp.pts.map(cp), closed: sp.closed };
      for (var i = segN(out) - 1; i >= 0; i--) { var s = seg(out, i), L = dist(s[0], s[1]) + dist(s[1], s[2]) + dist(s[2], s[3]), m = Math.min(16, Math.max(1, Math.ceil(L / Math.max(step, 1e-6)))); for (var k = m; k > 1; k--) insertAt(out, i, (k - 1) / k); }
      return out;
    });
  }
  function effD(d, fx, b) {
    if (!fx || !b || b.w < 1e-9 && b.h < 1e-9) return d;
    var f = fx.k === 'env' ? envMap(fx, b) : warpMap(fx, b); if (!f) return d;
    var dd = finer(d, b);
    dd.forEach(function (sp) { sp.pts.forEach(function (q) { var a = f(q.x, q.y), i = f(q.ix, q.iy), o = f(q.ox, q.oy); q.x = a.x; q.y = a.y; q.ix = i.x; q.iy = i.y; q.ox = o.x; q.oy = o.y; }); });
    return dd;
  }
  // WARP: a shape for the whole box, in its own fractions (u across, v
  // down), bent by fx.bend, with a little perspective either way (hd, vd);
  // dir 'v' bends the other way
  var WARPS = [['arc', 'Arc'], ['arclow', 'Arc Lower'], ['archigh', 'Arc Upper'], ['bulge', 'Bulge'], ['flag', 'Flag'], ['wave', 'Wave'], ['fish', 'Fish'], ['rise', 'Rise'], ['fisheye', 'Fisheye'], ['inflate', 'Inflate'], ['squeeze', 'Squeeze'], ['twist', 'Twist']];
  function warpUV(st, u, v, k) { // (u, v in 0..1; returns the new u, v)
    var c = 1 - (2 * u - 1) * (2 * u - 1);
    switch (st) {
      case 'arc': return [u, v - k * 0.5 * c];
      case 'arclow': return [u, v - k * 0.5 * c * v];
      case 'archigh': return [u, v - k * 0.5 * c * (1 - v)];
      case 'bulge': return [u, v - k * 0.5 * c * (1 - 2 * v)];
      case 'flag': return [u, v + k * 0.25 * Math.sin(2 * Math.PI * u)];
      case 'wave': return [u, v + k * 0.25 * Math.sin(2 * Math.PI * u) * (1 - Math.abs(2 * v - 1))];
      case 'fish': return [u, 0.5 + (v - 0.5) * (1 + k * 0.6 * Math.sin(Math.PI * u) * (u < 0.5 ? 1 : -1))];
      case 'rise': return [u, v - k * 0.5 * u * u * (1 + (0.5 - v))];
      case 'fisheye': { var dx = u - 0.5, dy = v - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2, m = r < 1 ? 1 + k * 0.6 * (1 - r * r) : 1; return [0.5 + dx * m, 0.5 + dy * m]; }
      case 'inflate': { var cu = 1 - (2 * v - 1) * (2 * v - 1); return [0.5 + (u - 0.5) * (1 + k * 0.4 * cu), 0.5 + (v - 0.5) * (1 + k * 0.4 * c)]; }
      case 'squeeze': { var cv = 1 - (2 * v - 1) * (2 * v - 1); return [0.5 + (u - 0.5) * (1 - k * 0.5 * cv), v]; }
      case 'twist': { var tx = u - 0.5, ty = v - 0.5, rr = Math.min(1, Math.sqrt(tx * tx + ty * ty) * 2), an = k * Math.PI * (1 - rr), cs = Math.cos(an), sn = Math.sin(an); return [0.5 + tx * cs - ty * sn, 0.5 + tx * sn + ty * cs]; }
    }
    return [u, v];
  }
  function warpMap(fx, b) {
    var W = Math.max(b.w, 1e-6), Hh = Math.max(b.h, 1e-6), k = fx.bend / 100, hd = fx.hd / 100, vd = fx.vd / 100, vert = fx.dir === 'v';
    return function (x, y) {
      var u = (x - b.x) / W, v = (y - b.y) / Hh, r;
      if (vert) { r = warpUV(fx.st, v, u, k); r = [r[1], r[0]]; } else r = warpUV(fx.st, u, v, k);
      u = r[0]; v = r[1];
      u = 0.5 + (u - 0.5) * (1 + hd * (v - 0.5)); v = 0.5 + (v - 0.5) * (1 + vd * (u - 0.5));
      return v2(b.x + u * W, b.y + v * Hh);
    };
  }
  // ENVELOPE (a mesh): fx.m holds (rows+1) × (cols+1) points in the box's
  // fractions; a point is put where its cell's four corners say (smoothly
  // across the cells, through Catmull-Rom between the mesh's points)
  function envGrid(rows, cols) { var m = []; for (var j = 0; j <= rows; j++) for (var i = 0; i <= cols; i++) m.push([i / cols, j / rows]); return m; }
  function envMap(fx, b) {
    var R = fx.rows, C = fx.cols, m = fx.m; if (!m || m.length !== (R + 1) * (C + 1)) return null;
    var at = function (i, j) { i = Math.max(0, Math.min(C, i)); j = Math.max(0, Math.min(R, j)); var q = m[j * (C + 1) + i]; return q; };
    var cr = function (p0, p1, p2, p3, t) { var t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
    // (a point past the mesh's edge goes on as its edge leans)
    var ext = function (i, j, k) { if (i >= 0 && i <= C && j >= 0 && j <= R) return at(i, j)[k]; var ci = Math.max(0, Math.min(C, i)), cj = Math.max(0, Math.min(R, j)), di = i - ci, dj = j - cj, a = at(ci, cj)[k]; return a + (a - at(ci - di, cj - dj)[k]); };
    return function (x, y) {
      var u = (x - b.x) / Math.max(b.w, 1e-6) * C, v = (y - b.y) / Math.max(b.h, 1e-6) * R, i = Math.max(0, Math.min(C - 1, Math.floor(u))), j = Math.max(0, Math.min(R - 1, Math.floor(v))), s = u - i, t = v - j, out = [0, 0];
      [0, 1].forEach(function (k) {
        var rows = [-1, 0, 1, 2].map(function (dj) { return cr(ext(i - 1, j + dj, k), ext(i, j + dj, k), ext(i + 1, j + dj, k), ext(i + 2, j + dj, k), s); });
        out[k] = cr(rows[0], rows[1], rows[2], rows[3], t);
      });
      return v2(b.x + out[0] * b.w, b.y + out[1] * b.h);
    };
  }
  // (a mesh made from a warp, so it can be pulled about afterwards)
  function envFromWarp(st, bend, rows, cols) { var f = warpMap({ st: st, bend: bend, hd: 0, vd: 0, dir: 'h' }, { x: 0, y: 0, w: 1, h: 1 }); return envGrid(rows, cols).map(function (q) { var r = f(q[0], q[1]); return [r.x, r.y]; }); }
  // BLEND: the steps between each key and the next, their shapes and looks in between
  function blendItems(items, bl, gid) {
    var keys = items, out = [];
    keys.forEach(function (a, i) {
      out.push(a); var b = keys[i + 1]; if (!b || a.type !== 'path' || b.type !== 'path') return;
      var n = bl.smooth ? smoothSteps(a, b) : Math.max(1, Math.min(500, bl.steps | 0)), pair = matchPaths(a.d, b.d);
      for (var k = 1; k <= n; k++) {
        var t = k / (n + 1), st = clone(a); st.id = gid + '~b' + i + '-' + k; st.name = 'Step';
        st.d = pair.a.map(function (sp, si) { var sb = pair.b[si]; return { pts: sp.pts.map(function (q, pi) { var r = sb.pts[pi]; var L = function (f) { return q[f] + (r[f] - q[f]) * t; }; return { x: L('x'), y: L('y'), ix: L('ix'), iy: L('iy'), ox: L('ox'), oy: L('oy'), s: q.s }; }), closed: sp.closed }; });
        st.app = blendApp(a.app, b.app, t); st.opacity = (a.opacity == null ? 1 : a.opacity) + ((b.opacity == null ? 1 : b.opacity) - (a.opacity == null ? 1 : a.opacity)) * t;
        delete st.live; out.push(st);
      }
    });
    return out;
  }
  function hexMix(a, b, t) { var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), m = function (s) { return Math.round(((x >> s) & 255) + (((y >> s) & 255) - ((x >> s) & 255)) * t); }; return '#' + [16, 8, 0].map(function (s) { return ('0' + m(s).toString(16)).slice(-2); }).join(''); }
  function solidHex(p) { return !p ? null : p.t === 'c' ? p.c : p.st ? p.st[0].c : '#888888'; }
  function blendApp(A, Bp, t) {
    var out = [];
    ['f', 's'].forEach(function (k) {
      var a = A[topOf(A, k)], b = Bp[topOf(Bp, k)]; if (!a && !b) return;
      var it = clone(a || b), ca = solidHex(a && a.on && a.p), cb = solidHex(b && b.on && b.p);
      if (ca && cb) it.p = { t: 'c', c: hexMix(ca, cb, t) }; else it.p = t < 0.5 ? clone(a && a.p) : clone(b && b.p);
      it.o = (a ? a.o : 1) + ((b ? b.o : 1) - (a ? a.o : 1)) * t; it.on = 1;
      if (k === 's') { it.w = (a ? a.w : 0) + ((b ? b.w : 0) - (a ? a.w : 0)) * t; it.prof = null; }
      out.push(it);
    });
    return out;
  }
  function smoothSteps(a, b) {
    var ca = solidHex(itemOf(a.app, 'f', false) && itemOf(a.app, 'f', false).p) || '#000000', cb = solidHex(itemOf(b.app, 'f', false) && itemOf(b.app, 'f', false).p) || '#000000';
    var x = parseInt(ca.slice(1), 16), y = parseInt(cb.slice(1), 16), dm = Math.max(Math.abs((x >> 16) - (y >> 16)), Math.abs((x >> 8 & 255) - (y >> 8 & 255)), Math.abs((x & 255) - (y & 255)));
    return Math.max(1, Math.min(255, Math.round(dm / 3)));
  }
  // (two paths made alike: the same subpaths, each with as many points,
  // the closed ones started where they're nearest)
  function matchPaths(da, db) {
    var n = Math.min(da.length, db.length), A = dCopy(da.slice(0, n)), Bd = dCopy(db.slice(0, n));
    A.forEach(function (sa, i) {
      var sb = Bd[i];
      var grow = function (sp, want) { var g = 0; while (sp.pts.length < want && g++ < 2000) { var best = 0, bl = -1; for (var k = 0; k < segN(sp); k++) { var s = seg(sp, k), L = dist(s[0], s[3]) + dist(s[0], s[1]) + dist(s[2], s[3]); if (L > bl) { bl = L; best = k; } } insertAt(sp, best, 0.5); } };
      if (sa.pts.length < sb.pts.length) grow(sa, sb.pts.length); else grow(sb, sa.pts.length);
      if (sa.closed && sb.closed && sb.pts.length > 2) {
        var N = sb.pts.length, bestR = 0, bestD = Infinity, ca = boxC(sa), cb = boxC(sb);
        for (var r = 0; r < N; r++) { var tot = 0; for (var k = 0; k < N; k++) { var p = sa.pts[k], q = sb.pts[(k + r) % N]; tot += Math.hypot(p.x - ca.x - (q.x - cb.x), p.y - ca.y - (q.y - cb.y)); } if (tot < bestD) { bestD = tot; bestR = r; } }
        sb.pts = sb.pts.slice(bestR).concat(sb.pts.slice(0, bestR));
      }
    });
    return { a: A, b: Bd };
  }
  function boxC(sp) { var b = dBox([sp]) || { x: 0, y: 0, w: 0, h: 0 }; return v2(b.x + b.w / 2, b.y + b.h / 2); }
  // REPEAT: copies of the group's items round a middle (radial), in rows
  // and columns (grid), or mirrored across a line (mirror)
  function repeatItems(items, rp, gid) {
    var b = boxOf(items); if (!b) return items;
    var out = items.slice(), copy = function (k, m) { items.forEach(function (q) { var c = clone(q); (function re(x, j) { x.id = gid + '~r' + k + '-' + j + '-' + x.id; if (isCont(x)) x.items.forEach(function (y, jj) { re(y, jj); }); })(c, 0); xform(c, m); out.push(c); }); };
    if (rp.k === 'radial') {
      var n = Math.max(2, Math.min(200, rp.n | 0)), c = v2(b.x + b.w / 2, b.y + b.h / 2 + Math.max(1, rp.r));
      for (var k = 1; k < n; k++) copy(k, mRot(k * 2 * Math.PI / n, c));
    } else if (rp.k === 'grid') {
      var R = Math.max(1, Math.min(50, rp.rows | 0)), C = Math.max(1, Math.min(50, rp.cols | 0));
      for (var j = 0; j < R; j++) for (var i = 0; i < C; i++) { if (!i && !j) continue; copy(j * C + i, [1, 0, 0, 1, i * (b.w + rp.gx), j * (b.h + rp.gy)]); }
    } else if (rp.k === 'mirror') {
      var a = rp.a * Math.PI / 180, o = v2(b.x + b.w + rp.off / 2, b.y + b.h / 2);
      copy(1, mRefl(a, o));
    }
    return out;
  }
  // PATTERNS: doc.pats ({ id, name, items, w, h, gap }), tiles made from
  // art; a fill or stroke paint { t: 'p', id, s, a, x, y } (size, turn, shift)
  var patIds = {};
  function patById(id) { return doc && doc.pats ? doc.pats.filter(function (q) { return q.id === id; })[0] : null; }
  function patTile(pt) { var b = boxOf(pt.items) || { x: 0, y: 0, w: 1, h: 1 }; return { x: b.x - pt.gap / 2, y: b.y - pt.gap / 2, w: Math.max(1, b.w + pt.gap), h: Math.max(1, b.h + pt.gap) }; }
  function patDef(id, p) {
    var pt = patById(p.id); if (!pt) return '';
    var t = patTile(pt);
    return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" x="' + r2(t.x) + '" y="' + r2(t.y) + '" width="' + r2(t.w) + '" height="' + r2(t.h) + '" patternTransform="translate(' + r2(p.x) + ' ' + r2(p.y) + ') rotate(' + r2(p.a) + ') scale(' + r2(p.s) + ')">' + pt.items.map(function (q) { return nodeSvg(q, false); }).join('') + '</pattern>';
  }
  function patCanvas(x, p) {
    var pt = patById(p.id); if (!pt) return 'rgba(0,0,0,0)';
    var t = patTile(pt), m = x.getTransform(), k = Math.max(0.05, Math.min(8, Math.hypot(m.a, m.b) * p.s)), W = Math.max(1, Math.round(t.w * k)), Hh = Math.max(1, Math.round(t.h * k));
    if (W * Hh > 4e6) { k *= Math.sqrt(4e6 / (W * Hh)); W = Math.max(1, Math.round(t.w * k)); Hh = Math.max(1, Math.round(t.h * k)); }
    var c = document.createElement('canvas'); c.width = W; c.height = Hh; var cx = c.getContext('2d'); cx.setTransform(W / t.w, 0, 0, Hh / t.h, -t.x * W / t.w, -t.y * Hh / t.h);
    pt.items.forEach(function (q) { cDraw(cx, q); });
    var pat = x.createPattern(c, 'repeat'), M = new DOMMatrix().translate(p.x, p.y).rotate(p.a).scale(p.s).translate(t.x, t.y).scale(t.w / W, t.h / Hh);
    pat.setTransform(M); return pat;
  }
  function patSwatch(pt, sz) { var t = patTile(pt); return '<svg viewBox="0 0 ' + sz + ' ' + sz + '" aria-hidden="true"><defs>' + patDef('vpp-' + pt.id, { id: pt.id, s: sz / Math.max(t.w, t.h), a: 0, x: -t.x * sz / Math.max(t.w, t.h), y: -t.y * sz / Math.max(t.w, t.h) }) + '</defs><rect width="' + sz + '" height="' + sz + '" fill="url(#vpp-' + pt.id + ')"/></svg>'; }
  function makePattern() {
    var list = picked().filter(editable); if (!list.length) { B.toast('Pick the art to make a pattern from'); return; }
    var items = stackOrder(list).map(function (n) { var c = fresh(n); return c; }), b = boxOf(items);
    items.forEach(function (c) { xform(c, [1, 0, 0, 1, -b.x, -b.y]); (function strip(q) { if (q.app) q.app.forEach(function (it) { if (it.p && it.p.t === 'p') it.p = null; }); if (isCont(q)) q.items.forEach(strip); })(c); });
    record('Make Pattern');
    var n = 1; while (doc.pats.some(function (q) { return q.name === 'Pattern ' + n; })) n++;
    var pt = { id: 'P' + uid(''), name: 'Pattern ' + n, items: items, gap: 0 }; doc.pats.push(pt); TS.pattern.cur = pt.id; changed();
    B.toast('Made ' + pt.name + ': pick shapes and tap it to fill them');
  }
  function usePattern(id) {
    var list = targets(); if (!list.length) { TS.pattern.cur = id; panelRefresh(); B.toast('Pick shapes to fill with the pattern'); return; }
    record('Pattern Fill'); TS.pattern.cur = id;
    list.forEach(function (n) { var it = itemOf(n.app, TS.pattern.to === 's' ? 's' : 'f', true); it.p = { t: 'p', id: id, s: 1, a: 0, x: 0, y: 0 }; it.on = 1; if (it.k === 's' && !(it.w > 0)) it.w = 8; });
    changed();
  }
  function patItem() { var t = targets(), app = t.length ? t[t.length - 1].app : null, it = app ? itemOf(app, TS.pattern.to === 's' ? 's' : 'f', false) : null; return it && it.p && it.p.t === 'p' ? it : null; }
  // OPACITY MASKS (Transparency): a group with omask: its top item is the
  // mask, light shows and dark hides (inv the other way round; clip hides
  // what's outside the mask's art); iso keeps a group's blending inside it
  var INV = '<filter id="vinv" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0"/></filter>';
  function maskSvg(n, forScreen) {
    var mk = n.items[n.items.length - 1], om = n.omask;
    return '<g' + gAttrs(n, forScreen) + '><defs>' + INV + '<mask id="vm-' + n.id + '" maskUnits="userSpaceOnUse" x="-1000000" y="-1000000" width="2000000" height="2000000"><rect x="-1000000" y="-1000000" width="2000000" height="2000000" fill="' + (om.clip ? '#000' : '#fff') + '"/><g' + (om.inv ? ' filter="url(#vinv)"' : '') + '>' + nodeSvg(mk, false) + '</g></mask></defs><g mask="url(#vm-' + n.id + ')">' +
      n.items.slice(0, -1).map(function (q) { return nodeSvg(q, forScreen); }).join('') + '</g></g>';
  }
  function maskDraw(x, n) {
    var W = x.canvas.width, Hh = x.canvas.height, T = x.getTransform(), mk = n.items[n.items.length - 1], om = n.omask;
    var a = document.createElement('canvas'); a.width = W; a.height = Hh; var ax = a.getContext('2d'); ax.setTransform(T); n.items.slice(0, -1).forEach(function (q) { cDraw(ax, q); });
    var m = document.createElement('canvas'); m.width = W; m.height = Hh; var mx2 = m.getContext('2d'); mx2.setTransform(T); cDraw(mx2, mk);
    var ad = ax.getImageData(0, 0, W, Hh), md = mx2.getImageData(0, 0, W, Hh).data, bg = om.clip ? 0 : 1;
    for (var i = 0; i < md.length; i += 4) {
      var al = md[i + 3] / 255, L = (0.2126 * md[i] + 0.7152 * md[i + 1] + 0.0722 * md[i + 2]) / 255; if (om.inv) L = 1 - L;
      ad.data[i + 3] = Math.round(ad.data[i + 3] * (L * al + bg * (1 - al)));
    }
    ax.putImageData(ad, 0, 0);
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = n.opacity == null ? 1 : n.opacity; if (n.blend && n.blend !== 'normal') x.globalCompositeOperation = n.blend; x.drawImage(a, 0, 0); x.restore();
  }
  // OFFSET PATH: the path grown (or shrunk) by d: its area with (or
  // without) the band a stroke 2|d| wide along its edge covers, traced at a
  // fine size, corners kept where the joins are sharp
  function offsetPath(n, off, join, ml) {
    var b = dBox(n.d); if (!b || !off) return null;
    var a = Math.abs(off), bw = b.w + 2 * a + 4, bh = b.h + 2 * a + 4, k = Math.min(Math.max(4, 24 / a), 3000 / Math.max(bw, bh)), W = Math.ceil(bw * k) + 6, Hh = Math.ceil(bh * k) + 6, ox = 3 - (b.x - a - 2) * k, oy = 3 - (b.y - a - 2) * k;
    var c = document.createElement('canvas'); c.width = W; c.height = Hh; var x = c.getContext('2d', { willReadFrequently: true });
    x.setTransform(k, 0, 0, k, ox, oy); x.lineWidth = 2 * a; x.lineJoin = join; x.miterLimit = ml; x.lineCap = 'round'; x.strokeStyle = '#000'; x.stroke(new Path2D(dStr(n.d)));
    var band = { rings: maskRings(x.getImageData(0, 0, W, Hh).data, W, Hh, function (q) { return v2((q.x - ox) / k, (q.y - oy) / k); }, join !== 'round'), rule: 'n' };
    var closed = n.d.some(function (sp) { return sp.closed; }), tol = boolTol([n]), err = Math.max(0.6 / k, tol * 2);
    if (!closed) return ringsToD(boolRings([band], 'union'), err);
    var me = shapeOf(n, tol);
    return ringsToD(boolRings(off > 0 ? [me, band] : [me, band], off > 0 ? 'union' : 'minus'), err);
  }
  // (a mask's edges as rings for the shape engine; corner: sharp turns are
  // kept as corners when the curves are fitted again)
  function maskRings(img, W, Hh, map, corner) {
    var mask = new Uint8Array(W * Hh); for (var i = 0; i < W * Hh; i++) mask[i] = img[i * 4 + 3] > 127 ? 1 : 0;
    return traceMask(mask, W, Hh).filter(function (lp) { return lp.length > 3; }).map(function (lp) {
      var poly = rdp(lp.concat([lp[0]]), 0.6).slice(0, -1), N = poly.length;
      return poly.map(function (q, j) { var A = poly[(j - 1 + N) % N], C = poly[(j + 1) % N], u = vnorm(vsub(q, A)), w = vnorm(vsub(C, q)), m = map(q); return { x: m.x, y: m.y, b: !!corner && u.x * w.x + u.y * w.y < 0.5, sm: true }; });
    }).filter(function (r) { return r.length >= 3; });
  }
  // IMAGE TRACE: a picture as paths: its colours brought down to a few (or
  // black and white), each colour's areas traced and fitted with curves,
  // one path each, the picture hidden under them
  function imageTrace(n) {
    var im = imgFor(n.asset), S = TS.trace; if (!im) return;
    im.ready.then(function () {
      if (!im.naturalWidth || !byId(n.id)) return;
      var sc = Math.min(1, 900 / Math.max(im.naturalWidth, im.naturalHeight)), W = Math.max(2, Math.round(im.naturalWidth * sc)), Hh = Math.max(2, Math.round(im.naturalHeight * sc));
      var c = document.createElement('canvas'); c.width = W; c.height = Hh; var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, W, Hh);
      var px = x.getImageData(0, 0, W, Hh).data, N = W * Hh, lab = new Int16Array(N).fill(-1), cols = [];
      if (S.mode === 'bw') {
        for (var i = 0; i < N; i++) if (px[i * 4 + 3] > 127 && (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) < S.th) lab[i] = 0;
        cols = ['#1d1d1f'];
      } else {
        // (k-means on a sample of the colours, then every pixel to its nearest)
        var K = Math.max(2, Math.min(16, S.n | 0)), grey = S.mode === 'grey', val = function (i) { var r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2]; if (grey) { var l = 0.2126 * r + 0.7152 * g + 0.0722 * b; return [l, l, l]; } return [r, g, b]; };
        var samp = []; for (var s2 = 0; s2 < 24000; s2++) { var j = Math.floor(Math.random() * N); if (px[j * 4 + 3] > 127) samp.push(val(j)); }
        if (!samp.length) { B.toast('There’s nothing to trace in that picture'); return; }
        var cen = []; for (var q = 0; q < K; q++) cen.push(samp[Math.floor(q * samp.length / K)].slice());
        for (var it = 0; it < 10; it++) {
          var sum = cen.map(function () { return [0, 0, 0, 0]; });
          samp.forEach(function (v) { var bi = 0, bd = Infinity; cen.forEach(function (cc, ci) { var d = (v[0] - cc[0]) * (v[0] - cc[0]) + (v[1] - cc[1]) * (v[1] - cc[1]) + (v[2] - cc[2]) * (v[2] - cc[2]); if (d < bd) { bd = d; bi = ci; } }); var su = sum[bi]; su[0] += v[0]; su[1] += v[1]; su[2] += v[2]; su[3]++; });
          cen = cen.map(function (cc, ci) { var su = sum[ci]; return su[3] ? [su[0] / su[3], su[1] / su[3], su[2] / su[3]] : cc; });
        }
        for (i = 0; i < N; i++) { if (px[i * 4 + 3] <= 127) continue; var v = val(i), bi = 0, bd = Infinity; for (var ci = 0; ci < K; ci++) { var cc = cen[ci], d = (v[0] - cc[0]) * (v[0] - cc[0]) + (v[1] - cc[1]) * (v[1] - cc[1]) + (v[2] - cc[2]) * (v[2] - cc[2]); if (d < bd) { bd = d; bi = ci; } } lab[i] = bi; }
        cols = cen.map(function (cc) { return '#' + cc.map(function (u) { return ('0' + Math.round(Math.max(0, Math.min(255, u))).toString(16)).slice(-2); }).join(''); });
      }
      // (to the picture's place on the artboard: its box, flips and matrix)
      var map = function (q) { var u = q.x / W, v = q.y / Hh; if (n.fx) u = 1 - u; if (n.fy) v = 1 - v; var p = v2(n.x + u * n.w, n.y + v * n.h); return n.mt ? mx(n.mt, p) : p; };
      var minA = S.noise * S.noise, err = 0.5 + S.smooth / 100 * 2.5, made = [];
      cols.forEach(function (col, ci) {
        var count = 0; for (var i2 = 0; i2 < N; i2++) if (lab[i2] === ci) count++;
        if (!count || (S.white && S.mode !== 'bw' && hexDist(col, '#ffffff') < 24)) return;
        // (each colour grown a pixel, so neighbours meet without a hairline gap)
        var m = new Uint8Array(N); for (var i3 = 0; i3 < N; i3++) if (lab[i3] === ci) m[i3] = 1;
        if (S.mode !== 'bw') { var g2 = m.slice(); for (var y = 1; y < Hh - 1; y++) for (var xx = 1; xx < W - 1; xx++) { var o = y * W + xx; if (!m[o] && (m[o - 1] || m[o + 1] || m[o - W] || m[o + W])) g2[o] = 1; } m = g2; }
        var loops = traceMask(m, W, Hh).filter(function (lp) { return lp.length > 3 && Math.abs(ringArea(lp)) >= minA; });
        var d = loops.map(function (lp) {
          var poly = rdp(lp.concat([lp[0]]), 0.6).slice(0, -1), L = poly.length;
          var R = poly.map(function (q, j) { var A = poly[(j - 1 + L) % L], C = poly[(j + 1) % L], u = vnorm(vsub(q, A)), w = vnorm(vsub(C, q)); return { x: q.x, y: q.y, b: u.x * w.x + u.y * w.y < 0.3, sm: false }; });
          var sp = ringToSp(R, err); sp.pts.forEach(function (q) { var a = map(q), ii = map(v2(q.ix, q.iy)), oo = map(v2(q.ox, q.oy)); q.x = a.x; q.y = a.y; q.ix = ii.x; q.iy = ii.y; q.ox = oo.x; q.oy = oo.y; });
          return sp;
        }).filter(function (sp) { return sp.pts.length > 2; });
        if (d.length) made.push({ d: d, col: col, n: count });
      });
      if (!made.length) { B.toast('Nothing came out of the trace: try another threshold or fewer colours'); return; }
      made.sort(function (a, b) { return b.n - a.n; }); // (the biggest areas at the bottom)
      record('Image Trace');
      var paths = made.map(function (m) { var q = newPath(m.d, m.col.toUpperCase(), [{ k: 'f', p: { t: 'c', c: m.col }, o: 1, on: 1 }]); q.opacity = 1; q.blend = 'normal'; return q; });
      var g = { id: uid('g'), type: 'group', name: 'Image Trace', items: paths, opacity: 1, blend: 'normal', visible: true, locked: false, open: false };
      var nn = byId(n.id); insertNode(g, nn); nn.visible = false; sel = [g.id]; asel = {}; changed();
      B.toast('Traced into ' + paths.length + (paths.length === 1 ? ' shape' : ' shapes') + '; the picture is hidden underneath');
    });
  }

  // ---- UNDO AND REDO: Vector mode's own steps (the painting has its own),
  // each a copy of the document as it was ----
  function snap() { return JSON.stringify({ layers: doc.layers, cur: doc.cur, n: doc.n, boards: doc.boards, ab: doc.ab, guides: doc.guides, pats: doc.pats, def: doc.def, sw: doc.sw, sel: sel, asel: asel }); }
  function restore(s) {
    var d = JSON.parse(s); doc.layers = d.layers; doc.cur = d.cur; doc.n = d.n; doc.boards = d.boards; doc.ab = d.ab; doc.guides = d.guides; doc.pats = d.pats; doc.def = d.def; doc.sw = d.sw;
    sel = (d.sel || []).filter(function (id) { return !!byId(id); });
    asel = {}; Object.keys(d.asel || {}).forEach(function (id) { if (byId(id)) asel[id] = d.asel[id]; });
  }
  function record(label) { hist.push({ s: snap(), label: label }); if (hist.length > HMAX) hist.shift(); fut = []; histButtons(); }
  function dropLast() { hist.pop(); histButtons(); } // (a step that came to nothing)
  function undo() { if (te) endEdit(); if (!hist.length) return; var e = hist.pop(); fut.push({ s: snap(), label: e.label }); restore(e.s); afterHist(); }
  function redo() { if (te) endEdit(); if (!fut.length) return; var e = fut.pop(); hist.push({ s: snap(), label: e.label }); restore(e.s); afterHist(); }
  function afterHist() { drag = null; penResync(); changed(true); pcRefresh(); }
  function histButtons() {
    if (!B || !on) return;
    B.undoBtn.disabled = !hist.length; B.redoBtn.disabled = !fut.length;
  }

  // ---- THE VIEW: the artboard on the screen, moved, zoomed and turned ----
  function vmat() { var c = Math.cos(view.r) * view.k, s = Math.sin(view.r) * view.k; return [c, s, -s, c, view.x, view.y]; }
  function toScreen(p) { return mx(vmat(), p); }
  function fromScreen(x, y) { return mx(mInv(vmat()), v2(x, y)); }
  function stageXY(e) { var r = stageEl.getBoundingClientRect(); return v2(e.clientX - r.left, e.clientY - r.top); }
  // (fitted: the same margin all round, clear of the Paint / Vector switch)
  var fitM = 34, fitT = 34;
  function fitView() {
    var sw = stageEl.clientWidth, sh = stageEl.clientHeight; if (!sw || !sh || !doc) return;
    fitM = fitT = B.phone() ? 10 : 34;
    var me = B.modeEl; if (me && me.offsetParent) fitT = Math.max(fitM, me.getBoundingClientRect().bottom - stageEl.getBoundingClientRect().top + 8);
    var A = AB(); fitK = Math.max(0.01, Math.min((sw - 2 * fitM) / A.w, (sh - fitT - fitM) / A.h));
  }
  function fit() {
    fitView(); if (!doc) return;
    var sw = stageEl.clientWidth, sh = stageEl.clientHeight;
    var A = AB(); view.k = fitK; view.r = 0; view.x = (sw - A.w * fitK) / 2 - A.x * fitK; view.y = fitT + (sh - fitT - fitM - A.h * fitK) / 2 - A.y * fitK; view.fit = true;
    applyView();
  }
  // (the point of the artboard under (cx, cy) stays there)
  function keepAt(p, cx, cy) { var s = toScreen(p); view.x += cx - s.x; view.y += cy - s.y; }
  function zoomAt(k, cx, cy) {
    var p = fromScreen(cx, cy);
    view.k = Math.max(fitK * 0.1, Math.min(fitK * 64, k)); keepAt(p, cx, cy); view.fit = false; applyView();
  }
  function rotateAt(r, cx, cy) { var p = fromScreen(cx, cy); view.r = r; keepAt(p, cx, cy); view.fit = false; applyView(); }
  function zoomStep(dir) { zoomAt(view.k * (dir > 0 ? 1.25 : 0.8), stageEl.clientWidth / 2, stageEl.clientHeight / 2); }
  function actualSize() { zoomAt(1, stageEl.clientWidth / 2, stageEl.clientHeight / 2); }
  function applyView() {
    if (!worldEl) return;
    worldEl.style.transform = 'matrix(' + vmat().join(',') + ')';
    rulersDraw(); gridDraw();
    if (on && B.zoomVal) B.zoomVal.textContent = Math.round(view.k / fitK * 100) + '%';
    drawUI();
  }
  var lastSize = null;
  function relayout() {
    if (!on || !doc) return;
    var sw = stageEl.clientWidth, sh = stageEl.clientHeight; if (!sw || !sh) return;
    if (view.fit || !lastSize) { lastSize = { w: sw, h: sh }; fit(); return; }
    fitView(); view.x += (sw - lastSize.w) / 2; view.y += (sh - lastSize.h) / 2; lastSize = { w: sw, h: sh }; applyView();
  }

  // ---- ON THE SCREEN: the artwork as SVG in the artboard's units; what's
  // picked, handles, anchors and what's being drawn on a sheet the stage's
  // size above it, in screen pixels ----
  function renderArt() {
    if (!doc || !artEl) return;
    // (the artboards; the art's sheet covers them all, and shows past them)
    var bh = doc.boards.map(function (b) { return '<div class="vec-board' + (b.clear ? ' clear' : '') + '" data-ab="' + b.id + '" style="left:' + r2(b.x) + 'px;top:' + r2(b.y) + 'px;width:' + r2(b.w) + 'px;height:' + r2(b.h) + 'px"></div>'; }).join('');
    if (bh !== boardsEl.dataset.k) { boardsEl.innerHTML = bh; boardsEl.dataset.k = bh; }
    var U = boardsBox(); artEl.style.left = r2(U.x) + 'px'; artEl.style.top = r2(U.y) + 'px';
    artEl.setAttribute('width', r2(U.w)); artEl.setAttribute('height', r2(U.h)); artEl.setAttribute('viewBox', r2(U.x) + ' ' + r2(U.y) + ' ' + r2(U.w) + ' ' + r2(U.h));
    ensureDefs();
    artRoot.innerHTML = doc.layers.map(function (L) { return nodeSvg(L, true); }).join('');
  }
  // (one node drawn again in place, while it's dragged or edited)
  function renderNode(n) {
    // (inside something with an effect, a mask or a clip, the whole of that is drawn again)
    var c = chain(n.id); for (var i = 0; i < c.length - 1; i++) if (hasFx(c[i]) || c[i].omask || c[i].clip) { n = c[i]; break; }
    var el = artRoot.querySelector('[data-v="' + n.id + '"]');
    if (!el) { renderArt(); return; }
    var tmp = document.createElementNS(SVGNS, 'g'); tmp.innerHTML = nodeSvg(n, true);
    if (tmp.firstChild) el.parentNode.replaceChild(tmp.firstChild, el);
  }
  function renderSome(list) { if (list.length > 40) renderArt(); else list.forEach(renderNode); }
  var ui = { marquee: null, lasso: null, knife: null, zoom: null, hover: null, pen: null, hoverPt: null, join: null, ink: null, brush: null, build: null, bface: -1, chover: null, smart: null, snapMk: null };
  var HS = 4;   // (half a handle's size, in screen pixels)
  function pickBox() { // (the box round what's picked and can be changed)
    var list = picked().filter(editable); return list.length ? boxOf(list) : null;
  }
  function quad(b) { return [v2(b.x, b.y), v2(b.x + b.w, b.y), v2(b.x + b.w, b.y + b.h), v2(b.x, b.y + b.h)].map(toScreen); }
  function polyStr(q) { return q.map(function (p) { return r2(p.x) + ',' + r2(p.y); }).join(' '); }
  var HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  function handlePts(b) {
    var m = function (x, y) { return toScreen(v2(b.x + b.w * x, b.y + b.h * y)); };
    return { nw: m(0, 0), n: m(0.5, 0), ne: m(1, 0), e: m(1, 0.5), se: m(1, 1), s: m(0.5, 1), sw: m(0, 1), w: m(0, 0.5) };
  }
  var BOXTOOLS = { select: 1, solid: 1, gradient: 0, swatches: 1, cpick: 1, swidth: 1, sprofile: 1, capjoin: 1, dash: 1, appear: 1, opacity: 1, blend: 1, wand: 1, groupsel: 1, eyedropper: 1, vfill: 0,
    vblend: 1, warp: 1, envelope: 1, offset: 1, repeat: 1, pattern: 1, transp: 1, rulers: 1, smartg: 1, grid: 1, snapgrid: 1, snappts: 1, snapobj: 1 };
  var ANCHORTOOLS = { direct: 1, lasso: 1, anchor: 1, addpt: 1, delpt: 1, convert: 1, scissors: 1, join: 1, pen: 1, curvature: 1, simplify: 1, knife: 1, smooth: 1 };
  function outlineOf(n, cls) {
    if (n.type === 'path') { var m = vmat(); var dd = dCopy(n.efx ? shownOf(n).d : n.d); dXform(dd, m); return '<path class="' + cls + '" d="' + dStr(dd) + '"/>'; }
    if (n.type === 'text' && n.kind === 'area' && n.area) return pathOutline(n.area, n.mt, cls);
    if (n.type === 'image' || n.type === 'text') return '<polygon class="' + cls + '" points="' + polyStr(nodeQuad(n).map(toScreen)) + '"/>';
    var b = nodeBox(n); return b ? '<polygon class="' + cls + '" points="' + polyStr(quad(b)) + '"/>' : '';
  }
  function drawUI() {
    if (!uiEl || !doc) return;
    var w = stageEl.clientWidth, h = stageEl.clientHeight, out = '';
    uiEl.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    out += precUi();
    var list = picked();
    if (ui.hover && !drag) { var hn = byId(ui.hover); if (hn && sel.indexOf(hn.id) < 0) out += outlineOf(hn, 'vs-hover'); }
    if (BOXTOOLS[tool] || tool === 'gradient' || tool === 'vfill' || tool === 'vwidth' || tool === 'hand' || tool === 'zoom' || tool === 'rotview' || TOOLS[tool].shape || XF[tool] || ALIGNT[tool] || TYPE[tool] || tool === 'chedit' || tool === 'pencil' || tool === 'vbrush') {
      list.forEach(function (n) { out += n.type !== 'path' || list.length < 60 ? outlineOf(n, 'vs-box') : (function () { var b = nodeBox(n); return b ? '<polygon class="vs-box" points="' + polyStr(quad(b)) + '"/>' : ''; })(); });
      var b = pickBox();
      if (b && XF[tool] && tool !== 'ftrans' && tool !== 'distort') out += '<polygon class="vs-bounds" points="' + polyStr(quad(b)) + '"/>';
      if (b && (tool === 'select' || tool === 'groupsel' || tool === 'ftrans')) {
        if (list.length > 1 || tool === 'ftrans') out += '<polygon class="vs-bounds" points="' + polyStr(quad(b)) + '"/>';
        var hp = handlePts(b);
        HANDLES.forEach(function (k) { out += '<rect class="vs-handle" x="' + r2(hp[k].x - HS) + '" y="' + r2(hp[k].y - HS) + '" width="' + 2 * HS + '" height="' + 2 * HS + '"/>'; });
      }
    }
    if (ANCHORTOOLS[tool]) {
      var shown = {};
      list.forEach(function (n) { leaves(n).forEach(function (q) { if (q.type === 'path') shown[q.id] = q; }); });
      Object.keys(asel).forEach(function (id) { var q = byId(id); if (q) shown[id] = q; });
      if (ui.hover) { var hq = byId(ui.hover); if (hq && hq.type === 'path') shown[hq.id] = hq; }
      Object.keys(shown).forEach(function (id) { out += anchorsSvg(shown[id]); });
    }
    if (tool === 'gradient') list.forEach(function (n) { out += gradUiSvg(n); });
    if (tool === 'vwidth') { var vn = byId(ui.hover) || list[0]; if (vn && vn.type === 'path') out += widthUiSvg(vn); }
    if (ui.pen) out += '<path class="vs-rubber" d="' + ui.pen + '"/>';
    if (ui.hoverPt) out += '<circle class="vs-dot" cx="' + r2(ui.hoverPt.x) + '" cy="' + r2(ui.hoverPt.y) + '" r="4"/>';
    if (ui.join) out += '<path class="vs-rubber" d="M' + r2(ui.join[0].x) + ' ' + r2(ui.join[0].y) + 'L' + r2(ui.join[1].x) + ' ' + r2(ui.join[1].y) + '"/>';
    var r = ui.marquee || ui.zoom;
    if (r) out += '<rect class="vs-marquee" x="' + r2(Math.min(r.x0, r.x1)) + '" y="' + r2(Math.min(r.y0, r.y1)) + '" width="' + r2(Math.abs(r.x1 - r.x0)) + '" height="' + r2(Math.abs(r.y1 - r.y0)) + '"/>';
    if (ui.lasso) out += '<polygon class="vs-marquee" points="' + polyStr(ui.lasso) + '"/>';
    if (ui.knife) out += '<polyline class="vs-knife" points="' + polyStr(ui.knife) + '"/>';
    out += uiExtra();
    uiEl.innerHTML = out;
  }
  // (a path's anchors on the screen: picked ones filled, with their handles)
  function anchorsSvg(n) {
    var out = outlineOf(n, 'vs-path'), A = asel[n.id] || {}, m = vmat();
    n.d.forEach(function (sp, si) {
      sp.pts.forEach(function (q, pi) {
        var s = mx(m, q), on2 = A[si + ':' + pi];
        if (on2 || tool === 'anchor' || tool === 'convert' || tool === 'curvature') {
          [['i', q.ix, q.iy, hasIn(q)], ['o', q.ox, q.oy, hasOut(q)]].forEach(function (hh) {
            if (!hh[3] || (!on2 && tool !== 'anchor')) return;
            var hs = mx(m, v2(hh[1], hh[2]));
            out += '<line class="vs-hline" x1="' + r2(s.x) + '" y1="' + r2(s.y) + '" x2="' + r2(hs.x) + '" y2="' + r2(hs.y) + '"/><circle class="vs-hdot" cx="' + r2(hs.x) + '" cy="' + r2(hs.y) + '" r="3.5"/>';
          });
        }
        out += '<rect class="vs-anchor' + (on2 ? ' on' : '') + '" x="' + r2(s.x - 3.5) + '" y="' + r2(s.y - 3.5) + '" width="7" height="7"/>';
      });
    });
    return out;
  }
  // (anything that changes the artwork: drawn again, the panels brought up to date, and kept)
  var ver = 0;
  function changed(full) {
    ver++;
    if (full !== false) renderArt();
    rulersDraw(); gridDraw(); drawUI(); panelSync(); layersRender(); histButtons(); bbarSync(); pcRefresh();
    B.autosave();
  }
  function selChanged() { drawUI(); panelSync(); layersRender(); bbarSync(); pcRefresh(); B.autosave(); }
  function setSel(ids, keepAnchors) { sel = ids.filter(function (id, i) { return ids.indexOf(id) === i && byId(id); }); if (!keepAnchors) asel = {}; var n = byId(sel[sel.length - 1]); if (n) { var L = layerOf(n); if (L) doc.cur = L.id; } selChanged(); }

  // ---- PICKING: what's under a point (in the artboard's units; tol, how
  // near counts, from the screen's pixels) ----
  function tolDoc(touch) { return (touch ? 12 : 5) / view.k; }
  function leafHit(n, p, tol) {
    if (n.efx) n = shownOf(n);
    if (n.type === 'image') { var q0 = n.mt ? mx(mInv(n.mt), p) : p; return q0.x >= n.x - tol && q0.x <= n.x + n.w + tol && q0.y >= n.y - tol && q0.y <= n.y + n.h + tol; }
    if (n.type === 'text') return textHit(n, p, tol);
    var b = dBox(n.d); if (!b) return false;
    var mw = 0; n.app.forEach(function (it) { if (it.k === 's' && it.on && it.p) mw = Math.max(mw, it.w * (it.prof ? Math.max.apply(null, it.prof.map(function (q) { return q.w; })) : 1)); });
    var pad = Math.max(tol, mw / 2);
    if (p.x < b.x - pad || p.x > b.x + b.w + pad || p.y < b.y - pad || p.y > b.y + b.h + pad) return false;
    if (n.app.some(function (it) { return it.k === 'f' && it.on && it.p; }) && inside(n.d, p, n.rule)) return true;
    var q = nearest(n.d, p, Math.max(0.2, tol / 4)); return !!q && q.d <= pad;
  }
  // (the deepest object under p that can be worked on, from the top; in a
  // clipping group, only what shows through, and its clipping path by its edge)
  function hitLeaf(p, tol, any) {
    var go = function (list) {
      for (var i = list.length - 1; i >= 0; i--) {
        var n = list[i]; if (!n.visible || (n.locked && !any)) continue;
        if (isCont(n)) {
          // (a blend's or repeat's steps and copies, or a warped group: hit as drawn, picking its own first object)
          if (hasFx(n)) { if (go([shownOf(n)])) { var r1 = go(n.items); return r1 || leaves(n)[0]; } continue; }
          if (n.omask && n.items.length > 1) { var rm = go(n.items.slice(0, -1)); if (rm) return rm; continue; }
          var cl = n.clip && n.items.length > 1 ? n.items[n.items.length - 1] : null;
          if (cl) {
            var ne = nearest(cl.d, p, Math.max(0.2, tol / 4)), edge = ne && ne.d <= tol;
            if (!edge && !inside(cl.d, p, cl.rule)) continue;
            var r0 = go(n.items.slice(0, -1)); if (r0) return r0;
            if (edge && (!cl.locked || any)) return cl;
            continue;
          }
          var r = go(n.items); if (r) return r;
        } else if (leafHit(n, p, tol)) return n;
      }
      return null;
    };
    return doc ? go(doc.layers) : null;
  }
  // (an anchor near a screen point: on picked paths first, then any)
  function hitAnchor(s, touch, onlyIds) {
    var r = touch ? 13 : 7, best = null, m = vmat();
    var look = function (n) {
      if (n.type !== 'path' || !editable(n)) return;
      n.d.forEach(function (sp, si) { sp.pts.forEach(function (q, pi) { var a = mx(m, q), dd = dist(a, s); if (dd <= r && (!best || dd < best.d)) best = { n: n, si: si, pi: pi, d: dd }; }); });
    };
    var ids = onlyIds || Object.keys(asel).concat(sel);
    ids.forEach(function (id) { var n = byId(id); if (n) leaves(n).forEach(look); });
    if (!best && !onlyIds) allLeaves().forEach(look);
    return best;
  }
  // (a handle of a picked anchor (or any, for the Anchor Point tool) near a screen point)
  function hitHandleOf(s, touch) {
    var r = touch ? 12 : 6, best = null, m = vmat();
    var ids = {}; Object.keys(asel).forEach(function (id) { ids[id] = 1; }); if (tool === 'anchor' || tool === 'curvature') { sel.forEach(function (id) { var n = byId(id); if (n) leaves(n).forEach(function (q) { ids[q.id] = 1; }); }); if (ui.hover) ids[ui.hover] = 1; }
    Object.keys(ids).forEach(function (id) {
      var n = byId(id); if (!n || n.type !== 'path' || !editable(n)) return;
      var A = asel[id] || {};
      n.d.forEach(function (sp, si) { sp.pts.forEach(function (q, pi) {
        if (!A[si + ':' + pi] && tool !== 'anchor') return;
        [['i', q.ix, q.iy, hasIn(q)], ['o', q.ox, q.oy, hasOut(q)]].forEach(function (hh) {
          if (!hh[3]) return; var hs = mx(m, v2(hh[1], hh[2])), dd = dist(hs, s);
          if (dd <= r && (!best || dd < best.d)) best = { n: n, si: si, pi: pi, h: hh[0], d: dd };
        });
      }); });
    });
    return best;
  }
  // (the nearest path segment to p among the given paths, within tol)
  function hitSegment(p, tol, list) {
    var best = null;
    (list || allLeaves()).forEach(function (n) {
      if (n.type !== 'path' || !editable(n)) return;
      var q = nearest(n.d, p, Math.max(0.15, tol / 4)); if (q && q.d <= tol && (!best || q.d < best.d)) { best = q; best.n = n; }
    });
    return best;
  }
  function hitBoxHandle(s, touch) {
    var b = pickBox(); if (!b || (tool !== 'select' && tool !== 'groupsel' && tool !== 'ftrans')) return null;
    var hp = handlePts(b), r = touch ? 16 : 8, hit = null;
    HANDLES.forEach(function (k) { if (!hit && Math.abs(s.x - hp[k].x) <= r && Math.abs(s.y - hp[k].y) <= r) hit = k; });
    return hit;
  }

  // ---- EDITING THE TREE ----
  function newPath(d, name, app) { return { id: uid('o'), type: 'path', name: name || 'Path', d: d, app: app || clone(doc.def.app), opacity: doc.def.op, blend: doc.def.blend, visible: true, locked: false }; }
  // (into the current layer, on top, or just above another node)
  function insertNode(n, above) {
    if (above) { var w = where(above.id); if (w) { w.list.splice(w.i + 1, 0, n); return n; } }
    var L = curLayer(); if (!L || !editable(L)) { L = newLayer(); } L.items.push(n); return n;
  }
  function removeNode(id) { var w = where(id); if (w) w.list.splice(w.i, 1); sel = sel.filter(function (x) { return x !== id; }); delete asel[id]; }
  function replaceNode(id, n) { var w = where(id); if (w) w.list[w.i] = n; return n; }
  function newLayer(name, into) {
    doc.n += 1;
    var L = { id: 'L' + uid(''), type: 'layer', name: name || 'Layer ' + doc.n, visible: true, locked: false, open: true, items: [] };
    if (into) into.items.push(L);
    else { var cur = curLayer(), w = cur && where(cur.id); if (w) w.list.splice(w.i + 1, 0, L); else doc.layers.push(L); }
    doc.cur = L.id; return L;
  }
  function fresh(n) { var c = clone(n); (function re(q) { q.id = q.type === 'layer' ? 'L' + uid('') : uid(q.type === 'group' ? 'g' : 'o'); if (isCont(q)) q.items.forEach(re); })(c); return c; }
  function deleteSel() {
    var list = picked().filter(function (n) { var c = chain(n.id); return c.every(function (q) { return !q.locked; }); });
    if (!list.length) return;
    record('Delete'); list.forEach(function (n) { removeNode(n.id); }); sel = []; asel = {}; changed();
  }
  function selectAll() {
    var ids = []; doc.layers.forEach(function (L) { if (!L.visible || L.locked) return; walk(L.items, function (n) { if (n.type !== 'layer' && n.visible && !n.locked && editable(n)) { ids.push(n.id); return false; } }); });
    setSel(ids);
  }
  function nudge(dx, dy) {
    var ids = Object.keys(asel);
    if (ids.length && ANCHORTOOLS[tool]) {
      record('Nudge');
      ids.forEach(function (id) { var n = byId(id); if (!n || !editable(n)) return; unlive(n); n.d.forEach(function (sp, si) { sp.pts.forEach(function (q, pi) { if (asel[id][si + ':' + pi]) moveAnchor(q, dx, dy); }); reflowAuto(sp); }); });
      changed(); return;
    }
    var list = picked().filter(editable); if (!list.length) return;
    record('Nudge'); list.forEach(function (n) { xform(n, [1, 0, 0, 1, dx, dy]); }); changed();
  }
  function group() {
    var list = picked().filter(editable); if (!list.length) return;
    record('Group');
    // (in stack order, where the top one of them was)
    var order = []; walk(doc.layers, function (n) { if (list.indexOf(n) >= 0) { order.push(n); return false; } });
    var top = order[order.length - 1], w = where(top.id), g = { id: uid('g'), type: 'group', name: 'Group', items: [], opacity: 1, blend: 'normal', visible: true, locked: false, open: false };
    w.list.splice(w.i + 1, 0, g);
    order.forEach(function (n) { var q = where(n.id); q.list.splice(q.i, 1); g.items.push(n); });
    sel = [g.id]; asel = {}; changed();
  }
  function ungroup() {
    var gs = picked().filter(function (n) { return n.type === 'group' && editable(n); }); if (!gs.length) return;
    record('Ungroup'); var ids = [];
    gs.forEach(function (g) { var w = where(g.id); w.list.splice.apply(w.list, [w.i, 1].concat(g.items)); g.items.forEach(function (q) { ids.push(q.id); if (g.opacity < 1 && q.opacity != null) q.opacity *= g.opacity; }); });
    sel = ids; asel = {}; changed();
  }
  function duplicate() {
    var list = picked().filter(editable); if (!list.length) return;
    record('Duplicate'); var ids = [];
    list.forEach(function (n) { var c = fresh(n); xform(c, [1, 0, 0, 1, 10, 10]); insertNode(c, n); ids.push(c.id); });
    sel = ids; asel = {}; changed();
  }
  // (forward or back within their containers: dir 1 up, -1 down; 2 / -2 to the very top or bottom)
  function arrange(dir) {
    var list = picked().filter(editable); if (!list.length) return;
    record(dir > 1 ? 'Bring to Front' : dir < -1 ? 'Send to Back' : dir > 0 ? 'Bring Forward' : 'Send Backward');
    var ws = list.map(function (n) { return where(n.id); }).sort(function (a, b) { return dir > 0 ? b.i - a.i : a.i - b.i; });
    ws.forEach(function (w) {
      var i = w.list.indexOf(w.n), j = Math.abs(dir) > 1 ? (dir > 0 ? w.list.length - 1 : 0) : i + dir;
      if (j < 0 || j >= w.list.length || j === i) return;
      w.list.splice(i, 1); w.list.splice(j, 0, w.n);
    });
    changed();
  }
  var clip = null, pasteTimer = 0;
  function copySel(cut) {
    var list = picked(); if (!list.length) return;
    clip = list.map(clone); if (cut) deleteSel();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(svgText(list)).catch(function () {});
  }
  function pasteClip() {
    if (!clip || !clip.length) return;
    record('Paste'); var ids = [];
    clip.forEach(function (n) { var c = fresh(n); xform(c, [1, 0, 0, 1, 10, 10]); insertNode(c); ids.push(c.id); });
    clip = clip.map(function (n) { var c = clone(n); xform(c, [1, 0, 0, 1, 10, 10]); return c; });
    sel = ids; asel = {}; if (!BOXTOOLS[tool]) setTool('select'); changed();
  }

  // ---- POINTERS: one finger, the mouse or the Pencil works the tool in
  // hand; two fingers move, zoom and turn the view (a quick tap with two is
  // undo, with three redo); Space, the middle button or the Hand pan ----
  var pts = {}, drag = null, pinch = null, taps = null, spaceDown = false, lastDown = { t: 0, s: null };
  function begin(d, label) { if (d.rec) return; d.rec = true; d.snap = snap(); hist.push({ s: d.snap, label: label }); if (hist.length > HMAX) hist.shift(); fut = []; histButtons(); }
  function cancelDrag() { var d = drag; drag = null; if (!d) return; if (d.rec) { restore(d.snap); hist.pop(); histButtons(); } ui.marquee = ui.lasso = ui.knife = ui.zoom = ui.join = null; changed(); }
  function cursorFor(s, touch) {
    if (spaceDown || tool === 'hand' || tool === 'none') return drag && drag.kind === 'pan' ? 'grabbing' : 'grab';
    if (tool === 'zoom') return 'zoom-in';
    if (tool === 'rotview') return 'grab';
    if (TOOLS[tool].shape || tool === 'pen' || tool === 'curvature' || tool === 'knife' || tool === 'pencil' || tool === 'vbrush' || tool === 'blob' || tool === 'veraser' || tool === 'smooth' || tool === 'builder') return 'crosshair';
    if (TYPE[tool]) return tool === 'vtext' ? 'vertical-text' : 'text';
    if (tool === 'move' && xfList().length) return 'move';
    if (XF[tool] && tool !== 'ftrans' && tool !== 'distort' && xfList().length) return 'crosshair';
    if ((tool === 'select' || tool === 'ftrans') && !hitBoxHandle(s, touch) && rotZone(s, touch)) return ROTC;
    if (tool === 'ftrans' && pickBox() && dist(s, knobPt(pickBox())) <= (touch ? 16 : 9)) return ROTC;
    if (tool === 'select' || tool === 'groupsel' || tool === 'ftrans') {
      var h = hitBoxHandle(s, touch);
      if (h) return h === 'n' || h === 's' ? 'ns-resize' : h === 'e' || h === 'w' ? 'ew-resize' : h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize';
    }
    return 'default';
  }
  function down(e) {
    e.stopPropagation(); if (e.button === 2 || !doc) return;
    try { stageEl.setPointerCapture(e.pointerId); } catch (x) {}
    var s = stageXY(e); pts[e.pointerId] = s;
    var ids = Object.keys(pts), touch = e.pointerType !== 'mouse';
    if (e.pointerType === 'touch') { if (!taps || ids.length === 1) taps = { n: 0, t0: performance.now(), moved: false }; taps.n = Math.max(taps.n, ids.length); }
    if (ids.length === 2 && e.pointerType === 'touch') {
      // (two fingers: what the first began is called off)
      if (drag) cancelDrag();
      var a = pts[ids[0]], c = pts[ids[1]];
      pinch = { d: Math.hypot(a.x - c.x, a.y - c.y) || 1, an: Math.atan2(c.y - a.y, c.x - a.x), mx: (a.x + c.x) / 2, my: (a.y + c.y) / 2, k: view.k, r: view.r, p: fromScreen((a.x + c.x) / 2, (a.y + c.y) / 2) };
      return;
    }
    if (ids.length > 1) return;
    var now = performance.now(), dbl = lastDown.s && now - lastDown.t < 350 && dist(lastDown.s, s) < (touch ? 18 : 6);
    lastDown = { t: dbl ? 0 : now, s: s };
    if (spaceDown || e.button === 1 || tool === 'hand' || tool === 'none') { drag = { kind: 'pan', s0: s, vx: view.x, vy: view.y }; stageEl.style.cursor = 'grabbing'; return; }
    var p = fromScreen(s.x, s.y), h = H[tool] || H.select;
    ui.snapMk = ui.smart = null; if (snapsAt(tool)) { var sq = snapPt(p, null, touch); p = v2(sq.x, sq.y); ui.snapMk = sq.mk; }
    h.down(e, s, p, touch, dbl);
  }
  function move(e) {
    e.stopPropagation();
    var s = stageXY(e), touch = e.pointerType !== 'mouse';
    if (pts[e.pointerId]) pts[e.pointerId] = s;
    if (pinch) {
      var ids = Object.keys(pts); if (ids.length < 2) return;
      var a = pts[ids[0]], c = pts[ids[1]], d = Math.hypot(a.x - c.x, a.y - c.y) || 1, mxp = (a.x + c.x) / 2, myp = (a.y + c.y) / 2, an = Math.atan2(c.y - a.y, c.x - a.x);
      if (taps && (Math.abs(d - pinch.d) > 10 || Math.hypot(mxp - pinch.mx, myp - pinch.my) > 10)) taps.moved = true;
      view.k = Math.max(fitK * 0.1, Math.min(fitK * 64, pinch.k * d / pinch.d));
      var r = pinch.r + an - pinch.an, deg = ((r * 180 / Math.PI) % 360 + 540) % 360 - 180; if (Math.abs(deg) < 4) r = 0;
      view.r = r; keepAt(pinch.p, mxp, myp); view.fit = false; applyView(); return;
    }
    if (!drag) {
      var h0 = H[tool] || H.select, hp = fromScreen(s.x, s.y);
      if (snapsAt(tool) && e.pointerType !== 'touch') { var hq = snapPt(hp, null, touch), mk0 = JSON.stringify(ui.snapMk); hp = v2(hq.x, hq.y); ui.snapMk = hq.mk; if (JSON.stringify(hq.mk) !== mk0) drawUI(); }
      if (h0.hover && e.pointerType !== 'touch') h0.hover(s, hp, touch); stageEl.style.cursor = cursorFor(s, touch); return;
    }
    if (taps && Math.hypot(s.x - drag.s0.x, s.y - drag.s0.y) > 8) taps.moved = true;
    var p = fromScreen(s.x, s.y);
    if (drag.kind === 'pan') { view.x = drag.vx + s.x - drag.s0.x; view.y = drag.vy + s.y - drag.s0.y; view.fit = false; applyView(); return; }
    var slop = e.pointerType === 'touch' ? 6 : 3;
    if (!drag.moved && Math.hypot(s.x - drag.s0.x, s.y - drag.s0.y) < slop) return;
    drag.moved = true;
    if (snapsAt(drag.tool)) { var mq = snapPt(p, null, touch); p = v2(mq.x, mq.y); ui.snapMk = mq.mk; }
    (H[drag.tool] || H.select).move(e, s, p, touch);
  }
  function up(e) {
    e.stopPropagation();
    delete pts[e.pointerId];
    var n = Object.keys(pts).length, s = stageXY(e);
    if (pinch) { if (n < 2) pinch = null; }
    else if (drag) {
      var d = drag;
      if (d.kind === 'pan') { drag = null; }
      else if (e.type === 'pointercancel') cancelDrag();
      else { var up0 = fromScreen(s.x, s.y); if (snapsAt(d.tool)) { var uq = snapPt(up0, null, e.pointerType !== 'mouse'); up0 = v2(uq.x, uq.y); } (H[d.tool] || H.select).up(e, s, up0, e.pointerType !== 'mouse'); if (drag === d) drag = null; }
      if (!drag && (ui.smart || ui.snapMk)) { ui.smart = ui.snapMk = null; drawUI(); }
    }
    if (!n && taps) {
      var t = taps; taps = null;
      if (t.n >= 2 && !t.moved && performance.now() - t.t0 < 300 && e.type === 'pointerup') { if (t.n >= 3) redo(); else undo(); B.toast(t.n >= 3 ? 'Redo' : 'Undo'); }
    }
    stageEl.style.cursor = cursorFor(s, e.pointerType !== 'mouse');
  }
  function wheel(e) {
    e.stopPropagation(); e.preventDefault();
    var s = stageXY(e);
    if (e.ctrlKey || e.metaKey) zoomAt(view.k * Math.exp(-e.deltaY * 0.01), s.x, s.y);
    else { view.x -= e.deltaX; view.y -= e.deltaY; view.fit = false; applyView(); }
  }
  function screenBox(n) { var b = nodeBox(n); if (!b) return null; var q = quad(b), xs = q.map(function (p) { return p.x; }), ys = q.map(function (p) { return p.y; }); return { x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys), x1: Math.max.apply(null, xs), y1: Math.max.apply(null, ys) }; }
  function rectOf(r) { return { x0: Math.min(r.x0, r.x1), y0: Math.min(r.y0, r.y1), x1: Math.max(r.x0, r.x1), y1: Math.max(r.y0, r.y1) }; }
  function meets(a, b) { return a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0; }
  function editLeaves() { return allLeaves().filter(editable); }

  // THE TOOLS' POINTER HANDLING: down / move / up (and hover, for a mouse);
  // a tool that isn't here picks like the Selection tool
  var H = {};
  // SELECTION: pick, move (Alt copies), size by the handles, or drag round
  H.select = {
    down: function (e, s, p, touch, dbl) {
      var hd = hitBoxHandle(s, touch);
      if (!hd && tool === 'select' && rotZone(s, touch)) { var rb = pickBox(), rc = v2(rb.x + rb.w / 2, rb.y + rb.h / 2); xfStart('rot', s, p, { c: rc, a0: Math.atan2(p.y - rc.y, p.x - rc.x) }); return; }
      if (hd && tool === 'select' || hd && tool === 'groupsel') {
        var list = picked().filter(editable);
        drag = { kind: 'scale', tool: tool, h: hd, b: pickBox(), s0: s, ids: list.map(function (n) { return n.id; }), orig: list.map(clone) };
        return;
      }
      var hit = hitLeaf(p, tolDoc(touch));
      if (hit && dbl && hit.type === 'text' && editable(hit) && !e.shiftKey) { if (e.pointerType === 'mouse') e.preventDefault(); setTool('text'); var ci = caretAt(hit, localOf(hit, p)); startEdit(hit, ci, ci, false); drag = { kind: 'tsel', tool: 'text', s0: s, id: hit.id, a: ci }; return; }
      if (hit) {
        var top = tool === 'groupsel' ? groupPick(hit) : topPick(hit);
        if (e.shiftKey) { var i = sel.indexOf(top.id); setSel(i >= 0 ? sel.filter(function (x) { return x !== top.id; }) : sel.concat(top.id)); if (i >= 0) return; }
        else if (sel.indexOf(top.id) < 0) setSel([top.id]);
        var list2 = picked().filter(editable);
        drag = { kind: 'move', tool: tool, s0: s, p0: p, alt: e.altKey, top: top.id, ids: list2.map(function (n) { return n.id; }), orig: list2.map(clone) };
        return;
      }
      if (!e.shiftKey && (sel.length || Object.keys(asel).length)) setSel([]);
      drag = { kind: 'marquee', tool: tool, s0: s, base: e.shiftKey ? sel.slice() : [] };
    },
    move: function (e, s, p) {
      var d = drag;
      if (xfMove(e, s, p)) return;
      if (d.kind === 'marquee') {
        ui.marquee = { x0: d.s0.x, y0: d.s0.y, x1: s.x, y1: s.y }; var R = rectOf(ui.marquee), ids = d.base.slice();
        editLeaves().forEach(function (n) { var b = screenBox(n); if (b && meets(b, R)) { var t = topPick(n); if (ids.indexOf(t.id) < 0) ids.push(t.id); } });
        sel = ids; drawUI(); return;
      }
      if (d.kind === 'move') {
        if (!d.rec) {
          begin(d, d.alt ? 'Copy' : 'Move');
          if (d.alt) { // (Alt: copies are dragged; the originals stay)
            d.ids = d.ids.map(function (id, i) { var c = fresh(d.orig[i]); insertNode(c, byId(id)); return c.id; });
            d.orig = d.ids.map(function (id) { return clone(byId(id)); }); sel = d.ids.slice(); renderArt();
          }
        }
        var dx = p.x - d.p0.x, dy = p.y - d.p0.y;
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        if (d.b0 === undefined) d.b0 = boxOf(d.orig); var sb = snapBox(d.b0, dx, dy, d.ids); dx = sb.dx; dy = sb.dy;
        d.ids.forEach(function (id, i) { var n = replaceNode(id, clone(d.orig[i])); xform(n, [1, 0, 0, 1, dx, dy]); });
        renderSome(d.ids.map(byId)); drawUI(); panelSync(); return;
      }
      if (d.kind === 'scale') {
        begin(d, 'Size');
        var sq2 = snapPt(p, d.ids, e.pointerType !== 'mouse'); ui.snapMk = sq2.mk;
        var M = scaleMat(d.b, d.h, v2(sq2.x, sq2.y), e.shiftKey, e.altKey);
        d.ids.forEach(function (id, i) { var n = replaceNode(id, clone(d.orig[i])); xformS(n, M); });
        renderSome(d.ids.map(byId)); drawUI(); panelSync();
      }
    },
    up: function (e, s, p, touch) {
      if (xfUp(e, s, p)) return;
      var d = drag; drag = null; ui.marquee = null;
      if (d.kind === 'marquee') { setSel(sel); return; }
      if (d.moved) { changed(); return; }
      // (a still click on one of several picked: just that one)
      if (d.kind === 'move' && !e.shiftKey && sel.length > 1) setSel([d.top]);
      drawUI();
    },
    hover: function (s, p, touch) { var h = hitLeaf(p, tolDoc(touch)), id = h ? topPick(h).id : null; if (tool === 'groupsel' && h) id = h.id; if (id !== ui.hover) { ui.hover = id; drawUI(); } }
  };
  // (a handle pulled: the opposite side stays put, or the middle with Alt;
  // a corner keeps the proportions, Shift lets them go)
  function scaleMat(b, h, p, shift, alt) {
    var x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    var nx0 = x0, ny0 = y0, nx1 = x1, ny1 = y1;
    if (h.indexOf('w') >= 0) { nx0 = p.x; if (alt) nx1 = 2 * cx - p.x; }
    if (h.indexOf('e') >= 0) { nx1 = p.x; if (alt) nx0 = 2 * cx - p.x; }
    if (h.indexOf('n') >= 0) { ny0 = p.y; if (alt) ny1 = 2 * cy - p.y; }
    if (h.indexOf('s') >= 0) { ny1 = p.y; if (alt) ny0 = 2 * cy - p.y; }
    var sx = b.w ? (nx1 - nx0) / b.w : 1, sy = b.h ? (ny1 - ny0) / b.h : 1;
    if (h.length === 2 && !shift) {
      var k = Math.abs(sx) > Math.abs(sy) ? Math.abs(sx) : Math.abs(sy); sx = (sx < 0 ? -1 : 1) * k; sy = (sy < 0 ? -1 : 1) * k;
      if (alt) { nx0 = cx - b.w * sx / 2; ny0 = cy - b.h * sy / 2; }
      else { if (h.indexOf('w') >= 0) nx0 = x1 - b.w * sx; if (h.indexOf('n') >= 0) ny0 = y1 - b.h * sy; }
    }
    if (!b.w) { sx = 1; nx0 = x0; } if (!b.h) { sy = 1; ny0 = y0; }
    if (Math.abs(sx) < 1e-4) sx = sx < 0 ? -1e-4 : 1e-4; if (Math.abs(sy) < 1e-4) sy = sy < 0 ? -1e-4 : 1e-4;
    return [sx, 0, 0, sy, nx0 - x0 * sx, ny0 - y0 * sy];
  }
  // GROUP SELECTION: the object itself; again, the group round what's picked
  function groupPick(hit) {
    var c = chain(hit.id).filter(function (q) { return q.type !== 'layer'; });
    // (once the outermost is picked, it starts again from the object)
    if (sel.length === 1) { var i = c.map(function (q) { return q.id; }).indexOf(sel[0]); if (i > 0) return c[i - 1]; }
    return hit;
  }
  H.groupsel = H.select;
  // DIRECT SELECTION: anchors and handles
  H.direct = {
    down: function (e, s, p, touch) {
      var hh = hitHandleOf(s, touch);
      if (hh) { drag = { kind: 'handle', tool: tool, s0: s, id: hh.n.id, si: hh.si, pi: hh.pi, h: hh.h, alt: e.altKey }; return; }
      var a = hitAnchor(s, touch);
      if (a) { pickAnchor(a.n, a.si + ':' + a.pi, e.shiftKey); if (asel[a.n.id] && asel[a.n.id][a.si + ':' + a.pi]) anchorDrag(s, p); return; }
      var tol = tolDoc(touch), sg = hitSegment(p, tol, editLeaves());
      if (sg) {
        var sp = sg.n.d[sg.si], k1 = sg.si + ':' + sg.i, k2 = sg.si + ':' + ((sg.i + 1) % sp.pts.length);
        if (!e.shiftKey) { asel = {}; sel = [sg.n.id]; } else if (sel.indexOf(sg.n.id) < 0) sel.push(sg.n.id);
        asel[sg.n.id] = asel[sg.n.id] || {}; asel[sg.n.id][k1] = 1; asel[sg.n.id][k2] = 1; selChanged(); anchorDrag(s, p); return;
      }
      var hit = hitLeaf(p, tol);
      if (hit) {
        if (!e.shiftKey) { asel = {}; sel = []; }
        if (sel.indexOf(hit.id) < 0) sel.push(hit.id);
        if (hit.type === 'path') { var all = {}; hit.d.forEach(function (sp2, si) { sp2.pts.forEach(function (q, pi) { all[si + ':' + pi] = 1; }); }); asel[hit.id] = all; }
        selChanged(); anchorDrag(s, p); return;
      }
      if (!e.shiftKey) { asel = {}; sel = []; selChanged(); }
      drag = { kind: 'amarquee', tool: tool, s0: s, base: clone(asel), bsel: sel.slice() };
    },
    move: function (e, s, p) {
      var d = drag;
      if (d.kind === 'handle') {
        begin(d, 'Handle');
        var n = byId(d.id), sp = n.d[d.si], q = sp.pts[d.pi]; unlive(n); q.a = 0;
        if (d.h === 'i') { q.ix = p.x; q.iy = p.y; } else { q.ox = p.x; q.oy = p.y; }
        if (d.alt || tool === 'anchor') q.s = 0;
        else if (q.s) { // (a smooth point: the other handle turns with it, keeping its length)
          var L = d.h === 'i' ? Math.hypot(q.ox - q.x, q.oy - q.y) : Math.hypot(q.ix - q.x, q.iy - q.y), u = vnorm(v2(q.x - p.x, q.y - p.y));
          if (d.h === 'i') { q.ox = q.x + u.x * L; q.oy = q.y + u.y * L; } else { q.ix = q.x + u.x * L; q.iy = q.y + u.y * L; }
        }
        renderNode(n); drawUI(); return;
      }
      if (d.kind === 'anchors') {
        begin(d, 'Move Points');
        var dx = p.x - d.p0.x, dy = p.y - d.p0.y; if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        if (!d.grab) d.grab = grabAnchor(d);
        var aq = snapPt(v2(d.grab.x + dx, d.grab.y + dy), d.ids, e.pointerType !== 'mouse'); if (aq.mk) { dx = aq.x - d.grab.x; dy = aq.y - d.grab.y; } ui.snapMk = aq.mk;
        d.ids.forEach(function (id, i) {
          var n2 = replaceNode(id, clone(d.orig[i]));
          if (n2.type !== 'path') { xform(n2, [1, 0, 0, 1, dx, dy]); return; }
          var A = asel[id] || {}; unlive(n2);
          n2.d.forEach(function (sp2, si) { sp2.pts.forEach(function (q2, pi) { if (A[si + ':' + pi]) moveAnchor(q2, dx, dy); }); reflowAuto(sp2); });
        });
        renderSome(d.ids.map(byId)); drawUI(); panelSync(); return;
      }
      if (d.kind === 'amarquee') {
        ui.marquee = { x0: d.s0.x, y0: d.s0.y, x1: s.x, y1: s.y };
        var R = rectOf(ui.marquee), m = vmat(); asel = clone(d.base); sel = d.bsel.slice();
        editLeaves().forEach(function (n3) {
          if (n3.type !== 'path') { var b = screenBox(n3); if (b && meets(b, R) && sel.indexOf(n3.id) < 0) sel.push(n3.id); return; }
          n3.d.forEach(function (sp3, si) { sp3.pts.forEach(function (q3, pi) { var a = mx(m, q3); if (a.x >= R.x0 && a.x <= R.x1 && a.y >= R.y0 && a.y <= R.y1) { (asel[n3.id] = asel[n3.id] || {})[si + ':' + pi] = 1; if (sel.indexOf(n3.id) < 0) sel.push(n3.id); } }); });
        });
        drawUI();
      }
    },
    up: function () { var d = drag; drag = null; ui.marquee = null; if (d.kind === 'amarquee') selChanged(); else if (d.moved) changed(); else drawUI(); },
    hover: function (s, p, touch) { var h = hitLeaf(p, tolDoc(touch)), id = h ? h.id : null; if (id !== ui.hover) { ui.hover = id; drawUI(); } }
  };
  function pickAnchor(n, key, shift) {
    if (!shift && !(asel[n.id] && asel[n.id][key])) { asel = {}; sel = []; }
    var A = asel[n.id] = asel[n.id] || {};
    if (shift && A[key]) delete A[key]; else A[key] = 1;
    if (!Object.keys(A).length) delete asel[n.id];
    if (sel.indexOf(n.id) < 0 && asel[n.id]) sel.push(n.id);
    selChanged();
  }
  // (the picked anchor nearest where a drag of them began: the one that snaps)
  function grabAnchor(d) {
    var best = null, bd = Infinity;
    d.orig.forEach(function (n) { var A = asel[n.id]; if (n.type !== 'path' || !A) return; n.d.forEach(function (sp, si) { sp.pts.forEach(function (q, pi) { if (!A[si + ':' + pi]) return; var dd = dist(q, d.p0); if (dd < bd) { bd = dd; best = v2(q.x, q.y); } }); }); });
    return best || v2(d.p0.x, d.p0.y);
  }
  // (the tools whose points are snapped as they're placed: shapes, the pen, words)
  function snapsAt(t) { return !!(TOOLS[t] && (TOOLS[t].shape || t === 'pen' || t === 'curvature' || t === 'text' || t === 'areatext' || t === 'vtext')) && snapping(); }
  // (what's picked by its anchors, dragged: paths by their picked anchors, pictures whole)
  function anchorDrag(s, p) {
    var ids = sel.filter(function (id) { var n = byId(id); return n && editable(n) && (n.type !== 'path' || asel[id]); });
    drag = { kind: 'anchors', tool: tool, s0: s, p0: p, ids: ids, orig: ids.map(function (id) { return clone(byId(id)); }) };
  }
  // LASSO: draw round anchor points (or whole objects)
  H.lasso = {
    down: function (e, s, p, touch) {
      var a = hitAnchor(s, touch, Object.keys(asel));
      if (a && asel[a.n.id] && asel[a.n.id][a.si + ':' + a.pi]) { anchorDrag(s, p); drag.tool = 'direct'; return; }
      drag = { kind: 'lasso', tool: tool, s0: s, shift: e.shiftKey, poly: [s] }; ui.lasso = drag.poly;
    },
    move: function (e, s) { drag.poly.push(s); ui.lasso = drag.poly; drawUI(); },
    up: function () {
      var d = drag; drag = null; ui.lasso = null; var poly = d.poly, m = vmat();
      if (!d.shift) { asel = {}; sel = []; }
      if (poly.length > 2) editLeaves().forEach(function (n) {
        if (TS.lasso.what === 'objects' || n.type !== 'path') {
          var b = nodeBox(n); if (!b) return;
          var any = n.type === 'path' ? n.d.some(function (sp) { return sp.pts.some(function (q) { return inPoly(poly, mx(m, q)); }); }) : quad(b).some(function (q) { return inPoly(poly, q); });
          if (any) { var t = topPick(n); if (sel.indexOf(t.id) < 0) sel.push(t.id); }
          return;
        }
        n.d.forEach(function (sp, si) { sp.pts.forEach(function (q, pi) { if (inPoly(poly, mx(m, q))) { (asel[n.id] = asel[n.id] || {})[si + ':' + pi] = 1; if (sel.indexOf(n.id) < 0) sel.push(n.id); } }); });
      });
      selChanged();
    }
  };
  // MAGIC WAND: everything like the object tapped
  function primHex(n, k) { if (!n.app) return null; var i = topOf(n.app, k), it = n.app[i]; return it && it.p ? solidHex(it.p) : null; }
  function hexDist(a, b) { if (!a || !b) return a === b ? 0 : 1e9; var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); return Math.max(Math.abs((x >> 16) - (y >> 16)), Math.abs((x >> 8 & 255) - (y >> 8 & 255)), Math.abs((x & 255) - (y & 255))); }
  function strokeW(n) { var i = n.app ? topOf(n.app, 's') : -1; return i >= 0 && n.app[i].p ? n.app[i].w : 0; }
  H.wand = {
    down: function (e, s, p, touch) {
      var hit = hitLeaf(p, tolDoc(touch));
      if (!hit) { if (!e.shiftKey) setSel([]); return; }
      var W = TS.wand, ids = e.shiftKey ? sel.slice() : [];
      editLeaves().forEach(function (n) {
        if (W.fill && hexDist(primHex(n, 'f'), primHex(hit, 'f')) > W.tol) return;
        if (W.stroke && hexDist(primHex(n, 's'), primHex(hit, 's')) > W.tol) return;
        if (W.width && Math.abs(strokeW(n) - strokeW(hit)) > Math.max(0.5, W.tol / 16)) return;
        if (W.op && Math.abs((n.opacity == null ? 1 : n.opacity) - (hit.opacity == null ? 1 : hit.opacity)) > W.tol / 255) return;
        if (W.blend && (n.blend || 'normal') !== (hit.blend || 'normal')) return;
        if (!W.fill && !W.stroke && !W.width && !W.op && !W.blend && n !== hit) return;
        if (ids.indexOf(n.id) < 0) ids.push(n.id);
      });
      setSel(ids);
    },
    move: function () {}, up: function () { drag = null; },
    hover: H.select.hover
  };
  // NAVIGATION
  H.zoom = {
    down: function (e, s) { drag = { kind: 'zoom', tool: 'zoom', s0: s, alt: e.altKey }; },
    move: function (e, s) { ui.zoom = { x0: drag.s0.x, y0: drag.s0.y, x1: s.x, y1: s.y }; drawUI(); },
    up: function () {
      var d = drag, z = ui.zoom; drag = null; ui.zoom = null;
      if (z && Math.abs(z.x1 - z.x0) > 8 && Math.abs(z.y1 - z.y0) > 8) {
        var cx = (z.x0 + z.x1) / 2, cy = (z.y0 + z.y1) / 2, c = fromScreen(cx, cy);
        zoomAt(view.k * Math.min(stageEl.clientWidth / Math.abs(z.x1 - z.x0), stageEl.clientHeight / Math.abs(z.y1 - z.y0)), cx, cy);
        keepAt(c, stageEl.clientWidth / 2, stageEl.clientHeight / 2); applyView();
      } else zoomAt(view.k * (d.alt ? 0.5 : 2), d.s0.x, d.s0.y);
      drawUI();
    }
  };
  H.rotview = {
    down: function (e, s) { var cx = stageEl.clientWidth / 2, cy = stageEl.clientHeight / 2; drag = { kind: 'rot', tool: 'rotview', s0: s, a0: Math.atan2(s.y - cy, s.x - cx), r0: view.r }; },
    move: function (e, s) {
      var cx = stageEl.clientWidth / 2, cy = stageEl.clientHeight / 2, r = drag.r0 + Math.atan2(s.y - cy, s.x - cx) - drag.a0, st = Math.PI / 12;
      if (e.shiftKey) r = Math.round(r / st) * st;
      rotateAt(r, cx, cy); panelSync();
    },
    up: function () { drag = null; }
  };
  H.hand = { down: function () {}, move: function () {}, up: function () { drag = null; } };
  H.none = H.hand;

  // PEN: click for corners, drag for curves; the first point closes it;
  // Return, Esc or another tool finishes it. Points are added at the end
  // of pen.si in path pen.id; each is a step of its own
  var pen = null;
  function penSp() { var n = pen && byId(pen.id); return n && n.d[pen.si] ? n.d[pen.si] : null; }
  function penResync() { if (pen && (!penSp() || penSp().closed)) { pen = null; ui.pen = null; } if (cv && (!byId(cv.id) || !byId(cv.id).d[cv.si] || byId(cv.id).d[cv.si].closed)) cv = null; }
  function endPen() {
    var n = pen && byId(pen.id);
    if (n) { n.d = n.d.filter(function (sp) { return sp.pts.length > 1; }); if (!n.d.length) removeNode(n.id); }
    pen = null; ui.pen = null; changed();
  }
  // (an open end of a path near a screen point: its subpath, and which end)
  function hitEnd(s, touch, onlyN) {
    var r = touch ? 14 : 8, best = null, m = vmat();
    (onlyN ? [onlyN] : editLeaves()).forEach(function (n) {
      if (n.type !== 'path') return;
      n.d.forEach(function (sp, si) {
        if (sp.closed || !sp.pts.length) return;
        [[0, 'head'], [sp.pts.length - 1, 'tail']].forEach(function (e2) { var dd = dist(mx(m, sp.pts[e2[0]]), s); if (dd <= r && (!best || dd < best.d)) best = { n: n, si: si, pi: e2[0], end: e2[1], d: dd }; });
      });
    });
    return best;
  }
  function reverseSp(sp) { sp.pts.reverse(); sp.pts.forEach(function (q) { var x = q.ix, y = q.iy; q.ix = q.ox; q.iy = q.oy; q.ox = x; q.oy = y; }); }
  H.pen = {
    down: function (e, s, p, touch) {
      var r = touch ? 14 : 8, m = vmat();
      if (!pen) {
        var end = hitEnd(s, touch);
        if (end) { record('Continue Path'); if (end.end === 'head') reverseSp(end.n.d[end.si]); pen = { id: end.n.id, si: end.si }; unlive(end.n); sel = [end.n.id]; asel = {}; changed(); return; }
        if (TS.pen.auto) {
          var pk = sel.map(byId).filter(function (n) { return n && n.type === 'path' && editable(n); });
          var a = hitAnchor(s, touch, pk.map(function (n) { return n.id; }));
          if (a) { record('Delete Anchor'); deletePoint(a.n, a.si, a.pi); changed(); return; }
          var sg = pk.length && hitSegment(p, tolDoc(touch), pk);
          if (sg) { record('Add Anchor'); unlive(sg.n); var k = insertAt(sg.n.d[sg.si], sg.i, sg.t); asel = {}; asel[sg.n.id] = {}; asel[sg.n.id][sg.si + ':' + k] = 1; changed(); return; }
        }
        record('Pen');
        var n = insertNode(newPath([{ pts: [P(p.x, p.y)], closed: false }], 'Path'));
        pen = { id: n.id, si: 0 }; sel = [n.id]; asel = {};
        drag = { kind: 'penpt', tool: 'pen', s0: s, q: n.d[0].pts[0] }; changed(); return;
      }
      var sp = penSp(); if (!sp) { pen = null; return; }
      var first = sp.pts[0], last = sp.pts[sp.pts.length - 1];
      if (sp.pts.length > 1 && dist(mx(m, first), s) <= r) {
        record('Close Path'); sp.closed = true; drag = { kind: 'penclose', tool: 'pen', s0: s, q: first }; changed(); return;
      }
      if (dist(mx(m, last), s) <= r) { record('Corner'); last.ox = last.x; last.oy = last.y; last.s = 0; drag = { kind: 'penout', tool: 'pen', s0: s, q: last }; changed(); return; }
      record('Pen Point');
      var q = P(p.x, p.y); if (e.shiftKey) { var a2 = Math.round(Math.atan2(p.y - last.y, p.x - last.x) / (Math.PI / 4)) * Math.PI / 4, L = dist(p, last); q = P(last.x + Math.cos(a2) * L, last.y + Math.sin(a2) * L); }
      sp.pts.push(q); drag = { kind: 'penpt', tool: 'pen', s0: s, q: q }; ui.pen = null; changed();
    },
    move: function (e, s, p) {
      var d = drag, q = d.q, n = byId(pen ? pen.id : '');
      if (d.kind === 'penpt' || d.kind === 'penclose') {
        if (d.kind === 'penclose') { q.ix = 2 * q.x - p.x; q.iy = 2 * q.y - p.y; q.s = 1; }
        else { q.ox = p.x; q.oy = p.y; q.ix = 2 * q.x - p.x; q.iy = 2 * q.y - p.y; q.s = 1; }
      } else if (d.kind === 'penout') { q.ox = p.x; q.oy = p.y; }
      if (n) renderNode(n); drawUI();
    },
    up: function () { var d = drag; drag = null; if (d.kind === 'penclose') { endPen(); return; } changed(); },
    hover: function (s, p, touch) {
      var sp = penSp();
      if (!sp) {
        var end = hitEnd(s, touch); ui.hoverPt = end ? toScreen(end.n.d[end.si].pts[end.pi]) : null;
        if (TS.pen.auto) { var pk = sel.map(byId).filter(function (n) { return n && n.type === 'path'; }); var sg = !end && pk.length ? hitSegment(p, tolDoc(touch), pk) : null; if (sg) ui.hoverPt = toScreen(sg); }
        ui.pen = null; drawUI(); return;
      }
      var last = sp.pts[sp.pts.length - 1], a = toScreen(last), o = toScreen(v2(last.ox, last.oy));
      ui.pen = 'M' + r2(a.x) + ' ' + r2(a.y) + 'C' + r2(o.x) + ' ' + r2(o.y) + ' ' + r2(s.x) + ' ' + r2(s.y) + ' ' + r2(s.x) + ' ' + r2(s.y);
      ui.hoverPt = sp.pts.length > 1 && dist(toScreen(sp.pts[0]), s) <= (touch ? 14 : 8) ? toScreen(sp.pts[0]) : null;
      drawUI();
    }
  };
  // CURVATURE: the path curves smoothly through each point (a: worked out
  // from its neighbours); a double-click makes a point a corner, or smooth again
  var cv = null;
  H.curvature = {
    down: function (e, s, p, touch, dbl) {
      var m = vmat(), r = touch ? 14 : 8;
      var a = hitAnchor(s, touch, cv ? [cv.id] : sel.filter(function (id) { var n = byId(id); return n && n.type === 'path'; }));
      if (dbl && a) { record('Corner or Smooth'); var q0 = a.n.d[a.si].pts[a.pi]; if (q0.a) { q0.a = 0; q0.ix = q0.ox = q0.x; q0.iy = q0.oy = q0.y; q0.s = 0; } else q0.a = 1; unlive(a.n); reflowAuto(a.n.d[a.si]); changed(); return; }
      var sp = cv && byId(cv.id) ? byId(cv.id).d[cv.si] : null;
      if (sp && sp.pts.length > 2 && dist(mx(m, sp.pts[0]), s) <= r) { record('Close Path'); sp.closed = true; reflowAuto(sp); cv = null; ui.pen = null; changed(); return; }
      if (a && !sp) { drag = { kind: 'cvpt', tool: 'curvature', s0: s, id: a.n.id, si: a.si, pi: a.pi }; sel = [a.n.id]; return; }
      if (a && sp && a.n.id === cv.id) { drag = { kind: 'cvpt', tool: 'curvature', s0: s, id: a.n.id, si: a.si, pi: a.pi }; return; }
      if (!sp) {
        var pk = sel.map(byId).filter(function (n) { return n && n.type === 'path' && editable(n); });
        var sg = pk.length && hitSegment(p, tolDoc(touch), pk);
        if (sg) { record('Add Point'); unlive(sg.n); var k = insertAt(sg.n.d[sg.si], sg.i, sg.t); sg.n.d[sg.si].pts[k].a = 1; reflowAuto(sg.n.d[sg.si]); drag = { kind: 'cvpt', tool: 'curvature', s0: s, id: sg.n.id, si: sg.si, pi: k, rec: true, snap: hist[hist.length - 1].s }; changed(); return; }
        record('Curvature');
        var q1 = P(p.x, p.y); q1.a = e.altKey ? 0 : 1;
        var n = insertNode(newPath([{ pts: [q1], closed: false }], 'Path'));
        cv = { id: n.id, si: 0 }; sel = [n.id]; asel = {}; changed(); return;
      }
      record('Curvature Point');
      var q = P(p.x, p.y); q.a = e.altKey ? 0 : 1; sp.pts.push(q); reflowAuto(sp);
      drag = { kind: 'cvpt', tool: 'curvature', s0: s, id: cv.id, si: cv.si, pi: sp.pts.length - 1, rec: true, snap: hist[hist.length - 1].s }; changed();
    },
    move: function (e, s, p) {
      var d = drag; begin(d, 'Move Point');
      var n = byId(d.id), sp = n.d[d.si], q = sp.pts[d.pi]; unlive(n);
      moveAnchor(q, p.x - q.x, p.y - q.y); reflowAuto(sp); renderNode(n); drawUI();
    },
    up: function () { drag = null; changed(); },
    hover: function (s, p) {
      var sp = cv && byId(cv.id) ? byId(cv.id).d[cv.si] : null;
      if (!sp) { ui.pen = null; drawUI(); return; }
      var t = { pts: sp.pts.map(cp).concat([(function () { var q = P(p.x, p.y); q.a = 1; return q; })()]), closed: false }; reflowAuto(t);
      var tail = { pts: t.pts.slice(-3), closed: false }, dd = dCopy([tail]); dXform(dd, vmat());
      ui.pen = dStr(dd); drawUI();
    }
  };
  // ANCHOR POINT: tap a smooth point for a corner, drag a point to pull out
  // handles, drag a handle on its own, drag a segment to bend it
  H.anchor = {
    down: function (e, s, p, touch) {
      var hh = hitHandleOf(s, touch);
      if (hh) { drag = { kind: 'handle', tool: 'direct', s0: s, id: hh.n.id, si: hh.si, pi: hh.pi, h: hh.h, alt: true }; return; }
      var a = hitAnchor(s, touch);
      if (a) { sel = [a.n.id]; drag = { kind: 'pull', tool: tool, s0: s, id: a.n.id, si: a.si, pi: a.pi }; selChanged(); return; }
      var sg = hitSegment(p, tolDoc(touch), editLeaves());
      if (sg) { sel = [sg.n.id]; drag = { kind: 'bend', tool: tool, s0: s, p0: p, id: sg.n.id, si: sg.si, i: sg.i, t: Math.max(0.12, Math.min(0.88, sg.t)), orig: clone(sg.n) }; selChanged(); return; }
      H.select.down(e, s, p, touch);
    },
    move: function (e, s, p) {
      var d = drag;
      if (d.kind === 'pull') {
        begin(d, 'Pull Handles');
        var n = byId(d.id), q = n.d[d.si].pts[d.pi]; unlive(n); q.a = 0;
        q.ox = p.x; q.oy = p.y; q.ix = 2 * q.x - p.x; q.iy = 2 * q.y - p.y; q.s = 1; renderNode(n); drawUI(); return;
      }
      if (d.kind === 'bend') {
        begin(d, 'Bend');
        var n2 = replaceNode(d.id, clone(d.orig)), sp = n2.d[d.si], a = sp.pts[d.i], b = sp.pts[(d.i + 1) % sp.pts.length], w = 1 / (3 * d.t * (1 - d.t));
        var dx = (p.x - d.p0.x) * w, dy = (p.y - d.p0.y) * w; unlive(n2);
        a.ox += dx * (1 - d.t) * 1.0; a.oy += dy * (1 - d.t); b.ix += dx * d.t; b.iy += dy * d.t;
        a.s = isSmooth(a) ? 1 : 0; b.s = isSmooth(b) ? 1 : 0; a.a = b.a = 0;
        renderNode(n2); drawUI(); return;
      }
      H.select.move(e, s, p);
    },
    up: function (e, s, p, touch) {
      var d = drag;
      if (d.kind === 'pull' && !d.moved) { // (a tap: the point becomes a corner)
        var n = byId(d.id), q = n.d[d.si].pts[d.pi];
        if (hasIn(q) || hasOut(q)) { record('Corner'); unlive(n); q.ix = q.ox = q.x; q.iy = q.oy = q.y; q.s = 0; q.a = 0; }
        drag = null; changed(); return;
      }
      if (d.kind === 'pull' || d.kind === 'bend') { drag = null; changed(); return; }
      H.select.up(e, s, p, touch);
    },
    hover: H.direct.hover
  };
  // CONVERT ANCHOR POINT: a point switches between corner and smooth; a
  // segment between straight and curved; a drag pulls out handles
  H.convert = {
    down: function (e, s, p, touch) {
      var a = hitAnchor(s, touch);
      if (a) { sel = [a.n.id]; drag = { kind: 'pull', tool: 'convert', s0: s, id: a.n.id, si: a.si, pi: a.pi }; selChanged(); return; }
      var sg = hitSegment(p, tolDoc(touch), editLeaves());
      if (sg) {
        var sp = sg.n.d[sg.si], A = sp.pts[sg.i], Bq = sp.pts[(sg.i + 1) % sp.pts.length], S = seg(sp, sg.i);
        if (straight(S)) {
          record('Curve Segment'); var nrm = vnorm(v2(-(Bq.y - A.y), Bq.x - A.x)), side = (p.x - A.x) * nrm.x + (p.y - A.y) * nrm.y >= 0 ? 1 : -1, L = dist(A, Bq) * 0.3 * side;
          A.ox = A.x + (Bq.x - A.x) / 3 + nrm.x * L; A.oy = A.y + (Bq.y - A.y) / 3 + nrm.y * L; Bq.ix = A.x + (Bq.x - A.x) * 2 / 3 + nrm.x * L; Bq.iy = A.y + (Bq.y - A.y) * 2 / 3 + nrm.y * L;
        } else { record('Straighten Segment'); A.ox = A.x; A.oy = A.y; Bq.ix = Bq.x; Bq.iy = Bq.y; }
        A.s = isSmooth(A) ? 1 : 0; Bq.s = isSmooth(Bq) ? 1 : 0; A.a = Bq.a = 0; unlive(sg.n); sel = [sg.n.id]; changed(); return;
      }
      H.select.down(e, s, p, touch);
    },
    move: function (e, s, p) { H.anchor.move(e, s, p); },
    up: function (e, s, p, touch) {
      var d = drag;
      if (d.kind === 'pull' && !d.moved) {
        var n = byId(d.id), sp = n.d[d.si], q = sp.pts[d.pi]; record(q.s || hasIn(q) || hasOut(q) ? 'Corner' : 'Smooth'); unlive(n); q.a = 0;
        if (q.s || hasIn(q) || hasOut(q)) { q.ix = q.ox = q.x; q.iy = q.oy = q.y; q.s = 0; } else autoSmooth(sp, d.pi);
        drag = null; changed(); return;
      }
      H.anchor.up(e, s, p, touch);
    },
    hover: H.direct.hover
  };
  // ADD and DELETE ANCHOR POINT
  H.addpt = {
    down: function (e, s, p, touch) {
      var sg = hitSegment(p, tolDoc(touch), editLeaves()); if (!sg) { H.select.down(e, s, p, touch); return; }
      record('Add Anchor'); unlive(sg.n); var k = insertAt(sg.n.d[sg.si], sg.i, sg.t);
      sel = [sg.n.id]; asel = {}; asel[sg.n.id] = {}; asel[sg.n.id][sg.si + ':' + k] = 1; changed();
    },
    move: function (e, s, p) { H.select.move(e, s, p); }, up: function (e, s, p, t) { H.select.up(e, s, p, t); },
    hover: function (s, p, touch) { var sg = hitSegment(p, tolDoc(touch), editLeaves()); ui.hoverPt = sg ? toScreen(sg) : null; ui.hover = sg ? sg.n.id : null; drawUI(); }
  };
  H.delpt = {
    down: function (e, s, p, touch) {
      var a = hitAnchor(s, touch); if (!a) { H.select.down(e, s, p, touch); return; }
      record('Delete Anchor'); deletePoint(a.n, a.si, a.pi); asel = {}; changed();
    },
    move: function (e, s, p) { H.select.move(e, s, p); }, up: function (e, s, p, t) { H.select.up(e, s, p, t); },
    hover: H.direct.hover
  };
  // (an anchor taken away; the two segments either side become one, fitted
  // to their old shape)
  function deletePoint(n, si, pi) {
    unlive(n); var sp = n.d[si], N = sp.pts.length;
    if (N <= (sp.closed ? 3 : 2)) { n.d.splice(si, 1); if (!n.d.length) removeNode(n.id); return; }
    var hasPrev = sp.closed || pi > 0, hasNext = sp.closed || pi < N - 1;
    if (hasPrev && hasNext) {
      var ip = (pi - 1 + N) % N, inx = (pi + 1) % N, a = sp.pts[ip], b = sp.pts[inx], s1 = seg(sp, ip), s2 = seg(sp, pi);
      var samp = []; flatSeg(s1, 0.3, samp, 0, 0, true); var s2f = []; flatSeg(s2, 0.3, s2f, 0, 1, false); samp = samp.concat(s2f);
      if (!straight(s1) || !straight(s2)) {
        var tl = hasOut(a) ? vnorm(v2(a.ox - a.x, a.oy - a.y)) : vnorm(vsub(sp.pts[pi], a)), tr = hasIn(b) ? vnorm(v2(b.ix - b.x, b.iy - b.y)) : vnorm(vsub(sp.pts[pi], b));
        var f = fitCurves(samp, 1e9, tl, tr)[0];
        if (f) { a.ox = f[1].x; a.oy = f[1].y; b.ix = f[2].x; b.iy = f[2].y; }
      }
    }
    sp.pts.splice(pi, 1);
  }
  // SCISSORS: a path cut where it's tapped
  H.scissors = {
    down: function (e, s, p, touch) {
      var a = hitAnchor(s, touch), sg = a ? null : hitSegment(p, tolDoc(touch), editLeaves());
      if (!a && !sg) { H.select.down(e, s, p, touch); return; }
      var n = a ? a.n : sg.n; record('Cut Path'); unlive(n);
      var si = a ? a.si : sg.si, k = a ? a.pi : insertAt(n.d[sg.si], sg.i, sg.t);
      var made = cutAt(n, si, k); sel = [n.id].concat(made ? [made.id] : []); asel = {}; changed();
      if (!made && !n.d[si].closed) B.toast('Cut open: drag its ends apart with Direct Selection');
    },
    move: function (e, s, p) { H.select.move(e, s, p); }, up: function (e, s, p, t) { H.select.up(e, s, p, t); },
    hover: function (s, p, touch) { var a = hitAnchor(s, touch), sg = a ? null : hitSegment(p, tolDoc(touch), editLeaves()); ui.hoverPt = a ? toScreen(a.n.d[a.si].pts[a.pi]) : sg ? toScreen(sg) : null; ui.hover = a ? a.n.id : sg ? sg.n.id : null; drawUI(); }
  };
  // (a closed subpath opens at point k; an open one splits there into a new path above)
  function cutAt(n, si, k) {
    var sp = n.d[si];
    if (sp.closed) {
      var pts = sp.pts.slice(k).concat(sp.pts.slice(0, k)), end = cp(pts[0]);
      pts[0].ix = pts[0].x; pts[0].iy = pts[0].y; end.ox = end.x; end.oy = end.y; pts.push(end);
      sp.pts = pts; sp.closed = false; return null;
    }
    if (k <= 0 || k >= sp.pts.length - 1) return null;
    var a = sp.pts.slice(0, k + 1), b = sp.pts.slice(k).map(cp);
    a[a.length - 1] = cp(a[a.length - 1]); a[a.length - 1].ox = a[a.length - 1].x; a[a.length - 1].oy = a[a.length - 1].y; b[0].ix = b[0].x; b[0].iy = b[0].y;
    sp.pts = a;
    var m = newPath([{ pts: b, closed: false }], n.name, clone(n.app)); m.opacity = n.opacity; m.blend = n.blend;
    insertNode(m, n); return m;
  }
  // KNIFE: dragged across shapes, it cuts them into pieces along its line
  H.knife = {
    down: function (e, s) { drag = { kind: 'knife', tool: 'knife', s0: s, pts: [s] }; ui.knife = drag.pts; },
    move: function (e, s) { drag.pts.push(s); ui.knife = drag.pts; drawUI(); },
    up: function () {
      var d = drag; drag = null; ui.knife = null;
      var line = rdp(d.pts, 1.5).map(function (q) { return fromScreen(q.x, q.y); });
      if (line.length < 2) { drawUI(); return; }
      var targets = picked().filter(editable).map(function (n) { return leaves(n); }).reduce(function (a, b) { return a.concat(b); }, []);
      if (!targets.length) targets = editLeaves();
      var snapped = snap(), cut = 0, ids = [];
      targets.forEach(function (n) { if (n.type === 'path') { var r = knifeCut(n, line); if (r) { cut++; ids = ids.concat(r); } } });
      if (cut) { hist.push({ s: snapped, label: 'Knife' }); if (hist.length > HMAX) hist.shift(); fut = []; sel = ids; asel = {}; changed(); }
      else { B.toast('The knife has to go right across a closed shape'); drawUI(); }
    }
  };
  // (the crossings of a line of points with a subpath: where along the line u, and along the path seg, t)
  function crossings(sp, line) {
    var f = flat(sp, 0.25, 0), out = [];
    for (var k = 0; k + 1 < f.length; k++) {
      var a = f[k], b = f[k + 1];
      for (var j = 0; j + 1 < line.length; j++) {
        var c = line[j], d = line[j + 1], den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x); if (Math.abs(den) < 1e-12) continue;
        var t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den, u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
        if (t >= 0 && t < 1 && u >= 0 && u <= 1) { var ta = a.i === b.i ? a.t : 0; out.push({ seg: b.i, t: ta + (b.t - ta) * t, u: j + u, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
      }
    }
    return out;
  }
  function knifeCut(n, line) {
    var pieces = [], any = false;
    n.d.forEach(function (sp) {
      if (!sp.closed || sp.pts.length < 2) { pieces.push([sp]); return; }
      var cs = crossings(sp, line).filter(function (c) { return c.t > 1e-6 && c.t < 1 - 1e-6; });
      if (cs.length < 2) { pieces.push([sp]); return; }
      // (each crossing becomes an anchor, tagged; insert from the last, so indices hold)
      var work = { pts: sp.pts.map(cp), closed: true };
      cs.forEach(function (c, i) { c.id = i; });
      cs.slice().sort(function (a, b) { return a.seg - b.seg || a.t - b.t; }).reverse().forEach(function (c) { var k = insertAt(work, c.seg, c.t); work.pts[k].cx = c.id + 1; });
      // (pairs along the knife whose middle is inside the shape are cuts)
      cs.sort(function (a, b) { return a.u - b.u; });
      var poly = flat(sp, 0.5, 0), chords = [];
      for (var i = 0; i + 1 < cs.length; i++) {
        var um = (cs[i].u + cs[i + 1].u) / 2, j = Math.floor(um), mid = lerp(line[j], line[Math.min(line.length - 1, j + 1)], um - j);
        if (inPoly(poly, mid)) chords.push([cs[i], cs[i + 1]]);
      }
      if (!chords.length) { pieces.push([sp]); return; }
      var loops = [work];
      chords.forEach(function (ch) {
        var A = ch[0], Bc = ch[1];
        loops.some(function (lp, li) {
          var ia = -1, ib = -1; lp.pts.forEach(function (q, k) { if (q.cx === A.id + 1) ia = k; if (q.cx === Bc.id + 1) ib = k; });
          if (ia < 0 || ib < 0) return false;
          var mid2 = [], j0 = Math.ceil(A.u), j1 = Math.floor(Bc.u); for (var j2 = j0; j2 <= j1; j2++) if (j2 > A.u && j2 < Bc.u) mid2.push(line[j2]);
          var N = lp.pts.length, run = function (from, to) { var r = []; for (var k = from; ; k = (k + 1) % N) { r.push(cp(lp.pts[k])); if (k === to) break; } return r; };
          var l1 = run(ia, ib), l2 = run(ib, ia);
          // (l1 goes A..B along the path, back B to A along the knife; l2 the other way round)
          l1[0].ix = l1[0].x; l1[0].iy = l1[0].y; l1[l1.length - 1].ox = l1[l1.length - 1].x; l1[l1.length - 1].oy = l1[l1.length - 1].y;
          l2[0].ix = l2[0].x; l2[0].iy = l2[0].y; l2[l2.length - 1].ox = l2[l2.length - 1].x; l2[l2.length - 1].oy = l2[l2.length - 1].y;
          var back = mid2.slice().reverse().map(function (q) { return P(q.x, q.y); }), fwd = mid2.map(function (q) { return P(q.x, q.y); });
          l1.forEach(function (q) { q.s = isSmooth(q) ? 1 : 0; }); l2.forEach(function (q) { q.s = isSmooth(q) ? 1 : 0; });
          loops.splice(li, 1, { pts: l1.concat(back), closed: true }, { pts: l2.concat(fwd), closed: true });
          any = true; return true;
        });
      });
      pieces.push(loops.map(function (lp) { lp.pts.forEach(function (q) { delete q.cx; }); return lp; }));
    });
    if (!any) return null;
    // (each piece of a cut subpath becomes a shape of its own; subpaths not
    // cut (holes) go with the piece they're inside)
    var cutLoops = [], rest = [];
    pieces.forEach(function (g) { if (g.length > 1) cutLoops = cutLoops.concat(g); else rest.push(g[0]); });
    var shapes = cutLoops.map(function (lp) { return [lp]; });
    rest.forEach(function (sp) { var at = sp.pts[0], home = shapes.filter(function (sh) { return inside([sh[0]], at); })[0]; if (home) home.push(sp); else shapes.push([sp]); });
    var ids = [];
    shapes.forEach(function (d, i) {
      if (i === 0) { n.d = d; unlive(n); ids.push(n.id); return; }
      var m = newPath(d, n.name, clone(n.app)); m.opacity = n.opacity; m.blend = n.blend; insertNode(m, n); ids.push(m.id);
    });
    return ids;
  }
  // JOIN: from one open end to another; Ctrl/⌘ J joins the picked paths
  H.join = {
    down: function (e, s, p, touch) {
      var a = hitEnd(s, touch);
      if (!a) { H.select.down(e, s, p, touch); return; }
      drag = { kind: 'join', tool: 'join', s0: s, a: a }; ui.join = [toScreen(a.n.d[a.si].pts[a.pi]), s];
    },
    move: function (e, s, p) { if (drag.kind !== 'join') { H.select.move(e, s, p); return; } ui.join[1] = s; drawUI(); },
    up: function (e, s, p, touch) {
      var d = drag; if (d.kind !== 'join') { H.select.up(e, s, p, touch); return; }
      drag = null; ui.join = null;
      var b = hitEnd(s, touch);
      if (!b || (b.n === d.a.n && b.si === d.a.si && b.pi === d.a.pi)) { if (!d.moved) { sel = [d.a.n.id]; asel = {}; selChanged(); } drawUI(); return; }
      record('Join'); joinEnds(d.a, b); changed();
    },
    hover: function (s, p, touch) { var a = hitEnd(s, touch); ui.hoverPt = a ? toScreen(a.n.d[a.si].pts[a.pi]) : null; drawUI(); }
  };
  function joinEnds(a, b) {
    var na = a.n, nb = b.n, spa = na.d[a.si], spb = nb.d[b.si]; unlive(na); unlive(nb);
    if (spa === spb) { closeSp(spa); sel = [na.id]; return; }
    if (a.end === 'head') reverseSp(spa);
    if (b.end === 'tail') reverseSp(spb);
    var la = spa.pts[spa.pts.length - 1], fb = spb.pts[0];
    if (dist(la, fb) < 0.5 / Math.max(view.k, 0.01)) { la.ox = fb.ox; la.oy = fb.oy; la.s = isSmooth(la) ? 1 : 0; spa.pts = spa.pts.concat(spb.pts.slice(1)); }
    else spa.pts = spa.pts.concat(spb.pts);
    nb.d.splice(nb.d.indexOf(spb), 1);
    if (nb !== na && !nb.d.length) removeNode(nb.id);
    sel = [na.id]; asel = {};
  }
  function closeSp(sp) {
    var f = sp.pts[0], l = sp.pts[sp.pts.length - 1];
    if (sp.pts.length > 2 && dist(f, l) < 0.5) { f.ix = l.ix; f.iy = l.iy; f.s = isSmooth(f) ? 1 : 0; sp.pts.pop(); }
    sp.closed = true;
  }
  function joinPicked() {
    var ends = [];
    picked().filter(editable).forEach(function (n) { leaves(n).forEach(function (q) { if (q.type === 'path') q.d.forEach(function (sp, si) { if (!sp.closed && sp.pts.length > 1) ends.push({ n: q, si: si }); }); }); });
    if (!ends.length) { B.toast('Pick an open path (or two) to join'); return; }
    record('Join');
    if (ends.length === 1) { closeSp(ends[0].n.d[ends[0].si]); unlive(ends[0].n); changed(); return; }
    // (two at a time: the nearest ends)
    while (ends.length > 1) {
      var a = ends[0], best = null;
      for (var j = 1; j < ends.length; j++) {
        var A = a.n.d[a.si], Bs = ends[j].n.d[ends[j].si];
        [['head', 0], ['tail', A.pts.length - 1]].forEach(function (ea) { [['head', 0], ['tail', Bs.pts.length - 1]].forEach(function (eb) { var dd = dist(A.pts[ea[1]], Bs.pts[eb[1]]); if (!best || dd < best.d) best = { j: j, ea: ea, eb: eb, d: dd }; }); });
      }
      var b = ends[best.j];
      joinEnds({ n: a.n, si: a.si, end: best.ea[0] }, { n: b.n, si: b.si, end: best.eb[0] });
      ends.splice(best.j, 1);
      ends[0] = { n: a.n, si: a.n.d.indexOf(a.n.d[a.si]) >= 0 ? a.si : 0 };
      ends = ends.filter(function (q) { return byId(q.n.id) && q.n.d[q.si]; });
    }
    changed();
  }
  // SIMPLIFY: the path fitted again with fewer anchors (corners kept)
  function simplifyPath(n, tol, corner) {
    unlive(n);
    n.d = n.d.map(function (sp) {
      if (sp.pts.length < 3) return sp;
      var N = sp.pts.length, cuts = [];
      sp.pts.forEach(function (q, i) { var end = !sp.closed && (i === 0 || i === N - 1); if (end || (corner && !q.s && (hasIn(q) || hasOut(q) || angleAt(sp, i) > 0.35))) cuts.push(i); });
      if (sp.closed && !cuts.length) cuts.push(0);
      var runs = [];
      for (var c = 0; c < cuts.length; c++) {
        var from = cuts[c], to = c + 1 < cuts.length ? cuts[c + 1] : (sp.closed ? cuts[0] : -1); if (to < 0) break;
        var samp = [], k = from, first = true;
        do { if (segN(sp) === 0) break; flatSeg(seg(sp, k), 0.2, samp, 0, 0, first); first = false; k = (k + 1) % N; } while (k !== to && samp.length < 20000);
        runs.push(fitCurves(samp, tol));
      }
      var segs = runs.reduce(function (a, b) { return a.concat(b); }, []);
      return segs.length ? { pts: bzPts(segs, sp.closed), closed: sp.closed } : sp;
    });
  }
  function angleAt(sp, i) {
    var N = sp.pts.length, q = sp.pts[i], a = sp.pts[(i - 1 + N) % N], b = sp.pts[(i + 1) % N];
    var u = hasIn(q) ? v2(q.x - q.ix, q.y - q.iy) : v2(q.x - (a.ox !== a.x || a.oy !== a.y ? a.ox : a.x), q.y - (a.ox !== a.x || a.oy !== a.y ? a.oy : a.y));
    var w = hasOut(q) ? v2(q.ox - q.x, q.oy - q.y) : v2((b.ix !== b.x || b.iy !== b.y ? b.ix : b.x) - q.x, (b.ix !== b.x || b.iy !== b.y ? b.iy : b.y) - q.y);
    var lu = Math.hypot(u.x, u.y), lw = Math.hypot(w.x, w.y); if (!lu || !lw) return 0;
    return Math.acos(Math.max(-1, Math.min(1, (u.x * w.x + u.y * w.y) / (lu * lw))));
  }
  function anchorCount(list) { var c = 0; list.forEach(function (n) { leaves(n).forEach(function (q) { if (q.type === 'path') q.d.forEach(function (sp) { c += sp.pts.length; }); }); }); return c; }
  H.simplify = {
    down: function (e, s, p, touch) {
      var hit = hitLeaf(p, tolDoc(touch));
      if (!hit || hit.type !== 'path') { H.select.down(e, s, p, touch); return; }
      var before = anchorCount([hit]); record('Simplify'); simplifyPath(hit, TS.simplify.tol, TS.simplify.corner); sel = [hit.id]; asel = {}; changed();
      B.toast('Simplified: ' + before + ' anchor points to ' + anchorCount([hit]));
    },
    move: function (e, s, p) { H.select.move(e, s, p); }, up: function (e, s, p, t) { H.select.up(e, s, p, t); },
    hover: H.select.hover
  };

  // SHAPES: dragged out (Shift squares them, Alt from the middle), or a
  // tap for one the size set in the panel; they stay live (n.live)
  function shapeLive(t, p0, p, shift, alt) {
    var S = TS[t];
    if (t === 'line') {
      var x2 = p.x, y2 = p.y;
      if (shift) { var a = Math.round(Math.atan2(p.y - p0.y, p.x - p0.x) / (Math.PI / 4)) * Math.PI / 4, L = dist(p, p0); x2 = p0.x + Math.cos(a) * L; y2 = p0.y + Math.sin(a) * L; }
      return alt ? { k: 'line', x1: 2 * p0.x - x2, y1: 2 * p0.y - y2, x2: x2, y2: y2 } : { k: 'line', x1: p0.x, y1: p0.y, x2: x2, y2: y2 };
    }
    if (t === 'arc') return { k: 'arc', x1: p0.x, y1: p0.y, x2: p.x, y2: p.y, slope: S.slope, closed: S.closed };
    if (t === 'polygon' || t === 'star' || t === 'spiral') {
      var r = Math.max(1, dist(p, p0)), an = shift ? -Math.PI / 2 : Math.atan2(p.y - p0.y, p.x - p0.x);
      if (t === 'polygon') return { k: 'polygon', cx: p0.x, cy: p0.y, r: r, n: S.n, a: an };
      if (t === 'star') return { k: 'star', cx: p0.x, cy: p0.y, r: r, r2: r * S.r2 / Math.max(1, S.r), n: S.n, a: an };
      return { k: 'spiral', cx: p0.x, cy: p0.y, r: r, decay: S.decay, segs: S.segs, cw: S.cw, a: an };
    }
    var dx = p.x - p0.x, dy = p.y - p0.y;
    if (shift) { var m = Math.max(Math.abs(dx), Math.abs(dy)); dx = (dx < 0 ? -1 : 1) * m; dy = (dy < 0 ? -1 : 1) * m; }
    var x = alt ? p0.x - Math.abs(dx) : Math.min(p0.x, p0.x + dx), y = alt ? p0.y - Math.abs(dy) : Math.min(p0.y, p0.y + dy), w = Math.abs(dx) * (alt ? 2 : 1), h = Math.abs(dy) * (alt ? 2 : 1);
    var L2 = { k: t, x: x, y: y, w: Math.max(0.5, w), h: Math.max(0.5, h) };
    if (t === 'rrect') L2.r = S.r;
    if (t === 'rgrid') { L2.rows = S.rows; L2.cols = S.cols; L2.frame = S.frame; }
    if (t === 'pgrid') { L2.rings = S.rings; L2.spokes = S.spokes; }
    return L2;
  }
  // (one the size set, its middle at p)
  function shapeAt(t, p) {
    var S = TS[t];
    if (t === 'line') { var a = S.ang * Math.PI / 180; return { k: 'line', x1: p.x - Math.cos(a) * S.len / 2, y1: p.y + Math.sin(a) * S.len / 2, x2: p.x + Math.cos(a) * S.len / 2, y2: p.y - Math.sin(a) * S.len / 2 }; }
    if (t === 'arc') return { k: 'arc', x1: p.x - S.w / 2, y1: p.y - S.h / 2, x2: p.x + S.w / 2, y2: p.y + S.h / 2, slope: S.slope, closed: S.closed };
    if (t === 'polygon') return { k: 'polygon', cx: p.x, cy: p.y, r: S.r, n: S.n, a: -Math.PI / 2 };
    if (t === 'star') return { k: 'star', cx: p.x, cy: p.y, r: S.r, r2: S.r2, n: S.n, a: -Math.PI / 2 };
    if (t === 'spiral') return { k: 'spiral', cx: p.x, cy: p.y, r: S.r, decay: S.decay, segs: S.segs, cw: S.cw, a: -Math.PI / 2 };
    var L = { k: t, x: p.x - S.w / 2, y: p.y - S.h / 2, w: S.w, h: S.h };
    if (t === 'rrect') L.r = S.r; if (t === 'rgrid') { L.rows = S.rows; L.cols = S.cols; L.frame = S.frame; } if (t === 'pgrid') { L.rings = S.rings; L.spokes = S.spokes; }
    return L;
  }
  var SHAPE_NAMES = { rect: 'Rectangle', rrect: 'Rounded Rectangle', ellipse: 'Ellipse', polygon: 'Polygon', star: 'Star', spiral: 'Spiral', line: 'Line', arc: 'Arc', rgrid: 'Grid', pgrid: 'Polar Grid' };
  function shapeApp(t) {
    var app = clone(doc.def.app);
    var noFill = t === 'line' || t === 'spiral' || (t === 'arc' && !TS.arc.fill) || (t === 'rgrid' && !TS.rgrid.fill) || (t === 'pgrid' && !TS.pgrid.fill);
    if (noFill) app.forEach(function (it) { if (it.k === 'f') it.p = null; });
    if (noFill && topOf(app, 's') < 0) app.push(clone(defApp()[1]));
    if (noFill) app.forEach(function (it) { if (it.k === 's' && !it.p) it.p = { t: 'c', c: '#1d1d1f' }; });
    return app;
  }
  function makeShape(t, L) { var n = newPath(liveGen(L), SHAPE_NAMES[t], shapeApp(t)); n.live = L; return n; }
  // (the panel's sizes follow the shape last drawn)
  function shapeToTS(t, L) {
    var S = TS[t];
    if (BOXY[L.k]) { S.w = Math.round(L.w); S.h = Math.round(L.h); }
    if (L.k === 'arc') { S.w = Math.round(Math.abs(L.x2 - L.x1)); S.h = Math.round(Math.abs(L.y2 - L.y1)); }
    if (CENTRED[L.k]) { S.r = Math.round(L.r); if (L.k === 'star') S.r2 = Math.round(L.r2); }
    if (L.k === 'line') { S.len = Math.round(Math.hypot(L.x2 - L.x1, L.y2 - L.y1)); S.ang = Math.round(Math.atan2(L.y1 - L.y2, L.x2 - L.x1) * 180 / Math.PI); }
    tsSave();
  }
  H.shape = {
    down: function (e, s, p) { drag = { kind: 'shape', tool: tool, t: tool, s0: s, p0: p }; },
    move: function (e, s, p) {
      var d = drag, L = shapeLive(d.t, d.p0, p, e.shiftKey, e.altKey), n = d.id && byId(d.id);
      if (!n) { begin(d, SHAPE_NAMES[d.t]); n = insertNode(makeShape(d.t, L)); d.id = n.id; sel = [n.id]; asel = {}; renderArt(); }
      else { n.live = L; n.d = liveGen(L); renderNode(n); }
      drawUI(); panelSync();
    },
    up: function (e, s, p) {
      var d = drag; drag = null;
      if (!d.moved) { record(SHAPE_NAMES[d.t]); var n = insertNode(makeShape(d.t, shapeAt(d.t, p))); sel = [n.id]; asel = {}; changed(); return; }
      var n2 = byId(d.id); if (n2 && n2.live) shapeToTS(d.t, n2.live);
      changed();
    }
  };
  ['rect', 'rrect', 'ellipse', 'polygon', 'star', 'spiral', 'line', 'arc', 'rgrid', 'pgrid'].forEach(function (t) { H[t] = H.shape; });

  // FILL TOOLS on the artboard
  function defItem(k) { return itemOf(doc.def.app, k, false); }
  function solidOf(p) { return !p ? null : p.t === 'c' ? clone(p) : p.st ? { t: 'c', c: p.st[p.st.length - 1].c } : { t: 'c', c: '#888888' }; }
  function isGrad(p) { return !!p && (p.t === 'l' || p.t === 'r'); }
  H.solid = {
    down: function (e, s, p, touch) {
      var hit = hitLeaf(p, tolDoc(touch)); if (!hit || !hit.app) { H.select.down(e, s, p, touch); return; }
      var f = defItem('f'); record('Fill'); var it = itemOf(hit.app, 'f', true); it.p = solidOf(f && f.p) || { t: 'c', c: '#ffffff' }; it.on = 1; changed();
    },
    move: function (e, s, p) { H.select.move(e, s, p); }, up: function (e, s, p, t) { H.select.up(e, s, p, t); }, hover: H.select.hover
  };
  // GRADIENT: tap for the gradient; drag across to point it
  var lastGrad = null;
  function gradNow() { return clone(lastGrad) || (function () { var g = gradOf('#000000'); if (TS.gradient.kind === 'r') { g = { t: 'r', st: g.st, cx: 0.5, cy: 0.5, r: 0.5 }; } return g; })(); }
  H.gradient = {
    down: function (e, s, p, touch) {
      // (dragging a gradient's end handle)
      var gh = gradHandleHit(s, touch); if (gh) { drag = { kind: 'gend', tool: 'gradient', s0: s, id: gh.n.id, end: gh.end }; return; }
      var hit = hitLeaf(p, tolDoc(touch)) || (sel.length === 1 && byId(sel[0]));
      if (!hit || hit.type !== 'path') { H.select.down(e, s, p, touch); return; }
      if (sel.indexOf(hit.id) < 0) { sel = [hit.id]; asel = {}; }
      drag = { kind: 'grad', tool: 'gradient', s0: s, p0: p, id: hit.id };
    },
    move: function (e, s, p) {
      var d = drag; if (d.kind !== 'grad' && d.kind !== 'gend') { H.select.move(e, s, p); return; }
      begin(d, 'Gradient');
      var n = byId(d.id), b = dBox(n.d) || { x: 0, y: 0, w: 1, h: 1 }, it = itemOf(n.app, TS.gradient.to === 's' ? 's' : 'f', true);
      if (!isGrad(it.p)) it.p = gradNow();
      var fx = function (q) { return v2((q.x - b.x) / Math.max(b.w, 1e-6), (q.y - b.y) / Math.max(b.h, 1e-6)); };
      var g = it.p;
      if (d.kind === 'grad') {
        var a = fx(d.p0), c = fx(p);
        if (g.t === 'r') { g.cx = a.x; g.cy = a.y; g.r = Math.max(0.01, Math.hypot(c.x - a.x, c.y - a.y)); }
        else { g.x1 = a.x; g.y1 = a.y; g.x2 = c.x; g.y2 = c.y; }
      } else {
        var q = fx(p);
        if (g.t === 'r') { if (d.end === 'a') { g.cx = q.x; g.cy = q.y; } else g.r = Math.max(0.01, Math.hypot(q.x - g.cx, q.y - g.cy)); }
        else if (d.end === 'a') { g.x1 = q.x; g.y1 = q.y; } else { g.x2 = q.x; g.y2 = q.y; }
      }
      it.on = 1; lastGrad = clone(g); renderNode(n); drawUI();
    },
    up: function (e, s, p, touch) {
      var d = drag; if (d.kind !== 'grad' && d.kind !== 'gend') { H.select.up(e, s, p, touch); return; }
      drag = null;
      if (!d.moved && d.kind === 'grad') { // (a tap: the gradient on, or a solid colour again with a second tap)
        var n = byId(d.id), it = itemOf(n.app, TS.gradient.to === 's' ? 's' : 'f', true);
        record('Gradient'); it.p = isGrad(it.p) ? it.p : gradNow(); it.on = 1;
      }
      changed();
    },
    hover: H.select.hover
  };
  function gradEnds(n) {
    var it = n.type === 'path' ? itemOf(n.app, TS.gradient.to === 's' ? 's' : 'f', false) : null; if (!it || !isGrad(it.p)) return null;
    var b = dBox(n.d); if (!b) return null; var g = it.p, at = function (x, y) { return toScreen(v2(b.x + x * b.w, b.y + y * b.h)); };
    return g.t === 'r' ? { a: at(g.cx, g.cy), b: at(g.cx + g.r * (b.w + b.h) / 2 / Math.max(b.w, 1e-6), g.cy), g: g } : { a: at(g.x1, g.y1), b: at(g.x2, g.y2), g: g };
  }
  function gradUiSvg(n) {
    var e = n.type === 'path' && gradEnds(n); if (!e) return '';
    return '<line class="vs-gline" x1="' + r2(e.a.x) + '" y1="' + r2(e.a.y) + '" x2="' + r2(e.b.x) + '" y2="' + r2(e.b.y) + '"/><circle class="vs-gend" cx="' + r2(e.a.x) + '" cy="' + r2(e.a.y) + '" r="5"/><rect class="vs-gend" x="' + r2(e.b.x - 4.5) + '" y="' + r2(e.b.y - 4.5) + '" width="9" height="9"/>';
  }
  function gradHandleHit(s, touch) {
    var r = touch ? 14 : 8, hit = null;
    picked().forEach(function (n) { var e = n.type === 'path' && gradEnds(n); if (!e || hit) return; if (dist(e.b, s) <= r) hit = { n: n, end: 'b' }; else if (dist(e.a, s) <= r) hit = { n: n, end: 'a' }; });
    return hit;
  }
  // EYEDROPPER: an object's look onto what's picked; Shift: the colour under the pointer
  H.eyedropper = {
    down: function (e, s, p, touch) {
      if (e.shiftKey) { var c = sampleAt(p); if (c) setColour(TS.cpick.to === 's' ? 'second' : 'main', c, 'Eyedropper'); return; }
      var hit = hitLeaf(p, tolDoc(touch)); if (!hit) return;
      var targets = picked().filter(editable).map(function (n) { return leaves(n); }).reduce(function (a, b) { return a.concat(b); }, []).filter(function (n) { return n !== hit && n.app; });
      record('Eyedropper');
      if (hit.app) { doc.def.app = clone(hit.app); targets.forEach(function (n) { n.app = clone(hit.app); }); }
      targets.forEach(function (n) { n.opacity = hit.opacity; n.blend = hit.blend; });
      changed(); B.toast(targets.length ? 'Copied its look onto what’s picked' : 'Picked up its look: new objects take it');
    },
    move: function () {}, up: function () { drag = null; }, hover: H.select.hover
  };
  // (the colour of the artwork at p, as it's seen; white where there's only the artboard)
  function sampleAt(p) {
    var c = document.createElement('canvas'); c.width = c.height = 1;
    var x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, 1, 1); x.setTransform(1, 0, 0, 1, -p.x + 0.5, -p.y + 0.5);
    doc.layers.forEach(function (L) { cDraw(x, L); });
    var d = x.getImageData(0, 0, 1, 1).data; return '#' + [d[0], d[1], d[2]].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }
  // VECTOR FILL: inside a shape, its fill; inside an area closed off by
  // lines, a new shape that fills just that area (under the lines)
  H.vfill = {
    down: function (e, s, p, touch) {
      var f = defItem('f'), paint = f && f.p ? clone(f.p) : { t: 'c', c: '#ffffff' }, hit = hitLeaf(p, tolDoc(touch));
      if (hit && hit.type === 'path' && hit.d.some(function (sp) { return sp.closed; }) && inside(hit.d, p)) { record('Fill'); var it = itemOf(hit.app, 'f', true); it.p = paint; it.on = 1; changed(); return; }
      var d = regionAt(p);
      if (!d) { B.toast('That area isn’t closed off: tap inside a shape, or an area lines close in'); return; }
      record('Vector Fill');
      var n = newPath(d, 'Fill', [{ k: 'f', p: paint, o: 1, on: 1 }]); n.opacity = 1; n.blend = 'normal';
      var L = curLayer(); if (!L || !editable(L)) L = newLayer(); L.items.unshift(n); sel = [n.id]; asel = {}; changed();
    },
    move: function () {}, up: function () { drag = null; }
  };
  // (the area round p that strokes and shapes' edges close in, traced to a path)
  function regionAt(p) {
    var list = allLeaves().filter(function (n) { return n.type === 'path' && shownN(n); }); if (!list.length) return null;
    var b = boxOf(list); if (!b || p.x < b.x || p.y < b.y || p.x > b.x + b.w || p.y > b.y + b.h) return null;
    var pad = 4 / view.k, k = Math.min(4 * Math.max(view.k, 0.25), 1800 / Math.max(b.w + 2 * pad, b.h + 2 * pad)), W = Math.ceil((b.w + 2 * pad) * k) + 2, Hh = Math.ceil((b.h + 2 * pad) * k) + 2;
    var c = document.createElement('canvas'); c.width = W; c.height = Hh; var x = c.getContext('2d', { willReadFrequently: true });
    x.setTransform(k, 0, 0, k, (pad - b.x) * k + 1, (pad - b.y) * k + 1); x.strokeStyle = '#000'; x.lineCap = 'round'; x.lineJoin = 'round';
    list.forEach(function (n) { x.lineWidth = Math.max(1.5 / k, strokeW(n)); x.stroke(new Path2D(dStr(n.d))); });
    var img = x.getImageData(0, 0, W, Hh).data, mask = new Uint8Array(W * Hh), sx = Math.floor((p.x - b.x + pad) * k + 1), sy = Math.floor((p.y - b.y + pad) * k + 1);
    var wall = function (i) { return img[i * 4 + 3] > 100; };
    if (sx < 0 || sy < 0 || sx >= W || sy >= Hh || wall(sy * W + sx)) return null;
    var stack = [sy * W + sx], leak = false; mask[sy * W + sx] = 1;
    while (stack.length) {
      var i = stack.pop(), xx = i % W, yy = (i - xx) / W;
      if (xx === 0 || yy === 0 || xx === W - 1 || yy === Hh - 1) { leak = true; break; }
      [i - 1, i + 1, i - W, i + W].forEach(function (j) { if (!mask[j] && !wall(j)) { mask[j] = 1; stack.push(j); } });
    }
    if (leak) return null;
    // (grown a little, so the fill tucks under the lines round it)
    for (var g = 0; g < 2; g++) { var m2 = mask.slice(); for (var q = W; q < W * (Hh - 1); q++) if (!mask[q] && (mask[q - 1] || mask[q + 1] || mask[q - W] || mask[q + W])) m2[q] = 1; mask = m2; }
    var loops = traceMask(mask, W, Hh);
    var d = loops.filter(function (lp) { return lp.length > 3; }).map(function (lp) {
      var pts = rdp(lp.concat([lp[0]]), 0.7).map(function (q) { return v2((q.x - 1) / k + b.x - pad, (q.y - 1) / k + b.y - pad); });
      var segs = fitCurves(pts, 0.8 / k + 0.25 / view.k); return { pts: bzPts(segs, true), closed: true };
    }).filter(function (sp) { return sp.pts.length > 2; });
    return d.length ? d : null;
  }
  // (the edges of a mask as loops of corner points, the inside always on
  // the right: outlines go one way round, holes the other, so a fill by the
  // non-zero rule leaves the holes empty)
  function traceMask(mask, W, Hh) {
    var at = function (x, y) { return x >= 0 && y >= 0 && x < W && y < Hh && mask[y * W + x] ? 1 : 0; }, seen = new Set(), loops = [];
    var R = { r: 'd', d: 'l', l: 'u', u: 'r' }, Lf = { r: 'u', u: 'l', l: 'd', d: 'r' };
    // (the edge from corner (px, py) going d has the inside on its right and the outside on its left)
    var edge = function (d, px, py) {
      if (d === 'r') return at(px, py) && !at(px, py - 1);
      if (d === 'd') return at(px - 1, py) && !at(px, py);
      if (d === 'l') return at(px - 1, py - 1) && !at(px - 1, py);
      return at(px, py - 1) && !at(px - 1, py - 1);
    };
    for (var y = 0; y < Hh; y++) for (var x = 0; x < W; x++) {
      if (!edge('r', x, y) || seen.has(y * (W + 1) + x)) continue;
      var lp = [], cx = x, cy = y, dir = 'r', guard = 0;
      do {
        if (dir === 'r') seen.add(cy * (W + 1) + cx);
        lp.push(v2(cx, cy));
        cx += dir === 'r' ? 1 : dir === 'l' ? -1 : 0; cy += dir === 'd' ? 1 : dir === 'u' ? -1 : 0;
        dir = edge(R[dir], cx, cy) ? R[dir] : edge(dir, cx, cy) ? dir : Lf[dir];
      } while ((cx !== x || cy !== y || dir !== 'r') && ++guard < 2000000);
      loops.push(lp);
    }
    return loops;
  }
  // VARIABLE WIDTH: width points along the stroke (its profile)
  function fracAt(n, p) {
    var best = null;
    n.d.forEach(function (sp, si) {
      var m = measure(sp, 0.4); if (m.L <= 0) return;
      m.f.forEach(function (q, k) { var dd = dist(q, p); if (!best || dd < best.d) { var a = m.f[Math.max(0, k - 1)], b = m.f[Math.min(m.f.length - 1, k + 1)]; best = { si: si, t: q.s / m.L, x: q.x, y: q.y, d: dd, tan: vnorm(vsub(b, a)) }; } });
    });
    return best;
  }
  function pointAtFrac(sp, t) {
    var m = measure(sp, 0.4), want = t * m.L, f = m.f;
    for (var k = 1; k < f.length; k++) if (f[k].s >= want) { var a = f[k - 1], b = f[k], u = (want - a.s) / Math.max(1e-9, b.s - a.s); return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, tan: vnorm(vsub(b, a)) }; }
    var e = f[f.length - 1], e0 = f[Math.max(0, f.length - 2)]; return { x: e.x, y: e.y, tan: vnorm(vsub(e, e0)) };
  }
  function widthUiSvg(n) {
    var it = itemOf(n.app, 's', false); if (!it || !it.p || !n.d.length) return '';
    var out = '', prof = it.prof || [];
    prof.forEach(function (q, i) {
      var at = pointAtFrac(n.d[0], q.t), hw = it.w / 2 * q.w, nrm = v2(-at.tan.y, at.tan.x), a = toScreen(v2(at.x + nrm.x * hw, at.y + nrm.y * hw)), b = toScreen(v2(at.x - nrm.x * hw, at.y - nrm.y * hw)), c = toScreen(at);
      out += '<line class="vs-hline" x1="' + r2(a.x) + '" y1="' + r2(a.y) + '" x2="' + r2(b.x) + '" y2="' + r2(b.y) + '"/><circle class="vs-hdot" cx="' + r2(a.x) + '" cy="' + r2(a.y) + '" r="3.5"/><circle class="vs-hdot" cx="' + r2(b.x) + '" cy="' + r2(b.y) + '" r="3.5"/><circle class="vs-wpt' + (i === wpick ? ' on' : '') + '" cx="' + r2(c.x) + '" cy="' + r2(c.y) + '" r="4"/>';
    });
    return out;
  }
  var wpick = -1;
  // (a profile that's the same width all along is no profile)
  function plainProf(prof) { return !prof || prof.length < 2 || prof.every(function (q) { return Math.abs(q.w - 1) < 1e-3; }) ? null : prof; }
  H.vwidth = {
    down: function (e, s, p, touch, dbl) {
      var cands = editLeaves().filter(function (n) { var it = n.type === 'path' && itemOf(n.app, 's', false); return it && it.p && it.w > 0; }), best = null, r = touch ? 14 : 8;
      // (an existing width point?)
      cands.forEach(function (n) { var it = itemOf(n.app, 's', false); (it.prof || []).forEach(function (q, i) { var at = pointAtFrac(n.d[0], q.t), nrm = v2(-at.tan.y, at.tan.x), hw = it.w / 2 * q.w; [v2(at.x + nrm.x * hw, at.y + nrm.y * hw), v2(at.x - nrm.x * hw, at.y - nrm.y * hw), at].forEach(function (pt) { var dd = dist(toScreen(pt), s); if (dd <= r && (!best || dd < best.d)) best = { n: n, i: i, d: dd }; }); }); });
      if (best && dbl) { var it0 = itemOf(best.n.app, 's', false); record('Remove Width Point'); it0.prof.splice(best.i, 1); it0.prof = plainProf(it0.prof); wpick = -1; changed(); return; }
      if (best) { sel = [best.n.id]; wpick = best.i; drag = { kind: 'wpt', tool: 'vwidth', s0: s, id: best.n.id, i: best.i, alt: e.altKey }; selChanged(); return; }
      var hit = null, fa = null;
      cands.forEach(function (n) { var f = fracAt(n, p), it = itemOf(n.app, 's', false); if (f && f.d <= Math.max(tolDoc(touch), it.w / 2 * profAt(it.prof, f.t) + 2 / view.k) && (!fa || f.d < fa.d)) { fa = f; hit = n; } });
      if (!hit) { H.select.down(e, s, p, touch); return; }
      var it2 = itemOf(hit.app, 's', false);
      drag = { kind: 'wnew', tool: 'vwidth', s0: s, id: hit.id, t: fa.t, si: fa.si }; sel = [hit.id]; asel = {}; selChanged();
      if (!it2.prof) it2.prof = null;
    },
    move: function (e, s, p) {
      var d = drag; if (d.kind !== 'wpt' && d.kind !== 'wnew') { H.select.move(e, s, p); return; }
      begin(d, 'Width');
      var n = byId(d.id), it = itemOf(n.app, 's', false);
      if (d.kind === 'wnew') { var prof = it.prof ? it.prof.slice() : [{ t: 0, w: 1 }, { t: 1, w: 1 }]; prof.push({ t: d.t, w: profAt(it.prof, d.t) }); prof.sort(function (a, b) { return a.t - b.t; }); it.prof = prof; d.i = prof.map(function (q) { return q.t; }).indexOf(d.t); d.kind = 'wpt'; wpick = d.i; }
      var q = it.prof[d.i], at = pointAtFrac(n.d[0], q.t);
      if (d.alt) { var f = fracAt({ d: [n.d[0]] }, p); if (f) { q.t = Math.max(0, Math.min(1, f.t)); it.prof.sort(function (a, b) { return a.t - b.t; }); d.i = it.prof.indexOf(q); wpick = d.i; } }
      else q.w = Math.max(0, Math.min(40, 2 * dist(p, at) / Math.max(0.01, it.w)));
      renderNode(n); drawUI(); panelSync();
    },
    up: function (e, s, p, touch) { var d = drag; if (d.kind !== 'wpt' && d.kind !== 'wnew') { H.select.up(e, s, p, touch); return; } drag = null; changed(); },
    hover: H.direct.hover
  };

  // ---- DRAWING: freehand lines (Pencil), brush strokes with a width
  // profile (Vector Brush), filled shapes that merge with others like them
  // (Blob Brush), smoothing a path where it's dragged over (Smooth), and
  // rubbing out (Vector Eraser) ----
  function strokePaintNow() { var s = defItem('s'); return s && s.p ? solidOf(s.p) : { t: 'c', c: '#1d1d1f' }; }
  function smoothErr(v) { return (0.6 + v / 100 * 10) / view.k; }
  // (every point the pointer passed, not just the ones the screen showed)
  function evPts(e) { var l = e.getCoalescedEvents ? e.getCoalescedEvents() : []; return l && l.length ? l : [e]; }
  function inkUi(d) { return { d: 'M' + d.spts.map(function (q) { return r2(q.x) + ' ' + r2(q.y); }).join('L'), w: d.tool === 'pencil' ? 1.5 : TS[d.tool].w * view.k, c: d.tool === 'veraser' ? null : d.tool === 'blob' ? blobColour() : (strokePaintNow().c) }; }
  H.pencil = {
    down: function (e, s, p, touch) {
      var end = null;
      if (TS[tool].edit) picked().forEach(function (n) { if (n.type !== 'path' || !editable(n)) return; var h = hitEnd(s, touch, n); if (h && (!end || h.d < end.d)) end = h; });
      drag = { kind: 'draw', tool: tool, s0: s, pts: [p], spts: [s], pr: [e.pressure || 0.5], pen: e.pointerType === 'pen', end: end };
    },
    move: function (e) {
      var d = drag;
      evPts(e).forEach(function (ev) { var s2 = stageXY(ev); d.spts.push(s2); d.pts.push(fromScreen(s2.x, s2.y)); d.pr.push(ev.pressure || 0.5); });
      ui.ink = inkUi(d); drawUI();
    },
    up: function () { var d = drag; drag = null; ui.ink = null; if (!d.moved || d.pts.length < 2) { drawUI(); return; } drawCommit(d); }
  };
  H.vbrush = H.pencil;
  function drawCommit(d) {
    var t = d.tool, S = TS[t], pts = d.pts, close = false, first = pts[0], last = pts[pts.length - 1];
    if (S.close && !d.end && pts.length > 4 && dist(first, last) <= 14 / view.k) close = true;
    var segs = fitCurves(close ? pts.concat([first]) : pts, smoothErr(S.smooth)); if (!segs.length) { drawUI(); return; }
    var sp = { pts: bzPts(segs, close), closed: close }, label = t === 'vbrush' ? 'Brush Stroke' : 'Pencil';
    if (d.end) { // (carrying on a picked path from its end)
      record(label);
      var n = d.end.n, tg = n.d[d.end.si]; unlive(n); if (d.end.end === 'head') reverseSp(tg);
      var tail = tg.pts[tg.pts.length - 1]; tail.ox = sp.pts[0].ox; tail.oy = sp.pts[0].oy; tail.s = isSmooth(tail) ? 1 : 0;
      tg.pts = tg.pts.concat(sp.pts.slice(1));
      if (tg.pts.length > 3 && dist(tg.pts[0], tg.pts[tg.pts.length - 1]) <= 14 / view.k) closeSp(tg);
      sel = [n.id]; asel = {}; changed(); return;
    }
    var app;
    if (t === 'vbrush') app = [{ k: 's', p: strokePaintNow(), o: 1, on: 1, w: S.w, cap: 'round', join: 'round', ml: 10, dash: null, prof: brushProf(sp, d) }];
    else {
      app = clone(doc.def.app); app.forEach(function (it) { if (it.k === 'f' && !S.fill) it.p = null; });
      if (topOf(app, 's') < 0) app.push(clone(defApp()[1]));
      var st = app[topOf(app, 's')]; if (!st.p) st.p = { t: 'c', c: '#1d1d1f' }; if (!(st.w > 0)) st.w = 1; st.on = 1;
    }
    record(label); var n2 = insertNode(newPath([sp], label, app)); sel = [n2.id]; asel = {}; changed();
  }
  // (how wide a brush stroke is along it: the brush's shape, the way it's
  // going for a calligraphic nib, and the Pencil's pressure)
  function brushProf(sp, d) {
    var S = TS.vbrush, M = measure(sp, 0.5); if (M.L <= 0) return null;
    var cum = [0]; for (var i = 1; i < d.pts.length; i++) cum.push(cum[i - 1] + dist(d.pts[i], d.pts[i - 1]));
    var tot = cum[cum.length - 1] || 1, ss = function (v) { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
    var prAt = function (t) {
      if (!d.pen || !S.press) return 1;
      var want = t * tot, j = 1; while (j < cum.length - 1 && cum[j] < want) j++;
      var a = cum[j - 1], b = cum[j], u = b > a ? (want - a) / (b - a) : 0, pr = d.pr[j - 1] + ((d.pr[j] == null ? d.pr[j - 1] : d.pr[j]) - d.pr[j - 1]) * u;
      return 0.15 + 0.85 * Math.max(0, Math.min(1, pr));
    };
    var N = 33, prof = [], an = S.angle * Math.PI / 180, rd = S.round / 100;
    for (var k = 0; k < N; k++) {
      var t = k / (N - 1), w = 1;
      if (S.kind === 'taper') w = Math.pow(Math.sin(Math.PI * t), 0.6);
      else if (S.kind === 'pen') w = ss(t / 0.15) * (1 - 0.85 * ss((t - 0.65) / 0.35));
      else if (S.kind === 'callig') { var q = pointAtDist(M, t * M.L), th = Math.atan2(q.tan.y, q.tan.x); w = rd + (1 - rd) * Math.abs(Math.sin(th - an)); }
      prof.push({ t: t, w: r2(Math.max(0.02, w * prAt(t))) });
    }
    return plainProf(prof);
  }
  // BLOB BRUSH and VECTOR ERASER: what the brush covered, as rings
  function blobColour() { var s = defItem('s'), f = defItem('f'), p = s && s.p ? s.p : f && f.p; return p ? solidOf(p).c : '#1d1d1f'; }
  H.blob = {
    down: function (e, s, p) { drag = { kind: 'ink', tool: tool, s0: s, pts: [p], spts: [s] }; ui.ink = inkUi(drag); drawUI(); },
    move: function (e) { var d = drag; evPts(e).forEach(function (ev) { var s2 = stageXY(ev); d.spts.push(s2); d.pts.push(fromScreen(s2.x, s2.y)); }); ui.ink = inkUi(d); ui.brush = { x: d.spts[d.spts.length - 1].x, y: d.spts[d.spts.length - 1].y, r: TS[d.tool].w * view.k / 2 }; drawUI(); },
    up: function () { var d = drag; drag = null; ui.ink = null; if (d.tool === 'blob') blobCommit(d.pts); else eraseCommit(d.pts); },
    hover: function (s) { ui.brush = { x: s.x, y: s.y, r: TS[tool].w * view.k / 2 }; drawUI(); }
  };
  H.veraser = H.blob;
  function strokeArea(pts, w) {
    var P0 = pts.filter(function (q, i) { return !i || dist(q, pts[i - 1]) > 1e-6; }), b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    P0.forEach(function (q) { b.x0 = Math.min(b.x0, q.x); b.y0 = Math.min(b.y0, q.y); b.x1 = Math.max(b.x1, q.x); b.y1 = Math.max(b.y1, q.y); });
    var bw = b.x1 - b.x0 + w, bh = b.y1 - b.y0 + w, k = Math.min(Math.max(view.k * 2, 20 / Math.max(w, 0.01)), 2400 / Math.max(bw, bh, 1e-6));
    var W = Math.ceil(bw * k) + 6, Hh = Math.ceil(bh * k) + 6, ox = 3 - (b.x0 - w / 2) * k, oy = 3 - (b.y0 - w / 2) * k;
    var c = document.createElement('canvas'); c.width = W; c.height = Hh; var x = c.getContext('2d', { willReadFrequently: true });
    x.setTransform(k, 0, 0, k, ox, oy); x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = x.fillStyle = '#000';
    if (P0.length < 2) { x.beginPath(); x.arc(P0[0].x, P0[0].y, w / 2, 0, Math.PI * 2); x.fill(); }
    else { var segs = fitCurves(P0, 0.5 / view.k); x.beginPath(); x.moveTo(segs[0][0].x, segs[0][0].y); segs.forEach(function (q) { x.bezierCurveTo(q[1].x, q[1].y, q[2].x, q[2].y, q[3].x, q[3].y); }); x.stroke(); }
    var img = x.getImageData(0, 0, W, Hh).data, mask = new Uint8Array(W * Hh);
    for (var i = 0; i < W * Hh; i++) mask[i] = img[i * 4 + 3] > 127 ? 1 : 0;
    var rings = traceMask(mask, W, Hh).filter(function (lp) { return lp.length > 3; }).map(function (lp) {
      return rdp(lp.concat([lp[0]]), 0.6).slice(0, -1).map(function (q) { return { x: (q.x - ox) / k, y: (q.y - oy) / k, b: false, sm: true }; });
    }).filter(function (r) { return r.length >= 3; });
    return { rings: rings, k: k, box: { x0: b.x0 - w / 2, y0: b.y0 - w / 2, x1: b.x1 + w / 2, y1: b.y1 + w / 2 } };
  }
  function boxMeet(b, r) { return !!b && b.x <= r.x1 && b.x + b.w >= r.x0 && b.y <= r.y1 && b.y + b.h >= r.y0; }
  function blobLike(n, col) { var f = n.app.filter(function (it) { return it.on && it.p && (it.k === 'f' || it.w > 0); }); return n.type === 'path' && !n.rule && f.length === 1 && f[0].k === 'f' && f[0].p.t === 'c' && f[0].p.c === col && f[0].o === 1 && (n.opacity == null || n.opacity === 1); }
  function overlapsShape(a, b) { var A = planar([a, b]); return !!A && A.C.some(function (c) { return c.area > 0 && c.mem[0] && c.mem[1]; }); }
  function blobCommit(pts) {
    var col = blobColour(), sa = strokeArea(pts, TS.blob.w); if (!sa.rings.length) return;
    var stroke = { rings: sa.rings, rule: 'n' }, err = Math.max(0.75 / sa.k, 0.05), tol = Math.max(0.02, Math.min(0.25, 0.25 / sa.k));
    var L0 = curLayer(), pool = TS.blob.sel ? targets() : editLeaves().filter(function (n) { return layerOf(n) === L0; });
    var merge = pool.filter(function (n) { return editable(n) && blobLike(n, col) && boxMeet(dBox(n.d), sa.box) && overlapsShape(shapeOf(n, tol), stroke); });
    var rings = boolRings(merge.map(function (n) { return shapeOf(n, tol); }).concat([stroke]), 'union'); if (!rings.length) { drawUI(); return; }
    record('Blob Brush');
    var n = newPath(ringsToD(rings, err), 'Blob', [{ k: 'f', p: { t: 'c', c: col }, o: 1, on: 1 }]); n.opacity = 1; n.blend = 'normal';
    if (merge.length) { insertNode(n, stackOrder(merge).pop()); merge.forEach(function (m) { removeNode(m.id); }); pruneEmpty(); } else insertNode(n);
    sel = [n.id]; asel = {}; changed();
  }
  function eraseCommit(pts) {
    var sa = strokeArea(pts, TS.veraser.w); if (!sa.rings.length) return;
    var er = { rings: sa.rings, rule: 'n', box: sa.box }, err = Math.max(0.75 / sa.k, 0.05), inEr = function (p) { return inShape(er, p); };
    var pool = (picked().length ? targets() : editLeaves()).filter(function (n) { return n.type === 'path' && editable(n) && boxMeet(dBox(n.d), sa.box); });
    var before = snap(), any = false;
    pool.forEach(function (n) {
      var filled = n.app.some(function (it) { return it.k === 'f' && it.on && it.p; }) && n.d.some(function (sp) { return sp.closed; });
      if (filled) {
        var A = planar([shapeOf(n, boolTol([n])), { rings: sa.rings, rule: 'n' }]);
        if (!A || !A.C.some(function (c) { return c.area > 0 && c.mem[0] && c.mem[1]; })) return;
        var rings = arrExtract(A, function (i, c) { return c.mem[0] && !c.mem[1]; }); any = true; unlive(n);
        if (!rings.length) { removeNode(n.id); return; }
        splitRings(rings).forEach(function (rs, k) {
          var d = ringsToD(rs, err);
          if (!k) { n.d = d; delete n.rule; return; }
          var m = newPath(d, n.name, clone(n.app)); m.opacity = n.opacity; m.blend = n.blend; insertNode(m, n);
        });
        return;
      }
      var out = [], cut = false;
      n.d.forEach(function (sp) { var r = cutByArea(sp, inEr, TS.veraser.w / 4); if (r) { cut = true; out = out.concat(r); } else out.push(sp); });
      if (!cut) return;
      any = true; unlive(n); if (out.length) n.d = out; else removeNode(n.id);
    });
    if (any) { hist.push({ s: before, label: 'Erase' }); if (hist.length > HMAX) hist.shift(); fut = []; sel = sel.filter(function (id) { return !!byId(id); }); changed(); }
    else drawUI();
  }
  // (a subpath with the parts inside an area taken out: null if none were,
  // otherwise what's left, cut exactly where it crossed the edge)
  function cutByArea(sp, inF, step) {
    var N = segN(sp); if (!N) return inF(sp.pts[0]) ? [] : null;
    var at = function (g) { var i = Math.min(N - 1, Math.floor(g)); return bez(seg(sp, i), g - i); }, S = [];
    for (var i = 0; i < N; i++) { var s = seg(sp, i), L = dist(s[0], s[1]) + dist(s[1], s[2]) + dist(s[2], s[3]), n = Math.max(2, Math.min(400, Math.ceil(L / Math.max(step, 1e-3)))); for (var k = 0; k < n; k++) S.push({ g: i + k / n, f: inF(bez(s, k / n)) }); }
    S.push({ g: N, f: inF(at(N)) });
    if (!S.some(function (q) { return q.f; })) return null;
    if (S.every(function (q) { return q.f; })) return [];
    var edges = [];
    for (var j = 0; j + 1 < S.length; j++) if (S[j].f !== S[j + 1].f) {
      var lo = S[j].g, hi = S[j + 1].g, fl = S[j].f;
      for (var it = 0; it < 16; it++) { var m = (lo + hi) / 2; if (inF(at(m)) === fl) lo = m; else hi = m; }
      edges.push({ g: (lo + hi) / 2, out: fl });
    }
    var runs = [], st = null;
    if (!sp.closed) {
      st = S[0].f ? null : 0;
      edges.forEach(function (e) { if (e.out) st = e.g; else { if (st != null) runs.push([st, e.g]); st = null; } });
      if (st != null) runs.push([st, N]);
    } else {
      var k0 = -1; edges.forEach(function (e, q) { if (k0 < 0 && e.out) k0 = q; }); if (k0 < 0) return null;
      var E2 = edges.slice(k0).concat(edges.slice(0, k0).map(function (e) { return { g: e.g + N, out: e.out }; }));
      E2.forEach(function (e) { if (e.out) st = e.g; else if (st != null) { runs.push([st, e.g]); st = null; } });
      if (st != null) runs.push([st, E2[0].g + N]);
    }
    return runs.map(function (r) { return subCurve(sp, r[0], r[1]); }).filter(function (q) { return q.pts.length >= 2; });
  }
  // (the piece of a subpath from g0 to g1, where g counts segments)
  function subCurve(sp, g0, g1) {
    var N = segN(sp), segs = [], i = Math.floor(g0);
    while (i < g1 - 1e-9) {
      var a = Math.max(g0, i) - i, b = Math.min(g1, i + 1) - i, s = seg(sp, ((i % N) + N) % N);
      if (b - a > 1e-6) {
        if (straight(s)) { var A = lerp(s[0], s[3], a), Bp = lerp(s[0], s[3], b); segs.push([A, A, Bp, Bp]); }
        else { var q = s; if (a > 0) q = splitBez(q, a)[1]; var bb = a > 0 ? (b - a) / (1 - a) : b; if (bb < 1 - 1e-9) q = splitBez(q, bb)[0]; segs.push(q.map(function (p) { return v2(p.x, p.y); })); }
      }
      i++;
    }
    return { pts: bzPts(segs, false), closed: false };
  }
  // SMOOTH: the anchors near the pointer fitted again, a little smoother each pass
  H.smooth = {
    down: function (e, s, p, touch) {
      var list = targets().filter(function (n) { return n.type === 'path'; });
      if (!list.length) { var h = hitLeaf(p, tolDoc(touch)); if (h && h.type === 'path' && editable(h)) { list = [h]; sel = [h.id]; asel = {}; selChanged(); } }
      if (!list.length) { H.select.down(e, s, p, touch); return; }
      drag = { kind: 'smooth', tool: 'smooth', s0: s, ids: list.map(function (n) { return n.id; }), last: null };
    },
    move: function (e, s, p) {
      var d = drag; if (d.kind !== 'smooth') { H.select.move(e, s, p); return; }
      ui.brush = { x: s.x, y: s.y, r: TS.smooth.r };
      if (d.last && dist(s, d.last) < TS.smooth.r / 3) { drawUI(); return; }
      d.last = s; var hit = false;
      d.ids.forEach(function (id) { var n = byId(id); if (n && smoothAt(n, p, TS.smooth.r / view.k, d)) hit = true; });
      if (hit) renderSome(d.ids.map(byId).filter(Boolean));
      drawUI();
    },
    up: function (e, s, p, touch) { var d = drag; if (d.kind !== 'smooth') { H.select.up(e, s, p, touch); return; } drag = null; changed(); },
    hover: function (s) { ui.brush = { x: s.x, y: s.y, r: TS.smooth.r }; drawUI(); }
  };
  function smoothAt(n, p, r, d) {
    var did = false;
    n.d.forEach(function (sp) {
      var N = sp.pts.length; if (N < 3) return;
      var best = -1, bd = r;
      sp.pts.forEach(function (q, i) { if (!sp.closed && (i === 0 || i === N - 1)) return; var dd = dist(q, p); if (dd <= bd) { bd = dd; best = i; } });
      if (best < 0) return;
      begin(d, 'Smooth'); unlive(n);
      if (sp.closed && best !== 1) { var sh = (best - 1 + N) % N; sp.pts = sp.pts.slice(sh).concat(sp.pts.slice(0, sh)); best = 1; }
      var a = best, b = best;
      while (a - 1 >= 1 && dist(sp.pts[a - 1], p) <= r) a--;
      while (b + 1 <= N - 2 && dist(sp.pts[b + 1], p) <= r) b++;
      var prev = sp.pts[a - 1], next = sp.pts[b + 1], samp = [];
      for (var k = a - 1; k <= b; k++) { var sg = seg(sp, k); for (var j = k === a - 1 ? 0 : 1; j <= 8; j++) samp.push(bez(sg, j / 8)); }
      var passes = 2 + Math.round(TS.smooth.str / 5);
      for (var ps = 0; ps < passes; ps++) samp = samp.map(function (q, i) { return i === 0 || i === samp.length - 1 ? q : { x: (samp[i - 1].x + 2 * q.x + samp[i + 1].x) / 4, y: (samp[i - 1].y + 2 * q.y + samp[i + 1].y) / 4 }; });
      var tl = hasOut(prev) ? vnorm(v2(prev.ox - prev.x, prev.oy - prev.y)) : null, tr = hasIn(next) ? vnorm(v2(next.ix - next.x, next.iy - next.y)) : null;
      var segs = fitCurves(samp, (0.5 + TS.smooth.str / 100 * 6) / view.k, tl, tr); if (!segs.length) return;
      var np = bzPts(segs, false);
      prev.ox = np[0].ox; prev.oy = np[0].oy; next.ix = np[np.length - 1].ix; next.iy = np[np.length - 1].iy;
      prev.a = next.a = 0; prev.s = isSmooth(prev) ? 1 : 0; next.s = isSmooth(next) ? 1 : 0;
      var mid = np.slice(1, -1); mid.forEach(function (q) { q.s = isSmooth(q) ? 1 : 0; });
      sp.pts.splice.apply(sp.pts, [a, b - a + 1].concat(mid));
      did = true;
    });
    return did;
  }

  // ---- SHAPE OPERATIONS on the artboard ----
  function stackOrder(list) { var order = []; walk(doc.layers, function (n) { if (list.indexOf(n) >= 0) order.push(n); }); return order; }
  function shapePaths() { var out = []; picked().filter(editable).forEach(function (n) { leaves(n).forEach(function (q) { if (q.type === 'path' && editable(q) && q.d.some(function (sp) { return sp.pts.length >= 2; }) && out.indexOf(q) < 0) out.push(q); }); }); return stackOrder(out); }
  function lastTrue(m) { for (var i = m.length - 1; i >= 0; i--) if (m[i]) return i; return -1; }
  // (groups left empty go; a clipping group with nothing to clip is a plain group again)
  function pruneEmpty() {
    (function go(list) { for (var i = list.length - 1; i >= 0; i--) { var n = list[i]; if (!isCont(n)) continue; go(n.items); if (n.type === 'group' && !n.items.length) list.splice(i, 1); else if (n.clip && n.items.length < 2) delete n.clip; } })(doc.layers);
  }
  function faceRings(A, f) { return [A.C[f.c]].concat(f.holes.map(function (h) { return A.C[h]; })).map(function (c) { return despike(c.h.map(function (h) { return A.V[h.o]; })); }).filter(function (r) { return r.length >= 3; }); }
  var OP_NAMES = { union: 'Union', minus: 'Subtract', intersect: 'Intersect', exclude: 'Exclude', divide: 'Divide' };
  function pathfinder(op) {
    var paths = shapePaths();
    if (paths.length < 2) { B.toast(paths.length ? OP_NAMES[op] + ' needs two or more shapes: pick another' : 'Pick two or more shapes first'); return; }
    var tol = boolTol(paths), err = Math.max(0.05, tol * 2), shapes = paths.map(function (n) { return shapeOf(n, tol); }), out = [];
    if (op === 'divide') {
      var A = planar(shapes); if (!A) return;
      arrFaces(A).forEach(function (f) { var top = lastTrue(f.mem); if (top < 0) return; var d = ringsToD(faceRings(A, f), err); if (d.length) out.push({ d: d, src: top }); });
    } else {
      var rings = boolRings(shapes, op);
      if (rings.length) out.push({ d: ringsToD(rings, err), src: op === 'minus' ? 0 : paths.length - 1 });
    }
    if (!out.length || !out[0].d.length) { B.toast(op === 'intersect' ? 'They don’t overlap, so nothing would be left' : 'Nothing would be left'); return; }
    record(OP_NAMES[op]);
    var made = out.map(function (o) { var s = paths[o.src], n = newPath(o.d, s.name, clone(s.app)); n.opacity = s.opacity; n.blend = s.blend; return n; });
    var node = made.length === 1 ? made[0] : { id: uid('g'), type: 'group', name: 'Divided', items: made, opacity: 1, blend: 'normal', visible: true, locked: false, open: false };
    insertNode(node, paths[paths.length - 1]); paths.forEach(function (n) { removeNode(n.id); }); pruneEmpty();
    sel = [node.id]; asel = {}; changed();
  }
  // SHAPE BUILDER: drag across the parts of the picked shapes to join them;
  // with Alt (or Delete in its settings) to take them away. A tap keeps
  // just that part as a shape of its own
  var bld = null;
  function bldPrep() {
    var paths = shapePaths(), key = paths.map(function (n) { return n.id; }).join(',') + '|' + ver;
    if (bld && bld.key === key) return bld;
    bld = null; if (!paths.length) return null;
    var tol = boolTol(paths), A = planar(paths.map(function (n) { return shapeOf(n, tol); })); if (!A) return null;
    var F = [];
    arrFaces(A).forEach(function (f, i) { if (f.mem.some(Boolean)) F.push({ i: i, f: f, poly: A.C[f.c].poly, holes: f.holes.map(function (h) { return A.C[h].poly; }) }); });
    bld = { key: key, A: A, F: F, paths: paths, tol: tol }; return bld;
  }
  function bldFaceAt(p) {
    var b = bldPrep(); if (!b) return -1;
    for (var k = 0; k < b.F.length; k++) { var o = b.F[k]; if (inPoly(o.poly, p) && !o.holes.some(function (h) { return inPoly(h, p); })) return k; }
    return -1;
  }
  H.builder = {
    down: function (e, s, p, touch) {
      var k = sel.length ? bldFaceAt(p) : -1;
      if (k < 0) { H.select.down(e, s, p, touch); return; }
      drag = { kind: 'build', tool: 'builder', s0: s, faces: [k], line: [s], del: e.altKey || TS.builder.mode === 'erase' }; ui.build = drag; drawUI();
    },
    move: function (e, s, p) {
      var d = drag; if (d.kind !== 'build') { H.select.move(e, s, p); return; }
      d.line.push(s); var k = bldFaceAt(p); if (k >= 0 && d.faces.indexOf(k) < 0) d.faces.push(k); drawUI();
    },
    up: function (e, s, p, touch) { var d = drag; if (d.kind !== 'build') { H.select.up(e, s, p, touch); return; } drag = null; ui.build = null; buildApply(d.faces, d.del); },
    hover: function (s, p, touch) { var k = sel.length ? bldFaceAt(p) : -1; if (k !== ui.bface) { ui.bface = k; drawUI(); } if (k < 0) H.select.hover(s, p, touch); }
  };
  function buildApply(ks, del) {
    var b = bldPrep(); if (!b || !ks.length) { drawUI(); return; }
    var A = b.A, err = Math.max(0.05, b.tol * 2), pick = {}, out = [];
    ks.forEach(function (k) { pick[b.F[k].i] = 1; });
    if (!del) out.push({ d: ringsToD(arrExtract(A, function (i, c) { return c.face >= 0 && pick[c.face]; }), err), src: lastTrue(b.F[ks[0]].f.mem), merged: true });
    b.F.forEach(function (o) { if (pick[o.i]) return; var d = ringsToD(faceRings(A, o.f), err); if (d.length) out.push({ d: d, src: lastTrue(o.f.mem) }); });
    record(del ? 'Shape Builder: Take Away' : 'Shape Builder');
    var top = b.paths[b.paths.length - 1], ids = [];
    out.forEach(function (o) {
      if (!o.d.length) return;
      var s = b.paths[o.src], n = newPath(o.d, s.name, clone(s.app)); n.opacity = s.opacity; n.blend = s.blend;
      if (o.merged && TS.builder.col === 'fill') { var f = itemOf(n.app, 'f', true), df = defItem('f'); f.p = clone(df && df.p) || f.p; f.on = 1; }
      insertNode(n, top); ids.push(n.id);
    });
    b.paths.forEach(function (n) { removeNode(n.id); }); pruneEmpty();
    sel = ids; asel = {}; bld = null; changed();
  }
  // COMPOUND PATH and CLIPPING MASK: made from what's picked, or released
  function compoundToggle() {
    var l = picked().filter(editable);
    if (l.length && l.every(function (n) { return n.type === 'path' && n.d.length > 1; }) && (l.length === 1 || l.every(function (n) { return n.rule === 'evenodd'; }))) {
      record('Release Compound Path'); var ids = [];
      l.forEach(function (n) {
        var w = where(n.id), parts = n.d.map(function (sp) { var m = newPath([sp], n.name, clone(n.app)); m.opacity = n.opacity; m.blend = n.blend; return m; });
        w.list.splice.apply(w.list, [w.i, 1].concat(parts)); ids = ids.concat(parts.map(function (m) { return m.id; }));
      });
      sel = ids; asel = {}; changed(); return;
    }
    var paths = shapePaths(); if (paths.length < 2) { B.toast('Pick two or more paths to make a compound path (or one to release)'); return; }
    record('Make Compound Path');
    var base = paths[0], n2 = newPath([].concat.apply([], paths.map(function (q) { return dCopy(q.d); })), 'Compound Path', clone(base.app));
    n2.rule = 'evenodd'; n2.opacity = base.opacity; n2.blend = base.blend;
    insertNode(n2, paths[paths.length - 1]); paths.forEach(function (q) { removeNode(q.id); }); pruneEmpty();
    sel = [n2.id]; asel = {}; changed();
  }
  function groupNodes(order, name) {
    var top = order[order.length - 1], w = where(top.id), g = { id: uid('g'), type: 'group', name: name, items: [], opacity: 1, blend: 'normal', visible: true, locked: false, open: false };
    w.list.splice(w.i + 1, 0, g);
    order.forEach(function (n) { var q = where(n.id); q.list.splice(q.i, 1); g.items.push(n); });
    return g;
  }
  function clipToggle() {
    var l = picked().filter(editable);
    if (l.length === 1 && l[0].type === 'group' && l[0].clip) {
      record('Release Clipping Mask'); var g = l[0], w = where(g.id);
      w.list.splice.apply(w.list, [w.i, 1].concat(g.items)); sel = g.items.map(function (q) { return q.id; }); asel = {}; changed(); return;
    }
    if (l.length < 2) { B.toast('Pick the shape to clip with (on top) and what it clips, together'); return; }
    var order = stackOrder(l), top = order[order.length - 1];
    if (top.type !== 'path') { B.toast('The object on top does the clipping, so it has to be a path'); return; }
    record('Make Clipping Mask'); var g2 = groupNodes(order, 'Clip Group'); g2.clip = true; sel = [g2.id]; asel = {}; changed();
  }
  function groupToggle() { var l = picked().filter(editable); if (!l.length) { B.toast('Pick something first'); return; } if (l.every(function (n) { return n.type === 'group'; })) ungroup(); else group(); }

  // ---- TRANSFORM: Free Transform (handles to size, slant and turn), Move,
  // Scale, Rotate, Reflect and Shear (a tap sets the point they work from,
  // tref, otherwise the reference point picked in the panel), and Distort
  // (each corner on its own, a projective map) ----
  var XF = { ftrans: 1, move: 1, scale: 1, rotate: 1, reflect: 1, shear: 1, distort: 1 }, tref = null, dq = null;
  var ROTC = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><g fill="none" stroke-linecap="round"><path d="M6 15A7 7 0 0 1 16.5 7" stroke="#fff" stroke-width="4"/><path d="M6 15A7 7 0 0 1 16.5 7" stroke="#000" stroke-width="1.6"/></g><path d="M13.5 3.5l5 3.2-4.6 3.6z" stroke="#fff" stroke-width="1"/><path d="M2.5 13.5l3.6 4.4 3.3-4.6z" stroke="#fff" stroke-width="1"/></svg>') + '") 12 12, alias';
  function selKey() { return sel.join(','); }
  function xfList() { return picked().filter(editable); }
  function xfOrigin() {
    var b = pickBox(); if (!b) return null;
    if (tref && tref.key === selKey()) return v2(tref.x, tref.y);
    var r = TS.xf.ref, fx = /w/.test(r) ? 0 : /e/.test(r) ? 1 : 0.5, fy = /^n/.test(r) ? 0 : /^s/.test(r) ? 1 : 0.5;
    return v2(b.x + b.w * fx, b.y + b.h * fy);
  }
  // (with Scale Strokes on, strokes and words grow and shrink with the rest)
  function xformS(n, m) {
    xform(n, m);
    if (!TS.xf.strokes) return;
    var k = Math.sqrt(Math.abs(mDet(m))); if (Math.abs(k - 1) < 1e-9) return;
    leaves(n).forEach(function (q) { if (q.app) q.app.forEach(function (it) { if (it.k === 's') it.w = Math.min(2000, it.w * k); }); });
  }
  function xfApply(M, label, copy) {
    var list = xfList(); if (!list.length) { B.toast('Pick something to transform first'); return; }
    record(copy ? label + ' Copy' : label);
    if (copy) list = list.map(function (n) { var c = fresh(n); insertNode(c, n); return c; });
    list.forEach(function (n) { xformS(n, M); });
    sel = list.map(function (n) { return n.id; }); asel = {}; if (tref) tref.key = selKey(); changed();
  }
  function xfStart(kind, s, p, extra) {
    var list = xfList(), d = { kind: kind, tool: tool, s0: s, p0: p, ids: list.map(function (n) { return n.id; }), orig: list.map(clone), b: pickBox() };
    Object.keys(extra || {}).forEach(function (k) { d[k] = extra[k]; });
    drag = d;
  }
  function xfShow(d, M, label) {
    if (!d.rec) {
      begin(d, d.alt ? label + ' Copy' : label);
      if (d.alt) { d.ids = d.ids.map(function (id, i) { var c = fresh(d.orig[i]); insertNode(c, byId(id)); return c.id; }); d.orig = d.ids.map(function (id) { return clone(byId(id)); }); sel = d.ids.slice(); renderArt(); }
    }
    d.ids.forEach(function (id, i) { var n = replaceNode(id, clone(d.orig[i])); xformS(n, M); });
    renderSome(d.ids.map(byId)); drawUI(); panelSync();
  }
  function xfMove(e, s, p) {
    var d = drag, M = null, label = 'Transform', sn = function (a, st) { return e.shiftKey ? Math.round(a / st) * st : a; };
    if (!d) return false;
    if (d.kind === 'rot') { M = mRot(sn(Math.atan2(p.y - d.c.y, p.x - d.c.x) - d.a0, Math.PI / 12), d.c); label = 'Rotate'; }
    else if (d.kind === 'scale') { var xq = snapPt(p, d.ids, e.pointerType !== 'mouse'); ui.snapMk = xq.mk; M = scaleMat(d.b, d.h, v2(xq.x, xq.y), e.shiftKey, e.altKey); label = 'Size'; }
    else if (d.kind === 'shear') {
      var b = d.b, h = d.h;
      if (h === 'n' || h === 's') { var oy = e.altKey ? b.y + b.h / 2 : h === 'n' ? b.y + b.h : b.y, hy = h === 'n' ? b.y : b.y + b.h; M = mShear((p.x - d.p0.x) / ((hy - oy) || 1), 0, v2(0, oy)); }
      else { var ox = e.altKey ? b.x + b.w / 2 : h === 'w' ? b.x + b.w : b.x, hx = h === 'w' ? b.x : b.x + b.w; M = mShear(0, (p.y - d.p0.y) / ((hx - ox) || 1), v2(ox, 0)); }
      label = 'Shear';
    }
    else if (d.kind === 'xm') { var dx = p.x - d.p0.x, dy = p.y - d.p0.y; if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; } var xsn = snapBox(d.b, dx, dy, d.ids); dx = xsn.dx; dy = xsn.dy; M = [1, 0, 0, 1, dx, dy]; d.dx = dx; d.dy = dy; label = 'Move'; }
    else if (d.kind === 'xs') {
      var o = d.o, ux = d.p0.x - o.x, uy = d.p0.y - o.y, sx = Math.abs(ux) > 2 / view.k ? (p.x - o.x) / ux : 1, sy = Math.abs(uy) > 2 / view.k ? (p.y - o.y) / uy : 1;
      if (e.shiftKey || TS.scale.uni) { var k = dist(p, o) / Math.max(1e-6, dist(d.p0, o)); if (vdot(vsub(p, o), vsub(d.p0, o)) < 0) k = -k; sx = sy = k; }
      M = mScale(sx, sy, o); d.sx = sx; d.sy = sy; label = 'Scale';
    }
    else if (d.kind === 'xr') { var a2 = sn(Math.atan2(p.y - d.o.y, p.x - d.o.x) - Math.atan2(d.p0.y - d.o.y, d.p0.x - d.o.x), Math.PI / 4); M = mRot(a2, d.o); d.a = a2; label = 'Rotate'; }
    else if (d.kind === 'xrefl') { var ax = sn(Math.atan2(p.y - d.o.y, p.x - d.o.x), Math.PI / 4); M = mRefl(ax, d.o); d.ax = ax; label = 'Reflect'; }
    else if (d.kind === 'xsh') {
      var ddx = p.x - d.p0.x, ddy = p.y - d.p0.y, b2 = d.b;
      if (Math.abs(ddx) >= Math.abs(ddy)) { var hy2 = d.p0.y - d.o.y; if (Math.abs(hy2) < 2 / view.k) hy2 = b2.h / 2 || 1; M = mShear(ddx / hy2, 0, d.o); d.sh = ['h', Math.atan(ddx / hy2)]; }
      else { var hx2 = d.p0.x - d.o.x; if (Math.abs(hx2) < 2 / view.k) hx2 = b2.w / 2 || 1; M = mShear(0, ddy / hx2, d.o); d.sh = ['v', Math.atan(ddy / hx2)]; }
      label = 'Shear';
    }
    else if (d.kind === 'dq') { distortMove(d, p); return true; }
    else return false;
    xfShow(d, M, label); return true;
  }
  function xfUp(e, s, p) {
    var d = drag; if (!d || !/^(rot|scale|shear|xm|xs|xr|xrefl|xsh|dq)$/.test(d.kind)) return false;
    drag = null;
    if (!d.moved) {
      if (/^(xs|xr|xrefl|xsh)$/.test(d.kind)) tref = { x: p.x, y: p.y, key: selKey() };
      else if (d.kind === 'xm' && !d.hit) setSel([]);
      drawUI(); panelSync(); return true;
    }
    var deg = function (a) { return Math.round(a * 180 / Math.PI * 100) / 100; };
    if (d.kind === 'xm') { TS.move.dx = r2(d.dx); TS.move.dy = r2(d.dy); }
    if (d.kind === 'xs') { TS.scale.u = TS.scale.h = Math.round(d.sx * 100); TS.scale.v = Math.round(d.sy * 100); if (TS.scale.uni) TS.scale.v = TS.scale.h; }
    if (d.kind === 'xr') TS.rotate.a = deg(d.a);
    if (d.kind === 'xrefl') { TS.reflect.axis = 'a'; TS.reflect.a = deg(d.ax); }
    if (d.kind === 'xsh') { TS.shear.axis = d.sh[0]; TS.shear.a = deg(d.sh[1]); }
    tsSave();
    if (tref) tref.key = selKey();
    if (d.kind === 'dq') { dq.key = selKey(); dq.ver = ver + 1; } // (the corners stay where they were pulled to, through the redraw)
    changed();
    return true;
  }
  function xfTool(kind) {
    return {
      down: function (e, s, p, touch) {
        if (!xfList().length) { H.select.down(e, s, p, touch); return; }
        var hit = hitLeaf(p, tolDoc(touch));
        if (kind === 'xm' && hit && sel.indexOf(topPick(hit).id) < 0) { if (e.shiftKey) setSel(sel.concat(topPick(hit).id)); else setSel([topPick(hit).id]); }
        xfStart(kind, s, p, { o: xfOrigin(), alt: e.altKey, hit: !!hit });
      },
      move: function (e, s, p) { if (!xfMove(e, s, p)) H.select.move(e, s, p); },
      up: function (e, s, p, touch) { if (!xfUp(e, s, p)) H.select.up(e, s, p, touch); },
      hover: H.select.hover
    };
  }
  H.move = xfTool('xm'); H.scale = xfTool('xs'); H.rotate = xfTool('xr'); H.reflect = xfTool('xrefl'); H.shear = xfTool('xsh');
  // (just outside a corner of what's picked: there, a drag turns it)
  function rotZone(s, touch) {
    var b = pickBox(); if (!b) return false;
    var hp = handlePts(b), q = quad(b), lo = touch ? 12 : 6, hi = touch ? 36 : 22;
    return ['nw', 'ne', 'se', 'sw'].some(function (k) { var dd = dist(s, hp[k]); return dd > lo && dd < hi && !inPoly(q, s); });
  }
  function knobPt(b) { var hp = handlePts(b), c = toScreen(v2(b.x + b.w / 2, b.y + b.h / 2)), u = vsub(hp.n, c), L = Math.hypot(u.x, u.y); u = L > 1e-6 ? vmul(u, 1 / L) : v2(0, -1); return vadd(hp.n, vmul(u, 26)); }
  H.ftrans = {
    down: function (e, s, p, touch) {
      var b = pickBox();
      if (b) {
        var c = v2(b.x + b.w / 2, b.y + b.h / 2);
        if (dist(s, knobPt(b)) <= (touch ? 16 : 9) || rotZone(s, touch)) { xfStart('rot', s, p, { c: c, a0: Math.atan2(p.y - c.y, p.x - c.x) }); return; }
        var h = hitBoxHandle(s, touch);
        if (h) { var sh = h.length === 1 && ((TS.ftrans.side === 'shear') !== !!(e.ctrlKey || e.metaKey)); xfStart(sh ? 'shear' : 'scale', s, p, { h: h }); return; }
      }
      H.select.down(e, s, p, touch);
    },
    move: function (e, s, p) { if (!xfMove(e, s, p)) H.select.move(e, s, p); },
    up: function (e, s, p, touch) { if (!xfUp(e, s, p)) H.select.up(e, s, p, touch); },
    hover: H.select.hover
  };
  function dqNow() {
    var k = selKey();
    if (!dq || dq.key !== k || dq.ver !== ver) { var b = pickBox(); dq = { key: k, ver: ver, q: b ? [v2(b.x, b.y), v2(b.x + b.w, b.y), v2(b.x + b.w, b.y + b.h), v2(b.x, b.y + b.h)] : [] }; }
    return dq.q;
  }
  function quadConvex(q) { var sg = 0; for (var i = 0; i < 4; i++) { var a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4], cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x); if (Math.abs(cr) < 1e-9) return false; if (!sg) sg = cr > 0 ? 1 : -1; else if ((cr > 0 ? 1 : -1) !== sg) return false; } return true; }
  H.distort = {
    down: function (e, s, p, touch) {
      var list = xfList(); if (!list.length) { H.select.down(e, s, p, touch); return; }
      var q = dqNow(), r = touch ? 16 : 9, i = -1; q.forEach(function (c, k) { if (dist(toScreen(c), s) <= r) i = k; });
      if (i < 0) { H.select.down(e, s, p, touch); return; }
      if (list.some(function (n) { return leaves(n).some(function (l) { return l.type !== 'path'; }); })) B.toast('Only paths distort: pictures and text stay as they are (Convert to Outlines first, for text)');
      xfStart('dq', s, p, { i: i, q0: q.map(function (c) { return v2(c.x, c.y); }) });
    },
    move: function (e, s, p) { if (!xfMove(e, s, p)) H.select.move(e, s, p); },
    up: function (e, s, p, touch) { if (!xfUp(e, s, p)) H.select.up(e, s, p, touch); },
    hover: H.select.hover
  };
  function distortMove(d, p) {
    var q = d.q0.map(function (c) { return v2(c.x, c.y); }); q[d.i] = v2(p.x, p.y);
    if (!quadConvex(q)) return;
    var Hm = homog(d.q0, q); if (!Hm) return;
    begin(d, 'Distort');
    d.ids.forEach(function (id, k) {
      var n = replaceNode(id, clone(d.orig[k]));
      leaves(n).forEach(function (l) { if (l.type !== 'path') return; unlive(l); l.d.forEach(function (sp) { sp.pts.forEach(function (pt) { var a = hmap(Hm, pt), i2 = hmap(Hm, v2(pt.ix, pt.iy)), o2 = hmap(Hm, v2(pt.ox, pt.oy)); pt.x = a.x; pt.y = a.y; pt.ix = i2.x; pt.iy = i2.y; pt.ox = o2.x; pt.oy = o2.y; }); }); });
    });
    dq.q = q; renderSome(d.ids.map(byId)); drawUI();
  }

  // ---- ALIGN AND ARRANGE: to what's picked, a key object (tap one of the
  // picked to make it the key), or the artboard ----
  var ALIGNT = { align: 1, distribute: 1, dspace: 1 }, keyId = null;
  function keyObj() { var l = xfList(); if (keyId && sel.indexOf(keyId) >= 0 && byId(keyId)) return byId(keyId); return l[l.length - 1] || null; }
  function alignRef(list) {
    if (TS.align.to === 'board' || list.length === 1) { var A = AB(); return { x: A.x, y: A.y, w: A.w, h: A.h }; }
    if (TS.align.to === 'key') { var k = keyObj(); return k ? nodeBox(k) : boxOf(list); }
    return boxOf(list);
  }
  var AL = { l: [0, 'x'], hc: [0.5, 'x'], r: [1, 'x'], t: [0, 'y'], vc: [0.5, 'y'], b: [1, 'y'] };
  function edgeOf(b, how) { var a = AL[how]; return a[1] === 'x' ? b.x + b.w * a[0] : b.y + b.h * a[0]; }
  function alignDo(how) {
    var list = xfList(); if (!list.length) { B.toast('Pick what to align first'); return; }
    var ref = alignRef(list), key = TS.align.to === 'key' && list.length > 1 ? keyObj() : null, a = AL[how];
    record('Align');
    list.forEach(function (n) { if (n === key) return; var b = nodeBox(n); if (!b) return; var v = edgeOf(ref, how) - edgeOf(b, how); if (Math.abs(v) > 1e-9) xform(n, a[1] === 'x' ? [1, 0, 0, 1, v, 0] : [1, 0, 0, 1, 0, v]); });
    changed();
  }
  function distDo(how) {
    var list = xfList(), board = TS.align.to === 'board';
    if (list.length < (board ? 2 : 3)) { B.toast(board ? 'Pick two or more to spread across the artboard' : 'Pick three or more to spread out'); return; }
    var a = AL[how], items = list.map(function (n) { return { n: n, b: nodeBox(n) }; }).filter(function (q) { return q.b; }).sort(function (p, q) { return edgeOf(p.b, how) - edgeOf(q.b, how); });
    var f = items[0], l = items[items.length - 1], lo = edgeOf(f.b, how), hi = edgeOf(l.b, how);
    if (board) { var A = AB(), o0 = a[1] === 'x' ? A.x : A.y, size = a[1] === 'x' ? A.w : A.h, fw = a[1] === 'x' ? f.b.w : f.b.h, lw = a[1] === 'x' ? l.b.w : l.b.h; lo = o0 + fw * a[0]; hi = o0 + size - lw * (1 - a[0]); }
    record('Distribute');
    items.forEach(function (q, i) { var v = lo + (hi - lo) * i / (items.length - 1) - edgeOf(q.b, how); if (Math.abs(v) > 1e-9) xform(q.n, a[1] === 'x' ? [1, 0, 0, 1, v, 0] : [1, 0, 0, 1, 0, v]); });
    changed();
  }
  function spaceDo(ax) {
    var list = xfList(), board = TS.align.to === 'board', key = TS.align.to === 'key' ? keyObj() : null;
    if (list.length < (board ? 1 : 2) || (!board && !key && list.length < 3)) { B.toast(key ? 'Pick two or more, one of them the key object' : 'Pick three or more to even out the gaps'); return; }
    var X = ax === 'h', pos = function (b) { return X ? b.x : b.y; }, len = function (b) { return X ? b.w : b.h; };
    var items = list.map(function (n) { return { n: n, b: nodeBox(n) }; }).filter(function (q) { return q.b; }).sort(function (p, q) { return pos(p.b) - pos(q.b); });
    var target = [];
    if (key) {
      var ki = items.map(function (q) { return q.n; }).indexOf(key), g = TS.align.gap;
      target[ki] = pos(items[ki].b);
      for (var i = ki + 1; i < items.length; i++) target[i] = target[i - 1] + len(items[i - 1].b) + g;
      for (i = ki - 1; i >= 0; i--) target[i] = target[i + 1] - g - len(items[i].b);
    } else {
      var sum = 0; items.forEach(function (q) { sum += len(q.b); });
      var A2 = AB(), start = board ? (X ? A2.x : A2.y) : pos(items[0].b), end = board ? (X ? A2.x + A2.w : A2.y + A2.h) : pos(items[items.length - 1].b) + len(items[items.length - 1].b), gap = items.length > 1 ? (end - start - sum) / (items.length - 1) : 0;
      if (items.length === 1) { start = start + (end - start - sum) / 2; }
      var at = start; items.forEach(function (q, j) { target[j] = at; at += len(q.b) + gap; });
    }
    record('Distribute Spacing');
    items.forEach(function (q, j) { var v = target[j] - pos(q.b); if (Math.abs(v) > 1e-9) xform(q.n, X ? [1, 0, 0, 1, v, 0] : [1, 0, 0, 1, 0, v]); });
    changed();
  }
  H.align = {
    down: function (e, s, p, touch) { H.select.down(e, s, p, touch); },
    move: function (e, s, p, touch) { H.select.move(e, s, p, touch); },
    up: function (e, s, p, touch) {
      var d = drag;
      if (d && d.kind === 'move' && !d.moved && sel.length > 1 && !e.shiftKey && sel.indexOf(d.top) >= 0) { drag = null; keyId = d.top; drawUI(); panelSync(); if (TS.align.to !== 'key') B.toast('Key object: set Align To to Key Object to line up to it'); return; }
      H.select.up(e, s, p, touch);
    },
    hover: H.select.hover
  };
  H.distribute = H.dspace = H.align;
  // (the tools that are actions: they act on what's picked, and the tool in hand stays)
  var ACTIONS = {
    fit: function () { fit(); }, actual: function () { actualSize(); },
    union: function () { pathfinder('union'); }, minus: function () { pathfinder('minus'); }, intersect: function () { pathfinder('intersect'); }, exclude: function () { pathfinder('exclude'); }, divide: function () { pathfinder('divide'); },
    compound: compoundToggle, clipmask: clipToggle, outlines: function () { outlines(); },
    front: function () { arrangeA(2); }, fwd: function () { arrangeA(1); }, back: function () { arrangeA(-1); }, backmost: function () { arrangeA(-2); }, groupun: groupToggle,
    abdup: function () { dupBoard(); }
  };
  function arrangeA(dir) { if (!xfList().length) { B.toast('Pick something first'); return; } arrange(dir); }
  function runAction(t) { if (te && t !== 'fit' && t !== 'actual') endEdit(); ACTIONS[t](); }

  // ---- TYPOGRAPHY: Text (a tap for point text, a drag for a text box),
  // Area Text (inside a shape), Text on Path, Vertical Text, Character
  // Editing (one letter moved, turned, sized or coloured), and Convert to
  // Outlines. The words are typed into a hidden textarea (ta), so the
  // keyboard, selecting, copying and pasting are the browser's own; te is
  // what's being typed into ----
  var TYPE = { text: 1, areatext: 1, ptext: 1, vtext: 1 }, te = null, ta = null, chs = null;
  function textApp() { var f = defItem('f'), p = f && f.p ? solidOf(f.p) : null; if (!p || p.c === '#ffffff') p = { t: 'c', c: '#1d1d1f' }; return [{ k: 'f', p: p, o: 1, on: 1 }]; }
  function newText(kind, o) {
    var S = TS.type, n = { id: uid('o'), type: 'text', name: 'Text', auto: 1, kind: kind, vert: o.vert ? 1 : 0, txt: '', x: o.x || 0, y: o.y || 0, font: S.font, size: S.size, weight: S.weight, italic: S.italic, lead: S.lead, track: S.track, align: S.align, app: textApp(), opacity: doc.def.op, blend: doc.def.blend, visible: true, locked: false };
    if (o.area) n.area = o.area;
    if (o.pd) { n.pd = o.pd; n.off = o.off || 0; n.flip = 0; }
    return n;
  }
  function rectD(x, y, w, h) { return [{ pts: [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)], closed: true }]; }
  function localOf(n, p) { return n.mt ? mx(mInv(n.mt), p) : p; }
  function docOf(n, p) { return n.mt ? mx(n.mt, p) : p; }
  function textUnder(p, touch) { var h = hitLeaf(p, tolDoc(touch)); return h && h.type === 'text' && editable(h) ? h : null; }
  function wordAt(t, i) { var a = i, b = i, w = /[\wÀ-￿]/; while (a > 0 && w.test(t[a - 1])) a--; while (b < t.length && w.test(t[b])) b++; return [a, b]; }
  function startEdit(n, a, b, isNew) {
    if (te && te.id === n.id) { focusTa(); setRange(a, b); return; }
    endEdit();
    if (!isNew) record('Edit Text');
    te = { id: n.id, orig: n.txt, isNew: !!isNew, h: hist.length };
    ta.value = n.txt; sel = [n.id]; asel = {}; chs = null;
    focusTa(); setRange(a, b); selChanged();
  }
  function setRange(a, b) { try { ta.setSelectionRange(Math.min(a, b), Math.max(a, b), b < a ? 'backward' : 'forward'); } catch (x) {} placeTa(); drawUI(); }
  function focusTa() { placeTa(); try { ta.focus({ preventScroll: true }); } catch (x) {} }
  // (the hidden textarea sits at the caret, so a phone's keyboard and
  // suggestions come up beside the words)
  function placeTa() {
    var n = te && byId(te.id); if (!n || !ta) return;
    var L = textLayout(n), c = L.car[Math.min(ta.selectionEnd || 0, n.txt.length)] || L.car[0] || { x: n.x, y: n.y }, s = toScreen(docOf(n, c));
    ta.style.left = Math.round(Math.max(0, Math.min(stageEl.clientWidth - 4, s.x))) + 'px'; ta.style.top = Math.round(Math.max(0, Math.min(stageEl.clientHeight - 24, s.y - 12))) + 'px';
  }
  function endEdit() {
    if (!te) return;
    var t = te; te = null;
    try { if (document.activeElement === ta) ta.blur(); } catch (x) {}
    var n = byId(t.id); if (!n) { changed(); return; }
    if (!n.txt.replace(/\s/g, '')) {
      // (nothing typed: a new one goes as if it had never been; an old one emptied is deleted, in one step with the typing)
      // (the shape a new area or path text was made from comes back too)
      if (t.isNew && hist.length === t.h) { restore(hist.pop().s); histButtons(); } else removeNode(n.id);
    } else if (!t.isNew && n.txt === t.orig && hist.length === t.h) dropLast();
    if (n.auto && byId(n.id) === n) n.name = n.txt.replace(/\s+/g, ' ').trim().slice(0, 30) || 'Text';
    changed();
  }
  function taInput() {
    if (!te) return; var n = byId(te.id); if (!n) { te = null; return; }
    var old = n.txt, nw = ta.value; if (old === nw) { drawUI(); return; }
    if (n.ch) shiftCh(n, old, nw);
    n.txt = nw; fut = []; histButtons(); renderNode(n); placeTa(); drawUI(); layersRender(); B.autosave();
  }
  // (letters with their own look keep it as words are typed before them)
  function shiftCh(n, a, b) {
    var p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
    var q = 0; while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
    var out = {}, dl = b.length - a.length;
    Object.keys(n.ch).forEach(function (k) { var i = +k; if (i < p) out[i] = n.ch[k]; else if (i >= a.length - q) out[i + dl] = n.ch[k]; });
    if (Object.keys(out).length) n.ch = out; else delete n.ch;
  }
  H.text = {
    down: function (e, s, p, touch, dbl) {
      var ht = textUnder(p, touch);
      if (ht) {
        var i = caretAt(ht, localOf(ht, p));
        if (dbl && te && te.id === ht.id) { var w = wordAt(ht.txt, i); setRange(w[0], w[1]); return; }
        var a0 = e.shiftKey && te && te.id === ht.id ? (ta.selectionDirection === 'backward' ? ta.selectionEnd : ta.selectionStart) : i;
        if (e.pointerType === 'mouse') e.preventDefault();
        startEdit(ht, a0, i, false);
        drag = { kind: 'tsel', tool: tool, s0: s, id: ht.id, a: a0 }; return;
      }
      if (te) endEdit();
      if (tool === 'ptext') {
        var hp = hitLeaf(p, tolDoc(touch));
        if (hp && hp.type === 'path' && editable(hp)) {
          var fa = fracAt(hp, p); if (!fa) return;
          record('Text on Path'); var n = newText('path', { pd: dCopy([hp.d[fa.si]]), off: Math.max(0, Math.min(1, fa.t)) });
          n.opacity = hp.opacity; replaceNode(hp.id, n); if (e.pointerType === 'mouse') e.preventDefault(); startEdit(n, 0, 0, true); return;
        }
        B.toast('Tap a path to put text along it'); return;
      }
      if (tool === 'areatext') {
        var hs = hitLeaf(p, tolDoc(touch));
        if (hs && hs.type === 'path' && editable(hs) && hs.d.some(function (sp) { return sp.closed; }) && inside(hs.d, p, hs.rule)) {
          record('Area Text'); var n2 = newText('area', { area: dCopy(hs.d.filter(function (sp) { return sp.closed; })) });
          replaceNode(hs.id, n2); if (e.pointerType === 'mouse') e.preventDefault(); startEdit(n2, 0, 0, true); return;
        }
      }
      drag = { kind: 'tnew', tool: tool, s0: s, p0: p };
    },
    move: function (e, s, p) {
      var d = drag;
      if (d.kind === 'tsel') { var n = byId(d.id); if (n && te) setRange(d.a, caretAt(n, localOf(n, p))); return; }
      if (d.kind === 'tnew') { ui.marquee = { x0: d.s0.x, y0: d.s0.y, x1: s.x, y1: s.y }; drawUI(); }
    },
    up: function (e, s, p) {
      var d = drag; drag = null; ui.marquee = null;
      if (d.kind === 'tsel') { focusTa(); drawUI(); return; }
      if (d.kind !== 'tnew') return;
      var vert = tool === 'vtext', n, w = Math.abs(p.x - d.p0.x), h = Math.abs(p.y - d.p0.y);
      if (d.moved && w > 6 / view.k && h > 6 / view.k) n = newText('area', { area: rectD(Math.min(p.x, d.p0.x), Math.min(p.y, d.p0.y), w, h), vert: vert });
      else if (tool === 'areatext') n = newText('area', { area: rectD(p.x, p.y, Math.min(AB().w / 2, 260), Math.min(AB().h / 3, 160)) });
      else n = newText('point', { x: p.x, y: p.y, vert: vert });
      record('Text'); insertNode(n); startEdit(n, 0, 0, true);
    },
    hover: function (s, p, touch) { var h = textUnder(p, touch), id = h ? h.id : null; if (id !== ui.hover) { ui.hover = id; drawUI(); } }
  };
  H.areatext = H.ptext = H.vtext = H.text;
  // CHARACTER EDITING: a letter of its own (n.ch[i]: dx, dy, r, s, c)
  function chSet(n, u) { n.ch = n.ch || {}; return n.ch[u] = n.ch[u] || {}; }
  function chClean(n, u) {
    var k = n.ch && n.ch[u]; if (!k) return;
    ['dx', 'dy', 'r'].forEach(function (f) { if (!k[f] || Math.abs(k[f]) < 1e-6) delete k[f]; });
    if (k.s != null && Math.abs(k.s - 1) < 1e-6) delete k.s; if (!k.c) delete k.c;
    if (!Object.keys(k).length) delete n.ch[u]; if (!Object.keys(n.ch).length) delete n.ch;
  }
  function chGlyph() { var n = chs && byId(chs.id); if (!n) return null; var L = textLayout(n), g = L.g.filter(function (q) { return q.u === chs.u; })[0]; return g ? { n: n, g: g, L: L } : null; }
  // (a letter's middle, with a given look of its own)
  function chMid(n, g, L, k) { var keep = n.ch; n.ch = {}; n.ch[g.u] = k; var m = glyphM(n, g); n.ch = keep; return mx(m, v2(g.w / 2, (L.desc - L.asc) / 2)); }
  function chHandles() {
    var c = chGlyph(); if (!c) return null;
    var q = glyphQuad(c.n, c.g, c.L).map(function (p) { return toScreen(docOf(c.n, p)); }), top = v2((q[0].x + q[1].x) / 2, (q[0].y + q[1].y) / 2), bot = v2((q[3].x + q[2].x) / 2, (q[3].y + q[2].y) / 2), u = vnorm(vsub(top, bot));
    return { q: q, knob: vadd(top, vmul(u, 22)), top: top, size: q[1] };
  }
  H.chedit = {
    down: function (e, s, p, touch) {
      var hh = chHandles(), r = touch ? 16 : 9;
      if (hh) {
        var c = chGlyph(), k0 = clone((c.n.ch && c.n.ch[c.g.u]) || {});
        if (dist(s, hh.knob) <= r) { drag = { kind: 'chrot', tool: 'chedit', s0: s, p0: p, id: c.n.id, u: c.g.u, o: k0 }; return; }
        if (dist(s, hh.size) <= r) { drag = { kind: 'chsize', tool: 'chedit', s0: s, p0: p, id: c.n.id, u: c.g.u, o: k0 }; return; }
      }
      var t = textUnder(p, touch);
      if (t) {
        var i = glyphAt(t, localOf(t, p), tolDoc(touch)), g = i >= 0 ? textLayout(t).g[i] : null;
        if (g && !g.sp) { chs = { id: t.id, u: g.u }; sel = [t.id]; asel = {}; selChanged(); drag = { kind: 'chmove', tool: 'chedit', s0: s, p0: p, id: t.id, u: g.u, o: clone((t.ch && t.ch[g.u]) || {}) }; return; }
      }
      chs = null; H.select.down(e, s, p, touch);
    },
    move: function (e, s, p) {
      var d = drag; if (!/^ch/.test(d.kind)) { H.select.move(e, s, p); return; }
      var n = byId(d.id); if (!n) return;
      var L = textLayout(n), g = L.g.filter(function (q) { return q.u === d.u; })[0]; if (!g) return;
      begin(d, 'Character');
      var k = chSet(n, d.u), a = localOf(n, d.p0), b = localOf(n, p);
      Object.keys(k).forEach(function (f) { delete k[f]; }); Object.keys(d.o).forEach(function (f) { k[f] = d.o[f]; });
      if (d.kind === 'chmove') { k.dx = (d.o.dx || 0) + b.x - a.x; k.dy = (d.o.dy || 0) + b.y - a.y; }
      else {
        var C0 = chMid(n, g, L, d.o);
        if (d.kind === 'chrot') { var deg = (d.o.r || 0) + (Math.atan2(b.y - C0.y, b.x - C0.x) - Math.atan2(a.y - C0.y, a.x - C0.x)) * 180 / Math.PI; if (e.shiftKey) deg = Math.round(deg / 15) * 15; k.r = ((deg + 540) % 360) - 180; }
        else k.s = Math.max(0.1, Math.min(20, (d.o.s || 1) * dist(b, C0) / Math.max(1e-6, dist(a, C0))));
        var C1 = chMid(n, g, L, k); k.dx = (k.dx || 0) + C0.x - C1.x; k.dy = (k.dy || 0) + C0.y - C1.y;
      }
      chClean(n, d.u); renderNode(n); drawUI(); panelSync();
    },
    up: function (e, s, p, touch) { var d = drag; if (!/^ch/.test(d.kind)) { H.select.up(e, s, p, touch); return; } drag = null; changed(); },
    hover: function (s, p, touch) {
      var t = textUnder(p, touch), i = t ? glyphAt(t, localOf(t, p), tolDoc(touch)) : -1, h = t && i >= 0 ? { id: t.id, i: i } : null;
      if (JSON.stringify(h) !== JSON.stringify(ui.chover)) { ui.chover = h; drawUI(); }
    }
  };
  // CONVERT TO OUTLINES: each letter drawn big, its edge traced and fitted
  // with curves (kept for each font and letter), then put where the letter is
  var GLY = new Map(), GS = 240;
  function glyphD(n, c) {
    var key = tFont(n, GS) + '|' + c; if (GLY.has(key)) return GLY.get(key);
    var x = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); x.font = tFont(n, GS);
    var m = x.measureText(c), l = Math.ceil(m.actualBoundingBoxLeft || 0) + 4, r = Math.ceil(m.actualBoundingBoxRight || m.width) + 4, a = Math.ceil(m.actualBoundingBoxAscent || GS) + 4, dd = Math.ceil(m.actualBoundingBoxDescent || GS * 0.3) + 4;
    var W = l + r + 2, Hh = a + dd + 2; x.canvas.width = W; x.canvas.height = Hh;
    x.font = tFont(n, GS); x.fillStyle = '#000'; x.textBaseline = 'alphabetic'; x.fillText(c, l + 1, a + 1);
    var img = x.getImageData(0, 0, W, Hh).data, mask = new Uint8Array(W * Hh);
    for (var i = 0; i < W * Hh; i++) mask[i] = img[i * 4 + 3] > 127 ? 1 : 0;
    var d = traceMask(mask, W, Hh).filter(function (lp) { return lp.length > 3; }).map(function (lp) {
      var poly = rdp(lp.concat([lp[0]]), 0.55).slice(0, -1), N = poly.length;
      var R = poly.map(function (q, j) { var A = poly[(j - 1 + N) % N], C = poly[(j + 1) % N], u = vnorm(vsub(q, A)), w = vnorm(vsub(C, q)); return { x: q.x - l - 1, y: q.y - a - 1, b: u.x * w.x + u.y * w.y < 0.6, sm: false }; });
      return ringToSp(R, 0.6);
    }).filter(function (sp) { return sp.pts.length > 2; });
    GLY.set(key, d); return d;
  }
  function outlines() {
    var texts = []; picked().filter(editable).forEach(function (n) { leaves(n).forEach(function (q) { if (q.type === 'text' && editable(q)) texts.push(q); }); });
    if (!texts.length) { B.toast('Pick some text to turn into outlines'); return; }
    if (te) endEdit();
    record('Convert to Outlines'); var ids = [];
    texts.forEach(function (n) {
      var L = textLayout(n), k = n.size / GS, paths = [];
      L.g.forEach(function (g) {
        if (g.sp || g.hid) return; var gd = glyphD(n, g.c); if (!gd.length) return;
        var d = dCopy(gd), m = mMul(glyphM(n, g), [k, 0, 0, k, 0, 0]); if (n.mt) m = mMul(n.mt, m); dXform(d, m);
        var app = clone(n.app), ck = chOf(n, g.u); if (ck && ck.c) app.forEach(function (it) { if (it.k === 'f') it.p = { t: 'c', c: ck.c }; });
        var q = newPath(d, g.c, app); q.opacity = 1; q.blend = 'normal'; paths.push(q);
      });
      var w = where(n.id); if (!w) return;
      if (!paths.length) { w.list.splice(w.i, 1); return; }
      var node = paths.length === 1 ? paths[0] : { id: uid('g'), type: 'group', name: n.name, items: paths, opacity: n.opacity, blend: n.blend, visible: true, locked: false, open: false };
      if (paths.length === 1) { node.name = n.name; node.opacity = n.opacity; node.blend = n.blend; }
      w.list[w.i] = node; ids.push(node.id);
    });
    sel = ids; asel = {}; changed();
  }

  // (what the new tools show on the screen sheet: the point a transform
  // works from, Free Transform's round handle, Distort's corners, the
  // caret and the picked words, a picked letter's handles, Shape Builder's
  // parts, a brush's circle and what's being drawn)
  function pathOutline(d, M, cls) { var dd = dCopy(d); if (M) dXform(dd, M); dXform(dd, vmat()); return '<path class="' + cls + '" d="' + dStr(dd) + '"/>'; }
  function uiExtra() {
    var out = envUi(), list = picked();
    if (XF[tool] && tool !== 'ftrans' && tool !== 'move' && tool !== 'distort' && xfList().length) {
      var o = xfOrigin(); if (o) { var so = toScreen(o); out += '<g class="vs-origin"><circle cx="' + r2(so.x) + '" cy="' + r2(so.y) + '" r="5.5"/><path d="M' + r2(so.x - 10) + ' ' + r2(so.y) + 'h20M' + r2(so.x) + ' ' + r2(so.y - 10) + 'v20"/></g>'; }
    }
    if (tool === 'ftrans') { var b = pickBox(); if (b) { var hp = handlePts(b), kn = knobPt(b); out += '<line class="vs-hline" x1="' + r2(hp.n.x) + '" y1="' + r2(hp.n.y) + '" x2="' + r2(kn.x) + '" y2="' + r2(kn.y) + '"/><circle class="vs-knob" cx="' + r2(kn.x) + '" cy="' + r2(kn.y) + '" r="5"/>'; } }
    if (tool === 'distort' && xfList().length) { var q = dqNow().map(toScreen); if (q.length) out += '<polygon class="vs-bounds" points="' + polyStr(q) + '"/>' + q.map(function (c) { return '<rect class="vs-handle" x="' + r2(c.x - HS) + '" y="' + r2(c.y - HS) + '" width="' + 2 * HS + '" height="' + 2 * HS + '"/>'; }).join(''); }
    if (ALIGNT[tool] && TS.align.to === 'key' && list.length > 1) { var k = keyObj(); if (k) out += outlineOf(k, 'vs-key'); }
    var n = te && byId(te.id);
    if (n) {
      var L = textLayout(n), a = Math.min(ta.selectionStart, ta.selectionEnd), bb = Math.max(ta.selectionStart, ta.selectionEnd), S = function (p) { return toScreen(docOf(n, p)); };
      if (n.kind === 'area' && n.area) out += pathOutline(n.area, n.mt, 'vs-path');
      if (n.kind === 'path' && n.pd) out += pathOutline(n.pd, null, 'vs-path');
      if (a !== bb) L.g.forEach(function (g) { if (g.u >= a && g.u < bb && !g.hid) out += '<polygon class="vs-tsel" points="' + polyStr(glyphQuad(n, g, L).map(S)) + '"/>'; });
      else if (document.activeElement === ta) {
        var c = L.car[Math.min(bb, n.txt.length)];
        if (c) {
          var p1, p2; if (c.v) { p1 = v2(c.x - n.size / 2, c.y); p2 = v2(c.x + n.size / 2, c.y); } else { var sn = Math.sin(c.r), cs = Math.cos(c.r); p1 = v2(c.x + sn * L.asc, c.y - cs * L.asc); p2 = v2(c.x - sn * L.desc, c.y + cs * L.desc); }
          p1 = S(p1); p2 = S(p2); out += '<line class="vs-caret" x1="' + r2(p1.x) + '" y1="' + r2(p1.y) + '" x2="' + r2(p2.x) + '" y2="' + r2(p2.y) + '"/>';
        }
      }
      if (L.over) { var qd = nodeQuad(n).map(toScreen), e2 = qd[2]; out += '<g class="vs-over"><rect x="' + r2(e2.x - 6) + '" y="' + r2(e2.y - 6) + '" width="12" height="12" rx="2"/><path d="M' + r2(e2.x - 3.5) + ' ' + r2(e2.y) + 'h7M' + r2(e2.x) + ' ' + r2(e2.y - 3.5) + 'v7"/></g>'; }
    } else if (TYPE[tool] || tool === 'chedit') {
      list.forEach(function (t) { if (t.type === 'text' && t.kind === 'path' && t.pd) out += pathOutline(t.pd, null, 'vs-path'); });
    }
    if (tool === 'chedit') {
      if (ui.chover) { var hn = byId(ui.chover.id), HL = hn && textLayout(hn), hg = HL && HL.g[ui.chover.i]; if (hg && !(chs && chs.id === hn.id && chs.u === hg.u)) out += '<polygon class="vs-hover" points="' + polyStr(glyphQuad(hn, hg, HL).map(function (p) { return toScreen(docOf(hn, p)); })) + '"/>'; }
      var hh = chHandles();
      if (hh) out += '<polygon class="vs-box" points="' + polyStr(hh.q) + '"/><line class="vs-hline" x1="' + r2(hh.top.x) + '" y1="' + r2(hh.top.y) + '" x2="' + r2(hh.knob.x) + '" y2="' + r2(hh.knob.y) + '"/><circle class="vs-knob" cx="' + r2(hh.knob.x) + '" cy="' + r2(hh.knob.y) + '" r="5"/><rect class="vs-handle" x="' + r2(hh.size.x - HS) + '" y="' + r2(hh.size.y - HS) + '" width="' + 2 * HS + '" height="' + 2 * HS + '"/>';
    }
    var bl3 = tool === 'builder' && sel.length ? bldPrep() : null;
    if (bl3) {
      var faceD = function (o) { return [o.poly].concat(o.holes).map(function (r) { return 'M' + r.map(function (v) { var s = toScreen(v); return r2(s.x) + ' ' + r2(s.y); }).join('L') + 'Z'; }).join(''); };
      bl3.F.forEach(function (o) { out += '<path class="vs-face-edge" d="' + faceD(o) + '"/>'; });
      var on2 = ui.build ? ui.build.faces : ui.bface >= 0 ? [ui.bface] : [];
      on2.forEach(function (k2) { var o = bl3.F[k2]; if (o) out += '<path class="vs-face' + (ui.build && ui.build.del || TS.builder.mode === 'erase' ? ' del' : '') + '" fill-rule="evenodd" d="' + faceD(o) + '"/>'; });
      if (ui.build && ui.build.line.length > 1) out += '<polyline class="vs-bline" points="' + polyStr(ui.build.line) + '"/>';
    }
    if (ui.ink) out += '<path class="vs-ink' + (ui.ink.c ? '' : ' erase') + '" d="' + ui.ink.d + '" style="stroke-width:' + r2(Math.max(1, ui.ink.w)) + 'px' + (ui.ink.c ? ';stroke:' + ui.ink.c : '') + '"/>';
    if (ui.brush && (tool === 'blob' || tool === 'veraser' || tool === 'smooth')) out += '<circle class="vs-brush" cx="' + r2(ui.brush.x) + '" cy="' + r2(ui.brush.y) + '" r="' + r2(Math.max(2, ui.brush.r)) + '"/>';
    return out;
  }

  // ---- ARTBOARDS: doc.boards ({ id, name, x, y, w, h, clear }), in the
  // artwork's own space, which runs on past them (the pasteboard); doc.ab is
  // the active one: Fit, saving and exporting, the rulers and aligning to
  // the artboard all go by it ----
  function AB() {
    var b = null; if (doc && doc.boards) { doc.boards.forEach(function (q) { if (q.id === doc.ab) b = q; }); if (!b) { b = doc.boards[0]; if (b) doc.ab = b.id; } }
    return b || { id: 'B1', name: 'Artboard 1', x: 0, y: 0, w: 1024, h: 768 };
  }
  function boardsBox() { var r = null; doc.boards.forEach(function (b) { if (!r) r = { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h }; else { r.x0 = Math.min(r.x0, b.x); r.y0 = Math.min(r.y0, b.y); r.x1 = Math.max(r.x1, b.x + b.w); r.y1 = Math.max(r.y1, b.y + b.h); } }); return r ? { x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 } : { x: 0, y: 0, w: 1, h: 1 }; }
  function boardAt(p) { var hit = null; doc.boards.forEach(function (b) { if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) hit = b; }); return hit; }
  function boardById(id) { return doc.boards.filter(function (b) { return b.id === id; })[0] || null; }
  function newBoardId() { return 'B' + uid(''); }
  function boardName() { var n = doc.boards.length + 1; while (doc.boards.some(function (b) { return b.name === 'Artboard ' + n; })) n++; return 'Artboard ' + n; }
  // (the next free place for a new board: to the right of them all)
  function boardSlot(w, h) { var U = boardsBox(); return v2(U.x + U.w + 60, AB().y); }
  function setAB(id) { if (doc.ab === id) return; doc.ab = id; if (on) { drawUI(); panelSync(); rulersDraw(); gridDraw(); B.autosave(); } }
  // (the objects that sit on a board: their middle inside it)
  function onBoard(b) { var out = []; doc.layers.forEach(function (L) { walk(L.items, function (n) { if (n.type === 'layer') return; var q = nodeBox(n); if (q && editable(n) && q.x + q.w / 2 >= b.x && q.x + q.w / 2 <= b.x + b.w && q.y + q.h / 2 >= b.y && q.y + q.h / 2 <= b.y + b.h) out.push(n); return false; }); }); return out; }
  function addBoard(x, y, w, h, label) {
    record(label || 'New Artboard');
    var b = { id: newBoardId(), name: boardName(), x: x, y: y, w: Math.max(1, w), h: Math.max(1, h) }; doc.boards.push(b); doc.ab = b.id; sel = []; asel = {};
    changed(); return b;
  }
  function dupBoard() {
    var b = AB(), at = boardSlot(b.w, b.h), dx = at.x - b.x, dy = at.y - b.y, list = onBoard(b);
    record('Duplicate Artboard');
    var nb = { id: newBoardId(), name: b.name + ' copy', x: at.x, y: at.y, w: b.w, h: b.h }; if (b.clear) nb.clear = 1;
    doc.boards.splice(doc.boards.indexOf(b) + 1, 0, nb); doc.ab = nb.id;
    var ids = []; list.forEach(function (n) { var c = fresh(n); xform(c, [1, 0, 0, 1, dx, dy]); insertNode(c, n); ids.push(c.id); });
    sel = ids; asel = {}; changed(); fitBoardView(nb);
  }
  function delBoard(b) {
    b = b || AB(); if (doc.boards.length < 2) { B.toast('A drawing needs one artboard'); return; }
    record('Delete Artboard'); var i = doc.boards.indexOf(b); doc.boards.splice(i, 1); doc.ab = doc.boards[Math.max(0, i - 1)].id; changed();
  }
  // (a board moved: what's on it goes with it, if asked)
  function moveBoard(b, dx, dy, art) { b.x += dx; b.y += dy; if (art) art.forEach(function (n) { xform(n, [1, 0, 0, 1, dx, dy]); }); }
  function fitBoardView(b) { if (b) doc.ab = b.id; fit(); }
  function fitAllView() {
    var U = boardsBox(), sw = stageEl.clientWidth, sh = stageEl.clientHeight; fitView();
    var k = Math.max(fitK * 0.1, Math.min((sw - 2 * fitM) / U.w, (sh - fitT - fitM) / U.h));
    view.k = k; view.r = 0; view.x = (sw - U.w * k) / 2 - U.x * k; view.y = fitT + (sh - fitT - fitM - U.h * k) / 2 - U.y * k; view.fit = false; applyView();
  }
  function rearrangeBoards() {
    var R = TS.abarr, n = doc.boards.length, cols = R.layout === 'row' ? n : R.layout === 'col' ? 1 : Math.max(1, Math.min(n, R.cols | 0)), gap = R.gap;
    record('Rearrange Artboards');
    var arts = TS.abarr.art ? doc.boards.map(onBoard) : null, x0 = doc.boards[0].x, y0 = doc.boards[0].y;
    var byCol = R.layout === 'gcol', rows = Math.ceil(n / cols), colW = [], rowH = [];
    var cell = function (i) { return byCol ? [Math.floor(i / rows), i % rows] : [i % cols, Math.floor(i / cols)]; };
    doc.boards.forEach(function (b, i) { var c = cell(i); colW[c[0]] = Math.max(colW[c[0]] || 0, b.w); rowH[c[1]] = Math.max(rowH[c[1]] || 0, b.h); });
    var cx = [x0], cy = [y0]; for (var i = 1; i < colW.length; i++) cx[i] = cx[i - 1] + colW[i - 1] + gap; for (i = 1; i < rowH.length; i++) cy[i] = cy[i - 1] + rowH[i - 1] + gap;
    doc.boards.forEach(function (b, i) { var c = cell(i); moveBoard(b, cx[c[0]] - b.x, cy[c[1]] - b.y, arts && arts[i]); });
    changed(); fitAllView();
  }
  // (a board's handles, on the screen)
  function boardHandle(s, touch) {
    var b = AB(), hp = handlePts(b), r = touch ? 16 : 8, hit = null;
    HANDLES.forEach(function (k) { if (!hit && Math.abs(s.x - hp[k].x) <= r && Math.abs(s.y - hp[k].y) <= r) hit = k; });
    return hit;
  }
  var ABT = { artboard: 1, abnew: 1, abresize: 1, abarr: 1, abset: 1 };
  // ARTBOARD TOOL: tap a board to make it the active one; drag it to move
  // it (what's on it too, if Move Artwork is on), its handles to size it;
  // drag on the pasteboard for a new one (Create Artboard: a tap makes one
  // the size set)
  H.artboard = {
    down: function (e, s, p, touch) {
      var h = tool !== 'abnew' && boardHandle(s, touch), b0 = AB();
      if (h) { drag = { kind: 'abs', tool: tool, s0: s, h: h, id: b0.id, o: clone(b0) }; return; }
      var b = boardAt(p);
      if (b && tool !== 'abnew') { setAB(b.id); drag = { kind: 'abm', tool: tool, s0: s, p0: p, id: b.id, o: clone(b), art: TS.abarr.art ? onBoard(b).map(function (n) { return n.id; }) : [], orig: null }; drag.orig = drag.art.map(function (id) { return clone(byId(id)); }); return; }
      drag = { kind: 'abn', tool: tool, s0: s, p0: p };
    },
    move: function (e, s, p) {
      var d = drag, b = d.id && boardById(d.id);
      if (d.kind === 'abn') { ui.marquee = { x0: d.s0.x, y0: d.s0.y, x1: s.x, y1: s.y }; drawUI(); return; }
      if (!b) return;
      begin(d, d.kind === 'abs' ? 'Size Artboard' : 'Move Artboard');
      if (d.kind === 'abm') {
        var dx = p.x - d.p0.x, dy = p.y - d.p0.y; if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        var sn = snapBox(d.o, dx, dy, [], b.id); dx = sn.dx; dy = sn.dy; if (!ui.smart) { dx = Math.round(d.o.x + dx) - d.o.x; dy = Math.round(d.o.y + dy) - d.o.y; }
        b.x = d.o.x + dx; b.y = d.o.y + dy;
        d.art.forEach(function (id, i) { var n = replaceNode(id, clone(d.orig[i])); xform(n, [1, 0, 0, 1, dx, dy]); });
        renderArt(); drawUI(); panelSync(); rulersDraw(); return;
      }
      var q = snapPt(p, null, false), o = d.o, x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h; if (!q.mk) q = v2(Math.round(q.x), Math.round(q.y));
      if (/w/.test(d.h)) x0 = Math.min(q.x, x1 - 1); if (/e/.test(d.h)) x1 = Math.max(q.x, x0 + 1); if (/^n/.test(d.h)) y0 = Math.min(q.y, y1 - 1); if (/^s/.test(d.h)) y1 = Math.max(q.y, y0 + 1);
      if (d.h.length === 2 && e.shiftKey) { var k = Math.max((x1 - x0) / o.w, (y1 - y0) / o.h); if (/w/.test(d.h)) x0 = x1 - o.w * k; else x1 = x0 + o.w * k; if (/^n/.test(d.h)) y0 = y1 - o.h * k; else y1 = y0 + o.h * k; }
      b.x = x0; b.y = y0; b.w = x1 - x0; b.h = y1 - y0; renderArt(); drawUI(); panelSync(); rulersDraw();
    },
    up: function (e, s, p) {
      var d = drag; drag = null; ui.marquee = null;
      if (d.kind === 'abn') {
        if (d.moved && Math.abs(p.x - d.p0.x) > 4 / view.k && Math.abs(p.y - d.p0.y) > 4 / view.k) { var a = snapPt(d.p0), c = snapPt(p); a = v2(Math.round(a.x), Math.round(a.y)); c = v2(Math.round(c.x), Math.round(c.y)); addBoard(Math.min(a.x, c.x), Math.min(a.y, c.y), Math.abs(c.x - a.x), Math.abs(c.y - a.y)); return; }
        if (tool === 'abnew') { var S = TS.abnew; addBoard(Math.round(p.x - S.w / 2), Math.round(p.y - S.h / 2), S.w, S.h); return; }
        drawUI(); return;
      }
      changed();
    },
    hover: function () {}
  };
  H.abnew = H.abresize = H.abarr = H.abset = H.artboard;
  var AB_PRESETS = [['custom', 'Custom'], ['1080x1080', 'Square 1080 × 1080'], ['1080x1350', 'Portrait 1080 × 1350'], ['1080x1920', 'Story 1080 × 1920'], ['1920x1080', 'HD 1920 × 1080'], ['1280x720', 'HD 720p 1280 × 720'],
    ['794x1123', 'A4 794 × 1123'], ['1123x1587', 'A3 1123 × 1587'], ['816x1056', 'Letter 816 × 1056'], ['1024x768', 'Tablet 1024 × 768'], ['390x844', 'Phone 390 × 844'], ['512x512', 'Icon 512 × 512'], ['1500x500', 'Banner 1500 × 500']];

  // ---- GUIDES AND PRECISION: rulers along the top and left (in the
  // active artboard's units, from its corner), guides (doc.guides, { o: 'h'
  // or 'v', p }, dragged out of the rulers or placed with the Guides tool),
  // a grid in the artwork's units (TS.prec.gsize, from the active board's
  // corner), and snapping: to the grid, to guides, to anchor points (Snap
  // to Points), to the outlines of other objects (Snap to Objects), and to
  // the edges and middles of other objects and the artboard, with lines
  // showing what lined up (Smart Guides). Measure reads distances ----
  var UNITS = { px: [1, 'px'], pt: [0.75, 'pt'], mm: [25.4 / 96, 'mm'], in: [1 / 96, 'in'] };
  var rulerH = null, rulerV = null, rulerC = null, RW = 18;
  function prec() { return TS.prec; }
  function rulersOn() { return on && TS.prec.rulers && Math.abs(view.r) < 1e-6; }
  // (a canvas strip, drawn again as the view moves; numbers every so often)
  function rulersDraw() {
    if (!rulerH) return;
    var show = rulersOn(); rulerH.hidden = rulerV.hidden = rulerC.hidden = !show; stageEl.classList.toggle('vec-ruled', !!show);
    if (!show) return;
    var W = stageEl.clientWidth, Hh = stageEl.clientHeight, dpr = window.devicePixelRatio || 1, cs = getComputedStyle(stageEl), ink = cs.getPropertyValue('--muted').trim() || '#888', line = cs.getPropertyValue('--line').trim() || 'rgba(0,0,0,.15)';
    var A = AB(), U = UNITS[TS.prec.units] || UNITS.px, k = view.k / U[0];
    // (a step in units that's at least 50px on the screen: 1, 2 or 5 of a power of ten)
    var step = 1, raw = 50 / k, pw = Math.pow(10, Math.floor(Math.log10(raw))); [1, 2, 5, 10].some(function (m) { step = m * pw; return step >= raw; });
    [[rulerH, W, RW, 'h'], [rulerV, RW, Hh, 'v']].forEach(function (q) {
      var c = q[0], w = q[1], h = q[2]; if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + 'px'; c.style.height = h + 'px'; }
      var x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
      x.strokeStyle = line; x.lineWidth = 1; x.beginPath(); if (q[3] === 'h') { x.moveTo(0, h - 0.5); x.lineTo(w, h - 0.5); } else { x.moveTo(w - 0.5, 0); x.lineTo(w - 0.5, h); } x.stroke();
      x.fillStyle = ink; x.strokeStyle = ink; x.font = '9px ' + (cs.fontFamily || 'sans-serif'); x.textBaseline = 'top';
      var o = q[3] === 'h' ? view.x + A.x * view.k : view.y + A.y * view.k, len = q[3] === 'h' ? w : h;
      var first = Math.floor((-o) / (step * k)) - 1, last = Math.ceil((len - o) / (step * k)) + 1;
      x.beginPath();
      for (var i = first; i <= last; i++) for (var j = 0; j < 10; j++) {
        var at = o + (i + j / 10) * step * k; if (at < RW || at > len) continue;
        var tl = j === 0 ? h * 0.6 : j === 5 ? 6 : 3, tl2 = j === 0 ? w * 0.6 : j === 5 ? 6 : 3;
        if (q[3] === 'h') { x.moveTo(Math.round(at) + 0.5, h); x.lineTo(Math.round(at) + 0.5, h - tl); } else { x.moveTo(w, Math.round(at) + 0.5); x.lineTo(w - tl2, Math.round(at) + 0.5); }
        if (j === 0) { var lab = String(r2(i * step)); if (q[3] === 'h') x.fillText(lab, Math.round(at) + 3, 2); else { x.save(); x.translate(2, Math.round(at) + 3); x.rotate(Math.PI / 2); x.fillText(lab, 0, -9); x.restore(); } }
      }
      x.stroke();
    });
  }
  // (a guide dragged out of a ruler: away from it, it stays; back over it, it goes)
  function rulerDown(e) {
    if (!on || !doc) return; e.preventDefault(); e.stopPropagation();
    var o = e.currentTarget === rulerH ? 'h' : 'v', g = { o: o, p: 0 }, r = stageEl.getBoundingClientRect(), st = false;
    var mv = function (ev) {
      var q = fromScreen(ev.clientX - r.left, ev.clientY - r.top), sq = snapPt(q, null, ev.pointerType !== 'mouse');
      if (!st) { st = true; record('Guide'); doc.guides.push(g); TS.prec.guides = 1; }
      g.p = r2(o === 'h' ? sq.y : sq.x); ui.snapMk = sq.mk; drawUI(); rulersDraw();
    };
    var upf = function (ev) {
      window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', upf, true); window.removeEventListener('pointercancel', upf, true);
      if (!st) return;
      var sx = ev.clientX - r.left, sy = ev.clientY - r.top;
      if ((o === 'h' ? sy : sx) < RW || ev.type === 'pointercancel') { dropLast(); doc.guides.pop(); }
      ui.snapMk = null; changed();
    };
    window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', upf, true); window.addEventListener('pointercancel', upf, true);
  }
  // THE GRID: lines a screen pixel wide (--gw), --gs apart (every 2nd, 4th...
  // when zoomed far out), finer ones between; behind the art or in front
  var gridSeen = '';
  function gridDraw() {
    if (!gridEl) return;
    var P2 = TS.prec, show = on && doc && P2.grid; gridEl.hidden = !show; if (!show) { gridSeen = ''; return; }
    var g = Math.max(1, P2.gsize), s = g; while (s * view.k < 8) s *= 2;
    var sub = Math.max(1, P2.gsub | 0), fs = s / sub, U = boardsBox(), A = AB(), pad = Math.max(U.w, U.h) * 2 + 2000, x0 = U.x - pad, y0 = U.y - pad;
    var key = [s, fs, view.k, U.x, U.y, U.w, U.h, A.x, A.y, P2.gfront, fs * view.k >= 6].join(); if (key === gridSeen) return; gridSeen = key;
    gridEl.style.left = x0 + 'px'; gridEl.style.top = y0 + 'px'; gridEl.style.width = (U.w + 2 * pad) + 'px'; gridEl.style.height = (U.h + 2 * pad) + 'px';
    gridEl.style.setProperty('--gs', s + 'px'); gridEl.style.setProperty('--gf', fs + 'px'); gridEl.style.setProperty('--gw', (1 / view.k) + 'px');
    gridEl.style.backgroundPosition = ['', ''].map(function () { return (((A.x - x0) % s) + s) % s + 'px ' + (((A.y - y0) % s) + s) % s + 'px'; }).concat(['', ''].map(function () { return (((A.x - x0) % fs) + fs) % fs + 'px ' + (((A.y - y0) % fs) + fs) % fs + 'px'; })).join(',');
    gridEl.classList.toggle('fine', sub > 1 && fs * view.k >= 6);
    // (in front of the art, or behind it)
    var want = P2.gfront ? artEl.nextSibling : artEl; if (gridEl.nextSibling !== want && gridEl !== want) worldEl.insertBefore(gridEl, want);
  }
  // SNAPPING. What can be snapped to is gathered once per change (snapCache):
  // the anchors and box edges and middles of everything else, the active
  // board's edges and middle
  var snapCache = null;
  function snapTargets(excl) {
    var key = ver + '|' + (excl || []).join(','); if (snapCache && snapCache.key === key) return snapCache;
    var ex = {}; (excl || []).forEach(function (id) { var n = byId(id); if (n) leaves(n).concat([n]).forEach(function (q) { ex[q.id] = 1; }); });
    var pts = [], xs = [], ys = [], paths = [], A = AB();
    var addBox = function (b, src) { [b.x, b.x + b.w / 2, b.x + b.w].forEach(function (v) { xs.push({ v: v, b: b, src: src }); }); [b.y, b.y + b.h / 2, b.y + b.h].forEach(function (v) { ys.push({ v: v, b: b, src: src }); }); };
    allLeaves().forEach(function (n) {
      if (ex[n.id] || !shownN(n)) return;
      var b = nodeBox(n); if (b) addBox(b, 'obj');
      if (n.type === 'path') { paths.push(n); n.d.forEach(function (sp) { sp.pts.forEach(function (q) { pts.push(v2(q.x, q.y)); }); }); }
      else if (b) [v2(b.x, b.y), v2(b.x + b.w, b.y), v2(b.x + b.w, b.y + b.h), v2(b.x, b.y + b.h)].forEach(function (q) { pts.push(q); });
    });
    addBox(A, 'board'); [v2(A.x, A.y), v2(A.x + A.w, A.y), v2(A.x + A.w, A.y + A.h), v2(A.x, A.y + A.h), v2(A.x + A.w / 2, A.y + A.h / 2)].forEach(function (q) { pts.push(q); });
    snapCache = { key: key, pts: pts, xs: xs, ys: ys, paths: paths }; return snapCache;
  }
  function snapping() { var P2 = TS.prec; return P2.snapGrid || P2.snapPts || P2.snapObj || P2.smart || (P2.guides && doc && doc.guides.length); }
  function gridLine(v, o) { var g = Math.max(1, TS.prec.gsize) / Math.max(1, TS.prec.gsub | 0); return Math.round((v - o) / g) * g + o; }
  // (a point snapped: to a point first, otherwise each way on its own to a grid line, a guide or a smart guide)
  function snapPt(p, excl, touch) {
    var P2 = TS.prec, t = (touch ? 12 : 7) / view.k, out = { x: p.x, y: p.y, mk: null }; if (!doc || !snapping()) return out;
    var T = snapTargets(excl), best = null;
    if (P2.snapPts) T.pts.forEach(function (q) { var d = dist(q, p); if (d <= t && (!best || d < best.d)) best = { x: q.x, y: q.y, d: d }; });
    if (!best && P2.snapObj) T.paths.forEach(function (n) { var q = nearest(n.d, p, Math.max(0.2, t / 4)); if (q && q.d <= t && (!best || q.d < best.d)) best = { x: q.x, y: q.y, d: q.d }; });
    if (best) { out.x = best.x; out.y = best.y; out.mk = { x: best.x, y: best.y, k: 'pt' }; return out; }
    var bx = null, by = null, A = AB(), lines = [];
    var tryX = function (v, kind, ln) { var d = Math.abs(v - p.x); if (d <= t && (!bx || d < bx.d)) bx = { v: v, d: d, k: kind, ln: ln }; };
    var tryY = function (v, kind, ln) { var d = Math.abs(v - p.y); if (d <= t && (!by || d < by.d)) by = { v: v, d: d, k: kind, ln: ln }; };
    if (P2.guides) doc.guides.forEach(function (g) { if (g.o === 'v') tryX(g.p, 'guide'); else tryY(g.p, 'guide'); });
    if (P2.smart) { T.xs.forEach(function (c) { tryX(c.v, 'smart', c); }); T.ys.forEach(function (c) { tryY(c.v, 'smart', c); }); }
    if (P2.snapGrid) { tryX(gridLine(p.x, A.x), 'grid'); tryY(gridLine(p.y, A.y), 'grid'); }
    if (bx) { out.x = bx.v; if (bx.ln) lines.push({ o: 'v', v: bx.v, a: Math.min(p.y, bx.ln.b.y), b: Math.max(p.y, bx.ln.b.y + bx.ln.b.h) }); }
    if (by) { out.y = by.v; if (by.ln) lines.push({ o: 'h', v: by.v, a: Math.min(p.x, by.ln.b.x), b: Math.max(p.x, by.ln.b.x + by.ln.b.w) }); }
    if (bx || by) out.mk = { x: out.x, y: out.y, k: 'line', lines: lines };
    return out;
  }
  // (a box being moved by dx, dy: its edges and middle snapped to the grid,
  // guides and other objects (Smart Guides), each way on its own)
  function snapBox(b, dx, dy, excl, boardId) {
    var P2 = TS.prec, out = { dx: dx, dy: dy }; ui.smart = null; if (!doc || !b || !snapping()) return out;
    var t = 7 / view.k, T = boardId ? boardTargets(boardId) : snapTargets(excl), A = AB(), bx = null, by = null;
    var cx = [b.x + dx, b.x + b.w / 2 + dx, b.x + b.w + dx], cy = [b.y + dy, b.y + b.h / 2 + dy, b.y + b.h + dy];
    var tryX = function (v, c, ln) { var d = v - c; if (Math.abs(d) <= t && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d: d, v: v, ln: ln }; };
    var tryY = function (v, c, ln) { var d = v - c; if (Math.abs(d) <= t && (!by || Math.abs(d) < Math.abs(by.d))) by = { d: d, v: v, ln: ln }; };
    cx.forEach(function (c) { if (P2.guides) doc.guides.forEach(function (g) { if (g.o === 'v') tryX(g.p, c); }); if (P2.smart) T.xs.forEach(function (q) { tryX(q.v, c, q); }); if (P2.snapGrid) tryX(gridLine(c, A.x), c); });
    cy.forEach(function (c) { if (P2.guides) doc.guides.forEach(function (g) { if (g.o === 'h') tryY(g.p, c); }); if (P2.smart) T.ys.forEach(function (q) { tryY(q.v, c, q); }); if (P2.snapGrid) tryY(gridLine(c, A.y), c); });
    var lines = [];
    if (bx) { out.dx += bx.d; if (bx.ln) lines.push({ o: 'v', v: bx.v, a: Math.min(b.y + out.dy, bx.ln.b.y), b: Math.max(b.y + b.h + out.dy, bx.ln.b.y + bx.ln.b.h) }); }
    if (by) { out.dy += by.d; if (by.ln) lines.push({ o: 'h', v: by.v, a: Math.min(b.x + out.dx, by.ln.b.x), b: Math.max(b.x + b.w + out.dx, by.ln.b.x + by.ln.b.w) }); }
    ui.smart = lines.length ? lines : null;
    return out;
  }
  // (a board moved: the other boards' edges and middles)
  function boardTargets(id) { var xs = [], ys = []; doc.boards.forEach(function (b) { if (b.id === id) return; [b.x, b.x + b.w / 2, b.x + b.w].forEach(function (v) { xs.push({ v: v, b: b }); }); [b.y, b.y + b.h / 2, b.y + b.h].forEach(function (v) { ys.push({ v: v, b: b }); }); }); return { xs: xs, ys: ys, pts: [], paths: [] }; }
  // GUIDES TOOL: tap to place a guide (across or down, as set), drag one to
  // move it, drag it off the edge or double-tap it to take it away
  function guideAt(s, touch) {
    var r = touch ? 10 : 5, hit = -1;
    if (!TS.prec.guides) return -1;
    doc.guides.forEach(function (g, i) { var a = g.o === 'h' ? toScreen(v2(0, g.p)) : toScreen(v2(g.p, 0)), b = g.o === 'h' ? toScreen(v2(1, g.p)) : toScreen(v2(g.p, 1)); var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, d = Math.abs((s.x - a.x) * dy - (s.y - a.y) * dx) / L; if (d <= r) hit = i; });
    return hit;
  }
  H.guides = {
    down: function (e, s, p, touch, dbl) {
      var i = guideAt(s, touch);
      if (i >= 0 && TS.prec.glock) { B.toast('Guides are locked'); return; }
      if (i >= 0 && dbl) { record('Remove Guide'); doc.guides.splice(i, 1); changed(); return; }
      if (i >= 0) { drag = { kind: 'gd', tool: 'guides', s0: s, i: i, o: doc.guides[i].p }; return; }
      var q = snapPt(p, null, touch); record('Guide'); TS.prec.guides = 1; doc.guides.push({ o: TS.prec.gnew, p: r2(TS.prec.gnew === 'h' ? q.y : q.x) });
      drag = { kind: 'gd', tool: 'guides', s0: s, i: doc.guides.length - 1, rec: true, isNew: true }; changed();
    },
    move: function (e, s, p, touch) {
      var d = drag, g = doc.guides[d.i]; if (!g) return; begin(d, 'Move Guide');
      var q = snapPt(p, null, touch); g.p = r2(g.o === 'h' ? q.y : q.x); ui.snapMk = q.mk; drawUI(); rulersDraw();
    },
    up: function (e, s) {
      var d = drag; drag = null; ui.snapMk = null;
      var W = stageEl.clientWidth, Hh = stageEl.clientHeight, g = doc.guides[d.i];
      if (g && d.moved && (s.x < 0 || s.y < 0 || s.x > W || s.y > Hh || (rulersOn() && ((g.o === 'h' && s.y < RW) || (g.o === 'v' && s.x < RW))))) doc.guides.splice(d.i, 1);
      changed();
    },
    hover: function (s, p, touch) { var i = guideAt(s, touch); stageEl.style.cursor = i >= 0 ? (doc.guides[i].o === 'h' ? 'ns-resize' : 'ew-resize') : 'crosshair'; var q = snapPt(p, null, touch); ui.snapMk = q.mk; drawUI(); }
  };
  // MEASURE: drag from one point to another; the distance, angle and the
  // two ways across show on the screen and in the panel
  var meas = null;
  H.measure = {
    down: function (e, s, p, touch) { var q = snapPt(p, null, touch); meas = { a: v2(q.x, q.y), b: v2(q.x, q.y) }; drag = { kind: 'meas', tool: 'measure', s0: s }; drawUI(); },
    move: function (e, s, p, touch) { var q = snapPt(p, null, touch), b = v2(q.x, q.y); if (e.shiftKey) { var a = meas.a, an = Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 4)) * Math.PI / 4, L = dist(a, b); b = v2(a.x + Math.cos(an) * L, a.y + Math.sin(an) * L); } meas.b = b; ui.snapMk = q.mk; drawUI(); panelSync(); },
    up: function () { drag = null; ui.snapMk = null; drawUI(); panelSync(); },
    hover: function (s, p, touch) { var q = snapPt(p, null, touch); ui.snapMk = q.mk; drawUI(); }
  };
  // (a switch that's a tool of its own is turned on by pressing its button, not by its category opening on it)
  function precPick(t) { var f = PREC_ON[t]; if (!f || TS.prec[f]) return; TS.prec[f] = 1; tsSave(); rulersDraw(); gridDraw(); drawUI(); panelSync(); }
  function precToggle(f) { TS.prec[f] = TS.prec[f] ? 0 : 1; tsSave(); rulersDraw(); gridDraw(); drawUI(); panelSync(); B.toast((f === 'grid' ? 'Grid' : f === 'guides' ? 'Guides' : 'Rulers') + (TS.prec[f] ? ' shown' : ' hidden')); }
  function uval(v) { var U = UNITS[TS.prec.units] || UNITS.px; return r2(v * U[0]) + ' ' + U[1]; }
  // (the switches that are tools of their own turn their feature on when picked)
  var PREC_ON = { rulers: 'rulers', smartg: 'smart', grid: 'grid', snapgrid: 'snapGrid', snappts: 'snapPts', snapobj: 'snapObj' };
  ['rulers', 'smartg', 'grid', 'snapgrid', 'snappts', 'snapobj'].forEach(function (t) { H[t] = H.select; });
  // (what precision draws on the screen sheet: guides across the whole
  // stage, Smart Guides' lines, the snap mark, a measurement, board names)
  function precUi() {
    var out = '', W = stageEl.clientWidth, Hh = stageEl.clientHeight;
    if (TS.prec.guides) doc.guides.forEach(function (g) {
      var a = g.o === 'h' ? toScreen(v2(-1e6, g.p)) : toScreen(v2(g.p, -1e6)), b = g.o === 'h' ? toScreen(v2(1e6, g.p)) : toScreen(v2(g.p, 1e6));
      out += '<line class="vs-guide" x1="' + r2(a.x) + '" y1="' + r2(a.y) + '" x2="' + r2(b.x) + '" y2="' + r2(b.y) + '"/>';
    });
    (ui.smart || []).concat(ui.snapMk && ui.snapMk.lines || []).forEach(function (l) { var a = l.o === 'v' ? toScreen(v2(l.v, l.a)) : toScreen(v2(l.a, l.v)), b = l.o === 'v' ? toScreen(v2(l.v, l.b)) : toScreen(v2(l.b, l.v)); out += '<line class="vs-smart" x1="' + r2(a.x) + '" y1="' + r2(a.y) + '" x2="' + r2(b.x) + '" y2="' + r2(b.y) + '"/>'; });
    if (ui.snapMk) { var m = toScreen(ui.snapMk); out += ui.snapMk.k === 'pt' ? '<rect class="vs-snap" x="' + r2(m.x - 4) + '" y="' + r2(m.y - 4) + '" width="8" height="8"/>' : '<circle class="vs-snap" cx="' + r2(m.x) + '" cy="' + r2(m.y) + '" r="3"/>'; }
    if (meas && tool === 'measure') {
      var a2 = toScreen(meas.a), b2 = toScreen(meas.b), mid = v2((a2.x + b2.x) / 2, (a2.y + b2.y) / 2);
      out += '<line class="vs-meas" x1="' + r2(a2.x) + '" y1="' + r2(a2.y) + '" x2="' + r2(b2.x) + '" y2="' + r2(b2.y) + '"/><circle class="vs-dot" cx="' + r2(a2.x) + '" cy="' + r2(a2.y) + '" r="3"/><circle class="vs-dot" cx="' + r2(b2.x) + '" cy="' + r2(b2.y) + '" r="3"/>' +
        '<text class="vs-label" x="' + r2(mid.x + 8) + '" y="' + r2(mid.y - 8) + '">' + esc(uval(dist(meas.a, meas.b))) + '</text>';
    }
    // (the boards' names, above each, when there's more than one or a board tool is in hand)
    if (doc.boards.length > 1 || ABT[tool]) doc.boards.forEach(function (b) { var q = toScreen(v2(b.x, b.y)); out += '<text class="vs-abname' + (b.id === doc.ab ? ' on' : '') + '" x="' + r2(q.x) + '" y="' + r2(q.y - 6) + '">' + esc(b.name) + '</text>'; });
    if (ABT[tool] && tool !== 'abnew') { var A = AB(), hp = handlePts(A); out += '<polygon class="vs-bounds" points="' + polyStr(quad(A)) + '"/>' + HANDLES.map(function (k) { return '<rect class="vs-handle" x="' + r2(hp[k].x - HS) + '" y="' + r2(hp[k].y - HS) + '" width="' + 2 * HS + '" height="' + 2 * HS + '"/>'; }).join(''); }
    return out;
  }

  // ---- EFFECTS' TOOLS ----
  // (the box an effect works in: a path's own, or the group's as drawn)
  function fxBox(n) { return n.type === 'path' ? dBox(n.d) : boxOf(n.items.map(shownOf)); }
  function fxTargets() { return picked().filter(function (n) { return editable(n) && (n.type === 'path' || n.type === 'group'); }); }
  // BLEND TOOL: tap one shape, then another, for the steps between them
  var blendA = null;
  function blendGroups() { return picked().filter(function (n) { return n.type === 'group' && n.blnd && editable(n); }); }
  function makeBlend(list) {
    var order = stackOrder(list).filter(function (n) { return n.type === 'path'; });
    if (order.length < 2) { B.toast('A blend needs two or more shapes'); return; }
    record('Blend'); var g = groupNodes(order, 'Blend'); g.blnd = { steps: TS.vblend.steps, smooth: TS.vblend.mode === 'smooth' ? 1 : 0 }; sel = [g.id]; asel = {}; changed();
  }
  H.vblend = {
    down: function (e, s, p, touch) {
      var hit = hitLeaf(p, tolDoc(touch));
      if (!hit || hit.type !== 'path' || !editable(hit) || chain(hit.id).some(function (q) { return q.blnd; })) { blendA = null; H.select.down(e, s, p, touch); return; }
      if (!blendA || !byId(blendA) || blendA === hit.id) { blendA = hit.id; sel = [hit.id]; asel = {}; selChanged(); B.toast('Now tap the shape to blend it to'); return; }
      var a = byId(blendA); blendA = null; makeBlend([a, hit]);
    },
    move: function (e, s, p) { if (drag) H.select.move(e, s, p); }, up: function (e, s, p, t) { if (drag) H.select.up(e, s, p, t); }, hover: H.select.hover
  };
  // WARP and ENVELOPE DISTORT: the effect on what's picked; the envelope's
  // mesh pulled about point by point
  function warpNow() { var w = TS.warp; return { k: 'warp', st: w.st, bend: w.bend, hd: w.hd, vd: w.vd, dir: w.dir }; }
  function fxPicked(k) { return fxTargets().filter(function (n) { return n.efx && n.efx.k === k; }); }
  function envHit(s, touch) {
    var r = touch ? 14 : 7, hit = null;
    fxPicked('env').forEach(function (n) { var b = fxBox(n); if (!b) return; n.efx.m.forEach(function (q, i) { var a = toScreen(v2(b.x + q[0] * b.w, b.y + q[1] * b.h)); if (dist(a, s) <= r && !hit) hit = { id: n.id, i: i, b: b }; }); });
    return hit;
  }
  H.envelope = {
    down: function (e, s, p, touch) { var h = envHit(s, touch); if (h) { drag = { kind: 'env', tool: 'envelope', s0: s, id: h.id, i: h.i, b: h.b }; return; } H.select.down(e, s, p, touch); },
    move: function (e, s, p) {
      var d = drag; if (d.kind !== 'env') { H.select.move(e, s, p); return; }
      var n = byId(d.id); if (!n || !n.efx) return; begin(d, 'Envelope'); var q = snapPt(p);
      n.efx.m[d.i] = [r2((q.x - d.b.x) / Math.max(d.b.w, 1e-6) * 1e4) / 1e4, r2((q.y - d.b.y) / Math.max(d.b.h, 1e-6) * 1e4) / 1e4]; renderNode(n); drawUI();
    },
    up: function (e, s, p, touch) { var d = drag; if (d.kind !== 'env') { H.select.up(e, s, p, touch); return; } drag = null; changed(); },
    hover: H.select.hover
  };
  H.warp = H.offset = H.repeat = H.pattern = H.transp = H.select;
  function envUi() {
    var out = '';
    fxPicked('env').forEach(function (n) {
      var b = fxBox(n), R = n.efx.rows, C = n.efx.cols, P2 = n.efx.m.map(function (q) { return toScreen(v2(b.x + q[0] * b.w, b.y + q[1] * b.h)); });
      for (var j = 0; j <= R; j++) out += '<polyline class="vs-mesh" points="' + polyStr(P2.slice(j * (C + 1), j * (C + 1) + C + 1)) + '"/>';
      for (var i = 0; i <= C; i++) { var col = []; for (j = 0; j <= R; j++) col.push(P2[j * (C + 1) + i]); out += '<polyline class="vs-mesh" points="' + polyStr(col) + '"/>'; }
      P2.forEach(function (q) { out += '<rect class="vs-anchor" x="' + r2(q.x - 3.5) + '" y="' + r2(q.y - 3.5) + '" width="7" height="7"/>'; });
    });
    if (tool === 'vblend' && blendA && byId(blendA)) out += outlineOf(byId(blendA), 'vs-key');
    return out;
  }
  // (an effect made real: the paths take the shapes drawn)
  function expandFx(list, label) {
    list = list.filter(hasFx); if (!list.length) { B.toast('Pick something with an effect first'); return; }
    record(label || 'Expand'); var ids = [];
    list.forEach(function (n) { var s2 = fresh(shownOf(n)); s2.name = n.name; var w = where(n.id); w.list[w.i] = s2; ids.push(s2.id); });
    sel = ids; asel = {}; changed();
  }
  function releaseFx(k, label) {
    var list = picked().filter(editable).filter(function (n) { return k === 'blnd' ? n.blnd : k === 'rep' ? n.rep : n.efx && n.efx.k === k; });
    if (!list.length) { B.toast('Pick something with that effect first'); return; }
    record(label); list.forEach(function (n) { if (k === 'fx' || k === 'warp' || k === 'env') delete n.efx; else delete n[k]; }); changed();
  }
  function applyWarp() {
    var list = fxTargets(); if (!list.length) { B.toast('Pick shapes (or groups) to warp'); return; }
    record('Warp'); list.forEach(function (n) { n.efx = warpNow(); }); changed();
  }
  function applyEnv(fromWarp) {
    var list = fxTargets(); if (!list.length) { B.toast('Pick shapes (or groups) for the envelope'); return; }
    var R = Math.max(1, Math.min(12, TS.env.rows | 0)), C = Math.max(1, Math.min(12, TS.env.cols | 0));
    record('Envelope'); list.forEach(function (n) { n.efx = { k: 'env', rows: R, cols: C, m: fromWarp ? envFromWarp(TS.warp.st, TS.warp.bend, R, C) : envGrid(R, C) }; }); changed();
  }
  function makeRepeat() {
    var list = picked().filter(editable); if (!list.length) { B.toast('Pick what to repeat'); return; }
    var R = TS.repeat; record('Repeat');
    var g = groupNodes(stackOrder(list), 'Repeat'); g.rep = { k: R.k, n: R.n, r: R.r, rows: R.rows, cols: R.cols, gx: R.gx, gy: R.gy, a: R.a, off: R.off }; sel = [g.id]; asel = {}; changed();
  }
  function repGroups() { return picked().filter(function (n) { return n.type === 'group' && n.rep && editable(n); }); }
  function doOffset() {
    var list = targets().filter(function (n) { return n.type === 'path'; }); if (!list.length) { B.toast('Pick the paths to offset'); return; }
    var S = TS.offset, made = [], before = snap(); B.toast('Offsetting…');
    list.forEach(function (n) {
      var d = offsetPath(n, S.d, S.join, S.ml); if (!d || !d.length) return;
      var m = newPath(d, n.name + ' Offset', clone(n.app)); m.opacity = n.opacity; m.blend = n.blend; m.app.forEach(function (it) { if (it.prof) it.prof = null; });
      var w = where(n.id); w.list.splice(S.d > 0 ? w.i : w.i + 1, 0, m); made.push(m.id);
    });
    if (!made.length) { B.toast('Nothing to offset'); return; }
    hist.push({ s: before, label: 'Offset Path' }); if (hist.length > HMAX) hist.shift(); fut = []; sel = made; asel = {}; changed();
  }
  function makeMask(fade) {
    var list = picked().filter(editable);
    if (fade) {
      if (!list.length) { B.toast('Pick what to fade'); return; }
      var b = boxOf(list); record('Fade');
      var r = newPath(rectD(b.x, b.y, b.w, b.h), 'Fade', [{ k: 'f', p: { t: 'l', st: [{ t: 0, c: '#ffffff', o: 1 }, { t: 1, c: '#000000', o: 1 }], x1: TS.transp.dir === 'v' ? 0.5 : 0, y1: TS.transp.dir === 'v' ? 0 : 0.5, x2: TS.transp.dir === 'v' ? 0.5 : 1, y2: TS.transp.dir === 'v' ? 1 : 0.5 }, o: 1, on: 1 }]);
      r.opacity = 1; r.blend = 'normal'; var order = stackOrder(list); insertNode(r, order[order.length - 1]);
      var g = groupNodes(order.concat([r]), 'Opacity Mask'); g.omask = { inv: 0, clip: 1 }; sel = [g.id]; asel = {}; changed(); return;
    }
    if (list.length < 2) { B.toast('Pick the mask (on top) and what it masks, together'); return; }
    record('Make Opacity Mask'); var g2 = groupNodes(stackOrder(list), 'Opacity Mask'); g2.omask = { inv: 0, clip: 1 }; sel = [g2.id]; asel = {}; changed();
  }
  function maskGroups() { return picked().filter(function (n) { return n.type === 'group' && n.omask && editable(n); }); }


  // ---- COLOURS: what the fill and the stroke are, for the bottom bar, the
  // colour picker ('main' is the fill, 'second' the stroke) and the panels.
  // A change goes to every picked path and becomes the colour new ones take ----
  var gstop = 0; // (the gradient stop being changed)
  function targets() { var out = []; picked().filter(editable).forEach(function (n) { leaves(n).forEach(function (q) { if ((q.type === 'path' || q.type === 'text') && editable(q)) out.push(q); }); }); var t = te && byId(te.id); if (t && out.indexOf(t) < 0) out.push(t); return out; }
  function shownApp() { var t = targets(); return t.length ? t[t.length - 1].app : doc.def.app; }
  function kOf(which) { return which === 'second' || which === 's' ? 's' : 'f'; }
  function itemNow(which) { return itemOf(shownApp(), kOf(which), false); }
  function pcGet(which) {
    var it = itemNow(which); if (!it || !it.p) return null;
    if (it.p.t === 'c') return it.p.c;
    if (!isGrad(it.p)) return null;
    var st = it.p.st[Math.max(0, Math.min(it.p.st.length - 1, gstop))]; return st.c;
  }
  function pcCss(which) { var it = itemNow(which); return it && it.p && it.on ? paintCss(it.p) : ''; }
  var recLast = { label: '', t: 0, key: '' };
  // (a run of changes from one slider or drag is one step)
  function recordC(label) {
    var key = sel.join(',') + '|' + tool, now = performance.now();
    if (recLast.label === label && recLast.key === key && now - recLast.t < 900 && hist.length) { recLast.t = now; return; }
    record(label); recLast = { label: label, t: now, key: key };
  }
  function eachItem(k, fn, make) {
    var list = targets().map(function (n) { return n.app; }); list.push(doc.def.app);
    list.forEach(function (app) { var it = itemOf(app, k, make); if (it) fn(it); });
  }
  function setColour(which, hex, label) {
    var k = kOf(which); recordC(label || (k === 'f' ? 'Fill' : 'Stroke'));
    eachItem(k, function (it) {
      if (hex == null) { it.p = null; return; }
      if (isGrad(it.p) && tool === 'gradient') { var st = it.p.st[Math.max(0, Math.min(it.p.st.length - 1, gstop))]; st.c = hex; lastGrad = clone(it.p); }
      else it.p = { t: 'c', c: hex };
      it.on = 1;
    }, true);
    changed();
  }
  function pcSet(which, hex) { setColour(which, hex); }
  function pcRefresh() { if (B && B.pcRefresh && on) B.pcRefresh(); }
  function swapColours() {
    record('Swap Fill and Stroke');
    var swap = function (app) { var f = itemOf(app, 'f', true), s = itemOf(app, 's', true), t = f.p; f.p = s.p; s.p = t; f.on = s.on = 1; };
    targets().forEach(function (n) { swap(n.app); }); swap(doc.def.app); changed();
  }
  function defaultColours() {
    record('Default Fill and Stroke');
    var d = defApp(); targets().forEach(function (n) { var f = itemOf(n.app, 'f', true), s = itemOf(n.app, 's', true); f.p = clone(d[0].p); s.p = clone(d[1].p); s.w = d[1].w; f.on = s.on = 1; });
    doc.def.app = defApp(); changed();
  }

  // ---- THE PANEL: the category's tools at the top (a grid of buttons with
  // their names), the tool's settings (or what's picked) under them. Every
  // control names what it changes (data-vk) in BK, which says how to read
  // and set it; buttons that do something name it (data-va) in ACT ----
  var cap1 = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
  var hint = function (t) { return '<span class="ctx-hint">' + t + '</span>'; };
  var sep = '<span class="ctx-sep" aria-hidden="true"></span>';
  var sub = function (t) { return '<div class="ctx-sub">' + t + '</div>'; };
  function slider(k, label, min, max, step, tip) { return '<label class="ctx-slider"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '><span>' + label + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + (step || 1) + '" data-vk="' + k + '" aria-label="' + label + '"><output></output></label>'; }
  function num(k, label, min, max, step) { return '<label class="ctx-field" data-tip="' + esc(label) + '"><span>' + label + '</span><input type="number" class="p-field ctx-num" ' + (min != null ? 'min="' + min + '" ' : '') + (max != null ? 'max="' + max + '" ' : '') + 'step="' + (step || 1) + '" data-vk="' + k + '" aria-label="' + esc(label) + '"></label>'; }
  function chip(k, label, icon, tip) { return '<button type="button" class="ctx-chip" data-vk="' + k + '" aria-pressed="false" data-tip="' + esc(tip || label) + '">' + (icon ? CI(icon) : '') + '<span>' + label + '</span></button>'; }
  function segc(k, label, opts) { return '<div class="pa-tabs ctx-seg' + (opts.length > 3 ? ' ctx-seg-fit' : '') + '" role="tablist" aria-label="' + esc(label) + '">' + opts.map(function (o) { return '<button type="button" role="tab" data-vk="' + k + '" data-val="' + o[0] + '"' + (o[2] ? ' data-tip="' + esc(o[2]) + '"' : '') + (o[3] ? ' aria-label="' + esc(o[1]) + '"' : '') + '>' + (o[3] ? CI(o[3]) : o[1]) + '</button>'; }).join('') + '</div>'; }
  function selBox(k, label, opts) { return '<label class="ctx-field vec-selrow"><span>' + label + '</span><select class="p-field" data-vk="' + k + '" aria-label="' + esc(label) + '">' + opts.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></label>'; }
  function btn(a, label, icon, tip, cls) { return '<button type="button" class="ctx-btn' + (cls ? ' ' + cls : '') + '" data-va="' + a + '"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' + (icon ? CI(icon) : '') + '<span>' + label + '</span></button>'; }
  function colourRow(k, label) { return '<button type="button" class="ctx-btn vec-colour" data-va="pick-' + k + '" data-tip="' + esc(label) + ': tap to change it"><i class="vec-sw" data-vsw="' + k + '"></i><span>' + label + '</span><span class="vec-hex" data-vhex="' + k + '"></span></button>'; }
  var IC = {
    trash: '<path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/>',
    group: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5" stroke-dasharray="2.5 2"/><rect x="7" y="7" width="6" height="6" rx="1"/><circle cx="15" cy="15" r="3"/>',
    ungroup: '<rect x="4" y="4" width="7" height="7" rx="1"/><circle cx="16.5" cy="16.5" r="3.5"/><path d="M14 4h6v6M4 14v6h6" stroke-dasharray="2 2"/>',
    dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    corner: '<path d="M5 19L12 6l7 13"/><rect x="10" y="4" width="4" height="4" rx=".7"/>', smooth: '<path d="M4 17c2-8 14-8 16 0"/><rect x="10" y="7" width="4" height="4" rx=".7"/><path d="M4 9h5M15 9h5"/>',
    reverse: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>', none: '<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/>', plus: '<path d="M12 5v14M5 12h14"/>'
  };
  var panelKey = '';
  function panelHTML() {
    if (tool === 'none') { panelKey = keyNow(); return '<div class="vec-panel"><div class="vec-cat">No Tool</div><div class="vec-set">' + hint(TOOLS.none.tip.replace(/^[^:]*: /, '')) + '</div></div>'; }
    var c = CATS.filter(function (q) { return q.id === cat; })[0] || CATS[0];
    var top = '<div class="vec-tools" role="group" aria-label="' + esc(c.name) + ' tools">' + c.tools.map(function (t) {
      var T = TOOLS[t];
      return '<button type="button" class="vec-tool" data-vtool="' + t + '"' + (T.action ? '' : ' aria-pressed="' + (t === tool) + '"') + ' data-tip="' + esc(T.tip) + '">' + CI(ICONS[t]) + '<span>' + T.name + '</span></button>';
    }).join('') + '</div>';
    panelKey = keyNow();
    return '<div class="vec-panel"><div class="vec-cat">' + esc(c.name) + '</div>' + top + sep + '<div class="vec-set">' + (SET[tool] || SET.select)() + '</div></div>';
  }
  // (what the panel shows depends on: the tool, what's picked, a path being drawn)
  function keyNow() {
    var list = picked(), one = list.length === 1 ? list[0] : null;
    return cat + '|' + tool + '|' + sel.join(',') + '|' + (one && one.live ? one.live.k : '') + '|' + Object.keys(asel).map(function (k) { return k + Object.keys(asel[k]).length; }).join(',') + '|' + (pen ? 'p' : '') + (cv ? 'c' : '') + '|' + (one && one.type === 'path' ? one.app.length : '') + '|' + wpick + '|' + (tool === 'gradient' ? (function () { var gi = gradItem(); return gi && gi.p ? gi.p.t : '-'; })() : '') + (tool === 'vwidth' ? (function () { var si = strokeItemOne(); return si && si.prof ? 'p' : ''; })() : '') + '|' + keyExtra();
  }
  function keyExtra() {
    var l = picked(), one = l.length === 1 ? l[0] : null;
    return (te ? 'e' : '') + (one && one.type === 'text' ? 'T' + one.kind : '') + (one && one.type === 'path' ? (one.d.length > 1 ? 'm' : '') + (one.rule || '') : '') + (one && one.clip ? 'c' : '') + (l.some(function (n) { return n.type === 'text'; }) ? 't' : '') +
      (tool === 'scale' ? TS.scale.uni : '') + (tool === 'reflect' ? TS.reflect.axis : '') + (ALIGNT[tool] ? TS.align.to : '') + (tool === 'chedit' && chs ? 'g' + chs.u : '') + (tool === 'vbrush' ? TS.vbrush.kind : '') + (XF[tool] || tool === 'builder' || tool === 'smooth' || tool === 'veraser' ? (xfList().length ? 'p' : '') : '') + '|' + keyFx();
  }
  // (stage 4: effects on what's picked, the boards, guides, patterns, a measurement)
  function keyFx() {
    var l = picked();
    return l.map(function (n) { return (n.efx ? n.efx.k : '') + (n.blnd ? 'b' + n.blnd.smooth : '') + (n.rep ? 'r' + n.rep.k : '') + (n.omask ? 'm' : '') + (n.iso ? 'i' : '') + n.type[0]; }).join('') +
      (tool === 'repeat' ? TS.repeat.k : '') + (tool === 'vblend' ? TS.vblend.mode : '') + (tool === 'pattern' ? doc.pats.length + (patItem() ? 'i' : '') + TS.pattern.cur + TS.pattern.to : '') +
      (ABT[tool] ? doc.ab + doc.boards.length + (tool === 'abarr' ? TS.abarr.layout + doc.boards.map(function (b) { return b.id + Math.round(b.w) + 'x' + Math.round(b.h); }).join() : '') : '') +
      (tool === 'guides' ? doc.guides.length : '') + (tool === 'measure' && meas ? 'm' : '') + (l.some(function (n) { return n.type === 'image'; }) ? TS.trace.mode : '');
  }
  function anyPicked() { return picked().filter(editable).length > 0; }
  function liveOne(kind) { var l = picked(); return l.length === 1 && l[0].type === 'path' && l[0].live && (!kind || l[0].live.k === kind) && editable(l[0]) ? l[0] : null; }
  var SHAPE_FIELDS = {
    rect: [['w', 'Width'], ['h', 'Height']], rrect: [['w', 'Width'], ['h', 'Height'], ['r', 'Corner Radius']], ellipse: [['w', 'Width'], ['h', 'Height']],
    polygon: [['r', 'Radius'], ['n', 'Sides', 3, 64]], star: [['r', 'Radius 1'], ['r2', 'Radius 2'], ['n', 'Points', 3, 64]],
    spiral: [['r', 'Radius'], ['decay', 'Decay %', 5, 99], ['segs', 'Segments', 1, 200]], line: [['len', 'Length'], ['ang', 'Angle °', -360, 360]],
    arc: [['w', 'Length X'], ['h', 'Length Y'], ['slope', 'Slope', -100, 100]], rgrid: [['w', 'Width'], ['h', 'Height'], ['rows', 'Rows', 1, 100], ['cols', 'Columns', 1, 100]],
    pgrid: [['w', 'Width'], ['h', 'Height'], ['rings', 'Rings', 1, 100], ['spokes', 'Spokes', 0, 180]]
  };
  function shapeSettings(t) {
    var f = SHAPE_FIELDS[t], one = liveOne(t);
    var out = hint(one ? 'The picked ' + SHAPE_NAMES[t].toLowerCase() + '’s settings: change them and it follows' : cap1(TOOLS[t].tip.replace(/^[^:]*: /, '')));
    out += '<div class="vec-fields vec-1col">' + f.map(function (q) { return num('L.' + q[0], q[1], q[2] != null ? q[2] : 0, q[3] != null ? q[3] : 100000, 1); }).join('') + '</div>';
    if (t === 'spiral') out += segc('L.cw', 'Direction', [['1', 'Clockwise'], ['0', 'Anticlockwise']]);
    if (t === 'arc') out += chip('L.closed', 'Closed', '<path d="M5 19C5 11 11 5 19 5V19z"/>', 'Closed: the arc and the two straight sides back to its corner') + chip('T.arc.fill', 'Fill Arc', ICONS.solid, 'New arcs take the fill colour');
    if (t === 'rgrid') out += chip('L.frame', 'Outer Frame', ICONS.rect, 'The outside as one rectangle') + chip('T.rgrid.fill', 'Fill Grid', ICONS.solid, 'New grids take the fill colour');
    if (t === 'pgrid') out += chip('T.pgrid.fill', 'Fill Grid', ICONS.solid, 'New grids take the fill colour');
    return out + sep + colourRow('f', 'Fill') + colourRow('s', 'Stroke') + slider('sw', 'Stroke Width', 0, 100, 0.5);
  }
  function objSettings() {
    var list = picked(), one = list.length === 1 ? list[0] : null;
    if (!list.length) return hint('Tap an object to pick it · drag round several · <b>Shift</b> adds or takes away') + hint(esc(AB().name) + ' ' + Math.round(AB().w) + ' × ' + Math.round(AB().h)) + btn('selectall', 'Select All', '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="2.5 2"/>', 'Pick everything (Ctrl/⌘ A)');
    var lv = one && one.type === 'path' && one.live;
    var out = (one ? '<label class="ctx-field vec-name"><span>Name</span><input type="text" class="p-field" maxlength="40" data-vk="name" aria-label="Name"></label>' : '<div class="vec-count">' + list.length + ' objects</div>') +
      '<div class="vec-fields">' + num('x', 'X', null, null, 1) + num('y', 'Y', null, null, 1) + num('w', 'W', 0, null, 1) + num('h', 'H', 0, null, 1) + '</div>';
    if (lv && SHAPE_FIELDS[lv.k]) out += sub(SHAPE_NAMES[lv.k]) + '<div class="vec-fields vec-1col">' + SHAPE_FIELDS[lv.k].filter(function (q) { return !/^(w|h)$/.test(q[0]) || !BOXY[lv.k]; }).map(function (q) { return num('L.' + q[0], q[1], q[2] != null ? q[2] : 0, q[3] != null ? q[3] : 100000, 1); }).join('') + '</div>';
    var txt = list.filter(function (n) { return n.type === 'text'; });
    if (txt.length) out += sub('Text') + typeFields(txt.every(function (n) { return n.kind === 'path'; })) + btn('outlines', 'Convert to Outlines', ICONS.outlines, 'The letters as paths (Ctrl/⌘ Shift O)');
    if (targets().length) out += colourRow('f', 'Fill') + colourRow('s', 'Stroke') + slider('sw', 'Stroke Width', 0, 100, 0.5);
    if (one && one.type === 'path' && one.d.length > 1) out += sub('Fill rule') + segc('rule', 'Fill rule', [['nonzero', 'Non-Zero', 'Overlapping parts are filled, holes that go the other way stay empty'], ['evenodd', 'Even-Odd', 'Every other overlap is a hole']]);
    out += slider('op', 'Opacity', 0, 100, 1, 'How solid it is: fade a picture to trace over it') + selBox('blend', 'Blend', BLENDS) + sep +
      chip('hide', 'Hidden', '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.4 3M6.5 7.6C4 9.3 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 4-.9"/>', 'Hidden: out of sight, and out of the way when picking') +
      chip('lock', 'Locked', '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/>', 'Locked: it stays put, and can’t be picked on the artboard (unlock it in Layers)') + sep;
    if (list.length > 1) out += btn('group', 'Group', IC.group, 'Group them (Ctrl/⌘ G)');
    if (list.some(function (n) { return n.type === 'group'; })) out += btn('ungroup', 'Ungroup', IC.ungroup, 'Ungroup (Ctrl/⌘ Shift G)');
    out += btn('dup', 'Duplicate', IC.dup, 'A copy, just below and to the right (Ctrl/⌘ D)') + btn('fwd', 'Bring Forward', IC.up, 'Up one in its layer (Ctrl/⌘ ])') + btn('back', 'Send Backward', IC.down, 'Down one in its layer (Ctrl/⌘ [)');
    if (list.some(function (n) { return n.type === 'image'; })) out += btn('fitboard', 'Fit to Artboard', ICONS.fit, 'As big as fits on the artboard, in the middle') + traceSettings();
    if (list.some(hasFx)) out += btn('fxexpandall', 'Expand Effects', IC.dup, 'Warps, envelopes, blends and repeats made into plain objects');
    if (list.some(function (n) { return n.omask; })) out += btn('omrelease', 'Release Opacity Mask', IC.ungroup, 'The mask and what it masked, apart again');
    if (one && one.clip) out += btn('clipmask', 'Release Clipping Mask', ICONS.clipmask, 'The clipping path and what it clipped, apart again (Ctrl/⌘ 7)');
    if (one && one.type === 'path' && one.d.length > 1) out += btn('compound', 'Release Compound Path', ICONS.compound, 'Each part a path of its own (Ctrl/⌘ 8)');
    return out + btn('del', 'Delete', IC.trash, 'Delete (Del)');
  }
  // IMAGE TRACE (for a picked picture): colours, threshold, how small a speck is kept, how smooth
  var TRACE_IC = '<rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke-dasharray="2 2" opacity=".55"/><path d="M6.5 16.5l4-5 3 3.5 2-2 2 3.5z"/><circle cx="15.5" cy="8.5" r="1.5"/>';
  function traceSettings() {
    var S = TS.trace;
    return sub('Image Trace') + segc('T.trace.mode', 'Trace mode', [['bw', 'Black & White'], ['grey', 'Greys'], ['colour', 'Colours']]) +
      (S.mode === 'bw' ? slider('T.trace.th', 'Threshold', 1, 255, 1, 'Darker than this is black') : slider('T.trace.n', 'Colours', 2, 16, 1)) +
      slider('T.trace.noise', 'Noise', 0, 20, 1, 'Specks smaller than this many pixels across are left out') + slider('T.trace.smooth', 'Smoothness', 0, 100, 1, 'Fewer points, rounder curves') +
      (S.mode === 'bw' ? '' : chip('T.trace.white', 'Ignore White', '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 20L20 4"/>', 'White areas aren’t traced')) +
      btn('trace', 'Trace', TRACE_IC, 'The picture as filled paths, on top of it');
  }
  function nAnchors() { var c = 0; Object.keys(asel).forEach(function (id) { c += Object.keys(asel[id]).length; }); return c; }
  function anchorSettings(h) {
    var n = nAnchors(), out = hint(h);
    if (n) {
      out += '<div class="vec-count">' + n + (n === 1 ? ' anchor point' : ' anchor points') + '</div>';
      if (n === 1) out += '<div class="vec-fields">' + num('ax', 'X', null, null, 1) + num('ay', 'Y', null, null, 1) + '</div>';
      out += btn('acorner', 'Corner', IC.corner, 'Make the picked points corners') + btn('asmooth', 'Smooth', IC.smooth, 'Make the picked points smooth') +
        btn('acut', 'Cut at Points', ICONS.scissors, 'Cut the path at the picked points') + btn('adel', 'Remove Points', ICONS.delpt, 'Take the picked points away (Del)');
    }
    return out;
  }
  var SET = {
    select: objSettings, groupsel: objSettings,
    direct: function () { var o = anchorSettings('Tap a point, or drag round several · drag a handle to bend · <b>Alt</b> moves one handle on its own'); return Object.keys(asel).length ? o : o + objOrNothing(); },
    lasso: function () { return segc('T.lasso.what', 'Lasso picks', [['anchors', 'Anchor Points'], ['objects', 'Objects']]) + anchorSettings('Draw round what to pick · <b>Shift</b> adds'); },
    wand: function () {
      return hint('Tap an object: everything like it is picked · <b>Shift</b> adds') + sub('Alike in') + chip('T.wand.fill', 'Fill Color', ICONS.solid) + chip('T.wand.stroke', 'Stroke Color', ICONS.swidth) +
        chip('T.wand.width', 'Stroke Width', ICONS.swidth) + chip('T.wand.op', 'Opacity', ICONS.opacity) + chip('T.wand.blend', 'Blend Mode', ICONS.blend) + slider('T.wand.tol', 'Tolerance', 0, 255, 1, 'How alike counts');
    },
    pen: function () {
      return hint(pen ? 'Click to add a point · drag to curve · click the first point to close · <b>Return</b> to finish' : 'Click for a corner, drag for a curve · click an open end to carry on a path') +
        chip('T.pen.auto', 'Add & Delete', ICONS.addpt, 'On a picked path: tap a segment to add a point, a point to take it away') +
        (pen ? btn('penclose', 'Close Path', '<path d="M5 18C8 6 16 6 19 18z"/>', 'Join the last point to the first') + btn('pendone', 'Finish', null, 'Finish the path (Return)', 'ctx-done') : '');
    },
    curvature: function () { return hint(cv ? 'Click to add points: the path curves through them · double-click a point for a corner · click the first to close' : 'Click points and the path curves smoothly through them · drag a point to move it · <b>Alt</b>-click for a corner') + (cv ? btn('cvdone', 'Finish', null, 'Finish the path (Return)', 'ctx-done') : ''); },
    anchor: function () { return hint('Tap a curved point for a corner · drag a point to pull out handles · drag a handle on its own · drag a segment to bend it'); },
    addpt: function () { return hint('Tap a path to add an anchor point; its shape stays the same'); },
    delpt: function () { return hint('Tap an anchor point to take it away; the path keeps as near its shape as it can'); },
    convert: function () { return anchorSettings('Tap a point: corner or smooth · tap a segment: straight or curved · drag a point to pull out handles'); },
    scissors: function () { return hint('Tap a path to cut it: a closed shape opens there, an open path becomes two'); },
    knife: function () { return hint('Drag right across shapes to cut them into pieces' + (anyPicked() ? ' (just the picked ones)' : '')); },
    join: function () { return hint('Drag from an open end to another to join them · or join what’s picked') + btn('joinpicked', 'Join Picked', ICONS.join, 'Join the picked open paths at their nearest ends, or close one (Ctrl/⌘ J)'); },
    simplify: function () {
      return hint('Tap a path, or pick some and use Simplify') + slider('T.simplify.tol', 'Closeness', 0.25, 20, 0.25, 'How far the simplified path may stray, in the artboard’s pixels: more is simpler') +
        chip('T.simplify.corner', 'Keep Corners', IC.corner, 'Sharp corners stay sharp') + (anyPicked() ? '<div class="vec-count" data-vcount></div>' + btn('simplify', 'Simplify', ICONS.simplify, 'Simplify the picked paths') : '');
    },
    solid: function () { return hint('Tap objects to fill them with the fill colour') + colourRow('f', 'Fill') + btn('fillnone', 'No Fill', IC.none, 'No fill (/)') + (anyPicked() ? btn('fillpicked', 'Fill Picked', ICONS.solid, 'The picked objects take the fill') : ''); },
    gradient: function () {
      var it = gradItem(), g = it && isGrad(it.p) ? it.p : null;
      var out = hint(g ? 'Drag across the object to point the gradient · drag its ends to move them · tap a stop to change its colour' : 'Tap an object to give it a gradient · drag across one to point it') +
        segc('T.gradient.to', 'Gradient on', [['f', 'Fill'], ['s', 'Stroke']]) + segc('gkind', 'Kind', [['l', 'Linear'], ['r', 'Radial']]);
      if (g) out += '<div class="ctx-gbar vec-gbar" data-vgbar data-tip="The stops: tap to add one, drag one along, or off the bar to take it away"><i></i></div>' + colourRow('stop', 'Stop Color') + slider('gso', 'Stop Opacity', 0, 100, 1) + slider('gpos', 'Stop Position', 0, 100, 1) +
        (g.t === 'l' ? slider('gang', 'Angle', -180, 180, 1) : '') + btn('greverse', 'Reverse', IC.reverse, 'Turn the gradient end to end') + btn('gsolid', 'Solid Color', ICONS.solid, 'Back to a solid colour');
      return out;
    },
    eyedropper: function () { return hint('Tap an object to copy how it looks onto what’s picked (and new objects) · <b>Shift</b>-tap: just the colour under the pointer, into the') + segc('T.cpick.to', 'Into', [['f', 'Fill'], ['s', 'Stroke']]); },
    swatches: function () {
      var P = B.palettes ? B.palettes() : [], sw = function (c) { return '<button type="button" class="vec-swatch" data-vsw-c="' + c + '" style="background:' + c + '" aria-label="' + c + '" data-tip="' + c + '"></button>'; };
      return segc('T.swatches.to', 'Swatches for', [['f', 'Fill'], ['s', 'Stroke']]) + sub('Document') +
        '<div class="vec-swatches"><button type="button" class="vec-swatch vec-none" data-vsw-c="none" aria-label="None" data-tip="None"></button>' + doc.sw.map(sw).join('') +
        '<button type="button" class="vec-swatch vec-add" data-va="swadd" aria-label="Add the colour" data-tip="Add the fill (or stroke) colour to the document’s swatches">' + CI(IC.plus) + '</button></div>' +
        (doc.sw.length ? hint('Right-click (or press and hold) a swatch to take it out') : '') +
        P.slice(0, 6).map(function (p) { return sub(esc(p.name)) + '<div class="vec-swatches">' + p.colors.map(sw).join('') + '</div>'; }).join('');
    },
    vfill: function () { return hint('Tap inside a shape to fill it, or inside an area that lines close off to fill just that area with a new shape') + colourRow('f', 'Fill'); },
    cpick: function () {
      return segc('T.cpick.to', 'Color for', [['f', 'Fill'], ['s', 'Stroke']]) + '<label class="ctx-field vec-name"><span>Hex</span><input type="text" class="p-field" maxlength="7" spellcheck="false" data-vk="cp.hex" aria-label="Hex"></label>' +
        slider('cp.h', 'Hue', 0, 360, 1) + slider('cp.s', 'Saturation', 0, 100, 1) + slider('cp.b', 'Brightness', 0, 100, 1) + slider('cp.o', 'Opacity', 0, 100, 1) +
        btn('cpnone', 'None', IC.none, 'No fill (or no stroke)') + btn('cpmore', 'Color Picker…', ICONS.cpick, 'The full colour picker: palettes, harmonies and recent colours');
    },
    swidth: function () { return colourRow('s', 'Stroke') + slider('sw', 'Width', 0, 100, 0.25) + num('swn', 'Width', 0, 1000, 0.25) + hint('For the picked objects, and the next ones drawn'); },
    vwidth: function () {
      var it = strokeItemOne(), p = it && it.prof && it.prof[wpick];
      return hint('Drag out from a stroke to make it wider there · <b>Alt</b>-drag a width point along · double-tap one to take it away') +
        (p ? '<div class="vec-fields">' + num('wp.t', 'Position %', 0, 100, 1) + num('wp.w', 'Width', 0, 2000, 0.5) + '</div>' + btn('wpdel', 'Remove Point', IC.trash, 'Take the width point away') : '') +
        (it && it.prof ? btn('wreset', 'Uniform Width', ICONS.swidth, 'The same width all along again') : '');
    },
    sprofile: function () {
      return hint('A profile for the picked strokes (and the next ones)') + '<div class="vec-profiles">' + PROFILES.map(function (pr) {
        var it = { w: 10, cap: 'butt', prof: pr[2] ? pr[2].map(function (q) { return { t: q[0], w: q[1] }; }) : null }, d = [{ pts: [P(4, 12), P(60, 12)], closed: false }];
        var pv = pr[2] ? '<path d="' + outlineD(d, it) + '" fill="currentColor" stroke="none"/>' : '<path d="M4 12h56" stroke-width="10" stroke-linecap="butt"/>';
        return '<button type="button" class="vec-profile" data-vprof="' + pr[0] + '" aria-label="' + pr[1] + '" data-tip="' + pr[1] + '"><svg viewBox="0 0 64 24" aria-hidden="true">' + pv + '</svg><span>' + pr[1] + '</span></button>';
      }).join('') + '</div>' + btn('pflip', 'Flip', IC.reverse, 'Turn the profile end to end');
    },
    capjoin: function () {
      return sub('Cap') + segc('cap', 'Cap', [['butt', 'Butt', 'Butt: the stroke stops at the end', '<path d="M5 12h11" stroke-width="6" stroke-linecap="butt"/><path d="M16 6v12" stroke-width="1"/>'], ['round', 'Round', 'Round: a half circle past the end', '<path d="M5 12h11" stroke-width="6" stroke-linecap="round"/><path d="M16 6v12" stroke-width="1"/>'], ['square', 'Projecting', 'Projecting: a half square past the end', '<path d="M5 12h11" stroke-width="6" stroke-linecap="square"/><path d="M16 6v12" stroke-width="1"/>']]) +
        sub('Corner') + segc('join', 'Corner', [['miter', 'Miter', 'Miter: a sharp point', '<path d="M6 18V8h12" stroke-width="5" stroke-linejoin="miter"/>'], ['round', 'Round', 'Round', '<path d="M6 18V8h12" stroke-width="5" stroke-linejoin="round"/>'], ['bevel', 'Bevel', 'Bevel: cut off', '<path d="M6 18V8h12" stroke-width="5" stroke-linejoin="bevel"/>']]) +
        slider('ml', 'Miter Limit', 1, 30, 0.5, 'How far a sharp corner may reach before it’s cut off');
    },
    dash: function () {
      return chip('dashon', 'Dashed Line', ICONS.dash, 'Dashes and gaps along the stroke') + '<div class="vec-fields">' + num('d0', 'Dash', 0, 1000, 0.5) + num('g0', 'Gap', 0, 1000, 0.5) + num('d1', 'Dash', 0, 1000, 0.5) + num('g1', 'Gap', 0, 1000, 0.5) + '</div>' +
        btn('dashp1', 'Dashes', '<path d="M3 12h5M11 12h5M19 12h2"/>', 'Even dashes') + btn('dashp2', 'Dots', '<path d="M4 12h.01M9 12h.01M14 12h.01M19 12h.01" stroke-width="3" stroke-linecap="round"/>', 'Round dots (a round cap, a dash of 0)') + btn('dashp3', 'Dash Dot', '<path d="M3 12h6M13 12h.01M17 12h4" stroke-linecap="round"/>', 'A dash, then a dot');
    },
    appear: function () {
      var app = shownApp(), lone = targets().length <= 1;
      var rows = app.map(function (it, i) { return { it: it, i: i }; }).reverse().map(function (q) {
        var it = q.it, i = q.i;
        return '<div class="vec-arow' + ((it.k === 'f' ? focusF : focusS) === i ? ' on' : '') + '">' +
          '<button type="button" class="pl-eye" data-va="aeye-' + i + '" aria-pressed="' + !it.on + '" aria-label="' + (it.on ? 'Hide' : 'Show') + '">' + CI(it.on ? '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>' : '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.4 3M6.5 7.6C4 9.3 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 4-.9"/>') + '</button>' +
          '<button type="button" class="vec-aname" data-va="afocus-' + i + '"><i class="vec-sw' + (it.p ? '' : ' none') + (it.k === 's' ? ' ring' : '') + '" style="--sw:' + (paintCss(it.p) || 'transparent') + '"></i><span>' + (it.k === 'f' ? 'Fill' : 'Stroke ' + r2(it.w)) + '</span></button>' +
          '<button type="button" class="pl-eye" data-va="aup-' + i + '" aria-label="Up"' + (i < app.length - 1 ? '' : ' disabled') + '>' + CI(IC.up) + '</button>' +
          '<button type="button" class="pl-eye" data-va="adel-' + i + '" aria-label="Remove"' + (app.length > 1 ? '' : ' disabled') + '>' + CI(IC.trash) + '</button></div>';
      }).join('');
      return hint(lone ? 'Fills and strokes, the top one drawn last · tap one to change its colour and width' : 'Pick one object to see its fills and strokes') + (lone ? '<div class="vec-alist">' + rows + '</div>' + btn('afill', 'Add Fill', IC.plus, 'Another fill') + btn('astroke', 'Add Stroke', IC.plus, 'Another stroke') : '');
    },
    opacity: function () { return slider('op', 'Opacity', 0, 100, 1, 'The whole object') + slider('fop', 'Fill Opacity', 0, 100, 1) + slider('sop', 'Stroke Opacity', 0, 100, 1) + hint('For the picked objects, and the next ones drawn'); },
    blend: function () { return hint('How the picked objects mix with what’s under them') + '<div class="vec-blends">' + BLENDS.map(function (b) { return '<button type="button" class="vec-blend" data-vk="blend" data-val="' + b[0] + '">' + b[1] + '</button>'; }).join('') + '</div>'; },
    hand: function () { return hint('Drag to move round the artboard. With any tool: hold <b>Space</b>, drag with the middle button, scroll, or use two fingers (twist to turn)'); },
    zoom: function () { return hint('Tap to zoom in · <b>Alt</b>-tap to zoom out · drag a box to zoom to it') + '<div class="vec-zoomrow">' + btn('zoomout', 'Zoom Out', '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5"/>') + btn('zoomin', 'Zoom In', ICONS.zoom) + '</div>'; },
    rotview: function () { return hint('Drag to turn the view; the artwork itself stays as it is · <b>Shift</b> for steps of 15°') + slider('rot', 'Angle', -180, 180, 1) + btn('rotreset', 'Upright', ICONS.rotview, 'Back upright'); }
  };
  ['rect', 'rrect', 'ellipse', 'polygon', 'star', 'spiral', 'line', 'arc', 'rgrid', 'pgrid'].forEach(function (t) { SET[t] = function () { return shapeSettings(t); }; });
  function objOrNothing() { return picked().length ? sep + btn('del', 'Delete', IC.trash, 'Delete (Del)') : ''; }
  function gradItem() { var t = targets(); var app = t.length ? t[t.length - 1].app : null; return app ? itemOf(app, TS.gradient.to === 's' ? 's' : 'f', false) : null; }
  function strokeItemOne() { var t = targets(); return t.length ? itemOf(t[t.length - 1].app, 's', false) : null; }
  function bboxPicked() { return boxOf(picked().filter(editable)); }
  var hsvNow = null;
  function hsvOf(hex) { var n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx2 = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx2 - mn, h = 0; if (d) h = mx2 === r ? ((g - b) / d + 6) % 6 : mx2 === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, mx2 ? d / mx2 : 0, mx2]; }
  function hexOf(h, s, v) { var f = function (n) { var k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return '#' + [f(5), f(3), f(1)].map(function (x) { return ('0' + Math.round(x * 255).toString(16)).slice(-2); }).join(''); }
  // (every control's value, and how it's set: get, set(v), and the step's name)
  var BK = {
    name: { get: function () { var l = picked(); return l.length === 1 ? l[0].name : ''; }, set: function (v) { var l = picked(); if (l.length === 1 && v.trim()) { l[0].name = v.trim().slice(0, 40); delete l[0].auto; } }, label: 'Rename', text: true },
    x: { get: function () { var b = bboxPicked(); return b ? b.x - AB().x : ''; }, set: function (v) { var b = bboxPicked(); v = +v + AB().x; if (b) picked().filter(editable).forEach(function (n) { xform(n, [1, 0, 0, 1, v - b.x, 0]); }); }, label: 'Position' },
    y: { get: function () { var b = bboxPicked(); return b ? b.y - AB().y : ''; }, set: function (v) { var b = bboxPicked(); v = +v + AB().y; if (b) picked().filter(editable).forEach(function (n) { xform(n, [1, 0, 0, 1, 0, v - b.y]); }); }, label: 'Position' },
    w: { get: function () { var b = bboxPicked(); return b ? b.w : ''; }, set: function (v) { var b = bboxPicked(); if (b && b.w > 0 && v > 0) picked().filter(editable).forEach(function (n) { xform(n, [v / b.w, 0, 0, 1, b.x - b.x * v / b.w, 0]); }); }, label: 'Size' },
    h: { get: function () { var b = bboxPicked(); return b ? b.h : ''; }, set: function (v) { var b = bboxPicked(); if (b && b.h > 0 && v > 0) picked().filter(editable).forEach(function (n) { xform(n, [1, 0, 0, v / b.h, 0, b.y - b.y * v / b.h]); }); }, label: 'Size' },
    op: { get: function () { var l = picked(); return Math.round((l.length ? (l[l.length - 1].opacity == null ? 1 : l[l.length - 1].opacity) : doc.def.op) * 100); }, set: function (v) { v = Math.max(0, Math.min(100, v)) / 100; picked().filter(editable).forEach(function (n) { n.opacity = v; }); doc.def.op = v; }, label: 'Opacity', fmt: function (v) { return v + '%'; } },
    blend: { get: function () { var l = picked(); return l.length ? l[l.length - 1].blend || 'normal' : doc.def.blend; }, set: function (v) { picked().filter(editable).forEach(function (n) { n.blend = v; }); doc.def.blend = v; }, label: 'Blend Mode', text: true },
    hide: { get: function () { var l = picked(); return l.length && l.every(function (n) { return !n.visible; }); }, set: function (v) { picked().forEach(function (n) { n.visible = !v; }); }, label: 'Hide' },
    lock: { get: function () { var l = picked(); return l.length && l.every(function (n) { return n.locked; }); }, set: function (v) { picked().forEach(function (n) { n.locked = !!v; }); }, label: 'Lock' },
    sw: { get: function () { var it = itemNow('s'); return it ? it.w : 0; }, set: function (v) { setStrokeW(v); }, label: 'Stroke Width', fmt: function (v) { return r2(v) + ' px'; } },
    swn: { get: function () { var it = itemNow('s'); return it ? r2(it.w) : 0; }, set: function (v) { setStrokeW(v); }, label: 'Stroke Width' },
    ml: { get: function () { var it = itemNow('s'); return it ? it.ml : 10; }, set: function (v) { eachItem('s', function (it) { it.ml = v; }, true); }, label: 'Miter Limit', fmt: function (v) { return r2(v); } },
    cap: { get: function () { var it = itemNow('s'); return it ? it.cap : 'butt'; }, set: function (v) { eachItem('s', function (it) { it.cap = v; }, true); }, label: 'Cap', text: true },
    join: { get: function () { var it = itemNow('s'); return it ? it.join : 'miter'; }, set: function (v) { eachItem('s', function (it) { it.join = v; }, true); }, label: 'Corner', text: true },
    dashon: { get: function () { var it = itemNow('s'); return !!(it && it.dash && it.dash.length); }, set: function (v) { eachItem('s', function (it) { it.dash = v ? [Math.max(1, it.w * 3), Math.max(1, it.w * 2)] : null; }, true); }, label: 'Dashes' },
    fop: { get: function () { var it = itemNow('f'); return Math.round((it ? it.o : 1) * 100); }, set: function (v) { eachItem('f', function (it) { it.o = Math.max(0, Math.min(100, v)) / 100; }, true); }, label: 'Fill Opacity', fmt: function (v) { return v + '%'; } },
    sop: { get: function () { var it = itemNow('s'); return Math.round((it ? it.o : 1) * 100); }, set: function (v) { eachItem('s', function (it) { it.o = Math.max(0, Math.min(100, v)) / 100; }, true); }, label: 'Stroke Opacity', fmt: function (v) { return v + '%'; } },
    gkind: { get: function () { var it = gradItem(); return it && isGrad(it.p) ? it.p.t : TS.gradient.kind; }, set: function (v) { TS.gradient.kind = v; tsSave(); eachGrad(function (g) { if (g.t === v) return; if (v === 'r') { g.t = 'r'; g.cx = 0.5; g.cy = 0.5; g.r = 0.5; } else { g.t = 'l'; g.x1 = 0; g.y1 = 0.5; g.x2 = 1; g.y2 = 0.5; } }); }, label: 'Gradient', text: true },
    gang: { get: function () { var it = gradItem(); var g = it && it.p; return g && g.t === 'l' ? Math.round(Math.atan2(g.y2 - g.y1, g.x2 - g.x1) * 180 / Math.PI) : 0; }, set: function (v) { var a = v * Math.PI / 180; eachGrad(function (g) { if (g.t !== 'l') return; var cx = (g.x1 + g.x2) / 2, cy = (g.y1 + g.y2) / 2, L = Math.max(0.05, Math.hypot(g.x2 - g.x1, g.y2 - g.y1) / 2); g.x1 = cx - Math.cos(a) * L; g.y1 = cy - Math.sin(a) * L; g.x2 = cx + Math.cos(a) * L; g.y2 = cy + Math.sin(a) * L; }); }, label: 'Gradient Angle', fmt: function (v) { return v + '°'; } },
    gso: { get: function () { var st = stopNow(); return st ? Math.round(st.o * 100) : 100; }, set: function (v) { eachGrad(function (g) { var s = g.st[Math.min(gstop, g.st.length - 1)]; s.o = v / 100; }); }, label: 'Stop Opacity', fmt: function (v) { return v + '%'; } },
    gpos: { get: function () { var st = stopNow(); return st ? Math.round(st.t * 100) : 0; }, set: function (v) { eachGrad(function (g) { var s = g.st[Math.min(gstop, g.st.length - 1)]; s.t = Math.max(0, Math.min(1, v / 100)); g.st.sort(function (a, b) { return a.t - b.t; }); gstop = g.st.indexOf(s); }); }, label: 'Stop Position', fmt: function (v) { return v + '%'; } },
    ax: { get: function () { var a = oneAnchor(); return a ? a.q.x - AB().x : ''; }, set: function (v) { var a = oneAnchor(); if (a) { moveAnchor(a.q, +v + AB().x - a.q.x, 0); unlive(a.n); } }, label: 'Move Point' },
    ay: { get: function () { var a = oneAnchor(); return a ? a.q.y - AB().y : ''; }, set: function (v) { var a = oneAnchor(); if (a) { moveAnchor(a.q, 0, +v + AB().y - a.q.y); unlive(a.n); } }, label: 'Move Point' },
    'wp.t': { get: function () { var it = strokeItemOne(), p = it && it.prof && it.prof[wpick]; return p ? Math.round(p.t * 100) : ''; }, set: function (v) { var it = strokeItemOne(), p = it && it.prof && it.prof[wpick]; if (p) { p.t = Math.max(0, Math.min(1, v / 100)); it.prof.sort(function (a, b) { return a.t - b.t; }); wpick = it.prof.indexOf(p); } }, label: 'Width' },
    'wp.w': { get: function () { var it = strokeItemOne(), p = it && it.prof && it.prof[wpick]; return p ? r2(p.w * it.w) : ''; }, set: function (v) { var it = strokeItemOne(), p = it && it.prof && it.prof[wpick]; if (p && it.w > 0) p.w = Math.max(0, v / it.w); }, label: 'Width' },
    rot: { get: function () { return Math.round(((view.r * 180 / Math.PI) % 360 + 540) % 360 - 180); }, set: function (v) { rotateAt(v * Math.PI / 180, stageEl.clientWidth / 2, stageEl.clientHeight / 2); }, view: true, fmt: function (v) { return v + '°'; } },
    'cp.hex': { get: function () { return (pcGet(TS.cpick.to === 's' ? 'second' : 'main') || '').toUpperCase(); }, set: function (v) { var m = v.trim().replace(/^#?/, '#'); if (/^#[0-9a-f]{3}$/i.test(m)) m = '#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]; if (HEX.test(m)) setColour(TS.cpick.to === 's' ? 'second' : 'main', m.toLowerCase()); }, text: true, own: true },
    'cp.h': { get: function () { return Math.round(cpHsv()[0]); }, set: function (v) { cpSet(0, v); }, own: true, fmt: function (v) { return v + '°'; } },
    'cp.s': { get: function () { return Math.round(cpHsv()[1] * 100); }, set: function (v) { cpSet(1, v / 100); }, own: true, fmt: function (v) { return v + '%'; } },
    'cp.b': { get: function () { return Math.round(cpHsv()[2] * 100); }, set: function (v) { cpSet(2, v / 100); }, own: true, fmt: function (v) { return v + '%'; } },
    'cp.o': { get: function () { var it = itemNow(TS.cpick.to); return Math.round((it ? it.o : 1) * 100); }, set: function (v) { eachItem(TS.cpick.to, function (it) { it.o = v / 100; }, true); }, label: 'Opacity', fmt: function (v) { return v + '%'; } }
  };
  ['d0', 'g0', 'd1', 'g1'].forEach(function (k, j) {
    BK[k] = { get: function () { var it = itemNow('s'); return it && it.dash && it.dash[j] != null ? r2(it.dash[j]) : ''; }, set: function (v) { eachItem('s', function (it) { var d = it.dash ? it.dash.slice() : []; while (d.length < j) d.push(d.length % 2 ? 2 : 4); d[j] = Math.max(0, v); if (d.length === 3) d.length = 2; it.dash = d.some(function (x) { return x > 0; }) ? d : null; }, true); }, label: 'Dashes' };
  });
  // ---- THE NEW CATEGORIES' SETTINGS ----
  function ibtn(a, label, icon) { return '<button type="button" class="ctx-btn vec-ibtn" data-va="' + a + '" aria-label="' + esc(label) + '" data-tip="' + esc(label) + '">' + CI(icon) + '</button>'; }
  var REFN = { nw: 'Top left', n: 'Top', ne: 'Top right', w: 'Left', c: 'Middle', e: 'Right', sw: 'Bottom left', s: 'Bottom', se: 'Bottom right' };
  function refGrid() { return '<div class="vec-refrow"><span>Reference point</span><div class="vec-ref" role="group" aria-label="Reference point">' + ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se'].map(function (k) { return '<button type="button" data-vk="xref" data-val="' + k + '" aria-label="' + REFN[k] + '" data-tip="Transform from the ' + REFN[k].toLowerCase() + '"><i></i></button>'; }).join('') + '</div></div>'; }
  function pickHint(t) { return xfList().length ? hint(t) : hint('Pick something first: tap it, or drag round it'); }
  var BRUSHES = [['round', 'Round'], ['taper', 'Tapered'], ['pen', 'Brush Pen'], ['callig', 'Calligraphic']];
  function fontSel() {
    var F = B.fonts ? B.fonts() : [['sans-serif', 'Sans Serif', 'Built In']], out = '', g = '';
    F.forEach(function (f) { if (f[2] !== g) { if (g) out += '</optgroup>'; g = f[2]; out += '<optgroup label="' + esc(g) + '">'; } out += '<option value="' + esc(f[0]) + '">' + esc(f[1]) + '</option>'; });
    return '<label class="ctx-field vec-selrow"><span>Font</span><select class="p-field" data-vk="tx.font" aria-label="Font">' + out + (g ? '</optgroup>' : '') + '</select></label>';
  }
  var ALIGN_IC = {
    l: '<path d="M4 3v18"/><rect x="7" y="6" width="12" height="4.5" rx="1"/><rect x="7" y="13.5" width="7" height="4.5" rx="1"/>', hc: '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4.5" rx="1"/><rect x="8" y="13.5" width="8" height="4.5" rx="1"/>',
    r: '<path d="M20 3v18"/><rect x="5" y="6" width="12" height="4.5" rx="1"/><rect x="10" y="13.5" width="7" height="4.5" rx="1"/>', t: '<path d="M3 4h18"/><rect x="6" y="7" width="4.5" height="12" rx="1"/><rect x="13.5" y="7" width="4.5" height="7" rx="1"/>',
    vc: '<path d="M3 12h18"/><rect x="6" y="5" width="4.5" height="14" rx="1"/><rect x="13.5" y="8" width="4.5" height="8" rx="1"/>', b: '<path d="M3 20h18"/><rect x="6" y="5" width="4.5" height="12" rx="1"/><rect x="13.5" y="10" width="4.5" height="7" rx="1"/>'
  };
  var DIST_IC = {
    l: '<path d="M4 3v18M12 3v18M20 3v18" stroke-dasharray="2 2"/><rect x="4" y="7" width="5" height="10" rx="1"/><rect x="12" y="9" width="5" height="6" rx="1"/>', hc: '<path d="M6 3v18M12 3v18M18 3v18" stroke-dasharray="2 2"/><rect x="3.5" y="7" width="5" height="10" rx="1"/><rect x="9.5" y="9" width="5" height="6" rx="1"/>',
    r: '<path d="M8 3v18M14 3v18M20 3v18" stroke-dasharray="2 2"/><rect x="3" y="7" width="5" height="10" rx="1"/><rect x="9" y="9" width="5" height="6" rx="1"/>', t: '<path d="M3 4h18M3 12h18M3 20h18" stroke-dasharray="2 2"/><rect x="7" y="4" width="10" height="5" rx="1"/><rect x="9" y="12" width="6" height="5" rx="1"/>',
    vc: '<path d="M3 6h18M3 12h18M3 18h18" stroke-dasharray="2 2"/><rect x="7" y="3.5" width="10" height="5" rx="1"/><rect x="9" y="9.5" width="6" height="5" rx="1"/>', b: '<path d="M3 8h18M3 14h18M3 20h18" stroke-dasharray="2 2"/><rect x="7" y="3" width="10" height="5" rx="1"/><rect x="9" y="9" width="6" height="5" rx="1"/>'
  };
  var ALIGN_N = { l: 'Left', hc: 'Horizontal Centre', r: 'Right', t: 'Top', vc: 'Vertical Centre', b: 'Bottom' };
  function alignTo() { return sub('Align to') + segc('T.align.to', 'Align to', [['sel', 'Selection', 'The box round everything picked'], ['key', 'Key', 'The key object stays put: tap one of the picked to make it the key'], ['board', 'Artboard', 'The artboard']]); }
  function typeFields(path) {
    var out = fontSel() + '<div class="vec-fields vec-1col">' + num('tx.size', 'Size', 1, 2000, 0.5) + num('tx.lead', 'Leading %', 50, 500, 1) + num('tx.track', 'Tracking', -500, 2000, 5) + '</div>' +
      chip('tx.bold', 'Bold', '<path d="M7 4.5h6a3.5 3.5 0 0 1 0 7H7zM7 11.5h7a4 4 0 0 1 0 8H7z" stroke-width="2.4"/>', 'Bold') + chip('tx.italic', 'Italic', '<path d="M10 4.5h8M6 19.5h8M14 4.5l-4 15"/>', 'Italic') +
      segc('tx.align', 'Align', [['left', 'Align Left', 'Align left', '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'], ['center', 'Centre', 'Centre', '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'], ['right', 'Align Right', 'Align right', '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'], ['justify', 'Justify', 'Justify (text in a box or shape)', '<path d="M4 6h16M4 10h16M4 14h16M4 18h10"/>']]);
    if (path) out += slider('tx.off', 'Start', 0, 100, 0.5, 'Where along the path the words start') + chip('tx.flip', 'Other Side', IC.reverse, 'The words along the other side of the path, the other way');
    else out += segc('tx.vert', 'Direction', [['0', 'Horizontal'], ['1', 'Vertical']]);
    return out;
  }
  function txList() { var l = []; picked().filter(editable).forEach(function (n) { leaves(n).forEach(function (q) { if (q.type === 'text' && editable(q)) l.push(q); }); }); var t = te && byId(te.id); if (t && l.indexOf(t) < 0) l.push(t); return l; }
  function txGet(f) { var l = txList(), n = l[l.length - 1]; return n ? n[f] : TS.type[f]; }
  function txSet(f, v) { txList().forEach(function (n) { n[f] = v; }); if (TS.type[f] != null) { TS.type[f] = v; tsSave(); } }
  function txPath() { var l = txList().filter(function (n) { return n.kind === 'path'; }); return l[l.length - 1] || null; }
  function textSettings(h) {
    var one = txList(), path = one.length && one.every(function (n) { return n.kind === 'path'; });
    return hint(h) + typeFields(path) + sep + colourRow('f', 'Fill') + colourRow('s', 'Stroke') + slider('sw', 'Stroke Width', 0, 100, 0.5) +
      (te ? btn('tdone', 'Done', null, 'Finish typing (Esc)', 'ctx-done') : '') + (one.length ? btn('outlines', 'Convert to Outlines', ICONS.outlines, 'The letters as paths (Ctrl/⌘ Shift O)') : '');
  }
  Object.assign(SET, {
    pencil: function () { return hint('Draw freehand; it’s smoothed into curves · start at the end of a picked path to carry it on') + slider('T.pencil.smooth', 'Smoothness', 0, 100, 1, 'More is smoother, with fewer points') + chip('T.pencil.fill', 'Fill New Lines', ICONS.solid, 'New pencil lines take the fill colour') + chip('T.pencil.close', 'Close Near Ends', '<path d="M5 18C8 6 16 6 19 18z"/>', 'A line that ends near where it began is closed') + chip('T.pencil.edit', 'Edit Picked Paths', ICONS.pencil, 'Start at an end of a picked path to carry it on') + sep + colourRow('s', 'Stroke') + slider('sw', 'Stroke Width', 0, 100, 0.5); },
    vbrush: function () {
      var S = TS.vbrush;
      return hint('Paint strokes that stay editable paths, in the stroke colour') + selBox('T.vbrush.kind', 'Brush', BRUSHES) + slider('T.vbrush.w', 'Size', 0.5, 200, 0.5) + slider('T.vbrush.smooth', 'Smoothness', 0, 100, 1) +
        (S.kind === 'callig' ? slider('T.vbrush.angle', 'Angle', -90, 90, 1, 'The nib’s angle') + slider('T.vbrush.round', 'Roundness', 0, 100, 1, 'How round the nib is: 100 is a round brush') : '') +
        chip('T.vbrush.press', 'Pencil Pressure', '<path d="M4 18c4 0 5-12 9-12s4 8 7 8"/>', 'Pressing harder with the Pencil makes the stroke wider') + chip('T.vbrush.edit', 'Edit Picked Paths', ICONS.pencil, 'Start at an end of a picked path to carry it on') + colourRow('s', 'Stroke');
    },
    blob: function () { return hint('Paint filled shapes; strokes of the same colour that touch become one shape') + slider('T.blob.w', 'Size', 1, 400, 1) + chip('T.blob.sel', 'Merge Only With Picked', ICONS.select, 'Join only with what’s picked, not everything of the same colour') + colourRow('s', 'Paint') + hint('Paints in the stroke colour (the fill colour if there’s no stroke)'); },
    smooth: function () { return pickHint('Drag along a picked path to smooth it there; each pass takes out a few points') + slider('T.smooth.str', 'Strength', 0, 100, 1) + slider('T.smooth.r', 'Size', 6, 120, 1, 'How far round the pointer it smooths, on the screen'); },
    veraser: function () { return hint('Drag across shapes and lines to rub them out' + (xfList().length ? ' (just the picked ones)' : '')) + slider('T.veraser.w', 'Size', 1, 400, 1); },
    builder: function () {
      return (xfList().length ? hint('Drag across the parts to join them into one · <b>Alt</b>-drag to take parts away · tap a part to keep it on its own') : hint('Pick the shapes to work on first, then drag across their parts')) +
        segc('T.builder.mode', 'Shape Builder', [['merge', 'Join'], ['erase', 'Take Away']]) + segc('T.builder.col', 'Joined shape', [['own', 'Its Own Colour', 'The colour of the part the drag started on'], ['fill', 'Fill Colour', 'The fill colour in hand']]) +
        sep + sub('Pathfinder') + '<div class="vec-ibtns">' + ibtn('union', 'Union', ICONS.union) + ibtn('minus', 'Subtract', ICONS.minus) + ibtn('intersect', 'Intersect', ICONS.intersect) + ibtn('exclude', 'Exclude', ICONS.exclude) + ibtn('divide', 'Divide', ICONS.divide) + '</div>' +
        btn('compound', 'Compound Path', ICONS.compound, 'Make or release a compound path (Ctrl/⌘ 8)') + btn('clipmask', 'Clipping Mask', ICONS.clipmask, 'Make or release a clipping mask (Ctrl/⌘ 7)');
    },
    ftrans: function () {
      return pickHint('Drag a handle to size it · the round handle (or just outside a corner) to turn it · a side handle with <b>Ctrl/⌘</b> to slant it') + '<div class="vec-fields">' + num('x', 'X', null, null, 1) + num('y', 'Y', null, null, 1) + num('w', 'W', 0, null, 1) + num('h', 'H', 0, null, 1) + '</div>' +
        sub('Side handles') + segc('T.ftrans.side', 'Side handles', [['scale', 'Size'], ['shear', 'Slant']]) + chip('T.xf.strokes', 'Scale Strokes', ICONS.swidth, 'Strokes grow and shrink with what’s sized') +
        '<div class="vec-ibtns">' + ibtn('rot90c', 'Turn 90° Left', '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v4.5h4.5"/>') + ibtn('rot90', 'Turn 90° Right', '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4.5h-4.5"/>') + ibtn('fliph', 'Flip Horizontal', '<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M9.5 6L3.5 18h6z"/><path d="M14.5 6l6 12h-6z"/>') + ibtn('flipv', 'Flip Vertical', '<path d="M3 12h18" stroke-dasharray="2 2"/><path d="M6 9.5L18 3.5v6z"/><path d="M6 14.5l12 6v-6z"/>') + '</div>';
    },
    move: function () { return pickHint('Drag to move what’s picked (from anywhere) · <b>Alt</b> moves a copy · or set the distance here') + '<div class="vec-fields">' + num('T.move.dx', 'Horizontal', -100000, 100000, 1) + num('T.move.dy', 'Vertical', -100000, 100000, 1) + num('mvdist', 'Distance', 0, 100000, 1) + num('mvang', 'Angle °', -360, 360, 1) + '</div>' + '<div class="vec-zoomrow">' + btn('xmove', 'Move', ICONS.move) + btn('xmovec', 'Copy', IC.dup, 'Move a copy') + '</div>'; },
    scale: function () {
      var u = TS.scale.uni;
      return pickHint('Drag to size what’s picked · tap to set the point it sizes from · <b>Shift</b> keeps the proportions') + refGrid() + chip('T.scale.uni', 'Uniform', '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 15l6-6M11 9h4v4"/>', 'The same both ways') +
        '<div class="vec-fields">' + (u ? num('T.scale.u', 'Scale %', -10000, 10000, 1) : num('T.scale.h', 'Horizontal %', -10000, 10000, 1) + num('T.scale.v', 'Vertical %', -10000, 10000, 1)) + '</div>' +
        chip('T.xf.strokes', 'Scale Strokes', ICONS.swidth, 'Strokes grow and shrink with what’s sized') + '<div class="vec-zoomrow">' + btn('xscale', 'Scale', ICONS.scale) + btn('xscalec', 'Copy', IC.dup, 'Scale a copy') + '</div>';
    },
    rotate: function () { return pickHint('Drag to turn what’s picked · tap to set the point it turns about · <b>Shift</b> for steps of 45°') + refGrid() + '<div class="vec-fields vec-1col">' + num('T.rotate.a', 'Angle °', -360, 360, 1) + '</div><div class="vec-zoomrow">' + btn('xrot', 'Rotate', ICONS.rotate) + btn('xrotc', 'Copy', IC.dup, 'Rotate a copy') + '</div>'; },
    reflect: function () {
      return pickHint('Drag to mirror what’s picked across a line through the point · tap to set the point') + refGrid() + segc('T.reflect.axis', 'Axis', [['v', 'Vertical', 'Mirror left to right'], ['h', 'Horizontal', 'Mirror top to bottom'], ['a', 'Angle']]) +
        (TS.reflect.axis === 'a' ? '<div class="vec-fields vec-1col">' + num('T.reflect.a', 'Angle °', -360, 360, 1) + '</div>' : '') + '<div class="vec-zoomrow">' + btn('xrefl', 'Reflect', ICONS.reflect) + btn('xreflc', 'Copy', IC.dup, 'Reflect a copy') + '</div>';
    },
    shear: function () { return pickHint('Drag sideways (or up and down) to slant what’s picked · tap to set the point it slants from') + refGrid() + segc('T.shear.axis', 'Axis', [['h', 'Horizontal'], ['v', 'Vertical']]) + '<div class="vec-fields vec-1col">' + num('T.shear.a', 'Angle °', -89, 89, 1) + '</div><div class="vec-zoomrow">' + btn('xshear', 'Shear', ICONS.shear) + btn('xshearc', 'Copy', IC.dup, 'Shear a copy') + '</div>'; },
    distort: function () { return pickHint('Drag a corner to pull it on its own: the paths follow, in perspective') + (xfList().length ? btn('dqreset', 'Square Up', ICONS.rect, 'The corners back round what’s picked (the paths stay as they are)') : ''); },
    text: function () { return textSettings(te ? 'Type · <b>Esc</b> when you’re done' : 'Tap for a line of text · drag for a text box · tap text to edit it'); },
    areatext: function () { return textSettings(te ? 'Type · <b>Esc</b> when you’re done' : 'Tap inside a shape to fill it with text · or drag a box'); },
    ptext: function () { return textSettings(te ? 'Type · <b>Esc</b> when you’re done' : 'Tap a path to put text along it'); },
    vtext: function () { return textSettings(te ? 'Type · <b>Esc</b> when you’re done' : 'Tap for a column of text · drag for a box of columns'); },
    chedit: function () {
      var c = chGlyph();
      return hint(c ? 'Drag the letter to move it · the round handle to turn it · the corner to size it' : 'Tap a letter to change it on its own') +
        (c ? '<div class="vec-fields">' + num('chx', 'Nudge', -10000, 10000, 0.5) + num('chy', 'Baseline', -10000, 10000, 0.5) + num('chr', 'Rotate °', -180, 180, 1) + num('chs', 'Scale %', 10, 2000, 1) + '</div>' +
          btn('chcol', 'Use Fill Colour', ICONS.solid, 'The letter takes the fill colour in hand') + btn('chreset', 'Reset Letter', IC.reverse, 'The letter as the rest are again') : '');
    },
    align: function () { return pickHint(TS.align.to === 'key' ? 'Tap one of the picked to make it the key object; the others line up to it' : 'Line up what’s picked') + alignTo() + sub('Align') + '<div class="vec-ibtns">' + ['l', 'hc', 'r', 't', 'vc', 'b'].map(function (k) { return ibtn('al-' + k, 'Align ' + ALIGN_N[k], ALIGN_IC[k]); }).join('') + '</div>'; },
    distribute: function () { return pickHint('Spread out what’s picked: the first and last stay, the rest go evenly between') + alignTo() + sub('Distribute') + '<div class="vec-ibtns">' + ['l', 'hc', 'r', 't', 'vc', 'b'].map(function (k) { return ibtn('ds-' + k, 'Distribute by ' + ALIGN_N[k], DIST_IC[k]); }).join('') + '</div>'; },
    dspace: function () {
      return pickHint('The same gap between each of what’s picked') + alignTo() + sub('Distribute spacing') + (TS.align.to === 'key' ? '<div class="vec-fields vec-1col">' + num('T.align.gap', 'Gap', -10000, 10000, 1) + '</div>' : '') +
        '<div class="vec-zoomrow">' + btn('sp-h', 'Horizontal', '<rect x="3.5" y="7" width="4" height="10" rx="1"/><rect x="16.5" y="7" width="4" height="10" rx="1"/><path d="M9.5 12h5"/>', 'Even gaps across') + btn('sp-v', 'Vertical', '<rect x="7" y="3.5" width="10" height="4" rx="1"/><rect x="7" y="16.5" width="10" height="4" rx="1"/><path d="M12 9.5v5"/>', 'Even gaps down') + '</div>';
    }
  });
  function chNow() { var c = chGlyph(); return c ? { n: c.n, k: (c.n.ch && c.n.ch[c.g.u]) || {} } : null; }
  function chField(f, get, set) { return { get: function () { var c = chNow(); return c ? get(c.k) : ''; }, set: function (v) { var c = chNow(); if (!c) return; set(chSet(c.n, chs.u), +v); chClean(c.n, chs.u); }, label: 'Character' }; }
  Object.assign(BK, {
    xref: { get: function () { return tref && tref.key === selKey() ? '' : TS.xf.ref; }, set: function (v) { TS.xf.ref = v; tref = null; tsSave(); }, own: true },
    mvdist: { get: function () { return r2(Math.hypot(TS.move.dx, TS.move.dy)); }, set: function (v) { var a = Math.atan2(-TS.move.dy, TS.move.dx); TS.move.dx = r2(v * Math.cos(a)); TS.move.dy = r2(-v * Math.sin(a)); tsSave(); }, own: true },
    mvang: { get: function () { return r2(Math.atan2(-TS.move.dy, TS.move.dx) * 180 / Math.PI); }, set: function (v) { var L = Math.hypot(TS.move.dx, TS.move.dy), a = v * Math.PI / 180; TS.move.dx = r2(L * Math.cos(a)); TS.move.dy = r2(-L * Math.sin(a)); tsSave(); }, own: true },
    'tx.font': { get: function () { return txGet('font'); }, set: function (v) { txSet('font', String(v).slice(0, 300)); }, label: 'Font', text: true },
    'tx.size': { get: function () { return r2(txGet('size')); }, set: function (v) { txSet('size', Math.max(1, Math.min(2000, +v))); }, label: 'Font Size' },
    'tx.lead': { get: function () { return Math.round(txGet('lead') * 100); }, set: function (v) { txSet('lead', Math.max(0.5, Math.min(5, v / 100))); }, label: 'Leading' },
    'tx.track': { get: function () { return txGet('track'); }, set: function (v) { txSet('track', Math.max(-500, Math.min(2000, Math.round(+v)))); }, label: 'Tracking' },
    'tx.bold': { get: function () { return txGet('weight') >= 600; }, set: function (v) { txSet('weight', v ? 700 : 400); }, label: 'Bold' },
    'tx.italic': { get: function () { return !!txGet('italic'); }, set: function (v) { txSet('italic', v ? 1 : 0); }, label: 'Italic' },
    'tx.align': { get: function () { return txGet('align'); }, set: function (v) { txSet('align', v); }, label: 'Align Text', text: true },
    'tx.vert': { get: function () { return String(txGet('vert') ? 1 : 0); }, set: function (v) { txList().forEach(function (n) { if (n.kind !== 'path') n.vert = +v ? 1 : 0; }); }, label: 'Direction', text: true },
    'tx.off': { get: function () { var n = txPath(); return n ? r2(n.off * 100) : 0; }, set: function (v) { txList().forEach(function (n) { if (n.kind === 'path') n.off = Math.max(0, Math.min(1, v / 100)); }); }, label: 'Start', fmt: function (v) { return r2(v) + '%'; } },
    'tx.flip': { get: function () { var n = txPath(); return !!(n && n.flip); }, set: function (v) { txList().forEach(function (n) { if (n.kind === 'path') n.flip = v ? 1 : 0; }); }, label: 'Other Side' },
    rule: { get: function () { var l = picked(); return l.length && l[l.length - 1].rule === 'evenodd' ? 'evenodd' : 'nonzero'; }, set: function (v) { picked().filter(editable).forEach(function (n) { if (n.type !== 'path') return; if (v === 'evenodd') n.rule = 'evenodd'; else delete n.rule; }); }, label: 'Fill Rule', text: true },
    chx: chField('dx', function (k) { return r2(k.dx || 0); }, function (k, v) { k.dx = v; }),
    chy: chField('dy', function (k) { return r2(-(k.dy || 0)); }, function (k, v) { k.dy = -v; }),
    chr: chField('r', function (k) { return r2(k.r || 0); }, function (k, v) { k.r = Math.max(-180, Math.min(180, v)); }),
    chs: chField('s', function (k) { return Math.round((k.s || 1) * 100); }, function (k, v) { k.s = Math.max(0.1, Math.min(20, v / 100)); })
  });
  // (the panel's buttons for the new categories)
  function act3(a) {
    if (ACTIONS[a]) { runAction(a); return true; }
    var o = xfOrigin(), deg = Math.PI / 180, b = pickBox(), c = b ? v2(b.x + b.w / 2, b.y + b.h / 2) : null, cp2 = /^x(move|scale|rot|refl|shear)c$/.test(a);
    var base = cp2 ? a.slice(0, -1) : a;
    if (/^(xmove|xscale|xrot|xrefl|xshear|rot90|rot90c|fliph|flipv)$/.test(base) && !o) { B.toast('Pick something to transform first'); return true; }
    if (base === 'xmove') { xfApply([1, 0, 0, 1, TS.move.dx, TS.move.dy], 'Move', cp2); return true; }
    if (base === 'xscale') { var sx = (TS.scale.uni ? TS.scale.u : TS.scale.h) / 100, sy = (TS.scale.uni ? TS.scale.u : TS.scale.v) / 100; if (!sx || !sy) { B.toast('A scale of 0% would leave nothing'); return true; } xfApply(mScale(sx, sy, o), 'Scale', cp2); return true; }
    if (base === 'xrot') { xfApply(mRot(TS.rotate.a * deg, o), 'Rotate', cp2); return true; }
    if (base === 'xrefl') { xfApply(mRefl(TS.reflect.axis === 'h' ? 0 : TS.reflect.axis === 'v' ? Math.PI / 2 : TS.reflect.a * deg, o), 'Reflect', cp2); return true; }
    if (base === 'xshear') { var k = Math.tan(Math.max(-89, Math.min(89, TS.shear.a)) * deg); xfApply(TS.shear.axis === 'v' ? mShear(0, k, o) : mShear(k, 0, o), 'Shear', cp2); return true; }
    if (a === 'rot90' || a === 'rot90c') { xfApply(mRot((a === 'rot90' ? 1 : -1) * Math.PI / 2, c), 'Rotate', false); return true; }
    if (a === 'fliph' || a === 'flipv') { xfApply(a === 'fliph' ? mScale(-1, 1, c) : mScale(1, -1, c), a === 'fliph' ? 'Flip Horizontal' : 'Flip Vertical', false); return true; }
    if (a === 'dqreset') { dq = null; drawUI(); return true; }
    var al = /^(al|ds)-(\w+)$/.exec(a); if (al) { if (al[1] === 'al') alignDo(al[2]); else distDo(al[2]); return true; }
    if (a === 'sp-h' || a === 'sp-v') { spaceDo(a === 'sp-h' ? 'h' : 'v'); return true; }
    if (a === 'tdone') { endEdit(); return true; }
    if (a === 'chcol' || a === 'chreset') {
      var cn = chNow(); if (!cn) return true; record(a === 'chcol' ? 'Letter Colour' : 'Reset Letter');
      if (a === 'chreset') { if (cn.n.ch) delete cn.n.ch[chs.u]; chClean(cn.n, chs.u); } else { var f = defItem('f'), p = f && f.p ? solidOf(f.p) : null; if (p) chSet(cn.n, chs.u).c = p.c; else B.toast('There’s no fill colour to use'); }
      changed(); return true;
    }
    return false;
  }

  // ---- THE PANELS: Effects, Artboards, Guides & Precision ----
  function effHint(t) { return xfList().length ? hint(t) : hint('Pick something first: tap it, or drag round it'); }
  function boardList() {
    return '<div class="vec-alist">' + doc.boards.map(function (b, i) {
      return '<div class="vec-arow' + (b.id === doc.ab ? ' on' : '') + '"><button type="button" class="vec-aname" data-va="abpick-' + b.id + '" data-tip="Make it the active artboard, and fit it"><span>' + esc(b.name) + '</span><span class="vec-hex">' + Math.round(b.w) + ' × ' + Math.round(b.h) + '</span></button>' +
        '<button type="button" class="pl-eye" data-va="abup-' + b.id + '" aria-label="Earlier"' + (i ? '' : ' disabled') + '>' + CI(IC.up) + '</button><button type="button" class="pl-eye" data-va="abdn-' + b.id + '" aria-label="Later"' + (i < doc.boards.length - 1 ? '' : ' disabled') + '>' + CI(IC.down) + '</button></div>';
    }).join('') + '</div>';
  }
  function abFields() { return '<div class="vec-fields">' + num('abx', 'X', null, null, 1) + num('aby', 'Y', null, null, 1) + num('abw', 'W', 1, 100000, 1) + num('abh', 'H', 1, 100000, 1) + '</div>'; }
  function precSwitch(k, label, icon, tip) { return chip('T.prec.' + k, label, icon, tip); }
  Object.assign(SET, {
    vblend: function () {
      var g = blendGroups();
      return hint(g.length ? 'The picked blend: change its steps here; edit its shapes with Direct Selection' : 'Tap a shape, then another, for the steps between · or pick two or more and Make Blend') +
        segc('bl.mode', 'Spacing', [['steps', 'Specified Steps'], ['smooth', 'Smooth Color']]) + (TS.vblend.mode === 'steps' || g.length && !g[0].blnd.smooth ? '<div class="vec-fields vec-1col">' + num('bl.steps', 'Steps', 1, 500, 1) + '</div>' : '') +
        (g.length ? btn('blrelease', 'Release', IC.ungroup, 'Back to the shapes alone') + btn('blexpand', 'Expand', IC.dup, 'The steps become shapes of their own') : btn('blmake', 'Make Blend', ICONS.vblend, 'Blend the picked shapes'));
    },
    warp: function () {
      var w = fxPicked('warp');
      return effHint(w.length ? 'The picked warp: change it here' : 'Pick shapes or groups, choose a warp, then Warp') + selBox('wp.st', 'Style', WARPS) + segc('wp.dir', 'Bend', [['h', 'Horizontal'], ['v', 'Vertical']]) +
        slider('wp.bend', 'Bend', -100, 100, 1) + slider('wp.hd', 'Horizontal', -100, 100, 1, 'Horizontal distortion') + slider('wp.vd', 'Vertical', -100, 100, 1, 'Vertical distortion') +
        (w.length ? btn('fxexpand', 'Expand', IC.dup, 'The warped shapes become plain paths') + btn('wprelease', 'Remove Warp', IC.trash) : btn('wpapply', 'Warp', ICONS.warp, 'Warp what’s picked'));
    },
    envelope: function () {
      var e2 = fxPicked('env');
      return effHint(e2.length ? 'Drag the mesh’s points to bend what’s inside' : 'Pick shapes or groups, then make an envelope') + '<div class="vec-fields">' + num('T.env.rows', 'Rows', 1, 12, 1) + num('T.env.cols', 'Columns', 1, 12, 1) + '</div>' +
        btn('envmesh', 'Make with Mesh', ICONS.envelope, 'A mesh of points to pull about') + btn('envwarp', 'Make with Warp', ICONS.warp, 'A mesh shaped by the Warp settings') +
        (e2.length ? btn('envreset', 'Reset Mesh', IC.reverse) + btn('fxexpand', 'Expand', IC.dup, 'The shapes take the envelope for good') + btn('envrelease', 'Release', IC.trash) : '');
    },
    offset: function () { return effHint('A new path round the picked ones, grown out (or in, below 0) by the offset') + slider('T.offset.d', 'Offset', -100, 100, 0.5) + num('T.offset.d', 'Offset', -1000, 1000, 0.5) + segc('T.offset.join', 'Joins', [['miter', 'Miter'], ['round', 'Round'], ['bevel', 'Bevel']]) + slider('T.offset.ml', 'Miter Limit', 1, 20, 0.5) + btn('offsetgo', 'Offset Path', ICONS.offset); },
    repeat: function () {
      var g = repGroups(), k = g.length ? g[0].rep.k : TS.repeat.k;
      var f = k === 'radial' ? num('rp.n', 'Instances', 2, 200, 1) + num('rp.r', 'Radius', 1, 100000, 1) : k === 'grid' ? num('rp.rows', 'Rows', 1, 50, 1) + num('rp.cols', 'Columns', 1, 50, 1) + num('rp.gx', 'Across', -10000, 10000, 1) + num('rp.gy', 'Down', -10000, 10000, 1) : num('rp.a', 'Axis °', -360, 360, 1) + num('rp.off', 'Gap', -10000, 10000, 1);
      return effHint(g.length ? 'The picked repeat: change it here; edit the original inside it' : 'Pick what to repeat, choose how, then Repeat') + segc('rp.k', 'Repeat', [['radial', 'Radial'], ['grid', 'Grid'], ['mirror', 'Mirror']]) + '<div class="vec-fields">' + f + '</div>' +
        (g.length ? btn('rpexpand', 'Expand', IC.dup, 'The copies become objects of their own') + btn('rprelease', 'Release', IC.ungroup, 'Just the original again') : btn('rpmake', 'Repeat', ICONS.repeat, 'Repeat what’s picked'));
    },
    pattern: function () {
      var it = patItem(), sw = doc.pats.map(function (pt) { return '<button type="button" class="vec-swatch vec-pat" data-vpat="' + pt.id + '" aria-label="' + esc(pt.name) + '" data-tip="' + esc(pt.name) + ': tap to fill what’s picked" aria-pressed="' + (TS.pattern.cur === pt.id) + '">' + patSwatch(pt, 28) + '</button>'; }).join('');
      return hint('Make a pattern from the picked art, then tap it to fill shapes with it') + btn('patmake', 'Make Pattern', ICONS.pattern, 'A pattern tile from what’s picked') + segc('T.pattern.to', 'Pattern for', [['f', 'Fill'], ['s', 'Stroke']]) +
        (doc.pats.length ? sub('Patterns') + '<div class="vec-swatches">' + sw + '</div>' : '') +
        (it ? sub('The picked pattern') + slider('pt.s', 'Scale', 5, 400, 1) + slider('pt.a', 'Angle', -180, 180, 1) + '<div class="vec-fields">' + num('pt.x', 'Move X', -10000, 10000, 1) + num('pt.y', 'Move Y', -10000, 10000, 1) + '</div>' + slider('pt.gap', 'Spacing', -50, 200, 1, 'Room round each tile') : '') +
        (doc.pats.length ? btn('patdel', 'Delete Pattern', IC.trash, 'Delete the pattern last picked (what it fills turns grey)') : '');
    },
    transp: function () {
      var g = maskGroups(), grp = picked().filter(function (n) { return n.type === 'group' && editable(n); });
      return slider('op', 'Opacity', 0, 100, 1) + selBox('blend', 'Blend', BLENDS) + sep + sub('Opacity mask') +
        (g.length ? chip('om.clip', 'Clip', ICONS.clipmask, 'Outside the mask’s art is hidden') + chip('om.inv', 'Invert Mask', IC.reverse, 'Dark shows and light hides') + btn('omrelease', 'Release Mask', IC.ungroup)
          : hint('White in the mask (on top) shows, black hides, grey fades') + btn('ommake', 'Make Mask', ICONS.transp, 'The top picked object masks the rest') + segc('T.transp.dir', 'Fade', [['h', 'Left to Right'], ['v', 'Top to Bottom']]) + btn('omfade', 'Fade Out', '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 5v14M12 5v14M16 5v14" opacity=".5"/>', 'A gradient mask fading what’s picked away')) +
        (grp.length ? sep + chip('iso', 'Isolate Blending', ICONS.blend, 'Blend modes inside the group mix only with each other') : '');
    },
    artboard: function () { var A = AB(); return hint('Tap an artboard to make it active · drag it to move it, its handles to size it · drag on the pasteboard for a new one') + '<div class="vec-name">' + esc(A.name) + '</div>' + chip('T.abarr.art', 'Move Artwork', ICONS.move, 'Artwork on an artboard moves with it') + '<div class="vec-zoomrow">' + btn('abfit', 'Fit Artboard', ICONS.fit) + btn('abfitall', 'Fit All', ICONS.fit) + '</div>' + btn('abdup', 'Duplicate Artboard', IC.dup) + (doc.boards.length > 1 ? btn('abdel', 'Delete Artboard', IC.trash, 'Delete the active artboard (what’s on it stays)') : ''); },
    abnew: function () { return hint('Tap the pasteboard for an artboard the size set here, or drag one out') + selBox('abpreset', 'Size', AB_PRESETS) + '<div class="vec-fields">' + num('T.abnew.w', 'W', 1, 100000, 1) + num('T.abnew.h', 'H', 1, 100000, 1) + '</div>' + segc('abor', 'Orientation', [['p', 'Portrait'], ['l', 'Landscape']]) + btn('abadd', 'Add Artboard', IC.plus, 'Beside the others'); },
    abresize: function () { return hint('Drag the active artboard’s handles, or set its size from the reference point') + selBox('abrpre', 'Size', AB_PRESETS) + refGridAB() + abFields() + btn('abfitart', 'Fit to Artwork', ICONS.fit, 'The artboard round what’s on it') + (xfList().length ? btn('abfitsel', 'Fit to Picked Art', ICONS.fit, 'The artboard round what’s picked') : ''); },
    abarr: function () { var R = TS.abarr; return hint('Tap an artboard to go to it; move them up and down the order, then lay them out') + boardList() + selBox('T.abarr.layout', 'Layout', [['grow', 'Grid by Row'], ['gcol', 'Grid by Column'], ['row', 'In a Row'], ['col', 'In a Column']]) + '<div class="vec-fields">' + (R.layout === 'grow' || R.layout === 'gcol' ? num('T.abarr.cols', R.layout === 'gcol' ? 'Rows' : 'Columns', 1, 50, 1) : '') + num('T.abarr.gap', 'Spacing', 0, 10000, 1) + '</div>' + chip('T.abarr.art', 'Move Artwork', ICONS.move, 'Artwork on an artboard moves with it') + btn('abarrgo', 'Rearrange', ICONS.abarr); },
    abset: function () { return '<label class="ctx-field vec-name"><span>Name</span><input type="text" class="p-field" maxlength="40" data-vk="abname" aria-label="Artboard name"></label>' + abFields() + sub('Background') + segc('abbg', 'Background', [['white', 'White'], ['clear', 'Transparent']]) + hint('Saved PNGs and SVGs take the background') + '<div class="vec-zoomrow">' + btn('abfit', 'Fit Artboard', ICONS.fit) + btn('abfitall', 'Fit All', ICONS.fit) + '</div>' + (doc.boards.length > 1 ? btn('abdel', 'Delete Artboard', IC.trash) : ''); },
    rulers: function () { return precSwitch('rulers', 'Show Rulers', ICONS.rulers, 'Rulers along the top and left') + segc('T.prec.units', 'Units', [['px', 'px'], ['pt', 'pt'], ['mm', 'mm'], ['in', 'in']]) + hint('Measured from the active artboard’s corner · drag out of a ruler for a guide'); },
    guides: function () {
      return hint('Tap for a guide · drag one to move it, off the edge (or double-tap it) to take it away') + segc('T.prec.gnew', 'New guides', [['h', 'Across'], ['v', 'Down']]) + precSwitch('guides', 'Show Guides', ICONS.guides) + precSwitch('glock', 'Lock Guides', '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/>') +
        (doc.guides.length ? '<div class="vec-count">' + doc.guides.length + (doc.guides.length === 1 ? ' guide' : ' guides') + '</div>' + btn('gclear', 'Clear Guides', IC.trash) : '');
    },
    smartg: function () { return precSwitch('smart', 'Smart Guides', ICONS.smartg, 'Edges and middles line up as you move and draw, with lines to show it') + hint('As things are moved, sized or drawn, they line up with the edges and middles of the others and the artboard'); },
    grid: function () { return precSwitch('grid', 'Show Grid', ICONS.grid) + num('T.prec.gsize', 'Gridline every', 2, 2000, 1) + num('T.prec.gsub', 'Subdivisions', 1, 20, 1) + precSwitch('gfront', 'Grid in Front', ICONS.grid, 'Over the artwork, not behind it') + precSwitch('snapGrid', 'Snap to Grid', ICONS.snapgrid); },
    snapgrid: function () { return precSwitch('snapGrid', 'Snap to Grid', ICONS.snapgrid, 'Points, edges and moves keep to the grid') + precSwitch('grid', 'Show Grid', ICONS.grid) + num('T.prec.gsize', 'Gridline every', 2, 2000, 1) + num('T.prec.gsub', 'Subdivisions', 1, 20, 1); },
    snappts: function () { return precSwitch('snapPts', 'Snap to Points', ICONS.snappts, 'Drawing and dragging catch on anchor points and corners') + hint('Points drawn or dragged near another’s anchor points (or an artboard’s corners) land exactly on them'); },
    snapobj: function () { return precSwitch('snapObj', 'Snap to Objects', ICONS.snapobj, 'Drawing and dragging catch on other objects’ edges') + hint('Points drawn or dragged near another object’s outline land on it'); },
    measure: function () {
      var m = meas;
      return hint('Drag from one point to another · <b>Shift</b> for steps of 45°') + segc('T.prec.units', 'Units', [['px', 'px'], ['pt', 'pt'], ['mm', 'mm'], ['in', 'in']]) +
        (m ? '<div class="vec-meas" data-vmeas></div>' + btn('measclear', 'Clear', IC.trash) : '');
    }
  });
  function refGridAB() { return '<div class="vec-refrow"><span>Reference point</span><div class="vec-ref" role="group" aria-label="Reference point">' + ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se'].map(function (k) { return '<button type="button" data-vk="T.abresize.ref" data-val="' + k + '" aria-label="' + REFN[k] + '"><i></i></button>'; }).join('') + '</div></div>'; }
  function measText() { if (!meas) return ''; var a = meas.a, b = meas.b, dx = b.x - a.x, dy = b.y - a.y; return '<span>D</span><b>' + uval(Math.hypot(dx, dy)) + '</b><span>Angle</span><b>' + r2(Math.atan2(-dy, dx) * 180 / Math.PI) + '°</b><span>W</span><b>' + uval(Math.abs(dx)) + '</b><span>H</span><b>' + uval(Math.abs(dy)) + '</b><span>X</span><b>' + uval(a.x - AB().x) + '</b><span>Y</span><b>' + uval(a.y - AB().y) + '</b>'; }
  // (the artboard's size from the reference point)
  function abSize(w, h) {
    var A = AB(), r = TS.abresize.ref, fx = /w/.test(r) ? 0 : /e/.test(r) ? 1 : 0.5, fy = /^n/.test(r) ? 0 : /^s/.test(r) ? 1 : 0.5;
    var ox = A.x + A.w * fx, oy = A.y + A.h * fy; A.w = Math.max(1, w); A.h = Math.max(1, h); A.x = ox - A.w * fx; A.y = oy - A.h * fy;
  }
  function fxField(get, set, label, ownIf) { var o = { get: get, set: set, label: label }; if (ownIf) Object.defineProperty(o, 'own', { get: ownIf }); return o; }
  // (with nothing of its kind picked, a setting is just the tool's, not an undo step)
  function noBlend() { return !blendGroups().length; } function noWarp() { return !fxPicked('warp').length; } function noRep() { return !repGroups().length; }
  function blendSet(f, v) { blendGroups().forEach(function (g) { g.blnd[f] = v; }); }
  function warpGet(f) { var w = fxPicked('warp'); return w.length ? w[w.length - 1].efx[f] : TS.warp[f]; }
  function warpSet(f, v) { TS.warp[f] = v; tsSave(); fxPicked('warp').forEach(function (n) { n.efx[f] = v; }); }
  function repGet(f) { var g = repGroups(); return g.length ? g[g.length - 1].rep[f] : TS.repeat[f]; }
  function repSet(f, v) { TS.repeat[f] = typeof TS.repeat[f] === 'number' ? +v : v; tsSave(); repGroups().forEach(function (g) { g.rep[f] = TS.repeat[f]; }); }
  function ptGet(f) { var it = patItem(); return it ? it.p[f] : ''; }
  function ptSet(f, v) { eachItem(TS.pattern.to === 's' ? 's' : 'f', function (it) { if (it.p && it.p.t === 'p') it.p[f] = v; }, false); }
  Object.assign(BK, {
    'bl.mode': fxField(function () { var g = blendGroups(); return g.length ? (g[0].blnd.smooth ? 'smooth' : 'steps') : TS.vblend.mode; }, function (v) { TS.vblend.mode = v; tsSave(); blendSet('smooth', v === 'smooth' ? 1 : 0); }, 'Blend Spacing', noBlend),
    'bl.steps': fxField(function () { var g = blendGroups(); return g.length ? g[0].blnd.steps : TS.vblend.steps; }, function (v) { v = Math.max(1, Math.min(500, Math.round(+v))); TS.vblend.steps = v; tsSave(); blendSet('steps', v); }, 'Blend Steps', noBlend),
    'wp.st': fxField(function () { return warpGet('st'); }, function (v) { warpSet('st', v); }, 'Warp', noWarp),
    'wp.dir': fxField(function () { return warpGet('dir'); }, function (v) { warpSet('dir', v); }, 'Warp', noWarp),
    'wp.bend': fxField(function () { return warpGet('bend'); }, function (v) { warpSet('bend', +v); }, 'Warp', noWarp),
    'wp.hd': fxField(function () { return warpGet('hd'); }, function (v) { warpSet('hd', +v); }, 'Warp', noWarp),
    'wp.vd': fxField(function () { return warpGet('vd'); }, function (v) { warpSet('vd', +v); }, 'Warp', noWarp),
    'rp.k': fxField(function () { return repGet('k'); }, function (v) { repSet('k', v); }, 'Repeat', noRep),
    'pt.s': { get: function () { var v = ptGet('s'); return v === '' ? 100 : Math.round(v * 100); }, set: function (v) { ptSet('s', Math.max(0.05, +v / 100)); }, label: 'Pattern', fmt: function (v) { return v + '%'; } },
    'pt.a': { get: function () { var v = ptGet('a'); return v === '' ? 0 : v; }, set: function (v) { ptSet('a', +v); }, label: 'Pattern', fmt: function (v) { return v + '°'; } },
    'pt.x': fxField(function () { return ptGet('x'); }, function (v) { ptSet('x', +v); }, 'Pattern'),
    'pt.y': fxField(function () { return ptGet('y'); }, function (v) { ptSet('y', +v); }, 'Pattern'),
    'pt.gap': { get: function () { var it = patItem(), pt = it && patById(it.p.id); return pt ? pt.gap : 0; }, set: function (v) { var it = patItem(), pt = it && patById(it.p.id); if (pt) pt.gap = +v; }, label: 'Pattern' },
    'om.clip': fxField(function () { var g = maskGroups(); return g.length && !!g[0].omask.clip; }, function (v) { maskGroups().forEach(function (g) { g.omask.clip = v ? 1 : 0; }); }, 'Mask'),
    'om.inv': fxField(function () { var g = maskGroups(); return g.length && !!g[0].omask.inv; }, function (v) { maskGroups().forEach(function (g) { g.omask.inv = v ? 1 : 0; }); }, 'Mask'),
    iso: fxField(function () { var g = picked().filter(function (n) { return n.type === 'group'; }); return g.length && !!g[0].iso; }, function (v) { picked().forEach(function (n) { if (n.type === 'group' && editable(n)) { if (v) n.iso = 1; else delete n.iso; } }); }, 'Isolate'),
    abx: fxField(function () { return r2(AB().x); }, function (v) { AB().x = +v; }, 'Artboard'),
    aby: fxField(function () { return r2(AB().y); }, function (v) { AB().y = +v; }, 'Artboard'),
    abw: fxField(function () { return r2(AB().w); }, function (v) { abSize(+v, AB().h); }, 'Artboard Size'),
    abh: fxField(function () { return r2(AB().h); }, function (v) { abSize(AB().w, +v); }, 'Artboard Size'),
    abname: { get: function () { return AB().name; }, set: function (v) { if (String(v).trim()) AB().name = String(v).trim().slice(0, 40); }, label: 'Rename Artboard', text: true },
    abbg: { get: function () { return AB().clear ? 'clear' : 'white'; }, set: function (v) { if (v === 'clear') AB().clear = 1; else delete AB().clear; }, label: 'Artboard Background', text: true },
    abpreset: { get: function () { var S = TS.abnew, m = AB_PRESETS.filter(function (q) { return q[0] === S.w + 'x' + S.h || q[0] === S.h + 'x' + S.w; })[0]; return m ? m[0] : 'custom'; }, set: function (v) { var m = /^(\d+)x(\d+)$/.exec(v); if (m) { TS.abnew.w = +m[1]; TS.abnew.h = +m[2]; tsSave(); } }, own: true, text: true },
    abor: { get: function () { return TS.abnew.w > TS.abnew.h ? 'l' : 'p'; }, set: function (v) { var S = TS.abnew; if ((v === 'l') !== (S.w > S.h)) { var t = S.w; S.w = S.h; S.h = t; tsSave(); } }, own: true, text: true },
    abrpre: { get: function () { var A = AB(), m = AB_PRESETS.filter(function (q) { return q[0] === Math.round(A.w) + 'x' + Math.round(A.h); })[0]; return m ? m[0] : 'custom'; }, set: function (v) { var m = /^(\d+)x(\d+)$/.exec(v); if (m) abSize(+m[1], +m[2]); }, label: 'Artboard Size', text: true }
  });
  ['n', 'r', 'rows', 'cols', 'gx', 'gy', 'a', 'off'].forEach(function (f) { BK['rp.' + f] = fxField(function () { return repGet(f); }, function (v) { repSet(f, f === 'n' || f === 'rows' || f === 'cols' ? Math.max(1, Math.round(+v)) : +v); }, 'Repeat', noRep); });
  // (their buttons)
  function act4(a) {
    var m;
    if (a === 'blmake') { makeBlend(picked().filter(editable)); return true; }
    if (a === 'blrelease') { var bg = blendGroups(); if (!bg.length) return true; record('Release Blend'); bg.forEach(function (g) { delete g.blnd; }); changed(); return true; }
    if (a === 'blexpand') { expandFx(blendGroups(), 'Expand Blend'); return true; }
    if (a === 'wpapply') { applyWarp(); return true; }
    if (a === 'wprelease') { releaseFx('warp', 'Remove Warp'); return true; }
    if (a === 'fxexpand') { expandFx(fxTargets().filter(function (n) { return n.efx; }), 'Expand'); return true; }
    if (a === 'envmesh' || a === 'envwarp') { applyEnv(a === 'envwarp'); return true; }
    if (a === 'envreset') { var ep = fxPicked('env'); record('Reset Mesh'); ep.forEach(function (n) { n.efx.m = envGrid(n.efx.rows, n.efx.cols); }); changed(); return true; }
    if (a === 'envrelease') { releaseFx('env', 'Release Envelope'); return true; }
    if (a === 'offsetgo') { doOffset(); return true; }
    if (a === 'rpmake') { makeRepeat(); return true; }
    if (a === 'rprelease') { var rg = repGroups(); if (!rg.length) return true; record('Release Repeat'); rg.forEach(function (g) { delete g.rep; }); changed(); return true; }
    if (a === 'rpexpand') { expandFx(repGroups(), 'Expand Repeat'); return true; }
    if (a === 'patmake') { makePattern(); return true; }
    if (a === 'patdel') {
      var id = TS.pattern.cur && patById(TS.pattern.cur) ? TS.pattern.cur : doc.pats.length ? doc.pats[doc.pats.length - 1].id : null; if (!id) return true;
      record('Delete Pattern'); doc.pats = doc.pats.filter(function (q) { return q.id !== id; });
      allLeaves().forEach(function (n) { if (n.app) n.app.forEach(function (it) { if (it.p && it.p.t === 'p' && it.p.id === id) it.p = { t: 'c', c: '#888888' }; }); });
      changed(); return true;
    }
    if (a === 'ommake' || a === 'omfade') { makeMask(a === 'omfade'); return true; }
    if (a === 'omrelease') { var mg = maskGroups(); if (!mg.length) return true; record('Release Mask'); var ids = []; mg.forEach(function (g) { var w = where(g.id); w.list.splice.apply(w.list, [w.i, 1].concat(g.items)); ids = ids.concat(g.items.map(function (q) { return q.id; })); }); sel = ids; asel = {}; changed(); return true; }
    if (a === 'abfit') { fit(); return true; } if (a === 'abfitall') { fitAllView(); return true; }
    if (a === 'abdel') { delBoard(); return true; } if (a === 'abdup') { dupBoard(); return true; }
    if (a === 'abadd') { var S = TS.abnew, at = boardSlot(S.w, S.h); addBoard(at.x, at.y, S.w, S.h); fit(); return true; }
    if (a === 'abfitart' || a === 'abfitsel') {
      var list = a === 'abfitsel' ? xfList() : onBoard(AB()), bb = boxOf(list); if (!bb) { B.toast('There’s nothing to fit it to'); return true; }
      record('Fit Artboard'); var A = AB(); A.x = bb.x; A.y = bb.y; A.w = Math.max(1, bb.w); A.h = Math.max(1, bb.h); changed(); return true;
    }
    if (a === 'abarrgo') { rearrangeBoards(); return true; }
    if ((m = /^ab(pick|up|dn)-(.+)$/.exec(a))) {
      var b = boardById(m[2]); if (!b) return true;
      if (m[1] === 'pick') { fitBoardView(b); panelRefresh(); return true; }
      var i = doc.boards.indexOf(b), j = i + (m[1] === 'up' ? -1 : 1); if (j < 0 || j >= doc.boards.length) return true;
      record('Artboard Order'); doc.boards.splice(i, 1); doc.boards.splice(j, 0, b); changed(); return true;
    }
    if (a === 'gclear') { record('Clear Guides'); doc.guides = []; changed(); return true; }
    if (a === 'measclear') { meas = null; drawUI(); panelRefresh(); return true; }
    if (a === 'fxexpandall') { expandFx(picked().filter(editable), 'Expand Effects'); return true; }
    if (a === 'trace') { var ims = picked().filter(function (n) { return n.type === 'image' && editable(n); }); if (!ims.length) { B.toast('Pick a picture to trace'); return true; } B.toast('Tracing…'); ims.forEach(imageTrace); return true; }
    return false;
  }

  function oneAnchor() { var ids = Object.keys(asel); if (ids.length !== 1) return null; var A = Object.keys(asel[ids[0]]); if (A.length !== 1) return null; var n = byId(ids[0]), k = A[0].split(':'); var q = n && n.d[+k[0]] && n.d[+k[0]].pts[+k[1]]; return q ? { q: q, n: n } : null; }
  function stopNow() { var it = gradItem(); return it && isGrad(it.p) ? it.p.st[Math.min(gstop, it.p.st.length - 1)] : null; }
  function eachGrad(fn) { var k = TS.gradient.to === 's' ? 's' : 'f'; eachItem(k, function (it) { if (isGrad(it.p)) { fn(it.p); lastGrad = clone(it.p); } }, false); }
  function cpHsv() { var h = pcGet(TS.cpick.to === 's' ? 'second' : 'main'); if (!h) return hsvNow || [0, 0, 0]; var x = hsvOf(h); if (hsvNow && (!x[1] || !x[2])) x[0] = hsvNow[0]; if (hsvNow && !x[2]) x[1] = hsvNow[1]; hsvNow = x; return x; }
  function cpSet(i, v) { var x = cpHsv().slice(); x[i] = v; hsvNow = x; setColour(TS.cpick.to === 's' ? 'second' : 'main', hexOf(x[0], x[1], x[2]), 'Color'); }
  // (the shape fields: the picked live shape's, or the tool's for the next one)
  function liveKey(k) {
    var f = k.slice(2), one = liveOne(TOOLS[tool].shape ? tool : null) || (tool === 'select' || tool === 'groupsel' ? liveOne() : null);
    return { one: one, f: f };
  }
  function liveGet(k) {
    var q = liveKey(k), L = q.one ? q.one.live : null, f = q.f;
    if (!L) { var S = TS[tool] || {}; return S[f] != null ? S[f] : ''; }
    if (f === 'w' && L.k === 'arc') return Math.round(Math.abs(L.x2 - L.x1)); if (f === 'h' && L.k === 'arc') return Math.round(Math.abs(L.y2 - L.y1));
    if (f === 'len') return Math.round(Math.hypot(L.x2 - L.x1, L.y2 - L.y1)); if (f === 'ang') return Math.round(Math.atan2(L.y1 - L.y2, L.x2 - L.x1) * 180 / Math.PI);
    if (f === 'r' || f === 'r2') return Math.round(L[f]);
    return typeof L[f] === 'number' ? r2(L[f]) : L[f];
  }
  function liveSet(k, v) {
    var q = liveKey(k), f = q.f, S = TS[q.one ? q.one.live.k : tool];
    if (S && S[f] != null) { S[f] = typeof S[f] === 'number' ? +v : v; tsSave(); }
    if (!q.one) return;
    var L = q.one.live; v = +v;
    if (f === 'n') v = Math.max(3, Math.min(64, Math.round(v))); if (f === 'segs') v = Math.max(1, Math.min(200, Math.round(v))); if (f === 'rows' || f === 'cols' || f === 'rings') v = Math.max(1, Math.min(100, Math.round(v))); if (f === 'spokes') v = Math.max(0, Math.min(180, Math.round(v)));
    if (BOXY[L.k] && (f === 'w' || f === 'h')) { var c = f === 'w' ? L.x + L.w / 2 : L.y + L.h / 2; L[f] = Math.max(0.5, v); if (f === 'w') L.x = c - L.w / 2; else L.y = c - L.h / 2; }
    else if (L.k === 'arc' && (f === 'w' || f === 'h')) { if (f === 'w') L.x2 = L.x1 + (L.x2 >= L.x1 ? 1 : -1) * v; else L.y2 = L.y1 + (L.y2 >= L.y1 ? 1 : -1) * v; }
    else if (L.k === 'line' && (f === 'len' || f === 'ang')) { var cx = (L.x1 + L.x2) / 2, cy = (L.y1 + L.y2) / 2, len = f === 'len' ? v : Math.hypot(L.x2 - L.x1, L.y2 - L.y1), an = (f === 'ang' ? v : Math.atan2(L.y1 - L.y2, L.x2 - L.x1) * 180 / Math.PI) * Math.PI / 180; L.x1 = cx - Math.cos(an) * len / 2; L.y1 = cy + Math.sin(an) * len / 2; L.x2 = cx + Math.cos(an) * len / 2; L.y2 = cy - Math.sin(an) * len / 2; }
    else L[f] = v;
    q.one.d = genLive(L);
  }
  function tsGet(k) { var a = k.split('.'); return TS[a[1]][a[2]]; }
  function tsSet(k, v) { var a = k.split('.'), cur = TS[a[1]][a[2]]; TS[a[1]][a[2]] = typeof cur === 'number' ? +v : v; tsSave(); }
  function bkOf(k) {
    if (BK[k]) return BK[k];
    if (k.indexOf('L.') === 0) return { get: function () { return liveGet(k); }, set: function (v) { liveSet(k, v); }, label: 'Shape', live: true };
    if (k.indexOf('T.') === 0) return { get: function () { return tsGet(k); }, set: function (v) { tsSet(k, v); }, own: true };
    return null;
  }
  function setStrokeW(v) { v = Math.max(0, +v || 0); eachItem('s', function (it) { it.w = v; if (!it.p && v > 0) it.p = { t: 'c', c: '#1d1d1f' }; }, true); }
  function panelRefresh() { if (on) B.ctxRefresh(); }
  function panelSync() {
    if (!on || !B.ctxTool || !doc) return;
    if (keyNow() !== panelKey) { panelRefresh(); return; }
    var root = B.ctxTool;
    Array.prototype.forEach.call(root.querySelectorAll('[data-vk]'), function (el) {
      var k = el.dataset.vk, b = bkOf(k); if (!b) return;
      var v = b.get();
      if (el.dataset.val != null) { el.setAttribute(el.getAttribute('role') === 'tab' ? 'aria-selected' : 'aria-pressed', String(v) === el.dataset.val ? 'true' : 'false'); return; }
      if (el.classList.contains('ctx-chip')) { el.setAttribute('aria-pressed', v && v !== '0' ? 'true' : 'false'); return; }
      if (document.activeElement !== el) el.value = typeof v === 'number' && el.type === 'number' ? r2(v) : v;
      if (el.type === 'range') { var o = el.parentNode.querySelector('output'); if (o) o.textContent = b.fmt ? b.fmt(+v) : v; }
    });
    ['f', 's', 'stop'].forEach(function (k) {
      var sw = root.querySelector('[data-vsw="' + k + '"]'), hx = root.querySelector('[data-vhex="' + k + '"]'); if (!sw) return;
      var css = k === 'stop' ? (stopNow() ? stopNow().c : '') : pcCss(k === 'f' ? 'main' : 'second'), hex = k === 'stop' ? (stopNow() ? stopNow().c : '') : pcGet(k === 'f' ? 'main' : 'second');
      sw.style.setProperty('--sw', css || 'transparent'); sw.classList.toggle('none', !css); sw.classList.toggle('ring', k === 's');
      if (hx) hx.textContent = css ? (hex || '').toUpperCase() + (css.indexOf('gradient') >= 0 && k !== 'stop' ? ' …' : '') : 'None';
    });
    var gb = root.querySelector('[data-vgbar]'); if (gb) gbarSync(gb);
    var vc = root.querySelector('[data-vcount]'); if (vc) vc.textContent = anchorCount(picked()) + ' anchor points';
    var vm = root.querySelector('[data-vmeas]'); if (vm) vm.innerHTML = measText();
    Array.prototype.forEach.call(root.querySelectorAll('[data-vpat]'), function (b3) { b3.setAttribute('aria-pressed', String(TS.pattern.cur === b3.dataset.vpat)); });
    Array.prototype.forEach.call(root.querySelectorAll('[data-vprof]'), function (b2) { var it = itemNow('s'), want = PROFILES.filter(function (q) { return q[0] === b2.dataset.vprof; })[0][2]; b2.setAttribute('aria-pressed', JSON.stringify(it && it.prof ? it.prof.map(function (q) { return [r2(q.t), r2(q.w)]; }) : null) === JSON.stringify(want ? want.map(function (q) { return [r2(q[0]), r2(q[1])]; }) : null) ? 'true' : 'false'); });
    var dis = !anyPicked() && (tool === 'select' || tool === 'groupsel');
    Array.prototype.forEach.call(root.querySelectorAll('[data-vk="x"], [data-vk="y"], [data-vk="w"], [data-vk="h"]'), function (i) { i.disabled = dis; });
  }
  // THE STOPS BAR: the gradient's colours, a marker for each stop
  function gbarSync(bar) {
    var it = gradItem(), g = it && isGrad(it.p) ? it.p : null; if (!g) return;
    bar.firstChild.style.setProperty('--gb', 'linear-gradient(to right,' + g.st.map(function (s) { return rgba(s.c, s.o) + ' ' + r2(s.t * 100) + '%'; }).join(',') + ')');
    var ms = bar.querySelectorAll('b');
    if (ms.length !== g.st.length) { Array.prototype.forEach.call(ms, function (m) { m.remove(); }); g.st.forEach(function () { bar.appendChild(document.createElement('b')); }); ms = bar.querySelectorAll('b'); }
    g.st.forEach(function (s, i) { var m = ms[i]; m.style.left = 'calc(9px + (100% - 18px) * ' + s.t + ')'; m.style.setProperty('--c', s.c); m.style.setProperty('--o', s.o); m.classList.toggle('on', i === gstop); });
  }
  function gbarDown(e) {
    var bar = e.target.closest('[data-vgbar]'); if (!bar || !on) return;
    var it = gradItem(); if (!it || !isGrad(it.p)) return;
    e.preventDefault(); e.stopPropagation();
    var r = bar.getBoundingClientRect(), tAt = function (x) { return Math.max(0, Math.min(1, (x - r.left - 9) / (r.width - 18))); };
    var g = it.p, t = tAt(e.clientX), hit = -1;
    g.st.forEach(function (s, i) { if (Math.abs((s.t - t) * (r.width - 18)) < 10) hit = i; });
    record(hit < 0 ? 'Add Stop' : 'Move Stop');
    if (hit < 0) {
      // (a new stop takes the colour the gradient has there)
      var c = document.createElement('canvas'); c.width = 64; c.height = 1; var x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 64, 0);
      g.st.forEach(function (s) { gr.addColorStop(s.t, s.c); }); x.fillStyle = gr; x.fillRect(0, 0, 64, 1);
      var d = x.getImageData(Math.min(63, Math.round(t * 63)), 0, 1, 1).data, hex = '#' + [d[0], d[1], d[2]].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
      g.st.push({ t: t, c: hex, o: 1 }); g.st.sort(function (a, b) { return a.t - b.t; }); hit = g.st.map(function (s) { return s.t; }).indexOf(t);
    }
    gstop = hit; var stop = g.st[hit], moved = false;
    var syncAll = function () { eachGrad(function (q) { if (q !== g) { q.st = clone(g.st); } }); lastGrad = clone(g); };
    syncAll(); changed(); pcRefresh();
    var mv = function (ev) {
      moved = true; var off = Math.abs(ev.clientY - (r.top + r.height / 2)) > 36 && g.st.length > 2;
      stop.t = tAt(ev.clientX); g.st.sort(function (a, b) { return a.t - b.t; });
      bar.classList.toggle('vec-off', off); gstop = g.st.indexOf(stop); syncAll(); changed();
    };
    var upf = function (ev) {
      window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', upf, true); window.removeEventListener('pointercancel', upf, true); bar.classList.remove('vec-off');
      if (moved && Math.abs(ev.clientY - (r.top + r.height / 2)) > 36 && g.st.length > 2) { g.st.splice(g.st.indexOf(stop), 1); gstop = Math.max(0, gstop - 1); syncAll(); changed(); }
      else if (!moved && hit >= 0) B.picker('main');
    };
    window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', upf, true); window.addEventListener('pointercancel', upf, true);
  }
  var gest = null; // (the control being dragged, so its run of changes is one step)
  function panelInput(e) {
    if (!on) return;
    var el = e.target.closest('[data-vk]'); if (!el || el.tagName !== 'INPUT' || el.type !== 'range') return;
    var k = el.dataset.vk, b = bkOf(k); if (!b) return;
    if (b.view) { b.set(+el.value); var o0 = el.parentNode.querySelector('output'); if (o0) o0.textContent = b.fmt ? b.fmt(+el.value) : el.value; return; }
    if (k === 'T.simplify.tol') { tsSet(k, +el.value); simplifyLive(); return; }
    if (!b.own && gest !== k) { gest = k; record(b.label || 'Change'); }
    b.set(+el.value);
    var o = el.parentNode.querySelector('output'); if (o) o.textContent = b.fmt ? b.fmt(+el.value) : el.value;
    if (b.own) panelSync(); else { renderSome(targetsAndPicked()); drawUI(); bbarSync(); pcRefresh(); }
  }
  function targetsAndPicked() { var out = picked().slice(); return out; }
  function panelChange(e) {
    if (!on) return;
    var el = e.target.closest('[data-vk]'); if (!el) return;
    var k = el.dataset.vk, b = bkOf(k); if (!b) return;
    if (el.type === 'range') { if (k === 'T.simplify.tol') { simpOrig = null; changed(); return; } gest = null; if (!b.view) changed(); return; }
    var v = b.text || el.tagName === 'SELECT' ? el.value : +el.value;
    if (!b.text && el.tagName !== 'SELECT' && (el.value === '' || !isFinite(v))) { panelSync(); return; }
    if (!b.own) record(b.label || 'Change');
    b.set(v); changed();
  }
  function panelClick(e) {
    if (!on) return;
    var t = e.target.closest('[data-vtool]'); if (t) { setTool(t.dataset.vtool); precPick(t.dataset.vtool); return; }
    var sw = e.target.closest('[data-vsw-c]'); if (sw) { var c = sw.dataset.vswC; setColour(TS.swatches.to === 's' ? 'second' : 'main', c === 'none' ? null : c, 'Swatch'); return; }
    var vp = e.target.closest('[data-vpat]'); if (vp) { usePattern(vp.dataset.vpat); return; }
    var pf = e.target.closest('[data-vprof]'); if (pf) { var pr = PROFILES.filter(function (q) { return q[0] === pf.dataset.vprof; })[0]; record('Stroke Profile'); eachItem('s', function (it) { it.prof = pr[2] ? pr[2].map(function (q) { return { t: q[0], w: q[1] }; }) : null; }, true); wpick = -1; changed(); return; }
    var b = e.target.closest('[data-vk]');
    if (b && b.tagName === 'BUTTON') {
      var k = b.dataset.vk, bk = bkOf(k); if (!bk) return;
      var v = b.dataset.val != null ? b.dataset.val : !(bk.get() && bk.get() !== '0');
      if (b.dataset.val == null && typeof tsGetSafe(k) === 'number') v = v ? 1 : 0;
      if (!bk.own) record(bk.label || 'Change');
      bk.set(v); changed(); return;
    }
    var a = e.target.closest('[data-va]'); if (a) act(a.dataset.va, a);
  }
  function tsGetSafe(k) { return k.indexOf('T.') === 0 ? tsGet(k) : k.indexOf('L.') === 0 ? liveGet(k) : null; }
  var simpOrig = null;
  function simplifyLive() {
    var list = targets().filter(function (n) { return n.type === 'path'; }); if (!list.length) { panelSync(); return; }
    if (!simpOrig) { record('Simplify'); simpOrig = list.map(function (n) { return { id: n.id, d: dCopy(n.d), live: clone(n.live) }; }); }
    simpOrig.forEach(function (o) { var n = byId(o.id); if (!n) return; n.d = dCopy(o.d); if (o.live) n.live = clone(o.live); simplifyPath(n, TS.simplify.tol, TS.simplify.corner); });
    renderArt(); drawUI(); panelSync();
  }
  // (the panel's and the quick menu's buttons)
  function act(a) {
    if (act3(a) || act4(a)) return;
    var list = picked().filter(editable);
    if (a === 'zoomin') { zoomStep(1); return; } if (a === 'zoomout') { zoomStep(-1); return; }
    if (a === 'rotreset') { rotateAt(0, stageEl.clientWidth / 2, stageEl.clientHeight / 2); panelSync(); return; }
    if (a === 'selectall') { selectAll(); return; }
    if (a === 'deselect') { setSel([]); return; }
    if (a === 'del') { if (nAnchors() && ANCHORTOOLS[tool]) delAnchors(); else deleteSel(); return; }
    if (a === 'group') { group(); return; } if (a === 'ungroup') { ungroup(); return; } if (a === 'dup') { duplicate(); return; }
    if (a === 'fwd') { arrange(1); return; } if (a === 'back') { arrange(-1); return; } if (a === 'front') { arrange(2); return; } if (a === 'backmost') { arrange(-2); return; }
    if (a === 'fitboard') {
      var bb = boxOf(list), A = AB(); if (!bb) return; var s = Math.min(A.w / bb.w, A.h / bb.h);
      record('Fit to Artboard'); list.forEach(function (n) { xform(n, [s, 0, 0, s, A.x + (A.w - bb.w * s) / 2 - bb.x * s, A.y + (A.h - bb.h * s) / 2 - bb.y * s]); }); changed(); return;
    }
    if (a === 'pick-f' || a === 'pick-s' || a === 'pick-stop') { B.picker(a === 'pick-s' ? 'second' : 'main'); return; }
    if (a === 'penclose') { var sp = penSp(); if (sp && sp.pts.length > 1) { record('Close Path'); sp.closed = true; endPen(); } return; }
    if (a === 'pendone') { endPen(); return; } if (a === 'cvdone') { cv = null; ui.pen = null; changed(); return; }
    if (a === 'joinpicked') { joinPicked(); return; }
    if (a === 'simplify') { var spl = targets().filter(function (n) { return n.type === 'path'; }); if (!spl.length) return; var before = anchorCount(picked()); record('Simplify'); spl.forEach(function (n) { simplifyPath(n, TS.simplify.tol, TS.simplify.corner); }); changed(); B.toast('Simplified: ' + before + ' anchor points to ' + anchorCount(picked())); return; }
    if (a === 'acorner' || a === 'asmooth') {
      record(a === 'acorner' ? 'Corner' : 'Smooth');
      Object.keys(asel).forEach(function (id) { var n = byId(id); if (!n || !editable(n)) return; unlive(n); n.d.forEach(function (sp2, si) { sp2.pts.forEach(function (q, pi) { if (!asel[id][si + ':' + pi]) return; q.a = 0; if (a === 'acorner') { q.ix = q.ox = q.x; q.iy = q.oy = q.y; q.s = 0; } else autoSmooth(sp2, pi); }); }); });
      changed(); return;
    }
    if (a === 'adel') { delAnchors(); return; }
    if (a === 'acut') {
      record('Cut Path'); var ids = [];
      Object.keys(asel).forEach(function (id) { var n = byId(id); if (!n || !editable(n)) return; unlive(n); var keys = Object.keys(asel[id]).map(function (k) { return k.split(':').map(Number); }).sort(function (x, y) { return y[0] - x[0] || y[1] - x[1]; }); keys.forEach(function (k) { if (n.d[k[0]]) { var m = cutAt(n, k[0], k[1]); if (m) ids.push(m.id); } }); ids.push(id); });
      sel = ids; asel = {}; changed(); return;
    }
    if (a === 'fillnone') { setColour('main', null, 'No Fill'); return; }
    if (a === 'fillpicked') { var f = defItem('f'); record('Fill'); targets().forEach(function (n) { var it = itemOf(n.app, 'f', true); it.p = clone(f && f.p); it.on = 1; }); changed(); return; }
    if (a === 'greverse') { record('Reverse Gradient'); eachGrad(function (g) { g.st.forEach(function (s) { s.t = 1 - s.t; }); g.st.reverse(); }); changed(); return; }
    if (a === 'gsolid') { record('Solid Color'); eachItem(TS.gradient.to === 's' ? 's' : 'f', function (it) { if (isGrad(it.p)) it.p = solidOf(it.p); }, false); changed(); return; }
    if (a === 'swadd') { var hx = pcGet(TS.swatches.to === 's' ? 'second' : 'main') || pcGet(TS.swatches.to === 's' ? 'main' : 'second'); if (hx && doc.sw.indexOf(hx) < 0) { record('Add Swatch'); doc.sw.push(hx); changed(); } return; }
    if (a === 'cpnone') { setColour(TS.cpick.to === 's' ? 'second' : 'main', null, 'None'); return; }
    if (a === 'cpmore') { B.picker(TS.cpick.to === 's' ? 'second' : 'main'); return; }
    if (a === 'wpdel') { var it2 = strokeItemOne(); if (it2 && it2.prof && it2.prof[wpick]) { record('Remove Width Point'); eachItem('s', function (q) { if (q.prof && q.prof.length > wpick) q.prof.splice(wpick, 1); q.prof = plainProf(q.prof); }, false); wpick = -1; changed(); } return; }
    if (a === 'wreset') { record('Uniform Width'); eachItem('s', function (q) { q.prof = null; }, false); wpick = -1; changed(); return; }
    if (a === 'pflip') { record('Flip Profile'); eachItem('s', function (q) { if (q.prof) q.prof = q.prof.map(function (p) { return { t: 1 - p.t, w: p.w }; }).reverse(); }, false); changed(); return; }
    if (/^dashp/.test(a)) { record('Dashes'); eachItem('s', function (q) { var w = Math.max(1, q.w); if (a === 'dashp1') q.dash = [w * 3, w * 2]; else if (a === 'dashp2') { q.dash = [0, w * 2]; q.cap = 'round'; } else { q.dash = [w * 4, w * 2, 0, w * 2]; q.cap = 'round'; } }, true); changed(); return; }
    var am = /^a(eye|focus|up|del)-(\d+)$/.exec(a);
    if (am) {
      var i = +am[2], app = shownApp(), it3 = app[i]; if (!it3) return;
      var tgs = targets().length ? targets() : null, apps = tgs ? tgs.map(function (n) { return n.app; }) : [doc.def.app];
      if (am[1] === 'focus') { if (it3.k === 'f') focusF = i; else focusS = i; panelRefresh(); bbarSync(); B.picker(it3.k === 'f' ? 'main' : 'second'); return; }
      record(am[1] === 'eye' ? 'Show or Hide' : am[1] === 'up' ? 'Move Up' : 'Remove');
      apps.forEach(function (ap) {
        if (!ap[i]) return;
        if (am[1] === 'eye') ap[i].on = ap[i].on ? 0 : 1;
        else if (am[1] === 'up' && i < ap.length - 1) { var t2 = ap[i]; ap[i] = ap[i + 1]; ap[i + 1] = t2; }
        else if (am[1] === 'del' && ap.length > 1) ap.splice(i, 1);
      });
      focusF = focusS = -1; changed(); return;
    }
    if (a === 'afill' || a === 'astroke') {
      record(a === 'afill' ? 'Add Fill' : 'Add Stroke');
      var apps2 = targets().length ? targets().map(function (n) { return n.app; }) : [doc.def.app];
      apps2.forEach(function (ap) { if (a === 'afill') ap.push({ k: 'f', p: { t: 'c', c: '#888888' }, o: 0.5, on: 1 }); else { var s2 = clone(defApp()[1]); s2.w = 6; s2.p = { t: 'c', c: '#2f7fd6' }; ap.push(s2); } });
      focusF = focusS = -1; changed(); return;
    }
  }
  function delAnchors() {
    record('Remove Points');
    Object.keys(asel).forEach(function (id) {
      var n = byId(id); if (!n || !editable(n)) return;
      var keys = Object.keys(asel[id]).map(function (k) { return k.split(':').map(Number); }).sort(function (x, y) { return y[0] - x[0] || y[1] - x[1]; });
      keys.forEach(function (k) { var nn = byId(id); if (nn && nn.d[k[0]] && nn.d[k[0]].pts[k[1]]) deletePoint(nn, k[0], k[1]); });
    });
    asel = {}; sel = sel.filter(function (id) { return !!byId(id); }); changed();
  }

  // ---- PICKING A TOOL: a category opens its panel on the tool last used in
  // it; the category stays lit in the left bar, the tool in the panel ----
  function setTool(t) {
    var T = TOOLS[t]; if (!T) return;
    if (T.action) { runAction(t); return; }
    if (te && !TYPE[t]) endEdit();
    if (t !== 'chedit') chs = null;
    ui.ink = ui.brush = ui.build = ui.chover = null; ui.bface = -1;
    if (pen && t !== 'pen') endPen();
    if (cv && t !== 'curvature') { cv = null; ui.pen = null; }
    if (drag) cancelDrag();
    tool = t; var c = catOf(t); cat = c ? c.id : null; if (cat) lastTool[cat] = t;
    ui.hover = ui.hoverPt = ui.pen = null; wpick = -1; ui.smart = ui.snapMk = null; if (t !== 'vblend') blendA = null;
    if (!ANCHORTOOLS[t] && t !== 'vwidth') asel = {};
    groupSync(); panelRefresh(); drawUI(); bbarSync();
    if (stageEl) stageEl.style.cursor = cursorFor(v2(-99, -99), false);
  }
  function pickCat(id) {
    var c = CATS.filter(function (q) { return q.id === id; })[0]; if (!c) return;
    B.showPanel();
    if (id === cat) return; // (picking it again leaves the panel as it is)
    setTool(lastTool[id] || c.tools.filter(function (t) { return !TOOLS[t].action; })[0]);
  }
  function groupSync() {
    if (!groupEl) return;
    Array.prototype.forEach.call(groupEl.querySelectorAll('[data-vcat]'), function (b) { b.setAttribute('aria-pressed', b.dataset.vcat === cat ? 'true' : 'false'); });
  }

  // ---- THE BOTTOM BAR in Vector mode: Stroke Width, Undo, Fill, Swap,
  // Stroke, Redo, Opacity and the quick options; the same bar, the same
  // places, its controls doing Vector's work ----
  var SW_MAX = 100;
  function swPos(w) { return Math.round(Math.sqrt(Math.max(0, Math.min(SW_MAX, w)) / SW_MAX) * 1000); }
  function swAt(pos) { var w = SW_MAX * Math.pow(pos / 1000, 2); return w < 10 ? Math.round(w * 4) / 4 : Math.round(w); }
  function bbarSync() {
    if (!on || !B.sizeIn || !doc) return;
    var s = itemNow('s'), w = s ? s.w : 0, l = picked(), op = l.length ? (l[l.length - 1].opacity == null ? 1 : l[l.length - 1].opacity) : doc.def.op;
    if (document.activeElement !== B.sizeIn) B.sizeIn.value = swPos(w);
    B.sizeIn.nextElementSibling.textContent = w < 10 ? r2(w) : Math.round(w);
    if (document.activeElement !== B.alphaIn) B.alphaIn.value = Math.round(op * 100);
    B.alphaIn.nextElementSibling.textContent = Math.round(op * 100);
    [['main', B.fillDot, B.fillBtn, 'Fill'], ['second', B.strokeDot, B.strokeBtn, 'Stroke']].forEach(function (q) {
      var css = pcCss(q[0]); q[1].style.background = css || ''; q[1].classList.toggle('v-none', !css);
      q[2].setAttribute('aria-label', q[3] + ': ' + (css ? (pcGet(q[0]) || '').toUpperCase() : 'none'));
    });
  }
  function bbarInput(e) {
    if (!on || !doc) return;
    if (e.target === B.sizeIn) { recordC('Stroke Width'); setStrokeW(swAt(+B.sizeIn.value)); renderSome(picked()); drawUI(); bbarSync(); panelSync(); }
    else if (e.target === B.alphaIn) { recordC('Opacity'); var v = +B.alphaIn.value / 100; picked().filter(editable).forEach(function (n) { n.opacity = v; }); doc.def.op = v; renderSome(picked()); bbarSync(); panelSync(); }
  }
  function bbarSetup(vec) {
    if (!B.sizeIn) return;
    var lab = function (inp, t) { var s = inp.parentNode.querySelector('span'); if (s) s.textContent = t; inp.setAttribute('aria-label', t); };
    if (vec) { var w0 = B.sizeIn.parentNode.querySelector('span').getBoundingClientRect().width; lab(B.sizeIn, 'Stroke'); var dw = B.sizeIn.parentNode.querySelector('span').getBoundingClientRect().width - w0; if (dw > 0 && !B.sizeIn.style.width) B.sizeIn.style.width = 'calc(var(--bbar-slider) - ' + r2(dw) + 'px)'; lab(B.alphaIn, 'Opacity'); B.alphaIn.min = 0; B.ctxBtn.setAttribute('aria-label', 'Quick options'); B.ctxBtn.dataset.tip = 'Quick options for the tool and what’s picked'; bbarSync(); }
    else { B.sizeIn.style.width = ''; quickMenu(false); B.fillDot.classList.remove('v-none'); B.strokeDot.classList.remove('v-none'); B.fillDot.style.background = ''; B.strokeDot.style.background = ''; }
  }
  // QUICK OPTIONS: the bottom bar's last button, in Vector mode
  function quickItems() {
    var list = picked().filter(editable), it = [], na = nAnchors();
    if (pen) it.push(['pendone', 'Finish Path', null], ['penclose', 'Close Path', '<path d="M5 18C8 6 16 6 19 18z"/>']);
    if (cv) it.push(['cvdone', 'Finish Path', null]);
    if (te) it.push(['tdone', 'Done Typing', null]);
    if (na && ANCHORTOOLS[tool]) it.push(['acorner', 'Corner Points', IC.corner], ['asmooth', 'Smooth Points', IC.smooth], ['acut', 'Cut at Points', ICONS.scissors], ['adel', 'Remove Points', ICONS.delpt]);
    if (list.length) {
      it.push(['dup', 'Duplicate', IC.dup]);
      if (list.length > 1) it.push(['group', 'Group', IC.group]);
      if (list.some(function (n) { return n.type === 'group'; })) it.push(['ungroup', 'Ungroup', IC.ungroup]);
      if (targets().some(function (n) { return n.d && n.d.some(function (sp) { return !sp.closed; }); })) it.push(['joinpicked', 'Join', ICONS.join]);
      var sp3 = shapePaths(), one3 = list.length === 1 ? list[0] : null;
      if (sp3.length >= 2) it.push(['union', 'Union', ICONS.union], ['minus', 'Subtract', ICONS.minus], ['intersect', 'Intersect', ICONS.intersect], ['exclude', 'Exclude', ICONS.exclude], ['divide', 'Divide', ICONS.divide], ['compound', 'Make Compound Path', ICONS.compound]);
      else if (one3 && one3.type === 'path' && one3.d.length > 1) it.push(['compound', 'Release Compound Path', ICONS.compound]);
      if (one3 && one3.clip) it.push(['clipmask', 'Release Clipping Mask', ICONS.clipmask]); else if (list.length > 1) it.push(['clipmask', 'Make Clipping Mask', ICONS.clipmask]);
      if (list.some(function (n) { return leaves(n).some(function (q) { return q.type === 'text'; }); })) it.push(['outlines', 'Convert to Outlines', ICONS.outlines]);
      if (list.some(hasFx)) it.push(['fxexpandall', 'Expand Effects', IC.dup]);
      if (list.some(function (n) { return n.omask; })) it.push(['omrelease', 'Release Opacity Mask', IC.ungroup]);
      if (list.some(function (n) { return n.type === 'image'; })) it.push(['trace', 'Image Trace', TRACE_IC]);
      it.push(['front', 'Bring to Front', IC.up], ['fwd', 'Bring Forward', IC.up], ['back', 'Send Backward', IC.down], ['backmost', 'Send to Back', IC.down]);
      if (targets().length) it.push(['swap', 'Swap Fill and Stroke', IC.reverse], ['fillnone', 'No Fill', IC.none], ['strokenone', 'No Stroke', IC.none]);
      it.push(['del', 'Delete', IC.trash]);
    } else {
      it.push(['selectall', 'Select All', '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="2.5 2"/>']);
      if (clip) it.push(['paste', 'Paste', IC.dup]);
      it.push(['defaults', 'Default Fill and Stroke', ICONS.solid], ['fitview', 'Fit to Screen', ICONS.fit]);
    }
    it.push(['panel', B.panelOpen() ? 'Hide Tool Settings' : 'Show Tool Settings', '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>']);
    return it;
  }
  function quickMenu(open) {
    if (!ctxMenu) return;
    if (!open) { if (!ctxMenu.hidden) { ctxMenu.hidden = true; B.ctxBtn.setAttribute('aria-expanded', 'false'); } return; }
    ctxMenu.innerHTML = '<div class="pd-title">Quick Options</div>' + quickItems().map(function (q) { return '<button type="button" role="menuitem" data-vq="' + q[0] + '">' + (q[2] ? CI(q[2]) : CI('<path d="M5 12l4.5 4.5L19 7"/>')) + q[1] + '</button>'; }).join('');
    ctxMenu.hidden = false; B.ctxBtn.setAttribute('aria-expanded', 'true');
    var r = B.ctxBtn.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    ctxMenu.style.left = Math.round(Math.max(8, Math.min(vw - ctxMenu.offsetWidth - 8, r.right - ctxMenu.offsetWidth))) + 'px';
    ctxMenu.style.top = Math.round(Math.max(8, r.top - ctxMenu.offsetHeight - 8)) + 'px';
    var f = ctxMenu.querySelector('button'); if (f) f.focus({ preventScroll: true });
  }
  function quickDo(k) {
    quickMenu(false);
    if (k === 'swap') swapColours(); else if (k === 'strokenone') setColour('second', null, 'No Stroke'); else if (k === 'paste') pasteClip();
    else if (k === 'defaults') defaultColours(); else if (k === 'fitview') fit(); else if (k === 'panel') B.togglePanel();
    else act(k);
  }

  // ---- LAYERS: its own panel, opened from the left bar's Layers button.
  // Layers and sublayers, groups and objects in a tree, the top of the
  // stack first: show or hide, lock, fold, rename, pick; drag a row (or its
  // grip, with a finger) to move it, into a layer or group, or between rows ----
  var EYE = function (vis) { return CI(vis ? '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>' : '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.4 3M6.5 7.6C4 9.3 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 4-.9"/>'); };
  var LOCK = function (lk) { return CI(lk ? '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/>' : '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 5.6-1.5"/>'); };
  var KIND = { text: '<path d="M6 7V5h12v2M12 5v14M9.5 19h5"/>', group: IC.group, path: '<path d="M4 18C7 6 13 18 20 6"/><rect x="2.5" y="16.5" width="3" height="3" rx=".6"/><rect x="18.5" y="4.5" width="3" height="3" rx=".6"/>', image: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 16l4.5-4.5 4 4L15 13l5 5"/><circle cx="15.5" cy="9" r="1.5"/>', layer: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5"/>' };
  function layersOpen() { return vlp && !vlp.hidden; }
  function layersPanel(open) {
    if (!vlp) return;
    var fresh = vlp.hidden;
    vlp.hidden = !open; B.layersBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); B.layersBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
    if (open) { layersRender(); B.layersPlace(vlp, B.layersBtn, fresh); }
  }
  function rowHtml(n, depth) {
    var cont = isCont(n), cur = n.type === 'layer' && n.id === doc.cur, on2 = sel.indexOf(n.id) >= 0;
    return '<div class="pl-row vl-row' + (cur ? ' cur' : '') + (on2 ? ' on' : '') + (n.visible ? '' : ' off') + (n.type === 'layer' ? ' vl-layer' : '') + '" data-vn="' + n.id + '" style="--vd:' + depth + '">' +
      '<button type="button" class="pl-eye" data-vn-eye="' + n.id + '" aria-label="' + (n.visible ? 'Hide ' : 'Show ') + esc(n.name) + '" aria-pressed="' + !n.visible + '">' + EYE(n.visible) + '</button>' +
      (cont ? '<button type="button" class="pl-fold" data-vn-fold="' + n.id + '" aria-expanded="' + !!n.open + '" aria-label="' + (n.open ? 'Fold ' : 'Open ') + esc(n.name) + '"><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9.5l5 5 5-5"/></svg></button>' : '<span class="vl-gap" aria-hidden="true"></span>') +
      '<button type="button" class="pl-name" data-vn-name="' + n.id + '"><svg class="pl-folder" viewBox="0 0 24 24" aria-hidden="true">' + (KIND[n.type] || '') + '</svg><span>' + esc(n.name) + '</span></button>' +
      '<button type="button" class="pl-eye vl-lock" data-vn-lock="' + n.id + '" aria-label="' + (n.locked ? 'Unlock ' : 'Lock ') + esc(n.name) + '" aria-pressed="' + !!n.locked + '">' + LOCK(n.locked) + '</button>' +
      '<span class="pl-grip" data-vn-grip title="Drag to move it" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="7" r="1.3"/><circle cx="15" cy="7" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="17" r="1.3"/><circle cx="15" cy="17" r="1.3"/></svg></span></div>';
  }
  function rowsOf(list, depth) { return list.slice().reverse().map(function (n) { return rowHtml(n, depth) + (isCont(n) && n.open ? rowsOf(n.items, depth + 1) : ''); }).join(''); }
  function layersRender() {
    if (!layersOpen() || !doc) return;
    var listEl = vlp.querySelector('.pl-list'), scroll = listEl ? listEl.scrollTop : 0, objs = picked();
    var cur = curLayer(), w = cur && where(cur.id);
    var canUp = objs.length ? objs.some(function (n) { var q = where(n.id); return q && q.i < q.list.length - 1; }) : w && w.i < w.list.length - 1;
    var canDown = objs.length ? objs.some(function (n) { var q = where(n.id); return q && q.i > 0; }) : w && w.i > 0;
    var canDel = objs.length ? objs.some(function (n) { return chain(n.id).every(function (q) { return !q.locked; }); }) : doc.layers.length > 1 || (w && w.p);
    vlp.innerHTML = '<div class="pl-title">Vector Layers</div>' +
      '<div class="pl-acts">' +
        '<button type="button" data-vl-act="add" title="New layer" aria-label="New layer">' + CI(IC.plus) + '</button>' +
        '<button type="button" data-vl-act="sub" title="New sublayer, in the current layer" aria-label="New sublayer">' + CI('<path d="M5 5v9a2 2 0 0 0 2 2h7"/><path d="M17 12v8M13 16h8"/>') + '</button>' +
        '<button type="button" data-vl-act="up" title="Move up" aria-label="Move up"' + (canUp ? '' : ' disabled') + '>' + CI(IC.up) + '</button>' +
        '<button type="button" data-vl-act="down" title="Move down" aria-label="Move down"' + (canDown ? '' : ' disabled') + '>' + CI(IC.down) + '</button>' +
        '<button type="button" data-vl-act="del" title="' + (objs.length ? 'Delete the picked objects' : 'Delete the layer') + '" aria-label="Delete"' + (canDel ? '' : ' disabled') + '>' + CI(IC.trash) + '</button>' +
      '</div><div class="pl-list">' + rowsOf(doc.layers, 0) + '</div>';
    vlp.querySelector('.pl-list').scrollTop = scroll;
    B.layersPlace(vlp, B.layersBtn, false);
  }
  var dndDone = 0;
  function layersClick(e) {
    if (dndDone) { e.preventDefault(); return; } // (the click that ends a drag)
    var b = e.target.closest('button'); if (!b || !doc) return;
    var d = b.dataset, n;
    if (d.vnEye) { n = byId(d.vnEye); record(n.visible ? 'Hide' : 'Show'); n.visible = !n.visible; changed(); }
    else if (d.vnLock) { n = byId(d.vnLock); record(n.locked ? 'Unlock' : 'Lock'); n.locked = !n.locked; if (n.locked) sel = sel.filter(function (id) { return editable(byId(id)); }); changed(); }
    else if (d.vnFold) { n = byId(d.vnFold); n.open = !n.open; layersRender(); B.autosave(); }
    else if (d.vnName) {
      n = byId(d.vnName);
      if (n.type === 'layer') {
        if (doc.cur === n.id && !sel.length) { rename(b, n.name, function (v) { record('Rename'); n.name = v; delete n.auto; changed(); }); return; }
        doc.cur = n.id; sel = []; asel = {}; selChanged(); return;
      }
      if (sel.length === 1 && sel[0] === n.id && !e.shiftKey) { rename(b, n.name, function (v) { record('Rename'); n.name = v; delete n.auto; changed(); }); return; }
      if (e.shiftKey || e.metaKey || e.ctrlKey) setSel(sel.indexOf(n.id) >= 0 ? sel.filter(function (x) { return x !== n.id; }) : sel.concat(n.id));
      else setSel([n.id]);
      if (!BOXTOOLS[tool] && !ANCHORTOOLS[tool]) setTool('select');
    }
    else if (d.vlAct === 'add') { record('New Layer'); var L = newLayer(); var cw = where(L.id); if (cw && cw.p) { cw.list.splice(cw.i, 1); var top = chain(cw.p.id)[0]; var tw = where(top.id); doc.layers.splice(tw.i + 1, 0, L); } sel = []; asel = {}; changed(); }
    else if (d.vlAct === 'sub') { record('New Sublayer'); newLayer('Sublayer', curLayer()); sel = []; asel = {}; changed(); }
    else if (d.vlAct === 'up' || d.vlAct === 'down') {
      if (picked().length) { arrange(d.vlAct === 'up' ? 1 : -1); return; }
      var cur = curLayer(), w = where(cur.id), j = w.i + (d.vlAct === 'up' ? 1 : -1); if (j < 0 || j >= w.list.length) return;
      record(d.vlAct === 'up' ? 'Move Layer Up' : 'Move Layer Down'); w.list.splice(w.i, 1); w.list.splice(j, 0, cur); changed();
    }
    else if (d.vlAct === 'del') {
      if (picked().length) { deleteSel(); return; }
      var c2 = curLayer(), w2 = where(c2.id); if (!w2.p && doc.layers.length < 2) return;
      record('Delete Layer'); w2.list.splice(w2.i, 1); doc.cur = (w2.p && w2.p.type === 'layer' ? w2.p : doc.layers[Math.max(0, w2.i - 1)] || doc.layers[0]).id; changed();
    }
  }
  function layersDbl(e) { var b = e.target.closest('[data-vn-name]'); if (!b) return; var n = byId(b.dataset.vnName); if (n) rename(b, n.name, function (v) { record('Rename'); n.name = v; delete n.auto; changed(); }); }
  function rename(btn2, name, done) {
    if (btn2.querySelector('input')) return;
    var i = document.createElement('input'); i.className = 'pl-rename p-field'; i.value = name; i.maxLength = 40;
    var span = btn2.querySelector('span'); span.hidden = true; btn2.appendChild(i); i.focus(); i.select();
    var over = false, fin = function (ok) { if (over) return; over = true; var v = i.value.trim(); i.remove(); span.hidden = false; if (ok && v && v !== name) done(v); else layersRender(); };
    i.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); });
    i.addEventListener('blur', function () { fin(true); });
    i.addEventListener('click', function (e) { e.stopPropagation(); });
  }
  // DRAG AND DROP in the tree
  function layersDown(e) {
    var row = e.target.closest('[data-vn]'); if (!row || e.button || e.target.closest('.pl-eye, .pl-fold, input')) return;
    var grip = !!e.target.closest('[data-vn-grip]'), touch = e.pointerType !== 'mouse';
    if (touch && !grip) return; // (with a finger, a row scrolls the list; its grip moves it)
    var id = row.dataset.vn, x0 = e.clientX, y0 = e.clientY, started = false, drop = null, mark = null;
    if (grip) e.preventDefault();
    var list = vlp.querySelector('.pl-list');
    function start() { started = true; row.classList.add('vl-dragging'); mark = document.createElement('div'); mark.className = 'vl-drop'; list.appendChild(mark); }
    function mv(ev) {
      if (!started) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return; start(); }
      ev.preventDefault(); drop = dropAt(ev.clientY, id); placeMark(mark, drop, list);
      var lr = list.getBoundingClientRect(); if (ev.clientY < lr.top + 16) list.scrollTop -= 8; else if (ev.clientY > lr.bottom - 16) list.scrollTop += 8;
    }
    function upf() {
      window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', upf, true); window.removeEventListener('pointercancel', upf, true);
      if (!started) return;
      dndDone = 1; setTimeout(function () { dndDone = 0; }, 0); row.classList.remove('vl-dragging'); if (mark) mark.remove();
      if (drop && drop.ok) { record('Move in Layers'); moveTo(id, drop); changed(); } else layersRender();
    }
    window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', upf, true); window.addEventListener('pointercancel', upf, true);
  }
  // (where a row dragged to y would go: into a container, or above or below a row)
  function dropAt(y, id) {
    var rows = Array.prototype.slice.call(vlp.querySelectorAll('[data-vn]')), best = null;
    rows.forEach(function (r) { var b = r.getBoundingClientRect(); if (y >= b.top - 1 && y <= b.bottom + 1) best = { r: r, b: b }; });
    if (!best) { var last = rows[rows.length - 1]; if (!last) return null; var lb = last.getBoundingClientRect(); if (y > lb.bottom) best = { r: last, b: lb }; else { var fb = rows[0].getBoundingClientRect(); best = { r: rows[0], b: fb }; } }
    var t = byId(best.r.dataset.vn), dn = byId(id), f = (y - best.b.top) / best.b.height, pos = isCont(t) && f > 0.28 && f < 0.72 ? 'into' : f < 0.5 ? 'above' : 'below';
    var ok = t && dn && t !== dn && chain(t.id).indexOf(dn) < 0;
    if (ok && pos === 'into' && dn.type === 'layer' && t.type === 'group') ok = false;
    if (ok && pos !== 'into') { var w = where(t.id); if (!w.p && dn.type !== 'layer') pos = pos === 'above' ? 'into-top' : 'into-bottom'; if (w.p && w.p.type === 'group' && dn.type === 'layer') ok = false; }
    return { id: t && t.id, pos: pos, ok: ok, r: best.r };
  }
  function placeMark(mark, drop, list) {
    if (!drop) { mark.hidden = true; return; } mark.hidden = false;
    var lr = list.getBoundingClientRect(), b = drop.r.getBoundingClientRect(), y = drop.pos === 'below' || drop.pos === 'into-bottom' ? b.bottom : b.top;
    mark.classList.toggle('into', /^into/.test(drop.pos) && drop.pos !== 'into-top' && drop.pos !== 'into-bottom' || drop.pos === 'into');
    mark.classList.toggle('bad', !drop.ok);
    if (drop.pos === 'into') { mark.style.top = (b.top - lr.top + list.scrollTop) + 'px'; mark.style.height = b.height + 'px'; }
    else { mark.style.top = (y - lr.top + list.scrollTop - 1) + 'px'; mark.style.height = ''; }
  }
  function moveTo(id, drop) {
    var n = byId(id), w = where(id); w.list.splice(w.i, 1);
    var t = byId(drop.id);
    if (drop.pos === 'into' || drop.pos === 'into-top') { t.items.push(n); t.open = true; }
    else if (drop.pos === 'into-bottom') { t.items.unshift(n); t.open = true; }
    else { var tw = where(t.id); tw.list.splice(drop.pos === 'above' ? tw.i + 1 : tw.i, 0, n); }
    if (n.type === 'layer') doc.cur = n.id;
  }

  // ---- ARTWORK ACROSS, AND SAVING IT ----
  // (the artwork as pixels, fitted into pw × ph as the artboard fits there,
  // see-through where nothing is)
  function raster(pw, ph, white, board) {
    var ims = [], fonts = 0; allLeaves().forEach(function (n) { if (n.type === 'image') { var im = imgFor(n.asset); if (im) ims.push(im.ready); } if (n.type === 'text' && document.fonts) { fonts = 1; ims.push(document.fonts.load(tFont(n, 40)).catch(function () {})); } });
    return Promise.all(ims).then(function () {
      if (fonts) TX.cache.clear();
      var c = document.createElement('canvas'); c.width = pw; c.height = ph;
      var x = c.getContext('2d'); if (white) { x.fillStyle = '#fff'; x.fillRect(0, 0, pw, ph); }
      if (!doc) return c;
      var A = board || AB(), s = Math.min(pw / A.w, ph / A.h); x.setTransform(s, 0, 0, s, (pw - A.w * s) / 2 - A.x * s, (ph - A.h * s) / 2 - A.y * s);
      doc.layers.forEach(function (L) { cDraw(x, L); });
      return c;
    });
  }
  function svgText(list) {
    var used = {}; (list || doc.layers).forEach(function (n) { leaves(n).forEach(function (q) { if (q.type === 'image' && q.visible && assets[q.asset]) used[q.asset] = 1; }); });
    var A = AB(), b = list ? boxOf(list) : { x: A.x, y: A.y, w: A.w, h: A.h };
    return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + r2(b.w) + '" height="' + r2(b.h) + '" viewBox="' + r2(b.x) + ' ' + r2(b.y) + ' ' + r2(b.w) + ' ' + r2(b.h) + '">\n' +
      (Object.keys(used).length ? '<defs>' + Object.keys(used).map(symbolOf).join('') + '</defs>\n' : '') +
      (!list && !A.clear ? '<rect x="' + r2(A.x) + '" y="' + r2(A.y) + '" width="' + r2(A.w) + '" height="' + r2(A.h) + '" fill="#ffffff"/>\n' : '') +
      (list || doc.layers).map(function (n) { return nodeSvg(n, false); }).join('\n') + '\n</svg>\n';
  }
  function exportBlob(type) {
    if (!doc) return Promise.resolve(null);
    if (type === 'svg') return Promise.resolve(new Blob([svgText()], { type: 'image/svg+xml' }));
    var A = AB(); return raster(Math.round(A.w), Math.round(A.h), type === 'jpeg' || !A.clear).then(function (c) { return new Promise(function (ok) { c.toBlob(ok, type === 'jpeg' ? 'image/jpeg' : 'image/png', 0.93); }); });
  }
  // KEEPING IT: with the drawing, in the browser and in project files
  function serialize() {
    if (!doc) return null;
    var used = {}; allLeaves().forEach(function (n) { if (n.type === 'image' && assets[n.asset]) used[n.asset] = assets[n.asset]; });
    var A = AB();
    return { v: 3, w: A.w, h: A.h, boards: clone(doc.boards), ab: doc.ab, guides: clone(doc.guides), pats: clone(doc.pats), n: doc.n, cur: doc.cur, layers: clone(doc.layers), def: clone(doc.def), sw: doc.sw.slice(), view: { x: view.x, y: view.y, k: view.k, r: view.r, fit: view.fit }, sel: sel.slice(), tool: tool, assets: used };
  }
  function nm(v, d) { v = +v; return isFinite(v) ? v : d; }
  var ENUM = { cap: ['butt', 'round', 'square'], join: ['miter', 'round', 'bevel'] };
  function sPaint(p) {
    if (!p || typeof p !== 'object') return null;
    if (p.t === 'c') return HEX.test(p.c) ? { t: 'c', c: p.c.toLowerCase() } : null;
    if ((p.t === 'l' || p.t === 'r') && Array.isArray(p.st) && p.st.length >= 2) {
      var st = p.st.slice(0, 32).filter(function (s) { return s && HEX.test(s.c); }).map(function (s) { return { t: Math.max(0, Math.min(1, nm(s.t, 0))), c: s.c.toLowerCase(), o: Math.max(0, Math.min(1, nm(s.o, 1))) }; });
      if (st.length < 2) return null;
      return p.t === 'r' ? { t: 'r', st: st, cx: nm(p.cx, 0.5), cy: nm(p.cy, 0.5), r: Math.max(0.001, nm(p.r, 0.5)) } : { t: 'l', st: st, x1: nm(p.x1, 0), y1: nm(p.y1, 0.5), x2: nm(p.x2, 1), y2: nm(p.y2, 0.5) };
    }
    if (p.t === 'p' && patIds[p.id]) return { t: 'p', id: p.id, s: clampN(nm(p.s, 1), 0.01, 100), a: clampN(nm(p.a, 0), -360, 360), x: clampN(nm(p.x, 0), -1e5, 1e5), y: clampN(nm(p.y, 0), -1e5, 1e5) };
    return null;
  }
  function clampN(v, a, b) { return Math.max(a, Math.min(b, v)); }
  // (the artboards, guides and patterns, checked)
  function sBoards(a, W0, H0) {
    var ids = {}, out = (Array.isArray(a) ? a : []).slice(0, 100).map(function (b) {
      if (!b || typeof b !== 'object') return null; var x = nm(b.x, NaN), y = nm(b.y, NaN), w = nm(b.w, NaN), h = nm(b.h, NaN);
      if (![x, y, w, h].every(isFinite) || w < 1 || h < 1 || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) return null;
      var id = String(b.id || '').replace(/[^\w-]/g, '').slice(0, 40); if (!id || ids[id]) id = newBoardId(); ids[id] = 1;
      var o = { id: id, name: String(b.name || '').slice(0, 40) || 'Artboard', x: x, y: y, w: Math.min(w, 100000), h: Math.min(h, 100000) }; if (b.clear) o.clear = 1; return o;
    }).filter(Boolean);
    return out.length ? out : [{ id: 'B1', name: 'Artboard 1', x: 0, y: 0, w: W0, h: H0 }];
  }
  function sGuides(a) { return (Array.isArray(a) ? a : []).slice(0, 500).filter(function (g) { return g && (g.o === 'h' || g.o === 'v') && isFinite(nm(g.p, NaN)) && Math.abs(nm(g.p, 0)) < 1e7; }).map(function (g) { return { o: g.o, p: nm(g.p, 0) }; }); }
  function sPat(q) {
    if (!q || typeof q !== 'object' || !Array.isArray(q.items)) return null;
    var items = q.items.slice(0, 2000).map(function (n) { return sNode(n, 1, false); }).filter(Boolean); if (!items.length) return null;
    return { id: String(q.id || '').replace(/[^\w-]/g, '').slice(0, 40) || 'P' + uid(''), name: String(q.name || 'Pattern').slice(0, 40), items: items, gap: clampN(nm(q.gap, 0), -1000, 10000) };
  }
  // (a live effect, checked: a warp's style and amounts, an envelope's mesh; a repeat's and a blend's settings)
  function sFx(f) {
    if (!f || typeof f !== 'object') return null;
    if (f.k === 'warp') return WARPS.some(function (w) { return w[0] === f.st; }) ? { k: 'warp', st: f.st, bend: clampN(nm(f.bend, 50), -100, 100), hd: clampN(nm(f.hd, 0), -100, 100), vd: clampN(nm(f.vd, 0), -100, 100), dir: f.dir === 'v' ? 'v' : 'h' } : null;
    if (f.k !== 'env') return null;
    var R = Math.round(nm(f.rows, 0)), C = Math.round(nm(f.cols, 0)); if (!(R >= 1 && R <= 12 && C >= 1 && C <= 12) || !Array.isArray(f.m) || f.m.length !== (R + 1) * (C + 1)) return null;
    var m = f.m.map(function (q) { return Array.isArray(q) ? [nm(q[0], NaN), nm(q[1], NaN)] : [NaN, NaN]; });
    return m.every(function (q) { return isFinite(q[0]) && isFinite(q[1]) && Math.abs(q[0]) < 1e4 && Math.abs(q[1]) < 1e4; }) ? { k: 'env', rows: R, cols: C, m: m } : null;
  }
  function sRep(r) {
    if (!r || typeof r !== 'object' || ['radial', 'grid', 'mirror'].indexOf(r.k) < 0) return null;
    return { k: r.k, n: clampN(Math.round(nm(r.n, 8)), 2, 200), r: clampN(nm(r.r, 120), 1, 1e5), rows: clampN(Math.round(nm(r.rows, 3)), 1, 50), cols: clampN(Math.round(nm(r.cols, 3)), 1, 50), gx: clampN(nm(r.gx, 20), -1e4, 1e4), gy: clampN(nm(r.gy, 20), -1e4, 1e4), a: clampN(nm(r.a, 90), -360, 360), off: clampN(nm(r.off, 0), -1e4, 1e4) };
  }
  function sApp(app) {
    if (!Array.isArray(app)) return defApp();
    return app.slice(0, 24).filter(function (it) { return it && (it.k === 'f' || it.k === 's'); }).map(function (it) {
      var o = { k: it.k, p: sPaint(it.p), o: Math.max(0, Math.min(1, nm(it.o, 1))), on: it.on === 0 || it.on === false ? 0 : 1 };
      if (it.k === 's') {
        o.w = Math.max(0, Math.min(2000, nm(it.w, 1))); o.cap = ENUM.cap.indexOf(it.cap) >= 0 ? it.cap : 'butt'; o.join = ENUM.join.indexOf(it.join) >= 0 ? it.join : 'miter'; o.ml = Math.max(1, Math.min(100, nm(it.ml, 10)));
        o.dash = Array.isArray(it.dash) && it.dash.length ? it.dash.slice(0, 12).map(function (v) { return Math.max(0, nm(v, 0)); }) : null;
        o.prof = Array.isArray(it.prof) && it.prof.length > 1 ? it.prof.slice(0, 64).map(function (q) { return { t: Math.max(0, Math.min(1, nm(q && q.t, 0))), w: Math.max(0, Math.min(40, nm(q && q.w, 1))) }; }).sort(function (a, b) { return a.t - b.t; }) : null;
      }
      return o;
    });
  }
  var LIVEK = { rect: 1, rrect: 1, ellipse: 1, polygon: 1, star: 1, spiral: 1, line: 1, arc: 1, rgrid: 1, pgrid: 1 };
  function sLive(L) {
    if (!L || !LIVEK[L.k]) return null;
    var o = { k: L.k }, ok = true;
    Object.keys(L).forEach(function (k) { if (k === 'k') return; if (k === 'm') { var m = sMat(L.m); if (m) o.m = m; else ok = false; return; } var v = nm(L[k], NaN); if (!isFinite(v)) ok = false; else o[k] = v; });
    return ok ? o : null;
  }
  function sMat(m) { if (!Array.isArray(m) || m.length !== 6) return null; var o = m.map(function (v) { return nm(v, NaN); }); return o.every(isFinite) && Math.abs(o[0] * o[3] - o[1] * o[2]) > 1e-12 ? o : null; }
  function sD(d, max) {
    return (Array.isArray(d) ? d : []).slice(0, max || 5000).map(function (sp) {
      if (!sp || !Array.isArray(sp.pts)) return null;
      var pts = sp.pts.slice(0, 100000).map(function (q) { if (!q) return null; var x = nm(q.x, NaN), y = nm(q.y, NaN); if (!isFinite(x) || !isFinite(y)) return null; var r = { x: x, y: y, ix: nm(q.ix, x), iy: nm(q.iy, y), ox: nm(q.ox, x), oy: nm(q.oy, y), s: q.s ? 1 : 0 }; if (q.a) r.a = 1; return r; }).filter(Boolean);
      return pts.length ? { pts: pts, closed: !!sp.closed } : null;
    }).filter(Boolean);
  }
  function sNode(n, depth, top) {
    if (!n || typeof n !== 'object' || depth > 40) return null;
    var type = top ? 'layer' : n.type, base = { id: String(n.id || uid()), type: type, name: String(n.name || '').slice(0, 40), visible: n.visible !== false, locked: !!n.locked };
    if (!base.id.replace(/[^\w-]/g, '')) base.id = uid(); base.id = base.id.replace(/[^\w-]/g, '').slice(0, 40);
    if (type === 'layer' || type === 'group') {
      base.open = n.open !== false; base.name = base.name || (type === 'layer' ? 'Layer' : 'Group');
      base.items = (Array.isArray(n.items) ? n.items : []).slice(0, 20000).map(function (q) { return sNode(q, depth + 1, false); }).filter(Boolean);
      if (type === 'group') {
        base.opacity = Math.max(0, Math.min(1, nm(n.opacity, 1))); base.blend = BLENDS.some(function (b) { return b[0] === n.blend; }) ? n.blend : 'normal'; if (n.clip && base.items.length > 1 && base.items[base.items.length - 1].type === 'path') base.clip = true;
        var gf = sFx(n.efx); if (gf) base.efx = gf; var gr = sRep(n.rep); if (gr) base.rep = gr; if (n.blnd && typeof n.blnd === 'object') base.blnd = { steps: clampN(Math.round(nm(n.blnd.steps, 4)), 1, 500), smooth: n.blnd.smooth ? 1 : 0 };
        if (n.omask && typeof n.omask === 'object' && base.items.length > 1) base.omask = { inv: n.omask.inv ? 1 : 0, clip: n.omask.clip ? 1 : 0 }; if (n.iso) base.iso = 1;
      }
      return base;
    }
    base.opacity = Math.max(0, Math.min(1, nm(n.opacity, 1))); base.blend = BLENDS.some(function (b) { return b[0] === n.blend; }) ? n.blend : 'normal';
    if (type === 'image') {
      if (!assets[n.asset]) return null;
      base.asset = n.asset; base.x = nm(n.x, 0); base.y = nm(n.y, 0); base.w = Math.max(0.5, nm(n.w, 1)); base.h = Math.max(0.5, nm(n.h, 1)); base.fx = n.fx ? 1 : 0; base.fy = n.fy ? 1 : 0; base.name = base.name || 'Picture';
      var im = sMat(n.mt); if (im) base.mt = im;
      return base;
    }
    if (type === 'text') {
      var kind = ['point', 'area', 'path'].indexOf(n.kind) >= 0 ? n.kind : 'point';
      base.kind = kind; base.txt = String(n.txt == null ? '' : n.txt).slice(0, 20000); base.vert = n.vert && kind !== 'path' ? 1 : 0;
      base.x = nm(n.x, 0); base.y = nm(n.y, 0); base.font = String(n.font || TS.type.font).replace(/[<>{};\\]/g, '').slice(0, 300) || TS.type.font;
      base.size = Math.max(0.5, Math.min(4000, nm(n.size, 48))); base.weight = nm(n.weight, 400) >= 600 ? 700 : 400; base.italic = n.italic ? 1 : 0;
      base.lead = Math.max(0.5, Math.min(5, nm(n.lead, 1.2))); base.track = Math.max(-500, Math.min(2000, nm(n.track, 0))); base.align = ['left', 'center', 'right', 'justify'].indexOf(n.align) >= 0 ? n.align : 'left';
      if (kind === 'area') { base.area = sD(n.area, 200).filter(function (sp) { return sp.closed; }); if (!base.area.length) return null; }
      if (kind === 'path') { base.pd = sD(n.pd, 1); if (!base.pd.length) return null; base.off = Math.max(0, Math.min(1, nm(n.off, 0))); base.flip = n.flip ? 1 : 0; }
      var tm = sMat(n.mt); if (tm && kind !== 'path') base.mt = tm;
      if (n.ch && typeof n.ch === 'object') { var ch = {}; Object.keys(n.ch).slice(0, 5000).forEach(function (k) { var c = n.ch[k], i = parseInt(k, 10); if (!c || !(i >= 0) || i > 20000) return; var o = {}; if (nm(c.dx, 0)) o.dx = nm(c.dx, 0); if (nm(c.dy, 0)) o.dy = nm(c.dy, 0); if (nm(c.r, 0)) o.r = Math.max(-360, Math.min(360, nm(c.r, 0))); if (c.s != null && nm(c.s, 1) !== 1) o.s = Math.max(0.1, Math.min(20, nm(c.s, 1))); if (HEX.test(c.c)) o.c = c.c.toLowerCase(); if (Object.keys(o).length) ch[i] = o; }); if (Object.keys(ch).length) base.ch = ch; }
      base.app = sApp(n.app); base.name = base.name || 'Text'; if (n.auto) base.auto = 1;
      return base;
    }
    if (type === 'path') {
      base.d = sD(n.d);
      if (!base.d.length) return null;
      if (n.rule === 'evenodd') base.rule = 'evenodd';
      base.app = sApp(n.app); base.name = base.name || 'Path';
      var L = sLive(n.live); if (L) base.live = L;
      var pf = sFx(n.efx); if (pf) base.efx = pf;
      return base;
    }
    return null;
  }
  function load(d) {
    if (te) { te = null; try { ta.blur(); } catch (x) {} }
    hist = []; fut = []; sel = []; asel = {}; imgs = {}; assets = {}; pen = null; cv = null; drag = null; clip = null; chs = null; tref = null; dq = null; bld = null; keyId = null; TX.cache.clear(); SHOWN.clear(); meas = null; blendA = null; snapCache = null;
    if (defsEl) defsEl.innerHTML = '';
    if (!d || !Array.isArray(d.layers) || !(d.w > 0) || !(d.h > 0)) { doc = null; view.fit = true; if (on) leave(); return; }
    var as = d.assets && typeof d.assets === 'object' ? d.assets : {};
    Object.keys(as).forEach(function (id) { var a = as[id]; if (a && typeof a.src === 'string' && /^data:image\//.test(a.src) && /^[\w-]+$/.test(id)) assets[id] = { src: a.src, w: Math.max(1, nm(a.w, 1)), h: Math.max(1, nm(a.h, 1)) }; });
    var W0 = Math.max(1, nm(d.w, 1024)), H0 = Math.max(1, nm(d.h, 768));
    // (patterns first, so fills can name them; a pattern's own art has none)
    patIds = {}; var pats = (Array.isArray(d.pats) ? d.pats : []).slice(0, 200).map(sPat).filter(Boolean); pats.forEach(function (q) { if (patIds[q.id]) q.id = 'P' + uid(''); patIds[q.id] = 1; });
    doc = { v: 3, w: W0, h: H0, n: d.n | 0 || 1, cur: String(d.cur || ''), boards: sBoards(d.boards, W0, H0), ab: String(d.ab || ''), guides: sGuides(d.guides), pats: pats,
      layers: d.layers.slice(0, 500).map(function (L) { return sNode(L, 0, true); }).filter(Boolean),
      def: { app: d.def && d.def.app ? sApp(d.def.app) : defApp(), op: Math.max(0, Math.min(1, nm(d.def && d.def.op, 1))), blend: d.def && BLENDS.some(function (b) { return b[0] === d.def.blend; }) ? d.def.blend : 'normal' },
      sw: (Array.isArray(d.sw) ? d.sw : []).filter(function (c) { return HEX.test(c); }).slice(0, 200) };
    if (!doc.layers.length) doc.layers = blank(W0, H0).layers;
    curLayer(); AB();
    sel = (Array.isArray(d.sel) ? d.sel : []).filter(function (id) { return !!byId(id); });
    if (d.view && isFinite(d.view.k) && d.view.k > 0) { view.x = nm(d.view.x, 0); view.y = nm(d.view.y, 0); view.k = d.view.k; view.r = nm(d.view.r, 0); view.fit = !!d.view.fit; } else view.fit = true;
    lastSize = null;
    if (TOOLS[d.tool] && !TOOLS[d.tool].action) { tool = d.tool; var tc = catOf(tool); cat = tc ? tc.id : null; if (cat) lastTool[cat] = tool; }
    ensureDefs(); renderArt();
    if (on) { relayout(); changed(false); }
  }
  function blank(w, h) {
    return { v: 3, w: w, h: h, boards: [{ id: 'B1', name: 'Artboard 1', x: 0, y: 0, w: w, h: h }], ab: 'B1', guides: [], pats: [], n: 1, cur: 'L1', layers: [{ id: 'L1', type: 'layer', name: 'Layer 1', visible: true, locked: false, open: true, items: [] }], def: { app: defApp(), op: 1, blend: 'normal' }, sw: [] };
  }
  // (a picture in: on the current layer; its own size if it fits, otherwise fitted)
  function placeImage(src, w, h, name, fitAll) {
    var A = AB(), a = addAsset(src, w, h), k = fitAll ? Math.min(A.w / w, A.h / h) : Math.min(1, A.w * 0.9 / w, A.h * 0.9 / h);
    return { id: uid('o'), type: 'image', name: name, asset: a, x: A.x + (A.w - w * k) / 2, y: A.y + (A.h - h * k) / 2, w: w * k, h: h * k, fx: 0, fy: 0, opacity: 1, blend: 'normal', visible: true, locked: false };
  }
  function addImageFile(file) {
    clearTimeout(pasteTimer);
    if (!file || !/^image\//.test(file.type)) { B.toast('That isn’t a picture'); return; }
    var rd = new FileReader();
    rd.onload = function () {
      var im = new Image();
      im.onload = function () {
        if (!doc) return;
        record('Place Picture');
        var o = placeImage(rd.result, im.naturalWidth, im.naturalHeight, (file.name || 'Picture').replace(/\.[a-z0-9]+$/i, '').slice(0, 40), false);
        insertNode(o); sel = [o.id]; asel = {}; setTool('select'); changed();
        B.toast('Placed the picture: drag it, or its corners to size it');
      };
      im.onerror = function () { B.toast('That picture couldn’t be opened'); };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  }

  // ---- IN AND OUT OF VECTOR MODE ----
  // (flat: a copy of the painting to bring in, as a picture on a layer of
  // its own; the first time, a blank artboard the painting's size)
  function enter(flat) {
    var sz = B.docSize();
    if (!doc) { doc = blank(sz.pw, sz.ph); view.fit = true; lastSize = null; }
    on = true; stageEl.hidden = false; groupEl.hidden = false; bbarSetup(true);
    renderArt();
    if (view.fit || !lastSize) { lastSize = { w: stageEl.clientWidth, h: stageEl.clientHeight }; if (view.fit) fit(); else { fitView(); applyView(); } } else relayout();
    if (flat) {
      record('Bring Artwork');
      var n = 1; walk(doc.layers, function (L) { if (L.type === 'layer' && /^Painting( \d+)?$/.test(L.name)) n++; });
      var L = newLayer(n > 1 ? 'Painting ' + n : 'Painting');
      var o = placeImage(flat.toDataURL('image/png'), flat.width, flat.height, 'Painting', true);
      L.items.push(o); sel = [o.id]; asel = {}; doc.cur = L.id; setTool('select');
    }
    groupSync(); changed();
    stageEl.style.cursor = cursorFor(v2(-99, -99), false);
  }
  function leave() {
    if (te) endEdit(); chs = null;
    if (pen) endPen();
    on = false; if (stageEl) stageEl.hidden = true; if (groupEl) groupEl.hidden = true;
    layersPanel(false); bbarSetup(false); drag = null; pinch = null; pts = {}; ui.marquee = ui.lasso = ui.knife = ui.zoom = ui.join = ui.pen = null; spaceDown = false; cv = null;
  }
  // (keys while Vector mode is showing: true when it's dealt with one)
  function key(e) {
    var k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
    if (!doc) return false;
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return true; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return true; }
    if (mod && k === 'a') { e.preventDefault(); selectAll(); return true; }
    if (mod && k === '1') { e.preventDefault(); actualSize(); return true; }
    if (mod && k === '0') { e.preventDefault(); fit(); return true; }
    if (mod && k === 'g') { e.preventDefault(); if (e.shiftKey) ungroup(); else group(); return true; }
    if (mod && k === 'j') { e.preventDefault(); joinPicked(); return true; }
    if (mod && k === 'd') { e.preventDefault(); duplicate(); return true; }
    if (mod && (k === 'c' || k === 'x')) { if (picked().length) { e.preventDefault(); copySel(k === 'x'); } return true; }
    if (mod && k === 'v') { clearTimeout(pasteTimer); if (clip) pasteTimer = setTimeout(pasteClip, 150); return true; } // (a picture on the clipboard comes in by the paste event instead)
    if (mod && (k === ']' || k === '[' || e.code === 'BracketRight' || e.code === 'BracketLeft')) { e.preventDefault(); arrange((k === ']' || e.code === 'BracketRight' ? 1 : -1) * (e.shiftKey ? 2 : 1)); return true; }
    if (mod && e.code === 'Digit8') { e.preventDefault(); compoundToggle(); return true; }
    if (mod && e.code === 'Digit7') { e.preventDefault(); clipToggle(); return true; }
    if (mod && e.shiftKey && k === 'o') { e.preventDefault(); outlines(); return true; }
    // (the grid, guides and rulers shown or hidden)
    if (mod && (e.code === 'Quote' || k === "'")) { e.preventDefault(); precToggle('grid'); return true; }
    if (mod && (e.code === 'Semicolon' || k === ';')) { e.preventDefault(); precToggle('guides'); return true; }
    if (mod && !e.shiftKey && k === 'r') { e.preventDefault(); precToggle('rulers'); return true; }
    if (mod || e.altKey) return false;
    if (k === ' ') { e.preventDefault(); if (!spaceDown) { spaceDown = true; stageEl.style.cursor = 'grab'; } return true; }
    if (k === 'escape') {
      if (ctxMenu && !ctxMenu.hidden) { quickMenu(false); return true; }
      if (layersOpen()) { layersPanel(false); return true; }
      if (drag) { cancelDrag(); return true; }
      if (pen) { endPen(); return true; } if (cv) { cv = null; ui.pen = null; changed(); return true; }
      if (te) { endEdit(); return true; }
      if (chs) { chs = null; drawUI(); panelRefresh(); return true; }
      if (blendA) { blendA = null; drawUI(); return true; }
      if (meas && tool === 'measure') { meas = null; drawUI(); panelRefresh(); return true; }
      if (sel.length || Object.keys(asel).length) setSel([]); return true;
    }
    if (k === 'enter') { if (pen) { endPen(); return true; } if (cv) { cv = null; ui.pen = null; changed(); return true; } return false; }
    if (k === 'delete' || k === 'backspace') {
      e.preventDefault();
      if (pen) { var sp = penSp(); if (sp && sp.pts.length > 1) { record('Remove Point'); sp.pts.pop(); changed(); } else endPen(); return true; }
      if (ABT[tool] && tool !== 'abnew' && !picked().length) { delBoard(); return true; }
      if (nAnchors() && ANCHORTOOLS[tool]) delAnchors(); else deleteSel(); return true;
    }
    if (/^arrow/.test(k)) { e.preventDefault(); var d = e.shiftKey ? 10 : 1; nudge(k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0, k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0); return true; }
    if (k === 'x') { swapColours(); return true; }
    if (k === 'd') { defaultColours(); return true; }
    if (k === '/') { setColour('main', null, 'No Fill'); return true; }
    if (k === '0') { fit(); return true; }
    if (k === '+' || k === '=') { zoomStep(1); return true; }
    if (k === '-') { zoomStep(-1); return true; }
    var want = e.shiftKey ? e.key : k, t = Object.keys(TOOLS).filter(function (q) { return TOOLS[q].key === want; })[0];
    if (t) { B.showPanel(); setTool(t); return true; }
    return false;
  }
  function keyup(e) { if (e.key === ' ') { spaceDown = false; if (stageEl) stageEl.style.cursor = cursorFor(v2(-99, -99), false); } }

  // ---- SETTING UP: the stage's vector sheet, the left bar's categories,
  // the panel's handlers, the layers panel, the quick options, and what's
  // routed here while Vector mode is showing ----
  function init(bridge) {
    B = bridge;
    stageEl = document.createElement('div'); stageEl.className = 'vec-stage'; stageEl.hidden = true;
    stageEl.innerHTML = '<div class="vec-world"><div class="vec-boards"></div><div class="vec-gridel" hidden></div></div><svg class="vec-ui" aria-hidden="true"></svg>';
    worldEl = stageEl.querySelector('.vec-world'); boardsEl = stageEl.querySelector('.vec-boards'); gridEl = stageEl.querySelector('.vec-gridel'); uiEl = stageEl.querySelector('.vec-ui');
    artEl = document.createElementNS(SVGNS, 'svg'); artEl.setAttribute('class', 'vec-art'); artEl.setAttribute('aria-hidden', 'true');
    defsEl = document.createElementNS(SVGNS, 'defs'); artRoot = document.createElementNS(SVGNS, 'g'); artEl.appendChild(defsEl); artEl.appendChild(artRoot); worldEl.appendChild(artEl);
    B.stage.appendChild(stageEl);
    // (the rulers: strips along the top and the left, and the corner where they meet; drag out of one for a guide)
    rulerH = document.createElement('canvas'); rulerH.className = 'vec-ruler vec-ruler-h';
    rulerV = document.createElement('canvas'); rulerV.className = 'vec-ruler vec-ruler-v';
    rulerC = document.createElement('div'); rulerC.className = 'vec-ruler vec-ruler-c';
    [rulerH, rulerV, rulerC].forEach(function (r) { r.hidden = true; r.setAttribute('aria-hidden', 'true'); stageEl.appendChild(r); });
    rulerH.addEventListener('pointerdown', rulerDown); rulerV.addEventListener('pointerdown', rulerDown);
    rulerC.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    document.addEventListener('paint:theme', function () { if (on) rulersDraw(); });
    stageEl.addEventListener('pointerdown', down); stageEl.addEventListener('pointermove', move);
    stageEl.addEventListener('pointerup', up); stageEl.addEventListener('pointercancel', up);
    stageEl.addEventListener('wheel', wheel, { passive: false });
    stageEl.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); });
    stageEl.addEventListener('pointerleave', function (e) { e.stopPropagation(); if (!drag && (ui.hover || ui.hoverPt || ui.pen || ui.brush || ui.bface >= 0 || ui.chover)) { ui.hover = ui.hoverPt = ui.brush = ui.chover = null; ui.bface = -1; if (!pen && !cv) ui.pen = null; drawUI(); } });
    // (the words being typed go into a hidden textarea at the caret)
    ta = document.createElement('textarea'); ta.className = 'vec-textin'; ta.setAttribute('aria-label', 'Text'); ta.spellcheck = false; ta.setAttribute('autocomplete', 'off'); ta.setAttribute('wrap', 'off'); stageEl.appendChild(ta);
    ta.addEventListener('input', taInput);
    stageEl.addEventListener('mousedown', function (e) { if (te) e.preventDefault(); }); // (a tap's mouse events mustn't take the focus from the words)
    ta.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); var id = te && te.id; endEdit(); if (id && byId(id)) setSel([id]); } else setTimeout(function () { if (te) { placeTa(); drawUI(); } }, 0); });
    ta.addEventListener('blur', function () { if (te) drawUI(); });
    ta.addEventListener('focus', function () { if (te) drawUI(); });
    document.addEventListener('selectionchange', function () { if (te && document.activeElement === ta) drawUI(); });
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', relayText);
    ['gesturestart', 'gesturechange', 'gestureend', 'dblclick'].forEach(function (t) { stageEl.addEventListener(t, function (e) { e.stopPropagation(); if (t !== 'dblclick') e.preventDefault(); }); });
    if (window.ResizeObserver) new ResizeObserver(function () { relayout(); }).observe(B.stage);
    // (the left bar: the categories, just above Layers and the zoom)
    groupEl = document.createElement('div'); groupEl.className = 'paint-group vec-group'; groupEl.hidden = true;
    groupEl.setAttribute('role', 'group'); groupEl.setAttribute('aria-label', 'Vector tools');
    groupEl.innerHTML = CATS.map(function (c) { return '<button type="button" data-vcat="' + c.id + '" aria-label="' + esc(c.name) + '" aria-pressed="false" data-tip="' + esc(c.name + ': ' + c.tools.map(function (t) { return TOOLS[t].name; }).join(', ')) + '">' + CI(ICONS[c.icon]) + '</button>'; }).join('');
    // (and Fit, the painting's own button, last, as it is there: its click is the artboard's fit)
    var fitB = B.leftViewGroup.parentNode.querySelector('.paint-fitbtn');
    if (fitB) { fitB = fitB.cloneNode(true); fitB.setAttribute('aria-label', 'Fit the artboard (0)'); fitB.dataset.tip = 'Fit (0): the whole artboard, upright'; groupEl.appendChild(fitB); }
    B.leftViewGroup.parentNode.insertBefore(groupEl, B.leftViewGroup);
    groupEl.addEventListener('click', function (e) { var b = e.target.closest('[data-vcat]'); if (b) pickCat(b.dataset.vcat); });
    // (the tool settings panel's own controls, when it shows Vector's)
    B.ctxTool.addEventListener('click', panelClick); B.ctxTool.addEventListener('input', panelInput); B.ctxTool.addEventListener('change', panelChange);
    B.ctxTool.addEventListener('pointerdown', gbarDown);
    B.ctxTool.addEventListener('contextmenu', function (e) { var s = on && e.target.closest('.vec-swatches [data-vsw-c]'); if (!s || doc.sw.indexOf(s.dataset.vswC) < 0) return; e.preventDefault(); record('Remove Swatch'); doc.sw.splice(doc.sw.indexOf(s.dataset.vswC), 1); changed(); panelRefresh(); });
    B.ctxTool.addEventListener('keydown', function (e) { if (on && e.target.closest('[data-vk]') && e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.blur(); } });
    // (the layers panel, built like the painting's)
    vlp = document.createElement('div'); vlp.className = 'paint-layerpanel vec-layerpanel'; vlp.hidden = true; vlp.setAttribute('role', 'dialog'); vlp.setAttribute('aria-label', 'Vector layers');
    B.root.appendChild(vlp); B.draggable(vlp, '.pl-title', 'vlayers');
    vlp.addEventListener('click', layersClick); vlp.addEventListener('dblclick', layersDbl); vlp.addEventListener('pointerdown', layersDown);
    // (the quick options, from the bottom bar's last button)
    ctxMenu = document.createElement('div'); ctxMenu.className = 'paint-drop vec-quick'; ctxMenu.hidden = true; ctxMenu.setAttribute('role', 'menu'); ctxMenu.setAttribute('aria-label', 'Quick options');
    document.body.appendChild(ctxMenu);
    ctxMenu.addEventListener('click', function (e) { var b = e.target.closest('[data-vq]'); if (b) quickDo(b.dataset.vq); });
    ctxMenu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); quickMenu(false); B.ctxBtn.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); var items = Array.from(ctxMenu.querySelectorAll('button')); items[(items.indexOf(document.activeElement) + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); }
    });
    // (the bottom bar's sliders)
    if (B.sizeIn) { B.sizeIn.addEventListener('input', bbarInput); B.alphaIn.addEventListener('input', bbarInput); B.sizeIn.addEventListener('change', function () { if (on) changed(); }); B.alphaIn.addEventListener('change', function () { if (on) changed(); }); }
    // (while Vector mode shows: the left bar's Layers button, the zoom, the
    // bottom bar's undo, redo, swap and quick options are Vector's)
    document.addEventListener('click', function (e) {
      if (!on) return;
      var t = e.target.closest('[data-act="layers"], [data-zoom], [data-act="undo"], [data-act="redo"], .paint-swap, .paint-settings-toggle'); if (!t || !B.root.contains(t)) return;
      e.stopPropagation(); e.preventDefault();
      if (t.dataset.act === 'layers') layersPanel(!layersOpen());
      else if (t.dataset.act === 'undo') undo();
      else if (t.dataset.act === 'redo') redo();
      else if (t.classList.contains('paint-swap')) swapColours();
      else if (t.classList.contains('paint-settings-toggle')) quickMenu(ctxMenu.hidden);
      else if (t.dataset.zoom === 'in') zoomStep(1);
      else if (t.dataset.zoom === 'out') zoomStep(-1);
      else fit();
    }, true);
    document.addEventListener('pointerdown', function (e) {
      if (!on) return;
      if (layersOpen() && !e.target.closest('.vec-layerpanel, [data-act="layers"]')) layersPanel(false);
      if (!ctxMenu.hidden && !e.target.closest('.vec-quick, .paint-settings-toggle')) quickMenu(false);
    }, true);
  }
  // (a colour dragged from the bottom bar or the picker and let go over the artwork)
  function dropColour(cx, cy, hex, which) {
    if (!on || !doc) return false;
    var r = stageEl.getBoundingClientRect(), p = fromScreen(cx - r.left, cy - r.top), hit = hitLeaf(p, tolDoc(true));
    if (!hit || !hit.app) return false;
    record(which === 'second' ? 'Stroke' : 'Fill');
    var it = itemOf(hit.app, which === 'second' ? 's' : 'f', true); it.p = hex ? { t: 'c', c: hex } : null; it.on = 1; if (it.k === 's' && !it.w) it.w = 2;
    changed(); return true;
  }

  // (a still tap on the empty workspace: the tool goes down, unless something's
  // being made with it, which keeps its own way of finishing)
  function toolDown() {
    if (!on || !doc || tool === 'none' || te || pen || cv || drag) return false;
    setTool('none'); return true;
  }

  window.PaintVector = {
    toolDown: toolDown,
    init: init, enter: enter, leave: leave, load: load, serialize: serialize, isEmpty: isEmpty,
    panelHTML: panelHTML, panelSync: panelSync, key: key, keyup: keyup, histButtons: histButtons, raster: raster, exportBlob: exportBlob,
    addImageFile: addImageFile, relayout: relayout, isOn: function () { return on; },
    pcGet: pcGet, pcSet: pcSet, pcCss: pcCss, dropColour: dropColour, swap: swapColours
  };
})();
