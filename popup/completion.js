// Completes the selected popup entry into the search input.
import { input, state } from "./state.js";
import { parseCommand } from "../lib/commands.js";
import { completeTag } from "../lib/filterQuery.js";
import { render } from "./render.js";
import { applyFilter } from "./filter.js";
import { updatePlacement } from "./window.js";

/**
 * Autocomplete the active entry into the input (Tab). Folders complete to
 * their path with the leading slash stripped — folder paths start with "/"
 * (e.g. "/INBOX/Sub"), which would otherwise trigger command mode; without
 * it, filterFolders still matches the path as a substring. Commands complete
 * to "/name", plus a trailing space for arg-taking commands (zoom).
 */
export function completeActive() {
  const entry = state.visible[state.activeIndex];
  if (!entry) return;
  if (entry.type === "tag") {
    completeTagEntry(entry);
    return;
  }
  // Column, account and link rows have nothing useful to complete to — the input
  // already reads "/columns …" / "/go …" and completing to a name would just
  // re-filter the same list.
  if (
    entry.type === "column" ||
    entry.type === "account" ||
    entry.type === "link" ||
    entry.type === "attachment" ||
    entry.type === "identity"
  ) return;
  const text =
    entry.type === "command"
      ? `/${entry.command.name}${entry.command.takesArg ? " " : ""}`
      : entry.folder.path.replace(/^\/+/, "");
  showInput(text);
}

/** Put `text` in the input, re-render the list for it, and keep typing there. */
export function showInput(text) {
  input.value = text;
  render(text);
  updatePlacement();
  input.focus();
}

/**
 * Enter and Tab on a tag suggestion both finish the `tag:` term and keep the
 * popup open, so more terms can follow; the live filter picks the tag up.
 */
export function completeTagEntry(entry) {
  showInput(completeTag(input.value, entry.label));
  applyFilter(parseCommand(input.value).arg);
}
