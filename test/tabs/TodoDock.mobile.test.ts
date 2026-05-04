// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import TodoDock from '@/tabs/TodoDock.vue';

vi.mock('@/mobile/MobileMainShell.vue', () => ({
  default: defineComponent({
    name: 'MobileMainShellStub',
    setup() {
      return () => h('div', { 'data-testid': 'mobile-main-shell-stub' }, 'mobile-main-shell');
    },
  }),
}));

vi.mock('@/mobile/MobileTodoDock.vue', () => ({
  default: defineComponent({
    name: 'MobileTodoDockStub',
    setup() {
      return () => h('div', { 'data-testid': 'mobile-todo-dock-stub' }, 'mobile-todo-dock');
    },
  }),
}));

vi.mock('@/tabs/DesktopTodoDock.vue', () => ({
  default: defineComponent({
    name: 'DesktopTodoDockStub',
    setup() {
      return () => h('div', { 'data-testid': 'desktop-todo-dock-stub' }, 'desktop-todo-dock');
    },
  }),
}));

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => undefined),
}));

function mountDock(plugin?: { isMobile?: boolean }) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(TodoDock, { plugin });
  app.mount(container);

  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('TodoDock mobile entry', () => {
  it('mounts MobileMainShell on mobile instead of the legacy MobileTodoDock wrapper', async () => {
    const mounted = mountDock({ isMobile: true });
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="mobile-main-shell-stub"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="mobile-todo-dock-stub"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="desktop-todo-dock-stub"]')).toBeNull();

    mounted.unmount();
  });

  it('keeps mounting DesktopTodoDock on desktop', async () => {
    const mounted = mountDock({ isMobile: false });
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="desktop-todo-dock-stub"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="mobile-main-shell-stub"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="mobile-todo-dock-stub"]')).toBeNull();

    mounted.unmount();
  });
});
