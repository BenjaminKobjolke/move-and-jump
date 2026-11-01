import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ATTACHMENT_ACTION,
  attachmentAction,
  filterAttachments,
  formatSize,
} from "../lib/attachments.js";

test("attachmentAction branches for none, one, and multiple attachments", () => {
  assert.equal(attachmentAction(0), ATTACHMENT_ACTION.NONE);
  assert.equal(attachmentAction(1), ATTACHMENT_ACTION.OPEN);
  assert.equal(attachmentAction(3), ATTACHMENT_ACTION.LIST);
});

test("formatSize uses readable binary units and rejects invalid sizes", () => {
  assert.equal(formatSize(0), "0 B");
  assert.equal(formatSize(512), "512 B");
  assert.equal(formatSize(12 * 1024), "12 KB");
  assert.equal(formatSize(3.4 * 1024 ** 2), "3.4 MB");
  assert.equal(formatSize(1.2 * 1024 ** 3), "1.2 GB");
  assert.equal(formatSize(undefined), "");
  assert.equal(formatSize(NaN), "");
  assert.equal(formatSize(Infinity), "");
  assert.equal(formatSize(-1), "");
});

test("filterAttachments matches every term in any order without case sensitivity", () => {
  const attachments = [
    { name: "Report-2026.pdf", partName: "1" },
    { name: "notes.txt", partName: "2" },
    { name: "PDF reference report.txt", partName: "3" },
  ];

  assert.deepEqual(filterAttachments(attachments, ""), attachments);
  assert.deepEqual(filterAttachments(attachments, "rep pdf"), [attachments[0], attachments[2]]);
  assert.deepEqual(filterAttachments(attachments, "PDF REPORT"), [attachments[0], attachments[2]]);
});
