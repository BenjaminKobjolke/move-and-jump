import {
  pushRecent,
  MAX_SENDER_FOLDERS,
  pruneSenders,
} from "./lib/recent.js";
import { DEFAULT_OPTIONS, getOptions } from "./lib/options.js";
import { COMMAND_NAMES } from "./lib/keys.js";
import { decodeImapUtf7 } from "./lib/imapUtf7.js";
import { incrementWeight, incrementQueryWeight } from "./lib/weights.js";
import { createSearchWindow } from "./lib/searchWindow.js";
import { createMessageActions } from "./lib/messageActions.js";

/**
 * In-memory mirror of storage.local's lastUsedFolderId, kept in sync so
 * the move-last/jump-last commands can act without waiting on a
 * storage round-trip first.
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

/**
 * The mail tab a move/jump should apply to. Uses currentWindow, which
 * is only correct when called before the search window exists (that
 * window is a separate top-level window and isn't a mail tab at all,
 * so it must never be "current" when this resolves) — see
 * openSearchWindow() and actOnLastFolder() for where this is safe to
 * call.
 */
async function getActiveTab() {
  const [tab] = await messenger.mailTabs.query({ active: true, currentWindow: true });
  return tab;
}

const { openSearchWindow, resizeSearchWindow } = createSearchWindow(messenger, getActiveTab);
const {
  copySender,
  copySubject,
  saveAttachments,
  writeToSender,
  navigateTop,
  messageActions: MESSAGE_ACTIONS,
} = createMessageActions(messenger, getActiveTab);

async function performMove(folderId, tabId) {
  if (tabId === undefined) {
    console.error("Move and Jump: performMove called with no tabId, nothing to move");
    return;
  }
  // A message opened in its own tab is not a mail tab; mailTabs rejects its id.
  const tab = await messenger.tabs.get(tabId);
  const { messages } =
    tab.type === "mail"
      ? await messenger.mailTabs.getSelectedMessages(tabId)
      : await messenger.messageDisplay.getDisplayedMessages(tabId);
  if (messages.length === 0) return;
  await messenger.messages.move(
    messages.map((message) => message.id),
    folderId,
    { isUserAction: true },
  );
  try {
    await recordSenders(messages, folderId);
  } catch (error) {
    console.error("Move and Jump: recording sender folders failed", error);
  }
}

async function recordSenders(messages, folderId) {
  if (!(await getOptions(messenger.storage.local)).senderSuggestions) return;
  const emails = new Set();
  for (const message of messages) {
    const [sender] = await messenger.messengerUtilities.parseMailboxString(message.author);
    if (sender?.email) emails.add(sender.email.toLowerCase());
  }
  if (emails.size === 0) return;
  const { senderFolders = {}, senderUsedAt = {} } = await messenger.storage.local.get([
    "senderFolders",
    "senderUsedAt",
  ]);
  const now = Date.now();
  for (const email of emails) {
    senderFolders[email] = pushRecent(
      senderFolders[email] ?? [],
      folderId,
      MAX_SENDER_FOLDERS,
    );
    senderUsedAt[email] = now;
  }
  const pruned = pruneSenders(senderFolders, senderUsedAt, now);
  await messenger.storage.local.set(pruned);
}

async function performJump(folderId, tabId) {
  if (tabId === undefined) {
    console.error("Move and Jump: performJump called with no tabId, nothing to jump in");
    return;
  }
  await messenger.mailTabs.update(tabId, { displayedFolderId: folderId });
}

async function recordUsage(folderId, query = "") {
  cachedLastUsedFolderId = folderId;
  const [{ recentFolders = [] }, { folderWeights = {} }, { queryWeights = {} }, folder] =
    await Promise.all([
      messenger.storage.local.get("recentFolders"),
      messenger.storage.local.get("folderWeights"),
      messenger.storage.local.get("queryWeights"),
      getFolderById(folderId),
    ]);
  await messenger.storage.local.set({
    recentFolders: pushRecent(recentFolders, folderId),
    folderWeights: incrementWeight(folderWeights, folderId),
    queryWeights: incrementQueryWeight(queryWeights, query, folderId),
    lastUsedFolderId: folderId,
  });
  if (folder) {
    await messenger.action.setTitle({
      title: messenger.i18n.getMessage("tooltipLastFolder", [decodeImapUtf7(folder.path)]),
    });
  }
}

async function handleSelection(mode, folderId, tabId, query) {
  try {
    if (mode === "move") await performMove(folderId, tabId);
    else if (mode === "jump") await performJump(folderId, tabId);
    await recordUsage(folderId, query);
    return { ok: true };
  } catch (error) {
    console.error("Move and Jump: handleSelection failed", error);
    return { ok: false, error: String(error) };
  }
}

async function actOnLastFolder(mode, tabId) {
  if (!cachedLastUsedFolderId) {
    await openSearchWindow(mode, tabId);
    return;
  }
  const folderId = cachedLastUsedFolderId;
  if (mode === "move") await performMove(folderId, tabId);
  else await performJump(folderId, tabId);
  await recordUsage(folderId);
}

