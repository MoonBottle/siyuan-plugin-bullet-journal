// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { createApp, nextTick } from 'vue';
import HabitWeekBar from '@/components/habit/HabitWeekBar.vue';
import type { Habit } from '@/types/models';

function mountWeekBar(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(HabitWeekBar, props);
  app.mount(container);

  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('HabitWeekBar', () => {
  it('shows the rolling 7-day window ending today instead of calendar week', async () => {
    const mounted = mountWeekBar({
      modelValue: '2026-05-01',
      currentDate: '2026-05-01',
    });

    await nextTick();

    const dayButtons = Array.from(mounted.container.querySelectorAll('.habit-week-bar__day'));
    const dateTexts = dayButtons.map(button => button.querySelector('.habit-week-bar__date')?.textContent?.trim());

    expect(dateTexts).toEqual(['25', '26', '27', '28', '29', '30', '1']);
    mounted.unmount();
  });

  it('renders a check marker when all eligible habits are completed for a day', async () => {
    const habits: Habit[] = [
      {
        name: '早起',
        docId: 'doc-1',
        blockId: 'habit-1',
        type: 'binary',
        startDate: '2026-04-01',
        frequency: { type: 'daily' },
        records: [{
          content: '早起',
          date: '2026-05-01',
          docId: 'doc-1',
          blockId: 'record-1',
          habitId: 'habit-1',
        }],
      },
      {
        name: '喝水',
        docId: 'doc-1',
        blockId: 'habit-2',
        type: 'count',
        startDate: '2026-04-01',
        target: 8,
        unit: '杯',
        frequency: { type: 'daily' },
        records: [{
          content: '喝水',
          date: '2026-05-01',
          docId: 'doc-1',
          blockId: 'record-2',
          habitId: 'habit-2',
          currentValue: 8,
          targetValue: 8,
          unit: '杯',
        }],
      },
    ];

    const mounted = mountWeekBar({
      modelValue: '2026-05-01',
      currentDate: '2026-05-01',
      habits,
    });

    await nextTick();

    const day = mounted.container.querySelector('[data-testid="habit-week-day-2026-05-01"]');
    expect(day?.querySelector('[data-testid="habit-week-check"]')).not.toBeNull();
    expect(day?.querySelector('[data-testid="habit-week-progress-ring"]')).toBeNull();

    mounted.unmount();
  });

  it('renders a progress ring when the day is only partially completed', async () => {
    const habits: Habit[] = [
      {
        name: '早起',
        docId: 'doc-1',
        blockId: 'habit-1',
        type: 'binary',
        startDate: '2026-04-01',
        frequency: { type: 'daily' },
        records: [{
          content: '早起',
          date: '2026-04-30',
          docId: 'doc-1',
          blockId: 'record-1',
          habitId: 'habit-1',
        }],
      },
      {
        name: '喝水',
        docId: 'doc-1',
        blockId: 'habit-2',
        type: 'count',
        startDate: '2026-04-01',
        target: 8,
        unit: '杯',
        frequency: { type: 'daily' },
        records: [{
          content: '喝水',
          date: '2026-04-30',
          docId: 'doc-1',
          blockId: 'record-2',
          habitId: 'habit-2',
          currentValue: 4,
          targetValue: 8,
          unit: '杯',
        }],
      },
    ];

    const mounted = mountWeekBar({
      modelValue: '2026-05-01',
      currentDate: '2026-05-01',
      habits,
    });

    await nextTick();

    const day = mounted.container.querySelector('[data-testid="habit-week-day-2026-04-30"]');
    const ring = day?.querySelector('[data-testid="habit-week-progress-ring"]') as SVGElement | null;
    expect(ring).not.toBeNull();
    expect(ring?.getAttribute('data-progress')).toBe('0.75');
    expect(day?.querySelector('[data-testid="habit-week-check"]')).toBeNull();

    mounted.unmount();
  });
});
