import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeImapUtf7 } from "../lib/imapUtf7.js";

test("plain ASCII passes through unchanged", () => {
  assert.equal(decodeImapUtf7("Inbox"), "Inbox");
  assert.equal(decodeImapUtf7("Archive/2024"), "Archive/2024");
});

test("decodes a single accented character", () => {
  assert.equal(decodeImapUtf7("M&APw-nchen"), "München");
  assert.equal(decodeImapUtf7("K&AOQ-se"), "Käse");
});

test("decodes a run of multiple non-ASCII characters", () => {
  assert.equal(decodeImapUtf7("Gr&APwA3w-e"), "Grüße");
  assert.equal(decodeImapUtf7("&ZeVnLIqe-"), "日本語");
  assert.equal(decodeImapUtf7("&BD8EOwQ+BEUEPgQ5-"), "плохой");
});

test("&- decodes to a literal ampersand", () => {
  assert.equal(decodeImapUtf7("Tom &- Jerry"), "Tom & Jerry");
});

test("empty string is unchanged", () => {
  assert.equal(decodeImapUtf7(""), "");
});
