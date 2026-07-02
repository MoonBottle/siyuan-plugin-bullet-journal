import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  resetWecomBotService,
  useWecomBotService,
} from '@/services/wecomBotService'
import { WecomBotError } from '@/types/wecombot'

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = []
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  sentMessages: string[] = []

  constructor(public url: string) {
    MockWebSocket.instances.push(this)
    // 异步触发 onopen
    setTimeout(() => {
      this.readyState = 1
      this.onopen?.()
    }, 0)
  }

  send(data: string): void {
    this.sentMessages.push(data)
  }

  close(): void {
    this.readyState = 3
    this.onclose?.()
  }

  // 测试辅助：模拟收到服务器消息
  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) })
  }

  // 测试辅助：模拟连接错误
  simulateError(): void {
    this.onerror?.(new Event('error'))
  }
}

describe('wecomBotService - 连接与订阅', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
    resetWecomBotService()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetWecomBotService()
  })

  it('连接成功后应发送 aibot_subscribe 命令', async () => {
    const service = useWecomBotService({
      enabled: true,
      botId: 'test-bot-id',
      secret: 'test-secret',
      connectionStatus: 'disconnected',
    })

    service.startMonitoring()
    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1)
    })
    // 等待 onopen 触发后发送订阅
    await vi.waitFor(() => {
      const ws = MockWebSocket.instances[0]
      expect(ws.sentMessages.length).toBeGreaterThanOrEqual(1)
      const subCmd = JSON.parse(ws.sentMessages[0])
      expect(subCmd.cmd).toBe('aibot_subscribe')
      expect(subCmd.body.bot_id).toBe('test-bot-id')
      expect(subCmd.body.secret).toBe('test-secret')
    })
  })

  it('订阅成功后 connectionStatus 应变为 connected', async () => {
    const service = useWecomBotService({
      enabled: true,
      botId: 'test-bot-id',
      secret: 'test-secret',
      connectionStatus: 'disconnected',
    })

    service.startMonitoring()
    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1)
    })

    // 模拟订阅成功响应
    MockWebSocket.instances[0].simulateMessage({
      cmd: 'aibot_subscribe',
      headers: { req_id: 'test-req-id' },
      body: { ret: 0 },
    })

    expect(service.getConfig().connectionStatus).toBe('connected')
  })

  it('订阅失败应抛出 auth_failed 错误且不重连', async () => {
    const service = useWecomBotService({
      enabled: true,
      botId: 'bad-bot-id',
      secret: 'bad-secret',
      connectionStatus: 'disconnected',
    })

    const errorHandler = vi.fn()
    service.onError(errorHandler)

    service.startMonitoring()
    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1)
    })

    // 模拟订阅失败响应
    MockWebSocket.instances[0].simulateMessage({
      cmd: 'aibot_subscribe',
      headers: { req_id: 'test-req-id' },
      body: {
        ret: -1,
        errmsg: 'auth failed',
      },
    })

    expect(service.getConfig().connectionStatus).toBe('error')
    expect(errorHandler).toHaveBeenCalledWith(
      expect.any(WecomBotError),
    )
    const error = errorHandler.mock.calls[0][0] as WecomBotError
    expect(error.kind).toBe('auth_failed')

    // 不应触发重连（只有一个 WebSocket 实例）
    await new Promise((resolve) => setTimeout(resolve, 1100))
    expect(MockWebSocket.instances.length).toBe(1)
  })
})
