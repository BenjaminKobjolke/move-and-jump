// Links in a message body, for the /links popup command. DOM-free so it can be
// unit-tested; popup/search.js reads HTML anchors itself (DOMParser) and hands
// plain-text parts to extractUrls().

// Stops at whitespace and at the characters that usually wrap a URL in text.
const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
// Sentence punctuation right after a URL is almost never part of it.
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

/**
 * Every http(s) URL in a plain-text body, in order of appearance.
 * @param {string} text
 * @returns {string[]}
 */
export function extractUrls(text) {
  return (String(text).match(URL_PATTERN) ?? []).map((url) =>
    url.replace(TRAILING_PUNCTUATION, ""),
  );
}

/**
 * Keep http(s) links only, first occurrence of each url wins — so an anchor
 * with real text beats the same url found again as bare text later.
 * @param {Array<{text: string, url: string}>} links
 */
export function dedupeLinks(links) {
  const seen = new Set();
  return links.filter(({ url }) => {
    if (!/^https?:\/\//i.test(url) || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}
