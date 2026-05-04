// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, onMounted } from 'vue';
import MobileMainShell from '@/mobile/MobileMainShell.vue';

const { todoPanelMountCount } = vi.hoisted(() => ({
  todoPanelMountCount: { value: 0 },
}));

vi.mock('@/mobile/panels/MobileTodoPanel.vue', () => ({
  default: defineComponent({
    name: 'MobileTodoPanelStub',
    emits: ['open-pomodoro'],
    setup(_, { emit }) {
      onMounted(() => {
        todoPanelMountCount.value += 1;
      });

      return () => h('div', { 'data-testid': 'todo-panel' }, [
        h(
          'button',
          {
            'data-testid': 'todo-open-pomodoro',
            onClick: () => emit('open-pomodoro', { blockId: 'item-1' }),
          },
          'Open pomodoro',
        ),
      ]);
    },
  }),
}));

vi.mock('@/mobile/panels/MobilePomodoroPanel.vue', () => ({
  default: defineComponent({
    name: 'MobilePomodoroPanelStub',
    props: {
      initialContext: {
        type: Object,
        default: null,
      },
    },
    setup(props) {
      return () => h(
        'div',
        {
          'data-testid': 'pomodoro-panel',
          'data-block-id': props.initialContext?.blockId ?? '',
        },
        props.initialContext?.blockId ?? 'no-context',
      );
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
      return () => h('div', { 'data-testid': 'more-panel' }, 'settings');
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

afterEach(() => {
  document.body.innerHTML = '';
  todoPanelMountCount.value = 0;
});

describe('MobileMainShell', () => {
  it('defaults to todo, shows fab only on todo, and forwards pomodoro requests to the pomodoro tab', async () => {
    const mounted = mountShell();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="todo-panel"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="mobile-create-fab"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="pomodoro-panel"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="mobile-tab-todo"]')?.className).toContain('mobile-bottom-tab-bar__button--active');
    expect(todoPanelMountCount.value).toBe(1);

    (mounted.container.querySelector('[data-testid="mobile-tab-habit"]') as HTMLButtonElement | null)?.click();
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-panel"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="mobile-create-fab"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="mobile-tab-habit"]')?.className).toContain('mobile-bottom-tab-bar__button--active');
    expect(mounted.container.querySelector('[data-testid="mobile-tab-todo"]')?.className).not.toContain('mobile-bottom-tab-bar__button--active');

    (mounted.container.querySelector('[data-testid="mobile-tab-todo"]') as HTMLButtonElement | null)?.click();
    await nextTick();

    expect(todoPanelMountCount.value).toBe(1);

    (mounted.container.querySelector('[data-testid="todo-open-pomodoro"]') as HTMLButtonElement | null)?.click();
    await nextTick();

    const pomodoroPanel = mounted.container.querySelector('[data-testid="pomodoro-panel"]');
    expect(pomodoroPanel).not.toBeNull();
    expect(pomodoroPanel?.getAttribute('data-block-id')).toBe('item-1');
    expect(mounted.container.querySelector('[data-testid="mobile-create-fab"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="mobile-tab-pomodoro"]')?.className).toContain('mobile-bottom-tab-bar__button--active');

    mounted.unmount();
  });
});
