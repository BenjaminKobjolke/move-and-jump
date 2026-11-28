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
- **Matching:** the word logic is upstream's multi-word search (merged from
  upstream 1.3.0; see "Multi-word queries" in `ARCHITECTURE.md`). Upstream
  always splits the query; this fork keeps the setting as a switch on top:
  `queryWords(query, fuzzy)` (`lib/match.js`) splits the trimmed query on
  `\s+` when `fuzzy` is on, and returns it as one literal word (spaces
  included) when off. `filterFolders`, `matchBand` and `findMatchRanges` all
  take the same `fuzzy` option and default to **on**; the popup passes
  `options.fuzzySearch`.
- **Match tier:** a folder's tier is that of its *worst*-matching word (name
  starts with it, name contains it, path, account), not the first word's.
- **Highlighting:** `findMatchRanges` (`lib/highlight.js`) returns a sorted,
  merged list of ranges, one per word; `appendHighlighted` (`popup/render.js`)
  emits a `<mark>` per range. A word found in both a parent folder and the
  folder's own name is marked in the name (`preferFrom`).
- **Ordering:** with two or more words, folders whose own name contains every
  word are listed before the rest (`matchBand`), ahead of usage weight. With
  one word, or with fuzzy off, usage weight decides as before.

## Relevant files

- `lib/options.js` — `fuzzySearch` default in `DEFAULT_OPTIONS`
- `lib/match.js` — `queryWords` (the `fuzzy` switch), `filterFolders`, `matchBand`
- `lib/highlight.js` — `findMatchRanges` (one range per word, merged)
- `popup/render.js` — passes the `fuzzy` flag; renders the `<mark>`s
- `options/options.html` / `options/options.js` — the checkbox, load/save
- `_locales/*/messages.json` — the `optionsFuzzySearch` label
