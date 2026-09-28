import { SignJWT, importPKCS8 } from 'jose'
import { OFFICIAL_MEETING_KEYWORD, RETRO_KEYWORD } from '../../../src/config/meetings.js'
import { TEAM_TIME_ZONE, addDaysToDateKey, zonedMidnight } from '../../../src/lib/teamTime.js'
import { getCalendarConfig, type CalendarConfig } from '../env.js'

/*
 * Reads the shared "DAWN Team" Google Calendar with a service account: a JWT signed with
 * jose (RS256) is exchanged for an access token, cached until 5 minutes before it expires.
 * The site never writes to the calendar.
 *
 * Privacy: events can carry attendee emails, descriptions, and organizer info (private notes,
 * links). Those are never requested (see EVENT_FIELDS) and never copied into a Meeting.
 */

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const TOKEN_MARGIN_MS = 5 * 60 * 1000
const RANGE_CACHE_MS = 5 * 60 * 1000
const MAX_CACHED_RANGES = 50
const MAX_PAGES = 10

export type MeetingKind = 'official' | 'retro' | 'adhoc'

/** A calendar event as the site shows it. Mirrored in src/lib/meetings.ts. */
export interface Meeting {
  id: string
  title: string
  /** Timed: an ISO instant. All-day: "YYYY-MM-DD". */
  start: string
  /** Timed: an ISO instant. All-day: "YYYY-MM-DD", exclusive (the day after it ends). */
  end: string
  allDay: boolean
  kind: MeetingKind
  /** Google Meet / video link, when the event has one. */
  joinUrl?: string
  /** The event in Google Calendar ("Details"). */
  htmlLink: string
}

/** A failed calendar call. `detail` is for server logs only; never send it to the client. */
export class CalendarError extends Error {
  readonly status: number
  readonly code: 'calendar-no-access' | 'calendar-unavailable'
  readonly detail: string

  constructor(code: CalendarError['code'], status: number, detail: string) {
    super(
      code === 'calendar-no-access'
        ? "The site can't read the team calendar. Share it with the site's service account."
        : "We couldn't read the team calendar right now. Please try again.",
    )
    this.name = 'CalendarError'
    this.code = code
    this.status = status
    this.detail = detail
  }
}

// ─── Normalization ───────────────────────────────────────────────────────────

/** Only what normalization needs. Attendees, description, organizer are never requested. */
const EVENT_FIELDS =
  'items(id,status,summary,start,end,hangoutLink,conferenceData/entryPoints,location,htmlLink),nextPageToken'

interface RawEventTime {
  date?: string
  dateTime?: string
}

/** A Google Calendar event (only the fields we read are typed; anything else is ignored). */
export interface RawEvent {
  id?: string
  status?: string
  summary?: string
  start?: RawEventTime
  end?: RawEventTime
  hangoutLink?: string
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] }
  location?: string
  htmlLink?: string
}

const contains = (text: string, keyword: string) =>
  keyword !== '' && text.toLowerCase().includes(keyword.toLowerCase())

/** official if the title has the official keyword, else retro if it has the retro keyword. */
export function classifyMeeting(title: string): MeetingKind {
  if (contains(title, OFFICIAL_MEETING_KEYWORD)) return 'official'
  if (contains(title, RETRO_KEYWORD)) return 'retro'
  return 'adhoc'
}

/** An https URL, or undefined. Keeps javascript: and other schemes out of links. */
function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

