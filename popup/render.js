// Filters folders and renders the popup's main search results.
import { commandResult, empty, jumpButton, list, moveButton, state } from "./state.js";
import { filterFolders, matchBand } from "../lib/match.js";
import { prioritize } from "../lib/recent.js";
import { sortByQueryWeight } from "../lib/weights.js";
import { findMatchRanges } from "../lib/highlight.js";
import { parseCommand } from "../lib/commands.js";
import {
  renderAccounts,
  renderAttachments,
  renderColumns,
  renderIdentities,
  renderLinks,
  renderTags,
} from "./subLists.js";
import { partialTag } from "../lib/filterQuery.js";
import { renderCommands } from "./commandRows.js";
import { createLabel, highlight } from "./rows.js";
import { canDemote, createDemoteButton } from "./demote.js";

function folderLabel(folder) {
  return state.showAccountPrefix ? `${folder.accountName}: ${folder.path}` : folder.path;
}

/** The options lib/match.js and lib/highlight.js share. */
function matchOptions() {
  return {
    caseSensitive: state.options.caseSensitiveSearch,
    fuzzy: state.options.fuzzySearch,
  };
}

/**
 * Fill `item` with `folder`'s label, wrapping the portions matching the
 * words of `query` (if any) in <mark> elements. Built from real DOM
 * nodes rather than innerHTML, consistent with the rest of the popup.
 */
function appendHighlighted(item, folder, query) {
  const label = folderLabel(folder);
  // The label ends with the folder's own name; prefer highlighting
  // words there over an earlier occurrence in a parent folder's name.
  const preferFrom = label.endsWith(folder.name) ? label.length - folder.name.length : 0;
  const ranges = query ? findMatchRanges(label, query, { ...matchOptions(), preferFrom }) : [];
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
  commandResult.hidden = true;

  // A leading "/" switches the list to slash-command mode (see
  // lib/commands.js). Folder paths that start with "/" are still
  // reachable by typing without the slash — filterFolders matches any
  // substring — so no folders become unreachable.
  const parsed = parseCommand(query);
  if (parsed) {
    const tagPrefix = parsed.token === "filter" ? partialTag(query) : null;
    // "/columns" (the complete name) lists the columns themselves; anything
    // shorter is still an ordinary command row.
    if (parsed.token === "columns") renderColumns(parsed.arg);
    else if (parsed.token === "go") renderAccounts(parsed.arg);
    else if (parsed.token === "links") renderLinks(parsed.arg);
    else if (parsed.token === "open-attachments") renderAttachments(parsed.arg);
    else if (parsed.token === "from") renderIdentities(parsed.arg);
    else if (tagPrefix !== null) renderTags(tagPrefix);
    else renderCommands(parsed);
    return;
  }

  const trimmed = query.trim();
  const folders = trimmed
    ? prioritize(
        sortByQueryWeight(
          filterFolders(state.allFolders, trimmed, matchOptions()),
          state.queryWeights,
          state.folderWeights,
          trimmed,
          (folder) => matchBand(folder, trimmed, matchOptions()),
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
    const label = createLabel();
    appendHighlighted(label, entry.folder, trimmed);
    item.append(label);
    if (senderIdSet.has(entry.folder.id)) {
      const tag = document.createElement("span");
      tag.className = "sender-tag";
      tag.textContent = messenger.i18n.getMessage("popupSenderTag");
      tag.title = messenger.i18n.getMessage("popupSenderTagTitle");
      item.append(tag);
    }
    if (canDemote(entry, trimmed)) item.append(createDemoteButton());
    list.appendChild(item);
  }
  highlight();

  empty.textContent = messenger.i18n.getMessage("popupNoMatches");
  empty.hidden = !(trimmed && state.visible.length === 0);
  moveButton.disabled = jumpButton.disabled = state.visible.length === 0;
}
