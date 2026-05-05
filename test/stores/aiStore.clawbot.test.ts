import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

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

vi.mock('@/agents/react/agent', () => ({
  ReActAgent: vi.fn().mockImplementation(() => ({
    setToolContext: vi.fn(),
    run: vi.fn(),
  })),
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

import { ClawBotApiError } from '@/services/clawBotService'
import { useAIStore } from '@/stores/aiStore'

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
      item_list: [{ type: 1, text_item: { text: 'hello' } }],
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
})
