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
  return {
    useWecomBotService: () => mockService,
    resetWecomBotService: vi.fn(),
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
