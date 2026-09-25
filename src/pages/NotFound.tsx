import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-4xl font-semibold">Page not found</h1>
      <p className="mt-4 text-dusk">
        <Link to="/" className="text-ember underline underline-offset-4">
          Back to home
        </Link>
      </p>
    </div>
  )
}
