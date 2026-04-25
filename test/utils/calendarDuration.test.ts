import { describe, expect, it } from 'vitest';
import { calculateDayTotalDurationMinutes, formatTotalDuration } from '@/utils/calendarDuration';
import type { CalendarEvent } from '@/types/models';

function createEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'event-1',
    title: '事项',
    start: '2026-04-25 09:00:00',
    end: '2026-04-25 10:00:00',
    allDay: false,
    extendedProps: {
      hasItems: true,
      docId: 'doc-1',
      lineNumber: 1,
      ...overrides.extendedProps,
    },
    ...overrides,
  };
}

describe('calendarDuration', () => {
  it('统计当天非全天事项总耗时并扣除午休', () => {
    const events: CalendarEvent[] = [
      createEvent({
        start: '2026-04-25 09:00:00',
        end: '2026-04-25 10:00:00',
        extendedProps: {
          date: '2026-04-25',
        },
      }),
      createEvent({
        id: 'event-2',
        start: '2026-04-25 11:30:00',
        end: '2026-04-25 13:30:00',
        extendedProps: {
          date: '2026-04-25',
        },
      }),
      createEvent({
        id: 'event-3',
        start: '2026-04-25',
        end: undefined,
        allDay: true,
        extendedProps: {
          date: '2026-04-25',
        },
      }),
      createEvent({
        id: 'event-4',
        start: '2026-04-25 14:00:00',
        end: '2026-04-25 15:00:00',
        extendedProps: {
          date: '2026-04-25',
          isPomodoroBlock: true,
        },
      }),
      createEvent({
        id: 'event-5',
        start: '2026-04-26 09:00:00',
        end: '2026-04-26 10:00:00',
        extendedProps: {
          date: '2026-04-26',
        },
      }),
    ];

    const totalMinutes = calculateDayTotalDurationMinutes(
      events,
      '2026-04-25',
      '12:00',
      '13:00'
    );

    expect(totalMinutes).toBe(120);
  });

  it('忽略没有完整起止时间的事件', () => {
    const events: CalendarEvent[] = [
      createEvent({
        start: '2026-04-25 09:00:00',
        end: undefined,
        extendedProps: {
          date: '2026-04-25',
        },
      }),
      createEvent({
        id: 'event-2',
        start: '2026-04-25 10:00:00',
        end: '2026-04-25 11:30:00',
        extendedProps: {
          date: '2026-04-25',
        },
      }),
    ];

    expect(calculateDayTotalDurationMinutes(events, '2026-04-25')).toBe(90);
  });

  it('格式化总耗时为 H:mm', () => {
    expect(formatTotalDuration(45)).toBe('0:45');
    expect(formatTotalDuration(135)).toBe('2:15');
  });
});
