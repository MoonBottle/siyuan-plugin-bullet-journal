// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import MobileMainShell from '@/mobile/MobileMainShell.vue';
import {
  consumePendingMobileMainShellTabTarget,
  setPendingMobileMainShellTabTarget,
} from '@/utils/mobileMainShellNavigation';
import { eventBus, Events } from '@/utils/eventBus';

vi.mock('@/mobile/panels/MobileTodoPanel.vue', () => ({
  default: defineComponent({
    name: 'MobileTodoPanelStub',
    setup() {
      return () => h('div', { 'data-testid': 'todo-panel' }, 'todo');
    },
  }),
}));

vi.mock('@/mobile/panels/MobilePomodoroPanel.vue', () => ({
  default: defineComponent({
    name: 'MobilePomodoroPanelStub',
    setup() {
      return () => h('div', { 'data-testid': 'pomodoro-panel' }, 'pomodoro');
    },
  }),
}));

vi.mock('@/mobile/panels/MobileHabitPanel.vue', () => ({
  default: defineComponent({
    name: 'MobileHabitPanelStub',
    setup() {
      return () => h('div', { 'data-testid': 'habit-panel' }, 'habit');
    },
  }),
}));

vi.mock('@/mobile/panels/MobileMorePanel.vue', () => ({
  default: defineComponent({
    name: 'MobileMorePanelStub',
    setup() {
      return () => h('div', { 'data-testid': 'more-panel' }, 'more');
    },
  }),
}));

function mountShell() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(MobileMainShell);
  app.mount(container);

  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('MobileMainShell navigation handling', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    eventBus.clear();
    consumePendingMobileMainShellTabTarget();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    eventBus.clear();
    consumePendingMobileMainShellTabTarget();
    vi.clearAllMocks();
  });

  it('applies pending shell tab targets on mount and reacts to live navigation events', async () => {
    setPendingMobileMainShellTabTarget({ tab: 'habit' });

    const mounted = mountShell();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-panel"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="todo-panel"]')).toBeNull();

    eventBus.emit(Events.MOBILE_MAIN_SHELL_NAVIGATE, { tab: 'pomodoro' });
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="pomodoro-panel"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-panel"]')).toBeNull();

    mounted.unmount();
  });
});
