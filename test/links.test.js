import { test } from "node:test";
import assert from "node:assert/strict";
import { extractUrls, dedupeLinks } from "../lib/links.js";

test("extractUrls finds http and https urls in order", () => {
  assert.deepEqual(extractUrls("see https://a.example/x and http://b.example"), [
    "https://a.example/x",
    "http://b.example",
  ]);
});

test("extractUrls strips trailing sentence punctuation", () => {
  assert.deepEqual(extractUrls("Visit https://a.example/page. Or (https://b.example)!"), [
    "https://a.example/page",
    "https://b.example",
  ]);
});

test("extractUrls stops at angle brackets and quotes", () => {
  assert.deepEqual(extractUrls('<https://a.example/q?x=1&y=2> "https://b.example"'), [
    "https://a.example/q?x=1&y=2",
    "https://b.example",
  ]);
});

test("extractUrls returns [] for text without urls", () => {
  assert.deepEqual(extractUrls("no links here, mailto:me@example.com"), []);
});

test("dedupeLinks keeps the first of each url and drops non-http links", () => {
  const links = [
    { text: "Docs", url: "https://a.example" },
    { text: "mail", url: "mailto:me@example.com" },
    { text: "https://a.example", url: "https://a.example" },
    { text: "B", url: "HTTP://b.example" },
  ];
  assert.deepEqual(dedupeLinks(links), [
    { text: "Docs", url: "https://a.example" },
    { text: "B", url: "HTTP://b.example" },
  ]);
});
