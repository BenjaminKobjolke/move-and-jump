import { test } from "node:test";
import assert from "node:assert/strict";
import { getOptions, DEFAULT_OPTIONS } from "../lib/options.js";

function fakeStorage(stored) {
  return {
    async get() {
      return stored;
    },
  };
}

test("returns defaults when nothing is stored", async () => {
  assert.deepEqual(await getOptions(fakeStorage({})), DEFAULT_OPTIONS);
});

test("stored options override defaults", async () => {
  const result = await getOptions(
    fakeStorage({ options: { caseSensitiveSearch: true } }),
  );
  assert.deepEqual(result, {
    caseSensitiveSearch: true,
    fuzzySearch: false,
    searchAllAccounts: true,
    zoom: 100,
  });
});

test("all default keys are present even with a partial stored object", async () => {
  const result = await getOptions(fakeStorage({ options: { searchAllAccounts: false } }));
  assert.deepEqual(result, {
    caseSensitiveSearch: false,
    fuzzySearch: false,
    searchAllAccounts: false,
    zoom: 100,
  });
});
