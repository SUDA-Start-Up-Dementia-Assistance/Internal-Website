import type { VercelRequest, VercelResponse } from '@vercel/node'
import { patchTask } from '../_lib/github/mutations.js'
import { getProjectMeta } from '../_lib/github/project.js'
import type { WriteResult } from '../_lib/github/types.js'
import { requireSameOrigin, sendError, sendJson, withErrors } from '../_lib/http.js'
import { getValidToken } from '../_lib/session.js'
import { parseItemId, parsePatchTask } from '../_lib/taskInput.js'

/** /api/tasks/:itemId. PATCH only: a partial update with the signed-in user's token. */
export default withErrors(async (req, res) => {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return sendError(res, 405, 'method-not-allowed', 'Use PATCH for this endpoint.')
  }
  return patch(req, res)
})

/** PATCH /api/tasks/:itemId → 200 { task, failedFields } */
async function patch(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireSameOrigin(req, res)) return
  const token = await getValidToken(req, res)
  const itemId = parseItemId(req.query.itemId)
  const meta = await getProjectMeta(token)
  const input = parsePatchTask(req.body, meta)
  const result = await patchTask(token, meta, itemId, input)
  if (!result) return sendError(res, 404, 'not-found', 'That task is no longer in the project.')
  sendJson(res, 200, result satisfies WriteResult)
}
