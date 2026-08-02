import { test } from "node:test";
import assert from "node:assert/strict";
import { incrementWeight, sortByWeight } from "../lib/weights.js";

test("incrementWeight starts an unseen folder at 1", () => {
  assert.deepEqual(incrementWeight({}, "f1"), { f1: 1 });
});

test("incrementWeight adds 1 to an existing weight", () => {
  assert.deepEqual(incrementWeight({ f1: 3, f2: 1 }, "f1"), { f1: 4, f2: 1 });
});

test("incrementWeight does not mutate the input object", () => {
  const weights = { f1: 1 };
  incrementWeight(weights, "f1");
  assert.deepEqual(weights, { f1: 1 });
});

const folders = [
  { id: "1", name: "Zebra" },
  { id: "2", name: "Archive" },
  { id: "3", name: "budget" },
  { id: "4", name: "Inbox" },
];

test("sorts by weight, most-used first", () => {
  const weights = { "1": 2, "2": 5, "4": 1 };
  const result = sortByWeight(folders, weights);
  assert.deepEqual(
    result.map((f) => f.id),
    ["2", "1", "4", "3"],
  );
});

test("folders with equal (including zero/absent) weight fall back to case-insensitive alphabetical order", () => {
  const result = sortByWeight(folders, {});
  assert.deepEqual(
    result.map((f) => f.id),
    ["2", "3", "4", "1"],
  );
});

test("does not mutate the input array", () => {
  const input = [...folders];
  sortByWeight(folders, { "1": 5 });
  assert.deepEqual(folders, input);
});
