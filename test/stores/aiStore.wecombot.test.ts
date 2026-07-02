import type { WecomMsgCallbackEvent } from '@/types/wecombot'
import {
  createPinia,
  setActivePinia,
} from 'pinia'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { useWecomBotService } from '@/services/wecomBotService'
import { useAIStore } from '@/stores/aiStore'

// Mock WecomBotService
vi.mock('@/services/wecomBotService', () => {
  const mockService = {
    getConfig: vi.fn(() => ({
      enabled: false,
      botId: '',
      secret: '',
      connectionStatus: 'disconnected',
    })),
    updateConfig: vi.fn(),
    isConnected: vi.fn(() => false),
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
    onMessage: vi.fn(() => () => {}),
    onError: vi.fn(() => () => {}),
    sendTextMessage: vi.fn().mockResolvedValue(undefined),
    clearMessageHandlers: vi.fn(),
    clearErrorHandlers: vi.fn(),
  }

  class MockWecomBotService {
    static stripMentionPrefix(content: string, botName?: string): string {
      if (!botName) {
        return content.replace(/^@\S+\s*/, '')
      }
      const prefix = `@${botName} `
      if (content.startsWith(prefix)) {
        return content.slice(prefix.length)
      }
      return content
    }
  }

  return {
    useWecomBotService: () => mockService,
    resetWecomBotService: vi.fn(),
    WecomBotService: MockWecomBotService,
  }
})

// Mock conversationStorageService
vi.mock('@/services/conversationStorageService', () => ({
  useConversationStorage: () => ({
    saveConversation: vi.fn(),
    loadConversation: vi.fn(() => null),
    loadAllConversations: vi.fn(() => []),
  }),
}))

describe('aiStore - wecomBot state 与初始化', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('应暴露 wecomBotConfig 状态', () => {
    const store = useAIStore()
    expect(store.wecomBotConfig).toBeDefined()
    expect(store.wecomBotConfig.enabled).toBe(false)
    expect(store.wecomBotConfig.connectionStatus).toBe('disconnected')
  })

  it('应暴露 wecomConversationMap 状态', () => {
    const store = useAIStore()
    expect(store.wecomConversationMap).toBeDefined()
    expect(typeof store.wecomConversationMap).toBe('object')
  })

  it('isWecomBotConnected getter 应反映连接状态', () => {
    const store = useAIStore()
    expect(store.isWecomBotConnected).toBe(false)
  })

  it('initializeWecomBot 应注册消息和错误处理器', async () => {
    const mockService = useWecomBotService()
    const store = useAIStore()

    // 模拟插件实例
    const mockPlugin = {
      loadData: vi.fn().mockResolvedValue(null),
      saveData: vi.fn().mockResolvedValue(undefined),
    }

    await store.initializeWecomBot(mockPlugin as any)

    expect(mockService.onMessage).toHaveBeenCalled()
    expect(mockService.onError).toHaveBeenCalled()
  })
})

describe('aiStore - wecomBot 消息处理', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('handleWecomMessage 应创建新会话（单聊）', async () => {
    const store = useAIStore()
    const msg: WecomMsgCallbackEvent = {
      cmd: 'aibot_msg_callback',
      headers: { req_id: 'test' },
      body: {
        msgid: 'msg-001',
        aibotid: 'bot-001',
        chatid: 'user-001',
        chattype: 'single',
        from: { userid: 'user-001' },
        msgtype: 'text',
        text: { content: '你好' },
      },
    }

    await store.handleWecomMessage(msg)

    expect(store.wecomConversationMap['wecom:user-001']).toBeDefined()
    expect(store.wecomConversationMap['wecom:user-001'].chatType).toBe('single')
    expect(store.wecomConversationMap['wecom:user-001'].userId).toBe('user-001')
  })

  it('handleWecomMessage 应创建新会话（群聊，剥离 @前缀）', async () => {
    const store = useAIStore()
    const msg: WecomMsgCallbackEvent = {
      cmd: 'aibot_msg_callback',
      headers: { req_id: 'test' },
      body: {
        msgid: 'msg-002',
        aibotid: 'bot-001',
        chatid: 'group-001',
        chattype: 'group',
        from: { userid: 'user-002' },
        msgtype: 'text',
        text: { content: '@RobotA 你好' },
      },
    }

    await store.handleWecomMessage(msg)

    expect(store.wecomConversationMap['wecom:group:group-001']).toBeDefined()
    expect(store.wecomConversationMap['wecom:group:group-001'].chatType).toBe('group')
  })

  it('getOrCreateWecomConversation 应复用已有会话', async () => {
    const store = useAIStore()
    // 预置会话
    store.wecomConversationMap['wecom:user-001'] = {
      chatId: 'user-001',
      chatType: 'single',
      userId: 'user-001',
      lastMessageAt: Date.now() - 1000,
      unreadCount: 0,
      active: true,
      consecutiveFailures: 0,
    }

    const conv = store.getOrCreateWecomConversation('user-001', 'single')
    expect(conv.chatId).toBe('user-001')
    // 不应创建新会话
    expect(Object.keys(store.wecomConversationMap).length).toBe(1)
  })
})
