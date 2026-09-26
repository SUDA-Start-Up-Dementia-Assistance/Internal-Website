export type ButtonVariant = 'primary' | 'secondary'
export type ButtonSize = 'md' | 'sm'

const BASE = 'inline-flex items-center gap-2 rounded-full text-sm font-medium transition-colors'

const SIZES: Record<ButtonSize, string> = {
  md: 'px-5 py-2.5',
  sm: 'px-3.5 py-1.5',
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-apricot text-night hover:bg-apricot/85',
  secondary: 'border border-night/15 text-night hover:border-ember hover:text-ember',
}

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}`
}
