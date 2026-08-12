export const DEFAULT_OPTIONS = {
  caseSensitiveSearch: false,
  fuzzySearch: false,
  searchAllAccounts: true,
  zoom: 100,
};

/** Clamp a zoom value to the supported 50–200% range (falls back to 100). */
export const clampZoom = (n) => Math.min(200, Math.max(50, Number(n) || 100));

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
