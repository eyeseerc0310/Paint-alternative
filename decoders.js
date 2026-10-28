// THE DECODERS, for the photos a browser can't open by itself: RAW (DNG,
// CR2, CR3, NEF, ARW, RAF, ORF, RW2 ...: LibRaw, built for the web, in its
// own worker), TIFF (UTIF, with pako for its zip compression) and HEIC/HEIF
// (libheif, where the browser has no HEIC of its own: Safari has). They're
// in vendor/, with their licences, and each is fetched only the first time
// its kind of file is opened. TIFF and HEIC are worked in a worker of their
// own too, so a big file never holds up the page. Each gives a canvas, its
// size and (RAW) what the camera says: { el, w, h, meta }.
(function () {
  'use strict';
  var V = 'vendor/';
  var RAW_EXT = /\.(dng|cr2|cr3|crw|nef|nrw|arw|srf|sr2|raf|orf|rw2|pef|srw|3fr|iiq|erf|kdc|dcr|mos|mrw|x3f|rwl)$/i;
  function kind(file) {
    var n = (file && file.name || '').toLowerCase(), t = (file && file.type || '').toLowerCase();
    if (RAW_EXT.test(n) || /image\/x-(adobe-dng|canon|nikon|sony|fuji|olympus|panasonic|pentax|samsung)/.test(t)) return 'raw';
    if (/\.tiff?$/.test(n) || t === 'image/tiff') return 'tiff';
    if (/\.(heic|heif)$/.test(n) || /image\/hei[cf]/.test(t)) return 'heic';
    return null;
  }
  var ext = function (file) { return ((file && file.name || '').split('.').pop() || '').toUpperCase(); };
  function bytes(file) { return file.arrayBuffer ? file.arrayBuffer() : new Response(file).arrayBuffer(); }
  function canvasOf(w, h, rgba) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').putImageData(new ImageData(rgba instanceof Uint8ClampedArray ? rgba : new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, w * h * 4), w, h), 0, 0);
    return c;
  }
  var abs = function (p) { return new URL(p, document.baseURI).href; };

  // ---- RAW: LibRaw develops it (the camera's white balance, sRGB with
  // its own curve, AHD demosaicing; brightness as LibRaw judges it, as most
  // raw viewers do), then it's a canvas like any photo ----
  var RAW_SET = { useCameraWb: true, outputColor: 1, outputBps: 8, userQual: 3, gamm: new Float64Array([1 / 2.4, 12.92, 0, 0, 0, 0]) };
  var LibRaw = null;
  function raw(file) {
    var R = null;
    var lib = LibRaw || (LibRaw = import(abs(V + 'libraw/index.js')).then(function (m) { return m.default; }, function (x) { LibRaw = null; throw x; }));
    return Promise.all([lib, bytes(file)]).then(function (q) {
      R = new q[0]();
      var set = {}; for (var k in RAW_SET) set[k] = RAW_SET[k] instanceof Float64Array ? new Float64Array(RAW_SET[k]) : RAW_SET[k]; // (a fresh copy: what's sent is handed over)
      return R.open(new Uint8Array(q[1]), set).then(function () { return R.metadata(); }).then(function (meta) {
        return R.imageData().then(function (im) { return { meta: meta, im: im }; });
      });
    }).then(function (r) {
      var im = r.im, w = im.width, h = im.height, n = im.colors || 3, src = im.data, out = new Uint8ClampedArray(w * h * 4);
      if (!w || !h || !src) throw new Error('empty');
      for (var i = 0, j = 0, e = w * h; i < e; i++, j += n) {
        var o = i * 4;
        out[o] = src[j]; out[o + 1] = n > 1 ? src[j + 1] : src[j]; out[o + 2] = n > 2 ? src[j + 2] : src[j]; out[o + 3] = 255;
      }
      var m = r.meta || {};
      return { el: canvasOf(w, h, out), w: w, h: h, meta: { make: m.camera_make || '', model: m.camera_model || '', iso: m.iso_speed || 0, shutter: m.shutter || 0, aperture: m.aperture || 0, focal: m.focal_len || 0, time: m.timestamp ? +m.timestamp : 0 } };
    }).then(function (res) { if (R) R.dispose(); return res; }, function (x) {
      if (R) R.dispose();
      throw new Error(/load|import|fetch|module/i.test(x && x.message || '') ? 'The RAW decoder couldn’t be loaded: connect once to the internet and try again' : 'That ' + (ext(file) || 'RAW') + ' file couldn’t be developed: its camera may not be known to the decoder yet');
    });
  }

  // ---- TIFF and HEIC: in a worker of their own, sent the file's bytes,
  // giving back the pixels (the largest picture in a TIFF; HEIC's main one,
  // turned as it says) ----
  var W = null, jobs = {}, nextId = 1;
  function worker() {
    if (W) return W;
    var code = 'var loaded = {};\n' +
      'function need(u) { if (!loaded[u]) { importScripts(u); loaded[u] = 1; } }\n' +
      'self.onmessage = function (e) {\n' +
      '  var d = e.data, done = function (w, h, px) { self.postMessage({ id: d.id, w: w, h: h, px: px }, [px.buffer]); }, fail = function (x) { self.postMessage({ id: d.id, error: String(x && x.message || x) }); };\n' +
      '  try {\n' +
      '    if (d.kind === "tiff") {\n' +
      '      need(d.urls.pako); need(d.urls.utif);\n' +
      '      var ifds = UTIF.decode(d.buf), best = null;\n' +
      '      ifds.forEach(function (f) { var w = f.t256 && f.t256[0], h = f.t257 && f.t257[0]; if (w && h && (!best || w * h > best.w * best.h)) best = { f: f, w: w, h: h }; });\n' +
      '      if (!best) throw new Error("no picture");\n' +
      '      UTIF.decodeImage(d.buf, best.f, ifds);\n' +
      '      var rgba = UTIF.toRGBA8(best.f);\n' +
      '      done(best.f.width, best.f.height, new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.length));\n' +
      '    } else {\n' +
      '      need(d.urls.heif);\n' +
      '      Promise.resolve(typeof libheif === "function" ? (self.heifLib = self.heifLib || libheif()) : libheif).then(function (lib) {\n' +
      '        var dec = new lib.HeifDecoder(), imgs = dec.decode(new Uint8Array(d.buf));\n' +
      '        if (!imgs || !imgs.length) throw new Error("no picture");\n' +
      '        var im = imgs[0], w = im.get_width(), h = im.get_height();\n' +
      '        im.display({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }, function (out) {\n' +
      '          imgs.forEach(function (q) { if (q.free) q.free(); });\n' +
      '          if (!out) fail(new Error("decode")); else done(w, h, out.data);\n' +
      '        });\n' +
      '      }).catch(fail);\n' +
      '    }\n' +
      '  } catch (x) { fail(x); }\n' +
      '};\n';
    W = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
    W.onmessage = function (e) { var j = jobs[e.data.id]; if (!j) return; delete jobs[e.data.id]; if (e.data.error) j.no(new Error(e.data.error)); else j.ok(e.data); };
    W.onerror = function (e) { e.preventDefault(); for (var id in jobs) jobs[id].no(new Error('load')); jobs = {}; W.terminate(); W = null; };
    return W;
  }
  function inWorker(k, file) {
    return bytes(file).then(function (buf) {
      return new Promise(function (ok, no) {
        var id = nextId++; jobs[id] = { ok: ok, no: no };
        worker().postMessage({ id: id, kind: k, buf: buf, urls: { pako: abs(V + 'pako/pako_inflate.min.js'), utif: abs(V + 'utif/UTIF.js'), heif: abs(V + 'libheif/libheif-bundle.js') } }, [buf]);
      });
    }).then(function (r) { return { el: canvasOf(r.w, r.h, r.px), w: r.w, h: r.h }; });
  }
  function tiff(file) {
    return inWorker('tiff', file).catch(function (x) { throw new Error(/load|importScripts|NetworkError/i.test(x.message) ? 'The TIFF decoder couldn’t be loaded: connect once to the internet and try again' : 'That TIFF couldn’t be opened'); });
  }
  // (HEIC: the browser's own decoder first, where it has one, then libheif)
  function heic(file) {
    var own = window.createImageBitmap ? createImageBitmap(file, { imageOrientation: 'from-image' }) : Promise.reject(new Error('none'));
    return own.then(function (bm) { return { el: bm, w: bm.width, h: bm.height }; }, function () {
      return inWorker('heic', file).catch(function (x) { throw new Error(/load|importScripts|NetworkError/i.test(x.message) ? 'The HEIC decoder couldn’t be loaded: connect once to the internet and try again' : 'That HEIC photo couldn’t be opened'); });
    });
  }
  function decode(file) { var k = kind(file); return k === 'raw' ? raw(file) : k === 'tiff' ? tiff(file) : k === 'heic' ? heic(file) : Promise.reject(new Error('not a kind these decode')); }

  window.PaintDecoders = { kind: kind, decode: decode, raw: raw, tiff: tiff, heic: heic };
})();
