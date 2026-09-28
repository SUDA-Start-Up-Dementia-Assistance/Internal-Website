import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDashboard } from './_lib/dashboard.js'
import { getProjectConfig } from './_lib/env.js'
import { sendError, sendJson, withErrors } from './_lib/http.js'
import { getValidAuth } from './_lib/session.js'

/** GET /api/dashboard → DashboardResponse (see api/_lib/dashboard.ts). Signed-in only. */
export default withErrors(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET')
    return sendError(res, 405, 'method-not-allowed', 'Use GET for this endpoint.')
  }
  return dashboard(req, res)
})

async function dashboard(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { token, user } = await getValidAuth(req, res)
  const { org } = getProjectConfig()
  sendJson(res, 200, await getDashboard({ token, user, org, now: new Date() }))
}
