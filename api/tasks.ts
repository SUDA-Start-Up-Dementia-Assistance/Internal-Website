import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createTask } from './_lib/github/mutations.js'
import { getProjectMeta, listItems, listTeam, toClientMeta } from './_lib/github/project.js'
import type { TasksResponse, WriteResult } from './_lib/github/types.js'
import { requireSameOrigin, sendError, sendJson, withErrors } from './_lib/http.js'
import { getValidToken } from './_lib/session.js'
import { parseCreateTask } from './_lib/taskInput.js'

/**
 * /api/tasks. One function for every task operation (Vercel Hobby allows only 12), switching
 * on the method. Every GitHub call uses the signed-in user's own token.
 */
export default withErrors(async (req, res) => {
  switch (req.method) {
    case 'GET':
    case 'HEAD':
      return getTasks(req, res)
    case 'POST':
      return postTask(req, res)
    default:
      res.setHeader('Allow', 'GET, POST')
      return sendError(res, 405, 'method-not-allowed', 'Use GET or POST for this endpoint.')
  }
})

/** GET /api/tasks → { tasks, hiddenCount, meta, team } */
async function getTasks(req: VercelRequest, res: VercelResponse): Promise<void> {
  const token = await getValidToken(req, res)
  const [meta, { tasks, hiddenCount }, team] = await Promise.all([
    getProjectMeta(token),
    listItems(token),
    listTeam(token),
  ])
  sendJson(res, 200, {
    tasks,
    hiddenCount,
    meta: toClientMeta(meta),
    team,
  } satisfies TasksResponse)
}

/** POST /api/tasks → 201 { task, failedFields }. Creates a draft issue, then sets its fields. */
async function postTask(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireSameOrigin(req, res)) return
  const token = await getValidToken(req, res)
  const meta = await getProjectMeta(token)
  const input = parseCreateTask(req.body, meta)
  const { task, failedFields } = await createTask(token, meta, input)
  sendJson(res, 201, { task, failedFields } satisfies WriteResult)
}
