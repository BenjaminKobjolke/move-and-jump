import { filterFolders } from "../lib/match.js";
import { filterByAccount } from "../lib/folders.js";
import { getOptions } from "../lib/options.js";

const heading = document.getElementById("heading");
const input = document.getElementById("query");
const list = document.getElementById("results");
const empty = document.getElementById("empty");

let mode = "move";
let options;
let allFolders = [];
let recentFolders = [];
let visible = [];
let activeIndex = 0;

async function init() {
  const [{ mode: storedMode }, folders, opts, { recentFolders: recentIds = [] }, [activeTab]] =
    await Promise.all([
      messenger.storage.session.get("mode"),
      messenger.folders.query({}),
      getOptions(messenger.storage.local),
      messenger.storage.local.get("recentFolders"),
      messenger.mailTabs.query({ active: true, currentWindow: true }),
    ]);

  mode = storedMode ?? "move";
  options = opts;
  allFolders = options.searchAllAccounts
    ? folders
    : filterByAccount(folders, activeTab?.displayedFolder?.accountId);

  const byId = new Map(allFolders.map((folder) => [folder.id, folder]));
  recentFolders = recentIds.map((id) => byId.get(id)).filter(Boolean);

  heading.textContent = mode === "move" ? "Move to…" : "Jump to…";
  input.placeholder = mode === "move" ? "Move to folder…" : "Jump to folder…";

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
