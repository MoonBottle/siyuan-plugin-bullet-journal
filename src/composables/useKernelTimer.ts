import { ref } from 'vue'
import { Events, eventBus } from '@/utils/eventBus'
import type { Plugin } from 'siyuan'

export const kernelAvailable = ref(false)

type KernelNotificationHandler = (params: any) => void

let onTimerExpired: KernelNotificationHandler | null = null
let onDateChanged: KernelNotificationHandler | null = null
let onStateChange: ((e: any) => void) | null = null

export function initKernelConnection(plugin: Plugin): void {
  onTimerExpired = (params: any) => {
    console.log('[KernelTimer] received timer-expired: type=' + params.type + ' id=' + params.id)
    eventBus.emit(Events.KERNEL_NOTIFICATION, params)
  }
  onDateChanged = (params: any) => {
    console.log('[KernelTimer] received date-changed: date=' + params.date)
    eventBus.emit(Events.KERNEL_DATE_CHANGED, params)
  }

  plugin.kernel.rpc.bind('timer-expired', onTimerExpired)
  plugin.kernel.rpc.bind('date-changed', onDateChanged)

  if (plugin.kernel.state.code === 2) {
    kernelAvailable.value = true
    console.log('[KernelTimer] kernel already running: true')
  }

  onStateChange = (state: { code: number; description: string }) => {
    const available = state.code === 2
    kernelAvailable.value = available
    console.log('[KernelTimer] kernel state changed: code=' + state.code + ' description=' + state.description + ' available=' + available)
  }
  plugin.eventBus.on('kernel-plugin-state-change', onStateChange)

  console.log('[KernelTimer] connection initialized')
}

export function destroyKernelConnection(plugin: Plugin): void {
  if (onTimerExpired) {
    plugin.kernel.rpc.unbind('timer-expired', onTimerExpired)
    onTimerExpired = null
  }
  if (onDateChanged) {
    plugin.kernel.rpc.unbind('date-changed', onDateChanged)
    onDateChanged = null
  }
  if (onStateChange) {
    plugin.eventBus.off('kernel-plugin-state-change', onStateChange)
    onStateChange = null
  }
  kernelAvailable.value = false
  console.log('[KernelTimer] connection destroyed')
}

export interface KernelDiagnoseResult {
  timers: Array<{
    id: string
    type: string
    endTime: number
    notified: boolean
    content: string
    remaining: number
  }>
  webhook: {
    enabled: boolean
    channels: Array<{
      name: string
      type: string
      enabled: boolean
      events: string[]
    }>
  }
  now: number
}
