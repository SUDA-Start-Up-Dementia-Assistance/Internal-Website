# D.A.W.N. Team Site

Internal website for our RIT SWEN 561/562 senior project team working on D.A.W.N.
(Daily Awareness & Well-being Navigator), a tablet-based morning orientation app for
people living with dementia, sponsored by Gerry Garavuso and in beta at St. Ann's Home.
Faculty coach: Drew Saur.

## Purpose
A lightweight hub for the team, sponsor, and coach: see upcoming/past meeting agendas,
browse project artifacts, and (team only) manage tasks and track sprint progress.
Agendas and artifacts live in Google Drive; the site only reads them. Tasks live in our
GitHub Project; the site reads and writes them through GitHub's API.

## Stack (do not add to this without asking)
- React 18+ with Vite, TypeScript (strict)
- Tailwind CSS v4 via @tailwindcss/vite, CSS-first config with @theme in src/index.css
- react-router-dom (BrowserRouter)
- lucide-react for icons
- Vercel serverless functions (Node.js runtime) in /api for everything that needs a secret
- jose (session cookie encryption), @vercel/blob (burndown snapshots)
- No state library. No UI component library. No chart library (charts are hand-built SVG).
- No database. GitHub Projects is the task store; Vercel Blob holds only daily snapshot totals.

## Public data: Google Drive (unchanged from Phase 1)
- Google Drive API v3, called from the browser with an API key.
- Content comes from *sources*, declared in src/config/sources.ts. Two source kinds:
  - "dated-feed": recurring files named "YYYY-MM-DD <Suffix>" in a working folder,
    pulled automatically. A feed is defined by { folderId, suffix }, and several feeds
    can share one folder. Current: agendas (suffix "Agenda") and fourUps (suffix
    "4Up"), both in the Agendas folder. Planned later: sprintArtifacts (do NOT build
    yet, but adding it must only require a new config entry).
  - "published-library": a curated folder whose subfolders are categories; the team
    manually uploads final artifacts into them. Current: publishedArtifacts. The
    Artifacts pages show only this library (agendas and 4Ups live on /agendas).
- Env vars (Vite): VITE_GOOGLE_API_KEY, VITE_AGENDAS_FOLDER_ID, VITE_PUBLISHED_FOLDER_ID
- If VITE_GOOGLE_API_KEY is missing, use mock data from src/lib/drive/mock.ts so the
  site runs locally without credentials. If one source's folder ID is missing, hide
  that source's UI rather than erroring.
- Fetch each folder once. Feeds that share a folder share the fetch and the cache.
- Filenames in the Agendas folder: exactly "YYYY-MM-DD Agenda" or "YYYY-MM-DD 4Up"
  (suffix match is case-insensitive, whitespace-tolerant). Files matching neither are
  ignored, with a console.warn in dev only. An Agenda and a 4Up with the same date
  form one "meeting".
- Published library: each subfolder is a category; files directly in the root folder are
  ignored. Subfolders and files both use an optional "NN " prefix for ordering (e.g.
  "02 Requirements", "01 Project Plan.pdf"): sort by the number, strip it for display.
  Unprefixed items sort after prefixed ones, by name.
- Every published artifact is a PDF, so artifact names are displayed without ".pdf".
  This applies only to artifacts: agendas and 4Ups are not PDFs and keep their names.

## Backend: /api (Vercel functions)
- Route files live in /api. Shared server code lives in /api/_lib (underscore = not a
  route). Server code has its own tsconfig (Node target) separate from the Vite app.
- Vercel Hobby allows at most 12 functions per deployment. Consolidate with dynamic
  routes (e.g. /api/auth/[action].ts handles login, callback, logout, me).
