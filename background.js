import { pushRecent } from "./lib/recent.js";
import { DEFAULT_OPTIONS } from "./lib/options.js";

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
  const [{ recentFolders = [] }, folder] = await Promise.all([
    messenger.storage.local.get("recentFolders"),
    getFolderById(folderId),
  ]);
  await messenger.storage.local.set({
    recentFolders: pushRecent(recentFolders, folderId),
    lastUsedFolderId: folderId,
  });
  if (folder) {
    await messenger.action.setTitle({ title: `Move and Jump — Last: ${folder.path}` });
  }
}

async function handleSelection(mode, folderId) {
  if (mode === "move") await performMove(folderId);
  else if (mode === "jump") await performJump(folderId);
  await recordUsage(folderId);
}

async function openSearchPopup(mode) {
  await messenger.storage.session.set({ mode });
  await messenger.action.openPopup();
}

async function actOnLastFolder(mode) {
  const { lastUsedFolderId } = await messenger.storage.local.get("lastUsedFolderId");
  if (!lastUsedFolderId) {
    // Nothing to repeat yet — fall back to the search popup.
    await openSearchPopup(mode);
    return;
  }
  if (mode === "move") await performMove(lastUsedFolderId);
  else await performJump(lastUsedFolderId);
  await recordUsage(lastUsedFolderId);
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
