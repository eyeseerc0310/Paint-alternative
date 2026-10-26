// stage 3: Shape Operations (Pathfinder, Shape Builder, Compound Path, Clipping Mask)
const { setup, ok, done } = require('./vt.js'); const G = require('./geo.js');
const near = (a, b, t) => Math.abs(a - b) <= t;
(async () => {
  const H = await setup(); const p = H.p;
  await H.vector();
  const two = async () => { await p.evaluate(() => { localStorage.clear(); }); await H.tool('rect'); await H.drag([100, 100], [300, 300]); await H.drag([200, 200], [400, 400]); await H.tool('select'); await p.keyboard.press('Control+a'); await p.waitForTimeout(60); };
  const clear = async () => { await H.tool('select'); await p.keyboard.press('Control+a'); await p.keyboard.press('Delete'); await p.waitForTimeout(60); };
  const expect = { union: 70000, intersect: 10000, minus: 30000, exclude: 60000 };
  for (const op of Object.keys(expect)) {
    await two(); await H.tool(op); await p.waitForTimeout(120);
    const L = await H.leaves();
    ok(L.length === 1, op + ': one object (' + L.length + ')');
    const a = Math.abs(G.area(L[0].d));
    ok(near(a, expect[op], 60), op + ': area ' + a.toFixed(0) + ' ~ ' + expect[op]);
    if (op === 'union') ok(L[0].d[0].pts.length === 8, 'union of two squares has 8 corners: ' + L[0].d[0].pts.length);
    // undo brings the two back
    await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
    ok((await H.leaves()).length === 2, op + ': undo brings both back');
    await clear();
  }
  // divide: three pieces in a group
  await two(); await H.tool('divide'); await p.waitForTimeout(100);
  let s = await H.ser(), top = s.layers[0].items;
  ok(top.length === 1 && top[0].type === 'group' && top[0].items.length === 3, 'divide: a group of three pieces');
  ok(near(top[0].items.reduce((t, n) => t + Math.abs(G.area(n.d)), 0), 70000, 80), 'divide: pieces add up to the union');
  await clear();
  // circles: union area
  await H.tool('ellipse'); await H.drag([100, 100], [300, 300]); await H.drag([180, 100], [380, 300]); await H.tool('select'); await p.keyboard.press('Control+a');
  await H.tool('intersect'); await p.waitForTimeout(100);
  let L = await H.leaves(), want = 2 * 1e4 * Math.acos(0.4) - 40 * Math.sqrt(4e4 - 6400);
  ok(L.length === 1 && near(Math.abs(G.area(L[0].d)), want, want * 0.01), 'circle lens area ' + Math.abs(G.area(L[0].d)).toFixed(0) + ' ~ ' + want.toFixed(0));
  ok(L[0].d[0].pts.length <= 6, 'lens refitted to few anchors: ' + L[0].d[0].pts.length);
  await clear();
  // Shape Builder: drag across all faces = union; alt-drag deletes a face
  await two(); await H.tool('builder');
  await H.drag([150, 150], [350, 350], 20);
  L = await H.leaves();
  ok(L.length === 1 && near(Math.abs(G.area(L[0].d)), 70000, 80), 'builder: dragging across all parts joins them (' + L.length + ')');
  await clear(); await two(); await H.tool('builder');
  await H.drag([140, 140], [260, 260], 10, ['Alt']);
  L = await H.leaves();
  ok(L.length === 1 && near(Math.abs(G.area(L[0].d)), 30000, 60), 'builder: alt-drag takes the corner and the middle away, one part left (' + L.length + ' / ' + L.map(n => Math.abs(G.area(n.d)).toFixed(0)) + ')');
  await clear(); await two(); await H.tool('builder');
  await H.click(250, 250);
  L = await H.leaves();
  ok(L.length === 3, 'builder: a tap splits into parts (' + L.length + ')');
  await clear();
  // compound path: square with a hole
  await H.tool('rect'); await H.drag([100, 100], [400, 400]); await H.drag([200, 200], [300, 300]); await H.tool('select'); await p.keyboard.press('Control+a');
  await p.keyboard.press('Control+8'); await p.waitForTimeout(80);
  L = await H.leaves();
  ok(L.length === 1 && L[0].d.length === 2 && L[0].rule === 'evenodd', 'compound path made with Ctrl 8');
  // the hole isn't hit
  await p.keyboard.press('Escape'); await H.click(250, 250); ok((await H.sel()).length === 0, 'compound: tapping the hole picks nothing');
  await H.click(150, 150); ok((await H.sel()).length === 1, 'compound: tapping the shape picks it');
  await p.keyboard.press('Control+8'); await p.waitForTimeout(80);
  ok((await H.leaves()).length === 2, 'compound released with Ctrl 8 again');
  await clear();
  // clipping mask: an ellipse clipping a rectangle
  await H.tool('rect'); await H.drag([100, 100], [400, 400]); await p.evaluate(() => window.PaintVector.pcSet('main', '#ff0000')); await H.tool('ellipse'); await H.drag([150, 150], [350, 350]);
  await H.tool('select'); await p.keyboard.press('Control+a'); await p.keyboard.press('Control+7'); await p.waitForTimeout(80);
  s = await H.ser(); top = s.layers[0].items;
  ok(top.length === 1 && top[0].clip && top[0].items.length === 2, 'clip group made');
  const clipEl = await p.$('.vec-art clipPath'); ok(!!clipEl, 'clipPath drawn');
  await p.keyboard.press('Escape'); await H.click(110, 110); ok((await H.sel()).length === 0, 'clip: outside the clip shape nothing is hit');
  await H.click(250, 250); ok((await H.sel()).length === 1, 'clip: inside it the group is picked');
  // raster: the corner outside the circle is white
  const px = await p.evaluate(async () => { const s = window.PaintVector.serialize(), c = await window.PaintVector.raster(Math.round(s.w), Math.round(s.h), true), x = c.getContext('2d'); return [Array.from(x.getImageData(110, 110, 1, 1).data), Array.from(x.getImageData(250, 250, 1, 1).data), Array.from(x.getImageData(100, 250, 1, 1).data)]; });
  ok(px[0][1] > 240 && px[1][0] > 240 && px[1][1] < 30 && px[2][1] > 240, 'clip: the rectangle edge outside the circle is clipped away, the circle edge shows ' + JSON.stringify(px));
  await H.tool('select'); await p.keyboard.press('Control+7'); await p.waitForTimeout(80);
  ok((await H.leaves()).length === 2 && !(await H.ser()).layers[0].items.some(n => n.clip), 'clip released');
  ok(!H.errs.length, 'no errors ' + H.errs.slice(0, 3).join(' | '));
  done(); await H.b.close();
})();
