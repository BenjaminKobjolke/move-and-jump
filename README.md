# Move and Jump

Add-on for Thunderbird that provides keyboard shortcuts
to quickly move mail to a folder that is identified using
type-ahead search, and that also enables users to quickly
jump to a folder which is also identified by type-ahead
search.

This is a modern rewrite of the venerable [Nostalgy][] and
[Nostalgy++][] extensions. It is by no means feature complete
in comparison to the existing add-ons.

## Functions

Note on shortcuts: Thunderbird's WebExtension `commands` API requires
at least one modifier key, so bare-letter shortcuts like Nostalgy's
plain <kbd>s</kbd>/<kbd>g</kbd> aren't available without falling back
to legacy, privileged code. The defaults below can be changed to
whatever you like under *Add-ons Manager → gear icon → Manage
Extension Shortcuts*.

### Move an email to a folder

Press <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>N</kbd> to open a search
box. Begin typing the desired folder name or parts of it. A list of
search results updates automatically as you type. Press
<kbd>ENTER</kbd> to accept the selected folder and move the email.

You may also just press <kbd>ENTER</kbd> without typing anything to
move the email to the first of the 10 most recent target folders, or
navigate the list using the <kbd>UP</kbd> and <kbd>DOWN</kbd> keys to
select one of those folders.

Press <kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>N</kbd> to move the email to
the last used folder directly, without opening the search box. This
last used folder is shown in the toolbar button's tooltip.

### Jump to a specific folder

Press <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>H</kbd> to open the search
box, and start typing the name (or parts of the name) of the desired
folder. Hit <kbd>ENTER</kbd> to accept the folder and go to it.

The list of the 10 most recent folders is shared between the
'move' and the 'jump' functions, and you can accept the most
recent one, or navigate the list in the same way as when
moving an email.

Press <kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>H</kbd> to jump directly to
the most recent folder, shown in the toolbar button's tooltip.

## Options

There currently is only a limited set of user preferences:

Preference                | Default
--------------------------|----------
Case-sensitive search     | off (search is case-insensitive)
Search in all accounts    | on (folders from all accounts are being listed)

## Installation

This add-on isn't published on [addons.thunderbird.net](https://addons.thunderbird.net)
yet, so install it from a locally built package:

```sh
npm install
npm run build   # produces web-ext-artifacts/move-and-jump-<version>.xpi
```

Then in Thunderbird: *Add-ons Manager* (hamburger menu → Add-ons and
Themes) → gear icon → **Install Add-on From File…** → select the
`.xpi`. Unlike Firefox, stock Thunderbird ships with add-on signature
enforcement **off** by default, so this works without touching
`about:config`. (If your build/distro has it turned on and installation
is refused, set `xpinstall.signatures.required` to `false` in
`about:config`, restart, and try again.)

This installs it as a regular, persistent add-on — it survives
restarts and updates like any other, it just won't auto-update itself;
building and reinstalling a new `.xpi` is how you pick up new versions
for now.

## Localization

The UI is available in English (default), French, German, Spanish, and
Simplified Chinese, matching Thunderbird's own display-language
setting automatically. The non-English strings (`_locales/*/messages.json`)
were translated by Claude and haven't been reviewed by native speakers —
corrections via PR are welcome.

## Development

This is a dependency-free WebExtension (Manifest V3); the only
tool involved is [web-ext][] for running, building, and linting it.

```sh
npm install
npm start   # launches Thunderbird with the add-on loaded (expects
            # `thunderbird` on PATH; override with
            # `npm start -- --firefox-binary /path/to/thunderbird`)
npm test    # runs the unit tests (Node's built-in test runner)
npm run lint   # validates manifest.json and source with web-ext lint
npm run build  # packages a .xpi into web-ext-artifacts/
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the add-on is put
together and why. A GitHub Actions workflow
([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs the same
three commands (test, lint, build) on every push and pull request.

## Contributing to developement

Pull requests are welcome.

This add-on is being co-authored by Claude Code (Sonnet 5).

## License

[PolyForm Noncommercial 1.0.0](LICENSE). True permissive licenses
(MIT, BSD, Apache) can't forbid commercial use, so this add-on uses
a noncommercial source-available license instead: you may freely
use, modify, and redistribute it for any noncommercial purpose;
commercial use requires a separate arrangement with the copyright
holder.

[Nostalgy]: https://github.com/nostalgy/nostalgy
[Nostalgy++]: https://github.com/opto/nostalgy-xpi
[web-ext]: https://github.com/mozilla/web-ext
