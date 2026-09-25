import {
  SOURCES,
  USE_MOCK_DATA,
  type DatedFeedSource,
  type LibraryKey,
  type Source,
} from '../../config/sources'
import { listFolder, type ListFolderOptions } from './client'
import { mockListFolder } from './mock'
import { classifyFeedFile, groupMeetings, parseCategory } from './parse'
import type { ArtifactCategory, DriveFile, FeedItem, Meeting } from './types'

/*
 * Non-React loaders behind the hooks. Every folder listing goes through one cache keyed
 * by folder, so feeds sharing a folder (agendas + 4Ups) share a single request.
 */

const folderCache = new Map<string, Promise<DriveFile[]>>()

function cacheKey(folderId: string, { foldersOnly, filesOnly }: ListFolderOptions): string {
  return `${folderId}|${foldersOnly ? 'folders' : filesOnly ? 'files' : 'all'}`
}

function listFolderCached(folderId: string, options: ListFolderOptions): Promise<DriveFile[]> {
  const key = cacheKey(folderId, options)
  let request = folderCache.get(key)
  if (!request) {
    request = (USE_MOCK_DATA ? mockListFolder : listFolder)(folderId, options)
    folderCache.set(key, request)
    // Don't cache failures, so a retry actually retries.
    request.catch(() => {
      if (folderCache.get(key) === request) folderCache.delete(key)
    })
  }
  return request
}

/** Drops every cached listing; the next load hits Drive again. */
export function clearDriveCache(): void {
  folderCache.clear()
}

function allSources(): Source[] {
  return Object.values(SOURCES as Record<string, Source>)
}

function getSource(key: string): Source {
  const source = (SOURCES as Record<string, Source | undefined>)[key]
  if (!source) throw new Error(`Unknown source "${key}". Add it to src/config/sources.ts.`)
  return source
}

const warnedFileIds = new Set<string>()

function warnUnmatched(file: DriveFile, feeds: DatedFeedSource[]) {
  if (!import.meta.env.DEV || warnedFileIds.has(file.id)) return
  warnedFileIds.add(file.id)
  const expected = feeds.map((f) => `"YYYY-MM-DD ${f.suffix}"`).join(' or ')
  console.warn(`[drive] Ignoring "${file.name}": expected ${expected}.`)
}

/** Items for one dated feed, newest first. Empty if the feed's folder isn't configured. */
export async function loadFeed(sourceKey: string): Promise<FeedItem[]> {
  const source = getSource(sourceKey)
  if (source.kind !== 'dated-feed') throw new Error(`Source "${sourceKey}" is not a dated feed.`)
  if (!source.folderId) return []

  const feedsInFolder = allSources().filter(
    (s): s is DatedFeedSource => s.kind === 'dated-feed' && s.folderId === source.folderId,
  )
  const files = await listFolderCached(source.folderId, { filesOnly: true })

  const items: FeedItem[] = []
  for (const file of files) {
    const item = classifyFeedFile(file, feedsInFolder)
    if (!item) warnUnmatched(file, feedsInFolder)
    else if (item.sourceKey === sourceKey) items.push(item)
  }
  return items.sort((a, b) => b.date.getTime() - a.date.getTime())
}

/** Agendas and 4Ups paired by date, newest first. */
export async function loadMeetings(): Promise<Meeting[]> {
  const [agendas, fourUps] = await Promise.all([loadFeed('agendas'), loadFeed('fourUps')])
  return groupMeetings(agendas, fourUps)
}

const byName = (a: DriveFile, b: DriveFile) =>
  a.name.localeCompare(b.name, undefined, { numeric: true })

/** Categories in "NN" order, each with its files sorted by name. */
export async function loadPublishedCategories(
  sourceKey: LibraryKey = 'publishedArtifacts',
): Promise<ArtifactCategory[]> {
  const source = getSource(sourceKey)
  if (!source.folderId) return []

  const folders = await listFolderCached(source.folderId, { foldersOnly: true })
  const categories = await Promise.all(
    folders.map(async (folder) => {
      const files = await listFolderCached(folder.id, { filesOnly: true })
      return parseCategory(folder, [...files].sort(byName))
    }),
  )
  return categories.sort((a, b) => a.order - b.order || a.displayName.localeCompare(b.displayName))
}

/** One category by slug, or null if there's no such category. */
export async function loadPublishedCategory(slug: string): Promise<ArtifactCategory | null> {
  const categories = await loadPublishedCategories()
  return categories.find((c) => c.slug === slug) ?? null
}
