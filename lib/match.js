/**
 * Filter and rank folders against a search query.
 * Rank tiers (lower is better): 0 = name starts with query,
 * 1 = name contains query, 2 = path contains query.
 * @param {{name: string, path: string}[]} folders
 * @param {string} query
 * @param {{caseSensitive?: boolean}} [options]
 * @returns {object[]} matching folders, best match first
 */
export function filterFolders(folders, query, { caseSensitive = false } = {}) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const norm = caseSensitive ? (s) => s : (s) => s.toLowerCase();
  const nq = norm(trimmed);

  const ranked = [];
  for (const folder of folders) {
    const name = norm(folder.name ?? "");
    const path = norm(folder.path ?? "");
    let rank;
    if (name.startsWith(nq)) rank = 0;
    else if (name.includes(nq)) rank = 1;
    else if (path.includes(nq)) rank = 2;
    else continue;
    ranked.push({ folder, rank });
  }

  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      norm(a.folder.name ?? "").localeCompare(norm(b.folder.name ?? "")),
  );
  return ranked.map((r) => r.folder);
}
