const V = require('./vt.js'), D = '';
(async () => {
  const H = await V.setup(), p = H.p, ok = V.ok;
  await H.vector();
  // SHAPES
  await H.tool('rect'); await H.drag([100, 100], [300, 220]);
  let L = await H.leaves();
  ok(L.length === 1 && L[0].type === 'path' && L[0].live && L[0].live.k === 'rect' && Math.round(L[0].live.w) === 200 && Math.round(L[0].live.h) === 120, 'rectangle by drag 200x120');
  ok(await p.$$eval('.vec-art path', l => l.length) >= 2, 'drawn as SVG (fill + stroke)');
  await H.tool('ellipse'); await H.click(600, 200);
  L = await H.leaves(); ok(L.length === 2 && L[1].live.k === 'ellipse' && L[1].live.w === 200, 'ellipse by a tap: the size set (200 x 140)');
  await H.tool('polygon'); await H.drag([900, 200], [900, 280], 6, ['Shift']);
  await H.tool('star'); await H.drag([1050, 200], [1120, 200]);
  await H.tool('spiral'); await H.drag([200, 500], [280, 500]);
  await H.tool('line'); await H.drag([400, 450], [600, 470], 6, ['Shift']);
  await H.tool('arc'); await H.drag([650, 400], [750, 500]);
  await H.tool('rgrid'); await H.drag([800, 400], [950, 520]);
  await H.tool('pgrid'); await H.drag([1000, 420], [1150, 560]);
  await H.tool('rrect'); await H.drag([100, 600], [260, 700]);
  L = await H.leaves();
  ok(L.length === 10, 'ten shapes, one of each kind: ' + L.map(n => n.live && n.live.k).join(','));
  const line = L.find(n => n.live && n.live.k === 'line');
  ok(line && Math.abs(line.live.y2 - line.live.y1) < 0.01, 'Shift keeps the line level');
  const poly = L.find(n => n.live && n.live.k === 'polygon');
  ok(poly && poly.d[0].pts.length === 6 && Math.abs(poly.live.a + Math.PI / 2) < 1e-6, 'polygon: 6 sides, upright with Shift');
  const star = L.find(n => n.live && n.live.k === 'star'); ok(star && star.d[0].pts.length === 10, 'star: 5 points');
  const sp = L.find(n => n.live && n.live.k === 'spiral'); ok(sp && !sp.d[0].closed && sp.d[0].pts.length === 11 && !sp.app.find(i => i.k === 'f').p, 'spiral: 10 segments, open, no fill');
  const grid = L.find(n => n.live && n.live.k === 'rgrid'); ok(grid && grid.d.length === 1 + 3 + 3, 'grid: frame + 3 + 3 dividers');
  const pg = L.find(n => n.live && n.live.k === 'pgrid'); ok(pg && pg.d.length === 4 + 6, 'polar grid: 4 rings, 6 spokes');
  await p.screenshot({ path: D + 't21-shapes.png' });
  // live edit from the panel: the polygon's sides
  await H.tool('select'); await H.click(900, 200);
  ok((await H.sel()).length === 1, 'picked the polygon');
  await p.fill('[data-vk="L.n"]', '8'); await p.press('[data-vk="L.n"]', 'Enter'); await p.waitForTimeout(100);
  L = await H.leaves(); ok(L.find(n => n.live && n.live.k === 'polygon').d[0].pts.length === 8, 'its sides changed in the panel (8)');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  L = await H.leaves(); ok(L.find(n => n.live && n.live.k === 'polygon').d[0].pts.length === 6, 'undo: 6 again');
  // SELECT: move, size, alt-copy, marquee
  await H.click(200, 160);
  let s = await H.ser(); const rid = s.sel[0];
  ok(s.sel.length === 1 && (await H.leaves()).find(n => n.id === rid).live.k === 'rect', 'tap picks the rectangle');
  await H.drag([200, 160], [250, 190]);
  let r = (await H.leaves()).find(n => n.id === rid);
  ok(Math.round(r.live.x) === 150 && Math.round(r.live.y) === 130, 'dragged by 50,30 (' + r.live.x + ',' + r.live.y + ')');
  // the se handle: from (350,250) to (450,310): proportions kept (200x120 -> 300x180)
  await H.drag([350, 250], [450, 300]);
  r = (await H.leaves()).find(n => n.id === rid);
  ok(Math.round(r.live.w) === 300 && Math.round(r.live.h) === 180, 'corner handle sizes in proportion (' + Math.round(r.live.w) + 'x' + Math.round(r.live.h) + ')');
  ok(r.live && r.d[0].pts.length === 4, 'still a live rectangle');
  const n0 = (await H.leaves()).length;
  await H.drag([300, 220], [300, 380], 6, ['Alt']);
  ok((await H.leaves()).length === n0 + 1, 'Alt-drag copies');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  ok((await H.leaves()).length === n0, 'undo the copy');
  await H.drag([60, 60], [700, 260]);
  s = await H.ser(); ok(s.sel.length === 2, 'marquee picks two (' + s.sel.length + ')');
  await H.click(900, 200, ['Shift']); s = await H.ser(); ok(s.sel.length === 3, 'Shift adds a third');
  // the W field with three picked
  await p.fill('[data-vk="w"]', '1000'); await p.press('[data-vk="w"]', 'Enter'); await p.waitForTimeout(100);
  const bx = await p.evaluate(() => { const v = window.PaintVector.serialize(); return v.sel.length; });
  ok(bx === 3, 'still three picked after typing a width');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  // group / ungroup
  await p.keyboard.press('Control+g'); await p.waitForTimeout(100);
  s = await H.ser(); let top = s.layers[0].items; ok(top.some(n => n.type === 'group' && n.items.length === 3) && s.sel.length === 1, 'Ctrl G groups the three');
  await H.tool('groupsel'); await H.click(600, 200);
  s = await H.ser(); const g = s.layers[0].items.find(n => n.type === 'group');
  ok(s.sel.length === 1 && g.items.some(n => n.id === s.sel[0]), 'Group Selection picks the ellipse inside');
  await H.click(600, 200); s = await H.ser(); ok(s.sel[0] === g.id, 'again: the group round it');
  await H.tool('select'); await H.click(600, 200);
  await p.keyboard.press('Control+Shift+g'); await p.waitForTimeout(100);
  s = await H.ser(); ok(!s.layers[0].items.some(n => n.type === 'group') && s.sel.length === 3, 'Ctrl Shift G ungroups');
  // delete + undo
  const n1 = (await H.leaves()).length; await p.keyboard.press('Delete'); await p.waitForTimeout(80);
  ok((await H.leaves()).length === n1 - 3, 'Delete takes the three');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  ok((await H.leaves()).length === n1, 'undo brings them back');
  console.log('errors', H.errs); V.done(); await H.b.close();
})();
