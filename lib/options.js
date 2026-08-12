export const DEFAULT_OPTIONS = {
  caseSensitiveSearch: false,
  fuzzySearch: false,
  searchAllAccounts: true,
  zoom: 100,
};

/**
 * Merge stored options over the defaults, so new options added in a later
 * version don't need a storage migration.
 * @param {{get(keys: string): Promise<object>}} storageArea e.g. messenger.storage.local
 * @returns {Promise<typeof DEFAULT_OPTIONS>}
 */
export async function getOptions(storageArea) {
  const { options } = await storageArea.get("options");
  return { ...DEFAULT_OPTIONS, ...options };
}
