import { test } from "node:test";
import assert from "node:assert/strict";
import {
  incrementWeight,
  sortByWeight,
  incrementQueryWeight,
  sortByQueryWeight,
} from "../lib/weights.js";

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

test("incrementQueryWeight fans out across every prefix of the query", () => {
  const result = incrementQueryWeight({}, "arch", "f1");
  assert.deepEqual(result, {
    a: { f1: 1 },
    ar: { f1: 1 },
    arc: { f1: 1 },
    arch: { f1: 1 },
  });
});

test("incrementQueryWeight normalizes case and trims whitespace", () => {
  assert.deepEqual(incrementQueryWeight({}, "  AB  ", "f1"), {
    a: { f1: 1 },
    ab: { f1: 1 },
  });
});

test("incrementQueryWeight accumulates across repeated calls", () => {
  let weights = incrementQueryWeight({}, "ar", "f1");
  weights = incrementQueryWeight(weights, "arch", "f1");
  assert.deepEqual(weights, {
    a: { f1: 2 },
    ar: { f1: 2 },
    arc: { f1: 1 },
    arch: { f1: 1 },
  });
});

test("incrementQueryWeight no-ops on a blank query", () => {
  const weights = { a: { f1: 1 } };
  assert.equal(incrementQueryWeight(weights, "", "f2"), weights);
  assert.equal(incrementQueryWeight(weights, "   ", "f2"), weights);
});

test("incrementQueryWeight does not mutate the input object", () => {
  const weights = { a: { f1: 1 } };
  incrementQueryWeight(weights, "a", "f2");
  assert.deepEqual(weights, { a: { f1: 1 } });
});

test("sortByQueryWeight ranks by query-specific weight first", () => {
  const queryWeights = { arch: { "2": 5, "1": 1 } };
  const globalWeights = { "1": 10, "2": 1, "4": 3 };
  const result = sortByQueryWeight(folders, queryWeights, globalWeights, "arch");
  assert.deepEqual(
    result.map((f) => f.id),
    ["2", "1", "4", "3"],
  );
});

test("sortByQueryWeight falls back to global weight, then alphabetical, when there is no query-weight entry", () => {
  const globalWeights = { "1": 5, "4": 2 };
  const result = sortByQueryWeight(folders, {}, globalWeights, "zzz");
  assert.deepEqual(
    result.map((f) => f.id),
    ["1", "4", "2", "3"],
  );
});

test("sortByQueryWeight normalizes the query the same way incrementQueryWeight does", () => {
  const queryWeights = { arch: { "2": 5 } };
  const result = sortByQueryWeight(folders, queryWeights, {}, "  ARCH  ");
  assert.equal(result[0].id, "2");
});
