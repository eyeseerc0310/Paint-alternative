const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
const [theme, wh] = (process.argv[2] || 'light:1366x860').split(':'), [VW, VH] = wh.split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: VW, height: VH }, colorScheme: theme }); const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForFunction(() => !document.querySelector('.app-splash'), null, { timeout: 10000 }); await p.waitForTimeout(600);
  const box = (s) => p.evaluate(s => { const e = document.querySelector(s); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }, s);
  const say = (...a) => console.log(...a);
  const stageW = async () => (await box('.paint-stage'))[2] - (await box('.paint-stage'))[0];
  say('stage width docked', await stageW(), '| world', JSON.stringify(await box('.paint-world')));
  // fold the tool options: the dock eases away, the picture's space grows
  await p.click('.ctx-min'); await p.waitForTimeout(80); const mid = await stageW(); await p.waitForTimeout(700);
  say('~ mid-ease stage width', mid);
  say('folded: stage width', await stageW(), '| dock', JSON.stringify(await box('.paint-dock')), '| mini button', JSON.stringify(await box('.paint-ctx')), '| zoom', await p.$eval('.paint-zoom-val', e => e.textContent));
  // (folded, the panel is hidden; tapping the tool in hand opens it again)
  say('folded, panel shows:', await p.$eval('.paint-ctx', e => getComputedStyle(e).visibility));
  await p.click('.paint-left [data-tool="brush"]'); await p.waitForTimeout(700);
  say('opened again: ctx', JSON.stringify(await box('.paint-ctx')), '| stage', await stageW(), '| dock', JSON.stringify(await box('.paint-dock')));
  // a double-click on the grip: back in the dock
  const g = await box('.ctx-grip'); await p.mouse.dblclick((g[0] + g[2]) / 2, (g[1] + g[3]) / 2); await p.waitForTimeout(700);
  say('double-click: ctx', JSON.stringify(await box('.paint-ctx')), '| stage', await stageW());
  // dragged off a little and let go near: it docks again
  let gg = await box('.ctx-grip'); await p.mouse.move((gg[0] + gg[2]) / 2, (gg[1] + gg[3]) / 2); await p.mouse.down(); await p.mouse.move((gg[0] + gg[2]) / 2 - 25, (gg[1] + gg[3]) / 2 + 20, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(700);
  say('let go near its place: ctx', JSON.stringify(await box('.paint-ctx')), '| stage', await stageW());
  // the brush list opens towards the picture
  await p.click('[data-ctx="brushes"]'); await p.waitForTimeout(700); say('brush list', JSON.stringify(await box('.ctx-list')), 'ctx', JSON.stringify(await box('.paint-ctx'))); await p.keyboard.press('Escape');
  // the colour picker: above the bar, over the colours
  await p.click('.paint-current'); await p.waitForTimeout(300); say('picker', JSON.stringify(await box('.paint-colorpanel')), 'pair', JSON.stringify(await box('.paint-pair')), 'bar', JSON.stringify(await box('.paint-bottom')), 'expanded', await p.$eval('.paint-current', e => e.getAttribute('aria-expanded')));
  await p.screenshot({ path: `out/int-${theme}-${VW}-picker.png` });
  await p.click('.paint-second'); await p.waitForTimeout(200); say('second picked:', await p.$eval('.paint-second', e => e.getAttribute('aria-expanded')));
  await p.click('.paint-second'); await p.waitForTimeout(200); say('picker closed', (await box('.paint-colorpanel')) === null);
  // layers beside the left bar
  // (where the panel opens shifts by a few pixels from run to run, on the reference too: not compared)
  await p.click('[data-act="layers"]'); await p.waitForTimeout(300); say('~ layers panel', JSON.stringify(await box('.paint-layerpanel')), 'left bar', JSON.stringify(await box('.paint-left')));
  await p.screenshot({ path: `out/int-${theme}-${VW}-layers.png` });
  await p.click('[data-act="layers"]'); await p.waitForTimeout(200);
  // zoom
  await p.click('[data-zoom="in"]'); await p.waitForTimeout(150); const z1 = await p.$eval('.paint-zoom-val', e => e.textContent); await p.click('.paint-zoom-val'); await p.waitForTimeout(150); say('zoom in', z1, 'fit', await p.$eval('.paint-zoom-val', e => e.textContent));
  // draw, undo, redo from the bar
  const w = await box('.paint-world'); await p.mouse.move(w[0] + 100, w[1] + 100); await p.mouse.down(); await p.mouse.move(w[0] + 300, w[1] + 200, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(150);
  const ink = () => p.evaluate(() => { const c = document.querySelector('.paint-layers canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] < 100) n++; return n; });
  const i1 = await ink(); await p.click('[data-act="undo"]'); await p.waitForTimeout(100); const i2 = await ink(); await p.click('[data-act="redo"]'); await p.waitForTimeout(100);
  say('stroke ink', i1, '| undo', i2, '| redo', await ink());
  // fill tool: size greyed out, opacity not
  await p.keyboard.press('f'); await p.waitForTimeout(100); say('fill: size disabled', await p.$eval('.paint-size', e => e.disabled), 'opacity disabled', await p.$eval('.paint-alpha', e => e.disabled));
  await p.keyboard.press('b'); say('brush: size disabled', await p.$eval('.paint-size', e => e.disabled));
  // size slider moves the size; [ and ] too
  await p.$eval('.paint-size', e => { e.value = 600; e.dispatchEvent(new Event('input', { bubbles: true })); }); say('size slider ->', await p.$eval('.paint-size + output', e => e.textContent)); await p.keyboard.press('['); say('[ ->', await p.$eval('.paint-size + output', e => e.textContent));
  // drag the colour onto the picture: fills
  await p.keyboard.press('Control+a').catch(() => {}); await p.keyboard.press('Escape');
  const pc = await box('.paint-current'); await p.mouse.move((pc[0] + pc[2]) / 2, (pc[1] + pc[3]) / 2); await p.mouse.down(); await p.mouse.move(w[0] + 500, w[1] + 300, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(700);
  say('colour dropped: ink now', await ink());
  // focus mode
  await p.keyboard.press('\\'); await p.waitForTimeout(900);
  say('focus: stage', JSON.stringify(await box('.paint-stage')), 'bottom bar visible', await p.$eval('.paint-bottom', e => getComputedStyle(e).visibility), 'dock', JSON.stringify(await box('.paint-dock')));
  await p.screenshot({ path: `out/int-${theme}-${VW}-focus.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(900);
  say('back: stage', JSON.stringify(await box('.paint-stage')), 'bottom', JSON.stringify(await box('.paint-bottom')));
  // header open / close
  await p.click('.hdr-fold'); await p.waitForTimeout(700); say('header open: stage', JSON.stringify(await box('.paint-stage')), 'bar', JSON.stringify(await box('.paint-bottom')), 'ctx', JSON.stringify(await box('.paint-ctx')));
  await p.click('.hdr-fold'); await p.waitForTimeout(700);
  // resize to a phone and back
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500); say('as a phone: dock', JSON.stringify(await box('.paint-dock')), 'ctx', JSON.stringify(await box('.paint-ctx')), 'stage', JSON.stringify(await box('.paint-stage')));
  await p.setViewportSize({ width: VW, height: VH }); await p.waitForTimeout(500); say('back: dock', JSON.stringify(await box('.paint-dock')), 'ctx', JSON.stringify(await box('.paint-ctx')), 'stage', JSON.stringify(await box('.paint-stage')), 'zoom', await p.$eval('.paint-zoom-val', e => e.textContent));
  say('errors', errs); await b.close();
})();
