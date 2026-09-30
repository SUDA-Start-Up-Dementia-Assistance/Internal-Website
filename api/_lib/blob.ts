import { get } from '@vercel/blob'
import { ConfigError } from './env.js'

/*
 * Shared helpers for the PRIVATE Vercel Blob store (burndown snapshots and team to-dos).
 * Server-side only: blob URLs never reach the client.
 */

export function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) {
    throw new ConfigError('Missing required environment variable(s): BLOB_READ_WRITE_TOKEN.')
  }
  return token
}

/**
 * The parsed JSON at `pathname` and its ETag, read from origin (never a cached copy), or
 * null if there's no such blob. Unparseable JSON comes back as `data: null`.
 */
export async function readJsonBlob(
  pathname: string,
): Promise<{ data: unknown; etag: string } | null> {
  const result = await get(pathname, {
    access: 'private',
    token: blobToken(),
    // Read the latest write, not a cached copy: callers read-modify-write.
    useCache: false,
  })
  if (!result || result.statusCode !== 200) return null
  const text = await new Response(result.stream).text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = null
  }
  return { data, etag: result.blob.etag }
}
