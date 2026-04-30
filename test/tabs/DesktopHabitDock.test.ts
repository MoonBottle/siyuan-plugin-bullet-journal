// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import DesktopHabitDock from '@/tabs/DesktopHabitDock.vue';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Habit } from '@/types/models';
import { openDocumentAtLine } from '@/utils/fileUtils';

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
}));

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({})),
}));

vi.mock('@/components/habit/HabitWeekBar.vue', () => ({
  default: defineComponent({
    name: 'HabitWeekBarStub',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup() {
      return () => h('div', { 'data-testid': 'habit-week-bar-stub' });
    },
  }),
}));

vi.mock('@/components/habit/HabitStatsCards.vue', () => ({
  default: defineComponent({
    name: 'HabitStatsCardsStub',
    setup() {
      return () => h('div', { 'data-testid': 'habit-stats-stub' });
    },
  }),
}));

vi.mock('@/components/habit/HabitMonthCalendar.vue', () => ({
  default: defineComponent({
    name: 'HabitMonthCalendarStub',
    setup() {
      return () => h('div', { 'data-testid': 'habit-month-calendar-stub' });
    },
  }),
}));

vi.mock('@/components/habit/HabitRecordLog.vue', () => ({
  default: defineComponent({
    name: 'HabitRecordLogStub',
    emits: ['edit-record', 'delete-record'],
    setup() {
      return () => h('div', { 'data-testid': 'habit-record-log-stub' });
    },
  }),
}));

vi.mock('@/components/habit/HabitCountInput.vue', () => ({
  default: defineComponent({
    name: 'HabitCountInputStub',
    emits: ['change'],
    setup() {
      return () => h('div', { 'data-testid': 'habit-count-input-stub' });
    },
  }),
}));

vi.mock('@/components/habit/HabitListItem.vue', () => ({
  default: defineComponent({
    name: 'HabitListItemStub',
    props: ['habit'],
    emits: ['open-doc', 'open-calendar', 'check-in', 'increment'],
    setup(props, { emit }) {
      return () => h('div', { 'data-testid': `habit-list-item-${props.habit.blockId}` }, [
        h('button', {
          'data-testid': 'habit-list-item-main',
          onClick: () => emit('open-doc', props.habit),
        }),
        h('button', {
          'data-testid': 'habit-list-item-calendar',
          onClick: () => emit('open-calendar', props.habit),
        }),
        h('button', {
          'data-testid': 'habit-list-item-check-in',
          onClick: () => emit('check-in', props.habit),
        }),
        h('button', {
          'data-testid': 'habit-list-item-increment',
          onClick: () => emit('increment', props.habit),
        }),
      ]);
    },
  }),
}));

function createHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    name: '喝水',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-04-01',
    frequency: { type: 'daily' },
    records: [],
    ...overrides,
  };
}

function mountDock() {
  const pinia = createPinia();
  setActivePinia(pinia);

  const projectStore = useProjectStore(pinia);
  const settingsStore = useSettingsStore(pinia);

  projectStore.projects = [{
    id: 'project-1',
    name: 'Project 1',
    items: [],
    habits: [createHabit()],
    links: [],
    groupId: '',
  } as any];
  projectStore.currentDate = '2026-04-30';
  projectStore.refresh = vi.fn().mockResolvedValue(undefined) as any;
  settingsStore.scanMode = 'folder';
  settingsStore.directories = [];

  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(DesktopHabitDock);
  app.use(pinia);
  app.mount(container);

  return {
    container,
    projectStore,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('DesktopHabitDock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('opening a list item document uses openDocumentAtLine', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-main"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(openDocumentAtLine).toHaveBeenCalledWith('doc-1', undefined, 'habit-1');
    mounted.unmount();
  });

  it('clicking the calendar action enters detail mode', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-calendar"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-detail-header"]')?.textContent).toContain('喝水');
    mounted.unmount();
  });

  it('detail header open-doc action opens the selected habit document', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-calendar"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-detail-open-doc"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(openDocumentAtLine).toHaveBeenCalledWith('doc-1', undefined, 'habit-1');
    mounted.unmount();
  });

  it('refresh button calls projectStore.refresh', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-dock-refresh-button"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.projectStore.refresh).toHaveBeenCalled();
    mounted.unmount();
  });

  it('binary check-in action does not open the document', async () => {
    const mounted = mountDock();

    mounted.container.querySelector('[data-testid="habit-list-item-check-in"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(openDocumentAtLine).not.toHaveBeenCalled();
    mounted.unmount();
  });

  it('increment action does not enter detail mode', async () => {
    const mounted = mountDock();
    mounted.projectStore.projects[0].habits = [createHabit({ type: 'count', target: 8, unit: '杯' })];
    await nextTick();

    mounted.container.querySelector('[data-testid="habit-list-item-increment"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-detail-header"]')).toBeNull();
    mounted.unmount();
  });
});
