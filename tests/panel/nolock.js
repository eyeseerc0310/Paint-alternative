// No menu has a lock (unlock) button: the tool settings, the colour picker
// and Effects stand in their place (the dock on wider screens, the strip on
// a phone) and can't be dragged off it, and a place the settings were once
// unlocked and dragged to (kept from before) is forgotten. Run as:
// node nolock.js light|dark width height [touch]
const L = require('../lib');
const { chromium } = L.use({});
const [theme, VW, VH] = [process.argv[2] || 'light', +(process.argv[3] || 1400), +(process.argv[4] || 900)];
const touch = process.argv.includes('touch'), phone = VW <= 560;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, hasTouch: touch, colorScheme: theme });
  // (as left by an older version: unlocked, and dragged off)
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('paint-ctx-lock', 'false'); localStorage.setItem('paint-pos-ctx2', '[-120,80]'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(900);
  await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
  const st = () => p.evaluate(() => {
    const c = document.querySelector('.paint-ctx');
    return { locks: document.querySelectorAll('.ctx-lock').length, locked: c.classList.contains('locked'), tr: c.style.translate, inDock: !!c.closest('.paint-dock'),
      dockOn: document.querySelector('.paint').classList.contains('dock-on'), lockKey: localStorage.getItem('paint-ctx-lock'), pos: localStorage.getItem('paint-pos-ctx2') };
  });
  let s = await st();
  L.ok(s.locks === 0, 'no lock button anywhere (' + s.locks + ')');
  L.ok(s.locked && !s.tr, 'the tool settings are in their place, though left unlocked and moved before (' + JSON.stringify(s.tr) + ')');
  L.ok(s.lockKey === null && s.pos === null, 'the old unlocked state and place are forgotten');
  if (!phone) L.ok(s.inDock && s.dockOn, 'they stand in the dock, which makes room for them');
  // the grip doesn't move them
  const g = await (await p.$('.paint-ctx .ctx-grip')).boundingBox();
  if (g && g.width) {
    await p.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await p.mouse.down(); await p.mouse.move(g.x - 80, g.y + 120, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
    s = await st(); L.ok(!s.tr && s.pos === null, 'dragging the grip leaves them where they are');
  }
  // the colour picker and Effects: no lock in their tops either, and they don't move
  await p.$eval('.paint-current', e => e.click()); await p.waitForTimeout(400);
  const pc = await p.evaluate(() => { const el = document.querySelector('.paint-colorpanel'); return { shown: !el.hidden, locks: el.querySelectorAll('.ctx-lock').length, locked: el.classList.contains('locked'), tr: el.style.translate }; });
  L.ok(pc.shown && pc.locks === 0 && pc.locked && (phone || !pc.tr), 'the colour picker: no lock, in its place (on a phone, over the colours: placePicker) (' + JSON.stringify(pc) + ')');
  if (!phone) {
    const pg = await (await p.$('.paint-colorpanel .pc-top .ctx-grip')).boundingBox();
    await p.mouse.move(pg.x + pg.width / 2, pg.y + pg.height / 2); await p.mouse.down(); await p.mouse.move(pg.x - 90, pg.y + 100, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
    L.ok(!(await p.$eval('.paint-colorpanel', e => e.style.translate)), 'its grip doesn\'t move it');
    // its fold button still closes it and folds the settings
    await p.$eval('.paint-colorpanel .pc-top .ctx-min', e => e.click()); await p.waitForTimeout(500);
    L.ok(await p.$eval('.paint-colorpanel', e => e.hidden) && await p.$eval('.paint-ctx', e => e.classList.contains('min')), 'its fold button closes it and folds the settings');
    await p.$eval('.paint-ctx .ctx-min', e => e.click()); await p.waitForTimeout(500);
  } else { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await p.$eval('[data-act="adjust"]', e => e.click()); await p.waitForTimeout(500);
  const fx = await p.evaluate(() => { const el = document.querySelector('.paint-adjust:not(.paint-studio)'); return { shown: !el.hidden, locks: el.querySelectorAll('.ctx-lock').length, locked: el.classList.contains('locked'), tr: el.style.translate }; });
  L.ok(fx.shown && fx.locks === 0 && fx.locked && !fx.tr, 'Effects: no lock, in its place (' + JSON.stringify(fx) + ')');
  await p.screenshot({ path: `nolock-${theme}-${VW}.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // a reload: still in place, nothing remembered
  await p.reload(); await p.waitForTimeout(900);
  s = await st(); L.ok(s.locks === 0 && s.locked && !s.tr && s.pos === null, 'after a reload, still in place');
  L.ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
  L.done();
})();
