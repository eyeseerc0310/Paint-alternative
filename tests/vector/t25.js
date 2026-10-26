const V = require('./vt.js'), D = '';
(async () => {
  const H = await V.setup({ viewport: { width: 1024, height: 768 }, hasTouch: true }), p = H.p, ok = V.ok;
  await H.vector();
  const cdp = await H.ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: i + 1 })) });
  const tdrag = async (a, b, n = 8) => { const A = await H.at(...a), Bq = await H.at(...b); await touch('touchStart', [A]); for (let i = 1; i <= n; i++) await touch('touchMove', [[A[0] + (Bq[0] - A[0]) * i / n, A[1] + (Bq[1] - A[1]) * i / n]]); await touch('touchEnd', []); await p.waitForTimeout(80); };
  const ttap = async (x, y) => { const A = await H.at(x, y); await touch('touchStart', [A]); await touch('touchEnd', []); await p.waitForTimeout(80); };
  // every tool: its panel builds, without errors
  const tools = await p.evaluate(() => Array.from(document.querySelectorAll('[data-vcat]')).map(b => b.dataset.vcat));
  let all = 0, empty = [];
  for (const c of tools) { await p.click('[data-vcat="' + c + '"]'); await p.waitForTimeout(60); const ts = await p.$$eval('[data-vtool]', l => l.map(b => b.dataset.vtool)); for (const t of ts) { if (t === 'abdup') { all++; continue; } await p.click('[data-vtool="' + t + '"]'); await p.waitForTimeout(40); all++; const h = await p.$eval('.vec-set', e => e.innerHTML.length).catch(() => 0); if (!h && !['fit', 'actual'].includes(t)) empty.push(t); } }
  ok(all === 99 && !empty.length && !H.errs.length, 'all ' + all + ' tools open their settings' + (empty.length ? ' (empty: ' + empty + ')' : ''));
  // (the precision switches the loop turned on, off again)
  for (const [t, k] of [['smartg', 'smart'], ['grid', 'grid'], ['snapgrid', 'snapGrid'], ['snappts', 'snapPts'], ['snapobj', 'snapObj'], ['rulers', 'rulers']]) { await H.tool(t); const c = await p.$('[data-vk="T.prec.' + k + '"][aria-pressed="true"]'); if (c) await c.click(); }
  await p.keyboard.press('0'); await p.waitForTimeout(80);
  // touch: a rectangle by finger, a pen path by taps
  await H.tool('rect'); await tdrag([100, 100], [300, 250]);
  let L = await H.leaves(); ok(L.length === 1 && Math.round(L[0].live.w) === 200, 'a finger draws a rectangle');
  await H.tool('pen'); await ttap(400, 100); await ttap(500, 200); await ttap(400, 250); await ttap(400, 100);
  L = await H.leaves(); ok(L.length === 2 && L[1].d[0].closed && L[1].d[0].pts.length === 3, 'taps with the Pen: a closed path');
  // a second finger calls off what the first began
  await H.tool('ellipse');
  const A = await H.at(600, 300), B2 = await H.at(700, 400);
  await touch('touchStart', [A]); await touch('touchMove', [[A[0] + 30, A[1] + 30]]); await touch('touchMove', [[A[0] + 60, A[1] + 60]]); await p.waitForTimeout(30);
  await touch('touchStart', [[A[0] + 60, A[1] + 60], B2]); await touch('touchMove', [[A[0] + 50, A[1] + 50], [B2[0] + 40, B2[1] + 40]]); await touch('touchEnd', []); await p.waitForTimeout(120);
  L = await H.leaves(); ok(L.length === 2, 'two fingers: the half-drawn ellipse is called off');
  // pinch and twist
  const s0 = (await H.ser()).view;
  const C = [512, 380];
  await touch('touchStart', [[C[0] - 60, C[1]], [C[0] + 60, C[1]]]); await p.waitForTimeout(20);
  for (let i = 1; i <= 8; i++) { const a = i / 8 * 0.4, r = 60 + i * 8; await touch('touchMove', [[C[0] - Math.cos(a) * r, C[1] - Math.sin(a) * r], [C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r]]); await p.waitForTimeout(16); }
  await touch('touchEnd', []); await p.waitForTimeout(120);
  const s1 = (await H.ser()).view;
  ok(s1.k > s0.k * 1.5 && Math.abs(s1.r - 0.4) < 0.05, 'pinch zooms and twist turns (x' + (s1.k / s0.k).toFixed(2) + ', ' + (s1.r * 180 / Math.PI).toFixed(1) + '°)');
  await p.keyboard.press('0'); await p.waitForTimeout(80);
  // keys
  await p.keyboard.press('m'); ok(await p.$eval('[data-vtool="rect"]', e => e.getAttribute('aria-pressed')) === 'true', 'M: Rectangle');
  await p.keyboard.press('p'); ok(await p.$eval('[data-vtool="pen"]', e => e.getAttribute('aria-pressed')) === 'true', 'P: Pen');
  await p.keyboard.press('Shift+W'); ok(await p.$eval('[data-vtool="vwidth"]', e => e.getAttribute('aria-pressed')) === 'true', 'Shift W: Variable Width');
  await p.keyboard.press('v'); await H.click(200, 175);
  await p.keyboard.press('Control+d'); await p.waitForTimeout(80); ok((await H.leaves()).length === 3, 'Ctrl D duplicates');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('Shift+ArrowDown'); await p.waitForTimeout(80);
  let sid = (await H.ser()).sel[0]; L = await H.leaves(); let dn = L.find(n => n.id === sid); ok(Math.round(dn.live.x) === 111 && Math.round(dn.live.y) === 120, 'arrows nudge (' + dn.live.x + ',' + dn.live.y + ')');
  await p.keyboard.press('Control+c'); await p.keyboard.press('Control+v'); await p.waitForTimeout(300);
  ok((await H.leaves()).length === 4, 'Ctrl C, Ctrl V: a copy');
  sid = (await H.ser()).sel[0];
  await p.keyboard.press('x'); await p.waitForTimeout(80); L = await H.leaves(); dn = L.find(n => n.id === sid);
  ok(dn.app.find(i => i.k === 'f').p.c === '#1d1d1f', 'X swaps fill and stroke');
  await p.keyboard.press('d'); await p.waitForTimeout(80); L = await H.leaves(); dn = L.find(n => n.id === sid);
  ok(dn.app.find(i => i.k === 'f').p.c === '#ffffff', 'D: default fill and stroke');
  await p.keyboard.press('Control+]'); await p.waitForTimeout(80);
  console.log('errors', H.errs); V.done(); await H.b.close();
})();
