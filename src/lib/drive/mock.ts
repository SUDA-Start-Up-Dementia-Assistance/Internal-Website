import { MOCK_AGENDAS_FOLDER_ID, MOCK_PUBLISHED_FOLDER_ID } from '../../config/sources'
import { FOLDER_MIME_TYPE, type ListFolderOptions } from './client'
import { slugify, toDateKey } from './parse'
import type { DriveFile } from './types'

/*
 * Fake Drive folder listings, served in place of the API when there's no API key.
 * Dates are relative to today so there are always past and upcoming meetings.
 */

const DOC = 'application/vnd.google-apps.document'
const SLIDES = 'application/vnd.google-apps.presentation'
const PDF = 'application/pdf'

const MEETING_WEEKDAY = 2 // Tuesday

function daysFromToday(days: number): Date {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

/** A modifiedTime that's never in the future. */
function modifiedAt(date: Date): string {
  return new Date(Math.min(date.getTime(), Date.now())).toISOString()
}

function mockFile(id: string, name: string, mimeType: string, modified: Date): DriveFile {
  return {
    id: `mock-${id}`,
    name,
    mimeType,
    modifiedTime: modifiedAt(modified),
    webViewLink: `https://drive.google.com/file/d/mock-${id}/view`,
    iconLink: `https://drive-thirdparty.googleusercontent.com/16/type/${mimeType}`,
  }
}

function mockFolder(id: string, name: string): DriveFile {
  return { ...mockFile(id, name, FOLDER_MIME_TYPE, daysFromToday(-60)), iconLink: '' }
}

function agendasFolder(): DriveFile[] {
  const today = daysFromToday(0)
  const lastMeeting = -((today.getDay() - MEETING_WEEKDAY + 7) % 7)
  const files: DriveFile[] = []

  // Eight weekly meetings: six past (or today), two upcoming.
  for (let week = -5; week <= 2; week++) {
    const offset = lastMeeting + week * 7
    const meetingDay = daysFromToday(offset)
    const key = toDateKey(meetingDay)
    // Filenames vary a little in case and spacing, like real uploads do.
    const agendaName = week === -2 ? `${key} agenda` : `${key} Agenda`
    const fourUpName = week === -1 ? `${key}  4Up ` : `${key} 4Up`

    files.push(mockFile(`agenda-${key}`, agendaName, DOC, daysFromToday(offset - 1)))
    // The furthest-out meeting has an agenda but no 4Up yet.
    if (week < 2) files.push(mockFile(`4up-${key}`, fourUpName, SLIDES, daysFromToday(offset - 1)))
  }

  // Junk that must be ignored.
  files.push(
    mockFile('notes', 'notes', DOC, daysFromToday(-3)),
    mockFile('template', 'Agenda template', DOC, daysFromToday(-90)),
    mockFile('dupe', `${toDateKey(daysFromToday(lastMeeting))} Agenda (1)`, DOC, daysFromToday(-2)),
  )
  return files
}

// Each subfolder of the Artifacts folder is a category; every artifact is a PDF. Folders
// and files use an optional "NN " prefix for ordering ("Usability Study Results" has none,
// so it sorts last in its folder).
const CATEGORIES: { id: string; name: string; files: [string, number][] }[] = [
  {
    id: 'cat-pm',
    name: '01 Project Management',
    files: [
      ['01 Team Charter.pdf', -40],
      ['02 Project Plan.pdf', -9],
      ['03 Risk Register.pdf', -12],
    ],
  },
  {
    id: 'cat-req',
    name: '02 Requirements',
    files: [
      ['01 Software Requirements Specification.pdf', -2],
      ['02 User Personas.pdf', -21],
    ],
  },
  {
    id: 'cat-design',
    name: '03 Architecture & Design',
    files: [
      ['01 Architecture Overview.pdf', -5],
      ['03 UI Mockups.pdf', -16],
      ['02 Data Model.pdf', -24],
    ],
  },
  {
    id: 'cat-test',
    name: '04 Testing',
    files: [
      ['01 Test Plan.pdf', -14],
      ['Usability Study Results.pdf', -30],
    ],
  },
  {
    id: 'cat-pres',
    name: '05 Presentations',
    files: [
      ['01 Kickoff Presentation.pdf', -45],
      ['02 Midterm Review.pdf', -7],
    ],
  },
]

function folderContents(folderId: string): DriveFile[] {
  if (folderId === MOCK_AGENDAS_FOLDER_ID) return agendasFolder()
  if (folderId === MOCK_PUBLISHED_FOLDER_ID) {
    return CATEGORIES.map((c) => mockFolder(c.id, c.name))
  }
  const category = CATEGORIES.find((c) => `mock-${c.id}` === folderId)
  if (!category) return []
  return category.files.map(([name, days]) =>
    mockFile(`${category.id}-${slugify(name)}`, name, PDF, daysFromToday(days)),
  )
}

/** Same contract as client.listFolder, backed by the fake listings above. */
export async function mockListFolder(
  folderId: string,
  { foldersOnly, filesOnly }: ListFolderOptions = {},
): Promise<DriveFile[]> {
  return folderContents(folderId).filter((f) => {
    const isFolder = f.mimeType === FOLDER_MIME_TYPE
    return foldersOnly ? isFolder : filesOnly ? !isFolder : true
  })
}
