// THE LAYOUT LOCK: every element's box that can be seen, the reference (PAINT_REF_URL)
// against this copy (PAINT_URL), in every state layout-steps.js opens, for
// each device and colour scheme asked for (default desk, phone and iPad, light).
// Anything that moved, went missing or turned up is listed; a styling change
// should list nothing.
const L = require('./lib'), { chromium } = L;
const STEPS = require('./layout-steps.js');
const modes = (process.argv[2] || 'desk-light,phone-light,ipad-light').split(','), only = process.argv[3] ? process.argv[3].split(',') : null;
const VP = { desk: [{ width: 1400, height: 900 }, false], phone: [{ width: 390, height: 844 }, true], ipad: [{ width: 1024, height: 768 }, true] };
async function grab(b, base, m, fn) {
  const [dev, scheme] = m.split('-');
  const ctx = await b.newContext({ viewport: VP[dev][0], colorScheme: scheme, hasTouch: VP[dev][1], isMobile: dev === 'phone' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('paint-hdr-open', '1'); } catch (e) {} });
  await p.goto(base + 'index.html'); await p.waitForTimeout(900);
  try { await fn(p); } catch (e) { errs.push('step: ' + e.message.split('\n')[0]); }
  await p.waitForTimeout(800);
  const measure = () => p.evaluate(() => { const out = {}, seen = {}, shows = new Map();
    // (only what can be seen: not hidden, see-through or empty; something that
    // draws nothing itself counts only if something inside it shows)
    const visible = el => {
      if (shows.has(el)) return shows.get(el);
      let v = el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      if (v) {
        const c = getComputedStyle(el), clear = s => !s || s === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(s);
        const own = el instanceof SVGElement || /^(CANVAS|IMG|INPUT|TEXTAREA|SELECT|VIDEO)$/.test(el.tagName) || !clear(c.backgroundColor) || c.backgroundImage !== 'none' || c.boxShadow !== 'none' || parseFloat(c.borderTopWidth) + parseFloat(c.borderLeftWidth) > 0 || [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        v = own || [...el.children].some(visible);
      }
      shows.set(el, v); return v;
    };
    for (const el of document.querySelectorAll('body *')) { if (!visible(el)) continue; if (el.closest('.mode-switch, .vec-stage, .vec-group, .vec-layerpanel, [data-save="svg"], .vec-quick, .pc-which span, .pc-none')) continue; const r = el.getBoundingClientRect(); if (!r.width && !r.height) continue;
      let k = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).filter(c => !/^(on|busy|away|aside|hover|spun|pop-in|in-dock|open|closing)$/.test(c)).join('.') : '') + (el.getAttribute('aria-label') ? '[' + el.getAttribute('aria-label').slice(0, 30) + ']' : '') + (el.getAttribute('data-tool') ? '[' + el.getAttribute('data-tool') + ']' : '');
      seen[k] = (seen[k] || 0) + 1; if (seen[k] > 1) k += '#' + seen[k];
      out[k] = [r.x, r.y, r.width, r.height].map(v => Math.round(v * 4) / 4).join(','); }
    return out; });
  // (until it's still: two readings a moment apart the same, so nothing is caught mid-move)
  let r = await measure();
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(250); const r2 = await measure(); if (JSON.stringify(r2) === JSON.stringify(r)) break; r = r2; }
  await ctx.close(); return [r, errs];
}
// (moved: by more than half a pixel, which is the least that shows; less is
// where an animation happened to come to rest)
const moved = (a, b) => { const x = a.split(',').map(Number), y = b.split(',').map(Number); return x.some((v, i) => Math.abs(v - y[i]) > 0.5); };
(async () => {
  const b = await chromium.launch(); let total = 0, changed = false;
  for (const m of modes) for (const [name, fn] of Object.entries(STEPS)) {
    if (only && !only.includes(name)) continue;
    // (a difference is looked at again, both sides measured afresh: a real one
    // is there every time, one that's only where an animation came to rest isn't)
    const compare = async () => {
      const [A, ea] = await grab(b, L.REF, m, fn), [B, eb] = await grab(b, L.APP, m, fn);
      return { ea, eb, diffs: Object.keys(A).filter(k => k in B && moved(A[k], B[k])).map(k => k.slice(0, 70) + ' ' + A[k] + ' -> ' + B[k]),
        missing: Object.keys(A).filter(k => !(k in B)).length, extra: Object.keys(B).filter(k => !(k in A)).length };
    };
    let c = await compare();
    if (c.diffs.length || c.missing || c.extra) c = await compare();
    const { ea, eb, diffs, missing, extra } = c;
    total += diffs.length; if (missing || extra) changed = true;
    if (diffs.length || missing || extra || eb.length > ea.length) console.log(`${m} ${name}: ${diffs.length} moved, ${missing} missing, ${extra} extra`, eb.length > ea.length ? eb : '', '\n   ' + diffs.slice(0, 400).join('\n   '));
  }
  console.log('TOTAL moved', total); if (total || changed) process.exitCode = 1;
  await b.close();
})();
