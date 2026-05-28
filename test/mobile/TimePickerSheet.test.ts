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
import TimePickerSheet from '@/mobile/components/time-picker/TimePickerSheet.vue'

function mountTimePickerSheet(props: Record<string, unknown>) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp(TimePickerSheet, props)
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

describe('timePickerSheet', () => {
  it('keeps the Siyuan dialog class on a wrapper and stacks above the time-setting drawer', async () => {
    const mounted = mountTimePickerSheet({
      modelValue: true,
      title: '选择开始时间',
      time: '09:00',
    })

    await mounted.tick()

    const root = document.body.querySelector('.time-picker-dialog-root')
    const overlay = document.body.querySelector('.time-picker-overlay')

    expect(root?.classList.contains('b3-dialog')).toBe(true)
    expect(overlay?.classList.contains('b3-dialog')).toBe(false)

    mounted.unmount()
  })
})
