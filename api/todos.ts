import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireSameOrigin, sendError, sendJson, withErrors } from './_lib/http.js'
import { getValidAuth } from './_lib/session.js'
import {
  createTodo,
  deleteTodo,
  listTodos,
  parseTodoId,
  teamLogins,
  TodoConflictError,
  TodoNotFoundError,
  updateTodo,
} from './_lib/todos.js'

/**
 * /api/todos and /api/todos/:id (vercel.json rewrites the latter to ?id=:id). One function for every team to-do operation (Vercel Hobby
 * allows only 12). Signed-in only; writes must come from the site itself. To-dos live in the
 * private Blob store and never touch GitHub, except for checking an assignee is on the team.
 *
 *   GET    /api/todos       → { todos }
 *   POST   /api/todos       → 201 { todo }
 *   PATCH  /api/todos/:id   → { todo }       body: { version, ...changed fields }
 *   DELETE /api/todos/:id   → { ok: true }   ?version=N (or { version } in the body)
 */
export default withErrors(async (req, res) => {
  const id = routeId(req)
  if (id === undefined) {
    if (req.method === 'GET' || req.method === 'HEAD') return getTodos(req, res)
    if (req.method === 'POST') return postTodo(req, res)
    res.setHeader('Allow', 'GET, POST')
    return sendError(res, 405, 'method-not-allowed', 'Use GET or POST for this endpoint.')
  }
  if (req.method === 'PATCH') return patchTodo(req, res, id)
  if (req.method === 'DELETE') return removeTodo(req, res, id)
  res.setHeader('Allow', 'PATCH, DELETE')
  return sendError(res, 405, 'method-not-allowed', 'Use PATCH or DELETE for this endpoint.')
})

/** The ":id" segment, if any: the rewrite's ?id=, falling back to the URL path. */
function routeId(req: VercelRequest): string | undefined {
  const param = req.query.id
  const segments = Array.isArray(param) ? param : param ? [param] : pathSegments(req.url)
  if (segments.length === 0) return undefined
  if (segments.length > 1) return '' // Never a valid id: parseTodoId answers 400.
  return segments[0]
}

function pathSegments(url: string | undefined): string[] {
  const path = (url ?? '').split('?')[0]
  const rest = path.replace(/^\/api\/todos\/?/, '')
  return rest ? rest.split('/').filter(Boolean).map(decodeURIComponent) : []
}

/** Conflicts and missing items become 409/404; everything else goes to withErrors. */
async function guarded(res: VercelResponse, work: () => Promise<void>): Promise<void> {
  try {
    await work()
  } catch (err) {
    if (err instanceof TodoConflictError) return sendError(res, 409, 'conflict', err.message)
    if (err instanceof TodoNotFoundError) return sendError(res, 404, 'not-found', err.message)
    throw err
  }
}

async function getTodos(req: VercelRequest, res: VercelResponse): Promise<void> {
  await getValidAuth(req, res)
  sendJson(res, 200, { todos: await listTodos() })
}

async function postTodo(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireSameOrigin(req, res)) return
  const { token, user } = await getValidAuth(req, res)
  const todo = await createTodo(req.body, user, () => teamLogins(token))
  sendJson(res, 201, { todo })
}

async function patchTodo(req: VercelRequest, res: VercelResponse, rawId: string): Promise<void> {
  if (!requireSameOrigin(req, res)) return
  const { token, user } = await getValidAuth(req, res)
  const id = parseTodoId(rawId)
  await guarded(res, async () => {
    const todo = await updateTodo(id, req.body, user, () => teamLogins(token))
    sendJson(res, 200, { todo })
  })
}

async function removeTodo(req: VercelRequest, res: VercelResponse, rawId: string): Promise<void> {
  if (!requireSameOrigin(req, res)) return
  await getValidAuth(req, res)
  const id = parseTodoId(rawId)
  const body = req.body as { version?: unknown } | undefined
  const version = req.query.version ?? body?.version
  await guarded(res, async () => {
    await deleteTodo(id, Array.isArray(version) ? version[0] : version)
    sendJson(res, 200, { ok: true })
  })
}
