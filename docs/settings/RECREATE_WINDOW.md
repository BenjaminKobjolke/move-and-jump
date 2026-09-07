# Recreate window

By default the search window (the move/jump folder picker) is created once and
then **kept alive**: dismissing it only minimizes it, and the next trigger
restores and re-uses the same window. That's fast, but it leaves a taskbar entry
sitting around between uses. **Recreate the search window each time** turns that
off — the window is destroyed on dismissal and built fresh on the next trigger.

## Using it (options page)

Open **Add-ons Manager → Move and Jump → Options** and tick **Recreate the
search window each time (instead of keeping it minimized)**:

- Default **off** (the window is reused).
- Takes effect from the **next dismissal**. Turning it on while a minimized
  window is still around is fine: the next trigger closes that leftover and
  opens a fresh window instead of reusing it.

## What counts as a dismissal

All of them, same as before: **Escape**, the **Cancel** button, clicking away
(the window loses focus), committing a `/filter`, and a completed move or jump.

## Trade-off

- **On:** no lingering taskbar entry, and every open is a brand-new window — on
  some window managers a fresh window takes keyboard focus more reliably than a
  restored one.
- **Off (default):** opening is cheaper, because only a `reset` message is sent
  to an already-running popup instead of loading the page again.

## How it works

- **Stored:** as `recreateWindow` (a boolean) inside the shared `options` object
  in `messenger.storage.local`. Default lives in `DEFAULT_OPTIONS`
  (`lib/options.js`); `getOptions()` merges it over stored values, so no
  migration was needed.
- **Applied (popup):** `hide()` in `popup/search.js` is the single dismissal
  path. With the option on it calls `window.close()` instead of
  `windows.update(..., { state: "minimized" })`. This is allowed because
  `background.js` creates the window with `allowScriptsToClose: true`.
- **Applied (background):** `openSearchWindow` reads the option along with the
  window geometry. With it on, any window still tracked (or recovered by
  `findExistingSearchWindow` after the event page was suspended) is removed with
  `windows.remove` and the reuse branch is skipped, so a normal
  `windows.create` runs. The existing `windows.onRemoved` listener clears
  `searchWindowId` / `searchWindowParent`, so no extra teardown was needed.
- **Everything else is unchanged:** zoom, **Resize the search window to fit the
  results**, and **Center the search window over the mail window** apply to the
  recreated window exactly as they do to a reused one (see
  `docs/settings/ZOOM.md`).

## Relevant files

- `lib/options.js` — `recreateWindow` default in `DEFAULT_OPTIONS`
- `options/options.html` / `options/options.js` — the checkbox, load/save
- `popup/search.js` — `hide()` closes instead of minimizing
- `background.js` — `computeSearchWindowGeometry` returns the flag;
  `openSearchWindow` removes a leftover window and skips the reuse branch
- `_locales/*/messages.json` — the `optionsRecreateWindow` label
