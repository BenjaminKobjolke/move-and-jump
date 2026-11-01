// DOM-free helpers for the /open-attachments command.

export const ATTACHMENT_ACTION = Object.freeze({ NONE: "none", OPEN: "open", LIST: "list" });

/** @param {number} count @returns {"none"|"open"|"list"} */
export function attachmentAction(count) {
  if (count === 0) return ATTACHMENT_ACTION.NONE;
  if (count === 1) return ATTACHMENT_ACTION.OPEN;
  return ATTACHMENT_ACTION.LIST;
}

/** @param {unknown} bytes @returns {string} */
export function formatSize(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  for (const unit of units) {
    if (size < 1024 || unit === "GB") {
      const rounded = unit === "KB" ? Math.round(size) : Math.round(size * 10) / 10;
      return `${rounded} ${unit}`;
    }
    size /= 1024;
  }
  return "";
}

/**
 * @param {{ name: string }[]} attachments
 * @param {string} query
 */
export function filterAttachments(attachments, query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return attachments;

  return attachments.filter(({ name }) => {
    const searchable = name.toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}
