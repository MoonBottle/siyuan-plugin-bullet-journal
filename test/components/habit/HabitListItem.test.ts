// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import HabitListItem from '@/components/habit/HabitListItem.vue';
import type { Habit, HabitDayState, HabitPeriodState, HabitStats } from '@/types/models';

type EmitSpies = {
  openDoc?: ReturnType<typeof vi.fn>;
  openCalendar?: ReturnType<typeof vi.fn>;
  checkIn?: ReturnType<typeof vi.fn>;
  increment?: ReturnType<typeof vi.fn>;
};

function mountComponent(props: Record<string, unknown>, emits: EmitSpies = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp({
    render() {
      return h(HabitListItem, {
        ...props,
        onOpenDoc: emits.openDoc,
        onOpenCalendar: emits.openCalendar,
        onCheckIn: emits.checkIn,
        onIncrement: emits.increment,
      });
    },
  });
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

describe('HabitListItem', () => {
  it('clicking main body emits open-doc only', async () => {
    const habit: Habit = {
      name: '周报',
      type: 'binary',
      records: [],
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'weekly' },
    };
    const dayState: HabitDayState = {
      date: '2026-04-10',
      hasRecord: false,
      isCompleted: false,
    };
    const periodState: HabitPeriodState = {
      periodType: 'week',
      periodStart: '2026-04-06',
      periodEnd: '2026-04-12',
      requiredCount: 1,
      completedCount: 0,
      remainingCount: 1,
      isCompleted: false,
      eligibleToday: true,
    };
    const emits = {
      openDoc: vi.fn(),
      openCalendar: vi.fn(),
      checkIn: vi.fn(),
      increment: vi.fn(),
    };

    const mounted = mountComponent({ habit, dayState, periodState }, emits);

    await nextTick();

    const target = mounted.container.querySelector('[data-testid="habit-list-item-main"]') as HTMLDivElement | null;
    expect(target).not.toBeNull();

    target?.click();

    expect(emits.openDoc).toHaveBeenCalledTimes(1);
    expect(emits.openDoc).toHaveBeenCalledWith(habit);
    expect(emits.openCalendar).not.toHaveBeenCalled();
    expect(emits.checkIn).not.toHaveBeenCalled();
    expect(emits.increment).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('clicking calendar action emits open-calendar only', async () => {
    const habit: Habit = {
      name: '周报',
      type: 'binary',
      records: [],
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'weekly' },
    };
    const dayState: HabitDayState = {
      date: '2026-04-10',
      hasRecord: false,
      isCompleted: false,
    };
    const periodState: HabitPeriodState = {
      periodType: 'week',
      periodStart: '2026-04-06',
      periodEnd: '2026-04-12',
      requiredCount: 1,
      completedCount: 0,
      remainingCount: 1,
      isCompleted: false,
      eligibleToday: true,
    };
    const emits = {
      openDoc: vi.fn(),
      openCalendar: vi.fn(),
      checkIn: vi.fn(),
      increment: vi.fn(),
    };

    const mounted = mountComponent({ habit, dayState, periodState }, emits);

    await nextTick();

    const target = mounted.container.querySelector('[data-testid="habit-list-item-calendar"]') as HTMLButtonElement | null;
    expect(target).not.toBeNull();

    target?.click();

    expect(emits.openCalendar).toHaveBeenCalledTimes(1);
    expect(emits.openCalendar).toHaveBeenCalledWith(habit);
    expect(emits.openDoc).not.toHaveBeenCalled();
    expect(emits.checkIn).not.toHaveBeenCalled();
    expect(emits.increment).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('clicking increment action emits increment only', async () => {
    const habit: Habit = {
      name: '喝水',
      type: 'count',
      records: [],
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      target: 8,
      unit: '杯',
      frequency: { type: 'daily' },
    };
    const dayState: HabitDayState = {
      date: '2026-04-10',
      hasRecord: false,
      isCompleted: false,
      currentValue: 3,
      targetValue: 8,
    };
    const periodState: HabitPeriodState = {
      periodType: 'day',
      periodStart: '2026-04-10',
      periodEnd: '2026-04-10',
      requiredCount: 1,
      completedCount: 0,
      remainingCount: 1,
      isCompleted: false,
      eligibleToday: true,
    };
    const emits = {
      openDoc: vi.fn(),
      openCalendar: vi.fn(),
      checkIn: vi.fn(),
      increment: vi.fn(),
    };

    const mounted = mountComponent({ habit, dayState, periodState }, emits);

    await nextTick();

    const target = mounted.container.querySelector('[data-testid="habit-list-item-increment"]') as HTMLButtonElement | null;
    expect(target).not.toBeNull();

    target?.click();

    expect(emits.increment).toHaveBeenCalledTimes(1);
    expect(emits.increment).toHaveBeenCalledWith(habit);
    expect(emits.openDoc).not.toHaveBeenCalled();
    expect(emits.openCalendar).not.toHaveBeenCalled();
    expect(emits.checkIn).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('clicking binary check-in emits check-in only', async () => {
    const habit: Habit = {
      name: '周报',
      type: 'binary',
      records: [],
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'weekly' },
    };
    const dayState: HabitDayState = {
      date: '2026-04-10',
      hasRecord: false,
      isCompleted: false,
    };
    const periodState: HabitPeriodState = {
      periodType: 'week',
      periodStart: '2026-04-06',
      periodEnd: '2026-04-12',
      requiredCount: 1,
      completedCount: 0,
      remainingCount: 1,
      isCompleted: false,
      eligibleToday: true,
    };
    const emits = {
      openDoc: vi.fn(),
      openCalendar: vi.fn(),
      checkIn: vi.fn(),
      increment: vi.fn(),
    };

    const mounted = mountComponent({ habit, dayState, periodState }, emits);

    await nextTick();

    const target = mounted.container.querySelector('[data-testid="habit-list-item-check-in"]') as HTMLButtonElement | null;
    expect(target).not.toBeNull();

    target?.click();

    expect(emits.checkIn).toHaveBeenCalledTimes(1);
    expect(emits.checkIn).toHaveBeenCalledWith(habit);
    expect(emits.openDoc).not.toHaveBeenCalled();
    expect(emits.openCalendar).not.toHaveBeenCalled();
    expect(emits.increment).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('周期已达标但当天未完成时仍应允许打卡并显示周期状态', async () => {
    const habit: Habit = {
      name: '周报',
      type: 'binary',
      records: [],
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'weekly' },
    };
    const dayState: HabitDayState = {
      date: '2026-04-10',
      hasRecord: false,
      isCompleted: false,
    };
    const periodState: HabitPeriodState = {
      periodType: 'week',
      periodStart: '2026-04-06',
      periodEnd: '2026-04-12',
      requiredCount: 1,
      completedCount: 1,
      remainingCount: 0,
      isCompleted: true,
      eligibleToday: true,
    };
    const stats: HabitStats = {
      habitId: habit.blockId,
      totalCheckins: 1,
      monthlyCheckins: 1,
      completionRate: 1,
      weeklyCompletionRate: 1,
      monthlyCompletionRate: 1,
      currentStreak: 1,
      longestStreak: 1,
      isEnded: false,
    };

    const mounted = mountComponent({
      habit,
      dayState,
      periodState,
      stats,
    });

    await nextTick();

    expect(mounted.container.textContent).toContain('本周已达标');
    expect(mounted.container.textContent).toContain('打卡');

    const button = mounted.container.querySelector('[data-testid="habit-list-item-check-in"]') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(false);

    mounted.unmount();
  });

  it('binary daily completed state shows 已打卡 only once', async () => {
    const habit: Habit = {
      name: '早起',
      type: 'binary',
      records: [],
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
    };
    const dayState: HabitDayState = {
      date: '2026-04-10',
      hasRecord: true,
      isCompleted: true,
    };
    const periodState: HabitPeriodState = {
      periodType: 'day',
      periodStart: '2026-04-10',
      periodEnd: '2026-04-10',
      requiredCount: 1,
      completedCount: 1,
      remainingCount: 0,
      isCompleted: true,
      eligibleToday: true,
    };

    const mounted = mountComponent({ habit, dayState, periodState });

    await nextTick();

    const text = mounted.container.textContent || '';
    const matches = text.match(/已打卡/g) || [];
    expect(matches).toHaveLength(1);

    mounted.unmount();
  });
});
