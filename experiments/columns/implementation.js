/* eslint-env mozilla/browser-window */
/* global ChromeUtils, ExtensionCommon, Services */

// Experiment API: message-list column visibility.
//
// Thunderbird's stable WebExtension API has no column control — mailTabs
// covers layout, panes, sort and the quick filter, but not which columns the
// thread pane shows. So this reaches into the internal about:3pane window and
// does exactly what Thunderbird's own column picker does: flip `hidden` on the
// column, persist, redraw.
//
// Everything here is internal API and can change with any Thunderbird release.
// Every access is therefore feature-detected and wrapped: on failure the API
// returns an empty list and the popup shows a disabled row instead of breaking.

var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs",
);

/**
 * The about:3pane window of a mail tab (the window that owns `threadPane`).
 * @param {object} context extension context, for the tab manager
 * @param {number} tabId mail tab id, or -1 for "the front mail window"
 * @returns {Window|null}
 */
function about3Pane(context, tabId) {
  try {
    if (tabId >= 0) {
      const nativeTab = context.extension.tabManager.get(tabId)?.nativeTab;
      const win = nativeTab?.chromeBrowser?.contentWindow;
      if (win?.threadPane) return win;
    }
  } catch (error) {
    // Tab gone or not a mail tab — fall through to the front window.
  }
  try {
    // ponytail: front mail window as fallback; only wrong with several mail
    // windows open and the popup opened for the one that isn't in front.
    const mail = Services.wm.getMostRecentWindow("mail:3pane");
    const win = mail?.document.getElementById("tabmail")?.currentAbout3Pane;
    return win?.threadPane ? win : null;
  } catch (error) {
    return null;
  }
}

/** Human-readable column name, from Fluent when possible. */
async function labelFor(win, column) {
  const id = column.l10n?.menuitem ?? column.l10n?.header;
  if (id && win.document.l10n) {
    try {
      const value = await win.document.l10n.formatValue(id);
      if (value) return value;
    } catch (error) {
      // Unknown Fluent id (e.g. a column added by another add-on).
    }
  }
  return column.name ?? column.id;
}

async function listColumns(win) {
  const columns = win?.threadPane?.columns;
  if (!Array.isArray(columns)) return [];
  return Promise.all(
    columns.map(async (column) => ({
      id: column.id,
      label: await labelFor(win, column),
      hidden: !!column.hidden,
    })),
  );
}

var columns = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      columns: {
        async list(tabId) {
          try {
            return await listColumns(about3Pane(context, tabId));
          } catch (error) {
            console.error("Move and Jump: columns.list failed", error);
            return [];
          }
        },

        async toggle(tabId, columnId) {
          const win = about3Pane(context, tabId);
          try {
            const column = win?.threadPane?.columns?.find((c) => c.id === columnId);
            if (!column) return await listColumns(win);
            column.hidden = !column.hidden;
            // Same three steps as about:3pane's own column picker.
            win.threadPane.persistColumnStates?.();
            win.threadPane.updateColumns?.();
            win.threadTree?.invalidate?.();
            return await listColumns(win);
          } catch (error) {
            console.error("Move and Jump: columns.toggle failed", error);
            return [];
          }
        },
      },
    };
  }
};
