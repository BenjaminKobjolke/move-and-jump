import { test } from "node:test";
import assert from "node:assert/strict";
import { completeTag, normalizeTag, parseFilterQuery, partialTag } from "../lib/filterQuery.js";

const TAGS = [
  { key: "$label1", tag: "Important" },
  { key: "$label4", tag: "To Do" },
  { key: "invoice", tag: "Invoice" },
];

test("normalizeTag lowercases and strips whitespace", () => {
  assert.equal(normalizeTag(" To  Do "), "todo");
});

test("parseFilterQuery keeps plain terms as text", () => {
  assert.deepEqual(parseFilterQuery("inn lehrich@theim", TAGS), {
    text: "inn lehrich@theim",
    tagKeys: [],
  });
});

test("parseFilterQuery splits tag terms from text, case-insensitive", () => {
  assert.deepEqual(parseFilterQuery("TAG:important rechnung tag:todo", TAGS), {
    text: "rechnung",
    tagKeys: ["$label1", "$label4"],
  });
});

test("parseFilterQuery drops unknown and partial tag terms", () => {
  assert.deepEqual(parseFilterQuery("tag:imp tag: foo", TAGS), { text: "foo", tagKeys: [] });
});

test("parseFilterQuery of an empty query is empty", () => {
  assert.deepEqual(parseFilterQuery("", TAGS), { text: "", tagKeys: [] });
});

test("partialTag returns the prefix of a tag term being typed", () => {
  assert.equal(partialTag("/filter foo tag:Im"), "im");
  assert.equal(partialTag("/filter tag:"), "");
});

test("partialTag is null after a trailing space or for a plain term", () => {
  assert.equal(partialTag("/filter tag:imp "), null);
  assert.equal(partialTag("/filter foo"), null);
  assert.equal(partialTag("/filter"), null);
});

test("completeTag replaces the last term and adds a space", () => {
  assert.equal(completeTag("/filter foo tag:t", "To Do"), "/filter foo tag:todo ");
});
