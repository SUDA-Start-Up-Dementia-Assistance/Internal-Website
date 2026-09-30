interface AvatarProps {
  person: { name: string; avatarUrl: string }
  size: 'xs' | 'sm' | 'md'
}

const BOX = { xs: 'size-6 text-[0.625rem]', sm: 'size-8 text-xs', md: 'size-10 text-sm' }

/** A round GitHub avatar, or initials on purple when there's no image. Decorative. */
export default function Avatar({ person, size }: AvatarProps) {
  const box = BOX[size]
  if (person.avatarUrl) {
    return (
      <img src={person.avatarUrl} alt="" className={`${box} shrink-0 rounded-full bg-ink/10`} />
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
      // Status-purple tokens: at least 5.4:1 in both themes.
      className={`${box} inline-flex shrink-0 items-center justify-center rounded-full bg-status-purple-bg font-semibold text-status-purple-text`}
    >
      {initials}
    </span>
  )
}
