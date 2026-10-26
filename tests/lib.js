// What every test shares: the browser, where the app is, and pass/fail.
//
// Tests open the app as http://127.0.0.1:8123/index.html; the browser this
// gives them sends that to PAINT_URL instead, so the runner can point the
// same test at this copy or at the reference (PAINT_REF_URL, what the
// layout lock compares against). Both default to the ports run.sh serves.
const path = require('path');

function playwright() {
  try { return require('playwright'); } catch (e) {}
  const root = require('child_process').execSync('npm root -g').toString().trim();
  return require(path.join(root, 'playwright'));
}
const pw = playwright();
const slash = u => u.replace(/\/?$/, '/');
const APP = slash(process.env.PAINT_URL || 'http://127.0.0.1:8123/');
const REF = slash(process.env.PAINT_REF_URL || 'http://127.0.0.1:8124/');
const NAMED = 'http://127.0.0.1:8123/';

// (what a test can ask for before the page loads: the top bar open, the old
// quick swatches as a hidden strip the regression suites click, the hidden
// Paint / Vector switch shown)
const SETUP = {
  hdrOpen: () => { try { localStorage.setItem('paint-hdr-open', '1'); } catch (e) {} },
  swatches: () => document.addEventListener('DOMContentLoaded', () => {
    const p = document.querySelector('.paint'); if (!p || document.querySelector('.paint-swatches')) return;
    const d = document.createElement('div'); d.className = 'paint-swatches'; d.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;display:flex;';
    ['#141414', '#ffffff', '#8a8a8a', '#d6332f', '#f08a24', '#f5d33a', '#3fa34d', '#2f7fd6', '#7b4bc9', '#e36aa6', '#8b5a2b', '#1f3d5c'].forEach(c => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.color = c; b.style.cssText = 'width:10px;height:10px;padding:0;border:0;background:' + c; d.appendChild(b);
    });
    p.appendChild(d);
  }),
  showSwitch: () => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.mode-switch[hidden]{display:flex !important}'; document.head.appendChild(s); })
};

function wrapPage(page, opts) {
  const goto = page.goto.bind(page);
  page.goto = (url, o) => goto(url.startsWith(NAMED) ? APP + url.slice(NAMED.length) : url, o);
  return page;
}
async function prepare(target, opts) {
  for (const k of Object.keys(SETUP)) if (opts[k]) await target.addInitScript(SETUP[k]);
}
function wrapContext(ctx, opts) {
  const newPage = ctx.newPage.bind(ctx);
  ctx.newPage = async () => wrapPage(await newPage(), opts);
  return ctx;
}
// chromium, as playwright's, with launch() giving a browser whose pages go to PAINT_URL
function use(opts = {}) {
  return {
    chromium: {
      launch: async (o) => {
        const b = await pw.chromium.launch(o);
        const newContext = b.newContext.bind(b), newPage = b.newPage.bind(b);
        b.newContext = async (o2) => { const c = await newContext(o2); await prepare(c, opts); return wrapContext(c, opts); };
        b.newPage = async (o2) => { const p = await newPage(o2); await prepare(p, opts); return wrapPage(p, opts); };
        return b;
      }
    }
  };
}

// pass/fail: each check prints a line; done() says how many failed and sets the exit code
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const done = () => { console.log(fails ? fails + ' FAILED' : 'ALL OK'); if (fails) process.exitCode = 1; };
const fixture = (name) => path.join(__dirname, 'fixtures', name);

module.exports = Object.assign(use(), { use, APP, REF, ok, done, fixture });
