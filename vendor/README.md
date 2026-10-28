# Third-party decoders

What a browser can't open by itself, decoded in the page (see `decoders.js`).
Each is fetched only the first time its kind of file is opened. They're kept
here unchanged, as published; the licence of each sits beside it.

| Folder | What | Version | Source | Licence |
| --- | --- | --- | --- | --- |
| `libraw/` | RAW photos (DNG, CR2, CR3, NEF, ARW, RAF, ORF, RW2 ...): LibRaw 0.22 built for WebAssembly, single-threaded (so it needs no cross-origin isolation, which GitHub Pages can't turn on) | libraw-wasm-nothread 1.6.0-nothread.1 (a fork of ybouane's LibRaw-Wasm) | npm `libraw-wasm-nothread`, `dist/` | the wrapper ISC (`LICENSE`); LibRaw LGPL 2.1 or CDDL 1.0 (`COPYRIGHT`, `LICENSE.LGPL`, `LICENSE.CDDL`); Little CMS 2 MIT |
| `libheif/` | HEIC/HEIF photos, where the browser has no HEIC of its own (Safari has) | libheif-js 1.23.5 (`wasm-bundle`) | npm `libheif-js` | LGPL 3.0 (`LICENSE`) |
| `utif/` | TIFF | UTIF.js 3.1.0 | npm `utif` | MIT (`LICENSE`) |
| `pako/` | the zip compression TIFF uses | pako 2.1.0 (`pako_inflate.min.js`) | npm `pako` | MIT (`LICENSE`) |

LibRaw and libheif are LGPL libraries, loaded as files of their own: any of
them can be swapped for another build of the same library by replacing the
file here. Their source: https://github.com/LibRaw/LibRaw and
https://github.com/strukturag/libheif.

## SHA-256

```
e3a994d82e644b03a792a930f574002658412f62407f5fee083f2555c5f23118  vendor/libheif/LICENSE
074b2b55ef3de477ba9f794ca381f3f0324c1cba8c91b4af07395f39c22d54cc  vendor/libheif/libheif-bundle.js
574c88f5dd59414cfc896293a63defbc2d525a418ed413d7ab7dcc43cf79c509  vendor/libraw/COPYRIGHT
89ed72df6b5aadc6a6db4a0e45dd4e06602c4b56173d299f36064b3d9b2abff2  vendor/libraw/LICENSE
0e3098d2d54a12434715f6679ea408d57da5e8d613c385c58ecc6fe5d30cc81f  vendor/libraw/LICENSE.CDDL
eea173a556abac0370461e57e12aab266894ea6be3874c2be05fd87871f75449  vendor/libraw/LICENSE.LGPL
3eb710aa5473c58c3b9dec74457b2ad2095d15b9a6df0056c96a3a011b720ca6  vendor/libraw/index.js
952ad840b341a420d0433979820917bca3716c3d51eefd091c7a1011c84995f4  vendor/libraw/libraw.wasm
f0bd51a370b6a9bf2b1854bb993b96aaf2c31e0eaef01e6cac043c5b1e35cc57  vendor/libraw/worker.js
a04665b3b2de56c66730c1f720f528175739e4104f79073614aa611da1e85539  vendor/pako/LICENSE
fa226c8e1e3556993260e6a5c1fe94e225da59b3418a06811fdc51d308f8bb43  vendor/pako/pako_inflate.min.js
c1fb8861eca211bf5aea574358aba7039396c0c1824c2a1477cc126d398efd89  vendor/utif/LICENSE
e3e76115f49571e39624c3316a76b3c4c5b2c5ca518dfec4b66a9f7af8c6d059  vendor/utif/UTIF.js
```
