// @vitest-environment happy-dom

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  createApp,
  nextTick,
} from 'vue'
import TimeSettingDrawer from '@/mobile/components/time-picker/TimeSettingDrawer.vue'

function mountTimeSettingDrawer(props: Record<string, unknown>) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp(TimeSettingDrawer, props)
  app.mount(container)

  return {
    async tick() {
      await nextTick()
    },
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('timeSettingDrawer', () => {
  it('keeps the Siyuan dialog class on a wrapper instead of the bottom-sheet overlay', async () => {
    const mounted = mountTimeSettingDrawer({
      modelValue: true,
      isAllDay: true,
      startTime: '',
      endTime: '',
    })

    await mounted.tick()

    const root = document.body.querySelector('.time-setting-dialog-root')
    const overlay = document.body.querySelector('.time-setting-overlay')

    expect(root?.classList.contains('b3-dialog')).toBe(true)
    expect(overlay?.classList.contains('b3-dialog')).toBe(false)

    mounted.unmount()
  })
})
