export interface DriveFile {
  id: string
  name: string
  mimeType: string
  /** ISO 8601 timestamp. */
  modifiedTime: string
  webViewLink: string
  iconLink: string
}

/** A file from a dated feed (agendas, 4Ups, later sprint artifacts). */
export interface FeedItem {
  file: DriveFile
  /** Local calendar date from the "YYYY-MM-DD" filename prefix (midnight local time). */
  date: Date
  sourceKey: string
}

/** An Agenda and/or 4Up sharing one date. */
export interface Meeting {
  date: Date
  agenda?: FeedItem
  fourUp?: FeedItem
}

export interface ArtifactCategory {
  /** Drive folder ID. */
  id: string
  slug: string
  /** Folder name with the "NN " prefix stripped. */
  displayName: string
  /** The numeric "NN" prefix; categories without one sort last. */
  order: number
  files: DriveFile[]
}
