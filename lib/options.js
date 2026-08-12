export const DEFAULT_OPTIONS = {
  caseSensitiveSearch: false,
  fuzzySearch: false,
  searchAllAccounts: true,
  zoom: 100,
  // Resize the search window to fit its content on open. When false the window
  // stays at its base (zoom-scaled) size and the folder list scrolls instead.
  resizeToFit: true,
  // Center the search window over the mail window on open (and after resizing).
  // When false, the platform places it and it isn't re-centered.
  centerOnParent: true,
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
