# D.A.W.N. Team Site

Internal website for our RIT SWEN 561/562 senior project team working on D.A.W.N.
(Daily Awareness & Well-being Navigator), a tablet-based morning orientation app for
people living with dementia, sponsored by Gerry Garavuso and in beta at St. Ann's Home.
Faculty coach: Drew Saur.

## Purpose
A lightweight hub for the team, sponsor, and coach: see upcoming/past meeting agendas
and browse project artifacts. Content lives in Google Drive; the site only reads it.

## Stack (do not add to this without asking)
- React 18+ with Vite, TypeScript (strict)
- Tailwind CSS v4 via @tailwindcss/vite, CSS-first config with @theme in src/index.css
- react-router-dom (BrowserRouter)
- lucide-react for icons
- No backend. No state library. No UI component library.

## Data source
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
- Every data view handles loading (skeletons), error (friendly message + retry), and empty.
- Run `npm run build` and `npm run lint` before declaring a task done.