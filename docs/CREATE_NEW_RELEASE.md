# Creating a new release

This is the authoritative recipe for shipping **Move and Jump**. Every step
below is a real command in this repository; `/release:create-release` follows
this file rather than its own generic defaults.

## Release label: plain semver, no build counter

The release label **is** the version in `manifest.json` — e.g. `1.4.3`. There
is no `build_version.txt` and no `<version>_<build>` label, because nothing
downstream could show a build number anyway: the `.xpi` filename, the git tag,
the GitHub release, and the addons.thunderbird.net listing are all keyed on the
semver version alone.

`manifest.json` is the **single source of truth**. `package.json`'s `version` is
kept in lockstep by the version tool purely so it can't drift again (it sat at
`1.2.0` while the add-on shipped `1.4.2`); nothing reads it.

> **Mapping to the generic `/release:create-release` workflow:** where that
> workflow says "read the build number and ship `currentBuild + 1`", this
> project reads the version and ships the **next patch version**. Its
> "increment the build number" step is `tools\windows\version_bump.bat`.

## 1. Get the current version

```bat
tools\windows\version_get.bat
```

Prints e.g. `1.4.2`. (Equivalent: `node tools/version.mjs get`.)

## 2. Compute the next label

`<nextLabel>` = the next **patch** version by default — `1.4.2` becomes `1.4.3`.

