import { TASKS_MOCK } from '../../config/tasks'
import { saveTaskEdit, TasksError, type TaskPatch } from '../../lib/tasks'
import { showToast } from '../../lib/toast'

export const SAVED_MESSAGE = TASKS_MOCK ? 'Saved (mock data, not GitHub)' : 'Saved to GitHub'

/** "Priority, Estimate" → "Priority and Estimate". */
export function listNames(names: string[]): string {
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Saves an inline edit (optimistically) and reports the outcome in a toast: a quiet
 * "Saved to GitHub", or what didn't save and why. `what` names the change, e.g. "the status".
 */
export async function saveWithToast(itemId: string, patch: TaskPatch, what: string): Promise<void> {
  try {
    const failed = await saveTaskEdit(itemId, patch)
    if (failed.length > 0) {
      showToast('error', `Saved, but GitHub didn't accept ${listNames(failed)}. Try that again.`)
    } else {
      showToast('success', SAVED_MESSAGE)
    }
  } catch (err) {
    const reason = err instanceof TasksError ? err.message : 'Something went wrong.'
    showToast('error', `Couldn't save ${what}: ${reason}`)
  }
}
