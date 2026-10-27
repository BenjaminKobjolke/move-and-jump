import { getOptions, clampZoom } from "./options.js";

const SEARCH_WINDOW_WIDTH = 560;
const SEARCH_WINDOW_MIN_HEIGHT = 440;
const SEARCH_WINDOW_MAX_HEIGHT = 700;
// Gap kept between the popup and the parent window's edges in corner placement.
const SEARCH_WINDOW_MARGIN = 12;
// Corner placement shows a short, button-less list, so it doesn't need the full
// width either — see the .filtering/.columns rules in popup/search.css.
const SEARCH_WINDOW_CORNER_WIDTH = 400;

/**
 * Open and resize the search popup while retaining its window state.
 * @param {object} messenger Thunderbird's extension API.
 * @param {Function} getActiveTab Resolves the active mail tab.
 */
export function createSearchWindow(messenger, getActiveTab) {
  let searchWindowId = null;
  let searchWindowParent = null;

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

  messenger.windows.onRemoved.addListener(async (windowId) => {
    if (windowId === searchWindowId) {
      searchWindowId = null;
      searchWindowParent = null;
      return;
    }

    // The kept-alive (minimized) search popup would otherwise be the last
    // window standing and keep Thunderbird running after the user closes
    // the main window.
    const wins = await messenger.windows.getAll();
    if (wins.some((w) => w.type === "normal")) return;
    const leftover = searchWindowId ?? (await findExistingSearchWindow());
    if (leftover === null) return;
    try {
      await messenger.windows.remove(leftover);
    } catch {
      // Already gone.
    }
  });

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
    return { zoom, width, height, left, top, recreateWindow: options.recreateWindow };
  }

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
   * the URL, rather than re-queried later — once the popup window exists,
   * "current window" no longer reliably means the mail window.
   */
  async function openSearchWindow(mode, tabId, prefill = "") {
    const resolvedTabId = tabId ?? (await getActiveTab())?.id;
    if (resolvedTabId === undefined) {
      console.error("Move and Jump: openSearchWindow could not resolve a target mail tab");
    }

    const { zoom, width, height, left, top, recreateWindow } = await computeSearchWindowGeometry();

    // Recover the id if the event page was suspended (searchWindowId wiped) while
    // the popup stayed open — otherwise we'd create a duplicate. See
    // findExistingSearchWindow.
    if (searchWindowId === null) {
      searchWindowId = await findExistingSearchWindow();
    }

    // With recreateWindow on, the popup closes itself on dismiss — so anything
    // still around is a leftover from before the option was switched on (or a
    // window the user left open). Drop it rather than reusing it.
    if (recreateWindow && searchWindowId !== null) {
      try {
        await messenger.windows.remove(searchWindowId);
      } catch {
        // Already gone; onRemoved may or may not have fired yet.
      }
      searchWindowId = null;
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
          await messenger.runtime.sendMessage({
            type: "reset",
            mode,
            tabId: resolvedTabId,
            zoom,
            prefill,
          });
        } catch {
          // Popup script not ready to receive the reset yet; the window is focused
          // regardless, so don't fall through and create a duplicate.
        }
        return;
      }
    }

    const params = new URLSearchParams({ mode, zoom: String(zoom) });
    if (resolvedTabId !== undefined) params.set("tabId", String(resolvedTabId));
    if (prefill) params.set("prefill", prefill);

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
   *
   * `place` is "center" normally and "corner" while /filter or /columns is in the
   * input: the popup is acting on the mail tab's message list behind it, so it has
   * to get off it (see docs/FILTER_EMAILS.md and docs/COMMANDS.md).
   * @param {"center"|"corner"} place
   */
  async function resizeSearchWindow(requestedHeight, zoom = 1, place = "center") {
    if (searchWindowId === null) return;
    // Content is zoomed in the popup (body.style.zoom), so widen the window
    // by the same factor and scale the height clamps to match — otherwise a
    // larger zoom would clip horizontally against the fixed 560px width.
    const width = Math.round(
      (place === "corner" ? SEARCH_WINDOW_CORNER_WIDTH : SEARCH_WINDOW_WIDTH) * zoom,
    );
    // In corner placement the list is short or empty, so the usual floor would
    // only pad the window with blank space over the message list.
    const floor = place === "corner" ? 0 : Math.round(SEARCH_WINDOW_MIN_HEIGHT * zoom);
    const height = Math.min(
      Math.round(SEARCH_WINDOW_MAX_HEIGHT * zoom),
      Math.max(floor, Math.round(requestedHeight)),
    );
    // Growing width/height keeps the top-left fixed, so re-place over the parent
    // mail window (captured at open) rather than letting the popup drift.
    const update = { width, height };
    const p = searchWindowParent;
    if (p && place === "corner") {
      update.left = Math.round(p.left + p.width - width - SEARCH_WINDOW_MARGIN);
      update.top = Math.round(p.top + p.height - height - SEARCH_WINDOW_MARGIN);
    } else if (p) {
      update.left = Math.round(p.left + (p.width - width) / 2);
      update.top = Math.round(p.top + (p.height - height) / 2);
    }
    await messenger.windows.update(searchWindowId, update);
  }

  return { openSearchWindow, resizeSearchWindow };
}
