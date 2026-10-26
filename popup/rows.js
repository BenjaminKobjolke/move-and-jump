// Owns shared popup row rendering, highlighting, and selection helpers.
import { list, state } from "./state.js";

/** Fill the result list with one plain-text row per entry. */
export function renderRows(entries) {
  state.visible = entries;
  state.activeIndex = 0;
  list.innerHTML = "";
  for (const entry of state.visible) {
    const item = document.createElement("li");
    item.textContent = entry.label;
    if (entry.enabled === false) item.classList.add("disabled");
    list.appendChild(item);
  }
}

export function highlight() {
  for (const [index, item] of [...list.children].entries()) {
    item.classList.toggle("active", index === state.activeIndex);
  }
  list.children[state.activeIndex]?.scrollIntoView({ block: "nearest" });
}

export function moveActive(delta) {
  if (state.visible.length === 0) return;
  state.activeIndex = (state.activeIndex + delta + state.visible.length) % state.visible.length;
  highlight();
}

export const onOff = (value) => messenger.i18n.getMessage(value ? "onState" : "offState");
