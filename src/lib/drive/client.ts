import { GOOGLE_API_KEY } from '../../config/sources'
import type { DriveFile } from './types'

const FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files'
export const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
const FIELDS = 'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,iconLink)'

export class DriveApiError extends Error {
  /** HTTP status, or 0 when the request never got a response. */
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DriveApiError'
    this.status = status
  }
}

export interface ListFolderOptions {
  foldersOnly?: boolean
  filesOnly?: boolean
}

interface FilesListResponse {
  nextPageToken?: string
  files?: DriveFile[]
}

function buildQuery(folderId: string, { foldersOnly, filesOnly }: ListFolderOptions): string {
  const escaped = folderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  let q = `'${escaped}' in parents and trashed=false`
  if (foldersOnly) q += ` and mimeType='${FOLDER_MIME_TYPE}'`
  else if (filesOnly) q += ` and mimeType!='${FOLDER_MIME_TYPE}'`
  return q
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } }
    if (body.error?.message) return body.error.message
  } catch {
    // Not JSON; fall through to the status text.
  }
  return res.statusText || 'Unknown error'
}

/** Lists every child of a Drive folder, following nextPageToken. */
export async function listFolder(
  folderId: string,
  options: ListFolderOptions = {},
  apiKey = GOOGLE_API_KEY,
): Promise<DriveFile[]> {
  if (!apiKey) throw new DriveApiError('No Google API key is configured.', 0)

  const files: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      q: buildQuery(folderId, options),
      fields: FIELDS,
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      key: apiKey,
    })
    if (pageToken) params.set('pageToken', pageToken)

    let res: Response
    try {
      res = await fetch(`${FILES_ENDPOINT}?${params}`)
    } catch {
      throw new DriveApiError("Couldn't reach Google Drive. Check your connection.", 0)
    }
    if (!res.ok) {
      const detail = await readErrorMessage(res)
      throw new DriveApiError(`Google Drive request failed (${res.status}): ${detail}`, res.status)
    }

    const body = (await res.json()) as FilesListResponse
    files.push(...(body.files ?? []))
    pageToken = body.nextPageToken
  } while (pageToken)

  return files
}
