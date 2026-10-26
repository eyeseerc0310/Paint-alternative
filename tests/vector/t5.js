const L = require('../lib'), { chromium } = L.use({ showSwitch: true });
const D = '', fs = require('fs');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(1200);
  const mode = () => p.evaluate(() => document.documentElement.classList.contains('vector-mode') ? 'vector' : 'paint');
  const sheet = () => p.$('.pa-sheet-wrap.in .vm');
  const nObj = () => p.$$eval('.vec-art use', l => l.length);
  const vser = () => p.evaluate(() => JSON.stringify(window.PaintVector.serialize()));
  const layerNames = () => p.$$eval('.paint-layers canvas', l => l.length);
  const paintHash = () => p.evaluate(() => { let h = 0; for (const c of document.querySelectorAll('.paint-layers canvas')) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; } return h + ':' + document.querySelectorAll('.paint-layers canvas').length; });
  // 1. blank paint -> vector: no dialog, a blank artboard the picture's size
  await p.click('[data-mode="vector"]'); await p.waitForTimeout(400);
  ok(!(await sheet()) && (await mode()) === 'vector', 'blank painting: switches at once, no dialog');
  const s0 = JSON.parse(await vser()); const pw = await p.$eval('.paint-over', c => [c.width, c.height]);
  ok(s0.w === pw[0] && s0.h === pw[1] && s0.layers.length === 1 && !s0.layers[0].items.length, 'first Vector open: a blank artboard ' + s0.w + 'x' + s0.h);
  ok(await p.$eval('[data-mode="vector"]', b => b.getAttribute('aria-checked')) === 'true', 'switch shows Vector picked');
  await p.click('[data-mode="paint"]'); await p.waitForTimeout(400);
  ok(!(await sheet()) && (await mode()) === 'paint', 'empty vector: back to Paint at once');
  // 2. paint something
  const w = await p.$eval('.paint-world', e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  await p.mouse.move(w[0] + 100, w[1] + 100); await p.mouse.down(); await p.mouse.move(w[0] + 400, w[1] + 300, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(200);
  const h0 = await paintHash();
  await p.click('[data-mode="vector"]'); await p.waitForTimeout(400);
  ok(!!(await sheet()), 'painting has art: the dialog asks');
  await p.click('[data-vm="cancel"]'); await p.waitForTimeout(300);
  ok((await mode()) === 'paint', 'Cancel stays in Paint');
  await p.click('[data-mode="vector"]'); await p.waitForTimeout(300); await p.click('[data-vm="switch"]'); await p.waitForTimeout(400);
  ok((await mode()) === 'vector' && (await nObj()) === 0, 'Switch Without Copying: Vector, nothing brought');
  await p.click('[data-mode="paint"]'); await p.waitForTimeout(400);
  ok((await paintHash()) === h0, 'painting unchanged after the round trip');
  await p.click('[data-mode="vector"]'); await p.waitForTimeout(300); await p.click('[data-vm="bring"]'); await p.waitForTimeout(700);
  ok((await nObj()) === 1, 'Bring Artwork: one picture object');
  let s1 = JSON.parse(await vser());
  ok(s1.layers.length === 2 && s1.layers[1].name === 'Painting' && s1.layers[1].items[0].w === pw[0], 'on a layer of its own, "Painting", artboard-sized');
  // vector undo / redo of the transfer
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  ok((await nObj()) === 0 && JSON.parse(await vser()).layers.length === 1, 'undo in Vector takes the transfer back');
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(200);
  ok((await nObj()) === 1, 'redo brings it back');
  // 3. edit the reference picture: move, size, fade, hide, lock
  const box = async () => p.$eval('.vec-art use', e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  let bx = await box();
  await p.mouse.move(bx[0] + bx[2] / 2, bx[1] + bx[3] / 2); await p.mouse.down(); await p.mouse.move(bx[0] + bx[2] / 2 + 60, bx[1] + bx[3] / 2 + 30, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200);
  let o = JSON.parse(await vser()).layers[1].items[0];
  ok(Math.abs(o.x - 60 / s1.view.k) < 3 && Math.abs(o.y - 30 / s1.view.k) < 3, 'drag moves it (' + o.x.toFixed(1) + ',' + o.y.toFixed(1) + ')');
  bx = await box();
  await p.mouse.move(bx[0], bx[1]); await p.mouse.down(); await p.mouse.move(bx[0] + bx[2] / 2, bx[1] + bx[3] / 2 - 50, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200);
  o = JSON.parse(await vser()).layers[1].items[0];
  ok(Math.abs(o.w / o.h - pw[0] / pw[1]) < 0.01 && o.w < pw[0] * 0.7, 'corner sizes it, proportions kept (' + Math.round(o.w) + 'x' + Math.round(o.h) + ')');
  await p.$eval('[data-vk="op"]', i => { i.value = 40; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(150);
  ok(JSON.parse(await vser()).layers[1].items[0].opacity === 0.4 && (await p.$eval('.vec-art use', e => e.parentNode.getAttribute('opacity'))) === '0.4', 'Opacity fades it to 40%');
  await p.fill('[data-vk="w"]', '500'); await p.press('[data-vk="w"]', 'Enter'); await p.waitForTimeout(150);
  ok(Math.round(JSON.parse(await vser()).layers[1].items[0].w) === 500, 'typed W = 500');
  await p.click('[data-vk="lock"]'); await p.waitForTimeout(150);
  ok(JSON.parse(await vser()).layers[1].items[0].locked === true, 'Locked');
  bx = await box(); const before = JSON.parse(await vser()).layers[1].items[0];
  await p.mouse.move(bx[0] + bx[2] / 2, bx[1] + bx[3] / 2); await p.mouse.down(); await p.mouse.move(bx[0] + bx[2] / 2 + 80, bx[1] + bx[3] / 2, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(150);
  ok(JSON.parse(await vser()).layers[1].items[0].x === before.x, 'a locked picture doesn’t move');
  // unlock via layers panel
  await p.click('[data-act="layers"]'); await p.waitForTimeout(250);
  await p.click('.vec-layerpanel [data-vn-lock]:not([data-vn-lock^="L"])'); await p.waitForTimeout(150);
  ok(JSON.parse(await vser()).layers[1].items[0].locked === false, 'unlocked from Vector Layers');
  await p.click('.vec-layerpanel [data-vn-eye]:not([data-vn-eye^="L"])'); await p.waitForTimeout(150);
  ok(JSON.parse(await vser()).layers[1].items[0].visible === false && (await p.$eval('.vec-art use', e => e.parentNode.getAttribute('display'))) === 'none', 'hidden from Vector Layers');
  await p.click('.vec-layerpanel [data-vn-eye]:not([data-vn-eye^="L"])'); await p.waitForTimeout(150);
  await p.click('[data-vl-act="add"]'); await p.waitForTimeout(150);
  ok(JSON.parse(await vser()).layers.length === 3, 'new vector layer');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok(await p.$eval('.vec-layerpanel', e => e.hidden), 'Esc closes Vector Layers');
  // keys: paint's letters don't change the paint tool here
  const ptool = await p.$eval('.paint-stage', e => e.dataset.tool);
  await p.keyboard.press('b'); await p.keyboard.press('h'); await p.waitForTimeout(100);
  ok((await p.$eval('.paint-stage', e => e.dataset.tool)) === ptool, 'paint keys don’t reach the painting (' + ptool + ')');
  ok((await p.$eval('[data-vtool="hand"]', e => e.getAttribute('aria-pressed')).catch(() => null)) === 'true', 'H picks the Hand');
  await p.keyboard.press('v'); await p.waitForTimeout(100);
  // place a picture by Open
  const fi = await p.$('.paint-open input'); await fi.setInputFiles(L.fixture('red.png')); await p.waitForTimeout(700);
  ok((await nObj()) === 2, 'Open with a picture in Vector: placed as an object');
  // save menu has SVG in vector
  await p.evaluate(() => document.querySelector('[data-act="save"]').click()); await p.waitForTimeout(200);
  ok(await p.$eval('[data-save="svg"]', e => !e.hidden && e.offsetParent !== null), 'Save offers SVG in Vector');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-save="svg"]')]);
  const svgText = fs.readFileSync(await dl.path(), 'utf8');
  ok(/<svg[^>]+width="\d+"/.test(svgText) && (svgText.match(/<image/g) || []).length === 2, 'SVG export has both pictures');
  // 4. vector -> paint, bring
  const vBefore = await vser();
  await p.click('[data-mode="paint"]'); await p.waitForTimeout(300);
  ok(!!(await sheet()), 'Vector has art: the dialog asks going back too');
  const nL = await layerNames();
  await p.click('[data-vm="bring"]'); await p.waitForTimeout(800);
  ok((await mode()) === 'paint' && (await layerNames()) === nL + 1, 'Bring to Paint: a new paint layer');
  const lname = await p.evaluate(() => { const r = document.querySelector('.paint-layers canvas:last-child'); return r && r.getAttribute('aria-label'); });
  ok((await vser()) === vBefore, 'the vector artwork is untouched by the transfer');
  // the red ellipse placed in the middle should be on the new layer
  const red = await p.evaluate(() => { const cs = document.querySelectorAll('.paint-layers canvas'); const c = cs[cs.length - 1]; const d = c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data; return Array.from(d); });
  ok(red[0] > 180 && red[1] < 90 && red[3] > 200, 'the new layer has the vector art (red in the middle: ' + red + ')');
  const corner = await p.evaluate(() => { const cs = document.querySelectorAll('.paint-layers canvas'); const c = cs[cs.length - 1]; return c.getContext('2d').getImageData(2, c.height - 3, 1, 1).data[3]; });
  ok(corner === 0, 'see-through where there’s nothing');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  ok((await layerNames()) === nL, 'paint undo takes the brought layer away');
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(200);
  ok((await layerNames()) === nL + 1, 'paint redo brings it back');
  // switching back and forth without bringing doesn't duplicate
  await p.click('[data-mode="vector"]'); await p.waitForTimeout(300); await p.click('[data-vm="switch"]'); await p.waitForTimeout(300);
  ok((await nObj()) === 2, 'no duplicates in Vector without Bring');
  await p.click('[data-mode="paint"]'); await p.waitForTimeout(300); await p.click('[data-vm="switch"]'); await p.waitForTimeout(400);
  ok((await layerNames()) === nL + 1, 'no duplicates in Paint without Bring');
  // 5. persistence across reload
  await p.click('[data-mode="vector"]'); await p.waitForTimeout(300); await p.click('[data-vm="switch"]'); await p.waitForTimeout(400);
  const vKeep = JSON.parse(await vser()); const hKeep = await paintHash();
  await p.waitForTimeout(2200);
  await p.reload(); await p.waitForTimeout(2000);
  ok((await mode()) === 'vector', 'reopened in Vector, as left');
  const vNow = JSON.parse(await vser());
  const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, q) => (o[q] = x[q], o), {}) : x);
  { const a = canon(vKeep.layers), b = canon(vNow.layers); for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { console.log('DIFF', a.slice(i - 60, i + 60), '\n   ', b.slice(i - 60, i + 60)); break; } }
  ok(canon(vNow.layers) === canon(vKeep.layers) && Math.abs(vNow.view.k - vKeep.view.k) < 1e-6, 'vector layers, objects and view back exactly');
  ok((await nObj()) === 2, 'objects drawn after reopening');
  await p.click('[data-mode="paint"]'); await p.waitForTimeout(300); await p.click('[data-vm="switch"]'); await p.waitForTimeout(400);
  ok((await paintHash()) === hKeep, 'painting back exactly after reopening');
  // 6. Don't ask again, and Settings
  await p.click('[data-mode="vector"]'); await p.waitForTimeout(300);
  await p.check('[data-vm-ask]'); await p.click('[data-vm="switch"]'); await p.waitForTimeout(300);
  await p.click('[data-mode="paint"]'); await p.waitForTimeout(300);
  ok(!(await sheet()) && (await mode()) === 'paint' && (await layerNames()) === nL + 1, 'Don’t ask again: switches with no copy');
  await p.evaluate(() => { document.documentElement.classList.add('hdr-open'); }); await p.evaluate(() => document.querySelector('[data-hb="settings"]').click()); await p.waitForTimeout(200);
  ok((await p.$eval('[data-setting="modeask"]', e => e.getAttribute('aria-checked'))) === 'false', 'Settings shows asking off');
  await p.click('[data-setting="modeask"]'); await p.waitForTimeout(200);
  await p.click('[data-mode="vector"]'); await p.waitForTimeout(300);
  ok(!!(await sheet()), 'turned back on in Settings: asks again');
  await p.click('[data-vm="cancel"]'); await p.waitForTimeout(300);
  // 7. project file
  await p.evaluate(() => document.querySelector('[data-act="save"]').click()); await p.waitForTimeout(200);
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('[data-save="project"]')]);
  const proj = JSON.parse(fs.readFileSync(await dl2.path(), 'utf8'));
  ok(proj.vector && proj.vector.layers.length === vKeep.layers.length && proj.mode === 'paint', 'project file keeps the vector side and the mode');
  fs.writeFileSync(D + 'proj.paint', JSON.stringify(proj));
  // 8. New picture: vector starts blank; gallery brings both back
  await p.evaluate(() => document.querySelector('[data-hb="new"]').click()); await p.waitForTimeout(300);
  await p.click('[data-ns-act="create"]'); await p.waitForTimeout(1200);
  ok((await vser()) === 'null', 'New Picture: no vector artwork yet');
  await p.click('[data-mode="vector"]'); await p.waitForTimeout(400);
  ok((await mode()) === 'vector' && (await nObj()) === 0, 'and Vector opens blank');
  await p.click('[data-mode="paint"]'); await p.waitForTimeout(300);
  const fi2 = await p.$('.paint-open input'); await fi2.setInputFiles(D + 'proj.paint'); await p.waitForTimeout(1500);
  ok(JSON.parse(await vser()).layers.length === vKeep.layers.length, 'opening the project brings its vector side back');
  console.log('errors', errs);
  console.log(fails ? fails + ' FAILED' : 'ALL OK');
  await b.close();
})();
