// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import MobilePomodoroPanel from '@/mobile/panels/MobilePomodoroPanel.vue';

const {
  pomodoroStore,
  eventBusOn,
} = vi.hoisted(() => ({
  pomodoroStore: {
    isFocusing: false,
    isBreakActive: false,
    startBreak: vi.fn(),
  },
  eventBusOn: vi.fn(() => vi.fn()),
}));

vi.mock('@/stores', () => ({
  usePomodoroStore: () => pomodoroStore,
}));

vi.mock('@/utils/eventBus', () => ({
  Events: {
    POMODORO_PENDING_COMPLETION: 'pomodoro:pending-completion',
  },
  eventBus: {
    on: eventBusOn,
  },
}));

vi.mock('@/mobile/drawers/pomodoro/sub/MobileTimerStarter.vue', () => ({
  default: defineComponent({
    name: 'MobileTimerStarterStub',
    props: {
      preselectedBlockId: {
        type: String,
        default: undefined,
      },
    },
    setup(props) {
      return () =>
        h(
          'div',
          {
            'data-testid': 'pomodoro-starter',
            'data-preselected-block-id': props.preselectedBlockId ?? '',
          },
          props.preselectedBlockId ?? 'no-preselected-block-id',
        );
    },
  }),
}));

vi.mock('@/mobile/drawers/pomodoro/sub/MobileActiveTimer.vue', () => ({
  default: defineComponent({
    name: 'MobileActiveTimerStub',
    setup() {
      return () => h('div', { 'data-testid': 'pomodoro-active' }, 'active');
    },
  }),
}));

vi.mock('@/mobile/drawers/pomodoro/sub/MobileBreakTimer.vue', () => ({
  default: defineComponent({
    name: 'MobileBreakTimerStub',
    setup() {
      return () => h('div', { 'data-testid': 'pomodoro-break' }, 'break');
    },
  }),
}));

vi.mock('@/mobile/drawers/pomodoro/sub/MobileComplete.vue', () => ({
  default: defineComponent({
    name: 'MobileCompleteStub',
    setup() {
      return () => h('div', { 'data-testid': 'pomodoro-complete' }, 'complete');
    },
  }),
}));

vi.mock('@/mobile/drawers/pomodoro/sub/MobileRestDialog.vue', () => ({
  default: defineComponent({
    name: 'MobileRestDialogStub',
    props: {
      modelValue: {
        type: Boolean,
        default: false,
      },
    },
    setup(props) {
      return () =>
        h(
          'div',
          {
            'data-testid': 'pomodoro-rest-dialog',
            'data-visible': String(props.modelValue),
          },
          'rest-dialog',
        );
    },
  }),
}));

function mountPanel(initialContext: { blockId?: string } | null = null) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const Root = defineComponent({
    setup() {
      return () =>
        h(MobilePomodoroPanel, {
          initialContext,
        });
    },
  });

  const app = createApp(Root);
  app.mount(container);

  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('MobilePomodoroPanel', () => {
  it('keeps the break view inside the panel surface when break mode is active', async () => {
    pomodoroStore.isBreakActive = true;

    const mounted = mountPanel({ blockId: 'item-123' });
    await nextTick();

    const surface = mounted.container.querySelector('.mobile-pomodoro-panel__surface');
    expect(surface).not.toBeNull();
    expect(surface?.querySelector('[data-testid="pomodoro-break"]')).not.toBeNull();

    mounted.unmount();
    pomodoroStore.isBreakActive = false;
  });

  it('forwards the initial block id into the starter path without drawer shell artifacts', async () => {
    const mounted = mountPanel({ blockId: 'item-123' });
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="pomodoro-panel"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="pomodoro-starter"]')?.getAttribute('data-preselected-block-id')).toBe('item-123');
    expect(mounted.container.querySelector('.drawer-overlay')).toBeNull();
    expect(mounted.container.querySelector('.drawer-handle')).toBeNull();
    expect(mounted.container.querySelector('.pomodoro-drawer')).toBeNull();
    expect(eventBusOn).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });

  it('keeps the completion view inside the panel surface when pending completion arrives', async () => {
    const mounted = mountPanel({ blockId: 'item-123' });
    await nextTick();

    const completionHandler = eventBusOn.mock.calls[0]?.[1];
    expect(typeof completionHandler).toBe('function');

    completionHandler?.({
      durationMinutes: 0,
      itemContent: '测试事项',
    });
    await nextTick();

    const surface = mounted.container.querySelector('.mobile-pomodoro-panel__surface');
    expect(surface).not.toBeNull();
    expect(surface?.querySelector('[data-testid="pomodoro-complete"]')).not.toBeNull();

    mounted.unmount();
  });
});
