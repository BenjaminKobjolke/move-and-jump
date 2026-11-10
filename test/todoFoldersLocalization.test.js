import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const messages = JSON.parse(
  await readFile(new URL("../_locales/en/messages.json", import.meta.url), "utf8"),
);
const manifest = JSON.parse(
  await readFile(new URL("../manifest.json", import.meta.url), "utf8"),
);

test("English locale defines the delete-empty-todos command and all outcomes", () => {
  for (const key of [
    "commandDeleteEmptyTodos",
    "commandDeleteEmptyTodosDescription",
    "commandDeleteEmptyTodosUnavailable",
    "commandDeleteEmptyTodosNone",
    "commandDeleteEmptyTodosDeleted",
    "commandDeleteEmptyTodosError",
  ]) {
    assert.equal(typeof messages[key]?.message, "string", `${key} has a message`);
    assert.equal(typeof messages[key]?.description, "string", `${key} has a description`);
  }
});

test("English locale declares the count and error substitutions", () => {
  assert.deepEqual(messages.commandDeleteEmptyTodosDeleted.placeholders, {
    count: { content: "$1", example: "3" },
  });
  assert.deepEqual(messages.commandDeleteEmptyTodosError.placeholders, {
    error: { content: "$1", example: "Sync is still running" },
  });
});

test("delete-empty-todos has a localized manifest shortcut without a default key", () => {
  const command = manifest.commands["delete-empty-todos"];

  assert.deepEqual(command, {
    description: "__MSG_commandDeleteEmptyTodosDescription__",
  });
  assert.equal("suggested_key" in command, false);
});
