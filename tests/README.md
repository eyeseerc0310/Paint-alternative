# Tests

The app is tested in a real browser with [Playwright](https://playwright.dev)'s
Chromium. Nothing here is part of the app: `index.html` never loads it.

## Running them

You need Node and Playwright (`npm i -g playwright && npx playwright install chromium`,
or a copy found by `require('playwright')`), Python 3 (it serves the app) and git.

```
tests/run.sh                    # everything (about 25 minutes)
tests/run.sh brushes            # the bristle brushes
tests/run.sh selection          # selecting: layers, undo and redo, Shift to add
tests/run.sh text               # the text tool: its settings, the highlight, the box
tests/run.sh effects            # Effects: Content-Aware Scale, the selection kept
tests/run.sh photo              # Photo mode: sliders, presets, compare, saving, keeping
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
- `selection/selection.js`: selecting. Making, replacing and letting go of a
  selection are undone and redone exactly, never changing the picture;
  Shift adds box, cutout, circle and wand parts (outlined separately, joined
  where they overlap, painted and moved as one, the last one taken away by
  undo); switching layers keeps the selection and selects nothing new (each
  selection tool and Move); a moved selection's outline goes back with undo;
  Shift still makes a circle round. Run at desktop size in light and iPad size
  in dark.
- `text/text.js`: the text tool. With words being typed and some of their
  letters highlighted, every setting in its panel (the style buttons,
  alignment, the sliders dragged or tapped, the size typed, a font from the
  list, the fills, a colour from the picker) changes them at once, leaves them
  open with the same letters highlighted and gives the focus back, and the
  dashed box stays round them as they grow; the picture never slides as they
  run past its edge; a tap on the picture lays them down as a layer, a tap on
  them opens them again with their look. `safari` acts as Safari (and so the
  iPad) does: a pressed button or slider takes no focus, and a press nothing
  stopped clears the highlight. Run with a mouse and by touch, at desktop,
  iPad and phone sizes, light and dark.
- `effects/cas.js`: Content-Aware Scale, in Effects, on `fixtures/scene.png` (a
  red circle and a blue square on a grainy sky). Greyed out without a
  selection; with one, a live look while the slider moves and the full size
  once it's let go of; the circle keeps its width as the selection narrows
  and widens while the sky gives way; what the selection no longer covers is
  see-through; outside the selection nothing changes; 100% puts the pixels
  back exactly; the same width gives the same result, and quick changes end
  on the last; Done is one undo step, redo puts it back; a circle selection
  works the same; Esc takes it all back; and the selection stays through
  every Effects slider. `gpu`/`cpu` pick the graphics chip or the worker for
  the other effects; `touch` and `safari` as in the text tool's.
- `photo/photo.js`: Photo mode, from Settings, on `fixtures/scene.png`. Formats it
  can't open (a RAW file, a HEIC in Chromium) say so; a photo with nothing set
  saves exactly as it came; every slider changes it as one undo step and, put
  back (a double-click on its name), gives the very same screen again, and the
  ones that shape another (vignette's midpoint, grain's size, sharpening's
  radius, detail and masking) change it too; the colour mixer, colour grading
  and the tone curve; half the detail while a slider moves, sharp once let go
  of; undo and redo; pressed and held (or \\ held), the photo as it came; the 15
  presets' thumbnails, trying one after another never adding up, Cancel, Done
  as one step; JPEG, PNG, WebP and TIFF at full and another size, a JPEG's EXIF
  kept and set upright; zoom, fit, a drag or a pinch; a reload and a project
  file keep it all; and the edited photo brought across to Paint on a layer.
  `touch` drives it by finger.
- `photo/geometry.js`: Photo mode's Optics & Geometry and Crop & Straighten.
  Each lens and perspective slider changes the photo as one step and, put
  back, gives the very same screen; the crop shows the whole frame; a square
  stays square while a corner is dragged, by mouse or finger, the opposite
  corner held; dragged by its inside it stops at the frame's edge; Free moves
  one side; the saved photo is the crop's size; undo takes a drag back;
  straightening leaves no corner empty; a quarter turn swaps the sides; flips
  and turns undo each other exactly; saving and loading keep it all; Reset
  and Done.
- `photo/masks.js`: Photo mode's masks. A linear mask drawn by a drag darkens
  the top and leaves the bottom alone; a radial one takes the colour out
  inside it and not outside, and inverted the other way round; a brush stroke
  (mouse or finger) is kept as its points, brightens where it went, and the
  eraser takes it back; undo and redo all the way give the very same photo;
  hidden, the masks change nothing; saved and loaded they come back the same;
  four at most; Done clears their lines.
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
