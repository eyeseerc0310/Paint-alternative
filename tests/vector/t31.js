// stage 3 smoke: every category and tool opens without errors; panel shows; quick menu
const { setup, ok, done } = require('./vt.js');
(async () => {
  const H = await setup(); const p = H.p;
  await H.vector();
  const cats = await p.$$eval('[data-vcat]', b => b.map(x => x.dataset.vcat));
  ok(cats.join(',') === 'selection,paths,drawing,shapes,shapeops,transform,type,fill,stroke,effects,arrange,boards,navigation,precision', 'category order ' + cats.join(','));
  // a couple of shapes to have something picked
  await H.tool('rect'); await H.drag([100, 100], [300, 260]); await H.tool('ellipse'); await H.drag([200, 180], [420, 380]);
  for (const c of cats) {
    await p.click('[data-vcat="' + c + '"]'); await p.waitForTimeout(80);
    const tools = await p.$$eval('.vec-tool', b => b.map(x => x.dataset.vtool));
    for (const t of tools) {
      if (/^(union|minus|intersect|exclude|divide|compound|clipmask|outlines|fwd|back|front|backmost|groupun|fit|actual|abdup)$/.test(t)) continue;
      await p.click('[data-vtool="' + t + '"]'); await p.waitForTimeout(50);
      const pressed = await p.$eval('[data-vtool="' + t + '"]', b => b.getAttribute('aria-pressed'));
      if (pressed !== 'true') ok(false, 'tool ' + t + ' pressed');
      await p.mouse.move(700, 450); await p.mouse.move(720, 470); await p.waitForTimeout(20);
    }
  }
  ok(!H.errs.length, 'no errors walking every tool ' + H.errs.slice(0, 3).join(' | '));
  await p.screenshot({ path: 'smoke.png' });
  // quick options
  await H.tool('select'); await p.keyboard.press('Control+a'); await p.waitForTimeout(80);
  await p.click('.paint-settings-toggle'); await p.waitForTimeout(150);
  const q = await p.$$eval('.vec-quick [data-vq]', b => b.map(x => x.dataset.vq));
  ok(q.indexOf('union') >= 0 && q.indexOf('clipmask') >= 0 && q.indexOf('compound') >= 0, 'quick menu has shape ops: ' + q.join(','));
  await p.keyboard.press('Escape');
  ok(!H.errs.length, 'no errors ' + H.errs.slice(0, 3).join(' | '));
  done(); await H.b.close();
})();
