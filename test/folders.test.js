import { test } from "node:test";
import assert from "node:assert/strict";
import { filterByAccount, inboxFolders, orderUnified } from "../lib/folders.js";

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

test("picks out the inboxes by specialUse", () => {
  const mixed = [
    { id: "i1", specialUse: ["inbox"] },
    { id: "s1", specialUse: ["sent"] },
    { id: "p1" },
  ];
  assert.deepEqual(
    inboxFolders(mixed).map((f) => f.id),
    ["i1"],
  );
});

test("orderUnified sorts by special use, unknown uses last", () => {
  const shuffled = [
    { specialUse: ["trash"] },
    { specialUse: ["outbox"] },
    { specialUse: ["inbox"] },
    { specialUse: ["sent"] },
    {},
  ];
  assert.deepEqual(
    orderUnified(shuffled).map((f) => f.specialUse?.[0] ?? "none"),
    ["inbox", "sent", "trash", "outbox", "none"],
  );
});

test("orderUnified does not mutate its input", () => {
  const input = [{ specialUse: ["sent"] }, { specialUse: ["inbox"] }];
  orderUnified(input);
  assert.deepEqual(input[0].specialUse, ["sent"]);
});
