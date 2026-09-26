import { describe, expect, it } from 'vitest'
import type { ArtifactCategory, DriveFile, FeedItem, Meeting } from './drive'
import { parseLocalDate, toDateKey } from './drive/parse'
import {
  categoryLastUpdated,
  filterMeetings,
  meetingMonths,
  searchPublished,
  selectLatestFourUp,
  splitMeetings,
} from './selectors'

const TODAY = parseLocalDate('2026-09-29')!
const NOON_TODAY = new Date(2026, 8, 29, 12, 30)

function item(date: string, sourceKey: string): FeedItem {
  const file: DriveFile = {
    id: `${date}-${sourceKey}`,
    name: `${date} ${sourceKey}`,
    mimeType: 'application/vnd.google-apps.document',
    modifiedTime: '2026-09-01T00:00:00.000Z',
    webViewLink: '',
    iconLink: '',
  }
  return { file, date: parseLocalDate(date)!, sourceKey }
}

function meeting(date: string, { agenda = true, fourUp = true } = {}): Meeting {
  return {
    date: parseLocalDate(date)!,
    agenda: agenda ? item(date, 'agendas') : undefined,
    fourUp: fourUp ? item(date, 'fourUps') : undefined,
  }
}

const keys = (meetings: Meeting[]) => meetings.map((m) => toDateKey(m.date))

const MEETINGS = [
  meeting('2026-09-15'),
  meeting('2026-10-06', { fourUp: false }),
  meeting('2026-09-29'),
  meeting('2026-09-22', { agenda: false }),
  meeting('2026-10-13', { agenda: false }),
  meeting('2026-08-25'),
]

describe('splitMeetings', () => {
  it('puts today and later in upcoming (soonest first), earlier in past (latest first)', () => {
    const { upcoming, past } = splitMeetings(MEETINGS, TODAY)
    expect(keys(upcoming)).toEqual(['2026-09-29', '2026-10-06', '2026-10-13'])
    expect(keys(past)).toEqual(['2026-09-22', '2026-09-15', '2026-08-25'])
  })

  it('keeps a meeting dated today upcoming for the whole day', () => {
    expect(keys(splitMeetings(MEETINGS, NOON_TODAY).upcoming)[0]).toBe('2026-09-29')
  })
})

describe('filterMeetings', () => {
  it('keeps everything for "all"', () => {
    expect(filterMeetings(MEETINGS, 'all', TODAY)).toHaveLength(MEETINGS.length)
  })

  it('keeps meetings with agendas, plus upcoming ones still waiting for one', () => {
    expect(keys(filterMeetings(MEETINGS, 'agendas', TODAY))).toEqual([
      '2026-09-15',
      '2026-10-06',
      '2026-09-29',
      '2026-10-13',
      '2026-08-25',
    ])
  })

  it('keeps only meetings with a 4Up', () => {
    expect(keys(filterMeetings(MEETINGS, 'fourUps', TODAY))).toEqual([
      '2026-09-15',
      '2026-09-29',
      '2026-09-22',
      '2026-10-13',
      '2026-08-25',
    ])
  })
})

describe('meetingMonths', () => {
  it('lists distinct months, newest first', () => {
    expect(meetingMonths(MEETINGS).map((m) => m.key)).toEqual(['2026-10', '2026-09', '2026-08'])
  })
})

describe('selectLatestFourUp', () => {
  it('picks the most recent past 4Up, not one posted for an upcoming meeting', () => {
    const meetings = [meeting('2026-09-22'), meeting('2026-10-06'), meeting('2026-09-15')]
    expect(toDateKey(selectLatestFourUp(meetings, TODAY)!.date)).toBe('2026-09-22')
  })

  it("counts today's meeting as the latest", () => {
    expect(toDateKey(selectLatestFourUp(MEETINGS, NOON_TODAY)!.date)).toBe('2026-09-29')
  })

  it('skips past meetings without a 4Up', () => {
    const meetings = [meeting('2026-09-22', { fourUp: false }), meeting('2026-09-15')]
    expect(toDateKey(selectLatestFourUp(meetings, TODAY)!.date)).toBe('2026-09-15')
  })

  it('returns undefined when every 4Up is for a future meeting', () => {
    expect(selectLatestFourUp([meeting('2026-10-06')], TODAY)).toBeUndefined()
  })
})

function file(name: string, modifiedTime: string): DriveFile {
  return {
    id: name,
    name,
    mimeType: 'application/pdf',
    modifiedTime,
    webViewLink: '',
    iconLink: '',
  }
}

const CATEGORIES: ArtifactCategory[] = [
  {
    id: 'c2',
    slug: 'requirements',
    displayName: 'Requirements',
    order: 2,
    files: [
      file('Software Requirements Specification.pdf', '2026-09-20T00:00:00.000Z'),
      file('User Personas.pdf', '2026-09-01T00:00:00.000Z'),
    ],
  },
  {
    id: 'c3',
    slug: 'architecture-design',
    displayName: 'Architecture & Design',
    order: 3,
    files: [file('Architecture Overview.pdf', '2026-09-24T00:00:00.000Z')],
  },
  { id: 'c4', slug: 'testing', displayName: 'Testing', order: 4, files: [] },
]

describe('categoryLastUpdated', () => {
  it('is the newest modifiedTime in the category', () => {
    expect(categoryLastUpdated(CATEGORIES[0])).toBe('2026-09-20T00:00:00.000Z')
  })

  it('is undefined for an empty category', () => {
    expect(categoryLastUpdated(CATEGORIES[2])).toBeUndefined()
  })
})

describe('searchPublished', () => {
  const names = (query: string) => searchPublished(query, CATEGORIES).map((r) => r.file.name)

  it('returns nothing for an empty or blank query', () => {
    expect(names('')).toEqual([])
    expect(names('   ')).toEqual([])
  })

  it('matches file names case-insensitively', () => {
    expect(names('ARCHITECTURE')).toEqual(['Architecture Overview.pdf'])
  })

  it('requires every word to match', () => {
    expect(names('software spec')).toEqual(['Software Requirements Specification.pdf'])
    expect(names('software overview')).toEqual([])
  })

  it('matches files by category name', () => {
    expect(names('design')).toEqual(['Architecture Overview.pdf'])
  })

  it('ignores the .pdf extension', () => {
    expect(names('pdf')).toEqual([])
  })

  it('sorts matches by most recently modified', () => {
    expect(names('re')).toEqual([
      'Architecture Overview.pdf',
      'Software Requirements Specification.pdf',
      'User Personas.pdf',
    ])
  })
})
