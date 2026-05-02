// @vitest-environment happy-dom

import { createApp, defineComponent, h, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { initI18n } from '@/i18n';

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

vi.mock('@/components/pomodoro/stats/StatsOverview.vue', () => ({
  default: defineComponent({
    name: 'StatsOverviewStub',
    setup() {
      return () => h('div', { 'data-testid': 'pomodoro-stats-overview-stub' }, 'overview');
    },
  }),
}));

vi.mock('@/components/pomodoro/stats/AnnualHeatmap.vue', () => ({
  default: defineComponent({
    name: 'AnnualHeatmapStub',
    setup() {
      return () => h('div', { 'data-testid': 'pomodoro-stats-annual-heatmap-stub' }, 'heatmap');
    },
  }),
}));

vi.mock('@/components/pomodoro/stats/FocusDetailSection.vue', () => ({
  default: defineComponent({
    name: 'FocusDetailSectionStub',
    props: ['range', 'rangeOffset'],
    emits: ['update:range', 'update:rangeOffset'],
    setup(props) {
      return () => h('div', {
        'data-testid': 'pomodoro-stats-focus-detail-stub',
        'data-range': props.range,
        'data-range-offset': String(props.rangeOffset),
      }, 'detail');
    },
  }),
}));

vi.mock('@/components/pomodoro/stats/FocusTrendChart.vue', () => ({
  default: defineComponent({
    name: 'FocusTrendChartStub',
    setup() {
      return () => h('div', { 'data-testid': 'pomodoro-stats-focus-trend-stub' }, 'trend');
    },
  }),
}));

vi.mock('@/components/pomodoro/stats/FocusTimelineChart.vue', () => ({
  default: defineComponent({
    name: 'FocusTimelineChartStub',
    setup() {
      return () => h('div', { 'data-testid': 'pomodoro-stats-focus-timeline-stub' }, 'timeline');
    },
  }),
}));

vi.mock('@/components/pomodoro/stats/BestFocusTimeChart.vue', () => ({
  default: defineComponent({
    name: 'BestFocusTimeChartStub',
    setup() {
      return () => h('div', { 'data-testid': 'pomodoro-stats-best-focus-time-stub' }, 'best-time');
    },
  }),
}));

async function mountDialog(options?: {
  initialConfig?: Record<string, unknown>;
  onConfirm?: ReturnType<typeof vi.fn>;
  onCancel?: ReturnType<typeof vi.fn>;
}) {
  const { default: PomodoroWidgetConfigDialog } = await import('@/components/workbench/dialogs/PomodoroWidgetConfigDialog.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const onConfirm = options?.onConfirm ?? vi.fn();
  const onCancel = options?.onCancel ?? vi.fn();

  const app = createApp(PomodoroWidgetConfigDialog, {
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
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

async function mountWidget(widgetConfig: Record<string, unknown>) {
  const { default: PomodoroStatsWidget } = await import('@/components/workbench/widgets/PomodoroStatsWidget.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(PomodoroStatsWidget, {
    widget: {
      id: 'widget-1',
      type: 'pomodoroStats',
      title: 'Pomodoro Stats',
      layout: { x: 0, y: 0, w: 6, h: 4 },
      config: widgetConfig,
    },
  });

  app.use(getActivePinia()!);
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

describe('PomodoroWidgetConfigDialog', () => {
  beforeEach(() => {
    initI18n('en_US');
    setActivePinia(createPinia());
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('confirms the selected stats section', async () => {
    const mounted = await mountDialog({
      initialConfig: {
        section: 'overview',
      },
    });

    const select = mounted.container.querySelector('[data-testid="pomodoro-widget-section-select"]') as HTMLSelectElement;
    select.value = 'focusTimeline';
    select.dispatchEvent(new Event('change'));
    await nextTick();

    (mounted.container.querySelector('[data-testid="pomodoro-widget-config-confirm"]') as HTMLButtonElement).click();

    expect(mounted.onConfirm).toHaveBeenCalledWith({
      section: 'focusTimeline',
    });

    mounted.unmount();
  });
});

describe('PomodoroStatsWidget', () => {
  beforeEach(() => {
    initI18n('en_US');
    setActivePinia(createPinia());
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders the configured stats section component', async () => {
    const mounted = await mountWidget({
      section: 'annualHeatmap',
    });

    expect(mounted.container.querySelector('[data-testid="workbench-pomodoro-widget-annual-heatmap"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="workbench-pomodoro-widget-overview"]')).toBeNull();

    mounted.unmount();
  });
});
