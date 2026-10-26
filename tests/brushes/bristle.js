// THE BRISTLE BRUSHES (Dry Brush, Flat Bristle, Rough Round): in the list,
// painting with pen pressure, a mouse and dabs, undo and redo, their Studio
// sections, and a QuickShape: sized without long stalls, and laid down the
// same whether it's let go mid-drag or after a rest.
// node bristle.js [light|dark] [width] [height]
const L = require('../lib'), { chromium } = L.use({ swatches: true }), ok = L.ok;
const BRUSHES = ['drybrush', 'flatbristle', 'roughround'];
(async () => {
  const scheme = process.argv[2] || 'light', vw = +(process.argv[3] || 1400), vh = +(process.argv[4] || 900), mob = vw < 600, tag = scheme + '-' + vw;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, colorScheme: scheme, deviceScaleFactor: 2, hasTouch: mob, isMobile: mob });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => { window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ entryTypes: ['longtask'] }); } catch (e) {} });
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(1300);
  const pic = await p.$eval('.paint-layers', e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
  const W = pic[2], H = pic[3];
  const pick = async (id) => { await p.click('[data-ctx="brushes"]'); await p.waitForTimeout(250); await p.click('.ctx-list [data-pick="brush"][data-val="' + id + '"]'); await p.waitForTimeout(150); };
  const size = (v) => p.evaluate(v => { const i = document.querySelector('.paint-bottom input[type="range"]'); i.value = Math.round(1000 * Math.pow((v - 1) / 499, 1 / 2.4)); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  // (a hash of every layer's pixels, and how many are painted)
  const look = () => p.evaluate(() => { let h = 0, n = 0; document.querySelectorAll('.paint-layers canvas').forEach(cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 0; i < d.length; i += 4) { h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 3] * 7) | 0; if (d[i + 3] && d[i] + d[i + 1] + d[i + 2] < 700) n++; } }); return { h, n }; });
  const pstroke = (pts, prs, type) => p.evaluate(async ([pts, prs, type]) => {
    const el = document.querySelector('.paint-stage'), ev = (t, q, pr) => el.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: type, isPrimary: true, clientX: q[0], clientY: q[1], pressure: pr, buttons: t === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true }));
    ev('pointerdown', pts[0], prs[0]);
    for (let i = 1; i < pts.length; i++) { await new Promise(r => setTimeout(r, 8)); ev('pointermove', pts[i], prs[i]); }
    ev('pointerup', pts[pts.length - 1], prs[prs.length - 1]); await new Promise(r => setTimeout(r, 120));
  }, [pts, prs, type]);

  // the list has them
  await p.click('[data-ctx="brushes"]'); await p.waitForTimeout(400);
  const listed = await p.$$eval('.ctx-list [data-pick="brush"]', a => a.map(e => e.dataset.val));
  ok(BRUSHES.every(id => listed.includes(id)), tag + ': the brush list has ' + BRUSHES.join(', '));
  await p.keyboard.press('Escape'); await p.mouse.click(5, vh - 5); await p.waitForTimeout(200);

  // each paints with the pen (pressure light, heavy, light along a wave), a mouse (a loop) and dabs
  for (let k = 0; k < 3; k++) {
    await pick(BRUSHES[k]); await size(mob ? 22 : 34);
    const x0 = pic[0] + W * (0.06 + k * 0.32), x1 = x0 + W * 0.27, N = 70;
    let a = await look();
    await pstroke(Array.from({ length: N + 1 }, (_, i) => [x0 + (x1 - x0) * i / N, pic[1] + H * 0.18 + Math.sin(i / N * Math.PI * 2) * H * 0.06]), Array.from({ length: N + 1 }, (_, i) => 0.08 + 0.92 * Math.sin(i / N * Math.PI)), 'pen');
    let c = await look(); ok(c.n > a.n + 200, tag + ' ' + BRUSHES[k] + ': a pen stroke paints (' + (c.n - a.n) + ' px)'); a = c;
    await pstroke(Array.from({ length: N + 1 }, (_, i) => { const t = i / N * Math.PI * 2.4; return [x0 + W * 0.13 + Math.cos(t) * W * 0.1 + i / N * W * 0.05, pic[1] + H * 0.48 + Math.sin(t) * H * 0.12]; }), Array(N + 1).fill(0.5), 'mouse');
    c = await look(); ok(c.n > a.n + 200, tag + ' ' + BRUSHES[k] + ': a mouse loop paints (' + (c.n - a.n) + ' px)'); a = c;
    for (let d = 0; d < 4; d++) await pstroke([[x0 + d * W * 0.065, pic[1] + H * 0.8]], [0.5], 'mouse');
    c = await look(); ok(c.n > a.n + 20, tag + ' ' + BRUSHES[k] + ': dabs paint (' + (c.n - a.n) + ' px)');
  }
  await p.screenshot({ path: 'bristle-' + tag + '.png' });

  // undo takes the last stroke away, redo brings it back exactly
  const before = await look(); await p.keyboard.press('Control+z'); await p.waitForTimeout(250); const und = await look();
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(250); const red = await look();
  ok(und.h !== before.h, tag + ': undo takes the last stroke away'); ok(red.h === before.h, tag + ': redo brings it back exactly');

  // the Studio shows Pressure for all three, Tapered Ends for Rough Round only
  for (const id of BRUSHES) {
    await pick(id); await p.click('[data-ctx="bstudio"]'); await p.waitForTimeout(500);
    const secs = await p.$$eval('.paint-studio [data-bsec]', a => a.map(s => s.dataset.bsec));
    ok(secs.join() === (id === 'roughround' ? 'pressure,taper' : 'pressure'), tag + ' ' + id + ': studio sections ' + secs.join());
    await p.click('.paint-studio [data-bs-act="done"]'); await p.waitForTimeout(200);
  }

  // a QuickShape: a circle held still snaps, sizing it has no long stalls,
  // and it's laid down the same let go mid-drag or after a rest
  if (!mob) {
    await p.keyboard.press('Control+a').catch(() => {}); await p.keyboard.press('Escape');
    await pick('flatbristle'); await size(60);
    const cx = pic[0] + W / 2, cy = pic[1] + H / 2, R = Math.min(W, H) * 0.3;
    const circle = async (rest) => {
      await p.mouse.move(cx + R, cy); await p.mouse.down();
      for (let i = 1; i <= 80; i++) { const t = i / 80 * Math.PI * 2; await p.mouse.move(cx + Math.cos(t) * R, cy + Math.sin(t) * R); }
      // (it snaps 550ms after the pointer stops, and drawing it can take a while)
      await p.waitForTimeout(1800);
      const snapped = await p.evaluate(() => /keep holding/.test((document.querySelector('.paint-toast') || {}).textContent || ''));
      await p.evaluate(() => { window.__lt = []; });
      for (let i = 1; i <= 20; i++) await p.mouse.move(cx + R + i * 4, cy + i * 2);
      const stall = await p.evaluate(() => Math.max(0, ...window.__lt));
      if (rest) await p.waitForTimeout(400);
      await p.mouse.up(); await p.waitForTimeout(300);
      const l = await look(); await p.keyboard.press('Control+z'); await p.waitForTimeout(250);
      return { snapped, stall, h: l.h };
    };
    const A = await circle(false), B = await circle(true);
    ok(A.snapped && B.snapped, tag + ': a held circle snaps');
    ok(A.stall < 200 && B.stall < 200, tag + ': sizing it, the longest stall is ' + Math.round(Math.max(A.stall, B.stall)) + 'ms (under 200)');
    ok(A.h === B.h, tag + ': let go mid-drag or after a rest, it comes out the same');
  }

  ok(!errs.length, tag + ': no errors ' + (errs.length ? JSON.stringify(errs) : ''));
  L.done(); await b.close();
})();
