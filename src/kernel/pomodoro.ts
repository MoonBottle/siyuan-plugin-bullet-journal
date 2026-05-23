import type { TimerEntry } from './types'
import { registerTimer, registerTimers, cancelTimer, cancelTimersByType, getActiveTimers } from './scheduler'

export function handleRegisterTimer(params: { id: string, type: string, endTime: number, metadata: any }): any {
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
  registerTimers(params.entries)
  return { ok: true }
}

export function handleCancelTimer(params: { id: string }): any {
  cancelTimer(params.id)
  return { ok: true }
}

export function handleCancelTimersByType(params: { type: string }): any {
  cancelTimersByType(params.type)
  return { ok: true }
}

export function handleGetActiveTimers(params: { type?: string }): any {
  return getActiveTimers(params.type)
}

export function handlePing(): any {
  return { ok: true, name: siyuan.plugin.name, version: siyuan.plugin.version }
}
