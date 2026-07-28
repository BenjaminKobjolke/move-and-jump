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
