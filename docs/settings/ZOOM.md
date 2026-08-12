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
- **Applied:** the popup sets `document.body.style.zoom = zoom / 100` in
  `init()` (`popup/search.js`) before it renders and measures. CSS `zoom` scales
  the entire UI in one line — no per-element font-size math. (Supported because
  the add-on requires Thunderbird `128.0`+ = Firefox 128+.)
- **Window sizing:** after applying zoom, the popup measures its rendered height
  and messages `background.js`, which scales the window **width** (`560 × zoom`)
  and the height clamps (`440 × zoom` … `700 × zoom`), then re-centers the window
  over the parent mail window. Without the width scale, larger zoom would clip
  horizontally against the fixed base width.

## Relevant files

- `lib/options.js` — `zoom` default in `DEFAULT_OPTIONS`
- `options/options.html` / `options/options.js` — the number input, load/save,
  clamp
- `popup/search.js` — applies `body.style.zoom`; sends zoom with the resize
  message
- `background.js` — `resizeSearchWindow` scales width + height clamps and centers
- `_locales/*/messages.json` — the `optionsZoom` label
