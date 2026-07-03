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
import { showSystemNotification } from '@/utils/notification'

const mockSendWechatNotification = vi.fn().mockResolvedValue(undefined)
const mockSendWecomNotification = vi.fn().mockResolvedValue(undefined)

// 共享 store 实例：保证在测试中修改的 wecomBotConfig 与 sendWecomNotification 内部读取的是同一对象
const sharedStore = {
  sendWechatNotification: mockSendWechatNotification,
  sendWecomNotification: mockSendWecomNotification,
  wecomBotConfig: {
    enabled: true,
    notifyOnLocalEvent: true,
    botId: '',
    secret: '',
    connectionStatus: 'disconnected' as const,
  },
  clawBotConfig: { enabled: true },
}

vi.mock('@/stores/aiStore', () => ({
  useAIStore: () => sharedStore,
}))

vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: () => createPinia(),
}))

vi.mock('siyuan', () => ({
  showMessage: vi.fn(),
  platformUtils: undefined,
}))

vi.mock('@/utils/dialog', () => ({
  showMessage: vi.fn(),
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key,
}))

describe('通知多通道分发', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // 默认开启 notifyOnLocalEvent 与 enabled
    sharedStore.wecomBotConfig.enabled = true
    sharedStore.wecomBotConfig.notifyOnLocalEvent = true
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('本地通知应同时推送到 ClawBot 和 WecomBot', async () => {
    await showSystemNotification('测试标题', '测试内容')

    // 等待 fire-and-forget 调用完成
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(mockSendWechatNotification).toHaveBeenCalledWith('测试标题\n测试内容')
    expect(mockSendWecomNotification).toHaveBeenCalledWith('测试标题\n测试内容')
  })

  it('wecomBot notifyOnLocalEvent 关闭时不应推送企微', async () => {
    sharedStore.wecomBotConfig.notifyOnLocalEvent = false

    await showSystemNotification('标题', '内容')
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(mockSendWechatNotification).toHaveBeenCalledWith('标题\n内容')
    expect(mockSendWecomNotification).not.toHaveBeenCalled()
  })

  it('wecomBot 未启用时不应推送企微', async () => {
    sharedStore.wecomBotConfig.enabled = false

    await showSystemNotification('标题', '内容')
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(mockSendWecomNotification).not.toHaveBeenCalled()
  })
})
