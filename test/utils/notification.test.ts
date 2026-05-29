import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mockShowMessage = vi.fn()
const mockSendNotification = vi.fn()
const mockCancelNotification = vi.fn()
const mockWechatNotification = vi.fn().mockResolvedValue(undefined)
const mockPluginState = {
  isMobile: false,
}

vi.mock('siyuan', () => ({
  platformUtils: {
    sendNotification: mockSendNotification,
    cancelNotification: mockCancelNotification,
  },
}))

vi.mock('@/utils/dialog', () => ({
  showMessage: mockShowMessage,
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => {
    if (key === 'pomodoro') {
      return {
        completeNotifyTitle: 'Pomodoro Complete',
        completeNotifyBody: '{content} {minutes}',
      }
    }
    return key
  },
}))

vi.mock('@/main', () => ({
  getCurrentPlugin: () => mockPluginState,
}))

vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: () => ({}),
}))

vi.mock('@/stores/aiStore', () => ({
  useAIStore: () => ({
    sendWechatNotification: mockWechatNotification,
  }),
}))

function installBrowserNotification() {
  const BrowserNotification = Object.assign(
    vi.fn().mockImplementation(() => ({
      close: vi.fn(),
    })),
    {
      permission: 'granted' as string,
      requestPermission: vi.fn(),
    },
  )
  vi.stubGlobal('Notification', BrowserNotification)
  return BrowserNotification
}

describe('notification utility', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.useFakeTimers();
    (globalThis as any).window = globalThis
    mockPluginState.isMobile = false
  })

  it('prefers native immediate notification over browser Notification', async () => {
    mockSendNotification.mockResolvedValueOnce(101)
    const BrowserNotification = installBrowserNotification()
    const onClick = vi.fn()
    const onClose = vi.fn()

    const { showSystemNotification } = await import('@/utils/notification')
    const result = await showSystemNotification('Title', 'Body', {
      tag: 'pomodoro',
      onClick,
      onClose,
    })

    expect(result).toBe(101)
    expect(mockSendNotification).toHaveBeenCalledWith({
      title: 'Title',
      body: 'Body',
      channel: 'pomodoro',
      timeoutType: 'never',
    })
    expect(BrowserNotification).not.toHaveBeenCalled()
    expect(mockShowMessage).not.toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(mockWechatNotification).toHaveBeenCalledWith('Title\nBody')
  })

  it('falls back to browser Notification when native immediate fails and wires onClick', async () => {
    mockSendNotification.mockRejectedValueOnce(new Error('native failed'))
    const BrowserNotification = installBrowserNotification()
    const onClick = vi.fn()

    const { showSystemNotification } = await import('@/utils/notification')
    const result = await showSystemNotification('Title', 'Body', {
      icon: '/icon.png',
      tag: 'fallback',
      onClick,
    })

    expect(mockSendNotification).toHaveBeenCalledTimes(1)
    expect(BrowserNotification).toHaveBeenCalledWith('Title', {
      body: 'Body',
      icon: '/icon.png',
      tag: 'fallback',
      requireInteraction: true,
    })
    expect(result).toMatchObject({
      close: expect.any(Function),
    });
    (result as Notification).onclick?.(new Event('click'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(mockShowMessage).not.toHaveBeenCalled()
  })

  it('falls back to showMessage when browser Notification is unavailable', async () => {
    mockSendNotification.mockRejectedValueOnce(new Error('native failed'))
    vi.unstubAllGlobals();
    (globalThis as any).window = globalThis

    const { showSystemNotification } = await import('@/utils/notification')
    const result = await showSystemNotification('Title', 'Body')

    expect(result).toBeNull()
    expect(mockShowMessage).toHaveBeenCalledWith('Title: Body')
  })

  it('schedules and cancels native notifications', async () => {
    mockSendNotification.mockResolvedValueOnce(202)

    const {
      scheduleNativeNotification,
      cancelNativeNotification,
    } = await import('@/utils/notification')

    const notificationId = await scheduleNativeNotification('Scheduled', 'Later', 30, { tag: 'reminder' })
    cancelNativeNotification(202)

    expect(notificationId).toBe(202)
    expect(mockSendNotification).toHaveBeenCalledWith({
      title: 'Scheduled',
      body: 'Later',
      delayInSeconds: 30,
      channel: 'reminder',
      timeoutType: 'never',
    })
    expect(mockCancelNotification).toHaveBeenCalledWith(202)
  })

  it('treats negative native notification ids as scheduling failure', async () => {
    mockSendNotification.mockResolvedValueOnce(-1)

    const { scheduleNativeNotification } = await import('@/utils/notification')
    const notificationId = await scheduleNativeNotification('Scheduled', 'Later', 30, { tag: 'reminder' })

    expect(notificationId).toBeNull()
  })

  it('requests browser notification permission when still undecided', async () => {
    const BrowserNotification = installBrowserNotification()
    BrowserNotification.permission = 'default'
    BrowserNotification.requestPermission.mockResolvedValueOnce('granted')

    const { requestNotificationPermission } = await import('@/utils/notification')
    const granted = await requestNotificationPermission()

    expect(granted).toBe(true)
    expect(BrowserNotification.requestPermission).toHaveBeenCalledTimes(1)
  })

  it('showPomodoroCompleteNotification uses the unified notification path', async () => {
    mockSendNotification.mockResolvedValueOnce(303)

    const { showPomodoroCompleteNotification } = await import('@/utils/notification')
    const result = await showPomodoroCompleteNotification('Write tests', 25)

    expect(result).toBe(303)
    expect(mockSendNotification).toHaveBeenCalledWith({
      title: 'Pomodoro Complete',
      body: 'Write tests 25',
      channel: 'pomodoro-complete',
      timeoutType: 'never',
    })
    expect(mockShowMessage).not.toHaveBeenCalled()
    expect(mockWechatNotification).toHaveBeenCalledWith('Pomodoro Complete\nWrite tests 25')
  })

  it('showPomodoroCompleteNotification still sends wechat notification on mobile', async () => {
    mockPluginState.isMobile = true
    mockSendNotification.mockResolvedValueOnce(404)

    const { showPomodoroCompleteNotification } = await import('@/utils/notification')
    const result = await showPomodoroCompleteNotification('Write tests', 25)

    expect(result).toBe(404)
    expect(mockWechatNotification).toHaveBeenCalledWith('Pomodoro Complete\nWrite tests 25')
  })
})
