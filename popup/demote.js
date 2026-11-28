// Per-folder "reset ranking" (upstream's demote), split out of search.js like
// the rest of this fork's popup.
import { error, state } from "./state.js";
import { forgetFolderWeights } from "../lib/weights.js";

/**
 * Whether a typed-search result has any usage history that demoting
 * could reset. Every selection bumps the global weight, so a zero
 * global weight means there's nothing per-query either. Not offered
 * in the empty-query recent-folders view, whose order is recency and
 * wouldn't change.
 */
export function canDemote(entry, query) {
  return Boolean(
    entry?.type === "folder" &&
      query.trim() &&
      (state.folderWeights[entry.folder.id] ?? 0) > 0,
  );
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** A small "arrow down to a line" icon, drawn in currentColor. */
function createDemoteIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M12 3v13M6 10l6 6 6-6M5 21h14");
  svg.appendChild(path);
  return svg;
}

/** The row button; its mousedown is handled by the list listener in search.js. */
export function createDemoteButton() {
  const label = messenger.i18n.getMessage("buttonDemote");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "demote";
  button.tabIndex = -1;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.appendChild(createDemoteIcon());
  return button;
}

/**
 * Reset `folder`'s ranking (see handleDemote in background.js), then
 * mirror the same change in this window's in-memory copy of the
 * weights, so a re-render shows the new order immediately.
 * @returns {Promise<boolean>} false when the reset failed (error row shown)
 */
export async function demote(folder) {
  error.hidden = true;
  try {
    const response = await messenger.runtime.sendMessage({
      type: "demote",
      folderId: folder.id,
    });
    if (response?.ok === false) throw new Error(response.error);
  } catch (sendError) {
    console.error("Move and Jump: demote failed", sendError);
    error.hidden = false;
    return false;
  }
  Object.assign(
    state,
    forgetFolderWeights(state.folderWeights, state.queryWeights, folder.id),
  );
  return true;
}
