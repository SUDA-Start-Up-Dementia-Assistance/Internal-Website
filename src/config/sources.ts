/**
 * Content sources. This is the only module that reads VITE_ env vars; pages, hooks, and
 * src/lib/drive read everything from here.
 *
 * Adding a dated feed (e.g. sprint artifacts) only takes a new entry below: useFeed,
 * the shared per-folder cache, and filename parsing all pick it up from this object.
 */

export type SourceKind = 'dated-feed' | 'published-library'

interface BaseSource {
  key: string
  label: string
  kind: SourceKind
  /** Drive folder ID, or undefined when not configured (the source's UI is hidden). */
  folderId: string | undefined
}

/** Recurring files named "YYYY-MM-DD <suffix>" in a working folder. */
export interface DatedFeedSource extends BaseSource {
  kind: 'dated-feed'
  suffix: string
}

/** A curated folder of "NN Category Name" subfolders. */
export interface PublishedLibrarySource extends BaseSource {
  kind: 'published-library'
}

export type Source = DatedFeedSource | PublishedLibrarySource

const env = import.meta.env

export const GOOGLE_API_KEY: string | undefined = env.VITE_GOOGLE_API_KEY || undefined

/** With no API key the site runs on mock data from src/lib/drive/mock.ts. */
export const USE_MOCK_DATA = !GOOGLE_API_KEY

// Stand-in folder IDs used in mock mode (mock.ts serves listings for these).
export const MOCK_AGENDAS_FOLDER_ID = 'mock-agendas-folder'
export const MOCK_PUBLISHED_FOLDER_ID = 'mock-published-folder'

function folder(envValue: string | undefined, mockId: string): string | undefined {
  return USE_MOCK_DATA ? mockId : envValue || undefined
}

const AGENDAS_FOLDER_ID = folder(env.VITE_AGENDAS_FOLDER_ID, MOCK_AGENDAS_FOLDER_ID)
const PUBLISHED_FOLDER_ID = folder(env.VITE_PUBLISHED_FOLDER_ID, MOCK_PUBLISHED_FOLDER_ID)

export const SOURCES = {
  agendas: {
    key: 'agendas',
    label: 'Agendas',
    kind: 'dated-feed',
    suffix: 'Agenda',
    folderId: AGENDAS_FOLDER_ID,
  },
  fourUps: {
    key: 'fourUps',
    label: '4Ups',
    kind: 'dated-feed',
    suffix: '4Up',
    folderId: AGENDAS_FOLDER_ID,
  },
  // Planned: sprint artifacts, e.g. "2026-10-06 Sprint Review" in their own folder.
  // Add VITE_SPRINT_FOLDER_ID to .env.example, then uncomment:
  // sprintArtifacts: {
  //   key: 'sprintArtifacts',
  //   label: 'Sprint artifacts',
  //   kind: 'dated-feed',
  //   suffix: 'Sprint Review',
  //   folderId: folder(env.VITE_SPRINT_FOLDER_ID, MOCK_AGENDAS_FOLDER_ID),
  // },
  publishedArtifacts: {
    key: 'publishedArtifacts',
    label: 'Published artifacts',
    kind: 'published-library',
    folderId: PUBLISHED_FOLDER_ID,
  },
} as const satisfies Record<string, Source>

export type SourceKey = keyof typeof SOURCES

export type FeedKey = {
  [K in SourceKey]: (typeof SOURCES)[K] extends { kind: 'dated-feed' } ? K : never
}[SourceKey]

export type LibraryKey = {
  [K in SourceKey]: (typeof SOURCES)[K] extends { kind: 'published-library' } ? K : never
}[SourceKey]

/** False when the source's folder ID is missing; callers hide that source's UI. */
export function isSourceConfigured(key: SourceKey): boolean {
  return Boolean((SOURCES[key] as Source).folderId)
}
