/*
 * The team's pull-request process, as the Developer dashboard checks it. Shared by the
 * browser and the server (/api/dashboard), so keep this file free of browser-only code.
 */

/** Every PR needs this many reviewers. */
export const REQUIRED_REVIEWERS = 2

/** A requested review is late after this many business days (Mon–Fri, America/New_York). */
export const REVIEW_SLA_BUSINESS_DAYS = 1

/**
 * A PR description must include a demo video. Any of these counts: a linked or attached
 * video file, YouTube, Loom, Google Drive, or a GitHub upload (github.com/user-attachments).
 * Images don't count, even when they're GitHub uploads: see hasDemoVideo in src/lib/prRules.
 */
export const DEMO_VIDEO_PATTERNS: readonly RegExp[] = [
  /\.(mp4|mov|webm)(?=$|[?#)\s"'>\]])/i,
  /\b(?:www\.|m\.)?youtube\.com\/(?:watch|shorts|embed|live)\b/i,
  /\byoutu\.be\//i,
  /\bloom\.com\/(?:share|embed)\//i,
  /\bdrive\.google\.com\//i,
  /\bgithub\.com\/user-attachments\/assets\//i,
]

/**
 * Branch flow: feature branch → canary → main. The base each head branch must target;
 * anything not named here is a feature branch and targets `featureBase`.
 */
export const BRANCH_FLOW = {
  /** Where feature branches merge. */
  featureBase: 'canary',
  /** Head branch → the only base it may target. */
  promotions: { canary: 'main' } as Record<string, string>,
  /** Branches that are never a PR's head (nothing merges out of main). */
  terminal: ['main'] as readonly string[],
} as const
