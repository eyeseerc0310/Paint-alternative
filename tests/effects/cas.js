// Content-Aware Scale, in Effects: greyed out without a selection; with
// one, a live look while the slider moves and the full size once it's let
// go of, only inside the selection, by seam carving (the red circle and the
// blue square keep their width while the background gives way); 100% puts
// the pixels back exactly; Done is one step for undo and redo; quick changes
// end on the last one asked for. And the selection stays, outline and all,
// through every Effects slider. Run as:
// node cas.js light|dark width height [touch] [safari] [gpu|cpu]
const L = require('../lib');
const { chromium } = L.use({});
const [theme, VW, VH] = [process.argv[2] || 'light', +(process.argv[3] || 1400), +(process.argv[4] || 900)];
const touch = process.argv.includes('touch'), safari = process.argv.includes('safari'), gpu = process.argv.includes('cpu') ? 'off' : 'on';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, hasTouch: touch, colorScheme: theme });
  await ctx.addInitScript(g => { try { localStorage.setItem('paint-fx-gpu', g); } catch (x) {} }, gpu);
  if (safari) await ctx.addInitScript(() => {
    document.addEventListener('focusin', e => { const t = e.target; if (t.matches && t.matches('button, input[type="range"]')) t.blur(); }, true);
    window.addEventListener('mousedown', e => { if (!e.defaultPrevented && e.target.closest && e.target.closest('button, input[type="range"]')) getSelection().removeAllRanges(); });
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(800);
  await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
  const tapAt = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
  const tapEl = async s => { const e = await p.$(s); await e.scrollIntoViewIfNeeded(); const r = await e.boundingBox(); await tapAt(r.x + r.width / 2, r.y + r.height / 2); await p.waitForTimeout(150); };
  // (a drag along a slider, by mouse or by finger, to a value)
  const cdp = touch ? await ctx.newCDPSession(p) : null;
  const touchMove = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const slide = async (sel, from, to, opts = {}) => {
    const e = await p.$(sel); await e.evaluate(el => el.scrollIntoView({ block: 'center' })); await p.waitForTimeout(50); const r = await e.boundingBox();
    const lo = +(await e.getAttribute('min')), hi = +(await e.getAttribute('max')), at = v => r.x + 8 + (r.width - 16) * (v - lo) / (hi - lo), y = r.y + r.height / 2;
    if (touch) { await touchMove('touchStart', at(from), y); for (let i = 1; i <= 6; i++) { await touchMove('touchMove', at(from + (to - from) * i / 6), y); await p.waitForTimeout(16); } if (opts.mid) await opts.mid(); await touchMove('touchEnd'); }
    else { await p.mouse.move(at(from), y); await p.mouse.down(); await p.mouse.move(at(to), y, { steps: 6 }); if (opts.mid) await opts.mid(); await p.mouse.up(); }
    await p.waitForTimeout(80);
  };
  // the picture's layer (the top one), read back
  const layer = (fn, arg) => p.evaluate(([f, a]) => { const cs = [...document.querySelectorAll('.paint-layers canvas')], c = cs[cs.length - 1]; return new Function('c', 'a', f)(c, a); }, [fn, arg]);
  const row = () => layer(`const y = Math.round(c.height / 2), d = c.getContext('2d').getImageData(0, y, c.width, 1).data; let red = 0, blue = 0, clear = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 10) clear++; else if (d[i] > 190 && d[i + 1] < 90) red++; else if (d[i + 2] > 130 && d[i] < 70) blue++; } return { red, blue, clear, w: c.width };`);
  // (a sum of the pixels, all of them or outside a box, to tell exactly what changed)
  const sum = box => layer(`const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, W = c.width; let s = 0;
    for (let i = 0, n = 0; i < d.length; i += 4, n++) { if (a) { const x = n % W, y = (n / W) | 0; if (x >= a[0] && x < a[2] && y >= a[1] && y < a[3]) continue; } s = (s * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11) % 1000000007; } return s;`, box || null);
  const selOn = () => p.evaluate(() => { const t = document.querySelector('.selection-toolbar'); return !!t && !t.closest('[hidden]') && getComputedStyle(t).display !== 'none'; });
  // the picture in, laid down
  await p.setInputFiles('.paint-open input', L.fixture('scene.png')); await p.waitForTimeout(900);
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const before = await row(), s0 = await sum();
  L.ok(before.red > before.w * 0.1 && before.blue > before.w * 0.08, 'the picture is in ' + JSON.stringify(before));
  // no selection: greyed out
  await tapEl('[data-act="adjust"]'); await p.waitForTimeout(300);
  await p.$eval('.fx-sec[data-fx="cas"]', s => { if (s.classList.contains('closed')) s.querySelector('.pr-head').click(); });
  L.ok(await p.$eval('[data-adj="cas"]', i => i.disabled), 'without a selection the slider is greyed out');
  L.ok(await p.$eval('[data-adj-row="cas"]', r => +getComputedStyle(r).opacity < 1), 'and so is its row');
  L.ok(await p.$eval('[data-adj-row="cas"] output', o => o.textContent === '100' && getComputedStyle(o, '::after').content === '"%"'), 'it starts at 100%');
  await tapEl('[data-act="adjust"]'); await p.waitForTimeout(250);
  // a box selection round most of the picture (in the layer's pixels too)
  const wr = await p.$eval('.paint-world', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const cw = await layer('return [c.width, c.height];');
  const sx0 = wr.x + wr.w * 0.06, sy0 = wr.y + wr.h * 0.12, sx1 = wr.x + wr.w * 0.86, sy1 = wr.y + wr.h * 0.88;
  const boxPx = [sx0, sy0, sx1, sy1].map((v, i) => Math.round(i % 2 ? (v - wr.y) / wr.h * cw[1] : (v - wr.x) / wr.w * cw[0]));
  await p.keyboard.press('m'); await p.waitForTimeout(150);
  await p.mouse.move(sx0, sy0); await p.mouse.down(); await p.mouse.move((sx0 + sx1) / 2, (sy0 + sy1) / 2, { steps: 4 }); await p.mouse.move(sx1, sy1, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(250);
  L.ok(await selOn(), 'a selection');
  await tapEl('[data-act="adjust"]'); await p.waitForTimeout(350);
  L.ok(!(await p.$eval('[data-adj="cas"]', i => i.disabled)), 'with a selection the slider can be used');
  // every Effects slider leaves the selection as it is
  for (const k of ['exposure', 'contrast', 'shadows']) {
    await slide('[data-adj="' + k + '"]', 0, 30);
    L.ok(await selOn(), k + ': the selection is still there');
    await p.$eval('[data-adj="' + k + '"]', i => { i.value = 0; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  }
  await p.waitForTimeout(300);
  // narrower: a live look while it moves, then the full size
  let mid = null;
  await slide('[data-adj="cas"]', 100, 70, { mid: async () => {
    await p.waitForFunction(() => { const cs = [...document.querySelectorAll('.paint-layers canvas')], c = cs[cs.length - 1], d = c.getContext('2d').getImageData(0, Math.round(c.height / 2), c.width, 1).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 10) n++; return n > c.width * 0.08; }, null, { timeout: 4000, polling: 30 }).catch(() => {});
    mid = await row(); L.ok(await selOn(), 'the selection stays while the slider moves'); } });
  L.ok(mid && mid.clear > before.clear + before.w * 0.06, 'a live look while the slider moves ' + JSON.stringify(mid));
  const v70 = +(await p.$eval('[data-adj="cas"]', i => i.value));
  L.ok(Math.abs(v70 - 70) <= 3, 'the slider is at ' + v70 + '%');
  await p.waitForTimeout(3500);
  const narrow = await row();
  L.ok(narrow.red >= before.red * 0.96, 'the circle keeps its width (' + before.red + ' → ' + narrow.red + ')');
  L.ok(narrow.clear > before.clear + before.w * 0.12, 'what the selection no longer covers is see-through, not stretched (' + narrow.clear + ')');
  L.ok(await selOn(), 'the selection is still there once it\'s let go of');
  const sN = await sum();
  // outside the selection, nothing changed
  await p.$eval('[data-adj="cas"]', i => { i.value = 100; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(300);
  L.ok((await sum()) === s0, '100% puts the pixels back exactly');
  await slide('[data-adj="cas"]', 100, 70); await p.waitForTimeout(3500);
  L.ok((await sum()) === sN, 'the same width again is the same result');
  // quick changes: only the last one counts
  await p.$eval('[data-adj="cas"]', i => { for (const v of [40, 90, 130, 75]) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); } i.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(3500); const s75 = await sum();
  await p.$eval('[data-adj="cas"]', i => { i.value = 100; i.dispatchEvent(new Event('change', { bubbles: true })); i.value = 75; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(3500);
  L.ok((await sum()) === s75, 'quick changes end on the last one asked for');
  // wider
  await slide('[data-adj="cas"]', 75, 150); await p.waitForTimeout(4500);
  const wide = await row();
  L.ok(wide.red >= before.red * 0.96 && wide.red <= before.red * 1.06, 'wider: the circle keeps its width (' + before.red + ' → ' + wide.red + ')');
  const sW = await sum();
  // Done: one step
  await tapEl('[data-adj-act="done"]'); await p.waitForTimeout(500);
  const kept = await sum();
  L.ok(kept === sW, 'Done keeps what was shown');
  L.ok(await selOn(), 'the selection is still there after Done');
  await p.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z'); await p.waitForTimeout(400);
  L.ok((await sum()) === s0, 'one undo brings the picture back exactly');
  await p.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+Shift+z'); await p.waitForTimeout(400);
  L.ok((await sum()) === kept, 'redo puts it back');
  // outside the selection, nothing changed (a pixel's margin for the edge)
  await p.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z'); await p.waitForTimeout(400);
  const outBefore = await sum([boxPx[0] - 1, boxPx[1] - 1, boxPx[2] + 1, boxPx[3] + 1]);
  await p.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+Shift+z'); await p.waitForTimeout(400);
  L.ok((await sum([boxPx[0] - 1, boxPx[1] - 1, boxPx[2] + 1, boxPx[3] + 1])) === outBefore, 'outside the selection nothing changed');
  // an irregular selection: a circle round the red one
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z'); await p.waitForTimeout(400); // (back to the picture as it came)
  L.ok((await sum()) === s0, 'the picture as it came');
  await tapEl('.selection-commit'); await p.waitForTimeout(400); // (the box let go of; Effects closing let the picture's space grow: measured again)
  const wr2 = await p.$eval('.paint-world', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  Object.assign(wr, wr2);
  const cx = wr.x + wr.w * 0.34, cy = wr.y + wr.h * 0.5;
  await p.keyboard.press('c'); await p.waitForTimeout(150);
  await p.mouse.move(cx - wr.w * 0.26, cy - wr.h * 0.36); await p.mouse.down(); await p.mouse.move(cx, cy, { steps: 4 }); await p.mouse.move(cx + wr.w * 0.26, cy + wr.h * 0.36, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(250);
  L.ok(await selOn(), 'a circle selection');
  const ob = [cx - wr.w * 0.26, cy - wr.h * 0.36, cx + wr.w * 0.26, cy + wr.h * 0.36].map((v, i) => Math.round(i % 2 ? (v - wr.y) / wr.h * cw[1] : (v - wr.x) / wr.w * cw[0]));
  const outC = await sum([ob[0] - 1, ob[1] - 1, ob[2] + 1, ob[3] + 1]);
  const cornerAt = () => layer(`const d = c.getContext('2d').getImageData(a[0] + 3, a[1] + 3, 1, 1).data; return [...d];`, ob), corner0 = await cornerAt();
  if (await p.$eval('.paint-adjust', a => a.hidden)) await tapEl('[data-act="adjust"]');
  await p.waitForTimeout(300);
  L.ok(!(await p.$eval('[data-adj="cas"]', i => i.disabled)), 'the slider can be used with a circle selection');
  await slide('[data-adj="cas"]', 100, 70); await p.waitForTimeout(3500);
  L.ok((await sum([ob[0] - 1, ob[1] - 1, ob[2] + 1, ob[3] + 1])) === outC, 'outside the circle\'s box nothing changed');
  const corner = await cornerAt();
  L.ok(JSON.stringify(corner) === JSON.stringify(corner0), 'the corners of the circle\'s box, outside the circle, are as they were ' + JSON.stringify(corner));
  const crow = await row();
  L.ok(crow.red >= before.red * 0.93, 'the circle keeps its width inside a circle selection (' + before.red + ' → ' + crow.red + ')');
  L.ok(await selOn(), 'the circle selection is still there');
  // Esc takes it back
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  L.ok((await sum()) === s0, 'Esc takes it all back');
  L.ok(errs.length === 0, 'no errors ' + JSON.stringify(errs));
  await p.screenshot({ path: 'cas-' + theme + '-' + VW + (touch ? '-touch' : '') + (safari ? '-safari' : '') + '-' + gpu + '.png' });
  await b.close();
  L.done();
})();
