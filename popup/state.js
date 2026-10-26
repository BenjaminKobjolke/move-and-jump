// Owns popup elements, URL parameters, and mutable state shared by popup modules.
export const heading = document.getElementById("heading");
export const input = document.getElementById("query");
export const list = document.getElementById("results");
export const empty = document.getElementById("empty");
export const error = document.getElementById("error");
export const moveButton = document.getElementById("moveButton");
export const jumpButton = document.getElementById("jumpButton");
export const cancelButton = document.getElementById("cancelButton");

// The background passes these values in the URL so the popup can use them before its first paint.
export const params = new URLSearchParams(window.location.search);

export const state = {
  // A reset message re-points these at the new mode/tab without recreating the window.
  mode: params.get("mode") === "jump" ? "jump" : "move",
  // This is the mail tab id; currentWindow would resolve to this popup window.
  tabId: params.has("tabId") ? Number(params.get("tabId")) : undefined,
  options: undefined,
  // Raw inputs let /all recompute scope without querying Thunderbird again.
  rawFolders: [],
  // Unified folders span accounts and need their own query.
  unifiedFolders: [],
  accountsList: [],
  activeTab: undefined,
  recentIds: [],
  allFolders: [],
  recentFolders: [],
  senderIds: [],
  folderWeights: {},
  queryWeights: {},
  // Entries are folders, commands, columns, accounts, links, or identities.
  visible: [],
  // Last columns reported by the experiment; empty when unavailable.
  columnState: [],
  // Links in the displayed message, populated by loadDisplayed().
  linkState: [],
  // Compose identities are loaded once each time the popup opens.
  identityState: { currentId: undefined, identities: [] },
  hasDisplayedMessage: false,
  activeIndex: 0,
  // The last query sent to the mail tab's quick filter.
  lastFilterQuery: "",
  showAccountPrefix: false,
  placement: "center",
  // Prevent our deliberate minimize from triggering the blur handler again.
  hiding: false,
};
