// Photo mode's masks, painted and edited: the first mask a brush, painted
// with nothing set, leaves the photo exactly as it was (it never goes black),
// and with Show the mask on, the photo shows through the red; painting is at
// full detail; a mask's slider held hides the red and shows what it does at
// half detail, let go of, the red and full detail are back (unless Show the
// mask is off); the size slider shows Paint's preview of the brush, its size
// on the screen, and the brush's ring follows the pointer at that size; Done
// keeps every mask, and back in Masks each can be picked again (from the
// list or by its pin on the photo), painted on and adjusted; sliders never
// let go of the picked mask. Run as: node maskedit.js light|dark width height [touch]
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
  const drag = async (x0, y0, x1, y1, n = 10) => {
    if (touch) {
      const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await t('touchStart', x0, y0); for (let i = 1; i <= n; i++) { await t('touchMove', x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await p.waitForTimeout(16); } await t('touchEnd');
    } else { await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, { steps: n }); await p.mouse.up(); }
    await p.waitForTimeout(150);
  };
  const slide = (k, v, end = true) => p.evaluate(([k, v, end]) => { const i = document.querySelector('[data-pk="' + k + '"]'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); if (end) i.dispatchEvent(new Event('change', { bubbles: true })); }, [k, v, end]);
  const endSlide = k => p.evaluate(k => document.querySelector('[data-pk="' + k + '"]').dispatchEvent(new Event('change', { bubbles: true })), k);
  // (the screen read back: the average of a box of the photo, in fractions of it)
  const at = async (fx, fy) => { const r = await p.$eval('.pho-cv', c => c.getBoundingClientRect().toJSON()), s = await S(); return [r.x + s.view.x + s.w * s.view.k * fx, r.y + s.view.y + s.h * s.view.k * fy]; };
  const box = (x0, y0, x1, y1) => p.evaluate(([x0, y0, x1, y1]) => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => {
    const c = document.querySelector('.pho-cv'), s = PaintPhoto.state(), dpr = c.width / c.clientWidth, t = document.createElement('canvas'); t.width = c.width; t.height = c.height; const x = t.getContext('2d'); x.drawImage(c, 0, 0);
    const X0 = Math.round((s.view.x + s.w * s.view.k * x0) * dpr), Y0 = Math.round((s.view.y + s.h * s.view.k * y0) * dpr), X1 = Math.round((s.view.x + s.w * s.view.k * x1) * dpr), Y1 = Math.round((s.view.y + s.h * s.view.k * y1) * dpr);
    const d = x.getImageData(X0, Y0, Math.max(1, X1 - X0), Math.max(1, Y1 - Y0)).data; let r = 0, g = 0, bl = 0, n = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; n++; }
    res({ r: r / n, g: g / n, b: bl / n, l: (r * 0.3 + g * 0.59 + bl * 0.11) / n, w: c.width });
  }))), [x0, y0, x1, y1]);

  await p.$eval('[data-hb="settings"]', e => e.click()); await p.waitForTimeout(250); await p.$eval('[data-setting="photo"]', e => e.click()); await p.waitForTimeout(400);
  await p.setInputFiles('.paint-open input', L.fixture('scene.png')); await p.waitForTimeout(1000);
  const sky0 = await box(0.45, 0.85, 0.6, 0.95), top0 = await box(0.45, 0.05, 0.6, 0.15), full = sky0.w;

  // ---- THE FIRST MASK A BRUSH: the photo never goes black ----
  await tapEl('[data-pcat="masks"]');
  await tapEl('[data-pa="madd"][data-kind="brush"]');
  if ((await S()).mOver) await tapEl('[data-pa="mover"]');
  let a = await at(0.3, 0.9), z = await at(0.8, 0.9);
  await drag(a[0], a[1], z[0], z[1], 14);
  const sky1 = await box(0.45, 0.85, 0.6, 0.95), top1 = await box(0.45, 0.05, 0.6, 0.15);
  L.ok(Math.abs(sky1.l - sky0.l) < 0.6 && Math.abs(top1.l - top0.l) < 0.6 && sky1.l > 60, 'a first mask painted with nothing set: the photo exactly as it was, never black ' + [sky0.l, sky1.l, top1.l].map(x => x.toFixed(1)).join(' '));
  await tapEl('[data-pa="mover"]');
  const red = await box(0.45, 0.85, 0.6, 0.95), off = await box(0.45, 0.05, 0.6, 0.15);
  L.ok(red.r > sky0.r + 25 && red.b < sky0.b - 20 && red.l > 60 && Math.abs(off.l - top0.l) < 0.6, 'Show the mask: the red lies over the photo where it was painted, the photo showing through, nowhere else ' + JSON.stringify({ red: [red.r, red.g, red.b].map(Math.round), was: [sky0.r, sky0.g, sky0.b].map(Math.round) }));
  // painting: full detail
  let q = await S();
  L.ok(!q.quick && red.w === full, 'painting leaves the photo at full detail');
  // ---- A MASK'S SLIDER HELD: the red steps aside, what it does shows, at half detail ----
  const pick = q.mask;
  await slide('m_ex', 70, false);
  const held = await box(0.45, 0.85, 0.6, 0.95); q = await S();
  L.ok(q.mSlide && q.quick && held.r < red.r - 10 && held.l > sky0.l + 20 && held.b > sky0.b + 10 && held.w < full, 'held: no red, the masked part brighter, at half detail ' + JSON.stringify({ l: [sky0.l, held.l].map(Math.round), w: held.w }));
  await endSlide('m_ex');
  const back = await box(0.45, 0.85, 0.6, 0.95); q = await S();
  L.ok(!q.mSlide && !q.quick && back.w === full && back.r > held.r + 10, 'let go of: the red back, at full detail');
  L.ok(q.mask === pick, 'the slider leaves the mask picked');
  await tapEl('[data-pa="mover"]');
  await slide('m_ex', 60, false); const held2 = await box(0.45, 0.85, 0.6, 0.95); await endSlide('m_ex'); const back2 = await box(0.45, 0.85, 0.6, 0.95);
  L.ok(Math.abs(held2.r - back2.r) < 6 && !(await S()).mOver, 'with Show the mask off, the red stays away after the slider too');
  // ---- THE BRUSH'S SIZE: Paint's preview, and the ring, the size it paints ----
  await slide('b_size', 30, false);
  const pv = await p.$eval('.paint-preview', e => ({ on: e.classList.contains('on'), vis: getComputedStyle(e).visibility, w: e.querySelector('canvas').getBoundingClientRect().width }));
  const want = await p.evaluate(() => { const s = PaintPhoto.state(); return 0.30 * Math.max(s.w, s.h) * s.view.k; });
  L.ok(pv.on && pv.vis === 'visible' && Math.abs(pv.w - Math.min(want, 1e9)) < Math.max(2, want * 0.03) || (pv.on && want > pv.w), 'the size slider shows Paint’s brush preview, its size on the screen ' + JSON.stringify({ pv, want: Math.round(want) }));
  L.ok((await S()).mask === pick, 'and leaves the mask picked');
  await endSlide('b_size'); await p.waitForTimeout(900);
  L.ok(await p.$eval('.paint-preview', e => !e.classList.contains('on')), 'let go of, the preview goes');
  if (!touch) {
    const c = await at(0.5, 0.5); await p.mouse.move(c[0], c[1]); await p.waitForTimeout(80);
    const rr = await p.$eval('.pho-mui circle.ring', e => +e.getAttribute('r'));
    L.ok(Math.abs(rr - want / 2) < 2, 'the ring over the photo is the size it paints ' + [rr, want / 2].map(Math.round).join(' / '));
    await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('='); await p.waitForTimeout(80); await p.mouse.move(c[0] + 1, c[1]); await p.waitForTimeout(80);
    const rr2 = await p.$eval('.pho-mui circle.ring', e => +e.getAttribute('r'));
    L.ok(rr2 > rr * 1.2, 'zoomed in, it grows with the photo ' + Math.round(rr2));
    await p.keyboard.press('0'); await p.waitForTimeout(80);
  }
  await slide('b_size', 12);
  // ---- A SECOND MASK; DONE; BACK: both there, each editable ----
  await tapEl('[data-pa="madd"][data-kind="radial"]');
  a = await at(0.22, 0.5); z = await at(0.34, 0.5); await drag(a[0], a[1], z[0], z[1]);
  await slide('m_sa', -100);
  const radial = (await S()).mask;
  await tapEl('[data-pa="mdone"]');
  L.ok((await S()).cat === 'edit' && (await S()).v.masks.length === 2, 'Done: back to the sliders, both masks kept');
  const kept = await box(0.17, 0.42, 0.27, 0.58);
  L.ok(Math.abs(kept.r - kept.b) < 12, 'and still at work on the photo (the circle grey)');
  await tapEl('[data-pcat="masks"]');
  L.ok(await p.$$eval('.pho-mrow', r => r.length) === 2 && (await S()).mask === radial, 'back in Masks: both listed, the last one picked');
  // the other's pin picks it
  const pin = await p.$eval('.pho-mui circle.pin', e => [+e.getAttribute('cx'), +e.getAttribute('cy')]), sr = await p.$eval('.pho-stage', e => e.getBoundingClientRect().toJSON());
  await tapAt(sr.x + pin[0], sr.y + pin[1]); await p.waitForTimeout(200);
  L.ok((await S()).mask === pick, 'a tap on the other mask’s pin picks it');
  const n0 = (await S()).v.masks.find(m => m.id === pick).g.st.length;
  a = await at(0.3, 0.75); z = await at(0.7, 0.75); await drag(a[0], a[1], z[0], z[1]);
  L.ok((await S()).v.masks.find(m => m.id === pick).g.st.length === n0 + 1, 'and it can be painted on again');
  await slide('m_ex', -40);
  L.ok((await S()).v.masks.find(m => m.id === pick).a.ex === -40 && (await S()).v.masks.find(m => m.id === radial).a.sa === -100, 'each keeps its own settings');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  L.ok((await S()).v.masks.find(m => m.id === pick).a.ex === 60, 'undo takes back just that change');
  await p.screenshot({ path: 'maskedit-' + theme + '-' + VW + (touch ? '-touch' : '') + '.png' });
  L.ok(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close();
  L.done();
})().catch(e => { console.log('FAIL', e.stack); process.exit(1); });
