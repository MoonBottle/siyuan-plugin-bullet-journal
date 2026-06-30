// @vitest-environment happy-dom

import type { Habit } from '@/types/models'
import { createPinia } from 'pinia'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  createApp,
  nextTick,
} from 'vue'
import HabitRecordLog from '@/components/habit/HabitRecordLog.vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { openDocumentAtLine } from '@/utils/fileUtils'

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
}))

function mountComponent(
  props: Record<string, unknown>,
  options: { habitCheckInTimePrecision?: 'day' | 'minute' | 'second' } = {},
) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const pinia = createPinia()
  const app = createApp(HabitRecordLog, props)
  app.use(pinia)

  if (options.habitCheckInTimePrecision) {
    useSettingsStore(pinia).habitCheckInTimePrecision = options.habitCheckInTimePrecision
  }

  app.mount(container)

  return {
    container,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('habitRecordLog', () => {
  it('renders minute precision from completedAt when the setting uses minute precision', async () => {
    const habit: Habit = {
      name: '喝水',
      type: 'binary',
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-05-01',
      frequency: { type: 'daily' },
      records: [
        {
          content: '喝水',
          date: '2026-05-08',
          completedAt: '2026-05-08 08:30',
          docId: 'doc-1',
          blockId: 'record-1',
          habitId: 'habit-1',
        },
      ],
    }

    const mounted = mountComponent({
      habit,
      viewMonth: '2026-05',
    }, { habitCheckInTimePrecision: 'minute' })

    await nextTick()

    expect(mounted.container.textContent).toContain('5/8 08:30')

    mounted.unmount()
  })

  it('keeps old day-only records date-only under second precision', async () => {
    const habit: Habit = {
      name: '喝水',
      type: 'binary',
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-05-01',
      frequency: { type: 'daily' },
      records: [
        {
          content: '喝水',
          date: '2026-05-08',
          completedAt: '2026-05-08',
          docId: 'doc-1',
          blockId: 'record-1',
          habitId: 'habit-1',
        },
      ],
    }

    const mounted = mountComponent({
      habit,
      viewMonth: '2026-05',
    }, { habitCheckInTimePrecision: 'second' })

    await nextTick()

    expect(mounted.container.textContent).toContain('5/8')
    expect(mounted.container.textContent).not.toContain('5/8 00:00')

    mounted.unmount()
  })

  it('shows month-specific title and filters records by view month', async () => {
    const habit: Habit = {
      name: '喝水',
      type: 'count',
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      target: 8,
      unit: '杯',
      frequency: { type: 'daily' },
      records: [
        {
          content: '喝水',
          date: '2026-04-30',
          docId: 'doc-1',
          blockId: 'record-1',
          habitId: 'habit-1',
          currentValue: 8,
          targetValue: 8,
          unit: '杯',
        },
        {
          content: '喝水',
          date: '2026-03-31',
          docId: 'doc-1',
          blockId: 'record-2',
          habitId: 'habit-1',
          currentValue: 6,
          targetValue: 8,
          unit: '杯',
        },
      ],
    }

    const mounted = mountComponent({
      habit,
      viewMonth: '2026-04',
    })

    await nextTick()

    expect(mounted.container.textContent).toContain('4 月打卡日志')
    expect(mounted.container.textContent).toContain('4/30')
    expect(mounted.container.textContent).not.toContain('3/31')
    expect(mounted.container.textContent).not.toContain('✅')

    mounted.unmount()
  })

  it('opens the record block when clicking a log row', async () => {
    const habit: Habit = {
      name: '早起',
      type: 'binary',
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [
        {
          content: '早起',
          date: '2026-04-10',
          docId: 'doc-2',
          blockId: 'record-10',
          habitId: 'habit-1',
        },
      ],
    }

    const mounted = mountComponent({
      habit,
      viewMonth: '2026-04',
    })

    await nextTick()

    const row = mounted.container.querySelector('[data-testid="habit-record-log-item-record-10"]')
    expect(row).not.toBeNull()

    row?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(openDocumentAtLine).toHaveBeenCalledWith('doc-2', undefined, 'record-10')

    mounted.unmount()
  })

  it('uses preview callback instead of opening document when preview mode is enabled', async () => {
    const habit: Habit = {
      name: '早起',
      type: 'binary',
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [
        {
          content: '早起',
          date: '2026-04-10',
          docId: 'doc-2',
          blockId: 'record-10',
          habitId: 'habit-1',
        },
      ],
    }
    const onRecordPreviewClick = vi.fn()

    const mounted = mountComponent({
      habit,
      viewMonth: '2026-04',
      previewTriggerMode: 'preview',
      onRecordPreviewClick,
    })

    await nextTick()

    const row = mounted.container.querySelector('[data-testid="habit-record-log-item-record-10"]')
    expect(row).not.toBeNull()

    row?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(onRecordPreviewClick).toHaveBeenCalledWith(expect.objectContaining({
      blockId: 'record-10',
      docId: 'doc-2',
      anchorEl: row,
    }), expect.any(MouseEvent))
    expect(openDocumentAtLine).not.toHaveBeenCalled()

    mounted.unmount()
  })

  it('does not render edit or delete actions', async () => {
    const habit: Habit = {
      name: '早起',
      type: 'binary',
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [
        {
          content: '早起',
          date: '2026-04-10',
          docId: 'doc-1',
          blockId: 'record-10',
          habitId: 'habit-1',
        },
      ],
    }

    const mounted = mountComponent({
      habit,
      viewMonth: '2026-04',
    })

    await nextTick()

    expect(mounted.container.querySelector('[data-action="edit-record"]')).toBeNull()
    expect(mounted.container.querySelector('[data-action="delete-record"]')).toBeNull()

    mounted.unmount()
  })

  it('shows empty state text for the current month when there are no records', async () => {
    const habit: Habit = {
      name: '早起',
      type: 'binary',
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [],
    }

    const mounted = mountComponent({
      habit,
      viewMonth: '2026-04',
    })

    await nextTick()

    expect(mounted.container.textContent).toContain('本月暂无打卡记录')

    mounted.unmount()
  })

  it('shows missed records with a trailing ❌ in the monthly log', async () => {
    const habit: Habit = {
      name: '早起',
      type: 'binary',
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [
        {
          content: '早起',
          date: '2026-04-10',
          docId: 'doc-1',
          blockId: 'record-10',
          habitId: 'habit-1',
          status: 'missed',
        },
      ],
    }

    const mounted = mountComponent({
      habit,
      viewMonth: '2026-04',
    })

    await nextTick()

    expect(mounted.container.textContent).toContain('早起 ❌')

    mounted.unmount()
  })
})
