import { describe, expect, it } from 'vitest'
import { zonedInstant } from '../../../src/lib/teamTime.js'
import {
  ciStateOf,
  normalizePr,
  toMyPr,
  toReviewQueuePr,
  waitingSinceFor,
  type RawPullRequest,
} from './pulls.js'

function rawPr(overrides: Partial<RawPullRequest> = {}): RawPullRequest {
  return {
    __typename: 'PullRequest',
    id: 'PR_1',
    title: 'Bigger clock font',
    url: 'https://github.com/dawn/app/pull/12',
    number: 12,
    isDraft: false,
    createdAt: '2026-09-25T14:00:00Z',
    baseRefName: 'canary',
    headRefName: 'feature/clock-font',
    body: null,
    repository: { nameWithOwner: 'dawn/app' },
    author: { login: 'ada' },
    reviewRequests: null,
    latestReviews: null,
    timelineItems: null,
    commits: null,
    ...overrides,
  }
}

describe('normalizePr', () => {
  it('handles a PR with no reviews, requests, or checks', () => {
    expect(normalizePr(rawPr())).toEqual({
      id: 'PR_1',
      title: 'Bigger clock font',
      url: 'https://github.com/dawn/app/pull/12',
      repo: 'dawn/app',
      number: 12,
      author: 'ada',
      authorAvatarUrl: null,
      isDraft: false,
      createdAt: '2026-09-25T14:00:00Z',
      baseRefName: 'canary',
      headRefName: 'feature/clock-font',
      requestedReviewers: [],
      reviews: [],
      reviewerCount: 0,
      requiredReviewers: 2,
      hasDemoVideo: false,
      ciState: null,
      targetsCorrectBase: true,
    })
  })

  it('counts requested and submitted reviewers once each, never the author', () => {
    const pr = normalizePr(
      rawPr({
        body: 'Demo: https://www.loom.com/share/abc123',
        reviewRequests: {
          nodes: [
            { requestedReviewer: { __typename: 'User', login: 'grace' } },
            {
              requestedReviewer: {
                __typename: 'Team',
                slug: 'reviewers',
                organization: { login: 'dawn' },
              },
            },
            null,
          ],
        },
        latestReviews: {
          nodes: [
            { state: 'APPROVED', submittedAt: '2026-09-26T10:00:00Z', author: { login: 'linus' } },
            { state: 'COMMENTED', submittedAt: '2026-09-26T11:00:00Z', author: { login: 'Grace' } },
            { state: 'COMMENTED', submittedAt: '2026-09-26T12:00:00Z', author: { login: 'ada' } },
          ],
        },
        commits: { nodes: [{ commit: { statusCheckRollup: { state: 'SUCCESS' } } }] },
      }),
    )
    expect(pr.requestedReviewers).toEqual(['grace', 'dawn/reviewers'])
    // grace (requested + commented), dawn/reviewers, linus. The author's own comment doesn't count.
    expect(pr.reviewerCount).toBe(3)
    expect(pr.reviews).toHaveLength(3)
    expect(pr.hasDemoVideo).toBe(true)
    expect(pr.ciState).toBe('SUCCESS')
  })

  it('flags a feature branch that targets main', () => {
    expect(normalizePr(rawPr({ baseRefName: 'main' })).targetsCorrectBase).toBe(false)
    expect(
      normalizePr(rawPr({ headRefName: 'canary', baseRefName: 'main' })).targetsCorrectBase,
    ).toBe(true)
  })

  it('never exposes the PR body', () => {
    const pr = normalizePr(rawPr({ body: 'secret staging password: hunter2' }))
    expect(JSON.stringify(pr)).not.toContain('hunter2')
  })
})

describe('ciStateOf', () => {
  it.each([
    ['SUCCESS', 'SUCCESS'],
    ['FAILURE', 'FAILURE'],
    ['ERROR', 'FAILURE'],
    ['PENDING', 'PENDING'],
    ['EXPECTED', 'PENDING'],
    [null, null],
    [undefined, null],
  ])('%s → %s', (rollup, state) => {
    expect(ciStateOf(rollup)).toBe(state)
  })
})

describe('review queue', () => {
  const requested = (login: string, createdAt: string) => ({
    createdAt,
    requestedReviewer: { __typename: 'User', login },
  })

  it('waits since my latest review request', () => {
    const raw = rawPr({
      timelineItems: {
        nodes: [
          requested('me', '2026-09-26T13:00:00Z'),
          requested('someone', '2026-09-28T09:00:00Z'),
          requested('ME', '2026-09-28T15:00:00Z'), // re-requested
        ],
      },
    })
    expect(waitingSinceFor(raw, 'me')).toBe('2026-09-28T15:00:00Z')
  })

  it('falls back to the PR creation time (e.g. requested via a team)', () => {
    expect(waitingSinceFor(rawPr(), 'me')).toBe('2026-09-25T14:00:00Z')
  })

  it('is past the SLA a full business day after the request', () => {
    // Requested Friday 2026-10-02 at 4pm Eastern.
    const raw = rawPr({ timelineItems: { nodes: [requested('me', '2026-10-02T20:00:00Z')] } })
    expect(toReviewQueuePr(raw, 'me', zonedInstant('2026-10-05', 15, 59)).isPastSla).toBe(false)
    expect(toReviewQueuePr(raw, 'me', zonedInstant('2026-10-05', 16)).isPastSla).toBe(true)
  })
})

describe('toMyPr', () => {
  it('counts approvals and change requests', () => {
    const pr = toMyPr(
      rawPr({
        isDraft: true,
        latestReviews: {
          nodes: [
            { state: 'APPROVED', submittedAt: null, author: { login: 'grace' } },
            { state: 'CHANGES_REQUESTED', submittedAt: null, author: { login: 'linus' } },
            { state: 'APPROVED', submittedAt: null, author: { login: 'margaret' } },
          ],
        },
        commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] },
      }),
    )
    expect(pr).toMatchObject({
      isDraft: true,
      reviewsApproved: 2,
      changesRequested: 1,
      reviewerCount: 3,
      ciState: 'FAILURE',
    })
  })

  it('has zero counts with no reviews', () => {
    expect(toMyPr(rawPr())).toMatchObject({ reviewsApproved: 0, changesRequested: 0 })
  })
})
