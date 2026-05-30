import type {
  KernelData,
  TimerEntry,
} from './types'
import {
  cancelTimersByType,
  isSchedulerActive,
  registerTimers,
} from './scheduler'
import { calculateReminderTime } from './utils'

const PATH_SEP_RE = /[/\\]/g

let fsNotifyDebounceTimer: ReturnType<typeof setTimeout> | null = null
let pendingPaths: Record<string, boolean> = {}
let reloadWebhookConfigFn: (() => Promise<void>) | null = null

export function setReloadWebhookConfig(fn: () => Promise<void>): void {
  reloadWebhookConfigFn = fn
}

export async function initReminderScheduler(): Promise<void> {
  await siyuan.storage.watcher.add('.')
  console.log('[reminder] storage watcher added')
  await rebuildReminderSchedule()
}

export async function rebuildReminderSchedule(): Promise<void> {
  if (!isSchedulerActive()) return
  try {
    const result = await siyuan.storage.get('kernel-data.json')
    const data: KernelData = await result.json()
    if (!data) {
      console.log('[reminder] kernel-data.json is empty or null')
      return
    }

    console.log(`[reminder] kernel-data loaded: items=${data.items ? data.items.length : 0} habits=${data.habits ? data.habits.length : 0}`)

    cancelTimersByType('reminder')
    cancelTimersByType('habit')

    const entries: TimerEntry[] = []
    const now = Date.now()
    const futureWindowMs = 24 * 60 * 60 * 1000

    if (data.items) {
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i]
        if (item.status === 'completed' || item.status === 'abandoned') continue
        if (!item.reminder || !item.reminder.enabled) continue
        const reminderTime = calculateReminderTime(
          item.date,
          item.startDateTime,
          item.endDateTime,
          item.startTime,
          item.endTime,
          item.reminder,
        )
        if (reminderTime < now - 5 * 60 * 1000) continue
        if (reminderTime > now + futureWindowMs) continue
        entries.push({
          id: `reminder-${item.blockId || item.id}-${item.date}-${reminderTime}`,
          type: 'reminder',
          endTime: Math.floor(reminderTime / 1000),
          metadata: {
            blockId: item.blockId || item.id,
            content: item.content,
            projectName: item.projectName,
            taskName: item.taskName,
          },
          notified: false,
        })
      }
    }

    if (data.habits) {
      for (let j = 0; j < data.habits.length; j++) {
        const habit = data.habits[j]
        if (!habit.reminder || !habit.reminder.enabled) continue
        const habitReminderTime = calculateReminderTime(
          habit.targetDate,
          undefined,
          undefined,
          undefined,
          undefined,
          habit.reminder,
        )
        if (habitReminderTime < now - 5 * 60 * 1000) continue
        if (habitReminderTime > now + futureWindowMs) continue
        entries.push({
          id: `habit-${habit.blockId}-${habit.targetDate}-${habitReminderTime}`,
          type: 'habit',
          endTime: Math.floor(habitReminderTime / 1000),
          metadata: {
            blockId: habit.blockId,
            content: habit.name,
            target: habit.target,
            unit: habit.unit,
          },
          notified: false,
        })
      }
    }

    if (entries.length > 0) {
      registerTimers(entries)
    }

    console.log(`[reminder] schedule rebuilt: ${entries.length} timer entries registered (reminder + habit)`)
  } catch (e) {
    console.log(`[reminder] failed to rebuild schedule: ${String(e)}`)
  }
}

export function handleFsNotify(event: { type: string, detail: any }): void {
  if (event.type !== 'fs-notify') return
  const path = event.detail.path.replace(PATH_SEP_RE, '/')
  if (path.endsWith('.tmp')) return
  if (path === 'timer-registry.json') return
  console.log(`[reminder] fs-notify: path=${path}`)
  pendingPaths[path] = true
  if (fsNotifyDebounceTimer) clearTimeout(fsNotifyDebounceTimer)
  fsNotifyDebounceTimer = setTimeout(() => {
    if (pendingPaths['kernel-data.json']) {
      void rebuildReminderSchedule()
    }
    if (pendingPaths.settings) {
      if (reloadWebhookConfigFn) void reloadWebhookConfigFn()
    }
    pendingPaths = {}
  }, 200)
}
