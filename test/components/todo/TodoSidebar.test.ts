// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import TodoSidebar from '@/components/todo/TodoSidebar.vue';
import type { Item } from '@/types/models';

const pendingItem: Item = {
  id: 'item-1',
  content: '处理优先级',
  date: '2026-05-01',
  lineNumber: 1,
  docId: 'doc-1',
  blockId: 'block-1',
  status: 'pending',
  priority: 'high',
  project: { id: 'project-1', name: '项目A', tasks: [], links: [] },
};

const mockProjectStore = {
  currentDate: '2026-05-01',
  loading: false,
  hideCompleted: false,
  hideAbandoned: false,
  getDisplayItems: vi.fn(() => [pendingItem]),
  getFilteredAndSortedItems: vi.fn(() => [pendingItem]),
  getFilteredCompletedItems: vi.fn(() => []),
  getFilteredAbandonedItems: vi.fn(() => []),
};

const mockPomodoroStore = {
  isFocusing: false,
  activePomodoro: null,
  restorePomodoro: vi.fn(() => Promise.resolve(false)),
};

vi.mock('@/stores', () => ({
  useSettingsStore: () => ({}),
  useProjectStore: () => mockProjectStore,
  usePomodoroStore: () => mockPomodoroStore,
}));

vi.mock('@/main', () => ({
  usePlugin: () => null,
}));

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'todo') {
      return {
        loading: '加载中',
        expired: '已过期',
        today: '今天',
        tomorrow: '明天',
        future: '未来',
        completed: '已完成',
        abandoned: '已放弃',
        allDay: '全天',
        detail: '详情',
        calendar: '日历',
        complete: '完成',
        abandon: '放弃',
        startFocusAria: '开始专注',
        migrateToToday: '迁移到今天',
        migrateToTomorrow: '迁移到明天',
        emptyGuideTitle: '空',
        emptyGuideDesc: '空',
        createExampleDoc: '创建',
      };
    }
    if (key === 'common') {
      return {
        loading: '加载中',
      };
    }
    if (key === 'statusTag') {
      return {
        completed: '#done',
        abandoned: '#abandoned',
      };
    }
    if (key === 'pomodoro') {
      return {
        startFocusTitle: '开始专注',
      };
    }
    return {};
  }),
}));

vi.mock('@/components/SiyuanTheme/SyLoading.vue', () => ({
  default: {
    name: 'SyLoadingStub',
    template: '<div data-testid="todo-loading-stub"></div>',
  },
}));

vi.mock('@/components/todo/TodoItemMeta.vue', () => ({
  default: {
    name: 'TodoItemMetaStub',
    props: ['item'],
    template: '<div data-testid="todo-item-meta-stub"></div>',
  },
}));

vi.mock('@/components/pomodoro/PomodoroTimerDialog.vue', () => ({
  default: {
    name: 'PomodoroTimerDialogStub',
    template: '<div></div>',
  },
}));

vi.mock('@/utils/dateUtils', () => ({
  formatDateLabel: (date: string) => date,
  formatTimeRange: () => '',
}));

vi.mock('@/utils/dateRangeUtils', () => ({
  getDateRangeStatus: vi.fn(() => ''),
  getTimeRangeStatus: vi.fn(() => ''),
  dateRangeStatusToEmoji: vi.fn(() => ''),
  getEffectiveDate: (item: Item) => item.date,
}));

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
  updateBlockContent: vi.fn(),
  updateBlockDateTime: vi.fn(),
  updateBlockPriority: vi.fn(),
}));

vi.mock('@/utils/dialog', () => ({
  showItemDetailModal: vi.fn(),
  showDatePickerDialog: vi.fn(),
  createDialog: vi.fn(),
}));

vi.mock('@/utils/contextMenu', () => ({
  showContextMenu: vi.fn(),
  createItemMenu: vi.fn(() => ({})),
}));

vi.mock('@/utils/eventBus', () => ({
  eventBus: {
    on: vi.fn(() => () => {}),
  },
  Events: {
    POMODORO_RESTORE: 'pomodoro:restore',
  },
}));

vi.mock('@/utils/exampleDocUtils', () => ({
  createExampleDocument: vi.fn(),
}));

vi.mock('@/utils/dayjs', () => ({
  default: () => ({
    format: () => '2026-05-01',
    add: () => ({
      format: () => '2026-05-02',
    }),
  }),
}));

