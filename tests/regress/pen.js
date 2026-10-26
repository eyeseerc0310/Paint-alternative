const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForFunction(() => !document.querySelector('.app-splash'), null, { timeout: 10000 });
  const cdp = await ctx.newCDPSession(p);
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: q[2] != null ? q[2] : i })) });
  const st = await (await p.$('.paint-stage')).boundingBox(), cx = st.x + st.width / 2, cy = st.y + st.height / 2;
  const ink = (x, y) => p.evaluate(([x, y]) => { const c = document.querySelector('.paint-layers canvas'), w = document.querySelector('.paint-world').getBoundingClientRect(); const d = c.getContext('2d').getImageData(Math.floor((x - w.left) / w.width * c.width), Math.floor((y - w.top) / w.height * c.height), 1, 1).data; return d[0] < 128; }, [x, y]);
  // a synthetic Apple Pencil stroke (pointerType pen, with pressure)
  const pen = (x0, y0, x1, y1, button) => p.evaluate(([x0, y0, x1, y1, button]) => {
    const s = document.querySelector('.paint-stage'), o = (t, x, y, extra) => s.dispatchEvent(new PointerEvent(t, Object.assign({ pointerId: 9, pointerType: 'pen', isPrimary: true, clientX: x, clientY: y, pressure: .6, button: t === 'pointermove' ? -1 : button, buttons: t === 'pointerup' ? 0 : (button === 5 ? 32 : 1), bubbles: true }, extra || {})));
    o('pointerdown', x0, y0); for (let i = 1; i <= 10; i++) o('pointermove', x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); o('pointerup', x1, y1);
  }, [x0, y0, x1, y1, button || 0]);
  // a finger draws before the Pencil is used
  await T('touchStart', [[cx - 20, cy - 100]]); for (let i = 1; i <= 8; i++) await T('touchMove', [[cx - 20 + i * 25, cy - 100]]); await T('touchEnd', []); await p.waitForTimeout(100);
  console.log('finger draws (no Pencil yet):', await ink(cx + 80, cy - 100));
  await pen(cx - 20, cy, cx + 280, cy); await p.waitForTimeout(150);
  console.log('Pencil draws:', await ink(cx + 130, cy), '| toast:', await p.$eval('.paint-toast', e => e.textContent));
  // right after the Pencil, a resting hand doesn't paint or tap
  await T('touchStart', [[cx - 20, cy + 100]]); for (let i = 1; i <= 8; i++) await T('touchMove', [[cx - 20 + i * 25, cy + 100]]); await T('touchEnd', []); await p.waitForTimeout(700);
  // and afterwards one finger still doesn't paint (it's the Pencil's job now)
  await T('touchStart', [[cx - 20, cy + 150]]); for (let i = 1; i <= 8; i++) await T('touchMove', [[cx - 20 + i * 25, cy + 150]]); await T('touchEnd', []); await p.waitForTimeout(100);
  console.log('palm right after Pencil ignored:', !(await ink(cx + 80, cy + 100)), '| one finger later ignored:', !(await ink(cx + 80, cy + 150)));
  // two fingers still zoom
  const v0 = await p.evaluate(() => document.querySelector('.paint-world').style.transform);
  await T('touchStart', [[cx - 50, cy + 200, 0]]); await T('touchStart', [[cx - 50, cy + 200, 0], [cx + 50, cy + 200, 1]]);
  for (let i = 1; i <= 8; i++) await T('touchMove', [[cx - 50 - i * 8, cy + 200, 0], [cx + 50 + i * 8, cy + 200, 1]]); await T('touchEnd', []); await p.waitForTimeout(100);
  console.log('pinch still zooms:', v0 !== await p.evaluate(() => document.querySelector('.paint-world').style.transform));
  await p.keyboard.press('0'); await p.waitForTimeout(100);
  // the Pencil's eraser end rubs out, then the brush is back
  await pen(cx - 20, cy, cx + 280, cy, 5); await p.waitForTimeout(150);
  console.log('eraser end rubs out:', !(await ink(cx + 130, cy)), '| tool after:', await p.evaluate(() => document.querySelector('.paint-stage').dataset.tool));
  // the setting: finger drawing always
  await p.evaluate(() => localStorage.setItem('paint-finger-draw', JSON.stringify('always')));
  await p.reload(); await p.waitForFunction(() => !document.querySelector('.app-splash'), null, { timeout: 10000 });
  await pen(cx - 20, cy + 250, cx + 30, cy + 250); await p.waitForTimeout(700);
  await T('touchStart', [[cx - 20, cy + 200]]); for (let i = 1; i <= 8; i++) await T('touchMove', [[cx - 20 + i * 25, cy + 200]]); await T('touchEnd', []); await p.waitForTimeout(100);
  console.log('"Always": a finger draws after the Pencil too:', await ink(cx + 80, cy + 200));
  // a pinch with Move picked doesn't leave a selection or an undo step
  await p.keyboard.press('v'); await p.waitForTimeout(100); const h0 = await p.$$eval('.ph-list button', l => l.length).catch(() => 0);
  await T('touchStart', [[cx - 50, cy, 0]]); await p.waitForTimeout(20); await T('touchStart', [[cx - 50, cy, 0], [cx + 50, cy, 1]]);
  for (let i = 1; i <= 6; i++) await T('touchMove', [[cx - 50 - i * 6, cy, 0], [cx + 50 + i * 6, cy, 1]]); await T('touchEnd', []); await p.waitForTimeout(100);
  console.log('pinch with Move: redo kept / no Move step', await p.$$eval('.ph-list button', l => l.length).catch(() => 0) === h0);
  console.log('errors', errs); await b.close();
})();
