export type ButtonVariant = 'primary' | 'secondary'

const BASE =
  'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-apricot text-night hover:bg-apricot/85',
  secondary: 'border border-night/15 text-night hover:border-ember hover:text-ember',
}

export function buttonClasses(variant: ButtonVariant = 'primary'): string {
  return `${BASE} ${VARIANTS[variant]}`
}
