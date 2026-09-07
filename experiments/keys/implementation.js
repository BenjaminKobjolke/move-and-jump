/* eslint-env mozilla/browser-window */
/* global ChromeUtils, ExtensionCommon, Services, Cc, Ci */

// Experiment API: single-key shortcuts.
//
// Thunderbird's stable `commands` API cannot express a binding without a
// Ctrl/Alt/Command/MacCtrl modifier — ShortcutUtils.validate() returns
// MODIFIER_REQUIRED for both "S" and "Shift+S" (see lib/keys.js for the exact
// rule). Plain `s`/`g`, the way Nostalgy worked, are therefore out of reach
// there, and [API Request] bug 1591730 has been open since 2019.
//
// The obvious way to get them anyway is to build XUL <key> elements, the way
// Thunderbird builds its own single letters in mainKeySet.inc.xhtml and the way
// ExtensionShortcuts builds the ones `commands` does support. That does not
// work, and it fails silently. Measured on 153.2.0:
//
//   own keyset, key="s", no modifiers ......... never fires
//   own keyset, key="s", modifiers="alt" ...... fires
//   inside Thunderbird's own mailKeys keyset ... never fires
//   exact clone of a working built-in <key>,
//     only the letter changed ................. never fires
//   the built-in itself ....................... fires
//
// So a modifier-less <key> inserted at runtime is not picked up, however it is
// built or wherever it is put, while the same element with a modifier is. Only
// keys present when the window's handler chain was first built work without
// one. That rules the whole approach out for this feature.
//
// What works is a plain keydown listener on the mail window, which is also what
// tbkeys does. The one thing that had to be checked is whether it sees keys
// pressed in the message list, since Thunderbird 115 moved that into an
// about:3pane document inside a <browser>. It does, and the event arrives with
// the real inner element as its target (ul#folderTree, not the browser), which
// is what makes the "is the user typing" test below possible.
//
// The cost of not going through Thunderbird's key handling is that the quiet-
// while-typing behaviour is no longer free — isTypingContext() has to earn it.
//
// Everything here is internal API and can change with any Thunderbird release.
// Every access is feature-detected and wrapped: on failure the bindings are
// simply not installed and the options page says so, rather than breaking.

var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs",
);
var { ExtensionParent } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionParent.sys.mjs",
);
var { ExtensionSupport } = ChromeUtils.importESModule(
  "resource:///modules/ExtensionSupport.sys.mjs",
);
var { ShortcutUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/ShortcutUtils.sys.mjs",
);

const EXTENSION_ID = "move-and-jump@bovender.de";
const WINDOW_LISTENER_ID = "move-and-jump-keys";

// Only the 3-pane mail window. Move and jump both act on a mail tab through the
// mailTabs API, which a compose or standalone-message window does not have.
const MAIL_WINDOW_URLS = ["chrome://messenger/content/messenger.xhtml"];

// Module-level, deliberately not per-context: an MV3 event page gets suspended
// after a short idle, taking its context with it, and the bindings have to keep
// working across that. See wakeBackground() for the other half — delivering the
// keypress to a background that has gone to sleep.
let shortcuts = new Map();
let listening = false;
const trackedWindows = new Map();

/** Live `fire` handles, one per background context listening to onCommand. */
const fires = new Set();

// Elements that mean "the user is typing, leave them alone". Taken from
// tbkeys' stopCallback, which has had years of Thunderbird-specific additions
// beyond the obvious HTML ones — the search boxes especially.
const TEXT_ENTRY_TAGS = new Set([
  "input",
  "textarea",
  "select",
  "textbox",
  "search-textbox",
  "global-search-bar",
  "search-bar",
  "moz-input-search",
  "moz-input-text",
  "account-hub-container",
  "imconversation",
  // A remote <browser> (a rendered message body, an account-setup page) never
  // lets its keydown reach us anyway; when one is itself the target, the focus
  // is inside content we cannot inspect, so stay out of the way.
  "browser",
]);

/**
 * Whether a keystroke on this element is text being typed rather than a
 * shortcut. Going through Thunderbird's own <key> handling would have given us
 * this for free — chrome key handlers run after the focused element, so an
 * editor that consumed the keystroke has already stopped it. A DOM listener
 * runs first and has to ask.
 */
