import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMAND_NAMES,
  mapKey,
  shortcutFromEvent,
  hasPrimaryModifier,
  validateSingleKey,
} from "../lib/keys.js";

test("mapKey uppercases single characters", () => {
  assert.equal(mapKey("s"), "S");
  assert.equal(mapKey("S"), "S");
  assert.equal(mapKey("7"), "7");
});

test("mapKey translates the keys Thunderbird spells differently", () => {
  assert.equal(mapKey("ArrowUp"), "Up");
  assert.equal(mapKey(" "), "Space");
  assert.equal(mapKey(","), "Comma");
  assert.equal(mapKey("."), "Period");
});

test("mapKey passes function keys through and rejects the rest", () => {
  assert.equal(mapKey("F5"), "F5");
  assert.equal(mapKey("F12"), "F12");
  assert.equal(mapKey("Enter"), null);
  assert.equal(mapKey("Backspace"), null);
});

test("shortcutFromEvent keeps a bare key, which commands.update would reject", () => {
  assert.equal(shortcutFromEvent({ key: "s" }), "S");
  assert.equal(shortcutFromEvent({ key: "S", shiftKey: true }), "Shift+S");
});

test("shortcutFromEvent orders modifiers the way Thunderbird writes them", () => {
  assert.equal(shortcutFromEvent({ key: "n", ctrlKey: true, shiftKey: true }), "Ctrl+Shift+N");
  assert.equal(shortcutFromEvent({ key: "n", ctrlKey: true, altKey: true }), "Ctrl+Alt+N");
});

test("shortcutFromEvent uses the mac modifier names on mac", () => {
  assert.equal(shortcutFromEvent({ key: "n", ctrlKey: true }, { isMac: true }), "MacCtrl+N");
  assert.equal(shortcutFromEvent({ key: "n", metaKey: true }, { isMac: true }), "Command+N");
  // Meta is not a modifier Thunderbird accepts off mac, so it is dropped.
  assert.equal(shortcutFromEvent({ key: "n", metaKey: true }), "N");
});

test("shortcutFromEvent returns null for a key with no Thunderbird name", () => {
  assert.equal(shortcutFromEvent({ key: "Enter" }), null);
  assert.equal(shortcutFromEvent({ key: "Dead" }), null);
});

test("hasPrimaryModifier tells the two binding kinds apart", () => {
  assert.equal(hasPrimaryModifier("S"), false);
  // Shift alone is exactly the case commands.update rejects with
  // MODIFIER_REQUIRED, so it belongs to the single-key path too.
  assert.equal(hasPrimaryModifier("Shift+S"), false);
  assert.equal(hasPrimaryModifier("Ctrl+S"), true);
  assert.equal(hasPrimaryModifier("Alt+S"), true);
  assert.equal(hasPrimaryModifier("Command+S"), true);
  assert.equal(hasPrimaryModifier("MacCtrl+S"), true);
});

test("hasPrimaryModifier does not mistake the key itself for a modifier", () => {
  // "Alt" as the bound key, not as a modifier — there is nothing before the
  // last "+"-separated part, so this is still a single key.
  assert.equal(hasPrimaryModifier("Alt"), false);
});

test("validateSingleKey accepts bare and Shift-only bindings", () => {
  assert.equal(validateSingleKey("S"), null);
  assert.equal(validateSingleKey("Shift+S"), null);
  assert.equal(validateSingleKey("7"), null);
});

test("validateSingleKey sends modifier combinations to the commands API", () => {
  assert.equal(validateSingleKey("Ctrl+S"), "has-modifier");
  assert.equal(validateSingleKey("Ctrl+Shift+S"), "has-modifier");
});

test("validateSingleKey rejects keys with no XUL spelling", () => {
  assert.equal(validateSingleKey("!"), "invalid-key");
  assert.equal(validateSingleKey("F13"), "invalid-key");
  assert.equal(validateSingleKey("Enter"), "invalid-key");
});

test("validateSingleKey rejects the keys the experiment's listener cannot match", () => {
  // Thunderbird spells these differently from the uppercased event.key the
  // keydown listener compares against, so a binding on one would be recorded
  // and displayed and then never fire. Rejecting at record time is the honest
  // answer until experiments/keys learns the same aliases.
  assert.equal(validateSingleKey("F5"), "invalid-key");
  assert.equal(validateSingleKey("Space"), "invalid-key");
  assert.equal(validateSingleKey("Comma"), "invalid-key");
  assert.equal(validateSingleKey("Up"), "invalid-key");
  assert.equal(validateSingleKey("PageDown"), "invalid-key");
});

test("COMMAND_NAMES matches the commands the manifest declares", async () => {
  const { default: manifest } = await import("../manifest.json", {
    with: { type: "json" },
  });
  assert.deepEqual([...COMMAND_NAMES].sort(), Object.keys(manifest.commands).sort());
});
