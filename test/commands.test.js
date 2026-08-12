import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand, matchCommands } from "../lib/commands.js";

test("parseCommand splits token and argument", () => {
  assert.deepEqual(parseCommand("/zoom 120"), { token: "zoom", arg: "120" });
});

test("parseCommand lowercases the token, trims, ignores case of arg", () => {
  assert.deepEqual(parseCommand("  /ZOOM  150  "), { token: "zoom", arg: "150" });
});

test("parseCommand returns empty arg for a bare command", () => {
  assert.deepEqual(parseCommand("/all"), { token: "all", arg: "" });
});

test("parseCommand returns null for non-command input", () => {
  assert.equal(parseCommand("inbox"), null);
  assert.equal(parseCommand(""), null);
});

test("matchCommands prefix-matches by command name", () => {
  assert.deepEqual(matchCommands("a").map((c) => c.name), ["all"]);
  assert.deepEqual(matchCommands("s").map((c) => c.name), ["sensitive"]);
  assert.deepEqual(matchCommands("z").map((c) => c.name), ["zoom"]);
});

test("bare slash (empty token) matches every command", () => {
  assert.deepEqual(matchCommands("").map((c) => c.name), [
    "zoom",
    "fuzzy",
    "all",
    "sensitive",
  ]);
});

test("no command matches an unknown token", () => {
  assert.deepEqual(matchCommands("xyz"), []);
});
