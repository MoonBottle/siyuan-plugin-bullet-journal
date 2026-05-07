// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from 'vue';
import MobileConfirmDrawer from '@/mobile/drawers/confirm/MobileConfirmDrawer.vue';

function mountConfirmDrawer(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(MobileConfirmDrawer, props);
  app.mount(container);

  return {
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('MobileConfirmDrawer', () => {
  it('marks the overlay as a Siyuan dialog container and constrains touch scrolling', () => {
    const mounted = mountConfirmDrawer({
      modelValue: true,
      title: '确认删除',
      message: '确定要删除吗？',
    });

    const overlay = document.body.querySelector('.confirm-overlay');
    const dialog = document.body.querySelector('.confirm-dialog') as HTMLElement | null;

    expect(overlay?.classList.contains('b3-dialog')).toBe(true);
    expect(dialog).not.toBeNull();
    expect(dialog?.style.touchAction).toBe('pan-y');
    expect(dialog?.style.overscrollBehavior).toBe('contain');

    mounted.unmount();
  });
});
