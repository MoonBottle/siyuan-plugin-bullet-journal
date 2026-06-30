import type { CalendarEvent } from '@/types/models'
import {
  describe,
  expect,
  it,
} from 'vitest'
import { buildItemFromEventProps } from '@/utils/dialog'

const baseExtendedProps = {
  hasItems: false as const,
  docId: 'doc-1',
  lineNumber: 1,
}

function makeAllDayEvent(extendedPropsOverrides?: Partial<CalendarEvent['extendedProps']>): CalendarEvent {
  return {
    id: 'event-1',
    title: '统计',
    start: '2026-06-05',
    allDay: true,
    extendedProps: {
      ...baseExtendedProps,
      ...extendedPropsOverrides,
    },
  }
}

function makeTimedEvent(extendedPropsOverrides?: Partial<CalendarEvent['extendedProps']>): CalendarEvent {
  return {
    id: 'event-2',
    title: '会议',
    start: '2026-06-05T10:00:00',
    end: '2026-06-05T11:00:00',
    allDay: false,
    extendedProps: {
      ...baseExtendedProps,
      ...extendedPropsOverrides,
    },
  }
}

describe('buildItemFromEventProps', () => {
  describe('全天事件', () => {
    it('全天事件不应设置 startDateTime', () => {
      const event = makeAllDayEvent()
      const item = buildItemFromEventProps(event)
      expect(item.startDateTime).toBeUndefined()
    })

    it('全天事件不应设置 endDateTime', () => {
      const event = makeAllDayEvent()
      event.end = '2026-06-06'
      const item = buildItemFromEventProps(event)
      expect(item.endDateTime).toBeUndefined()
    })

    it('全天事件正确提取日期', () => {
      const event = makeAllDayEvent()
      const item = buildItemFromEventProps(event)
      expect(item.date).toBe('2026-06-05')
    })

    it('全天事件使用 originalStartDateTime 时仍保留时间', () => {
      const event = makeAllDayEvent({ originalStartDateTime: '2026-06-05 09:00' })
      const item = buildItemFromEventProps(event)
      expect(item.startDateTime).toBe('2026-06-05 09:00')
    })
  })

  describe('非全天事件', () => {
    it('非全天事件从 start 推导 startDateTime', () => {
      const event = makeTimedEvent()
      const item = buildItemFromEventProps(event)
      expect(item.startDateTime).toBeTruthy()
    })

    it('非全天事件从 end 推导 endDateTime', () => {
      const event = makeTimedEvent()
      const item = buildItemFromEventProps(event)
      expect(item.endDateTime).toBeTruthy()
    })

    it('非全天事件优先使用 originalStartDateTime', () => {
      const event = makeTimedEvent({ originalStartDateTime: '10:00' })
      const item = buildItemFromEventProps(event)
      expect(item.startDateTime).toBe('10:00')
    })
  })

  describe('跳过本次场景（全天循环事件）', () => {
    it('全天循环事件的 startDateTime 为 undefined，不会导致日期残留', () => {
      const event = makeAllDayEvent({
        repeatRule: {
          type: 'weekly',
          daysOfWeek: [5],
        },
      })
      const item = buildItemFromEventProps(event)
      // 关键断言：全天事件的 startDateTime 必须为 undefined
      // 否则 extractTimePart("2026-06-05") 会返回 "2026-06-05"
      // 导致跳过本次后文档变成 "📅2026-06-12 2026-06-05 🔁每周五"
      expect(item.startDateTime).toBeUndefined()
    })
  })
})
