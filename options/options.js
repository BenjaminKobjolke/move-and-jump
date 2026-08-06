import { getOptions } from "../lib/options.js";

const caseSensitiveSearch = document.getElementById("caseSensitiveSearch");
const searchAllAccounts = document.getElementById("searchAllAccounts");
const shortcutsTable = document.getElementById("shortcuts");

document.getElementById("intro").textContent = messenger.i18n.getMessage("optionsIntro");
document.getElementById("rankingInfo").textContent =
  messenger.i18n.getMessage("optionsRankingInfo");
document.getElementById("shortcutsHeading").textContent = messenger.i18n.getMessage(
  "optionsShortcutsHeading",
);
document.getElementById("caseSensitiveSearchLabel").textContent =
  messenger.i18n.getMessage("optionsCaseSensitiveSearch");
document.getElementById("searchAllAccountsLabel").textContent =
  messenger.i18n.getMessage("optionsSearchAllAccounts");

async function loadShortcuts() {
  const commands = await messenger.commands.getAll();
  shortcutsTable.innerHTML = "";
  for (const command of commands) {
    const row = document.createElement("tr");
    const description = document.createElement("td");
    description.textContent = command.description;
    const shortcut = document.createElement("td");
    shortcut.textContent = command.shortcut || "—";
    row.append(description, shortcut);
    shortcutsTable.appendChild(row);
  }
}

async function load() {
  const options = await getOptions(messenger.storage.local);
  caseSensitiveSearch.checked = options.caseSensitiveSearch;
  searchAllAccounts.checked = options.searchAllAccounts;
}

async function save() {
  await messenger.storage.local.set({
    options: {
      caseSensitiveSearch: caseSensitiveSearch.checked,
      searchAllAccounts: searchAllAccounts.checked,
    },
  });
}

caseSensitiveSearch.addEventListener("change", save);
searchAllAccounts.addEventListener("change", save);

load();
loadShortcuts();
