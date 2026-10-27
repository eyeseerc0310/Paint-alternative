// Photo mode's Optics & Geometry and Crop & Straighten: each lens and
// perspective slider changes the photo and, put back, gives the very same
// screen again; the crop shows the whole frame with what it keeps lit; a
// shape keeps its proportions while a corner or a side is dragged (by mouse
// or finger), each drag one undo step; the saved photo is the crop's size;
// straightening turns the photo and fills the frame; a quarter turn swaps
// the saved photo's sides; two flips give the same screen back; Reset puts
// everything back; it's all kept through saving and loading. Run as:
// node geometry.js light|dark width height [touch]
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
  const drag = async (x0, y0, x1, y1) => {
    if (touch) {
      const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await t('touchStart', x0, y0); for (let i = 1; i <= 6; i++) { await t('touchMove', x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6); await p.waitForTimeout(16); } await t('touchEnd');
    } else { await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, { steps: 6 }); await p.mouse.up(); }
    await p.waitForTimeout(120);
  };
  const screen = (keep) => p.evaluate(keep => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => {
    const c = document.querySelector('.pho-cv'), t = document.createElement('canvas'); t.width = 200; t.height = Math.round(200 * c.height / c.width);
    const x = t.getContext('2d'); x.drawImage(c, 0, 0, t.width, t.height); const d = x.getImageData(0, 0, t.width, t.height).data;
    if (keep) window.__ref = d;
    let df = 0, n = 0; const ref = window.__ref; if (ref && ref.length === d.length) for (let i = 0; i < d.length; i++) { df += Math.abs(d[i] - ref[i]); n++; }
    r({ diff: n ? df / n : -1 });
  }))), !!keep);
  const setSlider = (k, v) => p.evaluate(([k, v]) => {
    const i = document.querySelector('[data-pk="' + k + '"]'); if (!i) return false;
    const sec = i.closest('.fx-sec'); if (sec && sec.classList.contains('closed')) sec.querySelector('.pr-head').click();
    i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true;
  }, [k, v]);
  const dbl = k => p.evaluate(k => { document.querySelector('[data-pk-row="' + k + '"] span').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); }, k);
  const saved = () => p.evaluate(async () => { const im = await createImageBitmap(await PaintPhoto.exportBlob({ type: 'png' })); return [im.width, im.height]; });
  // the crop on the screen
  const cropBox = () => p.$eval('.pho-crop', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, shown: !e.hidden }; });

  await p.$eval('[data-hb="settings"]', e => e.click()); await p.waitForTimeout(250); await p.$eval('[data-setting="photo"]', e => e.click()); await p.waitForTimeout(400);
  await p.setInputFiles('.paint-open input', L.fixture('scene.png')); await p.waitForTimeout(1000);
  L.ok((await S()).w === 600, 'the photo is open');
  await screen(true);

  // ---- OPTICS: each slider changes it, one step, and back it's exactly as it was ----
  const bad = [];
  for (const [k, v, back] of [['distort', 80, 0], ['lensVig', 80, 0], ['caR', 100, 0], ['caB', -100, 0], ['vert', 60, 0], ['horiz', -60, 0], ['scale', 130, 100]]) {
    const h0 = (await S()).hist; await setSlider(k, v); const a = await screen(), st = await S(); await dbl(k); const z = await screen(), st2 = await S();
    if (!(a.diff > (/^ca/.test(k) ? 0.005 : 0.05) && z.diff === 0 && st.hist === h0 + 1 && st2.v[k] === back)) bad.push(k + ' ' + JSON.stringify({ on: a.diff.toFixed(3), off: z.diff, steps: st.hist - h0, back: st2.v[k] }));
  }
  L.ok(!bad.length, 'each lens and perspective slider changes the photo, as one step, and back it is exactly as it was' + (bad.length ? ': ' + bad.join('; ') : ''));
  L.ok((await saved()).join('x') === '600x400', 'with no crop the saved photo is its own size');

  // ---- THE CROP ----
  await tapEl('[data-pcat="crop"]'); await p.waitForTimeout(400);
  let cb = await cropBox();
  L.ok(cb.shown && cb.w > 100 && Math.abs(cb.w / cb.h - 1.5) < 0.02, 'Crop & Straighten shows the whole frame, all of it kept ' + JSON.stringify(cb));
  await tapEl('[data-pasp="1:1"]');
  cb = await cropBox();
  L.ok(Math.abs(cb.w - cb.h) < 1.5 && (await S()).v.asp === '1:1', 'a square: the largest square in it, about the middle ' + JSON.stringify(cb));
  // a corner pulled in: still square, one step
  let h0 = (await S()).hist;
  await drag(cb.x + cb.w - 2, cb.y + cb.h - 2, cb.x + cb.w * 0.7, cb.y + cb.h * 0.8);
  const cb2 = await cropBox();
  L.ok(Math.abs(cb2.w - cb2.h) < 1.5 && cb2.w < cb.w * 0.85 && Math.abs(cb2.x - cb.x) < 1 && Math.abs(cb2.y - cb.y) < 1 && (await S()).hist === h0 + 1, 'a corner dragged in keeps it square, its opposite corner held, as one step ' + JSON.stringify(cb2));
  // moved by its inside, never past the frame
  await drag(cb2.x + cb2.w / 2, cb2.y + cb2.h / 2, cb2.x + cb2.w / 2 - 2000, cb2.y + cb2.h / 2);
  const cb3 = await cropBox(), c3 = (await S()).v.crop;
  L.ok(c3 && Math.abs(c3.x) < 1e-6 && Math.abs(cb3.w - cb2.w) < 1, 'dragged by its inside it moves, and stops at the frame’s edge ' + JSON.stringify(c3));
  // free: a side on its own
  await tapEl('[data-pasp="free"]');
  await drag(cb3.x + cb3.w - 1, cb3.y + cb3.h / 2, cb3.x + cb3.w + 60, cb3.y + cb3.h / 2);
  const cb4 = await cropBox();
  L.ok(cb4.w > cb3.w + 40 && Math.abs(cb4.h - cb3.h) < 1, 'Free: a side dragged moves only that side ' + JSON.stringify(cb4));
  const c4 = (await S()).v.crop, sz = await saved();
  L.ok(Math.abs(sz[0] - Math.round(c4.w * 600)) <= 1 && Math.abs(sz[1] - Math.round(c4.h * 400)) <= 1, 'the saved photo is what the crop keeps ' + sz.join('x'));
  // undo takes the drags back one at a time
  await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  L.ok(JSON.stringify((await S()).v.crop) === JSON.stringify(c3), 'undo takes the last drag back');
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(80);

  // ---- STRAIGHTEN: turned, and filled ----
  await screen(true);
  await setSlider('angle', 6.5);
  const st = await S();
  L.ok(st.v.angle === 6.5 && (await screen()).diff > 1, 'straightening turns the photo, by tenths of a degree ' + st.v.angle);
  const corner = await p.evaluate(async () => { const b = await PaintPhoto.exportBlob({ type: 'png' }), im = await createImageBitmap(b), c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return [...x.getImageData(0, 0, 1, 1).data, ...x.getImageData(c.width - 1, c.height - 1, 1, 1).data]; });
  L.ok(corner[3] === 255 && corner[7] === 255, 'and no corner of the frame is left empty ' + corner.join(','));
  await setSlider('angle', 0);

  // ---- TURNS AND FLIPS ----
  const before = await saved();
  await tapEl('[data-pa="rotr"]');
  const after = await saved();
  L.ok(after[0] === before[1] && after[1] === before[0] && (await S()).v.rot === 1, 'a quarter turn swaps the sides ' + before.join('x') + ' → ' + after.join('x'));
  await tapEl('[data-pa="rotl"]');
  await screen(true);
  await tapEl('[data-pa="fliph"]');
  L.ok((await screen()).diff > 1, 'a flip across changes it');
  await tapEl('[data-pa="fliph"]');
  L.ok((await screen()).diff === 0, 'and flipped back it is exactly as it was');
  await tapEl('[data-pa="flipv"]'); await tapEl('[data-pa="rotr"]'); await tapEl('[data-pa="rotr"]'); await tapEl('[data-pa="fliph"]');
  L.ok((await screen()).diff === 0, 'flipped upside down, turned twice and flipped across is where it began');

  // ---- KEPT: saved and loaded, every setting the same ----
  const v0 = (await S()).v;
  await p.evaluate(() => PaintPhoto.load(PaintPhoto.serialize())); await p.waitForTimeout(500);
  L.ok(JSON.stringify((await S()).v) === JSON.stringify(v0), 'saved and loaded, the crop and the turns are kept');

  // ---- RESET, and DONE ----
  await tapEl('[data-pcat="crop"]');
  await tapEl('[data-pa="cropreset"]');
  const rv = (await S()).v;
  L.ok(!rv.crop && rv.angle === 0 && rv.rot === 0 && !rv.flipH && !rv.flipV && rv.asp === 'orig', 'Reset puts the crop, the angle and the turns back');
  // ---- SHAPES, round and round: each always the same crop, Original the whole frame ----
  const shapes = ['1:1', '4:5', '3:2', '16:9', 'orig'], seen = {};
  let same = true, k0 = (await S()).view.k;
  for (let round = 0; round < 3; round++) for (const a of shapes) {
    await tapEl('[data-pasp="' + a + '"]');
    const c = JSON.stringify((await S()).v.crop), b2 = await cropBox();
    if (round === 0) seen[a] = [c, b2.w.toFixed(1), b2.h.toFixed(1)]; else if (seen[a][0] !== c || seen[a][1] !== b2.w.toFixed(1) || seen[a][2] !== b2.h.toFixed(1)) same = false;
  }
  L.ok(same, 'going round the shapes three times: each gives the very same crop every time ' + JSON.stringify(seen));
  L.ok((await S()).v.crop === null && (await saved()).join('x') === '600x400' && Math.abs((await S()).view.k - k0) < 1e-9, 'Original: the whole frame again, at its full size, the view unmoved');
  const sq = JSON.parse(seen['1:1'][0]);
  L.ok(Math.abs(sq.w * 600 - 400) < 1 && Math.abs(sq.h - 1) < 1e-9 && Math.abs(sq.x - (1 - sq.w) / 2) < 1e-9, 'a square is the largest there is, in the middle of the whole frame ' + JSON.stringify(sq));
  await tapEl('[data-pasp="16:9"]'); await tapEl('[data-pasp="1:1"]');
  L.ok(JSON.stringify((await S()).v.crop) === seen['1:1'][0], 'the square after the widest is the same square, not a smaller one');
  await tapEl('[data-pasp="orig"]');
  await tapEl('[data-pa="cropdone"]');
  L.ok((await S()).cat === 'edit' && await p.$eval('.pho-crop', e => e.hidden), 'Done goes back to the sliders, the crop’s marks gone');
  L.ok((await saved()).join('x') === '600x400', 'the photo whole again');
  await p.screenshot({ path: 'geometry-' + theme + '-' + VW + (touch ? '-touch' : '') + '.png' });
  L.ok(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close();
  L.done();
})().catch(e => { console.log('FAIL', e.stack); process.exit(1); });
