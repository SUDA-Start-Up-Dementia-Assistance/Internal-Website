import { coach, members, sponsor, type Person } from '../../config/team'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const PEOPLE: Person[] = [sponsor, coach, ...members]

export default function TeamStrip() {
  return (
    <section aria-labelledby="team-title">
      <h2 id="team-title" className="text-2xl font-semibold">
        The team
      </h2>
      <ul className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {PEOPLE.map((person, i) => (
          <li key={`${person.name}-${i}`} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-11 items-center justify-center rounded-full bg-lavender/25 text-sm font-semibold text-night"
            >
              {initials(person.name)}
            </span>
            <span className="flex flex-col">
              <span className="font-medium">{person.name}</span>
              <span className="text-sm text-dusk">{person.role}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
