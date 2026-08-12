# Fuzzy search

By default the folder search matches your query as a single **contiguous
substring**: typing `tob` finds `AXMain: /Team/Tobias`, but `main to` finds
nothing — that exact string never appears in any folder label.

**Fuzzy search** is an opt-in setting that makes the query match as **separate
words**: it is split on whitespace, and a folder matches when *every* word
appears somewhere in its name, path, or account — in any order. So `main to`
matches both `AXMain: /Team/Tobias` and `AXMain: /Rechnungen Tobias`, and each
matched word is highlighted in the result.

## Using it (options page)

Open **Add-ons Manager → Move and Jump → Options** and tick
**Fuzzy search (match separate words anywhere in the folder)**:

- Default **off** — search behaves as before (single contiguous substring).
- When **on**, the query is split on spaces; a folder shows only if *all* terms
  match (AND across terms, each term matching name **or** path **or** account).
- Order-independent: `to main` and `main to` match the same folders.
- Case sensitivity still follows the **Case-sensitive search** setting.

Example, query `main to`:

| Folder                        | Off      | On                 |
| ----------------------------- | -------- | ------------------ |
| `AXMain: /Team/Tobias`        | no match | ✓ (`main`, `to`)   |
| `AXMain: /Rechnungen Tobias`  | no match | ✓ (`main`, `to`)   |
| `AXMain: /Team/Anna`          | no match | ✗ (no `to`)        |

## Highlighting

Every matched term is wrapped in a `<mark>` in the result row. Overlapping or
adjacent matches are merged into one mark. A term that matched on a field **not
shown** in the label (e.g. an account name when the account prefix is hidden) is
simply not highlighted — it still counts toward the match.

## How it works

- **Stored:** as `fuzzySearch` (a boolean) inside the shared `options` object in
  `messenger.storage.local`. Default lives in `DEFAULT_OPTIONS`
  (`lib/options.js`); `getOptions()` merges it over stored values, so no
  migration was needed.
- **Matching:** `filterFolders` (`lib/match.js`) takes a `fuzzy` option. When
  set, it splits the trimmed query on `\s+` into terms and keeps a folder only
  if `terms.every(t => [name, path, account].some(f => f.includes(t)))`. The
  rank tier is still driven by the first term, so with a single term (or fuzzy
  off) the behavior is identical to the original substring match.
- **Highlighting:** `findMatchRanges` (`lib/highlight.js`) returns a sorted,
  merged list of match ranges instead of a single one; `appendHighlighted`
  (`popup/search.js`) emits a `<mark>` per range.
- **Weighting:** frequency/query weighting still applies on top — fuzzy only
  changes which folders are *included* and how they're *highlighted*, not the
  usage-based ordering.

## Relevant files

- `lib/options.js` — `fuzzySearch` default in `DEFAULT_OPTIONS`
- `lib/match.js` — `filterFolders` `fuzzy` term-splitting / AND matching
- `lib/highlight.js` — `findMatchRanges` (multi-term, merged ranges)
- `popup/search.js` — passes `fuzzy` flag; renders multiple `<mark>`s
- `options/options.html` / `options/options.js` — the checkbox, load/save
- `_locales/*/messages.json` — the `optionsFuzzySearch` label
