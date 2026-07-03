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
} from 'vue'
import WecomBotConfigSection from '@/components/settings/WecomBotConfigSection.vue'
import { useAIStore } from '@/stores/aiStore'

const mockUpdateWecomBotConfig = vi.fn().mockResolvedValue(undefined)

vi.mock('@/stores/aiStore', () => ({
  useAIStore: () => ({
    wecomBotConfig: {
      enabled: false,
      botId: '',
      secret: '',
      connectionStatus: 'disconnected',
    },
    isWecomBotConnected: false,
    updateWecomBotConfig: mockUpdateWecomBotConfig,
  }),
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => {
    if (key === 'settings') {
      return {
        wecombot: {
          title: 'settings.wecombot.title',
          sectionDescription: 'settings.wecombot.sectionDescription',
          enabled: 'settings.wecombot.enabled',
          enabledDesc: 'settings.wecombot.enabledDesc',
          botId: 'settings.wecombot.botId',
          botIdDesc: 'settings.wecombot.botIdDesc',
          botIdPlaceholder: 'settings.wecombot.botIdPlaceholder',
          secret: 'settings.wecombot.secret',
          secretDesc: 'settings.wecombot.secretDesc',
          secretPlaceholder: 'settings.wecombot.secretPlaceholder',
          testConnection: 'settings.wecombot.testConnection',
          testing: 'settings.wecombot.testing',
          notifyOnLocalEvent: 'settings.wecombot.notifyOnLocalEvent',
          notifyOnLocalEventDesc: 'settings.wecombot.notifyOnLocalEventDesc',
          authFailedHint: 'settings.wecombot.authFailedHint',
          connectionStatus: {
            disconnected: 'settings.wecombot.connectionStatus.disconnected',
            connecting: 'settings.wecombot.connectionStatus.connecting',
            connected: 'settings.wecombot.connectionStatus.connected',
            error: 'settings.wecombot.connectionStatus.error',
          },
        },
      }
    }
    return key
  },
}))

function mountComponent(props: Record<string, unknown> = {}) {
  const TestHost = defineComponent({
    setup() {
      return () => h(WecomBotConfigSection, {
        isMobile: false,
        ...props,
      })
    },
  })

  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(TestHost)
  app.mount(container)

  return {
    container,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

function setSwitch(container: HTMLElement, testid: string, checked: boolean) {
  const el = container.querySelector(`[data-testid="${testid}"]`) as HTMLInputElement
  el.checked = checked
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function setInputValue(container: HTMLElement, testid: string, value: string) {
  const el = container.querySelector(`[data-testid="${testid}"]`) as HTMLInputElement
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function clickButton(container: HTMLElement, testid: string) {
  const el = container.querySelector(`[data-testid="${testid}"]`) as HTMLButtonElement
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('wecomBotConfigSection', () => {
  beforeEach(() => {
    mockUpdateWecomBotConfig.mockClear()
    ;(window as any).__siyuan_plugin__ = {
      saveData: vi.fn().mockResolvedValue(undefined),
    }
  })

  it('应渲染启用开关', () => {
    const {
      container,
      unmount,
    } = mountComponent()
    expect(container.textContent).toContain('settings.wecombot.enabled')
    unmount()
  })

  it('启用后应显示 Bot ID 和 Secret 输入框', async () => {
    const {
      container,
      unmount,
    } = mountComponent()
    setSwitch(container, 'wecombot-enabled-switch', true)
    await nextTick()
    expect(container.querySelector('[data-testid="wecombot-bot-id-input"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="wecombot-secret-input"]')).not.toBeNull()
    unmount()
  })

  it('点击测试连接应调用 updateWecomBotConfig', async () => {
    const {
      container,
      unmount,
    } = mountComponent()
    setSwitch(container, 'wecombot-enabled-switch', true)
    await nextTick()
    setInputValue(container, 'wecombot-bot-id-input', 'test-bot')
    setInputValue(container, 'wecombot-secret-input', 'test-secret')
    // 等待 DOM 重新渲染，使按钮的 disabled 属性更新为 false
    await nextTick()
    clickButton(container, 'wecombot-test-button')
    // 等待微任务（mock 立即 resolve）刷新
    await nextTick()

    const store = useAIStore()
    expect(store.updateWecomBotConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: 'test-bot',
        secret: 'test-secret',
      }),
      expect.anything(),
    )
    unmount()
  })
})
