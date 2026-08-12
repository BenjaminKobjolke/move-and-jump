import { test } from "node:test";
import assert from "node:assert/strict";
import { filterFolders } from "../lib/match.js";

const folders = [
  { id: "1", name: "Inbox", path: "/Inbox", accountId: "a1" },
  { id: "2", name: "Archive", path: "/Archive", accountId: "a1" },
  { id: "3", name: "Projects", path: "/Archive/Projects", accountId: "a1" },
  { id: "4", name: "Budget", path: "/Work/Budget", accountId: "a2" },
  { id: "5", name: "Test", path: "/Test", accountId: "a1" },
  { id: "6", name: "Testing", path: "/Testing", accountId: "a1" },
];

test("empty (or blank) query returns no matches", () => {
  assert.deepEqual(filterFolders(folders, ""), []);
  assert.deepEqual(filterFolders(folders, "   "), []);
});

test("name-starts-with ranks above path-contains", () => {
  const result = filterFolders(folders, "arch");
  assert.deepEqual(
    result.map((f) => f.id),
    ["2", "3"],
  );
});

test("ties within a rank tier are ordered alphabetically", () => {
  const result = filterFolders(folders, "test");
  assert.deepEqual(
    result.map((f) => f.id),
    ["5", "6"],
  );
});

test("search is case-insensitive by default", () => {
  assert.deepEqual(
    filterFolders(folders, "INBOX").map((f) => f.id),
    ["1"],
  );
});

test("caseSensitive option respects case", () => {
  assert.deepEqual(filterFolders(folders, "INBOX", { caseSensitive: true }), []);
  assert.deepEqual(
    filterFolders(folders, "Inbox", { caseSensitive: true }).map((f) => f.id),
    ["1"],
  );
});

test("query with no matches returns an empty array", () => {
  assert.deepEqual(filterFolders(folders, "zzz"), []);
});

const foldersWithAccounts = [
  { id: "1", name: "Inbox", path: "/Inbox", accountId: "a1", accountName: "Personal" },
  { id: "2", name: "Inbox", path: "/Inbox", accountId: "a2", accountName: "Work" },
];

test("account-name matches rank below name and path matches", () => {
  const result = filterFolders(foldersWithAccounts, "work");
  assert.deepEqual(
    result.map((f) => f.id),
    ["2"],
  );
});

test("account name does not affect matches that already hit on name/path", () => {
  const result = filterFolders(foldersWithAccounts, "inbox");
  assert.deepEqual(
    result.map((f) => f.id),
    ["1", "2"],
  );
});

const fuzzyFolders = [
  { id: "1", name: "Tobias", path: "/Team/Tobias", accountName: "AXMain" },
  { id: "2", name: "Tobias", path: "/Rechnungen Tobias", accountName: "AXMain" },
  { id: "3", name: "Anna", path: "/Team/Anna", accountName: "AXMain" },
];

test("fuzzy: every space-split term must match somewhere, order-independent", () => {
  const result = filterFolders(fuzzyFolders, "main to", { fuzzy: true });
  assert.deepEqual(
    result.map((f) => f.id).sort(),
    ["1", "2"],
  );
});

test("fuzzy: a term matching no field excludes the folder", () => {
  // "team" hits #1/#3 but "tob" only hits #1
  const result = filterFolders(fuzzyFolders, "team tob", { fuzzy: true });
  assert.deepEqual(
    result.map((f) => f.id),
    ["1"],
  );
});

test("without fuzzy, a spaced query is a literal substring (no match)", () => {
  assert.deepEqual(filterFolders(fuzzyFolders, "main to"), []);
});
