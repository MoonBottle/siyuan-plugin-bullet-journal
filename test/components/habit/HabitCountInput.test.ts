// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import HabitCountInput from '@/components/habit/HabitCountInput.vue';

function mountComponent(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const onChange = vi.fn();
  const app = createApp(HabitCountInput, {
    ...props,
    onChange,
  });
  app.mount(container);

  return {
    container,
    onChange,
    unmount: () => {
      app.unmount();
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('HabitCountInput', () => {
  it('应支持直接输入具体值并提交', async () => {
    const mounted = mountComponent({
      currentValue: 3,
      target: 8,
    });

    const input = mounted.container.querySelector('[data-testid="habit-count-direct-input"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    input!.value = '5';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(mounted.onChange).toHaveBeenCalledWith(5);

    mounted.unmount();
  });

  it('非法输入时不应触发 change', async () => {
    const mounted = mountComponent({
      currentValue: 3,
      target: 8,
    });

    const input = mounted.container.querySelector('[data-testid="habit-count-direct-input"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    input!.value = '-1';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(mounted.onChange).not.toHaveBeenCalled();

    mounted.unmount();
  });
});
