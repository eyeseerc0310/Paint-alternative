const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
(async () => {
  const b = await chromium.launch();
  const dark = process.argv[2] === 'dark';
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 }, colorScheme: dark ? 'dark' : 'light' })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(700);
  const at = async (fx, fy) => p.evaluate(([fx, fy]) => { const w = document.querySelector('.paint-world').getBoundingClientRect(); return [w.left + w.width * fx, w.top + w.height * fy]; }, [fx, fy]);
  const ink = (fx, fy) => p.evaluate(([fx, fy]) => { const c = document.querySelector('.paint-layers canvas'); const d = c.getContext('2d').getImageData(Math.floor(c.width * fx) - 3, Math.floor(c.height * fy) - 3, 7, 7).data; let m = 255; for (let i = 0; i < d.length; i += 4) m = Math.min(m, d[i]); return m < 128; }, [fx, fy]);
  const stroke = async (x0, y0, x1, y1) => { await p.mouse.move(...await at(x0, y0)); await p.mouse.down(); await p.mouse.move(...await at(x1, y1), { steps: 8 }); await p.mouse.up(); };
  const open = async () => { if (!(await p.$('[data-ctx-sym]'))) await p.click('.paint-mirror'); };
  const pick = async (v) => { await open(); await p.click(`[data-ctx-sym="${v}"]`); };
  await p.$eval('.paint-size', e => { e.value = Math.round(1000 * Math.pow(((8) - 1) / 499, 1 / 2.4)); e.dispatchEvent(new Event('input', { bubbles: true })); });
  // vertical: a dot at (0.2,0.3) appears at (0.8,0.3)
  await pick('x'); await stroke(0.2, 0.3, 0.21, 0.3);
  console.log('vertical mirror copy:', await ink(0.8, 0.3), '| not below:', !(await ink(0.2, 0.7)));
  // move the guide's centre to x=0.4: a dot at 0.3 lands at 0.5
  const c0 = await p.$eval('.paint-symc', e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  const tgt = await at(0.4, 0.5);
  await p.mouse.move(...c0); await p.mouse.down(); await p.mouse.move(tgt[0], tgt[1], { steps: 6 }); await p.mouse.up();
  await stroke(0.3, 0.15, 0.301, 0.15);
  console.log('after moving the axis to 0.4: copy at 0.5:', await ink(0.5, 0.15), '| no stroke drawn by the drag:', !(await ink(0.45, 0.5)));
  await p.screenshot({ path: 'out/sym-moved.png' });
  // turn it: drag the turn handle 45 degrees
  const r0 = await p.$eval('.paint-symr', e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  const cc = await p.$eval('.paint-symc', e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await p.mouse.move(...r0); await p.mouse.down(); await p.mouse.move(cc[0] + 45, cc[1] - 45, { steps: 6 }); await p.mouse.up();
  await p.screenshot({ path: 'out/sym-turned.png' });
  // horizontal and quadrant, centred again via the menu
  await open(); await p.click('[data-ctx="symreset"]');
  await p.click('[data-hb="new"]'); await p.click('[data-pre="wide"]'); await p.click('[data-ns-act="create"]'); await p.waitForTimeout(600);
  await pick('y'); await stroke(0.3, 0.2, 0.31, 0.2);
  console.log('horizontal copy:', await ink(0.3, 0.8), '| no left-right copy:', !(await ink(0.7, 0.2)));
  await pick('xy'); await stroke(0.25, 0.25, 0.26, 0.25);
  console.log('quadrant copies:', await ink(0.75, 0.25), await ink(0.25, 0.75), await ink(0.75, 0.75));
  // radial: 8 segments with mirror
  await p.click('[data-hb="new"]'); await p.click('[data-pre="wide"]'); await p.click('[data-ns-act="create"]'); await p.waitForTimeout(200);
  await pick('radial');
  await p.click('[data-symd="1"]'); await p.click('[data-symd="1"]');
  console.log('segments shown:', await p.$eval('[data-ctx="symn"] output', e => e.textContent));
  await p.click('[data-ctx="symmirror"]'); console.log('mirror on:', await p.$eval('[data-ctx="symmirror"]', e => e.getAttribute('aria-pressed')));
  await p.screenshot({ path: 'out/sym-menu.png' });
  await p.keyboard.press('Escape');
  await stroke(0.5, 0.2, 0.56, 0.28);
  await p.mouse.move(...await at(0.45, 0.1)); await p.mouse.down(); await p.mouse.move(...await at(0.5, 0.3), { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'out/sym-radial.png' });
  console.log('errors', errs); await b.close();
})();
