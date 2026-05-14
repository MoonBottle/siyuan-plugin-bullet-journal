// @vitest-environment happy-dom

import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockShowFocusPlanDialog = vi.fn();

vi.mock('@/stores', () => ({
  usePomodoroStore: () => ({
    isFocusing: false,
  }),
}));

vi.mock('@/main', () => ({
  usePlugin: () => ({
    openCustomTab: vi.fn(),
  }),
}));

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'todo') {
      return {
        complete: '完成',
        startFocusAria: '开始专注',
        abandon: '放弃',
        openDoc: '打开文档',
        calendar: '日历',
        migrateToToday: '迁移到今天',
        migrateToTomorrow: '迁移到明天',
      };
    }
    if (key === 'focusPlan') {
      return {
        setAction: '设置预计',
        editAction: '修改预计',
      };
    }
    if (key === 'statusTag') {
      return {
        completed: '#完成',
        abandoned: '#放弃',
      };
    }
    return {};
  }),
}));

vi.mock('@/utils/dialog', () => ({
  hideIconTooltip: vi.fn(),
  showIconTooltip: vi.fn(),
  showPomodoroTimerDialog: vi.fn(),
  showFocusPlanDialog: mockShowFocusPlanDialog,
}));

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
  updateBlockContent: vi.fn(),
  updateBlockDateTime: vi.fn(),
}));

async function mountComponent(item: any) {
  const { default: ItemActionBar } = await import('@/components/todo/ItemActionBar.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(ItemActionBar, { item });
  app.mount(container);
  await nextTick();

  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('ItemActionBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T08:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows set-focus-plan action and opens dialog for the current item', async () => {
    const mounted = await mountComponent({
      id: 'item-1',
      blockId: 'block-1',
      content: '整理日报',
      date: '2026-05-14',
      status: 'pending',
    });

    const buttons = [...mounted.container.querySelectorAll('.block__icon')];
    const planButton = buttons.find(node => node.getAttribute('aria-label') === '设置预计');
    expect(planButton).toBeTruthy();

    (planButton as HTMLElement).click();

    expect(mockShowFocusPlanDialog).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-1' }),
    );

    mounted.unmount();
  });
});
