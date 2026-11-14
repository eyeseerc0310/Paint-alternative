// THE BRUSH STUDIO in the right-hand menu: Edit Brush (the tool settings'
// Brush Settings, data-ctx="bstudio") opens it in the tool settings' own
// place (in the dock; on a phone beside the left bar), as wide, nothing
// floating over the picture; only a press opens it, never picking the brush
// or hovering it; its head has Back to the brush's settings, its foot Reset,
// Save (not Save Copy) and Done; its settings still change the brush.
// node studio.js light|dark width height [touch]
const L = require('../lib'), { chromium } = L.use({}), ok = L.ok;
(async () => {
  const theme = process.argv[2] || 'light', VW = +(process.argv[3] || 1400), VH = +(process.argv[4] || 900), touch = process.argv.includes('touch'), phone = VW <= 560, tag = theme + '-' + VW;
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: VW, height: VH }, colorScheme: theme, hasTouch: touch }); const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForTimeout(1300);
  const box = s => p.evaluate(s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, s);
  const tap = async s => { const r = await box(s); if (touch) await p.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2); else await p.mouse.click(r.x + r.w / 2, r.y + r.h / 2); await p.waitForTimeout(450); };
  const open = () => p.evaluate(() => !document.querySelector('.paint-studio').hidden);
  await p.keyboard.press('b'); await p.waitForTimeout(300);
  if (!touch) { const bb = await box('.paint-left [data-tool="brush"]'); await p.mouse.move(bb.x + bb.w / 2, bb.y + bb.h / 2); await p.waitForTimeout(600); }
  ok(!(await open()), tag + ': the brush picked (and hovered): no Studio');
  if (phone && await p.evaluate(() => document.querySelector('.paint-ctx').classList.contains('min'))) await tap('.paint-settings-toggle');
  const ctx0 = await box('.paint-ctx');
  await tap('[data-ctx="bstudio"]');
  ok(await open(), tag + ': Edit Brush opens the Studio');
  const s = await box('.paint-studio');
  const w = await p.evaluate(() => { const s = document.querySelector('.paint-studio'), c = document.querySelector('.paint-ctx'), st = document.querySelector('.paint-stage').getBoundingClientRect(), r = s.getBoundingClientRect(); return { dock: !!s.closest('.paint-dock'), aside: c.classList.contains('aside'), over: r.left < st.right - 1 && r.right > st.left + 1, btns: [...s.querySelectorAll('.bs-foot button')].map(b => b.textContent.trim()), back: !!s.querySelector('.bs-head .bs-back'), title: s.querySelector('.bs-t').textContent }; });
  if (!phone) {
    ok(w.dock && w.aside && Math.abs(s.x - ctx0.x) < 1 && Math.abs(s.y - ctx0.y) < 1 && Math.abs(s.w - ctx0.w) < 1, tag + ': in the tool settings’ place, as wide, they step aside ' + JSON.stringify({ s, ctx0, w }));
    ok(!w.over, tag + ': nothing over the picture');
  }
  ok(w.back && /Brush Studio/.test(w.title), tag + ': its head: Back, then its title ' + JSON.stringify(w));
  ok(w.btns.join('|') === 'Reset|Save|Done', tag + ': Reset, Save and Done ' + w.btns.join('|'));
  // (a setting still changes the brush)
  const was = await p.evaluate(() => document.querySelector('.paint-studio [data-bs="tin"]').value);
  await p.evaluate(() => { const i = document.querySelector('.paint-studio [data-bs="tin"]'); i.value = 40; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  ok(await p.evaluate(() => { const e = JSON.parse(localStorage.getItem('paint-brush-edits') || '{}'); return Object.values(e).some(v => +v.tin === 40); }), tag + ': Start set to 40 is kept for the brush (was ' + was + ')');
  ok(await p.$eval('.paint-studio [data-bs-act="reset"]', b => !b.disabled), tag + ': Reset can be pressed after a change');
  await tap('.paint-studio [data-bs-act="reset"]');
  // (Back: the brush's settings again, where they were)
  await tap('.paint-studio .bs-back');
  ok(!(await open()) && await p.evaluate(() => !document.querySelector('.paint-ctx').classList.contains('aside')), tag + ': Back: the brush’s own settings again');
  const ctx1 = await box('.paint-ctx'); if (!phone) ok(Math.abs(ctx1.x - ctx0.x) < 1 && Math.abs(ctx1.y - ctx0.y) < 1, tag + ': in the same place');
  // (Save keeps a copy as a brush of your own, the Studio on it)
  await tap('[data-ctx="bstudio"]'); await tap('.paint-studio [data-bs-act="saveas"]');
  ok(await open() && await p.evaluate(() => JSON.parse(localStorage.getItem('paint-my-brushes') || '[]').length === 1), tag + ': Save makes a brush of your own, and the Studio shows it');
  await tap('.paint-studio [data-bs-act="done"]');
  ok(!(await open()), tag + ': Done closes it');
  await p.screenshot({ path: 'studio-' + tag + '.png' });
  ok(!errs.length, tag + ': no errors ' + errs.join(' | '));
  await b.close(); L.done();
})();
