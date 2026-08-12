# Keyboard shortcuts

Move and Jump ships four keyboard commands. Users can rebind or reset each one
directly on the add-on's options page — no need to dig through Thunderbird's
Add-ons Manager.

## Commands

| Command | Default | Action |
| --- | --- | --- |
| `move-search` | `Ctrl+Shift+N` | Move email: open folder search |
| `jump-search` | `Ctrl+Shift+H` | Jump to folder: open folder search |
| `move-last` | `Ctrl+Alt+N` | Move email to last-used folder (no UI) |
| `jump-last` | `Ctrl+Alt+H` | Jump to last-used folder (no UI) |

Defaults live in `manifest.json` (`commands` block). Descriptions are localized
via `__MSG_command*Description__` keys in `_locales/*/messages.json`.

## Rebinding (options page)

Open **Add-ons Manager → Move and Jump → Options**. Each shortcut row has two
buttons:

- **Record** — click it, then press the new key combo. The binding applies
  immediately and persists across restarts.
- **Reset** — restores that command's manifest default.

### Rules

- A shortcut needs at least one **non-Shift modifier** (Ctrl, Alt, or ⌘). Shift
  alone is rejected — Thunderbird can't bind bare or Shift-only keys.
- `Escape` while recording cancels without changing anything.
- If Thunderbird rejects a combo (already in use, or unsupported), an inline
  error appears and nothing changes.

## How it works

The options page uses the native WebExtension commands API — there is **no
custom keymap storage**:

- `messenger.commands.update({ name, shortcut })` sets a binding. Thunderbird
  validates the format, throws on bad input, and persists the override itself.
- `messenger.commands.reset(name)` restores the manifest default.
- `messenger.commands.getAll()` reads current state to render the table.

Because Thunderbird persists overrides natively, nothing is mirrored into
`storage.local` and there is no re-apply step on startup.

### Key-string mapping

`options/options.js` converts a `keydown` event into a Thunderbird shortcut
string:

- Modifiers: `ctrlKey` → `Ctrl` (`MacCtrl` on macOS), `metaKey` → `Command`
  (macOS only), `altKey` → `Alt`, `shiftKey` → `Shift`.
- Keys: single characters uppercased; `F1`–`F12` pass through; arrows and space
  mapped via `KEY_ALIASES` (`ArrowUp` → `Up`, etc.).
- Anything the format still rejects (e.g. `,` wants `Comma`) surfaces as an
  error from `commands.update` — the API is the source of truth, so full format
  validation is not reimplemented.

## Relevant files

- `manifest.json` — command names + default keys
- `options/options.html` / `options/options.js` / `options/options.css` — the UI
- `background.js` — `commands.onCommand` dispatcher (unchanged by rebinding)
- `_locales/*/messages.json` — command descriptions + options-page strings
