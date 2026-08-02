/**
 * Record one more use of a folder. Pure/immutable, mirroring
 * lib/recent.js's pushRecent — returns a new object rather than
 * mutating `weights`.
 * @param {Record<string, number>} weights
 * @param {string} folderId
 * @returns {Record<string, number>}
 */
export function incrementWeight(weights, folderId) {
  return { ...weights, [folderId]: (weights[folderId] ?? 0) + 1 };
}

/**
 * Sort folders by usage weight, most-used first, falling back to a
 * case-insensitive alphabetical-by-name order for folders with equal
 * (including absent, i.e. zero) weight. Unlike lib/match.js's own
 * tie-break, this is deliberately *not* about match relevance — it
 * decides display order for a set of folders match.js already
 * decided are candidates.
 * @param {{id: string, name?: string}[]} folders
 * @param {Record<string, number>} weights
 * @returns {object[]} new array; `folders` is not mutated
 */
export function sortByWeight(folders, weights) {
  return [...folders].sort((a, b) => {
    const weightDiff = (weights[b.id] ?? 0) - (weights[a.id] ?? 0);
    if (weightDiff !== 0) return weightDiff;
    return (a.name ?? "").toLowerCase().localeCompare((b.name ?? "").toLowerCase());
  });
}
