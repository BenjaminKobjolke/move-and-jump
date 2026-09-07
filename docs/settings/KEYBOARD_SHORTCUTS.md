# Keyboard shortcuts

Move and Jump ships five keyboard commands, and each one can carry **two
independent bindings**:

| Kind | Example | Backed by |
| --- | --- | --- |
| **Shortcut** | `Ctrl+Shift+N` | Thunderbird's `commands` WebExtension API |
| **Single key** | `s`, `Shift+G` | the `experiments/keys/` Experiment |

Both are set on the add-on's options page — no need to dig through Thunderbird's
Add-ons Manager. A command can have one, the other, or both at once; they do not
replace each other.

## Commands

| Command | Default shortcut | Action |
| --- | --- | --- |
| `move-search` | `Ctrl+Shift+N` | Move email: open folder search |
| `jump-search` | `Ctrl+Shift+H` | Jump to folder: open folder search |
| `move-last` | `Ctrl+Alt+N` | Move email to last-used folder (no UI) |
| `jump-last` | `Ctrl+Alt+H` | Jump to last-used folder (no UI) |
| `filter-search` | *(none)* | Open the popup in [`/filter`](../FILTER_EMAILS.md) mode |

No command ships with a default **single key** — that column starts empty.
Picking a letter is left to you, because most plain letters already mean
something in Thunderbird (see *Shadowing* below).

`filter-search` ships **unbound** on purpose: the obvious keys near the quick
filter (`Ctrl+Shift+K`, `Ctrl+Shift+F`) already mean something in Thunderbird, so
picking one is left to you — Record it on the options page. Everything it does is
also reachable by typing `/filter` in a popup opened with any of the other
shortcuts.

Defaults live in `manifest.json` (`commands` block). Descriptions are localized
via `__MSG_command*Description__` keys in `_locales/*/messages.json`. The command
names are also listed in `lib/keys.js` as `COMMAND_NAMES`, so the background can
filter stored single keys without an API round-trip on every wake-up;
`test/keys.test.js` asserts the two lists stay equal.

## Rebinding (options page)

Open **Add-ons Manager → Move and Jump → Options**. Each command is one table
row with a *Shortcut* cell and, when the experiment loaded, a *Single key* cell:

- **Record** — click it, then press the combination. It applies immediately and
  persists across restarts.
- **Reset** (Shortcut column) — restores that command's manifest default.
- **Clear** (Single key column) — removes the binding.
- `Escape` while recording cancels without changing anything.

### Which column takes what

- A **Shortcut** needs at least one non-Shift modifier: `Ctrl`, `Alt`, or `⌘`
  (`MacCtrl`/`Command` on macOS). Record a bare key here and the page points you
  at the other column instead of just refusing.
- A **Single key** is a letter or a digit, optionally with `Shift` — `s`, `7`,
  `Shift+G`. It takes no `Ctrl`/`Alt`/`⌘`; those belong in the Shortcut column.
- One letter cannot serve two commands. Recording a key another command already
  holds is refused, and the message names that command so you know what to clear.

### Why single keys are letters and digits only

Thunderbird can *spell* far more keys than that — `Comma`, `Space`, `Up`, `F5` —
and the Shortcut column accepts all of them. The single-key listener cannot: it
matches a binding by uppercasing the raw `event.key`, so `,` arrives as `","`
while the stored binding reads `"Comma"`, and `F5` is two characters and never
looks up at all. Such a binding would record, display, and then silently never
fire, so `validateSingleKey()` in `lib/keys.js` refuses it up front. Widening the
set means teaching `experiments/keys/implementation.js` the same aliases first.

### Avoid `Alt`+letter for Shortcuts

The `commands` API accepts `Alt+S` — one non-Shift modifier is enough — but on
Windows and Linux the menu bar claims `Alt`+letter for its access keys (File,
Edit, View, **Go**, Message, Tools, Help, localized), even with the menu bar
hidden. The shortcut registers and the handler is simply never called.

## Single keys in practice

- **Quiet while typing.** The listener runs ahead of the focused element, so it
  has to ask: a keystroke landing in an `<input>`, `<textarea>`, the quick filter
  (`search-bar`), a contenteditable, or a document in `designMode` is left alone.
  The full tag list is `TEXT_ENTRY_TAGS` in the experiment.
