// Renames a folder and carries the folder-id bookkeeping over to its new id.
// A rename changes the id of the folder and of every subfolder, and recents,
// weights, the last-used folder and sender suggestions are all keyed by id.
import { decodeImapUtf7 } from "./imapUtf7.js";

const STORE_KEYS = Object.freeze([
  "recentFolders",
  "folderWeights",
  "queryWeights",
  "lastUsedFolderId",
  "senderFolders",
]);

/**
 * The folder /rename-folder would act on, or null when the tab shows none.
 * Unified folders are virtual and cannot be renamed.
 * @param {{ displayedFolder?: { id: string, name?: string, isUnified?: boolean } } | undefined} tab
 * @returns {{ id: string, name: string } | null}
 */
export function renamableFolder(tab) {
  const folder = tab?.displayedFolder;
  if (!folder?.id || folder.isUnified) return null;
  return { id: folder.id, name: decodeImapUtf7(folder.name ?? "") };
}

/**
 * Rewrite `oldId`, and every subfolder id below it, to the `newId` prefix in
 * the stored bookkeeping. Ids that collide afterwards are merged.
 * @returns {{ recentFolders: string[], folderWeights: object, queryWeights: object, senderFolders: object, lastUsedFolderId?: string }}
 */
export function migrateFolderIds(stored, oldId, newId) {
  const mapId = (id) => {
    if (id === oldId) return newId;
    // The "/" keeps a sibling like ".../Workshop" out of a ".../Work" rename.
    return id.startsWith(`${oldId}/`) ? newId + id.slice(oldId.length) : id;
  };
  const mapIds = (ids) => [...new Set(ids.map(mapId))];
  const mapWeights = (weights) => {
    const result = {};
    for (const [id, weight] of Object.entries(weights)) {
      result[mapId(id)] = (result[mapId(id)] ?? 0) + weight;
    }
    return result;
  };
  const mapValues = (object, map) =>
    Object.fromEntries(Object.entries(object).map(([key, value]) => [key, map(value)]));

  const migrated = {
    recentFolders: mapIds(stored.recentFolders ?? []),
    folderWeights: mapWeights(stored.folderWeights ?? {}),
    queryWeights: mapValues(stored.queryWeights ?? {}, mapWeights),
    senderFolders: mapValues(stored.senderFolders ?? {}, mapIds),
  };
  if (typeof stored.lastUsedFolderId === "string") {
    migrated.lastUsedFolderId = mapId(stored.lastUsedFolderId);
  }
  return migrated;
}

/**
 * Handle the popup's "rename-folder" message.
 * @param {object} messenger
 * @param {{ folderId?: unknown, name?: unknown }} message
 * @returns {Promise<{ ok: true, lastUsedFolderId: string | null } | { ok: false, error: string }>}
 */
export async function handleRenameFolder(messenger, message) {
  const folderId = typeof message?.folderId === "string" ? message.folderId : "";
  const name = typeof message?.name === "string" ? message.name.trim() : "";
  if (!folderId || !name) return { ok: false, error: "missing folder or name" };
  try {
    const renamed = await messenger.folders.rename(folderId, name);
    const stored = await messenger.storage.local.get(STORE_KEYS);
    // The new id comes from Thunderbird, never built from the name.
    if (typeof renamed?.id !== "string") return { ok: true, lastUsedFolderId: stored.lastUsedFolderId ?? null };
    const migrated = migrateFolderIds(stored, folderId, renamed.id);
    await messenger.storage.local.set(migrated);
    return { ok: true, lastUsedFolderId: migrated.lastUsedFolderId ?? null };
  } catch (error) {
    console.error("Move and Jump: renaming folder failed", error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
