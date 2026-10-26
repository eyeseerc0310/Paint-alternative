const V = require('./vt.js'), D = '';
(async () => {
  const H = await V.setup(), p = H.p, ok = V.ok;
  await H.vector();
  const get = async (id) => (await H.leaves()).find(n => n.id === id);
  const top = (n, k) => { for (let i = n.app.length - 1; i >= 0; i--) if (n.app[i].k === k) return n.app[i]; return null; };
  await H.tool('rect'); await H.drag([100, 100], [300, 250]);
  let L = await H.leaves(); const rid = L[0].id;
  await H.tool('select'); await H.click(200, 175);
  // BOTTOM BAR: the fill opens the picker as Fill; a hex sets it
  await p.click('.paint-current'); await p.waitForTimeout(300);
  ok(await p.$eval('.paint-colorpanel', e => !e.hidden), 'Fill opens the colour picker');
  ok(await p.$eval('[data-pc-which="main"] span', e => e.textContent) === 'Fill' && await p.$eval('[data-pc-which="second"] span', e => e.textContent) === 'Stroke', 'its tabs say Fill and Stroke');
  await p.click('[data-pc-mode="hex"]').catch(() => {});
  await p.fill('[data-pcv="hex"]', '#d6332f'); await p.waitForTimeout(150);
  let r = await get(rid); ok(top(r, 'f').p.c === '#d6332f', 'the picker sets the fill (' + JSON.stringify(top(r, 'f').p) + ')');
  ok((await H.ser()).def.app.find(i => i.k === 'f').p.c === '#d6332f', 'and new objects take it too');
  ok(await p.$eval('.paint-current span', e => getComputedStyle(e).backgroundColor) === 'rgb(214, 51, 47)', 'the bottom bar shows the fill');
  await p.click('[data-pc-which="second"]'); await p.waitForTimeout(100);
  await p.fill('[data-pcv="hex"]', '#2f7fd6'); await p.waitForTimeout(150);
  r = await get(rid); ok(top(r, 's').p.c === '#2f7fd6', 'the Stroke tab sets the stroke');
  await p.click('.pc-none'); await p.waitForTimeout(100);
  r = await get(rid); ok(top(r, 's').p === null, 'None: no stroke');
  ok(await p.$eval('.paint-second span', e => e.classList.contains('v-none')), 'shown as none in the bottom bar');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  // swap, undo
  await p.click('.paint-swap'); await p.waitForTimeout(100);
  r = await get(rid); ok(top(r, 'f').p === null && top(r, 's').p.c === '#d6332f', 'Swap: the fill and stroke trade');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  r = await get(rid); ok(top(r, 'f').p.c === '#d6332f', 'undo the swap');
  // stroke width & opacity sliders in the bottom bar
  await p.click('.paint-swap'); await p.waitForTimeout(80); await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  await p.evaluate(() => { const i = document.querySelector('.paint-size'); i.value = 500; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  r = await get(rid); ok(top(r, 's').w === 25, 'the Stroke slider sets the width (' + top(r, 's').w + ')');
  ok(await p.$eval('.pb-size span', e => e.textContent) === 'Stroke', 'its name is Stroke');
  await p.evaluate(() => { const i = document.querySelector('.paint-alpha'); i.value = 40; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  r = await get(rid); ok(r.opacity === 0.4, 'the Opacity slider sets the opacity');
  // QUICK OPTIONS
  await p.click('.paint-settings-toggle'); await p.waitForTimeout(150);
  const items = await p.$$eval('.vec-quick [data-vq]', l => l.map(b => b.dataset.vq));
  ok(items.includes('dup') && items.includes('del') && items.includes('panel'), 'quick options for what’s picked: ' + items.join(','));
  await p.click('.vec-quick [data-vq="dup"]'); await p.waitForTimeout(100);
  ok((await H.leaves()).length === 2, 'Duplicate from quick options');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  await H.click(200, 175);
  // GRADIENT tool: tap, then drag direction
  await H.tool('gradient'); await H.click(200, 175);
  r = await get(rid); ok(top(r, 'f').p.t === 'l', 'Gradient: a tap gives it a gradient fill');
  await H.drag([120, 175], [280, 175]);
  r = await get(rid); const g = top(r, 'f').p; ok(Math.abs(g.x1 - 0.1) < 0.02 && Math.abs(g.x2 - 0.9) < 0.02, 'a drag points it (' + g.x1.toFixed(2) + '→' + g.x2.toFixed(2) + ')');
  ok(await p.$$eval('.vec-art linearGradient', l => l.length) === 1, 'drawn with an SVG gradient');
  await p.click('[data-vk="gkind"][data-val="r"]'); await p.waitForTimeout(80);
  r = await get(rid); ok(top(r, 'f').p.t === 'r', 'Radial');
  const nst = top(r, 'f').p.st.length;
  const gb = await p.$eval('[data-vgbar]', e => { const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  await p.mouse.click(...gb); await p.waitForTimeout(150);
  r = await get(rid); ok(top(r, 'f').p.st.length === nst + 1, 'a tap on the stops bar adds a stop');
  await p.keyboard.press('Escape');
  await p.click('[data-va="gsolid"]'); await p.waitForTimeout(80);
  r = await get(rid); ok(top(r, 'f').p.t === 'c', 'Solid Color: back to one colour');
  // EYEDROPPER: copies the look
  await H.tool('ellipse'); await H.click(600, 175);
  L = await H.leaves(); const eid = L[L.length - 1].id;
  await H.tool('select'); await H.click(600, 175);
  await H.tool('eyedropper'); await H.click(200, 175);
  let e = await get(eid); r = await get(rid);
  ok(JSON.stringify(e.app) === JSON.stringify(r.app) && e.opacity === r.opacity, 'Eyedropper: the ellipse takes the rectangle’s look');
  // SOLID FILL tool
  await p.evaluate(() => window.PaintVector.pcSet('main', '#3fa34d'));
  await H.tool('solid'); await H.click(200, 175);
  r = await get(rid); ok(top(r, 'f').p.c === '#3fa34d', 'Solid Fill: tap fills with the fill colour');
  // VECTOR FILL: four lines closing an area
  await p.evaluate(() => window.PaintVector.pcSet('main', '#f5d33a'));
  await H.tool('line'); await H.drag([700, 400], [900, 400]); await H.drag([900, 380], [900, 600]); await H.drag([920, 600], [700, 600]); await H.drag([700, 620], [700, 380]);
  const nb = (await H.leaves()).length;
  await H.tool('vfill'); await H.click(800, 500);
  L = await H.leaves(); ok(L.length === nb + 1, 'Vector Fill: a new shape fills the area the lines close in');
  const fl = L.find(n => n.name === 'Fill');
  if (fl) { const xs = fl.d[0].pts.map(q => q.x), ys = fl.d[0].pts.map(q => q.y); ok(Math.abs(Math.min(...xs) - 712) < 3 && Math.abs(Math.max(...xs) - 888) < 3 && Math.abs(Math.max(...ys) - 588) < 3, 'its edges follow the lines (' + [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map(Math.round) + ')'); ok(top(fl, 'f').p.c === '#f5d33a', 'in the fill colour'); }
  await H.click(1100, 700); ok((await H.leaves()).length === nb + 1, 'outside any closed area: nothing');
  // VARIABLE WIDTH on the top line
  await H.tool('vwidth'); await H.drag([800, 400], [800, 420]);
  L = await H.leaves(); const vl = L.find(n => n.live && n.live.k === 'line' && Math.abs(n.live.y1 - 400) < 1);
  ok(vl && top(vl, 's').prof && top(vl, 's').prof.length === 3, 'Variable Width: a width point added');
  ok(vl && top(vl, 's').prof[1].w > 1.5, 'and wider there (' + (vl && top(vl, 's').prof[1].w.toFixed(1)) + 'x)');
  // PROFILES, CAPS, DASHES on the left line
  await H.tool('select'); await H.click(700, 500);
  const lid = (await H.ser()).sel[0];
  await H.tool('sprofile'); await p.click('[data-vprof="both"]'); await p.waitForTimeout(80);
  let ll = await get(lid); ok(JSON.stringify(top(ll, 's').prof) === JSON.stringify([{ t: 0, w: 0 }, { t: 0.5, w: 1 }, { t: 1, w: 0 }]), 'Stroke Profiles: Taper Both');
  await H.tool('capjoin'); await p.click('[data-vk="cap"][data-val="round"]'); await p.click('[data-vk="join"][data-val="bevel"]'); await p.waitForTimeout(80);
  ll = await get(lid); ok(top(ll, 's').cap === 'round' && top(ll, 's').join === 'bevel', 'Caps & Joins');
  await H.tool('dash'); await p.click('[data-va="dashp1"]'); await p.waitForTimeout(80);
  ll = await get(lid); ok(top(ll, 's').dash && top(ll, 's').dash.length === 2, 'Dashed Strokes');
  // FILLS & STROKES
  await H.tool('appear'); await p.click('[data-va="astroke"]'); await p.waitForTimeout(80);
  ll = await get(lid); ok(ll.app.filter(i => i.k === 's').length === 2, 'Fills & Strokes: a second stroke');
  ok(await p.$$eval('.vec-arow', l => l.length) === 3, 'three rows in the list');
  // OPACITY / BLEND
  await H.tool('blend'); await p.click('[data-vk="blend"][data-val="multiply"]'); await p.waitForTimeout(80);
  ll = await get(lid); ok(ll.blend === 'multiply', 'Blend Modes: multiply');
  await H.tool('opacity'); await p.evaluate(() => { const i = document.querySelector('[data-vk="fop"]'); i.value = 50; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  ll = await get(lid); ok(top(ll, 'f').o === 0.5, 'Fill Opacity');
  // SWATCHES
  await H.tool('swatches'); await p.click('[data-va="swadd"]'); await p.waitForTimeout(80);
  ok((await H.ser()).sw.length === 1, 'Swatches: the colour added');
  await H.click(200, 175);
  await p.click('.vec-swatches [data-vsw-c]:not([data-vsw-c="none"])'); await p.waitForTimeout(80);
  // COLOR PICKER tool
  await H.tool('cpick'); await p.fill('[data-vk="cp.hex"]', '#7b4bc9'); await p.press('[data-vk="cp.hex"]', 'Enter'); await p.waitForTimeout(100);
  r = await get(rid); ok(top(r, 'f').p.c === '#7b4bc9', 'Color Picker: hex sets the fill');
  await p.evaluate(() => { const i = document.querySelector('[data-vk="cp.b"]'); i.value = 50; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  r = await get(rid); ok(top(r, 'f').p.c !== '#7b4bc9', 'brightness changes it (' + top(r, 'f').p.c + ')');
  // WAND: pick the alike
  await H.tool('wand'); await H.click(700, 500);
  const ws = (await H.ser()).sel.length; ok(ws >= 2, 'Magic Wand picks the alike (' + ws + ')');
  await p.screenshot({ path: D + 't23.png' });
  console.log('errors', H.errs); V.done(); await H.b.close();
})();
