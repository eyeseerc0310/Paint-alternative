const V = require('./vt.js');
(async () => {
  const H = await V.setup(); const p = H.p;
  await H.vector();
  // rulers
  await H.tool('rulers'); V.ok(true,'');
  V.ok(await p.$eval('.vec-ruler-h', r => !r.hidden && r.offsetHeight === 18), 'ruler shown');
  await p.click('[data-vk="T.prec.units"][data-val="mm"]'); await p.waitForTimeout(60);
  // drag a guide out of the top ruler
  const rh = await p.$eval('.vec-ruler-h', r => { const b = r.getBoundingClientRect(); return [b.left + b.width / 4, b.top + 9]; });
  const g = await H.at(0, 200);
  await p.mouse.move(...rh); await p.mouse.down(); await p.mouse.move(rh[0], g[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(80);
  let s = await H.ser(); V.ok(s.guides.length === 1 && s.guides[0].o === 'h' && Math.abs(s.guides[0].p - 200) < 2, 'guide from ruler ' + JSON.stringify(s.guides));
  V.ok(await p.$$eval('.vs-guide', a => a.length) === 1, 'guide drawn');
  // dropping back on the ruler removes it
  await p.mouse.move(...rh); await p.mouse.down(); await p.mouse.move(rh[0], g[1] - 100, { steps: 4 }); await p.mouse.move(...rh, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(80);
  s = await H.ser(); V.ok(s.guides.length === 1, 'guide dropped on ruler goes');
  // Guides tool: tap adds a vertical guide
  await H.tool('guides'); await p.click('[data-vk="T.prec.gnew"][data-val="v"]'); await H.click(300, 400);
  s = await H.ser(); V.ok(s.guides.length === 2 && s.guides[1].o === 'v' && Math.abs(s.guides[1].p - 300) < 2, 'guides tool add');
  // drag the guide to 350
  await p.waitForTimeout(450); await H.drag([s.guides[1].p, 400], [350, 400]); s = await H.ser(); V.ok(Math.abs(s.guides[1].p - 350) < 2, 'guide moved ' + s.guides[1].p);
  // snapping: a rect drawn near the guide snaps to it
  await H.tool('rect'); await H.drag([353, 197], [500, 300]);
  let L = await H.leaves(); let xs = L[0].d[0].pts.map(q => q.x), ys = L[0].d[0].pts.map(q => q.y);
  V.ok(Math.abs(Math.min(...xs) - s.guides[1].p) < 1e-6 && Math.abs(Math.min(...ys) - s.guides[0].p) < 1e-6, 'rect snapped to guides ' + Math.min(...xs) + ',' + Math.min(...ys));
  // Ctrl+; hides guides; no snapping then
  await p.keyboard.press('Control+;'); V.ok(await p.$$eval('.vs-guide', a => a.length) === 0, 'guides hidden');
  // grid + snap to grid
  await H.tool('snapgrid'); await p.fill('[data-vk="T.prec.gsize"]', '50'); await p.press('[data-vk="T.prec.gsize"]', 'Enter'); await p.fill('[data-vk="T.prec.gsub"]', '1'); await p.press('[data-vk="T.prec.gsub"]', 'Enter');
  await H.tool('grid'); V.ok(await p.$eval('.vec-gridel', g => !g.hidden), 'grid shown');
  await H.tool('ellipse'); await H.drag([603, 98], [748, 203]);
  L = await H.leaves(); const e = L[1]; xs = e.d[0].pts.map(q => q.x); ys = e.d[0].pts.map(q => q.y);
  V.ok(Math.abs(Math.min(...xs) - 600) < 1e-6 && Math.abs(Math.max(...xs) - 750) < 1e-6 && Math.abs(Math.min(...ys) - 100) < 1e-6, 'ellipse on grid ' + [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]);
  await p.keyboard.press("Control+'"); V.ok(await p.$eval('.vec-gridel', g => g.hidden), 'grid hidden by key');
  // switch grid snapping off: smart guides on, move rect so its left lines up with ellipse's left
  await H.tool('snapgrid'); await p.click('[data-vk="T.prec.snapGrid"]'); await H.tool('smartg');
  await H.tool('select'); const rb = { x: Math.min(...L[0].d[0].pts.map(q => q.x)), y: Math.min(...L[0].d[0].pts.map(q => q.y)) };
  await p.mouse.move(...await H.at(rb.x + 20, rb.y + 20)); await p.mouse.down(); await p.mouse.move(...await H.at(rb.x + 20 + (600 - rb.x) + 3, rb.y + 120), { steps: 8 });
  const smart = await p.$$eval('.vs-smart', a => a.length); await p.mouse.up(); await p.waitForTimeout(80);
  L = await H.leaves(); V.ok(Math.abs(Math.min(...L[0].d[0].pts.map(q => q.x)) - 600) < 1e-6, 'smart guide snap x=' + Math.min(...L[0].d[0].pts.map(q => q.x)));
  V.ok(smart > 0, 'smart lines while moving ' + smart);
  V.ok(await p.$$eval('.vs-smart', a => a.length) === 0, 'smart lines cleared');
  // snap to points: a line drawn starting near the ellipse's top anchor
  await H.tool('smartg'); await p.click('[data-vk="T.prec.smart"]');
  await H.tool('snappts'); await H.tool('line'); await H.drag([677, 103], [800, 400]);
  L = await H.leaves(); const ln = L[L.length - 1]; V.ok(Math.abs(ln.d[0].pts[0].x - 675) < 1e-6 && Math.abs(ln.d[0].pts[0].y - 100) < 1e-6, 'line starts on anchor ' + JSON.stringify(ln.d[0].pts[0]));
  // measure
  await H.tool('measure'); await p.click('[data-vk="T.prec.units"][data-val="px"]'); await H.drag([100, 600], [400, 600 - 0.0001]);
  const mt = await p.$eval('[data-vmeas]', m => m.textContent); V.ok(/D300 px/.test(mt.replace(/\s/g, ' ').replace(/ /g, '')) || /300 px/.test(mt), 'measure ' + mt);
  V.ok(await p.$$eval('.vs-label', a => a.length) === 1, 'measure label');
  console.log('grid state', await p.evaluate(() => { const g = document.querySelector('.vec-gridel'); return [g.hidden, getComputedStyle(g).display, g.style.cssText.slice(0,80)]; }));
  await p.screenshot({ path: 't43.png' });
  // persistence
  s = await H.ser(); await p.evaluate(d => window.PaintVector.load(d), s); const s2 = await H.ser(); V.ok(JSON.stringify(s2.guides) === JSON.stringify(s.guides), 'guides saved');
  V.ok(!H.errs.length, 'no errors ' + H.errs.join('\n'));
  V.done(); await H.b.close();
})();
