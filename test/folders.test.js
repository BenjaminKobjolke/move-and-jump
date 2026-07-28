import { test } from "node:test";
import assert from "node:assert/strict";
import { filterByAccount } from "../lib/folders.js";

const folders = [
  { id: "1", accountId: "a1" },
  { id: "2", accountId: "a2" },
  { id: "3", accountId: "a1" },
];

test("returns all folders when accountId is falsy", () => {
  assert.deepEqual(filterByAccount(folders, null), folders);
  assert.deepEqual(filterByAccount(folders, undefined), folders);
});

test("filters folders down to the given account", () => {
  assert.deepEqual(
    filterByAccount(folders, "a1").map((f) => f.id),
    ["1", "3"],
  );
});

test("returns an empty array when no folder matches", () => {
  assert.deepEqual(filterByAccount(folders, "a3"), []);
});
