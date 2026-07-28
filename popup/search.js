import { filterFolders } from "../lib/match.js";
import { filterByAccount } from "../lib/folders.js";
import { getOptions } from "../lib/options.js";

const heading = document.getElementById("heading");
const input = document.getElementById("query");
const list = document.getElementById("results");
const empty = document.getElementById("empty");

// Passed via the popup URL (see background.js's openSearchPopup),
// not storage, so it's available synchronously — no risk of reading
// it before background.js has finished writing it.
const mode = new URLSearchParams(window.location.search).get("mode") === "jump" ? "jump" : "move";

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
  const [folders, opts, { recentFolders: recentIds = [] }, [activeTab]] = await Promise.all([
    messenger.folders.query({}),
    getOptions(messenger.storage.local),
    messenger.storage.local.get("recentFolders"),
    messenger.mailTabs.query({ active: true, currentWindow: true }),
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

async function select(folder) {
  if (!folder) return;
  await messenger.runtime.sendMessage({ type: "select", mode, folderId: folder.id });
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
      select(visible[activeIndex]);
      break;
    case "Escape":
      event.preventDefault();
      window.close();
      break;
    default:
      break;
  }
});

init();
