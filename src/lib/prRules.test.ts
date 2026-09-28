import { describe, expect, it } from 'vitest'
import { expectedBase, hasDemoVideo, targetsCorrectBase } from './prRules'

describe('hasDemoVideo', () => {
  it.each([
    [
      'a GitHub video upload on its own line',
      'Demo:\n\nhttps://github.com/user-attachments/assets/1b2c3d4e-aaaa-bbbb-cccc-1234567890ab\n',
    ],
    ['an .mp4 link', 'See [demo](https://example.com/clips/demo.mp4)'],
    ['a .mov file', 'demo: https://files.example.com/Screen%20Recording.MOV'],
    ['a .webm file with a query string', 'https://cdn.example.com/demo.webm?token=1'],
    [
      'an old-style githubusercontent video',
      'https://user-images.githubusercontent.com/1/2-demo.mp4',
    ],
    ['YouTube', 'Walkthrough: https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['a youtu.be short link', 'https://youtu.be/dQw4w9WgXcQ'],
    ['Loom', 'Loom: https://www.loom.com/share/0123456789abcdef'],
    ['Google Drive', 'https://drive.google.com/file/d/abc123/view?usp=sharing'],
    ['a <video> tag', '<video src="https://github.com/user-attachments/assets/abc"></video>'],
  ])('finds %s', (_label, body) => {
    expect(hasDemoVideo(body)).toBe(true)
  })

  it.each([
    ['an empty body', ''],
    ['no body', null],
    ['text only', 'Fixes the clock font size. Tested on the tablet.'],
    [
      'a GitHub image upload (markdown)',
      '![screenshot](https://github.com/user-attachments/assets/1b2c3d4e-aaaa)',
    ],
    [
      'a GitHub image upload (<img>)',
      '<img width="400" alt="shot" src="https://github.com/user-attachments/assets/abc" />',
    ],
    ['a word ending in mp4-ish text', 'We compared mp4 and webm formats in the notes.'],
    ['a YouTube channel link (not a video)', 'https://www.youtube.com/@dawnteam'],
    ['a Loom homepage link', 'https://www.loom.com/pricing'],
  ])('rejects %s', (_label, body) => {
    expect(hasDemoVideo(body)).toBe(false)
  })
})

describe('base branch rule (feature → canary → main)', () => {
  it.each([
    ['feature/clock-font', 'canary', true],
    ['fix-weather-icon', 'canary', true],
    ['canary', 'main', true],
    ['feature/clock-font', 'main', false], // skips canary
    ['canary', 'canary', false],
    ['main', 'canary', false], // nothing merges out of main
    ['main', 'main', false],
    ['feature/x', 'release', false],
  ])('%s → %s is %s', (head, base, ok) => {
    expect(targetsCorrectBase(head, base)).toBe(ok)
  })

  it('names the expected base', () => {
    expect(expectedBase('feature/x')).toBe('canary')
    expect(expectedBase('canary')).toBe('main')
    expect(expectedBase('main')).toBeNull()
  })
})
