import type { VercelRequest, VercelResponse } from '@vercel/node'
import { exportPKCS8, generateKeyPair, decodeJwt, decodeProtectedHeader } from 'jose'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../../meetings.js'
import { getCalendarConfig, normalizePrivateKey } from '../env.js'
import { encryptSession } from '../session.js'
import {
  classifyMeeting,
  clearCalendarCaches,
  getServiceAccountToken,
  listMeetings,
  normalizeEvent,
  type RawEvent,
} from './calendar.js'

const SECRET = 'test-secret-that-is-definitely-32-chars-long!'
let PEM = ''

beforeAll(async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true })
  PEM = await exportPKCS8(privateKey)
})

beforeEach(() => {
  clearCalendarCaches()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const LINK = 'https://www.google.com/calendar/event?eid=abc'

describe('normalizeEvent', () => {
  it('normalizes a timed event', () => {
    expect(
      normalizeEvent({
        id: 'e1',
        status: 'confirmed',
        summary: 'DAWN Team Meeting',
        start: { dateTime: '2026-09-29T17:00:00-04:00', timeZone: 'America/New_York' } as never,
        end: { dateTime: '2026-09-29T18:15:00-04:00' },
        htmlLink: LINK,
      }),
    ).toEqual({
      id: 'e1',
      title: 'DAWN Team Meeting',
      start: '2026-09-29T17:00:00-04:00',
      end: '2026-09-29T18:15:00-04:00',
      allDay: false,
      kind: 'official',
      htmlLink: LINK,
    })
  })

  it('normalizes an all-day event with date keys', () => {
    expect(
      normalizeEvent({
        id: 'e2',
        summary: 'Demo day',
        start: { date: '2026-10-06' },
        end: { date: '2026-10-07' },
        htmlLink: LINK,
      }),
    ).toMatchObject({ start: '2026-10-06', end: '2026-10-07', allDay: true, kind: 'adhoc' })
  })

  it('normalizes one instance of a recurring event (singleEvents expands them)', () => {
    const instance = normalizeEvent({
      id: 'recurring123_20260929T210000Z',
      recurringEventId: 'recurring123',
      originalStartTime: { dateTime: '2026-09-29T17:00:00-04:00' },
      summary: 'Team Meeting',
      start: { dateTime: '2026-09-29T17:00:00-04:00' },
      end: { dateTime: '2026-09-29T18:15:00-04:00' },
      htmlLink: LINK,
    } as RawEvent)
    expect(instance).toEqual({
      id: 'recurring123_20260929T210000Z',
      title: 'Team Meeting',
      start: '2026-09-29T17:00:00-04:00',
      end: '2026-09-29T18:15:00-04:00',
      allDay: false,
      kind: 'official',
      htmlLink: LINK,
    })
  })

  it('drops a cancelled occurrence', () => {
    expect(
      normalizeEvent({
        id: 'recurring123_20261001T210000Z',
        status: 'cancelled',
        start: { dateTime: '2026-10-01T17:00:00-04:00' },
        end: { dateTime: '2026-10-01T18:15:00-04:00' },
      }),
    ).toBeNull()
  })

  it.each<[string, RawEvent, string | undefined]>([
    [
      'hangoutLink',
      { hangoutLink: 'https://meet.google.com/abc-defg-hij' },
      'https://meet.google.com/abc-defg-hij',
    ],
    [
      'a conferenceData video entry point',
      {
        conferenceData: {
          entryPoints: [
            { entryPointType: 'phone', uri: 'tel:+1-555-0100' },
            { entryPointType: 'video', uri: 'https://zoom.us/j/123' },
          ],
        },
      },
      'https://zoom.us/j/123',
    ],
    [
      'a URL in location',
      { location: 'Online: https://meet.google.com/xyz-abcd-efg (join)' },
      'https://meet.google.com/xyz-abcd-efg',
    ],
    ['a room name only', { location: 'GOL-2400' }, undefined],
    ['a non-https link', { hangoutLink: 'javascript:alert(1)' }, undefined],
  ])('finds the join link from %s', (_label, extra, expected) => {
    const m = normalizeEvent({
      id: 'e',
      summary: 'Sync',
      start: { dateTime: '2026-09-30T14:00:00-04:00' },
      end: { dateTime: '2026-09-30T14:30:00-04:00' },
      htmlLink: LINK,
      ...extra,
    })
    expect(m?.joinUrl).toBe(expected)
    if (!expected) expect(m && 'joinUrl' in m).toBe(false)
  })

  it('never leaks attendees, descriptions, organizer, or creator', () => {
    const raw = {
      id: 'private',
      summary: 'Team Meeting',
      description: 'Gate code 4471. Notes: https://docs.google.com/private-notes',
      attendees: [
        { email: 'sponsor@example.com', displayName: 'Sponsor', responseStatus: 'accepted' },
        { email: 'student@g.rit.edu', self: true },
      ],
      organizer: { email: 'organizer@example.com', displayName: 'Organizer' },
      creator: { email: 'creator@example.com' },
      attachments: [{ fileUrl: 'https://drive.google.com/secret' }],
      extendedProperties: { private: { note: 'secret' } },
      start: { dateTime: '2026-09-29T17:00:00-04:00' },
      end: { dateTime: '2026-09-29T18:15:00-04:00' },
      htmlLink: LINK,
    }
    const meeting = normalizeEvent(raw as RawEvent)
    expect(Object.keys(meeting!).sort()).toEqual(
      ['allDay', 'end', 'htmlLink', 'id', 'kind', 'start', 'title'].sort(),
    )
    const json = JSON.stringify(meeting)
    for (const secret of [
      'example.com',
      'rit.edu',
      'Gate code',
      'private-notes',
      'secret',
      'Sponsor',
    ]) {
      expect(json).not.toContain(secret)
    }
  })

  it('gives an untitled event a placeholder title', () => {
    expect(
      normalizeEvent({ id: 'x', start: { date: '2026-10-01' }, end: { date: '2026-10-02' } })
        ?.title,
    ).toBe('Untitled event')
  })
})

describe('classifyMeeting', () => {
  it.each([
    ['Team Meeting', 'official'],
    ['DAWN team meeting (Thursday)', 'official'],
    ['TEAM MEETING + retro', 'official'], // official wins
    ['Sprint Retro', 'retro'],
    ['sprint 4 retrospective', 'retro'],
    ['Pairing: clock screen', 'adhoc'],
    ['Team sync', 'adhoc'],
  ])('%j → %s', (title, kind) => {
    expect(classifyMeeting(title)).toBe(kind)
  })
})

describe('private key handling', () => {
  it('turns literal \\n into newlines and strips surrounding quotes', () => {
    const literal = PEM.trim().replace(/\n/g, '\\n')
    expect(literal).not.toContain('\n')
    expect(normalizePrivateKey(literal)).toBe(PEM.trim())
    expect(normalizePrivateKey(`"${literal}"`)).toBe(PEM.trim())
    expect(normalizePrivateKey(PEM.trim().replace(/\n/g, '\r\n'))).toBe(PEM.trim())
  })

  it('reads GOOGLE_SA_PRIVATE_KEY with literal \\n and signs a valid RS256 JWT with it', async () => {
    vi.stubEnv('GOOGLE_CALENDAR_ID', 'team@group.calendar.google.com')
    vi.stubEnv('GOOGLE_SA_EMAIL', 'site@dawn.iam.gserviceaccount.com')
    vi.stubEnv('GOOGLE_SA_PRIVATE_KEY', PEM.trim().replace(/\n/g, '\\n'))
    const config = getCalendarConfig()!
    let assertion = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        assertion = new URLSearchParams(String(init?.body)).get('assertion') ?? ''
        return Response.json({ access_token: 'ya29.token', expires_in: 3600 })
      }),
    )
    expect(await getServiceAccountToken(config)).toBe('ya29.token')
    expect(decodeProtectedHeader(assertion)).toMatchObject({ alg: 'RS256', typ: 'JWT' })
    expect(decodeJwt(assertion)).toMatchObject({
      iss: 'site@dawn.iam.gserviceaccount.com',
      aud: 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
    })
  })

  it('is "not connected" with no Google variables, and names missing ones when partial', () => {
    expect(getCalendarConfig()).toBeNull()
    vi.stubEnv('GOOGLE_SA_EMAIL', 'site@dawn.iam.gserviceaccount.com')
    expect(() => getCalendarConfig()).toThrow(
      'Missing required environment variable(s): GOOGLE_CALENDAR_ID, GOOGLE_SA_PRIVATE_KEY.',
    )
  })
})

