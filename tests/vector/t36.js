// stage 3: Align & Arrange; keeping everything; the panels' looks
const { setup, ok, done } = require('./vt.js'); const G = require('./geo.js');
const near = (a, b, t) => Math.abs(a - b) <= (t || 0.6);
(async () => {
  const H = await setup(); const p = H.p;
  await H.vector();
  const boxes = async () => (await H.leaves()).map(n => G.bbox(n.d));
  await H.tool('rect'); await H.drag([100, 100], [200, 150]); await H.drag([300, 200], [350, 300]); await H.drag([500, 120], [620, 180]);
  await H.tool('select'); await p.keyboard.press('Control+a');
  await H.tool('align'); await p.click('[data-va="al-t"]'); await p.waitForTimeout(60);
  let B = await boxes(); ok(B.every(b => near(b.y, 100)), 'align top to the selection');
  await p.click('[data-va="al-hc"]'); B = await boxes(); ok(B.every(b => near(b.x + b.w / 2, 360)), 'align horizontal centres');
  await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await p.waitForTimeout(60);
  // key object: tap the middle one
  await p.click('[data-vk="T.align.to"][data-val="key"]'); await p.waitForTimeout(40);
  await H.click(325, 250); await p.waitForTimeout(60);
  ok((await H.sel()).length === 3, 'a tap on one of the picked keeps them all picked');
  ok(!!(await p.$('.vs-key')), 'the key object is outlined');
  await p.click('[data-va="al-l"]'); B = await boxes();
  ok(B.every(b => near(b.x, 300)), 'align left to the key object (it stays put)');
  await p.keyboard.press('Control+z');
  // artboard
  await p.click('[data-vk="T.align.to"][data-val="board"]'); await p.click('[data-va="al-r"]');
  const W = (await H.ser()).w; B = await boxes(); ok(B.every(b => near(b.x + b.w, W)), 'align right to the artboard');
  await p.keyboard.press('Control+z'); await p.click('[data-vk="T.align.to"][data-val="sel"]');
  // distribute horizontal centres
  await H.tool('distribute'); await p.click('[data-va="ds-hc"]'); B = (await boxes()).sort((a, b) => a.x - b.x);
  const c = B.map(b => b.x + b.w / 2); ok(near(c[1] - c[0], c[2] - c[1], 0.6), 'distribute centres evenly ' + c.map(v => v.toFixed(1)));
  await p.keyboard.press('Control+z');
  // distribute spacing
  await H.tool('dspace'); await p.click('[data-va="sp-h"]'); B = (await boxes()).sort((a, b) => a.x - b.x);
  const g1 = B[1].x - (B[0].x + B[0].w), g2 = B[2].x - (B[1].x + B[1].w); ok(near(g1, g2), 'even gaps ' + g1.toFixed(1) + ' ' + g2.toFixed(1));
  // key + gap
  await p.click('[data-vk="T.align.to"][data-val="key"]'); await p.waitForTimeout(40);
  await p.fill('[data-vk="T.align.gap"]', '10'); await p.press('[data-vk="T.align.gap"]', 'Enter');
  await p.click('[data-va="sp-h"]'); B = (await boxes()).sort((a, b) => a.x - b.x);
  ok(near(B[1].x - (B[0].x + B[0].w), 10) && near(B[2].x - (B[1].x + B[1].w), 10), 'gaps of 10 round the key object');
  await p.click('[data-vk="T.align.to"][data-val="sel"]');
  // arrange actions
  await H.tool('select'); const f0 = (await H.leaves())[0], fb = G.bbox(f0.d); await H.click(fb.x + fb.w / 2, fb.y + fb.h / 2);
  const id = (await H.sel())[0]; ok(id === f0.id, 'picked the bottom one');
  await H.tool('front'); let items = (await H.ser()).layers[0].items; ok(items[items.length - 1].id === id, 'bring to front');
  await H.tool('back'); items = (await H.ser()).layers[0].items; ok(items[items.length - 2].id === id, 'send backward');
  await H.tool('backmost'); items = (await H.ser()).layers[0].items; ok(items[0].id === id, 'send to back');
  await H.tool('fwd'); items = (await H.ser()).layers[0].items; ok(items[1].id === id, 'bring forward');
  ok(await p.$$eval('.vec-tool[aria-pressed="true"]', b => b.length === 1 && ['align', 'distribute', 'dspace'].indexOf(b[0].dataset.vtool) >= 0), 'the tool in hand stays after an action');
  await p.keyboard.press('Control+a'); await H.tool('groupun'); items = (await H.ser()).layers[0].items; ok(items.length === 1 && items[0].type === 'group', 'group');
  await H.tool('groupun'); items = (await H.ser()).layers[0].items; ok(items.length === 3, 'ungroup');
  // nothing picked: a toast, nothing changes
  await p.keyboard.press('Escape'); await H.tool('front'); await p.waitForTimeout(50);
  ok(await p.evaluate(() => /Pick something/.test(document.body.innerText)), 'an action with nothing picked says so');
  // everything kept: the project and the autosave
  await H.tool('text'); await H.click(100, 500); await p.keyboard.type('kept'); await p.keyboard.press('Escape');
  await H.tool('select'); await p.keyboard.press('Control+a'); await H.tool('rotate'); await p.click('[data-va="xrot"]');
  const s0 = await H.ser(); await p.evaluate(s => window.PaintVector.load(JSON.parse(JSON.stringify(s))), s0); const s1 = await H.ser();
  const norm = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, q) => (a[q] = v[q], a), {}) : v);
  ok(norm(s1.layers) === norm(s0.layers), 'load gives the same layers back');
  // reload the page: the autosave brings it back
  await p.waitForTimeout(1200); await p.reload(); await p.waitForTimeout(1500);
  const s2 = await H.ser(); ok(s2 && JSON.stringify(s2.layers).length === JSON.stringify(s0.layers).length, 'the autosave keeps it through a reload');
  ok(!H.errs.length, 'no errors ' + H.errs.slice(0, 3).join(' | '));
  done(); await H.b.close();
})();
