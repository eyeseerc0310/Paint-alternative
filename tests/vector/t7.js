const L = require('../lib'), { chromium } = L.use({ showSwitch: true });
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: i + 1 })) });
  const wait = t => p.waitForTimeout(t);
  // paint a stroke with a finger (waits touchWait)
  const wr = await p.$eval('.paint-world', e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  await touch('touchStart', [[wr[0] + 100, wr[1] + 100]]); await wait(200);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [[wr[0] + 100 + i * 30, wr[1] + 100 + i * 15]]); await wait(16); }
  await touch('touchEnd', []); await wait(300);
  await p.tap('[data-mode="vector"]'); await wait(400); await p.tap('[data-vm="bring"]'); await wait(800);
  const ser = async () => JSON.parse(await p.evaluate(() => JSON.stringify(window.PaintVector.serialize())));
  let s = await ser(); const k0 = s.view.k;
  // tap empty board area? the picture covers the artboard. Tap outside board to deselect
  const st = await p.$eval('.vec-stage', e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  await touch('touchStart', [[st[0] + 8, st[1] + st[3] - 8]]); await touch('touchEnd', []); await wait(200);
  ok((await ser()).sel.length === 0, 'tap outside the artboard: nothing picked');
  const im = await p.$eval('.vec-art use', e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  const cx = im[0] + im[2] / 2, cy = im[1] + im[3] / 2;
  await touch('touchStart', [[cx, cy]]); await touch('touchEnd', []); await wait(200);
  ok((await ser()).sel.length === 1, 'tap picks the picture');
  await touch('touchStart', [[cx, cy]]); for (let i = 1; i <= 6; i++) { await touch('touchMove', [[cx + i * 10, cy + i * 5]]); await wait(16); } await touch('touchEnd', []); await wait(200);
  s = await ser(); const o = s.layers[1].items[0];
  ok(Math.abs(o.x - 60 / k0) < 3 && Math.abs(o.y - 30 / k0) < 3, 'finger drag moves it (' + o.x.toFixed(1) + ',' + o.y.toFixed(1) + ')');
  // pinch zoom
  await touch('touchStart', [[cx - 50, cy], [cx + 50, cy]]); await wait(30);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [[cx - 50 - i * 10, cy], [cx + 50 + i * 10, cy]]); await wait(16); }
  await touch('touchEnd', []); await wait(200);
  s = await ser();
  ok(Math.abs(s.view.k / k0 - 220 / 100) < 0.05, 'pinch zooms (x' + (s.view.k / k0).toFixed(2) + ')');
  ok(Math.abs(s.layers[1].items[0].x - o.x) < 0.01, 'the pinch didn’t move the picture');
  ok((await p.$eval('.paint-zoom-val', e => e.textContent)) === Math.round(s.view.k / k0 * 100) + '%', 'zoom shows ' + (await p.$eval('.paint-zoom-val', e => e.textContent)));
  // two-finger tap: undo (the move)
  await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]]); await wait(60); await touch('touchEnd', []); await wait(250);
  s = await ser();
  ok(Math.abs(s.layers[1].items[0].x) < 0.01, 'two-finger tap undoes the move');
  await touch('touchStart', [[cx - 40, cy], [cx, cy], [cx + 40, cy]]); await wait(60); await touch('touchEnd', []); await wait(250);
  s = await ser();
  ok(Math.abs(s.layers[1].items[0].x - o.x) < 0.01, 'three-finger tap redoes it');
  // Fit button
  await p.tap('.paint-zoom-val'); await wait(200);
  ok((await p.$eval('.paint-zoom-val', e => e.textContent)) === '100%', 'Fit from the zoom');
  // paint still has its stroke & tool
  await p.tap('[data-mode="paint"]'); await wait(300); await p.tap('[data-vm="switch"]'); await wait(400);
  const n = await p.$$eval('.paint-layers canvas', l => l.length);
  ok(n === 1, 'paint has its one layer still');
  console.log('errors', errs); console.log(fails ? fails + ' FAILED' : 'ALL OK');
  await b.close();
})();
