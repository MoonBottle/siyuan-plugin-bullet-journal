// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import DesktopTodoDock from '@/tabs/DesktopTodoDock.vue';
import { useProjectStore, useSettingsStore } from '@/stores';
import { Menu } from 'siyuan';
import type { Item, Project, Task } from '@/types/models';

const menuAddItem = vi.fn();
const menuAddSeparator = vi.fn();
const menuOpen = vi.fn();
const todoFilterBarProps = vi.fn();
const todoContentPaneProps = vi.fn();
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

vi.mock('@/components/todo/TodoFilterBar.vue', () => ({
  default: defineComponent({
    name: 'TodoFilterBarStub',
    props: [
      'tagQuery',
      'selectedTags',
      'tagOptions',
      'searchQuery',
      'selectedGroup',
      'dateFilterType',
      'selectedPriorities',
      'startDate',
      'endDate',
      'showSortPanel',
      'sortRules',
      'groupOptions',
      'dateFilterOptions',
      'priorityOptions',
      'sortDirectionOptions',
      'availableFieldOptions',
    ],
    emits: ['update:tagQuery', 'update:selectedTags'],
    setup(props, { emit }) {
      return () => {
        todoFilterBarProps({
          tagQuery: (props as any).tagQuery,
          selectedTags: (props as any).selectedTags,
          tagOptions: (props as any).tagOptions,
        });

        return h('div', { 'data-testid': 'todo-filter-bar-stub' }, [
          h('button', {
            'data-testid': 'todo-filter-bar-emit-tag-query',
            onClick: () => emit('update:tagQuery', 'alp'),
          }),
          h('button', {
            'data-testid': 'todo-filter-bar-emit-selected-tags',
            onClick: () => emit('update:selectedTags', ['Alpha', 'Beta']),
          }),
        ]);
      };
    },
  }),
}));

