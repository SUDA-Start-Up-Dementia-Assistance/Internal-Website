import { TASKS_MOCK } from '../config/tasks'

/*
 * Whether the Tasks UI runs on sample data instead of /api: always with VITE_TASKS_MOCK=true
 * (dev only), and on deployments where the server says sign-in isn't configured (Vercel
 * previews). It only ever switches on, before any task data loads; production always has
 * sign-in configured (the server refuses to run without it), so it never gets here.
 */
let enabled = TASKS_MOCK

export function isSampleMode(): boolean {
  return enabled
}

export function enableSampleMode(): void {
  enabled = true
}
