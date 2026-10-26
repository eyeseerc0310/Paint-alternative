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
  console.log('Aa button shown:', !!(await p.$('.paint-textbtn')));
  await p.click('.paint-textbtn'); await p.waitForTimeout(300);
  console.log('panel open:', await p.$eval('.paint-textpanel', e => !e.hidden), 'font shown:', await p.$eval('.tp-font span', e => e.textContent));
  await p.fill('[data-tp="sizen"]', '90');
  await p.click('[data-tpt="bold"]');
  await p.$eval('[data-tp="spacing"]', e => { e.value = 120; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('.paint-swatches button:nth-child(4)');
  // (the test's swatch strip is outside the panel: a press there closes it)
  if (await p.$eval('.paint-textpanel', e => e.hidden)) await p.click('.paint-textbtn');
  await p.click('[data-tpt="shadow"]');
  await p.$eval('[data-tp="outline"]', e => { e.value = 4; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('[data-tpa="fonts"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: 'out/textpanel.png' });
  await p.click('[data-tpa="fonts"]');
  const still = await p.$eval('.paint-text', e => ({ text: e.innerText, font: e.style.fontFamily, size: e.style.fontSize, ls: e.style.letterSpacing, color: e.style.color }));
  console.log('still typing after changes:', JSON.stringify(still));
  // second line, centred
  await p.click('.paint-text'); await p.keyboard.press('End'); await p.keyboard.press('Shift+Enter'); await p.keyboard.type('second line');
  if (await p.$eval('.paint-textpanel', e => e.hidden)) await p.click('.paint-textbtn');
  await p.click('[data-tpal="center"]');
  await p.waitForTimeout(150);
  await p.screenshot({ path: 'out/text-before.png', clip: { x: 140, y: 150, width: 1120, height: 600 } });
  await p.click('[data-tpa="done"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: 'out/text-after.png', clip: { x: 140, y: 150, width: 1120, height: 600 } });
  console.log('text box gone:', !(await p.$('.paint-text')), 'panel hidden:', await p.$eval('.paint-textpanel', e => e.hidden));
  // a quick plain one with a built-in font, then undo
  console.log('errors', errs);
  await b.close();
})();
