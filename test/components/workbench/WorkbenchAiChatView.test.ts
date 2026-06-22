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
import { initI18n } from '@/i18n'

const {
  mockMenuAddItem,
  mockMenuOpen,
  mockShowInputDialog,
  mockRenameConversation,
  mockDeleteConversation,
  mockGetConversationsList,
} = vi.hoisted(() => ({
  mockMenuAddItem: vi.fn(),
  mockMenuOpen: vi.fn(),
  mockShowInputDialog: vi.fn((_title, _message, _defaultValue, callback) => callback?.('Renamed conversation')),
  mockRenameConversation: vi.fn().mockResolvedValue(undefined),
  mockDeleteConversation: vi.fn().mockResolvedValue(undefined),
  mockGetConversationsList: vi.fn().mockResolvedValue([
    {
      id: 'conv-normal',
      title: 'Daily report',
      updatedAt: Date.now(),
      createdAt: Date.now(),
      messageCount: 0,
      fileSize: 0,
      hasSkillExecutions: false,
      source: 'manual',
    },
    {
      id: 'conv-weixin',
      title: 'Wechat user',
      updatedAt: Date.now() - 1000,
      createdAt: Date.now() - 1000,
      messageCount: 0,
      fileSize: 0,
      hasSkillExecutions: false,
      source: 'weixin',
      weixinUserId: 'wx-1',
      weixinUserName: 'Wechat user',
    },
  ]),
}))

const mockConversationsList = ref([
  {
    id: 'conv-normal',
    title: 'Daily report',
    updatedAt: Date.now(),
    createdAt: Date.now(),
    messageCount: 0,
    fileSize: 0,
    hasSkillExecutions: false,
    source: 'manual',
  },
  {
    id: 'conv-weixin',
    title: 'Wechat user',
    updatedAt: Date.now() - 1000,
    createdAt: Date.now() - 1000,
    messageCount: 0,
    fileSize: 0,
    hasSkillExecutions: false,
    source: 'weixin',
    weixinUserId: 'wx-1',
    weixinUserName: 'Wechat user',
  },
])

const mockAiStore = {
  currentConversationId: 'conv-normal',
  get conversationsList() {
    return mockConversationsList.value
  },
  getConversationsList: mockGetConversationsList,
  refreshConversationsList: vi.fn().mockImplementation(async () => {
    mockConversationsList.value = await mockGetConversationsList()
  }),
  startNewConversationDraft: vi.fn(),
  createConversation: vi.fn().mockResolvedValue('conv-new'),
  switchConversation: vi.fn().mockResolvedValue(undefined),
  renameConversation: mockRenameConversation,
  deleteConversation: mockDeleteConversation,
}

vi.mock('siyuan', () => ({
  Menu: class {
    addItem = mockMenuAddItem
    open = mockMenuOpen
  },
}))

vi.mock('@/utils/dialog', () => ({
  showInputDialog: mockShowInputDialog,
}))

vi.mock('@/stores', () => ({
  useAIStore: vi.fn(() => mockAiStore),
}))

vi.mock('@/tabs/AiChatDock.vue', () => ({
  default: defineComponent({
    name: 'AiChatDockStub',
    setup() {
      return () => h('div', { 'data-testid': 'ai-chat-dock-stub' })
    },
  }),
}))

describe('aiChatView', () => {
  beforeEach(async () => {
    initI18n('en')
    vi.clearAllMocks()
    mockGetConversationsList.mockResolvedValue([
      {
        id: 'conv-normal',
        title: 'Daily report',
        updatedAt: Date.now(),
        createdAt: Date.now(),
        messageCount: 0,
        fileSize: 0,
        hasSkillExecutions: false,
        source: 'manual',
      },
      {
        id: 'conv-weixin',
        title: 'Wechat user',
        updatedAt: Date.now() - 1000,
        createdAt: Date.now() - 1000,
        messageCount: 0,
        fileSize: 0,
        hasSkillExecutions: false,
        source: 'weixin',
        weixinUserId: 'wx-1',
        weixinUserName: 'Wechat user',
      },
    ])
    mockConversationsList.value = await mockGetConversationsList()
  })

  async function mountView() {
    const { default: AiChatView } = await import('@/components/workbench/view/WorkbenchAiChatView.vue')
    const container = document.createElement('div')
    document.body.appendChild(container)

    const app = createApp(defineComponent({
      render() {
        return h(AiChatView)
      },
    }))
    app.mount(container)
    await nextTick()
    await nextTick()

    return {
      container,
      app,
      unmount() {
        app.unmount()
        container.remove()
      },
    }
  }

  it('offers rename for normal conversations and renames through input dialog', async () => {
    const mounted = await mountView()
    const actions = mounted.container.querySelectorAll('.ai-chat-view__sidebar-item-action');

    (actions[0] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(mockMenuAddItem).toHaveBeenCalledTimes(2)
    expect(mockMenuAddItem.mock.calls[0][0]).toMatchObject({
      icon: 'iconEdit',
      label: 'Rename',
    })

    await mockMenuAddItem.mock.calls[0][0].click()

    expect(mockShowInputDialog).toHaveBeenCalledWith(
      'Rename',
      'Enter a new name',
      'Daily report',
      expect.any(Function),
    )
    expect(mockRenameConversation).toHaveBeenCalledWith('conv-normal', 'Renamed conversation')

    mounted.unmount()
  })

  it('does not offer rename for weixin conversations', async () => {
    const mounted = await mountView()
    const actions = mounted.container.querySelectorAll('.ai-chat-view__sidebar-item-action');

    (actions[1] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(mockMenuAddItem).toHaveBeenCalledTimes(1)
    expect(mockMenuAddItem.mock.calls[0][0]).toMatchObject({
      icon: 'iconTrashcan',
      label: 'Delete Conversation',
    })

    mounted.unmount()
  })

  it('does not create a conversation immediately when clicking new', async () => {
    const mounted = await mountView();

    (mounted.container.querySelector('.ai-chat-view__sidebar-header-btn') as HTMLElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(mockAiStore.createConversation).not.toHaveBeenCalled()
    expect(mockAiStore.startNewConversationDraft).toHaveBeenCalledTimes(1)

    mounted.unmount()
  })

  it('reacts to store conversation list updates after a new conversation is created', async () => {
    const mounted = await mountView()

    mockConversationsList.value = [
      {
        id: 'conv-created',
        title: 'What tasks are pending this week?',
        updatedAt: Date.now(),
        createdAt: Date.now(),
        messageCount: 2,
        fileSize: 0,
        hasSkillExecutions: false,
        source: 'manual',
      },
      ...mockConversationsList.value,
    ]
    await nextTick()

    expect(mounted.container.textContent).toContain('What tasks are pending this week?')

    mounted.unmount()
  })
})
