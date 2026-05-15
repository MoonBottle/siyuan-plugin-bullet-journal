// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import HabitListItem from '@/components/habit/HabitListItem.vue';
import type { Habit, HabitDayState, HabitPeriodState, HabitStats } from '@/types/models';

type EmitSpies = {
  openDoc?: ReturnType<typeof vi.fn>;
  openDetail?: ReturnType<typeof vi.fn>;
  checkIn?: ReturnType<typeof vi.fn>;
  increment?: ReturnType<typeof vi.fn>;
  markMissed?: ReturnType<typeof vi.fn>;
  resetRecord?: ReturnType<typeof vi.fn>;
};

function mountComponent(props: Record<string, unknown>, emits: EmitSpies = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp({
    render() {
      return h(HabitListItem, {
        ...props,
        onOpenDoc: emits.openDoc,
        onOpenDetail: emits.openDetail,
        onCheckIn: emits.checkIn,
        onIncrement: emits.increment,
        onMarkMissed: emits.markMissed,
        onResetRecord: emits.resetRecord,
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
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-12T10:00:00+08:00'));
});

describe('HabitListItem', () => {
  it('clicking main body emits open-detail only on desktop', async () => {
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
      openDetail: vi.fn(),
      checkIn: vi.fn(),
      increment: vi.fn(),
    };

    const mounted = mountComponent({ habit, dayState, periodState }, emits);

    await nextTick();

    const target = mounted.container.querySelector('[data-testid="habit-list-item-main"]') as HTMLDivElement | null;
    expect(target).not.toBeNull();

    target?.click();

    expect(emits.openDetail).toHaveBeenCalledTimes(1);
    expect(emits.openDetail).toHaveBeenCalledWith(habit);
    expect(emits.openDoc).not.toHaveBeenCalled();
    expect(emits.checkIn).not.toHaveBeenCalled();
    expect(emits.increment).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('clicking main body emits open-detail instead of open-doc on mobile', async () => {
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
      openDetail: vi.fn(),
      checkIn: vi.fn(),
      increment: vi.fn(),
    };

    const mounted = mountComponent({ habit, dayState, periodState, isMobile: true }, emits);

    await nextTick();

    const target = mounted.container.querySelector('[data-testid="habit-list-item-main"]') as HTMLDivElement | null;
    expect(target).not.toBeNull();

    target?.click();

    expect(emits.openDetail).toHaveBeenCalledTimes(1);
    expect(emits.openDetail).toHaveBeenCalledWith(habit);
    expect(emits.openDoc).not.toHaveBeenCalled();
    expect(emits.checkIn).not.toHaveBeenCalled();
    expect(emits.increment).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('clicking desktop document action emits open-doc only', async () => {
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
      openDetail: vi.fn(),
      checkIn: vi.fn(),
      increment: vi.fn(),
    };

    const mounted = mountComponent({ habit, dayState, periodState }, emits);

    await nextTick();

    const target = mounted.container.querySelector('[data-testid="habit-list-item-open-doc"]') as HTMLButtonElement | null;
    expect(target).not.toBeNull();

    target?.click();

    expect(emits.openDoc).toHaveBeenCalledTimes(1);
    expect(emits.openDoc).toHaveBeenCalledWith(habit);
    expect(emits.openDetail).not.toHaveBeenCalled();
    expect(emits.checkIn).not.toHaveBeenCalled();
    expect(emits.increment).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('hides the desktop document action on mobile', async () => {
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

    const mounted = mountComponent({ habit, dayState, periodState, isMobile: true });

    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-list-item-open-doc"]')).toBeNull();

    mounted.unmount();
  });

  it('renders ebbinghaus overdue hints', async () => {
    vi.setSystemTime(new Date('2026-05-18T10:00:00+08:00'));

    const habit: Habit = {
      name: '英语单词',
      type: 'binary',
      records: [],
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-05-14',
      frequency: { type: 'ebbinghaus', intervals: [1, 2, 4, 7, 15] },
    };
    const dayState: HabitDayState = {
      date: '2026-05-18',
      hasRecord: false,
      isCompleted: false,
      isDue: true,
      isOverdue: true,
      overdueDays: 3,
      nextDueDate: '2026-05-15',
      currentStageIndex: 0,
      currentIntervalDays: 1,
    };
    const periodState: HabitPeriodState = {
      periodType: 'day',
      periodStart: '2026-05-18',
      periodEnd: '2026-05-18',
      requiredCount: 1,
      completedCount: 0,
      remainingCount: 1,
      isCompleted: false,
      eligibleToday: true,
      nextDueDate: '2026-05-15',
      currentStageIndex: 0,
      currentIntervalDays: 1,
      overdueDays: 3,
    };

    const mounted = mountComponent({ habit, dayState, periodState, currentDate: '2026-05-18' });

    await nextTick();

    expect(mounted.container.textContent).toContain('艾宾浩斯');
    expect(mounted.container.textContent).toContain('已逾期 3 天');

    mounted.unmount();
  });

  it('right-clicking a completed binary action opens reset menu and confirms on click', async () => {
    const habit: Habit = {
      name: '晨间拉伸',
      type: 'binary',
      records: [],
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
    };
    const dayState: HabitDayState = {
      date: '2026-04-12',
      hasRecord: true,
      isCompleted: true,
    };
    const periodState: HabitPeriodState = {
      periodType: 'day',
      periodStart: '2026-04-12',
      periodEnd: '2026-04-12',
      requiredCount: 1,
      completedCount: 1,
      remainingCount: 0,
      isCompleted: true,
      eligibleToday: true,
    };
    const emits = {
      checkIn: vi.fn(),
      resetRecord: vi.fn(),
      openDetail: vi.fn(),
    };

    const mounted = mountComponent({ habit, dayState, periodState, currentDate: '2026-04-12' }, emits);
    await nextTick();

    const target = mounted.container.querySelector('[data-testid="habit-list-item-check-in"]') as HTMLButtonElement | null;
    expect(target).not.toBeNull();

    target?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await nextTick();

    expect(emits.resetRecord).not.toHaveBeenCalled();
    expect(emits.checkIn).not.toHaveBeenCalled();
    expect(emits.openDetail).not.toHaveBeenCalled();

    const menuItem = mounted.container.querySelector('[data-testid="habit-list-item-reset-menu-item"]') as HTMLButtonElement | null;
    expect(menuItem).not.toBeNull();

    menuItem?.click();

    expect(emits.resetRecord).toHaveBeenCalledTimes(1);
    expect(emits.resetRecord).toHaveBeenCalledWith(habit, '2026-04-12');

    mounted.unmount();
  });

  it('right-clicking an eligible pending binary action opens mark-missed menu and confirms on click', async () => {
    const habit: Habit = {
      name: '晨间拉伸',
      type: 'binary',
      records: [],
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
    };
    const dayState: HabitDayState = {
      date: '2026-04-12',
      hasRecord: false,
      isCompleted: false,
      isMissed: false,
    };
    const periodState: HabitPeriodState = {
      periodType: 'day',
      periodStart: '2026-04-12',
      periodEnd: '2026-04-12',
      requiredCount: 1,
      completedCount: 0,
      remainingCount: 1,
      isCompleted: false,
      eligibleToday: true,
    };
    const emits = {
      checkIn: vi.fn(),
      markMissed: vi.fn(),
      resetRecord: vi.fn(),
      openDetail: vi.fn(),
    };

    const mounted = mountComponent({ habit, dayState, periodState, currentDate: '2026-04-12' }, emits);
    await nextTick();

    const target = mounted.container.querySelector('[data-testid="habit-list-item-check-in"]') as HTMLButtonElement | null;
    expect(target).not.toBeNull();

    target?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await nextTick();

    expect(emits.markMissed).not.toHaveBeenCalled();
    expect(emits.resetRecord).not.toHaveBeenCalled();

    const menuItem = mounted.container.querySelector('[data-testid="habit-list-item-mark-missed-menu-item"]') as HTMLButtonElement | null;
    expect(menuItem).not.toBeNull();

    menuItem?.click();

    expect(emits.markMissed).toHaveBeenCalledTimes(1);
    expect(emits.markMissed).toHaveBeenCalledWith(habit, '2026-04-12');
    expect(emits.resetRecord).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('renders missed binary action as an x marker', async () => {
    const habit: Habit = {
      name: '晨间拉伸',
      type: 'binary',
      records: [],
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
    };
    const dayState: HabitDayState = {
      date: '2026-04-12',
      hasRecord: true,
      isCompleted: false,
      isMissed: true,
    };
    const periodState: HabitPeriodState = {
      periodType: 'day',
      periodStart: '2026-04-12',
      periodEnd: '2026-04-12',
      requiredCount: 1,
      completedCount: 0,
      remainingCount: 1,
      isCompleted: false,
      eligibleToday: true,
    };

    const mounted = mountComponent({ habit, dayState, periodState, currentDate: '2026-04-12' });
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-action-missed"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-action-empty"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-action-check"]')).toBeNull();

    mounted.unmount();
  });

  it('clicking a missed binary action emits reset-record only', async () => {
    const habit: Habit = {
      name: '晨间拉伸',
      type: 'binary',
      records: [],
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
    };
    const dayState: HabitDayState = {
      date: '2026-04-12',
      hasRecord: true,
      isCompleted: false,
      isMissed: true,
    };
    const periodState: HabitPeriodState = {
      periodType: 'day',
      periodStart: '2026-04-12',
      periodEnd: '2026-04-12',
      requiredCount: 1,
      completedCount: 0,
      remainingCount: 1,
      isCompleted: false,
      eligibleToday: true,
    };
    const emits = {
      checkIn: vi.fn(),
      resetRecord: vi.fn(),
      openDetail: vi.fn(),
    };

    const mounted = mountComponent({ habit, dayState, periodState, currentDate: '2026-04-12' }, emits);
    await nextTick();

    const target = mounted.container.querySelector('[data-testid="habit-list-item-check-in"]') as HTMLButtonElement | null;
    expect(target).not.toBeNull();

    target?.click();

    expect(emits.resetRecord).toHaveBeenCalledTimes(1);
    expect(emits.resetRecord).toHaveBeenCalledWith(habit, '2026-04-12');
    expect(emits.checkIn).not.toHaveBeenCalled();
    expect(emits.openDetail).not.toHaveBeenCalled();

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
    expect(emits.checkIn).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('clicking increment action on mobile does not emit open-detail', async () => {
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
      openDetail: vi.fn(),
      checkIn: vi.fn(),
      increment: vi.fn(),
    };

    const mounted = mountComponent({ habit, dayState, periodState, isMobile: true }, emits);

    await nextTick();

    const target = mounted.container.querySelector('[data-testid="habit-list-item-increment"]') as HTMLButtonElement | null;
    expect(target).not.toBeNull();

    target?.click();

    expect(emits.increment).toHaveBeenCalledTimes(1);
    expect(emits.increment).toHaveBeenCalledWith(habit);
    expect(emits.openDetail).not.toHaveBeenCalled();
    expect(emits.openDoc).not.toHaveBeenCalled();

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
    expect(emits.increment).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('clicking binary check-in on mobile does not emit open-detail', async () => {
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
      openDetail: vi.fn(),
      checkIn: vi.fn(),
      increment: vi.fn(),
    };

    const mounted = mountComponent({ habit, dayState, periodState, isMobile: true }, emits);

    await nextTick();

    const target = mounted.container.querySelector('[data-testid="habit-list-item-check-in"]') as HTMLButtonElement | null;
    expect(target).not.toBeNull();

    target?.click();

    expect(emits.checkIn).toHaveBeenCalledTimes(1);
    expect(emits.checkIn).toHaveBeenCalledWith(habit);
    expect(emits.openDetail).not.toHaveBeenCalled();
    expect(emits.openDoc).not.toHaveBeenCalled();

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

    const button = mounted.container.querySelector('[data-testid="habit-list-item-check-in"]') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(false);
    expect(button?.querySelector('[data-testid="habit-action-empty"]')).not.toBeNull();

    mounted.unmount();
  });

  it('every_n_days interval completed state does not render weekly completed copy', async () => {
    const habit: Habit = {
      name: '跑步',
      type: 'count',
      records: [],
      blockId: 'habit-interval-1',
      docId: 'doc-1',
      startDate: '2026-05-04',
      target: 3,
      unit: '公里',
      frequency: { type: 'every_n_days', interval: 2 },
    };
    const dayState: HabitDayState = {
      date: '2026-05-04',
      hasRecord: true,
      isCompleted: true,
      currentValue: 3,
      targetValue: 3,
    };
    const periodState: HabitPeriodState = {
      periodType: 'interval',
      periodStart: '2026-05-04',
      periodEnd: '2026-05-05',
      requiredCount: 1,
      completedCount: 1,
      remainingCount: 0,
      isCompleted: true,
      eligibleToday: true,
    };

    const mounted = mountComponent({ habit, dayState, periodState });

    await nextTick();

    expect(mounted.container.textContent).not.toContain('本周已达标');

    mounted.unmount();
  });

  it('binary historical completed state shows selected-day status copy', async () => {
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
    expect(text).toContain('当日已打卡');
    expect(mounted.container.querySelector('[data-testid="habit-action-check"]')).not.toBeNull();

    mounted.unmount();
  });

  it('binary pending state does not render unchecked helper copy', async () => {
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
      hasRecord: false,
      isCompleted: false,
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

    const mounted = mountComponent({ habit, dayState, periodState });

    await nextTick();

    const text = mounted.container.textContent || '';
    expect(text).not.toContain('未打卡');
    expect(mounted.container.querySelector('[data-testid="habit-action-empty"]')).not.toBeNull();

    mounted.unmount();
  });

  it('count historical completed state keeps progress and shows selected-day status copy', async () => {
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
      hasRecord: true,
      isCompleted: true,
      currentValue: 8,
      targetValue: 8,
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
    expect(text).toContain('当日已打卡');
    expect(text).toContain('8/8杯');
    expect(mounted.container.querySelector('[data-testid="habit-action-check"]')).not.toBeNull();

    mounted.unmount();
  });

  it('completed habit uses icon-only action button without emoji text', async () => {
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
    const stats: HabitStats = {
      habitId: habit.blockId,
      totalCheckins: 1,
      monthlyCheckins: 1,
      completionRate: 1,
      weeklyCompletionRate: 1,
      monthlyCompletionRate: 1,
      currentStreak: 3,
      longestStreak: 3,
      isEnded: false,
    };

    const mounted = mountComponent({ habit, dayState, periodState, stats });

    await nextTick();

    const text = mounted.container.textContent || '';
    expect(text).toContain('连续3天');
    expect(text).not.toContain('🔥');
    expect(text).not.toContain('✅');

    const button = mounted.container.querySelector('[data-testid="habit-list-item-check-in"]') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.textContent?.trim()).toBe('✓');
    expect(button?.querySelector('[data-testid="habit-action-check"]')).not.toBeNull();

    mounted.unmount();
  });

  it('count pending state renders a progress ring action with current ratio', async () => {
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
      hasRecord: true,
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

    const mounted = mountComponent({ habit, dayState, periodState });

    await nextTick();

    const button = mounted.container.querySelector('[data-testid="habit-list-item-increment"]') as HTMLButtonElement | null;
    const ring = mounted.container.querySelector('[data-testid="habit-action-progress-ring"]') as SVGElement | null;

    expect(button).not.toBeNull();
    expect(button?.textContent?.trim()).toBe('');
    expect(ring).not.toBeNull();
    expect(ring?.getAttribute('data-progress')).toBe('0.375');

    mounted.unmount();
  });

  it('right-clicking a partial count action opens reset menu and confirms on click', async () => {
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
      date: '2026-04-12',
      hasRecord: true,
      isCompleted: false,
      isMissed: false,
      currentValue: 3,
      targetValue: 8,
    };
    const periodState: HabitPeriodState = {
      periodType: 'day',
      periodStart: '2026-04-12',
      periodEnd: '2026-04-12',
      requiredCount: 1,
      completedCount: 0,
      remainingCount: 1,
      isCompleted: false,
      eligibleToday: true,
    };
    const emits = {
      increment: vi.fn(),
      markMissed: vi.fn(),
      resetRecord: vi.fn(),
    };

    const mounted = mountComponent({ habit, dayState, periodState, currentDate: '2026-04-12' }, emits);
    await nextTick();

    const target = mounted.container.querySelector('[data-testid="habit-list-item-increment"]') as HTMLButtonElement | null;
    expect(target).not.toBeNull();

    target?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="habit-list-item-reset-menu-item"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="habit-list-item-mark-missed-menu-item"]')).toBeNull();

    const menuItem = mounted.container.querySelector('[data-testid="habit-list-item-reset-menu-item"]') as HTMLButtonElement | null;
    menuItem?.click();

    expect(emits.resetRecord).toHaveBeenCalledTimes(1);
    expect(emits.resetRecord).toHaveBeenCalledWith(habit, '2026-04-12');
    expect(emits.markMissed).not.toHaveBeenCalled();
    expect(emits.increment).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('renders frequency and due-state helper text at the bottom-left', async () => {
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

    const mounted = mountComponent({ habit, dayState, periodState, currentDate: '2026-04-12' });
    await nextTick();

    const meta = mounted.container.querySelector('[data-testid="habit-list-item-meta"]') as HTMLDivElement | null;
    const status = mounted.container.querySelector('[data-testid="habit-list-item-meta-status"]') as HTMLSpanElement | null;
    expect(meta).not.toBeNull();
    expect(meta?.textContent).toContain('每天');
    expect(meta?.textContent).toContain('今天该打卡了');
    expect(status?.classList.contains('habit-list-item__meta-status--today')).toBe(true);
    expect(status?.getAttribute('data-marker')).toBe('dot');

    mounted.unmount();
  });

  it('icon action buttons expose tooltip classes for hover hints', async () => {
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

    const mounted = mountComponent({
      habit,
      currentDate: '2026-04-12',
      dayState: {
        date: '2026-04-12',
        hasRecord: false,
        isCompleted: false,
      },
      periodState: {
        periodType: 'day',
        periodStart: '2026-04-12',
        periodEnd: '2026-04-12',
        requiredCount: 1,
        completedCount: 0,
        remainingCount: 1,
        isCompleted: false,
        eligibleToday: true,
      },
    });
    await nextTick();

    const openDoc = mounted.container.querySelector('[data-testid="habit-list-item-open-doc"]') as HTMLButtonElement | null;
    const increment = mounted.container.querySelector('[data-testid="habit-list-item-increment"]') as HTMLButtonElement | null;

    expect(openDoc?.classList.contains('b3-tooltips')).toBe(true);
    expect(increment?.classList.contains('b3-tooltips')).toBe(true);

    mounted.unmount();
  });

  it('uses stronger helper style when due today and softer text when today is not eligible', async () => {
    const habit: Habit = {
      name: '周报',
      type: 'binary',
      records: [],
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'weekly_days', daysOfWeek: [1, 3, 5] },
    };

    const dueMounted = mountComponent({
      habit,
      currentDate: '2026-04-12',
      dayState: {
        date: '2026-04-12',
        hasRecord: false,
        isCompleted: false,
      },
      periodState: {
        periodType: 'week',
        periodStart: '2026-04-07',
        periodEnd: '2026-04-13',
        requiredCount: 3,
        completedCount: 0,
        remainingCount: 3,
        isCompleted: false,
        eligibleToday: true,
      },
    });
    await nextTick();
    const dueMeta = dueMounted.container.querySelector('[data-testid="habit-list-item-meta"]') as HTMLDivElement | null;
    const dueStatus = dueMounted.container.querySelector('[data-testid="habit-list-item-meta-status"]') as HTMLSpanElement | null;
    expect(dueMeta?.classList.contains('habit-list-item__meta--due')).toBe(true);
    expect(dueStatus?.classList.contains('habit-list-item__meta-status--today')).toBe(true);
    expect(dueStatus?.getAttribute('data-marker')).toBe('dot');
    dueMounted.unmount();

    const notDueMounted = mountComponent({
      habit,
      currentDate: '2026-04-12',
      dayState: {
        date: '2026-04-12',
        hasRecord: false,
        isCompleted: false,
      },
      periodState: {
        periodType: 'week',
        periodStart: '2026-04-07',
        periodEnd: '2026-04-13',
        requiredCount: 3,
        completedCount: 0,
        remainingCount: 3,
        isCompleted: false,
        eligibleToday: false,
      },
    });
    await nextTick();
    const notDueMeta = notDueMounted.container.querySelector('[data-testid="habit-list-item-meta"]') as HTMLDivElement | null;
    const notDueStatus = notDueMounted.container.querySelector('[data-testid="habit-list-item-meta-status"]') as HTMLSpanElement | null;
    expect(notDueMeta?.classList.contains('habit-list-item__meta--due')).toBe(false);
    expect(notDueMeta?.textContent).toContain('今天无需打卡');
    expect(notDueStatus?.classList.contains('habit-list-item__meta-status--today')).toBe(true);
    expect(notDueStatus?.getAttribute('data-marker')).toBe('dot');
    notDueMounted.unmount();
  });

  it('uses selected-day status copy when viewing a historical completed date', async () => {
    const habit: Habit = {
      name: '早起',
      type: 'binary',
      records: [{
        content: '早起',
        date: '2026-04-10',
        habitId: 'habit-1',
        blockId: 'record-1',
      }],
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
    };

    const mounted = mountComponent({
      habit,
      currentDate: '2026-04-10',
      dayState: {
        date: '2026-04-10',
        hasRecord: true,
        isCompleted: true,
      },
      periodState: {
        periodType: 'day',
        periodStart: '2026-04-10',
        periodEnd: '2026-04-10',
        requiredCount: 1,
        completedCount: 1,
        remainingCount: 0,
        isCompleted: true,
        eligibleToday: true,
      },
    });
    await nextTick();

    const meta = mounted.container.querySelector('[data-testid="habit-list-item-meta"]') as HTMLDivElement | null;
    expect(meta?.textContent).toContain('每天');
    expect(meta?.textContent).toContain('当日已打卡');
    expect(meta?.classList.contains('habit-list-item__meta--selected-day')).toBe(true);
    const status = mounted.container.querySelector('[data-testid="habit-list-item-meta-status"]') as HTMLSpanElement | null;
    expect(status?.classList.contains('habit-list-item__meta-status--selected-day')).toBe(true);
    expect(status?.classList.contains('habit-list-item__meta-status--completed')).toBe(true);
    expect(status?.getAttribute('data-marker')).toBe('check');
    expect(meta?.textContent).not.toContain('今天该打卡了');
    expect(meta?.textContent).not.toContain('明天再打卡');
    expect(meta?.textContent).not.toContain('下次');

    mounted.unmount();
  });

  it('binary items reserve the same helper-text baseline row as count items', async () => {
    const habit: Habit = {
      name: '早起',
      type: 'binary',
      records: [],
      blockId: 'habit-1',
      docId: 'doc-1',
      startDate: '2026-04-01',
      frequency: { type: 'daily' },
    };

    const mounted = mountComponent({
      habit,
      currentDate: '2026-04-12',
      dayState: {
        date: '2026-04-12',
        hasRecord: false,
        isCompleted: false,
      },
      periodState: {
        periodType: 'day',
        periodStart: '2026-04-12',
        periodEnd: '2026-04-12',
        requiredCount: 1,
        completedCount: 0,
        remainingCount: 1,
        isCompleted: false,
        eligibleToday: true,
      },
    });
    await nextTick();

    const placeholder = mounted.container.querySelector('.habit-list-item__progress--placeholder') as HTMLDivElement | null;
    const meta = mounted.container.querySelector('[data-testid="habit-list-item-meta"]') as HTMLDivElement | null;

    expect(placeholder).not.toBeNull();
    expect(meta).not.toBeNull();
    expect(meta?.previousElementSibling).toBe(placeholder);

    mounted.unmount();
  });
});
