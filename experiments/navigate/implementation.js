/* global ChromeUtils, Services */

// Experiment API: go to the top of the message list or the compose body.
//
// The stable API has neither: mailTabs can select messages but not by view
// row (messages.list() is folder order, not the sorted/threaded view), and a
// compose body can only be reached through `scripting`, which would cost a new
// permission prompt. So, like experiments/columns, this reaches into the
// internal windows directly.
//
// Everything here is internal API and can change with any Thunderbird release.
// Every access is feature-detected and wrapped: on failure top() resolves
// false and nothing happens.

var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs",
);

/** Start of the compose body, scrolled up, focused. */
function composeTop(win) {
  const editor = win.GetCurrentEditor?.();
  if (!editor) return false;
  editor.beginningOfDocument();
  win.document.getElementById("messageEditor")?.contentWindow?.scrollTo(0, 0);
  win.SetMsgBodyFrameFocus?.();
  return true;
}

/** First row of the thread pane, selected (like the Home key) and scrolled to. */
function listTop(win) {
  const tree = win?.threadTree;
  if (!tree || !(tree.view?.rowCount > 0)) return false;
  tree.selectedIndex = 0;
  tree.scrollToIndex?.(0);
  return true;
}

/**
 * The native window behind `tabId`: a compose window for a compose tab, the
 * about:3pane window for a mail tab.
 * @returns {Window|null}
 */
function nativeWindow(context, tabId) {
  try {
    if (tabId >= 0) {
      const nativeTab = context.extension.tabManager.get(tabId)?.nativeTab;
      // A compose "tab" is the compose window itself.
      if (nativeTab?.GetCurrentEditor) return nativeTab;
      const win = nativeTab?.chromeBrowser?.contentWindow;
      if (win?.threadTree) return win;
    }
  } catch {
    // Tab gone — fall through to the front mail window.
  }
  try {
    // ponytail: same front-window fallback as experiments/columns.
    const mail = Services.wm.getMostRecentWindow("mail:3pane");
    return mail?.document.getElementById("tabmail")?.currentAbout3Pane ?? null;
  } catch {
    return null;
  }
}

globalThis.navigate = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      navigate: {
        async top(tabId) {
          try {
            const win = nativeWindow(context, tabId);
            if (!win) return false;
            return win.GetCurrentEditor ? composeTop(win) : listTop(win);
          } catch (error) {
            console.error("Move and Jump: navigate.top failed", error);
            return false;
          }
        },
      },
    };
  }
};
