// The decoders: what a browser can't open by itself. A RAW (a DNG made by
// tests/fixtures/make_photo_fixtures.py: a 16-bit RGGB mosaic of the test
// scene), a TIFF (zip-compressed) and a HEIC (an HEVC picture in a HEIF file)
// each decode to the scene, 240 x 160: the sky blue at the top, the circle
// red, the square blue. In Photo mode each opens as the photo, and a RAW
// comes back after a reload; a file that isn't a real RAW says so and
// changes nothing; in Paint a TIFF and a HEIC come in as pictures on a
// layer of their own. Run as: node decoders.js light|dark width height [touch]
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
  const toastText = () => p.evaluate(() => [...document.querySelectorAll('.paint-toast, .toast, [role="status"]')].map(e => e.textContent).join(' | '));
  const near = (a, b, d) => a.every((v, i) => Math.abs(v - b[i]) <= d);

  // ---- EACH DECODER, by itself: the scene, as drawn ----
  for (const [f, tol] of [['scene.dng', 40], ['scene.tif', 1], ['scene.heic', 12]]) {
    const r = await p.evaluate(async f => {
      const blob = await (await fetch('tests/fixtures/' + f)).blob(), file = new File([blob], f), t0 = performance.now();
      const d = await window.PaintDecoders.decode(file);
      const c = document.createElement('canvas'); c.width = d.w; c.height = d.h; const x = c.getContext('2d'); x.drawImage(d.el, 0, 0);
      const at = (px, py) => Array.from(x.getImageData(px, py, 1, 1).data.slice(0, 3));
      return { w: d.w, h: d.h, sky: at(10, 8), circle: at(60, 80), square: at(175, 80), ms: Math.round(performance.now() - t0), meta: d.meta || null };
    }, f).catch(e => ({ err: e.message }));
    L.ok(!r.err && r.w === 240 && r.h === 160, f + ': decodes, 240 x 160 ' + JSON.stringify({ w: r.w, h: r.h, err: r.err, ms: r.ms }));
    if (r.err) continue;
    const red = r.circle[0] > 180 && r.circle[1] < 80 && r.circle[2] < 80, blue = r.square[2] > 120 && r.square[0] < 70 && r.square[1] < 70, sky = r.sky[2] > r.sky[1] && r.sky[1] > r.sky[0];
    L.ok(red && blue && sky, f + ': the circle red, the square blue, the sky blue ' + JSON.stringify({ sky: r.sky, circle: r.circle, square: r.square }));
    L.ok(near(r.circle, [226, 40, 36], tol) && near(r.square, [30, 32, 170], tol), f + ': and close to the colours drawn (within ' + tol + ')');
    if (f === 'scene.dng') L.ok(r.meta && r.meta.make === 'Paint Alternative', 'scene.dng: what the camera says comes with it ' + JSON.stringify(r.meta));
  }

  // ---- PHOTO MODE: each opens as the photo ----
  const settingsItem = async name => { await p.$eval('[data-hb="settings"]', e => e.click()); await p.waitForTimeout(250); await p.$eval('[data-setting="' + name + '"]', e => e.click()); await p.waitForTimeout(500); };
  await settingsItem('photo');
  const S = () => p.evaluate(() => PaintPhoto.state());
  for (const f of ['scene.tif', 'scene.heic', 'scene.dng']) {
    await p.setInputFiles('.paint-open input', L.fixture(f));
    await p.waitForFunction(n => PaintPhoto.state().w === 240 && document.querySelector('.pho-empty').hidden, f, { timeout: 15000 }).catch(() => {});
    const s = await S();
    L.ok(s.w === 240 && s.h === 160, 'Photo mode opens ' + f + ' ' + JSON.stringify({ w: s.w, h: s.h, toast: await toastText() }));
    await p.evaluate(() => { const s = PaintPhoto.state(); window.__w = s.w; });
    // (a new photo for the next: the empty stage again)
    await p.evaluate(() => PaintPhoto.load(null)); await p.waitForTimeout(150);
  }
  // a RAW, kept: it comes back after a reload
  await p.setInputFiles('.paint-open input', L.fixture('scene.dng'));
  await p.waitForFunction(() => PaintPhoto.state().w === 240, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(800); await p.waitForFunction(() => document.querySelector('.doc-status').dataset.state === 'saved', null, { timeout: 15000 }).catch(() => {});
  await p.reload(); await p.waitForFunction(() => !document.querySelector('.app-splash'), null, { timeout: 15000 }).catch(() => {});
  await p.waitForFunction(() => window.PaintPhoto && PaintPhoto.state().w === 240, null, { timeout: 15000 }).catch(() => {});
  const rl = await S();
  L.ok(rl.w === 240 && rl.h === 160 && await p.evaluate(() => document.documentElement.classList.contains('photo-mode')), 'after a reload the RAW photo is back, in Photo mode ' + JSON.stringify({ w: rl.w, h: rl.h }));
  // a file that only says it's a RAW
  await p.setInputFiles('.paint-open input', { name: 'shot.nef', mimeType: 'image/x-nikon-nef', buffer: Buffer.from('MM\0*not a raw file at all') });
  await p.waitForTimeout(1500);
  const t = await toastText();
  L.ok(/NEF/.test(t) && /couldn’t/.test(t) && (await S()).w === 240, 'a broken RAW says so, and the photo stays: ' + t);

  // ---- PAINT: a TIFF and a HEIC come in as pictures ----
  await settingsItem('paint');
  const sw = await p.$('.paint-docpanel:not([hidden]) [data-vm="switch"]'); if (sw) { await sw.click(); await p.waitForTimeout(400); }
  const layersN = () => p.evaluate(() => document.querySelectorAll('.paint-layers canvas').length);
  for (const f of ['scene.tif', 'scene.heic']) {
    const n0 = await layersN();
    await p.setInputFiles('.paint-open input', L.fixture(f));
    await p.waitForFunction(n => document.querySelectorAll('.paint-layers canvas').length > n, n0, { timeout: 15000 }).catch(() => {});
    await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    L.ok(await layersN() === n0 + 1, 'Paint: ' + f + ' comes in on a layer of its own');
  }
  const red = await p.evaluate(() => { const cs = [...document.querySelectorAll('.paint-layers canvas')], c = cs[cs.length - 1], x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 80 && d[i + 2] < 80) n++; return n; });
  L.ok(red > 500, 'and it’s the scene: the red circle is there (' + red + ' red pixels)');

  L.ok(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close(); L.done();
})();
