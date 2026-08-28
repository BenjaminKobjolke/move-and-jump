/**
 * Restrict a folder list to a single account, used when the
 * "search all accounts" option is turned off. A falsy accountId
 * means "no restriction" and returns the input unchanged.
 * @param {{accountId: string}[]} folders
 * @param {string|null|undefined} accountId
 * @returns {object[]}
 */
export function filterByAccount(folders, accountId) {
  if (!accountId) return folders;
  return folders.filter((folder) => folder.accountId === accountId);
}

/**
 * The inbox folders out of a flat folder list, one per account that has one.
 * A folder can carry several special uses, hence the includes().
 * @param {{specialUse?: string[]}[]} folders
 * @returns {object[]}
 */
export function inboxFolders(folders) {
  return folders.filter((folder) => folder.specialUse?.includes("inbox"));
}

// The order the unified folders are listed in: the ones you actually jump to
// first. folders.query() promises no order of its own.
const UNIFIED_ORDER = ["inbox", "drafts", "sent", "archives", "junk", "trash", "templates"];

/**
 * Unified folders in a stable, useful order; unrecognized uses sort last.
 * @param {{specialUse?: string[]}[]} folders
 * @returns {object[]}
 */
export function orderUnified(folders) {
  const rank = (folder) => {
    const i = UNIFIED_ORDER.findIndex((use) => folder.specialUse?.includes(use));
    return i === -1 ? UNIFIED_ORDER.length : i;
  };
  return [...folders].sort((a, b) => rank(a) - rank(b));
}