function mountSidebar(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp({
    render() {
      return h(TodoSidebar, props);
    },
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

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('TodoSidebar', () => {
  it('emits drag-start payload for embedded cards when drag support is enabled', async () => {
    const onItemDragStart = vi.fn();
    const mounted = mountSidebar({
      displayMode: 'embedded',
      enableDrag: true,
      onItemDragStart,
    });

    await nextTick();

    const card = mounted.container.querySelector('.todo-list .card') as HTMLDivElement | null;
    expect(card).not.toBeNull();
    expect(card?.getAttribute('draggable')).toBe('true');

    const setData = vi.fn();
    const dragStartEvent = new Event('dragstart', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(dragStartEvent, 'dataTransfer', {
      value: {
        setData,
        effectAllowed: 'none',
      },
      configurable: true,
    });
    card?.dispatchEvent(dragStartEvent);

    expect(onItemDragStart).toHaveBeenCalledTimes(1);
    expect(onItemDragStart).toHaveBeenCalledWith({
      blockId: 'block-1',
      itemId: 'item-1',
      priority: 'high',
    }, dragStartEvent);
    expect(setData).toHaveBeenCalledWith('application/json', JSON.stringify({
      blockId: 'block-1',
      itemId: 'item-1',
      priority: 'high',
    }));
    expect(setData).toHaveBeenCalledWith('text/plain', 'block-1');
    expect((dragStartEvent.dataTransfer as DataTransfer).effectAllowed).toBe('move');

    mounted.unmount();
  });

  it('emits hover payload with the card element as anchor for embedded cards', async () => {
    const onItemHoverStart = vi.fn();
    const onItemHoverEnd = vi.fn();
    const mounted = mountSidebar({
      displayMode: 'embedded',
      onItemHoverStart,
      onItemHoverEnd,
    });

    await nextTick();

    const card = mounted.container.querySelector('.todo-list .card') as HTMLDivElement | null;
    expect(card).not.toBeNull();

    const mouseEnterEvent = new MouseEvent('mouseenter', {
      bubbles: true,
      cancelable: true,
    });
    card?.dispatchEvent(mouseEnterEvent);

    expect(onItemHoverStart).toHaveBeenCalledTimes(1);
    expect(onItemHoverStart).toHaveBeenCalledWith({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl: card,
    }, mouseEnterEvent);

    const mouseLeaveEvent = new MouseEvent('mouseleave', {
      bubbles: true,
      cancelable: true,
    });
    card?.dispatchEvent(mouseLeaveEvent);
    await new Promise(resolve => window.requestAnimationFrame(() => resolve(undefined)));

    expect(onItemHoverEnd).toHaveBeenCalledTimes(1);
    expect(onItemHoverEnd).toHaveBeenCalledWith({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl: card,
    }, mouseLeaveEvent);

    mounted.unmount();
  });

  it('does not emit hover callbacks when previewTriggerMode is click', async () => {
    const onItemHoverStart = vi.fn();
    const onItemHoverEnd = vi.fn();
    const mounted = mountSidebar({
      displayMode: 'embedded',
      previewTriggerMode: 'click',
      onItemHoverStart,
      onItemHoverEnd,
    });

    await nextTick();

    const card = mounted.container.querySelector('.todo-list .card') as HTMLDivElement | null;
    expect(card).not.toBeNull();

    card?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
    card?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, cancelable: true }));
    await new Promise(resolve => window.requestAnimationFrame(() => resolve(undefined)));

    expect(onItemHoverStart).not.toHaveBeenCalled();
    expect(onItemHoverEnd).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('emits preview-click payload and suppresses document open when previewTriggerMode is click', async () => {
    const onItemPreviewClick = vi.fn();
    const mounted = mountSidebar({
      displayMode: 'embedded',
      previewTriggerMode: 'click',
      onItemPreviewClick,
    });

    await nextTick();

    const card = mounted.container.querySelector('.todo-list .card') as HTMLDivElement | null;
    expect(card).not.toBeNull();

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    card?.dispatchEvent(clickEvent);

    expect(onItemPreviewClick).toHaveBeenCalledTimes(1);
    expect(onItemPreviewClick).toHaveBeenCalledWith({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl: card,
    }, clickEvent);
    expect(clickEvent.defaultPrevented).toBe(true);

    mounted.unmount();
  });

  it('does not emit hover callbacks for items without a blockId', async () => {
    const originalBlockId = pendingItem.blockId;
    delete pendingItem.blockId;

    const onItemHoverStart = vi.fn();
    const onItemHoverEnd = vi.fn();
    const mounted = mountSidebar({
      displayMode: 'embedded',
      onItemHoverStart,
      onItemHoverEnd,
    });

    await nextTick();

    const card = mounted.container.querySelector('.todo-list .card') as HTMLDivElement | null;
    card?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    card?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect(onItemHoverStart).not.toHaveBeenCalled();
    expect(onItemHoverEnd).not.toHaveBeenCalled();

    mounted.unmount();
    pendingItem.blockId = originalBlockId;
  });

  it('does not emit hover-end when the pointer moves to a child inside the same card', async () => {
    const onItemHoverEnd = vi.fn();
    const mounted = mountSidebar({
      displayMode: 'embedded',
      onItemHoverEnd,
    });

    await nextTick();

    const card = mounted.container.querySelector('.todo-list .card') as HTMLDivElement | null;
    expect(card).not.toBeNull();

    const child = document.createElement('span');
    card?.appendChild(child);

    const mouseLeaveEvent = new MouseEvent('mouseleave', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(mouseLeaveEvent, 'relatedTarget', {
      value: child,
      configurable: true,
    });

    card?.dispatchEvent(mouseLeaveEvent);

    expect(onItemHoverEnd).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('does not emit hover-end when mouseleave fires but the pointer is still inside the same card bounds', async () => {
    const onItemHoverEnd = vi.fn();
    const mounted = mountSidebar({
      displayMode: 'embedded',
      onItemHoverEnd,
    });

    await nextTick();

    const card = mounted.container.querySelector('.todo-list .card') as HTMLDivElement | null;
    expect(card).not.toBeNull();

    card!.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 100,
      width: 240,
      height: 120,
      top: 100,
      left: 0,
      right: 240,
      bottom: 220,
      toJSON: () => ({}),
    } as DOMRect));

    const outsideTarget = document.createElement('div');
    outsideTarget.className = 'section-label clickable';
    document.body.appendChild(outsideTarget);

    const mouseLeaveEvent = new MouseEvent('mouseleave', {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 180,
    });
    Object.defineProperty(mouseLeaveEvent, 'relatedTarget', {
      value: outsideTarget,
      configurable: true,
    });

    card?.dispatchEvent(mouseLeaveEvent);

    expect(onItemHoverEnd).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('does not emit hover-end when mouseleave fires but the card still matches :hover on the next frame', async () => {
    const onItemHoverEnd = vi.fn();
    const mounted = mountSidebar({
      displayMode: 'embedded',
      onItemHoverEnd,
    });

    await nextTick();

    const card = mounted.container.querySelector('.todo-list .card') as HTMLDivElement | null;
    expect(card).not.toBeNull();

    const originalMatches = card!.matches.bind(card!);
    vi.spyOn(card!, 'matches').mockImplementation((selector: string) => {
      if (selector === ':hover') {
        return true;
      }
      return originalMatches(selector);
    });

    const mouseLeaveEvent = new MouseEvent('mouseleave', {
      bubbles: true,
      cancelable: true,
    });

    card?.dispatchEvent(mouseLeaveEvent);
    await new Promise(resolve => window.requestAnimationFrame(() => resolve(undefined)));

    expect(onItemHoverEnd).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('does not emit hover-end when elementFromPoint resolves to a descendant inside the same card', async () => {
    const onItemHoverEnd = vi.fn();
    const mounted = mountSidebar({
      displayMode: 'embedded',
      onItemHoverEnd,
    });

    await nextTick();

    const card = mounted.container.querySelector('.todo-list .card') as HTMLDivElement | null;
    expect(card).not.toBeNull();

    const button = document.createElement('span');
    button.className = 'block__icon';
    card?.appendChild(button);

    vi.spyOn(document, 'elementFromPoint').mockReturnValue(button);

    const originalMatches = card!.matches.bind(card!);
    vi.spyOn(card!, 'matches').mockImplementation((selector: string) => {
      if (selector === ':hover') {
        return false;
      }
      return originalMatches(selector);
    });

    const outsideTarget = document.createElement('div');
    outsideTarget.className = 'quadrant-panel__header';
    document.body.appendChild(outsideTarget);

    const mouseLeaveEvent = new MouseEvent('mouseleave', {
      bubbles: true,
      cancelable: true,
      clientX: 80,
      clientY: 120,
    });
    Object.defineProperty(mouseLeaveEvent, 'relatedTarget', {
      value: outsideTarget,
      configurable: true,
    });

    card?.dispatchEvent(mouseLeaveEvent);
    await new Promise(resolve => window.requestAnimationFrame(() => resolve(undefined)));

    expect(onItemHoverEnd).not.toHaveBeenCalled();

    mounted.unmount();
  });

  it('does not emit hover-end when elementFromPoint resolves inside a native block popover', async () => {
    const onItemHoverEnd = vi.fn();
    const mounted = mountSidebar({
      displayMode: 'embedded',
      onItemHoverEnd,
    });

    await nextTick();

    const card = mounted.container.querySelector('.todo-list .card') as HTMLDivElement | null;
    expect(card).not.toBeNull();

    const popover = document.createElement('div');
    popover.className = 'block__popover block__popover--open';
    const popoverContent = document.createElement('div');
    popoverContent.className = 'fn__flex-1';
    popover.appendChild(popoverContent);
    document.body.appendChild(popover);

    vi.spyOn(document, 'elementFromPoint').mockReturnValue(popoverContent);

    const originalMatches = card!.matches.bind(card!);
    vi.spyOn(card!, 'matches').mockImplementation((selector: string) => {
      if (selector === ':hover') {
        return false;
      }
      return originalMatches(selector);
    });

    const outsideTarget = document.createElement('div');
    outsideTarget.className = 'quadrant-panel__header';
    document.body.appendChild(outsideTarget);

    const mouseLeaveEvent = new MouseEvent('mouseleave', {
      bubbles: true,
      cancelable: true,
      clientX: 80,
      clientY: 120,
    });
    Object.defineProperty(mouseLeaveEvent, 'relatedTarget', {
      value: outsideTarget,
      configurable: true,
    });

    card?.dispatchEvent(mouseLeaveEvent);
    await new Promise(resolve => window.requestAnimationFrame(() => resolve(undefined)));

    expect(onItemHoverEnd).not.toHaveBeenCalled();

    mounted.unmount();
  });
});
