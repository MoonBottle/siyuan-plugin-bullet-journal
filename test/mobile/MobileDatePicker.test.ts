// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from 'vue';
import MobileDatePicker from '@/mobile/components/pickers/MobileDatePicker.vue';

function mountDatePicker(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(MobileDatePicker, props);
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

describe('MobileDatePicker', () => {
  it('marks the overlay as a Siyuan dialog container and constrains sheet scrolling', () => {
    const mounted = mountDatePicker({
      modelValue: true,
      date: '2026-05-07',
    });

    const overlay = document.body.querySelector('.date-picker-overlay');
    const sheet = document.body.querySelector('.date-picker-sheet') as HTMLElement | null;
    const content = document.body.querySelector('.sheet-content') as HTMLElement | null;

    expect(overlay?.classList.contains('b3-dialog')).toBe(true);
    expect(sheet?.style.touchAction).toBe('pan-y');
    expect(sheet?.style.overscrollBehavior).toBe('contain');
    expect(content?.style.touchAction).toBe('pan-y');
    expect(content?.style.overscrollBehavior).toBe('contain');

    mounted.unmount();
  });
});
