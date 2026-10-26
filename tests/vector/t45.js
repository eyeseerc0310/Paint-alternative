const V = require('./vt.js');
(async () => {
  const H = await V.setup({ viewport: { width: 1180, height: 820 }, hasTouch: true }), p = H.p, ok = V.ok;
  await H.vector();
  const cdp = await H.ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: i + 1 })) });
  const tdrag = async (a, b, n = 10) => { const A = await H.at(...a), Bq = await H.at(...b); await touch('touchStart', [A]); for (let i = 1; i <= n; i++) await touch('touchMove', [[A[0] + (Bq[0] - A[0]) * i / n, A[1] + (Bq[1] - A[1]) * i / n]]); await touch('touchEnd', []); await p.waitForTimeout(100); };
  const ttap = async (x, y) => { const A = await H.at(x, y); await touch('touchStart', [A]); await touch('touchEnd', []); await p.waitForTimeout(450); };
  await H.tool('rect'); await tdrag([100, 100], [200, 200]); await H.tool('ellipse'); await tdrag([400, 300], [500, 400]);
  // blend by two taps
  await H.tool('vblend'); await ttap(100, 150); await ttap(400, 350);
  let it = (await H.ser()).layers[0].items; ok(it.length === 1 && it[0].blnd, 'finger taps blend');
  // guides tool tap
  await H.tool('guides'); await ttap(300, 500); let s = await H.ser(); ok(s.guides.length === 1, 'finger tap guide');
  // artboard: drag the board by finger
  await H.tool('artboard'); const b0 = s.boards[0]; await tdrag([600, 600], [640, 630]); s = await H.ser();
  ok(Math.abs(s.boards[0].x - b0.x - 40) < 2 && Math.abs(s.boards[0].y - b0.y - 30) < 2, 'finger moves board ' + s.boards[0].x + ',' + s.boards[0].y);
  await p.keyboard.press('Control+z');
  // board handle by finger (se corner, within the touch radius)
  await tdrag([b0.w - 3, b0.h - 3], [b0.w - 103, b0.h - 53]); s = await H.ser();
  ok(Math.abs(s.boards[0].w - (b0.w - 100)) < 5, 'finger sizes board ' + s.boards[0].w);
  // envelope mesh by finger
  await H.tool('select'); await ttap(300, 250); await H.tool('envelope'); await p.click('[data-va="envmesh"]');
  it = (await H.ser()).layers[0].items; const g = it[0]; const bx = await p.evaluate(() => 0);
  ok(g.efx && g.efx.k === 'env', 'envelope on blend');
  ok(!H.errs.length, 'no errors ' + H.errs.join('\n'));
  V.done(); await H.b.close();
})();
