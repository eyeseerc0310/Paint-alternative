# Tests

The app is tested in a real browser with [Playwright](https://playwright.dev)'s
Chromium. Nothing here is part of the app: `index.html` never loads it.

## Running them

You need Node and Playwright (`npm i -g playwright && npx playwright install chromium`,
or a copy found by `require('playwright')`), Python 3 (it serves the app) and git.

```
tests/run.sh                    # everything (about 25 minutes)
tests/run.sh brushes            # the bristle brushes
tests/run.sh vector             # Vector mode, or: tests/run.sh vector t32 t44
tests/run.sh regress            # the paint regressions, or: tests/run.sh regress fill pen
tests/run.sh lock               # the layout lock, or: tests/run.sh lock desk-dark,phone-light
REF=abc1234 tests/run.sh regress   # compare with something other than origin/main
```

The runner serves this copy on port 8123 and, for the regressions and the
lock, the reference (`origin/main` unless `REF` says otherwise, taken out with
`git archive` into `tests/.ref`) on 8124. If something else is already on
either port it stops and says so; set `APP_PORT` / `REF_PORT` to use others.
What the tests print and the screenshots they take go in `tests/.out`. It ends
with `all passing`, or lists what isn't, and exits non-zero.

## What's here

- `lib.js`: what every test shares. Its `chromium` opens pages as playwright's
  does, but sends `http://127.0.0.1:8123/…` to `PAINT_URL`, so one test runs on
  either copy. `use({ hdrOpen, swatches, showSwitch })` sets a page up before it
  loads: the top bar open, a hidden strip of colour swatches the regression
  suites click (`[data-color]`), the hidden Paint / Vector switch shown. `ok`,
  `done` and `fixture` are for checks that pass or fail.
- `brushes/bristle.js`: Dry Brush, Flat Bristle and Rough Round paint with pen
  pressure, a mouse and dabs; undo and redo; their Studio sections; a QuickShape
  circle is sized without long stalls and comes out the same let go mid-drag or
  after a rest. Run at desktop size in light and at phone size in dark.
- `vector/`: Vector mode, each file a set of checks ending `ALL OK`, sharing
  `vt.js` (`setup`, which goes into Vector mode through Settings; `tool`, `drag`,
  `at` in the artboard's units, `ser` for the document). `t5`–`t8` switching and
  bringing artwork across, `t21`–`t26` the tools, layers and saving, `t31`–`t38`
  drawing, shape operations, transform, type and arranging, `t41`–`t46`
  artboards, guides and precision, effects, Vector mode living in Settings.
- `regress/`: the paint side, suite by suite (`all` a tour of everything, `fill`,
  `fx` effects, `lay` layers, `pen`, `proj` project files, `sym3` symmetry, `ui5`
  the bars and panels, `touch`, `interact`, `zoom`, `selmodes`, `tx` text, `mv`
  move, `lasso`, `pick` the colour picker, `op` opacity and blending). These
  don't pass or fail by themselves: each prints what it sees, the same suite runs
  on the reference, and any difference is listed. A line that starts with `~`
  varies from run to run (timing, textured brushes) and isn't compared.
- `layout-lock.js` with `layout-steps.js`: every visible element's box in each
  state the steps open (each panel, menu and sheet), reference against this
  copy, for desktop, iPad and phone. A styling change should move nothing.
  Only what can be seen counts (not hidden, see-through or empty), measured
  once the page is still; moving means by more than half a pixel, and anything
  appearing or going counts too. A state that differs is measured again on
  both sides, and only what differs both times is listed, since a panel that
  follows an animation can come to rest a fraction of a pixel apart.
- `fixtures/`: files the tests open.

## Adding a test

A check that should always hold goes in a file of its own that ends with
`L.done()` (see `brushes/bristle.js`), and in `run.sh`'s list for its kind. A
change that ought to leave the paint side looking and working the same is what
the regressions are for; run them, and the lock for anything visual, before
merging.