- vercel.json SPA rewrite must exclude /api: source "/((?!api/).*)" → "/index.html".
- Server env vars (never prefixed VITE_, never sent to the browser):
  GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET, GITHUB_ORG,
  GITHUB_PROJECT_NUMBER, BLOB_READ_WRITE_TOKEN. (GITHUB_SNAPSHOT_TOKEN and CRON_SECRET
  are reserved for an optional future scheduled snapshot job; don't require them.)
- Server code must fail with a clear error naming any missing required env var, except
  that missing OAuth vars mean "auth unavailable" (preview deployments), not a crash.
- Every endpoint returns JSON { error: { code, message } } on failure with a correct
  status code. Never return raw GitHub error bodies or tokens to the client.
- Local dev with the API: `npx vercel dev` (port 3000). `npm run dev` runs the frontend only.
  Local env vars come from Vercel's Development environment via
  `npx vercel env pull .env.local`. .env.local is never committed.

## Auth: Sign in with GitHub
- GitHub OAuth App, scopes: "read:user read:org project repo". `repo` is required because
  the team repo is private: without it GitHub redacts those issues/PRs in project items.
- Flow: /api/auth/login sets a random `state` in a short-lived HttpOnly cookie and
  redirects to GitHub; /api/auth/callback verifies state, exchanges the code, checks the
  user is an ACTIVE member of GITHUB_ORG (GET /user/memberships/orgs/{org}), then sets
  the session cookie. Non-members get redirected to /tasks?error=not-a-member.
- Session: the GitHub access token + { login, name, avatarUrl } encrypted with jose (JWE,
  key derived from SESSION_SECRET) in one cookie: HttpOnly, Secure (except localhost),
  SameSite=Lax, Path=/, Max-Age 7 days. The token never reaches browser JavaScript.
- /api/auth/me returns { user } or { user: null, authAvailable } (authAvailable is false
  when OAuth env vars are missing, e.g. on preview deployments).
- Sign-out revokes the GitHub grant (DELETE /applications/{client_id}/grant, basic
  auth with client id/secret) and then clears the cookie. If revocation fails, still
  clear the cookie.
- Mutating endpoints (POST/PATCH/DELETE) also require the Origin header to match the
  site's own origin.
- Frontend: src/lib/auth (AuthProvider + useAuth). Navbar shows "Sign in with GitHub"
  or the user's avatar with a menu (My tasks, Sign out).

## Tasks: GitHub Projects v2
- All task reads/writes go through /api/tasks* using the SIGNED-IN USER'S token, so
  GitHub attributes changes to them and enforces permissions. Server GraphQL client
  lives in /api/_lib/github.
- Project fields are found BY NAME at runtime (cache per function instance). All field
  and option names live in one server config file (/api/_lib/config.ts) so a rename is
  a one-line fix:
  - Status (single select): Product Backlog, Sprint Backlog, In progress, In review,
    Done, Blocked. "Done" = complete; everything else is open. "Blocked" is flagged.
  - Iteration (iteration): the ONLY source of truth for sprint membership.
  - Story Points (single select: 1, 2, 3, 5, 8, 13). Parse the option name as a number;
    a non-numeric option counts as unestimated.
  - Estimate (number, HOURS).
  - Priority (single select: P0, P1, P2). Badge, filter, secondary sort (P0 first).
  - Size (single select: XS, S, M, L, XL). Display only, never used in math.
  - Estimated done date (project DATE field): overdue/due-soon logic. In code, call
    this `doneBy`; in the UI label it "Done by".
  - Type (single select: Dev, Docs, Admin).
  - Ignore "Sub-issues progress" and any other issue-level fields, except labels: issue/PR
    labels are shown read-only on task rows (drafts can't have labels). The site never
    edits labels.
  The team hasn't finalized sizing fields. The burndown unit is a single config value,
  BURNDOWN_UNIT: "storyPoints" (default) | "estimateHours". Never mix units in one chart.
  Required fields: Status, Iteration, Estimated done date, plus whichever field
  BURNDOWN_UNIT uses. If one is missing, fail with a readable error naming it. All other
  fields (Type, Story Points, Estimate, Priority, Size) are optional: hide their UI
  (badges, filters, and dialog fields) when absent.
- New Task dialog: the sprint (Iteration) defaults to "none"; the user can pick one.
- Status colors come from GitHub's option colors (fetched with the project meta), mapped
  to the status-* tokens in src/index.css via statusColorTokens in src/lib/tasks; unknown
  or missing → GRAY. Every status display (lists, dialog, inline status select) uses the
  one StatusBadge component (and StatusDot in selects): the name is always shown as text,
  Blocked gets an AlertCircle instead of the dot, and Done tasks' titles are dusk with a
  line-through.
- New items created on the site get Status "Sprint Backlog" if an iteration is set,
  otherwise "Product Backlog", unless the user picks a status explicitly.
- Items GitHub returns redacted (content the user's token can't read) are skipped but
  counted; /tasks shows how many are hidden, with a "Sign in again" button.
- Items can be draft issues, issues, or PRs. New task creates real ISSUES only, never
  drafts: createIssue in the repository linked to the project, then addProjectV2ItemById,
  then the field updates. The repository is found at runtime from the project's linked
  repositories (fetched with the project meta): the only linked repo, or, if several are
  linked, the one named by ISSUE_REPOSITORY in /api/_lib/config.ts. With none (or an
  ambiguous set), refuse before writing anything, with a readable error naming the fix. If
  the issue is created but can't be added to the project, say which issue exists (so nobody
  retries into a duplicate). The site can edit fields on any item, title/notes on drafts
  (existing ones; drafts can still be made on the GitHub board), assignees on drafts and
  issues, and links out to GitHub for everything else. Archived items are excluded.
- "Current iteration" = the iteration where startDate <= today < startDate + duration.
- Dates: GitHub date fields are calendar dates. Parse them as local dates
  (America/New_York), never as UTC midnight. Overdue = Estimated done date before today and not Done.
- Frontend mock: when VITE_TASKS_MOCK=true, the Tasks UI uses src/lib/tasks/mock.ts and
  a fake signed-in user, and writes only update in-memory state. Never used in production.

## Burndown (built in Prompt 11)
- Snapshots are VIEW-TRIGGERED: there is no scheduled job and no server-owned GitHub
  token. When a signed-in user loads /api/burndown for the CURRENT iteration, the server
  computes today's totals with that user's token and upserts today's entry
  (America/New_York date) into burndown/<iterationId>.json. Days nobody views are gaps.
- File shape: { iteration: {id,title,startDate,duration}, days: [{ date, remaining,
  done, scope, unestimatedCount, unit }] }, measured in BURNDOWN_UNIT. Upsert by date
  (the latest view of the day wins). If BURNDOWN_UNIT changes mid-sprint, start a new
  file rather than mixing units: "estimateHours" snapshots go in
  burndown/<iterationId>.estimateHours.json. Past iterations are read-only (never rewritten).
- Vercel Blob store is PRIVATE: read/write with access "private", server-side only;
  never send blob URLs to the client.
- Store only totals, never task titles or assignees.
- Keep the snapshot computation in one function (/api/_lib/burndown.ts) that takes a
  token, so a scheduled job (cron + a read-only token) can reuse it later if the gaps
  become a problem.

## Design system: "First Light"
Tokens (define in @theme, use via Tailwind utilities; no raw hex in components):
night #1E2140, cream #FFF8EF, surface #FFFFFF, dusk #5B6091, ember #B4533A,
apricot #E07A5F, gold #F2B84B, lavender #8A8FB5.
- Text: night (primary), dusk (secondary). Links/active states: ember.
- apricot is a fill color with night text on top. gold and lavender are decorative only,
  never text.
- Fonts: Fraunces (headings), Inter (body).
- Cards: white, rounded-2xl, soft warm shadow, subtle hover lift.
- Signature motifs: sunrise hero gradient (night → lavender → apricot → gold),
  thin gold→apricot "horizon line" dividers, sun-arc SVG behind the wordmark.
- Respect prefers-reduced-motion. Meet WCAG AA. Fully keyboard navigable, visible focus rings.

## Conventions
- src/pages/* for routes, src/components/* for shared UI, src/lib/* for non-UI logic.
- Keep Drive API code isolated in src/lib/drive so it can be swapped for a build-time
  manifest later without touching pages.
- Keep all GitHub API code server-side in /api/_lib/github. The browser only talks to /api.
- Every data view handles loading (skeletons), error (friendly message + retry), and empty.
- Run `npm run build` and `npm run lint` before declaring a task done.