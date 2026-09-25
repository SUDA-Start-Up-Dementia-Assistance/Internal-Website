import { describe, expect, it } from 'vitest'
import { getEmbedUrl } from './preview'

describe('getEmbedUrl', () => {
  it.each([
    ['application/vnd.google-apps.document', 'https://docs.google.com/document/d/abc123/preview'],
    [
      'application/vnd.google-apps.presentation',
      'https://docs.google.com/presentation/d/abc123/embed',
    ],
    [
      'application/vnd.google-apps.spreadsheet',
      'https://docs.google.com/spreadsheets/d/abc123/preview',
    ],
    ['application/pdf', 'https://drive.google.com/file/d/abc123/preview'],
    ['image/png', 'https://drive.google.com/file/d/abc123/preview'],
  ])('%s → %s', (mimeType, expected) => {
    expect(getEmbedUrl({ id: 'abc123', mimeType })).toBe(expected)
  })

  it('encodes the file ID', () => {
    expect(getEmbedUrl({ id: 'a/b', mimeType: 'application/pdf' })).toBe(
      'https://drive.google.com/file/d/a%2Fb/preview',
    )
  })
})
