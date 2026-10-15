# Paint Alternative: notes for Claude

A browser painting app (plain HTML/CSS/JS, no build step), published with
GitHub Pages from `main`. The app is `index.html`, `style.css` and `paint.js`;
`sw.js`, `manifest.webmanifest` and `icons/` make it installable and offline.

## Design: use one shared design system

The owner wants a **shared design system**, not components styled one by one.
Every new feature must inherit the same colours, spacing, corner radii,
shadows and interaction behaviour automatically.

When building or changing anything visual:

- **Use the shared tokens** (CSS custom properties on `:root` in `style.css`,
  redefined for dark mode under `:root[data-theme="dark"]`). Colours: `--bg`,
  `--desk` (the page's soft gradient behind everything),
  `--text`, `--muted`, `--line`, `--accent`, `--accent-hover`,
  `--accent-soft`, `--hover`, `--hover-strong`, `--selected`, `--outline`,
  `--control` (slider and checkbox colour), `--ok`, `--warn`, `--danger` (deleting for good), `--seg-on` (the picked part of a segmented control), `--focus` (the keyboard's focus ring, blue, never the accent), `--switch-on` (an on switch, green), `--rail` (a slider's track, an off switch), `--chip`, `--chip-text` and
  `--chip-shadow` (the tool in hand), `--well-ring` (the rainbow ring round the
  colour in hand), `--accent-glow` (under a solid accent button), `--scrim`
  (behind a sheet), `--seg-shadow` (the picked part of a segmented control),
  `--stage-dot` (the dots in the picture's well), `--brand` (the
  app icon's blue gradient, also in `icons/icon.svg`), `--hdr-thin` and `--hdr-open`
  (the top bar folded and open; `--hdr` is the one in use, registered so it
  eases), `--panel`, `--panel-solid`,
  `--stage`, `--menu-*` (and `--menu-solid`, the same without the see-through). Shadows: `--shadow-panel`, `--shadow-pop`. Glass:
  `--glass`. Radii: `--r-xs` (menu rows), `--r-sm`, `--r-btn`, `--r-menu` (menus and pop-overs), `--r-panel`, `--r-sheet`, `--r-stage`, `--r-pill` (capsules: the top bar's groups, buttons with words).
  Sizes: `--row` (a menu's row), `--ctl` (a panel's or sheet's button; both taller on a touch screen), `--press` (the pressed shrink).
  Spacing: `--s-1` to `--s-4`. Type: `--fs-xs`, `--fs-sm`, `--fs`, `--fs-title` (every panel's and menu's title), `--fs-head` (a sheet's title); section labels are sentence case, never capitals. Icons:
  `--icon`, `--icon-sm`, `--icon-hdr` (the top bar), `--stroke`. Motion: `--dur`, `--dur-pop` (a menu or panel popping open), `--dur-slow`, `--ease`, `--spring` (a small overshoot, for things that pop open) (reduced motion is honoured for all of them by one rule at the end of `style.css`). Don't hard-code a colour, radius, shadow or spacing value in a
  component. If a value you need doesn't exist yet, add it as a token
  (spacing, radius, type size, motion and so on) so later features can reuse it.
- **Reuse shared component styles** for the same kind of thing (buttons,
  pills, menus and pop-overs, sheets, segmented controls, sliders, rows),
  rather than writing new one-off rules. Give new components the shared
  classes, and add a variant only when something truly differs.
- **Keep interaction behaviour consistent:** the same hover, pressed
  (slight scale), focus, disabled and selected states everywhere. Hover
  styles go inside `@media (hover: hover)`, so a tap on a touch screen
  doesn't leave one behind. The tool in hand (and a pressed button in the
  bars) is a solid neutral chip (`--chip`); picked list items use a neutral
  rounded outline. Neither uses the accent.
  The accent (red) is for primary actions (Save, Done, Create) and the
  chosen colour.
- **Where controls live:** the top bar has the document actions
  (new/open/save/share, image, history, focus, help, theme; on phones
  the extras go in its ••• menu) and the saved-status dot. It starts folded
  to a thin strip (the mark, the dot and the `.hdr-fold` arrow, in the middle), and opens
  downward (`headerOpen`, remembered as `paint-hdr-open`; `hdr-open` on
  `:root`, set before the page draws): `--hdr` eases and the workspace with
  it, never covered, with `refit()` each frame. A button in the folded bar
  can't be seen, so what it opens drops from the arrow (`hdrBtn`). The left
  bar (`.paint-left`) holds the tools in groups. The right bar
  (`.paint-right`) holds colour, then size and opacity for the tool in hand
  (in sections that fold), then undo/redo with Layers under them, then
  zoom. Panels that open from a bar open towards the picture (`besideBar`
  for fixed ones). The picture's space (`.paint-stage`) takes all the rest, and `fitTo` fits the
  picture with the same margin of the dotted well all round. A tool's own
  settings go in the **context bar** (`.paint-ctx`, built per tool by `CTX`
  in `paint.js`), and so do a selection's actions. It stands up at the
  picture's left edge, one setting per row (on/off settings as switches),
  and is a wrapping strip along the top on phones. Its `.ctx-min` button
  folds it down to one button (remembered), which can still be dragged.
  Toolbar icons are 24-unit outline drawings using `--stroke`, with round
  caps and joins; keep new ones in the same style. Put new tool
  settings there, never in a list beside the left toolbar. Symmetry's
  settings open in the panel too (its `sym` view), from the mirror button. Pop-out panels can be dragged with
  `draggable(el, handle, key)`. Give buttons a `data-tip` for their tooltip.
  Controls that sit on the picture must be listed in `STAGE_UI` so pressing
  them doesn't paint.
- **Text layers:** a layer with `L.text` is drawn from its words
  (`renderText`). Anything else that changes its pixels goes through
  `remember()`, which keeps the words for undo and turns the layer into
  paint; brushes, lines, shapes, gradients and the pen paint on a new layer
  above it instead (`paintAbove`). Keep both rules for new tools.
  Fancy words (`T.fill` other than solid, `T.arc`, or `T.path`, a pen path
  from where they start) are laid out letter by letter (`glyphsOf`) and,
  while typed, drawn on the overlay (`textPreview`); keep new text styles
  in `drawText`/`layoutText` so the box, Move and saving all follow.
- **Masks and groups:** a layer's look on screen and when saved comes from
  `viewOf(L)` (its paint, through its mask `L.mask`, through what it's
  clipped to) and `flattenInto` (groups as one). While a mask is picked
  (`L.editMask`), painting tools work on `L.mask.P`, which stands in for the
  layer (`maskIn`/`maskOut`). New layers made next to one join its group
  (`L.group`).
- **Several layers picked:** `also` holds the layers picked alongside
  `active` (a swipe right on a row, Shift- or Ctrl/⌘-click); `picks()` gives
  them all in stack order. A selection or the Move tool lifts every picked
  layer (`liftMany`: each on a sheet just above its own layer, text layers
  moved as words), and the ••• menu and the panel's buttons act on them all
  (`multiOption`). New layer actions should say what they do with several
  picked: act on all of `picks()`, or be greyed out.
- **Brushes:** a brush is an id; `bdef(id)` gives its name, the kind it's
  made from (`base`) and its settings (`BDEF` defaults, changed by the Brush
  Studio, or a brush of your own). Check `baseOf(id)`, never the id, for how
  a brush behaves.
- **Drawings:** the one in hand is the autosave (`docInfo`/`applyInfo`) and
  has a gallery id (`gid`). Before another is opened or started, `archive()`
  keeps it in the gallery, so anything that replaces the whole drawing should
  go through it (as `newPicture` and `openProject` do).
- **Gestures:** touch gestures run the action set for them (`gest`, changed
  in the Touch Gestures sheet) through `gestureDo`; add new actions to
  `GACTS`.
- **Filling:** the fill tool and a colour dropped on the picture both go
  through `fillDrop` (symmetry, masks, undo), which lays the fill down at
  once and shows it spreading on a stand-in canvas (`spread`); anything
  else that happens ends the spread (`endFillAnim`).
- **Pop-overs and sheets:** a drop-down from the top bar closes the others
  (`otherPopovers`); `openSheet` closes everything else, moves the focus in
  and gives it back; `relayout()` keeps everything that floats on the screen
  when the window changes size; Esc closes the top-most thing first.
- **Input:** mouse, finger, Apple Pencil and keyboard share the stage's
  pointer handlers. One finger waits a moment (`touchWait`) before starting
  anything, so a pinch never begins a stroke; once the Pencil has been used
  (`penSeen`) a single finger doesn't paint unless Touch Gestures says so
  (`fingerDraw`), and touches just after the Pencil are ignored as a resting
  hand. The Pencil's eraser end rubs out, its barrel button picks a colour.
  A still click or tap on the empty space around the picture puts the tool
  down (`st.tool` is `'none'`, from `offTap`; a stroke that starts there still
  paints, and an open selection, words or path is dealt with first): no tool
  button is lit, a drag moves the picture, and picking a colour takes up the
  brush. New tools mustn't assume a tool is always in hand.
- **The pen's path** has steps of its own while it's being made
  (`pen.hist`/`pen.fut`, kept with `penRecord`): each point placed, point or
  handle moved, close or Backspace is one step, and undo/redo take those
  first (`penUndo`/`penRedo`). Laying the path down keeps it with its 'Pen'
  undo entry (`e.pen`), so undoing that brings the path back to carry on
  with (`penRestore`). The History list works on the picture's steps only
  (`doUndo(true)`). Text on Path is a mode (`penText`) as well as an action.
- **Selecting:** one button in the left bar (`.paint-selbtn`) is the
  selection tool; its ways are tool ids of their own, `lasso` (Cutout, the
  first time), `select` (box), `circle` and `wand`, picked in its panel
  (`selWays`, `SEL_KINDS`) or by key (Q, M, C, W), and the one last used is
  remembered (`selKind`); the button takes that way's icon (`selBtnSync`).
  A circle is a selection with `sel.poly` (`ovalPoly`), so everything that
  works on a cutout works on it. Use `selTool(t)` to ask "is this
  selecting?", and `setTool(selKind)` to bring the tool up.
- **Transforming a selection:** while something is picked up, each move,
  size, turn or typed size is a step of its own (`sel.hist`/`sel.fut`, kept
  with `selRecord` at the start and `selTrim` at the end of a press), which
  undo and redo take first (`selUndo`/`selRedo`); anything that changes the
  picked-up pixels (a flip) clears them. Corners keep proportions unless
  Keep proportions is off (`keepRatio`, in Scale); Shift does the other.
  **Scale** (`.paint-scale`, `scaleSync` from `drawSel`) shows the size as a
  percentage of `sel.base` and lays a typed size on about the middle
  (`scaleTo`). A picture opened, pasted or dropped comes in selected with the
  Move tool, and what's picked up is the picture at its own size
  (`sel.src`), so sizing it back up loses nothing.
- **Effects run fast three ways**, all from the same settings (`fxParams`):
  the graphics chip (`fxGL*`: WebGL 2, a shader drawing on a stand-in canvas
  in the layer's place, read back once at Done), a worker (`fxWorker`, for
  layers seen through a mask or a clip, no WebGL 2, or software WebGL; live
  at the size the layer is seen at, `fxPrevMake`, then full size once the
  slider rests) and the main thread. The pixel sums live in `fxKernel`
  (which must stand alone: it's copied into the worker) and in `FX_FS`: a
  change to how an effect looks goes in both, and `fxcmp`-style checks
  should show the paths agree. Pixelate (`P.px`) is worked a row of blocks at
  a time in `fxKernel` (block sizes can be fractional, for the worker's
  smaller copy) and by `FX_PS` on the graphics chip (`fxGLPix`, a texel a
  block, kept for each size). **Done** in the panel (`adjustApply`) keeps
  what's set as one step and starts again from the layer as it now is
  (`adjustRebase`), the panel staying open (and through undo and redo with
  nothing set); Done with nothing set, and anything else that ends it,
  closes it (`adjustDone`). Nothing heavy happens on opening
  (`fxPrepare` runs at the first change); the histogram is made when
  Levels or Curves first shows. `paint-fx-gpu` (`on`/`off`) overrides the
  choice, for testing.
- **Opening:** `.app-splash` (in `index.html`) shows the app's mark until
  the drawing is back (`opened()`, called when `restore` is done).
- **Focus mode** animates: `focusMode` measures where the picture's space
  will end up (`.focus-measure`, nothing moving), then the header folds,
  the bars slide off and the stage's size eases there (`.focusing`), with
  `refit(true)` each frame so the picture keeps its zoom and stays centred.
- **Light and dark** fade: the colour tokens are registered with
  `@property`, so `.theme-fading` on `:root` eases them all together (new
  colour tokens must be registered and added to that list); afterwards
  `paint:theme` is sent so anything drawn in the panel's ink is redrawn.
- **The look:** the header has no bar: the app's name, then its buttons in
  frosted capsules (`.hb-group`). The bars, the context bar and every
  pop-over are frosted cards (`--panel`/`--menu-bg`, `--glass`, the shadow
  tokens, which carry a light top edge); the picture sits in a dotted well.
  Pop-overs open with `pd-in`/`pb-in`/`pl-in` on `--dur-pop` and `--spring`;
  sheets rise in over a blurred `--scrim`. Titles use `--display` in bold.
- **Shared looks:** every `input[type="range"]` gets the same thin track
  and white knob (one rule near the top of `style.css`; a slider whose track
  shows what it does sets `--track` and keeps it). A Done inside the tool
  panel is tinted (`--accent-soft` with accent text); Done, Save and Create at
  the foot of a panel or sheet are solid accent.
- **Test in light and dark mode and at phone width** (560px and narrower).
- Much of the existing CSS predates this rule and has repeated values. Don't
  refactor it unless asked. Move things onto shared tokens and styles as you
  touch them, and keep unrelated changes out of a task.
