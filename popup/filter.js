// Applies command field toggles and quick filters to the active mail tab.
import { input, state } from "./state.js";
import { parseCommand } from "../lib/commands.js";

/**
 * Flip one of the optional filter fields, persist it, and re-apply the active
 * query so the effect is immediate. Reached two ways: the /body and
 * /recipients command rows, and Ctrl+B / Ctrl+R while typing a /filter query
 * (which is where you actually notice a query matching nothing).
 * @param {"filterBody"|"filterRecipients"} key
 */
export const isFilterMode = () => parseCommand(input.value)?.token === "filter";

export async function toggleFilterField(key) {
  state.options[key] = !state.options[key];
  await messenger.storage.local.set({ options: state.options });
  applyFilter(state.lastFilterQuery);
}

/**
 * Filter the mail tab's message list via Thunderbird's own quick filter.
 * Sender and subject are always searched; /body and /recipients widen it.
 * An empty query clears the filter. The quick filter ANDs whitespace-separated
 * terms and ORs each term across the enabled fields, so "inn lehrich@theim"
 * matches a message whose subject has "Inn" and whose sender has "lehrich@theim".
 * @param {string} query
 */
export function applyFilter(query) {
  state.lastFilterQuery = query;
  if (state.tabId === undefined) return;
  const text = query
    ? {
        text: query,
        author: true,
        subject: true,
        recipients: state.options.filterRecipients,
        body: state.options.filterBody,
      }
    : null;
  // Clearing: put the Quick Filter bar away too, otherwise an emptied bar keeps
  // occupying a row of the mail tab until Ctrl+Shift+K. Only on the clearing
  // call — while a query is active the bar is the visible sign a filter is on,
  // and the way to drop it without the popup.
  const properties = text ? { text } : { text: null, show: false };
  // The tab can be gone (same race as the mailTabs.get() in init()); a failed
  // filter is not worth surfacing an error row for.
  // ponytail: no debounce; add one if typing stutters on very large folders.
  messenger.mailTabs.setQuickFilter(state.tabId, properties).catch(() => {});
}
