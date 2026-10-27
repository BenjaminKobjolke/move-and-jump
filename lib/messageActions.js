/**
 * Create actions for the message currently shown in a Thunderbird tab.
 * @param {object} messenger Thunderbird's extension API.
 * @param {Function} getActiveTab Resolves the active mail tab.
 */
export function createMessageActions(messenger, getActiveTab) {
  /**
   * The message shown in `tabId` — the preview pane of a mail tab, or a message
   * opened in its own tab/window. Null (logged) when there isn't exactly one.
   */
  async function getDisplayedMessage(tabId) {
    const resolvedTabId = tabId ?? (await getActiveTab())?.id;
    // MV3 has no getDisplayedMessage (singular); getDisplayedMessages returns a
    // MessageList. Exactly one, or it's ambiguous which sender is meant.
    const { messages = [] } =
      resolvedTabId === undefined
        ? {}
        : await messenger.messageDisplay.getDisplayedMessages(resolvedTabId);
    const message = messages.length === 1 ? messages[0] : null;
    return message;
  }

  /** Copy the displayed message's sender name ("name") or address ("email"). */
  async function copySender(tabId, field) {
    const message = await getDisplayedMessage(tabId);
    if (!message) return;
    const [sender] = await messenger.messengerUtilities.parseMailboxString(message.author);
    if (!sender) return;
    // A sender with no display name still copies something useful.
    const text = field === "name" ? sender.name || sender.email : sender.email;
    // Background has no user gesture; the clipboardWrite permission covers that.
    await navigator.clipboard.writeText(text);
  }

  async function copySubject(tabId) {
    const message = await getDisplayedMessage(tabId);
    if (message) await navigator.clipboard.writeText(message.subject);
  }

  /** Save every attachment of the displayed message into the Downloads folder. */
  async function saveAttachments(tabId) {
    const message = await getDisplayedMessage(tabId);
    if (!message) return;
    const attachments = await messenger.messages.listAttachments(message.id);
    if (attachments.length === 0) return;
    // In parallel: reading a large attachment out of the message is the slow part.
    await Promise.all(
      attachments.map(async (attachment) => {
        const file = await messenger.messages.getAttachmentFile(message.id, attachment.partName);
        // ponytail: blob URLs are not revoked; the suspended event page frees them.
        // Revoke on downloads.onChanged if memory ever shows up.
        await messenger.downloads.download({
          url: URL.createObjectURL(file),
          // downloads.download() rejects path separators and reserved characters.
          filename: attachment.name.replace(/[\\/:*?"<>|]/g, "_"),
          conflictAction: "uniquify",
        });
      }),
    );
  }

  async function writeToSender(tabId) {
    const message = await getDisplayedMessage(tabId);
    if (message) await messenger.compose.beginNew({ to: [message.author] });
  }

  /** @param {"replyToSender"|"replyToAll"} replyType */
  async function replyTo(tabId, replyType) {
    const message = await getDisplayedMessage(tabId);
    if (message) await messenger.compose.beginReply(message.id, replyType);
  }

  /**
   * Go to the top of the message list (mail tab) or the compose body (compose
   * tab), via experiments/navigate. Accessed guarded, like keysApi below: a
   * failed experiment must not take the background down.
   */
  async function navigateTop(tabId) {
    const api = messenger.navigate;
    if (!api || !(await api.top(tabId ?? -1))) {
      throw new Error(`Move and Jump: navigate-top not available in tab ${tabId}`);
    }
  }

  /**
   * Popup slash commands, keyed by command name. Run here so keyboard commands
   * and the popup share the same action path.
   */
  const messageActions = {
    "copy-name": (tabId) => copySender(tabId, "name"),
    "copy-email": (tabId) => copySender(tabId, "email"),
    "copy-subject": copySubject,
    "save-attachments": saveAttachments,
    write: writeToSender,
    reply: (tabId) => replyTo(tabId, "replyToSender"),
    "reply-all": (tabId) => replyTo(tabId, "replyToAll"),
    "navigate-top": navigateTop,
  };

  return {
    copySender,
    copySubject,
    saveAttachments,
    writeToSender,
    navigateTop,
    messageActions,
  };
}