/** Stubs Google: the token endpoint and events.list (returning `items`). */
function stubGoogle(items: RawEvent[], eventsStatus = 200) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: 'ya29.token', expires_in: 3600 })
    }
    if (url.startsWith('https://www.googleapis.com/calendar/v3/calendars/')) {
      return eventsStatus === 200
        ? Response.json({ items })
        : Response.json({ error: { message: 'Not Found' } }, { status: eventsStatus })
    }
    return new Response('unexpected', { status: 500 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function connect() {
  vi.stubEnv('GOOGLE_CALENDAR_ID', 'team@group.calendar.google.com')
  vi.stubEnv('GOOGLE_SA_EMAIL', 'site@dawn.iam.gserviceaccount.com')
  vi.stubEnv('GOOGLE_SA_PRIVATE_KEY', PEM)
}

const EVENTS: RawEvent[] = [
  {
    id: 'a',
    summary: 'Team Meeting',
    start: { dateTime: '2026-09-29T17:00:00-04:00' },
    end: { dateTime: '2026-09-29T18:15:00-04:00' },
    htmlLink: LINK,
  },
  { id: 'b', status: 'cancelled' },
]

describe('listMeetings', () => {
  it('asks Google to expand recurrences in Eastern time, requesting no private fields', async () => {
    connect()
    const fetchMock = stubGoogle(EVENTS)
    const meetings = await listMeetings('2026-09-28', '2026-10-04')
    expect(meetings?.map((m) => m.id)).toEqual(['a'])
    const url = new URL(String(fetchMock.mock.calls.find(([u]) => u.includes('/events'))![0]))
    expect(url.pathname).toBe('/calendar/v3/calendars/team%40group.calendar.google.com/events')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      singleEvents: 'true',
      orderBy: 'startTime',
      timeZone: 'America/New_York',
      timeMin: '2026-09-28T04:00:00.000Z', // midnight EDT
      timeMax: '2026-10-05T04:00:00.000Z', // through the end of the 4th
    })
    const fields = url.searchParams.get('fields')!
    for (const privateField of ['attendees', 'description', 'organizer', 'creator']) {
      expect(fields).not.toContain(privateField)
    }
  })

  it('caches the token and each range for 5 minutes', async () => {
    connect()
    const fetchMock = stubGoogle(EVENTS)
    await listMeetings('2026-09-28', '2026-10-04')
    await listMeetings('2026-09-28', '2026-10-04')
    await listMeetings('2026-10-05', '2026-10-11')
    const calls = (part: string) => fetchMock.mock.calls.filter(([u]) => u.includes(part)).length
    expect(calls('oauth2.googleapis.com/token')).toBe(1)
    expect(calls('/events')).toBe(2)
  })

  it('does not cache a failure', async () => {
    connect()
    stubGoogle(EVENTS, 500)
    await expect(listMeetings('2026-09-28', '2026-10-04')).rejects.toMatchObject({
      code: 'calendar-unavailable',
    })
    stubGoogle(EVENTS)
    expect(await listMeetings('2026-09-28', '2026-10-04')).toHaveLength(1)
  })

  it('reports a calendar not shared with the service account', async () => {
    connect()
    stubGoogle(EVENTS, 404)
    await expect(listMeetings('2026-09-28', '2026-10-04')).rejects.toMatchObject({
      code: 'calendar-no-access',
    })
  })

  it('is null (not connected) without Google variables', async () => {
    expect(await listMeetings('2026-09-28', '2026-10-04')).toBeNull()
  })
})

