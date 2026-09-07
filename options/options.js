import { getOptions, clampZoom } from "../lib/options.js";
import { shortcutFromEvent, hasPrimaryModifier, validateSingleKey } from "../lib/keys.js";

const caseSensitiveSearch = document.getElementById("caseSensitiveSearch");
const fuzzySearch = document.getElementById("fuzzySearch");
const searchAllAccounts = document.getElementById("searchAllAccounts");
const resizeToFit = document.getElementById("resizeToFit");
const centerOnParent = document.getElementById("centerOnParent");
const zoom = document.getElementById("zoom");
const shortcutsTable = document.getElementById("shortcuts");
const shortcutError = document.getElementById("shortcutError");

const msg = (key, subs) => messenger.i18n.getMessage(key, subs);

// The single-key experiment (experiments/keys). Absent on a Thunderbird build
// whose internals moved, or where experiments are blocked by policy — the
// column is then dropped rather than offering a control that can't work.
//
// In a try/catch, and not for tidiness: an experiment namespace that failed to
// register does not necessarily read back as undefined — the property access
// itself can throw. Unguarded, that took the *whole options page* down with it
// (every checkbox on it included), because this runs at module scope before
// anything is rendered. Nothing about the single-key column is worth that.
let keysAvailable = false;
try {
  keysAvailable = Boolean(messenger.keys);
} catch (error) {
  console.error("Move and Jump: single-key experiment unavailable", error);
}

document.getElementById("intro").textContent = msg("optionsIntro");
document.getElementById("rankingInfo").textContent = msg("optionsRankingInfo");
document.getElementById("shortcutsHeading").textContent = msg("optionsShortcutsHeading");
document.getElementById("shortcutsHint").textContent = msg(
  keysAvailable ? "optionsSingleKeyHint" : "optionsSingleKeyUnavailable",
);
document.getElementById("caseSensitiveSearchLabel").textContent = msg("optionsCaseSensitiveSearch");
document.getElementById("fuzzySearchLabel").textContent = msg("optionsFuzzySearch");
document.getElementById("searchAllAccountsLabel").textContent = msg("optionsSearchAllAccounts");
document.getElementById("resizeToFitLabel").textContent = msg("optionsResizeToFit");
document.getElementById("centerOnParentLabel").textContent = msg("optionsCenterOnParent");
document.getElementById("zoomLabel").textContent = msg("optionsZoom");

let isMac = false;
messenger.runtime.getPlatformInfo().then((info) => {
  isMac = info.os === "mac";
});

function setMessage(text, isWarning = false) {
  shortcutError.textContent = text;
  shortcutError.classList.toggle("warning", isWarning);
}

function button(labelKey, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = msg(labelKey);
  btn.addEventListener("click", onClick);
  return btn;
}

function headerCell(labelKey) {
  const th = document.createElement("th");
  th.textContent = msg(labelKey);
  return th;
}

/** Read the stored single-key map (command name → shortcut). */
async function getSingleKeys() {
  const { singleKeys } = await getOptions(messenger.storage.local);
  return { ...singleKeys };
}

/**
 * Store one single-key binding (or clear it with null). Writing to storage is
 * what installs it: the background watches storage.onChanged and re-registers
 * the whole set — which also wakes it if the event page was suspended.
 */
async function saveSingleKey(name, shortcut) {
  const current = await getOptions(messenger.storage.local);
  const singleKeys = { ...current.singleKeys };
  if (shortcut) singleKeys[name] = shortcut;
  else delete singleKeys[name];
  await messenger.storage.local.set({ options: { ...current, singleKeys } });
}

async function renderShortcuts() {
  const [commands, singleKeys] = await Promise.all([
    messenger.commands.getAll(),
    getSingleKeys(),
  ]);
  shortcutsTable.innerHTML = "";

  const head = document.createElement("tr");
  head.append(headerCell("optionsShortcutColumnCommand"), headerCell("optionsShortcutColumnKey"));
  if (keysAvailable) head.appendChild(headerCell("optionsShortcutColumnSingleKey"));
  shortcutsTable.appendChild(head);

  for (const command of commands) {
    const row = document.createElement("tr");

    const description = document.createElement("td");
    description.textContent = command.description;

    const shortcut = document.createElement("td");
    shortcut.className = "shortcut-value";
    const shortcutText = document.createElement("span");
    shortcutText.textContent = command.shortcut || "—";
    const recordBtn = button("optionsShortcutRecord", () => record(command.name, recordBtn));
    shortcut.append(
      shortcutText,
      recordBtn,
      button("optionsShortcutReset", async () => {
        setMessage("");
        await messenger.commands.reset(command.name);
        await renderShortcuts();
      }),
    );

    row.append(description, shortcut);

    if (keysAvailable) {
      const single = document.createElement("td");
      single.className = "shortcut-value";
      const singleText = document.createElement("span");
      singleText.textContent = singleKeys[command.name] || "—";
      const singleBtn = button("optionsShortcutRecord", () =>
        recordSingleKey(command.name, singleBtn),
      );
      single.append(
        singleText,
        singleBtn,
        button("optionsShortcutClear", async () => {
          setMessage("");
          await saveSingleKey(command.name, null);
          await renderShortcuts();
        }),
      );
      row.appendChild(single);
    }

    shortcutsTable.appendChild(row);
  }
}