const URL_IN_TEXT = /https:\/\/[^\s<>"')]+/i

function joinUrlOf(event: RawEvent): string | undefined {
  const video = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')
  const fromLocation = event.location ? URL_IN_TEXT.exec(event.location)?.[0] : undefined
  return httpsUrl(event.hangoutLink) ?? httpsUrl(video?.uri) ?? httpsUrl(fromLocation)
}

/**
 * A Meeting built field by field from an allow-list, or null for cancelled or malformed
 * events. Nothing else from the raw event is ever copied.
 */
export function normalizeEvent(event: RawEvent): Meeting | null {
  if (event.status === 'cancelled' || !event.id) return null
  const allDay = Boolean(event.start?.date) && !event.start?.dateTime
  const start = allDay ? event.start?.date : event.start?.dateTime
  const end = allDay ? event.end?.date : event.end?.dateTime
  if (!start || !end) return null
  const title = event.summary?.trim() || 'Untitled event'
  const meeting: Meeting = {
    id: event.id,
    title,
    start,
    end,
    allDay,
    kind: classifyMeeting(title),
    htmlLink: httpsUrl(event.htmlLink) ?? 'https://calendar.google.com/calendar/',
  }
  const joinUrl = joinUrlOf(event)
  if (joinUrl) meeting.joinUrl = joinUrl
  return meeting
}

// ─── Service-account access token ────────────────────────────────────────────

let tokenCache: { key: string; expiresAt: number; promise: Promise<string> } | null = null

/** For tests. */
export function clearCalendarCaches(): void {
  tokenCache = null
  rangeCache.clear()
}

/** An access token for the service account, reused until 5 minutes before it expires. */
export function getServiceAccountToken(config: CalendarConfig, now = Date.now()): Promise<string> {
  const key = config.serviceAccountEmail
  if (tokenCache && tokenCache.key === key && tokenCache.expiresAt - TOKEN_MARGIN_MS > now) {
    return tokenCache.promise
  }
  const entry = { key, expiresAt: Number.POSITIVE_INFINITY, promise: Promise.resolve('') }
  entry.promise = fetchServiceAccountToken(config).then(
    ({ token, expiresIn }) => {
      entry.expiresAt = Date.now() + expiresIn * 1000
      return token
    },
    (err: unknown) => {
      if (tokenCache === entry) tokenCache = null
      throw err
    },
  )
  tokenCache = entry
  return entry.promise
}

async function fetchServiceAccountToken(
  config: CalendarConfig,
): Promise<{ token: string; expiresIn: number }> {
  let assertion: string
  try {
    const key = await importPKCS8(config.privateKey, 'RS256')
    assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(config.serviceAccountEmail)
      .setAudience(TOKEN_URL)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(key)
  } catch (err) {
    // A malformed key: the env var, not Google, is at fault.
    throw new CalendarError(
      'calendar-unavailable',
      500,
      `bad GOOGLE_SA_PRIVATE_KEY: ${String(err)}`,
    )
  }

  let res: Response
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    })
  } catch (err) {
    throw new CalendarError('calendar-unavailable', 0, `token network: ${String(err)}`)
  }
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
  }
  if (!res.ok || !body.access_token) {
    throw new CalendarError('calendar-unavailable', res.status, `token: ${body.error ?? ''}`)
  }
  return { token: body.access_token, expiresIn: body.expires_in ?? 3600 }
}

// ─── Events ──────────────────────────────────────────────────────────────────

const rangeCache = new Map<string, { expires: number; promise: Promise<Meeting[]> }>()

/**
 * Meetings overlapping [fromKey 00:00, throughKey 24:00) America/New_York, in start order.
 * Calendar data is team-wide, so results are cached per range (not per user) for 5 minutes.
 * Null when the calendar isn't connected (no Google env vars).
 */
export async function listMeetings(fromKey: string, throughKey: string): Promise<Meeting[] | null> {
  const config = getCalendarConfig()
  if (!config) return null
  const cacheKey = `${config.calendarId}|${fromKey}|${throughKey}`
  const cached = rangeCache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.promise

  const promise = fetchMeetings(config, fromKey, throughKey)
  rangeCache.set(cacheKey, { expires: Date.now() + RANGE_CACHE_MS, promise })
  // Never cache a failure; keep the cache small.
  promise.catch(() => {
    if (rangeCache.get(cacheKey)?.promise === promise) rangeCache.delete(cacheKey)
  })
  if (rangeCache.size > MAX_CACHED_RANGES) {
    const oldest = rangeCache.keys().next().value
    if (oldest !== undefined) rangeCache.delete(oldest)
  }
  return promise
}

async function fetchMeetings(
  config: CalendarConfig,
  fromKey: string,
  throughKey: string,
): Promise<Meeting[]> {
  const token = await getServiceAccountToken(config)
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`
  const meetings: Meeting[] = []
  let pageToken: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      // Google expands recurring events and applies cancelled/moved occurrences.
      singleEvents: 'true',
      orderBy: 'startTime',
      timeZone: TEAM_TIME_ZONE,
      timeMin: zonedMidnight(fromKey).toISOString(),
      timeMax: zonedMidnight(addDaysToDateKey(throughKey, 1)).toISOString(),
      maxResults: '250',
      fields: EVENT_FIELDS,
    })
    if (pageToken) params.set('pageToken', pageToken)

    let res: Response
    try {
      res = await fetch(`${base}?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    } catch (err) {
      throw new CalendarError('calendar-unavailable', 0, `events network: ${String(err)}`)
    }
    const body = (await res.json().catch(() => ({}))) as {
      items?: RawEvent[]
      nextPageToken?: string
      error?: { message?: string }
    }
    if (!res.ok) {
      // 403/404: the calendar isn't shared with the service account (or the id is wrong).
      const code =
        res.status === 403 || res.status === 404 ? 'calendar-no-access' : 'calendar-unavailable'
      throw new CalendarError(code, res.status, `events: ${body.error?.message ?? ''}`)
    }
    for (const event of body.items ?? []) {
      const meeting = normalizeEvent(event)
      if (meeting) meetings.push(meeting)
    }
    pageToken = body.nextPageToken
    if (!pageToken) break
  }
  return meetings
}
