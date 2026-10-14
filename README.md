# Paint Alternative

A painting app like MS Paint that runs in the browser, with a clean,
Apple-style look. Everything is drawn on your own device and nothing is
uploaded.

**Live:** https://eyeseerc0310.github.io/Paint-alternative/

## What it does

- **Brushes:** round, feather, marker, pencil, spray (a soft airbrush mist),
  calligraphy and highlighter, drawn from smoothed strokes with tapered ends
  (Apple Pencil pressure works). Sizes from 1 to 500; the size preview shows
  exactly what one tap puts down. **Smoothing** steadies wobbly lines, and
  holding still at the end of a stroke **snaps it to a shape** (line,
  ellipse, circle or rectangle; hold Shift for a circle or square).
  **Tapered ends** can be switched off for lines of even thickness
- **Layout:** document actions and a saved status in the top bar, the tools
  in groups on the left, colour, size, opacity, undo/redo and zoom on the right,
  and a **tool panel** at the picture's left edge with the settings of the tool
  in hand (the brush, smoothing and taper; shape and fill; font, size, style
  and alignment) or what can be done with a selection. The tool panel folds
  down to one button, panels can be dragged aside, sections folded, and **Focus mode** (`\`) hides everything but the
  picture
- **Text layers:** text goes on a layer of its own and stays editable: tap
  the words with the text tool to change them, or drag before typing to make
  a box the words wrap inside. Move them, size them and turn them with Move,
  and they're still words; merging one down (or Turn into Image) makes it
  paint. Painting while a text layer is picked goes on a new layer above it
- **Move:** picks up everything on the layer, ready to move, size or turn
- **Pen:** click to place points, drag to make curves, click the first point
  to close; drawn as an outline, filled, or both
- **Text:** 57 fonts (sans, serif, display, handwriting, monospace), and an
  **Aa** button while typing for size, bold, italic, underline, capitals,
  alignment, letter spacing, line height, outline and shadow
- **Tools:** eraser, smudge, blur, line, shapes, pen, fill, gradient, text, select,
  move, cutout, magic wand, colour picker, hand, and light & dark
- **Symmetry:** vertical, horizontal, quadrant and radial (2 to 16 segments,
  optionally mirrored), set in the tool panel; drag the guide's centre to move it and its handle to
  turn it
- **Colour picker:** a hue ring and saturation/brightness square, sliders,
  HEX / RGB / HSB values, recent colours, and ready-made and your own
  palettes, colour harmonies, and palettes made from a photo (tap either main
  colour; dragging one still fills)
- **Fill** runs right up under the soft edge of a line, with no pale ring
- **Selections** can be moved, resized and turned (the round handle on top)
- **Touch:** two-finger tap to undo, three-finger tap to redo, pinch to zoom,
  twist two fingers to turn the canvas
- **Project files** (Save → Project): every layer and its settings in one
  `.paint` file, to open again on any device
- **Effects:** for a layer or a selection, in sections that fold: Light
  (exposure, brilliance, contrast, highlights, shadows, whites, blacks),
  Levels, Curves, Hue & Saturation, White Balance, Gradient Map (presets or
  your two colours, with strength and reverse), Detail (sharpen, clarity,
  grain) and Finish (vignette, fade)
- **Colour picker loupe:** hold the picker (or Alt) to see the pixels close
  up, with the new colour against the one in hand; let go to pick it
- **Layers:** as many as the memory allows for the picture's size (up to
  50), each with a live preview, its own opacity and blend mode, and a •••
  menu: select, rename, duplicate, merge down, masks, alpha lock, clipping
  mask, hide, move and delete
- **Layer masks:** paint on a layer's mask to hide parts of it without
  rubbing anything out (black hides, white shows, the eraser brings it
  back); add one from a selection, invert it, apply it or delete it
- **Groups:** put layers in a folder, fold it shut, hide it, fade or blend
  it as one, move it, merge it into one layer or ungroup it
- **Drag any colour** (a swatch, a recent one or either main colour) onto the
  picture to fill an area
- **Picture size:** New Picture with presets (square, 16:9, A4, Instagram…)
  or any size up to 4096 pixels a side
- **Crop, rotate and flip** the whole picture
- **Pictures in:** open one, paste one (⌘/Ctrl+V) or drag one onto the page
- **History:** see every step and jump back to any of them
- **Keyboard shortcuts:** press **?** to see them all
- **Save** as PNG or JPEG, or **Share** straight to Messages, Photos, Mail…
- **Install it as an app:** it works offline, and keeps your drawing between
  visits

## Files

- `index.html`, `style.css`, `paint.js`: the app
- `manifest.webmanifest`, `sw.js`, `icons/`: installing and working offline

Published with GitHub Pages from the `main` branch.
