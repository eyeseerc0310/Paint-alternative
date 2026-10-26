const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
const { PNG } = (() => { try { return require('pngjs'); } catch (e) { return {}; } })();
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(700);
  await p.addStyleTag({ content: '.paint-ctx { visibility: hidden !important; }' }); // (these strokes start where the tool bar stands)
  const at = async (fx, fy) => p.evaluate(([fx, fy]) => { const w = document.querySelector('.paint-world').getBoundingClientRect(); return [w.left + w.width * fx, w.top + w.height * fy]; }, [fx, fy]);
  // screen colour at a point (what you actually see)
  const seen = async (x, y) => { const buf = await p.screenshot({ clip: { x: x - 1, y: y - 1, width: 2, height: 2 } }); return buf; };
  await p.$eval('.paint-size', e => { e.value = Math.round(1000 * Math.pow(((40) - 1) / 499, 1 / 2.4)); e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.$eval('.paint-alpha', e => { e.value = 35; e.dispatchEvent(new Event('input', { bubbles: true })); });
  for (const br of ['round', 'marker', 'highlighter', 'feather']) {
    await p.click('[data-tool="brush"]');
    await p.$eval('[data-ctx="brushes"]', e => e.click()); await p.$eval(`.ctx-list [data-pick="brush"][data-val="${br}"]`, e => e.click());
    await p.click('.paint-swatches button:nth-child(8)');
    const y = { round: 0.2, marker: 0.4, highlighter: 0.6, feather: 0.8 }[br];
    await p.mouse.move(...await at(0.1, y)); await p.mouse.down(); await p.mouse.move(...await at(0.6, y), { steps: 15 });
    const pt = await at(0.35, y);
    const during = await p.screenshot({ clip: { x: pt[0], y: pt[1], width: 1, height: 1 } });
    const ovs = await p.$eval('.paint-over', c => [c.style.opacity, c.style.mixBlendMode]);
    await p.mouse.up(); await p.waitForTimeout(150);
    const after = await p.screenshot({ clip: { x: pt[0], y: pt[1], width: 1, height: 1 } });
    // decode the single pixel with a tiny canvas in the page
    const dec = async (buf) => p.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 1, 1); return Array.from(x.getImageData(0, 0, 1, 1).data).slice(0, 3).join(','); }, buf.toString('base64'));
    // (the feather brush is textured, different each time: its colours vary, but lifting mustn't change them)
    const d0 = await dec(during), d1 = await dec(after);
    console.log((br === 'feather' ? '~ ' : '') + br.padEnd(12), 'while drawing:', d0, ' after lifting:', d1, ' sheet:', JSON.stringify(ovs));
    console.log(br.padEnd(12), 'looks the same after lifting:', d0.split(',').every((v, i) => Math.abs(v - d1.split(',')[i]) <= 3));
  }
  // the size/opacity preview stays while the slider is held
  const s = await (await p.$('.paint-alpha')).boundingBox();
  await p.mouse.move(s.x + s.width * 0.3, s.y + s.height / 2); await p.mouse.down(); await p.mouse.move(s.x + s.width * 0.6, s.y + s.height / 2, { steps: 4 });
  await p.waitForTimeout(1500);
  console.log('preview still shown while held (1.5s):', await p.$eval('.paint-preview', e => e.classList.contains('on')), 'dot opacity', await p.$eval('.paint-preview canvas', e => e.style.opacity));
  await p.screenshot({ path: 'out/op-preview.png' });
  await p.mouse.up(); await p.waitForTimeout(1200);
  console.log('preview hidden after release:', !(await p.$eval('.paint-preview', e => e.classList.contains('on'))));
  // right panel close-up and the tool column
  await p.click('[data-tool="brush"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: 'out/ui-left.png', clip: { x: 20, y: 70, width: 360, height: 420 } });
  await p.keyboard.press('Escape');
  await p.screenshot({ path: 'out/ui-right.png', clip: { x: 1270, y: 70, width: 115, height: 520 } });
  console.log('errors', errs);
  await b.close();
})();
