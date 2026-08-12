import { filterFolders } from "../lib/match.js";
import { filterByAccount } from "../lib/folders.js";
import { getOptions, clampZoom } from "../lib/options.js";
import { decodeImapUtf7 } from "../lib/imapUtf7.js";
import { sortByQueryWeight } from "../lib/weights.js";
import { findMatchRanges } from "../lib/highlight.js";
import { parseCommand, matchCommands } from "../lib/commands.js";

const heading = document.getElementById("heading");
const input = document.getElementById("query");
const list = document.getElementById("results");
const empty = document.getElementById("empty");
const error = document.getElementById("error");
const moveButton = document.getElementById("moveButton");
const jumpButton = document.getElementById("jumpButton");
const cancelButton = document.getElementById("cancelButton");

// Passed via the window URL (see background.js's openSearchWindow),
// not storage, so both are available synchronously with no risk of a
// race against background.js. tabId identifies the mail tab this
// window was opened for — this window is its own top-level window,
// so `currentWindow: true` queries from in here would resolve to
// *this* window, not the mail window.
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode") === "jump" ? "jump" : "move";
const tabId = params.has("tabId") ? Number(params.get("tabId")) : undefined;

let options;
// Raw inputs kept around so a `/all` toggle can recompute the scoped
// folder view without re-querying Thunderbird (see applyScope()).
let rawFolders = [];
let accountsList = [];
let activeTab;
let recentIds = [];
let allFolders = [];
let recentFolders = [];
let folderWeights = {};
let queryWeights = {};
// Each entry is { type: "folder", folder } or
// { type: "command", command, arg, label, enabled }.
let visible = [];
let activeIndex = 0;
let showAccountPrefix = false;

// Set text and grab focus immediately, synchronously, before any
// async work below: Thunderbird only autofocuses the popup document
// itself, not a specific element, and focus() calls made after an
// await are prone to lose the race against the popup's own initial
// focus handling. The `autofocus` attribute in search.html is a
// second line of defense; render()'s repeat call below is a third.
document.title = messenger.i18n.getMessage("actionTitle");
heading.textContent = messenger.i18n.getMessage(
  mode === "move" ? "popupHeadingMove" : "popupHeadingJump",
);
input.placeholder = messenger.i18n.getMessage(
  mode === "move" ? "popupPlaceholderMove" : "popupPlaceholderJump",
);
empty.textContent = messenger.i18n.getMessage("popupNoMatches");
error.textContent = messenger.i18n.getMessage("popupError");
moveButton.textContent = messenger.i18n.getMessage("buttonMove");
jumpButton.textContent = messenger.i18n.getMessage("buttonJump");
cancelButton.textContent = messenger.i18n.getMessage("buttonCancel");
moveButton.classList.toggle("primary", mode === "move");
jumpButton.classList.toggle("primary", mode === "jump");
input.focus();

async function init() {
  const [
    folders,
    accounts,
    opts,
    { recentFolders: storedRecentIds = [] },
    { folderWeights: weights = {} },
    { queryWeights: qWeights = {} },
    tab,
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
    tabId === undefined ? undefined : messenger.mailTabs.get(tabId).catch(() => undefined),
  ]);
  rawFolders = folders;
  accountsList = accounts;
  recentIds = storedRecentIds;
  activeTab = tab;
  folderWeights = weights;
  queryWeights = qWeights;
  options = opts;

  applyScope();

  render("");
  input.focus();

  // Set the popup zoom and size the window to fit the initial
  // (recent-folders) view without scrolling. applyZoom() measures the
  // now-rendered, now-zoomed DOM, so render() must run first. Not
  // repeated on every later render() while typing — the window keeps
  // this size and the list scrolls internally for larger result sets.
  applyZoom();
}

/**
 * Recompute allFolders / recentFolders / showAccountPrefix from the raw
 * inputs and the current options.searchAllAccounts. Called on startup
 * and again whenever the `/all` command flips the scope.
 */
