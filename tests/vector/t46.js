// The mode switch: one of the top-left menu's icon buttons, where Focus Mode
// was (Focus where History was; History in Settings); folded, the menu is
// the save status alone, a thin strip, and nothing stands over the
// picture's space.
// Pressed, the three open side by side in a pill in the middle of the
// picture's space, the one in use picked; a pick switches (asking first when
// there's art to bring) and it closes; a press anywhere else, or Esc, closes
// it with nothing switched. Every way round, by mouse and by finger.
// Settings has no workspaces in it.
const V = require('./vt.js'), L = require('../lib');
(async () => {
  for (const [vp, name] of [[{ width: 1400, height: 900 }, 'desk'], [{ width: 1024, height: 768 }, 'ipad'], [{ width: 375, height: 812 }, 'phone']]) {
    const touch = name !== 'desk';
    const H = await V.setup({ viewport: vp, hasTouch: touch, isMobile: name === 'phone' }), p = H.p, ok = V.ok;
    const st = () => p.evaluate(() => {
      const q = s => document.querySelector(s), r = s => q(s).getBoundingClientRect();
      const btn = q('.hdr-mode'), pop = q('.mode-switch'), b = r('.hdr-mode'), f = r('.hdr-fold'), h = r('.site-header'), s = r('.paint-stage'), m = r('.mode-switch');
      return {
        vis: !!btn.getClientRects().length, folded: !document.documentElement.classList.contains('hdr-open'),
        text: btn.textContent.trim(), exp: btn.getAttribute('aria-expanded'), chev: !!btn.querySelector('.ms-chev'), icon: !!btn.querySelector('.ms-cur svg'),
        open: pop.classList.contains('open'), shown: getComputedStyle(pop).visibility === 'visible' && +getComputedStyle(pop).opacity > 0.5,
        btn: { l: b.left, t: b.top, w: b.width, h: b.height, b: b.bottom }, fold: { l: f.left, t: f.top, w: f.width, h: f.height }, hdr: { t: h.top, b: h.bottom },
        stage: { t: s.top, cx: s.left + s.width / 2, cy: s.top + s.height / 2 }, pop: { cx: m.left + m.width / 2, cy: m.top + m.height / 2, l: m.left, r: m.right, w: m.width, h: m.height },
        items: [...pop.querySelectorAll('[data-mode]')].filter(e => !e.hidden).map(e => e.dataset.mode + (e.getAttribute('aria-checked') === 'true' ? '✓' : '')).join(','),
        vec: document.documentElement.classList.contains('vector-mode'), pho: document.documentElement.classList.contains('photo-mode'), vw: innerWidth
      };
    });
    const tapAt = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
    const press = async s => { const r = await (await p.$(s)).boundingBox(); await tapAt(r.x + r.width / 2, r.y + r.height / 2); await p.waitForTimeout(450); };
    const mode = () => p.evaluate(() => document.documentElement.classList.contains('vector-mode') ? 'vector' : document.documentElement.classList.contains('photo-mode') ? 'photo' : 'paint');
    let s = await st();
    // ---- folded: the save status alone, a thin strip, nothing over the picture ----
    ok(s.folded && !s.vis && s.hdr.b - s.hdr.t <= 44 && Math.abs(s.stage.t - s.hdr.t) <= 1, name + ': folded, the menu is the save status alone, and the picture’s space starts level with it ' + JSON.stringify({ hdr: s.hdr, stage: s.stage.t }));
    ok(!(await p.$('.paint-centre .mode-switch')), name + ': nothing over the top of the picture’s space');
    // ---- open: the mode button, an icon like the others, where Focus Mode was ----
    await press('.hdr-fold'); await p.waitForTimeout(500);
    s = await st();
    ok(s.vis && s.icon && !s.chev && /Paint/.test(s.text) && (await p.$eval('.hdr-mode .ms-cur span', e => getComputedStyle(e).display)) === 'none' && s.exp === 'false' && !s.open && !s.shown, name + ': the mode button, an icon (its name kept, not shown), nothing open ' + JSON.stringify({ text: s.text }));
    const slot = await p.evaluate(() => { const bs = [...document.querySelectorAll('.site-header .header-tools button')].filter(e => e.offsetParent), m = document.querySelector('.hdr-mode'), i = bs.indexOf(m), r = e => e.getBoundingClientRect();
      return { order: bs.map(e => e.dataset.hb || e.dataset.act || (e === m ? 'mode' : '?')).join(','), same: r(m).width === r(bs[0]).width && r(m).height === r(bs[0]).height, label: m.getAttribute('aria-label') }; });
    ok(slot.order === 'gallery,new,save,image,focus,guides,mode,settings', name + ': Focus where History was, the mode button where Focus was, no History: ' + slot.order);
    ok(slot.same && /Paint/.test(slot.label), name + ': the size of the others, its label the workspace ' + JSON.stringify(slot));
    // (Settings: no workspaces)
    await p.evaluate(() => document.querySelector('[data-hb="settings"]').click()); await p.waitForTimeout(250);
    ok(!(await p.$('[data-setting="paint"], [data-setting="vector"], [data-setting="photo"], [data-setting="modeask"]')) && !!(await p.$('[data-setting="theme"]')), name + ': Settings has no workspaces');
    // (History is in Settings now, opening the same list, Back to Settings)
    await press('.paint-docpanel [data-setting="history"]');
    ok(await p.evaluate(() => document.querySelector('.dp-title').textContent === 'History' && !!document.querySelector('.paint-docpanel .ph-list') && !document.querySelector('.dp-back').hidden), name + ': Settings’ History opens the history, with Back');
    await press('.dp-back'); ok(await p.evaluate(() => document.querySelector('.dp-title').textContent === 'Settings'), name + ': Back to Settings');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    // ---- pressed: the three, side by side, in the middle of the picture's space ----
    await press('.hdr-mode');
    s = await st();
    ok(s.open && s.shown && s.exp === 'true' && s.items === 'paint✓,vector,photo', name + ': pressed, the three: ' + s.items);
    const mid = Math.min(Math.max(s.stage.cx, 8 + s.pop.w / 2), s.vw - 8 - s.pop.w / 2);
    ok(Math.abs(s.pop.cx - mid) <= 1.5 && Math.abs(s.pop.cy - s.pop.h / 2 - s.stage.t - 32) <= 1.5, name + ': across the middle, near the top of the picture’s space ' + JSON.stringify({ pop: [s.pop.cx, s.pop.cy], stage: [s.stage.cx, s.stage.cy] }));
    ok(s.pop.l >= 0 && s.pop.r <= s.vw, name + ': inside the window');
    const row = await p.evaluate(() => { const bs = [...document.querySelectorAll('.mode-switch [data-mode]')].filter(b => !b.hidden), rs = bs.map(b => b.getBoundingClientRect()), m = document.querySelector('.mode-switch').getBoundingClientRect();
      return { tops: [...new Set(rs.map(r => Math.round(r.top)))].length, inside: rs.every(r => r.left >= m.left - 0.5 && r.right <= m.right + 0.5), order: rs.every((r, i) => !i || r.left >= rs[i - 1].right - 0.5), cut: bs.some(b => { const t = b.querySelector('span'); return t.scrollWidth > t.clientWidth; }), picked: getComputedStyle(bs[0]).backgroundColor !== getComputedStyle(bs[1]).backgroundColor, icons: bs.every(b => !!b.querySelector('svg')),
        top: bs.every((b, i) => { const r = rs[i], e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && b.contains(e); }) }; });
    ok(row.tops === 1 && row.inside && row.order && !row.cut && row.icons, name + ': Paint | Vector | Photo side by side, each its icon and whole name ' + JSON.stringify(row));
    ok(row.picked, name + ': the one in use picked');
    ok(row.top, name + ': above everything, nothing covering it');
    await p.screenshot({ path: 't46-' + name + '-open.png' });
    // a press elsewhere: closed, nothing switched
    const lb = await (await p.$('.paint-left')).boundingBox();
    await tapAt(lb.x + 3, lb.y + lb.height - 3); await p.waitForTimeout(450);
    s = await st(); ok(!s.open && !s.shown && s.exp === 'false' && !s.vec, name + ': a press elsewhere closes it, still Paint');
    // the one in use again: closed, nothing switched
    await press('.hdr-mode'); await press('.mode-switch [data-mode="paint"]');
    s = await st(); ok(!s.open && !s.vec && !(await p.$('.pa-sheet-wrap.in .vm')), name + ': Paint picked again: closed, nothing switched');
    // ---- every way round; a question only when there's art to leave ----
    const go = async (m, answer) => {
      await L.pickMode(p, m, touch); await p.waitForTimeout(600);
      const asked = !!(await p.$('.pa-sheet-wrap.in .vm [data-vm="bring"]'));
      if (asked) { await press('.pa-sheet-wrap.in [data-vm="' + (answer || 'switch') + '"]'); await p.waitForTimeout(400); }
      const now = await mode(), t = await st();
      ok(now === m && !t.open && new RegExp(m, 'i').test(t.text) && t.items.split(',').includes(m + '✓'), name + ': ' + m + ' picked: switched, the row says so' + (asked ? ' (after asking)' : '') + ' ' + JSON.stringify({ now, text: t.text }));
      return asked;
    };
    await go('vector');
    await H.tool('rect'); const [bw, bh] = await p.evaluate(() => [window.PaintVector.serialize().w, window.PaintVector.serialize().h]); await H.drag([bw * 0.2, bh * 0.6], [bw * 0.6, bh * 0.85]);
    ok((await p.evaluate(() => window.PaintVector.serialize().layers[0].items.length)) === 1, name + ': a rectangle drawn');
    // (leaving art behind asks first; Cancel stays)
    await L.pickMode(p, 'paint', touch); await p.waitForTimeout(500);
    ok(!!(await p.$('.pa-sheet-wrap.in .vm [data-vm="bring"]')), name + ': leaving art behind asks first');
    await press('.pa-sheet-wrap.in [data-vm="cancel"]'); await p.waitForTimeout(300);
    ok(await mode() === 'vector', name + ': Cancel: still Vector');
    ok(await go('paint') === true, name + ': Vector → Paint asked');
    ok((await p.evaluate(() => window.PaintVector.serialize().layers[0].items.length)) === 1, name + ': the vector art kept');
    await go('photo'); await go('vector'); await go('photo'); await go('paint');
    // ---- the keyboard: Return opens on the one in use, Esc closes, the focus back on the row ----
    if (!touch) {
      await p.focus('.hdr-mode'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
      ok((await st()).open && await p.evaluate(() => document.activeElement.dataset.mode === 'paint'), name + ': Return on the row opens it, on Paint');
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      ok(!(await st()).open && await p.evaluate(() => document.activeElement.classList.contains('hdr-mode')), name + ': Esc closes it, the focus on the row');
    }
    // ---- the pill open, the menu folded: the pill closes with it ----
    await press('.hdr-mode'); ok((await st()).open, name + ': open again');
    await press('.hdr-fold'); await p.waitForTimeout(400);
    s = await st(); ok(s.folded && !s.open && !s.shown && !s.vis, name + ': the menu folded: the pill closes, the button goes with it');
    await p.screenshot({ path: 't46-' + name + '.png' });
    ok(!H.errs.length, name + ': no errors ' + H.errs.join('\n'));
    await H.b.close();
  }
  V.done();
})();
