import { UserRound } from 'lucide-react'
import { useId } from 'react'
import {
  groupByAssignee,
  sumTotals,
  type AssigneeGroup,
  type Task,
  type TaskMeta,
  type TeamMember,
} from '../../lib/tasks'
import Avatar from '../Avatar'
import TaskRow from './TaskRow'

interface TeamTasksProps {
  /** Already filtered, open tasks only. */
  tasks: Task[]
  team: TeamMember[]
  meta: TaskMeta
  showIteration: boolean
}

/** One section per member: their open tasks (Blocked first) and open points/hours. */
export default function TeamTasks({ tasks, team, meta, showIteration }: TeamTasksProps) {
  const groups = groupByAssignee(tasks, team)
  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <MemberSection
          key={group.member?.login ?? '(unassigned)'}
          group={group}
          meta={meta}
          team={team}
          showIteration={showIteration}
        />
      ))}
    </div>
  )
}

function MemberSection({
  group,
  meta,
  team,
  showIteration,
}: {
  group: AssigneeGroup
  meta: TaskMeta
  team: TeamMember[]
  showIteration: boolean
}) {
  const headingId = useId()
  const { member, tasks } = group
  const totals = sumTotals(tasks)
  const summary = [
    `${tasks.length} open`,
    meta.storyPointOptions && `${totals.storyPoints} pts`,
    meta.hasEstimate && `${totals.estimateHours}h estimated`,
  ].filter(Boolean)

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {member ? (
          <Avatar person={member} size="md" />
        ) : (
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-night/5 text-dusk">
            <UserRound aria-hidden="true" className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          <h2 id={headingId} className="text-xl font-semibold">
            {member ? member.name : 'Unassigned'}
          </h2>
          {member && member.name !== member.login && (
            <p className="text-sm text-dusk">@{member.login}</p>
          )}
        </div>
        <p className="ml-auto text-sm font-medium text-dusk">{summary.join(' · ')}</p>
      </div>
      {tasks.length === 0 ? (
        <p className="mt-3 text-sm text-dusk">No open tasks.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {tasks.map((task) => (
            <TaskRow
              key={task.itemId}
              task={task}
              meta={meta}
              team={team}
              showIteration={showIteration}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
