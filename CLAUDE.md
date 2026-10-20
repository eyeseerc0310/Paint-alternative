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
  eases), `--snap` (Smart Guides' lines), `--grid-line` (the grid's) and `--edit`
  with `--edit-edge` (a gradient's line and handles; all drawn on the picture,
  so the same in both themes), `--check` (with `--paper`, a see-through
  checkerboard, the same wherever one shows), `--knob-fill` (a slider's or
  switch's knob), `--on-accent` (text on a solid accent button), `--swatch-edge`
  (the hairline round a colour sample), `--panel`, `--panel-solid`,
  `--stage`, `--menu-*` (and `--menu-solid`, the same without the see-through). Shadows: `--shadow-panel`, `--shadow-pop`, `--shadow-float` (a small control standing on the picture). Glass:
  `--glass`. Radii: `--r-2xs` (small controls inside a row or panel: fields, tabs, chips), `--r-xs` (menu rows), `--r-sm`, `--r-btn`, `--r-menu` (menus and pop-overs), `--r-panel`, `--r-dock` (what stands in the dock), `--r-sheet`, `--r-stage`, `--r-pill` (capsules: the top bar's groups, buttons with words).
  Sizes: `--row` (a menu's row), `--ctl` (a panel's or sheet's button; both taller on a touch screen), `--press` (the pressed shrink, for every button), `--press-row` (the same for a full-width row).
  States: `--disabled` (how faint anything greyed out is, once: a group that's
  greyed out doesn't grey its parts again), `--ring-picked` (the active layer's
  outline while others are picked with it, and a picked thumbnail), `--ring-focus` (a focused field; elsewhere
  the shared `:focus-visible` outline), `--seg-on` with `--seg-shadow` (the
  picked part of a segmented control, in both themes).
  Spacing: `--s-1` to `--s-4`. Type: `--fs-xs`, `--fs-sm`, `--fs-ui` (buttons with words, rows, fields), `--fs`, `--fs-title` (every panel's and menu's title), `--fs-head` (a sheet's title); section labels are sentence case, never capitals. Icons:
  `--icon`, `--icon-sm`, `--icon-hdr` (the top bar), `--stroke`, `--chev-down` (a drop-down field's chevron; every `select` uses it), `--stroke-xs` (a 12px glyph: a
  list's chevron, a close X, the fold arrow, so it isn't drawn thinner than the
  rest; icons ≥14px keep `--stroke`). Motion: `--dur-fast` (a knob or swatch answering a touch), `--dur`, `--dur-pop` (a menu or panel popping open), `--dur-slow`, `--ease`, `--spring` (a small overshoot, for things that pop open) (reduced motion is honoured for all of them by one rule at the end of `style.css`). Don't hard-code a colour, radius, shadow or spacing value in a
  component. If a value you need doesn't exist yet, add it as a token
  (spacing, radius, type size, motion and so on) so later features can reuse it.
- **Reuse shared component styles** for the same kind of thing (buttons,
  pills, menus and pop-overs, sheets, segmented controls, sliders, rows),
  rather than writing new one-off rules. Give new components the shared
  classes, and add a variant only when something truly differs.
- **Keep interaction behaviour consistent:** the same hover, pressed
  (slight scale), focus, disabled and selected states everywhere. Hover
  styles go inside `@media (hover: hover)`, so a tap on a touch screen
  doesn't leave one behind. Anything picked (the tool in hand, a pressed
  button, a picked brush, font, shape, layer, history step or preset) is the
  same solid neutral chip (`--chip`, no outline), so the brush list, the bars
  and the menus all read alike; hover is the lighter `--hover`, so a picked
  row stays distinct while hovered. Only a picked part of a segmented control
  differs (`--seg-on` thumb), and the active layer keeps an outline
  (`--ring-picked`) only while other layers are picked with it. Full-width
  rows press by `--press-row`, other buttons by `--press`; a row's keyboard
  ring sits just inside it. Neither picked nor hover uses the accent.
  The accent (red) is for primary actions (Save, Done, Create) and the
  chosen colour.
- **Where controls live:** the top bar has the document actions
  (new/open/save/share, image, history, Smart Guides, focus, help, theme; on phones
  the extras go in its ••• menu). It starts folded to a slim strip (the
  `.hdr-fold` arrow, in the middle; no app name or mark, only a hidden
  heading for screen readers), and opens
  downward (`headerOpen`, remembered as `paint-hdr-open`; `hdr-open` on
  `:root`, set before the page draws): `--hdr` eases and the workspace with
  it, never covered, with `refit()` each frame. A button in the folded bar
  can't be seen, so what it opens drops from the arrow (`hdrBtn`). The left
  bar (`.paint-left`), its middle level with the picture's space's
  (`safe center` above the bottom bar, `--bbar-gap`; at the top if it's too
  tall for that), holds the tools in groups (there's no Hand button:
  the picture moves with Space, two fingers, the middle button, scrolling,
  H, or a drag with the tool put down). The Shapes button keeps its own icon
  whichever kind is picked; Select sits beside Pen; at its foot are Layers
  (`.pl-layersbtn`) and the zoom (`.paint-zoom`). The saved-status pill
  (`.doc-status`) sits in the corner under it, centred on the bar, level
  with the bottom bar's middle (hidden in focus mode). The **bottom bar**
  (`.paint-bottom`, `bbar`, under the picture in `.paint-centre`, a glass pill
  like the top bar's capsules) holds, in this order, Size, Undo, the two
  colours (`.paint-pair`, the swap tucked at their top), Redo and Opacity;
  a slider the tool doesn't use is greyed out (`data-uses`). On wider
  screens the colour picker and Effects open from the tool settings, as wide
  as them, over them, and they step aside (`dockPanels`, `in-dock`,
  `ctxAside`; the picker's wheel is sized to fit, `discSize`): locked, in
  the dock's place; unlocked, where the settings were moved to, kept within
  the workspace (`dockPlace`, worked out from the layout as they pop in).
  The picker there has the tool settings' top (`.pc-top`): the same lock
  (`lockToggle`, either one), a grip to move it by while unlocked (the tool
  settings move with it, `paint-pos-ctx2`), and a fold button that closes it
  and folds the tool settings.
  On those screens the dock is above the bars (z-index 6). On phones the
  picker opens above the bottom bar, its middle over the two colours
  (`placePicker`), and Effects beside the left bar. There's no right bar,
  and no quick swatches: the picker has the palettes and recent colours, as
  round swatches that can be dragged onto the picture to fill, like the two
  colours (`colourDrag`). Other panels that open from the left bar open
  towards the picture (`besideBar`). The picture's space (`.paint-stage`) takes all the
  rest, and `fitTo` fits the picture with the same margin of the dotted well
  all round. A tool's own settings go in the **context bar** (`.paint-ctx`,
  built per tool by `CTX` in `paint.js`), and so do a selection's actions.
  A tool with nothing to set (Fill, the colour picker, Move) has no `CTX`
  entry: picking it hides the panel without folding it (the dock keeps its
  room, so nothing moves; the bottom bar's settings toggle greys out), and
  the next tool's settings come back (`bare` in `chooseTool`).
  It stands in **the dock** (`.paint-dock`, at the workspace's right, as wide
  as it, `--ctx-w`; `dock-on` on `.paint`), one setting per row (on/off
  settings as switches), so it never covers the picture, while it's
  **locked** (`ctxLocked`, its `.ctx-lock` button, remembered; locked, it
  can't be dragged). Folded (its `.ctx-min` button, remembered) the dock
  eases shut and the picture's space grows into it (`dockSync`,
  `refitWhile`); unlocked, it floats where it's dragged and the dock stays
  shut; locking puts it back in its place, opened out if it
  was folded. Locked (not on phones) it doesn't fade while the picture is
  worked on (`busy`) or a selection sized or turned (`away`). It's kept within the workspace
  (`ctxBox`). On phones it's a wrapping strip along the
  top of the picture (the dock takes no room there). Its lists open on the
  side towards the picture's middle.
  Toolbar icons are 24-unit outline drawings using `--stroke`, with round
  caps and joins; keep new ones in the same style. An icon in a button that has its
  own `aria-label` is `aria-hidden="true"`; an icon that says something
  by itself (a layer's tags) has `role="img"` and a label. Put new tool
  settings there, never in a list beside the left toolbar. Symmetry's
  settings open in the panel too (its `sym` view), from the mirror button,
  and so does the **grid** (`gridOn`, `gridSize`, `gridKind` square or
  `iso`, `gridAlpha`): a background on `.paint-grid` inside the picture's
  world, in the picture's units, its lines a screen pixel wide (`--gw`) and
  every 2nd/4th... line only when zoomed far out (`gridDraw`, from
  `applyView`); never part of the picture. Isometric is upright lines and
  the two diagonals of a tile `--gx` (s√3) wide and `--gs` high. The ruler
  and perspective guides (`gMode`, the panel's Ruler & Perspective) only
  show; **Drawing Assist** (`assistOn`, the switch at the panel's foot,
  `setAssistOn`) is what makes strokes keep to them: through `assist`, a
  brush, eraser, spray or line stroke takes the way nearest how it starts
  (decided once, after `ASSIST_PX` on the screen), from exactly where it
  started: never moved onto a line or crossing. The ways come from the ruler
  or perspective if one is picked, otherwise the grid's (`gridDirs`: square,
  or isometric's upright and 30° either way), shown or not; a grid's way is
  only taken within `ASSIST_TOL`, so other strokes stay freehand
  (`down.gfree`). The
  mirror button is lit while symmetry, a guide, the grid or Drawing Assist is on (`mirrorLit`). Pop-out panels can be dragged with
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
- **Reordering layers:** by a row's grip, or by the row itself (`reorder`,
  one path for both): with a mouse a drag up or down moves it (the wheel
  scrolls the list); with a finger or the Pencil a moment's hold lifts it
  (`.lifted`, `rowLift`) and then it follows, while a quick drag still scrolls,
  a swipe right still picks and a longer hold still opens the layer's menu.
  The click that ends a drag is swallowed (`reorderDone`), so it doesn't
  pick or rename. The drag is followed on the window (moving the row in
  the list drops pointer capture), the row takes every place the pointer
  passed in one move (a step is a row plus the list's gap, changed a little
  past half a step, so it never bounces).
- **The Background** (`bg`: the white paper, opaque, always at the
  bottom) is where a picture starts, so it's often drawn on. Moving it (a
  drag, Move Up) or moving a layer under it (a drag, Move Down) lifts its
  drawing off the paper (`bgLift`): a new layer with the white made
  see-through (colour to alpha, so a stroke over white comes back exactly,
  soft edges and all) goes where the Background was put, and the paper,
  now plain white, stays at the bottom; one undo step brings both back.
  Blank paper has nothing to lift (`bgBlank`): it stays, and nothing can be
  dragged under it.
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
- **Picking a colour** (the picker, Alt, the Pencil's barrel button): one
  pixel decides everything, `floor(pos(e) * R)` on a flat copy of the
  picture (`pickFlat`). The loupe (`loupeShow`) shows it in the square at
  its middle, the cells round it turned as the view is, the picture's edge
  in `--stage`; its ring is that one colour all round (`k.now`), and
  letting go picks it (`pickEnd`). With a mouse or the Pencil the loupe's
  middle is the pointer (`loupe-on` hides the cursor), and with the picker
  in hand it follows a hovering pointer before any press (`pickHover`, its
  copy made again after a key or a press elsewhere); for a finger it sits
  64px above.
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
  paints; words, a path, a cutout or a gradient being made are dealt with
  first): no tool button is lit, a drag moves the picture, and picking a
  colour takes up the brush. An open selection stays exactly as it is
  (`setTool('none')` neither commits nor lays it down; a press on it or on
  its handles off the edge isn't an empty-space tap, so the tool in hand
  still works it; picking a tool again carries on with it), and once the Pencil's in use a finger's tap there
  still puts the tool down (its drag does nothing). Tapping a tool's button
  again folds its settings only while that tool is in hand. New tools
  mustn't assume a tool is always in hand.
- **The pen's path** has steps of its own while it's being made
  (`pen.hist`/`pen.fut`, kept with `penRecord`): each point placed, point or
  handle moved, close or Backspace is one step, and undo/redo take those
  first (`penUndo`/`penRedo`). Laying the path down keeps it with its 'Pen'
  undo entry (`e.pen`), so undoing that brings the path back to carry on
  with (`penRestore`). The History list works on the picture's steps only
  (`doUndo(true)`). Text on Path is a mode (`penText`) as well as an action.
- **Shapes and Blend** are one button each, like Selecting: the Shapes button
  (`.paint-shapebtn`) is the tools `line` and `shape` (picked in its panel,
  `shapeWays`; the last used is `shapeKind`), and the Blend button
  (`.paint-blendbtn`) is `smudge`, `blur` and `tone` (lighten or darken, by
  `st.tone`), picked in its panel (`blendWays`, `blendPick`; the last used is
  `blendTool`). `comboSync` keeps both buttons on the tool in use. Each Blend
  mode keeps its own size and opacity (`blendSet`, saved and loaded in
  `setTool`), and the other tools get theirs back (`blendOut`).
- **Gradients** (`grad`, like the pen's path): a drag makes one (`gradKind`:
  `linear`, `radial`, `angular`, `diamond` or `free`), which stays to be
  worked on until Done, Return, another tool or a drag elsewhere lays it down
  (`gradDone`, as one 'Gradient' step that keeps it in `e.grad`, so undoing
  it brings it back, `gradRestore`). While it's open: its handles are an SVG
  on the screen (`gradUi`, `gradMarks`; `gradHit`), each change is a step of
  its own (`grad.hist`/`grad.fut`, `gradRecord`, taken by undo and redo
  first), stops are `{t, c, o}` with the ends at 0 and 1, freeform points
  `{x, y, c, o}`; a picked stop or point takes the colour in hand and picking
  a colour changes it (`gradPick`, `gradTint` from `setColor`). Colours along
  it come from `gradAt` (smoothstep between stops, weighted by opacity) via a
  1024-step table (`gradLut`). It's shown on a stand-in canvas with the
  screen's detail (`gradPv`, `gradPaint`; clipped like `maskOv`), and worked
  out at full size only when laid down (`gradFill`): linear, radial and
  angular by the browser, diamond and freeform a pixel at a time
  (`gradPixels`, coarser while it moves). The stops bar (`[data-gbar]`) and
  the kinds are in the context bar, which shows them inside a selection too.
- **Selecting:** one button in the left bar (`.paint-selbtn`) is the
  selection tool; its ways are tool ids of their own, `lasso` (Cutout, the
  first time), `select` (box), `circle` and `wand`, picked in its panel
  (`selWays`, `SEL_KINDS`) or by key (Q, M, C, W), and the one last used is
  remembered (`selKind`); the button takes that way's icon (`selBtnSync`).
  A circle is a selection with `sel.poly` (`ovalPoly`), so everything that
  works on a cutout works on it. Use `selTool(t)` to ask "is this
  selecting?", and `setTool(selKind)` to bring the tool up.
- **The selection panel** (`.selection-slot` > `.selection-toolbar`): a
  selection's actions stand in a card of their own just under the left
  toolbar (the top menu's gap below it, `--menu-stack-gap`), built like it
  (`.paint-bar` > `.paint-toolgroups` > `.paint-group`, so the same glass,
  corners, buttons, dividers and sizes everywhere), never over the picture.
  `placeSelectionToolbar` puts it under the toolbar wherever that is (the
  top menu folding, frame by frame; the sides swapped, sliding out and in
  with the other bars in `flipUI`; the window resized)
  and caps its height at the bottom of the picture's space: its buttons
  scroll past that. Its options (Feather, Expand, Rotate, Transform with
  Scale and Distort, More) open beside it, towards the picture, level with
  their button, inside the picture's space (`placeSelectionPopover`). A
  selection turning up folds the top menu (`headerOpen(false)`, once), and it
  fades only while the selection itself is moved, sized or turned
  (`manipulating`), never while the picture is moved or zoomed. Its groups:
  what's picked and its edge (Select All, Invert, Feather, Expand), where it
  is and which way round (Transform, Rotate, the flips), what's done with it
  (Copy, Delete, Deselect, More; More also has Paste, and Duplicate to New
  Layer, `data-sel="duplicate"`); then, at its foot (`.selection-foot`,
  outside the scrolling groups, so always in view), **Commit**
  (`.selection-commit`, `data-sel="done"`, solid accent, its word alone,
  centred by its letters): it lays down whatever's been moved, sized, turned
  or distorted (`commitSelection`) and closes the selection, touching nothing
  else. Return does the same wherever the focus is (once; not mid-drag; not
  in a field, the words being typed, or on a control reached with Tab,
  `keyNav`, which keeps Return for itself).
- **Copy and paste:** Copy (`copySel`, the panel, More, ⌘/Ctrl+C) makes the
  selected pixels as they'd be laid down, moved, sized, turned or distorted,
  on every picked layer (`selBounds`; `liftFrom(..., true)` when still in
  place), without changing anything, and keeps them (`selClip`, until the next
  copy) as well as writing a PNG to the system clipboard where allowed.
  Paste (`pasteClip`: ⌘/Ctrl+V, More, the selection tool's settings) puts
  them on a new layer above the current one, where they were, picked up with
  the Move tool at their own pixels (one 'Paste' step). The paste event takes
  a picture from the system clipboard (`pasteFile`: the one copied here,
  matched by its pixels, comes back exact; anything else is added like a
  dropped picture), and with none, or no event (`pasteWait`), what was copied
  here (`pasteAny`, which also reads the system clipboard for the buttons
  when nothing was copied here).
- **The selection's outline on the screen:** what's lifted is drawn on the
  picture's own sheet (`sov`/`sctx`, clipped at its edges, like the picture),
  but the outline, handles, the round handle, a cutout being drawn and Smart
  Guides' lines are drawn on `.paint-selui`, a sheet the stage's size, through
  the view (`uiSheet`, `drawSelUi`; `drawLasso`), so they reach past the
  picture into the workspace, where they can still be taken hold of.
  `applyView` draws it again, so it stays on what's picked while the picture
  is moved, zoomed or turned. With a selection open, one finger waits longer
  (and further) before it starts anything (`touchWait.far`), so a two-finger
  move of the picture whose fingers land apart doesn't start a new selection.
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
- **Distort** (`.paint-seldist`, a pill over the top of a selection, out
  past the round handle, or under the bottom if that's off the top or under
  Scale; `placeSelDist`): tapped, the corners come apart (`distortOn`):
  `sel.quad` holds the four corners (top left, top right, bottom right,
  bottom left) from `sel.x`/`sel.y`, so moving moves them all, while the box
  stays the frame the pixels, outline and wand shape are in. A projective map
  takes the frame to the quad (`quadMap`, `mapInv`); `selWorld`/`selLocal`
  go through it, so hit tests, Smart Guides and the X follow. Each corner is
  pulled on its own (`selMode` `distort`; never across the others,
  `quadOk`), the round handle turns all four (`qrot`), Turn 90° turns them.
  The pixels are drawn through the map by `warpOf`: on the graphics chip
  (`warpOnGL`, a shader with the texture's smaller copies, not on software
  WebGL; `paint-warp-gpu` `on`/`off` for testing), or a pixel at a time on
  the processor (bilinear, weighted by how solid, coarser while dragged);
  previews by `warpShow` (`putFloat(c, f, true)`). Tapped again
  (`distortOff`), the corners are locked together again: what's picked up is
  worked into the box round the quad (a plain box's outline becomes a
  four-point `sel.poly`), as one step that keeps the old float in `selGeo`,
  so undo brings the distortion back. Not for words (`distortable`). Laid
  down like a turned one: the selection closes.
- **Smart Guides** (`smartOn`, the top bar's toggle): while a selection,
  picture or words are dragged (`snapMove`, from the move handlers; ended by
  `snapEnd`), the real box of what's moving (`movingBox`: the float's
  painted part, turned and sized with the selection) snaps, each way on its
  own, to the picture's middle (ahead on a tie) and to the edges and middles
  of the other visible layers (`layerBox`; text from its words), within
  `SNAP_PX` screen pixels, let go past `SNAP_LET`. Layers' boxes come from
  `paintBox` (a small copy, then each edge exactly) and are kept until the
  layer's paint changes (`boxStale` in `push`/`apply`, and `putFloat`). The
  lines (`snap.lines`) are drawn by `drawSelUi` on the stage's selection sheet.
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
  block, kept for each size). **Blur** (Gaussian, and motion at an angle) is
  worked first, by the same steps everywhere (`fxBlurPlan`): the layer, its
  colours weighted by how solid they are, made smaller by `f` when the blur
  is big enough, three box blurs each way, the motion passes (`n1` samples
  `s1` apart, then `n2` between), back to full size; `fxBlurRun` on the
  processor (it stands alone too), `FX_BD`/`FX_BB`/`FX_BM`/`FX_BU` on the chip
  (`fxGLBlurTex`), each kept until the blur changes; the effect then reads its
  colours from the blurred layer (`bs`, `u_bsrc`) inside the selection. **Done** in the panel (`adjustApply`) keeps
  what's set as one step and starts again from the layer as it now is
  (`adjustRebase`), the panel staying open (and through undo and redo with
  nothing set); Done with nothing set, and anything else that ends it,
  closes it (`adjustDone`). There's no Cancel button: Esc (`adjustCancel`)
  or Reset All takes back what's set. Nothing heavy happens on opening
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
- **The look:** the header has no bar: its buttons are in frosted capsules
  (`.hb-group`). The bars, the context bar and every
  pop-over are frosted cards (`--panel`/`--menu-bg`, `--glass`, the shadow
  tokens, which carry a light top edge); the picture sits in a dotted well.
  Pop-overs open with `pd-in`/`pb-in`/`pl-in` on `--dur-pop` and `--spring`;
  sheets rise in over a blurred `--scrim`. Titles use `--display` in bold.
- **Surfaces:** every pop-over, menu and panel has one hairline edge, its
  shadow's (`--shadow-pop`, or `--shadow-panel` for what stands in the dock):
  a border, where one is needed for the box's size, is transparent. Every
  control, wherever it sits, takes the app's font and eases between its
  states (the `:where(button)` rules near the top of `style.css`).
  A slider row is its name in `--muted` and its value in `--text`
  everywhere; section labels are `--fs-xs`/`--fs-sm` at weight 500 in
  `--muted`.
- **Layout is fixed:** a polish or styling change must not move or resize
  anything; compare every element's box before and after (the layout lock
  check) in each menu and panel, at desktop, iPad and phone sizes.
- **Shared looks:** every `input[type="range"]` gets the same thin track
  and white knob (one rule near the top of `style.css`; a slider whose track
  shows what it does sets `--track` and keeps it). A Done inside the tool
  panel is tinted (`--accent-soft` with accent text); Done, Save and Create at
  the foot of a panel or sheet are solid accent.
- **Touch:** on a touch screen (`pointer: coarse`) rows and buttons are
  taller (`--row`, `--ctl`), and a small control that can't grow gets a hit
  area past what's drawn (a `::after` with a negative inset, near the top of
  `style.css`); add new small controls to that rule. On phones a row of
  options in the tool settings stays inside the strip: icon segments narrow,
  word segments wrap.
- **Test in light and dark mode and at phone width** (560px and narrower: check 360 and 375 too).
- **One big scope:** most of `paint.js` shares one function's scope, so a
  new `var` or function can silently replace an existing one of the same
  name (a `var lift` once replaced the selection's `lift()`, and nothing
  picked up could move). Before adding a name, search for it
  (`function NAME`, `var NAME`), and run the selection and layer checks
  after any change there.
- Much of the existing CSS predates this rule and has repeated values. Don't
  refactor it unless asked. Move things onto shared tokens and styles as you
  touch them, and keep unrelated changes out of a task.
