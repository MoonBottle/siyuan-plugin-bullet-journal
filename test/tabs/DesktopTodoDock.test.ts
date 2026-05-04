// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import DesktopTodoDock from '@/tabs/DesktopTodoDock.vue';
import { useProjectStore, useSettingsStore } from '@/stores';
import { Menu } from 'siyuan';

const menuAddItem = vi.fn();
const menuAddSeparator = vi.fn();
const menuOpen = vi.fn();
const todoSidebarProps = vi.fn();
const nativePreviewOpen = vi.fn();
const nativePreviewClose = vi.fn();
const nativePreviewContainsTarget = vi.fn(() => false);

vi.mock('siyuan', () => ({
  Menu: vi.fn(function () {
    return {
    addItem: menuAddItem,
    addSeparator: menuAddSeparator,
    open: menuOpen,
    };
  }),
}));

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({})),
  getCurrentPlugin: vi.fn(() => ({})),
  useApp: vi.fn(() => ({})),
}));

vi.mock('@/utils/eventBus', () => ({
  eventBus: { on: vi.fn(() => () => {}), emit: vi.fn() },
  Events: { DATA_REFRESH: 'data:refresh' },
  DATA_REFRESH_CHANNEL: 'task-assistant-refresh',
}));

vi.mock('@/utils/refreshChannelGuard', () => ({
  createRefreshChannelGuard: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock('@/utils/dialog', () => ({
  showMessage: vi.fn(),
}));

vi.mock('@/utils/nativeBlockPreview', () => ({
  createNativeBlockPreviewController: () => ({
    open: nativePreviewOpen,
    close: nativePreviewClose,
    containsTarget: nativePreviewContainsTarget,
    isOpen: vi.fn(() => false),
  }),
}));

vi.mock('@/components/todo/TodoSidebar.vue', () => ({
  default: defineComponent({
    name: 'TodoSidebarStub',
    props: ['previewTriggerMode', 'onItemPreviewClick'],
    setup(_, { expose }) {
      todoSidebarProps({
        previewTriggerMode: (_ as any).previewTriggerMode,
        onItemPreviewClick: (_ as any).onItemPreviewClick,
      });
      expose({
        allCollapsed: false,
        toggleCollapseAll: vi.fn(),
      });
      return () => h('div', { 'data-testid': 'todo-sidebar-stub' });
    },
  }),
}));

vi.mock('@/components/SiyuanTheme/SySelect.vue', () => ({
  default: defineComponent({
    name: 'SySelectStub',
    props: ['modelValue'],
    emits: ['update:modelValue', 'change'],
    setup() {
      return () => h('div');
    },
  }),
}));

function mountDock(props?: Record<string, unknown>) {
  const pinia = createPinia();
  setActivePinia(pinia);

  const projectStore = useProjectStore(pinia);
  const settingsStore = useSettingsStore(pinia);

  projectStore.refresh = vi.fn().mockResolvedValue(undefined) as any;
  settingsStore.groups = [];
  settingsStore.todoDock.selectedGroup = '';
  settingsStore.todoDock.sortRules = [{ field: 'priority', direction: 'asc' }] as any;
  settingsStore.saveToPlugin = vi.fn();
  settingsStore.loadFromPlugin = vi.fn();

  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(DesktopTodoDock, props);
  app.use(pinia);
  app.mount(container);

  return {
    container,
    projectStore,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('DesktopTodoDock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    (globalThis as any).BroadcastChannel = vi.fn(() => ({ close: vi.fn() }));
  });

  it('renders a top-level refresh button before the more button', async () => {
    const mounted = mountDock();
    await nextTick();

    const refresh = mounted.container.querySelector('[data-testid="todo-dock-refresh-button"]');
    const more = mounted.container.querySelector('[data-testid="todo-dock-more-button"]');

    expect(refresh).not.toBeNull();
    expect(more).not.toBeNull();
    expect(refresh?.compareDocumentPosition(more as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    mounted.unmount();
  });

  it('more menu no longer includes refresh action', async () => {
    const mounted = mountDock();
    await nextTick();

    (mounted.container.querySelector('[data-testid="todo-dock-more-button"]') as HTMLElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const labels = menuAddItem.mock.calls.map(call => call[0]?.label);
    expect(labels).not.toContain('刷新');
    expect(Menu).toHaveBeenCalled();

    mounted.unmount();
  });

  it('clicking the top-level refresh button calls projectStore.refresh', async () => {
    const mounted = mountDock();
    await nextTick();

    (mounted.container.querySelector('[data-testid="todo-dock-refresh-button"]') as HTMLElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.projectStore.refresh).toHaveBeenCalled();

    mounted.unmount();
  });

  it('keeps default dock item click behavior instead of enabling workbench preview mode', async () => {
    const mounted = mountDock();
    await nextTick();

    expect(todoSidebarProps).toHaveBeenCalledWith(expect.objectContaining({
      previewTriggerMode: 'hover',
      onItemPreviewClick: undefined,
    }));
    expect(nativePreviewOpen).not.toHaveBeenCalled();

    mounted.unmount();
  });
});
