import { test } from "node:test";
import assert from "node:assert/strict";
import { elideMiddle, elidePath } from "../lib/elide.js";

test("elideMiddle leaves short text alone", () => {
  assert.equal(elideMiddle("Inbox", 10), "Inbox");
});

test("elideMiddle replaces the middle with an ellipsis, keeping more of the end", () => {
  assert.equal(elideMiddle("abcdefghijkl", 6), "ab…jkl");
});

test("elideMiddle never splits surrogate pairs", () => {
  assert.equal(elideMiddle("😀😀😀😀😀😀", 4), "😀…😀😀");
});

test("elidePath leaves short paths alone apart from the leading slash", () => {
  assert.equal(elidePath("/Inbox/Archive", 40), "Inbox/Archive");
});

test("elidePath drops whole middle segments, keeping the first and as many trailing ones as fit", () => {
  assert.equal(
    elidePath("/science/projects and publications/2026/2026-10 DGfN Leipzig", 40),
    "science/…/2026/2026-10 DGfN Leipzig",
  );
  assert.equal(
    elidePath("/science/projects and publications/2026/2026-10 DGfN Leipzig", 30),
    "science/…/2026-10 DGfN Leipzig",
  );
});

test("elidePath drops the first segment when it doesn't fit alongside the end", () => {
  assert.equal(
    elidePath("/a very long top-level folder/x/2026-10 DGfN Leipzig", 30),
    "…/x/2026-10 DGfN Leipzig",
  );
});

test("elidePath with two long segments keeps the last one", () => {
  assert.equal(elidePath("/projects and publications/2026-10 DGfN Leipzig", 30), "…/2026-10 DGfN Leipzig");
});

test("elidePath shortens an overlong last segment in its own middle", () => {
  assert.equal(elidePath("/a/b/abcdefghijklmnopqrstuvwxyz", 10), "abcd…vwxyz");
  assert.equal(elidePath("/abcdefghijklmnopqrstuvwxyz", 10), "abcd…vwxyz");
});

test("elidePath result never exceeds maxLength", () => {
  const path = "/one/two two/three three three/four/five five five five/six";
  for (let max = 3; max <= 60; max++) {
    assert.ok(Array.from(elidePath(path, max)).length <= max, `max ${max}`);
  }
});
