export const MAX_RECENT = 10;

/**
 * Move (or insert) a folder to the front of a most-recently-used list,
 * deduplicating and capping the result at `max` entries.
 * @param {string[]} recentFolderIds
 * @param {string} folderId
 * @param {number} [max]
 * @returns {string[]} new MRU list, unchanged input is not mutated
 */
export function pushRecent(recentFolderIds, folderId, max = MAX_RECENT) {
  const next = [folderId, ...recentFolderIds.filter((id) => id !== folderId)];
  return next.slice(0, max);
}
