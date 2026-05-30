import type { TimerEntry } from './types'
import { formatDate } from './utils'

const timers = new Map<string, TimerEntry>()
const notifiedTimerIds = new Set<string>()

export function isTimerNotified(id: string): boolean {
  return notifiedTimerIds.has(id)
}

export function markTimerNotified(id: string): void {
  notifiedTimerIds.add(id)
}

let checkInterval: ReturnType<typeof setInterval> | null = null
let lastKnownDate = ''
let persistTimer: ReturnType<typeof setTimeout> | null = null
let isDirty = false

const MISSED_THRESHOLD_MS = 5 * 60 * 1000
const PURGE_THRESHOLD_S = 24 * 60 * 60

export function getTimers(): Map<string, TimerEntry> {
  return timers
}

export async function loadTimerRegistry(): Promise<void> {
  try {
    const result = await siyuan.storage.get('timer-registry.json')
    const data = await result.json()
    if (data && Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        const entry = data[i] as TimerEntry
        if (entry.id && entry.endTime) {
          timers.set(entry.id, entry)
        }
      }
    }
  } catch (e) {
    await siyuan.logger.warn(`[scheduler] failed to load timer registry: ${String(e)}`)
  }
}

export async function persistTimerRegistry(): Promise<void> {
  if (!isDirty) return
  const entries: TimerEntry[] = []
  timers.forEach((entry) => {
    if (entry.type === 'reminder' || entry.type === 'habit') {
      entries.push(entry)
    }
  })
  try {
    await siyuan.storage.put('timer-registry.json', JSON.stringify(entries))
    isDirty = false
  } catch (e) {
    await siyuan.logger.warn(`[scheduler] failed to persist timer registry: ${String(e)}`)
  }
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    void persistTimerRegistry()
  }, 5000)
  isDirty = true
}

export function registerTimer(entry: TimerEntry): void {
  if (notifiedTimerIds.has(entry.id)) {
    console.log(`[scheduler] registerTimer SKIP id=${entry.id} (already notified)`)
    return
  }
  console.log(`[scheduler] registerTimer: id=${entry.id} type=${entry.type} endTime=${entry.endTime} content=${entry.metadata.content} notified=${entry.notified}`)
  timers.set(entry.id, entry)
  schedulePersist()
}

export function registerTimers(entries: TimerEntry[]): void {
  console.log(`[scheduler] registerTimers: count=${entries.length}`)
  let skipped = 0
  for (let i = 0; i < entries.length; i++) {
    if (notifiedTimerIds.has(entries[i].id)) {
      skipped++
      continue
    }
    console.log(`[scheduler]   - id=${entries[i].id} type=${entries[i].type} endTime=${entries[i].endTime} notified=${entries[i].notified}`)
    timers.set(entries[i].id, entries[i])
  }
  if (skipped > 0) console.log(`[scheduler]   skipped ${skipped} already-notified timer(s)`)
  schedulePersist()
}

export function cancelTimer(id: string): void {
  timers.delete(id)
  schedulePersist()
}

export function cancelTimersByType(type: string): void {
  const toDelete: string[] = []
  timers.forEach((entry, key) => {
    if (entry.type === type) {
      toDelete.push(key)
    }
  })
  for (let i = 0; i < toDelete.length; i++) {
    timers.delete(toDelete[i])
  }
  if (toDelete.length > 0) {
    console.log(`[scheduler] cancelTimersByType: type=${type} cancelled=${toDelete.length}`)
  }
  schedulePersist()
}

export function getActiveTimers(type?: string): TimerEntry[] {
  const result: TimerEntry[] = []
  timers.forEach((entry) => {
    if (!type || entry.type === type) {
      result.push(entry)
    }
  })
  return result
}
let dispatchNotification: (entry: TimerEntry) => void = function () {}
let rebuildReminderSchedule: () => void = function () {}

export function setDispatchNotification(fn: (entry: TimerEntry) => void): void {
  dispatchNotification = fn
}

export function setRebuildReminderSchedule(fn: () => void): void {
  rebuildReminderSchedule = fn
}

export function initScheduler(): void {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
  lastKnownDate = formatDate(new Date())
  console.log(`[scheduler] initScheduler: existing timers=${timers.size} today=${lastKnownDate}`)
  const now = Date.now() / 1000
  timers.forEach((entry) => {
    if (!notifiedTimerIds.has(entry.id) && entry.endTime <= now) {
      const diffMs = (now - entry.endTime) * 1000
      if (diffMs <= MISSED_THRESHOLD_MS) {
        entry.notified = true
        notifiedTimerIds.add(entry.id)
        console.log(`[scheduler] missed timer (within ${Math.round(diffMs / 1000)}s): id=${entry.id} type=${entry.type} content=${entry.metadata.content}`)
        dispatchNotification(entry)
      } else {
        entry.notified = true
        notifiedTimerIds.add(entry.id)
        console.log(`[scheduler] stale timer (${Math.round(diffMs / 60000)}min ago), skipping: id=${entry.id} type=${entry.type}`)
      }
    }
  })

  checkInterval = setInterval(checkTimers, 1000)
}

export function stopScheduler(): void {
  console.log('[scheduler] stopScheduler', checkInterval)
  if (checkInterval) {
    console.log('[scheduler] stopScheduler: clearInterval')
    clearInterval(checkInterval)
    checkInterval = null
  }
}

function checkTimers(): void {
  const now = Date.now() / 1000
  let firedCount = 0
  timers.forEach((entry) => {
    if (!notifiedTimerIds.has(entry.id) && now >= entry.endTime) {
      entry.notified = true
      notifiedTimerIds.add(entry.id)
      firedCount++
      console.log(`[scheduler] timer FIRED: id=${entry.id} type=${entry.type} content=${entry.metadata.content} endTime=${entry.endTime} now=${now}`)
      dispatchNotification(entry)
    }
  })
  if (firedCount > 0) {
    console.log(`[scheduler] checkTimers: ${firedCount} timer(s) fired, active=${timers.size}`)
  }

  const toDelete: string[] = []
  timers.forEach((entry, key) => {
    if (entry.notified && (now - entry.endTime) > PURGE_THRESHOLD_S) {
      toDelete.push(key)
      notifiedTimerIds.delete(key)
    }
  })
  for (let i = 0; i < toDelete.length; i++) {
    timers.delete(toDelete[i])
  }
  if (toDelete.length > 0) schedulePersist()

  const today = formatDate(new Date())
  if (today !== lastKnownDate) {
    lastKnownDate = today
    siyuan.rpc.broadcast('date-changed', { date: today })
    rebuildReminderSchedule()
  }
}
