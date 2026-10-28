const V = require('./vt.js');
(async () => {
  for (const [vp, name] of [[{ width: 1400, height: 900 }, 'desk'], [{ width: 375, height: 812 }, 'phone']]) {
    const H = await V.setup({ viewport: vp, hasTouch: name === 'phone', isMobile: name === 'phone' }), p = H.p, ok = V.ok;
    ok(await p.$eval('.mode-switch', e => e.hidden && e.offsetParent === null), name + ': switch hidden');
    // (Settings stays open in the panel after a pick that changes nothing, so open it only when it isn't)
    const openSettings = async () => { if (await p.$('.paint-docpanel:not([hidden]) [data-setting="paint"]')) return; await p.evaluate(() => document.querySelector('[data-hb="settings"]').click()); await p.waitForTimeout(150); };
    await openSettings();
    ok(await p.$eval('[data-setting="vector"]', b => b.getAttribute('aria-checked') === 'false' && /Vector mode/.test(b.textContent)), name + ': settings item, off');
    await p.keyboard.press('Escape');
    await H.vector();
    ok(await p.evaluate(() => document.documentElement.classList.contains('vector-mode')), name + ': in vector mode');
    ok(await p.$eval('.mode-switch', e => e.hidden), name + ': switch still hidden in vector');
    await H.tool('rect'); const bw = await p.evaluate(() => window.PaintVector.serialize().w); await H.drag([bw * 0.2, 300], [bw * 0.6, 450]);
    await openSettings();
    ok(await p.$eval('[data-setting="vector"]', b => b.getAttribute('aria-checked') === 'true' && b.textContent.includes('✓')), name + ': settings item, on');
    ok(await p.$$eval('[data-setting="paint"], [data-setting="vector"], [data-setting="photo"]', bs => bs.map(b => b.textContent.replace('✓', '').trim()).join('|')) === 'Paint mode|Vector mode|Photo mode', name + ': the three modes, no preview labels');
    ok(await p.$eval('[data-setting="paint"]', b => b.getAttribute('aria-checked') === 'false'), name + ': only the one in use ticked');
    await p.click('[data-setting="vector"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.documentElement.classList.contains('vector-mode')), name + ': the one in use again changes nothing');
    await openSettings();
    await p.click('[data-setting="paint"]'); await p.waitForTimeout(300);
    const sheet = await p.$('.paint-docpanel:not([hidden]) [data-vm="switch"]'); if (sheet) { await sheet.click(); await p.waitForTimeout(300); }
    ok(await p.evaluate(() => !document.documentElement.classList.contains('vector-mode')), name + ': back to paint');
    ok((await p.evaluate(() => window.PaintVector.serialize().layers[0].items.length)) === 1, name + ': vector art kept');
    if (name === 'phone') ok(await p.$eval('.paint-ctx', c => getComputedStyle(c).top) === '6px', 'phone strip at the top: ' + await p.$eval('.paint-ctx', c => getComputedStyle(c).top));
    await p.screenshot({ path: 't46-' + name + '.png' });
    await openSettings(); await p.screenshot({ path: 't46-' + name + '-settings.png' });
    ok(!H.errs.length, name + ': no errors ' + H.errs.join('\n'));
    await H.b.close();
  }
  V.done();
})();
