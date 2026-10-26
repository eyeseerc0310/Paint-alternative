// stage 3: Drawing (Pencil, Vector Brush, Blob Brush, Smooth, Vector Eraser)
const { setup, ok, done } = require('./vt.js'); const G = require('./geo.js');
(async () => {
  const H = await setup(); const p = H.p;
  await H.vector();
  const clear = async () => { await H.tool('select'); await p.keyboard.press('Control+a'); await p.keyboard.press('Delete'); await p.waitForTimeout(60); };
  const path = async (pts) => { const A = await H.at(...pts[0]); await p.mouse.move(...A); await p.mouse.down(); for (const q of pts.slice(1)) { const B = await H.at(...q); await p.mouse.move(...B, { steps: 3 }); } await p.mouse.up(); await p.waitForTimeout(100); };
  const wave = []; for (let i = 0; i <= 60; i++) wave.push([100 + i * 8, 300 + Math.sin(i / 6) * 60 + (i % 2 ? 1.5 : -1.5)]);
  // pencil
  await H.tool('pencil'); await path(wave);
  let L = await H.leaves();
  ok(L.length === 1 && L[0].type === 'path' && !L[0].d[0].closed, 'pencil: one open path');
  ok(L[0].d[0].pts.length >= 3 && L[0].d[0].pts.length < 20, 'pencil: smoothed to few anchors: ' + L[0].d[0].pts.length);
  const st = L[0].app.filter(i => i.k === 's' && i.on && i.p)[0], fi = L[0].app.filter(i => i.k === 'f' && i.p)[0];
  ok(!!st && !fi, 'pencil: stroked, not filled');
  // carry on from its end (it's picked)
  await path([[580, 300 + Math.sin(60 / 6) * 60], [640, 200], [700, 150]]);
  L = await H.leaves();
  ok(L.length === 1, 'pencil: starting at the picked path\'s end carries it on (' + L.length + ')');
  await clear();
  // closing loop
  const loop = []; for (let i = 0; i <= 40; i++) loop.push([300 + Math.cos(i / 40 * 6.2) * 100, 300 + Math.sin(i / 40 * 6.2) * 100]);
  await H.tool('pencil'); await path(loop);
  L = await H.leaves(); ok(L[0].d[0].closed, 'pencil: a line ending near its start closes');
  await clear();
  // vector brush: tapered profile
  await H.tool('vbrush'); await path(wave);
  L = await H.leaves(); const vs = L[0].app[0];
  ok(L.length === 1 && vs.k === 's' && vs.prof && vs.prof.length > 10 && vs.prof[0].w < 0.2 && Math.max(...vs.prof.map(q => q.w)) > 0.9, 'vector brush: tapered width profile');
  ok(await p.$('.vec-art path[stroke="none"]') !== null, 'vector brush: drawn as a filled outline');
  // calligraphic
  await p.selectOption('[data-vk="T.vbrush.kind"]', 'callig'); await p.waitForTimeout(80);
  ok(await p.$('[data-vk="T.vbrush.angle"]') !== null, 'calligraphic shows angle and roundness');
  await path([[100, 500], [400, 500], [400, 700]]);
  L = await H.leaves(); const cp = L[1].app[0].prof;
  ok(cp && cp.some(q => q.w < 0.6) && cp.some(q => q.w > 0.9), 'calligraphic: width changes with direction');
  await p.selectOption('[data-vk="T.vbrush.kind"]', 'taper');
  await clear();
  // blob brush: two overlapping strokes become one shape; a separate one stays separate
  await H.tool('blob');
  await path([[100, 200], [300, 200]]); await path([[200, 150], [200, 300]]);
  L = await H.leaves(); ok(L.length === 1 && L[0].app.length === 1 && L[0].app[0].k === 'f', 'blob: crossing strokes merge into one filled shape (' + L.length + ')');
  await path([[500, 500], [600, 520]]);
  L = await H.leaves(); ok(L.length === 2, 'blob: a stroke apart stays apart');
  const ar = Math.abs(G.area(L[0].d)); ok(ar > 2 * 200 * 24 - 24 * 24 - 600 && ar < 2 * 200 * 24 + 1500, 'blob: area about two 24-wide bars: ' + ar.toFixed(0));
  await clear();
  // eraser: across a rectangle cuts it in two; across a line cuts it
  await H.tool('rect'); await H.drag([100, 100], [500, 300]);
  await H.tool('select'); await p.keyboard.press('Escape');
  await H.tool('veraser'); await path([[300, 50], [300, 350]]);
  L = await H.leaves(); ok(L.length === 2, 'eraser: a rectangle rubbed across becomes two (' + L.length + ')');
  ok(L.every(n => Math.abs(G.area(n.d)) > 3000), 'eraser: both halves remain');
  await clear();
  await H.tool('line'); await H.drag([100, 400], [600, 400]);
  await H.tool('select'); await p.keyboard.press('Escape');
  await H.tool('veraser'); await path([[350, 350], [350, 450]]);
  L = await H.leaves(); ok(L.length === 1 && L[0].d.length === 2, 'eraser: a line rubbed across is cut in two pieces (' + (L[0] && L[0].d.length) + ')');
  const b0 = G.bbox([L[0].d[0]]), b1 = G.bbox([L[0].d[1]]);
  ok(Math.abs(b0.y - 400) < 0.01 && Math.abs(b1.y - 400) < 0.01, 'eraser: what\'s left of the line is exactly where it was');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(60);
  L = await H.leaves(); ok(L[0].d.length === 1, 'eraser: undo puts it back');
  await clear();
  // smooth: fewer anchors
  await H.tool('pencil'); await p.click('[data-vk="T.pencil.smooth"]', { position: { x: 2, y: 5 } }).catch(() => {});
  await p.evaluate(() => { const i = document.querySelector('[data-vk="T.pencil.smooth"]'); i.value = 0; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  const jag = []; for (let i = 0; i <= 50; i++) jag.push([100 + i * 10, 300 + (i % 2 ? 12 : -12)]);
  await path(jag);
  L = await H.leaves(); const n0 = L[0].d[0].pts.length;
  await H.tool('smooth');
  for (let k = 0; k < 3; k++) await path(jag.map(q => [q[0], 300]));
  L = await H.leaves(); const n1 = L[0].d[0].pts.length;
  ok(n1 < n0, 'smooth: fewer anchors after smoothing ' + n0 + ' → ' + n1);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(60);
  ok(!H.errs.length, 'no errors ' + H.errs.slice(0, 3).join(' | '));
  done(); await H.b.close();
})();
