import type { DriveFile } from './types'

const GOOGLE_DOC = 'application/vnd.google-apps.document'
const GOOGLE_SLIDES = 'application/vnd.google-apps.presentation'
const GOOGLE_SHEET = 'application/vnd.google-apps.spreadsheet'

/** An iframe-embeddable preview URL for a Drive file. */
export function getEmbedUrl(file: Pick<DriveFile, 'id' | 'mimeType'>): string {
  const id = encodeURIComponent(file.id)
  switch (file.mimeType) {
    case GOOGLE_DOC:
      return `https://docs.google.com/document/d/${id}/preview`
    case GOOGLE_SLIDES:
      return `https://docs.google.com/presentation/d/${id}/embed`
    case GOOGLE_SHEET:
      return `https://docs.google.com/spreadsheets/d/${id}/preview`
    default:
      return `https://drive.google.com/file/d/${id}/preview`
  }
}
