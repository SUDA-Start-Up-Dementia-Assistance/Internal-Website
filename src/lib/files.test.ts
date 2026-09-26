import { describe, expect, it } from 'vitest'
import { artifactDisplayName, fileKind } from './files'

describe('fileKind', () => {
  it.each([
    ['application/vnd.google-apps.document', 'doc'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'doc'],
    ['application/vnd.google-apps.presentation', 'slides'],
    ['application/vnd.ms-powerpoint', 'slides'],
    ['application/vnd.google-apps.spreadsheet', 'sheet'],
    ['text/csv', 'sheet'],
    ['application/pdf', 'pdf'],
    ['image/png', 'other'],
    ['', 'other'],
  ])('%s → %s', (mimeType, kind) => {
    expect(fileKind(mimeType)).toBe(kind)
  })
})

describe('artifactDisplayName', () => {
  it.each([
    ['01 Project Plan.pdf', 'Project Plan'],
    ['Test Plan.PDF', 'Test Plan'],
    ['12   Final Report.pdf', 'Final Report'],
    ['Usability Study Results.pdf', 'Usability Study Results'],
    ['report.pdf.pdf', 'report.pdf'],
    ['2026-09-29 Agenda', '2026-09-29 Agenda'],
  ])('%s → %s', (name, expected) => {
    expect(artifactDisplayName(name)).toBe(expected)
  })
})
