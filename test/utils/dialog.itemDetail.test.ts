// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import { nextTick } from 'vue';
import { initI18n } from '@/i18n';
import { setSharedPinia } from '@/utils/sharedPinia';

vi.mock('siyuan', async () => {
  return await import('../__mocks__/siyuan');
});
vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => null),
}));

describe('showItemDetailModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    initI18n('en_US');
    setSharedPinia(createPinia());
  });

  afterEach(() => {
    document.body.innerHTML = '';
    setSharedPinia(null);
    vi.restoreAllMocks();
  });

  it('opens item detail with initial focus on the cancel button instead of reminder actions', async () => {
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    const { showItemDetailModal } = await import('@/utils/dialog');

    const dialog = showItemDetailModal({
      id: 'item-1',
      content: 'Review PR',
      date: '2026-05-01',
      status: 'pending',
      reminder: {
        enabled: true,
        type: 'absolute',
        time: '09:30',
      },
      links: [],
      pomodoros: [],
    } as any, { plugin: null });

    await nextTick();

    const cancelButton = Array.from(dialog.element.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'Cancel');

    expect(cancelButton).toBeTruthy();
    expect(document.activeElement).toBe(cancelButton);

    dialog.destroy();
    rafSpy.mockRestore();
  });
});
