import { filterFolders } from "../lib/match.js";
import { filterByAccount } from "../lib/folders.js";
import { getOptions } from "../lib/options.js";

const heading = document.getElementById("heading");
const input = document.getElementById("query");
const list = document.getElementById("results");
const empty = document.getElementById("empty");

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
let allFolders = [];
let recentFolders = [];
let visible = [];
let activeIndex = 0;

// Set text and grab focus immediately, synchronously, before any
// async work below: Thunderbird only autofocuses the popup document
// itself, not a specific element, and focus() calls made after an
// await are prone to lose the race against the popup's own initial
// focus handling. The `autofocus` attribute in search.html is a
// second line of defense; render()'s repeat call below is a third.
heading.textContent = messenger.i18n.getMessage(
  mode === "move" ? "popupHeadingMove" : "popupHeadingJump",
);
input.placeholder = messenger.i18n.getMessage(
  mode === "move" ? "popupPlaceholderMove" : "popupPlaceholderJump",
);
empty.textContent = messenger.i18n.getMessage("popupNoMatches");
input.focus();

async function init() {
  const [folders, opts, { recentFolders: recentIds = [] }, activeTab] = await Promise.all([
    messenger.folders.query({}),
    getOptions(messenger.storage.local),
    messenger.storage.local.get("recentFolders"),
    tabId === undefined ? undefined : messenger.mailTabs.get(tabId),
  ]);

  options = opts;
  allFolders = options.searchAllAccounts
    ? folders
    : filterByAccount(folders, activeTab?.displayedFolder?.accountId);

  const byId = new Map(allFolders.map((folder) => [folder.id, folder]));
  recentFolders = recentIds.map((id) => byId.get(id)).filter(Boolean);

  render("");
  input.focus();
}

function render(query) {
  const trimmed = query.trim();
  visible = trimmed
    ? filterFolders(allFolders, trimmed, { caseSensitive: options.caseSensitiveSearch })
    : recentFolders;
  activeIndex = 0;

  list.innerHTML = "";
  for (const folder of visible) {
    const item = document.createElement("li");
    item.textContent = folder.path;
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      select(folder);
    });
    list.appendChild(item);
  }
  highlight();

  empty.hidden = !(trimmed && visible.length === 0);
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

async function select(folder) {
  if (!folder) {
    console.error("Move and Jump: select() called with no folder", {
      activeIndex,
      visibleCount: visible.length,
    });
    return;
  }
  console.log("Move and Jump: select() sending", { mode, folderId: folder.id, tabId });
  closing = true;
  try {
    const response = await messenger.runtime.sendMessage({
      type: "select",
      mode,
      folderId: folder.id,
      tabId,
    });
    console.log("Move and Jump: select() got response", response);
  } catch (error) {
    console.error("Move and Jump: sendMessage failed", error);
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
    case "Enter":
      event.preventDefault();
      console.log("Move and Jump: Enter pressed", {
        activeIndex,
        visibleCount: visible.length,
        folder: visible[activeIndex],
      });
      select(visible[activeIndex]);
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

// This is a real top-level window rather than an anchored toolbar
// popup, so nothing dismisses it automatically when the user clicks
// elsewhere — do that ourselves. Guarded by `closing` (see above).
window.addEventListener("blur", () => {
  if (!closing) window.close();
});

init();
