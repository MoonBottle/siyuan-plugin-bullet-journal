import type { Plugin } from 'siyuan';
import { CHINA_WORKDAY_FALLBACK, type ChinaWorkdayCalendarData } from '@/constants/chinaWorkdayFallback';

const HOLIDAY_API_URL = 'https://raw.githubusercontent.com/lanceliao/china-holiday-calender/master/holidayAPI.json';
const CACHE_KEY = 'china-workday-calendar.json';

interface HolidayApiEntry {
  StartDate?: string
  EndDate?: string
  CompDays?: string[]
}

interface HolidayApiPayload {
  Years?: HolidayApiEntry[] | Record<string, HolidayApiEntry>
}

type PersistenceAdapter = Pick<Plugin, 'loadData' | 'saveData'>;

let activeCalendar: ChinaWorkdayCalendarData = CHINA_WORKDAY_FALLBACK;
let persistenceAdapter: PersistenceAdapter | null = null;

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function enumerateDateRange(start: string, end: string): string[] {
  const result: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    result.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return result;
}

function normalizeCalendarData(data: ChinaWorkdayCalendarData): ChinaWorkdayCalendarData {
  return {
    holidays: [...new Set(data.holidays)].sort(),
    workdays: [...new Set(data.workdays)].sort(),
  };
}

function parseCalendarData(raw: unknown): ChinaWorkdayCalendarData | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (!Array.isArray(parsed.holidays) || !Array.isArray(parsed.workdays)) {
      return null;
    }

    return normalizeCalendarData({
      holidays: parsed.holidays.filter((item: unknown): item is string => typeof item === 'string'),
      workdays: parsed.workdays.filter((item: unknown): item is string => typeof item === 'string'),
    });
  } catch {
    return null;
  }
}

function convertHolidayPayload(payload: HolidayApiPayload): ChinaWorkdayCalendarData | null {
  const years = payload.Years;
  const entries = Array.isArray(years)
    ? years
    : years && typeof years === 'object'
      ? Object.values(years)
      : [];

  if (!entries.length) {
    return null;
  }

  const holidays = new Set<string>();
  const workdays = new Set<string>();

  for (const entry of entries) {
    if (!entry?.StartDate || !entry?.EndDate) {
      continue;
    }

    for (const day of enumerateDateRange(entry.StartDate, entry.EndDate)) {
      holidays.add(day);
    }

    for (const day of entry.CompDays || []) {
      workdays.add(day);
    }
  }

  if (!holidays.size && !workdays.size) {
    return null;
  }

  return normalizeCalendarData({
    holidays: [...holidays],
    workdays: [...workdays],
  });
}

async function loadCachedCalendar(): Promise<ChinaWorkdayCalendarData | null> {
  if (!persistenceAdapter) {
    return null;
  }

  try {
    const raw = await persistenceAdapter.loadData(CACHE_KEY);
    return parseCalendarData(raw);
  } catch (error) {
    console.warn('[ChinaWorkdayService] Failed to load cached calendar:', error);
    return null;
  }
}

async function saveCachedCalendar(data: ChinaWorkdayCalendarData): Promise<void> {
  if (!persistenceAdapter) {
    return;
  }

  try {
    await persistenceAdapter.saveData(CACHE_KEY, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn('[ChinaWorkdayService] Failed to save cached calendar:', error);
  }
}

export function setChinaWorkdayPersistenceAdapter(adapter: PersistenceAdapter | null): void {
  persistenceAdapter = adapter;
}

export function isChinaWorkday(dateStr: string): boolean {
  if (activeCalendar.workdays.includes(dateStr)) {
    return true;
  }

  if (activeCalendar.holidays.includes(dateStr)) {
    return false;
  }

  return !isWeekend(new Date(dateStr));
}

export function getNextChinaWorkday(dateStr: string): string {
  const date = new Date(dateStr);

  do {
    date.setDate(date.getDate() + 1);
  } while (!isChinaWorkday(formatDate(date)));

  return formatDate(date);
}

export async function initializeChinaWorkdayCalendar(plugin?: PersistenceAdapter): Promise<void> {
  if (plugin) {
    setChinaWorkdayPersistenceAdapter(plugin);
  }

  const cached = await loadCachedCalendar();
  activeCalendar = cached || CHINA_WORKDAY_FALLBACK;
}

export async function refreshChinaWorkdayCalendar(): Promise<void> {
  try {
    const response = await fetch(HOLIDAY_API_URL);
    if (!response.ok) {
      return;
    }

    const payload = await response.json() as HolidayApiPayload;
    const converted = convertHolidayPayload(payload);
    if (!converted) {
      return;
    }

    activeCalendar = converted;
    await saveCachedCalendar(converted);
  } catch (error) {
    console.warn('[ChinaWorkdayService] Failed to refresh remote calendar:', error);
  }
}

export async function __resetChinaWorkdayStateForTest(): Promise<void> {
  activeCalendar = CHINA_WORKDAY_FALLBACK;
  persistenceAdapter = null;
}
