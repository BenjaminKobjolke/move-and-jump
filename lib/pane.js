// Calculate and apply a message-list width through Thunderbird's pane experiment.

export const PANE_STEP = 10;
export const PANE_MIN = 10;
export const PANE_MAX = 90;

/** Return the requested message-list width, or null for an invalid request. */
export function nextListPercent(current, arg) {
  if (typeof arg !== "string" || !/^[+-]?\d+$/.test(arg)) return null;

  const relative = arg.startsWith("+") || arg.startsWith("-");
  if (relative && current === null) return null;

  const value = Number(arg);
  const next = relative ? current + value : value;
  return Math.min(PANE_MAX, Math.max(PANE_MIN, next));
}

/** Ask the pane experiment to set an absolute or relative message-list width. */
export async function resizePane(api, tabId, arg) {
  if (!api) return false;

  const current = await api.getListPercent(tabId);
  const next = nextListPercent(current, arg);
  if (next === null) return false;

  return api.setListPercent(tabId, next);
}
