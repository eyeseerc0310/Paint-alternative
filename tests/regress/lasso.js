const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(600);
  await p.addStyleTag({ content: '.paint-ctx { visibility: hidden !important; }' }); // (these strokes start where the tool bar stands)
  const at = async (fx, fy) => p.evaluate(([fx, fy]) => { const w = document.querySelector('.paint-world').getBoundingClientRect(); return [w.left + w.width * fx, w.top + w.height * fy]; }, [fx, fy]);
  const selbar = () => p.$eval('.paint-selbar', e => !e.hidden);
  await p.keyboard.press('q');
  // 1. freehand still works: drag round, let go -> selection
  await p.mouse.move(...await at(0.1, 0.1)); await p.mouse.down();
  for (const q of [[0.3, 0.1], [0.3, 0.3], [0.1, 0.3], [0.1, 0.12]]) await p.mouse.move(...await at(...q), { steps: 6 });
  await p.mouse.up();
  console.log('freehand -> selection shown:', await selbar());
  await p.keyboard.press('Escape');
  // 2. point to point: click, click, click, hover near start, click start
  await p.mouse.click(...await at(0.5, 0.2));
  console.log('after first click: selbar', await selbar(), '| toast:', await p.$eval('.paint-toast', t => t.classList.contains('on') && t.textContent));
  await p.mouse.click(...await at(0.8, 0.25));
  // a freehand piece between clicks
  await p.mouse.move(...await at(0.8, 0.6)); await p.mouse.down(); for (let i = 1; i <= 10; i++) await p.mouse.move(...await at(0.8 - i * 0.015, 0.6 + Math.sin(i / 2) * 0.04)); await p.mouse.up();
  await p.mouse.click(...await at(0.55, 0.7));
  const s0 = await at(0.5, 0.2); await p.mouse.move(s0[0] + 4, s0[1] + 3);
  await p.waitForTimeout(100);
  console.log('hovering start shows closing:', await p.$eval('.paint-stage', s => s.classList.contains('closing')));
  await p.screenshot({ path: 'out/lasso-building.png' });
  await p.mouse.click(s0[0] + 4, s0[1] + 3);
  await p.waitForTimeout(150);
  console.log('closed by clicking start -> selection:', await selbar());
  await p.screenshot({ path: 'out/lasso-done.png' });
  // the selection works: delete what's inside on a filled picture
  await p.keyboard.press('Escape');
  // 3. double-click closes; Backspace removes a point; Esc cancels
  await p.mouse.click(...await at(0.1, 0.5)); await p.mouse.click(...await at(0.3, 0.5)); await p.mouse.click(...await at(0.3, 0.8));
  await p.keyboard.press('Backspace');
  await p.mouse.dblclick(...await at(0.15, 0.85)); await p.waitForTimeout(150);
  console.log('double-click closes:', await selbar());
  await p.keyboard.press('Escape');
  await p.mouse.click(...await at(0.6, 0.8)); await p.mouse.click(...await at(0.7, 0.8));
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  console.log('Esc cancels (no selection):', !(await selbar()));
  await p.mouse.click(...await at(0.6, 0.8)); await p.mouse.click(...await at(0.7, 0.8)); await p.mouse.click(...await at(0.7, 0.9));
  await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  console.log('Return closes:', await selbar());
  // 4. switching tool mid-way lets it go cleanly
  await p.keyboard.press('Escape');
  await p.mouse.click(...await at(0.6, 0.5)); await p.mouse.click(...await at(0.7, 0.5));
  await p.keyboard.press('b');
  await p.mouse.move(...await at(0.2, 0.2)); await p.mouse.down(); await p.mouse.move(...await at(0.4, 0.4), { steps: 5 }); await p.mouse.up();
  console.log('brush after abandoning cutout ok, selbar:', await selbar());
  console.log('errors', errs);
  await b.close();
})();
