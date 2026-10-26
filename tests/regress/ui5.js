const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
(async () => {
  const b = await chromium.launch(); const phone = process.argv[2] === 'phone';
  const c = await b.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1400, height: 900 }, colorScheme: 'dark', hasTouch: phone });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(800);
  const hist = () => p.evaluate(() => document.querySelector('[data-act="undo"]').disabled);
  const r = await (await p.$('[data-ctx="smoothing"]')).boundingBox();
  await p.mouse.move(r.x + 3, r.y + r.height / 2); await p.mouse.down(); await p.mouse.move(r.x + r.width * .6, r.y + r.height / 2, { steps: 6 }); await p.mouse.up();
  console.log('slider value', await p.$eval('[data-ctx="smoothing"]', e => e.value), 'out', await p.$eval('.ctx-slider output', e => e.textContent), 'undo still disabled (no paint):', await hist());
  // chips
  const tp = await p.$eval('[data-ctx="taper"]', e => e.getAttribute('aria-pressed')); await p.click('[data-ctx="taper"]');
  console.log('taper', tp, '->', await p.$eval('[data-ctx="taper"]', e => e.getAttribute('aria-pressed')));
  // drag the ctx grip (not on a phone, where the settings are a strip)
  if (!phone) {
    const g = await (await p.$('.ctx-grip')).boundingBox();
    await p.mouse.move(g.x + 4, g.y + 8); await p.mouse.down(); await p.mouse.move(g.x + 60, g.y + 200, { steps: 6 }); await p.mouse.up();
    console.log('ctx moved', await p.$eval('.paint-ctx', e => e.style.translate), 'undo disabled:', await hist());
    await p.dblclick('.ctx-grip'); console.log('reset', JSON.stringify(await p.$eval('.paint-ctx', e => e.style.translate)));
  }
  // focus mode
  if (phone) { await p.click('[data-hb="more"]'); await p.click('.paint-drop >> text=Focus Mode'); } else await p.click('[data-hb="focus"]');
  await p.waitForTimeout(300);
  console.log('focus', await p.evaluate(() => [document.documentElement.classList.contains('focus-mode'), getComputedStyle(document.querySelector('.site-header')).display, getComputedStyle(document.querySelector('.paint-focusout')).display]));
  await p.screenshot({ path: `out/ui5-${phone ? 'phone' : 'desk'}-focus.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  console.log('focus off', await p.evaluate(() => document.documentElement.classList.contains('focus-mode')));
  // draw a stroke: status saving->saved
  const w = await (await p.$('.paint-world')).boundingBox();
  await p.mouse.move(w.x + 60, w.y + 300); await p.mouse.down(); await p.mouse.move(w.x + 200, w.y + 380, { steps: 10 }); await p.mouse.up();
  console.log('undo enabled after paint:', !(await hist()), 'status', await p.$eval('.doc-status', e => e.dataset.state));
  await p.waitForTimeout(2500); console.log('status later', await p.$eval('.doc-status', e => e.dataset.state));
  // tooltips
  await p.hover('.paint-left [data-tool="eraser"]'); await p.waitForTimeout(900);
  console.log('tip', await p.evaluate(() => { const t = document.querySelector('.paint-tip'); return t && t.classList.contains('on') ? t.textContent : null; }));
  // section collapse
  if (!phone) {
    await p.click('[data-ctx="bstudio"]'); await p.waitForTimeout(400);
    await p.click('[data-bsec="pressure"] .pr-head'); await p.waitForTimeout(300); console.log('pressure folded', await p.$eval('[data-bsec="pressure"]', e => e.className));
    await p.click('[data-bsec="pressure"] .pr-head'); await p.waitForTimeout(300); console.log('pressure open again', await p.$eval('[data-bsec="pressure"]', e => e.className));
    await p.click('.paint-studio [data-bs-act="done"]');
  }
  console.log('errors', errs); await b.close();
})();
