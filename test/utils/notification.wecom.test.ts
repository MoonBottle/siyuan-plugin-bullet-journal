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
const mockWecomBotConfig = {
  enabled: true,
  notifyOnLocalEvent: true,
  botId: '',
  secret: '',
  connectionStatus: 'disconnected' as const,
}

vi.mock('@/stores/aiStore', () => ({
  useAIStore: () => ({
    sendWechatNotification: mockSendWechatNotification,
    sendWecomNotification: mockSendWecomNotification,
    wecomBotConfig: mockWecomBotConfig,
    clawBotConfig: { enabled: true },
  }),
}))

vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: () => createPinia(),
}))

// Mock siyuan 模块（notification.ts 依赖）
vi.mock('siyuan', () => ({
  showMessage: vi.fn(),
  platformUtils: { sendNotification: vi.fn().mockResolvedValue(1) },
}))

// Mock i18n
vi.mock('@/i18n', () => ({
  t: (path: string) => path,
}))

// Mock dialog
vi.mock('@/utils/dialog', () => ({
  showMessage: vi.fn(),
}))

describe('通知多通道分发', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockWecomBotConfig.enabled = true
    mockWecomBotConfig.notifyOnLocalEvent = true
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

  it('wecomBot 未启用时不应推送企微', async () => {
    mockWecomBotConfig.enabled = false

    await showSystemNotification('标题', '内容')
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(mockSendWecomNotification).not.toHaveBeenCalled()
  })

  it('notifyOnLocalEvent 关闭时不应推送企微', async () => {
    mockWecomBotConfig.notifyOnLocalEvent = false

    await showSystemNotification('标题', '内容')
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(mockSendWecomNotification).not.toHaveBeenCalled()
  })
})
