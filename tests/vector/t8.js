const L = require('../lib'), { chromium } = L.use({ showSwitch: true });
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(1200);
  const ser = async () => JSON.parse(await p.evaluate(() => JSON.stringify(window.PaintVector.serialize())));
  // keyboard: Tab to the switch, arrow to Vector
  await p.focus('[data-mode="paint"]'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.documentElement.classList.contains('vector-mode')), 'arrow key on the switch: Vector');
  ok(await p.evaluate(() => document.activeElement.dataset.mode) === 'vector', 'focus follows to Vector');
  const k0 = (await ser()).view.k;
  await p.keyboard.press('Backslash'); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => document.documentElement.classList.contains('focus-mode')), '\\ : focus mode in Vector');
  const s = await ser();
  ok(s.view.k > k0, 'fitted artboard grows with the space (' + k0.toFixed(3) + ' -> ' + s.view.k.toFixed(3) + ')');
  ok(await p.$eval('.mode-switch', e => getComputedStyle(e).visibility) === 'hidden', 'switch out of sight in focus mode');
  await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
  ok(!(await p.evaluate(() => document.documentElement.classList.contains('focus-mode'))), 'Esc leaves focus mode');
  ok(Math.abs((await ser()).view.k - k0) < 1e-6, 'and back to the same fit');
  // settings toggle folds/unfolds Vector's panel
  await p.click('.paint-settings-toggle'); await p.waitForTimeout(200); await p.click('.vec-quick [data-vq="panel"]'); await p.waitForTimeout(600);
  ok(await p.$eval('.paint-ctx', e => e.classList.contains('min')), 'quick options: Hide Tool Settings folds the panel');
  await p.click('[data-vcat="selection"]'); await p.waitForTimeout(600);
  ok(!(await p.$eval('.paint-ctx', e => e.classList.contains('min'))), 'a category opens it again');
  // the layers button: aria-expanded only
  await p.click('[data-act="layers"]'); await p.waitForTimeout(300);
  ok(await p.$eval('[data-act="layers"]', e => e.getAttribute('aria-expanded') === 'true'), 'Layers button expanded');
  await p.mouse.click(700, 500); await p.waitForTimeout(200);
  ok(await p.$eval('.vec-layerpanel', e => e.hidden), 'a press elsewhere closes Vector Layers');
  // help sheet
  await p.keyboard.press('Shift+Slash'); await p.waitForTimeout(400);
  ok(await p.$$eval('.hs-h', l => l.some(h => h.textContent === 'Vector tools')), '? shows the shortcuts, with Vector mode');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // history/image disabled; zoom +/-
  ok(await p.$eval('[data-hb="history"]', e => e.disabled) && await p.$eval('[data-hb="image"]', e => e.disabled), 'History and Crop greyed out in Vector');
  await p.click('[data-zoom="in"]'); await p.waitForTimeout(150);
  ok(await p.$eval('.paint-zoom-val', e => e.textContent) === '125%', 'zoom + is Vector’s (' + await p.$eval('.paint-zoom-val', e => e.textContent) + ')');
  await p.keyboard.press('0'); await p.waitForTimeout(150);
  // back to paint: everything paint again
  await p.click('[data-mode="paint"]'); await p.waitForTimeout(400);
  ok(await p.$eval('.paint-zoom-val', e => e.textContent) === '100%' && !(await p.$eval('[data-hb="history"]', e => e.disabled)), 'Paint: its zoom and History back');
  ok(await p.$eval('.paint-ctx [data-ctxname]', e => !!e).catch(() => false), 'Paint’s brush settings back in the panel');
  console.log('errors', errs); console.log(fails ? fails + ' FAILED' : 'ALL OK');
  await b.close();
})();
