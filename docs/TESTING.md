# Testing

## Unit tests

Pure logic (matching, ranking, options, slash-command parsing, IMAP UTF-7) is
covered by plain [`node:test`](https://nodejs.org/api/test.html) suites in
`test/`. No framework, no build step — just Node.

```sh
npm test
```

Runs `node --test "test/*.test.js"`. Each `test/<name>.test.js` file exercises
the matching `lib/<name>.js` module (e.g. `test/commands.test.js` →
`lib/commands.js`). Node ≥ 18 is required.

To run a single file:

```sh
node --test test/commands.test.js
```

These tests are DOM-free by design — anything touching `popup/search.js`,
`messenger.*`, or the browser is verified manually (below).

## Lint

`web-ext lint` checks the extension against the add-on validator:

```sh
npm install   # once, to fetch web-ext
npm run lint
```

## Manual testing in Thunderbird

`npm run lint`/`npm test` don't exercise the popup UI. To try the real add-on:

```sh
npm install   # once
npm start     # web-ext run — launches Thunderbird with the add-on loaded
```

Or load it by hand: **Add-ons Manager → gear → Debug Add-ons → Load Temporary
Add-on** and pick `manifest.json`.

Then check the interactive paths, e.g.:

- Move/jump: open the popup, type part of a folder name, Enter or click a row.
- Slash commands: type `/` (all four appear), `/a`, `/zoom 150`, `/fuzzy`,
  `/sensitive` — the input clears and the popup stays open after a command; the
  change persists (reopen the options page to confirm).
