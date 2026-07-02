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

// Mock PiAgentAdapter for AI reply path tests
const { mockPiAgent } = vi.hoisted(() => {
  const fns = {
    createAgent: vi.fn(),
    prompt: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    getAgent: vi.fn(() => null),
    dispose: vi.fn(),
  }
  class MockPiAgentAdapter {
    createAgent = fns.createAgent
    prompt = fns.prompt
    subscribe = fns.subscribe
    getAgent = fns.getAgent
    dispose = fns.dispose
  }
  return {
    mockPiAgent: {
      MockPiAgentAdapter,
      ...fns,
    },
  }
})

vi.mock('@/agents/pi/PiAgentAdapter', () => ({
  PiAgentAdapter: mockPiAgent.MockPiAgentAdapter,
}))

vi.mock('@/services/aiPromptService', () => ({
  buildSystemPrompt: vi.fn(() => 'system prompt'),
}))

vi.mock('@/services/skillService', () => ({
  SkillService: {
    getInstance: vi.fn(() => ({
      getEnabledSkills: vi.fn(() => []),
    })),
  },
}))

vi.mock('@/services/aiTools', () => ({
  bulletJournalTools: [],
  setToolContext: vi.fn(),
}))

vi.mock('@/stores/projectStore', () => ({
  useProjectStore: vi.fn(() => ({
    projects: [],
    items: [],
  })),
}))

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: vi.fn(() => ({
    groups: [],
    directories: [],
  })),
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

describe('aiStore - wecomBot AI 回复路径', () => {
  function createTestProvider() {
    return {
      id: 'test-provider',
      name: 'Test Provider',
      provider: 'openai' as const,
      apiKey: 'test-api-key',
      apiUrl: 'https://api.test.com/v1',
      models: ['gpt-4'],
      defaultModel: 'gpt-4',
      enabled: true,
    }
  }

  function createTestMsg(
    content = '你好',
    chatid = 'user-001',
    chattype: 'single' | 'group' = 'single',
  ): WecomMsgCallbackEvent {
    return {
      cmd: 'aibot_msg_callback',
      headers: { req_id: 'test' },
      body: {
        msgid: `msg-${Date.now()}`,
        aibotid: 'bot-001',
        chatid,
        chattype,
        from: { userid: 'user-001' },
        msgtype: 'text',
        text: { content },
      },
    }
  }

  beforeEach(() => {
    setActivePinia(createPinia())

    mockPiAgent.createAgent.mockResolvedValue(undefined)
    mockPiAgent.prompt.mockResolvedValue(undefined)
    mockPiAgent.subscribe.mockReturnValue(() => {})
    mockPiAgent.dispose.mockReturnValue(undefined)
    mockPiAgent.getAgent.mockReturnValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('未启用 AI 时不调用 sendReplyToWecom', async () => {
    const store = useAIStore()
    const mockService = useWecomBotService()
    vi.mocked(mockService.isConnected).mockReturnValue(true)

    await store.handleWecomMessage(createTestMsg())

    // AI 未启用（无 provider），不应调用 AI 或发送消息
    expect(mockPiAgent.prompt).not.toHaveBeenCalled()
    expect(mockService.sendTextMessage).not.toHaveBeenCalled()
  })

  it('回复成功时通过 sendReplyToWecom 发送回复', async () => {
    const store = useAIStore()
    store.setProviders([createTestProvider()])
    store.setActiveProvider('test-provider')

    const mockService = useWecomBotService()
    vi.mocked(mockService.isConnected).mockReturnValue(true)
    vi.mocked(mockService.sendTextMessage).mockResolvedValue(undefined)

    // 模拟 AI 返回 assistant 消息：prompt 执行后向 agent.state.messages 追加 assistant 消息
    const mockAgent = {
      state: {
        messages: [] as Array<{ role: string, content: unknown, timestamp: number }>,
      },
    }
    mockPiAgent.getAgent.mockReturnValue(mockAgent)
    mockPiAgent.prompt.mockImplementation(async () => {
      mockAgent.state.messages.push({
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '你好，我是 AI 助手',
          },
        ],
        timestamp: Date.now(),
      })
    })

    await store.handleWecomMessage(createTestMsg())

    expect(mockPiAgent.prompt).toHaveBeenCalledWith('你好')
    expect(mockService.sendTextMessage).toHaveBeenCalledWith(
      'user-001',
      '你好，我是 AI 助手',
      'single',
    )
  })

  it('回复失败时通过 sendReplyToWecom 发送错误提示', async () => {
    const store = useAIStore()
    store.setProviders([createTestProvider()])
    store.setActiveProvider('test-provider')

    const mockService = useWecomBotService()
    vi.mocked(mockService.isConnected).mockReturnValue(true)
    vi.mocked(mockService.sendTextMessage).mockResolvedValue(undefined)

    // 模拟 AI 调用失败
    mockPiAgent.prompt.mockRejectedValue(new Error('AI service error'))

    await store.handleWecomMessage(createTestMsg())

    expect(mockPiAgent.prompt).toHaveBeenCalled()
    expect(mockService.sendTextMessage).toHaveBeenCalledWith(
      'user-001',
      '抱歉，我暂时无法处理您的请求，请稍后再试。',
      'single',
    )
  })
})
