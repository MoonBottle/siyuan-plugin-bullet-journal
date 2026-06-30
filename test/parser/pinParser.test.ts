import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  generatePinnedMarker,
  parsePinnedFromLine,
  stripPinnedMarker,
} from '@/parser/pinParser'

describe('pinParser', () => {
  it('detects pinned marker in a line', () => {
    expect(parsePinnedFromLine('整理资料 📌 @2026-05-08')).toBe(true)
  })

  it('returns false when line is not pinned', () => {
    expect(parsePinnedFromLine('整理资料 @2026-05-08')).toBe(false)
  })

  it('strips pinned marker and keeps surrounding content', () => {
    expect(stripPinnedMarker('整理资料 📌 @2026-05-08')).toBe('整理资料 @2026-05-08')
  })

  it('strips repeated pinned markers and normalizes whitespace', () => {
    expect(stripPinnedMarker('  📌 整理资料   📌  @2026-05-08  ')).toBe('整理资料 @2026-05-08')
  })

  it('generates the standard pinned marker', () => {
    expect(generatePinnedMarker()).toBe('📌')
  })
})
