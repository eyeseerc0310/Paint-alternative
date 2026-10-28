// Content-Aware Scale on a large picture stays responsive: nothing is
// carved on the page's own thread, so a heartbeat on it never stalls,
// while the frame is dragged, let go of, or Commit is pressed at once
// (before the full size is in: the pill says it's finishing, then it's laid
// down at full quality, the same as waiting first). Three commits one after
// another; a commit by something else (opening Effects) lays the quick look
// down and puts the full size in its place when it comes, exactly; undo
// pressed meanwhile waits for it, then undoes; Esc while Commit waits puts
// it all back; a worker that fails once is asked again, one that fails
// twice puts everything back. Never more than two workers at once. Run as:
// node casbig.js light|dark width height [touch] [huge (4000 x 3000)]
const L = require('../lib');
const { chromium } = L.use({});
const [theme, VW, VH] = [process.argv[2] || 'light', +(process.argv[3] || 1400), +(process.argv[4] || 900)];
const touch = process.argv.includes('touch');
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
const huge = process.argv.includes('huge'), [PW, PH] = huge ? [4000, 3000] : [2400, 1600];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, hasTouch: touch, colorScheme: theme });
  // (workers counted, and made to fail on demand: window.__casBreak jobs fail)
  await ctx.addInitScript(() => {
    // (only Content-Aware Scale's: the ones handed its pixels; Effects has a worker of its own)
    const W0 = window.Worker, cas = new Set(); window.__most = 0; window.__casBreak = 0;
    window.Worker = function (u) {
      const w = new W0(u);
      const tm = w.terminate.bind(w); w.terminate = () => { cas.delete(w); tm(); };
      const pm = w.postMessage.bind(w);
      w.postMessage = (m, t) => {
        if (m && m.t === 'src' && 'sid' in m) { cas.add(w); window.__most = Math.max(window.__most, cas.size); }
        if (m && !m.t && window.__casBreak > 0) { window.__casBreak--; setTimeout(() => w.onerror && w.onerror({ preventDefault() {} }), 30); return; }
        pm(m, t);
      };
      return w;
    };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(800);
  await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
  const cdp = touch ? await ctx.newCDPSession(p) : null;
  const tch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const tapAt = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
  const tapEl = async s => { const e = await p.$(s); await e.evaluate(el => el.scrollIntoView({ block: 'center' })); await p.waitForTimeout(50); const r = await e.boundingBox(); await tapAt(r.x + r.width / 2, r.y + r.height / 2); await p.waitForTimeout(120); };
  const drag = async (x0, y0, x1, y1) => {
    if (touch) { await tch('touchStart', x0, y0); for (let i = 1; i <= 10; i++) { await tch('touchMove', x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); await p.waitForTimeout(16); } await tch('touchEnd'); }
    else { await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, { steps: 10 }); await p.mouse.up(); }
  };
  // (the page's thread: a beat every 16 ms, the longest gap between beats)
  const beatOn = () => p.evaluate(() => { window.__gap = 0; let t = performance.now(); clearInterval(window.__beat); window.__beat = setInterval(() => { const n = performance.now(); window.__gap = Math.max(window.__gap, n - t); t = n; }, 16); });
  const gap = () => p.evaluate(() => Math.round(window.__gap));
  const layer = (fn, arg) => p.evaluate(([f, a]) => { const cs = [...document.querySelectorAll('.paint-layers canvas')], c = window.__pic || cs[cs.length - 1]; return new Function('c', 'a', f)(c, a); }, [fn, arg]);
  const sum = () => layer(`const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s = (s * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11) % 1000000007; return s;`);
  const redW = () => layer(`const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data; let best = 0;
    for (let y = 0; y < H; y += 8) { let n = 0; for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (d[i + 3] > 10 && d[i] > 190 && d[i + 1] < 90) n++; } best = Math.max(best, n); } return best;`);
  const selOn = () => p.evaluate(() => { const t = document.querySelector('.selection-toolbar'); return !!t && !t.closest('[hidden]') && getComputedStyle(t).display !== 'none'; });
  const pill = () => p.$eval('.paint-casmode', e => ({ shown: !e.hidden && getComputedStyle(e).display !== 'none', busy: !!e.dataset.busy, text: e.textContent }));
  const idle = () => p.waitForFunction(() => { const e = document.querySelector('.paint-casmode'); return !e.dataset.busy; }, null, { timeout: 60000, polling: 50 });
  const casOn = async () => {
    if (await p.$eval('.paint-adjust', a => a.hidden)) await tapEl('[data-act="adjust"]');
    await p.waitForSelector('.fx-sec[data-fx="cas"]', { state: 'visible' });
    for (let i = 0; i < 3 && await p.$eval('.fx-sec[data-fx="cas"]', s => s.classList.contains('closed')); i++) { await p.$eval('.fx-sec[data-fx="cas"] .pr-head', h => h.click()); await p.waitForTimeout(200); }
    await p.waitForSelector('[data-fx-cas]', { state: 'visible' }); await tapEl('[data-fx-cas]'); await p.waitForTimeout(250);
  };

  // a large picture: a red circle and a blue square on a grainy sky
  const png = await p.evaluate(([w, h]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6aa5d8'); g.addColorStop(1, '#b0a0d8'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const im = x.getImageData(0, 0, w, h), d = im.data; let s = 9; for (let i = 0; i < d.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = (s % 21) - 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(im, 0, 0);
    x.fillStyle = '#e02828'; x.beginPath(); x.arc(w * .28, h * .5, h * .2, 0, 7); x.fill(); x.fillStyle = '#1a1aa8'; x.fillRect(w * .62, h * .3, h * .3, h * .3);
    return c.toDataURL('image/png').split(',')[1]; }, [PW, PH]);
  // (a new picture that size first, so it comes in at its own size)
  await p.keyboard.press('n'); await p.waitForTimeout(400);
  await p.fill('[data-ns="w"]', String(PW)); await p.fill('[data-ns="h"]', String(PH)); await p.$eval('[data-ns-act="create"]', e => e.click()); await p.waitForTimeout(800);
  await p.setInputFiles('.paint-open input', { name: 'big.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }); await p.waitForTimeout(1500);
  await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  await p.evaluate(() => { const cs = [...document.querySelectorAll('.paint-layers canvas')]; window.__pic = cs[cs.length - 1]; });
  const cw = await layer('return [c.width, c.height];');
  L.ok(cw[0] >= PW, 'a large picture: ' + cw.join('x'));
  const s0 = await sum(), red0 = await redW();
  const wr = await p.$eval('.paint-world', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const sx0 = wr.x + wr.w * 0.08, sy0 = wr.y + wr.h * 0.1, sx1 = wr.x + wr.w * 0.9, sy1 = wr.y + wr.h * 0.9, my = (sy0 + sy1) / 2, dx = (sx1 - sx0) * 0.3;
  const boxSel = async () => { await p.keyboard.press('m'); await p.waitForTimeout(100); await p.mouse.move(sx0, sy0); await p.mouse.down(); await p.mouse.move(sx1, sy1, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(250); };
  // (back to the picture as it came, nothing selected)
  const fresh = async () => {
    for (let i = 0; i < 14 && (await sum()) !== s0; i++) { await p.keyboard.press(MOD + '+z'); await p.waitForTimeout(300); await idle(); }
    if (await selOn()) { await p.keyboard.press('Escape'); await p.waitForTimeout(200); }
    if (await selOn()) { await tapEl('.selection-commit'); await idle(); }
    return (await sum()) === s0;
  };

  // ---- COMMIT AT ONCE, three times over: never a stall ----
  let first = null;
  for (let round = 1; round <= 3; round++) {
    await boxSel(); await casOn();
    L.ok((await pill()).shown && await selOn(), round + ': the mode is on');
    await beatOn();
    await drag(sx1, my, sx1 - dx - round * 4, my);
    await p.keyboard.press('Enter'); await p.waitForTimeout(60);
    const pl = await pill(), stillOn = await selOn();
    L.ok(pl.busy && /Finishing/.test(pl.text) && stillOn, round + ': Return before the full size is in: the pill says it’s finishing, the selection waits (' + pl.text + ')');
    await idle(); await p.waitForTimeout(150);
    const g = await gap();
    L.ok(!(await selOn()) && !(await pill()).shown, round + ': then it’s laid down and the mode ends');
    L.ok(g < 300, round + ': the page never stalled (longest gap ' + g + ' ms)');
    const rw = await redW();
    L.ok(rw >= red0 * (huge ? 0.9 : 0.95), round + ': at full quality, the circle as wide (' + red0 + ' → ' + rw + ')');
    if (round === 1) first = await sum();
    L.ok(await fresh(), round + ': undo brings the picture back exactly');
  }

  // ---- WAITING FIRST GIVES THE SAME ----
  await boxSel(); await casOn();
  await drag(sx1, my, sx1 - dx - 4, my); await idle();
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  L.ok((await sum()) === first, 'waiting for the full size and then committing gives exactly the same');
  L.ok(await fresh(), 'and undo brings the picture back');

  // ---- LAID DOWN BY SOMETHING ELSE: the quick look, then the full size in its place ----
  // (a new layer from Layers lays the selection down first)
  const addLayer = () => p.evaluate(() => { const b = document.querySelector('[data-layer-act="add"]'); if (b) b.click(); return !!b; });
  if (!(await p.$('[data-layer-act="add"]'))) await tapEl('.pl-layersbtn');
  await boxSel(); await casOn();
  await beatOn();
  await drag(sx1, my, sx1 - dx - 4, my);
  L.ok(await addLayer(), 'Layers’ add button is there');
  await p.waitForTimeout(60);
  const pl2 = await pill(), g2a = await gap(), mid2 = await sum(); // (the gap read first: the sum's own work isn't the app's)
  await beatOn();
  L.ok(!(await selOn()) && pl2.shown && /Finishing/.test(pl2.text), 'a new layer lays it down at once, the pill finishing it (' + pl2.text + ')');
  L.ok(mid2 !== s0 && mid2 !== first, 'what’s laid down meanwhile is the quick look');
  await idle(); await p.waitForTimeout(200);
  L.ok((await sum()) === first, 'and then the full size takes its place, exactly as a Commit would have');
  const g2 = Math.max(g2a, await gap());
  L.ok(g2 < 300, 'the page never stalled (' + g2 + ' ms)');
  L.ok(await fresh(), 'undo brings the picture back');

  // ---- UNDO WHILE IT'S FINISHING: it waits, then undoes ----
  await boxSel(); await casOn();
  await drag(sx1, my, sx1 - dx - 4, my);
  await addLayer(); await p.waitForTimeout(40);
  await p.keyboard.press(MOD + '+z'); await p.waitForTimeout(40);
  L.ok((await pill()).shown, 'undo pressed while it finishes waits for it');
  await idle(); await p.waitForTimeout(400);
  L.ok((await p.$$('.paint-layers canvas')).length >= 2 && (await sum()) === first, 'then undoes the step after it (the new layer), the full size in place');
  L.ok(await fresh(), 'and the picture comes back exactly');

  // ---- ESC WHILE COMMIT WAITS ----
  await boxSel(); await casOn();
  await drag(sx1, my, sx1 - dx - 8, my);
  await p.keyboard.press('Enter'); await p.waitForTimeout(40);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  L.ok(!(await pill()).shown && await selOn(), 'Esc while Commit waits: the mode ends, the selection stays');
  L.ok((await sum()) === s0, 'and the picture is exactly as it was');
  await p.waitForTimeout(500);
  L.ok((await sum()) === s0, 'and stays so when the worker would have answered');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);

  // ---- A WORKER THAT FAILS ----
  await boxSel(); await casOn();
  await p.evaluate(() => { window.__casBreak = 1; });
  await drag(sx1, my, sx1 - dx - 4, my); await idle();
  await p.keyboard.press('Enter'); await p.waitForTimeout(300); await idle();
  L.ok(!(await selOn()) && (await sum()) === first, 'a worker that fails once is asked again, and the result is the same');
  L.ok(await fresh(), 'undo brings the picture back');
  await boxSel(); await casOn();
  await p.evaluate(() => { window.__casBreak = 99; });
  await drag(sx1, my, sx1 - dx - 4, my);
  await p.waitForFunction(() => document.querySelector('.paint-casmode').hidden, null, { timeout: 20000 }).catch(() => {});
  L.ok(!(await pill()).shown && await selOn() && (await sum()) === s0, 'one that keeps failing puts everything back as it was, the selection kept');
  await p.evaluate(() => { window.__casBreak = 0; });
  L.ok(await p.evaluate(() => /couldn’t/.test(document.body.textContent)), 'and says so');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // and it works again after that
  await boxSel(); await casOn();
  await drag(sx1, my, sx1 - dx - 4, my);
  await p.keyboard.press('Enter'); await idle(); await p.waitForTimeout(200);
  L.ok((await sum()) === first, 'after that it works again as before');
  const nw = await p.evaluate(() => window.__most);
  L.ok(nw <= 2, 'never more than two workers at once (' + nw + ')');
  L.ok(!errs.length, 'no errors ' + JSON.stringify(errs));
  await b.close();
  L.done();
})().catch(e => { console.log('FAIL', e.stack); process.exit(1); });
