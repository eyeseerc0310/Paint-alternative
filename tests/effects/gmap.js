// The Gradient Map in Effects: Original and ten presets, two across, each a
// small copy of the layer with it laid over, then the user's own; a preset
// picked fills the editor with its stops and is laid over the picture,
// another takes its place (nothing adds up) and Original takes only it off;
// the bar adds a stop with a tap, moves one, takes one away dragged off,
// sixteen at most, and its diamonds move where two colours meet; the
// picked stop's colour and place can be typed, Reverse runs it the other
// way, Reset puts the preset back as it came (the preset itself never
// changes); Strength 0 leaves only its light and dark, Opacity 0 nothing;
// the interpolations and the six blend modes each look their own, and the
// graphics chip and the worker work them out alike; Save Custom Gradient
// keeps it, named, through a reload, to rename or delete; a second tap on a
// stop opens the colour picker on it, Effects stepping aside and coming
// back as they were; inside a selection only it changes; Done is one undo
// step. Run as:
// node gmap.js light|dark width height [touch]
const L = require('../lib');
const { chromium } = L.use({});
const [theme, VW, VH] = [process.argv[2] || 'light', +(process.argv[3] || 1400), +(process.argv[4] || 900)];
const touch = process.argv.includes('touch');
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
const NAMES = ['Original', 'Classic B&W', 'Sepia', 'Cinematic Teal', 'Golden Hour', 'Midnight', 'Duotone', 'Forest', 'Vintage Film', 'Cyberpunk', 'Thermal'];
(async () => {
  const b = await chromium.launch();
  // one page as it would be (here, software WebGL: the worker), and the comparisons on the graphics chip as well
  const page = async (gpu) => {
    const ctx = await b.newContext({ viewport: { width: VW, height: VH }, hasTouch: touch, colorScheme: theme });
    if (gpu) await ctx.addInitScript(g => { try { localStorage.setItem('paint-fx-gpu', g); } catch (x) {} }, gpu);
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.stack || e.message));
    await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(800);
    await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    return { ctx, p };
  };
  const { ctx, p } = await page(null);
  const tapAt = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
  const tapEl = async (s, pp) => { pp = pp || p; const e = await pp.$(s); await e.evaluate(el => el.scrollIntoView({ block: 'center' })); await pp.waitForTimeout(50); const r = await e.boundingBox(); if (touch && pp === p) await pp.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); else await pp.mouse.click(r.x + r.width / 2, r.y + r.height / 2); await pp.waitForTimeout(160); };
  const cdp = touch ? await ctx.newCDPSession(p) : null;
  const tch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const drag = async (x0, y0, x1, y1) => {
    // (a finger waits a moment before it starts anything on the picture)
    if (touch) { await tch('touchStart', x0, y0); await p.waitForTimeout(260); for (let i = 1; i <= 8; i++) { await tch('touchMove', x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8); await p.waitForTimeout(16); } await tch('touchEnd'); }
    else { await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, { steps: 8 }); await p.mouse.up(); }
    await p.waitForTimeout(120);
  };
  // (the picture's layer: a sample of its pixels, and a sum of all of them)
  const layer = (pp) => (pp || p).evaluate(() => { const cs = [...document.querySelectorAll('.paint-layers canvas')], c = cs[cs.length - 1], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; const smp = [];
    for (let i = 0; i < d.length; i += 4) { s = (s * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1000000007; if (i % (4 * 211) === 0) smp.push(d[i], d[i + 1], d[i + 2]); } return { s, smp, w: c.width, h: c.height }; });
  const near = (a, b2, tol) => { let mx = 0; for (let i = 0; i < a.length; i++) mx = Math.max(mx, Math.abs(a[i] - b2[i])); return mx <= tol ? true : mx; };
  const S = (sel, pp) => (pp || p).$(sel);
  const setIn = (sel, v, ev, pp) => (pp || p).$eval(sel, (e, [v, ev]) => { e.value = v; e.dispatchEvent(new Event(ev || 'input', { bubbles: true })); if (!ev) e.dispatchEvent(new Event('change', { bubbles: true })); }, [v, ev]);
  const gm = (pp) => (pp || p).evaluate(() => {
    const sec = document.querySelector('.fx-sec[data-fx="gmap"]'), bar = sec.querySelector('[data-gmbar]');
    return { on: (sec.querySelector('[data-gm][aria-checked="true"]') || {}).dataset?.gm, changed: sec.classList.contains('changed'), off: sec.querySelector('.gm-edit').classList.contains('gm-off'),
      stops: bar.querySelectorAll('b').length, mids: bar.querySelectorAll('u').length, hex: sec.querySelector('[data-gmhex]').value, pos: +sec.querySelector('[data-gmpos]').value, gb: bar.firstChild.style.getPropertyValue('--gb'),
      customs: [...sec.querySelectorAll('.gm-cgrid [data-gm] span')].map(s => s.textContent), open: !document.querySelector('.paint-adjust:not(.paint-studio)').hidden };
  });
  // (Effects open on the Gradient Map; the others folded, so it's in view)
  const fxOpen = async (pp) => {
    pp = pp || p;
    if (await pp.$eval('.paint-adjust:not(.paint-studio)', a => a.hidden)) await pp.$eval('[data-act="adjust"]', e => e.click()); // (with a selection on a phone, its panel stands over the left bar)
    await pp.waitForTimeout(300);
    await pp.evaluate(() => document.querySelectorAll('.fx-sec').forEach(s => { const want = s.dataset.fx === 'gmap'; if (s.classList.contains('closed') === want) s.querySelector('.pr-head').click(); }));
    await pp.waitForTimeout(400);
  };
  const done = async (pp) => { pp = pp || p; await tapEl('[data-adj-act="done"]', pp); await pp.waitForFunction(() => !document.querySelector('.paint-adjust:not(.paint-studio)').dataset.finishing, null, { timeout: 20000 }); await pp.waitForTimeout(250); };
  const undo = async (pp) => { pp = pp || p; await pp.keyboard.press(MOD + '+z'); await pp.waitForTimeout(250); };
  const barIn = () => p.$eval('[data-gmbar]', e => { const r = e.getBoundingClientRect(); if (r.top < 60 || r.bottom > innerHeight - 60) e.scrollIntoView({ block: 'center' }); });
  const barAt = async (f, dy) => { await barIn(); const r = await (await S('[data-gmbar]')).boundingBox(); return [r.x + 10 + (r.width - 20) * f, r.y + (dy == null ? r.height * 0.6 : dy)]; };
  const stopAt = async (i) => { await barIn(); return p.$eval('[data-gmbar]', (bar, i) => { const r = bar.getBoundingClientRect(), m = bar.querySelectorAll('b')[i].getBoundingClientRect(); return [m.x + m.width / 2, m.y + m.height / 2, r.y]; }, i); };
  // a photo on its own layer, laid down
  const open = async (pp) => { pp = pp || p; await pp.setInputFiles('.paint-open input', L.fixture('scene.png')); await pp.waitForTimeout(1200); await pp.keyboard.press('Enter'); await pp.waitForTimeout(300); };
  await open();
  const base = await layer();
  await fxOpen();

  // ---- THE PRESETS: Original and ten, two across, each with this layer under it ----
  const tiles = await p.$$eval('.gm-grid:not(.gm-cgrid) [data-gm]', bs => bs.map(b => { const c = b.querySelector('canvas'), r = b.getBoundingClientRect(); let s = 0; if (c.width) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4 * 7) s = (s * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1000000007; }
    return { name: b.querySelector('span').textContent, x: Math.round(r.x), s, on: b.getAttribute('aria-checked') }; }));
  L.ok(tiles.map(t => t.name).join('|') === NAMES.join('|'), 'Original, then exactly the ten presets ' + tiles.map(t => t.name).join(', '));
  L.ok(new Set(tiles.map(t => t.x)).size === 2, 'two across');
  L.ok(tiles.every(t => t.s) && new Set(tiles.map(t => t.s)).size === tiles.length, 'each with a thumbnail of this layer, with that preset over it, each its own');
  let g = await gm();
  L.ok(g.on === '' && g.off && !g.changed, 'to begin with: Original, the editor greyed out, nothing changed');

  // ---- A PRESET: picked, in the editor, laid over; Done is one step ----
  await tapEl('[data-gm="sepia"]');
  g = await gm();
  L.ok(g.on === 'sepia' && !g.off && g.changed && g.stops === 4 && g.mids === 3 && g.hex === '#1c0e06' && g.pos === 0, 'Sepia: picked, its four stops (and three midpoints) in the editor ' + JSON.stringify(g));
  await done();
  const sepia = await layer();
  L.ok(sepia.s !== base.s, 'Done lays it over the picture');
  await undo();
  L.ok((await layer()).s === base.s, 'one undo step takes it all back');
  await fxOpen();
  await tapEl('[data-gm="teal"]'); await tapEl('[data-gm="sepia"]'); await done();
  L.ok((await layer()).s === sepia.s, 'another preset takes the last one’s place: Teal then Sepia is exactly Sepia');
  await undo(); await fxOpen();

  // ---- ORIGINAL takes only the gradient map off ----
  await setIn('[data-adj="exposure"]', 40); await done(); const expo = await layer(); await undo(); await fxOpen();
  await setIn('[data-adj="exposure"]', 40); await tapEl('[data-gm="golden"]'); await tapEl('[data-gm=""]');
  L.ok((await gm()).on === '' && (await gm()).off, 'Original: the gradient map off');
  await done();
  L.ok((await layer()).s === expo.s, 'and what else was set stays: exactly the exposure alone');
  await undo(); await fxOpen();

  // ---- THE EDITOR ----
  await tapEl('[data-gm="sepia"]');
  // a tap on the bar between two stops adds one there, picked
  let [x, y] = await barAt(0.57); await tapAt(x, y); await p.waitForTimeout(150);
  g = await gm();
  L.ok(g.stops === 5 && g.mids === 4 && Math.abs(g.pos - 57) <= 2, 'a tap on the bar adds a stop there, picked ' + JSON.stringify({ stops: g.stops, pos: g.pos }));
  // dragged along, it moves; dragged off, it's gone
  let st = await stopAt(2); await drag(st[0], st[1], st[0] + 12, st[1]);
  const moved = (await gm()).pos;
  L.ok(moved > 59, 'dragged along, it moves ' + moved);
  st = await stopAt(2); await drag(st[0], st[1], st[0], st[1] + 90);
  L.ok((await gm()).stops === 4, 'dragged off the bar, it’s taken away');
  // a diamond moves where its two colours meet
  const gb0 = (await gm()).gb;
  await barIn(); const dm = await p.$eval('[data-gmbar] u', u => { const r = u.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await drag(dm[0], dm[1], dm[0] + 25, dm[1]);
  L.ok((await gm()).gb !== gb0, 'a midpoint dragged changes where the colours meet');
  // the picked stop's colour and place, typed
  await setIn('[data-gmhex]', '#ff0000', 'change');
  await setIn('[data-gmpos]', '20', 'change');
  g = await gm();
  L.ok(g.hex === '#ff0000' && g.pos === 20, 'the picked stop’s colour and place can be typed ' + JSON.stringify({ hex: g.hex, pos: g.pos }));
  // Reverse runs it the other way; twice, as it was
  const before = await gm(); await tapEl('[data-gm-act="rev"]'); const rev = await gm(); await tapEl('[data-gm-act="rev"]'); const back = await gm();
  L.ok(rev.gb !== before.gb && back.gb === before.gb && rev.pos === 80, 'Reverse runs the gradient the other way (twice: as it was) ' + rev.pos);
  // the delete button
  await tapEl('[data-gm-act="del"]');
  L.ok((await gm()).stops === 3, 'the delete button takes the picked stop away');
  // Reset: the preset as it came
  await tapEl('[data-gm-act="reset"]');
  g = await gm();
  L.ok(g.stops === 4 && g.hex === '#1c0e06', 'Reset puts the preset back as it came');
  // the preset itself never changes
  [x, y] = await barAt(0.2); await tapAt(x, y); await tapEl('[data-gm="teal"]'); await tapEl('[data-gm="sepia"]');
  L.ok((await gm()).stops === 4, 'changing it never changes the preset: picked again, it’s as it came');
  // sixteen stops at most: on Classic B&W, a stop added in the middle and typed to the left, again and again, then a tap on the space that's left
  await tapEl('[data-gm="bw"]');
  for (let k = 1; k <= 14; k++) { [x, y] = await barAt(0.5); await tapAt(x, y); await p.waitForTimeout(420); await setIn('[data-gmpos]', String(k * 3), 'change'); }
  const s16 = (await gm()).stops; [x, y] = await barAt(0.75); await tapAt(x, y); await p.waitForTimeout(300);
  L.ok(s16 === 16 && (await gm()).stops === 16, 'sixteen stops at most ' + s16 + ' ' + (await gm()).stops);
  await tapEl('[data-gm-act="reset"]');

  // ---- STRENGTH AND OPACITY ----
  const more = async () => { if (await p.$eval('.gm-more', m => m.getAttribute('aria-expanded') !== 'true')) await tapEl('.gm-more'); };
  await setIn('[data-adj="gms"]', 0); await done();
  const grey = await p.evaluate(() => { const cs = [...document.querySelectorAll('.paint-layers canvas')], c = cs[cs.length - 1], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let off = 0; for (let i = 0; i < d.length; i += 4 * 13) if (d[i + 3] && (Math.abs(d[i] - d[i + 1]) > 2 || Math.abs(d[i + 1] - d[i + 2]) > 2)) off++; return off; });
  L.ok(grey === 0, 'Strength 0: only the gradient’s light and dark, no colour ' + grey);
  await undo(); await fxOpen(); await tapEl('[data-gm="sepia"]'); await more();
  await setIn('[data-adj="gmo"]', 0); await done();
  L.ok((await layer()).s === base.s, 'Opacity 0: nothing changes');
  await undo(); await fxOpen();

  // ---- INTERPOLATION AND BLEND: each its own; the graphics chip and the worker alike ----
  const looks = async (pp) => {
    const out = {};
    for (const [k, sel, v] of [['linear', '[data-gmi="linear"]'], ['smooth', '[data-gmi="smooth"]'], ['perceptual', '[data-gmi="perceptual"]'],
      ['multiply', '[data-gmb]', 'multiply'], ['screen', '[data-gmb]', 'screen'], ['overlay', '[data-gmb]', 'overlay'], ['soft', '[data-gmb]', 'soft'], ['colour', '[data-gmb]', 'colour']]) {
      await fxOpen(pp); await tapEl('[data-gm="thermal"]', pp);
      if (await pp.$eval('.gm-more', m => m.getAttribute('aria-expanded') !== 'true')) await tapEl('.gm-more', pp);
      if (v) await setIn(sel, v, 'change', pp); else await tapEl(sel, pp);
      await done(pp); out[k] = await layer(pp); await undo(pp);
    }
    return out;
  };
  const mine = await looks(p);
  L.ok(new Set(Object.values(mine).map(q => q.s)).size === 8, 'the three interpolations and the five other blends each look their own');
  const G = await page('on'); await open(G.p);
  const chip = await looks(G.p);
  const diff = Object.keys(mine).map(k => [k, near(mine[k].smp, chip[k].smp, 3)]).filter(q => q[1] !== true);
  L.ok(!diff.length, 'the graphics chip and the worker work them out alike (within 3 of 255)' + (diff.length ? ': ' + JSON.stringify(diff) : ''));
  L.ok(!G.p.errs.length, 'no errors on the graphics chip ' + G.p.errs.join(' | '));
  await G.ctx.close();

  // ---- THE STOP'S COLOUR IN THE PICKER: Effects step aside, and come back as they were ----
  await fxOpen(); await tapEl('[data-gm="duotone"]');
  st = await stopAt(1); await tapAt(st[0], st[1]); await p.waitForTimeout(120); await tapAt(st[0], st[1]); await p.waitForTimeout(300);
  const pk = await p.evaluate(() => { const pc = document.querySelector('.paint-colorpanel'); return { shown: !pc.hidden, gm: pc.classList.contains('pc-gm'), fx: !document.querySelector('.paint-adjust:not(.paint-studio)').hidden }; });
  L.ok(pk.shown && pk.gm && !pk.fx, 'a second tap on a stop opens the colour picker on it, Effects stepping aside ' + JSON.stringify(pk));
  const sw = await p.$('.paint-colorpanel [data-pc-color]');
  const pcCol = sw ? await sw.evaluate(e => e.dataset.pcColor) : null;
  if (sw) { await sw.evaluate(e => e.scrollIntoView({ block: 'center' })); await tapEl('.paint-colorpanel [data-pc-color]'); }
  await tapEl('.paint-colorpanel [data-pc-act="gmdone"]');
  g = await gm();
  L.ok(g.open && g.on === 'duotone' && (!pcCol || g.hex.toLowerCase() === pcCol.toLowerCase()), 'closed, Effects are back as they were, the stop in the colour picked ' + JSON.stringify({ open: g.open, on: g.on, hex: g.hex, picked: pcCol }));
  // (a press away from the picker closes it too, and Effects stay)
  st = await stopAt(1); await tapAt(st[0], st[1]); await p.waitForTimeout(120); await tapAt(st[0], st[1]); await p.waitForTimeout(300);
  // (somewhere with nothing on it: not a control, not the picture, not the picker)
  const away = await p.evaluate(() => { for (let y = 8; y < innerHeight; y += 12) for (let x = 4; x < innerWidth; x += 12) { const e = document.elementFromPoint(x, y);
    if (e && !e.closest('button, input, select, label, a, .paint-stage, .paint-colorpanel, .paint-adjust, .paint-ctx, .paint-bottom, .site-header, .paint-left, [data-tip]')) return [x, y]; } return [2, 2]; });
  await tapAt(away[0], away[1]); await p.waitForTimeout(300);
  g = await gm();
  const pcGone = await p.$eval('.paint-colorpanel', e => e.hidden);
  L.ok(g.open && g.on === 'duotone' && pcGone, 'a press away from the picker closes it, and Effects stay open as they were');
  await done(); L.ok((await layer()).s !== base.s, '(and Done still lays it down)'); await undo(); await fxOpen();

  // ---- THE USER'S OWN: saved, named, kept through a reload, renamed, deleted ----
  await tapEl('[data-gm="forest"]'); await more(); await setIn('[data-gmb]', 'overlay', 'change'); await setIn('[data-adj="gms"]', 70);
  await tapEl('[data-gm-act="save"]'); await p.waitForTimeout(150);
  const nm = await p.$('.gm-cgrid .gm-name'); L.ok(!!nm, 'Save Custom Gradient: a new one of my own, its name ready to type');
  if (nm) { await nm.fill('My Forest'); await nm.press('Enter'); }
  g = await gm();
  L.ok(g.customs.join('|') === 'My Forest' && /^c:/.test(g.on), 'in the Custom section, named, and picked ' + JSON.stringify(g.customs));
  const kept = await p.evaluate(() => JSON.parse(localStorage.getItem('paint-gmaps') || '[]'));
  L.ok(kept.length === 1 && kept[0].name === 'My Forest' && kept[0].gmb === 'overlay' && kept[0].gms === 70 && kept[0].g.s.length === 4, 'kept with all of its settings ' + JSON.stringify(kept[0] && { name: kept[0].name, gmb: kept[0].gmb, gms: kept[0].gms }));
  await done(); const myLook = await layer(); await undo();
  await p.reload(); await p.waitForTimeout(1500); await open(); await fxOpen();
  g = await gm();
  L.ok(g.customs.join('|') === 'My Forest', 'through a reload');
  await tapEl('.gm-cgrid [data-gm]'); await done();
  L.ok((await layer()).s === myLook.s, 'and picked again, it looks just as it did');
  await undo(); await fxOpen(); await tapEl('.gm-cgrid [data-gm]');
  await tapEl('[data-gm-act="rename"]'); const nm2 = await p.$('.gm-cgrid .gm-name'); if (nm2) { await nm2.fill('Moss'); await nm2.press('Enter'); }
  L.ok((await gm()).customs.join('|') === 'Moss' && (await p.evaluate(() => JSON.parse(localStorage.getItem('paint-gmaps'))[0].name)) === 'Moss', 'renamed');
  await tapEl('[data-gm-act="cdel"]');
  L.ok(!(await gm()).customs.length && (await p.evaluate(() => JSON.parse(localStorage.getItem('paint-gmaps')).length)) === 0, 'and deleted');
  L.ok((await p.$$eval('.gm-grid:not(.gm-cgrid) [data-gm]', bs => bs.length)) === 11, 'the ten presets untouched');

  // ---- INSIDE A SELECTION: only it changes ----
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => { const a = document.querySelector('.paint-adjust:not(.paint-studio)'); if (!a.hidden) document.querySelector('[data-adj-act="done"]').click(); }); await p.waitForTimeout(300);
  await p.keyboard.press('m'); await p.waitForTimeout(150);
  const wr = await p.$eval('.paint-world', e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  await drag(wr[0] + wr[2] * 0.1, wr[1] + wr[3] * 0.38, wr[0] + wr[2] * 0.45, wr[1] + wr[3] * 0.62); // (clear of the tool settings, which run along the top on a phone)
  const b0 = await layer();
  await fxOpen(); await tapEl('[data-gm="cyber"]'); await done();
  const inside = await p.evaluate(() => { const cs = [...document.querySelectorAll('.paint-layers canvas')], c = cs[cs.length - 1], x = c.getContext('2d'); const a = x.getImageData(Math.round(c.width * 0.27), Math.round(c.height * 0.5), 1, 1).data, z = x.getImageData(Math.round(c.width * 0.8), Math.round(c.height * 0.5), 1, 1).data; return [Array.from(a), Array.from(z)]; });
  const b1 = await layer();
  L.ok(b1.s !== b0.s, 'with a selection, the gradient map changes the picture');
  L.ok(near(b0.smp.filter((_, i) => { const n = Math.floor(i / 3) * 211, xx = n % b0.w; return xx > b0.w * 0.6; }), b1.smp.filter((_, i) => { const n = Math.floor(i / 3) * 211, xx = n % b1.w; return xx > b1.w * 0.6; }), 0) === true, 'but only inside it ' + JSON.stringify(inside));

  L.ok(!p.errs.length, 'no errors ' + p.errs.join(' | '));
  await b.close();
  L.done();
})().catch(e => { console.log('FAIL', e.stack); process.exit(1); });
