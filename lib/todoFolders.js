export const MANAGE_TODO_FOLDERS_ID = "manage-todo-folders@kobjolke.de";

export const TODO_FOLDER_MESSAGES = Object.freeze({
  PING: "ping",
  DELETE_EMPTY: "delete-empty-todo-folders",
});

/**
 * Ask Manage ToDo Folders to permanently remove empty numbered todo folders.
 * @param {{ sendMessage: (extensionId: string, message: object) => Promise<unknown> }} runtime
 * @returns {Promise<{ messageKey: string, substitutions: string[] }>}
 */
export async function deleteEmptyTodoFolders(runtime) {
  try {
    const ping = await runtime.sendMessage(MANAGE_TODO_FOLDERS_ID, {
      type: TODO_FOLDER_MESSAGES.PING,
    });
    if (ping?.ok !== true) return unavailableResult();
  } catch {
    return unavailableResult();
  }

  try {
    const result = await runtime.sendMessage(MANAGE_TODO_FOLDERS_ID, {
      type: TODO_FOLDER_MESSAGES.DELETE_EMPTY,
    });
    if (result?.ok === true && Array.isArray(result.deleted) && result.deleted.every((name) => typeof name === "string")) {
      return result.deleted.length === 0
        ? { messageKey: "commandDeleteEmptyTodosNone", substitutions: [] }
        : {
            messageKey: "commandDeleteEmptyTodosDeleted",
            substitutions: [String(result.deleted.length)],
          };
    }
    if (result?.ok === false && typeof result.error === "string") {
      return {
        messageKey: "commandDeleteEmptyTodosError",
        substitutions: [result.error],
      };
    }
    return { messageKey: "commandDeleteEmptyTodosError", substitutions: [""] };
  } catch (error) {
    return {
      messageKey: "commandDeleteEmptyTodosError",
      substitutions: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function unavailableResult() {
  return { messageKey: "commandDeleteEmptyTodosUnavailable", substitutions: [] };
}
