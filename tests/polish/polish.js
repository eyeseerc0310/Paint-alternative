// The app-wide polish: Fit in the left bar in Paint, Vector and Photo (and 0
// fits in each); Crop & Rotate stays open from one turn to the next and its
// size follows undo; in Layers, New Layer stays under the pointer as layers
// are added, the panel stays on the screen and above the bottom bar, the new
// layer is in view and the list keeps where it was scrolled; a still tap on
// the empty workspace puts the tool down (Vector's too, nothing lit, a drag
// then moves round) and a tap on a panel doesn't; every chevron in Effects
// stands at the same trailing edge, turned while its section is folded.
// Run as: node polish.js light|dark width height [touch]
const L = require('../lib');
const { chromium } = L.use({});
const [theme, VW, VH] = [process.argv[2] || 'light', +(process.argv[3] || 1400), +(process.argv[4] || 900)];
const touch = process.argv.includes('touch');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, hasTouch: touch, colorScheme: theme });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(900);
  await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
  const tapAt = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); await p.waitForTimeout(220); };
  const tapEl = async s => { const e = await p.$(s); await e.evaluate(el => el.scrollIntoView({ block: 'nearest' })); const r = await e.boundingBox(); await tapAt(r.x + r.width / 2, r.y + r.height / 2); };
  const box = s => p.evaluate(s => { const e = document.querySelector(s); if (!e || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right }; }, s);
  const shown = s => p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).visibility === 'visible' && !!e.offsetParent; }, s);
  // (a spot on the bare workspace: away from every bar, panel and the picture's space)
  const bareSpot = () => p.evaluate(() => {
    const bare = e => e && (e.matches('.paint, .paint-centre, .paint-dock, .site-main, body') || e === document.documentElement);
    for (let y = window.innerHeight - 14; y > 14; y -= 12) for (let x = 14; x < window.innerWidth - 14; x += 12) {
      if ([[0, 0], [-10, 0], [10, 0], [0, -10], [0, 10]].every(([dx, dy]) => bare(document.elementFromPoint(x + dx, y + dy)))) return { x, y };
    }
    return null;
  });
  const top = async k => {
    const seen = await p.evaluate(k => { const b = document.querySelector('[data-hb="' + k + '"]'); return !!(b && b.offsetParent); }, k);
    if (!seen) { await tapEl('[data-hb="more"]'); const items = await p.$$('.paint-moremenu button'); for (const it of items) if ((await it.textContent()).includes(k === 'image' ? 'Crop' : 'Settings')) { const r = await it.boundingBox(); await tapAt(r.x + r.width / 2, r.y + r.height / 2); break; } await p.waitForTimeout(300); return; }
    await p.evaluate(k => document.querySelector('[data-hb="' + k + '"]').click(), k); await p.waitForTimeout(300);
  };
  const zoomTxt = () => p.$eval('.paint-zoom-val', e => e.textContent);
  const tool = () => p.evaluate(() => document.querySelector('.paint-stage').dataset.tool);

  // (the top bar starts folded: opened, as a person would, to reach its buttons)
  if (await p.$eval('.hdr-fold', b => b.getAttribute('aria-expanded') !== 'true')) { await tapEl('.hdr-fold'); await p.waitForTimeout(600); }

  // ---- PAINT: Fit in the left bar, and 0 ----
  const st = await box('.paint-stage');
  await p.mouse.move(st.x + st.w * 0.35, st.y + st.h * 0.4); await p.mouse.down(); await p.mouse.move(st.x + st.w * 0.6, st.y + st.h * 0.6, { steps: 8 }); await p.mouse.up();
  L.ok(await shown('.paint-left .paint-fitbtn'), 'Paint: Fit in the left bar');
  const z0 = await zoomTxt();
  await tapEl('[data-zoom="in"]'); await tapEl('[data-zoom="in"]'); const z1 = await zoomTxt();
  await tapEl('.paint-left .paint-fitbtn'); L.ok(z1 !== z0 && await zoomTxt() === z0, 'Paint: zoomed in, Fit fits again ' + [z0, z1, await zoomTxt()].join(' → '));
  await tapEl('[data-zoom="in"]'); await p.keyboard.press('0'); await p.waitForTimeout(200); L.ok(await zoomTxt() === z0, 'Paint: and so does 0');

  // ---- CROP & ROTATE stays open ----
  const info = () => p.evaluate(() => { const d = document.querySelector('.paint-docpanel'); const i = document.querySelector('.paint-imgmenu .pd-info'); return { open: !d.hidden, title: d.querySelector('.dp-title').textContent, size: i ? (i.textContent.match(/(\d+) × (\d+)/) || []).slice(1).join('x') : '' }; });
  await top('image'); const i0 = await info();
  L.ok(i0.open && i0.title === 'Crop & Rotate', 'Crop & Rotate opens: ' + JSON.stringify(i0));
  await tapEl('[data-img="right"]'); const i1 = await info();
  L.ok(i1.open && i1.size === i0.size.split('x').reverse().join('x'), 'Rotate Right: the panel stays open, and says the new size ' + JSON.stringify(i1));
  await tapEl('[data-img="fliph"]'); await tapEl('[data-img="flipv"]'); L.ok((await info()).open, 'and through the flips');
  await p.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z'); await p.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z'); await p.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z'); await p.waitForTimeout(250);
  const i2 = await info(); L.ok(i2.open && i2.size === i0.size, 'undo: still open, the size back as it was ' + JSON.stringify(i2));
  await top('image'); L.ok(!(await info()).open, 'the same button closes it');

  // ---- LAYERS: New Layer stays put ----
  await tapEl('[data-act="layers"]'); await p.waitForTimeout(250);
  const ys = new Set(); let inView = true;
  for (let i = 0; i < 9; i++) {
    const a = await box('[data-layer-act="add"]'); ys.add(Math.round(a.y)); await tapAt(a.x + a.w / 2, a.y + a.h / 2);
    inView = inView && await p.evaluate(() => { const r = document.querySelector('.pl-row.on').getBoundingClientRect(), l = document.querySelector('.pl-list').getBoundingClientRect(); return r.top >= l.top - 1 && r.bottom <= l.bottom + 1; });
  }
  L.ok(ys.size === 1, 'New Layer stays under the pointer as 9 layers are added: ' + [...ys].join(','));
  L.ok(inView, 'each new layer is in view in the list');
  const lp = await box('.paint-layerpanel'), bb = await box('.paint-bottom');
  L.ok(lp.b <= VH - 7 && (!bb || bb.x > lp.r || bb.r < lp.x || lp.b <= bb.y - 7), 'the panel stays on the screen and off the bottom bar ' + JSON.stringify({ panel: Math.round(lp.b), bar: bb && Math.round(bb.y) }));
  await p.evaluate(() => { document.querySelector('.pl-list').scrollTop = 60; });
  await p.evaluate(() => document.querySelectorAll('[data-layer-eye]')[5].click()); await p.waitForTimeout(150);
  L.ok(await p.evaluate(() => document.querySelector('.pl-list').scrollTop) === 60, 'hiding a layer keeps where the list was scrolled');
  await tapEl('[data-act="layers"]');

  // ---- THE EMPTY WORKSPACE puts the tool down ----
  await p.keyboard.press('b'); await p.waitForTimeout(100);
  const bs = await bareSpot(); L.ok(!!bs, 'there is bare workspace to tap ' + JSON.stringify(bs));
  const cx = await box('.paint-ctx'); if (cx) await tapAt(cx.x + cx.w / 2, cx.y + Math.min(cx.h - 6, 40));
  L.ok(await tool() === 'brush', 'a tap on the tool settings leaves the brush in hand');
  if (bs) { await tapAt(bs.x, bs.y); L.ok(await tool() === 'none' && !(await p.$('.paint-left button[data-tool][aria-pressed="true"]')), 'a tap on the bare workspace puts it down, nothing lit'); }
  await p.keyboard.press('b'); await p.waitForTimeout(100);
  if (bs) { await p.mouse.move(bs.x, bs.y); await p.mouse.down(); await p.mouse.move(bs.x, bs.y + 40, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(150); L.ok(await tool() === 'brush', 'a drag there doesn’t'); }

  // ---- EFFECTS: every chevron at one trailing edge ----
  await tapEl('.paint-adjust-btn'); await p.waitForTimeout(400);
  const ch = await p.evaluate(() => [...document.querySelectorAll('.paint-adjust[aria-label="Effects"] .fx-sec .pr-head')].filter(h => h.offsetParent).map(h => { const c = h.querySelector('.chev'), r = c.getBoundingClientRect(), t = getComputedStyle(c).transform; return { r: Math.round(r.right), open: h.getAttribute('aria-expanded') === 'true', turned: t !== 'none' }; }));
  L.ok(ch.length > 8 && new Set(ch.map(c => c.r)).size === 1, 'Effects: ' + ch.length + ' chevrons, all at one edge ' + [...new Set(ch.map(c => c.r))].join(','));
  L.ok(ch.every(c => c.open !== c.turned), 'each turned while its section is folded');
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);

  // ---- VECTOR: Fit, 0, and the tool put down ----
  const settings = async m => { await top('settings'); await p.evaluate(m => document.querySelector('[data-setting="' + m + '"]').click(), m); await p.waitForTimeout(600); const sw = await p.$('.paint-docpanel:not([hidden]) [data-vm="switch"]'); if (sw) { await sw.click(); await p.waitForTimeout(500); } };
  await settings('vector');
  const V = () => p.evaluate(() => { const s = window.PaintVector.serialize(); return { tool: s.tool, fit: s.view.fit, lit: document.querySelectorAll('.vec-group [aria-pressed="true"]').length, cat: (document.querySelector('.vec-cat') || {}).textContent }; });
  const fb = await box('.vec-group .paint-fitbtn'), pv = await box('.pl-view');
  L.ok(fb && fb.w > 0 && fb.b <= pv.y, 'Vector: Fit in the left bar, above Layers ' + JSON.stringify({ fit: fb && Math.round(fb.b), layers: Math.round(pv.y) }));
  await tapEl('[data-zoom="in"]'); L.ok(!(await V()).fit, 'Vector: zoomed in');
  await tapEl('.vec-group .paint-fitbtn'); L.ok((await V()).fit, 'Vector: Fit fits the artboard');
  await tapEl('[data-zoom="in"]'); await p.keyboard.press('0'); await p.waitForTimeout(150); L.ok((await V()).fit, 'Vector: and so does 0');
  const bv = await bareSpot();
  if (bv) { await tapAt(bv.x, bv.y); const v = await V(); L.ok(v.tool === 'none' && v.lit === 0 && v.cat === 'No Tool', 'Vector: a tap on the bare workspace puts the tool down ' + JSON.stringify(v)); }
  const x0 = await p.evaluate(() => window.PaintVector.serialize().view.x), st2 = await box('.paint-stage');
  await p.mouse.move(st2.x + st2.w / 2, st2.y + st2.h / 2); await p.mouse.down(); await p.mouse.move(st2.x + st2.w / 2 + 50, st2.y + st2.h / 2, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(150);
  L.ok(Math.round((await p.evaluate(() => window.PaintVector.serialize().view.x)) - x0) === 50, 'Vector: with no tool, a drag moves round');
  await p.keyboard.press('v'); await p.waitForTimeout(100); L.ok((await V()).tool === 'select' && (await V()).lit === 1, 'Vector: a tool’s key takes one up again');

  // ---- PHOTO: Fit, 0 ----
  await settings('photo');
  await p.setInputFiles('.paint-open input', L.fixture('scene.png')); await p.waitForTimeout(1200);
  const k0 = (await p.evaluate(() => PaintPhoto.state().view.k));
  L.ok(await shown('.paint-left .pho-fit'), 'Photo: Fit among the left bar’s six buttons');
  await tapEl('[data-zoom="in"]'); const k1 = await p.evaluate(() => PaintPhoto.state().view.k);
  await tapEl('.paint-left .pho-fit'); const k2 = await p.evaluate(() => PaintPhoto.state().view.k);
  L.ok(k1 > k0 && Math.abs(k2 - k0) < 1e-6, 'Photo: zoomed in, Fit fits again ' + [k0, k1, k2].map(k => k.toFixed(3)).join(' → '));
  await tapEl('[data-zoom="in"]'); await p.keyboard.press('0'); await p.waitForTimeout(150); L.ok(Math.abs((await p.evaluate(() => PaintPhoto.state().view.k)) - k0) < 1e-6, 'Photo: and so does 0');

  L.ok(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close(); L.done();
})();
