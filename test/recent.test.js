import { test } from "node:test";
import assert from "node:assert/strict";
import { pushRecent, MAX_RECENT } from "../lib/recent.js";

test("adds a new folder to the front", () => {
  assert.deepEqual(pushRecent([], "a"), ["a"]);
  assert.deepEqual(pushRecent(["b", "c"], "a"), ["a", "b", "c"]);
});

test("moves an existing folder to the front instead of duplicating", () => {
  assert.deepEqual(pushRecent(["a", "b", "c"], "b"), ["b", "a", "c"]);
});

test("caps the list at the max length", () => {
  const many = Array.from({ length: MAX_RECENT }, (_, i) => `f${i}`);
  const result = pushRecent(many, "new");
  assert.equal(result.length, MAX_RECENT);
  assert.equal(result[0], "new");
  assert.equal(result[result.length - 1], `f${MAX_RECENT - 2}`);
});

test("respects a custom max", () => {
  assert.deepEqual(pushRecent(["a", "b", "c"], "d", 2), ["d", "a"]);
});

test("does not mutate the input array", () => {
  const input = ["a", "b"];
  pushRecent(input, "c");
  assert.deepEqual(input, ["a", "b"]);
});
