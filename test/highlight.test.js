import { test } from "node:test";
import assert from "node:assert/strict";
import { findMatchRange, findMatchRanges } from "../lib/highlight.js";

test("finds a case-insensitive match by default", () => {
  assert.deepEqual(findMatchRange("Archive/Projects", "proj"), { start: 8, end: 12 });
  assert.deepEqual(findMatchRange("Archive/Projects", "PROJ"), { start: 8, end: 12 });
});

test("caseSensitive option respects case", () => {
  assert.equal(findMatchRange("Archive/Projects", "PROJ", { caseSensitive: true }), null);
  assert.deepEqual(findMatchRange("Archive/Projects", "Proj", { caseSensitive: true }), {
    start: 8,
    end: 12,
  });
});

test("returns null for a blank query", () => {
  assert.equal(findMatchRange("Inbox", ""), null);
  assert.equal(findMatchRange("Inbox", "   "), null);
});

test("returns null when the query isn't in the text at all", () => {
  assert.equal(findMatchRange("Inbox", "zzz"), null);
});

test("matches at the very start and the very end of the text", () => {
  assert.deepEqual(findMatchRange("Inbox", "In"), { start: 0, end: 2 });
  assert.deepEqual(findMatchRange("Inbox", "box"), { start: 2, end: 5 });
});

test("findMatchRanges: single term returns one range", () => {
  assert.deepEqual(findMatchRanges("AXMain: /Team/Tobias", "tob"), [{ start: 14, end: 17 }]);
  assert.deepEqual(findMatchRanges("Inbox", ""), []);
});

test("findMatchRanges fuzzy: each term marked, sorted by position", () => {
  assert.deepEqual(findMatchRanges("AXMain: /Team/Tobias", "main to", { fuzzy: true }), [
    { start: 2, end: 6 },
    { start: 14, end: 16 },
  ]);
});

test("findMatchRanges fuzzy: overlapping terms are merged", () => {
  assert.deepEqual(findMatchRanges("Tobias", "tob obi", { fuzzy: true }), [{ start: 0, end: 4 }]);
});

test("findMatchRanges fuzzy: a term absent from the label is skipped", () => {
  assert.deepEqual(findMatchRanges("/Team/Tobias", "team zzz", { fuzzy: true }), [
    { start: 1, end: 5 },
  ]);
});
