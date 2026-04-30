// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import HabitRecordLog from '@/components/habit/HabitRecordLog.vue';
import type { Habit } from '@/types/models';
import { openDocumentAtLine } from '@/utils/fileUtils';

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
}));

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
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('HabitRecordLog', () => {
  it('shows month-specific title and filters records by view month', async () => {
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
          content: '喝水',
          date: '2026-04-30',
          docId: 'doc-1',
          blockId: 'record-1',
          habitId: 'habit-1',
          currentValue: 8,
          targetValue: 8,
          unit: '杯',
        },
        {
          content: '喝水',
          date: '2026-03-31',
          docId: 'doc-1',
          blockId: 'record-2',
          habitId: 'habit-1',
          currentValue: 6,
          targetValue: 8,
          unit: '杯',
        },
      ],
    };

    const mounted = mountComponent({
      habit,
      viewMonth: '2026-04',
    });

    await nextTick();

    expect(mounted.container.textContent).toContain('4 月打卡日志');
    expect(mounted.container.textContent).toContain('4/30');
    expect(mounted.container.textContent).not.toContain('3/31');

    mounted.unmount();
  });

  it('opens the record block when clicking a log row', async () => {
    const habit: Habit = {
      name: '早起',
      type: 'binary',
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [
        {
          content: '早起',
          date: '2026-04-10',
          docId: 'doc-2',
          blockId: 'record-10',
          habitId: 'habit-1',
        },
      ],
    };

    const mounted = mountComponent({
      habit,
      viewMonth: '2026-04',
    });

    await nextTick();

    const row = mounted.container.querySelector('[data-testid="habit-record-log-item-record-10"]');
    expect(row).not.toBeNull();

    row?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(openDocumentAtLine).toHaveBeenCalledWith('doc-2', undefined, 'record-10');

    mounted.unmount();
  });

  it('does not render edit or delete actions', async () => {
    const habit: Habit = {
      name: '早起',
      type: 'binary',
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [
        {
          content: '早起',
          date: '2026-04-10',
          docId: 'doc-1',
          blockId: 'record-10',
          habitId: 'habit-1',
        },
      ],
    };

    const mounted = mountComponent({
      habit,
      viewMonth: '2026-04',
    });

    await nextTick();

    expect(mounted.container.querySelector('[data-action="edit-record"]')).toBeNull();
    expect(mounted.container.querySelector('[data-action="delete-record"]')).toBeNull();

    mounted.unmount();
  });
});
