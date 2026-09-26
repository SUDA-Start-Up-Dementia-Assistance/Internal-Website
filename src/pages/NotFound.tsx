import { Link } from 'react-router-dom'
import PageTitle from '../components/PageTitle'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <PageTitle title="Page not found" />
      <h1 className="text-4xl font-semibold">Page not found</h1>
      <p className="mt-3 max-w-prose text-dusk">
        That page doesn&apos;t exist. It may have moved, or the link may be mistyped.
      </p>
      <p className="mt-6">
        <Link to="/" className="rounded-sm text-ember underline underline-offset-4">
          Back to home
        </Link>
      </p>
    </div>
  )
}
