# Sender suggestions

Mail from the same sender often belongs in the same folder. **Suggest and
preselect the folders last used for the sender** remembers the destinations of
your recent moves and puts them first the next time you move a message from
that sender.

## Using it

Open **Add-ons Manager → Move and Jump → Options** and use **Suggest and
preselect the folders last used for the sender**:

- Default **on**.
- In move mode, when the selected messages all have the same sender, the
  folders most recently used for that sender appear first and carry a sender
  tag. The most recent folder is selected, so pressing Enter moves there.
- With a search query, matching sender folders are moved to the top while the
  remaining results keep their learned order.
- Jump mode and messages from different senders do not use sender suggestions.
- Turning the option off stops recording and showing suggestions. Existing
  sender history stays stored and is used again if the option is turned back on.

## How it works

- **Stored:** `senderFolders` in `messenger.storage.local` maps each
  lowercased sender email address to up to three folder ids, most recent first.
- **Recorded:** after a move succeeds, `performMove()` records the destination
  once for each distinct sender in the moved messages. Move-last uses the same
  path; jump never records sender history.
- **Shown:** the popup reads selected messages from its originating mail tab.
  It uses history only when they share one sender email. Missing folder ids are
  ignored.
- **Setting:** `senderSuggestions` is a boolean in the shared `options` object.
  Its default is in `DEFAULT_OPTIONS` (`lib/options.js`), so no storage
  migration is needed.

## Relevant files

- `lib/recent.js` — sender history limit and folder prioritization
- `background.js` — records destinations after successful moves
- `popup/search.js` / `popup/search.css` — suggestions, tags and ordering
- `options/options.html` / `options/options.js` — the checkbox
- `_locales/*/messages.json` — translated labels and tag text
