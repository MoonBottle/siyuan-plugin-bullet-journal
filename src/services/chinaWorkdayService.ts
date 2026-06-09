import type { Plugin } from 'siyuan'
import type { ChinaWorkdayCalendarData } from '@/constants/chinaWorkdayFallback'
import { reactive } from 'vue'
import { CHINA_WORKDAY_FALLBACK } from '@/constants/chinaWorkdayFallback'

const HOLIDAY_API_URL = 'https://cdn.jsdelivr.net/gh/lanceliao/china-holiday-calender@master/holidayAPI.json'
const CACHE_KEY = 'china-workday-calendar.json'

interface HolidayApiEntry {
  StartDate?: string
  EndDate?: string
  CompDays?: string[]
}

interface HolidayApiPayload {
  Years?: HolidayApiEntry[] | Record<string, HolidayApiEntry[]>
}

type PersistenceAdapter = Pick<Plugin, 'loadData' | 'saveData'>

let activeCalendar: ChinaWorkdayCalendarData = CHINA_WORKDAY_FALLBACK
let persistenceAdapter: PersistenceAdapter | null = null

export const holidaySyncState = reactive({
  status: 'idle' as 'idle' | 'syncing' | 'success' | 'error',
  lastUpdated: null as string | null,
  source: 'fallback' as 'remote' | 'cache' | 'fallback',
  yearRange: inferYearRange(CHINA_WORKDAY_FALLBACK),
  errorMessage: '',
})

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function inferYearRange(data: { holidays: string[], workdays: string[] }): string {
  const years = new Set<number>()
  for (const d of [...data.holidays, ...data.workdays]) {
    const year = Number(d.substring(0, 4))
    if (year > 2000 && year < 2100) {
      years.add(year)
    }
  }
  const sorted = [...years].sort()
  return sorted.length > 0 ? sorted.join('-') : ''
}

function enumerateDateRange(start: string, end: string): string[] {
  const result: string[] = []
  let current = new Date(start)
  const endMs = new Date(end).getTime()

  while (current.getTime() <= endMs) {
    result.push(formatDate(current))
    current = new Date(current.getTime() + 86400000)
  }

  return result
}

function normalizeCalendarData(data: ChinaWorkdayCalendarData): ChinaWorkdayCalendarData {
  return {
    holidays: [...new Set(data.holidays)].sort(),
    workdays: [...new Set(data.workdays)].sort(),
    meta: data.meta,
  }
}

function parseCalendarData(raw: unknown): ChinaWorkdayCalendarData | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw

    if (!Array.isArray(parsed.holidays) || !Array.isArray(parsed.workdays)) {
      return null
    }

    return normalizeCalendarData({
      holidays: parsed.holidays.filter((item: unknown): item is string => typeof item === 'string'),
      workdays: parsed.workdays.filter((item: unknown): item is string => typeof item === 'string'),
      meta: parsed.meta?.lastUpdated !== undefined
        ? {
            lastUpdated: typeof parsed.meta.lastUpdated === 'string' ? parsed.meta.lastUpdated : null,
            source: ['remote', 'cache', 'fallback'].includes(parsed.meta.source) ? parsed.meta.source : 'fallback',
            yearRange: typeof parsed.meta.yearRange === 'string' ? parsed.meta.yearRange : '',
          }
        : undefined,
    })
  } catch {
    return null
  }
}

function convertHolidayPayload(payload: HolidayApiPayload): ChinaWorkdayCalendarData | null {
  const years = payload.Years
  const entries = Array.isArray(years)
    ? years
    : years && typeof years === 'object'
      ? Object.values(years).flat()
      : []

  if (!entries.length) {
    return null
  }

  const holidays = new Set<string>()
  const workdays = new Set<string>()

  for (const entry of entries) {
    if (!entry?.StartDate || !entry?.EndDate) {
      continue
    }

    for (const day of enumerateDateRange(entry.StartDate, entry.EndDate)) {
      holidays.add(day)
    }

    for (const day of entry.CompDays || []) {
      workdays.add(day)
    }
  }

  if (!holidays.size && !workdays.size) {
    return null
  }

  return normalizeCalendarData({
    holidays: [...holidays],
    workdays: [...workdays],
  })
}

