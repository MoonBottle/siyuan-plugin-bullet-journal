import type { CalendarEvent } from '@/types/models';
import { calculateDuration } from '@/utils/dateUtils';

function extractEventDate(event: CalendarEvent): string {
  if (event.extendedProps?.date) return event.extendedProps.date;
  if (typeof event.start === 'string') {
    if (event.start.includes(' ')) return event.start.split(' ')[0];
    if (event.start.includes('T')) return event.start.split('T')[0];
    return event.start;
  }
  return '';
}

function parseDurationToMinutes(duration: string): number {
  const match = duration.match(/^(\d+):(\d{2})$/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function calculateDayTotalDurationMinutes(
  events: CalendarEvent[],
  date: string,
  lunchBreakStart?: string,
  lunchBreakEnd?: string
): number {
  return events.reduce((sum, event) => {
    if (event.allDay) return sum;
    if (event.extendedProps?.isPomodoroBlock) return sum;
    if (!event.start || !event.end) return sum;
    if (extractEventDate(event) !== date) return sum;

    const duration = calculateDuration(
      event.start,
      event.end,
      lunchBreakStart,
      lunchBreakEnd
    );

    return sum + parseDurationToMinutes(duration);
  }, 0);
}

export function formatTotalDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}
