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
  WecomBotService,
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
      headers: { req_id: 'test-req-id' },
      errcode: 0,
      errmsg: 'ok',
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
      headers: { req_id: 'test-req-id' },
      errcode: -1,
      errmsg: 'auth failed',
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

describe('wecomBotService - 消息收发', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
    resetWecomBotService()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetWecomBotService()
  })

  it('收到 aibot_msg_callback 应触发 messageHandlers', async () => {
    const service = useWecomBotService({
      enabled: true,
      botId: 'test-bot-id',
      secret: 'test-secret',
      connectionStatus: 'disconnected',
    })

    const messageHandler = vi.fn()
    service.onMessage(messageHandler)

    service.startMonitoring()
    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1)
    })

    // 模拟订阅成功
    MockWebSocket.instances[0].simulateMessage({
      headers: { req_id: 'test-req-id' },
      errcode: 0,
      errmsg: 'ok',
    })

    // 模拟收到消息
    const msgEvent = {
      cmd: 'aibot_msg_callback',
      headers: { req_id: 'test-req-id' },
      body: {
        msgid: 'msg-001',
        aibotid: 'test-bot-id',
        chatid: 'chat-001',
        chattype: 'single',
        from: { userid: 'user-001' },
        msgtype: 'text',
        text: { content: '你好' },
      },
    }
    MockWebSocket.instances[0].simulateMessage(msgEvent)

    expect(messageHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        cmd: 'aibot_msg_callback',
        body: expect.objectContaining({
          msgid: 'msg-001',
          chatid: 'chat-001',
        }),
      }),
    )
  })

  it('sendTextMessage 应发送 aibot_send_msg 命令', async () => {
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
    // 等待 onopen 触发，readyState 变为 1
    await vi.waitFor(() => {
      expect(MockWebSocket.instances[0].readyState).toBe(1)
    })

    // 订阅成功
    MockWebSocket.instances[0].simulateMessage({
      headers: { req_id: 'test-req-id' },
      errcode: 0,
      errmsg: 'ok',
    })

    await service.sendTextMessage('chat-001', '回复内容', 'single')

    const ws = MockWebSocket.instances[0]
    const sendCmd = JSON.parse(ws.sentMessages.at(-1))
    expect(sendCmd.cmd).toBe('aibot_send_msg')
    expect(sendCmd.body.chatid).toBe('chat-001')
    expect(sendCmd.body.chat_type).toBe(1)
    expect(sendCmd.body.msgtype).toBe('markdown')
    expect(sendCmd.body.markdown.content).toBe('回复内容')
  })

  it('群聊消息应剥离 @机器人 前缀', () => {
    expect(WecomBotService.stripMentionPrefix('@RobotA 你好', 'RobotA')).toBe('你好')
    expect(WecomBotService.stripMentionPrefix('你好', 'RobotA')).toBe('你好')
    expect(WecomBotService.stripMentionPrefix('@OtherBot 你好', 'RobotA')).toBe('@OtherBot 你好')
  })
})

describe('wecomBotService - 重连策略', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', MockWebSocket)
    resetWecomBotService()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    resetWecomBotService()
  })

  it('连接断开应指数退避重连', async () => {
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

    // 订阅成功
    MockWebSocket.instances[0].simulateMessage({
      headers: { req_id: 'test-req-id' },
      errcode: 0,
      errmsg: 'ok',
    })

    // 模拟连接断开
    MockWebSocket.instances[0].close()

    // 第一次重连应在 1s 后
    expect(MockWebSocket.instances.length).toBe(1)
    vi.advanceTimersByTime(1000)
    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(2)
    })
  })

  it('达到最大重连次数后应标记 error 状态', async () => {
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

    // 订阅成功
    MockWebSocket.instances[0].simulateMessage({
      headers: { req_id: 'test-req-id' },
      errcode: 0,
      errmsg: 'ok',
    })

    // 模拟 10 次断开+重连
    for (let i = 0; i < 11; i++) {
      const currentWs = MockWebSocket.instances.at(-1)
      if (currentWs.readyState === 1) {
        currentWs.close()
      }
      vi.advanceTimersByTime(31000)
    }

    expect(service.getConfig().connectionStatus).toBe('error')
  })
})

describe('wecomBotService - 事件回调', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
    resetWecomBotService()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetWecomBotService()
  })

  it('收到 aibot_event_callback (enter_chat) 应触发 eventHandlers', async () => {
    const service = useWecomBotService({
      enabled: true,
      botId: 'test-bot-id',
      secret: 'test-secret',
      connectionStatus: 'disconnected',
    })

    const eventHandler = vi.fn()
    service.onEvent(eventHandler)

    service.startMonitoring()
    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1)
    })

    // 订阅成功
    MockWebSocket.instances[0].simulateMessage({
      headers: { req_id: 'test-req-id' },
      errcode: 0,
      errmsg: 'ok',
    })

    // 模拟收到 enter_chat 事件
    MockWebSocket.instances[0].simulateMessage({
      cmd: 'aibot_event_callback',
      headers: { req_id: 'test-req-id' },
      body: {
        msgid: 'event-001',
        create_time: 1700000000,
        aibotid: 'test-bot-id',
        from: { userid: 'user-001' },
        msgtype: 'event',
        event: { eventtype: 'enter_chat' },
      },
    })

    expect(eventHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        cmd: 'aibot_event_callback',
        body: expect.objectContaining({
          msgtype: 'event',
          event: { eventtype: 'enter_chat' },
        }),
      }),
    )
  })

  it('收到 disconnected_event 应停止监控且不重连', async () => {
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

    // 订阅成功
    MockWebSocket.instances[0].simulateMessage({
      headers: { req_id: 'test-req-id' },
      errcode: 0,
      errmsg: 'ok',
    })

    // 模拟收到 disconnected_event
    MockWebSocket.instances[0].simulateMessage({
      cmd: 'aibot_event_callback',
      headers: { req_id: 'test-req-id' },
      body: {
        msgid: 'event-002',
        create_time: 1700000000,
        aibotid: 'test-bot-id',
        msgtype: 'event',
        event: { eventtype: 'disconnected_event' },
      },
    })

    expect(service.getConfig().connectionStatus).toBe('disconnected')
    expect(service.getConfig().errorMessage).toBe('连接被新连接取代')

    // 等待一段时间，不应触发重连（无新 WebSocket 实例）
    await new Promise((resolve) => setTimeout(resolve, 1100))
    expect(MockWebSocket.instances.length).toBe(1)
  })
})
