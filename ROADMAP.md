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
- **Revisit `lib/highlight.js` when this lands.** Match highlighting
  already shipped (1.1.0), built for today's contiguous-substring
  matching (`findMatchRange` returns one `{start, end}` range). Fuzzy
  subsequence matches are scattered, non-contiguous characters, so
  highlighting will need to become "a set of matched indices" rather
  than a single range — a real (if contained) follow-up change, not
  just an extension of the current function.
- Also revisit `lib/weights.js`'s `sortByWeight()`/`sortByQueryWeight()`:
  they currently re-sort `filterFolders()`'s output by usage weight
  only, discarding match-quality order entirely. Fuzzy search's
  per-result relevance *score* is more informative than today's coarse
  tiers — worth reconsidering whether weight should factor into a
  combined score instead of overriding relevance outright, though the
  current "weight wins, full stop" behavior was a deliberate choice
  (see ARCHITECTURE.md) that should only change on its own merits, not
  as a side effect of unrelated fuzzy-search work.

Frequency-weighted folder ranking and search-term highlighting (both
previously listed here) shipped in 1.1.0, and per-typed-query-prefix
weighting followed in 1.2.0 — see [CHANGELOG.md](CHANGELOG.md) and
`lib/weights.js`/`lib/highlight.js` in [ARCHITECTURE.md](ARCHITECTURE.md).
