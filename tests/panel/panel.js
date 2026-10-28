// The top bar's panel: every option the top bar opens (Gallery, New
// Picture, Save, Crop, Rotate & Flip, History, Settings, Keyboard
// Shortcuts, and Touch Gestures from Settings) stands in the dock on wider
// screens, as wide as the tool settings, which step aside (and beside the
// left bar on phones, as Effects do), never a sheet over a dimmed page or a
// drop-down: with its title, Back for what opens inside it, and a close
// button. Another option takes its place; the same button closes it, as
// does Esc and the close button; the picture's space keeps its size from
// one option to the next; the tool in hand and its settings stay as they
// were. Share still asks the system. And each option still does what it
// did: Save downloads, History goes back a step, Crop, Rotate & Flip turns
// the picture, New Picture makes one, Settings switches the theme, Touch
// Gestures goes Back to Settings. Run as:
// node panel.js light|dark width height [touch]
const L = require('../lib');
const { chromium } = L.use({});
const [theme, VW, VH] = [process.argv[2] || 'light', +(process.argv[3] || 1400), +(process.argv[4] || 900)];
const touch = process.argv.includes('touch'), phone = VW <= 560;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, hasTouch: touch, colorScheme: theme, acceptDownloads: true });
  // (Share: the system's own sheet, seen through a stand-in)
  await ctx.addInitScript(() => { window.__shared = 0; navigator.share = () => { window.__shared++; return Promise.resolve(); }; navigator.canShare = () => true; });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(900);
  await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
  const tapAt = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
  const tapEl = async s => { const e = await p.$(s); await e.evaluate(el => el.scrollIntoView({ block: 'nearest' })); const r = await e.boundingBox(); await tapAt(r.x + r.width / 2, r.y + r.height / 2); await p.waitForTimeout(250); };
  // (a top bar button: in the bar, or on a phone in its ••• menu)
  const MORE = { gallery: 'Gallery', new: 'New Picture', image: 'Crop', history: 'History' };
  const top = async (k) => {
    if (k === 'save') { await p.evaluate(() => document.querySelector('[data-act="save"]').click()); await p.waitForTimeout(300); return; }
    const seen = await p.evaluate(k => { const b = document.querySelector('[data-hb="' + k + '"]'); return !!(b && b.offsetParent); }, k);
    if (!seen && MORE[k]) {
      await tapEl('[data-hb="more"]');
      const items = await p.$$('.paint-moremenu button'); for (const it of items) if ((await it.textContent()).includes(MORE[k])) { const r = await it.boundingBox(); await tapAt(r.x + r.width / 2, r.y + r.height / 2); break; }
      await p.waitForTimeout(350); return;
    }
    await p.evaluate(k => document.querySelector('[data-hb="' + k + '"]').click(), k); await p.waitForTimeout(300);
  };
  const panel = () => p.evaluate(() => {
    const d = document.querySelector('.paint-docpanel'), r = d.getBoundingClientRect(), st = document.querySelector('.paint-stage').getBoundingClientRect();
    return { shown: !d.hidden, title: d.querySelector('.dp-title').textContent, back: !d.querySelector('.dp-back').hidden, inDock: !!d.closest('.paint-dock'), beside: !!d.closest('.paint-left'),
      x: r.x, w: Math.round(r.width), ctxW: parseFloat(getComputedStyle(document.querySelector('.paint')).getPropertyValue('--ctx-w')),
      aside: document.querySelector('.paint-ctx').classList.contains('aside'), stageW: Math.round(st.width), stageH: Math.round(st.height),
      floating: [...document.querySelectorAll('.paint-drop:not([hidden]), .paint-savemenu:not([hidden])')].filter(e => !e.closest('.paint-docpanel')).length,
      wraps: document.querySelectorAll('.pa-sheet-wrap').length,
      expanded: [...document.querySelectorAll('.site-header [aria-expanded="true"]')].map(b => b.dataset.hb || b.dataset.act) };
  });
  const tool = () => p.evaluate(() => { const b = document.querySelector('.paint-left button[data-tool][aria-pressed="true"]'); return b ? b.dataset.tool : null; });
  const sizeV = () => p.$eval('.paint-bottom input[type="range"]', i => i.value);
  // (the top bar starts folded: opened, as a person would, to reach its buttons)
  if (await p.$eval('.hdr-fold', b => b.getAttribute('aria-expanded') !== 'true')) { await tapEl('.hdr-fold'); await p.waitForTimeout(600); }
  const tool0 = await tool(), size0 = await sizeV();
  const base = await panel();
  L.ok(!base.shown, 'the panel is closed to begin with');

  // ---- EACH OPTION, IN THE PANEL ----
  const OPTS = [['gallery', 'Gallery'], ['new', 'New Picture'], ['save', 'Save'], ['image', 'Crop & Rotate'], ['history', 'History'], ['settings', 'Settings']]; // (Keyboard Shortcuts: from Settings, or ?)
  let stage1 = null;
  for (const [k, title] of OPTS) {
    await top(k);
    const s = await panel();
    L.ok(s.shown && s.title === title && !s.back, k + ': opens in the panel, titled ' + JSON.stringify(s.title));
    L.ok(phone ? s.beside : s.inDock && s.w === s.ctxW, k + ': ' + (phone ? 'beside the left bar' : 'in the dock, as wide as the tool settings (' + s.w + ')'));
    L.ok(!s.floating && !s.wraps, k + ': no drop-down or sheet over the page');
    if (!phone) L.ok(s.aside, k + ': the tool settings step aside');
    L.ok(s.expanded.includes(k === 'save' ? 'save' : k), k + ': its button says it is open ' + JSON.stringify(s.expanded));
    if (!phone) { if (stage1) L.ok(s.stageW === stage1.w && s.stageH === stage1.h, k + ': the picture’s space keeps its size from one option to the next'); else stage1 = { w: s.stageW, h: s.stageH }; }
  }
  // the same button closes it
  await top('settings');
  let s = await panel();
  L.ok(!s.shown && !s.aside, 'the same button again closes it, the tool settings back');
  if (!phone) L.ok(s.stageW === base.stageW && s.stageH === base.stageH, 'and the picture’s space is as it was');
  L.ok((await tool()) === tool0 && (await sizeV()) === size0, 'the tool in hand and its size are as they were (' + tool0 + ')');
  // the close button, and Esc
  await top('settings'); await tapEl('.dp-close');
  L.ok(!(await panel()).shown, 'the close button closes it');
  await top('history'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  L.ok(!(await panel()).shown, 'Esc closes it');

  // ---- SETTINGS: it stays, and what opens from it has Back ----
  await top('settings');
  const dark0 = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await tapEl('[data-setting="theme"]'); await p.waitForTimeout(600);
  s = await panel();
  L.ok(s.shown && s.title === 'Settings' && (await p.evaluate(() => document.documentElement.getAttribute('data-theme'))) !== dark0, 'Settings: the theme switches and the panel stays');
  L.ok(await p.$eval('[data-setting="theme"]', b => /(Light|Dark) Mode/.test(b.textContent)), 'its row says what it switches to now');
  await tapEl('[data-setting="theme"]'); await p.waitForTimeout(600); // (back as it was)
  await tapEl('[data-setting="gestures"]');
  s = await panel();
  L.ok(s.shown && s.title === 'Touch Gestures' && s.back && !s.wraps, 'Touch Gestures opens in its place, with Back');
  await tapEl('.dp-back');
  s = await panel();
  L.ok(s.shown && s.title === 'Settings', 'Back goes back to Settings');
  await tapEl('[data-setting="help"]');
  s = await panel();
  L.ok(s.title === 'Keyboard Shortcuts' && s.back, 'Keyboard shortcuts from Settings, with Back');
  await tapEl('[data-close]');
  L.ok((await panel()).title === 'Settings', 'its Done goes back to Settings too');
  await top('settings');

  // ---- THEY STILL DO WHAT THEY DID ----
  // a stroke, then History back to the start
  const wr = await p.$eval('.paint-world', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const sum = () => p.evaluate(() => { let h = 0; for (const c of document.querySelectorAll('.paint-layers canvas')) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) % 1e9; } return h; });
  const s0 = await sum();
  await p.mouse.move(wr.x + wr.w * .3, wr.y + wr.h * .4); await p.mouse.down(); await p.mouse.move(wr.x + wr.w * .6, wr.y + wr.h * .6, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
  L.ok((await sum()) !== s0, 'a stroke');
  await top('history');
  L.ok(await p.$$eval('.paint-docpanel [data-hist]', l => l.length) === 2, 'History lists the start and the stroke');
  await tapEl('.paint-docpanel [data-hist="0"]'); await p.waitForTimeout(300);
  L.ok((await sum()) === s0 && (await panel()).shown, 'a tap on the start goes back to it, and the list stays');
  await tapEl('.paint-docpanel [data-hist="1"]'); await p.waitForTimeout(300);
  L.ok((await sum()) !== s0, 'and forward again');
  // Crop, Rotate & Flip: a quarter turn
  const dims = () => p.$eval('.paint-over', c => [c.width, c.height]);
  const d0 = await dims();
  await top('image'); await tapEl('[data-img="right"]'); await p.waitForTimeout(400);
  const d1 = await dims();
  L.ok(d1[0] === d0[1] && d1[1] === d0[0] && (await panel()).shown, 'Rotate Right turns the picture, and the panel stays open for the next ' + d0.join('x') + ' → ' + d1.join('x'));
  await top('image');
  await p.keyboard.press((process.platform === 'darwin' ? 'Meta' : 'Control') + '+z'); await p.waitForTimeout(300);
  // Save: PNG downloads
  await top('save');
  const dl = p.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await tapEl('[data-save="png"]');
  const f = await dl;
  L.ok(!!f && /\.png$/.test(f.suggestedFilename()) && !(await panel()).shown, 'Save → PNG downloads a PNG, and the panel closes ' + (f && f.suggestedFilename()));
  // Share: the system's own
  if (await p.$eval('[data-hb="share"]', b => !!b.offsetParent)) await tapEl('[data-hb="share"]');
  else { await tapEl('[data-hb="more"]'); for (const x of await p.$$('.paint-moremenu button')) if ((await x.textContent()).includes('Share')) { const r = await x.boundingBox(); await tapAt(r.x + r.width / 2, r.y + r.height / 2); break; } }
  await p.waitForTimeout(1200);
  L.ok((await p.evaluate(() => window.__shared)) === 1 && !(await panel()).shown, 'Share still asks the system, and opens nothing in the panel');
  // New Picture: a size, Create
  await top('new');
  await p.fill('[data-ns="w"]', '640'); await p.fill('[data-ns="h"]', '480');
  await tapEl('[data-ns-act="create"]'); await p.waitForTimeout(800);
  L.ok((await dims()).join('x') === '640x480' && !(await panel()).shown, 'New Picture makes a 640 x 480 picture, and the panel closes');
  // Gallery: the drawing before is in it, Done closes
  await top('gallery'); await p.waitForTimeout(500);
  L.ok(await p.$$eval('.paint-docpanel .gal-card', l => l.length) >= 1, 'the Gallery has the drawing from before (a blank one isn’t kept)');
  await tapEl('.paint-docpanel .pa-sheet-acts .pa-primary');
  L.ok(!(await panel()).shown, 'its Done closes it');
  // a tool with settings takes its place, as it does the picker's
  await top('history');
  await tapEl('.paint-left [data-tool="eraser"]');
  s = await panel();
  L.ok(!s.shown, 'picking a tool with settings brings them back in its place');
  await tapEl('.paint-left [data-tool="brush"]');
  // the colour picker gives way to it, and Effects take its place (on
  // something to adjust: a blank picture has nothing)
  const wr2 = await p.$eval('.paint-world', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await p.mouse.move(wr2.x + wr2.w * .3, wr2.y + wr2.h * .4); await p.mouse.down(); await p.mouse.move(wr2.x + wr2.w * .6, wr2.y + wr2.h * .6, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
  if (!phone) {
    await tapEl('.paint-current'); await p.waitForTimeout(300);
    L.ok(await p.$eval('.paint-colorpanel', e => !e.hidden), 'the colour picker open');
    await top('settings');
    L.ok((await panel()).shown && await p.$eval('.paint-colorpanel', e => e.hidden), 'Settings takes the picker’s place');
    await tapEl('[data-act="adjust"]'); await p.waitForTimeout(300);
    L.ok(!(await panel()).shown && await p.$eval('.paint-adjust[aria-label="Effects"]', e => !e.hidden), 'Effects take the panel’s place');
    await tapEl('[data-act="adjust"]'); await p.waitForTimeout(300);
  }
  // keys
  await p.keyboard.press('Shift+?'); await p.waitForTimeout(300);
  L.ok((await panel()).title === 'Keyboard Shortcuts', '? opens the shortcuts in the panel');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  L.ok(!(await panel()).shown, 'Esc closes them');
  L.ok(!errs.length, 'no errors ' + JSON.stringify(errs));
  await p.screenshot({ path: 'panel-' + theme + '-' + VW + (touch ? '-touch' : '') + '.png' });
  await b.close();
  L.done();
})().catch(e => { console.log('FAIL', e.stack); process.exit(1); });
