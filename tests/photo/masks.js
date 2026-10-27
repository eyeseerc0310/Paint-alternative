// Photo mode's masks (local adjustments): a linear mask drawn by a drag
// darkens where it's full and leaves alone what's past its last line; a
// radial one changes inside and not outside, and inverted the other way
// round; a brush paints where it goes (by mouse or finger) and the eraser
// takes it back; each change is one undo step and undo puts the photo back
// exactly; hidden or deleted, a mask changes nothing; the overlay shows
// only on the screen, never in what's saved; four at most; kept through
// saving and loading. Run as: node masks.js light|dark width height [touch]
const L = require('../lib');
const { chromium } = L.use({});
const [theme, VW, VH] = [process.argv[2] || 'light', +(process.argv[3] || 1400), +(process.argv[4] || 900)];
const touch = process.argv.includes('touch');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, hasTouch: touch, colorScheme: theme });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(800);
  await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
  const S = () => p.evaluate(() => PaintPhoto.state());
  const cdp = touch ? await ctx.newCDPSession(p) : null;
  const tapAt = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
  const tapEl = async s => { const e = await p.$(s); await e.evaluate(el => el.scrollIntoView({ block: 'center' })); await p.waitForTimeout(60); const r = await e.boundingBox(); await tapAt(r.x + r.width / 2, r.y + r.height / 2); await p.waitForTimeout(200); };
  const drag = async (x0, y0, x1, y1, n = 8) => {
    if (touch) {
      const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await t('touchStart', x0, y0); for (let i = 1; i <= n; i++) { await t('touchMove', x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await p.waitForTimeout(16); } await t('touchEnd');
    } else { await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, { steps: n }); await p.mouse.up(); }
    await p.waitForTimeout(150);
  };
  const setSlider = (k, v) => p.evaluate(([k, v]) => { const i = document.querySelector('[data-pk="' + k + '"]'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, [k, v]);
  // (the photo as saved, at its own size: the average light of a box of it, in fractions)
  const saved = () => p.evaluate(async () => { const im = await createImageBitmap(await PaintPhoto.exportBlob({ type: 'png' })), c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); window.__px = x.getImageData(0, 0, c.width, c.height); return [c.width, c.height]; });
  const lum = (x0, y0, x1, y1) => p.evaluate(([x0, y0, x1, y1]) => { const d = window.__px, W = d.width, H = d.height; let s = 0, n = 0; for (let y = Math.floor(y0 * H); y < Math.floor(y1 * H); y++) for (let x = Math.floor(x0 * W); x < Math.floor(x1 * W); x++) { const i = (y * W + x) * 4; s += d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11; n++; } return s / n; }, [x0, y0, x1, y1]);
  const sat = (x0, y0, x1, y1) => p.evaluate(([x0, y0, x1, y1]) => { const d = window.__px, W = d.width, H = d.height; let s = 0, n = 0; for (let y = Math.floor(y0 * H); y < Math.floor(y1 * H); y++) for (let x = Math.floor(x0 * W); x < Math.floor(x1 * W); x++) { const i = (y * W + x) * 4, r = d.data[i], g = d.data[i + 1], bl = d.data[i + 2]; s += Math.max(r, g, bl) - Math.min(r, g, bl); n++; } return s / n; }, [x0, y0, x1, y1]);
  const hash = () => p.evaluate(() => { const d = window.__px.data; let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) % 1000000007; return h; });
  // (a place on the photo, in fractions of it, on the screen)
  const at = async (fx, fy) => { const r = await p.$eval('.pho-cv', c => c.getBoundingClientRect().toJSON()), s = await S(); return [r.x + s.view.x + s.w * s.view.k * fx, r.y + s.view.y + s.h * s.view.k * fy]; };

  await p.$eval('[data-hb="settings"]', e => e.click()); await p.waitForTimeout(250); await p.$eval('[data-setting="photo"]', e => e.click()); await p.waitForTimeout(400);
  await p.setInputFiles('.paint-open input', L.fixture('scene.png')); await p.waitForTimeout(1000);
  await saved(); const H0 = await hash(), top0 = await lum(0.3, 0.02, 0.7, 0.12), bot0 = await lum(0.3, 0.85, 0.7, 0.98), circ0 = await sat(0.15, 0.4, 0.3, 0.6), sq0 = await sat(0.7, 0.4, 0.8, 0.6);
  await tapEl('[data-pcat="masks"]');
  L.ok(await p.$eval('.pho-masks', e => !!e), 'Masks shows its panel');

  // ---- LINEAR: drawn by a drag from full to none ----
  await tapEl('[data-pa="madd"][data-kind="linear"]');
  let a = await at(0.5, 0.05), z = await at(0.5, 0.5);
  const h0 = (await S()).hist;
  await drag(a[0], a[1], z[0], z[1]);
  await setSlider('m_ex', -80);
  const s1 = await S(), m1 = s1.v.masks[0]; 
  L.ok(m1.kind === 'linear' && m1.g.y1 > m1.g.y0 && s1.hist === h0 + 2, 'a linear mask: drawn by a drag, its exposure set, each a step ' + JSON.stringify({ g: m1.g, steps: s1.hist - h0 }));
  await saved();
  const top1 = await lum(0.3, 0.02, 0.7, 0.12), bot1 = await lum(0.3, 0.85, 0.7, 0.98);
  L.ok(top1 < top0 - 40 && Math.abs(bot1 - bot0) < 0.5, 'it darkens the top and leaves the bottom alone ' + [top0, top1, bot0, bot1].map(x => x.toFixed(1)).join(' '));
  // the overlay: on the screen only
  L.ok(await p.$eval('.pho-mui', e => e.querySelectorAll('line').length >= 3), 'its lines show on the photo');

  // ---- RADIAL: inside, then inverted ----
  const sqL = await sat(0.7, 0.4, 0.8, 0.6);
  await tapEl('[data-pa="madd"][data-kind="radial"]');
  a = await at(0.22, 0.5); z = await at(0.36, 0.5);
  await drag(a[0], a[1], z[0], z[1]);
  await setSlider('m_sa', -100);
  await saved();
  const circ1 = await sat(0.17, 0.42, 0.27, 0.58), sq1 = await sat(0.7, 0.4, 0.8, 0.6);
  L.ok(circ1 < circ0 * 0.3 && Math.abs(sq1 - sqL) < 1, 'a radial mask takes the colour out inside it, not outside ' + [circ0, circ1, sq0, sq1].map(x => x.toFixed(1)).join(' '));
  await p.evaluate(() => { const r = [...document.querySelectorAll('.pho-mrow')].find(r => r.getAttribute('aria-selected') === 'true'); r.querySelector('[data-pa="minv"]').click(); });
  await p.waitForTimeout(150); await saved();
  const circ2 = await sat(0.17, 0.42, 0.27, 0.58), sq2 = await sat(0.7, 0.4, 0.8, 0.6);
  L.ok(circ2 > circ0 * 0.8 && sq2 < sq0 * 0.4, 'inverted, the other way round ' + [circ2, sq2].map(x => x.toFixed(1)).join(' '));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);

  // ---- BRUSH: painted, then erased ----
  await tapEl('[data-pa="madd"][data-kind="brush"]');
  await setSlider('m_ex', 90);
  await saved(); const pre = await lum(0.62, 0.86, 0.9, 0.94);
  a = await at(0.6, 0.9); z = await at(0.95, 0.9);
  const hb = (await S()).hist;
  await drag(a[0], a[1], z[0], z[1], 14);
  const sb = await S(), bm = sb.v.masks[2];
  L.ok(bm.kind === 'brush' && bm.g.st.length === 1 && bm.g.st[0].p.length > 8 && sb.hist === hb + 1, 'a brush stroke is kept as its points, as one step ' + JSON.stringify({ strokes: bm.g.st.length, pts: bm.g.st[0].p.length / 2 }));
  await saved(); const painted = await lum(0.62, 0.86, 0.9, 0.94), elsewhere = await lum(0.62, 0.62, 0.9, 0.7);
  L.ok(painted > pre + 25, 'where it was painted it is brighter ' + [pre, painted].map(x => x.toFixed(1)).join(' → '));
  await tapEl('[data-pa="merase"]');
  await drag(a[0] - 30, a[1], z[0] + 30, z[1], 14);
  await saved(); const erased = await lum(0.62, 0.86, 0.9, 0.94);
  L.ok(Math.abs(erased - pre) < 3 && (await S()).v.masks[2].g.st[1].er, 'the eraser takes it back ' + erased.toFixed(1));
  await tapEl('[data-pa="mpaint"]');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(150); await saved();
  L.ok(Math.abs((await lum(0.62, 0.86, 0.9, 0.94)) - painted) < 1, 'undo brings the painted stroke back');

  // ---- HIDDEN, KEPT, THE OVERLAY NOT SAVED ----
  const withAll = await hash();
  for (let i = 0; i < 3; i++) await p.evaluate(i => document.querySelectorAll('.pho-mrow')[i].querySelector('[data-pa="mvis"]').click(), i);
  await p.waitForTimeout(150); await saved();
  L.ok((await hash()) === H0, 'every mask hidden: the photo exactly as it came');
  await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await p.waitForTimeout(150); await saved();
  L.ok((await hash()) === withAll, 'shown again (by undo): exactly as before');
  // undo all the way: exactly the photo; redo all the way: exactly as it was
  let n = 0; for (; n < 60 && (await S()).hist > 1; n++) await p.keyboard.press('Control+z');
  await p.waitForTimeout(150); await saved();
  L.ok((await hash()) === H0 && !(await S()).v.masks, 'undone all the way: the photo exactly as it came, no masks');
  for (let i = 0; i < n; i++) await p.keyboard.press('Control+Shift+z');
  await p.waitForTimeout(150); await saved();
  L.ok((await hash()) === withAll && (await S()).v.masks.length === 3, 'redone all the way: the three masks, exactly as they were');
  const v0 = (await S()).v;
  await p.evaluate(() => PaintPhoto.load(PaintPhoto.serialize())); await p.waitForTimeout(500);
  await tapEl('[data-pcat="masks"]'); await saved();
  const vl = (await S()).v.masks; if (JSON.stringify(vl) !== JSON.stringify(v0.masks)) console.log('~ before', JSON.stringify(v0.masks).slice(0, 400), '\n~ after ', JSON.stringify(vl).slice(0, 400));
  L.ok(JSON.stringify(vl) === JSON.stringify(v0.masks) && (await hash()) === withAll, 'saved and loaded, the masks and the brush’s strokes come back the same');
  // four at most
  await tapEl('[data-pa="madd"][data-kind="radial"]');
  L.ok((await S()).v.masks.length === 4 && await p.$eval('[data-pa="madd"]', b => b.disabled), 'four at most: the add buttons grey out');
  await tapEl('[data-pa="mdone"]');
  L.ok((await S()).cat === 'edit' && await p.$eval('.pho-mui', e => !e.childElementCount), 'Done goes back to the sliders, the mask’s lines gone');
  await p.screenshot({ path: 'masks-' + theme + '-' + VW + (touch ? '-touch' : '') + '.png' });
  L.ok(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close();
  L.done();
})().catch(e => { console.log('FAIL', e.stack); process.exit(1); });
