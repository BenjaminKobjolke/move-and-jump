/* global ChromeUtils, Services */

// Experiment API: adjust the message-list/message-pane split in vertical layout.
// Thunderbird 128+ owns these #threadPane/#messagePane IDs and the
// #messagePaneSplitter width/resizeDirection API. A horizontal resizeDirection
// marks vertical layout; its splitter-resized event is what paneLayout stores.
// Check these internals again when adding support for a new ESR.

var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs",
);

/** Find the about:3pane window for a mail tab, or the front mail window. */
function about3Pane(context, tabId) {
  try {
    if (tabId >= 0) {
      const nativeTab = context.extension.tabManager.get(tabId)?.nativeTab;
      const win = nativeTab?.chromeBrowser?.contentWindow;
      if (win?.threadPane) return win;
    }
  } catch {
    // The tab may have closed or may not be a mail tab; try the front window.
  }
  try {
    const mail = Services.wm.getMostRecentWindow("mail:3pane");
    const win = mail?.document.getElementById("tabmail")?.currentAbout3Pane;
    return win?.threadPane ? win : null;
  } catch {
    return null;
  }
}

/** Return the pane elements only when Thunderbird configures a horizontal split. */
function verticalPanes(win) {
  const thread = win?.document?.getElementById("threadPane");
  const message = win?.document?.getElementById("messagePane");
  const splitter = win?.document?.getElementById("messagePaneSplitter");
  if (!thread || !message || splitter?.resizeDirection !== "horizontal") return null;
  return { thread, message, splitter };
}

globalThis.pane = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      pane: {
        async getListPercent(tabId) {
          try {
            const parts = verticalPanes(about3Pane(context, tabId));
            if (!parts) return null;
            const threadWidth = parts.thread.getBoundingClientRect()?.width;
            const messageWidth = parts.message.getBoundingClientRect()?.width;
            const total = threadWidth + messageWidth;
            if (!(total > 0)) return null;
            return Math.round(100 * threadWidth / total);
          } catch (error) {
            console.error("Move and Jump: pane.getListPercent failed", error);
            return null;
          }
        },

        async setListPercent(tabId, percent) {
          try {
            const win = about3Pane(context, tabId);
            const parts = verticalPanes(win);
            if (!parts || !Number.isInteger(percent) || percent < 10 || percent > 90) {
              return false;
            }
            const threadWidth = parts.thread.getBoundingClientRect()?.width;
            const messageWidth = parts.message.getBoundingClientRect()?.width;
            const total = threadWidth + messageWidth;
            if (!(total > 0) || !("width" in parts.splitter)) return false;

            parts.splitter.width = Math.round(total * (100 - percent) / 100);
            parts.splitter.dispatchEvent(
              new win.CustomEvent("splitter-resized", { bubbles: true }),
            );
            return true;
          } catch (error) {
            console.error("Move and Jump: pane.setListPercent failed", error);
            return false;
          }
        },
      },
    };
  }
};
