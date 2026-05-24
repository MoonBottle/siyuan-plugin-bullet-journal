import type { TimerEntry } from './types'
import { registerTimer, registerTimers, cancelTimer, cancelTimersByType, getActiveTimers } from './scheduler'
import { getWebhookConfig } from './webhook'

export function handleRegisterTimer(params: { id: string, type: string, endTime: number, metadata: any }): any {
  console.log('[pomodoro] handleRegisterTimer: id=' + params.id + ' type=' + params.type + ' endTime=' + params.endTime)
  var entry: TimerEntry = {
    id: params.id,
    type: params.type as TimerEntry['type'],
    endTime: params.endTime,
    metadata: params.metadata,
    notified: false,
  }
  registerTimer(entry)
  return { ok: true }
}

export function handleRegisterTimers(params: { entries: TimerEntry[] }): any {
  console.log('[pomodoro] handleRegisterTimers: count=' + params.entries.length)
  registerTimers(params.entries)
  return { ok: true }
}

export function handleCancelTimer(params: { id: string }): any {
  console.log('[pomodoro] handleCancelTimer: id=' + params.id)
  cancelTimer(params.id)
  return { ok: true }
}

export function handleCancelTimersByType(params: { type: string }): any {
  console.log('[pomodoro] handleCancelTimersByType: type=' + params.type)
  cancelTimersByType(params.type)
  return { ok: true }
}

export function handleGetActiveTimers(params: { type?: string }): any {
  var timers = getActiveTimers(params.type)
  console.log('[pomodoro] handleGetActiveTimers: type=' + (params.type || 'all') + ' count=' + timers.length)
  return timers
}

export function handlePing(): any {
  console.log('[pomodoro] handlePing')
  return { ok: true, name: siyuan.plugin.name, version: siyuan.plugin.version }
}

export function handleDiagnose(): any {
  var timers = getActiveTimers()
  var webhookConfig = getWebhookConfig()
  var now = Date.now() / 1000
  console.log('[pomodoro] handleDiagnose: timers=' + timers.length + ' webhook.enabled=' + webhookConfig.enabled + ' webhook.channels=' + webhookConfig.channels.length)
  return {
    timers: timers.map(function (t) {
      return {
        id: t.id,
        type: t.type,
        endTime: t.endTime,
        notified: t.notified,
        content: t.metadata.content,
        remaining: t.endTime - now,
      }
    }),
    webhook: {
      enabled: webhookConfig.enabled,
      channels: webhookConfig.channels.map(function (ch) {
        return {
          name: ch.name,
          type: ch.type,
          enabled: ch.enabled,
          events: ch.events,
        }
      }),
    },
    now: now,
  }
}
