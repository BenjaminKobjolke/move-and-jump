// Slash commands typed into the search popup's input (e.g. "/zoom 120",
// "/all"). This module is DOM-free so it can be unit-tested; the popup
// (popup/search.js) owns rendering the matches and executing the effect.

export const COMMANDS = [
  { name: "zoom", takesArg: true },
  { name: "fuzzy" },
  { name: "all" },
  { name: "sensitive" },
];

/**
 * Parse raw input into a command token and its argument.
 * @param {string} input full input value, including the leading "/"
 * @returns {{ token: string, arg: string } | null} null when not a command
 */
export function parseCommand(input) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;
  const body = trimmed.slice(1);
  const i = body.indexOf(" ");
  const token = (i === -1 ? body : body.slice(0, i)).toLowerCase();
  const arg = i === -1 ? "" : body.slice(i + 1).trim();
  return { token, arg };
}

/** Commands whose name starts with `token` (bare "" matches all). */
export function matchCommands(token) {
  return COMMANDS.filter((c) => c.name.startsWith(token));
}
