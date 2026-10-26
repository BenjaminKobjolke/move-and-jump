// Handles popup selection, command activation, and folder actions.
import { error, input, state } from "./state.js";
import { clampZoom } from "../lib/options.js";
import { render } from "./render.js";
import { applyFilter, toggleFilterField } from "./filter.js";
import { applyScope } from "./load.js";
import { highlight } from "./rows.js";
import { applyZoom, hide, updatePlacement } from "./window.js";

/**
 * Handle selection of the active/clicked entry. Folders move/jump (and
 * close the window); commands mutate and persist options, then clear the
 * input and re-render, leaving the window open.
 */
export async function activate(entry) {
  if (!entry) return;
  if (entry.type === "column") {
    // Thunderbird persists column visibility itself, so nothing to store here.
    // The input is left as typed so the list stays on the same filter and the
    // next column is one Enter away.
    const keepIndex = state.activeIndex;
    state.columnState = await messenger.columns.toggle(state.tabId ?? -1, entry.id).catch(() => state.columnState);
    render(input.value);
    // render() resets the highlight; keep it on the row just toggled so the
    // state flip is visible where the eye already is.
    state.activeIndex = Math.min(keepIndex, Math.max(state.visible.length - 1, 0));
    highlight();
    updatePlacement();
    input.focus();
    return;
  }
  if (entry.type === "link") {
    try {
      await messenger.windows.openDefaultBrowser(entry.url);
    } catch (openError) {
      console.error("Move and Jump: opening link failed", openError);
      error.hidden = false;
      return;
    }
    hide();
    return;
  }
  if (entry.type === "identity") {
    try {
      await messenger.compose.setComposeDetails(state.tabId, { identityId: entry.identityId });
    } catch {
      error.hidden = false;
      return;
    }
    hide();
    return;
  }
  if (entry.type === "account") {
    // Same path as picking the folder out of the list by hand, so the
    // recents/weights bookkeeping and the error row come along unchanged.
    // ponytail: a unified folder id gets recorded in recentFolders too, where
    // applyScope()'s lookup drops it — it costs one recents slot and renders
    // nothing. Plumb a skip-recording flag through background.js if that ever
    // becomes visible.
    await select("jump", entry.folder);
    if (entry.unread) {
      // After the jump: switching folders clears the quick filter bar, so
      // setting it first would lose it. `show` reveals the bar, so the filter
      // is visible and can be cleared Thunderbird's own way.
      messenger.mailTabs.setQuickFilter(state.tabId, { unread: true, show: true }).catch(() => {});
    }
    return;
  }
  if (entry.type === "command") {
    if (entry.enabled === false) return;
    // navigate-top rides the same background round-trip as the message
    // actions (see MESSAGE_ACTIONS in background.js).
    if (entry.command.messageAction || entry.command.name === "navigate-top") {
      runMessageAction(entry.command.name);
      return;
    }
    switch (entry.command.name) {
      case "zoom": {
        const valid = entry.arg !== "" && !Number.isNaN(Number(entry.arg));
        if (!valid) {
          // No value yet: prefill "/zoom <current>" and preselect the number
          // so the user can overtype and Enter through the valid path below.
          input.value = `/zoom ${state.options.zoom || 100}`;
          render(input.value);
          input.setSelectionRange(input.value.indexOf(" ") + 1, input.value.length);
          input.focus();
          return;
        }
        state.options.zoom = clampZoom(entry.arg);
        applyZoom();
        break;
      }
      case "filter":
        if (!entry.arg) {
          // No query yet ("/fil", "/filter"): clear any active filter and
          // complete the input so the next keystroke starts the query.
          // Hiding here would dismiss the popup mid-word.
          applyFilter("");
          input.value = "/filter ";
          render(input.value);
          updatePlacement();
          input.focus();
          return;
        }
        // Already applied live while typing; re-apply for the click path, then
        // get out of the way so the filtered list is state.visible. The filter stays
        // on the tab (clear it with a bare "/filter", or Thunderbird's own bar).
        applyFilter(entry.arg);
        hide();
        return;
      case "body":
        await toggleFilterField("filterBody");
        break;
      case "recipients":
        await toggleFilterField("filterRecipients");
        break;
      case "fuzzy":
        state.options.fuzzySearch = !state.options.fuzzySearch;
        break;
      case "sensitive":
        state.options.caseSensitiveSearch = !state.options.caseSensitiveSearch;
        break;
      case "all":
        state.options.searchAllAccounts = !state.options.searchAllAccounts;
        applyScope();
        break;
      case "columns":
        // Complete the name; render() then lists the columns themselves.
        input.value = "/columns ";
        render(input.value);
        updatePlacement();
        input.focus();
        return;
      case "go":
        // Complete the name; render() then lists the accounts themselves.
        input.value = "/go ";
        render(input.value);
        updatePlacement();
        input.focus();
        return;
      case "links":
        input.value = "/links ";
        render(input.value);
        updatePlacement();
        input.focus();
        return;
      case "from":
        input.value = "/from ";
        render(input.value);
        updatePlacement();
        input.focus();
        return;
    }
    await messenger.storage.local.set({ options: state.options });
    input.value = "";
    render("");
    updatePlacement();
    input.focus();
    return;
  }
  select(state.mode, entry.folder);
}

/**
 * Autocomplete the active entry into the input (Tab). Folders complete to
 * their path with the leading slash stripped — folder paths start with "/"
 * (e.g. "/INBOX/Sub"), which would otherwise trigger command mode; without
 * it, filterFolders still matches the path as a substring. Commands complete
 * to "/name", plus a trailing space for arg-taking commands (zoom).
 */
export function completeActive() {
  const entry = state.visible[state.activeIndex];
  if (!entry) return;
  // Column, account and link rows have nothing useful to complete to — the input
  // already reads "/columns …" / "/go …" and completing to a name would just
  // re-filter the same list.
  if (
    entry.type === "column" ||
    entry.type === "account" ||
    entry.type === "link" ||
    entry.type === "identity"
  ) return;
  const text =
    entry.type === "command"
      ? `/${entry.command.name}${entry.command.takesArg ? " " : ""}`
      : entry.folder.path.replace(/^\/+/, "");
  input.value = text;
  render(text);
  updatePlacement();
  input.focus();
}

/**
 * Run a message command (/copy-name, /reply, …) in background.js — the same
 * code the keyboard commands use — then hide, or show the error row.
 */
async function runMessageAction(action) {
  error.hidden = true;
  state.hiding = true;
  try {
    const response = await messenger.runtime.sendMessage({ type: "message-action", action, tabId: state.tabId });
    if (response?.ok === false) throw new Error(response.error);
  } catch (actionError) {
    console.error("Move and Jump: message action failed", actionError);
    state.hiding = false;
    error.hidden = false;
    return;
  }
  hide();
}

export async function select(actionMode, folder) {
  if (!folder) {
    console.error("Move and Jump: select() called with no folder", {
      activeIndex: state.activeIndex,
      visibleCount: state.visible.length,
    });
    return;
  }
  error.hidden = true;
  state.hiding = true;
  try {
    const response = await messenger.runtime.sendMessage({
      type: "select",
      mode: actionMode,
      folderId: folder.id,
      tabId: state.tabId,
      query: input.value,
    });
    if (response?.ok === false) throw new Error(response.error);
  } catch (sendError) {
    console.error("Move and Jump: select failed", sendError);
    state.hiding = false;
    error.hidden = false;
    return;
  }
  hide();
}
