// Splits a /filter query into quick-filter text and `tag:` terms. DOM-free so
// it can be unit-tested; popup/filter.js applies the result.

const TAG_PREFIX = "tag:";

/** Tag labels can hold spaces ("To Do"); terms can't, so both compare without them. */
export const normalizeTag = (label) => label.toLowerCase().replace(/\s+/g, "");

/**
 * @param {string} query the /filter argument
 * @param {Array<{key: string, tag: string}>} tags messenger.messages.tags.list()
 * @returns {{text: string, tagKeys: string[]}} unresolved tag terms are dropped,
 *   so a half-typed tag doesn't empty the list mid-word
 */
export function parseFilterQuery(query, tags) {
  const keyByName = new Map(tags.map(({ key, tag }) => [normalizeTag(tag), key]));
  const textTerms = [];
  const tagKeys = [];
  for (const term of query.split(/\s+/).filter(Boolean)) {
    if (!term.toLowerCase().startsWith(TAG_PREFIX)) {
      textTerms.push(term);
      continue;
    }
    const key = keyByName.get(normalizeTag(term.slice(TAG_PREFIX.length)));
    if (key !== undefined) tagKeys.push(key);
  }
  return { text: textTerms.join(" "), tagKeys };
}

/**
 * The normalized name typed after `tag:` in the input's last term, or null when
 * no tag term is being typed (a trailing space means the term is finished).
 * @param {string} raw full input value
 */
export function partialTag(raw) {
  if (/\s$/.test(raw)) return null;
  const last = raw.split(/\s+/).pop() ?? "";
  return last.toLowerCase().startsWith(TAG_PREFIX)
    ? normalizeTag(last.slice(TAG_PREFIX.length))
    : null;
}

/** Replace the input's last term with the picked tag, ready for the next term. */
export function completeTag(raw, label) {
  return raw.replace(/\S*$/, `${TAG_PREFIX}${normalizeTag(label)} `);
}
