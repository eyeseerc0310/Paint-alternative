const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(600);
  const at = async (fx, fy) => p.evaluate(([fx, fy]) => { const w = document.querySelector('.paint-world').getBoundingClientRect(); return [w.left + w.width * fx, w.top + w.height * fy]; }, [fx, fy]);
  const top = (fx, fy) => p.evaluate(([fx, fy]) => { const l = document.querySelectorAll('.paint-layers canvas'), c = l[l.length - 1]; return c.getContext('2d').getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data[3]; }, [fx, fy]);
  await p.click('[data-hb="new"]'); await p.click('[data-pre="wide"]'); await p.click('[data-ns-act="create"]'); await p.waitForTimeout(200);
  await p.keyboard.press('b'); await p.$eval('.paint-size', e => { e.value = Math.round(1000 * Math.pow(((20) - 1) / 499, 1 / 2.4)); e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('[data-act="layers"]'); await p.click('[data-layer-act="add"]'); await p.click('[data-act="layers"]');
  // two blobs with a gap between them
  for (const x of [0.3, 0.5]) { await p.mouse.move(...await at(x, 0.25)); await p.mouse.down(); await p.mouse.move(...await at(x, 0.35), { steps: 6 }); await p.mouse.up(); }
  await p.waitForTimeout(200);
  console.log('before: blob at (0.3,0.3)', await top(0.3, 0.3), '| empty at (0.3,0.6)', await top(0.3, 0.6));
  // right-click the layer, Select
  await p.click('[data-act="layers"]'); await p.waitForTimeout(200);
  const rows = await p.$$('.pl-row'); await rows[0].click({ button: 'right' }); await p.waitForTimeout(150);
  await p.click('[data-lm="select"]'); await p.waitForTimeout(200);
  console.log('tool now:', await p.$eval('button[data-tool][aria-pressed="true"]', e => e.dataset.tool));
  // hover the gap between the blobs: move cursor
  await p.mouse.move(...await at(0.4, 0.3)); await p.waitForTimeout(50);
  console.log('move cursor over the gap:', await p.$eval('.paint-stage', e => e.classList.contains('can-move') && getComputedStyle(e).cursor));
  await p.mouse.down(); await p.mouse.move(...await at(0.4, 0.45), { steps: 4 });
  console.log('grabbing cursor while dragging:', await p.$eval('.paint-stage', e => getComputedStyle(e).cursor));
  await p.mouse.move(...await at(0.4, 0.6), { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(100);
  console.log('cursor after letting go:', await p.$eval('.paint-stage', e => getComputedStyle(e).cursor));
  await p.screenshot({ path: 'out/mv-moved.png' });
  // a second drag, from right on a blob
  await p.mouse.move(...await at(0.5, 0.6)); await p.mouse.down(); await p.mouse.move(...await at(0.6, 0.6), { steps: 8 }); await p.mouse.up();
  // resize still works: drag the bottom right corner out
  const box = await p.evaluate(() => { const c = document.querySelectorAll('.paint-stage canvas'); return null; });
  await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  console.log('after moves: old spot', await top(0.3, 0.3), '| moved to (0.4,0.6)', await top(0.4, 0.6), '| (0.6,0.6)', await top(0.6, 0.6));
  // select again and stretch from the corner
  await p.click('[data-act="layers"]'); await p.waitForTimeout(200);
  await (await p.$$('.pl-row'))[0].click({ button: 'right' }); await p.click('[data-lm="select"]'); await p.waitForTimeout(200);
  // find the bottom-right handle by scanning the selection sheet's handle squares is fiddly; use the layer's painted box
  const br = await p.evaluate(() => { const l = document.querySelectorAll('.paint-layers canvas'), c = l[l.length - 1], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let mx = -1, my = -1; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3]) { if (x > mx) mx = x; if (y > my) my = y; } const w = document.querySelector('.paint-world').getBoundingClientRect(); return [w.left + (mx + 1) / c.width * w.width, w.top + (my + 1) / c.height * w.height, (mx + 1) / c.width, (my + 1) / c.height]; });
  await p.mouse.move(br[0], br[1]); await p.waitForTimeout(50);
  console.log('resize cursor on corner:', await p.$eval('.paint-stage', e => getComputedStyle(e).cursor));
  await p.mouse.down(); await p.mouse.move(br[0] + 150, br[1] + 120, { steps: 8 }); await p.mouse.up(); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  const after = await p.evaluate(() => { const l = document.querySelectorAll('.paint-layers canvas'), c = l[l.length - 1], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let mx = -1; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] && x > mx) mx = x; return (mx + 1) / c.width; });
  console.log('right edge before stretch', br[2].toFixed(3), 'after', after.toFixed(3));
  // brush still paints after selecting via layer (switch back)
  await p.keyboard.press('b'); await p.mouse.move(...await at(0.1, 0.9)); await p.mouse.down(); await p.mouse.move(...await at(0.15, 0.9), { steps: 4 }); await p.mouse.up();
  console.log('brush paints again:', await top(0.12, 0.9) > 0);
  // undo walks it all back
  // (as many undos as it takes: selecting and letting go are steps too)
  let n = 0; while (n < 12 && !(await top(0.3, 0.3))) { await p.keyboard.press('Control+z'); await p.waitForTimeout(80); n++; }
  await p.waitForTimeout(150); console.log('~ undos it took', n);
  console.log('after undo: (0.3,0.3)', await top(0.3, 0.3), '(0.4,0.6)', await top(0.4, 0.6));
  console.log('errors', errs);
  await b.close();
})();
