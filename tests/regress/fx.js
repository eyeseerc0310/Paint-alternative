const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
(async () => {
  const b = await chromium.launch(); const mode = process.argv[2] || 'dark';
  const c = await b.newContext({ viewport: mode === 'phone' ? { width: 390, height: 844 } : { width: 1400, height: 900 }, colorScheme: mode === 'light' ? 'light' : 'dark', hasTouch: mode === 'phone' }); const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(800);
  const at = async (fx, fy) => p.evaluate(([fx, fy]) => { const w = document.querySelector('.paint-world').getBoundingClientRect(); return [w.left + w.width * fx, w.top + w.height * fy]; }, [fx, fy]);
  const px = (fx, fy) => p.evaluate(([fx, fy]) => { const c = document.querySelector('.paint-layers canvas'); return Array.from(c.getContext('2d').getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data).slice(0, 3).join(','); }, [fx, fy]);
  // paint a grey-ish band to work on: fill with a mid colour
  await p.evaluate(() => { const c = document.querySelector('.paint-layers canvas'), x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, c.width, 0); g.addColorStop(0, '#000'); g.addColorStop(1, '#fff'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height / 2); x.fillStyle = '#c04040'; x.fillRect(0, c.height / 2, c.width, c.height / 2); x.restore(); });
  await p.click('[data-act="adjust"]'); await p.waitForTimeout(250);
  const secs = await p.$$eval('.fx-sec', l => l.map(s => s.querySelector('.pr-head span').textContent + (s.classList.contains('closed') ? '' : ' (open)')));
  console.log('sections:', secs.join(' | '));
  await p.screenshot({ path: `out/fx-${mode}-open.png` });
  // hue: turn the red
  const before = await px(0.5, 0.75);
  await p.click('.fx-sec[data-fx="hsl"] .pr-head'); await p.waitForTimeout(250);
  await p.$eval('[data-adj="hue"]', e => { e.value = 66; e.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(150);
  console.log('red before', before, 'after hue +66', await px(0.5, 0.75), '| hsl marked changed', await p.$eval('.fx-sec[data-fx="hsl"]', e => e.classList.contains('changed')));
  // gradient map
  await p.click('.fx-sec[data-fx="gmap"] .pr-head'); await p.waitForTimeout(250);
  // (the presets and their colours changed with the gradient map's editor: what they look like is the editor's own check, tests/effects/gmap.js)
  await p.click('[data-gm="sunset"], [data-gm="golden"]'); await p.waitForTimeout(150);
  console.log('~ gradient map: dark end', await px(0.02, 0.2), 'light end', await px(0.98, 0.2));
  await p.screenshot({ path: `out/fx-${mode}-gmap.png` });
  await p.click('[data-gmrev], [data-gm-act="rev"]'); await p.waitForTimeout(100); console.log('~ reversed: dark end', await px(0.02, 0.2));
  await p.$eval('[data-adj="gms"]', e => { e.value = 0; e.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(100); console.log('~ strength 0: dark end', await px(0.02, 0.2));
  await p.click('[data-fx-reset="gmap"]'); await p.waitForTimeout(100); console.log('gmap reset: changed?', await p.$eval('.fx-sec[data-fx="gmap"]', e => e.classList.contains('changed')), 'strength slider', await p.$eval('[data-adj="gms"]', e => e.value));
  // levels and curves still work
  await p.click('.fx-sec[data-fx="curves"] .pr-head'); await p.waitForTimeout(300);
  const g = await (await p.$('.cv-graph')).boundingBox(); console.log('curve graph size', Math.round(g.width), Math.round(g.height));
  await p.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await p.mouse.down(); await p.mouse.move(g.x + g.width / 2, g.y + g.height * 0.25, { steps: 4 }); await p.mouse.up();
  console.log('curves changed:', await p.$eval('.fx-sec[data-fx="curves"]', e => e.classList.contains('changed')), 'mid grey now', await px(0.5, 0.2));
  await p.screenshot({ path: `out/fx-${mode}-curves.png` });
  await p.click('[data-adj-act="done"]'); await p.waitForTimeout(200);
  console.log('history label:', await p.evaluate(() => [...document.querySelectorAll('.ph-list button')].map(b => b.textContent).pop?.() || ''));
  await p.click('[data-act="undo"]'); console.log('after undo red back:', await px(0.5, 0.75));
  // the loupe
  await p.click('[data-tool="picker"]'); const q = await at(0.3, 0.75); await p.mouse.move(...q); await p.mouse.down(); await p.mouse.move(q[0] + 30, q[1] - 200, { steps: 5 }); await p.waitForTimeout(100);
  console.log('loupe shown', await p.$eval('.paint-loupe', e => !e.hidden));
  await p.screenshot({ path: `out/fx-${mode}-loupe.png` });
  await p.mouse.up(); console.log('picked colour', await p.$eval('.paint-current span', e => e.style.background), 'tool now', await p.$eval('[data-tool][aria-pressed="true"]', e => e.dataset.tool), 'loupe hidden', await p.$eval('.paint-loupe', e => e.hidden));
  console.log('errors', errs); await b.close();
})();
