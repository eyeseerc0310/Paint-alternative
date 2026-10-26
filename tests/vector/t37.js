// stage 3 on a phone (touch): text, blob brush, free transform's handle, shape builder; the strip
const { setup, ok, done } = require('./vt.js'); const G = require('./geo.js');
(async () => {
  const H = await setup({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); const p = H.p;
  await H.vector();
  const cdp = await H.ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: i + 1 })) });
  const tdrag = async (a, b, n = 8) => { const A = await H.at(...a), Bq = await H.at(...b); await touch('touchStart', [A]); for (let i = 1; i <= n; i++) { await touch('touchMove', [[A[0] + (Bq[0] - A[0]) * i / n, A[1] + (Bq[1] - A[1]) * i / n]]); await p.waitForTimeout(16); } await touch('touchEnd', []); await p.waitForTimeout(120); };
  const ttap = async (x, y) => { const A = await H.at(x, y); await touch('touchStart', [A]); await touch('touchEnd', []); await p.waitForTimeout(120); };
  const tcat = async (t) => { await H.tool(t); await p.waitForTimeout(60); };
  // (zoomed in on the bottom of the artboard, below the strip)
  await p.evaluate(() => { const s = document.querySelector('.vec-stage'), r = s.getBoundingClientRect(); s.dispatchEvent(new WheelEvent('wheel', { deltaY: -60, ctrlKey: true, clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.75, bubbles: true, cancelable: true })); });
  await p.waitForTimeout(100);
  const stripB = await p.evaluate(() => document.querySelector('.paint-ctx').getBoundingClientRect().bottom);
  const docAt = (sx, sy) => p.evaluate(([sx, sy]) => { const w = document.querySelector('.vec-world'), m = new DOMMatrix(getComputedStyle(w).transform).inverse(), r = document.querySelector('.vec-stage').getBoundingClientRect(), q = m.transformPoint(new DOMPoint(sx - r.left, sy - r.top)); return [q.x, q.y]; }, [sx, sy]);
  const Y0 = 400;
  // text with a finger: the typing box takes the focus
  await tcat('text'); const t0 = await docAt(150, Y0); await ttap(...t0);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('vec-textin')), 'touch: a tap with Text focuses the typing box');
  await p.keyboard.type('Touch'); await p.keyboard.press('Escape');
  ok((await H.leaves())[0].txt === 'Touch', 'touch: typed');
  await p.screenshot({ path: 'phone-type.png' });
  // blob with a finger
  await tcat('blob'); const b1 = await docAt(140, Y0 + 120), b2 = await docAt(340, Y0 + 130), b3 = await docAt(240, Y0 + 60), b4 = await docAt(250, Y0 + 220); await tdrag(b1, b2); await tdrag(b3, b4);
  let L = await H.leaves(); ok(L.filter(n => n.name === 'Blob').length === 1, 'touch: blob strokes merge');
  // shapes then free transform turn
  await tcat('rect'); const r1 = await docAt(160, Y0 + 260), r2 = await docAt(300, Y0 + 330); await tdrag(r1, r2); const rw = r2[0] - r1[0], rh = r2[1] - r1[1], rc = [(r1[0] + r2[0]) / 2, (r1[1] + r2[1]) / 2];
  await tcat('ftrans'); const kn = await p.$eval('.vs-knob', c => [+c.getAttribute('cx'), +c.getAttribute('cy')]);
  const sr = await p.$eval('.vec-stage', s => { const r = s.getBoundingClientRect(); return [r.left, r.top]; });
  const C = await H.at(...rc); await touch('touchStart', [[sr[0] + kn[0], sr[1] + kn[1]]]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [[sr[0] + kn[0] + (C[0] + 120 - sr[0] - kn[0]) * i / 8, sr[1] + kn[1] + (C[1] - sr[1] - kn[1]) * i / 8]]); await p.waitForTimeout(16); }
  await touch('touchEnd', []); await p.waitForTimeout(120);
  L = await H.leaves(); const r = L.filter(n => n.name === 'Rectangle')[0], b = G.bbox(r.d);
  ok(Math.abs(b.w - rh) < rh * 0.05 && Math.abs(b.h - rw) < rw * 0.05, 'touch: the round handle turns it ' + b.w.toFixed(0) + '×' + b.h.toFixed(0));
  await p.screenshot({ path: 'phone-ftrans.png' });
  // the panel strip: every new category opens in it without errors
  for (const c of ['drawing', 'shapeops', 'transform', 'type', 'arrange']) { await p.click('[data-vcat="' + c + '"]'); await p.waitForTimeout(100); await p.screenshot({ path: 'phone-' + c + '.png' }); }
  const over = await p.evaluate(() => { const c = document.querySelector('.paint-ctx'), r = c.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1; });
  ok(over, 'the strip stays on the screen');
  ok(!H.errs.length, 'no errors ' + H.errs.slice(0, 3).join(' | '));
  done(); await H.b.close();
})();
