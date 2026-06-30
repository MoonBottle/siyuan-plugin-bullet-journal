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

vi.mock('@/i18n', () => ({
  t: vi.fn(() => ''),
}))

vi.mock('@/main', () => ({
  usePlugin: () => ({ name: 'test-plugin' }),
}))

vi.mock('@/utils/itemActionHandlers', () => ({
  getItemActionHandlers: (_item: any, _plugin: any, options?: { afterAction?: () => void }) => {
    const afterAction = options?.afterAction
    return {
      isProcessing: { value: false },
      complete: vi.fn(async () => { afterAction?.() }),
      migrate: vi.fn(async () => { afterAction?.() }),
      abandon: vi.fn(async () => { afterAction?.() }),
      migrateToToday: vi.fn(async () => { afterAction?.() }),
      migrateToDate: vi.fn(async () => { afterAction?.() }),
    }
  },
}))

async function mountDrawer(props: Record<string, unknown>) {
  const { default: ActionDrawer } = await import('@/mobile/drawers/action/ActionDrawer.vue')
  const container = document.createElement('div')
  document.body.appendChild(container)

  const events: Array<{ name: string, payload: unknown }> = []
  const app = createApp(ActionDrawer, {
    ...props,
    'onUpdate:modelValue': (payload: unknown) => {
      events.push({
        name: 'update:modelValue',
        payload,
      })
    },
  })
  app.mount(container)
  await nextTick()

  return {
    events,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

describe('actionDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('closes drawer after completing an item', async () => {
    const mounted = await mountDrawer({
      modelValue: true,
      item: {
        blockId: 'block-1',
        content: '整理资料',
        date: '2026-05-01',
        status: 'pending',
      },
    });

    (document.body.querySelector('.action-complete') as HTMLButtonElement | null)?.click()
    await nextTick()

    expect(mounted.events).toEqual([
      {
        name: 'update:modelValue',
        payload: false,
      },
    ])

    mounted.unmount()
  })

  it('closes drawer after migrating an item', async () => {
    const mounted = await mountDrawer({
      modelValue: true,
      item: {
        blockId: 'block-2',
        content: '迁移事项',
        date: '2026-05-01',
        startDateTime: '2026-05-01 09:00',
        endDateTime: '2026-05-01 10:00',
        siblingItems: [{ date: '2026-05-03' }],
        status: 'pending',
      },
    });

    (document.body.querySelector('.action-migrate') as HTMLButtonElement | null)?.click()
    await nextTick()

    expect(mounted.events).toEqual([
      {
        name: 'update:modelValue',
        payload: false,
      },
    ])

    mounted.unmount()
  })
})
