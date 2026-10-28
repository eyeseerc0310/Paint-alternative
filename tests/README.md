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
tests/run.sh effects            # Content-Aware Scale on the selection's frame, and on a big picture
tests/run.sh photo              # Photo mode: sliders, presets, compare, saving, keeping
tests/run.sh panel              # the top bar's options in the right-hand panel
tests/run.sh polish             # Fit everywhere, panels that stay open, New Layer, the empty workspace, chevrons
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
- `effects/cas.js`: Content-Aware Scale on the selection's frame, on
  `fixtures/scene.png` (a red circle and a blue square on a grainy sky).
  The Effects button is greyed out without a selection; pressed, the mode is
  on (its pill, side handles) and the selection stays; a side dragged in
  shows a quick look while it moves and the full size once let go of, the
  circle and the square keeping their width; dragged back, it's exactly as
  it started; each size is an undo step in the mode; the same size gives the
  same result; Esc, and undo before anything's sized, put the picture back
  exactly; Return lays it down (see-through where it no longer reaches,
  nothing outside the selection changed), one undo step, redo puts it back;
  a corner narrows and shortens it, the circle as wide and as tall; Normal
  Scale goes back to plain sizing; a turned selection works from Transform's
  toggle, in its own frame; a circle selection changes nothing outside the
  circle. `touch` and `safari` as in the text tool's.
- `effects/casbig.js`: Content-Aware Scale on a 2400 x 1600 picture (`huge`:
  4000 x 3000), with a heartbeat on the page's thread: it never stalls while
  the frame is dragged and Commit is pressed at once, three times over (the
  pill says it's finishing, then it's laid down at full quality, the same as
  waiting first); a new layer laying it down puts the quick look down and
  the full size exactly in its place when it comes; undo pressed meanwhile
  waits, then undoes; Esc while Commit waits puts it all back; a worker that
  fails once is asked again, twice puts everything back and says so; never
  more than two of its workers at once (the injected failures and the count
  come from a stand-in `Worker`).
- `photo/photo.js`: Photo mode, from Settings (Paint, Vector and Photo mode,
  the one in use ticked), on `fixtures/scene.png`. Formats it
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
- `photo/maskedit.js`: Photo mode's masks, painted and edited. A first mask, a
  brush, painted with nothing set leaves the photo exactly as it was (it once
  went black: the brush's paint was bound in the tone table's place); Show
  the mask lays the red over the photo; painting is at full detail; a mask's
  slider held hides the red and shows what it does, at half detail, and let
  go of brings both back (or not, with Show the mask off); the size slider
  shows Paint's brush preview at the size it paints, and the ring over the
  photo grows with the zoom; Done keeps every mask; back in Masks each is
  picked from the list or its pin, painted on again and adjusted; undo takes
  back one change.
- `panel/panel.js`: the top bar's panel. Gallery, New Picture, Save, Crop,
  Rotate & Flip, History and Settings each open in it (in the dock, as wide
  as the tool settings, which step aside; beside the left bar on phones),
  never as a drop-down or a sheet, with the picture's space kept its size;
  another option replaces it, the same button, the close button and Esc
  close it; Settings stays open for the theme, Touch Gestures has Back and
  Keyboard Shortcuts' Done goes back; History goes back a step, Rotate Right
  turns the picture, Save downloads, Share still asks the system, New Picture
  makes one, the Gallery shows its drawings; a tool with settings, the
  picker and Effects take its place.
- `polish/polish.js`: the app-wide polish. Fit is in the left bar in Paint,
  Vector (above Layers) and Photo, and fits, as 0 does, after zooming in;
  Crop & Rotate stays open through a turn and the flips, says the new size,
  and follows undo; in Layers, New Layer stays under the pointer as nine
  layers are added, each new one in view, the panel on the screen and off
  the bottom bar, the list keeping where it was scrolled; a tap on the tool
  settings leaves the tool in hand, a still tap on the bare workspace puts
  it down (nothing lit) and a drag there doesn't; in Vector it puts Vector's
  tool down (nothing lit, No Tool, a drag moves round, a tool's key takes one
  up again); in Effects every chevron stands at one edge, turned while its
  section is folded.
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
