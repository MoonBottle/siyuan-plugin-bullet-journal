// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h } from 'vue';
import MobileHabitDetailSheet from '@/mobile/components/habit/MobileHabitDetailSheet.vue';

function mountSheet(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const Root = defineComponent({
    setup() {
      return () => h(MobileHabitDetailSheet, props, {
        default: () => h('div', { 'data-testid': 'sheet-slot' }, 'slot content'),
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
});

describe('MobileHabitDetailSheet', () => {
  it('renders the title and emits close from the header action', () => {
    let closeCount = 0;
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
        closeCount += 1;
      },
    });

    const title = document.body.querySelector('[data-testid="habit-detail-sheet-title"]');
    expect(title?.textContent).toBe('Read');
    expect(document.body.querySelector('[data-testid="sheet-slot"]')).not.toBeNull();

    const closeButton = document.body.querySelector('[data-testid="habit-detail-sheet-close"]') as HTMLButtonElement | null;
    closeButton?.click();

    expect(closeCount).toBe(1);

    mounted.unmount();
  });
});
