const MODIFIED_BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+,";

/**
 * Decode an IMAP "modified UTF-7" (RFC 3501) mailbox name into a plain
 * Unicode string. Thunderbird's folders API returns the raw IMAP
 * mailbox name for IMAP accounts, which for any folder containing
 * non-ASCII characters is still modified-UTF-7-encoded (e.g.
 * "M&APw-nchen" for "München") rather than already decoded — this
 * undoes that so folder names display and search correctly.
 *
 * Modified UTF-7 differs from standard UTF-7 in two ways: it uses `&`
 * instead of `+` as the shift character (so `&-` is a literal `&`),
 * and its base64 alphabet uses `,` instead of `/`, with no padding.
 *
 * @param {string} name
 * @returns {string}
 */
export function decodeImapUtf7(name) {
  if (!name.includes("&")) return name;

  let result = "";
  let i = 0;
  while (i < name.length) {
    const char = name[i];
    if (char !== "&") {
      result += char;
      i++;
      continue;
    }

    if (name[i + 1] === "-") {
      result += "&";
      i += 2;
      continue;
    }

    let j = i + 1;
    while (j < name.length && MODIFIED_BASE64_ALPHABET.includes(name[j])) {
      j++;
    }
    result += decodeModifiedBase64(name.slice(i + 1, j));
    i = name[j] === "-" ? j + 1 : j;
  }
  return result;
}

function decodeModifiedBase64(encoded) {
  const standard = encoded.replace(/,/g, "/");
  const padded = standard + "=".repeat((4 - (standard.length % 4)) % 4);
  const binary = atob(padded);

  let text = "";
  for (let i = 0; i + 1 < binary.length; i += 2) {
    text += String.fromCharCode((binary.charCodeAt(i) << 8) | binary.charCodeAt(i + 1));
  }
  return text;
}
