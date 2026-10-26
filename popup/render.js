// Filters folders and renders the popup's main search results.
import { empty, jumpButton, list, moveButton, state } from "./state.js";
import { filterFolders } from "../lib/match.js";
import { prioritize } from "../lib/recent.js";
import { sortByQueryWeight } from "../lib/weights.js";
import { findMatchRanges } from "../lib/highlight.js";
import { parseCommand } from "../lib/commands.js";
import { renderAccounts, renderColumns, renderIdentities, renderLinks } from "./subLists.js";
import { renderCommands } from "./commandRows.js";
import { highlight } from "./rows.js";

function folderLabel(folder) {
  return state.showAccountPrefix ? `${folder.accountName}: ${folder.path}` : folder.path;
}

/**
 * Fill `item` with `label`, wrapping the portion matching `query` (if
 * any) in a <mark> element. Built from real DOM nodes rather than
 * innerHTML, consistent with the rest of the popup.
 */
function appendHighlighted(item, label, query) {
  const ranges = query
    ? findMatchRanges(label, query, {
        caseSensitive: state.options.caseSensitiveSearch,
        fuzzy: state.options.fuzzySearch,
      })
    : [];
  if (ranges.length === 0) {
    item.textContent = label;
    return;
  }
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      item.append(document.createTextNode(label.slice(cursor, range.start)));
    }
    const mark = document.createElement("mark");
    mark.textContent = label.slice(range.start, range.end);
    item.append(mark);
    cursor = range.end;
  }
  if (cursor < label.length) {
    item.append(document.createTextNode(label.slice(cursor)));
  }
}

export function render(query) {
  // A leading "/" switches the list to slash-command mode (see
  // lib/commands.js). Folder paths that start with "/" are still
  // reachable by typing without the slash — filterFolders matches any
  // substring — so no folders become unreachable.
  const parsed = parseCommand(query);
  if (parsed) {
    // "/columns" (the complete name) lists the columns themselves; anything
    // shorter is still an ordinary command row.
    if (parsed.token === "columns") renderColumns(parsed.arg);
    else if (parsed.token === "go") renderAccounts(parsed.arg);
    else if (parsed.token === "links") renderLinks(parsed.arg);
    else if (parsed.token === "from") renderIdentities(parsed.arg);
    else renderCommands(parsed);
    return;
  }

  const trimmed = query.trim();
  const folders = trimmed
    ? prioritize(
        sortByQueryWeight(
          filterFolders(state.allFolders, trimmed, {
            caseSensitive: state.options.caseSensitiveSearch,
            fuzzy: state.options.fuzzySearch,
          }),
          state.queryWeights,
          state.folderWeights,
          trimmed,
        ),
        state.senderIds,
      )
    : state.recentFolders;
  state.visible = folders.map((folder) => ({ type: "folder", folder }));
  state.activeIndex = 0;

  list.innerHTML = "";
  const senderIdSet = new Set(state.senderIds);
  for (const entry of state.visible) {
    const item = document.createElement("li");
    if (senderIdSet.has(entry.folder.id)) {
      item.classList.add("sender");
    }
    appendHighlighted(item, folderLabel(entry.folder), trimmed);
    if (senderIdSet.has(entry.folder.id)) {
      const tag = document.createElement("span");
      tag.className = "sender-tag";
      tag.textContent = messenger.i18n.getMessage("popupSenderTag");
      tag.title = messenger.i18n.getMessage("popupSenderTagTitle");
      item.append(tag);
    }
    list.appendChild(item);
  }
  highlight();

  empty.textContent = messenger.i18n.getMessage("popupNoMatches");
  empty.hidden = !(trimmed && state.visible.length === 0);
  moveButton.disabled = jumpButton.disabled = state.visible.length === 0;
}
