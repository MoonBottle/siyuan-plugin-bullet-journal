// @vitest-environment happy-dom

import {
  afterEach,
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
import HabitDock from '@/tabs/HabitDock.vue'

const mockGetFrontend = vi.hoisted(() => vi.fn(() => 'desktop'))

vi.mock('@/mobile/MobileMainShell.vue', () => ({
  default: defineComponent({
    name: 'MobileMainShellStub',
    setup() {
      return () => h('div', { 'data-testid': 'mobile-main-shell-stub' }, 'mobile-main-shell')
    },
  }),
}))

vi.mock('@/mobile/MobileHabitDock.vue', () => ({
  default: defineComponent({
    name: 'MobileHabitDockStub',
    setup() {
      return () => h('div', { 'data-testid': 'mobile-habit-dock-stub' }, 'mobile-habit-dock')
    },
  }),
}))

vi.mock('@/tabs/DesktopHabitDock.vue', () => ({
  default: defineComponent({
    name: 'DesktopHabitDockStub',
    setup() {
      return () => h('div', { 'data-testid': 'desktop-habit-dock-stub' }, 'desktop-habit-dock')
    },
  }),
}))

vi.mock('siyuan', () => ({
  getFrontend: mockGetFrontend,
}))

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => undefined),
}))

function mountDock() {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp(HabitDock)
  app.mount(container)

  return {
    container,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
  mockGetFrontend.mockReturnValue('desktop')
})

describe('habitDock mobile entry', () => {
  it('mounts MobileMainShell on mobile instead of the legacy MobileHabitDock wrapper', async () => {
    mockGetFrontend.mockReturnValue('mobile')
    const mounted = mountDock()
    await nextTick()

    expect(mounted.container.querySelector('[data-testid="mobile-main-shell-stub"]')).not.toBeNull()
    expect(mounted.container.querySelector('[data-testid="mobile-habit-dock-stub"]')).toBeNull()
    expect(mounted.container.querySelector('[data-testid="desktop-habit-dock-stub"]')).toBeNull()

    mounted.unmount()
  })

  it('keeps mounting DesktopHabitDock on desktop', async () => {
    const mounted = mountDock()
    await nextTick()

    expect(mounted.container.querySelector('[data-testid="desktop-habit-dock-stub"]')).not.toBeNull()
    expect(mounted.container.querySelector('[data-testid="mobile-main-shell-stub"]')).toBeNull()
    expect(mounted.container.querySelector('[data-testid="mobile-habit-dock-stub"]')).toBeNull()

    mounted.unmount()
  })
})
