// Builds slash-command rows and their localized labels.
import { empty, jumpButton, list, moveButton, state } from "./state.js";
import { clampZoom } from "../lib/options.js";
import { matchCommands } from "../lib/commands.js";
import { goEntries } from "./subLists.js";
import { highlight, onOff, renderRows } from "./rows.js";

// i18n keys can't hold the commands' hyphens, hence a map.
const MESSAGE_ACTION_LABELS = {
  "copy-name": "commandCopyName",
  "copy-email": "commandCopyEmail",
  "copy-subject": "commandCopySubject",
  "save-attachments": "commandSaveAttachments",
  write: "commandWrite",
  reply: "commandReply",
  "reply-all": "commandReplyAll",
};

/** Build a command result entry: its display label and enabled state. */
function commandEntry(command, arg) {
  let label;
  let enabled = true;
  switch (command.name) {
    case "zoom": {
      // Selectable with or without a value: with a valid number it applies;
      // without one, activate() prefills the input for editing (see below).
      const valid = arg !== "" && !Number.isNaN(Number(arg));
      label = valid
        ? messenger.i18n.getMessage("commandZoomSet", [String(clampZoom(arg))])
        : messenger.i18n.getMessage("commandZoomHint", [String(state.options.zoom || 100)]);
      break;
    }
    case "filter":
      label = arg
        ? messenger.i18n.getMessage("commandFilterSet", [arg])
        : messenger.i18n.getMessage("commandFilterClear");
      break;
    case "body":
      label = messenger.i18n.getMessage("commandToggleBody", [onOff(state.options.filterBody)]);
      break;
    case "recipients":
      label = messenger.i18n.getMessage("commandToggleRecipients", [
        onOff(state.options.filterRecipients),
      ]);
      break;
    case "fuzzy":
      label = messenger.i18n.getMessage("commandToggleFuzzy", [onOff(state.options.fuzzySearch)]);
      break;
    case "all":
      label = messenger.i18n.getMessage("commandToggleAll", [onOff(state.options.searchAllAccounts)]);
      break;
    case "sensitive":
      label = messenger.i18n.getMessage("commandToggleSensitive", [
        onOff(state.options.caseSensitiveSearch),
      ]);
      break;
    case "columns":
      // Only ever a "press Enter" row: completing the name switches the list
      // to the columns themselves (see renderColumns).
      enabled = state.columnState.length > 0;
      label = messenger.i18n.getMessage(
        enabled ? "commandColumnsHint" : "commandColumnsUnavailable",
      );
      break;
    case "go":
      // Like /columns, only ever a "press Enter" row: completing the name
      // switches the list to the accounts themselves (see renderAccounts).
      enabled = goEntries().length > 0;
      label = messenger.i18n.getMessage(enabled ? "commandGoHint" : "commandGoUnavailable");
      break;
    case "links":
      // Same two-level shape: completing the name lists the links themselves.
      enabled = state.linkState.length > 0;
      label = messenger.i18n.getMessage(enabled ? "commandLinksHint" : "commandLinksUnavailable");
      break;
    case "from":
      // Completing the name lists sender identities for a compose tab.
      enabled = state.identityState.identities.length > 0;
      label = messenger.i18n.getMessage(
        enabled ? "commandFromHint" : "commandFromUnavailable",
      );
      break;
    case "navigate-top":
      enabled = state.tabId !== undefined;
      label = messenger.i18n.getMessage("commandNavigateTop");
      break;
    default:
      if (command.messageAction) {
        enabled = state.hasDisplayedMessage;
        label = messenger.i18n.getMessage(
          enabled ? MESSAGE_ACTION_LABELS[command.name] : "commandMessageUnavailable",
        );
      }
      break;
  }
  return { type: "command", command, arg, label, enabled };
}

export function renderCommands({ token, arg }) {
  renderRows(matchCommands(token).map((command) => commandEntry(command, arg)));
  // Which fields the filter searches, and the shortcuts that flip the optional
  // two — shown right where a query is being typed, so a query that matches
  // nothing has its fix on screen. This hint is not a selectable result entry.
  if (token === "filter") {
    const hint = document.createElement("li");
    hint.textContent = messenger.i18n.getMessage("commandFilterFields", [
      onOff(state.options.filterBody),
      onOff(state.options.filterRecipients),
    ]);
    hint.classList.add("disabled", "filter-hint");
    list.appendChild(hint);
  }
  highlight();

  empty.textContent = messenger.i18n.getMessage("popupNoCommands");
  empty.hidden = state.visible.length !== 0;
  // Move/Jump act on folders, not commands.
  moveButton.disabled = jumpButton.disabled = true;
}
