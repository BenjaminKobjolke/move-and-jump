import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

// Regression test for the failure that broke the add-on outright: reading
// `messenger.keys` at module scope when the experiment namespace failed to
// register. That access *throws* rather than yielding undefined, and both
// background.js and options/options.js read it before doing anything else — so
// one broken optional extra took down every command, the toolbar button, and
// the whole options page. See ARCHITECTURE.md, "Never let the Experiment take
// the add-on down with it".
//
// These load the real modules against a hostile `messenger` and assert only
// that they survive; behaviour is covered by the other test files.

const ROOT = path.resolve(import.meta.dirname, "..");

const noopEvent = () => ({ addListener() {}, removeListener() {} });

/**
 * @param {"present"|"absent"|"throwing"} keys how messenger.keys behaves
 */
function installMessengerStub(keys) {
  const messenger = {
    storage: {
      local: { get: async () => ({}), set: async () => {} },
      onChanged: noopEvent(),
    },
    windows: {
      onRemoved: noopEvent(),
      getAll: async () => [],
      create: async () => ({ id: 1 }),
      update: async () => {},
      getCurrent: async () => ({ left: 0, top: 0, width: 100, height: 100 }),
    },
    commands: {
      onCommand: noopEvent(),
      getAll: async () => [{ name: "move-search", description: "Move", shortcut: "Ctrl+Shift+N" }],
      reset: async () => {},
      update: async () => {},
    },
    action: { onClicked: noopEvent(), setTitle: async () => {} },
    runtime: {
      onMessage: noopEvent(),
      onInstalled: noopEvent(),
      sendMessage: async () => {},
      getPlatformInfo: async () => ({ os: "win" }),
    },
    mailTabs: { query: async () => [] },
    folders: { query: async () => [] },
    messages: { move: async () => {} },
    i18n: { getMessage: (key) => key },
  };

  if (keys === "present") {
    messenger.keys = { register: async () => [], check: async () => ({}), onCommand: noopEvent() };
  } else if (keys === "throwing") {
    Object.defineProperty(messenger, "keys", {
      get() {
        throw new Error("experiment namespace unavailable");
      },
    });
  }

  globalThis.messenger = messenger;
}

/** The handful of DOM calls options.js makes at module scope. */
function installDomStub() {
  const element = () => ({
    tagName: "DIV",
    children: [],
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    textContent: "",
    value: "",
    checked: false,
    set innerHTML(_) {
      this.children.length = 0;
    },
    get innerHTML() {
      return "";
    },
    append(...nodes) {
      this.children.push(...nodes);
    },
    appendChild(node) {
      this.children.push(node);
      return node;
    },
    addEventListener() {},
  });

  const byId = new Map();
  globalThis.document = {
    getElementById(id) {
      if (!byId.has(id)) byId.set(id, element());
      return byId.get(id);
    },
    createElement: element,
    addEventListener() {},
    removeEventListener() {},
  };
}

/** Import with a cache-busting query, so each case gets a fresh evaluation. */
function load(relativePath, tag) {
  const url = pathToFileURL(path.join(ROOT, relativePath));
  url.search = `?guards=${tag}`;
  return import(url.href);
}

for (const keys of ["present", "absent", "throwing"]) {
  test(`background.js loads when the keys experiment is ${keys}`, async () => {
    installMessengerStub(keys);
    await assert.doesNotReject(() => load("background.js", `bg-${keys}`));
  });

  test(`options.js loads when the keys experiment is ${keys}`, async () => {
    installMessengerStub(keys);
    installDomStub();
    await assert.doesNotReject(() => load("options/options.js", `opt-${keys}`));
  });
}
