// SELECTIONS: kept when the layer changes (and nothing selected for you),
// every selection step in the history in order with the painting's (undo and
// redo give back exactly the selection there was, and never change the
// picture), and Shift adding parts that act as one selection.
// node selection.js [light|dark] [width] [height]
const L = require('../lib'), { chromium } = L.use({ swatches: true }), ok = L.ok;
(async () => {
  const scheme = process.argv[2] || 'light', vw = +(process.argv[3] || 1400), vh = +(process.argv[4] || 900), tag = scheme + '-' + vw;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, colorScheme: scheme });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(1300);
  const at = (fx, fy) => p.evaluate(([fx, fy]) => { const w = document.querySelector('.paint-world').getBoundingClientRect(); return [w.left + w.width * fx, w.top + w.height * fy]; }, [fx, fy]);
  const drag = async (a, z, mods = []) => {
    for (const m of mods) await p.keyboard.down(m);
    await p.mouse.move(...await at(...a)); await p.mouse.down(); await p.mouse.move(...await at(...z), { steps: 8 }); await p.mouse.up();
    for (const m of mods) await p.keyboard.up(m);
    await p.waitForTimeout(250);
  };
  const click = async (a, mods = []) => { for (const m of mods) await p.keyboard.down(m); await p.mouse.click(...await at(...a)); for (const m of mods) await p.keyboard.up(m); await p.waitForTimeout(250); };
  const key = async (k) => { await p.keyboard.press(k); await p.waitForTimeout(250); };
  const undo = () => key('Control+z'), redo = () => key('Control+Shift+z');
  // (what shows: the selection panel, and a hash of the outline drawn on the selection's sheet)
  const selShown = () => p.evaluate(() => !document.querySelector('.selection-toolbar').hidden);
  const outline = () => p.evaluate(() => { const c = document.querySelector('.paint-selui'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0, n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) { n++; h = (h * 31 + i) | 0; } return n + ':' + h; });
  // (is the outline drawn near this point of the picture: within a couple of screen pixels)
  const lineAt = (fx, fy) => p.evaluate(([fx, fy]) => { const c = document.querySelector('.paint-selui'), r = c.getBoundingClientRect(), w = document.querySelector('.paint-world').getBoundingClientRect(), k = c.width / r.width; const x = Math.round((w.left + w.width * fx - r.left) * k), y = Math.round((w.top + w.height * fy - r.top) * k); const d = c.getContext('2d').getImageData(x - 2, y - 2, 5, 5).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; }, [fx, fy]);
  const art = () => p.evaluate(() => { let h = 0; document.querySelectorAll('.paint-layers canvas').forEach(cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 0; i < d.length; i += 16) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 3] * 7) | 0; }); return h; });
  // (the paint on the current layer at a point of the picture: is it painted?)
  const painted = (fx, fy) => p.evaluate(([fx, fy]) => { const on = [...document.querySelectorAll('.pl-row')]; const cs = document.querySelectorAll('.paint-layers canvas'); for (const cv of cs) { const d = cv.getContext('2d').getImageData(Math.floor(cv.width * fx), Math.floor(cv.height * fy), 1, 1).data; if (d[3] > 0 && d[0] + d[1] + d[2] < 600) return true; } return false; }, [fx, fy]);
  const histLabels = () => p.evaluate(() => { const b = document.querySelector('[data-hb="history"]'); b.click(); const l = [...document.querySelectorAll('.paint-history [data-hist]')].map(e => e.textContent + (e.classList.contains('on') ? '*' : '')); b.click(); return l; });
  const activeRow = () => p.$$eval('.pl-row', r => r.findIndex(x => x.classList.contains('on')));
  const layersOpen = async () => { if (await p.$eval('.paint-layerpanel', e => e.hidden).catch(() => true)) { await p.click('.pl-layersbtn'); await p.waitForTimeout(300); } };

  // a picture on two layers
  await key('b'); await drag([0.05, 0.1], [0.3, 0.12]);
  await layersOpen(); await p.click('[data-layer-act="add"]'); await p.waitForTimeout(300); await key('Escape');
  await drag([0.85, 0.94], [0.95, 0.95]); // (on the new layer, for the wand)

  // 1. MAKING A SELECTION IS A STEP: undo takes it away, redo brings it back exactly
  await key('m');
  const art0 = await art();
  await drag([0.2, 0.3], [0.4, 0.5]);
  const box1 = await outline();
  ok(await selShown(), tag + ': a box selection shows');
  await undo(); ok(!(await selShown()), tag + ': undo takes the new selection away');
  await redo(); ok(await selShown() && (await outline()) === box1, tag + ': redo brings it back exactly');
  ok((await art()) === art0, tag + ': selecting, undoing and redoing never changed the picture');

  // 2. A NEW ONE REPLACES IT; undo brings the first back, exactly
  await drag([0.5, 0.3], [0.7, 0.5]);
  const box2 = await outline();
  ok(box2 !== box1 && !(await lineAt(0.2, 0.4)), tag + ': a new selection replaces the first');
  await undo(); ok((await outline()) === box1, tag + ': undo brings the first back exactly');
  await redo(); ok((await outline()) === box2, tag + ': redo, the second again');

  // 3. LETTING GO is a step too (Esc, and a click outside)
  await key('Escape'); ok(!(await selShown()), tag + ': Esc lets go of it');
  await undo(); ok((await outline()) === box2, tag + ': undo brings it back');
  await click([0.9, 0.9]); ok(!(await selShown()), tag + ': a click outside lets go of it');
  await undo(); ok((await outline()) === box2, tag + ': undo brings that back too');

  // 4. SHIFT ADDS a part: both outlined, and acting as one selection
  await drag([0.1, 0.3], [0.25, 0.45]);
  const one = await outline();
  await drag([0.5, 0.3], [0.65, 0.45], ['Shift']);
  const two = await outline();
  ok(await lineAt(0.1, 0.375) && await lineAt(0.65, 0.375), tag + ': both parts are outlined');
  ok(!(await lineAt(0.375, 0.375)), tag + ': nothing outlined between them');
  // a big stroke right across: it paints in both parts and not between
  await key('b');
  const artPre = await art();
  await p.evaluate(() => { const i = document.querySelector('.paint-bottom input[type="range"]'); i.value = 700; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await drag([0.05, 0.375], [0.75, 0.38]);
  ok(await painted(0.15, 0.375) && await painted(0.6, 0.375), tag + ': a stroke across paints inside both parts');
  ok(!(await painted(0.375, 0.375)) && !(await painted(0.05, 0.375)), tag + ': and nowhere outside them');
  // undo the stroke: the picture goes back, the selection stays
  await undo(); ok((await art()) === artPre && (await outline()) === two, tag + ': undoing the stroke leaves both parts selected');
  // undo again: only the added part goes
  await undo(); ok((await outline()) === one, tag + ': undo takes away only the part added last');
  ok((await art()) === artPre, tag + ': which leaves the picture as it was');
  await redo(); ok((await outline()) === two, tag + ': redo adds it back');
  await redo(); ok((await art()) !== artPre, tag + ': and redo the stroke');
  await undo();

  // 5. OVERLAPPING parts join: one outline round both, none inside
  await key('m');
  await drag([0.1, 0.6], [0.3, 0.8]);
  await drag([0.2, 0.7], [0.4, 0.9], ['Shift']);
  ok(!(await lineAt(0.3, 0.75)) && !(await lineAt(0.2, 0.7 + 0.05)), tag + ': overlapping parts join, with no outline inside');
  ok(await lineAt(0.1, 0.7) && await lineAt(0.4, 0.8), tag + ': and the outline goes round both');

  // 6. CUTOUT, CIRCLE AND WAND add too, one undo step each
  const before6 = await outline();
  await key('q'); await p.keyboard.down('Shift');
  await p.mouse.move(...await at(0.6, 0.6)); await p.mouse.down();
  for (const q of [[0.75, 0.6], [0.75, 0.75], [0.6, 0.75], [0.6, 0.6]]) await p.mouse.move(...await at(...q), { steps: 5 });
  await p.mouse.up(); await p.keyboard.up('Shift'); await p.waitForTimeout(300);
  ok(await lineAt(0.75, 0.68) && await lineAt(0.1, 0.7), tag + ': a cutout added keeps what was there');
  await key('c'); await drag([0.8, 0.1], [0.9, 0.2], ['Shift']);
  ok(await lineAt(0.85, 0.1) && await lineAt(0.75, 0.68), tag + ': a circle added keeps the rest');
  await key('w'); await click([0.9, 0.945], ['Shift']);
  const after6 = await outline();
  ok(await lineAt(0.85, 0.1) && after6 !== before6, tag + ': a wand area added keeps the rest');
  await undo(); await undo(); await undo();
  ok((await outline()) === before6, tag + ': three undos take the three parts away, in turn');
  await redo(); await redo(); await redo();
  ok((await outline()) === after6, tag + ': and three redos bring them back');

  // 7. SWITCHING LAYERS leaves the selection exactly as it is, selects nothing new
  const keep = await outline(), artK = await art(), act0 = await activeRow();
  await layersOpen();
  const rows = await p.$$('.pl-row'); await rows[act0 === 0 ? 1 : 0].click(); await p.waitForTimeout(400);
  ok((await activeRow()) !== act0, tag + ': a click on another layer makes it the current one');
  ok((await outline()) === keep && await selShown(), tag + ': and leaves the selection exactly as it was');
  ok((await art()) === artK, tag + ': without changing the picture');
  const th = await p.$$('.pl-thumb'); await th[act0].click(); await p.waitForTimeout(400);
  ok((await outline()) === keep, tag + ': a click on a thumbnail too');
  await key('Escape'); await key('Escape');
  // nothing selected, with each selection tool and Move: switching selects nothing
  for (const t of ['m', 'q', 'w', 'v']) {
    await key(t); await layersOpen();
    const r2 = await p.$$('.pl-row'), a2 = await activeRow(); await r2[a2 === 0 ? 1 : 0].click(); await p.waitForTimeout(400);
    ok(!(await selShown()) && (await outline()).startsWith('0:'), tag + ': with ' + t + ' and nothing selected, switching layers selects nothing');
  }
  await key('Escape');

  // 8. A MOVED SELECTION: undo puts it back where it was, outline and all
  await key('m'); await drag([0.6, 0.1], [0.75, 0.25]);
  const at8 = await outline();
  await drag([0.67, 0.17], [0.8, 0.3]);
  ok((await outline()) !== at8, tag + ': dragging inside moves it');
  await key('Enter'); ok(!(await selShown()), tag + ': Commit lays it down and lets go');
  await undo(); ok(await selShown(), tag + ': undo brings the selection back');
  await undo();
  ok((await outline()) === at8, tag + ': and undoing the move puts the outline back where it was');

  // 9. THE HISTORY LIST names the selection steps, in order
  const H = await histLabels();
  ok(H.some(l => /^Select\*?$/.test(l)) && H.some(l => /^Add to Selection/.test(l)) && H.some(l => /^Deselect/.test(l)), tag + ': History lists Select, Add to Selection and Deselect (' + H.slice(-6).join(', ') + ')');

  // 10. SHIFT still makes a circle round, when it isn't adding
  await key('Escape'); await key('c');
  await p.mouse.move(...await at(0.1, 0.1)); await p.mouse.down(); await p.mouse.move(...await at(0.3, 0.15), { steps: 4 });
  await p.keyboard.down('Shift'); await p.mouse.move(...await at(0.3, 0.16), { steps: 2 }); await p.mouse.up(); await p.keyboard.up('Shift'); await p.waitForTimeout(250);
  const ratio = await p.evaluate(() => { const c = document.querySelector('.paint-selui'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return (x1 - x0) / (y1 - y0); });
  ok(Math.abs(ratio - 1) < 0.25, tag + ': Shift while drawing a circle keeps it round (' + ratio.toFixed(2) + ')');

  // 11. MOVING one made of parts moves what's in every part, and undo puts it back
  await key('Escape'); await key('b');
  await p.evaluate(() => { const i = document.querySelector('.paint-bottom input[type="range"]'); i.value = 350; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await drag([0.1, 0.55], [0.9, 0.55]);
  await key('m'); await drag([0.15, 0.5], [0.25, 0.6]); await drag([0.6, 0.5], [0.7, 0.6], ['Shift']);
  const art11 = await art();
  await drag([0.2, 0.555], [0.2, 0.655]); await key('Enter');
  const m11 = [await painted(0.2, 0.65), await painted(0.65, 0.65), await painted(0.65, 0.55), await painted(0.45, 0.55), await painted(0.45, 0.65)];
  ok(m11.join() === 'true,true,false,true,false', tag + ': dragging moves the paint in both parts, and nothing between (' + m11.join() + ')');
  await undo(); await undo();
  ok((await art()) === art11, tag + ': undo puts it back');

  await p.screenshot({ path: 'selection-' + tag + '.png' });
  ok(!errs.length, tag + ': no errors ' + (errs.length ? JSON.stringify(errs) : ''));
  L.done(); await b.close();
})();