/**
 * Capture the next keystroke and hand it to `apply`. Shared by both recorders;
 * the only difference between them is what they do with the shortcut string.
 * @param {(shortcut: string) => Promise<void>} apply
 */
function captureKey(recordBtn, apply) {
  setMessage("");
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
    stop();

    if (event.key === "Escape") return;

    const shortcut = shortcutFromEvent(event, { isMac });
    if (!shortcut) {
      setMessage(msg("optionsShortcutInvalid"));
      return;
    }
    await apply(shortcut);
  };

  document.addEventListener("keydown", onKeydown, true);
}

/** Bind through Thunderbird's own commands API — needs a modifier. */
function record(name, recordBtn) {
  captureKey(recordBtn, async (shortcut) => {
    if (!hasPrimaryModifier(shortcut)) {
      // Not an error the user has to fix twice: say which column takes it.
      setMessage(msg(keysAvailable ? "optionsShortcutUseSingleKey" : "optionsShortcutInvalid"));
      return;
    }
    try {
      await messenger.commands.update({ name, shortcut });
      await renderShortcuts();
    } catch (error) {
      console.error("Move and Jump: commands.update failed", error);
      setMessage(msg("optionsShortcutRejected", [shortcut]));
    }
  });
}

/** Bind through experiments/keys — a bare key, or Shift plus a key. */
function recordSingleKey(name, recordBtn) {
  captureKey(recordBtn, async (shortcut) => {
    const problem = validateSingleKey(shortcut);
    if (problem === "has-modifier") {
      setMessage(msg("optionsSingleKeyHasModifier"));
      return;
    }
    if (problem) {
      setMessage(msg("optionsSingleKeyInvalid", [shortcut]));
      return;
    }

    // The experiment keys its bindings by shortcut, so a second command taking
    // the same letter would silently displace the first. Refuse instead, and
    // name the command holding it so the user knows what to clear.
    const taken = Object.entries(await getSingleKeys()).find(
      ([other, key]) => key === shortcut && other !== name,
    );
    if (taken) {
      const commands = await messenger.commands.getAll();
      const holder = commands.find((command) => command.name === taken[0]);
      setMessage(msg("optionsSingleKeyTaken", [shortcut, holder?.description || taken[0]]));
      return;
    }

    // Thunderbird's own bindings sit in the same window, and ours is inserted
    // ahead of them, so this succeeds — but silently taking `a` away from
    // Archive would be a nasty surprise. Report it and let the choice stand.
    let shadows = null;
    try {
      ({ shadows } = await messenger.keys.check(shortcut));
    } catch (error) {
      console.error("Move and Jump: keys.check failed", error);
    }

    await saveSingleKey(name, shortcut);
    await renderShortcuts();
    if (shadows) setMessage(msg("optionsSingleKeyShadows", [shortcut, shadows]), true);
  });
}

async function load() {
  const options = await getOptions(messenger.storage.local);
  caseSensitiveSearch.checked = options.caseSensitiveSearch;
  fuzzySearch.checked = options.fuzzySearch;
  searchAllAccounts.checked = options.searchAllAccounts;
  resizeToFit.checked = options.resizeToFit;
  centerOnParent.checked = options.centerOnParent;
  zoom.value = options.zoom;
}

async function save() {
  // Merge over what's stored: options with no control on this page
  // (filterBody, filterRecipients — set via slash commands; singleKeys — set
  // by the recorder above) would otherwise be dropped every time a checkbox
  // here changes.
  const current = await getOptions(messenger.storage.local);
  await messenger.storage.local.set({
    options: {
      ...current,
      caseSensitiveSearch: caseSensitiveSearch.checked,
      fuzzySearch: fuzzySearch.checked,
      searchAllAccounts: searchAllAccounts.checked,
      resizeToFit: resizeToFit.checked,
      centerOnParent: centerOnParent.checked,
      zoom: clampZoom(zoom.value),
    },
  });
}

caseSensitiveSearch.addEventListener("change", save);
fuzzySearch.addEventListener("change", save);
searchAllAccounts.addEventListener("change", save);
resizeToFit.addEventListener("change", save);
centerOnParent.addEventListener("change", save);
zoom.addEventListener("change", save);

load();
renderShortcuts();
