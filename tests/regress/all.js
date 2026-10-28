const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
const URL = 'http://127.0.0.1:8123/index.html';
const log = (...a) => console.log(...a);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 850 }, colorScheme: 'light', acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(URL); await p.waitForTimeout(800); await p.addStyleTag({ content: '.paint-ctx { visibility: hidden !important; }' });
  const box = async () => (await p.$('.paint-stage')).boundingBox();
  // (a top bar button, folded away or not: a selection turning up folds the bar)
  const hb = k => p.evaluate(k => document.querySelector('[data-hb="' + k + '"]').click(), k);
  // (Crop & Rotate, opened only if it isn't open: it stays open after a turn now, and closed after one before)
  const imgOpen = () => p.evaluate(() => { const b = document.querySelector('[data-img="left"]'); if (!b || !b.offsetParent) document.querySelector('[data-hb="image"]').click(); });
  const docSize = () => p.evaluate(() => { const c = document.querySelector('.paint-over'); return [c.width, c.height]; });
  const nLayers = () => p.$$eval('.paint-layers canvas', l => l.length);
  // a point on the picture, as a fraction of it
  const at = async (fx, fy) => p.evaluate(([fx, fy]) => { const w = document.querySelector('.paint-world').getBoundingClientRect(); return [w.left + w.width * fx, w.top + w.height * fy]; }, [fx, fy]);
  const stroke = async (pts) => { const a = await at(...pts[0]); await p.mouse.move(...a); await p.mouse.down(); for (const q of pts.slice(1)) { const c = await at(...q); await p.mouse.move(...c, { steps: 6 }); } await p.mouse.up(); };
  const px = (fx, fy, li = 0) => p.evaluate(([fx, fy, li]) => { const c = document.querySelectorAll('.paint-layers canvas')[li]; return Array.from(c.getContext('2d').getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data); }, [fx, fy, li]);

  log('start size', await docSize());
  // 1. NEW PICTURE: Landscape 16:9
  await p.click('[data-hb="new"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: 'out/new-sheet.png' });
  await p.click('[data-pre="wide"]'); await p.click('[data-ns-act="create"]'); await p.waitForTimeout(300);
  log('after New 16:9', await docSize(), 'layers', await nLayers());
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  log('undo New ->', await docSize());
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(200);
  log('redo New ->', await docSize());
  // bad size message
  await p.click('[data-hb="new"]'); await p.fill('[data-ns="w"]', '9000'); await p.click('[data-ns-act="create"]');
  log('error shown:', await p.$eval('.ns-err', e => !e.hidden && e.textContent));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  // 2. draw, then the new brushes
  await p.keyboard.press('b');
  await stroke([[0.1, 0.2], [0.3, 0.25], [0.45, 0.2]]);
  for (const [i, br] of ['pencil', 'spray', 'calligraphy'].entries()) {
    await p.click('[data-tool="brush"]'); await p.waitForTimeout(150);
    await p.$eval('[data-ctx="brushes"]', e => e.click()); await p.$eval(`.ctx-list [data-pick="brush"][data-val="${br}"]`, e => e.click());
    await p.click('.paint-swatches button:nth-child(' + (4 + i * 3) + ')');
    await stroke([[0.1, 0.35 + i * 0.15], [0.3, 0.42 + i * 0.15], [0.5, 0.35 + i * 0.15], [0.7, 0.42 + i * 0.15]]);
  }
  await p.screenshot({ path: 'out/brushes.png' });
  log('~ brush pixels (should be painted):', JSON.stringify(await px(0.3, 0.42)), JSON.stringify(await px(0.3, 0.57)), JSON.stringify(await px(0.3, 0.72)));

  // 3. SYMMETRY: four ways; a dab top-left shows in all four corners
  await p.$eval('[data-ctx="brushes"]', e => e.click()); await p.$eval('.ctx-list [data-pick="brush"][data-val="round"]', e => e.click()).catch(() => {});
  await p.click('[data-tool="brush"]');
  await p.click('.paint-swatches button:nth-child(1)');
  await p.click('.paint-mirror'); await p.waitForTimeout(200);
  await p.screenshot({ path: 'out/sym-menu.png' });
  await p.evaluate(v => { if (!document.querySelector('[data-ctx-sym]')) document.querySelector('.paint-mirror').click(); document.querySelector('[data-ctx-sym="' + v + '"]').click(); }, 'xy');
  await p.$eval('.paint-size', e => { e.value = 306; }); await p.$eval('.paint-size', e => e.dispatchEvent(new Event('input', { bubbles: true })));
  await stroke([[0.12, 0.12], [0.13, 0.13]]);
  log('four-way dabs:', [[0.125, 0.125], [0.875, 0.125], [0.125, 0.875], [0.875, 0.875]].map(() => ''), JSON.stringify(await Promise.all([[0.125, 0.125], [0.875, 0.125], [0.125, 0.875], [0.875, 0.875]].map(q => px(...q)))));
  await p.evaluate(v => { if (!document.querySelector('[data-ctx-sym]')) document.querySelector('.paint-mirror').click(); document.querySelector('[data-ctx-sym="' + v + '"]').click(); }, 'radial');
  await stroke([[0.55, 0.3], [0.6, 0.35]]);
  await p.screenshot({ path: 'out/sym-radial-all.png' });
  await p.evaluate(v => { if (!document.querySelector('[data-ctx-sym]')) document.querySelector('.paint-mirror').click(); document.querySelector('[data-ctx-sym="' + v + '"]').click(); }, 'off');
  log('guide hidden after Off:', await p.$eval('.paint-guide', g => g.hidden));

  // 4. HISTORY
  await p.click('[data-hb="history"]'); await p.waitForTimeout(250);
  const rows = await p.$$eval('.ph-list button', l => l.map(b => b.textContent + (b.classList.contains('on') ? '*' : '')));
  log('history rows:', rows.join(' | '));
  await p.screenshot({ path: 'out/history.png' });
  const n0 = rows.length;
  await p.click('.ph-list button:nth-child(2)'); await p.waitForTimeout(250);
  log('after jump to step 1: undo buttons', await p.$eval('[data-act="undo"]', b => b.disabled), 'rows', (await p.$$eval('.ph-list button', l => l.map(b => b.className))).join(','));
  await p.click(`.ph-list button:nth-child(${n0})`); await p.waitForTimeout(250);
  log('after jump to latest: redo disabled', await p.$eval('[data-act="redo"]', b => b.disabled));
  await p.keyboard.press('Escape');

  // 5. LAYER OPACITY & BLEND
  await p.click('[data-act="layers"]'); await p.waitForTimeout(200);
  await p.click('[data-layer-act="add"]'); await p.waitForTimeout(150);
  await p.$eval('[data-layer-op]', e => { e.value = 40; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.selectOption('[data-layer-blend]', 'multiply');
  const st = await p.$$eval('.paint-layers canvas', l => l.map(c => [c.style.opacity, c.style.mixBlendMode]));
  log('layer styles:', JSON.stringify(st));
  await p.screenshot({ path: 'out/layers.png' });
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  log('undo blend ->', JSON.stringify(await p.$$eval('.paint-layers canvas', l => l.map(c => [c.style.opacity, c.style.mixBlendMode]))));
  await p.keyboard.press('Control+Shift+z');
  await p.mouse.click(5, 300);

  // 6. PASTE a picture
  const pasted = await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#2f7fd6'; x.fillRect(0, 0, 300, 200);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'p.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    return true;
  });
  await p.waitForTimeout(500);
  log('after paste: layers', await nLayers(), 'tool', await p.$eval('.paint-stage', s => s.dataset.tool), 'selbar shown', await p.$eval('.paint-selbar', s => !s.hidden), 'toast', await p.$eval('.paint-toast', t => t.classList.contains('on') && t.textContent));
  await p.screenshot({ path: 'out/paste.png' });
  // drop a picture
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 120; c.height = 120; c.getContext('2d').fillRect(0, 0, 120, 120);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'd.png', { type: 'image/png' }));
    const st = document.querySelector('.paint-stage');
    st.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    st.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await p.waitForTimeout(500);
  log('after drop: layers', await nLayers());
  await p.keyboard.press('Enter');

  // 7. IMAGE: rotate, flip, crop
  const s0 = await docSize();
  await hb('image'); await p.waitForTimeout(200);
  await p.screenshot({ path: 'out/image-menu.png' });
  log('crop disabled without selection:', await p.$eval('[data-img="crop"]', b => b.disabled));
  await p.click('[data-img="right"]'); await p.waitForTimeout(200);
  log('rotate right', JSON.stringify(s0), '->', JSON.stringify(await docSize()));
  await p.screenshot({ path: 'out/rotated.png' });
  await imgOpen(); await p.click('[data-img="left"]'); await p.waitForTimeout(200);
  log('rotate left ->', JSON.stringify(await docSize()));
  const before = await px(0.2, 0.25); await imgOpen(); await p.click('[data-img="fliph"]'); await p.waitForTimeout(200);
  log('flip: pixel at 0.2 before', JSON.stringify(before), 'now at 0.8', JSON.stringify(await px(0.8, 0.25)));
  await p.keyboard.press('m');
  await stroke([[0.25, 0.25], [0.75, 0.75]]);
  await imgOpen(); await p.click('[data-img="crop"]'); await p.waitForTimeout(250);
  log('crop ->', JSON.stringify(await docSize()));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  log('undo crop ->', JSON.stringify(await docSize()));

  // 8. SAVE size and SHARE fallback
  const [dl] = await Promise.all([p.waitForEvent('download'), (async () => { await p.evaluate(() => document.querySelector('[data-act="save"]').click()); await p.click('[data-save="png"]'); })()]);
  await dl.saveAs('out/saved.png');
  await hb('share'); await p.waitForTimeout(800);
  log('share result toast:', await p.$eval('.paint-toast', t => t.textContent));

  // 9. SHORTCUTS
  await p.keyboard.press('Shift+?'); await p.waitForTimeout(300);
  log('help open:', !!(await p.$('.pa-sheet.hs')));
  await p.screenshot({ path: 'out/help.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  log('help closed:', !(await p.$('.pa-sheet-wrap, .paint-docpanel:not([hidden]) .pa-sheet')));

  // 10. install / offline
  const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  const man = await p.evaluate(async () => (await fetch('manifest.webmanifest')).ok);
  log('service worker active:', sw, 'manifest ok:', man);

  // 11. kept after reload: size, layers, opacity
  await hb('new'); await p.click('[data-pre="insta"]'); await p.click('[data-ns-act="create"]'); await p.waitForTimeout(200);
  await p.keyboard.press('b'); await stroke([[0.3, 0.3], [0.6, 0.6]]);
  await p.click('[data-act="layers"]'); await p.click('[data-layer-act="add"]');
  await p.$eval('[data-layer-op]', e => { e.value = 55; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  // (kept once the status says so: wait for that, not a set time)
  await p.waitForTimeout(400); await p.waitForFunction(() => document.querySelector('.doc-status').dataset.state === 'saved', null, { timeout: 15000 }).catch(() => log('~ still not saved'));
  await p.reload(); await p.waitForFunction(() => !document.querySelector('.app-splash'), null, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(500);
  log('after reload: size', JSON.stringify(await docSize()), 'layers', await nLayers(), 'opacities', JSON.stringify(await p.$$eval('.paint-layers canvas', l => l.map(c => c.style.opacity))));
  // offline reload
  await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(1200);
  log('offline reload ok:', await p.title(), 'has paint:', !!(await p.$('.paint-stage')));
  await ctx.setOffline(false);
  log('ERRORS:', errs);
  await b.close();
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
