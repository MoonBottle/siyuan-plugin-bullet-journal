import {
  createPinia,
  setActivePinia,
} from 'pinia'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { ClawBotApiError } from '@/services/clawBotService'
import { useAIStore } from '@/stores/aiStore'

const {
  mockUseConversationStorage,
  mockUseClawBotService,
  mockResetClawBotService,
  mockShowMessage,
  mockStorageService,
  mockClawBotService,
} = vi.hoisted(() => {
  const storageService = {
    initialize: vi.fn(),
    getIndex: vi.fn(),
    loadConversation: vi.fn(),
    loadConversationsList: vi.fn(),
    createConversation: vi.fn(),
    saveConversation: vi.fn(),
    setCurrentConversation: vi.fn(),
    deleteConversation: vi.fn(),
  }

  const clawBotService = {
    isConnected: vi.fn(),
    isContextStaleError: vi.fn((error: any) => error?.kind === 'context_stale'),
    sendTextMessage: vi.fn(),
    probeContext: vi.fn(),
    notifyGatewayStart: vi.fn(),
    sendTypingKeepalive: vi.fn(),
    startMonitoring: vi.fn(),
    clearMessageHandlers: vi.fn(),
    onMessage: vi.fn(),
    updateConfig: vi.fn(),
    disconnect: vi.fn(),
    getConfig: vi.fn(),
  }

  return {
    mockUseConversationStorage: vi.fn(() => storageService),
    mockUseClawBotService: vi.fn(() => clawBotService),
    mockResetClawBotService: vi.fn(),
    mockShowMessage: vi.fn(),
    mockStorageService: storageService,
    mockClawBotService: clawBotService,
  }
})

vi.mock('@/services/conversationStorageService', () => ({
  useConversationStorage: mockUseConversationStorage,
}))

vi.mock('@/services/clawBotService', async () => {
  const actual = await vi.importActual<typeof import('@/services/clawBotService')>('@/services/clawBotService')
  return {
    ...actual,
    useClawBotService: mockUseClawBotService,
    resetClawBotService: mockResetClawBotService,
  }
})

