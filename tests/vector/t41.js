const V = require('./vt.js');
(async () => {
  const H = await V.setup(); const p = H.p;
  await H.vector();
  const cats = await p.$$eval('[data-vcat]', a => a.map(b => b.dataset.vcat));
  V.ok(cats.join() === 'selection,paths,drawing,shapes,shapeops,transform,type,fill,stroke,effects,arrange,boards,navigation,precision', 'cats ' + cats.join());
  // draw two shapes to have something picked
  await H.tool('rect'); await H.drag([100, 100], [300, 250]);
  await H.tool('ellipse'); await H.drag([400, 300], [600, 500]);
  for (const c of cats) {
    await p.click('[data-vcat="' + c + '"]'); await p.waitForTimeout(80);
    const tools = await p.$$eval('[data-vtool]', a => a.map(b => b.dataset.vtool));
    for (const t of tools) {
      if (['abdup'].includes(t)) continue;
      await p.click('[data-vtool="' + t + '"]'); await p.waitForTimeout(50);
    }
    if (['effects', 'boards', 'precision'].includes(c)) await p.screenshot({ path: 'c-' + c + '.png' });
  }
  const box = await p.$eval('.vec-group', g => { const r = g.getBoundingClientRect(), q = g.parentNode.getBoundingClientRect(); return [r.height, q.height]; });
  console.log('group h / room', box);
  V.ok(!H.errs.length, 'no errors ' + H.errs.join('\n'));
  V.done(); await H.b.close();
})();
