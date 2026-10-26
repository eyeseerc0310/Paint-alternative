const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(700);
  const at = async (fx, fy) => p.evaluate(([fx, fy]) => { const w = document.querySelector('.paint-world').getBoundingClientRect(); return [w.left + w.width * fx, w.top + w.height * fy]; }, [fx, fy]);
  const ring = async (cx, cy) => { const pts = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; pts.push([cx + Math.cos(a) * 0.08, cy + Math.sin(a) * 0.12]); } await p.mouse.move(...await at(...pts[0])); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(...await at(...q), { steps: 2 }); await p.mouse.up(); };
  await p.$eval('.paint-size', e => { e.value = Math.round(1000 * Math.pow(((6) - 1) / 499, 1 / 2.4)); e.dispatchEvent(new Event('input', { bubbles: true })); });
  // on the white background: a black ring, filled red
  await ring(0.25, 0.4);
  // on a layer: a black ring, filled red
  await p.click('[data-act="layers"]'); await p.click('[data-layer-act="add"]'); await p.click('[data-act="layers"]');
  await ring(0.6, 0.4);
  await p.click('.paint-swatches button:nth-child(4)');
  await p.keyboard.press('f');
  await p.click('[data-act="layers"]'); await (await p.$$('.pl-row'))[1].click(); await p.click('[data-act="layers"]'); // background
  await p.mouse.click(...await at(0.25, 0.4));
  await p.click('[data-act="layers"]'); await (await p.$$('.pl-row'))[0].click(); await p.click('[data-act="layers"]');
  await p.mouse.click(...await at(0.6, 0.4));
  await p.waitForTimeout(300);
  for (const [cx, n] of [[0.25, 'bg'], [0.6, 'layer']]) {
    const q = await at(cx + 0.08, 0.4);
    await p.screenshot({ path: `out/fill-${n}.png`, clip: { x: q[0] - 14, y: q[1] - 10, width: 28, height: 20 } });
  }
  await p.screenshot({ path: 'out/fill-all.png' });
  console.log('errors', errs); await b.close();
})();
