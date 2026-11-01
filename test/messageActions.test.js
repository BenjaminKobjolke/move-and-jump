import { test } from "node:test";
import assert from "node:assert/strict";
import { Blob } from "node:buffer";
import { createMessageActions } from "../lib/messageActions.js";

function setup({ messages = [{ id: 42 }], attachments = [] } = {}) {
  const calls = [];
  const messenger = {
    messageDisplay: {
      async getDisplayedMessages(tabId) {
        calls.push(["getDisplayedMessages", tabId]);
        return { messages };
      },
    },
    messages: {
      async listAttachments(messageId) {
        calls.push(["listAttachments", messageId]);
        return attachments;
      },
      async openAttachment(...args) {
        calls.push(["openAttachment", ...args]);
      },
      async getAttachmentFile(messageId, partName) {
        calls.push(["getAttachmentFile", messageId, partName]);
        return new Blob(["attachment"]);
      },
    },
    downloads: {
      async download(options) {
        calls.push(["download", options]);
      },
    },
  };
  const actions = createMessageActions(messenger, async () => ({ id: 7 }));
  return { actions, calls };
}

test("openAttachments with no attachments does nothing", async () => {
  const { actions, calls } = setup();
  let shown = false;

  await actions.openAttachments(undefined, async () => { shown = true; });

  assert.equal(calls.some(([name]) => name === "openAttachment"), false);
  assert.equal(shown, false);
});

test("openAttachments opens a sole attachment using the resolved tab id", async () => {
  const attachment = { name: "report.pdf", partName: "1.2" };
  const { actions, calls } = setup({ attachments: [attachment] });
  let shown = false;

  await actions.openAttachments(undefined, async () => { shown = true; });

  assert.deepEqual(calls.filter(([name]) => name === "openAttachment"), [
    ["openAttachment", 42, "1.2", 7],
  ]);
  assert.equal(shown, false);
});

test("openAttachments asks the popup to show a list for multiple attachments", async () => {
  const attachments = [
    { name: "a.pdf", partName: "1" },
    { name: "b.pdf", partName: "2" },
    { name: "c.pdf", partName: "3" },
  ];
  const { actions, calls } = setup({ attachments });
  const shown = [];

  await actions.openAttachments(undefined, async (tabId) => shown.push(tabId));

  assert.deepEqual(shown, [7]);
  assert.equal(calls.some(([name]) => name === "openAttachment"), false);
});

test("openAttachments does nothing when the displayed message is ambiguous", async () => {
  const { actions, calls } = setup({
    messages: [{ id: 42 }, { id: 43 }],
    attachments: [{ name: "a.pdf", partName: "1" }],
  });
  let shown = false;

  await actions.openAttachments(undefined, async () => { shown = true; });

  assert.equal(calls.some(([name]) => name === "listAttachments"), false);
  assert.equal(calls.some(([name]) => name === "openAttachment"), false);
  assert.equal(shown, false);
});

test("saveAttachments downloads every attachment with safe unique filenames", async () => {
  const originalCreateObjectURL = URL.createObjectURL;
  let nextUrl = 0;
  URL.createObjectURL = () => `blob:test-${++nextUrl}`;
  try {
    const { actions, calls } = setup({
      attachments: [
        { name: "report/2026:final.pdf", partName: "1" },
        { name: "notes.txt", partName: "2" },
      ],
    });

    await actions.saveAttachments(7);

    const downloads = calls.filter(([name]) => name === "download").map(([, options]) => options);
    assert.equal(downloads.length, 2);
    assert.deepEqual(downloads.map(({ filename, conflictAction }) => [filename, conflictAction]), [
      ["report_2026_final.pdf", "uniquify"],
      ["notes.txt", "uniquify"],
    ]);
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
  }
});
