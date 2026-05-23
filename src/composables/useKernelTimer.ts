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
  } catch {
    kernelAvailable.value = false
  }
  return kernelAvailable.value
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
  }
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.method === 'timer-expired') {
        eventBus.emit(Events.KERNEL_NOTIFICATION, data.params)
      }
      if (data.method === 'date-changed') {
        eventBus.emit(Events.KERNEL_DATE_CHANGED, data.params)
      }
    } catch {
      // ignore parse errors
    }
  }
  ws.onclose = () => {
    ws = null
    if (wsReconnectAttempts >= WS_MAX_RECONNECT_ATTEMPTS) {
      kernelAvailable.value = false
      return
    }
    wsReconnectAttempts++
    wsReconnectTimer = setTimeout(connectKernelWebSocket, 5000)
  }
  ws.onerror = () => {
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
