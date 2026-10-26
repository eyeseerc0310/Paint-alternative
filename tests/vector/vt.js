// helpers for the vector tests
const L = require('../lib');
const { chromium } = L;
exports.chromium = chromium;
exports.ok = L.ok;
exports.done = L.done;
// (showSwitch: the hidden Paint / Vector switch shown, for tests that use it)
exports.setup = async (opts = {}) => {
  const { showSwitch } = opts; opts = Object.assign({}, opts); delete opts.showSwitch;
  const b = await (showSwitch ? L.use({ showSwitch: true }).chromium : chromium).launch();
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }, opts));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(1100);
  const H = {
    b, ctx, p, errs,
    ser: async () => JSON.parse(await p.evaluate(() => JSON.stringify(window.PaintVector.serialize()))),
    leaves: async () => { const s = await H.ser(); const out = []; const go = l => l.forEach(n => { if (n.items) go(n.items); else out.push(n); }); go(s.layers); return out; },
    // a point on the artboard (its own units) on the screen
    at: async (x, y) => p.evaluate(([x, y]) => { const w = document.querySelector('.vec-world'), m = new DOMMatrix(getComputedStyle(w).transform), r = document.querySelector('.vec-stage').getBoundingClientRect(), q = m.transformPoint(new DOMPoint(x, y)); return [r.left + q.x, r.top + q.y]; }, [x, y]),
    drag: async (a, b, steps = 8, mods = []) => { for (const m of mods) await p.keyboard.down(m); const A = await H.at(...a), Bq = await H.at(...b); await p.mouse.move(...A); await p.mouse.down(); await p.mouse.move(...Bq, { steps }); await p.mouse.up(); for (const m of mods) await p.keyboard.up(m); await p.waitForTimeout(80); },
    click: async (x, y, mods = []) => { for (const m of mods) await p.keyboard.down(m); const A = await H.at(x, y); await p.mouse.click(...A); for (const m of mods) await p.keyboard.up(m); await p.waitForTimeout(80); },
    tool: async (t) => { await p.evaluate((t) => { const c = { select: 'selection', direct: 'selection', lasso: 'selection', wand: 'selection', groupsel: 'selection', pen: 'paths', curvature: 'paths', anchor: 'paths', addpt: 'paths', delpt: 'paths', convert: 'paths', scissors: 'paths', knife: 'paths', join: 'paths', simplify: 'paths', rect: 'shapes', rrect: 'shapes', ellipse: 'shapes', polygon: 'shapes', star: 'shapes', spiral: 'shapes', line: 'shapes', arc: 'shapes', rgrid: 'shapes', pgrid: 'shapes', solid: 'fill', gradient: 'fill', eyedropper: 'fill', swatches: 'fill', vfill: 'fill', cpick: 'fill', swidth: 'stroke', vwidth: 'stroke', sprofile: 'stroke', capjoin: 'stroke', dash: 'stroke', appear: 'stroke', opacity: 'stroke', blend: 'stroke', hand: 'navigation', zoom: 'navigation', rotview: 'navigation', pencil: 'drawing', vbrush: 'drawing', blob: 'drawing', smooth: 'drawing', veraser: 'drawing', builder: 'shapeops', union: 'shapeops', minus: 'shapeops', intersect: 'shapeops', exclude: 'shapeops', divide: 'shapeops', compound: 'shapeops', clipmask: 'shapeops', ftrans: 'transform', move: 'transform', scale: 'transform', rotate: 'transform', reflect: 'transform', shear: 'transform', distort: 'transform', text: 'type', areatext: 'type', ptext: 'type', vtext: 'type', chedit: 'type', outlines: 'type', align: 'arrange', distribute: 'arrange', dspace: 'arrange', fwd: 'arrange', back: 'arrange', front: 'arrange', backmost: 'arrange', groupun: 'arrange', vblend: 'effects', warp: 'effects', envelope: 'effects', offset: 'effects', repeat: 'effects', pattern: 'effects', transp: 'effects', artboard: 'boards', abnew: 'boards', abresize: 'boards', abdup: 'boards', abarr: 'boards', abset: 'boards', rulers: 'precision', guides: 'precision', smartg: 'precision', grid: 'precision', snapgrid: 'precision', snappts: 'precision', snapobj: 'precision', measure: 'precision' }[t]; document.querySelector('[data-vcat="' + c + '"]').click(); }, t); await p.waitForTimeout(60); await p.click('[data-vtool="' + t + '"]'); await p.waitForTimeout(60); },
    vector: async () => { await p.evaluate(() => document.querySelector('[data-hb="settings"]').click()); await p.waitForTimeout(150); await p.click('[data-setting="vector"]'); await p.waitForTimeout(400); const sh = await p.$('.pa-sheet-wrap.in [data-vm="switch"]'); if (sh) { await sh.click(); await p.waitForTimeout(400); } },
    sel: async () => (await H.ser()).sel
  };
  return H;
};
