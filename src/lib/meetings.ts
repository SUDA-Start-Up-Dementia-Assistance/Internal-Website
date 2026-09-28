import { useCallback, useEffect, useMemo, useState } from 'react'
import { isSourceConfigured } from '../config/sources'
import { useFeed } from './drive/hooks'
import { toDateKey } from './drive/parse'
import type { FeedItem } from './drive/types'
import { meetingDateKey } from './meetingTime'
import { mockMeetings } from './meetingsMock'
import { isSampleMode } from './sampleMode'
import { hasKey, request, TasksError } from './tasks/api'

/*
 * Team meetings from the "DAWN Team" Google Calendar, via /api/meetings. Not to be confused
 * with the Drive "meetings" in src/lib/drive (an Agenda and 4Up sharing a date):
 * joinAgendas links the two.
 */

export type MeetingKind = 'official' | 'retro' | 'adhoc'

/** Mirrors api/_lib/google/calendar.ts: keep the two in sync. */
export interface Meeting {
  id: string
  title: string
  /** Timed: an ISO instant. All-day: "YYYY-MM-DD". */
  start: string
  /** Timed: an ISO instant. All-day: "YYYY-MM-DD", exclusive. */
  end: string
  allDay: boolean
  /** Decides agenda linking (official only). Not shown as a tag, except Retro. */
  kind: MeetingKind
  /** One occurrence of a repeating series in Google Calendar: tagged "Recurring". */
  recurring: boolean
  joinUrl?: string
  /** The event in Google Calendar ("Details"). */
  htmlLink: string
}

/** Mirrors api/meetings.ts. */
export interface MeetingsResponse {
  /** False when the calendar isn't set up on this deployment: show "Calendar not connected". */
  connected: boolean
  from: string
  /** Inclusive. */
  to: string
  meetings: Meeting[]
}

/** An official meeting's Drive docs: the feed item for its date, or null (not posted yet). */
export interface MeetingDocs {
  agenda?: FeedItem | null
  fourUp?: FeedItem | null
}

/**
 * A meeting with its agenda and 4Up. Official meetings have `agenda` / `fourUp` once that
 * feed has loaded: the feed item with the same America/New_York date, or null ("not posted
 * yet"). Retro and ad hoc meetings never have either key, so they never show doc state.
 */
export type JoinedMeeting = Meeting & MeetingDocs

export { isUpcoming, meetingDateKey, meetingEnd, meetingStart } from './meetingTime'

/** Feed items by their date ("YYYY-MM-DD" filename prefix, a local calendar date). */
function byDate(feed: readonly FeedItem[]): Map<string, FeedItem> {
  const map = new Map<string, FeedItem>()
  for (const item of feed) {
    const key = toDateKey(item.date)
    if (!map.has(key)) map.set(key, item)
  }
  return map
}

/**
 * Attaches agendas and 4Ups to OFFICIAL meetings by date (America/New_York). A feed that's
 * left out (not loaded yet, or not configured) adds no key, so nothing shows for it.
 */
export function joinAgendas<T extends Meeting>(
  meetings: readonly T[],
  agendaFeed?: readonly FeedItem[],
  fourUpFeed?: readonly FeedItem[],
): (T & MeetingDocs)[] {
  const agendas = agendaFeed && byDate(agendaFeed)
  const fourUps = fourUpFeed && byDate(fourUpFeed)
  return meetings.map((meeting) => {
    if (meeting.kind !== 'official') return meeting
    const key = meetingDateKey(meeting)
    const joined: T & MeetingDocs = { ...meeting }
    if (agendas) joined.agenda = agendas.get(key) ?? null
    if (fourUps) joined.fourUp = fourUps.get(key) ?? null
    return joined
  })
}

/**
 * `meetings` with agendas and 4Ups joined, once each feed has loaded (they share one Drive
 * folder, so one request). Until then, or when a feed's folder isn't configured, that doc
 * shows nothing rather than a wrong "not posted yet".
 */
export function useWithAgendas<T extends Meeting>(
  meetings: readonly T[] | undefined,
): (T & MeetingDocs)[] | undefined {
  const agendas = useFeed('agendas')
  const fourUps = useFeed('fourUps')
  const agendaFeed = isSourceConfigured('agendas') ? agendas.data : undefined
  const fourUpFeed = isSourceConfigured('fourUps') ? fourUps.data : undefined
  return useMemo(
    () => meetings && joinAgendas(meetings, agendaFeed, fourUpFeed),
    [meetings, agendaFeed, fourUpFeed],
  )
}

export function fetchMeetings(from: string, to: string): Promise<MeetingsResponse> {
  const query = new URLSearchParams({ from, to })
  return request(
    `/api/meetings?${query}`,
    {},
    hasKey('meetings'),
    "We couldn't load the team calendar right now.",
  )
}

const load = (from: string, to: string) =>
  isSampleMode() ? Promise.resolve(mockMeetings(from, to)) : fetchMeetings(from, to)

export interface MeetingsQuery {
  data: MeetingsResponse | undefined
  loading: boolean
  error: TasksError | null
  refetch: () => void
}

/**
 * Calendar meetings from `from` through `to` ("YYYY-MM-DD", inclusive, at most 62 days
 * apart). Uses mock meetings in sample mode (VITE_TASKS_MOCK or a preview deployment).
 */
export function useMeetings(from: string, to: string): MeetingsQuery {
  const [attempt, setAttempt] = useState(0)
  const key = `${from}|${to}#${attempt}`
  const [settled, setSettled] = useState<{
    key: string
    data?: MeetingsResponse
    error: TasksError | null
  }>()

  useEffect(() => {
    let cancelled = false
    load(from, to).then(
      (data) => {
        if (!cancelled) setSettled({ key, data, error: null })
      },
      (err: unknown) => {
        if (cancelled) return
        const error =
          err instanceof TasksError
            ? err
            : new TasksError('unknown', "We couldn't load the team calendar right now.")
        setSettled({ key, error })
      },
    )
    return () => {
      cancelled = true
    }
  }, [from, to, key])

  const refetch = useCallback(() => setAttempt((n) => n + 1), [])
  const current = settled?.key === key ? settled : undefined
  return {
    data: current?.data,
    loading: current === undefined,
    error: current?.error ?? null,
    refetch,
  }
}