async function loadCachedCalendar(): Promise<ChinaWorkdayCalendarData | null> {
  if (!persistenceAdapter) {
    return null
  }

  try {
    const raw = await persistenceAdapter.loadData(CACHE_KEY)
    return parseCalendarData(raw)
  } catch (error) {
    console.warn('[ChinaWorkdayService] Failed to load cached calendar:', error)
    return null
  }
}

async function saveCachedCalendar(data: ChinaWorkdayCalendarData): Promise<void> {
  if (!persistenceAdapter) {
    return
  }

  try {
    await persistenceAdapter.saveData(CACHE_KEY, JSON.stringify(data, null, 2))
  } catch (error) {
    console.warn('[ChinaWorkdayService] Failed to save cached calendar:', error)
  }
}

export function setChinaWorkdayPersistenceAdapter(adapter: PersistenceAdapter | null): void {
  persistenceAdapter = adapter
}

export function isChinaWorkday(dateStr: string): boolean {
  if (activeCalendar.workdays.includes(dateStr)) {
    return true
  }

  if (activeCalendar.holidays.includes(dateStr)) {
    return false
  }

  return !isWeekend(new Date(dateStr))
}

export function getNextChinaWorkday(dateStr: string): string {
  const date = new Date(dateStr)

  do {
    date.setDate(date.getDate() + 1)
  } while (!isChinaWorkday(formatDate(date)))

  return formatDate(date)
}

export async function initializeChinaWorkdayCalendar(plugin?: PersistenceAdapter): Promise<void> {
  if (plugin) {
    setChinaWorkdayPersistenceAdapter(plugin)
  }

  const cached = await loadCachedCalendar()
  if (cached) {
    activeCalendar = cached
    holidaySyncState.source = cached.meta?.source === 'remote' ? 'cache' : (cached.meta?.source ?? 'cache')
    holidaySyncState.lastUpdated = cached.meta?.lastUpdated ?? null
    holidaySyncState.yearRange = cached.meta?.yearRange || inferYearRange(cached)
  } else {
    activeCalendar = CHINA_WORKDAY_FALLBACK
    holidaySyncState.source = 'fallback'
    holidaySyncState.lastUpdated = null
    holidaySyncState.yearRange = inferYearRange(CHINA_WORKDAY_FALLBACK)
  }
}

export async function refreshChinaWorkdayCalendar(): Promise<boolean> {
  holidaySyncState.status = 'syncing'
  holidaySyncState.errorMessage = ''

  try {
    const response = await fetch(HOLIDAY_API_URL)
    if (!response.ok) {
      holidaySyncState.status = 'error'
      holidaySyncState.errorMessage = `HTTP ${response.status}`
      return false
    }

    const payload = await response.json() as HolidayApiPayload
    const converted = convertHolidayPayload(payload)
    if (!converted) {
      holidaySyncState.status = 'error'
      holidaySyncState.errorMessage = 'Invalid data format'
      return false
    }

    const now = new Date().toISOString()
    const yearRange = inferYearRange(converted)
    const dataWithMeta: ChinaWorkdayCalendarData = {
      ...converted,
      meta: {
        lastUpdated: now,
        source: 'remote',
        yearRange,
      },
    }

    activeCalendar = dataWithMeta
    await saveCachedCalendar(dataWithMeta)

    holidaySyncState.status = 'success'
    holidaySyncState.source = 'remote'
    holidaySyncState.lastUpdated = now
    holidaySyncState.yearRange = yearRange

    return true
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    holidaySyncState.status = 'error'
    holidaySyncState.errorMessage = msg
    console.warn('[ChinaWorkdayService] Failed to refresh remote calendar:', error)
    return false
  }
}

export async function __resetChinaWorkdayStateForTest(): Promise<void> {
  activeCalendar = CHINA_WORKDAY_FALLBACK
  persistenceAdapter = null
  holidaySyncState.status = 'idle'
  holidaySyncState.lastUpdated = null
  holidaySyncState.source = 'fallback'
  holidaySyncState.yearRange = inferYearRange(CHINA_WORKDAY_FALLBACK)
  holidaySyncState.errorMessage = ''
}
