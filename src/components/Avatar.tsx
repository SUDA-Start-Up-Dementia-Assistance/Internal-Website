interface AvatarProps {
  person: { name: string; avatarUrl: string }
  size: 'sm' | 'md'
}

/** A round GitHub avatar, or initials on lavender when there's no image. Decorative. */
export default function Avatar({ person, size }: AvatarProps) {
  const box = size === 'md' ? 'size-10 text-sm' : 'size-8 text-xs'
  if (person.avatarUrl) {
    return (
      <img src={person.avatarUrl} alt="" className={`${box} shrink-0 rounded-full bg-cream/20`} />
    )
  }
  const initials = person.name
    .split(/[\s_-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      aria-hidden="true"
      // Solid lavender: night initials are 4.96:1 on it, on the dark navbar or a white card.
      className={`${box} inline-flex shrink-0 items-center justify-center rounded-full bg-lavender font-semibold text-night`}
    >
      {initials}
    </span>
  )
}
