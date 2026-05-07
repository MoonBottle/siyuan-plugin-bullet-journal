// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createApp, nextTick } from 'vue';
import MobileItemDetail from '@/mobile/drawers/item/MobileItemDetail.vue';

function mountItemDetail(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const pinia = createPinia();
  setActivePinia(pinia);

  const events: Array<{ name: string, payload: unknown }> = [];

  const app = createApp(MobileItemDetail, {
    ...props,
    onOpenProject: (payload: unknown) => {
      events.push({ name: 'openProject', payload });
    },
    onOpenTask: (payload: unknown) => {
      events.push({ name: 'openTask', payload });
    },
    'onUpdate:modelValue': (payload: unknown) => {
      events.push({ name: 'update:modelValue', payload });
    },
  });
  app.use(pinia);
  app.mount(container);

  return {
    events,
    async tick() {
      await nextTick();
    },
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('MobileItemDetail navigation', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('emits openProject and closes the current drawer when the project row is tapped', async () => {
    const mounted = mountItemDetail({
      modelValue: true,
      item: {
        blockId: 'item-1',
        content: '看机会',
        date: '2026-05-07',
        status: 'pending',
        project: {
          id: 'project-1',
          name: '股票',
        },
      },
    });

    await mounted.tick();

    const projectRow = Array.from(document.body.querySelectorAll('.info-item'))
      .find(node => node.textContent?.includes('股票')) as HTMLElement | undefined;
    projectRow?.click();

    expect(mounted.events).toEqual([
      { name: 'openProject', payload: 'project-1' },
      { name: 'update:modelValue', payload: false },
    ]);

    mounted.unmount();
  });

  it('emits openTask and closes the current drawer when the task row is tapped', async () => {
    const mounted = mountItemDetail({
      modelValue: true,
      item: {
        blockId: 'item-1',
        content: '看机会',
        date: '2026-05-07',
        status: 'pending',
        task: {
          id: 'task-id',
          blockId: 'task-block-1',
          name: '午后',
          level: 'L1',
        },
      },
    });

    await mounted.tick();

    const taskRow = Array.from(document.body.querySelectorAll('.info-item'))
      .find(node => node.textContent?.includes('午后')) as HTMLElement | undefined;
    taskRow?.click();

    expect(mounted.events).toEqual([
      { name: 'openTask', payload: 'task-block-1' },
      { name: 'update:modelValue', payload: false },
    ]);

    mounted.unmount();
  });
});
