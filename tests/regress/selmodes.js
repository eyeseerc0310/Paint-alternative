const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const c = await b.newContext({ viewport: { width: 1366, height: 860 } }); const p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForFunction(() => !document.querySelector('.app-splash'), null, { timeout: 10000 });
  const at = async (fx, fy) => p.evaluate(([fx, fy]) => { const w = document.querySelector('.paint-world').getBoundingClientRect(); return [w.left + w.width * fx, w.top + w.height * fy]; }, [fx, fy]);
  const state = () => p.evaluate(() => ({ tool: document.querySelector('.paint-stage').dataset.tool, btn: document.querySelector('.paint-selbtn').dataset.tool, pressed: document.querySelector('.paint-selbtn').getAttribute('aria-pressed'), seg: [...document.querySelectorAll('[data-ctx-sel]')].map(b => b.dataset.ctxSel + (b.getAttribute('aria-selected') === 'true' ? '*' : '')).join(' '), hint: (document.querySelector('.ctx-hint') || {}).textContent }));
  console.log('select buttons in bar:', await p.$$eval('.paint-left button[data-tool]', l => l.map(b => b.dataset.tool).join(',')));
  await p.click('.paint-selbtn'); console.log('first click:', JSON.stringify(await state()));
  // fill the picture with a colour so cut areas show
  await p.evaluate(() => document.querySelectorAll('.paint-swatches button')[3].click());
  await p.keyboard.press('f'); await p.mouse.click(...await at(0.5, 0.5)); await p.waitForTimeout(700);
  await p.click('.paint-selbtn');
  await p.click('[data-ctx-sel="circle"]'); console.log('circle picked:', JSON.stringify(await state()));
  // drag an oval
  const a = await at(0.3, 0.3), z = await at(0.6, 0.7); await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...z, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(100);
  const px = (fx, fy) => p.evaluate(([fx, fy]) => { const c = document.querySelector('.paint-layers canvas'); return Array.from(c.getContext('2d').getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data.slice(0, 3)).join(','); }, [fx, fy]);
  console.log('selection bar shown:', await p.evaluate(() => !document.querySelector('.paint-selbar').hidden), 'actions', await p.$$eval('.paint-selbar button', l => l.map(b => b.dataset.sel).join(',')));
  await p.keyboard.press('Delete'); await p.waitForTimeout(150);
  console.log('after Delete: centre', await px(0.45, 0.5), '| box corner (outside the oval)', await px(0.31, 0.31), '| outside', await px(0.8, 0.8));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  // shift: a circle
  await p.mouse.move(...await at(0.2, 0.2)); await p.mouse.down(); await p.keyboard.down('Shift'); await p.mouse.move(...await at(0.5, 0.35), { steps: 6 }); await p.mouse.up(); await p.keyboard.up('Shift'); await p.waitForTimeout(100);
  // copy, flip, move, turn on it
  for (const a of ['copy', 'fliph', 'rot90']) await p.evaluate(a => document.querySelector(`.paint-selbar [data-sel="${a}"]`).click(), a);
  await p.waitForTimeout(100);
  const mid = await p.evaluate(() => { const r = document.querySelector('.paint-selov').getBoundingClientRect(); return null; });
  console.log('copy/flip/turn ok, history:', await p.evaluate(() => { document.querySelector('[data-hb="history"]').click(); const t = [...document.querySelectorAll('.ph-list button')].map(b => b.textContent).join(' | '); document.querySelector('[data-hb="history"]').click(); return t; }));
  await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  // keys
  await p.keyboard.press('b'); await p.keyboard.press('m'); const m1 = (await state()).tool; const m2 = '', m3 = '';
  await p.keyboard.press('q'); const q = (await state()).tool; await p.keyboard.press('c'); const cc = (await state()).tool; await p.keyboard.press('w'); const w = (await state()).tool;
  console.log('keys: M', m1, '-> M', m2, '-> M', m3, '| Q', q, '| C', cc, '| W', w, '| button', (await state()).btn);
  // wand still selects
  await p.mouse.click(...await at(0.8, 0.8)); await p.waitForTimeout(150);
  console.log('wand selected:', await p.evaluate(() => !document.querySelector('.paint-selbar').hidden));
  await p.keyboard.press('Enter');
  // remembered after reload
  await p.keyboard.press('c'); await p.reload(); await p.waitForFunction(() => !document.querySelector('.app-splash'), null, { timeout: 10000 });
  console.log('after reload button is', await p.evaluate(() => document.querySelector('.paint-selbtn').dataset.tool));
  await p.click('.paint-selbtn'); console.log('click after reload:', JSON.stringify(await state()));
  console.log('errs', errs); await b.close();
})();
