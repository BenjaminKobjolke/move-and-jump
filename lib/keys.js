// Single-key shortcuts — the bindings Thunderbird's stable `commands` API
// cannot express.
//
// ShortcutUtils.validate() (toolkit/modules/ShortcutUtils.sys.mjs) rejects any
// shortcut whose only modifier is Shift, or that has none at all:
//
//     case 0:  if (!FUNCTION_KEYS.test(key)) return this.MODIFIER_REQUIRED;
//     case 1:  if (chromeModifiers[0] == "shift" && !FUNCTION_KEYS.test(key))
//                return this.MODIFIER_REQUIRED;
//
// That is the whole reason plain `s`/`g` (Nostalgy's bindings) are impossible
// through `commands`, and the reason for experiments/keys. This module holds
// the pure half of that feature — recognising and validating such a shortcut —
// so it can be unit-tested without a Thunderbird window. The experiment matches
// live keystrokes against the strings produced here.

/**
 * The commands a single key can be bound to — the keys of manifest.commands,
 * and the cases dispatchCommand() in background.js handles. Kept here rather
 * than read back from messenger.commands.getAll() so the background can filter
 * stored bindings without an API round-trip on every wake-up.
 */
export const COMMAND_NAMES = [
  "move-search",
  "jump-search",
  "filter-search",
  "move-last",
  "jump-last",
];

/** Modifiers that make a shortcut expressible through the `commands` API. */
const PRIMARY_MODIFIERS = ["Ctrl", "Alt", "Command", "MacCtrl"];

// Both mirror ShortcutUtils' own regexes. Keys outside these sets have no XUL
// `key`/`keycode` spelling, so a <key> element built from them would silently
// never match.
const BASIC_KEY =
  /^([A-Z0-9]|Comma|Period|Home|End|PageUp|PageDown|Space|Insert|Delete|Up|Down|Left|Right)$/;
const FUNCTION_KEY = /^(F[1-9]|F1[0-2])$/;

// event.key values that don't map to Thunderbird's shortcut key names 1:1.
// Anything not listed and length 1 is uppercased; F1-F12 pass through.
const KEY_ALIASES = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  " ": "Space",
  ",": "Comma",
  ".": "Period",
};

/** Thunderbird's name for a DOM `event.key`, or null if it has none. */
export function mapKey(key) {
  if (key in KEY_ALIASES) return KEY_ALIASES[key];
  if (FUNCTION_KEY.test(key)) return key;
  if (key.length === 1) return key.toUpperCase();
  return null;
}

/**
 * Build a Thunderbird shortcut string from a keydown event. Unlike the
 * `commands` API this accepts a bare key ("S") and a Shift-only combination
 * ("Shift+S") — telling the two kinds apart is hasPrimaryModifier()'s job, not
 * this one's.
 * @returns {string|null} null when the event carries no usable key at all
 *   (a bare modifier press, or a key with no Thunderbird spelling).
 */
export function shortcutFromEvent(event, { isMac = false } = {}) {
  const mapped = mapKey(event.key);
  if (mapped === null) return null;

  const parts = [];
  if (event.ctrlKey) parts.push(isMac ? "MacCtrl" : "Ctrl");
  if (event.metaKey && isMac) parts.push("Command");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  parts.push(mapped);
  return parts.join("+");
}

/** Whether `commands` can take this shortcut (i.e. it is not a single key). */
export function hasPrimaryModifier(shortcut) {
  const parts = String(shortcut).split("+");
  parts.pop();
  return parts.some((part) => PRIMARY_MODIFIERS.includes(part));
}

/**
 * Check a shortcut is usable as a single-key binding.
 * @returns {null|"has-modifier"|"invalid-key"} null when it is usable.
 *   "has-modifier" means it belongs in `commands` instead, not that it is bad.
 */
export function validateSingleKey(shortcut) {
  const parts = String(shortcut).split("+");
  const key = parts.pop();
  if (parts.some((part) => part !== "Shift")) return "has-modifier";
  if (!BASIC_KEY.test(key) && !FUNCTION_KEY.test(key)) return "invalid-key";
  return null;
}
