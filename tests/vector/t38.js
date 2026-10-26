// an empty new area / path text gives its shape back
const { setup, ok, done } = require('./vt.js');
(async () => {
  const H = await setup(); const p = H.p; await H.vector();
  await H.tool('ellipse'); await H.drag([100, 100], [400, 400]);
  await H.tool('areatext'); await H.click(250, 250); await p.keyboard.press('Escape'); await p.waitForTimeout(60);
  let L = await H.leaves(); ok(L.length === 1 && L[0].type === 'path', 'empty area text: the ellipse is back');
  await H.tool('line'); await H.drag([100, 500], [500, 500]);
  await H.tool('ptext'); await H.click(300, 500); await p.keyboard.press('Escape'); await p.waitForTimeout(60);
  L = await H.leaves(); ok(L.length === 2 && L.every(n => n.type === 'path'), 'empty path text: the line is back');
  await H.tool('text'); await H.click(600, 600); await p.keyboard.press('Escape'); await p.waitForTimeout(60);
  ok((await H.leaves()).length === 2, 'empty point text leaves nothing');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(60);
  ok((await H.leaves()).length === 1, 'and undo takes back the line, not a phantom step');
  ok(!H.errs.length, 'no errors ' + H.errs.join(' | '));
  done(); await H.b.close();
})();
