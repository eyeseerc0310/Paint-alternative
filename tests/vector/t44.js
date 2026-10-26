const V = require('./vt.js');
(async () => {
  const H = await V.setup(); const p = H.p;
  await H.vector();
  const nodes = async () => (await H.ser()).layers[0].items;
  const svgCount = async (sel) => p.$$eval('.vec-art ' + sel, a => a.length);
  // two shapes; blend them by tapping
  await H.tool('rect'); await H.drag([100, 100], [160, 160]);
  await H.tool('ellipse'); await H.drag([500, 300], [600, 400]);
  const paths0 = await svgCount('path');
  await H.tool('vblend'); await p.fill('[data-vk="bl.steps"]', '5'); await p.press('[data-vk="bl.steps"]', 'Enter');
  await H.click(100, 130); await p.waitForTimeout(400); await H.click(500, 350);
  let it = await nodes(); V.ok(it.length === 1 && it[0].type === 'group' && it[0].blnd && it[0].blnd.steps === 5, 'blend group ' + JSON.stringify(it.map(n => [n.type, n.blnd])));
  V.ok(await svgCount('path') === paths0 + 10, 'blend draws 5 steps: ' + await svgCount('path'));
  // change steps on the picked blend
  await p.fill('[data-vk="bl.steps"]', '2'); await p.press('[data-vk="bl.steps"]', 'Enter');
  V.ok(await svgCount('path') === paths0 + 4, 'steps changed');
  await p.keyboard.press('Control+z'); V.ok(await svgCount('path') === paths0 + 10, 'undo steps');
  // expand
  await p.click('[data-va="blexpand"]'); it = await nodes(); V.ok(it[0].type === 'group' && !it[0].blnd && it[0].items.length === 7, 'expanded blend ' + it[0].items.length);
  await p.keyboard.press('Control+z'); await p.click('[data-va="blrelease"]'); it = await nodes(); V.ok(!it[0].blnd && it[0].items.length === 2, 'released');
  await p.keyboard.press('Control+z');
  // warp a rectangle
  await H.tool('rect'); await H.drag([100, 450], [400, 600]);
  await H.tool('warp'); await p.selectOption('[data-vk="wp.st"]', 'arc'); await p.click('[data-va="wpapply"]');
  it = await nodes(); let w = it[it.length - 1]; V.ok(w.efx && w.efx.k === 'warp' && w.efx.st === 'arc', 'warp applied');
  const bb = await p.evaluate(id => { const e = document.querySelector('.vec-art [data-v="' + id + '"]'); const b = e.getBBox(); return [b.y, b.height]; }, w.id);
  V.ok(bb[0] < 449, 'warped bbox rises ' + bb);
  // change bend live
  await p.$eval('[data-vk="wp.bend"]', (r) => { r.value = -80; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
  it = await nodes(); w = it[it.length - 1]; V.ok(w.efx.bend === -80, 'bend changed ' + w.efx.bend);
  // envelope with mesh, drag a point
  await H.tool('envelope'); await p.click('[data-va="envmesh"]');
  it = await nodes(); w = it[it.length - 1]; V.ok(w.efx.k === 'env' && w.efx.m.length === 16, 'envelope mesh');
  await H.drag([100, 450], [60, 400]); it = await nodes(); w = it[it.length - 1];
  V.ok(w.efx.m[0][0] < -0.1 && w.efx.m[0][1] < -0.2, 'mesh point moved ' + w.efx.m[0]);
  await p.click('[data-va="fxexpand"]'); it = await nodes(); w = it[it.length - 1]; V.ok(!w.efx && w.d[0].pts.length > 4, 'envelope expanded pts=' + w.d[0].pts.length);
  // offset path
  await H.tool('offset'); await p.fill('[data-vk="T.offset.d"] >> nth=1', '20').catch(() => {});
  await p.$$eval('[data-vk="T.offset.d"]', a => { const n = a.find(x => x.type === 'number'); n.value = 20; n.dispatchEvent(new Event('change', { bubbles: true })); });
  await H.tool('select'); await H.click(130, 130); // the blend
  await H.tool('rect'); await H.drag([700, 100], [800, 200]); await H.tool('offset'); await p.click('[data-va="offsetgo"]');
  await p.waitForTimeout(300);
  it = await nodes(); const off = it[it.length - 2]; const xs = off.d.flatMap(sp => sp.pts.map(q => q.x)), ys = off.d.flatMap(sp => sp.pts.map(q => q.y));
  V.ok(Math.abs(Math.min(...xs) - 680) < 1.5 && Math.abs(Math.max(...xs) - 820) < 1.5 && Math.abs(Math.min(...ys) - 80) < 1.5, 'offset box ' + [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map(v => v.toFixed(1)));
  // repeat radial
  await H.tool('select'); await H.click(750, 150);
  await H.tool('repeat'); await p.click('[data-vk="rp.k"][data-val="radial"]'); await p.fill('[data-vk="rp.n"]', '6'); await p.press('[data-vk="rp.n"]', 'Enter');
  await p.click('[data-va="rpmake"]'); it = await nodes(); const rp = it[it.length - 1];
  V.ok(rp.type === 'group' && rp.rep && rp.rep.n === 6, 'repeat group ' + JSON.stringify(rp.rep));
  V.ok(await p.$eval('.vec-art [data-v="' + rp.id + '"]', g => g.querySelectorAll('path').length) === 12, 'six copies');
  await p.click('[data-vk="rp.k"][data-val="grid"]'); await p.waitForTimeout(60);
  V.ok(await p.$eval('.vec-art [data-v="' + rp.id + '"]', g => g.querySelectorAll('path').length) === 18, 'grid 3x3');
  // pattern from the star
  await H.tool('star'); await H.drag([950, 500], [980, 530]);
  await H.tool('pattern'); await p.click('[data-va="patmake"]');
  let s = await H.ser(); V.ok(s.pats.length === 1, 'pattern made');
  await H.tool('select'); await H.click(250, 525); await H.tool('pattern');
  await p.click('[data-vpat="' + s.pats[0].id + '"]'); s = await H.ser();
  const filled = JSON.stringify(s).includes('"t":"p"'); V.ok(filled, 'pattern fill');
  V.ok(await p.$$eval('.vec-art pattern', a => a.length) >= 1, 'svg pattern def');
  const px = await p.evaluate(async () => { const c = await window.PaintVector.raster(400, 300); return c.width; }); V.ok(px === 400, 'raster with pattern');
  // opacity mask fade
  await H.tool('select'); await H.click(130, 130); await H.tool('transp'); await p.click('[data-va="omfade"]');
  it = await nodes(); const om = it.find(n => n.omask); V.ok(om && om.items.length >= 2, 'fade mask group');
  V.ok(await p.$$eval('.vec-art mask', a => a.length) >= 1, 'svg mask');
  // image trace: place a generated picture
  await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 120; c.height = 80; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 120, 80); x.fillStyle = '#d02020'; x.fillRect(10, 10, 40, 40); x.fillStyle = '#2040d0'; x.beginPath(); x.arc(85, 40, 25, 0, 7); x.fill(); const b = await new Promise(r => c.toBlob(r)); window.PaintVector.addImageFile(new File([b], 'pic.png', { type: 'image/png' })); });
  await p.waitForTimeout(500);
  V.ok(await p.$$eval('[data-va="trace"]', a => a.length) === 1, 'trace button shows');
  await p.click('[data-vk="T.trace.mode"][data-val="colour"]'); await p.$eval('[data-vk="T.trace.n"]', r => { r.value = 3; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('[data-va="trace"]'); await p.waitForTimeout(1200);
  it = await nodes(); const tr = it.find(n => n.name === 'Image Trace');
  V.ok(tr && tr.items.length === 2, 'traced shapes ' + (tr && tr.items.map(q => q.name)));
  const cols = tr ? tr.items.map(q => q.app[0].p.c) : []; V.ok(cols.some(c => /^#d|^#c/.test(c)) && cols.some(c => /^#2|^#1/.test(c)), 'trace colours ' + cols);
  await p.screenshot({ path: 't44.png' });
  // save and load
  s = await H.ser(); await p.evaluate(d => window.PaintVector.load(d), s); const s2 = await H.ser();
  const cs = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((r, q) => (r[q] = v[q], r), {}) : v); const A = cs(s.layers), Bz = cs(s2.layers); let i = 0; while (i < A.length && A[i] === Bz[i]) i++;
  V.ok(A === Bz && cs(s2.pats) === cs(s.pats), 'roundtrip effects ' + (A === Bz ? 'pats' : A.slice(i - 150, i + 80) + ' ||| ' + Bz.slice(i - 150, i + 80)));
  const svg = await p.evaluate(async () => (await window.PaintVector.exportBlob('svg')).text());
  V.ok(/<pattern/.test(svg) && /<mask/.test(svg), 'svg export has pattern and mask');
  V.ok(!H.errs.length, 'no errors ' + H.errs.join('\n'));
  V.done(); await H.b.close();
})();
