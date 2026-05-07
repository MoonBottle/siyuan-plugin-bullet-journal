// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TaskItemDetail from '@/mobile/drawers/task/TaskItemDetail.vue';

function mountTaskItemDetail(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const pinia = createPinia();
  setActivePinia(pinia);

  const app = createApp(TaskItemDetail, props);
  app.use(pinia);
  app.mount(container);

  return {
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('TaskItemDetail overlay', () => {
  it('applies the dedicated overlay class and keeps it above project/task detail overlays', () => {
    const mounted = mountTaskItemDetail({
      modelValue: true,
      item: {
        blockId: 'item-1',
        content: '看机会',
        date: '2026-05-07',
        status: 'pending',
      },
    });

    const overlay = document.body.querySelector('.drawer-overlay');
    expect(overlay?.classList.contains('task-item-detail-overlay')).toBe(true);

    const source = readFileSync(
      resolve(process.cwd(), 'src/mobile/drawers/task/TaskItemDetail.vue'),
      'utf-8',
    );
    expect(source).toContain('z-index: 1005;');

    mounted.unmount();
  });
});
