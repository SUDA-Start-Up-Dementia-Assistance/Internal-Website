import { useState } from 'react'
import PreviewPanel, { type PreviewDocument } from './PreviewPanel'

export interface PreviewRequest {
  title: string
  documents: PreviewDocument[]
  initialId?: string
}

/** Holds which files are being previewed; render `previewPanel` once anywhere in the page. */
export function usePreviewPanel() {
  const [request, setRequest] = useState<(PreviewRequest & { key: number }) | null>(null)

  function openPreview(next: PreviewRequest) {
    setRequest({ ...next, key: Date.now() })
  }

  const previewPanel = request && (
    <PreviewPanel
      key={request.key}
      title={request.title}
      documents={request.documents}
      initialId={request.initialId}
      onClose={() => setRequest(null)}
    />
  )

  return { openPreview, previewPanel }
}
