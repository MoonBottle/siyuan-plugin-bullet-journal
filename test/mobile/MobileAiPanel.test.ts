// @vitest-environment happy-dom

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  createApp,
  defineComponent,
  h,
  nextTick,
  ref,
} from 'vue'
import MobileAiPanel from '@/mobile/panels/MobileAiPanel.vue'

const mockConversationsList = ref([
  {
    id: 'conv-1',
    title: '新对话',
    createdAt: 1,
    updatedAt: 1,
    messageCount: 0,
    fileSize: 10,
    hasSkillExecutions: false,
  },
  {
    id: 'conv-2',
    title: '工作复盘',
    createdAt: 2,
    updatedAt: 2,
    messageCount: 4,
    fileSize: 20,
    hasSkillExecutions: false,
  },
])

const mockAiStore = {
  currentConversation: {
    id: 'conv-1',
    title: '新对话',
    messages: [],
    createdAt: 1,
    updatedAt: 1,
  },
  currentConversationId: 'conv-1',
  showToolCallsEnabled: false,
  isClawBotConnected: false,
  hasUnreadWeixin: false,
  getWeixinConversationStatus: vi.fn(),
  loadSettings: vi.fn(),
  get conversationsList() {
    return mockConversationsList.value
  },
  getConversationsList: vi.fn(),
  refreshConversationsList: vi.fn().mockImplementation(async () => {
    mockConversationsList.value = await mockAiStore.getConversationsList()
  }),
  startNewConversationDraft: vi.fn(),
  createConversation: vi.fn(),
  switchConversation: vi.fn(),
  deleteConversation: vi.fn(),
  clearCurrentConversation: vi.fn(),
}

const mockPlugin = {
  getSettings: vi.fn(() => ({
    ai: {
      providers: [
        {
          id: 'provider-1',
          name: 'OpenAI',
          provider: 'openai',
          apiKey: 'test-key',
          baseUrl: 'https://api.openai.com/v1',
          defaultModel: 'gpt-4o-mini',
          models: ['gpt-4o-mini'],
          enabled: true,
        },
      ],
      activeProviderId: 'provider-1',
      showToolCalls: true,
    },
  })),
}

vi.mock('@/stores', () => ({
  useAIStore: () => mockAiStore,
  useProjectStore: () => ({
    projects: [],
    items: [],
  }),
  useSettingsStore: () => ({ groups: [] }),
}))

vi.mock('@/main', () => ({
  getCurrentPlugin: () => mockPlugin,
}))

vi.mock('@/components/ai/ChatPanel.vue', () => ({
  default: defineComponent({
    name: 'ChatPanelStub',
    setup(_, { expose }) {
      expose({ focusInput: vi.fn() })
      return () => h('div', { 'data-testid': 'chat-panel-stub' }, 'chat')
    },
  }),
}))

vi.mock('@/components/icons/WeixinIcon.vue', () => ({
  default: defineComponent({
    name: 'WeixinIconStub',
    setup() {
      return () => h('svg', { 'data-testid': 'weixin-icon-stub' })
    },
  }),
}))

vi.mock('@/mobile/drawers/weixin/MobileWeixinSheet.vue', () => ({
  default: defineComponent({
    name: 'MobileWeixinSheetStub',
    setup(_, { emit: _emit }) {
      return () => h('div', { 'data-testid': 'weixin-sheet-stub' })
    },
  }),
}))

