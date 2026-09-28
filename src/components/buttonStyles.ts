export type ButtonVariant = 'primary' | 'secondary'
export type ButtonSize = 'md' | 'sm'

const BASE = 'inline-flex items-center gap-2 rounded-full text-sm font-medium transition-colors'

const SIZES: Record<ButtonSize, string> = {
  md: 'px-5 py-2.5',
  sm: 'px-3.5 py-1.5',
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent/85',
  secondary: 'border border-border text-ink hover:border-link hover:text-link',
}

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}`
}
