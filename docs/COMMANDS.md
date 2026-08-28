# Slash commands

The search popup normally filters folders. Typing a leading `/` switches it into
**command mode**: instead of folders, the list shows settings you can flip
without leaving the keyboard-driven popup. Selecting a command applies it,
**clears the input, and keeps the popup open** so you can keep searching or run
another command.

## Available commands

| Command           | Effect                                                       |
| ----------------- | ------------------------------------------------------------ |
| `/filter <query>` | Filter the displayed **message** list (see below)            |
| `/body`           | Toggle: `/filter` also searches the message body (**Ctrl+B**) |
| `/recipients`     | Toggle: `/filter` also searches To/Cc (**Ctrl+R**)           |
| `/zoom <n>`       | Set popup zoom to `n`% (clamped **50–200**)                  |
| `/fuzzy`          | Toggle [fuzzy search](settings/FUZZY_SEARCH.md)              |
| `/all`            | Toggle search in all accounts                                |
| `/sensitive`      | Toggle case-sensitive search                                 |
| `/columns [name]` | Show/hide message-list columns (Date, From, …)               |

`/columns` is the odd one out: its state belongs to Thunderbird, not to this
add-on (see [Toggling columns](#toggling-columns)).

`/zoom`, `/fuzzy`, `/all` and `/sensitive` are the same four settings as the
options page — a command just changes them in place. `/body` and `/recipients`
have no options-page checkbox; the slash commands are their only UI. All changes
persist to the shared `options` object in `messenger.storage.local`, so they
stick across popups and match the options page exactly.

## Filtering messages

`/filter` is the one command that doesn't act on the popup: it narrows the
**message list of the folder currently displayed in the mail tab**, live as you
type, via Thunderbird's own Quick Filter. Enter hides the popup and leaves the
filter applied; a bare `/filter` clears it. Terms are ANDed and each matches
sender or subject (plus recipients/body when toggled on), so `inn lehrich@theim`
finds a message whose subject contains "Inn" and whose sender contains
"lehrich@theim", and `tom` finds one from `Thomas Lehrich`.

While typing a query, **Ctrl+B** and **Ctrl+R** flip the body and recipient
fields without losing what you typed — the fix for a query that matches nothing.

Full details — fields, semantics, limits — in
[FILTER_EMAILS.md](FILTER_EMAILS.md).

## Toggling columns

`/columns` is two levels deep. Typing `/c` … `/column` shows the usual single
command row; selecting it completes the input to `/columns `. From there the
list is **one row per message-list column** with its current state:

```
Toggle column: Date — Current: ON
Toggle column: Sender — Current: ON
```

Enter (or a click) shows/hides that column immediately and **leaves the popup
open** with the highlight on the same row, so several columns can be flipped in
a row. An argument prefix-filters the list by column name: `/columns da` → just
Date.

Like `/filter`, the popup **gets out of the way** while the column list is up:
heading and buttons are dropped and the window moves to the **bottom-right
corner of the Thunderbird window**, so the thread pane it is changing stays
visible. The column rows themselves stay — they're the list. Leaving columns
mode (backspacing to `/column`, or clearing the input) puts it back in the
middle at full size. Needs *Center on parent window*; with that option off the
popup only resizes and stays where it is.

The state is **persisted by Thunderbird itself**, exactly as if the column had
been ticked in the thread pane's column picker — the add-on stores nothing, and
the options page has no checkbox for it.

If the column list can't be read (no mail tab, or a Thunderbird version whose
internals moved), the row reads `Message list columns — unavailable here` and is
not selectable.

## Using it

- Type `/` alone to list **all** commands (discoverable — no need to memorize
  them).
- Commands prefix-match on name, like folder search: `/a` → `all`, `/s` →
  `sensitive`, `/z` → `zoom`, `/b` → `body`. An ambiguous prefix lists every
  match: `/f` shows both `filter` and `fuzzy` (and filters nothing until the
  name is complete).
- Each row shows the current state, e.g. `Toggle: Search in all accounts —
  Current: ON`. Selecting it flips the state.
- Select with **Enter** (on the highlighted row) or a **mouse click**, same as a
  folder. Arrow keys move the highlight.
- `/zoom` takes a value: `/zoom 150` applies it in one shot. Without one, the
  row reads `Set zoom — press Enter to edit (current: 100%)`; selecting it
  prefills the input with `/zoom 100` (the current value, preselected) so you
  can overtype and press Enter. Out-of-range values are clamped to 50–200.

After a command runs, the input clears and the list returns to the folder view.
`/filter` is the exception: it hides the popup instead, leaving you with the
filtered message list.

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
  `/all` so the folder list is re-scoped, `applyFilter()` for `/body` and
  `/recipients` so the active filter is re-applied with the new fields), then
  `messenger.storage.local.set({ options })`, clear the input, and re-render —
  the window stays open. A value-less `/zoom` is the one exception: instead of
  applying, it prefills the input with `/zoom <current>` (number preselected)
  and returns early, so the user edits the value and Enter applies it through
  the normal path.