function mountPanel() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(MobileAiPanel)
  app.mount(container)
  return {
    container,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

async function flushPanelUpdates() {
  await Promise.resolve()
  await nextTick()
}

async function flushConfirmFlow() {
  await flushPanelUpdates()
  await flushPanelUpdates()
}

function getConfirmDialog() {
  return document.body.querySelector('.confirm-dialog')
}

function getConfirmButton() {
  return document.body.querySelector('.confirm-btn') as HTMLButtonElement | null
}

function getCancelButton() {
  return document.body.querySelector('.cancel-btn') as HTMLButtonElement | null
}

describe('mobileAiPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    mockAiStore.currentConversation = {
      id: 'conv-1',
      title: '新对话',
      messages: [],
      createdAt: 1,
      updatedAt: 1,
    }
    mockAiStore.currentConversationId = 'conv-1'
    mockAiStore.getWeixinConversationStatus.mockReset()
    mockAiStore.getWeixinConversationStatus.mockReturnValue({
      status: 'active',
      label: '可用',
      tone: 'positive',
    })
    mockAiStore.loadSettings.mockReset()
    mockAiStore.createConversation.mockResolvedValue('conv-new')
    mockAiStore.switchConversation.mockResolvedValue(undefined)
    mockAiStore.deleteConversation.mockResolvedValue(undefined)
    mockAiStore.clearCurrentConversation.mockResolvedValue(undefined)
    mockAiStore.getConversationsList.mockResolvedValue([
      {
        id: 'conv-1',
        title: '新对话',
        createdAt: 1,
        updatedAt: 1,
        messageCount: 0,
        fileSize: 10,
        hasSkillExecutions: false,
      },
      {
        id: 'conv-2',
        title: '工作复盘',
        createdAt: 2,
        updatedAt: 2,
        messageCount: 4,
        fileSize: 20,
        hasSkillExecutions: false,
      },
    ])
    mockConversationsList.value = [
      {
        id: 'conv-1',
        title: '新对话',
        createdAt: 1,
        updatedAt: 1,
        messageCount: 0,
        fileSize: 10,
        hasSkillExecutions: false,
      },
      {
        id: 'conv-2',
        title: '工作复盘',
        createdAt: 2,
        updatedAt: 2,
        messageCount: 4,
        fileSize: 20,
        hasSkillExecutions: false,
      },
    ]
    mockPlugin.getSettings.mockReturnValue({
      ai: {
        providers: [
          {
            id: 'provider-1',
            name: 'OpenAI',
            provider: 'openai',
            apiKey: 'test-key',
            baseUrl: 'https://api.openai.com/v1',
            defaultModel: 'gpt-4o-mini',
            models: ['gpt-4o-mini'],
            enabled: true,
          },
        ],
        activeProviderId: 'provider-1',
        showToolCalls: true,
      },
    })
  })

  it('loads persisted ai settings from plugin on mount', async () => {
    const mounted = mountPanel()
    await flushPanelUpdates()

    expect(mockAiStore.loadSettings).toHaveBeenCalledWith({
      providers: [
        expect.objectContaining({
          id: 'provider-1',
          enabled: true,
          apiKey: 'test-key',
        }),
      ],
      activeProviderId: 'provider-1',
      showToolCalls: true,
    })

    mounted.unmount()
  })

  it('uses weixinUserId to derive the current weixin conversation status', async () => {
    mockAiStore.currentConversationId = 'conv-weixin'
    mockAiStore.getConversationsList.mockResolvedValue([
      {
        id: 'conv-weixin',
        title: '微信会话',
        createdAt: 1,
        updatedAt: 2,
        messageCount: 1,
        fileSize: 10,
        hasSkillExecutions: false,
        source: 'weixin',
        weixinUserId: 'user@im.wechat',
        weixinUserName: '展示名',
      },
    ])

    const mounted = mountPanel()
    await flushPanelUpdates()

    expect(mockAiStore.getWeixinConversationStatus).toHaveBeenCalledWith('user@im.wechat')

    mounted.unmount()
  })

  it('shows the current weixin conversation name in the mobile header and hides active status text', async () => {
    mockAiStore.currentConversationId = 'conv-weixin'
    mockAiStore.getConversationsList.mockResolvedValue([
      {
        id: 'conv-weixin',
        title: '微信: 展示名',
        createdAt: 1,
        updatedAt: 2,
        messageCount: 1,
        fileSize: 10,
        hasSkillExecutions: false,
        source: 'weixin',
        weixinUserId: 'user@im.wechat',
        weixinUserName: '展示名',
      },
    ])

    const mounted = mountPanel()
    await flushPanelUpdates()

    expect(mounted.container.textContent).toContain('展示名')
    expect(mounted.container.textContent).not.toContain('可用')

    mounted.unmount()
  })

  it('opens the full-screen history page from the header entry', async () => {
    const mounted = mountPanel()
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-open-history"]') as HTMLButtonElement | null)?.click()
    await flushPanelUpdates()

    expect(mounted.container.querySelector('[data-testid="mobile-ai-history-page"]')).not.toBeNull()

    mounted.unmount()
  })

  it('switches conversation and returns to chat after selecting a history item', async () => {
    const mounted = mountPanel()
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-open-history"]') as HTMLButtonElement | null)?.click()
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-history-item-conv-2"]') as HTMLButtonElement | null)?.click()
    await flushPanelUpdates()

    expect(mockAiStore.switchConversation).toHaveBeenCalledWith('conv-2')
    expect(mounted.container.querySelector('[data-testid="chat-panel-stub"]')).not.toBeNull()

    mounted.unmount()
  })

  it('does not create a default conversation when the current list is empty on first mount', async () => {
    mockAiStore.currentConversation = null
    mockAiStore.currentConversationId = null
    mockAiStore.getConversationsList.mockResolvedValueOnce([])
    mockConversationsList.value = []

    const mounted = mountPanel()
    await flushPanelUpdates()

    expect(mockAiStore.createConversation).not.toHaveBeenCalled()

    mounted.unmount()
  })

  it('returns to chat after deleting the last history item without creating a replacement conversation', async () => {
    mockAiStore.getConversationsList
      .mockResolvedValueOnce([
        {
          id: 'conv-1',
          title: '唯一会话',
          createdAt: 1,
          updatedAt: 1,
          messageCount: 0,
          fileSize: 10,
          hasSkillExecutions: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'conv-1',
          title: '唯一会话',
          createdAt: 1,
          updatedAt: 1,
          messageCount: 0,
          fileSize: 10,
          hasSkillExecutions: false,
        },
      ])
      .mockResolvedValueOnce([])
    mockConversationsList.value = [
      {
        id: 'conv-1',
        title: '唯一会话',
        createdAt: 1,
        updatedAt: 1,
        messageCount: 0,
        fileSize: 10,
        hasSkillExecutions: false,
      },
    ]

    const mounted = mountPanel()
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-open-history"]') as HTMLButtonElement | null)?.click()
    await flushPanelUpdates();
    (mounted.container.querySelector('[data-testid="mobile-ai-history-delete-conv-1"]') as HTMLButtonElement | null)?.click()
    await flushPanelUpdates()
    expect(getConfirmDialog()).not.toBeNull()
    getConfirmButton()?.click()
    await flushConfirmFlow()

    expect(mockAiStore.deleteConversation).toHaveBeenCalledWith('conv-1')
    expect(mockAiStore.createConversation).not.toHaveBeenCalled()
    expect(mounted.container.querySelector('[data-testid="chat-panel-stub"]')).not.toBeNull()

    mounted.unmount()
  })

  it('starts a draft instead of creating immediately from the mobile new conversation button', async () => {
    const mounted = mountPanel()
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-new-conversation"]') as HTMLButtonElement | null)?.click()
    await flushPanelUpdates()

    expect(mockAiStore.startNewConversationDraft).toHaveBeenCalled()
    expect(mockAiStore.createConversation).not.toHaveBeenCalled()

    mounted.unmount()
  })

  it('updates the mobile history page when the store conversation list changes after creation', async () => {
    const mounted = mountPanel()
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-open-history"]') as HTMLButtonElement | null)?.click()
    await flushPanelUpdates()

    expect(mounted.container.textContent).toContain('工作复盘')

    mockConversationsList.value = [
      {
        id: 'conv-new',
        title: '我这周有哪些待办任务?',
        createdAt: 3,
        updatedAt: 3,
        messageCount: 2,
        fileSize: 15,
        hasSkillExecutions: false,
      },
      ...mockConversationsList.value,
    ]
    await flushPanelUpdates()

    expect(mounted.container.textContent).toContain('我这周有哪些待办任务?')

    mounted.unmount()
  })

  it('stays on the history page after deleting one conversation when others remain', async () => {
    const mounted = mountPanel()
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-open-history"]') as HTMLButtonElement | null)?.click()
    await flushPanelUpdates();
    (mounted.container.querySelector('[data-testid="mobile-ai-history-delete-conv-2"]') as HTMLButtonElement | null)?.click()
    await flushPanelUpdates()
    expect(getConfirmDialog()).not.toBeNull()
    getConfirmButton()?.click()
    await flushConfirmFlow()

    expect(mockAiStore.deleteConversation).toHaveBeenCalledWith('conv-2')
    expect(mockAiStore.createConversation).not.toHaveBeenCalled()
    expect(mounted.container.querySelector('[data-testid="mobile-ai-history-page"]')).not.toBeNull()

    mounted.unmount()
  })

  it('does not delete when confirmation is cancelled', async () => {
    const mounted = mountPanel()
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-open-history"]') as HTMLButtonElement | null)?.click()
    await flushPanelUpdates();
    (mounted.container.querySelector('[data-testid="mobile-ai-history-delete-conv-2"]') as HTMLButtonElement | null)?.click()
    await flushPanelUpdates()
    expect(getConfirmDialog()).not.toBeNull()
    getCancelButton()?.click()
    await flushConfirmFlow()

    expect(mockAiStore.deleteConversation).not.toHaveBeenCalled()
    expect(mounted.container.querySelector('[data-testid="mobile-ai-history-page"]')).not.toBeNull()

    mounted.unmount()
  })

  it('clears the current conversation from the chat header action', async () => {
    const mounted = mountPanel()
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-clear-conversation"]') as HTMLButtonElement | null)?.click()
    await flushPanelUpdates()
    expect(getConfirmDialog()).not.toBeNull()
    getConfirmButton()?.click()
    await flushConfirmFlow()

    expect(mockAiStore.clearCurrentConversation).toHaveBeenCalled()

    mounted.unmount()
  })

  it('does not clear the current conversation when confirmation is cancelled', async () => {
    const mounted = mountPanel()
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-clear-conversation"]') as HTMLButtonElement | null)?.click()
    await flushPanelUpdates()
    expect(getConfirmDialog()).not.toBeNull()
    getCancelButton()?.click()
    await flushConfirmFlow()

    expect(mockAiStore.clearCurrentConversation).not.toHaveBeenCalled()

    mounted.unmount()
  })
})
