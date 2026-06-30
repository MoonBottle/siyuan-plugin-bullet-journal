// @vitest-environment happy-dom

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
} from 'vitest'
import {
  createApp,
  nextTick,
} from 'vue'
import FilterDrawer from '@/mobile/drawers/filter/FilterDrawer.vue'
import { useSettingsStore } from '@/stores'

function mountFilterDrawer(props: Record<string, unknown>) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const pinia = createPinia()
  setActivePinia(pinia)

  const settingsStore = useSettingsStore(pinia)
  settingsStore.groups = [
    {
      id: 'group-1',
      name: 'Work',
      order: 1,
    },
  ] as any

  const app = createApp(FilterDrawer, props)
  app.use(pinia)
  app.mount(container)

  return {
    container,
    async tick() {
      await nextTick()
      await Promise.resolve()
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

describe('filterDrawer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('marks the main drawer overlay as a Siyuan dialog and constrains content scrolling', async () => {
    const mounted = mountFilterDrawer({
      modelValue: true,
      selectedGroup: '',
      dateFilter: 'all',
      dateRange: null,
      priorities: [],
    })

    await mounted.tick()

    const overlay = document.body.querySelector('.drawer-overlay')
    const content = document.body.querySelector('.drawer-content') as HTMLElement | null

    expect(overlay?.classList.contains('b3-dialog')).toBe(true)
    expect(content).not.toBeNull()
    expect(content?.style.touchAction).toBe('pan-y')
    expect(content?.style.overscrollBehavior).toBe('contain')

    mounted.unmount()
  })

  it('marks the custom date picker sheet as a Siyuan dialog and constrains touch scrolling', async () => {
    const mounted = mountFilterDrawer({
      modelValue: true,
      selectedGroup: '',
      dateFilter: 'custom',
      dateRange: {
        start: '2026-05-01',
        end: '2026-05-07',
      },
      priorities: [],
    })

    await mounted.tick()

    const startDateButton = Array.from(document.body.querySelectorAll('.time-btn'))
      .find((button) => button.textContent?.includes('2026-05-01')) as HTMLButtonElement | undefined
    startDateButton?.click()
    await mounted.tick()

    const sheetOverlay = Array.from(document.body.querySelectorAll('.sheet-overlay'))
      .find((node) => node.querySelector('.date-picker-sheet'))
    const datePickerSheet = document.body.querySelector('.date-picker-sheet') as HTMLElement | null
    const sheetContent = datePickerSheet?.querySelector('.sheet-content') as HTMLElement | null

    expect(sheetOverlay?.classList.contains('b3-dialog')).toBe(true)
    expect(datePickerSheet).not.toBeNull()
    expect(datePickerSheet?.style.touchAction).toBe('pan-y')
    expect(datePickerSheet?.style.overscrollBehavior).toBe('contain')
    expect(sheetContent).not.toBeNull()
    expect(sheetContent?.style.touchAction).toBe('pan-y')
    expect(sheetContent?.style.overscrollBehavior).toBe('contain')

    mounted.unmount()
  })
})
