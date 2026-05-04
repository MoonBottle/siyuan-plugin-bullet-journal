// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { createApp, nextTick } from 'vue';
import HabitMonthCalendar from '@/components/habit/HabitMonthCalendar.vue';
import type { Habit } from '@/types/models';

function mountCalendar(habit: Habit, currentDate = '2026-04-30') {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(HabitMonthCalendar, {
    habit,
    currentDate,
  });
  app.mount(container);

  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

function getCell(container: HTMLElement, date: string) {
  return container.querySelector(`[data-testid="habit-month-cell-${date}"]`) as HTMLElement | null;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('HabitMonthCalendar', () => {
  it('today highlights only the day number instead of the whole cell', async () => {
    const habit: Habit = {
      name: '喝水',
      docId: 'doc-1',
      blockId: 'habit-1',
      type: 'count',
      startDate: '2026-04-01',
      target: 8,
      unit: '杯',
      frequency: { type: 'daily' },
      records: [],
    };

    const mounted = mountCalendar(habit, '2026-04-30');
    await nextTick();

    const cell = getCell(mounted.container, '2026-04-30');
    expect(cell).not.toBeNull();
    expect(cell?.classList.contains('habit-month-calendar__cell--today')).toBe(false);

    const dayNum = cell?.querySelector('.habit-month-calendar__day-num') as HTMLElement | null;
    expect(dayNum).not.toBeNull();
    expect(dayNum?.classList.contains('habit-month-calendar__day-num--today')).toBe(true);

    mounted.unmount();
  });

  it('binary completed day renders a check marker', async () => {
    const habit: Habit = {
      name: '早起',
      docId: 'doc-1',
      blockId: 'habit-1',
      type: 'binary',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [{
        content: '早起',
        date: '2026-04-12',
        habitId: 'habit-1',
        blockId: 'record-1',
      }],
    };

    const mounted = mountCalendar(habit);
    await nextTick();

    const cell = getCell(mounted.container, '2026-04-12');
    expect(cell).not.toBeNull();
    expect(cell?.querySelector('[data-testid="habit-month-check"]')).not.toBeNull();

    mounted.unmount();
  });

  it('count partial day renders progress ring with real ratio', async () => {
    const habit: Habit = {
      name: '喝水',
      docId: 'doc-1',
      blockId: 'habit-1',
      type: 'count',
      startDate: '2026-04-01',
      target: 8,
      unit: '杯',
      frequency: { type: 'daily' },
      records: [{
        content: '喝水',
        date: '2026-04-08',
        currentValue: 3,
        targetValue: 8,
        unit: '杯',
        habitId: 'habit-1',
        blockId: 'record-1',
      }],
    };

    const mounted = mountCalendar(habit);
    await nextTick();

    const cell = getCell(mounted.container, '2026-04-08');
    expect(cell).not.toBeNull();

    const ring = cell?.querySelector('[data-testid="habit-month-progress-ring"]') as SVGElement | null;
    expect(ring).not.toBeNull();
    expect(ring?.getAttribute('data-progress')).toBe('0.375');

    mounted.unmount();
  });

  it('count completed day renders a check marker instead of progress ring', async () => {
    const habit: Habit = {
      name: '喝水',
      docId: 'doc-1',
      blockId: 'habit-1',
      type: 'count',
      startDate: '2026-04-01',
      target: 8,
      unit: '杯',
      frequency: { type: 'daily' },
      records: [{
        content: '喝水',
        date: '2026-04-10',
        currentValue: 8,
        targetValue: 8,
        unit: '杯',
        habitId: 'habit-1',
        blockId: 'record-1',
      }],
    };

    const mounted = mountCalendar(habit);
    await nextTick();

    const cell = getCell(mounted.container, '2026-04-10');
    expect(cell).not.toBeNull();
    expect(cell?.querySelector('[data-testid="habit-month-check"]')).not.toBeNull();
    expect(cell?.querySelector('[data-testid="habit-month-progress-ring"]')).toBeNull();

    mounted.unmount();
  });
});