- **Message filter:** `applyFilter(query)` calls
  `messenger.mailTabs.setQuickFilter(tabId, ...)`. It runs from the `input`
  listener on every keystroke whose token is exactly `filter` (live filtering),
  and again from `activate()`, which then `hide()`s the window instead of
  clearing the input.
- **Columns:** the one command backed by a **WebExtension Experiment**
  (`experiments/columns/`, wired via `experiment_apis` in `manifest.json`).
  Thunderbird's stable API has no column control — `mailTabs` covers layout,
  panes, sort and the quick filter, but not column visibility — so the
  experiment reaches into the internal `about:3pane` window and does what
  Thunderbird's own column picker does: flip `hidden` on the column, then
  `persistColumnStates()` + `updateColumns()`. That is internal API and may
  break on a Thunderbird upgrade; every access is feature-detected and wrapped,
  and a failure degrades to an empty list (disabled row), never an exception.
  `columns.list(tabId)` / `columns.toggle(tabId, id)` both return the full
  `[{ id, label, hidden }]` list; `popup/search.js` caches it in `columnState`
  (refreshed by `init()`, so window reuse re-reads it) and `renderColumns()`
  turns it into rows. `renderRows()` is the row-building helper shared with
  `renderCommands()`. `updatePlacement()` sends `place: "corner"` for the
  `columns` token too, and marks the body `columns` (heading and buttons hidden,
  rows kept) rather than `filtering` (everything but the hint row hidden). Note that `npm run lint` (Firefox's addons-linter) reports
  `MANIFEST_FIELD_PRIVILEGED` for `experiment_apis` — expected, and not a
  problem for a Thunderbird add-on distributed via ATN.
- **Zoom clamp:** `clampZoom` lives in `lib/options.js` and is shared by the
  `/zoom` command and the options page `save()`.
- **Labels:** built with `messenger.i18n.getMessage`; keys `commandZoomSet`,
  `commandZoomHint`, `commandToggle{Fuzzy,All,Sensitive}`, and `onState`/
  `offState` live in `_locales/en/messages.json` (other locales fall back to
  `en`).

## Relevant files

- `experiments/columns/` — the `/columns` Experiment API (schema + implementation)
- `lib/commands.js` — `parseCommand`, `matchCommands`, the `COMMANDS` list
- `lib/options.js` — shared `clampZoom`
- `popup/search.js` — `renderCommands`, `commandEntry`, `activate`, `applyScope`,
  `applyZoom`, `applyFilter`
- `docs/FILTER_EMAILS.md` — the `/filter` semantics in full
- `popup/search.css` — `li.disabled` styling for unrunnable command rows
- `_locales/*/messages.json` — command label strings
- `test/commands.test.js` — parse/match unit tests