function isTypingContext(target) {
  if (!target) return false;
  const tag = (target.localName || "").toLowerCase();
  if (TEXT_ENTRY_TAGS.has(tag)) return true;
  try {
    if (target.isContentEditable) return true;
    if (target.ownerDocument?.designMode === "on") return true;
  } catch (error) {
    // Cross-origin or already-detached node; treat as not-typing.
  }
  return false;
}

/** `modifiers` attributes are written "accel,shift" and "accel, shift" alike. */
function normalizeModifiers(value) {
  return (value || "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .sort()
    .join(",");
}

/**
 * The Thunderbird key element a shortcut would shadow, or null.
 *
 * This is ShortcutUtils.isSystem() with two changes: it reports which key was
 * hit rather than just that one was, and it compares modifiers normalized
 * instead of by exact attribute match, so a locale or a Thunderbird version
 * that spells them differently can't produce a false "no conflict".
 *
 * Still worth reporting even though we no longer install <key> elements
 * ourselves: those are exactly the bindings our listener will be taking the
 * keystroke away from.
 * @returns {string|null} an identifier for the shadowed key, for display
 */
function systemKeyFor(win, shortcut) {
  const parts = shortcut.split("+");
  const chromeKey = parts.pop();
  const wanted = normalizeModifiers(ShortcutUtils.getModifiersAttribute(parts));
  const [attribute, value] = ShortcutUtils.getKeyAttribute(chromeKey);

  for (const element of win.document.querySelectorAll("key")) {
    if (element.getAttribute("disabled") === "disabled") continue;
    if (normalizeModifiers(element.getAttribute("modifiers")) !== wanted) continue;
    const own = element.getAttribute(attribute);
    if (!own) continue;
    // XUL matches the `key` attribute case-insensitively; `keycode` is exact.
    if (attribute === "key" ? own.toUpperCase() !== value : own !== value) continue;
    return element.id || element.getAttribute("command") || "key";
  }
  return null;
}

/**
 * The shortcut string a keydown event stands for, in the spelling register()
 * was given ("S", "Shift+S"), or null if it can't be a single-key binding.
 */
function shortcutForEvent(event) {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  const key = event.key;
  if (!key || key.length !== 1) return null;
  return (event.shiftKey ? "Shift+" : "") + key.toUpperCase();
}

/**
 * The mail tab the key was pressed in.
 *
 * Resolved from the window rather than by querying for the active tab, and via
 * the extension rather than a context: when the event page is asleep there is
 * no context to ask, and the background's own getActiveTab() fallback has
 * already proven unreliable from event callbacks — see background.js.
 * @returns {number} tab id, or -1 when it can't be resolved
 */
function activeMailTabId(win) {
  try {
    const extension = ExtensionParent.GlobalManager.getExtension(EXTENSION_ID);
    const nativeTab = win.document.getElementById("tabmail")?.currentTabInfo;
    if (!extension?.tabManager || !nativeTab) return -1;
    return extension.tabManager.getWrapper(nativeTab)?.id ?? -1;
  } catch (error) {
    // Not a mail tab, or the tab manager moved. The background falls back.
    return -1;
  }
}

async function emit(id, win) {
  const tabId = activeMailTabId(win);
  if (fires.size === 0) await wakeBackground();
  for (const fire of fires) {
    try {
      await fire.async(id, tabId);
    } catch (error) {
      console.error("Move and Jump: keys.onCommand delivery failed", error);
    }
  }
}

function handlerFor(win) {
  return (event) => {
    try {
      // Something ahead of us already claimed this keystroke.
      if (event.defaultPrevented) return;
      const shortcut = shortcutForEvent(event);
      if (!shortcut) return;
      const id = shortcuts.get(shortcut);
      if (!id) return;
      // originalTarget is the real inner node; target can be retargeted at a
      // shadow-DOM or browser boundary, which would hide the text field.
      if (isTypingContext(event.originalTarget || event.target)) return;

      // Claim the keystroke: we listen in the capture phase, ahead of
      // Thunderbird's own key handling, which skips events already handled.
      // This is what lets a user bind a letter Thunderbird already uses.
      event.preventDefault();
      event.stopPropagation();
      emit(id, win);
    } catch (error) {
      console.error("Move and Jump: single-key handler failed", error);
    }
  };
}

function detachFromWindow(win) {
  const handler = trackedWindows.get(win);
  if (!handler) return;
  try {
    win.removeEventListener("keydown", handler, true);
  } catch (error) {
    // Window already torn down.
  }
}

function attachToWindow(win) {
  detachFromWindow(win);
  const handler = handlerFor(win);
  trackedWindows.set(win, handler);
  // Capture phase, so we see the keystroke before the focused element and
  // before Thunderbird's own handlers.
  win.addEventListener("keydown", handler, true);
}

function forgetWindow(win) {
  detachFromWindow(win);
  trackedWindows.delete(win);
}

function ensureWindowListener() {
  if (listening) return;
  // Also fires onLoadWindow for windows that are already open.
  ExtensionSupport.registerWindowListener(WINDOW_LISTENER_ID, {
    chromeURLs: MAIL_WINDOW_URLS,
    onLoadWindow: attachToWindow,
    onUnloadWindow: forgetWindow,
  });
  listening = true;
}

/** The window to resolve conflicts against — any mail window will do. */
function referenceWindow() {
  for (const win of trackedWindows.keys()) return win;
  return Services.wm.getMostRecentWindow("mail:3pane");
}

// Timers are held until they fire; a timer that is only referenced by the
// closure below can be collected mid-flight and never notify.
const pendingTimers = new Set();

/** setTimeout is not a global here; nsITimer is what there is. */
function delay(ms) {
  return new Promise((resolve) => {
    const timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    pendingTimers.add(timer);
    timer.initWithCallback(
      {
        notify() {
          pendingTimers.delete(timer);
          resolve();
        },
      },
      ms,
      Ci.nsITimer.TYPE_ONE_SHOT,
    );
  });
}

/**
 * Bring the background back so it can act on the keypress.
 *
 * The background is an MV3 event page: Thunderbird suspends it after a short
 * idle and its listener goes with it, leaving `fires` empty. The tidy answer
 * would be a primed listener (ExtensionAPIPersistent + PERSISTENT_EVENTS), but
 * that combination stopped this API from being registered at all — getAPI() was
 * never called and `messenger.keys` never existed, which is a far worse failure
 * than a suspended page. So: wake it explicitly and wait briefly for it to
 * re-register, which it does at every start (see applySingleKeys).
 */
async function wakeBackground() {
  try {
    const extension = ExtensionParent.GlobalManager.getExtension(EXTENSION_ID);
    if (!extension?.wakeupBackground) return;
    await extension.wakeupBackground();
    for (let i = 0; i < 20 && fires.size === 0; i++) await delay(25);
  } catch (error) {
    console.error("Move and Jump: could not wake the background", error);
  }
}

var keys = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      keys: {
        async register(newBindings) {
          shortcuts = new Map(
            (newBindings ?? [])
              .filter((binding) => binding?.shortcut && binding?.id)
              .map((binding) => [binding.shortcut, binding.id]),
          );
          ensureWindowListener();

          const win = referenceWindow();
          return [...shortcuts].map(([shortcut, id]) => ({
            id,
            shortcut,
            shadows: win ? systemKeyFor(win, shortcut) : null,
          }));
        },

        async check(shortcut) {
          const win = referenceWindow();
          if (!win) return { available: false, shadows: null };
          try {
            return { available: true, shadows: systemKeyFor(win, shortcut) };
          } catch (error) {
            console.error("Move and Jump: keys.check failed", error);
            return { available: false, shadows: null };
          }
        },

        onCommand: new ExtensionCommon.EventManager({
          context,
          name: "keys.onCommand",
          register(fire) {
            fires.add(fire);
            return () => fires.delete(fire);
          },
        }).api(),
      },
    };
  }

  onShutdown(isAppShutdown) {
    if (isAppShutdown) return;
    if (listening) {
      ExtensionSupport.unregisterWindowListener(WINDOW_LISTENER_ID);
      listening = false;
    }
    for (const win of trackedWindows.keys()) detachFromWindow(win);
    trackedWindows.clear();
    shortcuts = new Map();
  }
};
