// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import HabitRecordLog from '@/components/habit/HabitRecordLog.vue';
import type { Habit } from '@/types/models';

function mountComponent(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(HabitRecordLog, props);
  app.mount(container);

  return {
    container,
    unmount: () => {
      app.unmount();
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('HabitRecordLog', () => {
  it('点击编辑和删除按钮时应触发对应事件', async () => {
    const onEditRecord = vi.fn();
    const onDeleteRecord = vi.fn();
    const habit: Habit = {
      name: '喝水',
      type: 'count',
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      target: 8,
      unit: '杯',
      frequency: { type: 'daily' },
      records: [
        {
          content: '喝水 4/8杯',
          date: '2026-04-10',
          docId: 'doc-1',
          blockId: 'record-1',
          habitId: 'habit-1',
          currentValue: 4,
          targetValue: 8,
          unit: '杯',
        },
      ],
    };

    const mounted = mountComponent({
      habit,
      onEditRecord,
      onDeleteRecord,
    });

    await nextTick();

    const editButton = mounted.container.querySelector('[data-action="edit-record"]');
    const deleteButton = mounted.container.querySelector('[data-action="delete-record"]');

    expect(editButton).not.toBeNull();
    expect(deleteButton).not.toBeNull();

    editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onEditRecord).toHaveBeenCalledTimes(1);
    expect(onDeleteRecord).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });
});
