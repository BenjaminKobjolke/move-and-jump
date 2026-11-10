import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MANAGE_TODO_FOLDERS_ID,
  TODO_FOLDER_MESSAGES,
  deleteEmptyTodoFolders,
} from "../lib/todoFolders.js";

function setup({ pingReply = { ok: true }, deleteReply = { ok: true, deleted: [] }, pingError, deleteError } = {}) {
  const calls = [];
  const runtime = {
    async sendMessage(extensionId, message) {
      calls.push([extensionId, message]);
      if (message.type === TODO_FOLDER_MESSAGES.PING) {
        if (pingError) throw pingError;
        return pingReply;
      }
      if (deleteError) throw deleteError;
      return deleteReply;
    },
  };
  return { runtime, calls };
}

test("uses the approved receiver id and pings before requesting deletion", async () => {
  const { runtime, calls } = setup({ deleteReply: { ok: true, deleted: ["1", "2"] } });

  await deleteEmptyTodoFolders(runtime);

  assert.deepEqual(calls, [
    [MANAGE_TODO_FOLDERS_ID, { type: "ping" }],
    [MANAGE_TODO_FOLDERS_ID, { type: "delete-empty-todo-folders" }],
  ]);
  assert.equal(MANAGE_TODO_FOLDERS_ID, "manage-todo-folders@kobjolke.de");
  assert.deepEqual(TODO_FOLDER_MESSAGES, {
    PING: "ping",
    DELETE_EMPTY: "delete-empty-todo-folders",
  });
  assert.equal(Object.isFrozen(TODO_FOLDER_MESSAGES), true);
});

test("maps a rejected ping to the unavailable message", async () => {
  const { runtime } = setup({ pingError: new Error("Receiving end does not exist.") });

  assert.deepEqual(await deleteEmptyTodoFolders(runtime), {
    messageKey: "commandDeleteEmptyTodosUnavailable",
    substitutions: [],
  });
});

test("maps an invalid ping reply to the unavailable message without deleting", async () => {
  const { runtime, calls } = setup({ pingReply: { ok: false } });

  assert.deepEqual(await deleteEmptyTodoFolders(runtime), {
    messageKey: "commandDeleteEmptyTodosUnavailable",
    substitutions: [],
  });
  assert.equal(calls.length, 1);
});

test("maps an empty deletion result", async () => {
  const { runtime } = setup();

  assert.deepEqual(await deleteEmptyTodoFolders(runtime), {
    messageKey: "commandDeleteEmptyTodosNone",
    substitutions: [],
  });
});

test("maps a non-empty deletion result with its count", async () => {
  const { runtime } = setup({ deleteReply: { ok: true, deleted: ["1", "3", "8"] } });

  assert.deepEqual(await deleteEmptyTodoFolders(runtime), {
    messageKey: "commandDeleteEmptyTodosDeleted",
    substitutions: ["3"],
  });
});

test("maps a receiver error", async () => {
  const { runtime } = setup({ deleteReply: { ok: false, error: "Sync is still running" } });

  assert.deepEqual(await deleteEmptyTodoFolders(runtime), {
    messageKey: "commandDeleteEmptyTodosError",
    substitutions: ["Sync is still running"],
  });
});

test("maps a rejected deletion call", async () => {
  const { runtime } = setup({ deleteError: new Error("Receiving end does not exist.") });

  assert.deepEqual(await deleteEmptyTodoFolders(runtime), {
    messageKey: "commandDeleteEmptyTodosError",
    substitutions: ["Receiving end does not exist."],
  });
});
