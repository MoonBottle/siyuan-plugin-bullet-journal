// @vitest-environment happy-dom

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createApp } from 'vue'
import MobileRestDialog from '@/mobile/drawers/pomodoro/sub/MobileRestDialog.vue'

vi.mock('@/main', () => ({
  usePlugin: () => ({
    getSettings: () => ({
      pomodoro: {
        breakDurationPresets: [5, 10, 15],
        defaultBreakDuration: 5,
      },
    }),
  }),
}))

function mountRestDialog(props: Record<string, unknown>) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp(MobileRestDialog, props)
  app.mount(container)

  return {
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('mobileRestDialog', () => {
  it('marks the overlay as a Siyuan dialog container and constrains dialog scrolling', () => {
    const mounted = mountRestDialog({
      modelValue: true,
    })

    const overlay = document.body.querySelector('.rest-overlay')
    const dialog = document.body.querySelector('.rest-dialog') as HTMLElement | null

    expect(overlay?.classList.contains('b3-dialog')).toBe(true)
    expect(dialog?.style.touchAction).toBe('pan-y')
    expect(dialog?.style.overscrollBehavior).toBe('contain')

    mounted.unmount()
  })
})
