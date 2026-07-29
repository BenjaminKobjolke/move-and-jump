# Roadmap

Ideas considered and deliberately deferred, so they survive between
sessions instead of living only in chat history. Not commitments or
a schedule — just a backlog with enough design context to pick back
up later. Add to this list rather than losing an idea; move an entry
into [CHANGELOG.md](CHANGELOG.md) once it actually ships.

## Fuzzy search (fzf-style matching)

Replace (not just extend) `lib/match.js`'s tiered substring matching
with proper scored fuzzy subsequence matching, like the `fzf`
command-line tool: query characters just need to appear in order,
not contiguously, with score bonuses for matches at the start of a
path segment, right after a `/`, and in unbroken runs.

**Design notes:**

- Feasible with zero dependencies — it's a pure string algorithm,
  fits the existing `lib/match.js` pattern (dependency-free, unit
  testable). The `fzy` algorithm (simpler than fzf's own) is a good
  reference implementation to study rather than reinventing scoring
  from scratch.
- The scoring is the actual work, not the subsequence check itself —
  a naive "does the subsequence exist" match produces noisy, hard to
  predict ordering for short strings like folder names.
- Sequencing: land *before* search-term highlighting below, since
  highlighting needs to know exactly which characters matched, and
  that's a different (and more involved) shape for fuzzy/non-contiguous
  matches than for the current contiguous-substring matches.

## Frequency-weighted folder ranking

Track a per-folder usage count, incremented by 1 every time a folder
is selected for a move or jump. Search results sort primarily by that
weight, then alphabetically, so frequently-used folders bubble to the
top — a step beyond the current recency-based MRU list.

**Design notes:**

- This is a different, likely-additional data structure from the
  existing `recentFolders` MRU array in `storage.local` (recency-
  capped-at-10 vs. frequency-uncapped) — needs a decision on whether
  it replaces MRU for the empty-query default view too, or only
  affects ranking once a query is typed.
- Open question to settle before implementing: does weight become the
  *primary* sort key outright, or a tie-breaker within the existing
  match-quality tiers in `lib/match.js` (name-starts-with beats
  name-contains beats path-contains, etc.)? Sorting purely by weight
  first could rank a frequently-used unrelated folder above a
  better textual match, which may or may not be the desired feel —
  worth testing both before committing.
- Storage shape: something like `storage.local.folderWeights:
  { [folderId]: number }`, incremented in `recordUsage()` in
  `background.js` alongside the existing MRU update.

## Highlight the matched search term in results

Render the matching portion of each folder's label in bold/a
different color, like most fuzzy-finder UIs do.

**Design notes:**

- Needs match *position*, not just a rank tier — `lib/match.js`
  currently returns which folder matched and why (tier), not *where*
  in the string. Either recompute the position at render time
  (case-insensitive `indexOf`) or have `filterFolders` return
  start/end indices alongside each result.
- Build highlighted markup with real DOM nodes (`textContent` for the
  non-matching parts, a separate element for the matched part) rather
  than string-concatenated `innerHTML`, consistent with how the rest
  of the popup avoids `innerHTML` for anything other than clearing a
  container.
- Depends on which matching algorithm is in place — a single
  contiguous highlighted range for today's substring matching, but
  potentially several disjoint highlighted characters if fuzzy search
  (above) lands first.
