// Owns popup sizing, placement, zoom, and dismissal.
import { input, state } from "./state.js";
import { parseCommand } from "../lib/commands.js";

/** Ask background.js to fit this window to its content at the current placement. */
function requestResize() {
  // background.js already created the window at the zoom-scaled base size; the
  // resize only grows it to fit content. Skip it when the user disabled
  // fit-to-content — the list scrolls internally instead. A corner placement
  // still has to be sent: it moves the window, which resizeToFit isn't about.
  if (!state.options.resizeToFit && state.placement === "center") return;
  messenger.runtime
    .sendMessage({
      type: "resize",
      height: measureRequiredWindowHeight(),
      zoom: (state.options.zoom || 100) / 100,
      place: state.placement,
    })
    .catch(() => {});
}

/**
 * Park the popup in the parent window's bottom-right corner while /filter or
 * /columns is in the input, and bring it back to center when it leaves them:
 * both act on the mail tab behind the popup — /filter narrows its message list,
 * /columns shows and hides that list's columns — and a centered popup covers
 * exactly what's changing. Only sends on a change of state.
 */
export function updatePlacement() {
  const token = parseCommand(input.value)?.token;
  const next = token === "filter" || token === "columns" ? "corner" : "center";
  // Strip the heading and the (already disabled) buttons so the window measures
  // down to its remaining rows — for /filter, just the input and the filter
  // hint; for /columns, the column rows themselves. Set unconditionally: the
  // reset listener resets placement without touching the DOM, so putting this
  // behind the change guard would leave a stale class on every row.
  document.body.classList.toggle("filtering", token === "filter");
  document.body.classList.toggle("columns", token === "columns");
  if (next === state.placement) return;
  state.placement = next;
  requestResize();
}

/** Apply the configured zoom to the popup body and resize the window to match. */
export function applyZoom() {
  document.body.style.zoom = (state.options.zoom || 100) / 100;
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

// next trigger builds a fresh one — see docs/settings/RECREATE_WINDOW.md.
export async function hide() {
  state.hiding = true;
  try {
    if (state.options?.recreateWindow) {
      // Permitted because background.js creates us with allowScriptsToClose.
      window.close();
      return;
    }
    const self = await messenger.windows.getCurrent();
    await messenger.windows.update(self.id, { state: "minimized" });
  } catch (hideError) {
    console.error("Move and Jump: hide failed", hideError);
  }
}
