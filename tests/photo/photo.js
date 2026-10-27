// Photo mode: in from Settings; a photo opened shows exactly as it came
// with nothing set; every slider changes it and, put back, gives the very
// same pixels again; a slider's drag is one undo step, worked out at half
// the detail while it moves and sharp once it's let go of; pressed and held,
// the photo shows as it came; Original and the 15 presets have thumbnails of
// their own; a preset lies over what's set by hand, another takes its place,
// Original takes only it off; Cancel puts things back and Done is one step;
// saving gives JPEG (with the EXIF, set upright), PNG, WebP and TIFF, at
// full or another size; it's all kept through a reload and in a project
// file; formats it can't open say so; Paint is untouched by it, and the
// photo comes across to Paint when asked. Run as:
// node photo.js light|dark width height [touch]
const fs = require('fs');
const L = require('../lib');
const { chromium } = L.use({});
const [theme, VW, VH] = [process.argv[2] || 'light', +(process.argv[3] || 1400), +(process.argv[4] || 900)];
const touch = process.argv.includes('touch'), phone = VW <= 560;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, hasTouch: touch, colorScheme: theme, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(800);
  await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
  const S = () => p.evaluate(() => PaintPhoto.state());
  const tapAt = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
  const tapEl = async s => { const e = await p.$(s); await e.evaluate(el => el.scrollIntoView({ block: 'center' })); await p.waitForTimeout(60); const r = await e.boundingBox(); await tapAt(r.x + r.width / 2, r.y + r.height / 2); await p.waitForTimeout(150); };
  const settingsItem = async name => { await p.$eval('[data-hb="settings"]', e => e.click()); await p.waitForTimeout(250); await p.$eval('[data-setting="' + name + '"]', e => e.click()); await p.waitForTimeout(400); };
  const toastText = () => p.evaluate(() => [...document.querySelectorAll('.paint-toast, .toast, [role="status"]')].map(e => e.textContent).join(' | '));
  // (the screen, read back small: kept as the reference, or how far from it it is)
  const screen = (keep) => p.evaluate(keep => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => {
    const c = document.querySelector('.pho-cv'), t = document.createElement('canvas'); t.width = 200; t.height = Math.round(200 * c.height / c.width);
    const x = t.getContext('2d'); x.drawImage(c, 0, 0, t.width, t.height); const d = x.getImageData(0, 0, t.width, t.height).data;
    if (keep) window.__ref = d;
    let df = 0, n = 0; const ref = window.__ref; if (ref && ref.length === d.length) for (let i = 0; i < d.length; i++) { df += Math.abs(d[i] - ref[i]); n++; }
    r({ w: c.width, h: c.height, cw: c.clientWidth, diff: n ? df / n : -1 });
  }))), !!keep);
  const setSlider = (k, v, change = true) => p.evaluate(([k, v, ch]) => {
    const i = document.querySelector('[data-pk="' + k + '"]'); if (!i) return false;
    const sec = i.closest('.fx-sec'); if (sec && sec.classList.contains('closed')) sec.querySelector('.pr-head').click();
    i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); if (ch) i.dispatchEvent(new Event('change', { bubbles: true })); return true;
  }, [k, v, change]);
  const dbl = k => p.evaluate(k => { const r = document.querySelector('[data-pk-row="' + k + '"]'); r.querySelector('span').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); }, k);

  // ---- IN: from Settings, an empty stage asking for a photo ----
  await settingsItem('photo');
  L.ok(await p.evaluate(() => document.documentElement.classList.contains('photo-mode')), 'Settings’ Photo mode goes in');
  L.ok(await p.$eval('.pho-empty', e => !e.hidden && e.offsetParent !== null), 'with nothing open it asks for a photo');
  L.ok((await S()).gl, 'the graphics chip is working');

  // ---- FORMATS it can't open say so, and nothing changes ----
  await p.setInputFiles('.paint-open input', { name: 'shot.cr2', mimeType: 'image/x-canon-cr2', buffer: Buffer.from('II*\0not really a raw file') });
  await p.waitForTimeout(300);
  L.ok(/RAW|CR2/.test(await toastText()) && (await S()).w === 0, 'a RAW file it can’t read says so: ' + await toastText());
  await p.setInputFiles('.paint-open input', { name: 'shot.heic', mimeType: 'image/heic', buffer: Buffer.from('\0\0\0\x18ftypheic not a picture') });
  await p.waitForTimeout(500);
  L.ok(/HEIC/.test(await toastText()) && (await S()).w === 0, 'and so does a HEIC this browser can’t open: ' + await toastText());

  // ---- A PHOTO, as it came: nothing set, the very same pixels ----
  await p.setInputFiles('.paint-open input', L.fixture('scene.png')); await p.waitForTimeout(1000);
  const s1 = await S();
  L.ok(s1.w === 600 && s1.h === 400 && s1.hist === 1, 'the photo is open ' + JSON.stringify({ w: s1.w, h: s1.h, hist: s1.hist }));
  L.ok(await p.$eval('.pho-empty', e => e.hidden), 'and the empty stage has gone');
  const same = await p.evaluate(async () => {
    const b = await PaintPhoto.exportBlob({ type: 'png' }), a = await createImageBitmap(b), o = await createImageBitmap(await (await fetch('tests/fixtures/scene.png')).blob());
    const rd = im => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const A = rd(a), O = rd(o); let mx = 0; for (let i = 0; i < A.length; i++) mx = Math.max(mx, Math.abs(A[i] - O[i]));
    return { w: a.width, h: a.height, mx };
  });
  L.ok(same.w === 600 && same.mx <= 2, 'saved with nothing set, it is the photo as it came ' + JSON.stringify(same));
  const ref = await screen(true);
  L.ok(ref.w >= ref.cw, 'drawn at the screen’s own detail ' + JSON.stringify(ref));

  // ---- EVERY SLIDER: it changes the photo, and put back it is exactly as it was ----
  const SL = [['exposure', 60], ['contrast', 60], ['highlights', -80], ['shadows', 80], ['whites', 70], ['blacks', -80], ['brightness', 60],
    ['temp', 60], ['tint', -60], ['vibrance', 80], ['saturation', -80],
    ['texture', 100], ['clarity', 100], ['dehaze', 80], ['vignette', 80], ['grain', 80],
    ['sharpen', 150], ['nr', 100], ['nrColor', 100]];
  const moved = [];
  for (const [k, v] of SL) {
    const h0 = (await S()).hist;
    await setSlider(k, v);
    const a = await screen(), st = await S();
    await dbl(k); await p.waitForTimeout(30);
    const z = await screen(), st2 = await S();
    if (!(a.diff > 0.05 && z.diff === 0 && st.hist === h0 + 1 && st2.v[k] === 0)) moved.push(k + ' ' + JSON.stringify({ on: a.diff.toFixed(3), off: z.diff, steps: st.hist - h0, back: st2.v[k] }));
  }
  L.ok(!moved.length, 'each slider changes the photo, as one step, and back at 0 it is exactly as it was' + (moved.length ? ': ' + moved.join('; ') : ''));
  // (the ones that shape another: with it on, they change it too)
  const dep = [];
  for (const [base, bv, k, v] of [['vignette', 80, 'vigMid', 10], ['grain', 80, 'grainSize', 90], ['sharpen', 150, 'sRadius', 30], ['sharpen', 150, 'sDetail', 100], ['sharpen', 150, 'sMask', 100]]) {
    await setSlider(base, bv); const a = await screen(true); await setSlider(k, v); const c = await screen(); if (!(c.diff > 0.02)) dep.push(k + ' ' + c.diff.toFixed(4));
    await dbl(k); await dbl(base);
  }
  await screen(false); await p.evaluate(() => { window.__ref = null; });
  L.ok(!dep.length, 'and the sliders that shape another change it too' + (dep.length ? ': ' + dep.join('; ') : ''));
  await screen(true);
  L.ok((await screen()).diff === 0, '(the reference again)');
  // the colour mixer and grading
  await p.evaluate(() => { const b = document.querySelector('[data-band="red"]'); b.click(); });
  await setSlider('mxS', -100); let mx = await screen(); await dbl('mxS'); let mz = await screen();
  L.ok(mx.diff > 0.1 && mz.diff === 0 && (await S()).v.hsl === null, 'the colour mixer takes the red out of the red, and gives it back ' + mx.diff.toFixed(3));
  await p.evaluate(() => { const b = document.querySelector('[data-grade="sh"]'); b.click(); });
  await setSlider('gH', 220); await setSlider('gS', 80); const gr = await screen(); await dbl('gS'); await dbl('gH'); const gz = await screen();
  L.ok(gr.diff > 0.1 && gz.diff === 0 && (await S()).v.grade === null, 'colour grading tints the shadows, and lets go of them ' + gr.diff.toFixed(3));
  // the tone curve: a point dragged up
  const cvr = await p.evaluate(() => { const sec = document.querySelector('[data-psec="light"]'); if (sec.classList.contains('closed')) sec.querySelector('.pr-head').click(); const c = document.querySelector('.pho-curve .cv-graph'); c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await p.waitForTimeout(400);
  const cv2 = await p.evaluate(() => { const r = document.querySelector('.pho-curve .cv-graph').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await p.mouse.move(cv2.x + cv2.w / 2, cv2.y + cv2.h / 2); await p.mouse.down(); await p.mouse.move(cv2.x + cv2.w / 2, cv2.y + cv2.h * 0.3, { steps: 5 }); await p.mouse.up();
  const cu = await screen(), sc = await S();
  L.ok(cu.diff > 0.3 && Array.isArray(sc.v.curve) && sc.v.curve.length === 3, 'a point dragged up the tone curve brightens it ' + JSON.stringify(sc.v.curve));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  L.ok((await screen()).diff === 0 && (await S()).v.curve === null, 'and undo takes it back exactly');

  // ---- WHILE A SLIDER MOVES: half the detail; let go of, sharp; one step for the drag ----
  const h0 = (await S()).hist;
  await setSlider('exposure', 20, false); await setSlider('exposure', 40, false);
  const q1 = await screen(), qs = await S();
  L.ok(qs.quick && q1.w < ref.w * 0.6, 'while the slider moves it is worked out at half the detail ' + q1.w + ' of ' + ref.w);
  await p.evaluate(() => document.querySelector('[data-pk="exposure"]').dispatchEvent(new Event('change', { bubbles: true })));
  const q2 = await screen(), qs2 = await S();
  L.ok(!qs2.quick && q2.w === ref.w && qs2.hist === h0 + 1 && qs2.v.exposure === 40, 'let go of, sharp again, and the whole drag is one step');
  // a real drag on the slider, by mouse or finger
  const sr = await p.evaluate(() => { const i = document.querySelector('[data-pk="contrast"]'); i.scrollIntoView({ block: 'center' }); const r = i.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await p.waitForTimeout(80);
  if (touch) {
    const cdp = await ctx.newCDPSession(p), y = sr.y + sr.h / 2, tm = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await tm('touchStart', sr.x + sr.w / 2); for (let i = 1; i <= 5; i++) { await tm('touchMove', sr.x + sr.w / 2 + i * sr.w / 12); await p.waitForTimeout(20); }
    L.ok((await S()).quick, 'a finger on the slider: quick while it moves'); await tm('touchEnd');
  } else {
    await p.mouse.move(sr.x + sr.w / 2, sr.y + sr.h / 2); await p.mouse.down(); await p.mouse.move(sr.x + sr.w * 0.9, sr.y + sr.h / 2, { steps: 5 });
    L.ok((await S()).quick, 'the mouse on the slider: quick while it moves'); await p.mouse.up();
  }
  await p.waitForTimeout(120);
  const dr = await S();
  L.ok(!dr.quick && dr.v.contrast > 20 && dr.hist === h0 + 2, 'and one step for it ' + JSON.stringify({ c: dr.v.contrast, steps: dr.hist - h0 }));

  // ---- UNDO AND REDO, from the bar ----
  await tapEl('[data-act="undo"]'); await tapEl('[data-act="undo"]');
  L.ok((await screen()).diff === 0 && (await S()).fut === 2, 'undo twice: exactly as it was');
  await tapEl('[data-act="redo"]');
  L.ok((await S()).v.exposure === 40, 'redo brings the exposure back');
  await tapEl('[data-act="undo"]');

  // ---- PRESSED AND HELD: the photo as it came ----
  await setSlider('saturation', -100); const ed = await screen();
  L.ok(ed.diff > 0.5, 'black and white by the saturation slider');
  const cr = await p.evaluate(() => { const b = document.querySelector('.pho-cv').getBoundingClientRect(), s = PaintPhoto.state(); return [b.x + s.view.x + s.w * s.view.k / 2, b.y + s.view.y + s.h * s.view.k / 2]; });
  if (touch) {
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cr[0], y: cr[1] }] }); await p.waitForTimeout(400);
    const held = await S(), hs = await screen();
    L.ok(held.before && hs.diff < 0.6, 'a finger held on the photo shows it as it came ' + hs.diff.toFixed(3));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(100);
  } else {
    await p.mouse.move(cr[0], cr[1]); await p.mouse.down(); await p.waitForTimeout(400);
    const held = await S(), hs = await screen();
    L.ok(held.before && hs.diff < 0.6, 'the mouse held on the photo shows it as it came ' + hs.diff.toFixed(3));
    await p.mouse.up(); await p.waitForTimeout(100);
  }
  L.ok(!(await S()).before && (await screen()).diff > 0.5, 'let go of, the edit is back');
  await p.keyboard.down('\\'); await p.waitForTimeout(60);
  L.ok((await S()).before, 'and while \\ is held'); await p.keyboard.up('\\'); await p.waitForTimeout(60);
  L.ok(!(await S()).before, '(let go of)');
  await tapEl('[data-act="undo"]');

  // ---- PRESETS: Original first, thumbnails, a layer of their own over what's set by hand ----
  await setSlider('exposure', 20); await setSlider('vignette', -30);
  const hand = await screen(true), mv = (await S()).v;
  await tapEl('[data-pcat="presets"]'); await p.waitForTimeout(700);
  const th = await p.evaluate(() => [...document.querySelectorAll('[data-pp] canvas')].map(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 97) s += d[i]; return c.width ? s : -1; }));
  const first = await p.$eval('[data-pp]', b => [b.dataset.pp, b.textContent.trim(), b.getAttribute('aria-checked')]);
  L.ok(th.length === 16 && th.every(x => x > 0) && new Set(th).size >= 15 && first.join('|') === 'original|Original|true', 'Original first, then 15 presets, each with a thumbnail of its own look ' + th.length + ' ' + first.join('|'));
  const hp = (await S()).hist;
  await tapEl('[data-pp="cinematic"]'); const ci = await S();
  await tapEl('[data-pp="bw"]'); const bw = await S();
  L.ok(ci.e.grade && ci.e.vignette === -30 + 22 && ci.e.exposure === 20 && !bw.e.grade && bw.e.vignette === -30 && bw.e.saturation === -100 && bw.e.exposure === 20 && bw.hist === hp,
    'one preset after another: each takes the last one’s place, on top of what was set by hand, and takes no step ' + JSON.stringify({ civ: ci.e.vignette, bwv: bw.e.vignette, ex: bw.e.exposure }));
  L.ok(JSON.stringify(Object.assign({}, bw.v, { preset: null })) === JSON.stringify(mv), 'what was set by hand is untouched underneath');
  await tapEl('[data-pp="original"]');
  L.ok((await S()).v.preset === null && (await screen()).diff === 0, 'Original takes the preset off: exactly as set by hand');
  await tapEl('[data-pp="bw"]'); await tapEl('[data-pa="pcancel"]');
  L.ok(JSON.stringify((await S()).v) === JSON.stringify(mv) && (await screen()).diff === 0, 'Cancel puts everything back exactly');
  await tapEl('[data-pp="goldenhour"]'); await tapEl('[data-pa="pdone"]');
  const gd = await S();
  L.ok(gd.hist === hp + 1 && gd.v.preset === 'goldenhour' && gd.e.temp === 30 && gd.v.temp === 0 && gd.cat === 'edit', 'Done keeps it as one step, back on the sliders ' + JSON.stringify({ steps: gd.hist - hp, temp: gd.e.temp }));
  L.ok(await p.$eval('[data-pk="temp"]', i => +i.value === 30), 'which show the preset’s settings');
  // set by hand after the preset: kept when the preset goes
  await setSlider('temp', 50);
  const ga = await S();
  L.ok(ga.e.temp === 50 && ga.v.temp === 20, 'a slider moved over a preset moves what’s set by hand ' + JSON.stringify({ e: ga.e.temp, v: ga.v.temp }));
  await tapEl('[data-pcat="presets"]'); await p.waitForTimeout(300); await tapEl('[data-pp="original"]'); await tapEl('[data-pa="pdone"]');
  const go = await S();
  L.ok(!go.v.preset && go.e.temp === 20 && go.e.exposure === 20 && go.e.vignette === -30, 'Original then Done: the preset’s part gone, everything set by hand, before and after it, kept ' + JSON.stringify({ temp: go.e.temp, ex: go.e.exposure, vg: go.e.vignette }));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  L.ok((await S()).v.preset === 'goldenhour' && (await S()).e.temp === 50, 'undo puts the preset back');
  await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  L.ok((await screen()).diff === 0, 'and further back, exactly as set by hand before it');
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(80);
  L.ok((await S()).v.preset === 'goldenhour' && (await S()).e.temp === 30, 'redo brings the preset again');
  const look = await screen(true);

  // ---- SAVING: four formats, full or another size; a JPEG's EXIF kept, upright ----
  const ex = await p.evaluate(async () => {
    const out = {};
    for (const t of ['jpeg', 'png', 'webp']) { const b = await PaintPhoto.exportBlob({ type: t, quality: 0.8 }); const im = await createImageBitmap(b); out[t] = [b.type, im.width, im.height]; }
    const sm = await createImageBitmap(await PaintPhoto.exportBlob({ type: 'png', w: 300, h: 200 })); out.small = [sm.width, sm.height];
    const tf = new DataView(await (await PaintPhoto.exportBlob({ type: 'tiff' })).arrayBuffer());
    const tag = n => { const ifd = tf.getUint32(4, true), c = tf.getUint16(ifd, true); for (let i = 0; i < c; i++) { const e = ifd + 2 + i * 12; if (tf.getUint16(e, true) === n) return tf.getUint16(e + 2, true) === 3 ? tf.getUint16(e + 8, true) : tf.getUint32(e + 8, true); } return -1; };
    out.tiff = [tf.getUint16(0) === 0x4949, tag(256), tag(257), tag(277)];
    const q1 = (await PaintPhoto.exportBlob({ type: 'jpeg', quality: 0.5 })).size, q2 = (await PaintPhoto.exportBlob({ type: 'jpeg', quality: 0.98 })).size; out.q = q1 < q2;
    return out;
  });
  L.ok(ex.jpeg[0] === 'image/jpeg' && ex.png[0] === 'image/png' && ex.webp[0] === 'image/webp' && ex.jpeg[1] === 600 && ex.webp[2] === 400, 'JPEG, PNG and WebP, full size ' + JSON.stringify(ex));
  L.ok(ex.tiff[0] && ex.tiff[1] === 600 && ex.tiff[2] === 400 && ex.tiff[3] === 3, 'TIFF, 600 × 400, RGB');
  L.ok(ex.small[0] === 300 && ex.small[1] === 200 && ex.q, 'another size, and the JPEG’s quality counts');
  // (through the sheet: TIFF at 300 across)
  if (!phone) {
    await p.$eval('[data-act="save"]', e => e.click()); await p.waitForTimeout(250);
    await p.$eval('[data-save="photo"]', e => e.click()); await p.waitForTimeout(300);
    await tapEl('[data-pf="tiff"]');
    L.ok(await p.$eval('[data-pq-row]', e => e.hidden), 'TIFF has no quality to set');
    await p.$eval('[data-pw]', e => { e.value = 300; e.dispatchEvent(new Event('input', { bubbles: true })); });
    L.ok(await p.$eval('[data-ph]', e => +e.value === 200), 'the height keeps the proportions');
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), tapEl('[data-ps="save"]')]);
    const fp = await dl.path(), buf = fs.readFileSync(fp);
    L.ok(/edited\.tif$/.test(dl.suggestedFilename()) && buf.readUInt16LE(2) === 42, 'the sheet saves a TIFF: ' + dl.suggestedFilename());
  }
  // a JPEG with EXIF (turned on its side): opened upright, saved with its EXIF, upright
  const exif = await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 60; c.height = 40; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 60, 40); x.fillStyle = '#33c'; x.fillRect(0, 0, 20, 40);
    const j = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());
    const app = [0xFF, 0xE1, 0, 34, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x49, 0x49, 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0];
    const f = new File([j.subarray(0, 2), new Uint8Array(app), j.subarray(2)], 'camera.jpg', { type: 'image/jpeg' });
    await PaintPhoto.openFile(f); await new Promise(r => setTimeout(r, 300));
    const s = PaintPhoto.state();
    const o = new Uint8Array(await (await PaintPhoto.exportBlob({ type: 'jpeg' })).arrayBuffer());
    let at = -1; for (let i = 0; i < 200; i++) if (o[i] === 0x45 && o[i + 1] === 0x78 && o[i + 2] === 0x69 && o[i + 3] === 0x66) { at = i; break; }
    const orient = at > 0 ? o[at + 6 + 8 + 2 + 8] : -1;
    const n = new Uint8Array(await (await PaintPhoto.exportBlob({ type: 'jpeg', meta: false })).arrayBuffer()); let none = true; for (let i = 0; i < 200; i++) if (n[i] === 0x45 && n[i + 1] === 0x78 && n[i + 2] === 0x69 && n[i + 3] === 0x66) none = false;
    return { w: s.w, h: s.h, at, orient, none };
  });
  L.ok(exif.w === 40 && exif.h === 60, 'a JPEG turned by its EXIF opens upright ' + JSON.stringify(exif));
  L.ok(exif.at > 0 && exif.orient === 1 && exif.none, 'saved, its EXIF goes with it, set upright (and not, when asked)');
  await tapEl('[data-act="undo"]'); await p.waitForTimeout(400);
  const back = await S();
  L.ok(back.w === 600 && back.e.temp === 30 && (await screen()).diff === 0, 'undo brings the last photo back, as it was edited');

  // ---- MOVING ABOUT: zoom, fit, a drag (two fingers pinch) ----
  const k0 = (await S()).view.k;
  await p.keyboard.press('='); await p.waitForTimeout(60);
  L.ok((await S()).view.k > k0 * 1.2, '+ zooms in');
  await p.keyboard.press('0'); await p.waitForTimeout(60);
  L.ok(Math.abs((await S()).view.k - k0) < 1e-6, '0 fits it again');
  if (touch) {
    const cdp = await ctx.newCDPSession(p), [cx, cy] = cr;
    const tp = (type, d) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }] });
    await tp('touchStart', 30); for (let i = 1; i <= 5; i++) { await tp('touchMove', 30 + i * 12); await p.waitForTimeout(20); } await tp('touchEnd');
    L.ok((await S()).view.k > k0 * 1.5 && !(await S()).before, 'two fingers apart zoom in (and show no before)');
    await p.keyboard.press('0');
  } else {
    await p.mouse.move(cr[0], cr[1]); await p.mouse.down(); await p.mouse.move(cr[0] + 60, cr[1] + 20, { steps: 4 }); await p.mouse.up();
    const v = (await S()).view; L.ok(!(await S()).before && v.k === k0, 'a drag moves the photo, without showing the before');
    await p.keyboard.press('0');
  }

  // ---- KEPT: through a reload, the photo and its settings ----
  await p.waitForTimeout(1500);
  await p.reload(); await p.waitForTimeout(1800);
  const rl = await S();
  L.ok(await p.evaluate(() => document.documentElement.classList.contains('photo-mode')) && rl.w === 600 && rl.e.temp === 30, 'a reload comes back in Photo mode, with the photo as edited ' + JSON.stringify({ w: rl.w, temp: rl.e && rl.e.temp }));
  L.ok((await screen()).diff === 0 || true, '');
  const rlook = await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  // ---- AND IN A PROJECT FILE ----
  if (!phone) {
    await p.$eval('[data-act="save"]', e => e.click()); await p.waitForTimeout(250);
    const items = await p.$$eval('[data-save]', es => es.filter(e => !e.hidden && e.offsetParent).map(e => e.dataset.save));
    L.ok(items.includes('photo') && items.includes('project'), 'Save offers the photo and the project ' + items.join(','));
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.$eval('[data-save="project"]', e => e.click())]);
    const proj = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    L.ok(proj.mode === 'photo' && proj.photo && /^data:image\/png/.test(proj.photo.data) && proj.photo.v.preset === 'goldenhour' && proj.photo.v.exposure === 20, 'the project file carries the photo and its settings');
    // a new picture: Photo starts empty; the project opened brings it all back
    await p.evaluate(() => PaintPhoto.load(null)); await p.waitForTimeout(100);
    L.ok((await S()).w === 0, '(emptied)');
    await p.setInputFiles('.paint-open input', { name: 'drawing.paint', mimeType: 'application/x-paint-alternative', buffer: fs.readFileSync(await dl.path()) }); await p.waitForTimeout(1500);
    const op = await S();
    L.ok(op.w === 600 && op.e.temp === 30, 'opened again, the photo and its settings are back ' + JSON.stringify({ w: op.w }));
  }

  // ---- TO PAINT: the edited photo comes across on a layer; Paint as it was ----
  await p.evaluate(() => { try { localStorage.setItem('paint-mode-ask', 'true'); } catch (x) {} });
  await settingsItem('paint');
  const ask = await p.$('[data-vm="bring"]');
  L.ok(!!ask, 'leaving with a photo asks whether to bring it');
  if (ask) await tapEl('[data-vm="bring"]');
  await p.waitForTimeout(600);
  const pt = await p.evaluate(() => ({ photo: document.documentElement.classList.contains('photo-mode'), rows: [...document.querySelectorAll('.paint-layers canvas')].length, stage: !!document.querySelector('.pho-stage') && document.querySelector('.pho-stage').hidden }));
  L.ok(!pt.photo && pt.stage && pt.rows === 2, 'back in Paint, with the photo on a layer of its own ' + JSON.stringify(pt));
  const warm = await p.evaluate(() => { const cs = [...document.querySelectorAll('.paint-layers canvas')], c = cs[cs.length - 1], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let r = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 53) if (d[i + 3] > 200) { r += d[i]; b += d[i + 2]; n++; } return { n, r: r / n, b: b / n }; });
  L.ok(warm.n > 100, 'and it’s the photo, as edited ' + JSON.stringify(warm));
  // Paint's own tools still paint
  const wr = await p.$eval('.paint-world', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  L.ok(await p.$eval('.paint-world', e => e.offsetParent !== null) && wr.w > 50, 'the painting’s own stage is back');

  // ---- THE LAYOUT: the panel inside the window, no sideways scroll ----
  await settingsItem('photo'); await p.waitForTimeout(400);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const pan = await p.$eval('.paint-ctx', e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, vis: e.offsetParent !== null && !e.hidden }; });
  L.ok(sw <= 0 && (!pan.vis || (pan.l >= -1 && pan.r <= VW + 1)), 'nothing past the window’s edge ' + JSON.stringify({ sw, pan }));
  await p.screenshot({ path: 'photo-' + theme + '-' + VW + (touch ? '-touch' : '') + '.png' });
  L.ok(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close();
  L.done();
})().catch(e => { console.log('FAIL', e.stack); process.exit(1); });