function applyScope() {
  const scopedFolders = options.searchAllAccounts
    ? rawFolders
    : filterByAccount(rawFolders, activeTab?.displayedFolder?.accountId);

  // Folder names commonly repeat across accounts ("Inbox", "Sent", …);
  // attach each folder's account name so the list — and the search
  // ranking in lib/match.js — can disambiguate them. Only show the
  // prefix in the UI when more than one account is present in scope.
  const accountNameById = new Map(accountsList.map((account) => [account.id, account.name]));
  allFolders = scopedFolders.map((folder) => ({
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
  showAccountPrefix = new Set(allFolders.map((folder) => folder.accountId)).size > 1;

  const byId = new Map(allFolders.map((folder) => [folder.id, folder]));
  recentFolders = recentIds.map((id) => byId.get(id)).filter(Boolean);
}

/** Apply options.zoom to the popup body and resize the window to match. */
function applyZoom() {
  const factor = (options.zoom || 100) / 100;
  document.body.style.zoom = factor;
  messenger.runtime
    .sendMessage({ type: "resize", height: measureRequiredWindowHeight(), zoom: factor })
    .catch(() => {});
}

/**
 * How tall this window would need to be to show all of its current
 * content without the list scrolling — measured from the real,
 * rendered DOM rather than assumed, since font size, DPI, and OS text
 * scaling all affect this and none of them are known ahead of time.
 * Temporarily lifts the list's height/overflow constraints (which
 * would otherwise clip it to whatever height it currently has) so
 * `scrollHeight` reflects the natural, unclipped content size; then
 * converts that content height into an outer *window* height by
 * adding this window's current chrome overhead (title bar etc. —
 * `outerHeight - innerHeight`), whatever that happens to be on this
 * system.
 */
function measureRequiredWindowHeight() {
  document.body.classList.add("measuring");
  const contentHeight = document.documentElement.scrollHeight;
  document.body.classList.remove("measuring");
  const chromeOverhead = window.outerHeight - window.innerHeight;
  return contentHeight + chromeOverhead;
}

function folderLabel(folder) {
  return showAccountPrefix ? `${folder.accountName}: ${folder.path}` : folder.path;
}

/**
 * Fill `item` with `label`, wrapping the portion matching `query` (if
 * any) in a <mark> element. Built from real DOM nodes rather than
 * innerHTML, consistent with the rest of the popup.
 */
function appendHighlighted(item, label, query) {
  const ranges = query
    ? findMatchRanges(label, query, {
        caseSensitive: options.caseSensitiveSearch,
        fuzzy: options.fuzzySearch,
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

function render(query) {
  // A leading "/" switches the list to slash-command mode (see
  // lib/commands.js). Folder paths that start with "/" are still
  // reachable by typing without the slash — filterFolders matches any
  // substring — so no folders become unreachable.
  const parsed = parseCommand(query);
  if (parsed) {
    renderCommands(parsed);
    return;
  }

  const trimmed = query.trim();
  const folders = trimmed
    ? sortByQueryWeight(
        filterFolders(allFolders, trimmed, {
          caseSensitive: options.caseSensitiveSearch,
          fuzzy: options.fuzzySearch,
        }),
        queryWeights,
        folderWeights,
        trimmed,
      )
    : recentFolders;
  visible = folders.map((folder) => ({ type: "folder", folder }));
  activeIndex = 0;

  list.innerHTML = "";
  for (const entry of visible) {
    const item = document.createElement("li");
    appendHighlighted(item, folderLabel(entry.folder), trimmed);
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      activate(entry);
    });
    list.appendChild(item);
  }
  highlight();

  empty.textContent = messenger.i18n.getMessage("popupNoMatches");
  empty.hidden = !(trimmed && visible.length === 0);
  moveButton.disabled = jumpButton.disabled = visible.length === 0;
}

function renderCommands({ token, arg }) {
  visible = matchCommands(token).map((command) => commandEntry(command, arg));
  activeIndex = 0;

  list.innerHTML = "";
  for (const entry of visible) {
    const item = document.createElement("li");
    item.textContent = entry.label;
    if (entry.enabled === false) item.classList.add("disabled");
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      activate(entry);
    });
    list.appendChild(item);
  }
  highlight();

  empty.textContent = messenger.i18n.getMessage("popupNoCommands");
  empty.hidden = visible.length !== 0;
  // Move/Jump act on folders, not commands.
  moveButton.disabled = jumpButton.disabled = true;
}

const onOff = (value) => messenger.i18n.getMessage(value ? "onState" : "offState");

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
        : messenger.i18n.getMessage("commandZoomHint", [String(options.zoom || 100)]);
      break;
    }
    case "fuzzy":
      label = messenger.i18n.getMessage("commandToggleFuzzy", [onOff(options.fuzzySearch)]);
      break;
    case "all":
      label = messenger.i18n.getMessage("commandToggleAll", [onOff(options.searchAllAccounts)]);
      break;
    case "sensitive":
      label = messenger.i18n.getMessage("commandToggleSensitive", [
        onOff(options.caseSensitiveSearch),
      ]);
      break;
  }
  return { type: "command", command, arg, label, enabled };
}

