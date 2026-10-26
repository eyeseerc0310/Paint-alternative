const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
(async () => {
  const b = await chromium.launch();
  const mode = process.argv[2] || 'light', phone = mode === 'phone';
  const ctx = await b.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1400, height: 900 }, colorScheme: mode === 'dark' ? 'dark' : 'light', hasTouch: phone });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(700);
  const box = async (s) => { const r = await (await p.$(s)).boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2, r]; };
  const tap = async (s) => { const q = await box(s); if (phone) await p.touchscreen.tap(q[0], q[1]); else await p.mouse.click(q[0], q[1]); };
  await tap('.paint-current'); await p.waitForTimeout(300);
  console.log('tap opens picker:', await p.$eval('.paint-colorpanel', e => !e.hidden));
  await p.screenshot({ path: `out/pick-${mode}.png` });
  // drag on the square: top right = full colour
  const d = await box('.pc-disc'); const r = d[2];
  await p.mouse.move(r.x + r.width * 0.72, r.y + r.height * 0.28); await p.mouse.down(); await p.mouse.move(r.x + r.width * 0.735, r.y + r.height * 0.265, { steps: 3 }); await p.mouse.up();
  // ring at the right (hue 90: yellow-green)
  await p.mouse.move(r.x + r.width - 8, r.y + r.height / 2); await p.mouse.down(); await p.mouse.up();
  const s1 = await p.evaluate(() => ({ dot: getComputedStyle(document.querySelector('.paint-current span')).backgroundColor, hex: document.querySelector('[data-pcv="hex"]').value }));
  console.log('after ring + square:', s1);
  // type a hex
  await p.fill('[data-pcv="hex"]', '#3366cc'); await p.waitForTimeout(50);
  console.log('typed hex -> colour', await p.$eval('.paint-current span', e => getComputedStyle(e).backgroundColor));
  await p.click('[data-pc-mode="rgb"]'); console.log('rgb fields', await p.$$eval('[data-pcv]', l => l.map(i => i.value).join(',')));
  await p.fill('[data-pcv="r"]', '255'); console.log('r=255 ->', await p.$eval('.paint-current span', e => getComputedStyle(e).backgroundColor));
  await p.click('[data-pc-mode="hsb"]'); console.log('hsb fields', await p.$$eval('[data-pcv]', l => l.map(i => i.value).join(',')));
  await p.fill('[data-pcv="v"]', '50'); console.log('B=50 ->', await p.$eval('.paint-current span', e => getComputedStyle(e).backgroundColor));
  // sliders
  await p.$eval('[data-pc="s"]', e => { e.value = 0; e.dispatchEvent(new Event('input', { bubbles: true })); });
  console.log('saturation 0 ->', await p.$eval('.paint-current span', e => getComputedStyle(e).backgroundColor));
  // palettes: add to My Colours, new palette, remove by right click
  await p.$eval('[data-pc="s"]', e => { e.value = 80; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('[data-pc-act="add"]'); console.log('my colours after add:', await p.$$eval('.pc-swatches [data-pc-color]', l => l.length));
  await p.click('[data-pc-act="new"]'); console.log('palettes:', await p.$$eval('.pc-pal option', l => l.map(o => o.textContent).join(' | ')), 'chosen', await p.$eval('.pc-pal', s => s.selectedOptions[0].textContent));
  if (!phone) { await p.click('.pc-swatches [data-pc-i="0"]', { button: 'right' }); console.log('after removing:', await p.$$eval('.pc-swatches [data-pc-color]', l => l.length)); }
  await p.selectOption('.pc-pal', '1'); console.log('ready palette Greys swatches', await p.$$eval('.pc-swatches [data-pc-color]', l => l.length), 'add shown', !!(await p.$('[data-pc-act="add"]')));
  await p.click('.pc-swatches [data-pc-color="#8e8e93"]'); console.log('palette colour picked ->', await p.$eval('.paint-current span', e => getComputedStyle(e).backgroundColor));
  // second colour tab
  await p.click('[data-pc-which="second"]'); await p.fill('[data-pcv="h"]', '120');
  console.log('second colour now', await p.$eval('.paint-second span', e => getComputedStyle(e).backgroundColor));
  console.log('state before shot', await p.evaluate(() => ({ tabs: [...document.querySelectorAll('[data-pc-which]')].map(b => b.dataset.pcWhich + ':' + b.getAttribute('aria-selected')).join(' '), was: document.querySelector('.pc-was').style.background, now: document.querySelector('.pc-now').style.background, c1: document.querySelector('.paint-current span').style.background, c2: document.querySelector('.paint-second span').style.background })));
  await p.screenshot({ path: `out/pick2-${mode}.png` });
  // escape closes; recent got the picked colour
  await p.keyboard.press('Escape'); console.log('esc closes:', await p.$eval('.paint-colorpanel', e => e.hidden));
  console.log('toolbar recent:', await p.$$eval('.paint-recent button', l => l.map(b => b.dataset.color).join(',')));
  // tap again then tap outside closes
  await tap('.paint-current'); { const w = (await box('.paint-world'))[2]; if (phone) await p.touchscreen.tap(w.x + w.width - 12, w.y + w.height * 0.85); else await p.mouse.click(w.x + w.width - 12, w.y + w.height * 0.85); } console.log('outside tap closes:', await p.$eval('.paint-colorpanel', e => e.hidden));
  // DRAG the main colour onto the picture: fills, never opens the picker
  for (let k = 0; k < 6; k++) {
    const c = await box('.paint-current'), st2 = await box('.paint-world');
    const tx = st2[2].x + st2[2].width * (0.3 + k * 0.08), ty = st2[2].y + st2[2].height * 0.5;
    if (phone) {
      const cdp = await ctx.newCDPSession(p);
      const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await tp('touchStart', c[0], c[1]); for (let i = 1; i <= 8; i++) await tp('touchMove', c[0] + (tx - c[0]) * i / 8, c[1] + (ty - c[1]) * i / 8); await tp('touchEnd');
    } else { await p.mouse.move(c[0], c[1]); await p.mouse.down(); await p.mouse.move(tx, ty, { steps: 8 }); await p.mouse.up(); }
    await p.waitForTimeout(150);
    if (await p.$eval('.paint-colorpanel', e => !e.hidden)) { console.log('DRAG OPENED THE PICKER on try', k); break; }
  }
  await p.waitForTimeout(1200);
  console.log('after drags picker hidden:', await p.$eval('.paint-colorpanel', e => e.hidden));
  // a short wobbly tap (moves 3px) still opens it
  { const c = await box('.paint-current'); if (!phone) { await p.mouse.move(c[0], c[1]); await p.mouse.down(); await p.mouse.move(c[0] + 3, c[1] + 2); await p.mouse.up(); console.log('wobbly tap opens:', await p.$eval('.paint-colorpanel', e => !e.hidden)); } }
  // keyboard: focus and Enter
  await p.keyboard.press('Escape'); await p.waitForTimeout(900); await p.focus('.paint-second'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  console.log('keyboard Enter opens second:', await p.$eval('.paint-colorpanel', e => !e.hidden), await p.$eval('[data-pc-which="second"]', e => e.getAttribute('aria-selected')));
  console.log('errors', errs); await b.close();
})();
