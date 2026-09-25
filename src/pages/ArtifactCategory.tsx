import { useParams } from 'react-router-dom'

export default function ArtifactCategory() {
  const { category } = useParams()
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-4xl font-semibold">Artifacts: {category}</h1>
    </div>
  )
}
