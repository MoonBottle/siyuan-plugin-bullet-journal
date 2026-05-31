import type { TimerEntry } from './types'
import {
  cancelTimer,
  cancelTimersByType,
  getActiveTimers,
  registerTimer,
  registerTimers,
} from './scheduler'
import { getWebhookConfig } from './webhook'

export function handleRegisterTimer(params: { id: string, type: string, endTime: number, metadata: any }): any {
  const now = Math.floor(Date.now() / 1000)
  const remaining = params.endTime - now
  console.log(`[pomodoro] handleRegisterTimer: id=${params.id} type=${params.type} endTime=${params.endTime} remaining=${remaining}s metadata=${JSON.stringify(params.metadata)}`)
  const entry: TimerEntry = {
    id: params.id,
    type: params.type as TimerEntry['type'],
    endTime: params.endTime,
    metadata: params.metadata,
    notified: false,
  }
  registerTimer(entry)
  const activeTimers = getActiveTimers()
  console.log(`[pomodoro] handleRegisterTimer done: totalActiveTimers=${activeTimers.length} types=${activeTimers.map((t) => t.type).join(',')}`)
  return { ok: true }
}

export function handleRegisterTimers(params: { entries: TimerEntry[] }): any {
  console.log(`[pomodoro] handleRegisterTimers: count=${params.entries.length}`)
  for (let i = 0; i < params.entries.length; i++) {
    if (params.entries[i].notified === undefined) {
      params.entries[i].notified = false
    }
  }
  registerTimers(params.entries)
  return { ok: true }
}

export function handleCancelTimer(params: { id: string }): any {
  console.log(`[pomodoro] handleCancelTimer: id=${params.id}`)
  cancelTimer(params.id)
  return { ok: true }
}

export function handleCancelTimersByType(params: { type: string }): any {
  console.log(`[pomodoro] handleCancelTimersByType: type=${params.type}`)
  cancelTimersByType(params.type)
  return { ok: true }
}

export function handleGetActiveTimers(params: { type?: string }): any {
  const timers = getActiveTimers(params.type)
  console.log(`[pomodoro] handleGetActiveTimers: type=${params.type || 'all'} count=${timers.length}`)
  return timers
}

export function handlePing(): any {
  console.log('[pomodoro] handlePing')
  return {
    ok: true,
    name: siyuan.plugin.name,
    version: siyuan.plugin.version,
  }
}

export function handleDiagnose(): any {
  const timers = getActiveTimers()
  const webhookConfig = getWebhookConfig()
  const now = Date.now() / 1000
  console.log(`[pomodoro] handleDiagnose: timers=${timers.length} webhook.enabled=${webhookConfig.enabled} webhook.channels=${webhookConfig.channels.length}`)
  return {
    timers: timers.map((t) => {
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
      channels: webhookConfig.channels.map((ch) => {
        return {
          name: ch.name,
          type: ch.type,
          enabled: ch.enabled,
          events: ch.events,
        }
      }),
    },
    now,
  }
}
