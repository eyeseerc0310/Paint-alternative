// THE SELECTION'S ACTIONS in the tool settings panel: nothing floats over the
// picture for them; they show under the selection tools' settings while a
// selection is open (four across, Commit at the foot), go with another tool
// in hand and come back with a selection tool, the tool's own Select All and
// Paste step aside for them, their options open beside the panel towards the
// picture, folded settings stay folded for a new selection (the picture never
// moves under it) and open out from the settings button, and Commit closes it.
// node panel.js [light|dark] [width] [height] [touch]
const L = require('../lib'), { chromium } = L.use({}), ok = L.ok;
(async () => {
  const scheme = process.argv[2] || 'light', vw = +(process.argv[3] || 1400), vh = +(process.argv[4] || 900), touch = process.argv.includes('touch'), phone = vw <= 560, tag = scheme + '-' + vw;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, colorScheme: scheme, hasTouch: touch });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(1300);
  const box = s => p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(e => e.getClientRects().length); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, s);
  const tap = async s => { const r = await box(s); if (touch) await p.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2); else await p.mouse.click(r.x + r.w / 2, r.y + r.h / 2); await p.waitForTimeout(350); };
  const cdp = touch ? await ctx.newCDPSession(p) : null;
  const drag = async (fx0, fy0, fx1, fy1) => {
    const s = await box('.paint-world'), a = [s.x + s.w * fx0, s.y + s.h * fy0], z = [s.x + s.w * fx1, s.y + s.h * fy1];
    if (touch) { const pt = (x, y) => [{ x, y, id: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(...a) }); await p.waitForTimeout(150);
      for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(a[0] + (z[0] - a[0]) * i / 8, a[1] + (z[1] - a[1]) * i / 8) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await p.waitForTimeout(400); // (a moment, as a person's hand: a tap straight after the drag is taken as part of it by the test browser)
    } else { await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...z, { steps: 8 }); await p.mouse.up(); }
    await p.waitForTimeout(500);
  };
  const shown = () => p.evaluate(() => { const s = document.querySelector('.selection-slot'); return !!s && s.classList.contains('on') && !!s.getClientRects().length; });
  const selOpen = () => p.evaluate(() => !!document.querySelector('.paint.selection-active'));
  await p.keyboard.press('m'); await p.waitForTimeout(200);
  // (the actions are there with the tool, selection or not: without one only Select All and Paste can be pressed)
  ok((await shown()) === !phone, tag + (phone ? ': a phone: no actions until there is a selection (the strip covers the picture)' : ': the selection tool in hand: its actions show, before any selection'));
  const states = () => p.evaluate(() => [...document.querySelectorAll('.selection-toolbar [data-sel], .selection-toolbar [data-selection-pop]')].filter(e => e.getClientRects().length).map(e => (e.dataset.sel || e.dataset.selectionPop) + (e.disabled ? '-' : '+')).join(' '));
  const none = 'all+ region-invert- feather- grow- transform- rotate- rot90- invert- fliph- flipv- copy- paste+ duplicate- layer- delete- deselect- done-';
  if (!phone) {
    ok((await states()) === none, tag + ': no selection: all greyed out but Select All and Paste ' + await states());
    await p.evaluate(() => document.querySelector('.selection-toolbar [data-sel="flipv"]').click()); await p.waitForTimeout(200);
    ok(!(await selOpen()), tag + ': a greyed-out one does nothing');
  }
  ok(!(await p.$('.ctx-tool [data-ctx="all"], .ctx-tool [data-ctx="paste"]')), tag + ': no separate Select All or Paste rows');
  // (on a phone the tool settings are a strip over the top of the picture: dragged below it)
  if (phone) await drag(0.3, 0.6, 0.7, 0.85); else await drag(0.3, 0.3, 0.6, 0.6);
  ok(await selOpen() && await shown(), tag + ': a selection: its actions show');
  const where = await p.evaluate(() => { const s = document.querySelector('.selection-slot'); return { inCtx: !!s.closest('.paint-ctx'), afterTool: !!(document.querySelector('.paint-ctx .ctx-tool').compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) && s.getBoundingClientRect().top >= document.querySelector('.paint-ctx .ctx-tool').getBoundingClientRect().bottom - .5 }; });
  ok(where.inCtx && where.afterTool, tag + ': in the tool settings panel, under the tool’s own settings ' + JSON.stringify(where));
  const ids = await p.evaluate(() => [...document.querySelectorAll('.selection-toolbar [data-sel], .selection-toolbar [data-selection-pop]')].filter(e => e.getClientRects().length).map(e => e.dataset.sel || e.dataset.selectionPop));
  ok(ids.join(',') === 'all,region-invert,feather,grow,transform,rotate,rot90,invert,fliph,flipv,copy,paste,duplicate,layer,delete,deselect,done', tag + ': every action, and Commit: ' + ids.join(','));
  ok(!/-(\s|$)/.test(await states()), tag + ': with a selection, every one can be pressed ' + await states());
  const lay = await p.evaluate(() => { const bs = [...document.querySelectorAll('.selection-toolbar .paint-group > button')], rs = bs.map(e => e.getBoundingClientRect()), c = document.querySelector('.paint-ctx').getBoundingClientRect(), k = document.querySelector('.selection-commit').getBoundingClientRect();
    const rows = {}; rs.forEach(r => { const t = Math.round(r.top); rows[t] = (rows[t] || 0) + 1; });
    return { inside: rs.every(r => r.left >= c.left - .5 && r.right <= c.right + .5) && k.left >= c.left && k.right <= c.right, rows: Object.values(rows), last: rs.every(r => r.bottom <= k.top), sizes: [...new Set(rs.map(r => Math.round(r.width) + 'x' + Math.round(r.height)))], commitW: Math.round(k.width), ctxW: Math.round(c.width) }; });
  ok(lay.inside && lay.last && lay.sizes.length === 1, tag + ': inside the panel, the same size, Commit under them all ' + JSON.stringify(lay));
  if (!phone) ok(lay.rows.length === 4 && lay.rows.every(n => n === 4), tag + ': four across, four down ' + JSON.stringify(lay.rows));
  if (!phone) {
    const over = await p.evaluate(() => { const s = document.querySelector('.paint-stage').getBoundingClientRect(), r = document.querySelector('.selection-slot').getBoundingClientRect(); return r.left < s.right && r.right > s.left && r.top < s.bottom && r.bottom > s.top; });
    ok(!over, tag + ': nothing of it over the picture’s space');
  }
  // (an option: beside the panel, towards the picture; on a phone under the strip)
  await tap('[data-selection-pop="feather"]');
  const pop = await p.evaluate(() => { const e = document.querySelector('.selection-pop'), r = e.getBoundingClientRect(), c = document.querySelector('.paint-ctx').getBoundingClientRect(); return { open: !e.hidden, left: r.right <= c.left + .5, below: r.top >= c.bottom - .5, inView: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, focus: document.activeElement && document.activeElement.matches('input[data-selection-value]') }; });
  ok(pop.open && pop.inView && (phone ? pop.below : pop.left) && pop.focus, tag + ': Feather opens beside the panel, towards the picture ' + JSON.stringify(pop));
  ok(await selOpen(), tag + ': and the selection stays');
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  ok(await p.$eval('.selection-pop', e => e.hidden) && await selOpen(), tag + ': Esc closes the option, the selection stays');
  // (an action from the panel: the selection stays open)
  await tap('.selection-toolbar [data-sel="fliph"]');
  ok(await selOpen() && await shown(), tag + ': Flip from the panel: the selection still open');
  // (another tool: the selection stays, its actions go; a selection tool again brings them back)
  await p.keyboard.press('b'); await p.waitForTimeout(300);
  ok(await selOpen() && !(await shown()), tag + ': the brush in hand: the selection stays, its actions step aside');
  await p.keyboard.press('m'); await p.waitForTimeout(300);
  ok(await shown(), tag + ': the selection tool again: back');
  await p.keyboard.press('v'); await p.waitForTimeout(300);
  ok(await shown(), tag + ': with Move too');
  // (Commit closes it)
  await tap('.selection-commit');
  ok(!(await selOpen()) && (phone ? !(await shown()) : await shown() && (await states()) === none), tag + (phone ? ': Commit closes the selection, and on a phone its actions go' : ': Commit closes the selection; its actions stay, greyed out again'));
  // (the settings folded: a new selection opens them out)
  if (!phone) {
    await p.keyboard.press('m'); await p.waitForTimeout(200);
    await tap('.paint-settings-toggle'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => document.querySelector('.paint-ctx').classList.contains('min')), tag + ': the settings folded');
    await drag(0.25, 0.25, 0.5, 0.5);
    const w0 = await box('.paint-world');
    ok(await selOpen() && await p.evaluate(() => document.querySelector('.paint-ctx').classList.contains('min')), tag + ': a new selection leaves them folded, the picture where it was');
    await tap('.paint-settings-toggle'); await p.waitForTimeout(700);
    ok(await p.evaluate(() => !document.querySelector('.paint-ctx').classList.contains('min')) && await shown() && await selOpen(), tag + ': the settings button opens them out, its actions in view, the selection kept');
    // (undo and redo keep working with the actions in the panel)
    await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
    ok(!(await selOpen()), tag + ': undo takes the selection back');
    await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(300);
    ok(await selOpen() && await shown(), tag + ': redo brings it back, and its actions');
    await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    ok(!(await selOpen()), tag + ': Return commits it');
  }
  await p.screenshot({ path: 'panel-' + tag + '.png' });
  ok(!errs.length, tag + ': no errors ' + errs.join(' | '));
  await b.close(); L.done();
})();
