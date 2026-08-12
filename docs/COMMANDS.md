# Slash commands

The search popup normally filters folders. Typing a leading `/` switches it into
**command mode**: instead of folders, the list shows settings you can flip
without leaving the keyboard-driven popup. Selecting a command applies it,
**clears the input, and keeps the popup open** so you can keep searching or run
another command.

## Available commands

| Command      | Effect                                           |
| ------------ | ------------------------------------------------ |
| `/zoom <n>`  | Set popup zoom to `n`% (clamped **50–200**)      |
| `/fuzzy`     | Toggle [fuzzy search](settings/FUZZY_SEARCH.md)  |
| `/all`       | Toggle search in all accounts                    |
| `/sensitive` | Toggle case-sensitive search                     |

These are the same four settings as the options page — a command just changes
them in place. All changes persist to the shared `options` object in
`messenger.storage.local`, so they stick across popups and match the options
page exactly.

## Using it

- Type `/` alone to list **all** commands (discoverable — no need to memorize
  them).
- Commands prefix-match on name, like folder search: `/a` → `all`, `/s` →
  `sensitive`, `/f` → `fuzzy`, `/z` → `zoom`.
- Each row shows the current state, e.g. `Toggle: Search in all accounts —
  Current: ON`. Selecting it flips the state.
- Select with **Enter** (on the highlighted row) or a **mouse click**, same as a
  folder. Arrow keys move the highlight.
- `/zoom` takes a value: `/zoom 150` applies it in one shot. Without one, the
  row reads `Set zoom — press Enter to edit (current: 100%)`; selecting it
  prefills the input with `/zoom 100` (the current value, preselected) so you
  can overtype and press Enter. Out-of-range values are clamped to 50–200.

After a command runs, the input clears and the list returns to the folder view.

## Note on folder paths starting with `/`

The `/` prefix is reserved for commands, so it can't be used to search a folder
path that begins with `/`. That's harmless: `filterFolders` (`lib/match.js`)
matches any substring of the name/path, so typing the folder name **without**
the leading slash still finds it. No folders become unreachable.

## How it works

- **Parsing:** `lib/commands.js` is a small DOM-free module. `parseCommand(input)`
  strips the leading `/` and splits into `{ token, arg }` (first word is the
  token, the rest is the argument); it returns `null` for non-command input.
  `matchCommands(token)` returns the commands whose name starts with `token`
  (bare `""` matches all). Being DOM-free, it's unit-tested in
  `test/commands.test.js`.
- **Rendering:** `render()` (`popup/search.js`) calls `parseCommand` first; on a
  match it hands off to `renderCommands`, which builds one list row per matching
  command via `commandEntry(command, arg)`. Command rows are plain text (no
  `<mark>` highlight) and disable the Move/Jump buttons.
- **Entries:** the shared `visible` array holds either
  `{ type: "folder", folder }` or
  `{ type: "command", command, arg, label, enabled }`, so keyboard nav and
  selection are the same code for both.
- **Execution:** `activate(entry)` dispatches on `entry.type`. Folders
  move/jump and close the window (unchanged). Commands mutate the in-memory
  `options`, run any side effect (`applyZoom()` for zoom, `applyScope()` for
  `/all` so the folder list is re-scoped), then
  `messenger.storage.local.set({ options })`, clear the input, and re-render —
  the window stays open. A value-less `/zoom` is the one exception: instead of
  applying, it prefills the input with `/zoom <current>` (number preselected)
  and returns early, so the user edits the value and Enter applies it through
  the normal path.
- **Zoom clamp:** `clampZoom` lives in `lib/options.js` and is shared by the
  `/zoom` command and the options page `save()`.
- **Labels:** built with `messenger.i18n.getMessage`; keys `commandZoomSet`,
  `commandZoomHint`, `commandToggle{Fuzzy,All,Sensitive}`, and `onState`/
  `offState` live in `_locales/en/messages.json` (other locales fall back to
  `en`).

## Relevant files

- `lib/commands.js` — `parseCommand`, `matchCommands`, the `COMMANDS` list
- `lib/options.js` — shared `clampZoom`
- `popup/search.js` — `renderCommands`, `commandEntry`, `activate`, `applyScope`,
  `applyZoom`
- `popup/search.css` — `li.disabled` styling for unrunnable command rows
- `_locales/*/messages.json` — command label strings
- `test/commands.test.js` — parse/match unit tests
