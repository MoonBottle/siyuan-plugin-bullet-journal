import { ref } from 'vue'
import { Events, eventBus } from '@/utils/eventBus'

const PLUGIN_NAME = 'siyuan-plugin-bullet-journal'
export const kernelAvailable = ref(false)

let ws: WebSocket | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null
let wsReconnectAttempts = 0
const WS_MAX_RECONNECT_ATTEMPTS = 10

export async function rpcCall<T = any>(method: string, params?: Record<string, any>): Promise<T> {
  const resp = await fetch(`/api/plugin/rpc/${PLUGIN_NAME}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params: params ?? {},
      id: Date.now(),
    }),
  })
  const data = await resp.json()
  if (data.error) {
    throw new Error(`RPC Error ${data.error.code}: ${data.error.message}`)
  }
  return data.result as T
}

export async function checkKernelAvailable(): Promise<boolean> {
  try {
    await rpcCall('ping')
    kernelAvailable.value = true
    console.log('[KernelTimer] kernel available: true')
  } catch (e) {
    kernelAvailable.value = false
    console.log('[KernelTimer] kernel available: false, error=' + String(e))
  }
  return kernelAvailable.value
}

let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryAttempts = 0
const MAX_RETRY_ATTEMPTS = 5
const RETRY_INTERVAL = 3000

export function startKernelAvailabilityCheck(): void {
  void checkKernelAvailable().then((available) => {
    if (available) {
      connectKernelWebSocket()
      return
    }
    if (retryAttempts < MAX_RETRY_ATTEMPTS) {
      retryAttempts++
      console.log('[KernelTimer] kernel not available, retry ' + retryAttempts + '/' + MAX_RETRY_ATTEMPTS + ' in ' + RETRY_INTERVAL + 'ms')
      retryTimer = setTimeout(async () => {
        const ok = await checkKernelAvailable()
        if (ok) {
          connectKernelWebSocket()
        } else {
          startKernelAvailabilityCheck()
        }
      }, RETRY_INTERVAL)
    } else {
      console.log('[KernelTimer] kernel not available after ' + MAX_RETRY_ATTEMPTS + ' retries, giving up')
    }
  })
}

export function stopKernelAvailabilityCheck(): void {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  retryAttempts = 0
}

export function connectKernelWebSocket(): void {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer)
    wsReconnectTimer = null
  }

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const token = (window as any).siyuan?.config?.accessToken || ''
  const wsUrl = token
    ? `${protocol}://${location.host}/ws/plugin/rpc/${PLUGIN_NAME}?token=${encodeURIComponent(token)}`
    : `${protocol}://${location.host}/ws/plugin/rpc/${PLUGIN_NAME}`

  ws = new WebSocket(wsUrl)
  ws.onopen = () => {
    wsReconnectAttempts = 0
    console.log('[KernelTimer] WebSocket connected')
  }
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.method === 'timer-expired') {
        console.log('[KernelTimer] received timer-expired: type=' + (data.params && data.params.type) + ' id=' + (data.params && data.params.id))
        eventBus.emit(Events.KERNEL_NOTIFICATION, data.params)
      }
      if (data.method === 'date-changed') {
        console.log('[KernelTimer] received date-changed: date=' + (data.params && data.params.date))
        eventBus.emit(Events.KERNEL_DATE_CHANGED, data.params)
      }
    } catch (e) {
      console.log('[KernelTimer] WebSocket message parse error: ' + String(e))
    }
  }
  ws.onclose = () => {
    ws = null
    console.log('[KernelTimer] WebSocket closed, reconnect attempts=' + wsReconnectAttempts)
    if (wsReconnectAttempts >= WS_MAX_RECONNECT_ATTEMPTS) {
      kernelAvailable.value = false
      return
    }
    wsReconnectAttempts++
    wsReconnectTimer = setTimeout(connectKernelWebSocket, 5000)
  }
  ws.onerror = () => {
    console.log('[KernelTimer] WebSocket error')
    ws?.close()
  }
}

export function disconnectKernelWebSocket(): void {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer)
    wsReconnectTimer = null
  }
  if (ws) {
    ws.close()
    ws = null
  }
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

export async function diagnoseKernel(): Promise<KernelDiagnoseResult> {
  return rpcCall<KernelDiagnoseResult>('diagnose')
}
