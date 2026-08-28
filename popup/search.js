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
// Mutable: the window is reused across triggers (see background.js) — a "reset"
// message re-points these at the new mode/tab without recreating the window.
let mode = params.get("mode") === "jump" ? "jump" : "move";
let tabId = params.has("tabId") ? Number(params.get("tabId")) : undefined;
// Zoom is passed in the URL (not read from storage in init()) so it can be
// applied synchronously below, before the first paint — background.js already
// created the window at this scale, so content and window match on frame one.
const initialZoom = clampZoom(params.get("zoom"));
// Text to start with, e.g. "/filter " from the filter-search shortcut.
const initialPrefill = params.get("prefill") ?? "";

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
// Each entry is { type: "folder", folder },
// { type: "command", command, arg, label, enabled }, or
// { type: "column", id, label } (one message-list column).
let visible = [];
// Message-list columns as last reported by the columns experiment:
// [{ id, label, hidden }]. Empty when unavailable (no mail tab, or a
// Thunderbird version whose internals the experiment can't read).
let columnState = [];
let activeIndex = 0;
// Last query handed to the mail tab's quick filter, so a /body or /recipients
// toggle can re-apply it with the new field set.
let lastFilterQuery = "";
let showAccountPrefix = false;

// Set text and grab focus immediately, synchronously, before any
// async work below: Thunderbird only autofocuses the popup document
// itself, not a specific element, and focus() calls made after an
// await are prone to lose the race against the popup's own initial
// focus handling. The `autofocus` attribute in search.html is a
// second line of defense; render()'s repeat call below is a third.
document.title = messenger.i18n.getMessage("actionTitle");
empty.textContent = messenger.i18n.getMessage("popupNoMatches");
error.textContent = messenger.i18n.getMessage("popupError");
moveButton.textContent = messenger.i18n.getMessage("buttonMove");
jumpButton.textContent = messenger.i18n.getMessage("buttonJump");
cancelButton.textContent = messenger.i18n.getMessage("buttonCancel");

/** Apply the current `mode` to the heading, placeholder, and primary button. */
function setModeUI() {
  heading.textContent = messenger.i18n.getMessage(
    mode === "move" ? "popupHeadingMove" : "popupHeadingJump",
  );
  input.placeholder = messenger.i18n.getMessage(
    mode === "move" ? "popupPlaceholderMove" : "popupPlaceholderJump",
  );
  moveButton.classList.toggle("primary", mode === "move");
  jumpButton.classList.toggle("primary", mode === "jump");
}

setModeUI();
input.value = initialPrefill;
document.body.style.zoom = initialZoom / 100;
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
    cols,
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
    listColumns(),
  ]);
  rawFolders = folders;
  accountsList = accounts;
  recentIds = storedRecentIds;
  activeTab = tab;
  folderWeights = weights;
  queryWeights = qWeights;
  options = opts;
  columnState = cols;

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

/** Where background.js was last told to put this window: "center" or "corner". */
let placement = "center";

/** Ask background.js to fit this window to its content at the current placement. */
function requestResize() {
  // background.js already created the window at the zoom-scaled base size; the
  // resize only grows it to fit content. Skip it when the user disabled
  // fit-to-content — the list scrolls internally instead. A corner placement
  // still has to be sent: it moves the window, which resizeToFit isn't about.
  if (!options.resizeToFit && placement === "center") return;
  messenger.runtime
    .sendMessage({
      type: "resize",
      height: measureRequiredWindowHeight(),
      zoom: (options.zoom || 100) / 100,
      place: placement,
    })
    .catch(() => {});
}

/**
 * Park the popup in the parent window's bottom-right corner while a /filter
 * query is in the input, and bring it back to center when it leaves filter
 * mode: /filter narrows the mail tab's message list live, and a centered popup
 * covers the list it's filtering. Only sends on a change of state.
 */
function updatePlacement() {
  const next = isFilterMode() ? "corner" : "center";
  // Strip the heading and the (already disabled) buttons so the window measures
  // down to just the input and the filter rows. Set unconditionally: the reset
  // listener resets `placement` without touching the DOM, so putting this behind
  // the change guard would leave a stale `filtering` class hiding every row.
  document.body.classList.toggle("filtering", next === "corner");
  if (next === placement) return;
  placement = next;
  requestResize();
}

/** Apply options.zoom to the popup body and resize the window to match. */
function applyZoom() {
  document.body.style.zoom = (options.zoom || 100) / 100;
  requestResize();
}