vi.mock('@/services/aiPromptService', () => ({
  buildSystemPrompt: vi.fn(() => 'prompt'),
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

vi.mock('siyuan', () => ({
  showMessage: mockShowMessage,
}))

function createConversation(id = 'conv-1') {
  return {
    id,
    title: 'Test Conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  }
}

describe('aiStore clawbot context management', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    mockStorageService.initialize.mockResolvedValue({
      migrated: false,
      conversationCount: 0,
      backupCreated: false,
    })
    mockStorageService.getIndex.mockResolvedValue({
      currentConversationId: null,
      conversations: [],
    })
    mockStorageService.loadConversation.mockResolvedValue(null)
    mockStorageService.loadConversationsList.mockResolvedValue([])
    mockStorageService.createConversation.mockResolvedValue(createConversation())
    mockStorageService.saveConversation.mockResolvedValue(undefined)

    mockClawBotService.isConnected.mockReturnValue(true)
    mockClawBotService.sendTextMessage.mockResolvedValue(undefined)
    mockClawBotService.probeContext.mockResolvedValue({ status: 'active' })
    mockClawBotService.notifyGatewayStart.mockResolvedValue({ ret: 0 })
    mockClawBotService.sendTypingKeepalive.mockResolvedValue({ status: 'active' })
    mockClawBotService.startMonitoring.mockResolvedValue(undefined)
    mockClawBotService.getConfig.mockReturnValue({})
  })

  it('retries notification once without context token after a stale context failure', async () => {
    const store = useAIStore()
    store.clawBotConfig.enabled = true
    store.clawBotConfig.token = 'token'
    store.clawBotConfig.loginStatus = 'connected'
    store.weixinConversationMap = {
      'user@im.wechat': {
        ilinkUserId: 'user@im.wechat',
        conversationId: 'conv-1',
        contextToken: 'stale-token',
        contextState: 'active',
        lastMessageAt: 1,
        lastInboundAt: 1,
      },
    }

    mockClawBotService.sendTextMessage
      .mockRejectedValueOnce(new ClawBotApiError('stale', -2, 'context_stale'))
      .mockResolvedValueOnce(undefined)

    await store.sendWechatNotification('hello')

    expect(mockClawBotService.sendTextMessage).toHaveBeenNthCalledWith(1, 'user@im.wechat', 'hello', 'stale-token')
    expect(mockClawBotService.sendTextMessage).toHaveBeenNthCalledWith(2, 'user@im.wechat', 'hello', undefined)
    expect(store.weixinConversationMap['user@im.wechat'].contextToken).toBeUndefined()
    expect(store.weixinConversationMap['user@im.wechat'].contextState).toBe('unknown')
    expect(store.weixinConversationMap['user@im.wechat'].lastOutboundAt).toBeTypeOf('number')
    expect(store.weixinConversationMap['user@im.wechat'].lastContextErrorAt).toBeTypeOf('number')
  })

  it('keeps conversation stale when the recovery retry also fails', async () => {
    const store = useAIStore()
    store.clawBotConfig.enabled = true
    store.clawBotConfig.token = 'token'
    store.clawBotConfig.loginStatus = 'connected'
    store.weixinConversationMap = {
      'user@im.wechat': {
        ilinkUserId: 'user@im.wechat',
        conversationId: 'conv-1',
        contextToken: 'stale-token',
        contextState: 'active',
        lastMessageAt: 1,
        lastInboundAt: 1,
      },
    }

    mockClawBotService.sendTextMessage
      .mockRejectedValueOnce(new ClawBotApiError('stale', -2, 'context_stale'))
      .mockRejectedValueOnce(new Error('still failed'))

    await store.sendWechatNotification('hello')

    expect(mockClawBotService.sendTextMessage).toHaveBeenCalledTimes(2)
    expect(store.weixinConversationMap['user@im.wechat'].contextToken).toBeUndefined()
    expect(store.weixinConversationMap['user@im.wechat'].contextState).toBe('stale')
  })

  it('refreshes a stale context when a new inbound message arrives', async () => {
    const store = useAIStore()
    await store.initializeStorage({})
    store.weixinConversationMap = {
      'user@im.wechat': {
        ilinkUserId: 'user@im.wechat',
        conversationId: 'conv-1',
        contextToken: undefined,
        contextState: 'stale',
        lastMessageAt: 1,
        lastInboundAt: 1,
        lastContextErrorAt: 2,
      },
    }

    await store.handleWeixinMessage({
      from_user_id: 'user@im.wechat',
      message_type: 1,
      context_token: 'fresh-token',
      item_list: [{
        type: 1,
        text_item: { text: 'hello' },
      }],
    })

    expect(store.weixinConversationMap['user@im.wechat'].contextToken).toBe('fresh-token')
    expect(store.weixinConversationMap['user@im.wechat'].contextState).toBe('active')
    expect(store.weixinConversationMap['user@im.wechat'].lastInboundAt).toBeTypeOf('number')
  })

  it('marks context stale during a silent health probe without sending a visible message', async () => {
    const store = useAIStore()
    store.clawBotConfig.enabled = true
    store.clawBotConfig.token = 'token'
    store.clawBotConfig.loginStatus = 'connected'
    store.weixinConversationMap = {
      'user@im.wechat': {
        ilinkUserId: 'user@im.wechat',
        conversationId: 'conv-1',
        contextToken: 'stale-token',
        contextState: 'active',
        lastMessageAt: Date.now(),
        lastInboundAt: Date.now(),
      },
    }

    mockClawBotService.probeContext.mockResolvedValueOnce({ status: 'stale' })

    await store.runClawBotHealthCheck()

    expect(mockClawBotService.probeContext).toHaveBeenCalledWith('user@im.wechat', 'stale-token')
    expect(mockClawBotService.sendTextMessage).not.toHaveBeenCalled()
    expect(store.weixinConversationMap['user@im.wechat'].contextState).toBe('stale')
    expect(store.weixinConversationMap['user@im.wechat'].lastHealthCheckAt).toBeTypeOf('number')
  })

  it('skips proactive notifications for stale contexts until a new inbound message arrives', async () => {
    const store = useAIStore()
    store.clawBotConfig.enabled = true
    store.clawBotConfig.token = 'token'
    store.clawBotConfig.loginStatus = 'connected'
    store.weixinConversationMap = {
      'user@im.wechat': {
        ilinkUserId: 'user@im.wechat',
        conversationId: 'conv-1',
        contextToken: undefined,
        contextState: 'stale',
        lastMessageAt: Date.now(),
        lastInboundAt: Date.now(),
        lastContextErrorAt: Date.now(),
      },
    }

    await store.sendWechatNotification('hello')

    expect(mockClawBotService.sendTextMessage).not.toHaveBeenCalled()
  })

  it('sends a gateway keepalive heartbeat through notifyStart', async () => {
    const store = useAIStore()
    store.clawBotConfig.enabled = true
    store.clawBotConfig.token = 'token'
    store.clawBotConfig.loginStatus = 'connected'

    await store.runClawBotGatewayHeartbeat()

    expect(mockClawBotService.notifyGatewayStart).toHaveBeenCalledTimes(1)
  })

  it('sends experimental typing keepalive for active recent contexts', async () => {
    const store = useAIStore()
    store.clawBotConfig.enabled = true
    store.clawBotConfig.token = 'token'
    store.clawBotConfig.loginStatus = 'connected'
    store.weixinConversationMap = {
      'user@im.wechat': {
        ilinkUserId: 'user@im.wechat',
        conversationId: 'conv-1',
        contextToken: 'fresh-token',
        contextState: 'active',
        lastMessageAt: Date.now(),
        lastInboundAt: Date.now(),
      },
    }

    await store.runClawBotHealthCheck()

    expect(mockClawBotService.probeContext).toHaveBeenCalledWith('user@im.wechat', 'fresh-token')
    expect(mockClawBotService.sendTypingKeepalive).toHaveBeenCalledWith('user@im.wechat', 'fresh-token')
    expect(store.weixinConversationMap['user@im.wechat'].lastKeepaliveAt).toBeTypeOf('number')
  })

  it('initializes clawbot monitoring on mobile', async () => {
    const store = useAIStore()
    const loadWechatLoginState = vi.fn().mockResolvedValue({
      enabled: true,
      token: 'token',
      accountId: 'account',
      loginStatus: 'connected',
    })

    await store.initializeStorage({
      isMobile: true,
      loadWechatLoginState,
    })

    await store.initializeClawBot({
      isMobile: true,
      loadWechatLoginState,
    })

    expect(mockUseClawBotService).toHaveBeenCalled()
    expect(mockClawBotService.startMonitoring).toHaveBeenCalled()
    expect(mockClawBotService.onMessage).toHaveBeenCalled()
  })

  it('sends wechat notifications on mobile', async () => {
    const store = useAIStore()
    await store.initializeStorage({ isMobile: true })

    store.clawBotConfig.enabled = true
    store.clawBotConfig.token = 'token'
    store.clawBotConfig.loginStatus = 'connected'
    store.weixinConversationMap = {
      'user@im.wechat': {
        ilinkUserId: 'user@im.wechat',
        conversationId: 'conv-1',
        contextToken: 'ctx',
        contextState: 'active',
        lastMessageAt: Date.now(),
        lastInboundAt: Date.now(),
      },
    }

    await store.sendWechatNotification('hello')

    expect(mockClawBotService.sendTextMessage).toHaveBeenCalled()
  })

  it('handles inbound wechat messages on mobile', async () => {
    const store = useAIStore()
    await store.initializeStorage({ isMobile: true })

    await store.handleWeixinMessage({
      from_user_id: 'user@im.wechat',
      message_type: 1,
      context_token: 'fresh-token',
      item_list: [{
        type: 1,
        text_item: { text: 'hello' },
      }],
    })

    expect(store.weixinConversationMap['user@im.wechat']).toBeDefined()
    expect(store.weixinConversationMap['user@im.wechat'].contextToken).toBe('fresh-token')
  })

  it('shows wechat conversations in conversation list on mobile', async () => {
    const store = useAIStore()
    mockStorageService.loadConversationsList.mockResolvedValue([
      {
        id: 'conv-normal',
        title: 'Normal',
        createdAt: 1,
        updatedAt: 1,
        messageCount: 0,
        fileSize: 10,
        hasSkillExecutions: false,
      },
      {
        id: 'conv-weixin',
        title: 'Weixin',
        createdAt: 2,
        updatedAt: 2,
        messageCount: 1,
        fileSize: 20,
        hasSkillExecutions: false,
        source: 'weixin',
        weixinUserId: 'user@im.wechat',
      },
    ])

    await store.initializeStorage({ isMobile: true })

    const conversations = await store.getConversationsList()

    expect(conversations).toHaveLength(2)
    expect(conversations.find((c) => c.source === 'weixin')).toBeDefined()
  })

  it('restores weixin conversation map from persisted conversations during clawbot init', async () => {
    const store = useAIStore()
    const loadWechatLoginState = vi.fn().mockResolvedValue({
      enabled: true,
      token: 'token',
      accountId: 'account',
      loginStatus: 'connected',
    })

    mockStorageService.loadConversationsList.mockResolvedValue([
      {
        id: 'conv-weixin',
        title: 'Weixin',
        createdAt: 2,
        updatedAt: 20,
        messageCount: 1,
        fileSize: 20,
        hasSkillExecutions: false,
        source: 'weixin',
        weixinUserId: 'user@im.wechat',
        weixinUserName: '微信用户',
      },
    ])

    await store.initializeStorage({
      isMobile: true,
      loadWechatLoginState,
    })

    expect(Object.keys(store.weixinConversationMap)).toHaveLength(0)

    await store.initializeClawBot({
      isMobile: true,
      loadWechatLoginState,
    })

    expect(store.weixinConversationMap['user@im.wechat']).toMatchObject({
      ilinkUserId: 'user@im.wechat',
      conversationId: 'conv-weixin',
      userName: '微信用户',
      contextState: 'unknown',
    })
  })

  it('uses the first user message as the title for a new untitled conversation', async () => {
    const store = useAIStore()
    await store.initializeStorage({})

    store.loadSettings({
      providers: [
        {
          id: 'provider-1',
          name: 'Test Provider',
          provider: 'openai',
          apiKey: 'test-key',
          baseUrl: 'https://api.example.com',
          defaultModel: 'test-model',
          models: ['test-model'],
          enabled: true,
        },
      ],
      activeProviderId: 'provider-1',
      showToolCalls: true,
    })

    mockStorageService.createConversation.mockResolvedValueOnce({
      id: 'conv-1',
      title: '新对话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      skillExecutions: [],
    })

    await store.sendMessage('今天完成周报并同步项目进度\n补充第二行')

    expect(mockStorageService.saveConversation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'conv-1',
        title: '今天完成周报并同步项目进度',
      }),
    )
    expect(store.currentConversation?.title).toBe('今天完成周报并同步项目进度')
  })
})
