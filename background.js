import { pushRecent } from "./lib/recent.js";
import { DEFAULT_OPTIONS } from "./lib/options.js";

/**
 * In-memory mirror of storage.local's lastUsedFolderId, kept in sync so
 * the move-last/jump-last commands can decide synchronously whether to
 * act directly or fall back to the search popup. This matters because
 * any `await` before `messenger.action.openPopup()` — even one that
 * resolves near-instantly, like a storage read — drops the "user
 * gesture" status that call requires when invoked from a command
 * shortcut, and openPopup() then fails silently (see ARCHITECTURE.md).
 */
let cachedLastUsedFolderId = null;
messenger.storage.local.get("lastUsedFolderId").then(({ lastUsedFolderId }) => {
  cachedLastUsedFolderId = lastUsedFolderId ?? null;
});

/**
 * Look up a single folder by id. Thunderbird's folders API has no
 * get-by-id call, so this does a linear scan of the (typically small)
 * folder list.
 */
async function getFolderById(folderId) {
  const folders = await messenger.folders.query({});
  return folders.find((folder) => folder.id === folderId);
}

async function getActiveTab() {
  const [tab] = await messenger.mailTabs.query({ active: true, currentWindow: true });
  return tab;
}

async function performMove(folderId) {
  const tab = await getActiveTab();
  if (!tab) return;
  const { messages } = await messenger.mailTabs.getSelectedMessages(tab.id);
  if (messages.length === 0) return;
  await messenger.messages.move(
    messages.map((message) => message.id),
    folderId,
    { isUserAction: true },
  );
}

async function performJump(folderId) {
  const tab = await getActiveTab();
  if (!tab) return;
  await messenger.mailTabs.update(tab.id, { displayedFolderId: folderId });
}

async function recordUsage(folderId) {
  cachedLastUsedFolderId = folderId;
  const [{ recentFolders = [] }, folder] = await Promise.all([
    messenger.storage.local.get("recentFolders"),
    getFolderById(folderId),
  ]);
  await messenger.storage.local.set({
    recentFolders: pushRecent(recentFolders, folderId),
    lastUsedFolderId: folderId,
  });
  if (folder) {
    await messenger.action.setTitle({
      title: messenger.i18n.getMessage("tooltipLastFolder", [folder.path]),
    });
  }
}

async function handleSelection(mode, folderId) {
  if (mode === "move") await performMove(folderId);
  else if (mode === "jump") await performJump(folderId);
  await recordUsage(folderId);
}

/**
 * Open the search popup in the given mode. Must stay synchronous up to
 * (and including) the openPopup() call itself — see the comment on
 * `cachedLastUsedFolderId` above for why.
 */
function openSearchPopup(mode) {
  messenger.action.setPopup({ popup: `popup/search.html?mode=${mode}` });
  messenger.action.openPopup().then(() => {
    // Reset so a plain toolbar-button click (which opens the
    // manifest's default_popup directly, bypassing this function)
    // always starts in "move" mode.
    messenger.action.setPopup({ popup: "popup/search.html" });
  });
}

function actOnLastFolder(mode) {
  if (!cachedLastUsedFolderId) {
    openSearchPopup(mode);
    return;
  }
  const folderId = cachedLastUsedFolderId;
  const action = mode === "move" ? performMove(folderId) : performJump(folderId);
  action.then(() => recordUsage(folderId));
}

messenger.commands.onCommand.addListener((command) => {
  switch (command) {
    case "move-search":
      return openSearchPopup("move");
    case "jump-search":
      return openSearchPopup("jump");
    case "move-last":
      return actOnLastFolder("move");
    case "jump-last":
      return actOnLastFolder("jump");
    default:
      return undefined;
  }
});

messenger.runtime.onMessage.addListener((message) => {
  if (message?.type === "select") {
    return handleSelection(message.mode, message.folderId);
  }
  return undefined;
});

messenger.runtime.onInstalled.addListener(async () => {
  const { options } = await messenger.storage.local.get("options");
  if (!options) {
    await messenger.storage.local.set({ options: DEFAULT_OPTIONS });
  }
});
