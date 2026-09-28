import { EyeOff, LogIn } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { buttonClasses } from '../buttonStyles'

/**
 * Some project items came back redacted: GitHub didn't let this user's sign-in read them.
 * Usually an issue in a repo the DAWN Team Site app isn't installed on, or one the user
 * can't access.
 */
export default function HiddenItemsNotice({ count }: { count: number }) {
  const { signIn } = useAuth()
  if (count === 0) return null
  const items = count === 1 ? '1 project item is' : `${count} project items are`
  return (
    <section
      aria-labelledby="hidden-items-title"
      className="flex gap-3 rounded-2xl border border-ember/30 bg-surface p-4 shadow-card"
    >
      <EyeOff aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ember" />
      <div className="min-w-0 flex-1">
        <h2 id="hidden-items-title" className="font-body font-medium">
          {items} hidden because GitHub didn&apos;t share {count === 1 ? 'it' : 'them'}
        </h2>
        <p className="mt-1 text-sm text-dusk">
          These are usually issues in a repository the DAWN Team Site app isn&apos;t installed on
          (ask an org owner to add it) or one you can&apos;t access. If you signed in before the app
          was added, sign in again.
        </p>
        <button
          type="button"
          onClick={() => signIn('/tasks')}
          className={`mt-3 ${buttonClasses('secondary', 'sm')}`}
        >
          <LogIn aria-hidden="true" className="size-4" />
          Sign in again
        </button>
      </div>
    </section>
  )
}
