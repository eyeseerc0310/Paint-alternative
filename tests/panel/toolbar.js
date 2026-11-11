// The left bar without Fill, Shapes and Move buttons (Fill and Shapes kept
// on their keys, F, R and L, and the colour dropped on the picture still
// fills; Move is in the Select panel's row, after the four ways, and lights
// the Select button), its groups with no gaps (Fit, then Layers beside it, the zoom alone at the foot; in
// the middle), and the top bar, open, as tall as what's in it. Run as:
// node toolbar.js light|dark width height [touch]
const L = require('../lib');
const { chromium } = L.use({ hdrOpen: true });
const [theme, VW, VH] = [process.argv[2] || 'light', +(process.argv[3] || 1400), +(process.argv[4] || 900)];
const touch = process.argv.includes('touch'), phone = VW <= 560;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, hasTouch: touch, colorScheme: theme });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(900);
  await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
  const tapAt = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
  const tapEl = async s => { const e = typeof s === 'string' ? await p.$(s) : s; await e.evaluate(el => el.scrollIntoView({ block: 'nearest' })); const r = await e.boundingBox(); await tapAt(r.x + r.width / 2, r.y + r.height / 2); await p.waitForTimeout(250); };
  const tool = () => p.evaluate(() => document.querySelector('.paint-stage').dataset.tool);
  const at = async (fx, fy) => p.evaluate(([fx, fy]) => { const w = document.querySelector('.paint-world').getBoundingClientRect(); return [w.left + w.width * fx, w.top + w.height * fy]; }, [fx, fy]);
  const px = (fx, fy, i) => p.evaluate(([fx, fy, i]) => { const cs = document.querySelectorAll('.paint-layers canvas'), c = cs[i == null ? cs.length - 1 : i]; return Array.from(c.getContext('2d').getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data); }, [fx, fy, i]);
  // (a drag: a finger waits a moment before it starts anything)
  const drag = async (a, z) => {
    if (touch) {
      const cdp = await ctx.newCDPSession(p), T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(q => ({ x: q[0], y: q[1] })) });
      await T('touchStart', [a]); await p.waitForTimeout(260);
      for (let i = 1; i <= 8; i++) await T('touchMove', [[a[0] + (z[0] - a[0]) * i / 8, a[1] + (z[1] - a[1]) * i / 8]]);
      await T('touchEnd', []);
    } else { await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...z, { steps: 8 }); await p.mouse.up(); }
    await p.waitForTimeout(300);
  };

  // ---- 1 and 4. THE LEFT BAR ----
  const bar = await p.evaluate(() => {
    const left = document.querySelector('.paint-left');
    const groups = [...left.querySelectorAll('.paint-toolgroups > .paint-group:not(.pl-view)')].filter(g => g.offsetParent).map(g => {
      const bs = [...g.children].filter(x => x.offsetParent), rs = bs.map(x => x.getBoundingClientRect()), gr = g.getBoundingClientRect();
      const rows = {}; rs.forEach(r => { const k = Math.round(r.top); rows[k] = (rows[k] || 0) + 1; });
      return { n: bs.length, rows: Object.values(rows), last: bs.length > 1 ? { fit: bs[bs.length - 2].classList.contains(innerWidth <= 560 ? 'paint-fitbtn' : 'paint-adjust-btn'), layers: bs[bs.length - 1].classList.contains('pl-layersbtn'), level: innerWidth <= 560 ? Math.round(rs[rs.length - 1].top) === Math.round(rs[rs.length - 2].top) : Math.round(rs[rs.length - 1].left) === Math.round(rs[rs.length - 2].left) && rs[rs.length - 1].top >= rs[rs.length - 2].bottom } : null, sizes: [...new Set(rs.map(r => Math.round(r.width) + 'x' + Math.round(r.height)))] };
    });
    return { fill: !!left.querySelector('[data-tool="fill"]'), shape: !!left.querySelector('.paint-shapebtn, [data-tool="shape"], [data-tool="line"]'), move: !!left.querySelector('[data-tool="move"]'), groups };
  });
  L.ok(!bar.fill && !bar.shape && !bar.move, 'no Fill, Shapes or Move button in the left bar');
  L.ok(bar.groups.length === 3, 'three groups of tools, then Layers and the zoom: ' + bar.groups.map(g => g.n).join(' | '));
  const phone = await p.evaluate(() => innerWidth <= 560);
  L.ok(bar.groups.every(g => g.rows.every(r => r === (phone ? 2 : 1))), (phone ? 'a phone: every row two across ' : 'one column: every tool on a row of its own ') + JSON.stringify(bar.groups.map(g => g.rows)));
  // (the Fluent set: filled drawings in the button's colour; Text is Aa)
  const ic = await p.evaluate(() => [...document.querySelectorAll('.paint-left .paint-toolgroups > .paint-group:not(.pl-view) > button')].filter(b => b.offsetParent).map(b => { const ps = [...b.querySelectorAll('svg path')]; return ps.length === 1 && ps[0].getAttribute('fill') === 'currentColor' && ps[0].getAttribute('stroke') === 'none' && getComputedStyle(ps[0]).fill === getComputedStyle(b).color; }));
  L.ok(ic.length === (phone ? 12 : 11) && ic.every(Boolean), 'all the tools (eleven, Fit being in the bottom bar; a phone twelve): one filled Fluent drawing each, in the button’s colour ' + JSON.stringify(ic));
  const bw = await p.evaluate(() => { const l = document.querySelector('.paint-left').getBoundingClientRect(), h = document.querySelector('.site-header').getBoundingClientRect(); return [Math.round(l.width), Math.round(h.width)]; });
  L.ok(bw[0] === (phone ? 100 : 56) && bw[1] === bw[0], 'the left bar and the menu over it: 56 wide (a phone: 100) ' + bw);
  const lg = bar.groups[bar.groups.length - 1];
  L.ok(lg.last.fit && lg.last.layers && lg.last.level, (phone ? 'a phone: Fit, then Layers beside it, last ' : 'Effects, then Layers just under it, last (Fit is in the bottom bar) ') + JSON.stringify(lg.last));
  // (Fit at the bottom bar's left end, mirroring the settings toggle at its right; the bar centred
  // on the screen as far as the picture's space allows; a phone keeps Fit in the left bar)
  if (!phone) {
    const bb = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(), b = r('.paint-bottom'), f = r('.paint-bottom .paint-fitbtn'), s = r('.paint-settings-toggle'), c = r('.paint-centre'), kids = [...document.querySelector('.paint-bottom').children].filter(e => e.offsetParent);
      return { first: kids[0].classList.contains('paint-fitbtn'), sep: kids[1].classList.contains('pb-sep'), l: f.left - b.left, r: b.right - s.right, top: Math.abs(f.top - s.top), size: f.width === s.width && f.height === s.height, mid: (b.left + b.right) / 2, want: Math.max(c.left + b.width / 2, Math.min(c.right - b.width / 2, innerWidth / 2)), left: !!document.querySelector('.paint-left .paint-fitbtn').offsetParent }; });
    L.ok(bb.first && bb.sep && !bb.left, 'Fit first in the bottom bar, a divider after it, not in the left bar ' + JSON.stringify(bb));
    L.ok(Math.abs(bb.l - bb.r) < 0.5 && bb.top < 0.5 && bb.size, 'Fit and the settings toggle mirror each other: the same size, level, as far from their ends ' + [bb.l, bb.r]);
    L.ok(Math.abs(bb.mid - bb.want) <= 1, 'the bar centred on the screen, as far as the picture’s space allows ' + [bb.mid, bb.want]);
  }
  L.ok(await p.evaluate(() => { const v = document.querySelector('.paint-left .pl-view'); return !v.querySelector('.pl-layersbtn') && !!v.querySelector('.paint-zoom'); }), 'the foot: the zoom alone, no full-width Layers');
  L.ok(bar.groups.every(g => g.sizes.length === 1) && new Set(bar.groups.map(g => g.sizes[0])).size === 1, 'every tool the same size ' + JSON.stringify(bar.groups.map(g => g.sizes)));
  // (what they did is still there: the keys, and a colour dropped on the picture)
  await p.keyboard.press('f'); L.ok(await tool() === 'fill', 'F still picks the fill tool');
  await p.keyboard.press('r'); L.ok(await tool() === 'shape' && !!(await p.$('.paint-ctx [data-ctx-shape]')), 'R still picks Shapes, its kinds in the tool panel');
  await p.keyboard.press('l'); L.ok(await tool() === 'line', 'and L the line');
  await p.keyboard.press('b');
  const w0 = await at(0.15, 0.85), cur = await (await p.$('.paint-current')).boundingBox();
  if (!touch) { await p.mouse.move(cur.x + cur.width / 2, cur.y + cur.height / 2); await p.mouse.down(); await p.mouse.move(...w0, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(900);
    L.ok((await px(0.15, 0.85, 0))[0] < 60, 'the colour dragged onto the picture still fills it ' + (await px(0.15, 0.85, 0)).join(',')); await p.keyboard.press((process.platform === 'darwin' ? 'Meta' : 'Control') + '+z'); await p.waitForTimeout(300); }

  // ---- 2. MOVE, IN THE SELECT PANEL ----
  // (a stroke on a layer of its own, to move)
  await p.evaluate(() => document.querySelector('[data-act="layers"]').click()); await p.waitForTimeout(250);
  await p.evaluate(() => document.querySelector('[data-layer-act="add"]').click()); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('[data-act="layers"]').click()); await p.waitForTimeout(200);
  await p.$eval('.paint-size', e => { e.value = 700; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await drag(await at(0.4, 0.5), await at(0.45, 0.5));
  const was = await px(0.425, 0.5);
  L.ok(was[3] > 200, 'a stroke to move ' + was.join(','));
  await tapEl('.paint-selbtn');
  const row = await p.evaluate(() => { const t = [...document.querySelectorAll('.paint-ctx [data-ctx-sel]')]; return { ids: t.map(b => b.dataset.ctxSel), sizes: [...new Set(t.map(b => Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height)))], top: [...new Set(t.map(b => Math.round(b.getBoundingClientRect().top)))].length, svg: t.map(b => b.querySelector('svg') && b.querySelector('svg').innerHTML) }; });
  L.ok(JSON.stringify(row.ids) === JSON.stringify(['lasso', 'select', 'circle', 'wand', 'move']), 'the Select panel’s top row: the four ways, then Move ' + row.ids.join(', '));
  L.ok(row.sizes.length === 1 && row.top === 1, 'all in one row, the same size ' + row.sizes.join(' '));
  L.ok(/M15\.28 6\.03c/.test(row.svg[4]), 'Move with its own icon');
  await tapEl('.paint-ctx [data-ctx-sel="move"]');
  const mv = await p.evaluate(() => { const s = document.querySelector('.paint-selbtn'), t = document.querySelector('.paint-ctx [data-ctx-sel="move"]'); return { tool: document.querySelector('.paint-stage').dataset.tool, lit: s.getAttribute('aria-pressed'), icon: /M15\.28 6\.03c/.test(s.innerHTML), label: s.getAttribute('aria-label'), tab: t && t.getAttribute('aria-selected'), panel: !document.querySelector('.paint-ctx').hidden, hint: (document.querySelector('.paint-ctx .ctx-hint') || {}).textContent }; });
  L.ok(mv.tool === 'move' && mv.tab === 'true' && mv.panel, 'its tab picks the Move tool, and the panel stays, Move picked ' + JSON.stringify(mv));
  L.ok(mv.lit === 'true' && mv.icon && /Move/.test(mv.label), 'the Select button is lit, showing Move');
  L.ok(/^Move/.test(mv.hint || ''), 'the panel says what Move does: ' + mv.hint);
  // (it works as it did: the layer picked up and moved by a drag anywhere)
  await drag(await at(0.6, 0.7), await at(0.6, 0.3));
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const now = await px(0.425, 0.5);
  L.ok(now[3] < 40, 'the stroke has moved off where it was ' + now.join(','));
  L.ok((await px(0.425, 0.1))[3] > 200, 'up to where it was dragged ' + (await px(0.425, 0.1)).join(','));
  // (the Select button again picks the way last used; V is Move)
  await tapEl('.paint-ctx [data-ctx-sel="select"]');
  const back = await p.evaluate(() => { const s = document.querySelector('.paint-selbtn'); return { tool: document.querySelector('.paint-stage').dataset.tool, data: s.dataset.tool, lit: s.getAttribute('aria-pressed') }; });
  L.ok(back.tool === 'select' && back.data === 'select' && back.lit === 'true', 'Box from the row: the Select button shows Box again ' + JSON.stringify(back));
  await p.keyboard.press('b'); await p.keyboard.press('v');
  L.ok(await tool() === 'move' && await p.$eval('.paint-selbtn', e => e.getAttribute('aria-pressed') === 'true' && e.dataset.tool === 'move'), 'V picks Move, the Select button lit');
  await p.keyboard.press('Escape'); await p.keyboard.press('b');
  L.ok(await p.$eval('.paint-selbtn', e => e.getAttribute('aria-pressed') === 'false' && e.dataset.tool === 'select'), 'another tool: the Select button goes back to the way last used, unlit');
  await p.screenshot({ path: `toolbar-${theme}-${VW}.png` });

  // ---- 3. THE TOP BAR, OPEN: as tall as what's in it ----
  if (!(await p.evaluate(() => document.documentElement.classList.contains('hdr-open')))) { await p.$eval('.hdr-fold', e => e.click()); await p.waitForTimeout(700); }
  const hd = await p.evaluate(() => { const h = document.querySelector('.site-header'), f = h.querySelector('.hdr-fold'), t = h.querySelector('.header-tools'), q = h.getBoundingClientRect(), tr = t.getBoundingClientRect(), fr = f.getBoundingClientRect(), bs = [...t.querySelectorAll('button')].filter(b => b.offsetParent), lb = bs[bs.length - 1].getBoundingClientRect();
    return { top: Math.round(tr.top - q.top), bottom: Math.round(q.bottom - fr.bottom), gap: Math.round(fr.top - lb.bottom), over: h.scrollHeight > h.clientHeight + 1 }; });
  L.ok(!hd.over && hd.top === hd.bottom && hd.gap <= 10, 'the open top bar fits what’s in it: as much room under the arrow as over the buttons ' + JSON.stringify(hd));
  await p.screenshot({ path: `toolbar-${theme}-${VW}-hdr.png`, clip: { x: 0, y: 0, width: Math.min(VW, 400), height: Math.min(VH, 640) } });
  // ---- 5. THE DIVIDERS: exactly half way between the rows either side, in every workspace ----
  const divs = () => p.evaluate(() => {
    const gs = [...document.querySelectorAll('.paint-left .paint-toolgroups > .paint-group')].filter(g => g.offsetParent && g.children.length), out = [];
    for (let i = 1; i < gs.length; i++) {
      const lastBot = Math.max(...[...gs[i - 1].children].filter(x => x.offsetParent).map(x => x.getBoundingClientRect().bottom));
      const firstTop = Math.min(...[...gs[i].children].filter(x => x.offsetParent).map(x => x.getBoundingClientRect().top));
      const be = getComputedStyle(gs[i], '::before'), d = gs[i].getBoundingClientRect().top + parseFloat(be.top) + parseFloat(be.height) / 2;
      out.push([+(d - lastBot).toFixed(1), +(firstTop - d).toFixed(1)]);
    }
    return out;
  });
  for (const md of ['paint', 'vector', 'photo']) {
    if (md !== 'paint') { await p.$eval('.mode-switch [data-mode="' + md + '"]', e => e.click()); await p.waitForTimeout(700); const q = await p.$('.pa-sheet-wrap.in [data-vm="switch"]'); if (q) { await q.click(); await p.waitForTimeout(500); } }
    const d = await divs();
    L.ok(d.length && d.every(([a, b]) => Math.abs(a - b) <= 0.5 && a > 2), md + ': every divider half way between its rows ' + JSON.stringify(d));
  }
  L.ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
  L.done();
})();
