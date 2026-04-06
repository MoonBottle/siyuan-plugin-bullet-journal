import { describe, expect, it } from 'vitest'
import { getProgressDirection } from '@/utils/progressDirection'

describe('getProgressDirection', () => {
  it('returns extend for stopwatch mode', () => {
    expect(getProgressDirection('stopwatch')).toBe('extend')
  })

  it('returns shrink for countdown mode', () => {
    expect(getProgressDirection('countdown')).toBe('shrink')
  })

  it('returns shrink when timerMode is undefined (break)', () => {
    expect(getProgressDirection(undefined)).toBe('shrink')
  })
})
