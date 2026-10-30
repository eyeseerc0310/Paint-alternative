// The layer menu's Copy and Paste, the top bar without Open (it's New
// Picture's Import Picture now, in Paint, Vector and Photo, each opening what
// it opens), and two icons that are another button's own: the bottom bar's
// tool settings has Photo's settings panel icon, and Photo's Edit has Paint's
// Effects icon. Run as:
// node reorg.js light|dark width height [touch]
const L = require('../lib');
const { chromium } = L.use({ hdrOpen: true });
const [theme, VW, VH] = [process.argv[2] || 'light', +(process.argv[3] || 1400), +(process.argv[4] || 900)];
const touch = process.argv.includes('touch'), phone = VW <= 560;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, hasTouch: touch, colorScheme: theme });
  await ctx.addInitScript(() => { try { localStorage.setItem('paint-mode-ask', 'false'); } catch (e) {} });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(900);
  await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
  const tapAt = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
  const tapEl = async s => { const e = typeof s === 'string' ? await p.$(s) : s; await e.evaluate(el => el.scrollIntoView({ block: 'nearest' })); const r = await e.boundingBox(); await tapAt(r.x + r.width / 2, r.y + r.height / 2); await p.waitForTimeout(250); };
  const settingsItem = async name => { await p.$eval('[data-hb="settings"]', e => e.click()); await p.waitForTimeout(250); await p.$eval('[data-setting="' + name + '"]', e => e.click()); await p.waitForTimeout(600); };
  const count = () => p.$$eval('.paint-layers canvas', l => l.length);
  const at = async (fx, fy) => p.evaluate(([fx, fy]) => { const w = document.querySelector('.paint-world').getBoundingClientRect(); return [w.left + w.width * fx, w.top + w.height * fy]; }, [fx, fy]);
  // (a layer's pixels, summed, and how it's shown)
  const layer = i => p.evaluate(i => {
    const cs = document.querySelectorAll('.paint-layers canvas'), c = cs[i < 0 ? cs.length + i : i]; if (!c) return null;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0, a = 0;
    for (let k = 0; k < d.length; k += 4) { if (d[k + 3]) { a++; h = (h * 31 + d[k] * 7 + d[k + 1] * 3 + d[k + 3] + k) % 1e9; } }
    return { w: c.width, h: c.height, hash: h, solid: a, op: c.style.opacity, blend: c.style.mixBlendMode };
  }, i);
  const openLayers = async () => { if (await p.$eval('.paint-layerpanel', e => e.hidden)) await p.$eval('[data-act="layers"]', e => e.click()); await p.waitForTimeout(250); };
  const menuItems = async () => p.$$eval('.paint-lmenu [data-lm]', l => l.map(b => b.dataset.lm + (b.disabled ? '(off)' : '')));
  const menu = async (row, item) => {
    await openLayers(); const btns = await p.$$('.pl-more'); await tapEl(btns[row]);
    if (item) { const it = await p.$('.paint-lmenu [data-lm="' + item + '"]'); await tapEl(it); await p.waitForTimeout(300); }
  };

  // ---- 1. THE LAYER MENU: Copy and Paste ----
  await openLayers(); await p.$eval('[data-layer-act="add"]', e => e.click()); await p.waitForTimeout(200);
  await p.$eval('[data-act="layers"]', e => e.click()); await p.waitForTimeout(200);
  await p.$eval('.paint-size', e => { e.value = 700; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const s0 = await at(0.3, 0.4), s1 = await at(0.6, 0.6);
  await p.mouse.move(...s0); await p.mouse.down(); await p.mouse.move(...s1, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(300);
  await openLayers();
  await p.$eval('[data-layer-op]', e => { e.value = 50; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.$eval('[data-layer-blend]', e => { e.value = 'multiply'; e.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(200);
  const orig = await layer(-1), n0 = await count();
  L.ok(orig.solid > 50 && orig.op === '0.5' && orig.blend === 'multiply', 'a layer with paint, at 50% and Multiply ' + JSON.stringify(orig));
  await menu(0);
  let items = await menuItems();
  L.ok(items.includes('copy') && items.includes('paste(off)'), 'its menu has Copy, and Paste (greyed out, nothing copied yet): ' + items.join(', '));
  L.ok(items.indexOf('copy') === items.indexOf('duplicate') + 1, 'Copy and Paste come after Duplicate');
  await tapEl('.paint-lmenu [data-lm="copy"]'); await p.waitForTimeout(250);
  L.ok(await p.$eval('.paint-lmenu', e => e.hidden), 'Copy closes the menu');
  L.ok(await count() === n0, 'Copy changes nothing');
  await menu(0); items = await menuItems();
  L.ok(items.includes('paste'), 'after a copy, Paste can be picked');
  await tapEl('.paint-lmenu [data-lm="paste"]'); await p.waitForTimeout(400);
  let pasted = await layer(-1);
  L.ok(await count() === n0 + 1, 'Paste adds a layer (' + n0 + ' → ' + await count() + ')');
  L.ok(pasted.hash === orig.hash && pasted.solid === orig.solid, 'with the very same pixels, where they were, see-through round them');
  L.ok(pasted.op === '0.5' && pasted.blend === 'multiply', 'its opacity and blend mode too ' + JSON.stringify([pasted.op, pasted.blend]));
  const names = await p.$$eval('.pl-row .pl-name span', l => l.map(e => e.textContent));
  L.ok(names[0] === names[1], 'its name too, above the one it came from: ' + names.slice(0, 2).join(' / '));
  // (independent: changing the original leaves the copy and what's kept to paste alone)
  await p.evaluate(() => { const cs = document.querySelectorAll('.paint-layers canvas'), c = cs[cs.length - 2].getContext('2d'); c.fillStyle = '#0f0'; c.fillRect(0, 0, 40, 40); });
  L.ok((await layer(-1)).hash === orig.hash && (await layer(-2)).hash !== orig.hash, 'the pasted layer is its own: the original changed, the paste didn’t');
  await menu(0, 'paste');
  L.ok(await count() === n0 + 2 && (await layer(-1)).hash === orig.hash, 'pasting again gives the layer as it was copied, not as it is now');
  await p.$eval('[data-act="undo"]', e => e.click()); await p.waitForTimeout(300);
  L.ok(await count() === n0 + 1, 'one undo takes one paste away');
  // (a long menu, a mask's items too: it never covers the ••• that opened it, so that closes it again)
  await menu(0, 'addmask'); await p.waitForTimeout(200);
  await menu(0);
  const cover = await p.evaluate(() => { const b = document.querySelector('.pl-more'), r = b.getBoundingClientRect(), m = document.querySelector('.paint-lmenu'), q = m.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { free: !!e && !!e.closest('.pl-more'), inView: q.top >= 0 && q.bottom <= innerHeight, scrolls: m.scrollHeight > m.clientHeight + 1, items: m.querySelectorAll('[data-lm]').length }; });
  L.ok(cover.free && cover.inView, 'a long layer menu stays in the window without covering its ••• button ' + JSON.stringify(cover));
  await tapEl((await p.$$('.pl-more'))[0]);
  L.ok(await p.$eval('.paint-lmenu', e => e.hidden), 'which closes it again');
  await p.$eval('[data-act="undo"]', e => e.click()); await p.waitForTimeout(300);
  // (another drawing, another size: pasted at the same pixels)
  await p.$eval('[data-hb="new"]', e => e.click()); await p.waitForTimeout(400);
  await p.$eval('.ns [data-ns="w"]', e => { e.value = 900; }); await p.$eval('.ns [data-ns="h"]', e => { e.value = 700; });
  await tapEl('.ns [data-ns-act="create"]'); await p.waitForTimeout(800);
  const n1 = await count();
  await menu(0, 'paste'); await p.waitForTimeout(300);
  const other = await layer(-1);
  L.ok(await count() === n1 + 1 && other.w === 900 && other.solid > 0 && other.op === '0.5' && other.blend === 'multiply', 'and into a new picture of another size ' + JSON.stringify(other));
  await p.screenshot({ path: `reorg-${theme}-${VW}-layers.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);

  // ---- 2. THE TOP BAR: no Open; New Picture has Import Picture ----
  L.ok(!(await p.$('[data-hb="open"]')) && !(await p.$('.site-header .hb.paint-open')), 'the top bar has no Open button');
  L.ok(await p.$eval('.paint-open', e => e.hidden && getComputedStyle(e).display === 'none') && !!(await p.$('.paint-open input[type="file"]')), 'the one file picker is still there, out of sight');
  if (phone) {
    await p.$eval('[data-hb="more"]', e => e.click()); await p.waitForTimeout(250);
    L.ok(!(await p.$('.paint-moremenu [data-more="open"]')) && !!(await p.$('.paint-moremenu [data-more="new"]')), 'the phone’s ••• menu has no Open either, New Picture still');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  }
  const accept = await p.$eval('.paint-open input', e => e.accept);
  L.ok(/image\/\*/.test(accept) && /\.paint/.test(accept) && /\.cr2/.test(accept) && /\.dng/.test(accept) && /\.heic/.test(accept) && /\.tiff?/.test(accept), 'it still takes pictures, projects, RAW, HEIC and TIFF');
  const importVia = async (file, label) => {
    await p.$eval('[data-hb="new"]', e => e.click()); await p.waitForTimeout(450);
    const sh = await p.evaluate(() => { const s = document.querySelector('.pa-sheet.ns'), b = s && s.querySelector('[data-ns-act="import"]'); if (!b) return null; b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(), q = s.getBoundingClientRect(); return { text: b.textContent.trim(), icon: !!b.querySelector('svg'), inside: r.left >= q.left && r.right <= q.right && r.top >= q.top - 1 && r.bottom <= q.bottom + 1, row: [...b.parentNode.children].map(x => Math.round(x.getBoundingClientRect().top)), presets: s.querySelectorAll('.ns-pre').length, create: !!s.querySelector('[data-ns-act="create"]'), tip: b.dataset.tip }; });
    L.ok(sh && sh.text === 'Import Picture' && sh.icon && sh.inside, label + ': New Picture has Import Picture, with its icon, inside the sheet ' + JSON.stringify(sh));
    L.ok(sh && sh.presets >= 6 && sh.create, label + ': the blank picture’s sizes and Create are all still there');
    if (phone) L.ok(sh && sh.row[0] < sh.row[1] && sh.row[1] === sh.row[2], label + ': on a phone, a row of its own over Cancel and Create ' + JSON.stringify(sh && sh.row));
    else L.ok(sh && sh.row[0] === sh.row[1] && sh.row[1] === sh.row[2], label + ': in one row with Cancel and Create ' + JSON.stringify(sh && sh.row));
    if (label === 'Paint') await p.screenshot({ path: `reorg-${theme}-${VW}-new.png` });
    const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 5000 }), tapEl('.ns [data-ns-act="import"]')]);
    L.ok(!!fc, label + ': Import Picture opens the file picker');
    await fc.setFiles(L.fixture(file)); await p.waitForTimeout(1300);
    L.ok(!(await p.$('.pa-sheet-wrap.in')), label + ': the sheet has closed');
    return sh;
  };
  const before = await count();
  await importVia('scene.png', 'Paint');
  L.ok(await count() === before + 1, 'Paint: the picture comes in on a new layer, as Open did (' + before + ' → ' + await count() + ')');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);

  await settingsItem('vector');
  L.ok(await p.evaluate(() => document.documentElement.classList.contains('vector-mode')), 'in Vector mode');
  const vImg = () => p.evaluate(() => (JSON.stringify(PaintVector.serialize()).match(/"type":"image"/g) || []).length);
  const vb = await vImg();
  const vs = await importVia('red.png', 'Vector');
  L.ok(await vImg() === vb + 1, 'Vector: the picture is placed as an object (' + vb + ' → ' + await vImg() + ')');
  L.ok(/object/.test(vs.tip), 'Vector: its tip says so: ' + vs.tip);

  await settingsItem('photo');
  L.ok(await p.evaluate(() => document.documentElement.classList.contains('photo-mode')), 'in Photo mode');
  const ps = await importVia('scene.png', 'Photo');
  const st = await p.evaluate(() => PaintPhoto.state());
  L.ok(st.w === 600 && st.h === 400, 'Photo: the photo is open to edit ' + JSON.stringify({ w: st.w, h: st.h }));
  L.ok(/RAW/.test(ps.tip), 'Photo: its tip names RAW: ' + ps.tip);

  // ---- 3 and 4. THE ICONS: another button's own, drawn the same ----
  const ic = await p.evaluate(() => {
    const svg = s => document.querySelector(s + ' svg'), box = e => { const r = e.getBoundingClientRect(); return [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; };
    const cs = e => { const c = getComputedStyle(e); return [c.strokeWidth, c.strokeLinecap, c.strokeLinejoin, c.fill]; };
    const ed = svg('[data-pcat="edit"]'), crop = svg('[data-pcat="crop"]'), fx = svg('.paint-adjust-btn'), pb = svg('.pho-panelbtn'), ts = svg('.paint-settings-toggle');
    return { editSame: ed.innerHTML === fx.innerHTML, editBox: box(ed), cropBox: box(crop), editCs: cs(ed), cropCs: cs(crop), panelSame: pb.innerHTML === ts.innerHTML,
      editBtn: box(ed.closest('button')), cropBtn: box(crop.closest('button')) };
  });
  L.ok(ic.editSame, 'Photo’s Edit has Paint’s Effects icon, exactly');
  L.ok(JSON.stringify(ic.editBox) === JSON.stringify(ic.cropBox) && JSON.stringify(ic.editCs) === JSON.stringify(ic.cropCs) && JSON.stringify(ic.editBtn) === JSON.stringify(ic.cropBtn), 'the same size, stroke and button as the others ' + JSON.stringify([ic.editBox, ic.cropBox, ic.editCs]));
  L.ok(ic.panelSame, 'the bottom bar’s tool settings and Photo’s settings panel button draw the same icon');
  await p.screenshot({ path: `reorg-${theme}-${VW}-photo.png` });
  await settingsItem('paint');
  const tg = await p.evaluate(() => {
    const t = document.querySelector('.paint-settings-toggle svg'), u = document.querySelector('.paint-bottom [data-act="undo"] svg'), r = e => { const q = e.getBoundingClientRect(); return [q.width, q.height]; }, c = e => getComputedStyle(e).strokeWidth;
    return { t: r(t), u: r(u), ts: c(t), us: c(u), rect: !!t.querySelector('rect'), shown: t.closest('button').offsetParent !== null };
  });
  L.ok(tg.shown && tg.rect && JSON.stringify(tg.t) === JSON.stringify(tg.u) && tg.ts === tg.us, 'Paint: the tool settings button shows the panel icon, the size and stroke of the bar’s others ' + JSON.stringify(tg));
  await p.screenshot({ path: `reorg-${theme}-${VW}-paint.png` });
  L.ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
  L.done();
})();
