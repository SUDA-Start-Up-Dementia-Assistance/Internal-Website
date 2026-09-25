export interface Person {
  name: string
  role: string
}

export const sponsor: Person = { name: 'Gerry Garavuso', role: 'Sponsor' }

export const coach: Person = { name: 'Drew Saur', role: 'Faculty coach' }

export const members: Person[] = [
  { name: 'Tess Hacker', role: 'Developer' },
  { name: 'Ashton Michelstein', role: 'Developer' },
  { name: 'Jay Doody', role: 'Developer' },
  { name: 'Haroon Aziz', role: 'Developer' },
  { name: 'Alex Bruno', role: 'Developer' },
  { name: 'David Holt', role: 'Developer' },
]
