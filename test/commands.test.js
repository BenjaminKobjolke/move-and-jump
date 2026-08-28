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

test("parseCommand keeps spaces inside a multi-term argument", () => {
  assert.deepEqual(parseCommand("/filter tom lehr"), { token: "filter", arg: "tom lehr" });
});

test("matchCommands prefix-matches by command name", () => {
  assert.deepEqual(matchCommands("a").map((c) => c.name), ["all"]);
  assert.deepEqual(matchCommands("s").map((c) => c.name), ["sensitive"]);
  assert.deepEqual(matchCommands("z").map((c) => c.name), ["zoom"]);
  assert.deepEqual(matchCommands("b").map((c) => c.name), ["body"]);
  assert.deepEqual(matchCommands("r").map((c) => c.name), ["recipients"]);
  assert.deepEqual(matchCommands("c").map((c) => c.name), ["columns"]);
});

test("an ambiguous prefix matches every command sharing it", () => {
  assert.deepEqual(matchCommands("f").map((c) => c.name), ["filter", "fuzzy"]);
});

test("bare slash (empty token) matches every command", () => {
  assert.deepEqual(matchCommands("").map((c) => c.name), [
    "filter",
    "body",
    "recipients",
    "zoom",
    "fuzzy",
    "all",
    "sensitive",
    "columns",
    "go",
  ]);
});

test("parseCommand keeps a column name as the argument", () => {
  assert.deepEqual(parseCommand("/columns da"), { token: "columns", arg: "da" });
});

test("no command matches an unknown token", () => {
  assert.deepEqual(matchCommands("xyz"), []);
});

test("matchCommands(\"g\") matches only go", () => {
  assert.deepEqual(matchCommands("g").map((c) => c.name), ["go"]);
});
