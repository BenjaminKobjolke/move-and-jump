# Changelog

All notable changes to this project are documented here. Versions
follow [semantic versioning](https://semver.org/) — see
[ARCHITECTURE.md](ARCHITECTURE.md#versioning) for the project's policy.

## [0.2.4] - 2026-07-28

### Fixed

- The search window's fixed height could clip the recent-folders list
  (e.g. showing only 9 of 10 entries), and by how much depended on the
  viewer's font size, DPI, and OS text-scale settings, since the old
  height was a hardcoded pixel guess. The window now measures its own
  rendered content once after the initial view loads and resizes to
  fit, which works the same way regardless of environment because it's
  based on actual measurements rather than an assumed number.

## [0.2.3] - 2026-07-28

### Fixed

- Folder names with non-ASCII characters (e.g. umlauts) on IMAP
  accounts displayed as garbled text like `M&APw-nchen` instead of
  `München` — Thunderbird's `folders` API returns raw, undecoded IMAP
  "modified UTF-7" for such names. Added a decoder (`lib/imapUtf7.js`)
  applied wherever folder names are displayed or searched.

## [0.2.2] - 2026-07-28

### Fixed

- Move/jump failures are no longer silent: `background.js` now
  reports success/failure back to the search window, which shows an
  inline error message and stays open on failure instead of closing
  regardless of outcome.
- A rejected `mailTabs.get(tabId)` call (e.g. if the target tab closed
  at just the wrong moment) no longer takes down the whole popup
  initialization — it now falls back to unscoped folder search.
- The search window's title was the only hardcoded-English string in
  the UI; now routed through i18n like everything else.
- Typo fix in README.md ("developement" → "development").

## [0.2.1] - 2026-07-28

### Changed

- Search window widened from 420×420 to 560×440 to show more of
  nested folder paths, especially with the new account-name prefix.
- The options page now follows the system/Thunderbird dark theme
  instead of always rendering black-on-white.

## [0.2.0] - 2026-07-28

### Added

- Folders whose name exists in more than one account are now prefixed
  with the account name (e.g. `Work: Inbox`) wherever that's
  ambiguous, and the account name is also searchable.
- The search window always shows explicit **Move**, **Jump**, and
  **Cancel** buttons, regardless of which mode it was opened in — the
  one matching the window's mode is the default (what Enter does);
  the other lets you act differently on the highlighted folder.
- The options page now opens with a short explanation of the add-on
  and a live table of the current keyboard shortcuts (reflecting any
  rebinding you've done, not just the shipped defaults).

## [0.1.6] - 2026-07-28

### Fixed

- Keyboard shortcuts opened the search window but couldn't actually
  move or jump: `commands.onCommand` hands the active tab directly to
  its listener, same as `action.onClicked` (fixed in 0.1.3) — the
  keyboard path just hadn't been fixed the same way yet.

## [0.1.5] - 2026-07-28

### Changed

- Default shortcuts changed after real-world conflicts: `Ctrl+Shift+S`
  collided with something outside Thunderbird, and `Ctrl+Shift+G` is
  already a built-in Thunderbird shortcut.
  `move-search`/`move-last`/`jump-search`/`jump-last` are now
  `Ctrl+Shift+N` / `Ctrl+Alt+N` / `Ctrl+Shift+H` / `Ctrl+Alt+H`.

## [0.1.4] - 2026-07-28

### Fixed

- Selecting a folder with Enter (default top MRU entry, or after
  arrow-key navigation) silently did nothing: the window's own
  dismiss-on-blur handler was racing the in-flight move/jump message
  and closing the window before it completed.

## [0.1.3] - 2026-07-28

### Fixed

- Opening the search window via the toolbar button and picking a
  folder didn't move the message: `action.onClicked`'s listener wasn't
  using the tab it's handed directly, and fell back to a tab lookup
  that didn't reliably resolve from that callback.

## [0.1.2] - 2026-07-28

### Changed

- Replaced the toolbar action-popup panel with a real top-level popup
  window (`windows.create`). The panel wasn't reliably taking keyboard
  focus on Linux — the input would show a blinking caret but not
  actually receive keystrokes, which fell through to Thunderbird's own
  single-letter shortcuts underneath.

## [0.1.1] - 2026-07-28

### Fixed

- Keyboard shortcuts did nothing at all: opening the action popup
  awaited a storage write first, which drops the "user gesture" status
  `action.openPopup()` requires when invoked from a command shortcut.

## [0.1.0] - 2026-07-28

### Added

- Initial release: type-ahead search to move the selected email to a
  folder, or jump to a folder, as a lean Manifest V3 MailExtension
  with no runtime dependencies.
- Modifier-based keyboard shortcuts and a toolbar button, an options
  page (case-sensitive search, search all accounts), a shared
  most-recently-used folder list, unit tests for the pure logic in
  `lib/`, a GitHub Actions CI workflow, and localization into English,
  French, German, Spanish, and Simplified Chinese.
- Licensed under PolyForm Noncommercial 1.0.0.
