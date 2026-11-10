import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand, matchCommands, createCommandDispatcher } from "../lib/commands.js";

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
  assert.deepEqual(matchCommands("se").map((c) => c.name), ["sensitive"]);
  assert.deepEqual(matchCommands("z").map((c) => c.name), ["zoom"]);
  assert.deepEqual(matchCommands("b").map((c) => c.name), ["body"]);
  assert.deepEqual(matchCommands("rec").map((c) => c.name), ["recipients"]);
  assert.deepEqual(matchCommands("col").map((c) => c.name), ["columns"]);
});

test("with no prefix match, matchCommands falls back to letters in order", () => {
  assert.deepEqual(matchCommands("top").map((c) => c.name), ["navigate-top"]);
  assert.deepEqual(matchCommands("ntp").map((c) => c.name), ["navigate-top"]);
  assert.deepEqual(matchCommands("attach").map((c) => c.name), [
    "save-attachments",
    "open-attachments",
  ]);
  assert.deepEqual(matchCommands("xyz"), []);
});

test("an ambiguous prefix matches every command sharing it", () => {
  assert.deepEqual(matchCommands("f").map((c) => c.name), ["filter", "fuzzy", "from"]);
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
    "links",
    "from",
    "copy-name",
    "copy-email",
    "copy-subject",
    "save-attachments",
    "open-attachments",
    "write",
    "reply",
    "reply-all",
    "navigate-top",
    "delete-empty-todos",
  ]);
});

test('matchCommands("del") matches delete-empty-todos', () => {
  assert.deepEqual(matchCommands("del").map((c) => c.name), ["delete-empty-todos"]);
});

test("parseCommand keeps a column name as the argument", () => {
  assert.deepEqual(parseCommand("/columns da"), { token: "columns", arg: "da" });
});

test("\"/reply\" lists both reply commands, \"/reply-\" only reply-all", () => {
  assert.deepEqual(matchCommands("reply").map((c) => c.name), ["reply", "reply-all"]);
  assert.deepEqual(matchCommands("reply-").map((c) => c.name), ["reply-all"]);
});

test("no command matches an unknown token", () => {
  assert.deepEqual(matchCommands("xyz"), []);
});

test("matchCommands(\"g\") matches only go", () => {
  assert.deepEqual(matchCommands("g").map((c) => c.name), ["go"]);
});

test("command dispatcher routes the message commands and search commands", async () => {
  const calls = [];
  const action = (name) => (...args) => calls.push([name, ...args]);
  const dispatch = createCommandDispatcher({
    openSearchWindow: action("search"),
    actOnLastFolder: action("last"),
    messageActions: {
      copySender: action("copySender"),
      copySubject: action("copySubject"),
      saveAttachments: action("saveAttachments"),
      openAttachments: action("openAttachments"),
      writeToSender: action("writeToSender"),
      navigateTop: action("navigateTop"),
    },
  });

  dispatch("move-search", 3);
  dispatch("jump-search", 3);
  dispatch("filter-search", 3);
  dispatch("move-last", 3);
  dispatch("jump-last", 3);
  dispatch("copy-sender-name", 3);
  dispatch("copy-sender-email", 3);
  dispatch("copy-subject", 3);
  dispatch("save-attachments", 3);
  dispatch("open-attachments", 3);
  dispatch("write-to-sender", 3);
  dispatch("open-link", 3);
  dispatch("navigate-top", 3);
  dispatch("delete-empty-todos", 3);
  assert.equal(dispatch("unknown", 3), undefined);

  assert.deepEqual(calls.map(([name, ...args]) => [
    name,
    ...args.map((arg) => typeof arg === "function" ? "<callback>" : arg),
  ]), [
    ["search", "move", 3],
    ["search", "jump", 3],
    ["search", "move", 3, "/filter "],
    ["last", "move", 3],
    ["last", "jump", 3],
    ["copySender", 3, "name"],
    ["copySender", 3, "email"],
    ["copySubject", 3],
    ["saveAttachments", 3],
    ["openAttachments", 3, "<callback>"],
    ["writeToSender", 3],
    ["search", "move", 3, "/links "],
    ["navigateTop", 3],
    ["search", "move", 3, "/delete-empty-todos"],
  ]);
});
