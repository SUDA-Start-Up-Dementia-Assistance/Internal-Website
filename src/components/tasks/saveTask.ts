import { saveTaskPatch, TasksError, type TaskPatch } from '../../lib/tasks'
import { isSampleMode } from '../../lib/sampleMode'
import { showToast } from '../../lib/toast'

export const savedMessage = () =>
  isSampleMode() ? 'Saved (sample data, not GitHub)' : 'Saved to GitHub'

/** "Priority, Estimate" → "Priority and Estimate". */
export function listNames(names: string[]): string {
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Saves an inline edit (optimistically, when the task is in the tasks cache) and reports the
 * outcome in a toast: a quiet "Saved to GitHub", or what didn't save and why. `what` names the
 * change, e.g. "the status". Resolves true only if every change was accepted.
 */
export async function saveWithToast(
  itemId: string,
  patch: TaskPatch,
  what: string,
): Promise<boolean> {
  try {
    const failed = await saveTaskPatch(itemId, patch)
    if (failed.length > 0) {
      showToast('error', `Saved, but GitHub didn't accept ${listNames(failed)}. Try that again.`)
      return false
    }
    showToast('success', savedMessage())
    return true
  } catch (err) {
    const reason = err instanceof TasksError ? err.message : 'Something went wrong.'
    showToast('error', `Couldn't save ${what}: ${reason}`)
    return false
  }
}