Use a minor or major bump instead when the change warrants it under the
project's versioning policy
([ARCHITECTURE.md](../ARCHITECTURE.md#versioning)); pass the level to the bump
bat in step 5.

## 3. Write the release notes (English only)

Create the folder for the **next** label and author **only `en.json`** in it:

```
release_notes/<nextLabel>/en.json      e.g. release_notes/1.4.3/en.json
```

The folder name is the bare version — no `v` prefix, no build suffix — so it
matches `manifest.json`, the tag minus its `v`, and the `.xpi` filename.

Schema:

```json
{
  "version": "1.4.3",
  "date": "2026-09-07",
  "title": "Single-key shortcuts",
  "notes": [
    "Every command can now also be bound to a bare key, set on the options page.",
    "New /go command jumps straight to an account's inbox."
  ]
}
```

- **`notes`** is the actual release-notes text: an array of short, user-facing
  bullets. This is the key the in-app view renders.
- `title` is a one-line headline for the release.
- `date` is the release date, `YYYY-MM-DD`.
- `version` repeats the label so a notes file is self-describing.

Source material: the `## [Unreleased]` section of
[CHANGELOG.md](../CHANGELOG.md). Release notes are user-facing and much shorter
than the changelog — rewrite, don't paste.

**Do not hand-write `de.json`, `es.json`, `fr.json` or `zh_CN.json`.** Step 4
generates them.

## 4. Translate the release notes — MANDATORY, DO NOT SKIP

```bat
tools\windows\translate_release_notes.bat
```

This is a required step of every release. Without it the new release ships with
English-only notes while the rest of the add-on is localised, and the in-app
view silently falls back to English for four of the five UI languages.

The bat wraps **GPT-json-translator**
(`D:\GIT\BenjaminKobjolke\GPT-json-translator`) in recursive mode: it walks
`release_notes\`, finds every folder that has an `en.json` but is missing
locales, and fills in `de.json`, `es.json`, `fr.json` and `zh_CN.json` beside
it. It is incremental (only missing keys hit the API) and idempotent, so
re-running it is safe and cheap.

The locale codes are passed explicitly (`--languages="de,es,fr,zh_CN"`) because
the translator names each output file after the code it is given, and those
names must match the directories in `_locales\`. If a UI language is ever added
or removed, update that list in the bat as well.

After it finishes, confirm the folder holds all five files:

```
release_notes/1.4.3/
  en.json  de.json  es.json  fr.json  zh_CN.json
```

## 5. Bump the version

```bat
tools\windows\version_bump.bat            :: patch  1.4.2 -> 1.4.3
tools\windows\version_bump.bat minor      :: 1.4.2 -> 1.5.0
tools\windows\version_bump.bat major      :: 1.4.2 -> 2.0.0
```

Rewrites the `version` value in `manifest.json` and `package.json` in place
(formatting and key order survive) and prints the new version. It must match the
`release_notes/<nextLabel>/` folder name from step 3.

To roll a bump back after a failed build:

```bat
tools\windows\version_set.bat 1.4.2
```

Also move the `## [Unreleased]` block in [CHANGELOG.md](../CHANGELOG.md) under a
`## [<nextLabel>]` heading as part of this step.

## 6. Build

```bat
tools\windows\build_xpi.bat
```

Runs `npm run build -- --overwrite-dest` (i.e. `web-ext build`) and produces:

```
web-ext-artifacts/move-and-jump-<nextLabel>.xpi
```

Before building, run the same checks CI does:

```sh
npm test        # node --test test/*.test.js
npm run lint    # web-ext lint
```

**Release notes are bundled automatically.** `web-ext build` packages
everything not listed in `ignoreFiles` in
[web-ext-config.cjs](../web-ext-config.cjs), and `release_notes/` is
deliberately *not* ignored — the JSON files ship inside the `.xpi`, where the
in-app view reads them with `fetch()`. The development-only trees (`docs/`,
`claude-plans/`, `tmp/`, `tools/`, `test/`) *are* ignored; if you add a new
non-shipping directory to the repo, add it there too or it will ride along into
the add-on.

No Windows installer and no local code-signing handshake apply here: the
artifact is a `.xpi`, and it is signed by addons.thunderbird.net during
publishing (step 7), not on this machine.

## 7. Publish

Publishing is **tag-driven**, so there is no separate publish bat. Commit the
release, tag it with an **annotated** tag, and push:

```sh
git add -A
git commit -m "RELEASE (extension): <nextLabel>"
git tag -a v<nextLabel> -m "<the release headline and bullets>"
git push
git push --tags
```

Pushing the `v*.*.*` tag triggers
[.github/workflows/release.yml](../.github/workflows/release.yml), which:

1. verifies the tag matches `manifest.json`'s version (a mismatch fails the run
   before anything is published);
2. runs `npm test`, `npm run lint`, `npm run build`;
3. creates a **GitHub release** whose body is the tag's own annotation message,
   with the `.xpi` attached.

### addons.thunderbird.net publishing is currently DISABLED

The workflow still contains the ATN step — sign and submit as a listed add-on,
using the `ATN_API_KEY` / `ATN_API_SECRET` repo secrets — but it is turned off
with `if: false`. **Releases go to GitHub only.** To resume publishing to ATN,
flip that `if:` back to true (or delete the line); nothing else needs changing.

While it is off:

- the `.xpi` attached to the GitHub release is **unsigned**, so installing it
  requires `xpinstall.signatures.required` = `false` in `about:config` (see
  [README.md](../README.md#installation));
- installs from the GitHub `.xpi` do **not** auto-update — ATN is what feeds
  Thunderbird's update check, so each release has to be installed by hand;
- the public ATN listing stays frozen at whatever version was last published
  through it.

Two consequences worth remembering:

- The tag **must be annotated** (`git tag -a … -m …`). A lightweight tag has no
  message, so the GitHub release body comes out empty.
- The tag message is user-facing. Reuse the `title` and `notes` from
  `release_notes/<nextLabel>/en.json`.

Nothing is published until the tag is pushed, so a build can be inspected and
discarded without consequence.

## 8. In-app release notes view — `/whatsnew`

> **Status: planned, not yet implemented.** Everything above works today; this
> section is the agreed design so the release notes have a destination inside
> the add-on. Until it ships, `release_notes/*.json` are bundled in the `.xpi`
> but nothing renders them.

The view lives in the **search popup** as a slash command, `/whatsnew`,
alongside `/columns`, `/filter` and `/go` — see
[docs/COMMANDS.md](COMMANDS.md).

### How it will work

- `/whatsnew` shows the **newest release first**: title, date, and one row per
  `notes` bullet.
- Back/forth navigation moves through older releases — the popup is a
  keyboard-first surface, so this is a pair of rows (or `←`/`→`), not a
  scrolling document.
- The locale is `messenger.i18n.getUILanguage()`, with a fallback chain of exact
  code, then base language, then `en.json`, so a release whose translation is
  missing still renders.

### Implementation plan

1. **Ship an index.** `fetch()` cannot list a directory inside an `.xpi`, so the
   set of releases has to be enumerable. Add `release_notes/index.json` — a
   newest-first array of version strings — written by a small step in
   `tools/version.mjs` (`node tools/version.mjs index`) and called from
   `version_bump.bat`, so it can never drift from the folders on disk. This is
   the one piece of new plumbing the feature needs.
2. **Register the command** in [lib/commands.js](../lib/commands.js):
   `{ name: "whatsnew" }`. It takes no argument.
3. **Load and render** in [popup/search.js](../popup/search.js): a
   `renderWhatsNew(offset)` alongside the existing `renderColumns` / `renderGo`,
   reading `release_notes/<index[offset]>/<locale>.json` and falling back to
   `en.json` on a failed fetch. Reuse the `/columns` pattern of a command that
   keeps the popup open and re-renders in place.
4. **Locale strings** for the command description and the Older/Newer rows go in
   `_locales/en/messages.json`, then through the add-on's usual translation
   pass.
5. **Test** the version-independent part — index ordering and the locale
   fallback chain — in `test/`, matching the existing `node --test` files.

Sort releases by parsed semver components, not string order, so `1.10.0` lands
after `1.9.0`.
