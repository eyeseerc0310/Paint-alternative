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
  `--text`, `--muted`, `--line`, `--accent`, `--accent-hover`,
  `--accent-soft`, `--hover`, `--hover-strong`, `--selected`, `--outline`,
  `--control` (slider and checkbox colour), `--ok`, `--warn`, `--danger` (deleting for good), `--seg-on` (the picked part of a segmented control), `--brand` (the
  app icon's blue gradient, also in `icons/icon.svg`), `--panel`, `--panel-solid`,
  `--stage`, `--menu-*` (and `--menu-solid`, the same without the see-through). Shadows: `--shadow-panel`, `--shadow-pop`. Glass:
  `--glass`. Radii: `--r-xs`, `--r-sm`, `--r-btn`, `--r-menu`, `--r-panel`, `--r-sheet`.
  Spacing: `--s-1` to `--s-4`. Type: `--fs-xs`, `--fs-sm`, `--fs`. Icons:
  `--icon`, `--icon-sm`, `--stroke`. Motion: `--dur`, `--dur-slow`, `--ease` (reduced motion is honoured for all of them by one rule at the end of `style.css`). Don't hard-code a colour, radius, shadow or spacing value in a
  component. If a value you need doesn't exist yet, add it as a token
  (spacing, radius, type size, motion and so on) so later features can reuse it.
- **Reuse shared component styles** for the same kind of thing (buttons,
  pills, menus and pop-overs, sheets, segmented controls, sliders, rows),
  rather than writing new one-off rules. Give new components the shared
  classes, and add a variant only when something truly differs.
- **Keep interaction behaviour consistent:** the same hover, pressed
  (slight scale), focus, disabled and selected states everywhere. Hover
  styles go inside `@media (hover: hover)`, so a tap on a touch screen
  doesn't leave one behind. Selected
  tools and list items use a neutral rounded outline, not the accent.
  The accent (red) is for primary actions (Save, Done, Create) and the
  chosen colour.
- **Where controls live:** the top bar has the document actions
  (new/open/save/share, image, history, layers, focus, help, theme; on phones
  the extras go in its ••• menu) and the saved-status dot. The left bar holds
  the tools in groups. The right bar holds colour, then size and opacity for
  the tool in hand (in sections that fold), then undo/redo, then zoom. A tool's own
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
- **Opening:** `.app-splash` (in `index.html`) shows the app's mark until
  the drawing is back (`opened()`, called when `restore` is done).
- **Test in light and dark mode and at phone width** (560px and narrower).
- Much of the existing CSS predates this rule and has repeated values. Don't
  refactor it unless asked. Move things onto shared tokens and styles as you
  touch them, and keep unrelated changes out of a task.
