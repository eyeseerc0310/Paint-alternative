# Paint Alternative: notes for Claude

A browser painting app (plain HTML/CSS/JS, no build step), published with
GitHub Pages from `main`. The app is `index.html`, `style.css` and `paint.js`,
with Vector mode in `vector.js` and Photo mode in `photo.js` (both loaded
before `paint.js`, after `fx-shared.js`, the tone sums they share);
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
  Sizes: `--row` (a menu's row), `--ctl` (a panel's or sheet's button; both taller on a touch screen), `--press` (the pressed shrink, for every button), `--press-row` (the same for a full-width row), `--mode-h` (the Paint / Vector switch's height; the phone's tool settings strip starts under it), `--ruler` (Vector's rulers).
  States: `--disabled` (how faint anything greyed out is, once: a group that's
  greyed out doesn't grey its parts again), `--ring-picked` (the active layer's
  outline while others are picked with it, and a picked thumbnail), `--ring-focus` (a focused field; elsewhere
  the shared `:focus-visible` outline), `--seg-on` with `--seg-shadow` (the
  picked part of a segmented control, in both themes).
  Spacing: `--s-1` to `--s-4`. Type: `--fs-xs`, `--fs-sm`, `--fs-ui` (buttons with words, rows, fields), `--fs`, `--fs-title` (every panel's and menu's title), `--fs-head` (a sheet's title); section labels are sentence case, never capitals. Icons:
  `--icon`, `--icon-sm`, `--icon-hdr` (the top bar), `--stroke`, `--chev-down` (a drop-down field's chevron; every `select` uses it), `--stroke-xs` (a 12px glyph: a
  list's chevron, a close X, the fold arrow, so it isn't drawn thinner than the
  rest; icons ≥14px keep `--stroke`), `--chev` (the one chevron's size), `--tool-h` (a left-bar tool button's height). Motion: `--dur-fast` (a knob or swatch answering a touch, and every button's hover and press, the `:where(button)` rules), `--dur`, `--dur-pop` (a menu or panel popping open), `--dur-slow`, `--ease`, `--spring` (a small overshoot, for things that pop open) (reduced motion is honoured for all of them by one rule at the end of `style.css`). Don't hard-code a colour, radius, shadow or spacing value in a
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
  it, never covered, with `refit()` each frame. What its buttons open
  stands in the top bar's panel (below); the phone's ••• menu, the one
  drop-down left, drops from the arrow while the bar is folded (`hdrBtn`).
  The left bar (`.paint-left`), its middle level with the picture's space's
  (`safe center` above the bottom bar, `--bbar-gap`; at the top if it's too
  tall for that), holds the tools in groups (there's no Hand button:
  the picture moves with Space, two fingers, the middle button, scrolling,
  H, or a drag with the tool put down). The Shapes button keeps its own icon
  whichever kind is picked; Select sits beside Pen; Fit (`.paint-fitbtn`,
  0) is its last tool, in every workspace: Photo shows the painting's own
  where it is, Vector a copy after its categories (an eighth row, with Layers
  stepped down only where the buttons are too tall for it, from `--tool-h`
  and `--group-gap`), each click going to that workspace's own `fit`. At its
  foot are Layers (`.pl-layersbtn`) and the zoom (`.paint-zoom`). The saved-status pill
  (`.doc-status`) sits in the corner under it, centred on the bar, level
  with the bottom bar's middle (hidden in focus mode). The **bottom bar**
  (`.paint-bottom`, `bbar`, under the picture in `.paint-centre`, a glass pill
  like the top bar's capsules) holds, in this order, Size, Undo, the two
  colours (`.paint-pair`, in `color-controls.css`: the pair is the swap
  button, its arrows in the gap between the two, `--color-pair-gap`, wide
  enough that they never touch either), Redo and Opacity;
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
  the next tool's settings come back (`bare` in `chooseTool`), folded still
  if they were folded. `hasMenu(t)` (a `CTX` entry) is the one test for
  anything that would open, unfold or replace the panel: picking a tool with
  no settings again does nothing to any panel (Move still picks the layer up
  again), and such a tool never unfolds the panel, whatever is open.
  In the dock (not on phones) the colour picker stays open through a change
  to a tool with no settings (`keepPc` in `chooseTool`), Layers, the zoom and Fit (`pcStays`);
  a tool with settings, symmetry, Effects or the Brush Studio take its
  place, as before. Only the picker does this.
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
  caps and joins; keep new ones in the same style. **One chevron** (`.chev`:
  the path `M7 9.5l5 5 5-5`, `--chev` big, `--stroke-xs`, `--muted`, `--text`
  on its row's hover) for every disclosure, list and fold: a section's head
  (`.pr-head`, the whole row its button, the chevron at its trailing edge;
  Effects' reset stands just inside it, so every section's chevron lines up),
  a drop-down in the tool settings (turned up while open), a group of layers,
  Back (pointing back), the selection panel's arrows; a folded one turns to
  point right. A `select` draws the same glyph (`--chev-down`, `--chev` big). An icon in a button that has its
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
  Every text setting (font, size, B I U, capitals, shadow, alignment,
  letter spacing, line height, outline, fill, curve) is in the tool's
  panel (`CTX.text`), nothing floats beside the words, and a change goes
  through `afterTextChange`. Where the words stay open (`TEXT_KEEP`: the
  panel, the font list, the bottom bar, the colour picker) is decided by
  where the press was (`textPress`), never only by where the focus went:
  Safari, and so the iPad, gives a pressed button or slider no focus. Their
  buttons keep the focus and the highlight by stopping `mousedown`
  (`textKeepCaret`; `pointerdown` doesn't stop Safari); the highlight is kept
  as `textHi` (from `selectionchange`) and shown with the CSS Custom
  Highlight API while the page's own is elsewhere (`textHiShow`); a button
  pressed, a slider let go of or a field finished there gives the words the
  focus back with it (`textBack`, `textFocus`). A press anywhere else lays
  them down (their blur, or the capture `pointerdown` when they'd lost the
  focus already), as does a tap on the picture. The settings apply to the
  whole of the words (a text layer has one look); the dashed box is
  `.paint-text`'s outline. The stage is `overflow: clip`, so a caret past
  its edge can't scroll the picture sideways.
- **Masks and groups:** a layer's look on screen and when saved comes from
  `viewOf(L)` (its paint, through its mask `L.mask`, through what it's
  clipped to) and `flattenInto` (groups as one). While a mask is picked
  (`L.editMask`), painting tools work on `L.mask.P`, which stands in for the
  layer (`maskIn`/`maskOut`). New layers made next to one join its group
  (`L.group`).
- **The Layers panels** (the painting's and Vector's, `.paint-layerpanel`):
  the title, then the actions (`.pl-acts`: New Layer first), then the list
  (`.pl-list`, which scrolls), then the active layer's opacity and blend. They're
  placed beside the bar only when they open (`layersPlace(el, btn, fresh)`),
  and then stay where they are while rows come and go, so New Layer stays
  under the pointer for the next one; no taller than the room under where
  they start, and clear of the bottom bar where they'd cover it. A redrawn
  list keeps where it was scrolled, and a layer just made is scrolled into
  view (`revealOn`). Vector's current layer is tinted `--selected`, what's
  picked the chip.
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
- **Bristle brushes** (Dry Brush, Flat Bristle, Rough Round: `drybrush`,
  `flatbristle`, `roughround`; their look in `BRISTLE`): the head is a set of
  stable bristles (`bristleSet`, seeded, so a stroke draws the same every
  time) carried along the stroke by `bristleHead` (its axis lags and turns
  the short way, so doubling back keeps each bristle's place; width from
  pressure, contact from pressure or `mouse`, speed from the samples'
  timestamps `t`, which `resample` and the pointer handlers carry). Each
  bristle's contact and paint come from smooth noise along the stroke and
  across the head (`wander`/`wander2`, read through `wv`/`wv2`), never per
  point, and it's drawn as one trail (`bristleStroke`) in stretches of `BC`
  samples, segments batched by alpha and width. `bristleFrame` (from
  `renderStroke`) draws settled stretches once onto `doneSheet` and redraws
  only the tail each frame; the redraw is never clipped (clipping changes
  the edges' anti-aliasing and shows seams). A dab is a short drag. Their
  Studio sections are Pressure (and Tapered Ends for Rough Round).
  A QuickShape (a stroke held still, snapped to a line, rectangle or
  ellipse, `shapeGeo`/`shapePts`) being sized is drawn at most once a frame
  (`redrawShape` only asks); for a bristle brush, what was last drawn
  exactly (`shapeDraw`, kept in `shapeShot`) is shown stretched to the new
  size (`shapeShow`) and drawn exactly again once the pointer rests or lets
  go (`shapeFlush` in `end0`), so what's laid down is always exact.
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
- **The top bar's panel** (`.paint-docpanel`, `docBox`): everything the
  top bar opens (Gallery, New Picture, Save, Crop & Rotate, History,
  Settings, Keyboard Shortcuts, and Touch Gestures and Vector's mode dialog
  from Settings) is shown in it, never as a drop-down or a sheet over a
  dimmed page; only Share asks the system. It stands in the dock like Effects
  (`DOCKED_PANELS`, as wide as the tool settings, which step aside,
  `ctxAside`; `dockPlace` while unlocked) and beside the left bar on phones
  (`docFit` keeps its foot above the bottom bar). Its head (`.dp-head`) has
  the view's title, Back when it was opened from another view, and a close
  button. `docShow(key, title, el, {btn, back, reopen})` puts a view in
  (what stood in the dock gives way: the picker, Effects keeping what's set,
  the Brush Studio, the layer menu; the tool in hand stays); another view
  replaces it, the same button closes it (`docIs(key)`), as do the close
  button, Esc (`docClose`, focus back where it was), a tool with settings
  (`hasMenu`), the picker, Effects, the Studio, the settings toggle and a
  workspace switch. `openSheet(cls, html)` makes a sheet a view (its
  `.pa-sheet-title` becomes the panel's title; `.pa-sheet-acts` stays at the
  foot) and `closeSheet` goes Back (`sheetBack`, set just before opening one
  from a view, as Settings does with `settingsAgain`) or closes. The
  toolbar's own `.paint button`/`.paint svg` rules skip what's in it
  (`:where(:not(.paint-docpanel *))`, so their weight doesn't change);
  Crop & Rotate stays open from one turn, flip, crop or Clear Layer to the
  next: its buttons and the picture's size are made again in place
  (`imageFill`, also after every undo and redo, from `buttons()`), the
  pressed button keeping the focus. Settings' items are Title Case, short
  enough for one line at the dock's width (Shortcuts, Ask to Bring Art).
  `relayout()` keeps everything that floats on the screen when the window
  changes size; Esc closes the top-most thing first.
- **Input:** mouse, finger, Apple Pencil and keyboard share the stage's
  pointer handlers. One finger waits a moment (`touchWait`) before starting
  anything, so a pinch never begins a stroke; once the Pencil has been used
  (`penSeen`) a single finger doesn't paint unless Touch Gestures says so
  (`fingerDraw`), and touches just after the Pencil are ignored as a resting
  hand. The Pencil's eraser end rubs out, its barrel button picks a colour.
  A still click or tap on the empty space around the picture, or on the bare
  workspace round the bars and panels (`bareTap`, `bareAt`: only the bare
  backgrounds, never a control or a panel), puts the tool
  down (`st.tool` is `'none'`, from `offTap`; a stroke that starts there still
  paints; words, a path, a cutout or a gradient being made are dealt with
  first): no tool button is lit, a drag moves the picture, and picking a
  colour takes up the brush. An open selection stays exactly as it is
  (`setTool('none')` neither commits nor lays it down; a press on it or on
  its handles off the edge isn't an empty-space tap, so the tool in hand
  still works it; picking a tool again carries on with it), and once the Pencil's in use a finger's tap there
  still puts the tool down (its drag does nothing). Tapping a tool's button
  again folds its settings only while that tool is in hand. New tools
  mustn't assume a tool is always in hand. In Vector the bare workspace
  puts its tool down too (`PV.toolDown`: `tool` is `'none'`, in no
  category, so nothing in the left bar is lit, the panel says No Tool, and
  a drag moves round, as with the Hand; not while words, a path or a
  curvature path are being made, or mid-drag); in Photo it lets go of the
  mask in hand (`PH.toolDown`), its other categories holding no tool.
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
- **Selections in the history:** making, adding to, changing (Feather,
  Expand, Invert Selection, Select All, the layer menu's Select) and letting
  go of a selection (Deselect, Commit, Return, Esc, a click outside) are
  steps of their own (`selOnly`, `selLog(was, label)` after the change, with
  `was` from `selSnap()` before it), in order with the painting's; undo and
  redo swap the selection (`selRestore`) and never change the picture. A
  snapshot is the selection at rest (a turned or distorted one as the mask
  it covers); only what the person made counts (`sel.auto`, `sel.text` and
  `sel.thing` are the tools' own). A Move step (`lift`, `liftMany`) keeps
  the selection as it was in `selAt`, so undoing it puts the outline back
  with the pixels. Before undo, redo or a History jump, anything picked up
  is put down and the selection stays (`selSettle`). Selection steps don't
  count towards the memory limit of steps (`heavySteps`); their masks have
  a cap of their own (`selBytes`). Switching layers
  (a row, a thumbnail, picking more or letting them go) only changes the
  current layer: what's picked up is put down on its own layer
  (`selSettle`), the selection stays, and nothing is selected for you, the
  Move tool included (it picks the layer up when it's pressed on the
  picture).
- **Adding to a selection:** Shift held as a box, circle, cutout or wand
  selection starts adds it to what's selected (never a move, even inside
  it); without Shift a new one replaces it. What's there is kept as a mask
  the picture's size (`selAddStart`, `selAdd`; its outline shows while the
  new part is drawn, `drawAddBase`), and the new part is added to it when
  it's finished (`selAddFinish`): one mask selection round all of it
  (`maskSel`), so painting, moving, Effects and the rest treat it as one,
  with `sel.edges`, the outline of every part (`edgeLoops`: the mask's edges
  joined into loops, steps smoothed to within 0.6 of a pixel, as fractions of
  the box; drawn by `edgePath`), so separate parts each have their own and
  overlapping ones join; no blue wash. Undo takes away the part added last.
  With the circle, Shift still makes it round, unless that Shift started an
  added part (let go and pressed again, it does).
- **The selection panel** (`.selection-slot` > `.selection-toolbar`): a
  selection's actions stand in a card of their own just under the left
  toolbar (the top menu's gap below it, `--menu-stack-gap`), built like it
  (`.paint-bar` > `.paint-toolgroups` > `.paint-group`, so the same glass,
  corners, buttons, dividers and sizes everywhere), never over the picture.
  `placeSelectionToolbar` puts it under the toolbar wherever that is (the
  top menu folding, frame by frame; the sides swapped, sliding out and in
  with the other bars in `flipUI`; the window resized)
  and makes it reach down to the bottom of the colour bar (`bbar`; the
  picture's space's when that bar is away): its buttons take the room above
  Commit and scroll past that, the edge with more past it fading
  (`selFades`, `more-above`/`more-below`) under a small round arrow
  (`.sel-more`, `selArrows`) that scrolls the next group fully into view
  (`selStep`), and the first time it turns up with more than fits it scrolls
  a little way down and back, once ever (`selNudge`, `paint-sel-nudged`).
  Its options (Feather, Expand,
  Rotate, Transform with Scale and Distort) open beside it, towards the picture, level with
  their button, inside the picture's space (`placeSelectionPopover`). A
  selection turning up folds the top menu (`headerOpen(false)`, once), and it
  stays in view while the selection is moved, sized, turned or distorted
  and while the picture is moved or zoomed (it never fades for a press; an
  option open beside it closes on a press elsewhere, as every pop-over does).
  Its groups, every selection action as a button (there's no ••• menu):
  what's picked and its edge (Select All, Invert Selection, Feather,
  Expand); what's done to its pixels (Transform, Rotate, Rotate 90°, Invert
  Colours, the flips); the clipboard and layers (Copy, Paste, Duplicate to
  New Layer `data-sel="duplicate"`, Cut to Layer); and Delete, Deselect; then, at its foot (`.selection-foot`,
  outside the scrolling groups, so always in view), **Commit**
  (`.selection-commit`, `data-sel="done"`, solid accent, its word alone,
  centred by its letters): it lays down whatever's been moved, sized, turned
  or distorted (`commitSelection`) and closes the selection, touching nothing
  else. Return does the same wherever the focus is (once; not mid-drag; not
  in a field, the words being typed, or on a control reached with Tab,
  `keyNav`, which keeps Return for itself).
- **Copy and paste:** Copy (`copySel`, the panel, ⌘/Ctrl+C) makes the
  selected pixels as they'd be laid down, moved, sized, turned or distorted,
  on every picked layer (`selBounds`; `liftFrom(..., true)` when still in
  place), without changing anything, and keeps them (`selClip`, until the next
  copy) as well as writing a PNG to the system clipboard where allowed.
  Paste (`pasteClip`: ⌘/Ctrl+V, the panel, the selection tool's settings) puts
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
  choice, for testing. **Content-Aware Scale** (the last section, `cas`) is a
  button, `[data-fx-cas]`, greyed out without a selection (`casOk`,
  `casSync`), and the same toggle, `.paint-selcas`, sits beside Distort in
  the selection's Transform options (`casBtnSync`), where what's picked up
  stays picked up, turned or not. Either starts the mode (`casStart`):
  Effects steps aside, the selection is lifted (`lift`, its 'Move' step kept
  as `sel.cas.mv`) and what's picked up is the original (`sel.cas.src`, not
  copied: nothing changes it while the mode's on), with a ~80,000-pixel
  copy (`small`); each mode has a `sid`. The frame gets side handles (`n`,
  `s`, `e`, `w` in `localCorners`, `corner-ns`/`corner-ew` cursors) and a
  pill on the picture says it's on (`.paint-casmode`, with Normal Scale). A
  side sizes one way, a corner both (each free, unless Shift), in whole
  pixels of what's picked up, so the size it began at is exactly that.
  **Nothing is carved on the page's thread** (once, Commit carved there
  whenever the full size wasn't back yet, and froze for seconds): two
  workers (`casWorker` `prev` and `full`, one Blob URL, `CAS_W`) are each
  handed the mode's pixels once (`casPrime`/`casGo`, `src`, transferred, so
  no copy stays here) and keep them, and the width they carved last, so an
  ask is only its size; each works one ask at a time, the newest waiting,
  and one asked again while it's worked isn't asked twice (`casSend`,
  `casNext`). Every size is worked from the original: while a handle is
  dragged the small copy is carved (`casLive`, few passes) and shown
  stretched in the frame (`C.pv`, drawn at most once a frame, `casDraw`;
  swapped in by `putFloat`), and held still a moment (`restT`) or let go of,
  the full size (`casFull`, `casAsk`), kept by size in `C.cache` (the newest
  four, ~64 MB at most, `casKeep`); a size already known invalidates a
  quick look still on its way (`C.pid`). The pill's `data-busy` is set while
  the full size is worked, and past 400 ms its dot pulses (`slow`,
  `casBusy`, `casPillSync`). Explicit actions wait for it without blocking
  (`casGate(fn)`: Commit, Return, Deselect, a click outside, the X, Normal
  Scale, Distort, Copy and the other selection actions but a quarter turn
  and Delete): the pill reads Finishing…, the picture takes no presses
  (`casHold` in `begin0`), Esc calls it all off, undo or redo drops the
  wait, and `fn` runs once it's in (no drawing first). Anything else that
  lays the selection down (a new layer, a tool, a mode) goes through
  `commitSelection` → `casEnd`, which never carves either: the quick look
  stands in (`casFix`, laid down with what was under it kept, `casFixLay`)
  and the full size takes its place exactly when it comes (`casRefine`),
  if the layer hasn't changed since (`boxV`); meanwhile the pill says it's
  finishing, presses wait, and undo or redo run after it (`casFix.after`).
  A worker that fails is made again and asked once more (`casLost`); twice,
  everything goes back as it was (`casFailed`); a mode that ends lets its
  workers drop its pixels, stops one still working for it and empties its
  cache (`casDrop`). It's seam carving (`casCarve`, `casCarve2`: width,
  then height through a transposed copy; both stand alone, copied into the
  workers): forward energy plus the change across and down (`dp`, a
  function of its own with all it uses handed to it, so the engine keeps it
  fast), on a softened copy, each difference counted as d² / (d + T), `T`
  the picture's own grain (`grain`: six times its 90th-percentile step,
  sampled, at most 16), so grain costs next to nothing and edges their
  full amount (a flat shape on a grainy ground was cheaper to cut through
  than the ground, and on a big picture the circle in the tests lost a
  quarter of its width); several seams a pass that step aside rather than
  cross; wider by doubling the seams that would go first. Each size is a
  step of the selection's own (`selRecord`, undo and redo take them first,
  `selPut` lays the right size in). Normal Scale, pressing the toggle
  again, Distort or any other selection action ends the mode with what's
  carved still picked up (`casEnd`); Esc, or undo before anything's sized,
  puts everything back exactly (`casCancel`: the lift's own step taken
  back, or, if it was picked up already, the geometry and pixels as they
  were).
- **Paint and Vector** are two workspaces in one drawing (with Photo, three).
  **They're reached from Settings: Paint mode, Vector mode and Photo mode**
  (`data-setting` the mode, `menuitemradio`s, the one in use ticked; picking
  it again does nothing): the switch
  (`.mode-switch`, a radio group in a frosted capsule at the top middle of
  `.paint-centre`, over the picture's space; picked side `--seg-on`) is kept
  but hidden (`modeEl.hidden`), and the phone's tool strip only steps down
  for it while it shows; the help sheet lists Vector's keys only in Vector
  mode. Either way in calls `askMode(m)`: when the side being left has art (`thumbOf().blank`,
  `PV.isEmpty()`) and `modeAsk` is on (`paint-mode-ask`; the dialog's
  Don't ask again, and Settings' Ask to bring artwork across), a sheet
  offers Cancel, Switch Without Copying and Bring Artwork; otherwise it
  switches with no copy. `setMode(m, bring)` does the switch (`wsMode`,
  `vector-mode` on `:root`, `modeSync`). The painting is only hidden in
  Vector mode, never changed: the words being typed and Effects are
  finished first, a selection, path or gradient stays open. Bring to
  Vector: `flatCopy()` goes in as a picture object on a new layer
  "Painting" (`PV.enter(flat)`, one Vector undo step). Bring to Paint:
  `PV.raster(pw, ph)` (see-through, fitted as the artboard fits) goes on a
  new paint layer "Vector Artwork" above the active one (`rememberLayers`,
  one undo step). Each side keeps its own layers, undo, view, selection
  and tool. **`vector.js`** (`window.PaintVector`, `PV` in `paint.js`) owns
  Vector's side, in this order: THE TOOLS (`CATS`, the left bar's
  categories in the spec's order, all fourteen now real;
  `TOOLS`, each tool's name, key and tip; `ICONS`; `TS`, each tool's own
  settings, kept as `paint-vec-tools`), GEOMETRY (a path's `d` is a list
  of subpaths `{ pts, closed }`, each point an anchor with its handles
  `{ x, y, ix, iy, ox, oy, s }` (s smooth; `a`: kept curving through its
  neighbours, the Curvature tool's, `reflowAuto`); `seg`/`bez`/`splitBez`/
  `insertAt`, `flat`/`measure`, `nearest`, `inside` (non-zero, or a
  compound path's `rule: 'evenodd'`), `dBox`,
  `fitCurves` (Schneider), `rdp`), THE DOCUMENT (`doc.layers`, top last:
  `layer` nodes hold sublayers, `group`s, `path`s, `image`s and `text`, each with
  `id`, `name`, `visible`, `locked`; `walk`/`where`/`chain`; `topPick`, what
  the Selection tool picks, the outermost group in its layer; `editable`;
  `xform(n, matrix)`; LIVE SHAPES, `n.live`, what a shape was made from,
  `liveGen`, kept through moves and sizes by `liveXform`, dropped by
  `unlive` when its points are edited), HOW IT LOOKS (`n.app`, fills and
  strokes stacked from the bottom: `{ k: 'f'|'s', p, o, on }`, strokes with
  `w`, `cap`, `join`, `ml`, `dash`, `prof`; a paint `p` is null (none),
  `{ t: 'c', c }`, a gradient `{ t: 'l'|'r', st: [{ t, c, o }], ... }` in
  fractions of the object's box (`isGrad(p)`), or a pattern `{ t: 'p', id,
  s, a, x, y }`; `itemOf(app, k)` is the one the colours change, the top
  one unless Fills & Strokes focused another; `prof`, a width profile
  `[{ t, w }]`, is drawn as a filled outline, `outlineD`;
  `doc.def` is what new objects take, and every colour, width or opacity
  set goes to what's picked and to it), DRAWING IT (`nodeSvg` for the
  screen and saving, pictures as `<use>` of a `<symbol>` in `defsEl`;
  `cDraw` on a canvas for `raster`, the eyedropper's `sampleAt` and the
  Vector Fill, from the same appearance), UNDO (`record`, a whole-document
  snapshot; `begin` records a drag on its first move, `cancelDrag` takes it
  back when a second finger lands; `recordC` makes a run of slider or
  picker changes one step), THE VIEW (`view` x, y, k and r, turned by
  Rotate View or two fingers' twist; `vmat`, `toScreen`/`fromScreen`; `fit`
  keeps clear of the switch and sets it upright), ON THE SCREEN (`renderArt`,
  `renderNode` for one node during a drag; `drawUI` draws what's picked,
  handles, anchors and what's being made on `.vec-ui`, in screen pixels),
  PICKING (`hitLeaf`, `hitAnchor`, `hitHandleOf`, `hitSegment`,
  `hitBoxHandle`), the pointer (`down`/`move`/`up` hand each press to
  `H[tool]` (`H.select` for a tool with none): `down`, `move`, `up`, `hover`;
  a drag object `drag` carries its kind and tool), THE PANEL (`panelHTML`:
  the category's tools as a grid, then `SET[tool]()`; every control names
  what it changes with `data-vk`, read and set through `BK` (or `L.` for a
  live shape's settings, `T.` for `TS`), buttons name an action with
  `data-va` (`act`); `panelSync` fills it, and it's made again only when
  `keyNow()` changes), COLOURS (`pcGet`/`pcSet`/`pcCss` for the picker,
  'main' the fill and 'second' the stroke; a gradient's picked stop with
  the Gradient tool), THE BOTTOM BAR (`bbarSync`, `bbarInput`: Size is the
  stroke's width, `swAt`/`swPos`, its slider narrowed so the longer name
  keeps the bar its width; Opacity; the two colours, the stroke as a ring,
  none as a red slash; Swap; the last button opens QUICK OPTIONS, `quickItems`,
  for the tool and what's picked, ending with showing or hiding the tool
  settings), LAYERS (a tree, top first, a level a step in; eye, lock, fold,
  rename with a double-tap; a row dragged with the mouse, or by its grip
  with a finger, goes into a layer or group or between rows, `dropAt`,
  `moveTo`; objects never go loose at the top, layers never into groups),
  KEEPING IT (`serialize`; `load` checks everything, `sNode`, `sApp`,
  `sPaint`), and IN AND OUT (`enter`, `leave`, `key`). Paint hands it what
  it shares through the bridge in `PV.init` (the stage, the tool panel,
  Layers, the zoom, undo and redo, the bottom bar's controls, the colour
  picker, `palettes`, autosave, toasts); the picker's tabs read Fill and
  Stroke in Vector mode and it has None (`.pc-none`), and a colour dragged
  from the bar or the picker onto an object fills or strokes it
  (`PV.dropColour`). In Vector mode: what's only the painting's is hidden or
  greyed out (History, Crop), pictures opened, pasted or
  dropped are placed as objects (`PV.addImageFile`), Save offers SVG and
  saves Vector's art, Share sends it. Both sides are kept together:
  `docInfo`/`applyInfo` and the project file carry `mode` and `vector`
  (`PV.serialize`, `vecLoad`); New Picture starts Vector blank again; the
  gallery keeps a drawing whose painting is blank if Vector has art.
- **Vector's Drawing, Shape Operations, Transform, Typography and Align &
  Arrange** (`vector.js`). A tool that's an action (`TOOLS[t].action`: the
  Pathfinder ops, Compound Path, Clipping Mask, Convert to Outlines, the
  four arrange steps, Group/Ungroup, Fit, Actual Size) runs from `ACTIONS`
  (`runAction`) on what's picked and leaves the tool in hand as it was; a
  category opens on its first real tool. **Matrices**: `mMul`, `mAbout`,
  `mRot`/`mScale`/`mShear`/`mRefl`, `homog`/`hmap` (projective). `xform`
  takes any affine matrix: a path's points; a live shape's settings follow
  where they can (`liveFit`), otherwise it keeps `live.m` (`genLive` makes
  its points); a picture or words that can't stay upright keep `mt`
  (drawn as `transform="matrix()"`, read back with `nodeQuad`). `xformS`
  also sizes strokes when Scale Strokes (`TS.xf.strokes`) is on.
  **Shape operations** share one planar arrangement (`planar`): shapes
  flattened to rings (`pathRings`, a point knows if it was an anchor and a
  smooth one), crossings found in a grid, edges cut, half-edges joined into
  cycles (positive area: a face; negative: a piece's outside), each cycle
  told which shapes it's inside from a point just left of it (`inShape`,
  each shape's own fill rule). `arrExtract(A, keep)` gives the rings
  between kept and dropped cycles; `arrFaces` gives faces with their holes;
  `ringToSp` fits curves again between anchors and crossings (`fitCurves`,
  smooth anchors keep one tangent), `cleanSp` drops corners in straight
  lines. `OPS` (union, intersect, minus, exclude) and Divide (`pathfinder`,
  its pieces grouped, each the colour of the top shape it was in), Shape
  Builder (`bldPrep` keyed by `ver`, the count `changed()` keeps; `buildApply`
  joins the dragged faces and leaves the rest divided; Alt or Take Away
  drops them), the Blob Brush and the Vector Eraser all use it. Compound
  Path (`compoundToggle`, Ctrl/⌘ 8) joins paths into one with `rule:
  'evenodd'`, the bottom one's look; Clipping Mask (`clipToggle`, Ctrl/⌘ 7)
  makes a `group` with `clip`: its top item is a path that isn't drawn but
  clips the rest (`clipPath` in `nodeSvg`, `clip()` in `cDraw`, and
  `hitLeaf` only finds what shows through, the clipping path by its edge);
  `pruneEmpty` tidies groups left empty. **Drawing**: Pencil and Vector
  Brush (`H.pencil`, `drawCommit`: the pointer's points, coalesced events
  too, fitted with `smoothErr`; starting at a picked path's end carries it
  on; the brush's width profile from its kind, a calligraphic nib's angle
  and the Pencil's pressure, `brushProf`); Blob Brush and Vector Eraser
  (`H.blob`: what the brush covered traced from a canvas, `strokeArea`;
  the blob joins the touching shapes of its colour, `blobLike`; the eraser
  cuts filled shapes (separate pieces, `splitRings`) and cuts lines exactly
  where they cross its edge, `cutByArea`/`subCurve`); Smooth (`smoothAt`,
  the anchors near the pointer fitted again from dense, averaged samples).
  **Transform** (`XF`): a drag from copies taken as it starts (`xfStart`,
  `xfShow`, `xfMove`, `xfUp`; Alt moves a copy), from `xfOrigin` (a tapped
  point, `tref`, or the panel's reference point, `TS.xf.ref`); the panel's
  numbers apply with `xfApply` (and Copy). Free Transform has the box's
  handles, a round handle (`knobPt`) and, like Selection, turning just
  outside a corner (`rotZone`, the `ROTC` cursor); Ctrl/⌘ or Side handles:
  Slant on a side handle shears. Distort (`dq`, kept while `ver` says
  nothing else changed) maps paths from the old corners to the new
  (`homog`); pictures and words don't distort. **Typography**: a `text`
  node has `kind` (`point` from `x`, `y`; `area` inside `area`, a closed
  path; `path` along `pd` from `off`, `flip`), `vert`, `txt`, `font` (paint's
  `FONTS`, through the bridge's `fonts`/`ensureFonts`), `size`, `weight`,
  `italic`, `lead`, `track` (per mille), `align`, `app`, and `ch`, letters
  with a look of their own by index into `txt` (`dx`, `dy`, `r`, `s`, `c`;
  `shiftCh` keeps them on their letters as words are typed). `textLayout`
  (kept in `TX.cache`, laid out again when a web font arrives, `relayText`)
  gives each letter's place, turn and advance, and the caret's places;
  `textSvg` draws one `<text>` with a position (and turn) for each letter,
  letters of their own one by one; `textDraw` on a canvas; `textBox`,
  `glyphAt`, `caretAt`, `textXform` (point text grows in size, an area's
  shape is sized and the words flow again, text on a path goes with it).
  Typing goes into a hidden textarea at the caret (`ta`, `te` the edit:
  `startEdit`/`endEdit`, one undo step, nothing typed leaves nothing;
  `placeTa`; the stage's `mousedown` is cancelled while typing so a tap
  keeps the focus), so selecting, copying and a phone's keyboard are the
  browser's own. Character Editing (`chs`, `chHandles`) moves, turns and
  sizes one letter about its middle (`chMid`). Convert to Outlines
  (`outlines`) traces each letter big (`glyphD`, kept in `GLY`) and fits it
  with curves. **Align & Arrange** (`ALIGNT`): to the selection, the key
  object (`keyId`, a tap on one of the picked) or the artboard
  (`TS.align.to`); `alignDo`, `distDo`, `spaceDo` (a set gap round the key
  object). On the screen: `uiExtra` (the origin, the round handle,
  Distort's corners, the caret and picked letters, Shape Builder's parts,
  a brush's circle, what's being drawn), in the editing blue (`--edit`).
  Saved and checked by `sNode` (`text`, `clip`, `rule`, `mt`, `live.m`,
  `sMat`, `sD`).
- **Vector's Effects, Artboards and Guides & Precision** (`vector.js`).
  **Artboards**: `doc.boards` (`{ id, name, x, y, w, h, clear }`, in the
  artwork's own space; the pasteboard runs on past them) and `doc.ab`, the
  active one: `AB()` is what Fit, saving and exporting (`raster`, `svgText`,
  `exportBlob`; `clear` boards save see-through), the rulers, the X and Y
  fields (from its corner) and aligning to the artboard go by. They're drawn
  as `.vec-board`s in `.vec-boards`, and the art's SVG covers `boardsBox()`.
  The Artboard tools (`ABT`) share `H.artboard`: tap a board to make it
  active, drag it (what's on it too, `onBoard`, with Move Artwork,
  `TS.abarr.art`), its handles to size it, the pasteboard for a new one
  (Create Artboard: a tap makes one the size set, `AB_PRESETS`);
  `addBoard`, `dupBoard` (with its art), `delBoard` (never the last),
  `rearrangeBoards` (grid by row or column, a row or a column, a gap),
  `abSize` (from `TS.abresize.ref`). Board drags round to whole pixels.
  **Guides & Precision** (`TS.prec`, kept as the tools' settings):
  rulers (`rulerH`/`rulerV` canvases, `--ruler` wide, `rulersDraw` from
  `applyView` and `changed`, in `UNITS`; drag out of one for a guide,
  `rulerDown`, back onto it to take it away), guides (`doc.guides`,
  `{ o: 'h'|'v', p }`; the Guides tool, `H.guides`), the grid
  (`.vec-gridel`, CSS lines a screen pixel wide, `gridDraw`, behind or in
  front of the art), and snapping: `snapPt(p, excl, touch)` (to anchor
  points, then outlines, then each way on its own to guides, Smart Guides'
  edges and middles, the grid) and `snapBox(box, dx, dy, excl)` (a moved
  box's edges and middle), from `snapTargets` (kept per `ver`). Shapes, the
  Pen, Curvature and the text tools snap where they're placed (`snapsAt`,
  in `down`/`move`/`up`); Selection's and the Move tool's moves, sizing
  and dragged anchors (`grabAnchor`) snap too; what lined up is drawn by
  `precUi` (`ui.smart`, `ui.snapMk`, `--snap`; guides in `--guide`). The
  switches that are tools of their own (`PREC_ON`) turn on when their
  button is pressed (`precPick`), never by a category opening on them;
  `precToggle` (Ctrl/⌘ R, ', ;). Measure (`meas`, `measText`).
  **Live effects** never change the objects: what's drawn, hit and boxed
  is a stand-in from `shownOf(n)` (kept in `SHOWN` by the node's JSON), so
  `nodeSvg`, `cDraw`, `nodeBox`, `hitLeaf` and `outlineOf` all go through
  it (`hasFx`). `n.efx` on a path or group is a warp (`{ k: 'warp', st,
  bend, hd, vd, dir }`, `WARPS`, `warpMap`) or an envelope mesh (`{ k:
  'env', rows, cols, m }`, `envMap`, Catmull-Rom across the mesh; dragged
  with `H.envelope`); not `fx`, which is a picture's flip. A group's `blnd`
  (`{ steps, smooth }`, `blendItems`, `matchPaths`, `blendApp`) or `rep`
  (radial, grid or mirror, `repeatItems`) makes its steps or copies.
  Expand (`expandFx`) makes the stand-in real. Patterns are `doc.pats`
  (`{ id, name, items, gap }`; `patDef` in SVG, `patCanvas` on a canvas).
  An opacity mask is a group with `omask` (`{ inv, clip }`; its top item is
  the mask, `maskSvg`/`maskDraw`); `iso` isolates a group's blending.
  Offset Path (`offsetPath`) and Image Trace (`imageTrace`, `TS.trace`,
  from a picked picture's settings or Quick Options) go through the same
  `traceMask`, `rdp`, `ringToSp` and booleans as the Blob Brush. Effects'
  settings change what's picked when something of their kind is (an undo
  step), the tool's own otherwise (`fxField`'s `ownIf`). Checked on load
  by `sBoards`, `sGuides`, `sPat` (before the layers, so fills can name
  them, `patIds`), `sFx`, `sRep`, and `sPaint` for patterns.
- **Photo mode** (`photo.js`, `window.PaintPhoto`, `PH` in `paint.js`) is the
  third workspace, reached from Settings' Photo mode
  (`data-setting="photo"`; `photo-mode` on `:root`; `setMode`/`askMode` take
  `paint`, `vector` or `photo`, `MODE_NAME`, `modeOk`, `sideHas`). The photo as
  it came is never changed: `doc.blob` is the file (kept in the autosave and,
  as a data URL, in the project file, `photoFrom`), `doc.v` the settings
  (`DEF`: each slider's key; `curve` points, `hsl` per band, `grade`), and
  undo is a stack of snapshots (`record` once per drag, `putBack`). The look
  is worked out on the graphics chip (WebGL 2; `glInit`): the photo a
  texture with its smaller copies, a ~1,024-pixel linear working copy and
  three blurs of it made once (`upload`, `blurOf`; the third of its
  highlights only), then one pass, `DEV`, in floating point: white balance
  and exposure in linear light, a film's matrix or black-and-white mix and
  halation, dehaze, a
  highlight shoulder only once the light is pushed up (with nothing set the
  photo comes out exactly as it went in), noise reduction, texture,
  clarity, sharpening, the tone table (`toneTable`: `PaintFX.toneAt`, the
  very sums Paint's Effects use, then brightness and `PaintFX.curveLut`),
  the colour mixer, vibrance and saturation (Paint's formula), colour
  grading, vignette, grain. Geometry comes first, worked backwards for each
  pixel (`geo`: `u_A` from the place in what the crop keeps, through the
  straightening, filled so no corner shows, `fillZoom`, and Scale; `u_P` the
  perspective; the lens, `u_k`, and the colour fringes, red and blue read a
  touch further in or out; `u_B` the quarter turns, `rot`, and flips, which
  turn the frame, `frameOf`); the saved photo is `outSize`. Crop &
  Straighten is the left bar's third category (`cropping`, `cropHTML`): the
  whole frame shows, `.pho-crop` lit over a dimmed rest (`cropSync`); its
  corners and sides (`cropHit`, `cropSize`, keeping the shape, `aspOf`,
  `ASPECTS`, `aspT` the other way round) and inside are dragged, one step
  each; `turn` goes round or flips the crop with the frame. **Masks** (the
  fourth category, `masksHTML`; `doc.v.masks`, four at most, `checkMasks`):
  each `{ id, kind, name, on, inv, a, g }`, `a` its own settings (`MADJ`,
  added up across masks by how much of each a place takes, `maskW` in
  `DEV`), `g` its shape in the photo's own units (`q`: across the long
  side, `aspQ`), so it stays on what it covers through any crop or turn:
  linear `x0..y1` (full before, none past), radial `cx, cy, rx, ry, ang, fe`,
  brush `st`, strokes kept as points (`s` size, `f` feather, `fl` flow, `er`
  erase) and painted again onto a canvas 1,024 across when they change
  (`brushTex`, `brushRedraw`, `stampSeg`; `brushKey` says when). `toSrc`/
  `toScr` go between the stage and the photo through the same geometry as
  the shader; the picked mask's lines and handles are `.pho-mui` (`mSync`,
  `mHandles`), its red overlay `u_show` (on the screen only, `onScreen`).
  A new linear or radial mask is drawn by the first drag (`mFresh`). The
  brushes' textures are made and sent up on unit 8 (`maskUniforms`), never on
  the unit in use: once, the first brush mask's paint was bound in the tone
  table's place and the photo went black. The red shows only with Show the
  mask on (`mOver`) and steps aside while a mask's own slider is held
  (`mSlide`); painting and moving a mask's shape stay at full detail, only
  sliders work at half. The other masks have pins (`pinOf`): a tap picks
  one. The brush's size slider shows Paint's own brush preview through the
  bridge (`discPreview`, `brushPeek`), and over the photo the brush is
  Paint's ring (`circle.ring`), the size it paints at the zoom. Done keeps
  every mask; they're part of `doc.v`, so back in Masks each is there to
  pick, paint, move and adjust. Crop shapes are worked out from the whole
  frame each time (`aspCrop`: the largest of the shape in its middle), so
  they never shrink one after another, and Original is the whole frame. Only what's in view is drawn (`drawNow`), at
  half the detail while a slider moves (`quick`, cleared on `change`).
  Pressed and held still (or `\` held), the photo shows as it came
  (`before`, the `Original` pill); its pointer handlers stop propagation,
  so the painting's never see them. The panel (`panelHTML`, `panelSync`;
  `data-pk` sliders through `getK`/`setK`, a double-click on a name resets
  it) has the left bar's categories, Edit (sections that fold like
  Effects') and Presets. **Photo's left bar** is one column of six big
  buttons the bar's width (`.pho-group`: the four categories, Fit and the
  panel's toggle `.pho-panelbtn`, which presses the bottom bar's settings
  toggle through the bridge, `settingsBtn`, and mirrors its state; sizes
  `--tool-lg`, `--icon-lg`), then Undo and Redo (`.pho-hist`, Photo's own
  history, `histButtons`), then the zoom; the painting's groups, Layers and
  the bottom bar aren't shown in Photo mode (`--bbar-h` is 0 there, so the
  photo has the room). **The presets** are data in `photo-presets.js`
  (`window.PaintPhotoPresets`: `cats`, Colour and Black & White; `groups`,
  Film stocks and Looks; `list`, each `{ id, name, short, cat, group, v,
  look }`), about 60, the films' notes beside each. The panel shows one tab
  at a time (`ptab`, `[data-ptab]`; switching only changes what's shown,
  never the preset), Original first in each. A film's `look` is what only a
  preset sets (`e.plook`): `mat`, a 3×3 matrix in linear light whose rows
  add to one; `mono`, a black-and-white film's red, green and blue
  sensitivity (both in `DEV` right after exposure); `rgb`, curves per
  channel after the main ones (the tone table is RGBA, a column each). The
  grain (`grain`, `grainSize`, `grainRough`, `grainCol`) is sized from the
  frame, not the pixels, and fades as it gets smaller than an output pixel
  (`u_fp`), so it's the same at any export size; luminance-weighted, hashed
  value noise, so the same every time. Halation (`halation`) is a warm ring
  round the strongest light, from a blur of the highlights only (`T.hl`,
  made in `upload`, read on unit 9). Thumbnails are worked out a few at a
  time (`thumbStep`, 8 ms a frame, nearest the view first, cached per
  `thumbGen`; anything newer drops the queue). A preset is a layer
  of its own over what's set by hand: `doc.v` is the hand's settings and
  `doc.v.preset` the preset's id; everything drawn, saved and shown on the
  sliders is `eff(v)` (each slider the hand's value plus the preset's
  offset from where the slider starts, `offOf`; its curve after the hand's,
  `pcurve`; its mixer added band by band; its grading where the hand's has
  none, `gradeMix`), and a slider moved sets the hand's value so the slider
  shows where it's put (`setK`); a double-click puts the hand's value back.
  So Original takes only the preset off, another takes its place, and what
  was set by hand, before or after, stays. Trying them changes only
  `v.preset` (`presetTry`, thumbnails from `render`); Cancel puts back what
  was there when they opened (`presetBase`), Done is one step. On phones the panel is the strip
  along the top, kept to part of the height, and the photo is fitted into
  the room under it (`free`). Saving (`saveSheet`, `exportBlob`): the full
  size from the photo as it came (`render` into a texture), JPEG with its
  quality (and the original's EXIF, orientation set to 1, `withExif`),
  PNG, WebP, or TIFF (`tiff`, written here), at full or another size.
  Formats a browser can't show natively are named (`kindOf`) and go to
  the decoders on the bridge (`decoders.raw`, `.tiff`, `.heic`; HEIC tries
  the browser's own first), when opened and when kept ones load again; what
  can't be decoded says so in a toast. **The decoders** (`decoders.js`,
  `window.PaintDecoders`: `kind`, `decode`, `raw`, `tiff`, `heic`, each
  giving `{ el, w, h, meta }`) use the libraries in `vendor/` (see its
  README: versions, licences, hashes), each fetched only the first time its
  kind of file is opened (the service worker keeps it from then on): RAW by
  LibRaw (single-threaded WebAssembly in its own module worker; `RAW_SET`:
  the camera's white balance, sRGB with its own curve, `gamm` as a
  `Float64Array`, a plain array isn't read; AHD; brightness LibRaw's own),
  TIFF by UTIF with pako (its largest picture) and HEIC by libheif, both
  in a worker of their own made from a Blob (`inWorker`). Paint and Vector
  take them too: `addPicture` decodes one and adds it as a PNG. Bring to Paint:
  `PH.raster()` on a new layer "Photo"; from Paint or Vector into Photo the
  flat copy becomes the photo (undo brings the last one back).
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
  after any change there. `vector.js` is one scope too (a control builder
  once took the geometry's `seg` name): search it the same way.
- Much of the existing CSS predates this rule and has repeated values. Don't
  refactor it unless asked. Move things onto shared tokens and styles as you
  touch them, and keep unrelated changes out of a task.

## Finishing a task

Once a change is merged and the Pages deploy has finished, the reply to the
owner ends with the link to the live app:
https://eyeseerc0310.github.io/Paint-alternative/

## Testing

The tests live in `tests/` (see `tests/README.md`) and run in Playwright's
Chromium: `tests/run.sh` for everything, or `brushes`, `selection`, `text`, `effects`, `photo`, `panel`, `polish`, `vector`, `regress
[names]`, `lock [modes]`. The paint regressions (`tests/regress/`) print what
they see and are compared with the same suite run on the reference
(`origin/main`, or `REF=`); a line starting with `~` varies between runs and
isn't compared. The layout lock (`layout-lock.js`, its states in
`layout-steps.js`) compares every element's box. Vector's checks
(`tests/vector/`, sharing `vt.js`), the bristle brushes' (`tests/brushes/`),
selecting's (`tests/selection/`), the text tool's (`tests/text/`),
Effects' (`tests/effects/`) and Photo mode's (`tests/photo/`)
pass or fail by themselves, ending `ALL OK`. Tests open the app as
`http://127.0.0.1:8123/index.html` through `lib.js`'s `chromium`, which sends
that to whichever copy is being tested. Run the regressions and the lock
before merging anything on the paint side, add a check to `tests/` with each
new feature, and fix a suite a change breaks rather than leaving it to crash
part-way (a suite that stops early tests nothing after that point).
