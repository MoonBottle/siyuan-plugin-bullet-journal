// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp, nextTick } from 'vue';
import MobileFilterBar from '@/mobile/components/todo/MobileFilterBar.vue';

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'todo')
      return { searchPlaceholder: '搜索事项...' };
    return key;
  }),
}));

function mountFilterBar() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(MobileFilterBar, {
    search: '',
    hasActiveFilters: false,
  });
  app.mount(container);

  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('MobileFilterBar', () => {
  it('leaves outer horizontal gutter to the parent shell', async () => {
    const mounted = mountFilterBar();
    await nextTick();

    const filterBar = mounted.container.querySelector('.mobile-filter-bar');
    expect(filterBar).not.toBeNull();
    const source = readFileSync(
      resolve(process.cwd(), 'src/mobile/components/todo/MobileFilterBar.vue'),
      'utf-8',
    );
    expect(source).toContain('padding: 10px 0');
    expect(source).toContain('background: var(--b3-theme-background)');

    mounted.unmount();
  });
});
