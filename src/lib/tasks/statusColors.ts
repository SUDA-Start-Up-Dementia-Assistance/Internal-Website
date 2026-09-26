import type { StatusOption, Task, TaskMeta } from './types'

/** GitHub's single-select option colors (ProjectV2SingleSelectFieldOptionColor). */
export const STATUS_COLORS = [
  'GRAY',
  'BLUE',
  'GREEN',
  'YELLOW',
  'ORANGE',
  'RED',
  'PINK',
  'PURPLE',
] as const

export type StatusColor = (typeof STATUS_COLORS)[number]

export interface StatusColorTokens {
  /** Pill background. */
  bg: string
  /** Label text (and icon). */
  text: string
  /** The solid dot, in the text color. */
  dot: string
}

/**
 * Tailwind classes for each GitHub color, from the status tokens in src/index.css. Written
 * out in full so Tailwind finds them when scanning the source.
 */
export const statusColorTokens: Record<StatusColor, StatusColorTokens> = {
  GRAY: { bg: 'bg-status-gray-bg', text: 'text-status-gray-text', dot: 'bg-status-gray-text' },
  BLUE: { bg: 'bg-status-blue-bg', text: 'text-status-blue-text', dot: 'bg-status-blue-text' },
  GREEN: { bg: 'bg-status-green-bg', text: 'text-status-green-text', dot: 'bg-status-green-text' },
  YELLOW: {
    bg: 'bg-status-yellow-bg',
    text: 'text-status-yellow-text',
    dot: 'bg-status-yellow-text',
  },
  ORANGE: {
    bg: 'bg-status-orange-bg',
    text: 'text-status-orange-text',
    dot: 'bg-status-orange-text',
  },
  RED: { bg: 'bg-status-red-bg', text: 'text-status-red-text', dot: 'bg-status-red-text' },
  PINK: { bg: 'bg-status-pink-bg', text: 'text-status-pink-text', dot: 'bg-status-pink-text' },
  PURPLE: {
    bg: 'bg-status-purple-bg',
    text: 'text-status-purple-text',
    dot: 'bg-status-purple-text',
  },
}

/** A GitHub color name → a known StatusColor; unknown or missing → GRAY. */
export function normalizeStatusColor(color: string | null | undefined): StatusColor {
  const upper = color?.trim().toUpperCase()
  return STATUS_COLORS.find((c) => c === upper) ?? 'GRAY'
}

export function tokensForStatusColor(color: string | null | undefined): StatusColorTokens {
  return statusColorTokens[normalizeStatusColor(color)]
}

/**
 * The status option (with its color) for a task. Falls back to the task's own name and key
 * when the option isn't in meta (e.g. renamed since meta was cached).
 */
export function statusOptionOf(
  task: Task,
  meta: Pick<TaskMeta, 'statuses'>,
): Pick<StatusOption, 'name' | 'key' | 'color'> | null {
  if (!task.status) return null
  const option = meta.statuses.find((s) => s.name === task.status)
  return option ?? { name: task.status, key: task.statusKey }
}
