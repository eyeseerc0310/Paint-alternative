const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
(async () => {
  const b = await chromium.launch(); const mode = process.argv[2] || 'light', phone = mode === 'phone';
  const p = await (await b.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1400, height: 900 }, colorScheme: mode === 'dark' ? 'dark' : 'light', hasTouch: phone })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(700);
  const at = async (fx, fy) => p.evaluate(([fx, fy]) => { const w = document.querySelector('.paint-world').getBoundingClientRect(); return [w.left + w.width * fx, w.top + w.height * fy]; }, [fx, fy]);
  const stroke = async (pts) => { await p.mouse.move(...await at(...pts[0])); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(...await at(...q), { steps: 6 }); await p.mouse.up(); };
  const layerPx = (idx, fx, fy) => p.evaluate(([idx, fx, fy]) => { const cs = document.querySelectorAll('.paint-layers canvas'); const c = cs[idx]; return Array.from(c.getContext('2d').getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data).join(','); }, [idx, fx, fy]);
  const flat = (fx, fy) => p.evaluate(([fx, fy]) => { const cs = [...document.querySelectorAll('.paint-layers canvas')]; const o = document.createElement('canvas'); o.width = cs[0].width; o.height = cs[0].height; const x = o.getContext('2d'); cs.forEach(c => { if (c.style.visibility !== 'hidden') { x.globalAlpha = +(c.style.opacity || 1); x.drawImage(c, 0, 0); } }); return Array.from(x.getImageData(Math.floor(o.width * fx), Math.floor(o.height * fy), 1, 1).data).slice(0, 3).join(','); }, [fx, fy]);
  const openLayers = async () => { if (await p.$eval('.paint-layerpanel', e => e.hidden)) await p.click('[data-act="layers"]'); await p.waitForTimeout(150); };
  const menu = async (rowIdx, item) => { await openLayers(); const btns = await p.$$('.pl-more'); await btns[rowIdx].click(); await p.waitForTimeout(100); if (item) await p.click(`[data-lm="${item}"]`); };
  await p.$eval('.paint-size', e => { e.value = Math.round(1000 * Math.pow((40 - 1) / 499, 1 / 2.4)); e.dispatchEvent(new Event('input', { bubbles: true })); });
  // layer 1: a black blob
  await openLayers(); await p.click('[data-layer-act="add"]'); await p.click('[data-act="layers"]');
  await stroke([[0.3, 0.5], [0.4, 0.5]]);
  // menu opens from the ••• button
  await menu(0); console.log('menu items:', await p.$$eval('.paint-lmenu [data-lm]', l => l.map(b => b.textContent + (b.disabled ? '(off)' : '') + (b.getAttribute('aria-checked') === 'true' ? '✓' : '')).join(', ')));
  await p.screenshot({ path: `out/lmenu-${mode}.png` });
  await p.click('[data-lm="lock"]'); console.log('lock icon shown:', !!(await p.$('.pl-row .pl-tag')));
  await p.click('[data-act="layers"]');
  // alpha lock: red stroke across the blob only lands on the blob
  await p.click('.paint-swatches button:nth-child(4)');
  await stroke([[0.2, 0.5], [0.5, 0.5]]);
  console.log('alpha lock: on blob', await layerPx(1, 0.35, 0.5), '| off blob (stays empty)', await layerPx(1, 0.22, 0.5));
  // eraser blocked on locked layer
  await p.keyboard.press('e'); await stroke([[0.33, 0.5], [0.37, 0.5]]); console.log('eraser blocked, blob kept:', await layerPx(1, 0.35, 0.5));
  await p.keyboard.press('b');
  await menu(0, 'lock');
  // clipping: new layer above, clip to the blob layer, paint wide green
  await openLayers(); await p.click('[data-layer-act="add"]'); await p.click('[data-act="layers"]');
  await menu(0, 'clip'); console.log('clipped row shown:', !!(await p.$('.pl-row.clipped')));
  await p.click('[data-act="layers"]');
  await p.click('.paint-swatches button:nth-child(' + (phone ? 5 : 7) + ')'); await stroke([[0.2, 0.52], [0.5, 0.52]]);
  console.log('clip: over blob', await flat(0.35, 0.52), '| beside blob (white)', await flat(0.22, 0.52));
  // unclip brings it back
  await menu(0, 'clip'); console.log('unclipped: beside blob', await flat(0.22, 0.52));
  await menu(0, 'clip');
  // duplicate
  await menu(1, 'duplicate'); await openLayers(); console.log('layers after duplicate:', await p.$$eval('.pl-row .pl-name span', l => l.map(x => x.textContent).join(' | ')));
  // merge down the top (clipped) layer
  const n0 = await p.$$eval('.pl-row', l => l.length);
  await menu(0, 'merge'); await openLayers(); console.log('merge down:', n0, '->', await p.$$eval('.pl-row', l => l.length), '| look kept beside blob', await flat(0.22, 0.52), 'over blob', await flat(0.35, 0.52));
  await p.keyboard.press('Escape');
  await p.keyboard.press('Control+z'); await openLayers(); console.log('undo merge ->', await p.$$eval('.pl-row', l => l.length), 'layers; clipped again:', !!(await p.$('.pl-row.clipped')), '| beside', await flat(0.22, 0.52));
  // menu items: move, hide, delete, rename, select
  await menu(0, 'hide'); console.log('hidden ->', await p.$eval('.pl-row .pl-eye', e => e.getAttribute('aria-pressed')));
  await menu(0, 'hide');
  await menu(1, 'rename'); await p.keyboard.type('Ink'); await p.keyboard.press('Enter'); console.log('renamed:', await p.$$eval('.pl-row .pl-name span', l => l.map(x => x.textContent).join(' | ')));
  await menu(2, 'select'); console.log('select -> tool', await p.$eval('button[data-tool][aria-pressed="true"]', e => e.dataset.tool), 'selbar', await p.$eval('.paint-selbar', e => !e.hidden));
  await p.keyboard.press('Escape');
  // menu toggles closed with the same button; right-click still works
  await menu(0); await (await p.$$('.pl-more'))[0].click(); console.log('••• again closes:', await p.$eval('.paint-lmenu', e => e.hidden));
  if (!phone) { await (await p.$$('.pl-row'))[0].click({ button: 'right' }); console.log('right-click opens:', await p.$eval('.paint-lmenu', e => !e.hidden)); await p.keyboard.press('Escape'); }
  // saved and back after reload
  await p.waitForTimeout(1500); await p.reload(); await p.waitForTimeout(1500); await openLayers();
  console.log('after reload: rows', await p.$$eval('.pl-row', l => l.length), 'clipped kept:', !!(await p.$('.pl-row.clipped')));
  await p.screenshot({ path: `out/layers-${mode}.png` });
  console.log('errors', errs); await b.close();
})();
