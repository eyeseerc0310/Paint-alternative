// stage 3: Transform (Free Transform, Move, Scale, Rotate, Reflect, Shear, Distort) and turning with Selection
const { setup, ok, done } = require('./vt.js'); const G = require('./geo.js');
const near = (a, b, t) => Math.abs(a - b) <= (t || 0.6);
(async () => {
  const H = await setup(); const p = H.p;
  await H.vector();
  const clear = async () => { await H.tool('select'); await p.keyboard.press('Control+a'); await p.keyboard.press('Delete'); await p.waitForTimeout(60); };
  const box = async () => G.bbox((await H.leaves())[0].d);
  const setNum = async (k, v) => { await p.fill('[data-vk="' + k + '"]', String(v)); await p.press('[data-vk="' + k + '"]', 'Enter'); await p.waitForTimeout(60); };
  // a 200 × 100 rectangle, picked
  const rect = async () => { await H.tool('rect'); await H.drag([200, 200], [400, 300]); };
  await rect();
  // Rotate 90 with the panel
  await H.tool('rotate'); await setNum('T.rotate.a', 90); await p.click('[data-va="xrot"]'); await p.waitForTimeout(80);
  let b = await box(); ok(near(b.w, 100) && near(b.h, 200) && near(b.x + b.w / 2, 300) && near(b.y + b.h / 2, 250), 'rotate 90° about the middle: ' + JSON.stringify(b));
  let L = await H.leaves(); ok(!!L[0].live && !!L[0].live.m, 'a turned rectangle stays live, with a matrix');
  // a live setting still works on it
  await H.tool('select'); const hasW = await p.$('[data-vk="L.r"]'); ok(!hasW, 'plain rect has no radius field (as before)');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(60); b = await box(); ok(near(b.w, 200), 'undo the turn');
  // Rotate copy
  await H.tool('rotate'); await p.click('[data-va="xrotc"]'); await p.waitForTimeout(80);
  ok((await H.leaves()).length === 2, 'rotate copy makes a copy');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(60);
  // Scale tool: tap sets origin at the top-left, drag doubles
  await H.tool('scale'); await H.click(200, 200);
  await H.drag([400, 300], [600, 400], 10);
  b = await box(); ok(near(b.x, 200, 1) && near(b.y, 200, 1) && near(b.w, 400, 2) && near(b.h, 200, 2), 'scale from a tapped point: ' + JSON.stringify(b));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(60);
  // Scale numeric 50% about the reference point (bottom right)
  await p.click('[data-vk="xref"][data-val="se"]'); await setNum('T.scale.u', 50); await p.click('[data-va="xscale"]'); await p.waitForTimeout(60);
  b = await box(); ok(near(b.x, 300) && near(b.y, 250) && near(b.w, 100) && near(b.h, 50), 'scale 50% from the bottom right: ' + JSON.stringify(b));
  await p.keyboard.press('Control+z'); await p.click('[data-vk="xref"][data-val="c"]');
  // Reflect across the vertical axis
  await H.tool('reflect'); await p.click('[data-va="xrefl"]'); await p.waitForTimeout(60);
  b = await box(); ok(near(b.x, 200) && near(b.w, 200), 'reflect keeps the box ' + JSON.stringify(b));
  L = await H.leaves(); ok(near(L[0].d[0].pts[0].x, 400, 1), 'reflect mirrors the points (first corner now on the right)');
  await p.keyboard.press('Control+z');
  // Shear 45° horizontal: the box widens by its height
  await H.tool('shear'); await setNum('T.shear.a', 45); await p.click('[data-va="xshear"]'); await p.waitForTimeout(60);
  b = await box(); ok(near(b.w, 300) && near(b.h, 100), 'shear 45° widens it by its height ' + JSON.stringify(b));
  await p.keyboard.press('Control+z');
  // Move numeric
  await H.tool('move'); await setNum('T.move.dx', 30); await setNum('T.move.dy', -20); await p.click('[data-va="xmove"]'); await p.waitForTimeout(60);
  b = await box(); ok(near(b.x, 230) && near(b.y, 180), 'move by 30, -20');
  ok(await p.$eval('[data-vk="mvdist"]', i => +i.value) > 35, 'distance follows');
  // Move tool drag from empty space
  await H.drag([600, 500], [650, 520], 6); b = await box(); ok(near(b.x, 280, 1.5) && near(b.y, 200, 1.5), 'move tool drags what\'s picked from anywhere ' + JSON.stringify(b));
  await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z');
  // Free Transform: the round handle turns it
  await H.tool('ftrans');
  const kn = await p.$eval('.vs-knob', c => [+c.getAttribute('cx'), +c.getAttribute('cy')]);
  const sr = await p.$eval('.vec-stage', s => { const r = s.getBoundingClientRect(); return [r.left, r.top]; });
  const C = await H.at(300, 250);
  await p.mouse.move(sr[0] + kn[0], sr[1] + kn[1]); await p.mouse.down(); await p.mouse.move(C[0] + 200, C[1], { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(80);
  b = await box(); ok(near(b.w, 100, 2) && near(b.h, 200, 2), 'free transform: the round handle turns it 90° ' + JSON.stringify(b));
  await p.keyboard.press('Control+z');
  // Free Transform: a side handle with Ctrl slants
  const E = await H.at(400, 250);
  await p.keyboard.down('Control'); await p.mouse.move(...E); await p.mouse.down(); await p.mouse.move(E[0], E[1] + 60, { steps: 8 }); await p.mouse.up(); await p.keyboard.up('Control'); await p.waitForTimeout(80);
  b = await box(); ok(near(b.w, 200, 1) && b.h > 140, 'free transform: Ctrl on a side handle slants ' + JSON.stringify(b));
  await p.keyboard.press('Control+z');
  // Selection: just outside a corner turns
  await H.tool('select'); const nw = await H.at(200, 200);
  await p.mouse.move(nw[0] - 10, nw[1] - 10); await p.mouse.down(); const c2 = await H.at(300, 250); await p.mouse.move(c2[0] + 150, c2[1] - 150, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(80);
  L = await H.leaves(); ok(!near(G.bbox(L[0].d).w, 200, 1), 'selection: a drag just outside a corner turns it');
  await p.keyboard.press('Control+z');
  // Distort: pull a corner
  await H.tool('distort'); const se = await H.at(400, 300);
  await p.mouse.move(...se); await p.mouse.down(); const t2 = await H.at(450, 360); await p.mouse.move(...t2, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(80);
  L = await H.leaves(); const pts = L[0].d[0].pts; ok(!L[0].live && pts.some(q => near(q.x, 450, 1) && near(q.y, 360, 1)) && pts.some(q => near(q.x, 200, 0.5) && near(q.y, 200, 0.5)), 'distort: one corner moves, the opposite stays');
  // square up then another corner from the new quad
  const ne = await H.at(400, 200); await p.mouse.move(...ne); await p.mouse.down(); const t3 = await H.at(420, 180); await p.mouse.move(...t3, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(60);
  L = await H.leaves(); ok(L[0].d[0].pts.some(q => near(q.x, 450, 1) && near(q.y, 360, 1)) && L[0].d[0].pts.some(q => near(q.x, 420, 1) && near(q.y, 180, 1)), 'distort: corners carry on from where they were');
  await clear();
  // a picture turned keeps a matrix and draws turned
  await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 40; c.height = 20; c.getContext('2d').fillRect(0, 0, 40, 20); const bl = await new Promise(r => c.toBlob(r)); window.PaintVector.addImageFile(new File([bl], 'pic.png', { type: 'image/png' })); });
  await p.waitForTimeout(400);
  await H.tool('rotate'); await setNum('T.rotate.a', 30); await p.click('[data-va="xrot"]'); await p.waitForTimeout(80);
  L = await H.leaves(); ok(L[0].type === 'image' && L[0].mt && L[0].mt.length === 6, 'a picture turned keeps a matrix');
  ok(!!(await p.$('.vec-art g[transform^="matrix"] use')), 'and is drawn turned');
  // save and load keeps it
  const s0 = await H.ser(); await p.evaluate(s => window.PaintVector.load(s), s0); const s1 = await H.ser();
  ok(JSON.stringify(s1.layers[0].items[0].mt) === JSON.stringify(s0.layers[0].items[0].mt), 'its matrix is kept on load');
  ok(!H.errs.length, 'no errors ' + H.errs.slice(0, 3).join(' | '));
  done(); await H.b.close();
})();
