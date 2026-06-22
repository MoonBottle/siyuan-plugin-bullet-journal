// @vitest-environment happy-dom

import { createPinia } from 'pinia'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { nextTick } from 'vue'
import { initI18n } from '@/i18n'
import { setSharedPinia } from '@/utils/sharedPinia'

vi.mock('siyuan', async () => {
  return await import('../__mocks__/siyuan')
})
vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => null),
  useApp: vi.fn(() => null),
}))

describe('showItemDetailModal', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    initI18n('en')
    setSharedPinia(createPinia())
  })

  afterEach(() => {
    document.body.innerHTML = ''
    setSharedPinia(null)
    vi.restoreAllMocks()
  })

  it('opens item detail dialog and focuses the first focusable element on mount', async () => {
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })

    const { showItemDetailModal } = await import('@/utils/dialog')

    const dialog = showItemDetailModal({
      id: 'item-1',
      blockId: 'block-1',
      content: 'Review PR',
      date: '2026-05-01',
      status: 'pending',
      reminder: {
        enabled: true,
        type: 'absolute',
        time: '09:30',
      },
      links: [],
      pomodoros: [],
    } as any)

    await nextTick()

    const buttons = dialog.element.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)

    // The first button should receive initial focus (not reminder-specific)
    const firstButton = buttons[0]
    expect(document.activeElement).toBe(firstButton)

    dialog.destroy()
    rafSpy.mockRestore()
  }, 15000)
})
