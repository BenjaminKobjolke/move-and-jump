/**
 * Filter and rank folders against a search query.
 * Rank tiers (lower is better): 0 = name starts with query, 1 = name
 * contains query, 2 = path contains query, 3 = account name contains
 * query (only relevant for folders carrying an `accountName`, used to
 * disambiguate same-named folders across accounts).
 *
 * With `fuzzy`, the query is split on whitespace and a folder matches
 * when *every* term appears (as a substring) in at least one of its
 * name/path/account fields, order-independent — so "main to" matches
 * "Main: /Team/Tobias". The rank tier is driven by the first term, so
 * with a single term this is identical to the non-fuzzy path.
 * @param {{name: string, path: string, accountName?: string}[]} folders
 * @param {string} query
 * @param {{caseSensitive?: boolean, fuzzy?: boolean}} [options]
 * @returns {object[]} matching folders, best match first
 */
export function filterFolders(folders, query, { caseSensitive = false, fuzzy = false } = {}) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const norm = caseSensitive ? (s) => s : (s) => s.toLowerCase();
  const terms = fuzzy ? trimmed.split(/\s+/).map(norm) : [norm(trimmed)];
  const first = terms[0];

  const ranked = [];
  for (const folder of folders) {
    const name = norm(folder.name ?? "");
    const path = norm(folder.path ?? "");
    const accountName = norm(folder.accountName ?? "");
    const fields = [name, path, accountName];
    if (!terms.every((t) => fields.some((f) => f.includes(t)))) continue;
    let rank;
    if (name.startsWith(first)) rank = 0;
    else if (name.includes(first)) rank = 1;
    else if (path.includes(first)) rank = 2;
    else rank = 3;
    ranked.push({ folder, rank });
  }

  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      norm(a.folder.name ?? "").localeCompare(norm(b.folder.name ?? "")),
  );
  return ranked.map((r) => r.folder);
}
