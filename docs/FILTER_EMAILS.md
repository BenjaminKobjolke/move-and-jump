# Filtering emails (`/filter`)

The popup finds **folders**. `/filter` is the exception: it narrows the
**message list** of the folder already displayed in the mail tab, in place —
the popup shows no message results of its own.

## Using it

```
/filter tom
/filter inn lehrich@theim
/filter                     ← no query: clears the filter
```

- The list behind the popup narrows **as you type** — every keystroke re-applies
  the filter.
- The popup **gets out of the way**: as soon as the input is in filter mode it
  strips down to just the input and the field-hint row — heading, buttons and
  the command row hidden, narrower window — and moves to the **bottom-right corner of the
  Thunderbird window**, so the message list stays visible while you type.
  Clearing the input (or leaving filter mode any other way) puts it back in the
  middle at full height. Needs *Center on parent window* — with that option off,
  the popup only resizes and stays where it is.
- **Enter** on the `/filter` row hides the popup so you can work with the
  filtered list. The filter stays applied.
- **Enter with no query yet** (`/fil`, `/filter`) does *not* hide the popup: it
  clears any active filter and completes the input to `/filter `, ready for the
  query. **Tab** completes the same way without clearing.
- **Escape** also leaves the filter applied. To drop it, run `/filter` with no
  query, or use Thunderbird's own Quick Filter bar (Ctrl+Shift+K).
- Clearing the filter also **hides the Quick Filter bar** again, so it stops
  taking up a row of the mail tab. While a query is active the bar stays
  visible — that's what tells you a filter is on.

While a `/filter` query is in the input, a second, non-selectable row shows which
fields are searched and how to change them:

```
Filter messages: automatisch
Sender + subject — Ctrl+B body: OFF, Ctrl+R recipients: OFF
```

## A shortcut straight into filter mode

`/filter` works in any popup — including one opened with the move or jump
shortcut; just type it. If you filter often, the options page also has a
`filter-search` command that opens the popup with `/filter ` already typed.

It ships with **no key assigned**: open **Add-ons Manager → Move and Jump →
Options**, find *Filter the displayed message list* in the shortcut table, and
click **Record** (see [KEYBOARD_SHORTCUTS.md](settings/KEYBOARD_SHORTCUTS.md)).
Clearing the input in that popup returns you to the normal folder search.

## What it matches

Whitespace-separated terms are **ANDed**; each term matches as a
case-insensitive **substring** of any enabled field. Sender and subject are
always enabled:

| Field           | Enabled by            |
| --------------- | --------------------- |
| Sender (From)   | always                |
| Subject         | always                |
| Recipients (To/Cc) | `/recipients` toggle |
| Message body    | `/body` toggle        |

The sender field is the full `From` header, display name included — so `tom`
matches `Thomas Lehrich <t.lehrich@theim.de>`.

Worked example — `inn lehrich@theim` keeps a message from
`Thomas Lehrich <t.lehrich@theim.de>` with subject
`S63-250476: InnoTrans 2026 …`: `inn` matches the subject, `lehrich@theim`
matches the sender. Different terms may match different fields.

There is no date field. A date only matches when it appears literally in one of
the fields above (e.g. `19.08.2026` written in the subject).

[`/fuzzy`](settings/FUZZY_SEARCH.md) and `/sensitive` apply to **folder** search only; the message filter is
always case-insensitive substring matching.

## Toggles

Two ways to flip the optional fields — both do exactly the same thing:

| How                      | When                                              |
| ------------------------ | ------------------------------------------------- |
| **Ctrl+B** / **Ctrl+R**  | While typing a `/filter` query — the query stays in the input |
| `/body` / `/recipients`  | Any time — ON/OFF command rows like `/fuzzy`      |

Ctrl+B and Ctrl+R are the ones to reach for mid-search: your query matches
nothing, you widen the fields, and the list re-filters without retyping. They
only act in filter mode, so they do nothing during a folder search.

The `/body` and `/recipients` rows show the current state and flip it on Enter,
then clear the input like every other command.

Either way the setting persists in the shared `options` object in
`messenger.storage.local`, and the last `/filter` query is immediately
re-applied with the new field set, so the effect is visible at once. They have
no options-page checkbox: these are the only UI.

## How it works

`applyFilter(query)` in `popup/search.js` calls

```js
messenger.mailTabs.setQuickFilter(tabId, { text: { text, author, subject, recipients, body } })
```

which is Thunderbird's **own Quick Filter** — the same engine as the bar, so the
bar visibly reflects what the popup applied and can clear it. All matching
semantics above come from Thunderbird, not from this add-on; `lib/match.js` is
not involved. A `null` `text` clears the filter, and that call also passes
`show: false` to close the bar; `show` is never passed while a query is active,
leaving the bar to Thunderbird.

`tabId` is the mail tab the popup was opened for (passed on its URL, see
[SEARCH_POPUP.md](SEARCH_POPUP.md)). Rejections are swallowed: the tab can
close while the popup is open.

## Relevant files

- `background.js` — `resizeSearchWindow(height, zoom, place)`; `place: "corner"`
  drops the minimum-height floor, narrows to `SEARCH_WINDOW_CORNER_WIDTH`, and
  parks the window in the parent window's bottom-right corner (also
  used by `/columns`, see [COMMANDS.md](COMMANDS.md#toggling-columns))
- `popup/search.css` — `body.filtering` hides the heading, the action buttons
  and every row but `li.filter-hint`
- `manifest.json` / `background.js` — the `filter-search` command; it calls
  `openSearchWindow(mode, tabId, "/filter ")`, which passes the text on as the
  popup's `prefill` URL parameter (or in the `reset` message when the window is
  reused)
- `popup/search.js` — `initialPrefill`, `applyFilter`, `toggleFilterField`, `isFilterMode`,
  `updatePlacement`/`requestResize` (the corner move), the
  `filter`/`body`/`recipients` cases in `commandEntry` and `activate`, the field
  hint row in `renderCommands`, and the live-filter + Ctrl+B/Ctrl+R hooks in the
  `input`/`keydown` listeners
- `lib/commands.js` — `filter` (takes an argument), `body`, `recipients`
- `lib/options.js` — `filterBody`, `filterRecipients` defaults
- `_locales/en/messages.json` — `commandFilterSet`, `commandFilterClear`,
  `commandToggleBody`, `commandToggleRecipients`, `commandFilterFields`
