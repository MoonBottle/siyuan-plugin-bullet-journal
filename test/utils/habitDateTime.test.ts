import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractHabitCompletedAt,
  formatHabitCompletedAtForDisplay,
  formatHabitCompletedAtForMarkdown,
} from '@/utils/habitDateTime';

describe('extractHabitCompletedAt', () => {
  it('extracts day precision timestamps', () => {
    expect(extractHabitCompletedAt('喝水 📅2026-05-08')).toEqual({
      date: '2026-05-08',
      completedAt: '2026-05-08',
    });
  });

  it('extracts minute precision timestamps', () => {
    expect(extractHabitCompletedAt('喝水 📅2026-05-08 09:30')).toEqual({
      date: '2026-05-08',
      completedAt: '2026-05-08 09:30',
    });
  });

  it('extracts second precision timestamps', () => {
    expect(extractHabitCompletedAt('喝水 📅2026-05-08 09:30:45')).toEqual({
      date: '2026-05-08',
      completedAt: '2026-05-08 09:30:45',
    });
  });

  it('rejects malformed trailing content after a second precision timestamp', () => {
    expect(extractHabitCompletedAt('喝水 📅2026-05-08 09:30:45foo')).toBeNull();
    expect(extractHabitCompletedAt('喝水 📅2026-05-08 09:30:45~10:00:00')).toBeNull();
  });
});

describe('formatHabitCompletedAtForMarkdown', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats minute precision using the current time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T09:30:45'));

    expect(formatHabitCompletedAtForMarkdown('minute')).toBe('2026-05-08 09:30');
  });

  it('formats second precision using an explicit date', () => {
    expect(
      formatHabitCompletedAtForMarkdown('second', new Date('2026-05-08T09:30:45')),
    ).toBe('2026-05-08 09:30:45');
  });
});

describe('formatHabitCompletedAtForDisplay', () => {
  it('preserves day-only records under second precision', () => {
    expect(formatHabitCompletedAtForDisplay('2026-05-08', 'second')).toBe('5/8');
  });

  it('shows second precision when the timestamp includes seconds', () => {
    expect(formatHabitCompletedAtForDisplay('2026-05-08 09:30:45', 'second')).toBe('5/8 09:30:45');
  });

  it('returns empty string for invalid display input', () => {
    expect(formatHabitCompletedAtForDisplay('not-a-date', 'second')).toBe('');
  });
});
