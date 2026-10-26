const V = require('./vt.js');
(async () => {
  const H = await V.setup(); const p = H.p;
  await H.vector();
  let s = await H.ser(); const A0 = s.boards[0];
  V.ok(s.boards.length === 1 && s.ab === A0.id, 'one board ' + JSON.stringify(A0));
  await H.tool('rect'); await H.drag([100, 100], [300, 250]);
  // Artboard tool: drag on the pasteboard right of the board for a new one
  await H.tool('artboard');
  const zoomOut = async () => { await p.click('[data-zoom="out"]'); await p.waitForTimeout(80); };
  await zoomOut(); await zoomOut();
  await H.drag([A0.w + 100, 0], [A0.w + 500, 300]);
  s = await H.ser();
  V.ok(s.boards.length === 2 && s.ab === s.boards[1].id, 'drag made board 2 active');
  const b2 = s.boards[1]; V.ok(Math.abs(b2.w - 400) < 2 && Math.abs(b2.h - 300) < 2 && Math.abs(b2.x - (A0.w + 100)) < 2, 'board 2 rect ' + JSON.stringify(b2));
  // tap board 1 makes it active
  await H.click(50, 50); s = await H.ser(); V.ok(s.ab === A0.id, 'tap picks board 1');
  // drag board 1 moves it and its art (Move Artwork on)
  const r0 = (await H.leaves())[0]; const x0 = r0.d[0].pts[0].x;
  await H.drag([600, 500], [650, 520]);
  s = await H.ser(); const r1 = (await H.leaves())[0];
  V.ok(Math.abs(s.boards[0].x - 50) < 1.5 && Math.abs(s.boards[0].y - 20) < 1.5, 'board moved ' + s.boards[0].x + ',' + s.boards[0].y);
  V.ok(Math.abs(r1.d[0].pts[0].x - x0 - (s.boards[0].x - A0.x)) < 0.01, 'art moved with board');
  await p.keyboard.press('Control+z'); s = await H.ser(); V.ok(s.boards[0].x === A0.x, 'undo board move');
  // resize by handle: se corner
  await H.drag([A0.w, A0.h], [A0.w - 100, A0.h - 50]);
  s = await H.ser(); V.ok(Math.abs(s.boards[0].w - (A0.w - 100)) < 1.5 && Math.abs(s.boards[0].h - (A0.h - 50)) < 1.5, 'resized ' + s.boards[0].w + 'x' + s.boards[0].h);
  // settings panel fields
  await H.tool('abset');
  await p.fill('[data-vk="abname"]', 'Cover'); await p.press('[data-vk="abname"]', 'Enter'); await p.waitForTimeout(100);
  await p.fill('[data-vk="abw"]', '800'); await p.press('[data-vk="abw"]', 'Enter'); await p.waitForTimeout(100);
  s = await H.ser(); V.ok(s.boards[0].name === 'Cover' && s.boards[0].w === 800, 'name+width ' + s.boards[0].name + ' ' + s.boards[0].w);
  await p.click('[data-vk="abbg"][data-val="clear"]'); s = await H.ser(); V.ok(s.boards[0].clear === 1, 'transparent bg');
  V.ok(await p.$eval('.vec-board', b => b.classList.contains('clear')), 'checkerboard class');
  // export uses active board size and is see-through
  const ex = await p.evaluate(async () => { const b = await window.PaintVector.exportBlob('png'); const im = await createImageBitmap(b); const c = new OffscreenCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0); return [im.width, im.height, x.getImageData(5, im.height - 5, 1, 1).data[3]]; });
  V.ok(ex[0] === 800 && ex[2] === 0, 'export ' + ex);
  // duplicate
  await H.tool('abdup'); s = await H.ser(); V.ok(s.boards.length === 3 && s.boards[1].name === 'Cover copy', 'duplicated ' + s.boards.map(b => b.name));
  const lv = await H.leaves(); V.ok(lv.length === 2, 'art duplicated: ' + lv.length);
  // rearrange: in a row
  await H.tool('abarr'); await p.selectOption('[data-vk="T.abarr.layout"]', 'col'); await p.waitForTimeout(80);
  await p.click('[data-va="abarrgo"]'); s = await H.ser();
  V.ok(s.boards.every((b, i) => !i || Math.abs(b.x - s.boards[0].x) < 0.01 && b.y > s.boards[i - 1].y), 'column layout');
  // reorder down
  const firstId = s.boards[0].id; await p.click('[data-va="abdn-' + firstId + '"]'); s = await H.ser(); V.ok(s.boards[1].id === firstId, 'reordered');
  // create artboard by tap with preset
  await H.tool('abnew'); await p.selectOption('[data-vk="abpreset"]', '1080x1920'); await p.waitForTimeout(60);
  await p.click('[data-va="abadd"]'); s = await H.ser(); const nb = s.boards[s.boards.length - 1];
  V.ok(s.boards.length === 4 && nb.w === 1080 && nb.h === 1920, 'add preset ' + JSON.stringify(nb));
  // delete via key
  await H.tool('artboard'); await p.keyboard.press('Delete'); s = await H.ser(); V.ok(s.boards.length === 3, 'deleted');
  // resize tool fit to artwork
  await p.click('[data-vcat="boards"]'); await H.tool('abresize');
  // roundtrip
  const before = await H.ser();
  await p.evaluate(d => window.PaintVector.load(d), before); const after = await H.ser();
  V.ok(JSON.stringify(after.boards) === JSON.stringify(before.boards) && after.ab === before.ab, 'roundtrip boards');
  // old (v2) file without boards
  await p.evaluate(d => { delete d.boards; delete d.ab; window.PaintVector.load(d); }, before); const old = await H.ser();
  V.ok(old.boards.length === 1 && old.boards[0].w === before.w, 'v2 load ' + JSON.stringify(old.boards));
  await p.screenshot({ path: 't42.png' });
  V.ok(!H.errs.length, 'no errors ' + H.errs.join('\n'));
  V.done(); await H.b.close();
})();
