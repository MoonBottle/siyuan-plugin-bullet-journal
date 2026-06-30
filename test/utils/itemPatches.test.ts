import {
  describe,
  expect,
  it,
} from 'vitest'
import { extractTimePart } from '@/utils/blockWriter/intent/itemPatches'

describe('extractTimePart', () => {
  it('从完整日期时间字符串中提取时间部分', () => {
    expect(extractTimePart('2026-06-05 10:30')).toBe('10:30')
  })

  it('从 ISO 格式字符串中提取时间部分', () => {
    expect(extractTimePart('2026-06-05T10:30:00')).toBe('10:30:00')
  })

  it('从带秒的时间字符串中提取时间部分', () => {
    expect(extractTimePart('10:30:45')).toBe('10:30:45')
  })

  it('从纯时间字符串中提取时间部分', () => {
    expect(extractTimePart('10:30')).toBe('10:30')
  })

  it('纯日期字符串不含时间格式时返回 undefined', () => {
    expect(extractTimePart('2026-06-05')).toBeUndefined()
  })

  it('空字符串返回 undefined', () => {
    expect(extractTimePart('')).toBeUndefined()
  })

  it('null 返回 undefined', () => {
    expect(extractTimePart(null)).toBeUndefined()
  })

  it('undefined 返回 undefined', () => {
    expect(extractTimePart(undefined)).toBeUndefined()
  })

  it('仅空白字符返回 undefined', () => {
    expect(extractTimePart('   ')).toBeUndefined()
  })

  it('不包含时间格式的随机文本返回 undefined', () => {
    expect(extractTimePart('每周五')).toBeUndefined()
  })
})
