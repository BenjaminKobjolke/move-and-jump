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

/**
 * Record one more use of a folder *for a specific typed query*,
 * fanning the increment out across every prefix of the (trimmed,
 * lowercased) query. Fanning out means a *shorter* query typed on
 * some future occasion still benefits, as long as it's a prefix of
 * what was typed this time — selecting a folder after typing
 * "archive" also credits "a", "ar", …, "archiv", so typing just
 * "arch" next time already finds the association. The reverse isn't
 * true: typing *more* than was ever typed before won't match
 * anything yet — a deliberate, acceptable limit (see ARCHITECTURE.md).
 * No-ops (returns `queryWeights` unchanged) for a blank query.
 * @param {Record<string, Record<string, number>>} queryWeights
 * @param {string} query
 * @param {string} folderId
 * @returns {Record<string, Record<string, number>>}
 */
export function incrementQueryWeight(queryWeights, query, folderId) {
  const normalized = (query ?? "").trim().toLowerCase();
  if (!normalized) return queryWeights;

  const next = { ...queryWeights };
  for (let end = 1; end <= normalized.length; end++) {
    const prefix = normalized.slice(0, end);
    next[prefix] = incrementWeight(next[prefix] ?? {}, folderId);
  }
  return next;
}

/**
 * Sort folders for a specific typed query: primarily by the weight
 * recorded for that exact (trimmed, lowercased) query, falling back
 * to overall/global weight, falling back to alphabetical — each
 * level only breaking ties left by the one before it. Composes two
 * stable sorts (`sortByWeight` already provides the global-weight +
 * alphabetical baseline) rather than a single three-key comparator,
 * relying on `Array.prototype.sort`'s stability guarantee (ES2019+).
 * @param {{id: string, name?: string}[]} folders
 * @param {Record<string, Record<string, number>>} queryWeights
 * @param {Record<string, number>} globalWeights
 * @param {string} query
 * @returns {object[]} new array; `folders` is not mutated
 */
export function sortByQueryWeight(folders, queryWeights, globalWeights, query) {
  const normalized = (query ?? "").trim().toLowerCase();
  const forQuery = queryWeights[normalized] ?? {};
  return sortByWeight(folders, globalWeights).sort(
    (a, b) => (forQuery[b.id] ?? 0) - (forQuery[a.id] ?? 0),
  );
}
