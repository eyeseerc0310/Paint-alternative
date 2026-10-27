// The text tool: while words are typed, every setting in its panel changes
// them without laying them down, the letters highlighted stay highlighted
// and the dashed box stays round the words (following their size, spacing
// and line height); a tap on the picture lays them down, and they can be
// opened again. Run as: node text.js light|dark width height [touch] [safari]
// ("safari" acts as Safari does, which the iPad runs: a pressed button or
// slider takes no focus, and a press nobody stopped clears the highlight).
const L = require('../lib');
const { chromium } = L.use({});
const [theme, VW, VH] = [process.argv[2] || 'light', +(process.argv[3] || 1400), +(process.argv[4] || 900)];
const TY = VW < 600 ? 0.62 : 0.3; // (where the words start: under the phone's strip of settings)
const touch = process.argv.includes('touch'), safari = process.argv.includes('safari');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, hasTouch: touch, colorScheme: theme });
  if (safari) await ctx.addInitScript(() => {
    document.addEventListener('focusin', e => { const t = e.target; if (t.matches && t.matches('button, input[type="range"]')) t.blur(); }, true);
    window.addEventListener('mousedown', e => { if (!e.defaultPrevented && e.target.closest && e.target.closest('button, input[type="range"]')) getSelection().removeAllRanges(); });
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(800);
  await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
  const tapAt = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
  const tapEl = async (s, fx = 0.5) => { const e = await p.$(s); L.ok(!!e, 'there is ' + s); await e.scrollIntoViewIfNeeded(); const r = await e.boundingBox(); await tapAt(r.x + r.width * fx, r.y + r.height / 2); await p.waitForTimeout(120); };
  const measure = () => p.$eval('.paint-world', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  let world = await measure();
  const state = () => p.evaluate(() => {
    const t = document.querySelector('.paint-text'); if (!t) return { box: false };
    const cs = getComputedStyle(t), r = t.getBoundingClientRect(), a = document.activeElement;
    return { box: true, focus: a === t, field: !!(a && a.dataset && a.dataset.ctx === 'tsize'), hi: (t.contains(getSelection().anchorNode) ? getSelection().toString() : (window.CSS && CSS.highlights && CSS.highlights.get('paint-text-kept') ? [...CSS.highlights.get('paint-text-kept')][0].toString() : '')).toLowerCase(), text: t.innerText.toLowerCase(),
      outline: cs.outlineStyle + ' ' + cs.outlineWidth, ocol: cs.outlineColor, w: r.width, h: r.height,
      weight: cs.fontWeight, style: cs.fontStyle, deco: cs.textDecorationLine, caps: cs.textTransform, shadow: cs.textShadow, align: cs.textAlign,
      ls: parseFloat(cs.letterSpacing) || 0, lh: t.style.lineHeight, fs: parseFloat(cs.fontSize), font: cs.fontFamily, stroke: t.style.webkitTextStroke, color: cs.color };
  });
  const open = (s, l, hi = 'there') => {
    L.ok(s.box, l + ': the words are still being typed');
    L.ok(s.outline === 'dashed 1px' && !/, 0\)$/.test(s.ocol), l + ': the dashed box shows (' + s.outline + ' ' + s.ocol + ')');
    if (hi !== null) L.ok(s.hi === hi, l + ': "' + hi + '" is still highlighted (got "' + s.hi + '")');
  };
  // words, with some of them highlighted
  await p.keyboard.press('t'); await p.waitForTimeout(500);
  await tapAt(world.x + world.w * 0.15, world.y + world.h * TY); await p.waitForTimeout(touch ? 700 : 250);
  await p.keyboard.type('Hello there');
  await p.keyboard.down('Shift'); for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowLeft'); await p.keyboard.up('Shift');
  let s = await state(); open(s, 'typed'); L.ok(s.focus, 'the words have the focus');
  const w0 = s.w, h0 = s.h;
  // the style buttons, and alignment
  for (const [sel, key, want] of [['[data-ctx-t="bold"]', 'weight', '700'], ['[data-ctx-t="italic"]', 'style', 'italic'], ['[data-ctx-t="underline"]', 'deco', 'underline'], ['[data-ctx-t="caps"]', 'caps', 'uppercase'], ['[data-ctx-t="shadow"]', 'shadow', /px/], ['[data-ctx-al="center"]', 'align', 'center'], ['[data-ctx-al="right"]', 'align', 'right'], ['[data-ctx-al="left"]', 'align', 'left']]) {
    await tapEl('.paint-ctx ' + sel); s = await state(); open(s, sel);
    L.ok(want instanceof RegExp ? want.test(s[key]) : s[key] === want, sel + ' changes the words (' + key + ' ' + s[key] + ')');
    L.ok(s.focus, sel + ': the words keep the focus, so typing carries on');
  }
  // the sliders, dragged or tapped: live while they move, the box following
  for (const [k, key] of [['tspacing', 'ls'], ['tlh', 'lh'], ['toutline', 'stroke'], ['tsizer', 'fs']]) {
    const was = (await state())[key], e = await p.$('.paint-ctx [data-ctx="' + k + '"]'); await e.scrollIntoViewIfNeeded(); const r = await e.boundingBox();
    if (touch) await tapAt(r.x + r.width * 0.4, r.y + r.height / 2);
    else {
      await p.mouse.move(r.x + r.width * 0.3, r.y + r.height / 2); await p.mouse.down();
      await p.mouse.move(r.x + r.width * 0.6, r.y + r.height / 2, { steps: 4 });
      const mid = await state(); open(mid, k + ' mid-drag'); L.ok(mid[key] !== was, k + ' changes the words while it moves');
      await p.mouse.move(r.x + r.width * 0.8, r.y + r.height / 2, { steps: 4 }); await p.mouse.up();
    }
    await p.waitForTimeout(120); s = await state(); open(s, k); L.ok(s[key] !== was, k + ' changed the words (' + was + ' → ' + s[key] + ')');
    L.ok(s.focus, k + ': the words have the focus back once it\'s let go of');
  }
  s = await state(); L.ok(s.w > w0 && s.h > h0, 'the box grew with the words (' + Math.round(w0) + 'x' + Math.round(h0) + ' → ' + Math.round(s.w) + 'x' + Math.round(s.h) + ')');
  const box = await p.evaluate(() => { const t = document.querySelector('.paint-text'), r = t.getBoundingClientRect(), g = document.createRange(); g.selectNodeContents(t); const q = g.getBoundingClientRect(); return { r: [r.left, r.top, r.right, r.bottom], q: [q.left, q.top, q.right, q.bottom] }; });
  L.ok(box.q[0] >= box.r[0] - 2 && box.q[2] <= box.r[2] + 2 && box.q[1] >= box.r[1] - 2 && box.q[3] <= box.r[3] + 2, 'the box is round the words ' + JSON.stringify(box));
  // the size typed: the field has the focus while it's typed in, Return gives it back
  await tapEl('.paint-ctx [data-ctx="tsize"]'); await p.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A'); await p.keyboard.type('72');
  s = await state(); open(s, 'size typed', null); L.ok(s.field && Math.abs(s.fs - 72 * (await p.evaluate(() => { const t = document.querySelector('.paint-text'); return parseFloat(t.style.fontSize) / 72; }))) < 0.5, 'the size typed shows at once');
  await p.keyboard.press('Enter'); await p.waitForTimeout(100); s = await state(); open(s, 'size Return'); L.ok(s.focus, 'Return gives the words the focus back');
  // a font from the list
  await tapEl('.paint-ctx [data-ctx="fonts"]'); await p.waitForTimeout(200); s = await state(); open(s, 'font list open');
  await tapEl('.ctx-list [data-val*="Georgia"]'); await p.waitForTimeout(200); s = await state(); open(s, 'font picked'); L.ok(/Georgia/.test(s.font), 'the font changed (' + s.font + ')'); L.ok(s.focus, 'the font list leaves the words the focus');
  // a fill, and back
  await tapEl('.paint-ctx [data-ctx-tf="rainbow"]'); s = await state(); open(s, 'rainbow fill');
  await tapEl('.paint-ctx [data-ctx-tf="solid"]'); s = await state(); open(s, 'solid fill');
  // a colour from the picker, through the bottom bar
  await tapEl('.paint-bottom .paint-current'); await p.waitForTimeout(250);
  L.ok(await p.evaluate(() => !document.querySelector('.paint-colorpanel').hidden), 'the colour picker opened from the bottom bar');
  s = await state(); open(s, 'colour picker open'); const was = s.color;
  await tapEl('.paint-colorpanel [data-pcv="hex"]'); await p.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A'); await p.keyboard.type('#2266cc');
  s = await state(); open(s, 'colour typed', null); L.ok(s.color !== was, 'the colour changed (' + was + ' → ' + s.color + ')');
  await p.keyboard.press('Enter'); await p.waitForTimeout(150); s = await state(); open(s, 'colour Return'); L.ok(s.focus, 'Return in the colour gives the words the focus back');
  await tapEl('.paint-bottom .paint-current'); await p.waitForTimeout(250); s = await state(); open(s, 'colour picker closed');
  L.ok(await p.evaluate(() => document.querySelector('.paint-colorpanel').hidden), 'a second tap on the colour closes the picker'); L.ok(s.focus, 'and the words keep the focus');
  // (which folds the tool settings, as it always has: the bottom bar's toggle brings them back)
  await tapEl('.paint-bottom .paint-settings-toggle'); await p.waitForTimeout(400); s = await state(); open(s, 'settings back');
  L.ok(await p.evaluate(() => !document.querySelector('.paint-ctx').classList.contains('min')), 'the settings are back'); L.ok(s.focus, 'and the words still have the focus');
  world = await measure();
  // more typing goes over the highlight, as it would anywhere
  await p.keyboard.type('world'); s = await state(); open(s, 'typed over', ''); L.ok(s.text === 'hello world', 'typing replaces what was highlighted (' + s.text + ')');
  // a tap on the picture lays them down: no box, a text layer with all that
  const layersBefore = await p.evaluate(() => document.querySelectorAll('.pl-row').length);
  L.ok(await p.evaluate(() => { const st = document.querySelector('.paint-stage'); return !st.scrollLeft && !st.scrollTop; }), 'the picture never slides inside its space as the words run past its edge');
  const first = await p.evaluate(() => { const t = document.querySelector('.paint-text'), g = document.createRange(), n = t.firstChild; g.setStart(n, 0); g.setEnd(n, 3); const r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const away = await p.evaluate(w => { const r = document.querySelector('.paint-text').getBoundingClientRect(); const below = r.bottom + 30, above = r.top - 30;
    return [w.x + w.w * 0.5, below < w.y + w.h - 20 ? below : above]; }, world); // (on the picture, clear of the words' box)
  await tapAt(away[0], away[1]); await p.waitForTimeout(touch ? 700 : 300);
  s = await state(); L.ok(!s.box, 'a tap on the picture lays the words down, and the box goes');
  L.ok((await p.evaluate(() => document.querySelectorAll('.pl-row').length)) === layersBefore + 1, 'as a layer of their own');
  const T = await p.evaluate(() => { const r = document.querySelector('.pl-row.on .pl-name span, .pl-row[aria-selected="true"] .pl-name span'); return r && r.textContent; });
  L.ok(/Hello world/i.test(T || ''), 'named for the words (' + T + ')');
  // opened again: a tap on them with the text tool
  await tapAt(first[0], first[1]); await p.waitForTimeout(touch ? 700 : 300);
  world = await measure(); s = await state(); L.ok(s.box && s.text === 'hello world', 'a tap on the words opens them again (' + s.text + ')'); open(s, 'opened again', null);
  L.ok(s.weight === '700' && /Georgia/.test(s.font) && s.caps === 'uppercase', 'with their look');
  await p.keyboard.down('Shift'); for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowLeft'); await p.keyboard.up('Shift');
  await tapEl('.paint-ctx [data-ctx-t="bold"]'); s = await state(); open(s, 'bold again', 'world');
  L.ok(s.weight === '400', 'bold taken off');
  // another tool lays them down
  await p.keyboard.press('Escape'); await p.waitForTimeout(150); s = await state(); L.ok(!s.box, 'Esc leaves them as they were');
  L.ok(errs.length === 0, 'no errors ' + JSON.stringify(errs));
  await p.screenshot({ path: 'text-' + theme + '-' + VW + (touch ? '-touch' : '') + (safari ? '-safari' : '') + '.png' });
  await b.close();
  L.done();
})();
