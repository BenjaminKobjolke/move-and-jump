// Loads popup data and derives the currently visible folder scope.
import { input, state } from "./state.js";
import { getOptions } from "../lib/options.js";
import { decodeImapUtf7 } from "../lib/imapUtf7.js";
import { filterByAccount } from "../lib/folders.js";
import { extractUrls, dedupeLinks } from "../lib/links.js";
import { render } from "./render.js";
import { applyZoom, updatePlacement } from "./window.js";

export async function init() {
  const [
    folders,
    accounts,
    opts,
    { recentFolders: storedRecentIds = [] },
    { folderWeights: weights = {} },
    { queryWeights: qWeights = {} },
    tab,
    cols,
    unified,
    displayed,
    identities,
  ] = await Promise.all([
    messenger.folders.query({}),
    messenger.accounts.list(),
    getOptions(messenger.storage.local),
    messenger.storage.local.get("recentFolders"),
    messenger.storage.local.get("folderWeights"),
    messenger.storage.local.get("queryWeights"),
    // The tab can close in the moment between background.js resolving
    // tabId and this running; a rejection here is only used for the
    // "search all accounts" scoping below, so fall back to unscoped
    // rather than letting the whole Promise.all reject.
    state.tabId === undefined ? undefined : messenger.mailTabs.get(state.tabId).catch(() => undefined),
    listColumns(),
    // Unified folders are a TB 128+ nicety; degrade to none rather than
    // failing the whole popup if this Thunderbird won't serve them.
    messenger.folders.query({ isUnified: true }).catch(() => []),
    loadDisplayed().catch((displayError) => {
      console.error("Move and Jump: reading the displayed message failed", displayError);
      return { single: false, links: [] };
    }),
    loadIdentities().catch(() => ({ currentId: undefined, identities: [] })),
  ]);
  state.rawFolders = folders;
  state.unifiedFolders = unified;
  state.accountsList = accounts;
  state.recentIds = storedRecentIds;
  state.activeTab = tab;
  state.folderWeights = weights;
  state.queryWeights = qWeights;
  state.options = opts;
  state.columnState = cols;
  state.linkState = displayed.links;
  state.identityState = identities;
  state.hasDisplayedMessage = displayed.single;

  state.senderIds =
    state.options.senderSuggestions && state.mode === "move" && state.tabId !== undefined
      ? await loadSenderFolderIds().catch(() => [])
      : [];

  applyScope();

  render(input.value);
  input.focus();

  // Set the popup zoom and size the window to fit the initial
  // (recent-folders) view without scrolling. applyZoom() measures the
  // now-rendered, now-zoomed DOM, so render() must run first. Not
  // repeated on every later render() while typing — the window keeps
  // this size and the list scrolls internally for larger result sets.
  applyZoom();
  // A /filter prefill (the filter-search command) opens straight into filter
  // mode, so move out of the message list's way right away. After applyZoom()
  // so the corner placement is the last geometry sent.
  updatePlacement();
}

async function loadSenderFolderIds() {
  const { messages = [] } = await messenger.mailTabs.getSelectedMessages(state.tabId);
  if (messages.length === 0) return [];
  const emails = new Set();
  for (const message of messages) {
    const senders = await messenger.messengerUtilities.parseMailboxString(message.author);
    if (!senders.some((sender) => sender?.email)) return [];
    for (const sender of senders) {
      if (sender?.email) emails.add(sender.email.toLowerCase());
    }
  }
  if (emails.size !== 1) return [];
  const [email] = emails;
  const { senderFolders = {} } = await messenger.storage.local.get("senderFolders");
  return senderFolders[email] ?? [];
}

/**
 * Recompute allFolders / recentFolders / showAccountPrefix from the raw
 * inputs and the current searchAllAccounts option. Called on startup
 * and again whenever the `/all` command flips the scope.
 */
export function applyScope() {
  const scopedFolders = state.options.searchAllAccounts
    ? state.rawFolders
    : filterByAccount(state.rawFolders, state.activeTab?.displayedFolder?.accountId);

  // Folder names commonly repeat across accounts ("Inbox", "Sent", …);
  // attach each folder's account name so the list — and the search
  // ranking in lib/match.js — can disambiguate them. Only show the
  // prefix in the UI when more than one account is present in scope.
  const accountNameById = new Map(state.accountsList.map((account) => [account.id, account.name]));
  state.allFolders = scopedFolders.map((folder) => ({
    ...folder,
    // IMAP folder names/paths come back as raw, undecoded modified
    // UTF-7 (RFC 3501) for anything containing non-ASCII characters —
    // e.g. "M&APw-nchen" instead of "München". Decode for display and
    // search matching; `id`/`accountId` are left untouched, since
    // those are opaque identifiers passed straight back to Thunderbird.
    name: decodeImapUtf7(folder.name ?? ""),
    path: decodeImapUtf7(folder.path ?? ""),
    accountName: accountNameById.get(folder.accountId) ?? "",
  }));
  state.showAccountPrefix = new Set(state.allFolders.map((folder) => folder.accountId)).size > 1;

  const byId = new Map(state.allFolders.map((folder) => [folder.id, folder]));
  const senderFolders = state.senderIds.map((id) => byId.get(id)).filter(Boolean);
  const recentIdsWithSenders = new Set(state.senderIds);
  state.recentFolders = [
    ...senderFolders,
    ...state.recentIds
      .filter((id) => !recentIdsWithSenders.has(id))
      .map((id) => byId.get(id))
      .filter(Boolean),
  ];
}

/** Read the message list's columns; [] whenever the experiment can't serve them. */
async function listColumns() {
  try {
    // -1: no mail tab known — the experiment falls back to the front mail window.
    return (await messenger.columns.list(state.tabId ?? -1)) ?? [];
  } catch {
    return [];
  }
}

/**
 * Whether the tab shows exactly one message, and every http(s) link in it,
 * anchors first. HTML parts give anchor text + href via DOMParser (no script
 * runs in a parsed document); plain-text parts only have bare urls, which
 * label themselves.
 * @returns {Promise<{single: boolean, links: Array<{text: string, url: string}>}>}
 */
async function loadDisplayed() {
  if (state.tabId === undefined) return { single: false, links: [] };
  // MV3: getDisplayedMessages returns a MessageList; the singular call is MV2-only.
  const { messages = [] } = await messenger.messageDisplay.getDisplayedMessages(state.tabId);
  if (messages.length !== 1) return { single: false, links: [] };
  const [message] = messages;
  const parts = await messenger.messages.listInlineTextParts(message.id);
  const links = [];
  for (const part of parts) {
    if (part.contentType === "text/html") {
      const doc = new DOMParser().parseFromString(part.content, "text/html");
      for (const anchor of doc.querySelectorAll("a[href]")) {
        links.push({ text: anchor.textContent.replace(/\s+/g, " ").trim(), url: anchor.href });
      }
    } else {
      for (const url of extractUrls(part.content)) links.push({ text: url, url });
    }
  }
  return { single: true, links: dedupeLinks(links) };
}

/** Read the active compose identity and the identities available in this profile. */
async function loadIdentities() {
  if (state.tabId === undefined) return { currentId: undefined, identities: [] };
  const details = await messenger.compose.getComposeDetails(state.tabId);
  const identities = await messenger.identities.list();
  return {
    currentId: details.identityId,
    identities: identities.map((identity) => ({
      id: String(identity.id ?? ""),
      name: String(identity.name ?? ""),
      email: String(identity.email ?? ""),
      label: String(identity.label ?? ""),
    })),
  };
}
