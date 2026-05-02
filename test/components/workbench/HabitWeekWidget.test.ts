// @vitest-environment happy-dom

import { createApp, defineComponent, h, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { initI18n } from '@/i18n';
import { useProjectStore, useSettingsStore } from '@/stores';
import type { Habit } from '@/types/models';

const { openHabitWidgetDetailDialog } = vi.hoisted(() => ({
  openHabitWidgetDetailDialog: vi.fn(() => ({
    destroy: vi.fn(),
  })),
}));

vi.mock('@/workbench/habitWidgetDetailDialog', () => ({
  openHabitWidgetDetailDialog,
}));

vi.mock('@/components/SiyuanTheme/SySelect.vue', () => ({
  default: defineComponent({
    name: 'SySelectStub',
    props: ['modelValue', 'options', 'placeholder', 'disabled'],
    emits: ['update:modelValue'],
    inheritAttrs: false,
    setup(props, { emit, attrs }) {
      return () => h('select', {
        ...attrs,
        value: props.modelValue,
        disabled: props.disabled,
        onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLSelectElement).value),
      }, [
        props.placeholder
          ? h('option', { value: '' }, props.placeholder)
          : null,
        ...(props.options ?? []).map((option: { value: string, label: string }) =>
          h('option', { value: option.value }, option.label),
        ),
      ]);
    },
  }),
}));

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({ debugInstanceId: 'plugin-1' })),
}));

function createHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    name: 'Habit',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-04-01',
    frequency: { type: 'daily' },
    records: [],
    ...overrides,
  };
}

async function mountDialog(options?: {
  initialConfig?: Record<string, unknown>;
  onConfirm?: ReturnType<typeof vi.fn>;
  onCancel?: ReturnType<typeof vi.fn>;
}) {
  const { default: HabitWidgetConfigDialog } = await import('@/components/workbench/dialogs/HabitWidgetConfigDialog.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const onConfirm = options?.onConfirm ?? vi.fn();
  const onCancel = options?.onCancel ?? vi.fn();

  const app = createApp(HabitWidgetConfigDialog, {
    initialConfig: options?.initialConfig ?? {},
    onConfirm,
    onCancel,
  });

  app.use(getActivePinia()!);
  app.mount(container);
  await nextTick();

  return {
    container,
    onConfirm,
    onCancel,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

async function mountWidget(widgetConfig: Record<string, unknown>) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const projectStore = useProjectStore();
  projectStore.currentDate = '2026-05-02';
  projectStore.projects = [
    {
      id: 'project-a',
      name: 'Project A',
      tasks: [],
      items: [],
      habits: [createHabit({ blockId: 'habit-a', name: 'Alpha Habit' })],
      links: [],
      groupId: 'group-a',
    } as any,
    {
      id: 'project-b',
      name: 'Project B',
      tasks: [],
      items: [],
      habits: [createHabit({ blockId: 'habit-b', name: 'Beta Habit', docId: 'doc-2' })],
      links: [],
      groupId: 'group-b',
    } as any,
  ];

  const { default: HabitWeekWidget } = await import('@/components/workbench/widgets/HabitWeekWidget.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(HabitWeekWidget, {
    widget: {
      id: 'widget-1',
      type: 'habitWeek',
      title: 'Habit Widget',
      layout: { x: 0, y: 0, w: 6, h: 4 },
      config: widgetConfig,
    },
  });

  app.use(pinia);
  app.mount(container);
  await nextTick();

  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('HabitWidgetConfigDialog', () => {
  beforeEach(() => {
    initI18n('en_US');
    setActivePinia(createPinia());
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('confirms the selected group id', async () => {
    const settingsStore = useSettingsStore();
    settingsStore.loaded = true;
    settingsStore.groups = [
      { id: 'group-a', name: 'Alpha' } as any,
      { id: 'group-b', name: 'Beta' } as any,
    ];

    const mounted = await mountDialog({
      initialConfig: {
        groupId: 'group-a',
      },
    });

    const select = mounted.container.querySelector('[data-testid="habit-widget-group-select"]') as HTMLSelectElement;
    select.value = 'group-b';
    select.dispatchEvent(new Event('change'));
    await nextTick();

    (mounted.container.querySelector('[data-testid="habit-widget-config-confirm"]') as HTMLButtonElement).click();

    expect(mounted.onConfirm).toHaveBeenCalledWith({
      groupId: 'group-b',
    });

    mounted.unmount();
  });

  it('normalizes an empty selection to undefined on confirm', async () => {
    const settingsStore = useSettingsStore();
    settingsStore.loaded = true;
    settingsStore.groups = [
      { id: 'group-a', name: 'Alpha' } as any,
    ];

    const mounted = await mountDialog({
      initialConfig: {
        groupId: 'group-a',
      },
    });

    const select = mounted.container.querySelector('[data-testid="habit-widget-group-select"]') as HTMLSelectElement;
    select.value = '';
    select.dispatchEvent(new Event('change'));
    await nextTick();

    (mounted.container.querySelector('[data-testid="habit-widget-config-confirm"]') as HTMLButtonElement).click();

    expect(mounted.onConfirm).toHaveBeenCalledWith({
      groupId: undefined,
    });

    mounted.unmount();
  });
});

describe('HabitWeekWidget', () => {
  beforeEach(() => {
    initI18n('en_US');
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('filters habits by configured group and opens detail dialog from the list item', async () => {
    const mounted = await mountWidget({
      groupId: 'group-a',
    });

    expect(mounted.container.textContent).toContain('Alpha Habit');
    expect(mounted.container.textContent).not.toContain('Beta Habit');

    mounted.container.querySelector('[data-testid="habit-list-item-main"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(openHabitWidgetDetailDialog).toHaveBeenCalledWith({
      habitId: 'habit-a',
      habitName: 'Alpha Habit',
      groupId: 'group-a',
    });

    mounted.unmount();
  });
});
