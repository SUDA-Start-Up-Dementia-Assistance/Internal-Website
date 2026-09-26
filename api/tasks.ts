import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getProjectMeta, listItems, listTeam, toClientMeta } from './_lib/github/project.js'
import type { TasksResponse } from './_lib/github/types.js'
import { requireSession, sendError, sendJson, withErrors } from './_lib/http.js'

/**
 * /api/tasks. One function for every task operation (Vercel Hobby allows only 12), switching
 * on the method. Every GitHub call uses the signed-in user's own token.
 */
export default withErrors(async (req, res) => {
  switch (req.method) {
    case 'GET':
    case 'HEAD':
      return getTasks(req, res)
    default:
      res.setHeader('Allow', 'GET')
      return sendError(res, 405, 'method-not-allowed', 'Use GET for this endpoint.')
  }
})

/** GET /api/tasks → { tasks, meta, team } */
async function getTasks(req: VercelRequest, res: VercelResponse): Promise<void> {
  const session = await requireSession(req, res)
  if (!session) return
  const [meta, tasks, team] = await Promise.all([
    getProjectMeta(session.token),
    listItems(session.token),
    listTeam(session.token),
  ])
  sendJson(res, 200, { tasks, meta: toClientMeta(meta), team } satisfies TasksResponse)
}
