// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import { createApp, nextTick } from 'vue';
import HabitCreateDialog from '@/components/dialog/HabitCreateDialog.vue';
import { showHabitCreateDialog } from '@/utils/dialog';
import { setSharedPinia } from '@/utils/sharedPinia';

function mountDialog(props: Record<string, any> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  let savedMarkdown = '';
  const app = createApp(HabitCreateDialog, {
    ...props,
    onSave: (markdown: string) => {
      savedMarkdown = markdown;
    },
  });

  app.mount(container);

  return {
    container,
    getSavedMarkdown: () => savedMarkdown,
    unmount: () => {
      app.unmount();
      container.remove();
    },
  };
}

async function setInputValue(element: Element | null, value: string) {
  expect(element).not.toBeNull();
  const input = element as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}

function getByTestId(container: Element, testId: string): HTMLInputElement {
  const element = container.querySelector(`[data-testid="${testId}"]`);
  expect(element).not.toBeNull();
  return element as HTMLInputElement;
}

afterEach(() => {
  document.body.innerHTML = '';
  setSharedPinia(null);
});

beforeEach(() => {
  setSharedPinia(createPinia());
});

describe('HabitCreateDialog', () => {
  it('编辑模式应预填 reminder 和 frequency', async () => {
    const mounted = mountDialog({
      initialData: {
        name: '喝水',
        startDate: '2026-04-01',
        type: 'count',
        target: 8,
        unit: '杯',
        reminder: { type: 'absolute', time: '09:00' },
        frequency: { type: 'weekly' },
      },
    });

    await nextTick();

    expect(getByTestId(mounted.container, 'habit-name-input').value).toBe('喝水');
    expect(getByTestId(mounted.container, 'habit-start-date-input').value).toBe('2026-04-01');
    expect(getByTestId(mounted.container, 'habit-reminder-time-input').value).toBe('09:00');

    const weeklyButton = mounted.container.querySelector('[data-testid="habit-frequency-weekly-button"]');
    expect(weeklyButton?.classList.contains('active')).toBe(true);

    mounted.unmount();
  });

  it('保存时应生成包含 reminder 的 markdown', async () => {
    const mounted = mountDialog();

    const countTypeButton = mounted.container.querySelector('[data-testid="habit-type-count-button"]');
    countTypeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    await setInputValue(getByTestId(mounted.container, 'habit-name-input'), '喝水');
    await setInputValue(getByTestId(mounted.container, 'habit-start-date-input'), '2026-04-01');
    await setInputValue(getByTestId(mounted.container, 'habit-target-input'), '8');
    await setInputValue(getByTestId(mounted.container, 'habit-unit-input'), '杯');
    await setInputValue(getByTestId(mounted.container, 'habit-reminder-time-input'), '09:00');

    mounted.container.querySelector('.btn-save')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.getSavedMarkdown()).toBe('喝水 🎯2026-04-01 8杯 ⏰09:00 🔄每天');

    mounted.unmount();
  });

  it('count 模式缺少目标值时不应保存', async () => {
    const mounted = mountDialog();

    const countTypeButton = mounted.container.querySelector('[data-testid="habit-type-count-button"]');
    countTypeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    await setInputValue(getByTestId(mounted.container, 'habit-name-input'), '喝水');
    await setInputValue(getByTestId(mounted.container, 'habit-target-input'), '');
    mounted.container.querySelector('.btn-save')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.getSavedMarkdown()).toBe('');

    mounted.unmount();
  });

  it('weekly_days 未选择周几时不应保存', async () => {
    const mounted = mountDialog();

    await setInputValue(getByTestId(mounted.container, 'habit-name-input'), '拉伸');
    const weeklyDaysButton = mounted.container.querySelector('[data-testid="habit-frequency-weekly_days-button"]');
    weeklyDaysButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    mounted.container.querySelector('.btn-save')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.getSavedMarkdown()).toBe('');

    mounted.unmount();
  });

  it('showHabitCreateDialog 打开后应把焦点交给首个可交互元素', async () => {
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    let focusedElement: Element | null = null;
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement) {
      focusedElement = this;
    });

    const dialog = showHabitCreateDialog(() => {});
    await nextTick();

    expect(focusedElement).toBe(dialog.element.querySelector('input, button'));

    dialog.destroy();
    focusSpy.mockRestore();
    rafSpy.mockRestore();
  });
});
