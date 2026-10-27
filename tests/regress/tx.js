const { chromium } = require('../lib').use({ hdrOpen: true, swatches: true });
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(700);
  const at = async (fx, fy) => p.evaluate(([fx, fy]) => { const w = document.querySelector('.paint-world').getBoundingClientRect(); return [w.left + w.width * fx, w.top + w.height * fy]; }, [fx, fy]);
  await p.click('[data-hb="new"]'); await p.click('[data-pre="wide"]'); await p.click('[data-ns-act="create"]'); await p.waitForTimeout(200);
  // the font list on the text tool
  await p.keyboard.press('t'); await p.waitForTimeout(1500); // (a second tap on its button would fold its settings)
  await p.click('[data-ctx="fonts"]'); console.log('fonts in list:', await p.$$eval('.paint-fontmenu [data-pick="font"]', l => l.length), 'headings:', await p.$$eval('.paint-fontmenu .pf-h', l => l.map(h => h.textContent).join(', ')));
  await p.screenshot({ path: 'out/fontmenu.png' });
  await p.click('.paint-fontmenu [data-val*="Pacifico"]');
  // type
  await p.mouse.click(...await at(0.2, 0.3)); await p.waitForTimeout(200);
  await p.keyboard.type('Hello there');
  // (its settings are in the tool's panel: no Aa button, no panel of its own)
  console.log('no Aa button:', !(await p.$('.paint-textbtn')), '| settings in the panel:', !!(await p.$('.paint-ctx [data-ctx="tspacing"]')), '| font shown:', await p.$eval('.paint-ctx [data-ctxfont]', e => e.textContent));
  const set = (k, v) => p.$eval('.paint-ctx [data-ctx="' + k + '"]', (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  await set('tsize', 90);
  await p.click('.paint-ctx [data-ctx-t="bold"]');
  await set('tspacing', 120);
  // (the test's swatch strip isn't the app's: clicked without taking the focus from the words)
  await p.$eval('.paint-swatches button:nth-child(4)', e => e.click());
  await p.click('.paint-ctx [data-ctx-t="shadow"]');
  await set('toutline', 4);
  await p.click('.paint-ctx [data-ctx="fonts"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: 'out/textpanel.png' });
  await p.click('.paint-ctx [data-ctx="fonts"]'); await p.waitForTimeout(100);
  const still = await p.$eval('.paint-text', e => ({ text: e.innerText, font: e.style.fontFamily, size: e.style.fontSize, ls: e.style.letterSpacing, color: e.style.color }));
  console.log('still typing after changes:', JSON.stringify(still));
  // second line, centred
  await p.click('.paint-text'); await p.keyboard.press('End'); await p.keyboard.press('Shift+Enter'); await p.keyboard.type('second line');
  await p.click('.paint-ctx [data-ctx-al="center"]');
  await p.waitForTimeout(150);
  await p.screenshot({ path: 'out/text-before.png', clip: { x: 140, y: 150, width: 1120, height: 600 } });
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await p.screenshot({ path: 'out/text-after.png', clip: { x: 140, y: 150, width: 1120, height: 600 } });
  console.log('text box gone:', !(await p.$('.paint-text')));
  // a quick plain one with a built-in font, then undo
  console.log('errors', errs);
  await b.close();
})();
