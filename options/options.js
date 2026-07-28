import { getOptions } from "../lib/options.js";

const caseSensitiveSearch = document.getElementById("caseSensitiveSearch");
const searchAllAccounts = document.getElementById("searchAllAccounts");

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
