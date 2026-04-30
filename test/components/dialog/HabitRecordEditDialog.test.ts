// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import { createApp, nextTick } from 'vue';
import HabitRecordEditDialog from '@/components/dialog/HabitRecordEditDialog.vue';
import { showHabitRecordEditDialog } from '@/utils/dialog';
import { setSharedPinia } from '@/utils/sharedPinia';

function mountDialog(props: Record<string, any> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  let savedMarkdown = '';
  const app = createApp(HabitRecordEditDialog, {
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

function getByTestId(container: Element, testId: string): HTMLInputElement | HTMLTextAreaElement {
  const element = container.querySelector(`[data-testid="${testId}"]`);
  expect(element).not.toBeNull();
  return element as HTMLInputElement | HTMLTextAreaElement;
}

async function setTextareaValue(element: Element | null, value: string) {
  expect(element).not.toBeNull();
  const input = element as HTMLTextAreaElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}

afterEach(() => {
  document.body.innerHTML = '';
  setSharedPinia(null);
});

beforeEach(() => {
  setSharedPinia(createPinia());
});

describe('HabitRecordEditDialog', () => {
  it('应预填原始 markdown', async () => {
    const mounted = mountDialog({
      initialMarkdown: '喝水 4/8杯 📅2026-04-10',
    });

    await nextTick();

    expect(getByTestId(mounted.container, 'habit-record-markdown-input').value).toBe('喝水 4/8杯 📅2026-04-10');

    mounted.unmount();
  });

  it('保存时应返回编辑后的 markdown', async () => {
    const mounted = mountDialog({
      initialMarkdown: '喝水 4/8杯 📅2026-04-10',
    });

    await setTextareaValue(
      getByTestId(mounted.container, 'habit-record-markdown-input'),
      '喝水 5/8杯 📅2026-04-10 ✅',
    );

    mounted.container.querySelector('.btn-save')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.getSavedMarkdown()).toBe('喝水 5/8杯 📅2026-04-10 ✅');

    mounted.unmount();
  });

  it('showHabitRecordEditDialog 打开后应把焦点交给编辑框', async () => {
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    let focusedElement: Element | null = null;
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement) {
      focusedElement = this;
    });

    const dialog = showHabitRecordEditDialog('喝水 4/8杯 📅2026-04-10', () => {});
    await nextTick();

    expect(focusedElement).toBe(dialog.element.querySelector('textarea'));

    dialog.destroy();
    focusSpy.mockRestore();
    rafSpy.mockRestore();
  });
});
