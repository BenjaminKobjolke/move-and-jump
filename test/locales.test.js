import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";

const messages = JSON.parse(
  readFileSync(new URL("../_locales/en/messages.json", import.meta.url), "utf8"),
);

test("locale message placeholders name declared placeholders", () => {
  for (const [key, entry] of Object.entries(messages)) {
    const placeholders = new Set(
      Object.keys(entry.placeholders ?? {}).map((name) => name.toLowerCase()),
    );

    for (const [, placeholder] of entry.message.matchAll(/\$([A-Za-z0-9_@]+)\$/g)) {
      assert.ok(
        placeholders.has(placeholder.toLowerCase()),
        `${key} uses undeclared placeholder ${placeholder}`,
      );
    }
  }
});