/**
 * Run one of the add-on's commands. Shared by the two ways a command can be
 * triggered from the keyboard: Thunderbird's own `commands` API, and the
 * single-key bindings from experiments/keys. Both hand us the mail tab up
 * front rather than making us query for it — see the callers.
 * @param {number|undefined} tabId
 */
function dispatchCommand(command, tabId) {
  switch (command) {
    case "move-search":
      return openSearchWindow("move", tabId);
    case "jump-search":
      return openSearchWindow("jump", tabId);
    // No default key (see manifest.json) — the user assigns one on the options
    // page. Opens the same popup, already in /filter mode; move/jump stay
    // reachable from it by clearing the input.
    case "filter-search":
      return openSearchWindow("move", tabId, "/filter ");
    case "move-last":
      return actOnLastFolder("move", tabId);
    case "jump-last":
      return actOnLastFolder("jump", tabId);
    // Act on the displayed message rather than on folders; no default keys.
    case "copy-sender-name":
      return copySender(tabId, "name");
    case "copy-sender-email":
      return copySender(tabId, "email");
    case "copy-subject":
      return copySubject(tabId);
    case "save-attachments":
      return saveAttachments(tabId);
    case "write-to-sender":
      return writeToSender(tabId);
    case "open-link":
      return openSearchWindow("move", tabId, "/links ");
    // Works in a compose window too: commands.onCommand hands us its tab.
    case "navigate-top":
      return navigateTop(tabId);
    default:
      return undefined;
  }
}

// commands.onCommand hands us the active tab directly as its second
// argument (Thunderbird 106+) — use that, same as action.onClicked
// below, rather than an independent currentWindow query. That query
// (getActiveTab(), still used as a last-resort fallback inside
// openSearchWindow) turned out not to reliably resolve a tab when
// called from these event callbacks — confirmed via the
// "could not resolve a target mail tab" diagnostic, which is what
// silently broke the keyboard-shortcut path.
messenger.commands.onCommand.addListener((command, tab) => dispatchCommand(command, tab?.id));

/**
 * The single-key experiment (experiments/keys), or null when it isn't there.
 *
 * Resolved once, in a try/catch, and never touched as `messenger.keys` again.
 * That is not defensiveness for its own sake: an experiment namespace that
 * failed to register does not necessarily read back as undefined — the property
 * access itself can throw, and an unguarded one at module scope takes the whole
 * background down with it, which means every command, the toolbar button and
 * move/jump all stop working because of an optional extra. An add-on must not
 * be able to lose its core function to its most fragile part.
 */
const keysApi = (() => {
  try {
    return messenger.keys ?? null;
  } catch (error) {
    console.error("Move and Jump: single-key experiment unavailable", error);
    return null;
  }
})();

/**
 * Push the single-key bindings (options.singleKeys) into the keys experiment,
 * which watches for them in every mail window.
 *
 * Called at every background start — including the wake-ups Thunderbird does
 * after suspending the event page — because the experiment holds the bindings
 * in memory only. Registering is idempotent: it replaces the set wholesale.
 * @returns {Promise<Array<{id: string, shortcut: string, shadows: ?string}>>}
 */
async function applySingleKeys() {
  // Absent when the experiment failed to load (a Thunderbird build whose
  // internals moved, or a policy that blocks experiments). Everything else
  // keeps working; the options page shows the column as unavailable.
  if (!keysApi) return [];
  const { singleKeys } = await getOptions(messenger.storage.local);
  const bindings = COMMAND_NAMES.filter((id) => singleKeys?.[id]).map((id) => ({
    id,
    shortcut: singleKeys[id],
  }));
  try {
    return await keysApi.register(bindings);
  } catch (error) {
    console.error("Move and Jump: keys.register failed", error);
    return [];
  }
}

if (keysApi) {
  // tabId is -1 when the experiment could not resolve one; openSearchWindow
  // then falls back the same way it does for the toolbar button.
  keysApi.onCommand.addListener((command, tabId) =>
    dispatchCommand(command, tabId >= 0 ? tabId : undefined),
  );
}

// Re-register whenever the options page rebinds a key. This also wakes a
// suspended event page, so the new binding takes effect immediately rather
// than at the next Thunderbird start.
messenger.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.options) applySingleKeys();
});

applySingleKeys();

// action.onClicked hands us the clicked tab directly — use that
// rather than an independent currentWindow query, which is not
// guaranteed to resolve the same way from this callback.
messenger.action.onClicked.addListener((tab) => openSearchWindow("move", tab.id));

messenger.runtime.onMessage.addListener((message) => {
  if (message?.type === "select") {
    return handleSelection(message.mode, message.folderId, message.tabId, message.query);
  }
  if (message?.type === "message-action" && MESSAGE_ACTIONS[message.action]) {
    return MESSAGE_ACTIONS[message.action](message.tabId).then(
      () => ({ ok: true }),
      (error) => {
        console.error("Move and Jump: message action failed", message.action, error);
        return { ok: false, error: String(error) };
      },
    );
  }
  if (message?.type === "resize") {
    return resizeSearchWindow(message.height, message.zoom, message.place);
  }
  return undefined;
});

messenger.runtime.onInstalled.addListener(async () => {
  const { options } = await messenger.storage.local.get("options");
  if (!options) {
    await messenger.storage.local.set({ options: DEFAULT_OPTIONS });
  }
});