describe('GET /api/meetings', () => {
  async function call(query: Record<string, string>, signedIn = true) {
    const cookies: Record<string, string> = {}
    if (signedIn) {
      cookies.dawn_session = await encryptSession(
        { accessToken: 'ghu_test', user: { login: 'ada', name: 'Ada', avatarUrl: '' } },
        SECRET,
      )
    }
    const req = {
      method: 'GET',
      query,
      cookies,
      headers: { host: 'localhost:3000' },
    } as unknown as VercelRequest
    const out = { statusCode: 200, body: undefined as unknown }
    const res = {
      headersSent: false,
      setHeader: () => res,
      getHeader: () => undefined,
      status(code: number) {
        out.statusCode = code
        return res
      },
      json(body: unknown) {
        out.body = body
        return res
      },
    } as unknown as VercelResponse
    await handler(req, res)
    return out
  }

  beforeEach(() => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'client-id')
    vi.stubEnv('GITHUB_CLIENT_SECRET', 'client-secret')
    vi.stubEnv('SESSION_SECRET', SECRET)
    vi.stubEnv('GITHUB_ORG', 'dawn')
  })

  it('requires sign-in', async () => {
    const res = await call({ from: '2026-09-28', to: '2026-10-04' }, false)
    expect(res.statusCode).toBe(401)
  })

  it.each([
    [{ from: '2026-09-28' }, 'from and to'],
    [{ from: '2026-9-28', to: '2026-10-04' }, 'from and to'],
    [{ from: '2026-10-04', to: '2026-09-28' }, 'before'],
    [{ from: '2026-09-01', to: '2026-11-03' }, 'at most 62'],
  ])('rejects %j', async (query, message) => {
    const res = await call(query)
    expect(res.statusCode).toBe(400)
    expect(JSON.stringify(res.body)).toContain(message)
  })

  it('allows exactly 62 days', async () => {
    const res = await call({ from: '2026-09-01', to: '2026-11-02' })
    expect(res.statusCode).toBe(200)
  })

  it('says "not connected" without Google variables', async () => {
    const res = await call({ from: '2026-09-28', to: '2026-10-04' })
    expect(res.body).toEqual({
      connected: false,
      from: '2026-09-28',
      to: '2026-10-04',
      meetings: [],
    })
  })

  it('returns normalized meetings', async () => {
    connect()
    stubGoogle(EVENTS)
    const res = await call({ from: '2026-09-28', to: '2026-10-04' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ connected: true, meetings: [{ id: 'a', kind: 'official' }] })
  })

  it('maps a Google failure to a safe error', async () => {
    connect()
    stubGoogle(EVENTS, 404)
    const res = await call({ from: '2026-09-28', to: '2026-10-04' })
    expect(res.statusCode).toBe(502)
    expect(res.body).toMatchObject({ error: { code: 'calendar-no-access' } })
    expect(JSON.stringify(res.body)).not.toContain('Not Found')
  })
})
