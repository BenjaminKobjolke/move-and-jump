/**
 * Find where `query` appears in `text`, for highlighting the matched
 * portion of a displayed folder label. This deliberately re-derives
 * the position from the final *displayed* string rather than
 * threading match position through lib/match.js's tiered matching —
 * simpler, and correct regardless of which field (name/path/account
 * name) actually caused the match, since it just looks at what's on
 * screen.
 * @param {string} text
 * @param {string} query
 * @param {{caseSensitive?: boolean}} [options]
 * @returns {{start: number, end: number} | null} null if `query` is
 *   blank or doesn't appear in `text` at all (the latter can happen
 *   if a folder matched on a field not shown in the label, e.g. an
 *   account name when the account prefix isn't displayed).
 */
export function findMatchRange(text, query, { caseSensitive = false } = {}) {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? trimmed : trimmed.toLowerCase();
  const start = haystack.indexOf(needle);
  if (start === -1) return null;

  return { start, end: start + needle.length };
}