/**
 * Handle selection of the active/clicked entry. Folders move/jump (and
 * close the window); commands mutate + persist options, then clear the
 * input and re-render, leaving the window open.
 */
async function activate(entry) {
  if (!entry) return;
  if (entry.type === "command") {
    if (entry.enabled === false) return;
    switch (entry.command.name) {
      case "zoom": {
        const valid = entry.arg !== "" && !Number.isNaN(Number(entry.arg));
        if (!valid) {
          // No value yet: prefill "/zoom <current>" and preselect the number
          // so the user can overtype and Enter through the valid path below.
          input.value = `/zoom ${options.zoom || 100}`;
          render(input.value);
          input.setSelectionRange(input.value.indexOf(" ") + 1, input.value.length);
          input.focus();
          return;
        }
        options.zoom = clampZoom(entry.arg);
        applyZoom();
        break;
      }
      case "fuzzy":
        options.fuzzySearch = !options.fuzzySearch;
        break;
      case "sensitive":
        options.caseSensitiveSearch = !options.caseSensitiveSearch;
        break;
      case "all":
        options.searchAllAccounts = !options.searchAllAccounts;
        applyScope();
        break;
    }
    await messenger.storage.local.set({ options });
    input.value = "";
    render("");
    input.focus();
    return;
  }
  select(mode, entry.folder);
}

/**
 * Autocomplete the active entry into the input (Tab). Folders complete to
 * their path with the leading slash stripped — folder paths start with "/"
 * (e.g. "/INBOX/Sub"), which would otherwise trigger command mode; without
 * it, filterFolders still matches the path as a substring. Commands complete
 * to "/name", plus a trailing space for arg-taking commands (zoom).
 */
function completeActive() {
  const entry = visible[activeIndex];
  if (!entry) return;
  const text =
    entry.type === "command"
      ? `/${entry.command.name}${entry.command.takesArg ? " " : ""}`
      : entry.folder.path.replace(/^\/+/, "");
  input.value = text;
  render(text);
  input.focus();
}

function highlight() {
  for (const [index, item] of [...list.children].entries()) {
    item.classList.toggle("active", index === activeIndex);
  }
  list.children[activeIndex]?.scrollIntoView({ block: "nearest" });
}

function moveActive(delta) {
  if (visible.length === 0) return;
  activeIndex = (activeIndex + delta + visible.length) % visible.length;
  highlight();
}

// Guards against our own dismiss-on-blur handler below racing a
// deliberate selection closed: if Enter (unlike the arrow keys)
// causes this window to lose focus as a side effect, blur would fire
// while select()'s sendMessage is still in flight and close the
// window before the move/jump actually happens. Once we've decided to
// close on purpose, further blur events are a no-op.
let closing = false;

async function select(actionMode, folder) {
  if (!folder) {
    console.error("Move and Jump: select() called with no folder", {
      activeIndex,
      visibleCount: visible.length,
    });
    return;
  }
  error.hidden = true;
  closing = true;
  try {
    const response = await messenger.runtime.sendMessage({
      type: "select",
      mode: actionMode,
      folderId: folder.id,
      tabId,
      query: input.value,
    });
    if (response?.ok === false) throw new Error(response.error);
  } catch (sendError) {
    console.error("Move and Jump: select failed", sendError);
    closing = false;
    error.hidden = false;
    return;
  }
  window.close();
}

input.addEventListener("input", () => render(input.value));

input.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      moveActive(1);
      break;
    case "ArrowUp":
      event.preventDefault();
      moveActive(-1);
      break;
    case "Tab":
      if (event.shiftKey) break;
      event.preventDefault();
      completeActive();
      break;
    case "Enter":
      event.preventDefault();
      activate(visible[activeIndex]);
      break;
    case "Escape":
      event.preventDefault();
      closing = true;
      window.close();
      break;
    default:
      break;
  }
});

// Buttons act on folders only; in command mode they're disabled.
moveButton.addEventListener("click", () => {
  const entry = visible[activeIndex];
  if (entry?.type === "folder") select("move", entry.folder);
});
jumpButton.addEventListener("click", () => {
  const entry = visible[activeIndex];
  if (entry?.type === "folder") select("jump", entry.folder);
});
cancelButton.addEventListener("click", () => {
  closing = true;
  window.close();
});

// This is a real top-level window rather than an anchored toolbar
// popup, so nothing dismisses it automatically when the user clicks
// elsewhere — do that ourselves. Guarded by `closing` (see above).
window.addEventListener("blur", () => {
  if (!closing) window.close();
});

init();
