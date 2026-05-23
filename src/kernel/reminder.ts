import type { KernelData, TimerEntry } from './types'
import { calculateReminderTime } from './utils'
import { registerTimers, cancelTimersByType } from './scheduler'

var fsNotifyDebounceTimer: ReturnType<typeof setTimeout> | null = null
var pendingPaths: Record<string, boolean> = {}
var reloadWebhookConfigFn: (() => Promise<void>) | null = null

export function setReloadWebhookConfig(fn: () => Promise<void>): void {
  reloadWebhookConfigFn = fn
}

export async function initReminderScheduler(): Promise<void> {
  await siyuan.storage.watcher.add('.')
  await rebuildReminderSchedule()
}

export async function rebuildReminderSchedule(): Promise<void> {
  try {
    var result = await siyuan.storage.get('kernel-data.json')
    var data: KernelData = await result.json()
    if (!data) return

    cancelTimersByType('reminder')
    cancelTimersByType('habit')

    var entries: TimerEntry[] = []
    var now = Date.now()
    var futureWindowMs = 24 * 60 * 60 * 1000

    if (data.items) {
      for (var i = 0; i < data.items.length; i++) {
        var item = data.items[i]
        if (item.status === 'completed' || item.status === 'abandoned') continue
        if (!item.reminder || !item.reminder.enabled) continue
        var reminderTime = calculateReminderTime(
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
          id: 'reminder-' + item.id + '-' + item.date + '-' + reminderTime,
          type: 'reminder',
          endTime: Math.floor(reminderTime / 1000),
          metadata: {
            blockId: item.id,
            content: item.content,
            projectName: item.projectName,
            taskName: item.taskName,
          },
          notified: false,
        })
      }
    }

    if (data.habits) {
      for (var j = 0; j < data.habits.length; j++) {
        var habit = data.habits[j]
        if (!habit.reminder || !habit.reminder.enabled) continue
        var habitReminderTime = calculateReminderTime(
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
          id: 'habit-' + habit.blockId + '-' + habit.targetDate + '-' + habitReminderTime,
          type: 'habit',
          endTime: Math.floor(habitReminderTime / 1000),
          metadata: {
            blockId: habit.blockId,
            content: habit.name,
          },
          notified: false,
        })
      }
    }

    if (entries.length > 0) {
      registerTimers(entries)
    }
  } catch (e) {
    await siyuan.logger.warn('[reminder] failed to rebuild schedule: ' + String(e))
  }
}

export function handleFsNotify(event: { type: string, detail: any }): void {
  if (event.type !== 'fs-notify') return
  var path = event.detail.path.replace(/\\/g, '/')
  pendingPaths[path] = true
  if (fsNotifyDebounceTimer) clearTimeout(fsNotifyDebounceTimer)
  fsNotifyDebounceTimer = setTimeout(function () {
    if (pendingPaths['kernel-data.json']) {
      void rebuildReminderSchedule()
    }
    if (pendingPaths['webhook-config.json']) {
      if (reloadWebhookConfigFn) void reloadWebhookConfigFn()
    }
    pendingPaths = {}
  }, 200)
}
