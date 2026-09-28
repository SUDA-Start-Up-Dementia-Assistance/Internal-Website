# D.A.W.N. Team Site

Internal hub for the RIT SWEN 561/562 team building D.A.W.N. (Daily Awareness & Well-being
Navigator): meeting agendas and 4Ups, published project artifacts, and (for the team) tasks and
the sprint burndown.

- **Agendas and artifacts** are read from Google Drive in the browser (API key, read-only).
- **Tasks** live in the team's GitHub Project and are read/written through `/api` with each
  person's own GitHub sign-in.
- **Burndown history** is a small daily-totals file per sprint in a private Vercel Blob store.

See `CLAUDE.md` for the full design and conventions.

## Quick start

Requires **Node 22.22+ or 24** (Vite 8, Vitest 5, and jsdom 30 don't support Node 20).

```sh
npm install
npm run dev          # frontend only, http://localhost:5173
```

With no credentials at all, the site still runs: Drive pages use mock data, and `/tasks` shows
sample tasks under a "Preview: sample data" banner. `VITE_TASKS_MOCK=true npm run dev` forces
the sample tasks with a fake signed-in user (never active in production builds).

| Command          | What it does                           |
| ---------------- | -------------------------------------- |
| `npm run dev`    | Vite dev server (no `/api`)            |
| `npx vercel dev` | Frontend + `/api` functions, port 3000 |
| `npm run build`  | Type-check (app + api) and build       |
| `npm run lint`   | ESLint                                 |
| `npm test`       | Vitest (server and UI tests)           |

## Phase 2 setup

Phase 2 adds GitHub sign-in, tasks, and the burndown. Everything secret stays server-side in the
`/api` functions.

### 1. Create the GitHub OAuth Apps

GitHub OAuth Apps allow a single callback host, so create **two** apps under the team's
organization (**Organization → Settings → Developer settings → OAuth Apps → New OAuth App**):

| App        | Homepage URL            | Authorization callback URL                |
| ---------- | ----------------------- | ----------------------------------------- |
| Production | `https://<your-domain>` | `https://<your-domain>/api/auth/callback` |
| Local dev  | `http://localhost:3000` | `http://localhost:3000/api/auth/callback` |

For each, note the **Client ID** and generate a **Client secret** (shown once).

The site asks for the scopes `read:user read:org project repo`. `repo` is needed because the
team's repository is private: without it, GitHub hides those issues in project items.

Preview deployments get **no** OAuth app on purpose: without OAuth vars, a preview shows sample
tasks with a "Preview: sample data" banner and never touches GitHub.

### 2. Get the apps approved by the organization

If the organization restricts third-party access (the default for new orgs), members can't use
an OAuth App until an owner approves it:

1. Sign in on the site once. GitHub's consent screen lists the organization with a
   **Request** button: click it.
2. An org owner approves it at **Organization → Settings → Third-party access → OAuth app
   policy**.

Until then, sign-in works but tasks fail with "the organization hasn't approved this app". Do
this for both apps. Only **active** org members can sign in; pending invitees see a message
asking them to accept the invitation first.

### 3. Create the private Blob store

In the Vercel project: **Storage → Create → Blob**, choose **Private** access, and connect it
to the Production and Development environments. That adds `BLOB_READ_WRITE_TOKEN`. The store
holds only daily totals per sprint (`burndown/<iterationId>.estimateHours.json`), never task
titles or assignees, and the server never sends blob URLs to the browser.

### 4. Set the environment variables

Set these in **Vercel → Project → Settings → Environment Variables**. Server variables are
never prefixed `VITE_` and never reach the browser.

| Variable                   | Production        | Preview | Development     | Notes                                                       |
| -------------------------- | ----------------- | ------- | --------------- | ----------------------------------------------------------- |
| `GITHUB_CLIENT_ID`         | prod app          | unset   | local-dev app   | Unset = sign-in off (sample data). Required in production.  |
| `GITHUB_CLIENT_SECRET`     | prod app          | unset   | local-dev app   | Secret.                                                     |
| `SESSION_SECRET`           | random ≥ 32 chars | unset   | a different one | Encrypts the session cookie. `openssl rand -base64 48`      |
| `GITHUB_ORG`               | org login         | unset   | org login       | e.g. `dawn-team`; sign-in requires active membership.       |
| `GITHUB_PROJECT_NUMBER`    | number            | unset   | number          | From the project URL: `/orgs/<org>/projects/<number>`.      |
| `BLOB_READ_WRITE_TOKEN`    | from Blob store   | unset   | from Blob store | Added by connecting the store.                              |
| `VITE_GOOGLE_API_KEY`      | key               | key     | key             | Browser key; restrict it to the Drive API and your domains. |
| `VITE_AGENDAS_FOLDER_ID`   | folder id         | same    | same            | Missing = hide agendas/4Ups.                                |
| `VITE_PUBLISHED_FOLDER_ID` | folder id         | same    | same            | Missing = hide the artifacts library.                       |

If sign-in is partly configured (e.g. a client ID without `SESSION_SECRET`), the API fails with
an error naming exactly what's missing. On production, missing OAuth vars are an error rather
than "preview mode", so the real site can never show sample data.

### 5. Run it locally with the API

```sh
npx vercel link            # once: connect this folder to the Vercel project
npx vercel env pull .env.local   # Development env vars → .env.local (git-ignored; never commit it)
npx vercel dev             # http://localhost:3000, frontend + /api
```

Sign in at `http://localhost:3000` (the local-dev OAuth app's callback is on port 3000, so
`npm run dev` on 5173 can't sign in). Re-run `vercel env pull` whenever the Development
variables change.

## How tasks work

**The GitHub Project is the source of truth.** The site stores no tasks: every read and write
goes to GitHub through `/api` using the signed-in person's own token, so GitHub records who made
each change and enforces their permissions. Edits made on the GitHub board show up on the site
(it refetches when you come back to the tab), and vice versa.

- **New task** creates a real issue in the repository linked to the project, adds it to the
  project, then sets its fields. Draft issues can still be made on the board; the site can edit
  their title and notes.
- **Sprints** are the project's **Iteration** field, and nothing else. The current sprint is
  the iteration whose dates include today (America/New_York).
- **The burndown** is measured in **Estimate** hours. There's no scheduled job: whenever a
  signed-in teammate opens the Sprint tab for the current sprint, today's totals are recorded.
  Days nobody opens it are gaps.
- Issues your token can't read are skipped and counted, never shown redacted.

### Don't rename project fields

The site finds fields and options **by name** at runtime:

| Field                 | Type          | Options / notes                                                        |
| --------------------- | ------------- | ---------------------------------------------------------------------- |
| `Status`              | single select | Product Backlog, Sprint Backlog, In progress, In review, Done, Blocked |
| `Iteration`           | iteration     | Sprint membership                                                      |
| `Estimate`            | number        | Hours; the burndown's unit                                             |
| `Estimated done date` | date          | Shown as "Done by"; drives overdue                                     |
| `Priority`            | single select | P0, P1, P2 (optional)                                                  |
| `Size`                | single select | XS, S, M, L, XL (optional, display only)                               |
| `Type`                | single select | Dev, Docs, Admin (optional)                                            |

Renaming a required field (Status, Iteration, Estimate, Estimated done date) breaks `/tasks`
with an error naming the missing field; renaming an optional one silently hides it. If a rename
is really needed, change the name in `api/_lib/config.ts` in the same step. Adding new
options (e.g. another Status) is fine: unknown statuses count as "open".

## Rotating secrets

Rotate a secret right away if it may have leaked (committed, pasted in chat, a lost laptop with
`.env.local`), and whenever someone with Vercel access leaves the team.

**`SESSION_SECRET`**: set a new random value in Vercel (`openssl rand -base64 48`) and
redeploy. Every existing session cookie stops decrypting, so everyone is signed out and simply
signs in again. Nothing else to do.

**`GITHUB_CLIENT_SECRET`**: in the OAuth App settings, **Generate a new client secret**,
update it in Vercel, redeploy, then **delete the old secret** on GitHub. Existing sessions keep
working (they hold user tokens, not the app secret). For the local-dev app, re-run
`npx vercel env pull .env.local` afterwards.

**Revoking everyone's GitHub access** (e.g. a session cookie or `SESSION_SECRET` may have leaked): in the
OAuth App settings, **Revoke all user tokens**, then rotate `SESSION_SECRET`. Each person
re-approves the app on their next sign-in. A single person can revoke their own grant at
**GitHub → Settings → Applications → Authorized OAuth Apps**; signing out on the site does
this too.

**`BLOB_READ_WRITE_TOKEN`**: in **Vercel → Storage → the Blob store**, rotate the token (or
disconnect and reconnect the store), then redeploy. The burndown history is kept.

**`VITE_GOOGLE_API_KEY`**: this key is public by design (it ships in the browser bundle), so
its protection is its restrictions: Drive API only, HTTP referrers limited to the site's
domains. To rotate, create a new key in Google Cloud with the same restrictions, update Vercel,
redeploy, then delete the old key.

After any rotation, check the deployment: sign in, open `/tasks`, and open the Sprint tab.
