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
  `--control` (slider and checkbox colour), `--ok`, `--warn`, `--brand` (the
  app icon's blue gradient, also in `icons/icon.svg`), `--panel`, `--panel-solid`,
  `--stage`, `--menu-*` (and `--menu-solid`, the same without the see-through). Shadows: `--shadow-panel`, `--shadow-pop`. Glass:
  `--glass`. Radii: `--r-xs`, `--r-sm`, `--r-btn`, `--r-menu`, `--r-panel`.
  Spacing: `--s-1` to `--s-4`. Type: `--fs-xs`, `--fs-sm`, `--fs`. Icons:
  `--icon`, `--icon-sm`, `--stroke`. Motion: `--dur`, `--ease`. Don't hard-code a colour, radius, shadow or spacing value in a
  component. If a value you need doesn't exist yet, add it as a token
  (spacing, radius, type size, motion and so on) so later features can reuse it.
- **Reuse shared component styles** for the same kind of thing (buttons,
  pills, menus and pop-overs, sheets, segmented controls, sliders, rows),
  rather than writing new one-off rules. Give new components the shared
  classes, and add a variant only when something truly differs.
- **Keep interaction behaviour consistent:** the same hover, pressed
  (slight scale), focus, disabled and selected states everywhere. Selected
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
- **Test in light and dark mode and at phone width** (560px and narrower).
- Much of the existing CSS predates this rule and has repeated values. Don't
  refactor it unless asked. Move things onto shared tokens and styles as you
  touch them, and keep unrelated changes out of a task.
