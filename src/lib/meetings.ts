import { useCallback, useEffect, useState } from 'react'
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
  kind: MeetingKind
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

/**
 * A meeting with its agenda. Official meetings always have `agenda`: the Agendas feed item
 * with the same America/New_York date, or null ("Agenda not posted yet"). Retro and ad hoc
 * meetings never have the key at all, so they never show agenda state.
 */
export type JoinedMeeting = Meeting & { agenda?: FeedItem | null }

export { isUpcoming, meetingDateKey, meetingEnd, meetingStart } from './meetingTime'

/** Attaches agendas to OFFICIAL meetings by date (America/New_York). */
export function joinAgendas(
  meetings: readonly Meeting[],
  agendaFeed: readonly FeedItem[],
): JoinedMeeting[] {
  // Feed dates come from "YYYY-MM-DD Agenda" filenames, parsed as local calendar dates.
  const byDate = new Map<string, FeedItem>()
  for (const item of agendaFeed) {
    const key = toDateKey(item.date)
    if (!byDate.has(key)) byDate.set(key, item)
  }
  return meetings.map((meeting) =>
    meeting.kind === 'official'
      ? { ...meeting, agenda: byDate.get(meetingDateKey(meeting)) ?? null }
      : meeting,
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