/**
 * How tall this window would need to be to show all of its current
 * content without the list scrolling — measured from the real,
 * rendered DOM rather than assumed, since font size, DPI, and OS text
 * scaling all affect this and none of them are known ahead of time.
 * Temporarily lifts the list's height/overflow constraints (which
 * would otherwise clip it to whatever height it currently has), then
 * converts the content height into an outer *window* height by adding
 * this window's current chrome overhead (title bar etc. —
 * `outerHeight - innerHeight`), whatever that happens to be on this
 * system.
 *
 * Measured as the bottom edge of the last visible top-level element rather than
 * `documentElement.scrollHeight`: html/body are `height: 100%`, and scrollHeight
 * never reports less than the viewport, so that number could only ever grow the
 * window — never shrink it back down (which /filter mode needs).
 */
function measureRequiredWindowHeight() {
  document.documentElement.classList.add("measuring");
  document.body.classList.add("measuring");
  const bodyBox = document.body.getBoundingClientRect();
  const bottoms = [...document.body.children]
    .filter((el) => el.getClientRects().length > 0)
    .map((el) => el.getBoundingClientRect().bottom);
  const paddingBottom = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
  document.body.classList.remove("measuring");
  document.documentElement.classList.remove("measuring");
  const contentHeight = Math.max(0, ...bottoms) - bodyBox.top + paddingBottom;
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
    // "/columns" (the complete name) lists the columns themselves; anything
    // shorter is still an ordinary command row.
    if (parsed.token === "columns") renderColumns(parsed.arg);
    else renderCommands(parsed);
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

/** Read the message list's columns; [] whenever the experiment can't serve them. */
async function listColumns() {
  try {
    // -1: no mail tab known — the experiment falls back to the front mail window.
    return (await messenger.columns.list(tabId ?? -1)) ?? [];
  } catch (columnsError) {
    return [];
  }
}

/** Fill the result list with one plain-text row per entry. */
function renderRows(entries) {
  visible = entries;
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
}

/**
 * One row per message-list column, prefix-filtered by `arg`. Selecting a row
 * shows/hides that column; the popup stays open so several can be flipped.
 */
function renderColumns(arg) {
  const needle = arg.toLowerCase();
  const matches = columnState.filter(
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
    columnState.length === 0 ? "commandColumnsUnavailable" : "popupNoCommands",
  );
  empty.hidden = visible.length !== 0;
  moveButton.disabled = jumpButton.disabled = true;
}

function renderCommands({ token, arg }) {
  renderRows(matchCommands(token).map((command) => commandEntry(command, arg)));
  // Which fields the filter searches, and the shortcuts that flip the optional
  // two — shown right where a query is being typed, so a query that matches
  // nothing has its fix on screen. Not an entry in `visible`: not selectable.
  if (token === "filter") {
    const hint = document.createElement("li");
    hint.textContent = messenger.i18n.getMessage("commandFilterFields", [
      onOff(options.filterBody),
      onOff(options.filterRecipients),
    ]);
    hint.classList.add("disabled", "filter-hint");
    list.appendChild(hint);
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
    case "filter":
      label = arg
        ? messenger.i18n.getMessage("commandFilterSet", [arg])
        : messenger.i18n.getMessage("commandFilterClear");
      break;
    case "body":
      label = messenger.i18n.getMessage("commandToggleBody", [onOff(options.filterBody)]);
      break;
    case "recipients":
      label = messenger.i18n.getMessage("commandToggleRecipients", [
        onOff(options.filterRecipients),
      ]);
      break;
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
    case "columns":
      // Only ever a "press Enter" row: completing the name switches the list
      // to the columns themselves (see renderColumns).
      enabled = columnState.length > 0;
      label = messenger.i18n.getMessage(
        enabled ? "commandColumnsHint" : "commandColumnsUnavailable",
      );
      break;
  }
  return { type: "command", command, arg, label, enabled };
}

/**
 * Flip one of the optional filter fields, persist it, and re-apply the active
 * query so the effect is immediate. Reached two ways: the /body and
 * /recipients command rows, and Ctrl+B / Ctrl+R while typing a /filter query
 * (which is where you actually notice a query matching nothing).
 * @param {"filterBody"|"filterRecipients"} key
 */
const isFilterMode = () => parseCommand(input.value)?.token === "filter";

async function toggleFilterField(key) {
  options[key] = !options[key];
  await messenger.storage.local.set({ options });
  applyFilter(lastFilterQuery);
}

/**
 * Filter the mail tab's message list via Thunderbird's own quick filter.
 * Sender and subject are always searched; /body and /recipients widen it.
 * An empty query clears the filter. The quick filter ANDs whitespace-separated
 * terms and ORs each term across the enabled fields, so "inn lehrich@theim"
 * matches a message whose subject has "Inn" and whose sender has "lehrich@theim".
 * @param {string} query
 */
function applyFilter(query) {
  lastFilterQuery = query;
  if (tabId === undefined) return;
  const text = query
    ? {
        text: query,
        author: true,
        subject: true,
        recipients: options.filterRecipients,
        body: options.filterBody,
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
  messenger.mailTabs.setQuickFilter(tabId, properties).catch(() => {});
}

/**
 * Handle selection of the active/clicked entry. Folders move/jump (and
 * close the window); commands mutate + persist options, then clear the
 * input and re-render, leaving the window open.
 */
async function activate(entry) {
  if (!entry) return;
  if (entry.type === "column") {
    // Thunderbird persists column visibility itself, so nothing to store here.
    // The input is left as typed so the list stays on the same filter and the
    // next column is one Enter away.
    const keepIndex = activeIndex;
    columnState = await messenger.columns.toggle(tabId ?? -1, entry.id).catch(() => columnState);
    render(input.value);
    // render() resets the highlight; keep it on the row just toggled so the
    // state flip is visible where the eye already is.
    activeIndex = Math.min(keepIndex, Math.max(visible.length - 1, 0));
    highlight();
    updatePlacement();
    input.focus();
    return;
  }
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
        // get out of the way so the filtered list is visible. The filter stays
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
        options.fuzzySearch = !options.fuzzySearch;
        break;
      case "sensitive":
        options.caseSensitiveSearch = !options.caseSensitiveSearch;
        break;
      case "all":
        options.searchAllAccounts = !options.searchAllAccounts;
        applyScope();
        break;
      case "columns":
        // Complete the name; render() then lists the columns themselves.
        input.value = "/columns ";
        render(input.value);
        updatePlacement();
        input.focus();
        return;
    }
    await messenger.storage.local.set({ options });
    input.value = "";
    render("");
    updatePlacement();
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
  // Column rows have nothing useful to complete to — the input already reads
  // "/columns …" and completing to a name would just re-filter the same list.
  if (entry.type === "column") return;
  const text =
    entry.type === "command"
      ? `/${entry.command.name}${entry.command.takesArg ? " " : ""}`
      : entry.folder.path.replace(/^\/+/, "");
  input.value = text;
  render(text);
  updatePlacement();
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
// deliberate selection: if Enter (unlike the arrow keys) causes this
// window to lose focus as a side effect, blur would fire while
// select()'s sendMessage is still in flight and hide the window before
// the move/jump actually happens. Once we've decided to hide on
// purpose, further blur events are a no-op.
let hiding = false;

// The window is kept alive and reused (see background.js): dismissing
// minimizes it rather than closing it, so the next trigger just
// restores + re-inits it instead of recreating the whole window.
async function hide() {
  hiding = true;
  try {
    const self = await messenger.windows.getCurrent();
    await messenger.windows.update(self.id, { state: "minimized" });
  } catch (hideError) {
    console.error("Move and Jump: hide failed", hideError);
  }
}

async function select(actionMode, folder) {
  if (!folder) {
    console.error("Move and Jump: select() called with no folder", {
      activeIndex,
      visibleCount: visible.length,
    });
    return;
  }
  error.hidden = true;
  hiding = true;
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
    hiding = false;
    error.hidden = false;
    return;
  }
  hide();
}

input.addEventListener("input", () => {
  render(input.value);
  // After render: the corner window is sized from the rendered DOM.
  updatePlacement();
  // Filter as you type. Exact token only: "/f" still matches both "filter" and
  // "fuzzy", and shouldn't filter anything until the user commits to one.
  const parsed = parseCommand(input.value);
  if (parsed?.token === "filter") applyFilter(parsed.arg);
});

input.addEventListener("keydown", (event) => {
  // Change the searched fields without losing the query you're typing. Only
  // in filter mode: elsewhere these keys would silently flip a setting with
  // nothing on screen to show it.
  if (event.ctrlKey && !event.altKey && !event.shiftKey && isFilterMode()) {
    const key = event.key.toLowerCase();
    if (key === "b" || key === "r") {
      event.preventDefault();
      toggleFilterField(key === "b" ? "filterBody" : "filterRecipients").then(() =>
        render(input.value),
      );
      return;
    }
  }
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
      hide();
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
  hide();
});

// This is a real top-level window rather than an anchored toolbar
// popup, so nothing dismisses it automatically when the user clicks
// elsewhere — do that ourselves. Guarded by `hiding` (see above) so our
// own minimize doesn't re-trigger it.
window.addEventListener("blur", () => {
  if (!hiding) hide();
});

// Reused across triggers: background.js restores the window and sends this to
// re-point it at the new mode/tab/zoom and refresh the folder list, in place of
// recreating the window. Re-runs the same init() the first URL-driven open uses.
messenger.runtime.onMessage.addListener((message) => {
  if (message?.type !== "reset") return undefined;
  mode = message.mode === "jump" ? "jump" : "move";
  tabId = message.tabId;
  hiding = false;
  lastFilterQuery = "";
  // background.js re-centers the window before sending this, so the placement
  // we last requested no longer holds; init() re-applies it from the input.
  placement = "center";
  document.body.style.zoom = clampZoom(message.zoom) / 100;
  input.value = message.prefill ?? "";
  setModeUI();
  init();
  input.focus();
  return undefined;
});

init();
