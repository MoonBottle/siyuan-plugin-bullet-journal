// @vitest-environment happy-dom

import fs from 'node:fs'
import path from 'node:path'
import {
  afterEach,
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
} from 'vue'
import ChatPanel from '@/components/ai/ChatPanel.vue'

const mockAiStore = {
  currentMessages: [],
  isLoading: false,
  isAIEnabled: true,
  enabledProviders: [
    {
      id: 'provider-1',
      name: 'Provider 1',
      defaultModel: 'model-1',
      models: ['model-1', 'model-2'],
    },
  ],
  activeProviderId: 'provider-1',
  setActiveProvider: vi.fn(),
  sendMessage: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@/stores', () => ({
  useAIStore: vi.fn(() => mockAiStore),
  useSkillStore: vi.fn(() => ({
    enabledSkills: [],
  })),
}))

vi.mock('@/components/ai/ChatMessage.vue', () => ({
  default: defineComponent({
    name: 'ChatMessageStub',
    setup() {
      return () => h('div', { class: 'chat-message-stub' })
    },
  }),
}))

vi.mock('@/components/ai/ChatInput.vue', () => ({
  default: defineComponent({
    name: 'ChatInputStub',
    props: {
      modelValue: {
        type: String,
        default: '',
      },
      placeholder: {
        type: String,
        default: '',
      },
      disabled: {
        type: Boolean,
        default: false,
      },
      skills: {
        type: Array,
        default: () => [],
      },
    },
    emits: ['update:modelValue', 'send'],
    setup(props) {
      return () => h('textarea', {
        class: 'chat-input-stub',
        value: props.modelValue,
        placeholder: props.placeholder,
        disabled: props.disabled,
      })
    },
  }),
}))

vi.mock('@/components/icons/AiAssistantIcon.vue', () => ({
  default: defineComponent({
    name: 'AiAssistantIconStub',
    setup() {
      return () => h('div', { class: 'ai-assistant-icon-stub' })
    },
  }),
}))

vi.mock('@/components/SiyuanTheme/SySelect.vue', () => ({
  default: defineComponent({
    name: 'SySelectStub',
    props: {
      modelValue: {
        type: String,
        default: '',
      },
      options: {
        type: Array,
        default: () => [],
      },
      placeholder: {
        type: String,
        default: '',
      },
      disabled: {
        type: Boolean,
        default: false,
      },
    },
    emits: ['update:modelValue'],
    setup(props) {
      return () => h('button', {
        class: 'sy-select-stub',
        disabled: props.disabled,
      }, props.modelValue || props.placeholder)
    },
  }),
}))

vi.mock('@/api', () => ({
  appendBlock: vi.fn(),
  pushMsg: vi.fn(),
}))

vi.mock('@/utils/markdownRenderer', () => ({
  smartFormatMarkdown: vi.fn((value: string) => value),
}))

vi.mock('siyuan', () => ({
  getActiveEditor: vi.fn(() => null),
  getFrontend: vi.fn(() => 'desktop'),
}))

function mountChatPanel() {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp(ChatPanel, {
    projects: [],
    groups: [],
    items: [],
    showToolCalls: false,
  })
  app.mount(container)

  return {
    container,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  mockAiStore.currentMessages = []
  mockAiStore.isLoading = false
  mockAiStore.isAIEnabled = true
  mockAiStore.enabledProviders = [
    {
      id: 'provider-1',
      name: 'Provider 1',
      defaultModel: 'model-1',
      models: ['model-1', 'model-2'],
    },
  ]
  mockAiStore.activeProviderId = 'provider-1'
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('chatPanel layout guards', () => {
  it('keeps key flex containers shrinkable inside embedded layouts', () => {
    const mounted = mountChatPanel()

    const root = mounted.container.querySelector('.chat-panel')
    const inputArea = mounted.container.querySelector('.chat-panel__input-area')
    const inputCard = mounted.container.querySelector('.chat-panel__input-card')
    const cardHeader = mounted.container.querySelector('.chat-panel__card-header')
    const providerSelect = mounted.container.querySelector('.chat-panel__provider-select')
    const footer = mounted.container.querySelector('.chat-panel__card-footer')

    expect(root).not.toBeNull()
    expect(inputArea).not.toBeNull()
    expect(inputCard).not.toBeNull()
    expect(cardHeader).not.toBeNull()
    expect(providerSelect).not.toBeNull()
    expect(footer).not.toBeNull()

    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ai/ChatPanel.vue'),
      'utf-8',
    ).replace(/\r\n/g, '\n')

    expect(source).toContain('.chat-panel {')
    expect(source).toContain('min-width: 0;')
    expect(source).toContain('&__input-area {\n+    min-width: 0;'.replace('\n+', '\n'))
    expect(source).toContain('&__input-card {\n+    min-width: 0;'.replace('\n+', '\n'))
    expect(source).toContain('&__card-header {')
    expect(source).toContain('&__provider-select {')
    expect(source).toContain('&__card-body {\n+    min-width: 0;'.replace('\n+', '\n'))
    expect(source).toContain('&__card-footer {\n+    display: flex;\n+    align-items: center;\n+    min-width: 0;'.replace(/\n\+/g, '\n'))

    mounted.unmount()
  })
})
