# Search popup

The search popup is the main GUI. It's a keyboard-driven folder finder that
opens in its own top-level window (not an anchored toolbar popup) so it can be
sized and focused freely. Type part of a folder name, pick a folder, and the
add-on either **moves** the selected messages there or **jumps** the mail tab to
it.

## Modes

The window opens in one of two modes, passed via the window URL (`?mode=…`) by
`background.js`:

| Mode   | Heading | Enter / primary button does            |
| ------ | ------- | -------------------------------------- |
| `move` | MOVE    | Moves the selected messages to the folder |
| `jump` | JUMP    | Switches the mail tab to the folder    |

The `tabId` of the originating mail tab is also passed on the URL, so the popup
knows which tab to act on without a `currentWindow` query (which would resolve
to the popup's own window).

## Layout

Top to bottom (`popup/search.html`):

- **Heading** — MOVE or JUMP.
- **Input** — the search box; focused immediately on open.
- **Results list** — one row per match; the active row is highlighted, matched
  text shown in `<mark>`. Scrolls internally for long lists.
- **Empty / error** — "no matches" / "no commands", or an error line if the
  move/jump fails.
- **Actions** — Cancel, Jump, Move buttons (the mode's button is `primary`).
  Act on folders only; disabled in command mode.

On open the initial view lists **recent folders** (from
`recentFolders` in `messenger.storage.local`). Typing switches to filtered,
ranked matches over the in-scope folders.

## Keyboard

| Key             | Action                                                    |
| --------------- | --------------------------------------------------------- |
| Type            | Filter folders (or, with a leading `/`, [commands](COMMANDS.md)) |
| Up / Down       | Move the highlight                                         |
| **Tab**         | **Autocomplete the highlighted entry into the input**     |
| Enter           | Activate the highlighted entry (move/jump, or run command)|
| Escape          | Close the popup                                            |
| Mouse click     | Activate that row                                          |

### Tab autocomplete

Tab fills the input with the highlighted entry, then re-filters — it does **not**
execute; press Enter to act. It works in both views:

- **Folder** → the folder's path (the leading `/` is stripped so it stays a
  folder search rather than triggering command mode; `filterFolders` still
  matches it as a substring).
- **Command** → `/name`, plus a trailing space for `/zoom` so a value can be
  typed next.

Plain Tab only. Shift+Tab keeps its default behavior (reverse focus).

## Scope, ranking, display

- **Scope:** by default only folders in the active tab's account are shown;
  `options.searchAllAccounts` (or the `/all` command) widens it to every
  account. Re-scoping (`applyScope()`) reuses the folders already queried — no
  re-query of Thunderbird.
- **Account prefix:** when more than one account is in scope, rows are prefixed
  with the account name (`account: path`) to disambiguate repeated names like
  "Inbox".
- **Ranking:** matches are ordered by `sortByQueryWeight` (`lib/weights.js`),
  which learns from past picks (`queryWeights` / `folderWeights`), so
  frequently chosen folders for a query float up.
- **Matching:** `filterFolders` (`lib/match.js`) does substring matching over
  name/path, honoring `caseSensitiveSearch` and the opt-in `fuzzySearch`.
- **IMAP names:** folder names/paths come back as raw modified UTF-7 (RFC 3501);
  `decodeImapUtf7` decodes them for display and matching. Ids are left untouched.

## Zoom and window sizing

`options.zoom` scales the popup (`document.body.style.zoom`) and the window is
resized to fit its content without the list scrolling. The height is **measured**
from the real, rendered DOM (`measureRequiredWindowHeight()`) — font size, DPI,
and OS text scaling all affect it — then the window chrome overhead is added.
Measured once, after the first render.

The same resize message carries a **placement**: `center` (over the parent mail
window) normally, and `corner` while the input is in
[`/filter`](FILTER_EMAILS.md) mode — there `body.filtering` hides the heading,
the (already disabled) action buttons and every list row but the field hint —
nothing on screen there is a result — and the window shrinks to what is left
(the minimum-height floor is dropped, the width drops to
`SEARCH_WINDOW_CORNER_WIDTH`) and moves to the parent window's bottom-right
corner so it doesn't cover the message list it is filtering.

## Slash commands

A leading `/` switches the list into command mode (settings you can flip from
the keyboard). See [COMMANDS.md](COMMANDS.md) for the full list and mechanics,
and [FILTER_EMAILS.md](FILTER_EMAILS.md) for `/filter`, which narrows the mail
tab's **message** list instead of the folder list.

## Relevant files

- `popup/search.html` — markup (heading, input, list, actions)
- `popup/search.js` — all popup logic: `init`, `applyScope`, `render`,
  `renderCommands`, `activate`, `completeActive` (Tab), `select`, `applyZoom`
- `popup/search.css` — layout, active/disabled rows, light/dark theming
- `lib/match.js` — `filterFolders` (substring matching)
- `lib/weights.js` — `sortByQueryWeight` (learned ranking)
- `lib/folders.js` — `filterByAccount` (scope)
- `lib/imapUtf7.js` — `decodeImapUtf7` (IMAP name decoding)
- `lib/commands.js` — slash-command parsing (see COMMANDS.md)