vi.mock('@/components/todo/TodoContentPane.vue', () => ({
  default: defineComponent({
    name: 'TodoContentPaneStub',
    props: ['selectedTags', 'previewTriggerMode', 'onItemPreviewClick'],
    emits: ['add-tag-filter'],
    setup(props, { expose, emit }) {
      const root = document.createElement('div');
      expose({
        allCollapsed: false,
        toggleCollapseAll: vi.fn(),
        getScrollElement: () => root,
      });
      return () => {
        todoContentPaneProps({
          selectedTags: (props as any).selectedTags,
          previewTriggerMode: (props as any).previewTriggerMode,
          onItemPreviewClick: (props as any).onItemPreviewClick,
        });
        return h('div', { 'data-testid': 'todo-content-pane-stub' }, [
          h('button', {
            'data-testid': 'todo-content-pane-emit-add-tag-filter',
            onClick: () => emit('add-tag-filter', 'Alpha'),
          }),
        ]);
      };
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
    settingsStore,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

const mkItem = (
  date: string,
  blockId: string,
  overrides?: Partial<Item>,
): Item => ({
  id: `item-${blockId}`,
  content: '测试事项',
  date,
  lineNumber: 1,
  docId: 'doc1',
  blockId,
  status: 'pending',
  dateRangeStart: undefined,
  dateRangeEnd: undefined,
  ...overrides,
}) as Item;

function createMockProject(items: Item[]): Project {
  const task: Task = {
    id: 'task-1',
    name: '测试任务',
    level: 'L1',
    items,
    lineNumber: 1,
  };

  return {
    id: 'proj-1',
    name: '测试项目',
    path: '/test',
    tasks: [task],
    habits: [],
  };
}

async function mountRealTodoFilterBar(initialSelectedTags: string[], tagOptions: Array<{ name: string; count: number }>) {
  const pinia = createPinia();
  setActivePinia(pinia);

  const TodoFilterBar = (await vi.importActual<typeof import('@/components/todo/TodoFilterBar.vue')>('@/components/todo/TodoFilterBar.vue')).default;
  const selectedTagsState = ref<string[]>([...initialSelectedTags]);

  const Root = defineComponent({
    components: { TodoFilterBar },
    setup() {
      return {
        selectedTagsState,
        tagOptions,
      };
    },
    template: `
      <TodoFilterBar
        selected-group=""
        search-query=""
        tag-query=""
        :selected-tags="selectedTagsState"
        date-filter-type="today"
        :selected-priorities="[]"
        start-date="2026-05-01"
        end-date="2026-05-08"
        :show-sort-panel="false"
        :sort-rules="[{ field: 'priority', direction: 'asc' }]"
        :group-options="[]"
        :tag-options="tagOptions"
        :date-filter-options="[]"
        :priority-options="[]"
        :sort-direction-options="[]"
        :available-field-options="() => []"
        @update:selected-tags="selectedTagsState = $event"
      />
    `,
  });

  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(Root);
  app.use(pinia);
  app.mount(container);

  await nextTick();

  return {
    container,
    selectedTagsState,
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

    expect(todoContentPaneProps).toHaveBeenCalledWith(expect.objectContaining({
      previewTriggerMode: 'hover',
      onItemPreviewClick: undefined,
    }));
    expect(nativePreviewOpen).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('passes aggregated tag options into the filter bar', async () => {
    const mounted = mountDock();
    mounted.projectStore.$patch({
      currentDate: '2026-05-01',
      projects: [createMockProject([
        mkItem('2026-05-01', 'item-a', { tags: ['Alpha'] }),
        mkItem('2026-05-01', 'item-b', { tags: ['alpha', 'Beta'] }),
      ])],
    });

    await nextTick();

    expect(todoFilterBarProps).toHaveBeenLastCalledWith(expect.objectContaining({
      tagQuery: '',
      selectedTags: [],
      tagOptions: [
        { name: 'Alpha', count: 2 },
        { name: 'Beta', count: 1 },
      ],
    }));

    mounted.unmount();
  });

  it('updates tag query and selected tags from filter bar and passes selected tags to content pane', async () => {
    const mounted = mountDock();
    await nextTick();

    (mounted.container.querySelector('[data-testid="todo-filter-bar-emit-tag-query"]') as HTMLElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    (mounted.container.querySelector('[data-testid="todo-filter-bar-emit-selected-tags"]') as HTMLElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(todoFilterBarProps).toHaveBeenLastCalledWith(expect.objectContaining({
      tagQuery: 'alp',
      selectedTags: ['Alpha', 'Beta'],
    }));
    expect(todoContentPaneProps).toHaveBeenLastCalledWith(expect.objectContaining({
      selectedTags: ['Alpha', 'Beta'],
    }));

    mounted.unmount();
  });

  it('adds sidebar tag clicks into selected tags with normalized deduplication', async () => {
    const mounted = mountDock();
    await nextTick();

    (mounted.container.querySelector('[data-testid="todo-filter-bar-emit-selected-tags"]') as HTMLElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    (mounted.container.querySelector('[data-testid="todo-content-pane-emit-add-tag-filter"]') as HTMLElement)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(todoFilterBarProps).toHaveBeenLastCalledWith(expect.objectContaining({
      selectedTags: ['Beta', 'Alpha'],
    }));
    expect(todoContentPaneProps).toHaveBeenLastCalledWith(expect.objectContaining({
      selectedTags: ['Beta', 'Alpha'],
    }));

    mounted.unmount();
  });

  it('treats selected tags case-insensitively in the filter bar toggle flow', async () => {
    const mounted = await mountRealTodoFilterBar(
      ['alpha'],
      [{ name: 'Alpha', count: 2 }],
    );

    const optionChip = mounted.container.querySelector('.tag-options .tag-chip') as HTMLElement | null;
    expect(optionChip?.className).toContain('tag-chip--active');

    optionChip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(mounted.selectedTagsState.value).toEqual([]);

    mounted.unmount();
  });

  it('deduplicates selected tag chips by normalized tag value', async () => {
    const mounted = await mountRealTodoFilterBar(
      ['Alpha', 'alpha'],
      [{ name: 'Alpha', count: 2 }],
    );

    const selectedChips = mounted.container.querySelectorAll('.selected-tag-chips .tag-chip');
    expect(selectedChips).toHaveLength(1);
    expect(selectedChips[0]?.textContent).toContain('#Alpha');

    mounted.unmount();
  });
});
