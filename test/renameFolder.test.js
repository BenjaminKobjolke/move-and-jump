import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRenameFolder, migrateFolderIds, renamableFolder } from "../lib/renameFolder.js";

const OLD = "account1://Work";
const NEW = "account1://Job";

function setup({ stored = {}, renamed = { id: NEW }, renameError } = {}) {
  const calls = [];
  const writes = [];
  const shown = [];
  const messenger = {
    folders: {
      async rename(folderId, name) {
        calls.push([folderId, name]);
        if (renameError) throw renameError;
        return renamed;
      },
    },
    mailTabs: {
      async update(tabId, properties) {
        shown.push([tabId, properties]);
      },
    },
    storage: {
      local: {
        async get() {
          return stored;
        },
        async set(values) {
          writes.push(values);
        },
      },
    },
  };
  return { messenger, calls, writes, shown };
}

test("handleRenameFolder keeps the tab on the renamed folder", async () => {
  const { messenger, shown } = setup();

  await handleRenameFolder(messenger, { folderId: OLD, name: "Job", tabId: 7 });

  assert.deepEqual(shown, [[7, { displayedFolderId: NEW }]]);
});

test("handleRenameFolder does not touch a tab when the rename fails or no tab is given", async () => {
  const failed = setup({ renameError: new Error("nope") });
  await handleRenameFolder(failed.messenger, { folderId: OLD, name: "Job", tabId: 7 });
  const tabless = setup();
  await handleRenameFolder(tabless.messenger, { folderId: OLD, name: "Job" });

  assert.deepEqual(failed.shown, []);
  assert.deepEqual(tabless.shown, []);
});

test("migrateFolderIds rewrites the folder and its subfolders in every store", () => {
  const migrated = migrateFolderIds(
    {
      recentFolders: [OLD, "account1://Inbox", `${OLD}/Sub`],
      folderWeights: { [OLD]: 3, "account1://Inbox": 1 },
      queryWeights: { wo: { [`${OLD}/Sub`]: 2 } },
      lastUsedFolderId: OLD,
      senderFolders: { "a@example.com": [OLD] },
    },
    OLD,
    NEW,
  );

  assert.deepEqual(migrated, {
    recentFolders: [NEW, "account1://Inbox", `${NEW}/Sub`],
    folderWeights: { [NEW]: 3, "account1://Inbox": 1 },
    queryWeights: { wo: { [`${NEW}/Sub`]: 2 } },
    lastUsedFolderId: NEW,
    senderFolders: { "a@example.com": [NEW] },
  });
});

test("migrateFolderIds leaves a sibling that only shares the name prefix", () => {
  const sibling = "account1://Workshop";
  const migrated = migrateFolderIds(
    { recentFolders: [sibling], folderWeights: { [sibling]: 1 }, lastUsedFolderId: sibling },
    OLD,
    NEW,
  );

  assert.deepEqual(migrated.recentFolders, [sibling]);
  assert.deepEqual(migrated.folderWeights, { [sibling]: 1 });
  assert.equal(migrated.lastUsedFolderId, sibling);
});

test("migrateFolderIds merges ids that collide after the rename", () => {
  const migrated = migrateFolderIds(
    { recentFolders: [NEW, OLD], folderWeights: { [NEW]: 1, [OLD]: 2 } },
    OLD,
    NEW,
  );

  assert.deepEqual(migrated.recentFolders, [NEW]);
  assert.deepEqual(migrated.folderWeights, { [NEW]: 3 });
});

test("migrateFolderIds tolerates empty storage", () => {
  assert.deepEqual(migrateFolderIds({}, OLD, NEW), {
    recentFolders: [],
    folderWeights: {},
    queryWeights: {},
    senderFolders: {},
  });
});

test("handleRenameFolder renames, stores the migrated ids and reports the last-used id", async () => {
  const { messenger, calls, writes } = setup({ stored: { lastUsedFolderId: OLD, recentFolders: [OLD] } });

  const result = await handleRenameFolder(messenger, { folderId: OLD, name: "Job" });

  assert.deepEqual(calls, [[OLD, "Job"]]);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].recentFolders, [NEW]);
  assert.deepEqual(result, { ok: true, lastUsedFolderId: NEW });
});

test("handleRenameFolder reports a rejected rename and writes nothing", async () => {
  const { messenger, writes } = setup({ renameError: new Error("special folder") });

  const result = await handleRenameFolder(messenger, { folderId: OLD, name: "Job" });

  assert.deepEqual(result, { ok: false, error: "special folder" });
  assert.deepEqual(writes, []);
});

test("handleRenameFolder rejects a malformed message without calling Thunderbird", async () => {
  const { messenger, calls } = setup();

  for (const message of [{ folderId: OLD, name: "  " }, { folderId: "", name: "Job" }, { name: "Job" }]) {
    assert.equal((await handleRenameFolder(messenger, message)).ok, false);
  }
  assert.deepEqual(calls, []);
});

test("renamableFolder gives the displayed folder's id and decoded name", () => {
  assert.deepEqual(
    renamableFolder({ displayedFolder: { id: "account1://M&APw-nchen", name: "M&APw-nchen" } }),
    { id: "account1://M&APw-nchen", name: "München" },
  );
});

test("renamableFolder is null without a displayed folder or for a unified folder", () => {
  assert.equal(renamableFolder(undefined), null);
  assert.equal(renamableFolder({}), null);
  assert.equal(renamableFolder({ displayedFolder: { id: "unified://inbox", name: "Inbox", isUnified: true } }), null);
});
