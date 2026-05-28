// @vitest-environment happy-dom

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  createApp,
  defineComponent,
  h,
} from 'vue'
import MobileHabitDetailSheet from '@/mobile/components/habit/MobileHabitDetailSheet.vue'

function mountSheet(props: Record<string, unknown>) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const Root = defineComponent({
    setup() {
      return () => h(MobileHabitDetailSheet, props, {
        default: () => h('div', { 'data-testid': 'sheet-slot' }, 'slot content'),
      })
    },
  })

  const app = createApp(Root)
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
})

describe('mobileHabitDetailSheet', () => {
  it('renders the title and emits close from the header action', () => {
    let closeCount = 0
    const mounted = mountSheet({
      open: true,
      habit: {
        blockId: 'habit-1',
        name: 'Read',
      },
      selectedDate: '2026-05-01',
      viewMonth: '2026-05',
      stats: null,
      onClose: () => {
        closeCount += 1
      },
    })

    const title = document.body.querySelector('[data-testid="habit-detail-sheet-title"]')
    expect(title?.textContent).toBe('Read')
    expect(document.body.querySelector('[data-testid="sheet-slot"]')).not.toBeNull()

    const closeButton = document.body.querySelector('[data-testid="habit-detail-sheet-close"]') as HTMLButtonElement | null
    closeButton?.click()

    expect(closeCount).toBe(1)

    mounted.unmount()
  })

  it('shows archive action for active habits', () => {
    let archiveCount = 0
    const mounted = mountSheet({
      open: true,
      habit: {
        blockId: 'habit-1',
        name: 'Read',
      },
      selectedDate: '2026-05-01',
      viewMonth: '2026-05',
      stats: null,
      onArchive: () => {
        archiveCount += 1
      },
    })

    const button = document.body.querySelector('[data-testid="mobile-habit-archive"]') as HTMLButtonElement | null
    expect(button).not.toBeNull()
    expect(document.body.querySelector('[data-testid="mobile-habit-unarchive"]')).toBeNull()

    button?.click()
    expect(archiveCount).toBe(1)

    mounted.unmount()
  })

  it('shows unarchive action for archived habits', () => {
    let unarchiveCount = 0
    const mounted = mountSheet({
      open: true,
      habit: {
        blockId: 'habit-1',
        name: 'Read',
        archivedAt: '2026-05-04',
      },
      selectedDate: '2026-05-01',
      viewMonth: '2026-05',
      stats: null,
      onUnarchive: () => {
        unarchiveCount += 1
      },
    })

    const button = document.body.querySelector('[data-testid="mobile-habit-unarchive"]') as HTMLButtonElement | null
    expect(button).not.toBeNull()
    expect(document.body.querySelector('[data-testid="mobile-habit-archive"]')).toBeNull()

    button?.click()
    expect(unarchiveCount).toBe(1)

    mounted.unmount()
  })

  it('marks the sheet panel as a Siyuan dialog container and constrains touch scrolling', () => {
    const mounted = mountSheet({
      open: true,
      habit: {
        blockId: 'habit-1',
        name: 'Read',
      },
      selectedDate: '2026-05-01',
      viewMonth: '2026-05',
      stats: null,
    })

    const root = document.body.querySelector('[data-testid="habit-detail-sheet"]')
    const body = document.body.querySelector('.mobile-habit-detail-sheet__body') as HTMLElement | null

    expect(root?.classList.contains('b3-dialog')).toBe(true)
    expect(body).not.toBeNull()
    expect(body?.style.touchAction).toBe('pan-y')
    expect(body?.style.overscrollBehavior).toBe('contain')

    mounted.unmount()
  })
})
