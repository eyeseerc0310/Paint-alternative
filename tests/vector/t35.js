// stage 3: Typography (Text, Area Text, Text on Path, Vertical Text, Character Editing, Convert to Outlines)
const { setup, ok, done } = require('./vt.js'); const G = require('./geo.js');
(async () => {
  const H = await setup(); const p = H.p;
  await H.vector();
  const clear = async () => { await p.keyboard.press('Escape'); await H.tool('select'); await p.keyboard.press('Control+a'); await p.keyboard.press('Delete'); await p.waitForTimeout(60); };
  const hist = async () => p.evaluate(() => !document.querySelector('[data-act="undo"]').disabled);
  // point text
  await H.tool('text'); await H.click(100, 200);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('vec-textin')), 'text: the typing box has the focus');
  await p.keyboard.type('Hello world'); await p.waitForTimeout(80);
  let L = await H.leaves(); ok(L.length === 1 && L[0].type === 'text' && L[0].txt === 'Hello world', 'text: typed into a new text object');
  ok(await p.$$eval('.vec-art text', t => t.map(x => x.textContent).join('')) === 'Helloworld', 'text: drawn as SVG text (spaces between)');
  ok(!!(await p.$('.vs-caret')), 'text: a caret shows');
  await p.keyboard.press('Escape'); await p.waitForTimeout(60);
  ok((await H.sel()).length === 1 && L[0].name !== '' && (await H.leaves())[0].name === 'Hello world', 'text: Esc finishes and picks it, named by its words');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(60);
  ok((await H.leaves()).length === 0, 'text: one undo takes the whole new text away');
  await p.keyboard.press('Control+y'); await p.waitForTimeout(60);
  // empty text leaves nothing
  await H.tool('text'); await H.click(300, 400); await p.keyboard.press('Escape'); await p.waitForTimeout(60);
  ok((await H.leaves()).length === 1, 'text: a tap and nothing typed leaves nothing');
  // edit: click in the text puts the caret there
  await H.tool('text'); const at = await p.evaluate(() => { const t = document.querySelector('.vec-art text'); const b = t.getBoundingClientRect(); return [b.left + 2, b.top + b.height / 2]; });
  await p.mouse.click(...at); await p.keyboard.type('X'); await p.keyboard.press('Escape'); await p.waitForTimeout(60);
  L = await H.leaves(); ok(L[0].txt === 'XHello world', 'text: typing at the start of existing words: ' + L[0].txt);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(60); L = await H.leaves(); ok(L[0].txt === 'Hello world', 'text: an edit is one undo step');
  // double-click with Selection edits
  await H.tool("select"); await p.mouse.dblclick(at[0] + 30, at[1]); await p.waitForTimeout(80);
  ok(await p.evaluate(() => document.activeElement.classList.contains('vec-textin')), 'selection: double-click on words edits them');
  await p.keyboard.press('End'); await p.keyboard.type('!'); await p.keyboard.press('Escape');
  L = await H.leaves(); ok(L[0].txt === 'Hello world!', 'text: End then typing adds at the end');
  // panel: size and font
  await H.tool('select'); await H.click(150, 190);
  await p.fill('[data-vk="tx.size"]', '72'); await p.press('[data-vk="tx.size"]', 'Enter'); await p.waitForTimeout(60);
  L = await H.leaves(); ok(L[0].size === 72, 'panel: font size');
  const fonts = await p.$$eval('[data-vk="tx.font"] option', o => o.map(x => x.value));
  ok(fonts.length > 30, 'panel: the font list (' + fonts.length + ')');
  await p.selectOption('[data-vk="tx.font"]', fonts[1]); await p.waitForTimeout(60);
  L = await H.leaves(); ok(L[0].font === fonts[1], 'panel: font picked');
  // scale with the corner: size grows
  const b0 = await p.evaluate(() => window.PaintVector.serialize().layers[0].items[0].size);
  await H.tool('scale'); await p.fill('[data-vk="T.scale.u"]', '200'); await p.press('[data-vk="T.scale.u"]', 'Enter'); await p.click('[data-va="xscale"]'); await p.waitForTimeout(60);
  L = await H.leaves(); ok(Math.abs(L[0].size - b0 * 2) < 0.01 && !L[0].mt, 'scale 200%: point text takes double the size, no matrix');
  await H.tool('rotate'); await p.fill('[data-vk="T.rotate.a"]', '30'); await p.press('[data-vk="T.rotate.a"]', 'Enter'); await p.click('[data-va="xrot"]'); await p.waitForTimeout(60);
  L = await H.leaves(); ok(L[0].mt && L[0].mt.length === 6, 'rotate: text keeps a matrix');
  ok(!!(await p.$('.vec-art g[transform^="matrix"] text')), 'rotate: drawn turned');
  await clear();
  // area text: a box wraps
  await H.tool('text'); await H.drag([100, 100], [300, 400]);
  await p.keyboard.type('the quick brown fox jumps over the lazy dog again and again'); await p.waitForTimeout(80);
  L = await H.leaves(); ok(L[0].kind === 'area', 'drag: area text');
  const ys = await p.evaluate(() => { const t = document.querySelector('.vec-art text'); return [...new Set(t.getAttribute('y').split(' '))].length; });
  ok(ys >= 3, 'area text wraps onto ' + ys + ' lines');
  await p.keyboard.press('Escape'); await clear();
  // area text inside an ellipse
  await H.tool('ellipse'); await H.drag([100, 100], [400, 400]);
  await H.tool('areatext'); await H.click(250, 250); await p.keyboard.type('inside a circle of words, going round'); await p.keyboard.press('Escape'); await p.waitForTimeout(60);
  L = await H.leaves(); ok(L.length === 1 && L[0].type === 'text' && L[0].kind === 'area' && L[0].area[0].pts.length === 4, 'area text: the ellipse becomes its shape');
  await clear();
  // text on a path
  await H.tool('arc'); await H.drag([100, 400], [500, 150]);
  await H.tool('ptext'); const pt0 = await p.evaluate(() => { const s = window.PaintVector.serialize(), n = s.layers[0].items[0], q = n.d[0].pts[0]; return [q.x, q.y]; });
  await H.click(pt0[0] + 0.5, pt0[1]); await p.keyboard.type('along the arc'); await p.keyboard.press('Escape'); await p.waitForTimeout(60);
  L = await H.leaves(); ok(L.length === 1 && L[0].kind === 'path' && L[0].txt === 'along the arc', 'text on a path made from the arc');
  ok(await p.evaluate(() => !!document.querySelector('.vec-art text[rotate]')), 'text on a path: letters turned along it');
  const s1 = await H.ser(); await p.evaluate(s => window.PaintVector.load(s), s1); L = await H.leaves();
  ok(L[0].kind === 'path' && L[0].pd.length === 1, 'text on a path: kept on load');
  await clear();
  // vertical
  await H.tool('vtext'); await H.click(300, 100); await p.keyboard.type('ABC'); await p.keyboard.press('Escape'); await p.waitForTimeout(60);
  const v = await p.evaluate(() => { const t = document.querySelector('.vec-art text'); return [t.getAttribute('x').split(' ').map(Number), t.getAttribute('y').split(' ').map(Number)]; });
  ok(v[1][0] < v[1][1] && v[1][1] < v[1][2] && Math.abs(v[0][0] + 0) > 0, 'vertical text: letters one under another');
  await clear();
  // character editing
  await H.tool('text'); await H.click(100, 300); await p.keyboard.type('Wave'); await p.keyboard.press('Escape');
  await H.tool('chedit');
  const g1 = await p.evaluate(() => { const t = document.querySelector('.vec-art text'), xs = t.getAttribute('x').split(' ').map(Number), y = +t.getAttribute('y').split(' ')[0]; return [xs[1] + 4, y - 8]; });
  await H.drag(g1, [g1[0], g1[1] - 30], 6);
  L = await H.leaves(); ok(L[0].ch && L[0].ch[1] && Math.abs(L[0].ch[1].dy + 30) < 1, 'character editing: one letter lifted ' + JSON.stringify(L[0].ch));
  await p.fill('[data-vk="chr"]', '25'); await p.press('[data-vk="chr"]', 'Enter'); await p.waitForTimeout(60);
  L = await H.leaves(); ok(L[0].ch[1].r === 25, 'character editing: turned in the panel');
  // typing before it keeps it on the same letter
  await H.tool('text'); await H.click(100, 300); await p.keyboard.press('Home'); await p.keyboard.type('>'); await p.keyboard.press('Escape');
  L = await H.leaves(); ok(L[0].txt === '>Wave' && L[0].ch[2] && !L[0].ch[1], 'character editing: the letter keeps its look as words are typed before it');
  // outlines
  await H.tool('select'); await H.click(110, 290); await p.keyboard.press('Control+Shift+O'); await p.waitForTimeout(400);
  const s2 = await H.ser(), g = s2.layers[0].items[0];
  ok(g.type === 'group' && g.items.length === 5 && g.items.every(n => n.type === 'path' && Math.abs(G.area(n.d)) > 20), 'outlines: a group of five letter paths');
  ok(g.items.some(n => n.d.length >= 2), 'outlines: letters keep their holes (' + g.items.map(n => n.d.length).join(',') + ')');
  await clear();
  // raster draws text
  await H.tool('text'); await H.click(100, 300); await p.keyboard.type('III'); await p.keyboard.press('Escape');
  const dark = await p.evaluate(async () => { const s = window.PaintVector.serialize(), c = await window.PaintVector.raster(Math.round(s.w), Math.round(s.h), true), x = c.getContext('2d'), d = x.getImageData(90, 240, 120, 80).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 100) n++; return n; });
  ok(dark > 200, 'raster: the words are drawn (' + dark + ' dark pixels)');
  ok(!H.errs.length, 'no errors ' + H.errs.slice(0, 3).join(' | '));
  await p.screenshot({ path: 'type.png' });
  done(); await H.b.close();
})();
