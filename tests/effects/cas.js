// Content-Aware Scale, from Effects, on the selection's own frame: the
// button is greyed out without a selection; pressed, the mode is on (its
// pill on the picture, side handles on the frame) and the selection stays;
// a side dragged in carves the plainest parts away (the red circle and the
// blue square keep their width), a quick look while it moves and the full
// size once it's let go of; dragged back to where it began, the pixels are
// exactly as they were (always worked from the original, nothing adds up);
// a corner does both ways; Commit (Return) lays it down, one undo step for
// the pixels, and redo puts it back; Esc, or undo before anything's sized,
// puts back exactly what was there, selection and all; Normal Scale goes
// back to plain sizing with what's carved; outside the selection nothing
// changes, a circle's corners included. Run as:
// node cas.js light|dark width height [touch] [safari]
const L = require('../lib');
const { chromium } = L.use({});
const [theme, VW, VH] = [process.argv[2] || 'light', +(process.argv[3] || 1400), +(process.argv[4] || 900)];
const touch = process.argv.includes('touch'), safari = process.argv.includes('safari');
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, hasTouch: touch, colorScheme: theme });
  if (safari) await ctx.addInitScript(() => {
    document.addEventListener('focusin', e => { const t = e.target; if (t.matches && t.matches('button, input[type="range"]')) t.blur(); }, true);
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(800);
  await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
  const tapAt = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
  const tapEl = async s => { const e = await p.$(s); await e.evaluate(el => el.scrollIntoView({ block: 'center' })); await p.waitForTimeout(50); const r = await e.boundingBox(); await tapAt(r.x + r.width / 2, r.y + r.height / 2); await p.waitForTimeout(200); };
  // (a drag, by mouse or by finger; mid: looked at before letting go)
  const cdp = touch ? await ctx.newCDPSession(p) : null;
  const tch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const drag = async (x0, y0, x1, y1, mid) => {
    if (touch) { await tch('touchStart', x0, y0); for (let i = 1; i <= 10; i++) { await tch('touchMove', x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); await p.waitForTimeout(16); } }
    else { await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, { steps: 10 }); }
    if (mid) await mid();
    if (touch) await tch('touchEnd'); else await p.mouse.up();
    await p.waitForTimeout(100);
  };
  // the top layer (the picture's) and the sheet what's picked up is drawn on
  const cvOf = (which, fn, arg) => p.evaluate(([w, f, a]) => { const cs = [...document.querySelectorAll('.paint-layers canvas')], c = w === 'sov' ? document.querySelector('.paint-selov') : cs[cs.length - 1]; return new Function('c', 'a', f)(c, a); }, [which, fn, arg]);
  const ROW = `const y = Math.round(c.height * (a || 0.5)), d = c.getContext('2d').getImageData(0, y, c.width, 1).data; let red = 0, blue = 0, clear = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 10) clear++; else if (d[i] > 190 && d[i + 1] < 90) red++; else if (d[i + 2] > 130 && d[i] < 70) blue++; } return { red, blue, clear, w: c.width };`;
  // (how much of a column is there at all; the red circle's widest row and tallest column)
  const TALL = `const x = Math.round(c.width * a), d = c.getContext('2d').getImageData(x, 0, 1, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++; return n;`;
  const SPAN = `const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data, rw = new Int32Array(H), cl = new Int32Array(W);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (d[i + 3] > 10 && d[i] > 190 && d[i + 1] < 90) { rw[y]++; cl[x]++; } }
    return { w: Math.max(...rw), h: Math.max(...cl) };`;
  const row = (w, at) => cvOf(w || 'layer', ROW, at || 0.5);
  // (a sum of the pixels, all of them or outside a box, to tell exactly what changed)
  const sum = box => cvOf('layer', `const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, W = c.width; let s = 0;
    for (let i = 0, n = 0; i < d.length; i += 4, n++) { if (a) { const x = n % W, y = (n / W) | 0; if (x >= a[0] && x < a[2] && y >= a[1] && y < a[3]) continue; } s = (s * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11) % 1000000007; } return s;`, box || null);
  const sheetSum = () => cvOf('sov', `const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i++) s = (s * 31 + d[i]) % 1000000007; return s;`);
  const selOn = () => p.evaluate(() => { const t = document.querySelector('.selection-toolbar'); return !!t && !t.closest('[hidden]') && getComputedStyle(t).display !== 'none'; });
  const pill = () => p.$eval('.paint-casmode', e => !e.hidden && getComputedStyle(e).display !== 'none');
  const fxOpen = async () => { if (await p.$eval('.paint-adjust', a => a.hidden)) await tapEl('[data-act="adjust"]'); await p.waitForTimeout(250); await p.$eval('.fx-sec[data-fx="cas"]', s => { if (s.classList.contains('closed')) s.querySelector('.pr-head').click(); }); };
  const casOn = async () => { await fxOpen(); await tapEl('[data-fx-cas]'); await p.waitForTimeout(300); };
  // (the full size laid in: the sheet stops changing)
  const settle = async () => { await p.waitForFunction(() => !document.querySelector('.paint-casmode').dataset.busy, null, { timeout: 30000, polling: 50 }); await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };

  // (back to the picture as it came, the box selected again; none: let go of)
  let boxSel = null, s0 = null;
  const fresh = async (none) => {
    for (let i = 0; i < 12 && (await sum()) !== s0; i++) { await p.keyboard.press(MOD + '+z'); await p.waitForTimeout(250); }
    L.ok((await sum()) === s0, 'back to the picture as it came');
    if (await selOn()) { await p.keyboard.press('Escape'); await p.waitForTimeout(200); }
    if (await selOn()) { await tapEl('.selection-commit'); }
    if (!none) await boxSel();
  };
  // the picture in, laid down
  await p.setInputFiles('.paint-open input', L.fixture('scene.png')); await p.waitForTimeout(900);
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const before = await row(); s0 = await sum(); const span0 = await cvOf('layer', SPAN);
  L.ok(before.red > before.w * 0.1 && before.blue > before.w * 0.08, 'the picture is in ' + JSON.stringify(before));
  // no selection: greyed out, and it says why
  await fxOpen();
  L.ok(await p.$eval('[data-fx-cas]', i => i.disabled && /select/i.test(i.dataset.tip)), 'without a selection the button is greyed out, and says why');
  L.ok(!(await p.$('[data-adj="cas"]')), 'there is no slider any more');
  await tapEl('[data-act="adjust"]'); await p.waitForTimeout(250);
  // a box selection round most of the picture (in the layer's pixels too)
  const wr = await p.$eval('.paint-world', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const cw = await cvOf('layer', 'return [c.width, c.height];');
  const sx0 = wr.x + wr.w * 0.06, sy0 = wr.y + wr.h * 0.12, sx1 = wr.x + wr.w * 0.86, sy1 = wr.y + wr.h * 0.88, my = (sy0 + sy1) / 2;
  const toPx = (v, i) => Math.round(i % 2 ? (v - wr.y) / wr.h * cw[1] : (v - wr.x) / wr.w * cw[0]);
  const boxPx = [sx0, sy0, sx1, sy1].map(toPx), outBox = [boxPx[0] - 1, boxPx[1] - 1, boxPx[2] + 1, boxPx[3] + 1];
  const out0 = await sum(outBox);
  boxSel = async () => { await p.keyboard.press('m'); await p.waitForTimeout(150); await p.mouse.move(sx0, sy0); await p.mouse.down(); await p.mouse.move(sx1, sy1, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(250); };
  await boxSel();
  L.ok(await selOn(), 'a selection');
  await fxOpen();
  L.ok(!(await p.$eval('[data-fx-cas]', i => i.disabled)), 'with a selection the button can be pressed');
  await tapEl('[data-fx-cas]'); await p.waitForTimeout(300);
  L.ok(await pill(), 'pressed: the mode shows it is on');
  L.ok(await selOn(), 'the selection stays');
  L.ok(await p.$eval('.paint-adjust', a => a.hidden), 'Effects steps aside, the frame is what sizes it');
  if (!touch) { await p.mouse.move(sx1, my); await p.waitForTimeout(60); L.ok(await p.$eval('.paint-stage', s => s.classList.contains('corner-ew')), 'the frame has side handles'); }

  const sheet0 = await sheetSum();

  // ---- A SIDE DRAGGED IN: carved, a quick look while it moves ----
  const dx = (sx1 - sx0) * 0.3;
  let mid = null, midSum = 0;
  await drag(sx1, my, sx1 - dx, my, async () => {
    await p.waitForTimeout(500); mid = await row('sov'); midSum = await sheetSum();
    L.ok(await selOn() && await pill(), 'while it moves the selection and the mode stay');
  });
  L.ok(mid && mid.red >= before.red * 0.88 && mid.blue >= before.blue * 0.85, 'a quick look while it moves, the circle and the square keeping their width (' + before.red + '/' + before.blue + ' → ' + (mid && mid.red) + '/' + (mid && mid.blue) + ')');
  await settle();
  const full = await row('sov');
  L.ok(full.red >= before.red * 0.96 && full.blue >= before.blue * 0.93, 'let go of, the full size: the circle keeps its width (' + before.red + ' → ' + full.red + ')');
  L.ok((await sheetSum()) !== midSum, 'and it is not the quick look');
  const sNarrow = await sheetSum();
  // each size is a step of the selection's own, in the mode
  await p.keyboard.press(MOD + '+z'); await settle();
  L.ok((await sheetSum()) === sheet0 && await pill(), 'undo takes the size back, still in the mode');
  await p.keyboard.press(MOD + '+Shift+z'); await settle();
  L.ok((await sheetSum()) === sNarrow && await pill(), 'and redo puts it back');
  // back out to where it began: exactly what it started with
  await drag(sx1 - dx, my, sx1, my); await settle();
  L.ok((await sheetSum()) === sheet0, 'dragged back to where it began, it is exactly as it started: always worked from the original, nothing adds up');
  // ---- ESC: all of it put back ----
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  L.ok(!(await pill()) && await selOn(), 'Esc ends the mode, and the selection stays');
  L.ok((await sum()) === s0, 'and the picture is exactly as it was');

  // ---- AGAIN, NARROWER, AND COMMIT ----
  await casOn();
  await drag(sx1, my, sx1 - dx, my); await settle();
  L.ok((await sheetSum()) === sNarrow, 'the same size again is the same result');
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  L.ok(!(await selOn()) && !(await pill()), 'Return commits, and the mode ends with it');
  const kept = await sum(), narrow = await row();
  L.ok(narrow.red >= before.red * 0.96, 'laid down, the circle as wide as it was (' + before.red + ' → ' + narrow.red + ')');
  L.ok(narrow.clear > before.clear + before.w * 0.12, 'what the selection no longer covers is see-through, not stretched (' + narrow.clear + ')');
  L.ok((await sum(outBox)) === out0, 'outside the selection nothing changed');
  let n = 0; while ((await sum()) !== s0 && n < 3) { await p.keyboard.press(MOD + '+z'); await p.waitForTimeout(300); n++; }
  L.ok((await sum()) === s0 && n <= 2, 'undo brings the picture back exactly (' + n + ' presses)');
  for (let i = 0; i < n; i++) { await p.keyboard.press(MOD + '+Shift+z'); await p.waitForTimeout(300); }
  L.ok((await sum()) === kept, 'redo puts it back');
  await fresh();

  // ---- UNDO BEFORE ANYTHING IS SIZED: as Esc ----
  await casOn();
  await p.keyboard.press(MOD + '+z'); await p.waitForTimeout(300);
  L.ok(!(await pill()) && await selOn(), 'undo before anything is sized ends the mode, the selection kept');
  L.ok((await sum()) === s0, 'and the picture is exactly as it was');

  // ---- A CORNER: both ways; then Normal Scale ----
  await casOn();
  const dy = (sy1 - sy0) * 0.2;
  await drag(sx1, sy1, sx1 - dx, sy1 - dy); await settle();
  const sp1 = await cvOf('sov', SPAN), tall1 = await cvOf('sov', TALL, (boxPx[0] + 4) / cw[0]);
  L.ok(sp1.w >= span0.w * 0.95, 'a corner: narrower, the circle as wide (' + span0.w + ' → ' + sp1.w + ')');
  L.ok(tall1 < (boxPx[3] - boxPx[1]) * 0.9 && sp1.h >= span0.h * 0.95, 'and shorter, the circle as tall (' + (boxPx[3] - boxPx[1]) + ' → ' + tall1 + '; ' + span0.h + ' → ' + sp1.h + ')');
  await tapEl('.paint-casmode [data-cas-off]');
  L.ok(!(await pill()) && await selOn(), 'Normal Scale: back to plain sizing, the selection kept');
  if (!touch) { await p.mouse.move(sx1 - dx, my - dy / 2); await p.waitForTimeout(60); L.ok(!(await p.$eval('.paint-stage', s => s.classList.contains('corner-ew'))), 'and no side handles'); }
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  L.ok((await sum(outBox)) === out0, 'laid down: outside the selection nothing changed');
  await fresh(true);

  // ---- TURNED: it stays turned, the mode works in its own frame ----
  // (from the selection's Transform options, where what's picked up stays picked up)
  const bx0 = wr.x + wr.w * 0.1, bx1 = wr.x + wr.w * 0.55, by0 = wr.y + wr.h * 0.2, by1 = wr.y + wr.h * 0.8;
  await p.keyboard.press('m'); await p.waitForTimeout(150); await p.mouse.move(bx0, by0); await p.mouse.down(); await p.mouse.move(bx1, by1, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(250);
  await tapEl('.selection-toolbar [data-sel="rot90"]');
  await tapEl('.selection-toolbar [data-selection-pop="transform"]');
  L.ok(await p.$eval('.paint-selcas', b => !b.hidden && b.getAttribute('aria-pressed') === 'false'), 'Transform has Content-Aware Scale too');
  await tapEl('.paint-selcas');
  L.ok(await pill() && await selOn(), 'a turned selection: the mode is on, and it stays turned');
  L.ok(await p.$eval('.paint-selcas', b => b.getAttribute('aria-pressed') === 'true'), 'its button shows it is on');
  const turned0 = await sheetSum();
  // (turned a quarter: the frame's side handle that was east is now south)
  const tcx = (bx0 + bx1) / 2, tcy = (by0 + by1) / 2, th2 = (bx1 - bx0) / 2;
  await drag(tcx, tcy + th2, tcx, tcy + th2 * 0.7); await settle();
  const tsp = await cvOf('sov', SPAN);
  L.ok((await sheetSum()) !== turned0 && tsp.h >= span0.w * 0.95, 'sized in its own frame, the circle keeps its width, turned (' + span0.w + ' → ' + tsp.h + ')');
  await tapEl('.selection-toolbar [data-selection-pop="transform"]'); await tapEl('.paint-selcas');
  L.ok(!(await pill()) && await selOn(), 'pressed again: back to plain scaling');
  await tapEl('.selection-toolbar [data-selection-pop="transform"]'); // (the options closed: keys there stay there)
  L.ok(await selOn() && await p.$eval('.selection-pop', e => e.hidden), 'Transform pressed again closes its options');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  L.ok(!(await selOn()), 'and Return lays it down');
  await fresh(true);

  // ---- A CIRCLE SELECTION: only what's inside it changes ----
  const wr2 = await p.$eval('.paint-world', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  Object.assign(wr, wr2);
  const cx = wr.x + wr.w * 0.34, cy = wr.y + wr.h * 0.5, rx = wr.w * 0.26, ry = wr.h * 0.36;
  await p.keyboard.press('c'); await p.waitForTimeout(150);
  await p.mouse.move(cx - rx, cy - ry); await p.mouse.down(); await p.mouse.move(cx, cy, { steps: 4 }); await p.mouse.move(cx + rx, cy + ry, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(250);
  L.ok(await selOn(), 'a circle selection');
  const ob = [cx - rx, cy - ry, cx + rx, cy + ry].map(toPx), obox = [ob[0] - 1, ob[1] - 1, ob[2] + 1, ob[3] + 1];
  const outC = await sum(obox);
  const corner = () => cvOf('layer', `return [...c.getContext('2d').getImageData(a[0] + 3, a[1] + 3, 1, 1).data];`, ob), corner0 = await corner();
  await casOn();
  L.ok(await pill(), 'the mode works on a circle selection');
  await drag(cx + rx, cy, cx + rx * 0.5, cy); await settle();
  await tapEl('.selection-commit'); await p.waitForTimeout(400);
  L.ok((await sum(obox)) === outC, 'outside the circle\'s box nothing changed');
  L.ok(JSON.stringify(await corner()) === JSON.stringify(corner0), 'the corners of the circle\'s box, outside the circle, are as they were');
  const crow = await row();
  L.ok(crow.red >= before.red * 0.9, 'the circle keeps its width inside a circle selection (' + before.red + ' → ' + crow.red + ')');
  L.ok(errs.length === 0, 'no errors ' + JSON.stringify(errs));
  await p.screenshot({ path: 'cas-' + theme + '-' + VW + (touch ? '-touch' : '') + (safari ? '-safari' : '') + '.png' });
  await b.close();
  L.done();
})().catch(e => { console.log('FAIL', e.stack); process.exit(1); });
