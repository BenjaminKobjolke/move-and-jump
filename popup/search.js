// Wires popup startup, user events, and the reusable window reset message.
import { clampZoom } from "../lib/options.js";
import {
  cancelButton,
  empty,
  error,
  heading,
  input,
  jumpButton,
  list,
  moveButton,
  params,
  state,
} from "./state.js";
import { activate, completeActive, select } from "./actions.js";
import { applyFilter, isFilterMode, toggleFilterField } from "./filter.js";
import { init } from "./load.js";
import { moveActive } from "./rows.js";
import { render } from "./render.js";
import { hide, updatePlacement } from "./window.js";
import { parseCommand } from "../lib/commands.js";

// Zoom is applied synchronously, before the first paint, at the scale used to
// create the window in background.js.
const initialZoom = clampZoom(params.get("zoom"));
// Text to start with, e.g. "/filter " from the filter-search shortcut.
const initialPrefill = params.get("prefill") ?? "";

// Set text and grab focus immediately, before the asynchronous initial load.
document.title = messenger.i18n.getMessage("actionTitle");
empty.textContent = messenger.i18n.getMessage("popupNoMatches");
error.textContent = messenger.i18n.getMessage("popupError");
moveButton.textContent = messenger.i18n.getMessage("buttonMove");
jumpButton.textContent = messenger.i18n.getMessage("buttonJump");
cancelButton.textContent = messenger.i18n.getMessage("buttonCancel");

/** Apply the current mode to the heading, placeholder, and primary button. */
function setModeUI() {
  heading.textContent = messenger.i18n.getMessage(
    state.mode === "move" ? "popupHeadingMove" : "popupHeadingJump",
  );
  input.placeholder = messenger.i18n.getMessage(
    state.mode === "move" ? "popupPlaceholderMove" : "popupPlaceholderJump",
  );
  moveButton.classList.toggle("primary", state.mode === "move");
  jumpButton.classList.toggle("primary", state.mode === "jump");
}

setModeUI();
input.value = initialPrefill;
document.body.style.zoom = initialZoom / 100;
input.focus();

list.addEventListener("mousedown", (event) => {
  const item = event.target.closest("li");
  if (!item) return;
  const index = [...list.children].indexOf(item);
  const entry = state.visible[index];
  if (!entry) return;
  event.preventDefault();
  activate(entry);
});

input.addEventListener("input", () => {
  render(input.value);
  updatePlacement();
  // Exact token only: "/f" still matches both "filter" and "fuzzy".
  const parsed = parseCommand(input.value);
  if (parsed?.token === "filter") applyFilter(parsed.arg);
});

input.addEventListener("keydown", (event) => {
  // Change the searched fields without losing the query you're typing. Only
  // in filter mode: elsewhere these keys would silently flip a setting.
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
      activate(state.visible[state.activeIndex]);
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
  const entry = state.visible[state.activeIndex];
  if (entry?.type === "folder") select("move", entry.folder);
});
jumpButton.addEventListener("click", () => {
  const entry = state.visible[state.activeIndex];
  if (entry?.type === "folder") select("jump", entry.folder);
});
cancelButton.addEventListener("click", hide);

// Dismiss on blur, unless a deliberate action already chose to hide.
window.addEventListener("blur", () => {
  if (!state.hiding) hide();
});

// Reuse this window across triggers by updating its state and loading again.
messenger.runtime.onMessage.addListener((message) => {
  if (message?.type !== "reset") return undefined;
  state.mode = message.mode === "jump" ? "jump" : "move";
  state.tabId = message.tabId;
  state.hiding = false;
  state.lastFilterQuery = "";
  // background.js re-centers before sending this, then init reapplies placement.
  state.placement = "center";
  document.body.style.zoom = clampZoom(message.zoom) / 100;
  input.value = message.prefill ?? "";
  setModeUI();
  init();
  input.focus();
  return undefined;
});

init();
