const V = require('./vt.js'), D = '', fs = require('fs');
(async () => {
  const H = await V.setup({ showSwitch: true }), p = H.p, ok = V.ok;
  await H.vector();
  await H.tool('rect'); await H.drag([100, 100], [300, 250]);
  await H.tool('ellipse'); await H.drag([400, 100], [600, 250]);
  await H.tool('star'); await H.drag([800, 200], [880, 200]);
  // LAYERS: open, new layer, sublayer, rename, hide, lock, drag and drop
  await p.click('[data-act="layers"]'); await p.waitForTimeout(250);
  ok(await p.$eval('.vec-layerpanel', e => !e.hidden), 'Vector Layers opens');
  let rows = await p.$$eval('.vec-layerpanel [data-vn]', l => l.map(r => r.querySelector('.pl-name span').textContent));
  ok(rows.join('|') === 'Layer 1|Star|Ellipse|Rectangle', 'the tree, top first: ' + rows.join('|'));
  await p.click('[data-vl-act="add"]'); await p.waitForTimeout(100);
  await p.click('[data-vl-act="sub"]'); await p.waitForTimeout(100);
  let s = await H.ser();
  ok(s.layers.length === 2 && s.layers[1].items.length === 1 && s.layers[1].items[0].type === 'layer', 'a new layer, and a sublayer in it');
  // drag the Ellipse row into the sublayer (mouse: the row itself)
  const rowBox = async (name) => p.evaluate((name) => { const r = Array.from(document.querySelectorAll('.vec-layerpanel [data-vn]')).find(r => r.querySelector('.pl-name span').textContent === name); const b = r.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }, name);
  let a = await rowBox('Ellipse'), t = await rowBox('Sublayer');
  await p.mouse.move(a[0] + a[2] * 0.55, a[1] + a[3] / 2); await p.mouse.down(); await p.mouse.move(t[0] + t[2] * 0.55, t[1] + t[3] / 2, { steps: 10 }); await p.waitForTimeout(80); await p.mouse.up(); await p.waitForTimeout(150);
  s = await H.ser();
  ok(s.layers[1].items[0].items.length === 1 && s.layers[1].items[0].items[0].name === 'Ellipse', 'drag and drop: the ellipse into the sublayer');
  ok(s.layers[0].items.length === 2, 'and out of Layer 1');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  s = await H.ser(); ok(s.layers[0].items.length === 3, 'undo puts it back');
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(100);
  // drop the Rectangle above the Star (reorder)
  a = await rowBox('Rectangle'); t = await rowBox('Star');
  await p.mouse.move(a[0] + a[2] * 0.55, a[1] + a[3] / 2); await p.mouse.down(); await p.mouse.move(t[0] + t[2] * 0.55, t[1] + 3, { steps: 10 }); await p.waitForTimeout(80); await p.mouse.up(); await p.waitForTimeout(150);
  s = await H.ser(); ok(s.layers[0].items.map(n => n.name).join(',') === 'Star,Rectangle', 'reordered: the rectangle now above the star (' + s.layers[0].items.map(n => n.name).join(',') + ')');
  // eye, lock, rename
  await p.click('.vec-layerpanel [data-vn-eye]'); await p.waitForTimeout(80);
  s = await H.ser(); ok(s.layers[1].visible === false, 'the eye hides the top layer');
  await p.click('.vec-layerpanel [data-vn-eye]'); await p.waitForTimeout(80);
  const starRow = await rowBox('Star');
  await p.dblclick('.vec-layerpanel [data-vn] .pl-name >> text=Star'); await p.waitForTimeout(100);
  await p.keyboard.press('Control+a'); await p.keyboard.type('Big Star'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  s = await H.ser(); ok(s.layers[0].items.some(n => n.name === 'Big Star'), 'renamed by a double-click');
  await p.screenshot({ path: D + 't24-layers.png' });
  await p.keyboard.press('Escape');
  // ROTATE VIEW
  await H.tool('rotview'); await p.evaluate(() => { const i = document.querySelector('[data-vk="rot"]'); i.value = 30; i.dispatchEvent(new Event('input', { bubbles: true })); });
  s = await H.ser(); ok(Math.abs(s.view.r - Math.PI / 6) < 1e-6, 'Rotate View: 30°');
  await H.tool('select'); await H.click(500, 175);
  ok((await H.ser()).sel.length === 1, 'picking works with the view turned');
  await p.screenshot({ path: D + 't24-rot.png' });
  await p.keyboard.press('0'); await p.waitForTimeout(80);
  s = await H.ser(); ok(s.view.r === 0, 'Fit puts it upright');
  // SAVE: SVG
  await p.evaluate(() => document.querySelector('[data-act="save"]').click()); await p.waitForTimeout(150);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-save="svg"]')]);
  const svg = fs.readFileSync(await dl.path(), 'utf8');
  ok((svg.match(/<path /g) || []).length >= 6 && /<g/.test(svg), 'SVG export: paths in layer groups');
  // PERSISTENCE across a reload
  const before = await H.ser(); await p.waitForTimeout(1600);
  await p.reload(); await p.waitForTimeout(1800);
  const after = await H.ser();
  const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, q) => (o[q] = x[q], o), {}) : x);
  ok(canon(before.layers) === canon(after.layers), 'reload: every layer, group and path back exactly');
  // TO PAINT: bring the art across
  await p.click('[data-mode="paint"]'); await p.waitForTimeout(300); await p.click('[data-vm="bring"]'); await p.waitForTimeout(800);
  const px = await p.evaluate(() => { const cs = document.querySelectorAll('.paint-layers canvas'), c = cs[cs.length - 1], k = c.width / window.PaintVector.serialize().w; const d = c.getContext('2d').getImageData(Math.round(100 * k), Math.round(175 * k), 1, 1).data; return Array.from(d); });
  ok(px[3] > 200 && px[0] < 80, 'brought to Paint: the rectangle’s left edge is there (' + px + ')');
  console.log('errors', H.errs); V.done(); await H.b.close();
})();