- **Shadowing.** The listener runs in the capture phase and calls
  `preventDefault()`, so a single key *wins* over Thunderbird's own binding for
  the same letter. That is deliberate — it is what makes Nostalgy's `s`/`g`
  possible — but it is a surprise, so recording a key that collides shows a
  warning naming what it shadows (`s` is Thunderbird's *mark as flagged*).
- **Autorepeat is ignored.** Holding the key fires the command once, not once per
  repeat.
- **Not inside a message body.** A rendered message is a remote `<browser>`; its
  keystrokes never reach the chrome window, so a single key does not fire while
  the focus is in the message text. Thunderbird's own letters still do.
- **It can go away.** The experiment reaches into Thunderbird internals. If a
  release moves them, the *Single key* column disappears and the options page
  says single keys are unavailable — the modifier shortcuts are unaffected.

## How it works

### Shortcuts: the native API, no custom storage

- `messenger.commands.update({ name, shortcut })` sets a binding. Thunderbird
  validates the format, throws on bad input, and persists the override itself.
- `messenger.commands.reset(name)` restores the manifest default.
- `messenger.commands.getAll()` reads current state to render the table.

Because Thunderbird persists overrides natively, nothing is mirrored into
`storage.local` and there is no re-apply step on startup.

### Single keys: stored by the add-on, installed by the Experiment

`commands` cannot express them at all — `ShortcutUtils.validate()` returns
`MODIFIER_REQUIRED` for anything whose only modifier is Shift, or that has none —
so this half is the add-on's own:

1. The options page writes `options.singleKeys` (command name → shortcut) to
   `storage.local`.
2. `background.js` watches `storage.onChanged`, and also runs `applySingleKeys()`
   at every start, including the wake-ups after the event page is suspended — the
   Experiment holds the bindings in memory only.
3. `applySingleKeys()` calls `messenger.keys.register(bindings)`, which replaces
   the whole set.
4. `experiments/keys/implementation.js` listens for `keydown` in the capture phase
   on every `messenger.xhtml` window and emits `keys.onCommand(id, tabId)`.
5. `background.js` routes both that and `commands.onCommand` through the same
   `dispatchCommand()`.

When the keypress arrives while the background is asleep, the Experiment calls
`extension.wakeupBackground()` and waits briefly (20 × 25 ms) for it to
re-register before delivering.

`messenger.keys` is read **once, in a `try`/`catch`**, in both `background.js` and
`options/options.js`: an experiment namespace that failed to register does not
read back as `undefined` — the property access itself throws, and an unguarded one
at module scope takes down the whole background and the whole options page.
`test/guards.test.js` covers exactly that. See
[ARCHITECTURE.md](../../ARCHITECTURE.md#single-key-shortcuts) for the measurements
behind the design, including why XUL `<key>` elements do not work.

### Key-string mapping

`lib/keys.js` converts a `keydown` event into a Thunderbird shortcut string, and
is unit-tested in `test/keys.test.js`:

- `shortcutFromEvent(event, { isMac })` — modifiers `ctrlKey` → `Ctrl` (`MacCtrl`
  on macOS), `metaKey` → `Command` (macOS only), `altKey` → `Alt`, `shiftKey` →
  `Shift`; then the key from `mapKey()`.
- `mapKey(key)` — single characters uppercased; `F1`–`F12` pass through; the rest
  via `KEY_ALIASES` (`ArrowUp` → `Up`, `" "` → `Space`, `","` → `Comma`, `"."` →
  `Period`). Anything else returns `null`.
- `hasPrimaryModifier(shortcut)` — tells the two columns apart. Shift alone counts
  as *no* primary modifier, because that is exactly the case `commands.update`
  rejects.
- `validateSingleKey(shortcut)` — `"has-modifier"`, `"invalid-key"`, or `null`
  when usable.

For the Shortcut column the `commands` API stays the source of truth: a format it
still rejects surfaces as an error from `commands.update` rather than being
re-validated here.

## Relevant files

- `manifest.json` — command names, default keys, and the `keys` experiment entry
- `lib/keys.js` — key-string mapping and validation (pure, unit-tested)
- `experiments/keys/` — `schema.json` + `implementation.js`, the single-key listener
- `options/options.html` / `options/options.js` / `options/options.css` — the UI
- `background.js` — `dispatchCommand()`, plus `applySingleKeys()` and the
  `keys.onCommand` listener
- `_locales/*/messages.json` — command descriptions + options-page strings
