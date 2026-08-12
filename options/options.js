import { getOptions, clampZoom } from "../lib/options.js";

const caseSensitiveSearch = document.getElementById("caseSensitiveSearch");
const fuzzySearch = document.getElementById("fuzzySearch");
const searchAllAccounts = document.getElementById("searchAllAccounts");
const zoom = document.getElementById("zoom");
const shortcutsTable = document.getElementById("shortcuts");
const shortcutError = document.getElementById("shortcutError");

const msg = (key, subs) => messenger.i18n.getMessage(key, subs);

document.getElementById("intro").textContent = msg("optionsIntro");
document.getElementById("rankingInfo").textContent = msg("optionsRankingInfo");
document.getElementById("shortcutsHeading").textContent = msg("optionsShortcutsHeading");
document.getElementById("caseSensitiveSearchLabel").textContent = msg("optionsCaseSensitiveSearch");
document.getElementById("fuzzySearchLabel").textContent = msg("optionsFuzzySearch");
document.getElementById("searchAllAccountsLabel").textContent = msg("optionsSearchAllAccounts");
document.getElementById("zoomLabel").textContent = msg("optionsZoom");

let isMac = false;
messenger.runtime.getPlatformInfo().then((info) => {
  isMac = info.os === "mac";
});

// event.key values that don't map to Thunderbird's shortcut key names 1:1.
// Anything not listed and length 1 is uppercased; F1-F12 pass through. Keys
// commands.update still rejects (e.g. "," → wants "Comma") surface as an error.
const KEY_ALIASES = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  " ": "Space",
};

function mapKey(key) {
  if (key in KEY_ALIASES) return KEY_ALIASES[key];
  if (/^F([1-9]|1[0-2])$/.test(key)) return key;
  if (key.length === 1) return key.toUpperCase();
  return null;
}

/**
 * Build a Thunderbird shortcut string from a keydown event, or return null
 * if it isn't a usable binding yet (bare modifier, or no non-Shift modifier
 * — Thunderbird requires at least one of Ctrl/Alt/Command/MacCtrl).
 */
function buildShortcut(event) {
  const mapped = mapKey(event.key);
  if (mapped === null) return null;

  const parts = [];
  if (event.ctrlKey) parts.push(isMac ? "MacCtrl" : "Ctrl");
  if (event.metaKey && isMac) parts.push("Command");
  if (event.altKey) parts.push("Alt");
  const hasPrimaryModifier = parts.length > 0;
  if (event.shiftKey) parts.push("Shift");

  if (!hasPrimaryModifier) return null;
  parts.push(mapped);
  return parts.join("+");
}

function button(labelKey, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = msg(labelKey);
  btn.addEventListener("click", onClick);
  return btn;
}

async function renderShortcuts() {
  const commands = await messenger.commands.getAll();
  shortcutsTable.innerHTML = "";
  for (const command of commands) {
    const row = document.createElement("tr");

    const description = document.createElement("td");
    description.textContent = command.description;

    const shortcut = document.createElement("td");
    shortcut.className = "shortcut-value";
    shortcut.textContent = command.shortcut || "—";

    const recordCell = document.createElement("td");
    const recordBtn = button("optionsShortcutRecord", () => record(command.name, recordBtn));
    recordCell.appendChild(recordBtn);

    const resetCell = document.createElement("td");
    resetCell.appendChild(
      button("optionsShortcutReset", async () => {
        shortcutError.textContent = "";
        await messenger.commands.reset(command.name);
        await renderShortcuts();
      }),
    );

    row.append(description, shortcut, recordCell, resetCell);
    shortcutsTable.appendChild(row);
  }
}

/** Capture the next keystroke and apply it as the binding for `name`. */
function record(name, recordBtn) {
  shortcutError.textContent = "";
  recordBtn.classList.add("recording");
  recordBtn.textContent = msg("optionsShortcutRecording");

  const stop = () => {
    document.removeEventListener("keydown", onKeydown, true);
    recordBtn.classList.remove("recording");
    recordBtn.textContent = msg("optionsShortcutRecord");
  };

  const onKeydown = async (event) => {
    // Ignore standalone modifier presses — wait for a real key.
    if (["Control", "Alt", "Shift", "Meta", "OS"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      stop();
      return;
    }

    const shortcut = buildShortcut(event);
    if (!shortcut) {
      shortcutError.textContent = msg("optionsShortcutInvalid");
      stop();
      return;
    }

    stop();
    try {
      await messenger.commands.update({ name, shortcut });
      await renderShortcuts();
    } catch (error) {
      console.error("Move and Jump: commands.update failed", error);
      shortcutError.textContent = msg("optionsShortcutRejected", [shortcut]);
    }
  };

  document.addEventListener("keydown", onKeydown, true);
}

async function load() {
  const options = await getOptions(messenger.storage.local);
  caseSensitiveSearch.checked = options.caseSensitiveSearch;
  fuzzySearch.checked = options.fuzzySearch;
  searchAllAccounts.checked = options.searchAllAccounts;
  zoom.value = options.zoom;
}

async function save() {
  await messenger.storage.local.set({
    options: {
      caseSensitiveSearch: caseSensitiveSearch.checked,
      fuzzySearch: fuzzySearch.checked,
      searchAllAccounts: searchAllAccounts.checked,
      zoom: clampZoom(zoom.value),
    },
  });
}

caseSensitiveSearch.addEventListener("change", save);
fuzzySearch.addEventListener("change", save);
searchAllAccounts.addEventListener("change", save);
zoom.addEventListener("change", save);

load();
renderShortcuts();
