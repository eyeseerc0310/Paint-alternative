const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(700);
  const at = async (fx, fy) => p.evaluate(([fx, fy]) => { const w = document.querySelector('.paint-world').getBoundingClientRect(); return [w.left + w.width * fx, w.top + w.height * fy]; }, [fx, fy]);
  await p.click('[data-hb="new"]'); await p.click('[data-pre="square"]'); await p.click('[data-ns-act="create"]'); await p.waitForTimeout(200);
  await p.$eval('.paint-size', e => { e.value = 400; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.mouse.move(...await at(0.2, 0.3)); await p.mouse.down(); await p.mouse.move(...await at(0.6, 0.3), { steps: 8 }); await p.mouse.up();
  await p.click('[data-act="layers"]'); await p.click('[data-layer-act="add"]');
  await (await p.$$('.pl-more'))[0].click(); await p.click('[data-lm="clip"]');
  await p.$eval('[data-layer-op]', e => { e.value = 60; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('[data-act="layers"]');
  await p.click('.paint-swatches button:nth-child(4)');
  await p.mouse.move(...await at(0.1, 0.32)); await p.mouse.down(); await p.mouse.move(...await at(0.8, 0.32), { steps: 8 }); await p.mouse.up();
  const state = () => p.evaluate(() => ({ size: document.querySelector('.paint-layers canvas').width + 'x' + document.querySelector('.paint-layers canvas').height, rows: [...document.querySelectorAll('.pl-row')].map(r => r.querySelector('.pl-name span').textContent + (r.classList.contains('clipped') ? '(clip)' : '')).join(' | ') }));
  await p.click('[data-act="layers"]'); const s0 = await state(); await p.click('[data-act="layers"]');
  const look = () => p.screenshot({ clip: { x: 300, y: 150, width: 600, height: 600 } });
  const img0 = await look();
  // save the project
  await p.click('[data-act="save"]');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-save="project"]')]);
  const path = 'out/test.paint'; await dl.saveAs(path);
  console.log('saved', dl.suggestedFilename(), require('fs').statSync(path).size, 'bytes');
  // start a new, different picture, then open the project
  await p.click('[data-hb="new"]'); await p.click('[data-pre="wide"]'); await p.click('[data-ns-act="create"]'); await p.waitForTimeout(200);
  // (opened once the picture is the saved one's size: wait for that, not a set time)
  await p.setInputFiles('.paint-open input', path);
  await p.waitForFunction(sz => { const c = document.querySelector('.paint-layers canvas'); return c && c.width + 'x' + c.height === sz; }, s0.size, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(400);
  await p.click('[data-act="layers"]'); const s1 = await state(); await p.click('[data-act="layers"]');
  const img1 = await look();
  console.log('before:', JSON.stringify(s0)); console.log('opened:', JSON.stringify(s1));
  console.log('looks the same:', Buffer.compare(img0, img1) === 0);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  console.log('undo goes back to the wide picture:', await p.evaluate(() => document.querySelector('.paint-layers canvas').width + 'x' + document.querySelector('.paint-layers canvas').height));
  // a bad file
  require('fs').writeFileSync('out/bad.paint', 'not json');
  // (wait for the toast to change, not a set time)
  const toastWas = await p.evaluate(() => (document.querySelector('.paint-toast') || {}).textContent || '');
  await p.setInputFiles('.paint-open input', 'out/bad.paint');
  await p.waitForFunction(w => ((document.querySelector('.paint-toast') || {}).textContent || '') !== w, toastWas, { timeout: 10000 }).catch(() => {});
  console.log('bad file toast:', await p.$eval('.paint-toast', e => e.textContent).catch(() => '?'));
  console.log('errors', errs); await b.close();
})();
