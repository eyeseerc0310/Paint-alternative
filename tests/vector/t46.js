// The mode switch: a small pill over the top of the picture's space (the
// window's middle, level with the top bar's strip; on a phone, the middle of
// the picture's space, the tool strip under it), showing the workspace in
// use. Pressed, it moves down a touch and grows into the menu of the three,
// the one in use ticked; a pick switches (asking first when there's art to
// bring) and it shrinks back; a press anywhere else, or Esc, closes it with
// nothing switched. Settings has no workspaces in it any more.
const V = require('./vt.js'), L = require('../lib');
(async () => {
  for (const [vp, name] of [[{ width: 1400, height: 900 }, 'desk'], [{ width: 1024, height: 768 }, 'ipad'], [{ width: 375, height: 812 }, 'phone']]) {
    const touch = name !== 'desk';
    const H = await V.setup({ viewport: vp, hasTouch: touch, isMobile: name === 'phone' }), p = H.p, ok = V.ok;
    const pill = () => p.evaluate(() => { const m = document.querySelector('.mode-switch'), h = m.querySelector('.ms-head'), r = m.getBoundingClientRect(), st = document.querySelector('.paint-stage').getBoundingClientRect(), fold = document.querySelector('.hdr-fold').getBoundingClientRect();
      return { shown: !m.hidden && getComputedStyle(m).visibility !== 'hidden' && r.width > 0, open: m.classList.contains('open'), exp: h.getAttribute('aria-expanded'), text: h.textContent.trim(), chev: !!h.querySelector('.ms-chev'), x: r.left + r.width / 2, top: r.top, w: r.width, h: r.height, vw: innerWidth / 2, stageMid: st.left + st.width / 2, stageTop: st.top, foldMid: fold.top + fold.height / 2, ty: new DOMMatrix(getComputedStyle(m).transform).m42,
        items: [...m.querySelectorAll('[data-mode]')].filter(b => !b.hidden).map(b => b.dataset.mode + (b.getAttribute('aria-checked') === 'true' ? '✓' : '')).join(','), vec: document.documentElement.classList.contains('vector-mode') }; });
    const tapAt = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
    const press = async s => { const r = await (await p.$(s)).boundingBox(); await tapAt(r.x + r.width / 2, r.y + r.height / 2); await p.waitForTimeout(450); };
    let s = await pill();
    ok(s.shown && !s.open && s.exp === 'false' && /Paint/.test(s.text) && s.chev, name + ': the pill shows Paint, with its chevron ' + JSON.stringify({ text: s.text }));
    if (name === 'phone') ok(Math.abs(s.x - s.stageMid) <= 1, name + ': over the middle of the picture’s space ' + JSON.stringify({ x: s.x, mid: s.stageMid }));
    else ok(Math.abs(s.x - s.vw) <= 1 && Math.abs((s.top + s.h / 2) - s.foldMid) <= 2, name + ': in the middle of the window, level with the top bar’s strip ' + JSON.stringify({ x: s.x, vw: s.vw, mid: s.top + s.h / 2, fold: s.foldMid }));
    ok(s.h <= 32 && s.w <= 130, name + ': small ' + s.w + '×' + s.h);
    ok(s.top + s.h <= s.stageTop, name + ': in the band over the picture’s space, never over it ' + JSON.stringify({ bottom: s.top + s.h, stage: s.stageTop }));
    const w0 = s.w, h0 = s.h;
    // (Settings: no workspaces, no Ask to Bring Art)
    await p.evaluate(() => document.querySelector('[data-hb="settings"]').click()); await p.waitForTimeout(250);
    ok(!(await p.$('[data-setting="paint"], [data-setting="vector"], [data-setting="photo"], [data-setting="modeask"]')) && !!(await p.$('[data-setting="theme"]')), name + ': Settings has no workspaces and no Ask to Bring Art');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    // open: down a touch, taller and a little wider, the three, Paint ticked
    await press('.ms-head');
    s = await pill();
    ok(s.open && s.exp === 'true' && s.items === 'paint✓,vector,photo', name + ': pressed, its menu: ' + s.items);
    ok(Math.abs(s.ty) < 0.5 && Math.abs(s.h - h0) <= 1 && s.w > w0 + 100, name + ': grown sideways, the same height, in the same place ' + JSON.stringify({ ty: s.ty, h: s.h, w: s.w, w0 }));
    ok(Math.abs(s.x - (name === 'phone' ? s.stageMid : s.vw)) <= 1, name + ': still centred');
    const row = await p.evaluate(() => { const bs = [...document.querySelectorAll('.ms-items [data-mode]')].filter(b => !b.hidden), rs = bs.map(b => b.getBoundingClientRect()), m = document.querySelector('.mode-switch').getBoundingClientRect(); return { tops: [...new Set(rs.map(r => Math.round(r.top)))].length, inside: rs.every(r => r.left >= m.left && r.right <= m.right + 0.5), order: rs.every((r, i) => !i || r.left >= rs[i - 1].right - 0.5), cut: bs.some(b => { const t = b.querySelector('span'); return t.scrollWidth > t.clientWidth; }), picked: getComputedStyle(bs[0]).backgroundColor !== getComputedStyle(bs[1]).backgroundColor, icons: bs.every(b => !!b.querySelector('svg')) }; });
    ok(row.tops === 1 && row.inside && row.order && !row.cut && row.icons, name + ': Paint | Vector | Photo side by side, each its icon and whole name, inside the pill ' + JSON.stringify(row));
    ok(row.picked, name + ': the one in use picked');
    if (name !== 'phone') await p.screenshot({ path: 't46-' + name + '-open.png', clip: { x: vp.width / 2 - 160, y: 0, width: 320, height: 200 } });
    else await p.screenshot({ path: 't46-' + name + '-open.png' });
    // a press elsewhere: closed, nothing switched
    // (on the left bar's own padding: nothing there to press, nothing painted)
    const lb = await (await p.$('.paint-left')).boundingBox();
    await tapAt(lb.x + 3, lb.y + lb.height - 3); await p.waitForTimeout(450);
    s = await pill();
    ok(!s.open && !s.vec && Math.abs(s.h - h0) <= 1, name + ': a press elsewhere closes it, still Paint');
    // Paint again: nothing happens
    await press('.ms-head'); await press('.ms-items [data-mode="paint"]');
    s = await pill(); ok(!s.open && !s.vec && !(await p.$('.pa-sheet-wrap.in .vm')), name + ': Paint picked again: closed, nothing switched');
    // Vector: blank painting, so no question
    await L.pickMode(p, 'vector', touch); await p.waitForTimeout(600);
    s = await pill();
    ok(s.vec && !s.open && /Vector/.test(s.text) && s.items === 'paint,vector✓,photo', name + ': Vector picked: switched, the pill says Vector, ticked in the menu ' + JSON.stringify({ vec: s.vec, open: s.open, text: s.text, items: s.items }));
    // (the artboard is fitted clear of the pill)
    const ab = await p.evaluate(() => { const b = document.querySelector('.vec-board').getBoundingClientRect(), m = document.querySelector('.mode-switch').getBoundingClientRect(); return { b: b.top, m: m.bottom }; });
    if (name !== 'phone') ok(ab.b >= ab.m, name + ': the artboard clear of the pill ' + JSON.stringify(ab));
    await H.tool('rect'); const [bw, bh] = await p.evaluate(() => [window.PaintVector.serialize().w, window.PaintVector.serialize().h]); await H.drag([bw * 0.2, bh * 0.6], [bw * 0.6, bh * 0.85]); // (low on the artboard: clear of a phone's tool strip)
    ok((await p.evaluate(() => window.PaintVector.serialize().layers[0].items.length)) === 1, name + ': a rectangle drawn');
    // Paint: Vector has art, so it asks
    await L.pickMode(p, 'paint', touch); await p.waitForTimeout(500);
    ok(!!(await p.$('.pa-sheet-wrap.in .vm [data-vm="bring"]')), name + ': leaving art behind asks first');
    await press('.pa-sheet-wrap.in [data-vm="switch"]');
    s = await pill();
    ok(!s.vec && /Paint/.test(s.text), name + ': Switch Without Copying: Paint, the pill says so');
    ok((await p.evaluate(() => window.PaintVector.serialize().layers[0].items.length)) === 1, name + ': the vector art kept');
    // the keyboard: Esc closes, the focus back on the pill
    if (!touch) {
      await p.focus('.ms-head'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
      ok((await pill()).open, name + ': Return on the pill opens it');
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      ok(!(await pill()).open && await p.evaluate(() => document.activeElement.classList.contains('ms-head')), name + ': Esc closes it, the focus on the pill');
    }
    // (the dock folded: the pill doesn't move)
    if (name !== 'phone') {
      const x0 = (await pill()).x;
      await p.evaluate(() => { const m = document.querySelector('.paint-ctx .ctx-min'); if (m) m.click(); }); await p.waitForTimeout(600);
      ok(Math.abs((await pill()).x - x0) <= 1, name + ': the tool settings folded away: the pill stays where it is');
      await p.evaluate(() => { const m = document.querySelector('.paint-ctx .ctx-min'); if (m) m.click(); }); await p.waitForTimeout(400);
    }
    if (name === 'phone') {
      const top = await p.$eval('.paint-ctx', c => parseFloat(getComputedStyle(c).top)), m = await p.$eval('.mode-switch', e => e.getBoundingClientRect().bottom - document.querySelector('.paint-stage').getBoundingClientRect().top);
      ok(top >= m, 'phone: the tool strip starts under the pill ' + JSON.stringify({ top, m }));
    }
    await p.screenshot({ path: 't46-' + name + '.png' });
    ok(!H.errs.length, name + ': no errors ' + H.errs.join('\n'));
    await H.b.close();
  }
  V.done();
})();
