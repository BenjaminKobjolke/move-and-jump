export const MAX_RECENT = 10;
export const MAX_SENDER_FOLDERS = 3;

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

/**
 * Move folders with listed ids to the front in `ids` order.
 * @template T
 * @param {T[]} folders
 * @param {string[]} ids
 * @returns {T[]} new ordered array, unchanged inputs are not mutated
 */
export function prioritize(folders, ids) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const prioritized = ids.map((id) => byId.get(id)).filter(Boolean);
  const prioritizedIds = new Set(prioritized.map((folder) => folder.id));
  return [...prioritized, ...folders.filter((folder) => !prioritizedIds.has(folder.id))];
}
