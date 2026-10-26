// Renders the popup's column, account, link, and identity sublists.
import { empty, jumpButton, moveButton, state } from "./state.js";
import { filterIdentities } from "../lib/identities.js";
import { inboxFolders, orderUnified } from "../lib/folders.js";
import { highlight, onOff, renderRows } from "./rows.js";

/**
 * One row per message-list column, prefix-filtered by `arg`. Selecting a row
 * shows/hides that column; the popup stays open so several can be flipped.
 */
export function renderColumns(arg) {
  const needle = arg.toLowerCase();
  const matches = state.columnState.filter(
    (column) =>
      column.label.toLowerCase().startsWith(needle) || column.id.toLowerCase().startsWith(needle),
  );
  renderRows(
    matches.map((column) => ({
      type: "column",
      id: column.id,
      label: messenger.i18n.getMessage("commandColumnToggle", [
        column.label,
        onOff(!column.hidden),
      ]),
    })),
  );
  highlight();

  empty.textContent = messenger.i18n.getMessage(
    state.columnState.length === 0 ? "commandColumnsUnavailable" : "popupNoCommands",
  );
  empty.hidden = state.visible.length !== 0;
  moveButton.disabled = jumpButton.disabled = true;
}

/**
 * Every row `/go` can offer, in display order: "all unread" first, then one row
 * per account inbox, then the unified folders. `key` is what the argument
 * prefix-filters on. Built from the raw folders, not the scoped list: the latter is
 * narrowed to one account while "search all accounts" is off, which is exactly
 * when this command is most useful.
 */
export function goEntries() {
  const accountNameById = new Map(state.accountsList.map((account) => [account.id, account.name]));
  const unified = orderUnified(state.unifiedFolders);
  const unifiedInbox = inboxFolders(unified)[0];

  const entries = [];
  if (unifiedInbox) {
    // "All unread" is not a folder Thunderbird has: it's the unified inbox
    // (every account's mail in one list) plus the unread quick filter, applied
    // after the jump in activate().
    entries.push({
      type: "account",
      folder: unifiedInbox,
      unread: true,
      key: "unread",
      label: messenger.i18n.getMessage("commandGoUnread"),
    });
  }
  for (const folder of inboxFolders(state.rawFolders)) {
    const accountName = accountNameById.get(folder.accountId) ?? "";
    entries.push({
      type: "account",
      folder,
      key: accountName,
      label: messenger.i18n.getMessage("commandGoAccount", [accountName]),
    });
  }
  for (const folder of unified) {
    // Unified folders carry no accountId, and Thunderbird already localizes
    // their names ("Inbox" / "Posteingang"), so the name is the label.
    entries.push({
      type: "account",
      folder,
      key: folder.name,
      label: messenger.i18n.getMessage("commandGoUnified", [folder.name]),
    });
  }
  return entries;
}

/** The `/go` rows, prefix-filtered by `arg` on each row's `key`. */
export function renderAccounts(arg) {
  const needle = arg.toLowerCase();
  const entries = goEntries();
  renderRows(entries.filter((entry) => entry.key.toLowerCase().startsWith(needle)));
  highlight();

  empty.textContent = messenger.i18n.getMessage(
    entries.length === 0 ? "commandGoUnavailable" : "popupNoCommands",
  );
  empty.hidden = state.visible.length !== 0;
  moveButton.disabled = jumpButton.disabled = true;
}

/** The `/links` rows, substring-filtered by `arg` on text and url. */
export function renderLinks(arg) {
  const needle = arg.toLowerCase();
  const entries = state.linkState.map(({ text, url }) => ({
    type: "link",
    url,
    label: text && text !== url ? `${text} — ${url}` : url,
  }));
  renderRows(entries.filter((entry) => entry.label.toLowerCase().includes(needle)));
  highlight();

  empty.textContent = messenger.i18n.getMessage(
    entries.length === 0 ? "commandLinksUnavailable" : "popupNoCommands",
  );
  empty.hidden = state.visible.length !== 0;
  moveButton.disabled = jumpButton.disabled = true;
}

/** The `/from` rows, matching all query terms across identity fields. */
export function renderIdentities(arg) {
  const entries = filterIdentities(state.identityState.identities, arg).map((identity) => {
    const email = identity.email ? ` <${identity.email}>` : "";
    const label = identity.label ? ` (${identity.label})` : "";
    const identityText = `${identity.name}${email}${label}`;
    const rowLabel = messenger.i18n.getMessage("commandFromIdentity", [identityText]);
    return {
      type: "identity",
      identityId: identity.id,
      label:
        identity.id === state.identityState.currentId
          ? `${rowLabel} (${messenger.i18n.getMessage("commandFromCurrent")})`
          : rowLabel,
    };
  });
  renderRows(entries);
  highlight();

  empty.textContent = messenger.i18n.getMessage(
    state.identityState.identities.length === 0 ? "commandFromUnavailable" : "popupNoCommands",
  );
  empty.hidden = state.visible.length !== 0;
  moveButton.disabled = jumpButton.disabled = true;
}
