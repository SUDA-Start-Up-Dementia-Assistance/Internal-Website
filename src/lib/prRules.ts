// Shared with /api (Node ESM): relative imports keep their .js extension.
import { BRANCH_FLOW, DEMO_VIDEO_PATTERNS } from '../config/process.js'

/*
 * The team's pull-request rules from src/config/process.ts, as pure functions. Shared by the
 * browser and /api/dashboard.
 */

/** Markdown images `![alt](url)` and HTML <img> tags: uploads that aren't videos. */
const IMAGES = /!\[[^\]]*\]\([^)]*\)|<img\b[^>]*>/gi

/**
 * Whether a PR description includes a demo video: a video link or a GitHub video upload.
 * GitHub uploads images to the same github.com/user-attachments URLs as videos, so images
 * are removed before matching.
 */
export function hasDemoVideo(body: string | null | undefined): boolean {
  if (!body) return false
  const withoutImages = body.replace(IMAGES, ' ')
  return DEMO_VIDEO_PATTERNS.some((pattern) => pattern.test(withoutImages))
}

/**
 * The base branch a PR from `headRef` must target: canary → main, feature branches →
 * canary. Null when the head may never be a PR's head (main).
 */
export function expectedBase(headRef: string): string | null {
  if (BRANCH_FLOW.terminal.includes(headRef)) return null
  return BRANCH_FLOW.promotions[headRef] ?? BRANCH_FLOW.featureBase
}

/** Feature → canary → main. Anything else (e.g. a feature branch straight into main) is flagged. */
export function targetsCorrectBase(headRef: string, baseRef: string): boolean {
  const expected = expectedBase(headRef)
  return expected !== null && expected === baseRef
}
