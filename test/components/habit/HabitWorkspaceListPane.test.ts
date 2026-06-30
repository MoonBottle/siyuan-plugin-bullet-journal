// @vitest-environment happy-dom

import type {
  Habit,
  HabitDayState,
  HabitPeriodState,
  HabitStats,
} from '@/types/models'
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
import HabitWorkspaceListPane from '@/components/habit/HabitWorkspaceListPane.vue'

const habitListItemResetSpy = vi.fn()

vi.mock('@/components/habit/HabitWeekBar.vue', () => ({
  default: defineComponent({
    name: 'HabitWeekBarStub',
    template: '<div data-testid="habit-week-bar-stub"></div>',
  }),
}))

vi.mock('@/components/habit/HabitListItem.vue', () => ({
  default: defineComponent({
    name: 'HabitListItemStub',
    props: ['currentDate', 'habit'],
    emits: ['reset-record'],
    setup(props, { emit }) {
      habitListItemResetSpy.mockImplementationOnce(() => emit('reset-record', props.habit, props.currentDate))
      return () => h('div', {
        'data-testid': `habit-list-item-stub-${props.habit.blockId}`,
        'data-current-date': props.currentDate,
      })
    },
  }),
}))

function mountPane(onResetRecord?: (...args: unknown[]) => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const habit: Habit = {
    name: '早起',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-05-01',
    frequency: { type: 'daily' },
    records: [],
  }

  const habitStatsMap = new Map<string, HabitStats>([[
    'habit-1',
    {
      habitId: 'habit-1',
      totalCheckins: 3,
      currentStreak: 1,
      longestStreak: 2,
      monthlyCheckins: 2,
      completionRate: 50,
      weeklyCompletionRate: 0,
      monthlyCompletionRate: 0,
    },
  ]])

  const habitDayStateMap = new Map<string, HabitDayState>([[
    'habit-1',
    {
      date: '2026-05-10',
      hasRecord: true,
      isCompleted: true,
    },
  ]])

  const habitPeriodStateMap = new Map<string, HabitPeriodState>([[
    'habit-1',
    {
      periodType: 'day',
      periodStart: '2026-05-10',
      periodEnd: '2026-05-10',
      requiredCount: 1,
      completedCount: 1,
      remainingCount: 0,
      isCompleted: true,
      eligibleToday: true,
    },
  ]])

  const app = createApp(HabitWorkspaceListPane, {
    selectedDate: '2026-05-10',
    currentDate: '2026-05-12',
    habits: [habit],
    habitStatsMap,
    habitDayStateMap,
    habitPeriodStateMap,
    onResetRecord,
  })

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
  habitListItemResetSpy.mockReset()
})

describe('habitWorkspaceListPane', () => {
  it('passes the selected week-bar date to habit list items instead of today', async () => {
    const mounted = mountPane()
    await nextTick()

    const item = mounted.container.querySelector('[data-testid="habit-list-item-stub-habit-1"]') as HTMLElement | null
    expect(item).not.toBeNull()
    expect(item?.getAttribute('data-current-date')).toBe('2026-05-10')

    mounted.unmount()
  })

  it('forwards reset-record from list item with the selected date', async () => {
    const onResetRecord = vi.fn()
    const mounted = mountPane(onResetRecord)
    await nextTick()

    habitListItemResetSpy()
    await nextTick()

    expect(onResetRecord).toHaveBeenCalledTimes(1)
    expect(onResetRecord).toHaveBeenCalledWith(expect.anything(), '2026-05-10')

    mounted.unmount()
  })
})
