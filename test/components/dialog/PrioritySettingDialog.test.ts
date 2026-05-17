// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { createApp, nextTick } from 'vue';
import PrioritySettingDialog from '@/components/dialog/PrioritySettingDialog.vue';
import { setSharedPinia } from '@/utils/sharedPinia';

function mountDialog(props: Record<string, any> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  let confirmedPriority: string | undefined | null = null;
  let cancelCount = 0;
  const app = createApp(PrioritySettingDialog, {
    ...props,
    onConfirm: (priority: string | undefined) => {
      confirmedPriority = priority;
    },
    onCancel: () => {
      cancelCount += 1;
    },
  });

  app.mount(container);

  return {
    container,
    getConfirmedPriority: () => confirmedPriority,
    getCancelCount: () => cancelCount,
    unmount: () => {
      app.unmount();
      container.remove();
    },
  };
}

function getOptionButtons(container: Element): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('.priority-option')) as HTMLButtonElement[];
}

afterEach(() => {
  document.body.innerHTML = '';
  setSharedPinia(null);
});

describe('PrioritySettingDialog', () => {
  it('初始高亮应跟随 initialPriority', async () => {
    const mounted = mountDialog({ initialPriority: 'medium' });
    await nextTick();

    const options = getOptionButtons(mounted.container);
    expect(options[1]?.classList.contains('active')).toBe(true);
    expect(options[0]?.classList.contains('active')).toBe(false);

    mounted.unmount();
  });

  it('无初始优先级时默认高亮清除优先级', async () => {
    const mounted = mountDialog();
    await nextTick();

    const options = getOptionButtons(mounted.container);
    expect(options[3]?.classList.contains('active')).toBe(true);

    mounted.unmount();
  });

  it('ArrowDown 和 ArrowUp 应切换当前高亮项', async () => {
    const mounted = mountDialog({ initialPriority: 'high' });
    await nextTick();

    const root = mounted.container.querySelector('.priority-setting-dialog') as HTMLDivElement | null;
    expect(root).not.toBeNull();

    root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await nextTick();
    let options = getOptionButtons(mounted.container);
    expect(options[1]?.classList.contains('active')).toBe(true);

    root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await nextTick();
    options = getOptionButtons(mounted.container);
    expect(options[2]?.classList.contains('active')).toBe(true);

    root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await nextTick();
    options = getOptionButtons(mounted.container);
    expect(options[1]?.classList.contains('active')).toBe(true);

    mounted.unmount();
  });

  it('Enter 应确认当前高亮项', async () => {
    const mounted = mountDialog({ initialPriority: 'high' });
    await nextTick();

    const root = mounted.container.querySelector('.priority-setting-dialog') as HTMLDivElement | null;
    expect(root).not.toBeNull();

    root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await nextTick();
    root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await nextTick();

    expect(mounted.getConfirmedPriority()).toBe('medium');
    expect(mounted.getCancelCount()).toBe(0);

    mounted.unmount();
  });

  it('鼠标点击某项时仍可更新选择并确认', async () => {
    const mounted = mountDialog({ initialPriority: 'high' });
    await nextTick();

    const options = getOptionButtons(mounted.container);
    options[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    mounted.container.querySelector('.b3-button--text')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.getConfirmedPriority()).toBe('low');

    mounted.unmount();
  });
});
