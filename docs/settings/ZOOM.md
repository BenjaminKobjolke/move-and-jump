# Zoom

The search window (the move/jump folder picker) can be scaled up or down with a
**Zoom** setting on the add-on's options page. Handy on high-DPI displays or for
anyone who just wants larger text.

## Using it (options page)

Open **Add-ons Manager → Move and Jump → Options** and set **Zoom (%)**:

- Default `100`. Range `50`–`200`, in steps of `10`.
- Values are clamped to `50`–`200`; a blank or invalid entry falls back to `100`.
- Applies the **next time the search window opens** — it is read at open, not
  pushed to an already-open window.

## What it scales

The whole popup — heading, search box, folder rows, and buttons — scales
together, and the window itself grows/shrinks to match and stays centered over
the mail window.

## How it works

- **Stored:** as `zoom` (a percent) inside the shared `options` object in
  `messenger.storage.local`. Default lives in `DEFAULT_OPTIONS`
  (`lib/options.js`); `getOptions()` merges it over stored values, so no
  migration was needed.
- **Applied:** `background.js` reads `zoom` before opening the window and passes
  it in the popup URL. The popup sets `document.body.style.zoom = zoom / 100`
  **synchronously at the top of `popup/search.js`**, before its first paint — so
  the content is never shown unzoomed and then rescaled. CSS `zoom` scales the
  entire UI in one line — no per-element font-size math. (Supported because the
  add-on requires Thunderbird `128.0`+ = Firefox 128+.)
- **Window reuse:** the search window is created once and then **kept alive** —
  dismissing (Escape, Cancel, select, or click-away) **minimizes** it rather
  than closing it, and the next trigger restores it and sends the popup a
  `reset` message (new mode/tab/`zoom`) which re-applies zoom and re-runs the
  same `init()`. WebExtensions has no hide, so "hidden" = minimized (a taskbar
  entry persists between uses). If the window is closed manually, the next
  trigger recreates it.
- **Window sizing:** because `background.js` knows the zoom up front, it
  **creates** the window already scaled (`560 × zoom` wide, `440 × zoom` min
  high) and centered — no open-time flash. The popup then measures its rendered
  height and messages `background.js`, which re-applies the width scale, the
  height clamps (`440 × zoom` … `700 × zoom`), and re-centers to fit the actual
  content height. Without the width scale, larger zoom would clip horizontally
  against the fixed base width.
- **Fit-to-content toggle:** the options page has a **Resize the search window
  to fit the results** checkbox (`resizeToFit`, default on). When off, the popup
  skips the resize message and the window stays at its base (zoom-scaled) size;
  a taller folder list scrolls internally instead of growing the window.
- **Centering toggle:** **Center the search window over the mail window**
  (`centerOnParent`, default on). When off, `background.js` omits `left`/`top` so
  the platform places the window, and it isn't re-centered after a resize
  (`searchWindowParent` is left null, which the resize path checks).

## Relevant files

- `lib/options.js` — `zoom` default in `DEFAULT_OPTIONS`
- `options/options.html` / `options/options.js` — the number input, load/save,
  clamp
- `popup/search.js` — reads `zoom` from the window URL, applies `body.style.zoom`
  before first paint; sends zoom with the resize message
- `background.js` — `openSearchWindow` reads zoom, creates the window pre-scaled
  and passes zoom in the URL; `resizeSearchWindow` scales width + height clamps
  and centers
- `_locales/*/messages.json` — the `optionsZoom` label
