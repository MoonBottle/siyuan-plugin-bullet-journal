// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { createApp, nextTick } from 'vue';
import HabitMonthCalendar from '@/components/habit/HabitMonthCalendar.vue';
import type { Habit } from '@/types/models';

function mountCalendar(habit: Habit, currentDate = '2026-04-30') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const events = {
    primary: [] as string[],
    reset: [] as string[],
    missed: [] as string[],
  };

  const app = createApp(HabitMonthCalendar, {
    habit,
    currentDate,
    onMonthCellPrimary: (date: string) => events.primary.push(date),
    onMonthCellReset: (date: string) => events.reset.push(date),
    onMonthCellMarkMissed: (date: string) => events.missed.push(date),
  });
  app.mount(container);

  return {
    container,
    events,
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

  it('missed day renders a cross marker', async () => {
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
        status: 'missed',
      }],
    };

    const mounted = mountCalendar(habit);
    await nextTick();

    const cell = getCell(mounted.container, '2026-04-12');
    expect(cell?.querySelector('[data-testid="habit-month-missed"]')).not.toBeNull();

    mounted.unmount();
  });

  it('first left click on a missed day emits reset instead of primary action', async () => {
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
        status: 'missed',
      }],
    };

    const mounted = mountCalendar(habit);
    await nextTick();

    const cell = getCell(mounted.container, '2026-04-12');
    const marker = cell?.querySelector('.habit-month-calendar__marker') as HTMLDivElement | null;
    marker?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(mounted.events.reset).toEqual(['2026-04-12']);
    expect(mounted.events.primary).toEqual([]);

    mounted.unmount();
  });

  it('blank day context menu offers missed action', async () => {
    const habit: Habit = {
      name: '早起',
      docId: 'doc-1',
      blockId: 'habit-1',
      type: 'binary',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [],
    };

    const mounted = mountCalendar(habit);
    await nextTick();

    const cell = getCell(mounted.container, '2026-04-12');
    const marker = cell?.querySelector('.habit-month-calendar__marker') as HTMLDivElement | null;
    marker?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 }));
    await nextTick();

    const action = mounted.container.querySelector('[data-action="mark-missed"]') as HTMLButtonElement | null;
    expect(action).not.toBeNull();
    action?.click();

    expect(mounted.events.missed).toEqual(['2026-04-12']);
    mounted.unmount();
  });

  it('interactive day exposes pointer hint title', async () => {
    const habit: Habit = {
      name: '早起',
      docId: 'doc-1',
      blockId: 'habit-1',
      type: 'binary',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
      records: [],
    };

    const mounted = mountCalendar(habit);
    await nextTick();

    const cell = getCell(mounted.container, '2026-04-12');
    const marker = cell?.querySelector('.habit-month-calendar__marker') as HTMLDivElement | null;
    expect(marker?.classList.contains('habit-month-calendar__marker--interactive')).toBe(true);
    expect(marker?.getAttribute('title')).toBe('点击可打卡，右键可更多操作');

    mounted.unmount();
  });
});
