import { pushRecent } from "./lib/recent.js";
import { DEFAULT_OPTIONS, getOptions, clampZoom } from "./lib/options.js";
import { decodeImapUtf7 } from "./lib/imapUtf7.js";
import { incrementWeight, incrementQueryWeight } from "./lib/weights.js";

/**
 * In-memory mirror of storage.local's lastUsedFolderId, kept in sync so
 * the move-last/jump-last commands can act without waiting on a
 * storage round-trip first.
 */
let cachedLastUsedFolderId = null;
messenger.storage.local.get("lastUsedFolderId").then(({ lastUsedFolderId }) => {
  cachedLastUsedFolderId = lastUsedFolderId ?? null;
});

/** Tracks the currently open search window, if any, so a second
 * invocation replaces it instead of piling up windows. */
let searchWindowId = null;
// Parent (mail) window geometry captured at open time, so the popup can be
// re-centered after it resizes itself — see resizeSearchWindow.
let searchWindowParent = null;
messenger.windows.onRemoved.addListener((windowId) => {
  if (windowId === searchWindowId) {
    searchWindowId = null;
    searchWindowParent = null;
  }
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

async function performMove(folderId, tabId) {
  if (tabId === undefined) {
    console.error("Move and Jump: performMove called with no tabId, nothing to move");
    return;
  }
  const { messages } = await messenger.mailTabs.getSelectedMessages(tabId);
  if (messages.length === 0) return;
  await messenger.messages.move(
    messages.map((message) => message.id),
    folderId,
    { isUserAction: true },
  );
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

const SEARCH_WINDOW_WIDTH = 560;
const SEARCH_WINDOW_MIN_HEIGHT = 440;
const SEARCH_WINDOW_MAX_HEIGHT = 700;

/**
 * Open the search UI as a real top-level popup window rather than the
 * toolbar action's popup panel. The action-popup panel turned out to
 * be unreliable at actually taking keyboard focus on (at least some)
 * Linux window managers — the input would show a blinking caret but
 * not receive keystrokes, which fell through to Thunderbird's own
 * single-letter shortcuts instead. A genuine top-level window is
 * subject to normal window-manager focus handling and doesn't have
 * that problem. See ARCHITECTURE.md for the full story.
 *
 * The target mail tab is resolved *before* the popup window exists
 * (or passed in already resolved) and threaded through explicitly via
 * the URL, rather than re-queried later — once the popup window
 * exists, "current window" no longer reliably means the mail window.
 */
/**
 * Read options and compute the search window's base (zoom-scaled) geometry for
 * this open. The parent mail window may have moved since last time, so this
 * re-queries it every open and (re)sets searchWindowParent — which also gates
 * re-centering in resizeSearchWindow (null → not centered).
 */
async function computeSearchWindowGeometry() {
  const options = await getOptions(messenger.storage.local);
  const zoom = clampZoom(options.zoom);
  const factor = zoom / 100;
  const width = Math.round(SEARCH_WINDOW_WIDTH * factor);
  const height = Math.round(SEARCH_WINDOW_MIN_HEIGHT * factor);

  let left;
  let top;
  searchWindowParent = null;
  if (options.centerOnParent) {
    try {
      const current = await messenger.windows.getCurrent();
      searchWindowParent = {
        left: current.left,
        top: current.top,
        width: current.width,
        height: current.height,
      };
      left = Math.round(current.left + (current.width - width) / 2);
      top = Math.round(current.top + (current.height - height) / 3);
    } catch {
      // Fall back to the platform's default placement.
    }
  }
  return { zoom, width, height, left, top };
}

/**
 * Find an already-open search popup among live windows. The background is an
 * MV3 non-persistent event page (see manifest.json): Gecko suspends it after a
 * short idle, wiping searchWindowId while the popup keeps living. Without this,
 * the next command would create a duplicate. Own extension pages expose their
 * url without any extra permission.
 */
async function findExistingSearchWindow() {
  const wins = await messenger.windows.getAll({ populate: true });
  const match = wins.find(
    (w) => w.type === "popup" && w.tabs?.some((t) => t.url?.includes("popup/search.html")),
  );
  return match?.id ?? null;
}

async function openSearchWindow(mode, tabId) {
  const resolvedTabId = tabId ?? (await getActiveTab())?.id;
  if (resolvedTabId === undefined) {
    console.error("Move and Jump: openSearchWindow could not resolve a target mail tab");
  }

  const { zoom, width, height, left, top } = await computeSearchWindowGeometry();

  // Recover the id if the event page was suspended (searchWindowId wiped) while
  // the popup stayed open — otherwise we'd create a duplicate. See
  // findExistingSearchWindow.
  if (searchWindowId === null) {
    searchWindowId = await findExistingSearchWindow();
  }

  // Reuse the existing window (kept alive, minimized while dismissed) instead of
  // recreating it: restore + re-center it, then tell the popup to re-init for
  // the new mode/tab/zoom. The popup's re-init sends its own resize message, so
  // resizeSearchWindow still fits/centers to content.
  if (searchWindowId !== null) {
    try {
      await messenger.windows.update(searchWindowId, {
        state: "normal",
        focused: true,
        width,
        height,
        left,
        top,
      });
    } catch {
      // Window is gone despite our id (e.g. closed at just the wrong moment);
      // fall through and create a fresh one.
      searchWindowId = null;
    }
    if (searchWindowId !== null) {
      try {
        await messenger.runtime.sendMessage({ type: "reset", mode, tabId: resolvedTabId, zoom });
      } catch {
        // Popup script not ready to receive the reset yet; the window is focused
        // regardless, so don't fall through and create a duplicate.
      }
      return;
    }
  }

  const params = new URLSearchParams({ mode, zoom: String(zoom) });
  if (resolvedTabId !== undefined) params.set("tabId", String(resolvedTabId));

  const win = await messenger.windows.create({
    type: "popup",
    url: `popup/search.html?${params}`,
    width,
    height,
    left,
    top,
    allowScriptsToClose: true,
  });
  searchWindowId = win.id;
}

/**
 * Called once the popup has measured how tall its own initial content
 * (heading + input + up to 10 recent folders + buttons) actually
 * rendered — fonts, DPI, and OS text-scale settings all affect how
 * tall that really is, so no fixed pixel guess holds up across
 * environments (see search.js's measureRequiredWindowHeight()).
 * Clamped between the window's initial height (a sensible floor,
 * leaving headroom for typed searches that return more than the
 * recent-folder list's 10 entries) and a generous ceiling (guards
 * against pathological cases on unusual systems).
 */
async function resizeSearchWindow(requestedHeight, zoom = 1) {
  if (searchWindowId === null) return;
  // Content is zoomed in the popup (body.style.zoom), so widen the window
  // by the same factor and scale the height clamps to match — otherwise a
  // larger zoom would clip horizontally against the fixed 560px width.
  const width = Math.round(SEARCH_WINDOW_WIDTH * zoom);
  const height = Math.min(
    Math.round(SEARCH_WINDOW_MAX_HEIGHT * zoom),
    Math.max(Math.round(SEARCH_WINDOW_MIN_HEIGHT * zoom), Math.round(requestedHeight)),
  );
  // Growing width/height keeps the top-left fixed, so re-center over the parent
  // mail window (captured at open) rather than letting the popup drift.
  const update = { width, height };
  const p = searchWindowParent;
  if (p) {
    update.left = Math.round(p.left + (p.width - width) / 2);
    update.top = Math.round(p.top + (p.height - height) / 2);
  }
  await messenger.windows.update(searchWindowId, update);
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

// commands.onCommand hands us the active tab directly as its second
// argument (Thunderbird 106+) — use that, same as action.onClicked
// below, rather than an independent currentWindow query. That query
// (getActiveTab(), still used as a last-resort fallback inside
// openSearchWindow) turned out not to reliably resolve a tab when
// called from these event callbacks — confirmed via the
// "could not resolve a target mail tab" diagnostic, which is what
// silently broke the keyboard-shortcut path.
messenger.commands.onCommand.addListener((command, tab) => {
  switch (command) {
    case "move-search":
      return openSearchWindow("move", tab?.id);
    case "jump-search":
      return openSearchWindow("jump", tab?.id);
    case "move-last":
      return actOnLastFolder("move", tab?.id);
    case "jump-last":
      return actOnLastFolder("jump", tab?.id);
    default:
      return undefined;
  }
});

// action.onClicked hands us the clicked tab directly — use that
// rather than an independent currentWindow query, which is not
// guaranteed to resolve the same way from this callback.
messenger.action.onClicked.addListener((tab) => openSearchWindow("move", tab.id));

messenger.runtime.onMessage.addListener((message) => {
  if (message?.type === "select") {
    return handleSelection(message.mode, message.folderId, message.tabId, message.query);
  }
  if (message?.type === "resize") {
    return resizeSearchWindow(message.height, message.zoom);
  }
  return undefined;
});

messenger.runtime.onInstalled.addListener(async () => {
  const { options } = await messenger.storage.local.get("options");
  if (!options) {
    await messenger.storage.local.set({ options: DEFAULT_OPTIONS });
  }
});
