const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
const pre = process.argv[2];
(async () => {
  const b = await chromium.launch();
  for (const dark of [false, true]) {
    const c = await b.newContext({ viewport: { width: 1366, height: 860 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' }); const p = await c.newPage();
    await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForFunction(() => !document.querySelector('.app-splash'), null, { timeout: 10000 });
    if (dark) await p.evaluate(() => document.documentElement.dataset.theme = 'dark');
    await p.waitForTimeout(300);
    const m = dark ? 'D' : 'L';
    await p.screenshot({ path: `shots/${pre}-${m}-z-left.png`, clip: { x: 0, y: 0, width: 360, height: 580 } });
    await p.screenshot({ path: `shots/${pre}-${m}-z-right.png`, clip: { x: 1180, y: 0, width: 186, height: 560 } });
    await p.screenshot({ path: `shots/${pre}-${m}-z-head.png`, clip: { x: 900, y: 0, width: 466, height: 52 } });
    await c.close();
  }
  await b.close();
})();
