import dayjs from '@/utils/dayjs';

const HABIT_COMPLETED_AT_BOUNDARY = String.raw`(?=$|[\s),.;!?，。；！？])`;
const HABIT_COMPLETED_AT_SECOND_RE = new RegExp(
  String.raw`📅(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):(\d{2})${HABIT_COMPLETED_AT_BOUNDARY}`,
);
const HABIT_COMPLETED_AT_MINUTE_RE = new RegExp(
  String.raw`📅(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})${HABIT_COMPLETED_AT_BOUNDARY}`,
);
const HABIT_COMPLETED_AT_DAY_RE = new RegExp(
  String.raw`📅(\d{4}-\d{2}-\d{2})${HABIT_COMPLETED_AT_BOUNDARY}`,
);
const HABIT_COMPLETED_AT_TIME_FRAGMENT_RE = /📅\d{4}-\d{2}-\d{2}(?= \d)/;
export const HABIT_COMPLETED_AT_TOKEN_RE = new RegExp(
  String.raw`📅\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}(?::\d{2})?)?${HABIT_COMPLETED_AT_BOUNDARY}`,
  'g',
);

type HabitDateTimePrecision = 'day' | 'minute' | 'second';

const MARKDOWN_FORMATS: Record<HabitDateTimePrecision, string> = {
  day: 'YYYY-MM-DD',
  minute: 'YYYY-MM-DD HH:mm',
  second: 'YYYY-MM-DD HH:mm:ss',
};

const DISPLAY_FORMATS: Record<HabitDateTimePrecision, string> = {
  day: 'M/D',
  minute: 'M/D HH:mm',
  second: 'M/D HH:mm:ss',
};

export function extractHabitCompletedAt(markdown: string): { date: string, completedAt: string } | null {
  const secondMatch = markdown.match(HABIT_COMPLETED_AT_SECOND_RE);
  if (secondMatch) {
    const [, date, time, seconds] = secondMatch;
    return {
      date,
      completedAt: `${date} ${time}:${seconds}`,
    };
  }

  const minuteMatch = markdown.match(HABIT_COMPLETED_AT_MINUTE_RE);
  if (minuteMatch) {
    const [, date, time] = minuteMatch;
    return {
      date,
      completedAt: `${date} ${time}`,
    };
  }

  if (HABIT_COMPLETED_AT_TIME_FRAGMENT_RE.test(markdown)) {
    return null;
  }

  const dayMatch = markdown.match(HABIT_COMPLETED_AT_DAY_RE);
  if (dayMatch) {
    const [, date] = dayMatch;
    return {
      date,
      completedAt: date,
    };
  }

  return null;
}

export function stripHabitCompletedAtTokens(markdown: string): string {
  return markdown.replace(HABIT_COMPLETED_AT_TOKEN_RE, '');
}

export function formatHabitCompletedAtForMarkdown(
  precision: HabitDateTimePrecision,
  now?: Date,
): string {
  return dayjs(now).format(MARKDOWN_FORMATS[precision]);
}

export function formatHabitCompletedAtForDisplay(
  completedAt: string | undefined,
  precision: HabitDateTimePrecision,
): string {
  if (!completedAt) {
    return '';
  }

  const hasTime = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(completedAt);
  const isDayOnly = /^\d{4}-\d{2}-\d{2}$/.test(completedAt);
  if (!isDayOnly && !hasTime) {
    return '';
  }

  const parsed = dayjs(completedAt);
  if (!parsed.isValid()) {
    return '';
  }

  if (isDayOnly) {
    return parsed.format(DISPLAY_FORMATS.day);
  }

  return parsed.format(DISPLAY_FORMATS[precision]);
}
