import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pushRecent,
  prioritize,
  MAX_RECENT,
  MAX_SENDER_FOLDERS,
  SENDER_RETENTION_MS,
  pruneSenders,
} from "../lib/recent.js";

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

test("prioritizes listed folders in id order and preserves the remaining order", () => {
  const folders = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  assert.deepEqual(prioritize(folders, ["c", "a"]), [
    folders[2],
    folders[0],
    folders[1],
    folders[3],
  ]);
});

test("prioritize ignores ids that are not present", () => {
  const folders = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(prioritize(folders, ["missing", "b"]), [folders[1], folders[0]]);
});

test("prioritize does not mutate its input", () => {
  const folders = [{ id: "a" }, { id: "b" }];
  const ids = ["b"];
  prioritize(folders, ids);
  assert.deepEqual(folders, [{ id: "a" }, { id: "b" }]);
  assert.deepEqual(ids, ["b"]);
});

test("pushRecent caps sender history at three folders", () => {
  assert.equal(MAX_SENDER_FOLDERS, 3);
  assert.deepEqual(pushRecent(["a", "b", "c"], "d", MAX_SENDER_FOLDERS), [
    "d",
    "a",
    "b",
  ]);
});

test("pruneSenders keeps senders used within the retention window", () => {
  const now = 1_000_000;
  const result = pruneSenders({ alice: ["inbox"] }, { alice: now - SENDER_RETENTION_MS }, now);
  assert.deepEqual(result, {
    senderFolders: { alice: ["inbox"] },
    senderUsedAt: { alice: now - SENDER_RETENTION_MS },
  });
});

test("pruneSenders drops senders older than the retention window from both maps", () => {
  const now = 1_000_000;
  const result = pruneSenders(
    { alice: ["inbox"], bob: ["archive"] },
    { alice: now - SENDER_RETENTION_MS - 1, bob: now },
    now,
  );
  assert.deepEqual(result, {
    senderFolders: { bob: ["archive"] },
    senderUsedAt: { bob: now },
  });
});

test("pruneSenders keeps senders exactly at the retention boundary", () => {
  const now = 1_000_000;
  const result = pruneSenders(
    { alice: ["inbox"] },
    { alice: now - SENDER_RETENTION_MS },
    now,
  );
  assert.deepEqual(result.senderFolders, { alice: ["inbox"] });
});

test("pruneSenders stamps legacy senders without a timestamp", () => {
  const now = 1_000_000;
  const result = pruneSenders({ alice: ["inbox"] }, {}, now);
  assert.deepEqual(result, {
    senderFolders: { alice: ["inbox"] },
    senderUsedAt: { alice: now },
  });
});

test("pruneSenders drops timestamp entries without folders", () => {
  const result = pruneSenders({}, { orphan: 999 }, 1_000);
  assert.deepEqual(result, { senderFolders: {}, senderUsedAt: {} });
});

test("pruneSenders does not mutate its inputs", () => {
  const senderFolders = { alice: ["inbox"] };
  const senderUsedAt = {};
  pruneSenders(senderFolders, senderUsedAt, 1_000);
  assert.deepEqual(senderFolders, { alice: ["inbox"] });
  assert.deepEqual(senderUsedAt, {});
});

test("pruneSenders honors a custom retention window", () => {
  const result = pruneSenders({ alice: ["inbox"] }, { alice: 899 }, 1_000, 100);
  assert.deepEqual(result, { senderFolders: {}, senderUsedAt: {} });
});
