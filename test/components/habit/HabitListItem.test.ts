// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { createApp, nextTick } from 'vue';
import HabitListItem from '@/components/habit/HabitListItem.vue';
import type { Habit, HabitDayState, HabitPeriodState, HabitStats } from '@/types/models';

function mountComponent(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(HabitListItem, props);
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

    const button = mounted.container.querySelector('.habit-check-btn') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(false);

    mounted.unmount();
  });
});
