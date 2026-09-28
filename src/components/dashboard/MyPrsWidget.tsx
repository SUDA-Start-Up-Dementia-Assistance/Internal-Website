import { GitPullRequestDraft } from 'lucide-react'
import { repoRef, type DashboardQuery, type MyPr } from '../../lib/dashboard'
import { expectedBase } from '../../lib/prRules'
import EmptyState from '../EmptyState'
import Skeleton from '../Skeleton'
import { CiStatus, PrTitleLink, Tag, Warning } from './PrBits'
import { CountBadge, WidgetBody, WidgetCard } from './Widget'

export default function MyPrsWidget({ query }: { query: DashboardQuery }) {
  const prs = query.data?.myPrs
  const count = Array.isArray(prs) ? prs.length : undefined
  return (
    <WidgetCard
      id="my-prs"
      title="My pull requests"
      icon={GitPullRequestDraft}
      badge={count !== undefined && <CountBadge count={count} label={`${count} open`} />}
    >
      <WidgetBody
        query={query}
        value={prs}
        skeleton={
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        }
      >
        {(list) =>
          list.length === 0 ? (
            <EmptyState>You don&apos;t have any open pull requests.</EmptyState>
          ) : (
            <ul className="divide-y divide-night/10">
              {list.map((pr) => (
                <MyPrRow key={pr.id} pr={pr} />
              ))}
            </ul>
          )
        }
      </WidgetBody>
    </WidgetCard>
  )
}

function baseWarning(pr: MyPr): string | null {
  if (pr.targetsCorrectBase) return null
  if (pr.baseRefName === 'main') return 'Targets main directly'
  const expected = expectedBase(pr.headRefName)
  return expected ? `Should target ${expected}` : `Opened from ${pr.headRefName}`
}

function MyPrRow({ pr }: { pr: MyPr }) {
  const approved = pr.reviewsApproved >= pr.requiredReviewers
  const base = baseWarning(pr)
  return (
    <li className="py-3">
      <p className="text-xs text-dusk">
        {repoRef(pr)} <span aria-hidden="true">·</span> {pr.headRefName} → {pr.baseRefName}
      </p>
      <PrTitleLink pr={pr} />
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        {pr.isDraft && <Tag>Draft</Tag>}
        <CiStatus state={pr.ciState} />
        <span className={approved ? 'font-medium text-status-green-text' : 'text-dusk'}>
          {pr.reviewsApproved}/{pr.requiredReviewers} approvals
        </span>
        {pr.changesRequested > 0 && (
          <span className="rounded-full bg-status-red-bg px-2 py-0.5 font-medium text-status-red-text">
            Changes requested
          </span>
        )}
        {!pr.hasDemoVideo && <Warning>No demo video</Warning>}
        {base && <Warning>{base}</Warning>}
      </div>
    </li>
  )
}
