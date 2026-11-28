/**
 * Maximum length (in characters) of the folder path shown on the
 * toolbar button. Thunderbird's unified toolbar truncates long button
 * labels at the end, which would cut off the most informative part of
 * a path — the folder's own name — so the path is shortened here
 * first, from the middle.
 */
export const TOOLBAR_PATH_MAX_LENGTH = 40;

const ELLIPSIS = "…";

/**
 * Shorten a string to at most maxLength characters by replacing its
 * middle with an ellipsis, keeping slightly more of the end than of
 * the start. Counts code points, so surrogate pairs are never split.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function elideMiddle(text, maxLength) {
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;
  if (maxLength <= 1) return ELLIPSIS.slice(0, maxLength);
  const keep = maxLength - 1;
  const head = Math.floor(keep / 2);
  const tail = keep - head;
  return chars.slice(0, head).join("") + ELLIPSIS + chars.slice(chars.length - tail).join("");
}

/**
 * Shorten a folder path ("/a/b/c/d") for display by dropping whole
 * segments from the middle, keeping the top-level segment and as many
 * trailing segments as fit: "a/…/c/d". If even "a/…/d" is too long,
 * falls back to "…/c/d" (again keeping as much of the end as fits), and if the last segment alone is too long, it
 * is shortened in its own middle. The leading slash is dropped.
 * @param {string} path
 * @param {number} [maxLength]
 * @returns {string}
 */
export function elidePath(path, maxLength = TOOLBAR_PATH_MAX_LENGTH) {
  const trimmed = path.replace(/^\/+/, "");
  const length = (s) => Array.from(s).length;
  if (length(trimmed) <= maxLength) return trimmed;

  const segments = trimmed.split("/");
  const last = segments[segments.length - 1];
  if (segments.length === 1 || length(`${ELLIPSIS}/${last}`) > maxLength) {
    return elideMiddle(last, maxLength);
  }

  // Greedily keep as many trailing segments (never the first one) as
  // fit after the given prefix; the last segment always fits here.
  const keepTail = (prefix) => {
    let tail = last;
    for (let i = segments.length - 2; i > 0; i--) {
      const candidate = `${segments[i]}/${tail}`;
      if (length(prefix + candidate) > maxLength) break;
      tail = candidate;
    }
    return prefix + tail;
  };

  const withFirst = `${segments[0]}/${ELLIPSIS}/`;
  if (segments.length > 2 && length(withFirst + last) <= maxLength) {
    return keepTail(withFirst);
  }
  return keepTail(`${ELLIPSIS}/`);
}
