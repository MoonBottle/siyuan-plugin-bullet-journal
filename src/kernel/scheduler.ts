import type { TimerEntry } from './types'
import { formatDate } from './utils'

var timers = new Map<string, TimerEntry>()
var checkInterval: ReturnType<typeof setInterval> | null = null
var lastKnownDate = ''
var persistTimer: ReturnType<typeof setTimeout> | null = null
var isDirty = false

var MISSED_THRESHOLD_MS = 5 * 60 * 1000
var PURGE_THRESHOLD_S = 24 * 60 * 60

export function getTimers(): Map<string, TimerEntry> {
  return timers
}

export async function loadTimerRegistry(): Promise<void> {
  try {
    var result = await siyuan.storage.get('timer-registry.json')
    var data = await result.json()
    if (data && Array.isArray(data)) {
      for (var i = 0; i < data.length; i++) {
        var entry = data[i] as TimerEntry
        if (entry.id && entry.endTime) {
          timers.set(entry.id, entry)
        }
      }
    }
  } catch (e) {
    await siyuan.logger.warn('[scheduler] failed to load timer registry: ' + String(e))
  }
}

export async function persistTimerRegistry(): Promise<void> {
  if (!isDirty) return
  var entries: TimerEntry[] = []
  timers.forEach(function (entry) {
    if (entry.type === 'reminder' || entry.type === 'habit') {
      entries.push(entry)
    }
  })
  try {
    await siyuan.storage.put('timer-registry.json', JSON.stringify(entries))
    isDirty = false
  } catch (e) {
    await siyuan.logger.warn('[scheduler] failed to persist timer registry: ' + String(e))
  }
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(function () {
    void persistTimerRegistry()
  }, 5000)
  isDirty = true
}

export function registerTimer(entry: TimerEntry): void {
  console.log('[scheduler] registerTimer: id=' + entry.id + ' type=' + entry.type + ' endTime=' + entry.endTime + ' content=' + entry.metadata.content)
  timers.set(entry.id, entry)
  schedulePersist()
}

export function registerTimers(entries: TimerEntry[]): void {
  console.log('[scheduler] registerTimers: count=' + entries.length)
  for (var i = 0; i < entries.length; i++) {
    console.log('[scheduler]   - id=' + entries[i].id + ' type=' + entries[i].type + ' endTime=' + entries[i].endTime)
    timers.set(entries[i].id, entries[i])
  }
  schedulePersist()
}

export function cancelTimer(id: string): void {
  timers.delete(id)
  schedulePersist()
}

export function cancelTimersByType(type: string): void {
  var toDelete: string[] = []
  timers.forEach(function (entry, key) {
    if (entry.type === type) {
      toDelete.push(key)
    }
  })
  for (var i = 0; i < toDelete.length; i++) {
    timers.delete(toDelete[i])
  }
  if (toDelete.length > 0) {
    console.log('[scheduler] cancelTimersByType: type=' + type + ' cancelled=' + toDelete.length)
  }
  schedulePersist()
}

export function getActiveTimers(type?: string): TimerEntry[] {
  var result: TimerEntry[] = []
  timers.forEach(function (entry) {
    if (!type || entry.type === type) {
      result.push(entry)
    }
  })
  return result
}

export function initScheduler(): void {
  lastKnownDate = formatDate(new Date())
  console.log('[scheduler] initScheduler: existing timers=' + timers.size + ' today=' + lastKnownDate)
  var now = Date.now() / 1000
  timers.forEach(function (entry) {
    if (!entry.notified && entry.endTime <= now) {
      var diffMs = (now - entry.endTime) * 1000
      if (diffMs <= MISSED_THRESHOLD_MS) {
        entry.notified = true
        console.log('[scheduler] missed timer (within ' + Math.round(diffMs / 1000) + 's): id=' + entry.id + ' type=' + entry.type + ' content=' + entry.metadata.content)
        dispatchNotification(entry)
      } else {
        entry.notified = true
        console.log('[scheduler] stale timer (' + Math.round(diffMs / 60000) + 'min ago), skipping: id=' + entry.id + ' type=' + entry.type)
      }
    }
  })

  checkInterval = setInterval(checkTimers, 1000)
}

export function stopScheduler(): void {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
}

function checkTimers(): void {
  var now = Date.now() / 1000
  var firedCount = 0
  timers.forEach(function (entry) {
    if (!entry.notified && now >= entry.endTime) {
      entry.notified = true
      firedCount++
      console.log('[scheduler] timer FIRED: id=' + entry.id + ' type=' + entry.type + ' content=' + entry.metadata.content + ' endTime=' + entry.endTime + ' now=' + now)
      dispatchNotification(entry)
    }
  })
  if (firedCount > 0) {
    console.log('[scheduler] checkTimers: ' + firedCount + ' timer(s) fired, active=' + timers.size)
  }

  var toDelete: string[] = []
  timers.forEach(function (entry, key) {
    if (entry.notified && (now - entry.endTime) > PURGE_THRESHOLD_S) {
      toDelete.push(key)
    }
  })
  for (var i = 0; i < toDelete.length; i++) {
    timers.delete(toDelete[i])
  }
  if (toDelete.length > 0) schedulePersist()

  var today = formatDate(new Date())
  if (today !== lastKnownDate) {
    lastKnownDate = today
    siyuan.rpc.broadcast('date-changed', { date: today })
    rebuildReminderSchedule()
  }
}

var dispatchNotification: (entry: TimerEntry) => void = function () {}
var rebuildReminderSchedule: () => void = function () {}

export function setDispatchNotification(fn: (entry: TimerEntry) => void): void {
  dispatchNotification = fn
}

export function setRebuildReminderSchedule(fn: () => void): void {
  rebuildReminderSchedule = fn
}
