// @vitest-environment happy-dom

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
  nextTick,
} from 'vue'
import ConversationSelect from '@/components/ai/ConversationSelect.vue'

const mockAiStore = {
  getWeixinConversationStatus: vi.fn(),
}

vi.mock('@/stores', () => ({
  useAIStore: vi.fn(() => mockAiStore),
}))

describe('conversationSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    mockAiStore.getWeixinConversationStatus.mockReturnValue({
      status: 'active',
      label: '进行中',
      tone: 'positive',
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('uses weixinUserId to derive weixin status badges', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const app = createApp(ConversationSelect, {
      conversations: [
        {
          id: 'conv-1',
          title: '微信: 张三',
          source: 'weixin',
          weixinUserId: 'wx-user-1',
          weixinUserName: '张三',
        },
      ],
      currentConversationId: 'conv-1',
    })

    app.mount(container)

    const trigger = container.querySelector('.block__icon')
    expect(trigger).not.toBeNull()

    trigger!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    await nextTick()

    expect(mockAiStore.getWeixinConversationStatus).toHaveBeenCalled()
    expect(mockAiStore.getWeixinConversationStatus).toHaveBeenCalledWith('wx-user-1')
    expect(mockAiStore.getWeixinConversationStatus).not.toHaveBeenCalledWith('张三')

    app.unmount()
    container.remove()
  })
})
