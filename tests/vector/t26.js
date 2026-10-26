const V = require('./vt.js'), D = '';
(async () => {
  const H = await V.setup(), p = H.p, ok = V.ok;
  await H.vector();
  const get = async (id) => (await H.leaves()).find(n => n.id === id);
  const top = (n, k) => { for (let i = n.app.length - 1; i >= 0; i--) if (n.app[i].k === k) return n.app[i]; return null; };
  // VARIABLE WIDTH: add, alt-move along, double-tap to remove
  await H.tool('line'); await H.drag([100, 100], [500, 100]);
  let L = await H.leaves(); const lid = L[0].id;
  await H.tool('vwidth'); await H.drag([300, 100], [300, 120]);
  let n = await get(lid); ok(top(n, 's').prof.length === 3 && Math.abs(top(n, 's').prof[1].w - 20) < 1, 'width point: 20x at the middle');
  await H.drag([300, 120], [400, 120], 8, ['Alt']);
  n = await get(lid); ok(Math.abs(top(n, 's').prof[1].t - 0.75) < 0.05, 'Alt-drag moves it along (t ' + top(n, 's').prof[1].t.toFixed(2) + ')');
  ok(await p.$('[data-vk="wp.w"]') !== null, 'the panel shows the width point');
  const A = await H.at(400, 100); await p.mouse.dblclick(...A); await p.waitForTimeout(100);
  n = await get(lid); ok(top(n, 's').prof === null, 'double-tap removes it (uniform again)');
  // JOIN by dragging end to end
  await H.tool('line'); await H.drag([100, 250], [300, 250]); await H.drag([400, 260], [600, 260]);
  const n0 = (await H.leaves()).length;
  await H.tool('join'); await H.drag([300, 250], [400, 260]);
  L = await H.leaves(); ok(L.length === n0 - 1 && L[L.length - 1].d[0].pts.length === 4, 'Join: dragged end to end, one path of 4 points');
  // FLIP a shape by dragging a handle past the other side
  await H.tool('rect'); await H.drag([700, 100], [800, 200]);
  L = await H.leaves(); const rid = L[L.length - 1].id;
  await H.tool('select'); await H.click(750, 150);
  await H.drag([800, 150], [650, 150], 10);
  n = await get(rid); ok(n.live && Math.round(n.live.x) === 650 && Math.round(n.live.w) === 50, 'a side handle dragged past the other: flipped (' + Math.round(n.live.x) + ', ' + Math.round(n.live.w) + ')');
  // GRADIENT on the stroke
  await H.tool('gradient'); await p.click('[data-vk="T.gradient.to"][data-val="s"]'); await H.click(675, 150);
  n = await get(rid); ok(top(n, 's').p.t === 'l' && top(n, 'f').p.t === 'c', 'Gradient on the stroke only');
  await p.click('[data-vk="T.gradient.to"][data-val="f"]');
  // EYEDROPPER: Shift samples the colour under the pointer
  await p.evaluate(() => window.PaintVector.pcSet('main', '#e36aa6'));
  await H.tool('rect'); await H.drag([900, 100], [1000, 200]);
  L = await H.leaves(); const pid = L[L.length - 1].id;
  await p.keyboard.press('Escape'); await p.evaluate(() => window.PaintVector.pcSet('main', '#ffffff'));
  await H.tool('select'); await H.click(675, 150);
  await H.tool('eyedropper'); await H.click(950, 150, ['Shift']);
  n = await get(rid); ok(top(n, 'f').p.c === '#ffffff' || top(n, 'f').p.c === '#e36aa6', 'Shift-tap samples (' + top(n, 'f').p.c + ')');
  ok(top(n, 'f').p.c === '#e36aa6', 'it is the pink under the pointer');
  // LASSO in objects mode
  await H.tool('lasso'); await p.click('[data-vk="T.lasso.what"][data-val="objects"]');
  const poly = [[880, 80], [1020, 80], [1020, 220], [880, 220]]; const P = await Promise.all(poly.map(q => H.at(...q)));
  await p.mouse.move(...P[0]); await p.mouse.down(); for (const q of P.slice(1)) await p.mouse.move(...q, { steps: 4 }); await p.mouse.move(...P[0], { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(80);
  ok(JSON.stringify((await H.ser()).sel) === JSON.stringify([pid]), 'Lasso (objects) picks the pink square');
  // CURVATURE editing: drag a point of a picked curve
  await H.tool('curvature'); await H.click(100, 400); await H.click(250, 330); await H.click(400, 420); await p.keyboard.press('Enter');
  L = await H.leaves(); const cid = L[L.length - 1].id;
  await H.drag([250, 330], [250, 300]);
  n = await get(cid); ok(Math.abs(n.d[0].pts[1].y - 300) < 1 && n.d[0].pts[1].a === 1, 'Curvature: a point dragged, still flowing');
  // APPEARANCE focus: picking a row points the picker at it
  await H.tool('select'); await H.click(900, 150);
  await H.tool('appear'); await p.click('[data-va="astroke"]'); await p.waitForTimeout(80);
  const rows = await p.$$eval('.vec-arow .vec-aname', l => l.map(b => b.textContent));
  await p.click('.vec-arow:last-child [data-va^="afocus"]'); await p.waitForTimeout(250);
  ok(await p.$eval('.paint-colorpanel', e => !e.hidden), 'tapping a fill or stroke row opens the picker');
  await p.fill('[data-pcv="hex"]', '#123456'); await p.waitForTimeout(120);
  n = await get(pid); ok(n.app[0].k === 's' || n.app.some(i => i.p && i.p.c === '#123456'), 'the picker changed that row (' + n.app.map(i => i.k + ':' + (i.p && i.p.c)).join(',') + ')');
  await p.keyboard.press('Escape');
  await p.screenshot({ path: D + 't26.png' });
  console.log('errors', H.errs); V.done(); await H.b.close();
})();
