import { test } from "node:test";
import assert from "node:assert/strict";
import { nextListPercent, resizePane } from "../lib/pane.js";

test("nextListPercent accepts absolute and relative percentages", () => {
  assert.equal(nextListPercent(40, "50"), 50);
  assert.equal(nextListPercent(40, "+10"), 50);
  assert.equal(nextListPercent(40, "-20"), 20);
});

test("nextListPercent clamps percentages to 10 through 90", () => {
  assert.equal(nextListPercent(85, "+10"), 90);
  assert.equal(nextListPercent(15, "-10"), 10);
  assert.equal(nextListPercent(40, "99"), 90);
  assert.equal(nextListPercent(40, "0"), 10);
});

test("nextListPercent rejects invalid values and relative values without a current width", () => {
  for (const arg of ["", "abc", "5%", "+"]) {
    assert.equal(nextListPercent(40, arg), null);
  }
  assert.equal(nextListPercent(null, "+10"), null);
  assert.equal(nextListPercent(null, "50"), 50);
});

test("resizePane returns false when the experiment API is unavailable", async () => {
  assert.equal(await resizePane(null, 3, "50"), false);
});

test("resizePane skips setting a relative width when current width is unavailable", async () => {
  let setCalled = false;
  const api = {
    async getListPercent() {
      return null;
    },
    async setListPercent() {
      setCalled = true;
      return true;
    },
  };

  assert.equal(await resizePane(api, 3, "+10"), false);
  assert.equal(setCalled, false);
});

test("resizePane sets the computed width and returns the experiment result", async () => {
  const calls = [];
  const api = {
    async getListPercent(tabId) {
      calls.push(["getListPercent", tabId]);
      return 40;
    },
    async setListPercent(tabId, percent) {
      calls.push(["setListPercent", tabId, percent]);
      return true;
    },
  };

  assert.equal(await resizePane(api, 3, "+10"), true);
  assert.deepEqual(calls, [["getListPercent", 3], ["setListPercent", 3, 50]]);
});
