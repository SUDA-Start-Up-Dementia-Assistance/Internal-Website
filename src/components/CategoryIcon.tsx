import { createElement } from 'react'
import { categoryIcon } from '../config/categoryIcons'

/** The configured lucide icon for a category slug, in a tinted tile. Decorative. */
export default function CategoryIcon({ slug, size = 'md' }: { slug: string; size?: 'md' | 'lg' }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl bg-apricot/15 text-ember ${
        size === 'lg' ? 'size-12' : 'size-11'
      }`}
    >
      {createElement(categoryIcon(slug), {
        'aria-hidden': true,
        className: size === 'lg' ? 'size-6' : 'size-5',
      })}
    </span>
  )
}
