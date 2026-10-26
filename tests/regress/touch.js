const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: false }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(700);
  const cdp = await ctx.newCDPSession(p);
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: q[2] != null ? q[2] : i })) });
  const st = await (await p.$('.paint-stage')).boundingBox(), cx = st.x + st.width / 2, cy = st.y + st.height / 2;
  const view = () => p.evaluate(() => document.querySelector('.paint-world').style.transform);
  const count = () => p.$$eval('.paint-history-list li, [data-hist]', l => l.length).catch(() => -1);
  const undoOn = () => p.$eval('[data-act="undo"]', e => !e.disabled), redoOn = () => p.$eval('[data-act="redo"]', e => !e.disabled);
  // draw two strokes with one finger
  for (const y of [-80, 0]) { await T('touchStart', [[cx - 150, cy + y]]); for (let i = 1; i <= 10; i++) await T('touchMove', [[cx - 150 + i * 25, cy + y]]); await T('touchEnd', []); await p.waitForTimeout(80); }
  const ink = (dy) => p.evaluate(([dy]) => { const c = document.querySelector('.paint-layers canvas'), w = document.querySelector('.paint-world').getBoundingClientRect(); const st = document.querySelector('.paint-stage').getBoundingClientRect(); const fx = (st.left + st.width / 2 - w.left) / w.width, fy = (st.top + st.height / 2 + dy - w.top) / w.height; return c.getContext('2d').getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data[0] < 100; }, [dy]);
  console.log('two strokes drawn:', await ink(-80), await ink(0));
  // two-finger tap: undo the second stroke
  await T('touchStart', [[cx - 40, cy + 150, 0]]); await T('touchStart', [[cx - 40, cy + 150, 0], [cx + 40, cy + 150, 1]]); await p.waitForTimeout(60); await T('touchEnd', [[cx + 40, cy + 150, 1]]); await T('touchEnd', []);
  await p.waitForTimeout(150);
  console.log('after 2-finger tap: stroke 2 gone', !(await ink(0)), '| stroke 1 kept', await ink(-80), '| redo available', await redoOn(), '| toast', await p.$eval('.paint-toast', e => e.textContent).catch(() => '?'));
  // three-finger tap: redo
  await T('touchStart', [[cx - 60, cy + 150, 0]]); await T('touchStart', [[cx - 60, cy + 150, 0], [cx, cy + 150, 1]]); await T('touchStart', [[cx - 60, cy + 150, 0], [cx, cy + 150, 1], [cx + 60, cy + 150, 2]]);
  await p.waitForTimeout(60); await T('touchEnd', []); await p.waitForTimeout(150);
  console.log('after 3-finger tap: stroke 2 back', await ink(0));
  // a two-finger pinch that moves doesn't undo
  const before = await undoOn();
  await T('touchStart', [[cx - 50, cy, 0]]); await T('touchStart', [[cx - 50, cy, 0], [cx + 50, cy, 1]]);
  for (let i = 1; i <= 10; i++) await T('touchMove', [[cx - 50 - i * 6, cy, 0], [cx + 50 + i * 6, cy, 1]]);
  await T('touchEnd', []); await p.waitForTimeout(100);
  console.log('pinch zoomed:', await view(), '| stroke 2 still there', await ink(0));
  // twist: rotate about 45 degrees
  const r = 120; await T('touchStart', [[cx - r, cy, 0]]); await T('touchStart', [[cx - r, cy, 0], [cx + r, cy, 1]]);
  for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI / 4; await T('touchMove', [[cx - r * Math.cos(a), cy - r * Math.sin(a), 0], [cx + r * Math.cos(a), cy + r * Math.sin(a), 1]]); }
  await T('touchEnd', []); await p.waitForTimeout(100);
  console.log('twisted:', await view());
  await p.screenshot({ path: 'out/rotated.png' });
  // draw while rotated: a one-finger stroke lands under the finger
  await T('touchStart', [[cx + 100, cy + 120]]); for (let i = 1; i <= 6; i++) await T('touchMove', [[cx + 100 + i * 4, cy + 120]]); await T('touchEnd', []);
  await p.waitForTimeout(100);
  const under = await p.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); const c = document.querySelector('.paint-layers canvas'); const w = document.querySelector('.paint-world'); const m = new DOMMatrix(getComputedStyle(w).transform).inverse(); const sr = document.querySelector('.paint-stage').getBoundingClientRect(); const pt = m.transformPoint(new DOMPoint(x - sr.left, y - sr.top)); const R = c.width / parseFloat(c.style.width); return c.getContext('2d').getImageData(Math.floor(pt.x * R), Math.floor(pt.y * R), 1, 1).data[0] < 100; }, [cx + 112, cy + 120]);
  console.log('stroke while rotated lands under finger:', under);
  // nearly upright snaps back to upright
  await T('touchStart', [[cx - r, cy, 0]]); await T('touchStart', [[cx - r, cy, 0], [cx + r, cy, 1]]);
  for (let i = 1; i <= 12; i++) { const a = -i / 12 * (Math.PI / 4 - 0.03); await T('touchMove', [[cx - r * Math.cos(a), cy - r * Math.sin(a), 0], [cx + r * Math.cos(a), cy + r * Math.sin(a), 1]]); }
  await T('touchEnd', []); await p.waitForTimeout(100);
  console.log('twisted back near upright -> snaps:', await view());
  // fill with a finger, then two-finger tap: undo removes the fill only once
  await p.click('[data-tool="fill"]'); await p.click('.paint-swatches button:nth-child(4)');
  await T('touchStart', [[cx + 200, cy - 200]]); await T('touchEnd', []); await p.waitForTimeout(100);
  const filled = await p.evaluate(() => { const c = document.querySelector('.paint-layers canvas'); return Array.from(c.getContext('2d').getImageData(5, 5, 1, 1).data).slice(0, 3).join(','); });
  await T('touchStart', [[cx + 200, cy - 200, 0]]); await T('touchStart', [[cx + 200, cy - 200, 0], [cx + 260, cy - 200, 1]]); await p.waitForTimeout(50); await T('touchEnd', []); await p.waitForTimeout(150);
  const after = await p.evaluate(() => { const c = document.querySelector('.paint-layers canvas'); return Array.from(c.getContext('2d').getImageData(5, 5, 1, 1).data).slice(0, 3).join(','); });
  console.log('finger fill:', filled, '-> two-finger tap undoes it:', after, '| strokes kept', await ink(0));
  // zoom "fit" puts the picture upright
  await p.click('.paint-zoom-val'); console.log('fit resets turn:', await view());
  console.log('errors', errs); await b.close();
})();
