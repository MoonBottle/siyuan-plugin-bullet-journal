// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { createApp, nextTick } from 'vue';
import HabitWeekBar from '@/components/habit/HabitWeekBar.vue';

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
});
