const V = require('./vt.js'), D = '';
(async () => {
  const H = await V.setup(), p = H.p, ok = V.ok;
  await H.vector();
  const byName = async (k) => (await H.leaves()).filter(n => n.live && n.live.k === k);
  const npts = n => n.d.reduce((a, sp) => a + sp.pts.length, 0);
  // PEN: corner, curve (drag), corner, close on the first
  await H.tool('pen');
  await H.click(100, 100); await H.drag([300, 100], [360, 160]); await H.click(300, 300);
  let L = await H.leaves(); ok(L.length === 1 && L[0].d[0].pts.length === 3 && !L[0].d[0].closed, 'pen: three points so far');
  const q1 = L[0].d[0].pts[1]; ok(Math.abs(q1.ox - 360) < 1 && Math.abs(q1.ix - 240) < 1 && q1.s === 1, 'the dragged point has mirrored handles');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  L = await H.leaves(); ok(L[0].d[0].pts.length === 2, 'undo while drawing: the last point off');
  await H.click(300, 300);
  await H.click(100, 100);
  L = await H.leaves(); ok(L[0].d[0].closed && L[0].d[0].pts.length === 3, 'clicking the first point closes it');
  // continue an open path: line, then pen from its end
  await H.tool('pen'); await H.click(500, 100); await H.click(600, 100); await p.keyboard.press('Enter'); await p.waitForTimeout(80);
  L = await H.leaves(); ok(L.length === 2 && L[1].d[0].pts.length === 2 && !L[1].d[0].closed, 'Return finishes an open path');
  await H.click(600, 100); await H.click(650, 200); await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  L = await H.leaves(); ok(L.length === 2 && L[1].d[0].pts.length === 3, 'clicking its end carries the path on');
  // CURVATURE
  await H.tool('curvature'); await H.click(100, 400); await H.click(200, 330); await H.click(300, 420); await H.click(400, 350); await p.keyboard.press('Enter'); await p.waitForTimeout(80);
  L = await H.leaves(); const cvp = L[2];
  ok(cvp && cvp.d[0].pts.length === 4 && cvp.d[0].pts[1].a === 1 && cvp.d[0].pts[1].s === 1 && Math.abs(cvp.d[0].pts[1].ox - cvp.d[0].pts[1].x) > 5, 'curvature: smooth points through the clicks');
  // ADD / DELETE / CONVERT on a rectangle
  await H.tool('rect'); await H.drag([700, 300], [900, 450]);
  L = await H.leaves(); const rect = L[L.length - 1];
  await H.tool('addpt'); await H.click(800, 300);
  L = await H.leaves(); let r = L.find(n => n.id === rect.id); ok(npts(r) === 5 && !r.live, 'Add Anchor: 5 points, no longer a live rectangle');
  await H.tool('delpt'); await H.click(800, 300);
  L = await H.leaves(); r = L.find(n => n.id === rect.id); ok(npts(r) === 4, 'Delete Anchor: 4 again');
  await H.tool('convert'); await H.click(700, 300);
  L = await H.leaves(); r = L.find(n => n.id === rect.id); const c0 = r.d[0].pts.find(q => Math.abs(q.x - 700) < 0.5 && Math.abs(q.y - 300) < 0.5);
  ok(c0 && c0.s === 1 && Math.abs(c0.ox - c0.x) + Math.abs(c0.oy - c0.y) > 5, 'Convert: the corner becomes smooth');
  await H.click(700, 300); L = await H.leaves(); r = L.find(n => n.id === rect.id); const c1 = r.d[0].pts.find(q => Math.abs(q.x - 700) < 0.5 && Math.abs(q.y - 300) < 0.5);
  ok(c1 && c1.s === 0 && c1.ox === c1.x, 'Convert again: a corner');
  await H.click(900, 375); L = await H.leaves(); r = L.find(n => n.id === rect.id);
  const right = r.d[0].pts.findIndex(q => Math.abs(q.x - 900) < 0.5 && Math.abs(q.y - 300) < 0.5);
  ok(right >= 0 && Math.abs(r.d[0].pts[right].ox - 900) > 1, 'Convert a segment: it curves');
  // ANCHOR POINT: pull handles out of a corner
  await H.tool('anchor'); await H.drag([900, 450], [960, 470]);
  L = await H.leaves(); r = L.find(n => n.id === rect.id); const pk = r.d[0].pts.find(q => Math.abs(q.x - 900) < 0.5 && Math.abs(q.y - 450) < 0.5);
  ok(pk && Math.abs(pk.ox - 960) < 1 && Math.abs(pk.ix - 840) < 1, 'Anchor Point: drag pulls out handles');
  // DIRECT SELECTION: drag a corner
  await H.tool('direct'); await H.click(700, 450);
  let s = await H.ser(); ok(s.sel[0] === rect.id && Object.keys((await p.evaluate(() => window.PaintVector.serialize().sel)) ).length >= 0, 'direct: picked by its anchor');
  await H.drag([700, 450], [680, 480]);
  L = await H.leaves(); r = L.find(n => n.id === rect.id); ok(r.d[0].pts.some(q => Math.abs(q.x - 680) < 1 && Math.abs(q.y - 480) < 1), 'direct: the corner dragged to 680,480');
  await p.screenshot({ path: D + 't22-direct.png' });
  // SCISSORS: a closed shape opens; an open line splits in two
  await H.tool('ellipse'); await H.click(300, 650);
  L = await H.leaves(); const ell = L[L.length - 1];
  await H.tool('scissors'); await H.click(400, 650);
  L = await H.leaves(); let e2 = L.find(n => n.id === ell.id); ok(!e2.d[0].closed && e2.d[0].pts.length === 5, 'Scissors: the ellipse opens where tapped');
  await H.tool('line'); await H.drag([500, 600], [700, 600]);
  L = await H.leaves(); const ln = L[L.length - 1], nL = L.length;
  await H.tool('scissors'); await H.click(600, 600);
  L = await H.leaves(); ok(L.length === nL + 1, 'Scissors: an open line becomes two');
  // JOIN the two halves back
  await H.tool('select'); await H.drag([480, 580], [720, 620]);
  await p.keyboard.press('Control+j'); await p.waitForTimeout(80);
  L = await H.leaves(); ok(L.length === nL, 'Ctrl J joins them again (' + L.length + ')');
  // KNIFE across a rectangle
  await H.tool('rect'); await H.drag([800, 560], [1000, 700]);
  L = await H.leaves(); const nK = L.length;
  await p.keyboard.press('Escape');
  await H.tool('knife'); await H.drag([900, 520], [900, 740], 12);
  L = await H.leaves(); ok(L.length === nK + 1, 'Knife: the rectangle cut in two (' + (L.length - nK + 1) + ' pieces)');
  const pieces = L.slice(-2); const boxes = pieces.map(n => { const xs = n.d[0].pts.map(q => q.x); return [Math.round(Math.min(...xs)), Math.round(Math.max(...xs))]; });
  ok(boxes.some(b => b[0] === 800 && b[1] === 900) && boxes.some(b => b[0] === 900 && b[1] === 1000), 'the pieces meet at the cut: ' + JSON.stringify(boxes));
  // SIMPLIFY a spiral
  await H.tool('spiral'); await H.drag([1100, 250], [1200, 250]);
  L = await H.leaves(); const spr = L[L.length - 1], before = npts(spr);
  await H.tool('simplify'); await p.evaluate(() => { const i = document.querySelector('[data-vk="T.simplify.tol"]'); i.value = 8; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.click('[data-va="simplify"]'); await p.waitForTimeout(100);
  L = await H.leaves(); const after = npts(L.find(n => n.id === spr.id)); ok(after < before, 'Simplify: ' + before + ' anchors to ' + after);
  // LASSO anchors
  await H.tool('lasso');
  const poly = [[650, 260], [950, 260], [950, 340], [650, 340]];
  const A = await Promise.all(poly.map(q => H.at(...q))); await p.mouse.move(...A[0]); await p.mouse.down(); for (const q of A.slice(1)) await p.mouse.move(...q, { steps: 4 }); await p.mouse.move(...A[0], { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(80);
  const nas = await p.evaluate(() => document.querySelectorAll('.vs-anchor.on').length);
  ok(nas >= 2, 'Lasso picks the anchors inside (' + nas + ')');
  console.log('errors', H.errs); V.done(); await H.b.close();
})();
